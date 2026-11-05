import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@bolo/core";

/** Set KEY=value lines in the repo-root .env (adds missing keys, keeps everything else). */
export function writeEnv(values: Record<string, string>) {
  const file = join(repoRoot(), ".env");
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
    process.env[k] = v;
  }
  writeFileSync(file, text);
}
