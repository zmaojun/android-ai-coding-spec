import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  KIT_VERSION,
  PRODUCT_NAME,
  loadCatalog,
} from "./catalog.mjs";
import {
  hashFile,
  pathExists,
  readJson,
  removeFileAndEmptyParents,
  writeFileAtomic,
  writeJsonAtomic,
} from "./files.mjs";

const STATE_DIRECTORY = ".ai-coding";
const LOCK_FILE = "manifest.lock.json";
const CONFIG_FILE = "config.json";

function statePath(targetDirectory, fileName) {
  return path.join(targetDirectory, STATE_DIRECTORY, fileName);
}

function toNativePath(targetDirectory, relativePath) {
  const segments = relativePath.split("/");
  const resolved = path.resolve(targetDirectory, ...segments);
  const targetRoot = path.resolve(targetDirectory);
  if (resolved !== targetRoot && !resolved.startsWith(`${targetRoot}${path.sep}`)) {
    throw new Error(`Unsafe managed path: ${relativePath}`);
  }
  return resolved;
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-");
}

function isRecognizedInstallation(config, lock) {
  const current = config?.schemaVersion === 2 &&
    config.product === PRODUCT_NAME &&
    lock?.schemaVersion === 2 &&
    lock.product === PRODUCT_NAME;
  const legacy = (config?.schemaVersion === undefined || config?.schemaVersion === 1) &&
    config?.managedBy === "android-ai-coding-kit" &&
    (lock?.schemaVersion === undefined || lock?.schemaVersion === 1);
  return current || legacy;
}

function managedEntry(pathValue, hash, source) {
  return { path: pathValue, hash, source };
}

function preserveEntry(entry) {
  return managedEntry(entry.path, entry.hash, entry.source ?? "legacy");
}

