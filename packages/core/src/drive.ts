import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listClients, loadClient, repoRoot } from "./brand-kit";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { addMedia, MEDIA_TYPES, mediaPath } from "./media";
import { updateStore } from "./store";
import type { Client, Post } from "./types";

// Google Drive as the asset store: My Drive / Bolo Studio / <Client> / References | Published.
// OAuth (not a service account) because a personal Gmail Drive can't receive service-account
// uploads. Tokens stay in data/google.json; the refresh token never leaves this machine.

const SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER = "application/vnd.google-apps.folder";
const MAX_IMPORT = 200 * 1024 * 1024;

type Folders = { client: string; references: string; published: string };
type Saved = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  email?: string;
  root?: string;
  clients: Record<string, Folders>;
};

export type DriveFile = { id: string; name: string; mimeType: string; size?: number; modifiedTime?: string; thumbnailLink?: string };

const file = () => join(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), "google.json");

function load(): Saved | null {
  return existsSync(file()) ? (JSON.parse(readFileSync(file(), "utf8")) as Saved) : null;
}

function save(s: Saved) {
  mkdirSync(join(file(), ".."), { recursive: true });
  writeFileSync(file(), JSON.stringify(s, null, 2), { mode: 0o600 });
}

export function driveRedirectUri() {
  return `${(setting("BOLO_WEB_URL") || "http://localhost:3000").replace(/\/$/, "")}/api/drive/callback`;
}

