import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "@bolo/core";

// Where Switch Console keeps the local server it manages (per OS).
function consoleDataDir() {
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "switchdash");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "switchdash");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "switchdash");
}

function readLocalServer() {
  const dir = join(consoleDataDir(), "local-switch-server");
  const envFile = join(dir, "native", "run", "switch-core.env");
  const portsFile = join(dir, "ports.json");
  const env: Record<string, string> = {};
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  }
  const ports = existsSync(portsFile) ? (JSON.parse(readFileSync(portsFile, "utf8")) as { api?: number }) : {};
  return { env, apiPort: ports.api };
}

/**
 * Bridge URL: SWITCH_BRIDGE_URL, else the API port of the local server Switch Console runs
 * (ports can change when Console restarts it, so the local value wins over a stale .env one).
 */
export function bridgeUrl() {
  repoRoot();
  const local = readLocalServer();
  if (local.apiPort) return `http://127.0.0.1:${local.apiPort}`;
  const url = process.env.SWITCH_BRIDGE_URL;
  if (!url) throw new Error("SWITCH_BRIDGE_URL is not set and no local Switch server was found.");
  return url.replace(/\/$/, "");
}

/**
 * Registration key: SWITCH_REGISTRATION_KEY. With `useLocalConsole` (the explicit --local flag),
 * the registration token of the server Switch Console runs on this machine — a Console-managed
 * local server has no API Keys page, so this is the only key it offers.
 */
export function registrationKey(useLocalConsole: boolean) {
  repoRoot();
  const key = process.env.SWITCH_REGISTRATION_KEY || (useLocalConsole ? readLocalServer().env.AGENT_REGISTRATION_TOKEN : undefined);
  if (!key) {
    throw new Error(
      useLocalConsole
        ? "No local Switch server found. Start it from Switch Console first."
        : "Set SWITCH_REGISTRATION_KEY in .env, or for a server Switch Console runs on this machine use: npm run switch:register -- --local",
    );
  }
  return key;
}

export function agentCredentials() {
  repoRoot();
  const id = process.env.SWITCH_AGENT_ID;
  const key = process.env.SWITCH_AGENT_API_KEY;
  if (!id || !key) throw new Error("Publisher isn't registered with Switch yet. Run: npm run switch:register");
  return { id, key };
}
