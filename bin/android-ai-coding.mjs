#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  KIT_VERSION,
  loadRegistry,
} from "../lib/catalog.mjs";
import { diagnose } from "../lib/doctor.mjs";
import { readJson } from "../lib/files.mjs";
import { installOrUpdate, uninstall } from "../lib/installer.mjs";

function printHelp() {
  console.log(`Android AI Coding

Usage:
  android-ai-coding init [target] --profile <name> [--packs a,b]
  android-ai-coding update [target] [--profile <name>] [--packs a,b]
  android-ai-coding doctor [target]
  android-ai-coding uninstall [target]
  android-ai-coding profiles
  android-ai-coding packs
  android-ai-coding version

Defaults:
  target   current directory
  profile  core`);
}

function parseArguments(argumentsList) {
  const [rawCommand = "help", ...rest] = argumentsList;
  const command =
    rawCommand === "--help" || rawCommand === "-h" ? "help" : rawCommand;
  let targetDirectory = process.cwd();
  let profile;
  let packs;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--profile") {
      if (!rest[index + 1]) {
        throw new Error("--profile requires a value.");
      }
      profile = rest[index + 1];
      index += 1;
    } else if (argument === "--packs") {
      if (!rest[index + 1]) {
        throw new Error("--packs requires a comma-separated value.");
      }
      packs = rest[index + 1].split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      return { command: "help", targetDirectory, profile, packs };
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      targetDirectory = path.resolve(argument);
    }
  }
  return { command, targetDirectory, profile, packs };
}

function printSummary(summary) {
  for (const [name, paths] of Object.entries(summary)) {
    if (paths.length > 0) {
      console.log(`${name}: ${paths.length}`);
      for (const managedPath of paths) {
        console.log(`  - ${managedPath}`);
      }
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  switch (options.command) {
    case "help":
      printHelp();
      return;
    case "version":
      console.log(KIT_VERSION);
      return;
    case "profiles": {
      const registry = await loadRegistry();
      for (const [name, profile] of Object.entries(registry.profiles)) {
        console.log(`${name}: ${profile.packs.join(", ")}`);
      }
      return;
    }
    case "packs": {
      const registry = await loadRegistry();
      for (const [name, pack] of Object.entries(registry.packs)) {
        const dependencies = pack.dependencies.length
          ? pack.dependencies.join(", ")
          : "无";
        console.log(
          `${name}@${pack.version} [${pack.layer}] dependencies: ${dependencies}`,
        );
      }
      return;
    }
    case "init":
    case "update": {
      const installedConfig = await readJson(
        path.join(options.targetDirectory, ".ai-coding", "config.json"),
        null,
      );
      const profile = options.profile ?? installedConfig?.profile ?? "core";
      let packs;
      let additionalPacks = options.packs ?? [];
      if (options.command === "update" && installedConfig?.schemaVersion === 2 &&
          !options.profile) {
        if (options.packs) {
          additionalPacks = [...installedConfig.packs, ...options.packs];
        } else {
          packs = installedConfig.packs;
        }
      }
      const summary = await installOrUpdate({
        targetDirectory: options.targetDirectory,
        profile,
        additionalPacks,
        packs,
        command: options.command,
      });
      printSummary(summary);
      if (summary.conflicts.length > 0) {
        console.log(
          "Conflicting incoming files were saved under .ai-coding/incoming/.",
        );
      }
      return;
    }
    case "doctor": {
      const results = await diagnose(options.targetDirectory);
      for (const result of results) {
        console.log(
          `${result.level.toUpperCase().padEnd(4)} ${result.code}: ${result.message}`,
        );
      }
      if (results.some((result) => result.level === "fail")) {
        process.exitCode = 1;
      }
      return;
    }
    case "uninstall":
      printSummary(
        await uninstall({ targetDirectory: options.targetDirectory }),
      );
      return;
    default:
      throw new Error(`Unknown command: ${options.command}`);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
