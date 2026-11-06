import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-room-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
delete process.env.AUTH_SECRET;

const core = await import("@bolo/core");
const { handleRoomMessage } = await import("./room");
// Nothing may really go out to Switch or Telegram from these tests
core.repoRoot();
for (const k of ["TELEGRAM_BOT_TOKEN", "SWITCH_AGENT_ID", "SWITCH_AGENT_API_KEY", "SWITCH_BRIDGE_URL"]) process.env[k] = "";

const owner = await core.createUser({ email: "owner@shop.in", name: "Shop Owner", password: "password-1", role: "member" });
const company = await core.createCompany(owner, { name: "Chai House", sector: "Cafe · Pune" });
const ROOM = company.rooms.approvals; // "Chai Approvals"

async function waiting(title: string) {
  const p = await core.createIdea({ clientId: company.id, text: title, author: owner.name, authorId: owner.id, mode: "self" });
  await core.updatePost(p.id, { captions: [{ lang: "EN", text: `${title}. Order today — call us.` }] });
  return core.submitForApproval(p.id);
}
const status = (id: string) => core.readStore().posts.find((p) => p.id === id)!;

test("a stranger in the approvals room can't approve", async () => {
  const post = await waiting("Masala chai offer");
  await assert.rejects(() => handleRoomMessage({ room: ROOM, author: "@random_guy", text: `approve ${core.postRef(post)}` }), /approvers/);
  assert.equal(status(post.id).status, "awaiting");
});

test("a Telegram approver from Team approves through Switch — no Bolo account", async () => {
  const post = await waiting("Weekend breakfast");
  await core.updateApprovals(company.id, { telegram: ["cafe_manager"] });
  const r = await handleRoomMessage({ room: ROOM, author: "@cafe_manager", text: `approve ${core.postRef(post)}` });
  assert.equal(r.handled, true);
  assert.equal(status(post.id).status, "scheduled");
});

test("reject #ref with a reason sends it back to production", async () => {
  const post = await waiting("Cold coffee launch");
  await handleRoomMessage({ room: ROOM, author: "@cafe_manager", text: `reject ${core.postRef(post)}: wrong price` });
  const p = status(post.id);
  assert.equal(p.status, "draft");
  assert.match(p.note ?? "", /Rejected by .*: wrong price/);
});

test("change #ref: … asks for changes", async () => {
  const post = await waiting("Monsoon specials");
  await handleRoomMessage({ room: ROOM, author: "@cafe_manager", text: `change ${core.postRef(post)}: add the timings` });
  assert.match(status(post.id).note ?? "", /add the timings/);
});

test("“Anyone in the group can approve” lets every member of the approvals room approve", async () => {
  const post = await waiting("Diwali hampers");
  await core.updateApprovals(company.id, { anyoneInGroup: true });
  await handleRoomMessage({ room: ROOM, author: "@someone_in_group", text: `approve ${core.postRef(post)}` });
  assert.equal(status(post.id).status, "scheduled");
});
