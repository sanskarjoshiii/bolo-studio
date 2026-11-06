import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-media-"));
process.env.POSTIZ_API_KEY = "";
process.env.BOLO_IGNORE_ENV_FILE = "1"; // never let a real key in .env reach tests

const media = await import("./media");
const wf = await import("./workflow");
const { resetStore } = await import("./store");

before(() => resetStore());

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("attach, read back and remove a file", async () => {
  const post = await media.addMedia("pp-sitevisit", { name: "Slide 1 (final).png", type: "image/png", bytes: PNG });
  const m = post.media!.at(-1)!;
  assert.equal(m.kind, "image");
  assert.match(m.file, /-slide-1-final\.png$/);
  assert.deepEqual(new Uint8Array(media.readMedia("pp-sitevisit", m.file)), PNG);

  await media.removeMedia("pp-sitevisit", m.file);
  assert.equal(existsSync(media.mediaPath("pp-sitevisit", m.file)), false);
});

test("rejects other file types and path traversal", async () => {
  await assert.rejects(() => media.addMedia("pp-sitevisit", { name: "x.exe", type: "application/x-msdownload", bytes: PNG }), /PNG, JPG/);
  assert.throws(() => media.mediaPath("pp-sitevisit", "../../users.json"), /Invalid media path/);
});

test("changing media withdraws a pending approval", async () => {
  const post = await media.addMedia("pp-diwali", { name: "cover.png", type: "image/png", bytes: PNG });
  assert.equal(post.status, "draft");
  assert.match(post.note!, /Media changed/);
});

test("a template render that no longer matches the text blocks approval", async () => {
  const { creativeTextHash } = await import("./shared");
  const idea = await wf.createIdea({ clientId: "pushpam-demo", text: "Luxe 28 open house", author: "Kamran" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Luxe 28 from ₹78 L onwards*. Site visit this Sunday.\n*T&C apply" }] });
  const before = (await import("./store")).readStore().posts.find((p) => p.id === idea.id)!;
  // Rendered before Brand Guard adds the RERA number to the creative text
  await media.addMedia(idea.id, { name: "r.png", type: "image/png", bytes: PNG, source: "template", textHash: creativeTextHash(before) });
  const r = await wf.submitForApproval(idea.id);
  assert.equal(r.status, "brand-check");
  assert.equal(r.checks.find((c) => c.id === "render")?.ok, false);

  // Re-render with the current text → passes
  await media.addMedia(idea.id, { name: "r2.png", type: "image/png", bytes: PNG, source: "template", textHash: creativeTextHash(r) });
  for (const m of r.media!.filter((m) => m.source === "template")) await media.removeMedia(idea.id, m.file);
  assert.equal((await wf.submitForApproval(idea.id)).status, "awaiting");
});

test("approver handles match with or without @, and only approvers can request changes", async () => {
  const idea = await wf.createIdea({ clientId: "my-brand", text: "Day 3 learnings", author: "Kamran" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Day 3: the Publisher now listens to Switch over a WebSocket." }] });
  await wf.submitForApproval(idea.id);
  await assert.rejects(() => wf.clientReply(idea.id, { handle: "@stranger", text: "change: nope" }), /Only this company.s approvers/);
  const r = await wf.clientReply(idea.id, { handle: "PathanKamran_03", text: "approve" });
  assert.equal(r.status, "scheduled");
});
