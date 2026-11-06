import { readFileSync } from "node:fs";
import { getCompany } from "./companies";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { mediaPath } from "./media";
import { captionFor, publishMedia } from "./postiz";
import { decrypt, encrypt } from "./secrets";
import { updateStore } from "./store";
import type { Media, Platform, Post } from "./types";
import { signToken } from "./users";

// Clients connect their own Facebook Page (+ its Instagram business account) and LinkedIn with one
// login each; Bolo Studio then publishes through the official APIs — no Postiz, no keys for the
// client. The developer apps (META_APP_ID / SECRET, LINKEDIN_CLIENT_ID / SECRET) are the platform's,
// set once by the Bolo Studio admin.

const nowIso = () => new Date().toISOString();
const webUrl = () => (setting("BOLO_WEB_URL") || "http://localhost:3000").replace(/\/$/, "");
/** Where Instagram fetches media from — must be public https (your domain on AWS, or a tunnel locally). */
const publicUrl = () => (setting("BOLO_PUBLIC_URL") || setting("BOLO_WEB_URL")).replace(/\/$/, "");

// ---------------------------------- Meta ----------------------------------

const GRAPH = () => `https://graph.facebook.com/${setting("META_GRAPH_VERSION") || "v23.0"}`;
const META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management", "instagram_basic", "instagram_content_publish"];

export const metaConfigured = () => Boolean(setting("META_APP_ID") && setting("META_APP_SECRET"));
export const metaRedirectUri = () => `${webUrl()}/api/connect/meta/callback`;

export function metaAuthUrl(state: string) {
  if (!metaConfigured()) throw new WorkflowError(409, "Facebook & Instagram aren't available yet — the Bolo Studio admin needs to add the Meta app (META_APP_ID / SECRET).");
  const q = new URLSearchParams({ client_id: setting("META_APP_ID"), redirect_uri: metaRedirectUri(), state, response_type: "code", scope: META_SCOPES.join(",") });
  return `https://www.facebook.com/${setting("META_GRAPH_VERSION") || "v23.0"}/dialog/oauth?${q}`;
}

async function graph<T>(path: string, init: { method?: string; params?: Record<string, string>; body?: FormData | URLSearchParams } = {}): Promise<T> {
  const url = new URL(`${GRAPH()}${path}`);
  for (const [k, v] of Object.entries(init.params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { method: init.method ?? (init.body ? "POST" : "GET"), body: init.body, signal: AbortSignal.timeout(120_000) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!res.ok || j.error) {
    const e = j.error;
    if (e?.code === 190) throw new WorkflowError(409, "The Facebook login expired or was revoked — reconnect Facebook & Instagram in Connections.");
    throw new WorkflowError(409, `Facebook: ${e?.error_user_msg ?? e?.message ?? `HTTP ${res.status}`}`);
  }
  return j;
}

type PageInfo = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

/**
 * After the Facebook login: a long-lived user token gives Page tokens that don't expire. One Page →
 * connected right away; several → the client picks one in Connections.
 */
export async function connectMeta(companyId: string, code: string) {
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    params: { client_id: setting("META_APP_ID"), client_secret: setting("META_APP_SECRET"), redirect_uri: metaRedirectUri(), code },
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    params: { grant_type: "fb_exchange_token", client_id: setting("META_APP_ID"), client_secret: setting("META_APP_SECRET"), fb_exchange_token: short.access_token },
  });
  const meInfo = await graph<{ name?: string }>("/me", { params: { fields: "name", access_token: long.access_token } });
  const pages = await graph<{ data: PageInfo[] }>("/me/accounts", { params: { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: long.access_token } });
  if (!pages.data.length) {
    throw new WorkflowError(409, "No Facebook Page came back. You need a Facebook Page you manage — and in the login screen, tick that Page (and its Instagram account).");
  }
  const list = pages.data.map((p) => ({ id: p.id, name: p.name, token: encrypt(p.access_token), igUserId: p.instagram_business_account?.id, igUsername: p.instagram_business_account?.username }));
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    if (list.length === 1) {
      const p = list[0];
      c.connections.meta = { userName: meInfo.name, pageId: p.id, pageName: p.name, pageToken: p.token, igUserId: p.igUserId, igUsername: p.igUsername, connectedAt: nowIso() };
      delete c.connections.metaPending;
    } else {
      c.connections.metaPending = { pages: list, userName: meInfo.name, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
    }
  });
  return { pages: list.length };
}

