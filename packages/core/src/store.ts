import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AnyBulkWriteOperation, ClientSession, Collection, Db, MongoClient } from "mongodb";
import { diskKitIds, readDiskKit, repoRoot } from "./brand-kit";
import { buildSeed } from "./seed";
import type { Company, StudioData } from "./types";
import type { StoredUser } from "./users";

// The store. Locally it's one JSON file (zero services to run). With MONGODB_URI set (Vercel) it's
// MongoDB: one document per post / company / account / invite / notification, plus a version
// number. Every server keeps the whole store in memory, so reads stay synchronous; each request
// checks the version (refreshStore) and reloads when another server changed something, and every
// write runs in a transaction on the latest data, so parallel servers can't overwrite each other.

export function dataDir() {
  return process.env.BOLO_DATA_DIR ?? (process.env.VERCEL ? "/tmp/bolo" : join(repoRoot(), "data"));
}

const dataFile = () => join(dataDir(), "studio.json");
const mongoUri = () => {
  repoRoot(); // loads .env on first use
  return process.env.MONGODB_URI ?? "";
};
export const usingMongo = () => Boolean(mongoUri());

/** Parsed store, reused until it changes. */
let cache: { key: string; data: StudioData } | null = null;
/** Bumped on every change — lets callers cache work derived from the store (parsed clients). */
let generation = 0;
export const storeGeneration = () => generation;

function setCache(key: string, data: StudioData) {
  cache = { key, data };
  generation++;
}

// ---------------------------------- JSON file ----------------------------------

const fileKey = (file: string) => {
  const st = statSync(file);
  return `${st.mtimeMs}:${st.size}`;
};

function readFileStore(): StudioData {
  const file = dataFile();
  if (!existsSync(file)) {
    const seed = buildSeed();
    writeFileStore(seed);
    return seed;
  }
  const key = fileKey(file);
  if (cache?.key === key) return cache.data;
  const { data, changed } = migrate(JSON.parse(readFileSync(file, "utf8")));
  if (changed) {
    writeFileStore(data);
    return data;
  }
  setCache(key, data);
  return data;
}

function writeFileStore(data: StudioData) {
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${dataFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, dataFile()); // atomic on the same volume
  setCache(fileKey(dataFile()), data);
}

// ---------------------------------- MongoDB ----------------------------------

type Entity = { _id: string; k: string; d: unknown };
type Meta = { _id: "meta"; v: number };

const g = globalThis as typeof globalThis & { __boloMongo?: Promise<{ client: MongoClient; db: Db }> };

async function mongo() {
  g.__boloMongo ??= (async () => {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(mongoUri(), { maxPoolSize: 10 });
    await client.connect();
    return { client, db: client.db(process.env.MONGODB_DB || "bolo_studio") };
  })();
  try {
    return await g.__boloMongo;
  } catch (e) {
    g.__boloMongo = undefined; // try again on the next request
    throw e;
  }
}

const entities = (db: Db) => db.collection<Entity>("entities");
const metaColl = (db: Db) => db.collection<Meta>("meta");

/** StudioData → one document per thing. */
function toEntities(data: StudioData): Entity[] {
  const out: Entity[] = [{ _id: "doc:version", k: "doc", d: data.version }];
  for (const p of data.posts) out.push({ _id: `post:${p.id}`, k: "post", d: p });
  for (const c of data.companies) out.push({ _id: `company:${c.id}`, k: "company", d: c });
  for (const i of data.invites) out.push({ _id: `invite:${i.id}`, k: "invite", d: i });
  for (const n of data.notifications) out.push({ _id: `notification:${n.id}`, k: "notification", d: n });
  for (const u of data.users) out.push({ _id: `user:${u.id}`, k: "user", d: u });
  for (const [id, s] of Object.entries(data.settings)) out.push({ _id: `settings:${id}`, k: "settings", d: s });
  return out;
}

