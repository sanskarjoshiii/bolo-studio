import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { WorkflowError } from "./errors";
import { readStore, storeGeneration, updateStore } from "./store";

// Studio accounts. Passwords are scrypt-hashed; sessions are stateless HMAC-signed tokens.

/**
 * Platform role. "admin" = Bolo Studio staff: sees every company and manages the platform services
 * (Switch, Postiz, Wispr Flow). Everyone else is a "member" and sees only the companies they belong to.
 */
export type Role = "admin" | "member";
export type User = { id: string; email: string; username: string; name: string; role: Role; telegram?: string; createdAt: string };
/** sessionVersion: bumped on logout / password change — every older session token stops working. */
export type StoredUser = Omit<User, "username"> & { username?: string; passwordHash: string; sessionVersion?: number };

// Accounts live in the store with everything else (JSON file locally, Postgres on AWS), so reads
// are instant and writes go through updateStore like every other change.

const dataDir = () => process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data");

/** Bumped whenever anything in the store changes — lets companies.ts cache member names and handles. */
export const usersGeneration = () => storeGeneration();

/** The accounts, shared between callers — read only. */
function sharedUsers(): StoredUser[] {
  return readStore().users ?? [];
}

const USERNAME = /^[a-z0-9][a-z0-9_.]{2,23}$/;
const normUsername = (u: string) => u.trim().replace(/^@/, "").toLowerCase();

export function uniqueUsername(base: string, users: StoredUser[]) {
  const clean = (normUsername(base).replace(/[^a-z0-9_.]/g, "").replace(/^[_.]+/, "") || "user").slice(0, 20).padEnd(3, "0");
  let name = clean;
  for (let i = 2; users.some((u) => u.username === name); i++) name = `${clean.slice(0, 20)}${i}`;
  return name;
}

