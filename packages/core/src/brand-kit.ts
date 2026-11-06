import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Agent, Approver, BrandChecks, BrandKitFile, Client, ClientMeta, MemberInfo } from "./types";

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

export const sortKitFiles = (files: BrandKitFile[]) =>
  [...files].sort((a, b) => (KIT_ORDER.indexOf(a.name) + 1 || 99) - (KIT_ORDER.indexOf(b.name) + 1 || 99));

/** A Brand Kit (client.json + its files) → the Client everything else works with. Pure. */
export function parseKit(id: string, meta: ClientMeta, files: BrandKitFile[], members: MemberInfo[] = []): Client {
  const read = (f: string) => files.find((x) => x.name === f)?.content ?? "";
  const protocol = read("protocol.md");
  const products = read("products.md") || read("services.md");
  let checks: BrandChecks = {};
  try {
    checks = parseChecks(read("rules.md"));
  } catch {
    checks = {}; // a broken bolo-checks block must not take the whole studio down — the Brand Kit page shows it
  }
  return {
    id,
    ...meta,
    channels: meta.channels ?? [],
    rooms: meta.rooms ?? { work: "", approvals: "" },
    approvers: parseApprovers(protocol),
    platforms: parsePlatforms(protocol),
    bestTimes: parseBestTimes(protocol),
    products: parseProducts(products),
    reraNumbers: parseRera(products),
    checks,
    files: sortKitFiles(files),
    members,
    telegramApprovers: [],
    groupApproves: false,
  };
}

export const kitsDir = () => join(repoRoot(), "brand-kits");

/** Read a Brand Kit folder from disk (the demo kits, and kits added by hand). */
export function readDiskKit(id: string): { meta: ClientMeta; files: BrandKitFile[] } | null {
  const dir = join(kitsDir(), id);
  const metaPath = join(dir, "client.json");
  if (!existsSync(metaPath)) return null;
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as ClientMeta;
  const files = readdirSync(dir)
    .filter((f) => f !== "client.json" && /\.(md|json)$/.test(f))
    .map((name) => ({ name, content: readFileSync(join(dir, name), "utf8") }));
  return { meta, files: sortKitFiles(files) };
}

/** Pushpam first so the demo opens on the richest kit. */
export const CLIENT_ORDER = ["pushpam-demo", "clinic-demo", "my-brand"];

export function diskKitIds(): string[] {
  const dir = kitsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "client.json")))
    .map((d) => d.name)
    .sort((a, b) => (CLIENT_ORDER.indexOf(a) + 1 || 99) - (CLIENT_ORDER.indexOf(b) + 1 || 99));
}

/** Clients straight from the brand-kits/ folders — used to build the first store (seed). */
export function listDiskClients(): Client[] {
  return diskKitIds()
    .map((id) => {
      const kit = readDiskKit(id);
      return kit ? parseKit(id, kit.meta, kit.files) : null;
    })
    .filter((c): c is Client => c !== null);
}

/**
 * Where an agent reads a company's Brand Kit: brand-kits/<id>/ for the kits that ship in the repo,
 * <data>/brand-kits/<id>/ for companies created in the studio (never inside the source tree).
 */
export function kitDirFor(id: string) {
  const repoKit = join(kitsDir(), id);
  if (existsSync(join(repoKit, "client.json"))) return repoKit;
  return join(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), "brand-kits", id);
}

/**
 * Write a company's Brand Kit to its folder so the Switch content agents (which read files) see
 * edits made in the studio. Best effort — the store is the source of truth.
 */
export function writeDiskKit(id: string, kit: { meta: ClientMeta; files: BrandKitFile[] }) {
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) return;
  const dir = kitDirFor(id);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "client.json"), `${JSON.stringify(kit.meta, null, 2)}\n`);
    for (const f of kit.files) {
      if (!/^[\w.-]+\.(md|json)$/.test(f.name)) continue;
      writeFileSync(join(dir, f.name), f.content);
    }
  } catch (e) {
    console.error(`brand-kits/${id}: not written (${(e as Error).message})`);
  }
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
