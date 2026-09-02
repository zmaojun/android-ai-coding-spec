import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, pathExists, sha256 } from "./files.mjs";

export const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export async function loadRegistry(registryPath = path.join(PACKAGE_ROOT, "kit.config.json")) {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  validateRegistry(registry);
  return registry;
}

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function validateRegistry(registry) {
  if (registry.schemaVersion !== 1 || !registry.product ||
      !SEMVER_PATTERN.test(registry.productVersion ?? "")) {
    throw new Error("Invalid kit registry metadata.");
  }
  if (!registry.packs || !registry.profiles || !Array.isArray(registry.rulesWhitelist)) {
    throw new Error("Registry must declare packs, profiles, and rulesWhitelist.");
  }
  for (const [name, pack] of Object.entries(registry.packs)) {
    if (!SEMVER_PATTERN.test(pack.version ?? "") ||
        !pack.path || !Array.isArray(pack.dependencies) ||
        !Array.isArray(pack.softDependencies) || !Array.isArray(pack.overrides)) {
      throw new Error(`Invalid pack declaration: ${name}`);
    }
  }
  for (const [name, profile] of Object.entries(registry.profiles)) {
    if (!Array.isArray(profile.packs) || profile.packs.length === 0) {
      throw new Error(`Invalid profile declaration: ${name}`);
    }
  }
}

export function resolvePacks(registry, requestedPacks) {
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(name, chain = []) {
    const pack = registry.packs[name];
    if (!pack) {
      throw new Error(`Unknown pack "${name}"${chain.length ? ` required by ${chain.at(-1)}` : ""}.`);
    }
    if (visiting.has(name)) {
      throw new Error(`Pack dependency cycle: ${[...chain, name].join(" -> ")}`);
    }
    if (visited.has(name)) {
      return;
    }
    visiting.add(name);
    for (const dependency of pack.dependencies) {
      visit(dependency, [...chain, name]);
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  for (const name of requestedPacks) {
    visit(name);
  }
  return ordered;
}

export function profileRootPacks(registry, profile) {
  const declaration = registry.profiles[profile];
  if (!declaration) {
    throw new Error(
      `Unknown profile "${profile}". Use: ${Object.keys(registry.profiles).join(", ")}`,
    );
  }
  return declaration.packs;
}

async function loadAssetDirectory(directory, packName) {
  if (!(await pathExists(directory))) {
    throw new Error(`Pack assets missing: ${packName}`);
  }
  const files = new Map();
  for (const absolutePath of await listFiles(directory)) {
    const relativePath = path
      .relative(directory, absolutePath)
      .split(path.sep)
      .join("/");
    const content = await readFile(absolutePath);
    files.set(relativePath, {
      content,
      hash: sha256(content),
      source: absolutePath,
      pack: packName,
    });
  }
  return files;
}

export async function loadCatalog({ profile, additionalPacks = [], packs, registry: suppliedRegistry } = {}) {
  const registry = suppliedRegistry ?? await loadRegistry();
  const requestedPacks = packs ??
    [...profileRootPacks(registry, profile), ...additionalPacks];
  const selectedPacks = resolvePacks(registry, requestedPacks);
  const catalog = new Map();

  for (const packName of selectedPacks) {
    const pack = registry.packs[packName];
    const overlay = await loadAssetDirectory(
      path.join(PACKAGE_ROOT, ...pack.path.split("/")),
      packName,
    );
    for (const [relativePath, asset] of overlay) {
      const previous = catalog.get(relativePath);
      if (previous && previous.hash !== asset.hash &&
          !pack.overrides.includes(relativePath)) {
        throw new Error(
          `Pack "${packName}" conflicts with "${previous.pack}" at ${relativePath}; declare an override.`,
        );
      }
      catalog.set(relativePath, asset);
    }
  }

  for (const relativePath of catalog.keys()) {
    if (relativePath.startsWith(".cursor/rules/") &&
        !registry.rulesWhitelist.includes(relativePath)) {
      throw new Error(`RULE_LEAK: ${relativePath}`);
    }
  }
  return { catalog, packs: selectedPacks, registry };
}

const defaultRegistry = await loadRegistry();
export const KIT_VERSION = defaultRegistry.productVersion;
export const PRODUCT_NAME = defaultRegistry.product;
export const SUPPORTED_PROFILES = Object.keys(defaultRegistry.profiles);
