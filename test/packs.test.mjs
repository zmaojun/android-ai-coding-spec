import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import {
  loadCatalog,
  loadRegistry,
  resolvePacks,
  validateRegistry,
} from "../lib/catalog.mjs";
import { diagnose } from "../lib/doctor.mjs";
import { pathExists, sha256 } from "../lib/files.mjs";
import { installOrUpdate, uninstall } from "../lib/installer.mjs";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, "..");

async function withProject(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "android-ai-coding-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("core、android、android-medical 默认无血糖且 SmartPro 包含", async () => {
  const expected = {
    core: ["core"],
    android: ["core", "android"],
    "android-medical": ["core", "android", "android-medical"],
    smartpro: ["core", "android", "android-medical", "domain-glucose", "smartpro"],
  };
  for (const [profile, packs] of Object.entries(expected)) {
    const loaded = await loadCatalog({ profile });
    assert.deepEqual(loaded.packs, packs);
    assert.equal(
      loaded.catalog.has(".cursor/skills/flow-glucose-domain/SKILL.md"),
      profile === "smartpro",
    );
  }
  const registry = await loadRegistry();
  assert.deepEqual(registry.profiles.smartpro.packs, ["domain-glucose", "smartpro"]);
  assert.deepEqual(registry.packs.smartpro.dependencies, ["android-medical"]);
});

test("附加 pack 自动展开依赖", async () => {
  const loaded = await loadCatalog({
    profile: "android-medical",
    additionalPacks: ["domain-glucose"],
  });
  assert.deepEqual(loaded.packs, [
    "core",
    "android",
    "android-medical",
    "domain-glucose",
  ]);
});

test("显式 packs 仍补全依赖并拒绝未知项", async () => {
  const loaded = await loadCatalog({ packs: ["domain-glucose"] });
  assert.deepEqual(loaded.packs, [
    "core",
    "android",
    "android-medical",
    "domain-glucose",
  ]);
  await assert.rejects(loadCatalog({ packs: ["unknown"] }), /Unknown pack/);
  const cyclic = await loadRegistry();
  cyclic.packs.core.dependencies = ["android"];
  await assert.rejects(
    loadCatalog({ packs: ["android"], registry: cyclic }),
    /cycle/,
  );
});

test("依赖解析拒绝未知 pack 与循环", async () => {
  const registry = await loadRegistry();
  assert.throws(() => resolvePacks(registry, ["missing"]), /Unknown pack/);
  const cyclic = structuredClone(registry);
  cyclic.packs.core.dependencies = ["android"];
  assert.throws(() => resolvePacks(cyclic, ["android"]), /cycle/);
});

test("Pack 使用静态 SemVer 且产品版本与 package 一致", async () => {
  const registry = await loadRegistry();
  const packageJson = await readJson(path.join(packageRoot, "package.json"));
  assert.equal(registry.productVersion, packageJson.version);
  assert.deepEqual(registry.rulesWhitelist, [
    ".cursor/rules/eng-ai-coding-workflow.mdc",
    ".cursor/rules/eng-ai-coding-android.mdc",
    ".cursor/rules/domain-ai-coding-medical.mdc",
  ]);
  for (const pack of Object.values(registry.packs)) {
    assert.match(pack.version, /^\d+\.\d+\.\d+(?:[-+].+)?$/u);
  }
  const invalid = structuredClone(registry);
  invalid.packs.android.version = "latest";
  assert.throws(() => validateRegistry(invalid), /Invalid pack declaration/);
});

test("内容冲突必须显式声明 override", async () => {
  const registry = await loadRegistry();
  const invalid = structuredClone(registry);
  invalid.packs.smartpro.overrides = [];
  await assert.rejects(
    loadCatalog({ profile: "smartpro", registry: invalid }),
    /declare an override/,
  );
});

