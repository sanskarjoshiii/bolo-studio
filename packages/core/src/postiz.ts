import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { mediaPath } from "./media";
import { languagePlan } from "./shared";
import type { Client, Platform, Post } from "./types";

// Postiz public API — https://docs.postiz.com/public-api
// Auth is the raw API key in the Authorization header (no "Bearer").

export function postizConfig() {
  const url = setting("POSTIZ_API_URL").replace(/\/$/, "");
  const key = setting("POSTIZ_API_KEY");
  return { url, key, configured: Boolean(url && key) };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = postizConfig();
  const res = await fetch(`${url}${path}`, { ...init, headers: { Authorization: key, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Postiz ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

export type PostizIntegration = { id: string; name?: string; identifier?: string; picture?: string; disabled?: boolean };

export function listIntegrations() {
  return call<PostizIntegration[]>("/integrations");
}

/** Upload a rendered PNG/MP4; returns the { id, path } Postiz expects in value[].image. */
export async function uploadMedia(filePath: string, type?: string) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(filePath)], type ? { type } : undefined), basename(filePath));
  return call<{ id: string; path: string }>("/upload", { method: "POST", body: form });
}

/**
 * Per-provider settings (Postiz public API, settings.__type + provider fields):
 * Instagram post_type "post" | "story", LinkedIn image carousel, YouTube title/visibility.
 * Verify against the provider docs on the first real publish of each kind.
 */
export function providerSettings(platform: Platform, post: Post): Record<string, unknown> {
  switch (platform) {
    case "instagram":
      return { __type: "instagram", post_type: post.format === "Story" ? "story" : "post", collaborators: [] };
    case "facebook":
      return { __type: "facebook" };
    case "linkedin":
      return { __type: "linkedin", post_as_images_carousel: post.format === "Carousel" };
    case "youtube":
      return { __type: "youtube", title: post.title.slice(0, 100), type: "public", selfDeclaredMadeForKids: "no", tags: [] };
  }
}

/** Caption for one platform: stories carry none; LinkedIn keeps at most 3 hashtags. */
export function captionFor(platform: Platform, post: Post) {
  if (post.format === "Story") return "";
  const caps = post.captions.filter((c) => c.text.trim());
  // Two-language posts (Marathi + English …) publish both captions; hashtags only once, at the end
  const both = caps.length > 1 && (languagePlan(post.languages)?.langs.length ?? 0) > 1;
  const stripTags = (t: string) => t.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]{2,}/g, " ").trim();
  const text = both ? `${stripTags(caps[0].text)}\n\n${caps[1].text.trim()}` : (caps[0]?.text ?? "");
  if (platform !== "linkedin") return text;
  let n = 0;
  return text.replace(/#[\p{L}\p{N}_]+/gu, (t) => (++n <= 3 ? t : "")).replace(/[ \t]{2,}/g, " ").trim();
}

/** The POST /posts body — pure, so it can be tested without Postiz. */
export function postizBody(post: Post, channels: { platform: Platform; postizIntegrationId?: string }[], images: { id: string; path: string }[], now = new Date()) {
  const at = new Date(post.scheduledAt);
  const due = at.getTime() <= now.getTime() + 60_000;
  return {
    type: due ? "now" : "schedule",
    date: (due ? now : at).toISOString(),
    shortLink: false,
    tags: [],
    posts: channels.map((ch) => ({
      integration: { id: ch.postizIntegrationId },
      value: [{ content: captionFor(ch.platform, post), image: images }],
      settings: providerSettings(ch.platform, post),
    })),
  };
}

/** What to publish: videos for reels/stories with video, otherwise the images in order (≤10). */
export function publishMedia(post: Post) {
  const media = post.media ?? [];
  const videos = media.filter((m) => m.kind === "video");
  if ((post.format === "Reel" || post.format === "Story") && videos.length) return [videos.at(-1)!];
  if (post.format === "Reel") return [];
  // A designed render already contains the reference photos — publish it; otherwise the uploads
  const images = media.filter((m) => m.kind === "image");
  const designed = images.filter((m) => m.source === "template");
  return (designed.length ? designed : images).slice(0, post.format === "Carousel" ? 10 : 1);
}

export type ScheduleResult = { postizId: string; dryRun: boolean; reason?: string };

export async function schedulePost(post: Post, client: Client): Promise<ScheduleResult> {
  const { configured } = postizConfig();
  const channels = post.platforms
    .map((p) => client.channels.find((c) => c.platform === p))
    .filter((c): c is NonNullable<typeof c> => Boolean(c?.postizIntegrationId));

  if (!configured) return { postizId: `dry-${post.id}`, dryRun: true, reason: "POSTIZ_API_KEY not set" };
  if (channels.length !== post.platforms.length) {
    return { postizId: `dry-${post.id}`, dryRun: true, reason: "Some channels have no postizIntegrationId in client.json" };
  }

  const media = publishMedia(post);
  if (!media.length && (post.format === "Reel" || post.platforms.some((p) => p === "instagram" || p === "youtube"))) {
    throw new WorkflowError(
      409,
      post.format === "Reel" ? "A reel needs its video — Generate reel (or upload the MP4) first." : "Instagram needs an image or video — Generate it from the template or upload one first.",
    );
  }
  const images: { id: string; path: string }[] = [];
  for (const m of media) images.push(await uploadMedia(mediaPath(post.id, m.file), m.type));

  const body = postizBody(post, channels, images);

  const res = await call<{ postId?: string; id?: string }[] | { postId?: string; id?: string }>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const first = Array.isArray(res) ? res[0] : res;
  return { postizId: first?.postId ?? first?.id ?? "unknown", dryRun: false };
}
