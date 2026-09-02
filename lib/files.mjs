import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function sha256(content) {
  const normalizedContent = Buffer.isBuffer(content)
    ? content.toString("utf8").replaceAll("\r\n", "\n")
    : String(content).replaceAll("\r\n", "\n");
  return createHash("sha256").update(normalizedContent).digest("hex");
}

export async function hashFile(filePath) {
  return sha256(await readFile(filePath));
}

export async function listFiles(rootDirectory) {
  if (!(await pathExists(rootDirectory))) {
    return [];
  }

  const result = [];
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootDirectory, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(absolutePath)));
    } else if (entry.isFile()) {
      result.push(absolutePath);
    }
  }
  return result;
}

export async function writeFileAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, filePath);
}

export async function writeJsonAtomic(filePath, value) {
  await writeFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(filePath, fallback = null) {
  if (!(await pathExists(filePath))) {
    return fallback;
  }
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function removeFileAndEmptyParents(filePath, stopDirectory) {
  await rm(filePath, { force: true });
  let currentDirectory = path.dirname(filePath);
  const boundary = path.resolve(stopDirectory);

  while (currentDirectory.startsWith(boundary) && currentDirectory !== boundary) {
    const entries = await readdir(currentDirectory);
    if (entries.length > 0) {
      return;
    }
    await rm(currentDirectory, { recursive: true, force: false });
    currentDirectory = path.dirname(currentDirectory);
  }
}
