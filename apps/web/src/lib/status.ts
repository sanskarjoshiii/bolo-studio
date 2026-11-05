import type { PostStatus } from "@bolo/core";

export const STATUS_ORDER: PostStatus[] = ["awaiting", "brand-check", "draft", "scheduled", "live"];

export const STATUS_META: Record<PostStatus, { label: string; short: string; dot: string; text: string }> = {
  draft: { label: "In production", short: "Producing", dot: "bg-white/40", text: "text-white/60" },
  "brand-check": { label: "Brand check", short: "Checking", dot: "bg-sky-300", text: "text-sky-200" },
  awaiting: { label: "Awaiting approval", short: "Approval", dot: "bg-amber-300", text: "text-amber-200" },
  scheduled: { label: "Scheduled", short: "Scheduled", dot: "bg-lime", text: "text-lime" },
  live: { label: "Live", short: "Live", dot: "bg-emerald-400", text: "text-emerald-300" },
};