function fromEntities(rows: Entity[]): StudioData {
  const data = { version: 3, posts: [], settings: {}, companies: [], invites: [], notifications: [], users: [] } as unknown as StudioData;
  for (const r of rows) {
    const id = r._id.slice(r.k.length + 1);
    if (r.k === "doc") (data as { version: number }).version = r.d as number;
    else if (r.k === "post") data.posts.push(r.d as StudioData["posts"][number]);
    else if (r.k === "company") data.companies.push(r.d as Company);
    else if (r.k === "invite") data.invites.push(r.d as StudioData["invites"][number]);
    else if (r.k === "notification") data.notifications.push(r.d as StudioData["notifications"][number]);
    else if (r.k === "user") data.users.push(r.d as StoredUser);
    else if (r.k === "settings") data.settings[id] = r.d as StudioData["settings"][string];
  }
  // Insertion order matters to people (notifications newest last, posts by creation)
  data.notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  data.users.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return data;
}

async function loadAll(db: Db, session?: ClientSession) {
  return fromEntities(await entities(db).find({}, { session }).toArray());
}

/** The local data/ folder, if this server has one — imported once when MongoDB is still empty. */
function localData(): StudioData | null {
  try {
    if (!existsSync(dataFile())) return null;
    return migrate(JSON.parse(readFileSync(dataFile(), "utf8"))).data;
  } catch {
    return null;
  }
}

/**
 * Load the store before serving. JSON: nothing to do. MongoDB: connect and read everything (and on
 * a brand-new database, import the local data/ or build the demo seed).
 */
export async function loadStore() {
  if (!usingMongo()) return void readFileStore();
  const { db } = await mongo();
  const meta = await metaColl(db).findOne({ _id: "meta" });
  if (!meta) {
    const first = localData() ?? buildSeed();
    try {
      await metaColl(db).insertOne({ _id: "meta", v: 1 });
      await entities(db).insertMany(toEntities(first));
      setCache("1", first);
      return;
    } catch {
      // another server created it at the same moment — read theirs
    }
  }
  await refreshStore(true);
}

/** Cheap check on every request: reload only when another server changed the store. */
export async function refreshStore(force = false) {
  if (!usingMongo()) return void readFileStore();
  const { db } = await mongo();
  const meta = await metaColl(db).findOne({ _id: "meta" });
  const key = String(meta?.v ?? 0);
  if (!force && cache?.key === key) return;
  const { data, changed } = migrate(await loadAll(db));
  setCache(key, data);
  if (changed) await updateStore(() => undefined); // persist the migration
}

/**
 * The whole store. Callers must treat the result as read-only — it is shared between requests;
 * change data only through updateStore.
 */
export function readStore(): StudioData {
  if (!usingMongo()) return readFileStore();
  if (!cache) throw new Error("The store isn't loaded yet — await loadStore() at startup (instrumentation.ts, CLI, worker).");
  return cache.data;
}

