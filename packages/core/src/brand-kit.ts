import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Agent, Approver, BrandChecks, Channel, Client } from "./types";

let root: string | null = null;

/** Repo root = first ancestor of cwd that has a brand-kits/ folder (works from apps/web and services/*). */
export function repoRoot() {
  if (root) return root;
  if (process.env.BOLO_ROOT) return (root = resolve(process.env.BOLO_ROOT));
  let dir = process.cwd();
  while (!existsSync(join(dir, "brand-kits"))) {
    const up = dirname(dir);
    if (up === dir) throw new Error("Could not find the repo root (no brand-kits/ folder above " + process.cwd() + "). Set BOLO_ROOT.");
    dir = up;
  }
  root = dir;
  const env = join(dir, ".env");
  if (existsSync(env)) {
    try {
      process.loadEnvFile(env);
    } catch {
      // malformed .env — fall back to the process environment
    }
  }
  return root;
}

// ---------- parsers (exported for tests) ----------

export function parseApprovers(protocol: string): Approver[] {
  const out: Approver[] = [];
  const re = /^-\s*(Backup approver|Approver):\s*(.+?)\s*\(Telegram\s+(@[\w.]+)\)/gim;
  for (const m of protocol.matchAll(re)) {
    out.push({ name: m[2].trim(), handle: m[3], backup: m[1].toLowerCase().startsWith("backup") });
  }
  return out;
}

function section(md: string, heading: RegExp) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (start < 0) return [];
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (/^##\s/.test(l)) break;
    if (l.trim().startsWith("-")) body.push(l.trim().replace(/^-\s*/, ""));
  }
  return body;
}

export function parseBestTimes(protocol: string) {
  return section(protocol, /best posting times/i).map((line) => {
    const [label, ...rest] = line.split(":");
    return { label: label.trim(), time: rest.join(":").trim() };
  });
}

export function parsePlatforms(protocol: string) {
  return section(protocol, /platforms/i).join(", ");
}

export function parseRera(products: string) {
  return [...products.matchAll(/RERA:\s*([A-Z0-9]+)/g)].map((m) => m[1]);
}

export function parseProducts(products: string) {
  return [...products.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
}

export function parseChecks(rules: string): BrandChecks {
  const m = rules.match(/```bolo-checks\s*([\s\S]*?)```/);
  if (!m) return {};
  try {
    return JSON.parse(m[1]) as BrandChecks;
  } catch (e) {
    throw new Error(`rules.md has an invalid bolo-checks block: ${(e as Error).message}`);
  }
}

// ---------- loaders ----------

const KIT_ORDER = ["brand.md", "rules.md", "protocol.md", "audience.md", "products.md", "examples.md", "reel-style.md", "tokens.json"];

export function loadClient(id: string): Client | null {
  const dir = join(repoRoot(), "brand-kits", id);
  const metaPath = join(dir, "client.json");
  if (!existsSync(metaPath)) return null;

  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    name: string;
    short: string;
    sector: string;
    mark: Client["mark"];
    rooms: Client["rooms"];
    channels: Channel[];
  };
  const read = (f: string) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
  const protocol = read("protocol.md");
  const products = read("products.md") || read("services.md");

  const files = readdirSync(dir)
    .filter((f) => f !== "client.json" && /\.(md|json)$/.test(f))
    .sort((a, b) => (KIT_ORDER.indexOf(a) + 1 || 99) - (KIT_ORDER.indexOf(b) + 1 || 99))
    .map((name) => ({ name, content: read(name) }));

  return {
    id,
    ...meta,
    approvers: parseApprovers(protocol),
    platforms: parsePlatforms(protocol),
    bestTimes: parseBestTimes(protocol),
    products: parseProducts(products),
    reraNumbers: parseRera(products),
    checks: parseChecks(read("rules.md")),
    files,
  };
}

/** Pushpam first so the demo opens on the richest kit. */
const CLIENT_ORDER = ["pushpam-demo", "clinic-demo", "my-brand"];

export function listClients(): Client[] {
  const dir = join(repoRoot(), "brand-kits");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => (CLIENT_ORDER.indexOf(a) + 1 || 99) - (CLIENT_ORDER.indexOf(b) + 1 || 99))
    .map(loadClient)
    .filter((c): c is Client => c !== null);
}

const AGENT_ORDER = ["strategist", "copywriter", "visual-designer", "reel-producer", "brand-guard", "publisher"];

export function listAgents(): Agent[] {
  const dir = join(repoRoot(), "agents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort((a, b) => (AGENT_ORDER.indexOf(a.slice(0, -3)) + 1 || 99) - (AGENT_ORDER.indexOf(b.slice(0, -3)) + 1 || 99))
    .map((f) => {
      const md = readFileSync(join(dir, f), "utf8");
      const field = (k: string) => md.match(new RegExp(`^-\\s*${k}:\\s*(.+)$`, "mi"))?.[1].trim() ?? "";
      const instructions = md.split(/^##\s+Instructions\s*$/m)[1]?.trim() ?? "";
      return {
        id: f.replace(/\.md$/, ""),
        name: md.match(/^#\s+(.+)$/m)?.[1].trim() ?? f,
        role: (field("Role") === "Shared" ? "Shared" : "Single-holder") as Agent["role"],
        builtWith: field("Built with"),
        summary: field("Job"),
        instructions,
      };
    });
}
