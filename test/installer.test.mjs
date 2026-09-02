import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { diagnose } from "../lib/doctor.mjs";
import { installOrUpdate, uninstall } from "../lib/installer.mjs";
import { pathExists } from "../lib/files.mjs";

async function withTemporaryProject(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ai-coding-kit-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const criticalManagedDocuments = [
  ".cursor/skills/ai-coding/SKILL.md",
  "docs/ai-coding/governance/constitution.md",
  "docs/ai-coding/governance/decision-boundaries.md",
  "docs/ai-coding/governance/domain-boundaries.md",
  "docs/ai-coding/governance/project.md",
  "docs/ai-coding/governance/quality-gate.md",
  "docs/ai-coding/guides/asset-map.md",
  "docs/ai-coding/templates/analysis-plan.md",
  "docs/ai-coding/templates/change-checklist.md",
  "docs/ai-coding/templates/delivery.md",
];

const smartproGlucoseAssets = [
  ".cursor/skills/flow-glucose-domain/SKILL.md",
  ".cursor/skills/flow-glucose-measurement/SKILL.md",
  ".cursor/skills/flow-glucose-orders/SKILL.md",
  "docs/ai-coding/guides/glucose-skill-pack.md",
];

const legacyManagedDocuments = [
  "android-boundaries.md",
  "constitution.md",
  "decision-boundaries.md",
  "domain-boundaries.md",
  "project.md",
  "quality-gate.md",
].map((fileName) => path.posix.join(".ai", fileName));

const legacyEnglishText = [
  /^# AI Coding Constitution$/m,
  /^# AI Decision Boundaries$/m,
  /^# SmartPro AI Coding Profile$/m,
  /^## Authority$/m,
  /^## Requirement$/m,
  /Use this order when instructions conflict/,
  /A change is complete only when/,
  /Human design and review are mandatory/,
];

test("installs a complete SmartPro workflow", async () => {
  await withTemporaryProject(async (directory) => {
    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });

    assert.ok(summary.written.length > 10);
    assert.equal(summary.conflicts.length, 0);
    assert.equal(
      await pathExists(path.join(directory, ".cursor", "commands", "ai-design.md")),
      true,
    );
    assert.match(
      await readFile(
        path.join(
          directory,
          "docs",
          "ai-coding",
          "governance",
          "project.md",
        ),
        "utf8",
      ),
      /SmartPro AI Coding 项目配置/,
    );
    for (const relativePath of criticalManagedDocuments) {
      const installedPath = path.join(directory, ...relativePath.split("/"));
      assert.equal(await pathExists(installedPath), true, relativePath);
      const content = await readFile(installedPath, "utf8");
      assert.match(content, /[\u3400-\u9fff]/u, relativePath);
      for (const pattern of legacyEnglishText) {
        assert.doesNotMatch(content, pattern, `${relativePath}: ${pattern}`);
      }
    }
    for (const relativePath of smartproGlucoseAssets) {
      const installedPath = path.join(directory, ...relativePath.split("/"));
      assert.equal(await pathExists(installedPath), true, relativePath);
      const content = await readFile(installedPath, "utf8");
      assert.match(content, /[\u3400-\u9fff]/u, relativePath);
      if (relativePath.endsWith("/SKILL.md")) {
        const skillName = path.posix.basename(path.posix.dirname(relativePath));
        assert.match(content, new RegExp(`^name: ${skillName}$`, "m"));
        assert.match(content, /^description:\s*>-/m, relativePath);
        assert.match(content, /Use when/, relativePath);
        assert.match(
          content,
          /^disable-model-invocation: true$/m,
          relativePath,
        );
        assert.ok(content.split(/\r?\n/u).length < 500, relativePath);
      }
    }
    for (const relativePath of legacyManagedDocuments) {
      const installedPath = path.join(directory, ...relativePath.split("/"));
      assert.equal(await pathExists(installedPath), false, relativePath);
    }

    const results = await diagnose(directory);
    assert.equal(
      results.some((result) => result.level === "fail"),
      false,
    );
  });
});