test("未托管同路径文件不被接管", async () => {
  await withProject(async (directory) => {
    const relativePath = ".cursor/commands/ai-analyze.md";
    const destination = path.join(directory, ...relativePath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, "用户文件\n");
    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    assert.ok(summary.conflicts.includes(relativePath));
    assert.equal(await readFile(destination, "utf8"), "用户文件\n");
  });
});

test("schema v2 记录 Pack 版本与文件来源", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    const state = path.join(directory, ".ai-coding");
    const config = await readJson(path.join(state, "config.json"));
    const lock = await readJson(path.join(state, "manifest.lock.json"));
    assert.deepEqual(config.packVersions, lock.packVersions);
    assert.deepEqual(Object.keys(config.packVersions), config.packs);
    assert.equal(
      lock.files.find((entry) =>
        entry.path === ".cursor/skills/flow-glucose-domain/SKILL.md").source,
      "domain-glucose",
    );
    assert.equal(
      lock.files.find((entry) =>
        entry.path === "docs/ai-coding/governance/project.md").source,
      "smartpro",
    );
    assert.ok(lock.files.every((entry) => typeof entry.source === "string"));
  });
});

test("修改过的托管文件 update 冲突且 uninstall 保留", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    const relativePath = ".cursor/skills/flow-glucose-domain/SKILL.md";
    const destination = path.join(directory, ...relativePath.split("/"));
    await writeFile(destination, "本地定制\n");
    const update = await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "update",
    });
    assert.ok(update.conflicts.includes(relativePath));
    assert.equal(await readFile(destination, "utf8"), "本地定制\n");
    const removal = await uninstall({ targetDirectory: directory });
    assert.ok(removal.preserved.includes(relativePath));
    assert.equal(await pathExists(destination), true);
  });
});

test("update 幂等", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "android",
      command: "init",
    });
    const first = await installOrUpdate({
      targetDirectory: directory,
      profile: "android",
      command: "update",
    });
    const second = await installOrUpdate({
      targetDirectory: directory,
      profile: "android",
      packs: ["core", "android"],
      command: "update",
    });
    assert.equal(first.written.length, 0);
    assert.equal(first.conflicts.length, 0);
    assert.equal(second.written.length, 0);
    assert.equal(second.conflicts.length, 0);
  });
});