/** The client picked which Page (and its Instagram) this company posts to. */
export async function chooseMetaPage(companyId: string, pageId: string) {
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    const pending = c?.connections.metaPending;
    if (!c || !pending || Date.parse(pending.expiresAt) < Date.now()) throw new WorkflowError(409, "That choice expired — click Connect Facebook & Instagram again.");
    const p = pending.pages.find((x) => x.id === pageId);
    if (!p) throw new WorkflowError(404, "That Page isn't in the list.");
    c.connections.meta = { userName: pending.userName, pageId: p.id, pageName: p.name, pageToken: p.token, igUserId: p.igUserId, igUsername: p.igUsername, connectedAt: nowIso() };
    delete c.connections.metaPending;
  });
}

// ---------------------------------- LinkedIn ----------------------------------

export const linkedinConfigured = () => Boolean(setting("LINKEDIN_CLIENT_ID") && setting("LINKEDIN_CLIENT_SECRET"));
export const linkedinRedirectUri = () => `${webUrl()}/api/connect/linkedin/callback`;

/** LinkedIn's API is versioned by month (YYYYMM, each supported about a year) — default: two months back. */
function linkedinVersion() {
  const v = setting("LINKEDIN_VERSION");
  if (v) return v;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function linkedinAuthUrl(state: string) {
  if (!linkedinConfigured()) throw new WorkflowError(409, "LinkedIn isn't available yet — the Bolo Studio admin needs to add the LinkedIn app (LINKEDIN_CLIENT_ID / SECRET).");
  const q = new URLSearchParams({ response_type: "code", client_id: setting("LINKEDIN_CLIENT_ID"), redirect_uri: linkedinRedirectUri(), state, scope: "openid profile w_member_social" });
  return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
}

export async function connectLinkedIn(companyId: string, code: string) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: linkedinRedirectUri(), client_id: setting("LINKEDIN_CLIENT_ID"), client_secret: setting("LINKEDIN_CLIENT_SECRET") }),
  });
  const t = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!t.access_token) throw new WorkflowError(409, `LinkedIn sign-in failed: ${t.error_description ?? res.status}`);
  const info = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
  const me = (await info.json().catch(() => ({}))) as { sub?: string; name?: string };
  if (!me.sub) throw new WorkflowError(409, "LinkedIn didn't return your profile — try connecting again.");
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    c.connections.linkedin = {
      name: me.name ?? "LinkedIn member",
      authorUrn: `urn:li:person:${me.sub}`,
      token: encrypt(t.access_token!),
      expiresAt: new Date(Date.now() + (t.expires_in ?? 60 * 86_400) * 1000).toISOString(),
      connectedAt: nowIso(),
    };
  });
}

// ---------------------------------- status ----------------------------------

export async function disconnectSocial(companyId: string, which: "meta" | "linkedin") {
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) return;
    delete c.connections[which];
    if (which === "meta") delete c.connections.metaPending;
  });
}

/** Which platforms this company can publish to directly. */
export function directPlatforms(companyId: string): Platform[] {
  const c = getCompany(companyId)?.connections;
  const out: Platform[] = [];
  if (c?.meta) {
    out.push("facebook");
    if (c.meta.igUserId) out.push("instagram");
  }
  if (c?.linkedin && Date.parse(c.linkedin.expiresAt) > Date.now()) out.push("linkedin");
  return out;
}

// ---------------------------------- publishing ----------------------------------

export type PublishOutcome = { ok: true; id: string; url?: string } | { ok: false; error: string };

const bytesOf = (post: Post, m: Media) => new Blob([readFileSync(mediaPath(post.id, m.file))], { type: m.type });

/** A signed, expiring public link to one media file (Instagram downloads from it). */
export function publicMediaUrl(post: Post, m: Media) {
  const base = publicUrl();
  if (!/^https:\/\//.test(base)) {
    throw new WorkflowError(409, "Instagram downloads the media from a public https link — set BOLO_PUBLIC_URL (your AWS domain, or a tunnel such as ngrok when running locally).");
  }
  const t = signToken({ kind: "media", pid: post.id, f: m.file }, 3 * 3600);
  return `${base}/api/public-media/${post.id}/${encodeURIComponent(m.file)}?t=${encodeURIComponent(t)}`;
}

