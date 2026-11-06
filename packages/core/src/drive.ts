import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { getCompany } from "./companies";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { decrypt, encrypt } from "./secrets";
import { readStore, updateStore } from "./store";
import type { Media, Post } from "./types";

// Google Drive as each company's design archive. The client connects their Google account once;
// Bolo creates My Drive / Bolo Studio / <Company> / Designs + Published and saves into it:
//   Designs   — every image, carousel slide and reel Bolo generates (newest renders each time)
//   Published — a copy of exactly what was approved
// The permission is `drive.file`: Bolo can only see and change files it created itself, never the
// rest of the client's Drive — which keeps Google's sign-in screen simple and its review quick.

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER = "application/vnd.google-apps.folder";

type Folders = { client: string; designs: string; published: string };
type Account = { refreshToken: string; email?: string; folders?: Partial<Folders> & { references?: string }; legacy?: boolean };

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

// ---------- the machine-wide Drive from before companies had their own (data/google.json) ----------

type Legacy = { refreshToken: string; email?: string; clients: Record<string, { client: string; references?: string; published: string }> };
const legacyFile = () => join(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), "google.json");
function legacy(): Legacy | null {
  try {
    return existsSync(legacyFile()) ? (JSON.parse(readFileSync(legacyFile(), "utf8")) as Legacy) : null;
  } catch {
    return null;
  }
}

/** The Drive a company uses: its own connection, else the old machine-wide one if it has folders there. */
function account(companyId: string): Account | null {
  const own = getCompany(companyId)?.connections.drive;
  if (own) return { refreshToken: decrypt(own.refreshToken), email: own.email, folders: own.folders };
  const old = legacy();
  if (old?.refreshToken && old.clients?.[companyId]) return { refreshToken: old.refreshToken, email: old.email, folders: old.clients[companyId], legacy: true };
  return null;
}

export function driveRedirectUri() {
  return `${(setting("BOLO_WEB_URL") || "http://localhost:3000").replace(/\/$/, "")}/api/drive/callback`;
}

export function driveConfigured() {
  return Boolean(setting("GOOGLE_CLIENT_ID") && setting("GOOGLE_CLIENT_SECRET"));
}

export function driveStatus(companyId: string) {
  const a = account(companyId);
  return {
    configured: driveConfigured(),
    connected: Boolean(a),
    /** Using the agency's shared Drive rather than the company's own. */
    shared: Boolean(a?.legacy),
    email: a?.email ?? null,
    folder: a?.folders?.client ? folderUrl(a.folders.client) : null,
    designs: a?.folders?.designs ? folderUrl(a.folders.designs) : null,
    published: a?.folders?.published ? folderUrl(a.folders.published) : null,
  };
}

export function driveAuthUrl(state: string) {
  const id = setting("GOOGLE_CLIENT_ID");
  if (!id) throw new WorkflowError(409, "Google Drive isn't available yet — the Bolo Studio admin needs to add the Google OAuth client (GOOGLE_CLIENT_ID / SECRET).");
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: driveRedirectUri(),
    response_type: "code",
    scope: `${SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: setting("GOOGLE_CLIENT_ID"), client_secret: setting("GOOGLE_CLIENT_SECRET"), ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) throw new WorkflowError(409, `Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body;
}

// Access tokens live in memory only (an hour each).
const tokens = new Map<string, { value: string; expiresAt: number }>();

async function accessToken(companyId: string) {
  const a = account(companyId);
  if (!a) throw new WorkflowError(409, "Google Drive isn't connected — Connections → Google Drive.");
  const cached = tokens.get(a.refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const t = await token({ refresh_token: a.refreshToken, grant_type: "refresh_token" });
  tokens.set(a.refreshToken, { value: t.access_token!, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 });
  return t.access_token!;
}

async function raw(companyId: string, path: string, init: RequestInit = {}, bearer?: string) {
  const res = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { Authorization: `Bearer ${bearer ?? (await accessToken(companyId))}`, ...(init.headers ?? {}) } });
  if (res.status === 401 || res.status === 403) {
    const text = (await res.text().catch(() => "")).slice(0, 200);
    throw new WorkflowError(409, `Google Drive refused (${res.status}) — reconnect Google Drive in Connections. ${text}`);
  }
  if (!res.ok) throw new WorkflowError(409, `Google Drive ${init.method ?? "GET"} failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return res;
}

async function api<T>(companyId: string, path: string, init: RequestInit = {}, bearer?: string) {
  return (await (await raw(companyId, path, init, bearer)).json()) as T;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** With drive.file the search only sees folders Bolo made — exactly the ones we want to reuse. */
async function findOrCreateFolder(companyId: string, name: string, parent: string | "root", bearer?: string) {
  const q = `name='${esc(name)}' and mimeType='${FOLDER}' and '${parent}' in parents and trashed=false`;
  const found = await api<{ files: { id: string }[] }>(companyId, `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {}, bearer);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>(
    companyId,
    "/drive/v3/files?fields=id",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }) },
    bearer,
  );
  return made.id;
}

