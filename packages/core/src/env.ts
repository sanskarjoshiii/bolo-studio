import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";

// Integration settings (Switch, Postiz) are read from the repo-root .env on each use, re-parsed
// only when the file changes — so registering the Publisher or adding a Postiz key takes
// effect without restarting the web app.

let cache: { mtime: number; values: Record<string, string> } | null = null;

function fileValues() {
  const file = join(repoRoot(), ".env");
  if (!existsSync(file)) return {};
  const mtime = statSync(file).mtimeMs;
  if (cache?.mtime === mtime) return cache.values;
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  cache = { mtime, values };
  return values;
}

/**
 * .env wins over the process environment captured at startup (which may be stale).
 * Tests set BOLO_IGNORE_ENV_FILE so a real key in .env can never make them post for real.
 */
export function setting(key: string): string {
  if (process.env.BOLO_IGNORE_ENV_FILE) return process.env[key] ?? "";
  const v = fileValues()[key];
  return v !== undefined && v !== "" ? v : (process.env[key] ?? "");
}