test("preserves locally modified managed files", async () => {
  await withTemporaryProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    const managedPath = path.join(
      directory,
      ".cursor",
      "skills",
      "flow-glucose-domain",
      "SKILL.md",
    );
    await writeFile(managedPath, "project customization\n");

    const updateSummary = await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "update",
    });
    assert.deepEqual(updateSummary.conflicts, [
      ".cursor/skills/flow-glucose-domain/SKILL.md",
    ]);
    assert.equal(await readFile(managedPath, "utf8"), "project customization\n");

    const uninstallSummary = await uninstall({ targetDirectory: directory });
    assert.ok(
      uninstallSummary.preserved.includes(
        ".cursor/skills/flow-glucose-domain/SKILL.md",
      ),
    );
    assert.equal(await pathExists(managedPath), true);
  });
});

test("update is idempotent for unchanged installations", async () => {
  await withTemporaryProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    const updateSummary = await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "update",
    });

    assert.equal(updateSummary.written.length, 0);
    assert.equal(updateSummary.conflicts.length, 0);
    assert.ok(updateSummary.unchanged.length > 10);
    for (const relativePath of smartproGlucoseAssets) {
      assert.ok(updateSummary.unchanged.includes(relativePath), relativePath);
    }
  });
});

test("does not install SmartPro glucose assets for other profiles", async () => {
  for (const profile of ["core", "android-medical"]) {
    await withTemporaryProject(async (directory) => {
      await installOrUpdate({
        targetDirectory: directory,
        profile,
        command: "init",
      });
      for (const relativePath of smartproGlucoseAssets) {
        assert.equal(
          await pathExists(path.join(directory, ...relativePath.split("/"))),
          false,
          `${profile}: ${relativePath}`,
        );
      }
    });
  }
});

test("update migrates unchanged legacy governance documents", async () => {
  await withTemporaryProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "init",
    });
    const lockPath = path.join(
      directory,
      ".ai-coding",
      "manifest.lock.json",
    );
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    const governancePrefix = "docs/ai-coding/governance/";
    for (const entry of lock.files) {
      if (!entry.path.startsWith(governancePrefix)) {
        continue;
      }
      const currentPath = path.join(directory, ...entry.path.split("/"));
      const legacyPath = path.posix.join(".ai", path.posix.basename(entry.path));
      const legacyDestination = path.join(
        directory,
        ...legacyPath.split("/"),
      );
      await mkdir(path.dirname(legacyDestination), { recursive: true });
      await writeFile(legacyDestination, await readFile(currentPath));
      await rm(currentPath);
      entry.path = legacyPath;
    }
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "smartpro",
      command: "update",
    });

    assert.deepEqual(
      [...summary.removed].sort(),
      [...legacyManagedDocuments].sort(),
    );
    for (const relativePath of criticalManagedDocuments) {
      assert.equal(
        await pathExists(path.join(directory, ...relativePath.split("/"))),
        true,
        relativePath,
      );
    }
    for (const relativePath of legacyManagedDocuments) {
      assert.equal(
        await pathExists(path.join(directory, ...relativePath.split("/"))),
        false,
        relativePath,
      );
    }
  });
});

test("doctor reports only populated legacy OpenSpec active directories", async () => {
  await withTemporaryProject(async (directory) => {
    await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    const activeDirectory = path.join(
      directory,
      "openspec",
      "changes",
      "active",
    );
    await mkdir(activeDirectory, { recursive: true });
    let results = await diagnose(directory);
    assert.equal(
      results.some((result) => result.code === "OPENSPEC_LEGACY_LAYOUT"),
      false,
    );

    await writeFile(path.join(activeDirectory, "README.md"), "legacy\n");
    results = await diagnose(directory);
    assert.equal(
      results.some((result) => result.code === "OPENSPEC_LEGACY_LAYOUT"),
      true,
    );
  });
});

test("install removes only an empty legacy OpenSpec active directory", async () => {
  await withTemporaryProject(async (directory) => {
    const activeDirectory = path.join(
      directory,
      "openspec",
      "changes",
      "active",
    );
    await mkdir(activeDirectory, { recursive: true });
    const summary = await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "init",
    });
    assert.deepEqual(summary.removedDirectories, [
      "openspec/changes/active",
    ]);
    assert.equal(await pathExists(activeDirectory), false);

    await mkdir(activeDirectory, { recursive: true });
    await writeFile(path.join(activeDirectory, "README.md"), "keep\n");
    await installOrUpdate({
      targetDirectory: directory,
      profile: "core",
      command: "update",
    });
    assert.equal(await pathExists(activeDirectory), true);
  });
});
