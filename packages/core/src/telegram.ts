import { readFileSync } from "node:fs";
import { setting } from "./env";
import { mediaPath } from "./media";
import { publishMedia } from "./postiz";
import { formatSlot, postRef } from "./shared";
import { readStore } from "./store";
import { findRoomByName, switchConfig, type Delivery } from "./switch";
import type { Media, Post } from "./types";

// Telegram through Bolo Studio's own bot (TELEGRAM_BOT_TOKEN, set once by the admin). A company
// connects its group with one click (a t.me "add to group" link carrying a code); approval
// packages then arrive there with the media and Approve / Changes / Reject buttons.
// Companies set up before this still go through the Switch room (text) + this bot (media).

const LIMITS = { photo: 10 * 1024 * 1024, video: 50 * 1024 * 1024 }; // Bot API upload limits

export function telegramConfigured() {
  return Boolean(setting("TELEGRAM_BOT_TOKEN"));
}

/**
 * How Bolo hears the bot's messages. With Switch set up, Switch owns the bot: it bridges each
 * client's Telegram group into a Switch room, and the Publisher agent relays "approve #ref" — so
 * Bolo only *sends* through the bot ("off"). Without Switch, Bolo reads the bot itself ("poll").
 * Telegram lets only one program read a bot's messages. TELEGRAM_UPDATES overrides.
 */
export function telegramUpdatesMode(): "webhook" | "poll" | "off" {
  const m = setting("TELEGRAM_UPDATES").toLowerCase();
  if (m === "webhook" || m === "poll" || m === "off") return m;
  if (!telegramConfigured()) return "off";
  return switchConfig().configured ? "off" : "poll";
}

/** Approvals run through Switch rooms (Switch-first) rather than Bolo's own bot buttons. */
export const approvalsViaSwitch = () => switchConfig().configured && telegramUpdatesMode() === "off";

/** The client approves exactly what will be published — same selection as the publisher uses. */
export function previewMedia(post: Post): Media[] {
  return publishMedia(post);
}

export type TgResult<T = unknown> = { ok: true; result: T } | { ok: false; reason: string };

export async function tg<T = unknown>(method: string, body: FormData | Record<string, unknown>): Promise<TgResult<T>> {
  const token = setting("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN isn't set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      ...(body instanceof FormData ? { body } : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
      signal: AbortSignal.timeout(method === "getUpdates" ? 60_000 : 30_000),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
    return j.ok ? { ok: true, result: j.result as T } : { ok: false, reason: `Telegram ${method}: ${j.description ?? res.status}` };
  } catch (e) {
    return { ok: false, reason: `Telegram unreachable: ${(e as Error).message}` };
  }
}

const toDelivery = (r: TgResult): Delivery => (r.ok ? { ok: true } : { ok: false, reason: r.reason });

let me: { username: string; at: number } | null = null;
/** The bot's @username (cached for an hour) — used in the "add to group" link. */
export async function botUsername(): Promise<string | null> {
  if (me && me.at > Date.now() - 3_600_000) return me.username;
  const r = await tg<{ username: string }>("getMe", {});
  if (!r.ok) return null;
  me = { username: r.result.username, at: Date.now() };
  return me.username;
}

/** The company's own connected group, else the chat id Switch learned for its approvals room. */
export function chatFor(companyId: string, approvalsRoom?: string): { chatId: string; own: boolean } | null {
  const own = readStore().companies.find((c) => c.id === companyId)?.connections.telegram;
  if (own?.chatId) return { chatId: own.chatId, own: true };
  const room = approvalsRoom ? findRoomByName(approvalsRoom) : undefined;
  return room?.externalId ? { chatId: room.externalId, own: false } : null;
}

const blob = (post: Post, m: Media) => new Blob([readFileSync(mediaPath(post.id, m.file))], { type: m.type });

/** Send the post's media to a chat, captioned with the ref. Returns why it didn't send, never throws. */
export async function sendMediaToChat(chatId: string, post: Post): Promise<Delivery> {
  if (!telegramConfigured()) return { ok: false, reason: "Telegram isn't set up on this server yet (media not sent; text was)" };
  const media = previewMedia(post);
  if (!media.length) return { ok: false, reason: "no image or video attached yet" };
  const caption = `${post.title} ${postRef(post)}\n${post.format} · ${formatSlot(post.scheduledAt)} IST`.slice(0, 1024);

  for (const m of media) {
    const limit = m.kind === "video" ? LIMITS.video : LIMITS.photo;
    if (m.size > limit) return { ok: false, reason: `${m.name} is over Telegram's ${limit / 1024 / 1024} MB bot limit — share it via Drive` };
  }

  if (media.length === 1) {
    const m = media[0];
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    if (m.kind === "video") {
      form.append("video", blob(post, m), m.name);
      form.append("supports_streaming", "true");
      return toDelivery(await tg("sendVideo", form));
    }
    form.append("photo", blob(post, m), m.name);
    return toDelivery(await tg("sendPhoto", form));
  }

  // Album (carousel slides): media items reference attached files by name
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("media", JSON.stringify(media.slice(0, 10).map((m, i) => ({ type: m.kind === "video" ? "video" : "photo", media: `attach://file${i}`, ...(i === 0 ? { caption } : {}) }))));
  media.slice(0, 10).forEach((m, i) => form.append(`file${i}`, blob(post, m), m.name));
  return toDelivery(await tg("sendMediaGroup", form));
}

/** Back-compat: media to the chat Switch learned for a room name. */
export async function sendMediaToRoom(roomName: string, post: Post): Promise<Delivery> {
  if (!telegramConfigured()) return { ok: false, reason: "TELEGRAM_BOT_TOKEN isn't set in .env (media not sent; text was)" };
  const chatId = findRoomByName(roomName)?.externalId;
  if (!chatId) return { ok: false, reason: `no Telegram chat id for “${roomName}” yet — the Publisher learns it once it's in the room` };
  return sendMediaToChat(chatId, post);
}

/** Approve / Changes / Reject under the approval package. Callback data: <action>:<postId>. */
export const approvalButtons = (postId: string) => ({
  inline_keyboard: [
    [
      { text: "✅ Approve", callback_data: `a:${postId}` },
      { text: "✏️ Changes", callback_data: `c:${postId}` },
      { text: "⛔ Reject", callback_data: `r:${postId}` },
    ],
  ],
});

export async function sendText(chatId: string, text: string, extra: Record<string, unknown> = {}): Promise<Delivery> {
  return toDelivery(await tg("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true, ...extra }));
}
