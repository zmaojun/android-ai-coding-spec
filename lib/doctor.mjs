import path from "node:path";
import { readdir } from "node:fs/promises";
import {
  KIT_VERSION,
  PRODUCT_NAME,
  loadCatalog,
  loadRegistry,
  profileRootPacks,
  resolvePacks,
} from "./catalog.mjs";
import { hashFile, pathExists, readJson } from "./files.mjs";

const REQUIRED_COMMANDS = [
  "ai-analyze",
  "ai-plan",
  "ai-design",
  "ai-implement",
  "ai-review",
  "ai-test",
  "ai-fix",
  "ai-refactor",
  "ai-deliver",
];

const LEGACY_RULES = [
  "00-project.mdc",
  "01-android-java.mdc",
  "02-medical.mdc",
  "03-security.mdc",
  "04-device.mdc",
  "05-sync.mdc",
  "06-oop-quality.mdc",
  "07-ai-workflow.mdc",
  "ai-coding-core.mdc",
  "ai-coding-architecture.mdc",
  "ai-coding-quality.mdc",
  "ai-coding-security.mdc",
  "ai-coding-governance.mdc",
  "ai-coding-android-medical.mdc",
];

function check(level, code, message) {
  return { level, code, message };
}

async function directoryIsEmpty(directory) {
  return (await pathExists(directory)) && (await readdir(directory)).length === 0;
}