async function makeFolders(companyId: string, name: string, bearer?: string): Promise<Folders> {
  const root = await findOrCreateFolder(companyId, "Bolo Studio", "root", bearer);
  const client = await findOrCreateFolder(companyId, name, root, bearer);
  return {
    client,
    designs: await findOrCreateFolder(companyId, "Designs", client, bearer),
    published: await findOrCreateFolder(companyId, "Published", client, bearer),
  };
}

/** The email on the Google account (from the sign-in's ID token — no extra permission needed). */
function emailFromIdToken(idToken?: string) {
  try {
    return idToken ? (JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString()) as { email?: string }).email : undefined;
  } catch {
    return undefined;
  }
}

/** OAuth callback for one company: store its refresh token (encrypted) and create its folders. */
export async function connectDrive(companyId: string, code: string) {
  const company = getCompany(companyId);
  if (!company) throw new WorkflowError(404, "Company not found.");
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: driveRedirectUri() });
  if (!t.refresh_token) throw new WorkflowError(409, "Google didn't return a refresh token — remove Bolo Studio's access at myaccount.google.com/permissions and connect again.");
  const folders = await makeFolders(companyId, company.kit.meta.name, t.access_token);
  tokens.set(t.refresh_token, { value: t.access_token!, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 });
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId)!;
    c.connections.drive = { refreshToken: encrypt(t.refresh_token!), email: emailFromIdToken(t.id_token), folders, connectedAt: new Date().toISOString() };
  });
  return driveStatus(companyId);
}

export async function disconnectDrive(companyId: string) {
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (c) delete c.connections.drive;
  });
  // The old machine-wide connection is removed only once no company uses it any more
  const old = legacy();
  if (old && !readStore().companies.some((c) => c.id !== companyId && !c.connections.drive && old.clients?.[c.id])) {
    if (existsSync(legacyFile())) rmSync(legacyFile());
  }
}

/** The company's folders, creating any that are missing (e.g. Designs on an older connection). */
async function foldersOf(companyId: string): Promise<Folders> {
  const a = account(companyId);
  if (!a) throw new WorkflowError(409, "Google Drive isn't connected — Connections → Google Drive.");
  const f = a.folders;
  if (f?.client && f.designs && f.published) return f as Folders;
  const company = getCompany(companyId)!;
  const folders = f?.client
    ? { client: f.client, designs: f.designs ?? (await findOrCreateFolder(companyId, "Designs", f.client)), published: f.published ?? (await findOrCreateFolder(companyId, "Published", f.client)) }
    : await makeFolders(companyId, company.kit.meta.name);
  if (!a.legacy) {
    await updateStore((data) => {
      const c = data.companies.find((x) => x.id === companyId);
      if (c?.connections.drive) c.connections.drive.folders = folders;
    });
  }
  return folders;
}

/** multipart/related upload body (metadata + content) — exported for tests. */
export function multipartBody(meta: Record<string, unknown>, mime: string, bytes: Uint8Array, boundary: string) {
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--`);
  return Buffer.concat([head, Buffer.from(bytes), tail]);
}

async function upload(companyId: string, parent: string, name: string, mime: string, bytes: Uint8Array) {
  const boundary = `bolo${Date.now().toString(36)}`;
  const res = await raw(companyId, "/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipartBody({ name, parents: [parent] }, mime, bytes, boundary),
  });
  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}

const folderName = (post: Post) => `${post.scheduledAt.slice(0, 10)} ${post.title}`.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120);

/**
 * A freshly generated design (image, carousel slide or reel) → Designs/<date> <title>/ in the
 * company's Drive. Returns quietly when Drive isn't connected; never fails the render.
 */
export async function saveDesign(post: Post, media: Media, bytes: Uint8Array) {
  if (!account(post.clientId)) return null;
  const f = await foldersOf(post.clientId);
  const folder = await findOrCreateFolder(post.clientId, folderName(post), f.designs);
  await upload(post.clientId, folder, media.name, media.type, bytes);
  return folderUrl(folder);
}

/** After approval: a copy of exactly what was approved in Published/<date> <title>. */
export async function archiveToDrive(post: Post) {
  if (!account(post.clientId) || !(post.media ?? []).length) return null;
  const { mediaPath } = await import("./media");
  const f = await foldersOf(post.clientId);
  const folder = await findOrCreateFolder(post.clientId, folderName(post), f.published);
  for (const m of post.media ?? []) await upload(post.clientId, folder, m.name, m.type, new Uint8Array(readFileSync(mediaPath(post.id, m.file))));
  await updateStore((data) => {
    const p = data.posts.find((x) => x.id === post.id);
    p?.thread.push({ from: "Drive", text: `Saved the approved files to Published: ${folderUrl(folder)}`, at: new Date().toISOString() });
  });
  return folderUrl(folder);
}
