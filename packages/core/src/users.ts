import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { WorkflowError } from "./errors";

// Team accounts for the studio dashboard. Passwords are scrypt-hashed; sessions are
// stateless HMAC-signed tokens. Stored next to the post store in data/.

export type Role = "admin" | "member";
export type User = { id: string; email: string; name: string; role: Role; telegram?: string; createdAt: string };
/** sessionVersion: bumped on logout / password change — every older session token stops working. */
type StoredUser = User & { passwordHash: string; sessionVersion?: number };

const dataDir = () => process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data");
const usersFile = () => join(dataDir(), "users.json");

function readUsers(): StoredUser[] {
  return existsSync(usersFile()) ? (JSON.parse(readFileSync(usersFile(), "utf8")) as StoredUser[]) : [];
}

function writeUsers(users: StoredUser[]) {
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${usersFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  renameSync(tmp, usersFile());
}

const publicUser = ({ passwordHash: _h, sessionVersion: _v, ...u }: StoredUser): User => u;

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
  return readUsers().length > 0;
}

export function listUsers(): User[] {
  return readUsers().map(publicUser);
}

export function getUser(id: string): User | null {
  const u = readUsers().find((x) => x.id === id);
  return u ? publicUser(u) : null;
}

export function createUser(input: { email: string; name: string; password: string; role: Role; telegram?: string }): User {
  validate(input);
  const users = readUsers();
  const email = normEmail(input.email);
  if (users.some((u) => u.email === email)) throw new WorkflowError(409, "That email already has an account.");
  const user: StoredUser = {
    id: randomUUID(),
    email,
    name: input.name.trim(),
    role: input.role,
    telegram: normTelegram(input.telegram),
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(input.password),
  };
  writeUsers([...users, user]);
  return publicUser(user);
}

export function updateUser(id: string, patch: { name?: string; role?: Role; telegram?: string; password?: string }): User {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new WorkflowError(404, "User not found.");
  if (patch.password !== undefined && patch.password.length < 8) throw new WorkflowError(400, "Password must be at least 8 characters.");
  if (patch.role && patch.role !== "admin" && u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) {
    throw new WorkflowError(409, "Keep at least one admin.");
  }
  if (patch.name !== undefined && patch.name.trim()) u.name = patch.name.trim();
  if (patch.role) u.role = patch.role;
  if (patch.telegram !== undefined) u.telegram = normTelegram(patch.telegram);
  if (patch.password) {
    u.passwordHash = hashPassword(patch.password);
    u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  }
  writeUsers(users);
  return publicUser(u);
}

/** Sign this user out everywhere. */
export function endSessions(id: string) {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return;
  u.sessionVersion = (u.sessionVersion ?? 0) + 1;
  writeUsers(users);
}

export function deleteUser(id: string) {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw new WorkflowError(404, "User not found.");
  if (u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) throw new WorkflowError(409, "Keep at least one admin.");
  writeUsers(users.filter((x) => x.id !== id));
}

const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

/** Returns the user for a correct email + password, else null (same work either way). */
export function authenticate(email: string, password: string): User | null {
  const u = readUsers().find((x) => x.email === normEmail(email));
  const ok = checkPassword(password, u?.passwordHash ?? DUMMY_HASH);
  return u && ok ? publicUser(u) : null;
}

// ---------- signed tokens (sessions, render links) ----------

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const f = join(dataDir(), "auth-secret");
  if (!existsSync(f)) {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(f, "utf8").trim();
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
  const sv = readUsers().find((x) => x.id === user.id)?.sessionVersion ?? 0;
  return signToken({ uid: user.id, kind: "session", sv }, SESSION_TTL);
}

export function userFromSession(token: string | undefined): User | null {
  const p = verifyToken<{ uid: string; kind: string; sv?: number }>(token);
  if (p?.kind !== "session") return null;
  const u = readUsers().find((x) => x.id === p.uid);
  return u && (p.sv ?? 0) === (u.sessionVersion ?? 0) ? publicUser(u) : null;
}
