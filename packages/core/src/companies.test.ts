import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-companies-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
delete process.env.AUTH_SECRET;

const users = await import("./users");
const co = await import("./companies");
const wf = await import("./workflow");
const store = await import("./store");

const owner = await users.createUser({ email: "owner@acme.in", name: "Asha Owner", password: "password-1", role: "member", username: "asha" });
const teammate = await users.createUser({ email: "ravi@acme.in", name: "Ravi", password: "password-2", role: "member" });
const outsider = await users.createUser({ email: "x@other.in", name: "Outsider", password: "password-3", role: "member" });

test("signing up gives a username; teammates are found by email or username", async () => {
  assert.equal(owner.username, "asha");
  assert.equal(teammate.username, "ravi");
  assert.equal(users.findUserByLogin("RAVI@acme.in")?.id, teammate.id);
  assert.equal(users.findUserByLogin("@ravi")?.id, teammate.id);
  assert.equal(users.findUserByLogin("nobody"), null);
  await assert.rejects(() => users.createUser({ email: "a2@acme.in", name: "A", password: "password-4", role: "member", username: "asha" }), /taken/);
});

test("a new company belongs to its creator; others can't see it", async () => {
  const c = await co.createCompany(owner, { name: "Acme Sweets", sector: "Food · Pune", primary: "#7A1F3D", accent: "#F2B544" });
  assert.equal(c.id, "acme-sweets");
  assert.equal(c.members[0].role, "owner");
  assert.ok(c.files.some((f) => f.name === "rules.md"));
  assert.ok(co.canManage(owner, c.id));
  assert.equal(co.canAccess(outsider, c.id), false);
  assert.deepEqual(co.clientsFor(outsider).map((x) => x.id).includes(c.id), false);
  assert.ok(co.clientsFor({ id: "staff", role: "admin" }).some((x) => x.id === c.id), "platform admins see every company");
});

test("with no approvers set, the owner approves in the studio", async () => {
  const client = co.loadClient("acme-sweets")!;
  assert.equal(client.approvers.length, 1);
  assert.equal(client.approvers[0].owner, true);
  assert.ok(co.approverForUser(client, owner));
  assert.equal(co.approverForUser(client, teammate), null);

  const idea = await wf.createIdea({ clientId: "acme-sweets", text: "Diwali sweets box", author: owner.name, authorId: owner.id, mode: "self" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Diwali sweets box. Order today — call us." }] });
  const sent = await wf.submitForApproval(idea.id);
  assert.equal(sent.status, "awaiting");
  assert.ok(co.listNotifications(owner.id).some((n) => n.kind === "approval"), "the approver is notified");

  await assert.rejects(() => wf.approve(idea.id, { userId: teammate.id }, "dashboard"), /approvers/);
  const done = await wf.approve(idea.id, { userId: owner.id }, "dashboard");
  assert.equal(done.status, "scheduled");
});

test("an approver can reject: back to production with the reason", async () => {
  const idea = await wf.createIdea({ clientId: "acme-sweets", text: "Weekend offer", author: owner.name, authorId: owner.id, mode: "self" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Weekend offer on kaju katli. Order today — call us." }] });
  await wf.submitForApproval(idea.id);
  const r = await wf.clientReply(idea.id, { userId: owner.id, text: "reject: wrong price", via: "dashboard" });
  assert.equal(r.status, "draft");
  assert.match(r.note ?? "", /Rejected by Asha Owner: wrong price/);
});

test("invite → notification → accept → member; members can be made approvers", async () => {
  await co.inviteMember("acme-sweets", owner, teammate, { role: "member", canApprove: true });
  await assert.rejects(() => co.inviteMember("acme-sweets", owner, teammate), /already has an invite/);
  const note = co.listNotifications(teammate.id).find((n) => n.kind === "invite");
  assert.ok(note?.inviteId);
  assert.equal(co.canAccess(teammate, "acme-sweets"), false, "no access before accepting");

  await co.respondInvite(note!.inviteId!, teammate, true);
  assert.ok(co.canAccess(teammate, "acme-sweets"));
  assert.equal(co.canManage(teammate, "acme-sweets"), false);
  const client = co.loadClient("acme-sweets")!;
  // Ravi approves now; the owner still can, but is no longer the "nobody set" fallback
  assert.deepEqual(client.approvers.map((a) => [a.userId, Boolean(a.owner)]), [[teammate.id, false], [owner.id, false]]);
  assert.ok(co.listNotifications(owner.id).some((n) => n.kind === "member" && /joined/.test(n.title)));
  await assert.rejects(() => co.inviteMember("acme-sweets", owner, teammate), /already in/);
});

test("the last owner can't leave or be demoted", async () => {
  await assert.rejects(() => co.removeMember("acme-sweets", owner.id), /last owner/);
  await assert.rejects(() => co.updateMember("acme-sweets", owner.id, { role: "member" }), /at least one owner/);
});

test("Brand Kit edits are validated and saved", async () => {
  await assert.rejects(() => co.updateKit("acme-sweets", { files: [{ name: "rules.md", content: "```bolo-checks\n{ not json\n```" }] }), /invalid bolo-checks/);
  await assert.rejects(() => co.updateKit("acme-sweets", { files: [{ name: "tokens.json", content: "{" }] }), /valid JSON/);
  await assert.rejects(() => co.updateKit("acme-sweets", { removeFiles: ["rules.md"] }), /required/);
  const c = await co.updateKit("acme-sweets", { meta: { sector: "Sweets · Pune" }, files: [{ name: "audience.md", content: "# Audience\n- Families in Pune" }] });
  assert.equal(c.sector, "Sweets · Pune");
  assert.match(c.files.find((f) => f.name === "audience.md")!.content, /Families/);
});

test("an old store migrates: kits become companies, users.json moves in, everyone keeps access", () => {
  const dir = process.env.BOLO_DATA_DIR!;
  const file = join(dir, "studio.json");
  assert.ok(existsSync(file));
  const accounts = store.readStore().users.map(({ username: _u, ...rest }) => rest); // as users.json had them: no usernames
  writeFileSync(join(dir, "users.json"), JSON.stringify(accounts));
  writeFileSync(file, JSON.stringify({ version: 1, posts: [], settings: {} }));
  const data = store.readStore();
  assert.equal(data.version, 3);
  assert.equal(data.users.length, 3, "accounts imported");
  assert.ok(data.users.every((u) => u.username), "usernames backfilled");
  const pushpam = data.companies.find((c) => c.id === "pushpam-demo");
  assert.ok(pushpam, "demo kits imported");
  assert.equal(pushpam!.members.length, 3, "every existing account joins");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).version, 3, "written back");
});