async function facebook(post: Post, pageId: string, token: string): Promise<PublishOutcome> {
  const media = publishMedia(post);
  const caption = captionFor("facebook", post);
  if (post.format === "Story") {
    const img = media.find((m) => m.kind === "image");
    if (!img) return { ok: false, error: "Facebook video stories aren't supported here yet — use an image story, or post it as a Reel." };
    const form = new FormData();
    form.append("source", bytesOf(post, img), img.name);
    form.append("published", "false");
    form.append("access_token", token);
    const photo = await graph<{ id: string }>(`/${pageId}/photos`, { body: form });
    const story = await graph<{ post_id?: string; id?: string }>(`/${pageId}/photo_stories`, { body: new URLSearchParams({ photo_id: photo.id, access_token: token }) });
    return { ok: true, id: story.post_id ?? story.id ?? photo.id };
  }
  const video = media.find((m) => m.kind === "video");
  if (video) {
    const form = new FormData();
    form.append("source", bytesOf(post, video), video.name);
    form.append("description", caption);
    form.append("access_token", token);
    const v = await graph<{ id: string }>(`/${pageId}/videos`, { body: form });
    return { ok: true, id: v.id, url: `https://www.facebook.com/${pageId}/videos/${v.id}` };
  }
  if (!media.length) {
    const p = await graph<{ id: string }>(`/${pageId}/feed`, { body: new URLSearchParams({ message: caption, access_token: token }) });
    return { ok: true, id: p.id, url: `https://www.facebook.com/${p.id}` };
  }
  if (media.length === 1) {
    const form = new FormData();
    form.append("source", bytesOf(post, media[0]), media[0].name);
    form.append("caption", caption);
    form.append("access_token", token);
    const p = await graph<{ id: string; post_id?: string }>(`/${pageId}/photos`, { body: form });
    return { ok: true, id: p.post_id ?? p.id, url: `https://www.facebook.com/${p.post_id ?? p.id}` };
  }
  // Several images: upload unpublished, then one feed post with all of them
  const ids: string[] = [];
  for (const m of media) {
    const form = new FormData();
    form.append("source", bytesOf(post, m), m.name);
    form.append("published", "false");
    form.append("access_token", token);
    ids.push((await graph<{ id: string }>(`/${pageId}/photos`, { body: form })).id);
  }
  const body = new URLSearchParams({ message: caption, access_token: token });
  ids.forEach((id, i) => body.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  const p = await graph<{ id: string }>(`/${pageId}/feed`, { body });
  return { ok: true, id: p.id, url: `https://www.facebook.com/${p.id}` };
}

/** Instagram containers take a while to process videos — wait until FINISHED (max ~5 min). */
async function waitForContainer(id: string, token: string) {
  for (let i = 0; i < 60; i++) {
    const s = await graph<{ status_code?: string; status?: string }>(`/${id}`, { params: { fields: "status_code,status", access_token: token } });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new WorkflowError(409, `Instagram couldn't process the media (${s.status ?? s.status_code}).`);
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  throw new WorkflowError(409, "Instagram is still processing the video — try Post now again in a few minutes.");
}

async function instagram(post: Post, igUserId: string, token: string): Promise<PublishOutcome> {
  const media = publishMedia(post);
  if (!media.length) return { ok: false, error: "Instagram needs an image or video — generate or upload one first." };
  const caption = captionFor("instagram", post);
  const container = async (m: Media, extra: Record<string, string>) => {
    const params: Record<string, string> = { access_token: token, ...extra };
    if (m.kind === "video") params.video_url = publicMediaUrl(post, m);
    else params.image_url = publicMediaUrl(post, m);
    const c = await graph<{ id: string }>(`/${igUserId}/media`, { body: new URLSearchParams(params) });
    if (m.kind === "video") await waitForContainer(c.id, token);
    return c.id;
  };

  let creation: string;
  if (post.format === "Story") creation = await container(media[0], { media_type: "STORIES" });
  else if (post.format === "Reel" || media[0].kind === "video") creation = await container(media[0], { media_type: "REELS", caption, share_to_feed: "true" });
  else if (media.length > 1) {
    const children: string[] = [];
    for (const m of media.slice(0, 10)) children.push(await container(m, { is_carousel_item: "true", ...(m.kind === "video" ? { media_type: "VIDEO" } : {}) }));
    const parent = await graph<{ id: string }>(`/${igUserId}/media`, { body: new URLSearchParams({ media_type: "CAROUSEL", children: children.join(","), caption, access_token: token }) });
    creation = parent.id;
  } else creation = await container(media[0], { caption });

  const published = await graph<{ id: string }>(`/${igUserId}/media_publish`, { body: new URLSearchParams({ creation_id: creation, access_token: token }) });
  const link = await graph<{ permalink?: string }>(`/${published.id}`, { params: { fields: "permalink", access_token: token } }).catch(() => ({ permalink: undefined }));
  return { ok: true, id: published.id, url: link.permalink };
}

async function linkedinFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.linkedin.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": linkedinVersion(), "X-Restli-Protocol-Version": "2.0.0", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(180_000),
  });
  if (res.status === 401) throw new WorkflowError(409, "The LinkedIn login expired — reconnect LinkedIn in Connections.");
  if (!res.ok) throw new WorkflowError(409, `LinkedIn ${init.method ?? "GET"} ${path.split("?")[0]} failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res;
}

async function linkedinUploadImage(post: Post, m: Media, owner: string, token: string) {
  const init = await linkedinFetch("/rest/images?action=initializeUpload", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: readFileSync(mediaPath(post.id, m.file)) });
  if (!put.ok) throw new WorkflowError(409, `LinkedIn image upload failed (${put.status}).`);
  return value.image;
}

async function linkedinUploadVideo(post: Post, m: Media, owner: string, token: string) {
  const bytes = readFileSync(mediaPath(post.id, m.file));
  const init = await linkedinFetch("/rest/videos?action=initializeUpload", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false } }),
  });
  const { value } = (await init.json()) as { value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } };
  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const res = await fetch(part.uploadUrl, { method: "PUT", body: bytes.subarray(part.firstByte, part.lastByte + 1) });
    if (!res.ok) throw new WorkflowError(409, `LinkedIn video upload failed (${res.status}).`);
    etags.push(res.headers.get("etag") ?? "");
  }
  await linkedinFetch("/rest/videos?action=finalizeUpload", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken, uploadedPartIds: etags } }),
  });
  return value.video;
}

async function linkedin(post: Post, authorUrn: string, token: string): Promise<PublishOutcome> {
  if (post.format === "Story") return { ok: false, error: "LinkedIn has no stories." };
  const media = publishMedia(post);
  const commentary = captionFor("linkedin", post).replace(/[\\|{}@[\]()<>#*_~]/g, (ch) => `\\${ch}`);
  let content: Record<string, unknown> | undefined;
  const video = media.find((m) => m.kind === "video");
  if (video) content = { media: { id: await linkedinUploadVideo(post, video, authorUrn, token), title: post.title.slice(0, 200) } };
  else if (media.length === 1) content = { media: { id: await linkedinUploadImage(post, media[0], authorUrn, token), altText: post.title.slice(0, 300) } };
  else if (media.length > 1) {
    const images = [];
    for (const m of media.slice(0, 9)) images.push({ id: await linkedinUploadImage(post, m, authorUrn, token), altText: post.title.slice(0, 300) });
    content = { multiImage: { images } };
  }
  const res = await linkedinFetch("/rest/posts", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: authorUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const urn = res.headers.get("x-restli-id") ?? "";
  return { ok: true, id: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined };
}

/** Publish one post to one platform through the company's own connection. */
export async function publishTo(post: Post, platform: Platform): Promise<PublishOutcome> {
  const c = getCompany(post.clientId)?.connections;
  try {
    if (platform === "facebook" && c?.meta) return await facebook(post, c.meta.pageId, decrypt(c.meta.pageToken));
    if (platform === "instagram" && c?.meta?.igUserId) return await instagram(post, c.meta.igUserId, decrypt(c.meta.pageToken));
    if (platform === "linkedin" && c?.linkedin) return await linkedin(post, c.linkedin.authorUrn, decrypt(c.linkedin.token));
    return { ok: false, error: `${platform} isn't connected for this company.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
