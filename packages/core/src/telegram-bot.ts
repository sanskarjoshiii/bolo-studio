import { randomBytes } from "node:crypto";
import { loadClient, managersOf, pushNotification } from "./companies";
import { WorkflowError } from "./errors";
import { postRef } from "./shared";
import { readStore, updateStore } from "./store";
import { botUsername, sendText, telegramUpdatesMode, tg } from "./telegram";
import { approve, clientReply, findApprover, rejectPost } from "./workflow";

// What Bolo's Telegram bot does with incoming updates (webhook or long polling):
//  • "/start <code>" or "/connect <code>" in a group (or a private chat with the bot) → that chat
//    becomes the company's approvals chat
//  • ✅ / ✏️ / ⛔ buttons under an approval package → approve, ask what to change, reject
//  • a reply to "What should change?" → change request
//  • typed "approve #ref", "change #ref: …", "reject #ref" also work
// The company's approvers act (Bolo accounts with "can approve", Telegram usernames added in Team,
// the owners) — or anyone in the chat when the company turned on "Anyone in this group can approve".

type TgUser = { id: number; username?: string; first_name?: string };
type TgChat = { id: number; type: string; title?: string };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string; reply_to_message?: { text?: string; from?: TgUser } };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage } };

const nowIso = () => new Date().toISOString();
const CODE_TTL = 30 * 60_000;

/**
 * A fresh one-time code for a company and the one-click link that adds the bot to a group and sends
 * the code there. Returns null for the link when the bot isn't set up on this server.
 */
export async function startTelegramConnect(companyId: string) {
  const code = randomBytes(5).toString("hex").toUpperCase();
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    c.connections.telegramCode = { code, expiresAt: new Date(Date.now() + CODE_TTL).toISOString() };
  });
  const bot = await botUsername();
  return {
    code,
    bot,
    /** Opens Telegram → pick a group → the bot joins it and sends the code. */
    link: bot ? `https://t.me/${bot}?startgroup=${code}` : null,
    /** Opens a private chat with the bot → Start sends the code. For one person approving alone. */
    privateLink: bot ? `https://t.me/${bot}?start=${code}` : null,
    listening: telegramUpdatesMode() !== "off",
  };
}

export async function disconnectTelegram(companyId: string) {
  const chat = readStore().companies.find((c) => c.id === companyId)?.connections.telegram;
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (c) {
      delete c.connections.telegram;
      delete c.connections.telegramCode;
    }
  });
  if (chat) await sendText(chat.chatId, "This group is no longer connected to Bolo Studio. Approvals continue in the studio.");
}

function companyByChat(chatId: number | string) {
  return readStore().companies.find((c) => c.connections.telegram?.chatId === String(chatId));
}