const publicUser = ({ passwordHash: _h, sessionVersion: _v, ...u }: StoredUser): User => ({ ...u, username: u.username ?? "" });

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function checkPassword(password: string, stored: string) {
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const normEmail = (e: string) => e.trim().toLowerCase();
const normTelegram = (t?: string) => {
  const v = t?.trim().replace(/^@/, "");
  if (!v) return undefined;
  if (!/^[A-Za-z0-9_]{5,32}$/.test(v)) throw new WorkflowError(400, "Telegram username: 5–32 letters, numbers or underscores.");
  return `@${v}`;
};

function validate(input: { email: string; name: string; password?: string }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new WorkflowError(400, "Enter a valid email.");
  if (!input.name.trim()) throw new WorkflowError(400, "Enter a name.");
  if (input.password !== undefined && input.password.length < 8) throw new WorkflowError(400, "Password must be at least 8 characters.");
}

export function hasUsers() {
  return sharedUsers().length > 0;
}

export function listUsers(): User[] {
  return sharedUsers().map(publicUser);
}

export function getUser(id: string): User | null {
  const u = sharedUsers().find((x) => x.id === id);
  return u ? publicUser(u) : null;
}

/** An account by email or username (with or without @) — how teammates are added. */
export function findUserByLogin(login: string): User | null {
  const q = login.trim().toLowerCase();
  if (!q) return null;
  const users = sharedUsers();
  const u = q.includes("@") && !q.startsWith("@") ? users.find((x) => x.email === normEmail(q)) : users.find((x) => x.username === normUsername(q));
  return u ? publicUser(u) : null;
}

export async function createUser(input: { email: string; name: string; password: string; role: Role; telegram?: string; username?: string }): Promise<User> {
  validate(input);
  const telegram = normTelegram(input.telegram);
  const passwordHash = hashPassword(input.password); // slow on purpose — outside the store lock
  return updateStore((data) => {
  const users = (data.users ??= []);
  const email = normEmail(input.email);
  if (users.some((u) => u.email === email)) throw new WorkflowError(409, "That email already has an account.");
  let username: string;
  if (input.username?.trim()) {
    username = normUsername(input.username);
    if (!USERNAME.test(username)) throw new WorkflowError(400, "Username: 3–24 characters — letters, numbers, dots or underscores.");
    if (users.some((u) => u.username === username)) throw new WorkflowError(409, "That username is taken.");
  } else {
    username = uniqueUsername(email.split("@")[0], users);
  }
  const user: StoredUser = {
    id: randomUUID(),
    email,
    username,
    name: input.name.trim(),
    role: input.role,
    telegram,
    createdAt: new Date().toISOString(),
    passwordHash,
  };
  users.push(user);
  return publicUser(user);
  });
}

export async function updateUser(id: string, patch: { name?: string; role?: Role; telegram?: string; password?: string; username?: string }): Promise<User> {
  if (patch.password !== undefined && patch.password.length < 8) throw new WorkflowError(400, "Password must be at least 8 characters.");
  const telegram = patch.telegram !== undefined ? normTelegram(patch.telegram) : undefined;
  const passwordHash = patch.password ? hashPassword(patch.password) : undefined;
  return updateStore((data) => {
  const users = (data.users ??= []);
  const u = users.find((x) => x.id === id);
  if (!u) throw new WorkflowError(404, "User not found.");
  if (patch.username !== undefined && normUsername(patch.username) !== u.username) {
    const name = normUsername(patch.username);
    if (!USERNAME.test(name)) throw new WorkflowError(400, "Username: 3–24 characters — letters, numbers, dots or underscores.");
    if (users.some((x) => x.username === name && x.id !== id)) throw new WorkflowError(409, "That username is taken.");
    u.username = name;
  }
  if (patch.role && patch.role !== "admin" && u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) {
    throw new WorkflowError(409, "Keep at least one admin.");
  }
  if (patch.name !== undefined && patch.name.trim()) u.name = patch.name.trim();
  if (patch.role) u.role = patch.role;
  if (patch.telegram !== undefined) u.telegram = telegram;
  if (passwordHash) {
    u.passwordHash = passwordHash;
    u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  }
  return publicUser(u);
  });
}

/** Sign this user out everywhere. */
export async function endSessions(id: string) {
  await updateStore((data) => {
    const u = data.users?.find((x) => x.id === id);
    if (u) u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  });
}

export async function deleteUser(id: string) {
  await updateStore((data) => {
    const users = data.users ?? [];
    const u = users.find((x) => x.id === id);
    if (!u) throw new WorkflowError(404, "User not found.");
    if (u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) throw new WorkflowError(409, "Keep at least one admin.");
    data.users = users.filter((x) => x.id !== id);
    // and out of every company
    for (const c of data.companies) c.members = c.members.filter((m) => m.userId !== id);
  });
}

const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

/** Returns the user for a correct email + password, else null (same work either way). */
export function authenticate(email: string, password: string): User | null {
  const u = sharedUsers().find((x) => x.email === normEmail(email));
  const ok = checkPassword(password, u?.passwordHash ?? DUMMY_HASH);
  return u && ok ? publicUser(u) : null;
}

// ---------- signed tokens (sessions, render links) ----------

let fileSecret: { dir: string; value: string } | null = null;

export function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (fileSecret?.dir === dataDir()) return fileSecret.value;
  const f = join(dataDir(), "auth-secret");
  if (!existsSync(f)) {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  fileSecret = { dir: dataDir(), value: readFileSync(f, "utf8").trim() };
  return fileSecret.value;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function signToken(payload: Record<string, unknown>, ttlSeconds: number) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sign(body)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

export const SESSION_TTL = 60 * 60 * 24 * 7;

export function createSession(user: User) {
  const sv = sharedUsers().find((x) => x.id === user.id)?.sessionVersion ?? 0;
  return signToken({ uid: user.id, kind: "session", sv }, SESSION_TTL);
}

export function userFromSession(token: string | undefined): User | null {
  const p = verifyToken<{ uid: string; kind: string; sv?: number }>(token);
  if (p?.kind !== "session") return null;
  const u = sharedUsers().find((x) => x.id === p.uid);
  return u && (p.sv ?? 0) === (u.sessionVersion ?? 0) ? publicUser(u) : null;
}