export function driveStatus() {
  const s = load();
  return {
    configured: Boolean(setting("GOOGLE_CLIENT_ID") && setting("GOOGLE_CLIENT_SECRET")),
    connected: Boolean(s?.refreshToken),
    email: s?.email ?? null,
    rootUrl: s?.root ? folderUrl(s.root) : null,
    clients: Object.fromEntries(Object.entries(s?.clients ?? {}).map(([id, f]) => [id, { references: folderUrl(f.references), published: folderUrl(f.published) }])),
  };
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

export function driveAuthUrl(state: string) {
  const id = setting("GOOGLE_CLIENT_ID");
  if (!id) throw new WorkflowError(409, "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (see docs/setup.md → Google Drive).");
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: driveRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  const hint = setting("GOOGLE_DRIVE_ACCOUNT");
  if (hint) q.set("login_hint", hint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: setting("GOOGLE_CLIENT_ID"), client_secret: setting("GOOGLE_CLIENT_SECRET"), ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) throw new WorkflowError(409, `Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body;
}

/** OAuth callback: store the refresh token, then create the folder tree for every client. */
export async function connectDrive(code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: driveRedirectUri() });
  if (!t.refresh_token) throw new WorkflowError(409, "Google didn't return a refresh token — remove Bolo Studio's access at myaccount.google.com/permissions and connect again.");
  save({ refreshToken: t.refresh_token, accessToken: t.access_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000, clients: {} });
  const about = await api<{ user?: { emailAddress?: string } }>("/drive/v3/about?fields=user(emailAddress)");
  const s = load()!;
  s.email = about.user?.emailAddress;
  save(s);
  for (const c of listClients()) await clientFolders(c);
  return driveStatus();
}

export function disconnectDrive() {
  if (existsSync(file())) rmSync(file());
}

async function accessToken() {
  const s = load();
  if (!s?.refreshToken) throw new WorkflowError(409, "Google Drive isn't connected — Connections → Connect Google Drive.");
  if (s.accessToken && (s.expiresAt ?? 0) > Date.now() + 60_000) return s.accessToken;
  const t = await token({ refresh_token: s.refreshToken, grant_type: "refresh_token" });
  s.accessToken = t.access_token;
  s.expiresAt = Date.now() + (t.expires_in ?? 3600) * 1000;
  save(s);
  return s.accessToken!;
}

async function raw(path: string, init: RequestInit = {}, host = "https://www.googleapis.com") {
  const res = await fetch(`${host}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    throw new WorkflowError(409, `Google Drive ${init.method ?? "GET"} failed (${res.status}): ${text}`);
  }
  return res;
}

async function api<T>(path: string, init: RequestInit = {}) {
  return (await (await raw(path, init)).json()) as T;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function findOrCreateFolder(name: string, parent: string | "root") {
  const q = `name='${esc(name)}' and mimeType='${FOLDER}' and '${parent}' in parents and trashed=false`;
  const found = await api<{ files: { id: string }[] }>(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
  });
  return made.id;
}

/** Bolo Studio / <Client> / References + Published — created once, ids cached. */
export async function clientFolders(client: Client): Promise<Folders> {
  const s = load();
  if (!s) throw new WorkflowError(409, "Google Drive isn't connected.");
  if (s.clients[client.id]) return s.clients[client.id];
  const root = s.root ?? (await findOrCreateFolder("Bolo Studio", "root"));
  const folder = await findOrCreateFolder(client.name, root);
  const f: Folders = { client: folder, references: await findOrCreateFolder("References", folder), published: await findOrCreateFolder("Published", folder) };
  const fresh = load()!;
  fresh.root = root;
  fresh.clients[client.id] = f;
  save(fresh);
  return f;
}

function requireClient(id: string) {
  const c = loadClient(id);
  if (!c) throw new WorkflowError(404, `Unknown client “${id}”.`);
  return c;
}

/** Images and videos in the client's References folder, newest first. */
export async function listReferences(clientId: string): Promise<DriveFile[]> {
  const f = await clientFolders(requireClient(clientId));
  const q = `'${f.references}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`;
  const res = await api<{ files: (DriveFile & { size?: string })[] }>(
    `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink)&orderBy=modifiedTime desc&pageSize=100`,
  );
  return res.files.map((x) => ({ ...x, size: x.size ? Number(x.size) : undefined }));
}

export async function fileMeta(id: string) {
  return api<DriveFile & { size?: string; parents?: string[] }>(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents,thumbnailLink`);
}

/** Small preview image for the picker (Drive thumbnails need the signed-in user's token). */
export async function thumbnail(id: string) {
  const meta = await fileMeta(id);
  if (!meta.thumbnailLink) return null;
  const res = await fetch(meta.thumbnailLink.replace(/=s\d+$/, "=s400"), { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "image/jpeg" };
}

/** Only files inside one of the clients' Bolo Studio folders can be pulled into posts. */
async function assertInBoloFolders(meta: { parents?: string[] }) {
  const s = load();
  const allowed = new Set(Object.values(s?.clients ?? {}).flatMap((f) => [f.references, f.published, f.client]));
  if (!meta.parents?.some((p) => allowed.has(p))) throw new WorkflowError(403, "That file isn't in a Bolo Studio client folder.");
}

/** Copy a Drive reference into a post as an attached file. */
export async function importFromDrive(postId: string, fileId: string): Promise<Post> {
  const meta = await fileMeta(fileId);
  await assertInBoloFolders(meta);
  if (!MEDIA_TYPES[meta.mimeType]) throw new WorkflowError(400, `${meta.name} is ${meta.mimeType} — use PNG, JPG, WebP, MP4 or MOV.`);
  if (Number(meta.size ?? 0) > MAX_IMPORT) throw new WorkflowError(400, `${meta.name} is over 200 MB.`);
  const res = await raw(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  return addMedia(postId, { name: meta.name, type: meta.mimeType, bytes: new Uint8Array(await res.arrayBuffer()) });
}

/** multipart/related upload body (metadata + content) — exported for tests. */
export function multipartBody(meta: Record<string, unknown>, mime: string, bytes: Uint8Array, boundary: string) {
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--`);
  return Buffer.concat([head, Buffer.from(bytes), tail]);
}

async function upload(parent: string, name: string, mime: string, bytes: Uint8Array) {
  const boundary = `bolo${Date.now().toString(36)}`;
  const res = await raw(
    "/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipartBody({ name, parents: [parent] }, mime, bytes, boundary) },
  );
  return (await res.json()) as DriveFile & { webViewLink?: string };
}

export async function uploadReference(clientId: string, input: { name: string; type: string; bytes: Uint8Array }) {
  if (!MEDIA_TYPES[input.type]) throw new WorkflowError(400, "Use PNG, JPG, WebP, MP4 or MOV.");
  const f = await clientFolders(requireClient(clientId));
  return upload(f.references, input.name, input.type, input.bytes);
}

/** After approval: keep a copy of exactly what was published in Published/<date> <title>. */
export async function archiveToDrive(post: Post) {
  if (!load()?.refreshToken || !(post.media ?? []).length) return null;
  const f = await clientFolders(requireClient(post.clientId));
  const folder = await findOrCreateFolder(`${post.scheduledAt.slice(0, 10)} ${post.title}`.slice(0, 120), f.published);
  for (const m of post.media ?? []) await upload(folder, m.name, m.type, new Uint8Array(readFileSync(mediaPath(post.id, m.file))));
  await updateStore((data) => {
    const p = data.posts.find((x) => x.id === post.id);
    p?.thread.push({ from: "Drive", text: `Archived ${post.media!.length} file(s) to ${folderUrl(folder)}`, at: new Date().toISOString() });
  });
  return folderUrl(folder);
}