/** Writes for the changed documents only. */
function diff(before: StudioData, after: StudioData): AnyBulkWriteOperation<Entity>[] {
  const old = new Map(toEntities(before).map((e) => [e._id, JSON.stringify(e.d)]));
  const ops: AnyBulkWriteOperation<Entity>[] = [];
  const next = toEntities(after);
  for (const e of next) {
    if (old.get(e._id) !== JSON.stringify(e.d)) ops.push({ replaceOne: { filter: { _id: e._id }, replacement: e, upsert: true } });
    old.delete(e._id);
  }
  for (const id of old.keys()) ops.push({ deleteOne: { filter: { _id: id } } });
  return ops;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Serialised read-modify-write so concurrent requests can't drop each other's changes. `fn` gets
 * a private copy: if it throws, nothing is written and the shared copy is untouched. With MongoDB
 * it runs inside a transaction on the newest data (it may run again if another server wrote first).
 */
export function updateStore<T>(fn: (data: StudioData) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    if (!usingMongo()) {
      const data = structuredClone(readFileStore());
      const result = await fn(data);
      writeFileStore(data);
      return result;
    }
    const { client, db } = await mongo();
    const session = client.startSession();
    try {
      let out!: { result: T; data: StudioData; v: number };
      await session.withTransaction(async () => {
        const meta = await metaColl(db).findOne({ _id: "meta" }, { session });
        const v = meta?.v ?? 0;
        const base = cache && cache.key === String(v) ? cache.data : migrate(await loadAll(db, session)).data;
        const data = structuredClone(base);
        const result = await fn(data);
        const ops = diff(base, data);
        if (ops.length) await entities(db).bulkWrite(ops, { session, ordered: false });
        // Touching the version makes concurrent writers conflict, so one of them retries on fresh data
        await metaColl(db).updateOne({ _id: "meta" }, { $set: { v: v + 1 } }, { session, upsert: true });
        out = { result, data, v: v + 1 };
      });
      setCache(String(out.v), out.data);
      return out.result;
    } finally {
      await session.endSession();
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Back to the demo week. Accounts, and companies people created themselves, are kept. */
export async function resetStore() {
  const seed = buildSeed();
  const keep = (data: StudioData) => {
    seed.users = data.users;
    const demo = new Set(seed.companies.map((c) => c.id));
    for (const c of data.companies) if (!demo.has(c.id)) seed.companies.push(c);
    for (const c of seed.companies) {
      const old = data.companies.find((x) => x.id === c.id);
      if (old) c.members = old.members;
    }
  };
  if (!usingMongo()) {
    if (existsSync(dataFile())) keep(readFileStore());
    writeFileStore(seed);
    return seed;
  }
  await updateStore((data) => {
    keep(data);
    Object.assign(data, seed);
  });
  return seed;
}

/** A Brand Kit folder as a company record (no members yet). */
export function companyFromDisk(id: string): Company | null {
  const kit = readDiskKit(id);
  return kit ? { id, kit, members: [], connections: {}, createdAt: new Date().toISOString() } : null;
}

// ---------------------------------- migrations ----------------------------------

/**
 * v1 → v2: Brand Kits move into the store as companies (the folders stay as the seed and as a copy
 * the Switch agents read), and every existing account joins every existing company — before v2
 * everyone saw every client, so nobody loses access.
 * v2 → v3: accounts move from users.json into the store (so MongoDB holds everything).
 */
function migrate(raw: Partial<StudioData> & { version: number }): { data: StudioData; changed: boolean } {
  let changed = false;
  const data = raw as StudioData;
  if ((raw.version as number) < 3 && !data.users?.length) {
    data.users = fileUsers();
    changed = true;
  }
  if ((raw.version as number) === 1) {
    data.companies = diskKitIds()
      .map(companyFromDisk)
      .filter((c): c is Company => c !== null)
      .map((c) => ({
        ...c,
        members: data.users.map((u) => ({ userId: u.id, role: u.role === "admin" ? ("owner" as const) : ("member" as const), canApprove: false, addedAt: c.createdAt })),
      }));
    changed = true;
  }
  if ((raw.version as number) < 3) {
    data.version = 3;
    changed = true;
  }
  data.posts ??= [];
  data.settings ??= {};
  data.companies ??= [];
  data.invites ??= [];
  data.notifications ??= [];
  data.users ??= [];
  // Accounts made before usernames existed get one from their email
  for (const u of data.users) {
    if (!u.username) {
      const base = (u.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "") || "user").slice(0, 20).padEnd(3, "0");
      let name = base;
      for (let i = 2; data.users.some((x) => x !== u && x.username === name); i++) name = `${base}${i}`;
      u.username = name;
      changed = true;
    }
  }
  return { data, changed };
}

/** data/users.json from before accounts moved into the store. */
function fileUsers(): StoredUser[] {
  const f = join(dataDir(), "users.json");
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as StoredUser[]) : [];
  } catch {
    return [];
  }
}
