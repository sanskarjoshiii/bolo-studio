import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { buildSeed } from "./seed";
import type { StudioData } from "./types";

// A JSON file is enough for a single-agency deployment and keeps the repo
// cloneable with zero services. Both the web app and the Publisher write here.

function dataDir() {
  return process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data");
}

function dataFile() {
  return join(dataDir(), "studio.json");
}

export function readStore(): StudioData {
  const file = dataFile();
  if (!existsSync(file)) {
    const seed = buildSeed();
    writeStore(seed);
    return seed;
  }
  return JSON.parse(readFileSync(file, "utf8")) as StudioData;
}

function writeStore(data: StudioData) {
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${dataFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, dataFile()); // atomic on the same volume
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialised read-modify-write so concurrent requests can't drop each other's changes. */
export function updateStore<T>(fn: (data: StudioData) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const data = readStore();
    const result = await fn(data);
    writeStore(data);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function resetStore() {
  const seed = buildSeed();
  writeStore(seed);
  return seed;
}
