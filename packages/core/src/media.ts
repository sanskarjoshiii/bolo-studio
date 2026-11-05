import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { repoRoot } from "./brand-kit";
import { readStore, updateStore } from "./store";
import type { Media } from "./types";
import { WorkflowError } from "./errors";

// Rendered/uploaded creatives live in data/media/<postId>/. Only these types are accepted —
// the formats Instagram, Facebook, LinkedIn and YouTube take through Postiz.

export const MEDIA_TYPES: Record<string, Media["kind"]> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
};
export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

const mediaRoot = () => resolve(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), "media");

/** Absolute path of a stored file — refuses anything that would escape data/media. */
export function mediaPath(postId: string, file: string) {
  const p = resolve(mediaRoot(), postId, file);
  if (!p.startsWith(mediaRoot() + sep)) throw new WorkflowError(400, "Invalid media path.");
  return p;
}

const safeName = (name: string) =>
  basename(name)
    .toLowerCase()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+(\.)/g, "$1")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";

export function readMedia(postId: string, file: string) {
  const p = mediaPath(postId, file);
  if (!existsSync(p)) throw new WorkflowError(404, "File not found.");
  return readFileSync(p);
}

/** Store a file and attach it to the post. Content changes withdraw a pending approval. */
export async function addMedia(
  postId: string,
  input: { name: string; type: string; bytes: Uint8Array; source?: Media["source"]; textHash?: string },
) {
  const kind = MEDIA_TYPES[input.type];
  if (!kind) throw new WorkflowError(400, "Use PNG, JPG, WebP, MP4 or MOV.");
  if (input.bytes.byteLength > MAX_MEDIA_BYTES) throw new WorkflowError(400, "Files are limited to 200 MB.");
  const current = readStore().posts.find((p) => p.id === postId);
  if (!current) throw new WorkflowError(404, `Post ${postId} not found.`);
  if (current.status === "scheduled" || current.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");

  const file = `${Date.now().toString(36)}-${safeName(input.name)}`;
  mkdirSync(resolve(mediaRoot(), postId), { recursive: true });
  writeFileSync(mediaPath(postId, file), input.bytes);

  return updateStore((data) => {
    const post = data.posts.find((p) => p.id === postId)!;
    const entry: Media = { file, name: input.name, type: input.type, kind, size: input.bytes.byteLength, source: input.source ?? "upload" };
    if (input.textHash) entry.textHash = input.textHash;
    post.media = [...(post.media ?? []), entry];
    if (post.status === "awaiting") {
      post.thread.push({ from: "Brand Guard", text: "Media changed — approval request withdrawn.", at: new Date().toISOString() });
      post.status = "draft";
      post.note = "Media changed — run Brand Guard to send it again";
    }
    post.updatedAt = new Date().toISOString();
    return post;
  });
}

export async function removeMedia(postId: string, file: string) {
  const path = mediaPath(postId, file);
  return updateStore((data) => {
    const post = data.posts.find((p) => p.id === postId);
    if (!post) throw new WorkflowError(404, `Post ${postId} not found.`);
    if (post.status === "scheduled" || post.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");
    post.media = (post.media ?? []).filter((m) => m.file !== file);
    if (existsSync(path)) rmSync(path);
    if (post.status === "awaiting") {
      post.status = "draft";
      post.note = "Media changed — run Brand Guard to send it again";
    }
    post.updatedAt = new Date().toISOString();
    return post;
  });
}
