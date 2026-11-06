import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-drive-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
delete process.env.AUTH_SECRET;

const drive = await import("./drive");
const media = await import("./media");
const users = await import("./users");
const co = await import("./companies");
const wf = await import("./workflow");
const { readStore } = await import("./store");

// A fake Google: OAuth token, folder search/create, multipart uploads — and a log of every call
type Call = { url: string; method: string; body?: string };
const calls: Call[] = [];
let failUploads = false;
const folders = new Map<string, string>(); // "parent/name" → id
globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : undefined;
  calls.push({ url, method, body });
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    const claims = Buffer.from(JSON.stringify({ email: "owner@shop.in" })).toString("base64url");
    return json({ access_token: "at", refresh_token: "rt", expires_in: 3600, id_token: `x.${claims}.y` });
  }
  if (url.includes("/drive/v3/files?q=")) {
    const q = decodeURIComponent(url.split("q=")[1].split("&")[0]);
    const name = q.match(/name='(.+?)'/)![1];
    const parent = q.match(/'([^']+)' in parents/)![1];
    const id = folders.get(`${parent}/${name}`);
    return json({ files: id ? [{ id }] : [] });
  }
  if (url.includes("/drive/v3/files?fields=id") && method === "POST") {
    const meta = JSON.parse(body!);
    const id = `folder-${meta.name.replace(/\W+/g, "-")}`;
    folders.set(`${meta.parents[0]}/${meta.name}`, id);
    return json({ id });
  }
  if (url.includes("/upload/drive/v3/files")) return failUploads ? json({ error: "quota" }, 500) : json({ id: `file-${calls.length}`, name: "x" });
  return json({ error: "unexpected" }, 404);
}) as typeof fetch;

const owner = await users.createUser({ email: "owner@shop.in", name: "Shop Owner", password: "password-1", role: "member" });
const company = await co.createCompany(owner, { name: "Kurta Co", sector: "Clothes" });

test("sign-in asks only for files Bolo creates (drive.file), not the whole Drive", () => {
  const url = new URL(drive.driveAuthUrl("state"));
  const scope = url.searchParams.get("scope")!;
  assert.match(scope, /auth\/drive\.file\b/);
  assert.doesNotMatch(scope, /auth\/drive(\s|$)/, "no full-Drive permission");
});

test("connecting creates Bolo Studio / <Company> / Designs + Published", async () => {
  const s = await drive.connectDrive(company.id, "code");
  assert.equal(s.connected, true);
  assert.equal(s.email, "owner@shop.in");
  assert.ok(folders.has("root/Bolo Studio"));
  assert.ok(folders.has(`${folders.get("root/Bolo Studio")}/Kurta Co`));
  assert.ok(s.designs && s.published);
  const stored = readStore().companies.find((c) => c.id === company.id)!.connections.drive!;
  assert.match(stored.refreshToken, /^enc:v1:/, "refresh token stored encrypted");
});

test("every generated design is saved to Designs/<date> <title>; uploads by hand are not", async () => {
  const post = await wf.createIdea({ clientId: company.id, text: "Festive kurtas", author: owner.name, authorId: owner.id, mode: "self" });
  const before = calls.filter((c) => c.url.includes("/upload/")).length;
  await media.addMedia(post.id, { name: "festive-kurtas-1080x1350.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]), source: "template", w: 1080, h: 1350 });
  const uploads = calls.filter((c) => c.url.includes("/upload/"));
  assert.equal(uploads.length, before + 1, "the design was uploaded");
  const designsFolder = folders.get(`${folders.get(`${folders.get("root/Bolo Studio")}/Kurta Co`)}/Designs`)!;
  assert.ok([...folders.keys()].some((k) => k.startsWith(`${designsFolder}/`) && k.endsWith("Festive kurtas")), "inside a folder named after the post");

  await media.addMedia(post.id, { name: "photo.jpg", type: "image/jpeg", bytes: new Uint8Array([4]) });
  assert.equal(calls.filter((c) => c.url.includes("/upload/")).length, before + 1, "reference photos stay out of Drive");
});

test("a Drive failure never fails the render — it's noted on the post", async () => {
  failUploads = true;
  const post = await wf.createIdea({ clientId: company.id, text: "Sale banner", author: owner.name, authorId: owner.id, mode: "self" });
  const result = await media.addMedia(post.id, { name: "sale.png", type: "image/png", bytes: new Uint8Array([9]), source: "template" });
  assert.equal(result.media?.length, 1, "the design is still attached");
  assert.ok(readStore().posts.find((p) => p.id === post.id)!.thread.some((m) => /not saved to Google Drive/.test(m.text)));
  failUploads = false;
});

test("without Drive connected, nothing is uploaded and nothing complains", async () => {
  await drive.disconnectDrive(company.id);
  const post = await wf.createIdea({ clientId: company.id, text: "No drive", author: owner.name, authorId: owner.id, mode: "self" });
  const before = calls.length;
  await media.addMedia(post.id, { name: "a.png", type: "image/png", bytes: new Uint8Array([1]), source: "template" });
  assert.equal(calls.length, before);
  assert.ok(!readStore().posts.find((p) => p.id === post.id)!.thread.some((m) => m.from === "Drive"));
});