export async function installOrUpdate({
  targetDirectory,
  profile,
  additionalPacks = [],
  packs,
  command,
}) {
  const targetRoot = path.resolve(targetDirectory);
  const configPath = statePath(targetRoot, CONFIG_FILE);
  const previousConfig = await readJson(configPath);
  const previousLockValue = await readJson(statePath(targetRoot, LOCK_FILE));
  if ((previousConfig || previousLockValue) &&
      !isRecognizedInstallation(previousConfig, previousLockValue)) {
    throw new Error("Unrecognized .ai-coding installation state; refusing to claim files.");
  }
  const previousLock = previousLockValue ?? { files: [] };
  const loaded = await loadCatalog({ profile, additionalPacks, packs });
  const { catalog } = loaded;
  const packVersions = Object.fromEntries(
    loaded.packs.map((packName) => [
      packName,
      loaded.registry.packs[packName].version,
    ]),
  );
  const previousFiles = new Map(
    (previousLock.files ?? []).map((entry) => [entry.path, entry]),
  );
  const nextFiles = [];
  const summary = {
    written: [],
    unchanged: [],
    removed: [],
    conflicts: [],
    preserved: [],
    removedDirectories: [],
  };
  const incomingRoot = path.join(
    targetRoot,
    STATE_DIRECTORY,
    "incoming",
    timestamp(),
  );

  for (const [relativePath, asset] of catalog) {
    const destination = toNativePath(targetRoot, relativePath);
    const previous = previousFiles.get(relativePath);

    if (!(await pathExists(destination))) {
      await writeFileAtomic(destination, asset.content);
      summary.written.push(relativePath);
      nextFiles.push(managedEntry(relativePath, asset.hash, asset.pack));
      continue;
    }

    const currentHash = await hashFile(destination);
    if (previous && currentHash === asset.hash) {
      summary.unchanged.push(relativePath);
      nextFiles.push(managedEntry(relativePath, asset.hash, asset.pack));
      continue;
    }

    if (previous && currentHash === previous.hash) {
      await writeFileAtomic(destination, asset.content);
      summary.written.push(relativePath);
      nextFiles.push(managedEntry(relativePath, asset.hash, asset.pack));
      continue;
    }

    const incomingPath = toNativePath(incomingRoot, relativePath);
    await writeFileAtomic(incomingPath, asset.content);
    summary.conflicts.push(relativePath);
    if (previous) {
      nextFiles.push(preserveEntry(previous));
    }
  }

  if (command === "update") {
    for (const previous of previousLock.files ?? []) {
      if (catalog.has(previous.path)) {
        continue;
      }
      const destination = toNativePath(targetRoot, previous.path);
      if (!(await pathExists(destination))) {
        continue;
      }
      if ((await hashFile(destination)) === previous.hash) {
        await removeFileAndEmptyParents(destination, targetRoot);
        summary.removed.push(previous.path);
      } else {
        summary.preserved.push(previous.path);
        nextFiles.push(preserveEntry(previous));
      }
    }
  }

  nextFiles.sort((left, right) => left.path.localeCompare(right.path));
  await mkdir(path.join(targetRoot, STATE_DIRECTORY), { recursive: true });
  await writeJsonAtomic(statePath(targetRoot, LOCK_FILE), {
    schemaVersion: 2,
    product: PRODUCT_NAME,
    version: KIT_VERSION,
    profile,
    packs: loaded.packs,
    packVersions,
    installedAt: new Date().toISOString(),
    files: nextFiles,
  });
  await writeJsonAtomic(configPath, {
    schemaVersion: 2,
    product: PRODUCT_NAME,
    version: KIT_VERSION,
    profile,
    packs: loaded.packs,
    packVersions,
    commandStyle: "cursor-slash-commands",
  });

  const legacyActiveDirectory = path.join(
    targetRoot,
    "openspec",
    "changes",
    "active",
  );
  if (
    (await pathExists(legacyActiveDirectory)) &&
    (await readdir(legacyActiveDirectory)).length === 0
  ) {
    await rm(legacyActiveDirectory, { recursive: true });
    summary.removedDirectories.push("openspec/changes/active");
  }

  const skillsDirectory = path.join(targetRoot, ".cursor", "skills");
  if (await pathExists(skillsDirectory)) {
    for (const entry of await readdir(skillsDirectory, {
      withFileTypes: true,
    })) {
      if (
        entry.isDirectory() &&
        /^ai-coding-.+/u.test(entry.name)
      ) {
        const legacySkillDirectory = path.join(skillsDirectory, entry.name);
        if ((await readdir(legacySkillDirectory)).length === 0) {
          await rm(legacySkillDirectory, { recursive: true });
          summary.removedDirectories.push(
            `.cursor/skills/${entry.name}`,
          );
        }
      }
    }
  }

  return summary;
}

export async function uninstall({ targetDirectory }) {
  const targetRoot = path.resolve(targetDirectory);
  const lockPath = statePath(targetRoot, LOCK_FILE);
  const lock = await readJson(lockPath);
  if (!lock) {
    throw new Error("No AI Coding Kit installation was found.");
  }
  const configPath = statePath(targetRoot, CONFIG_FILE);
  const config = await readJson(configPath);
  if (!isRecognizedInstallation(config, lock)) {
    throw new Error("Unrecognized .ai-coding installation state; refusing to uninstall.");
  }

  const summary = { removed: [], preserved: [] };
  for (const entry of lock.files ?? []) {
    const destination = toNativePath(targetRoot, entry.path);
    if (!(await pathExists(destination))) {
      continue;
    }
    if ((await hashFile(destination)) === entry.hash) {
      await removeFileAndEmptyParents(destination, targetRoot);
      summary.removed.push(entry.path);
    } else {
      summary.preserved.push(entry.path);
    }
  }

  await removeFileAndEmptyParents(lockPath, targetRoot);
  if (await pathExists(configPath)) {
    await removeFileAndEmptyParents(configPath, targetRoot);
  }
  return summary;
}

export async function readInstalledFile(targetDirectory, relativePath) {
  return readFile(toNativePath(path.resolve(targetDirectory), relativePath));
}
