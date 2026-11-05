import { readFileSync } from "node:fs";
import { setting } from "./env";
import { mediaPath } from "./media";
import { publishMedia } from "./postiz";
import { formatSlot, postRef } from "./shared";
import { findRoomByName, type Delivery } from "./switch";
import type { Media, Post } from "./types";

// Switch relays text only, so the files the client approves (image, slides, video) go to the
// Telegram group directly through the Bot API with the same bot Switch uses. The chat id comes
// from Switch (get_room_detail.external_channel_id), stored with the room by the Publisher.

const LIMITS = { photo: 10 * 1024 * 1024, video: 50 * 1024 * 1024 }; // Bot API upload limits

export function telegramConfigured() {
  return Boolean(setting("TELEGRAM_BOT_TOKEN"));
}

/** The client approves exactly what will be published — same selection as Postiz gets. */
export function previewMedia(post: Post): Media[] {
  return publishMedia(post);
}

async function call(method: string, form: FormData): Promise<Delivery> {
  const token = setting("TELEGRAM_BOT_TOKEN");
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return body.ok ? { ok: true } : { ok: false, reason: `Telegram ${method}: ${body.description ?? res.status}` };
  } catch (e) {
    return { ok: false, reason: `Telegram unreachable: ${(e as Error).message}` };
  }
}

const blob = (post: Post, m: Media) => new Blob([readFileSync(mediaPath(post.id, m.file))], { type: m.type });

/**
 * Send the post's media to the client's Telegram approvals group, captioned with the ref so the
 * client can answer "approve #ref". Returns why it didn't send, never throws.
 */
export async function sendMediaToRoom(roomName: string, post: Post): Promise<Delivery> {
  if (!telegramConfigured()) return { ok: false, reason: "TELEGRAM_BOT_TOKEN isn't set in .env (media not sent; text was)" };
  const room = findRoomByName(roomName);
  const chatId = room?.externalId;
  if (!chatId) return { ok: false, reason: `no Telegram chat id for “${roomName}” yet — the Publisher learns it once it's in the room` };

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
      return call("sendVideo", form);
    }
    form.append("photo", blob(post, m), m.name);
    return call("sendPhoto", form);
  }

  // Album (carousel slides): media items reference attached files by name
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append(
    "media",
    JSON.stringify(media.map((m, i) => ({ type: m.kind === "video" ? "video" : "photo", media: `attach://file${i}`, ...(i === 0 ? { caption } : {}) }))),
  );
  media.forEach((m, i) => form.append(`file${i}`, blob(post, m), m.name));
  return call("sendMediaGroup", form);
}
