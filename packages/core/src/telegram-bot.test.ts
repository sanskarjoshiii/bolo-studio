import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-tgbot-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
delete process.env.TELEGRAM_BOT_TOKEN; // nothing is really sent to Telegram
delete process.env.AUTH_SECRET;

const users = await import("./users");
const co = await import("./companies");
const wf = await import("./workflow");
const bot = await import("./telegram-bot");
const { readStore } = await import("./store");
(await import("./brand-kit")).repoRoot(); // loads .env…
process.env.TELEGRAM_BOT_TOKEN = ""; // …then make sure the real bot is never used here

const owner = await users.createUser({ email: "solo@shop.in", name: "Solo Founder", password: "password-1", role: "member", username: "solo" });
const company = await co.createCompany(owner, { name: "Solo Shop", sector: "Clothes · Nagpur" });

let n = 0;
const msg = (chat: { id: number; type: string; title?: string }, text: string, from = { id: 7, username: "solo_tg", first_name: "Solo" }) => ({
  update_id: ++n,
  message: { message_id: n, chat, from, text },
});
const tap = (chatId: number, data: string, from: { id: number; username?: string; first_name?: string }) => ({
  update_id: ++n,
  callback_query: { id: `cb${n}`, from, data, message: { message_id: 1, chat: { id: chatId, type: "group" } } },
});

async function waitingPost(title: string) {
  const p = await wf.createIdea({ clientId: company.id, text: title, author: owner.name, authorId: owner.id, mode: "self" });
  await wf.updatePost(p.id, { captions: [{ lang: "EN", text: `${title}. Order today — call us.` }] });
  return wf.submitForApproval(p.id);
}

test("one person can connect a private chat with the bot", async () => {
  const { code, privateLink } = await bot.startTelegramConnect(company.id);
  assert.equal(privateLink, null, "no bot token here, so no link — the code still works");
  await bot.handleTelegramUpdate(msg({ id: 555, type: "private" }, `/start ${code}`));
  const tg = readStore().companies.find((c) => c.id === company.id)!.connections.telegram;
  assert.equal(tg?.chatId, "555");
  assert.match(tg?.title ?? "", /Private chat with @solo_tg/);
});

test("a group can be connected; an old or wrong code does nothing", async () => {
  await bot.handleTelegramUpdate(msg({ id: -100, type: "supergroup", title: "Solo Shop approvals" }, "/start DEADBEEF00"));
  assert.equal(readStore().companies.find((c) => c.id === company.id)!.connections.telegram?.chatId, "555");
  const { code } = await bot.startTelegramConnect(company.id);
  await bot.handleTelegramUpdate(msg({ id: -100, type: "supergroup", title: "Solo Shop approvals" }, `/connect@BoloBot ${code}`));
  const tg = readStore().companies.find((c) => c.id === company.id)!.connections.telegram;
  assert.equal(tg?.chatId, "-100");
  assert.equal(tg?.title, "Solo Shop approvals");
});

test("Telegram approvers need no Bolo account; others can't approve", async () => {
  const post = await waitingPost("Festive kurta drop");
  assert.equal(post.status, "awaiting");
  await bot.handleTelegramUpdate(tap(-100, `a:${post.id}`, { id: 9, username: "random_person" }));
  assert.equal(readStore().posts.find((p) => p.id === post.id)!.status, "awaiting", "a stranger's tap is refused");

  await co.updateApprovals(company.id, { telegram: ["@Client_Manager"] });
  const client = co.loadClient(company.id)!;
  assert.ok(client.approvers.some((a) => a.handle === "@client_manager" && !a.userId), "listed without an account");
  assert.ok(client.approvers.some((a) => a.userId === owner.id), "the owner still approves");
  await bot.handleTelegramUpdate(tap(-100, `a:${post.id}`, { id: 10, username: "client_manager", first_name: "Meera" }));
  const done = readStore().posts.find((p) => p.id === post.id)!;
  assert.equal(done.status, "scheduled");
  assert.ok(done.thread.some((m) => m.client && /Meera/.test(m.from)), "recorded as the person who tapped");
});

test("“Anyone in this group can approve” lets every member of the connected chat approve — only there", async () => {
  const post = await waitingPost("Weekend sale");
  await co.updateApprovals(company.id, { anyoneInGroup: true });
  // Same person, a different chat: not the company's group, so nothing happens
  await bot.handleTelegramUpdate(tap(-999, `a:${post.id}`, { id: 11, username: "someone_else" }));
  assert.equal(readStore().posts.find((p) => p.id === post.id)!.status, "awaiting");
  await bot.handleTelegramUpdate(tap(-100, `r:${post.id}`, { id: 11, username: "someone_else" }));
  const rejected = readStore().posts.find((p) => p.id === post.id)!;
  assert.equal(rejected.status, "draft");
  assert.match(rejected.note ?? "", /Rejected by/);
});

test("typed “change #ref: …” from an approver sends it back with the note", async () => {
  await co.updateApprovals(company.id, { anyoneInGroup: false });
  const post = await waitingPost("New arrivals");
  const ref = (await import("./shared")).postRef(post);
  await bot.handleTelegramUpdate(msg({ id: -100, type: "supergroup" }, `change ${ref}: make the price bigger`, { id: 10, username: "client_manager", first_name: "Meera" }));
  const p = readStore().posts.find((x) => x.id === post.id)!;
  assert.equal(p.status, "draft");
  assert.match(p.note ?? "", /make the price bigger/);
});

test("bad Telegram usernames are refused", async () => {
  await assert.rejects(() => co.updateApprovals(company.id, { telegram: ["no"] }), /isn't a Telegram username/);
});