/** "#p1a2b3" in the text → that company's post. */
function postByRef(companyId: string, text: string) {
  const ref = text.match(/#p[0-9a-f]{5}\b/i)?.[0].toLowerCase();
  return ref ? readStore().posts.find((p) => p.clientId === companyId && postRef(p) === ref) : undefined;
}

const who = (u?: TgUser) => (u?.username ? `@${u.username}` : (u?.first_name ?? "someone"));

async function linkGroup(msg: TgMessage, code: string) {
  const data = readStore();
  const company = data.companies.find((c) => c.connections.telegramCode?.code === code.toUpperCase());
  if (!company || Date.parse(company.connections.telegramCode!.expiresAt) < Date.now()) {
    await sendText(String(msg.chat.id), "That connect code isn't valid any more. In Bolo Studio → Connections → Telegram, click Connect again.");
    return;
  }
  const isPrivate = msg.chat.type === "private";
  const title = isPrivate ? `Private chat with ${who(msg.from)}` : (msg.chat.title ?? "Telegram group");
  await updateStore((d) => {
    const c = d.companies.find((x) => x.id === company.id)!;
    c.connections.telegram = { chatId: String(msg.chat.id), title, connectedAt: nowIso(), by: who(msg.from) };
    delete c.connections.telegramCode;
    for (const userId of managersOf(company.id)) {
      pushNotification(d, userId, {
        kind: "connection",
        title: `Telegram connected: ${title}`,
        body: "Approval requests for this company now arrive there with Approve / Changes / Reject buttons.",
        companyId: company.id,
        href: `/studio/${company.id}/connections`,
      });
    }
  });
  await sendText(
    String(msg.chat.id),
    isPrivate
      ? `Connected ✅ — approval requests for ${company.kit.meta.name} will arrive in this chat with the image or video. Tap ✅ Approve, ✏️ Changes or ⛔ Reject.`
      : `Connected ✅ — approval requests for ${company.kit.meta.name} will arrive here with the image or video.\nApprovers tap ✅ Approve, ✏️ Changes or ⛔ Reject. Who can approve is set in Bolo Studio → Team.`,
  );
}

/** Act for the person who tapped or typed, if they approve for this company. */
async function act(companyId: string, postId: string, from: TgUser, action: "approve" | "reject" | "change", note = "") {
  const client = loadClient(companyId);
  if (!client) return "That company no longer exists.";
  const handle = from.username ? `@${from.username}` : "";
  const actor = { handle, name: [from.first_name, handle && `(${handle})`].filter(Boolean).join(" ") || handle, inGroup: true };
  if (!findApprover(client, actor)) {
    return handle
      ? `${handle} isn't an approver for ${client.name}. The owner can add your Telegram username in Bolo Studio → Team → Telegram approvers.`
      : `Set a Telegram username (Telegram → Settings → Username) so ${client.name} can add you as an approver.`;
  }
  try {
    if (action === "approve") await approve(postId, actor, "telegram");
    else if (action === "reject") await rejectPost(postId, actor, note, "telegram");
    else await clientReply(postId, { ...actor, text: `change: ${note}`, via: "telegram" });
    return null;
  } catch (e) {
    return e instanceof WorkflowError ? e.message : "Something went wrong — try again in the studio.";
  }
}

const ASK = "What should change? Reply to this message";

export async function handleTelegramUpdate(update: TgUpdate) {
  const cb = update.callback_query;
  if (cb?.data && cb.message) {
    const [kind, postId] = cb.data.split(":");
    const company = companyByChat(cb.message.chat.id);
    const post = readStore().posts.find((p) => p.id === postId);
    if (!company || !post || post.clientId !== company.id) {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "This post isn't linked to this group any more." });
      return;
    }
    if (kind === "c") {
      await tg("answerCallbackQuery", { callback_query_id: cb.id });
      await sendText(String(cb.message.chat.id), `${ASK} ${postRef(post)} — ${post.title}`, { reply_markup: { force_reply: true, selective: false } });
      return;
    }
    const problem = await act(company.id, post.id, cb.from, kind === "a" ? "approve" : "reject");
    await tg("answerCallbackQuery", { callback_query_id: cb.id, text: problem ?? (kind === "a" ? "Approved ✅" : "Rejected"), show_alert: Boolean(problem) });
    if (!problem) await tg("editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
    return;
  }

  const msg = update.message;
  const text = msg?.text?.trim();
  if (!msg || !text) return;

  const start = text.match(/^\/(?:start|connect)(?:@\w+)?\s+([0-9A-Fa-f]{6,})\b/);
  if (start) return linkGroup(msg, start[1]);

  const company = companyByChat(msg.chat.id);
  if (!company || !msg.from) return;

  // A reply to "What should change? … #ref"
  const asked = msg.reply_to_message?.text?.startsWith(ASK) ? msg.reply_to_message.text : null;
  if (asked) {
    const post = postByRef(company.id, asked);
    if (!post) return;
    const problem = await act(company.id, post.id, msg.from, "change", text);
    if (problem) await sendText(String(msg.chat.id), problem, { reply_to_message_id: msg.message_id });
    return;
  }

  const typed = text.match(/^(approve|reject|change)\b/i);
  if (typed) {
    const post = postByRef(company.id, text) ?? (() => {
      // No ref: the only post waiting in this company
      const waiting = readStore().posts.filter((p) => p.clientId === company.id && p.status === "awaiting");
      return waiting.length === 1 ? waiting[0] : undefined;
    })();
    if (!post) {
      await sendText(String(msg.chat.id), "Which post? Add its ref, e.g. approve #p1a2b3.", { reply_to_message_id: msg.message_id });
      return;
    }
    const kind = typed[1].toLowerCase() as "approve" | "reject" | "change";
    const note = text.replace(/^(approve|reject|change)\b(?:\s*#\w+)?\s*:?\s*/i, "");
    if (kind === "change" && !note) {
      await sendText(String(msg.chat.id), `Say what should change: change ${postRef(post)}: <what>`, { reply_to_message_id: msg.message_id });
      return;
    }
    const problem = await act(company.id, post.id, msg.from, kind, note);
    if (problem) await sendText(String(msg.chat.id), problem, { reply_to_message_id: msg.message_id });
  }
}

// ---------- long polling (local and single-server; production can use the webhook route) ----------

const g = globalThis as typeof globalThis & { __boloTgPoller?: { stop: boolean } };

export function startTelegramPoller(log: (m: string) => void = console.log) {
  if (telegramUpdatesMode() !== "poll" || g.__boloTgPoller) return;
  const state = { stop: false };
  g.__boloTgPoller = state;
  let offset = 0;
  void (async () => {
    // Polling and a webhook can't both be on — polling wins on this server
    await tg("deleteWebhook", { drop_pending_updates: false });
    log("Telegram: listening for approvals and group connections (long polling).");
    while (!state.stop) {
      const r = await tg<TgUpdate[]>("getUpdates", { offset, timeout: 45, allowed_updates: ["message", "callback_query"] });
      if (!r.ok) {
        if (/Conflict/i.test(r.reason)) log("Telegram: another program is reading this bot's updates (Switch?) — set TELEGRAM_UPDATES=off or use a separate bot.");
        await new Promise((ok) => setTimeout(ok, 15_000));
        continue;
      }
      for (const u of r.result) {
        offset = u.update_id + 1;
        await handleTelegramUpdate(u).catch((e) => log(`Telegram update failed: ${(e as Error).message}`));
      }
    }
  })();
}

export function stopTelegramPoller() {
  if (g.__boloTgPoller) g.__boloTgPoller.stop = true;
  g.__boloTgPoller = undefined;
}