export async function diagnose(targetDirectory) {
  const targetRoot = path.resolve(targetDirectory);
  const results = [];
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  results.push(
    nodeMajor >= 20
      ? check("pass", "NODE_VERSION", `Node ${process.versions.node}`)
      : check("fail", "NODE_VERSION", "Node 20 or newer is required."),
  );

  const config = await readJson(
    path.join(targetRoot, ".ai-coding", "config.json"),
  );
  const lock = await readJson(
    path.join(targetRoot, ".ai-coding", "manifest.lock.json"),
  );
  if (!config || !lock) {
    results.push(
      check("fail", "INSTALL_STATE", "请先运行 `android-ai-coding init`。"),
    );
    return results;
  }

  const legacySchema =
    (config.schemaVersion === undefined || config.schemaVersion === 1) &&
    config.managedBy === "android-ai-coding-kit" &&
    (lock.schemaVersion === undefined || lock.schemaVersion === 1);
  const currentSchema =
    config.schemaVersion === 2 &&
    config.product === PRODUCT_NAME &&
    lock.schemaVersion === 2 &&
    lock.product === PRODUCT_NAME;
  if (!legacySchema && !currentSchema) {
    results.push(check("fail", "INSTALL_STATE", "无法识别 .ai-coding 状态格式。"));
    return results;
  }
  if (legacySchema) {
    results.push(
      check("warn", "LEGACY_SCHEMA", "检测到 schema v1；运行 update 可安全迁移到 schema v2。"),
    );
  }

  results.push(
    check(
      config.version === KIT_VERSION ? "pass" : "warn",
      "KIT_VERSION",
      `Installed ${config.version}; CLI ${KIT_VERSION}.`,
    ),
  );

  let registry;
  let selectedPacks = [];
  let catalog = new Map();
  try {
    registry = await loadRegistry();
    results.push(check("pass", "REGISTRY", "Pack 注册表有效。"));
    const expectedProfilePacks = resolvePacks(
      registry,
      profileRootPacks(registry, config.profile),
    );
    const configuredPacks = legacySchema ? expectedProfilePacks : config.packs ?? [];
    for (const packName of configuredPacks) {
      if (!registry.packs[packName]) {
        results.push(check("fail", "PACK_MISSING", packName));
      }
    }
    selectedPacks = results.some((result) => result.code === "PACK_MISSING")
      ? configuredPacks
      : resolvePacks(registry, configuredPacks);
    if (!legacySchema) {
      const missingProfilePacks = expectedProfilePacks.filter(
        (packName) => !selectedPacks.includes(packName),
      );
      if (missingProfilePacks.length > 0) {
        results.push(
          check("fail", "PROFILE_PACK", `Profile 缺少: ${missingProfilePacks.join(", ")}`),
        );
      }
      for (const packName of selectedPacks) {
        const expectedVersion = registry.packs[packName]?.version;
        const configVersion = config.packVersions?.[packName];
        const lockVersion = lock.packVersions?.[packName];
        if (expectedVersion &&
            (configVersion !== expectedVersion || lockVersion !== expectedVersion)) {
          results.push(
            check(
              "warn",
              "PACK_VERSION",
              `${packName}: config=${configVersion ?? "缺失"}, manifest=${lockVersion ?? "缺失"}, registry=${expectedVersion}`,
            ),
          );
        }
      }
    }
    if (!results.some((result) => result.code === "PACK_MISSING")) {
      const loaded = await loadCatalog({ profile: config.profile, packs: selectedPacks });
      catalog = loaded.catalog;
    }
  } catch (error) {
    const code = error.message.startsWith("RULE_LEAK")
      ? "RULE_LEAK"
      : error.message.startsWith("Pack assets missing")
        ? "PACK_MISSING"
        : "REGISTRY";
    results.push(check("fail", code, error.message));
  }

  const lockFiles = new Map((lock.files ?? []).map((entry) => [entry.path, entry]));
  const filesToCheck = legacySchema
    ? new Map((lock.files ?? []).map((entry) => [entry.path, { hash: entry.hash }]))
    : catalog;
  for (const [relativePath, asset] of filesToCheck) {
    const destination = path.join(targetRoot, ...relativePath.split("/"));
    if (!(await pathExists(destination))) {
      results.push(check("fail", "MANAGED_FILE_MISSING", relativePath));
      continue;
    }
    const currentHash = await hashFile(destination);
    const lockEntry = lockFiles.get(relativePath);
    if (!lockEntry) {
      results.push(check("warn", "LOCK_ENTRY_MISSING", relativePath));
    } else if (currentHash !== lockEntry.hash) {
      results.push(check("warn", "MANAGED_FILE_MODIFIED", relativePath));
    } else if (!legacySchema && asset.hash !== lockEntry.hash) {
      results.push(check("warn", "UPDATE_AVAILABLE", relativePath));
    }
  }

  const rulesWhitelist = new Set(registry?.rulesWhitelist ?? []);
  for (const entry of lock.files ?? []) {
    if (entry.path.startsWith(".cursor/rules/") && !rulesWhitelist.has(entry.path)) {
      results.push(check("fail", "RULE_LEAK", entry.path));
    }
  }

  if (registry) {
    for (const packName of selectedPacks ?? []) {
      const pack = registry.packs[packName];
      for (const dependency of pack?.softDependencies ?? []) {
        const dependencyPath = path.join(targetRoot, ...dependency.path.split("/"));
        if (!(await pathExists(dependencyPath))) {
          results.push(
            check("warn", "SOFTDEP_MISSING", `${packName}: ${dependency.name}`),
          );
        }
      }
    }
  }

  for (const command of REQUIRED_COMMANDS) {
    const commandPath = path.join(
      targetRoot,
      ".cursor",
      "commands",
      `${command}.md`,
    );
    if (!(await pathExists(commandPath))) {
      results.push(check("fail", "COMMAND_MISSING", command));
    }
  }

  const activeCompatibilityPath = path.join(
    targetRoot,
    "openspec",
    "changes",
    "active",
  );
  if (
    (await pathExists(activeCompatibilityPath)) &&
    (await readdir(activeCompatibilityPath)).length > 0
  ) {
    results.push(
      check(
        "warn",
        "OPENSPEC_LEGACY_LAYOUT",
        "Move active changes to openspec/changes/<change>; `active` is treated as a change by the OpenSpec CLI.",
      ),
    );
  }

  const rulesDirectory = path.join(targetRoot, ".cursor", "rules");
  const foundLegacyRules = [];
  for (const fileName of LEGACY_RULES) {
    if (await pathExists(path.join(rulesDirectory, fileName))) {
      foundLegacyRules.push(fileName);
    }
  }
  if (foundLegacyRules.length > 0) {
    results.push(
      check(
        "warn",
        "LEGACY_RULES",
        `Consolidate duplicate rules: ${foundLegacyRules.join(", ")}`,
      ),
    );
  }

  const parallelGovernance = path.join(targetRoot, ".ai");
  if ((await pathExists(parallelGovernance)) &&
      (await readdir(parallelGovernance)).length > 0) {
    results.push(
      check("warn", "PARALLEL_GOVERNANCE", "发现平行 .ai 治理副本，请人工确认并合并。"),
    );
  }

  const skillsDirectory = path.join(
    targetRoot,
    ".cursor",
    "skills",
  );
  if (await pathExists(skillsDirectory)) {
    const skillEntries = await readdir(skillsDirectory, { withFileTypes: true });
    for (const entry of skillEntries) {
      if (entry.isDirectory() &&
          (entry.name === "ai-coding" || entry.name.startsWith("ai-coding-")) &&
          await directoryIsEmpty(path.join(skillsDirectory, entry.name))) {
        results.push(
          check(
            "warn",
            "EMPTY_SKILL_DIRECTORY",
            `.cursor/skills/${entry.name} 为空目录。`,
          ),
        );
      }
    }
  }

  if (!results.some((result) => result.level === "fail")) {
    results.push(check("pass", "WORKFLOW_READY", "AI Coding workflow is ready."));
  }
  return results;
}