test("schema v1 状态可诊断并迁移到 v2", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    const state = path.join(directory, ".ai-coding");
    const currentLock = await readJson(path.join(state, "manifest.lock.json"));
    await writeFile(
      path.join(state, "config.json"),
      `${JSON.stringify({
        version: "1.0.0",
        managedBy: "android-ai-coding-kit",
        profile: "core",
        commandStyle: "cursor-slash-commands",
      }, null, 2)}\n`,
    );
    const customizedPath = path.join(
      directory,
      ".cursor",
      "commands",
      "ai-analyze.md",
    );
    await writeFile(customizedPath, "旧版用户定制\n");
    await writeFile(
      path.join(state, "manifest.lock.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        kitVersion: "1.0.0",
        profile: "core",
        files: currentLock.files.map(({ path: filePath, hash }) => ({
          path: filePath,
          hash,
        })),
      }, null, 2)}\n`,
    );

    const before = await diagnose(directory);
    assert.ok(before.some((result) => result.code === "LEGACY_SCHEMA"));
    assert.equal(before.some((result) => result.code === "PACK_VERSION"), false);
    assert.equal(before.some((result) => result.level === "fail"), false);

    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "update",
    });
    const config = await readJson(path.join(state, "config.json"));
    const lock = await readJson(path.join(state, "manifest.lock.json"));
    assert.equal(config.schemaVersion, 2);
    assert.equal(config.product, "android-ai-coding");
    assert.equal(lock.schemaVersion, 2);
    assert.deepEqual(lock.packs, ["core"]);
    assert.deepEqual(config.packVersions, { core: "1.1.0" });
    assert.deepEqual(lock.packVersions, { core: "1.1.0" });
    assert.ok(summary.conflicts.includes(".cursor/commands/ai-analyze.md"));
    assert.equal(
      lock.files.find((entry) => entry.path === ".cursor/commands/ai-analyze.md").source,
      "legacy",
    );
    assert.ok(
      lock.files
        .filter((entry) => entry.path !== ".cursor/commands/ai-analyze.md")
        .every((entry) => entry.source === "core"),
    );
  });
});

test("doctor 报告 pack、profile、rule、软依赖与平行治理问题", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    let results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "SOFTDEP_MISSING"));
    assert.ok(results.some((result) => result.code === "WORKFLOW_READY"));

    const state = path.join(directory, ".ai-coding");
    const configPath = path.join(state, "config.json");
    const config = await readJson(configPath);
    config.packVersions.core = "9.9.9";
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "PACK_VERSION"));
    config.packVersions.core = "1.1.0";
    config.packs = ["core", "unknown"];
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "PACK_MISSING"));

    config.packs = ["core"];
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "PROFILE_PACK"));

    const lockPath = path.join(state, "manifest.lock.json");
    const lock = await readJson(lockPath);
    lock.files.push({
      path: ".cursor/rules/project-private.mdc",
      hash: sha256("private\n"),
    });
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    await mkdir(path.join(directory, ".cursor", "rules"), { recursive: true });
    await writeFile(
      path.join(directory, ".cursor", "rules", "project-private.mdc"),
      "private\n",
    );
    await mkdir(path.join(directory, ".ai"), { recursive: true });
    await writeFile(path.join(directory, ".ai", "quality-gate.md"), "legacy\n");
    await rm(
      path.join(directory, ".cursor", "skills", "ai-coding", "SKILL.md"),
    );
    await mkdir(
      path.join(directory, ".cursor", "skills", "ai-coding-unused"),
      { recursive: true },
    );
    results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "RULE_LEAK"));
    assert.ok(results.some((result) => result.code === "PARALLEL_GOVERNANCE"));
    assert.equal(
      results.filter((result) => result.code === "EMPTY_SKILL_DIRECTORY").length,
      2,
    );
  });
});

test("空 OpenSpec active 被清理，非空目录保留并报告", async () => {
  await withProject(async (directory) => {
    const active = path.join(directory, "openspec", "changes", "active");
    await mkdir(active, { recursive: true });
    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    assert.ok(summary.removedDirectories.includes("openspec/changes/active"));
    await mkdir(active, { recursive: true });
    await writeFile(path.join(active, "proposal.md"), "legacy\n");
    await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "update",
    });
    assert.equal(await pathExists(active), true);
    const results = await diagnose(directory);
    assert.ok(results.some((result) => result.code === "OPENSPEC_LEGACY_LAYOUT"));
  });
});

test("update 清理空的旧阶段 Skill 目录并保留非空目录", async () => {
  await withProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    const skills = path.join(directory, ".cursor", "skills");
    const emptyLegacy = path.join(skills, "ai-coding-plan");
    const populatedLegacy = path.join(skills, "ai-coding-review");
    await mkdir(emptyLegacy, { recursive: true });
    await mkdir(populatedLegacy, { recursive: true });
    await writeFile(path.join(populatedLegacy, "README.md"), "保留\n");

    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "update",
    });

    assert.ok(
      summary.removedDirectories.includes(
        ".cursor/skills/ai-coding-plan",
      ),
    );
    assert.equal(await pathExists(emptyLegacy), false);
    assert.equal(await pathExists(populatedLegacy), true);
  });
});

test("CLI help、profiles、packs 可执行且九命令完整", async () => {
  for (const args of [["--help"], ["profiles"], ["packs"]]) {
    const { stdout } = await execFileAsync(
      process.execPath,
      [path.join(packageRoot, "bin", "android-ai-coding.mjs"), ...args],
      { cwd: packageRoot },
    );
    assert.ok(stdout.trim().length > 0);
  }
  const loaded = await loadCatalog({ profile: "core" });
  const commands = [...loaded.catalog.keys()].filter(
    (relativePath) => relativePath.startsWith(".cursor/commands/ai-"),
  );
  assert.equal(commands.length, 9);
});
