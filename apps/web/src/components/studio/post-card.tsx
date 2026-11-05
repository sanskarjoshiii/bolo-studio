"use client";

import { MoreHorizontal, PenLine } from "lucide-react";
import type { Client, Post } from "@bolo/core";
import { formatTime, istParts } from "@bolo/core/shared";
import { ClientMark } from "./controls";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";
import { platformIcon } from "@/components/ui/platform-icons";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/cn";

export function PostCard({ post, client, selected, onClick }: { post: Post; client: Client; selected: boolean; onClick: () => void }) {
  const s = STATUS_META[post.status];
  const main = client.channels.find((c) => c.platform === post.platforms[0]) ?? client.channels[0];
  const cover = post.media?.find((m) => m.kind === "image");

  return (
    <button
      onClick={onClick}
      className={cn(
        "group block w-full rounded-[14px] bg-[#4c7a63]/25 p-1.5 text-left ring-1 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-[#4c7a63]/35",
        selected ? "ring-lime/70" : "ring-white/[0.08]",
      )}
    >
      <div className="relative">
        {/* Creative keeps its real 4:5 / 9:16 ratio and is cropped like a photo thumbnail */}
        <div className="h-[80px] overflow-hidden rounded-[10px]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- auth-gated file served by /api/media
            <img src={`/api/media/${post.id}/${encodeURIComponent(cover.file)}`} alt="" className="size-full object-cover" />
          ) : (
          <MiniCreative
            variant={toVariant(post.creative)} content={contentFromPost(post, client.short)}
            className={cn(
              "w-full",
              post.format === "Reel" ? "aspect-[9/16] -translate-y-[38%]" : "aspect-[4/5]",
              post.status === "draft" && "scale-110 opacity-40 blur-[3px] saturate-50",
            )}
          />
          )}
        </div>
        <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md bg-black/35 text-white opacity-80 backdrop-blur group-hover:opacity-100">
          <MoreHorizontal className="size-3.5" />
        </span>
        {post.status === "draft" && !cover && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/85 backdrop-blur">
              <PenLine className="size-3" /> Draft
            </span>
          </span>
        )}
        <div className="absolute -bottom-3 left-1.5">
          <ClientMark client={client} className="size-7 rounded-lg text-[12px] ring-2 ring-[#203a2e]" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 px-1">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">{main?.handle}</p>
        <div className="flex gap-1 text-white/70">
          {post.platforms.map((pl) => {
            const I = platformIcon[pl];
            return <I key={pl} className="size-3" />;
          })}
        </div>
      </div>
      <p className="mt-1 truncate px-1 text-[11.5px] text-white/75">{post.title}</p>

      <div className="mt-2 flex items-center justify-between gap-1 px-1 pb-0.5">
        <span className="truncate rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] text-white/70">{post.tag}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-1 text-[10px]", s.text)}>
          <span className={cn("size-1.5 rounded-full", s.dot)} />
          {s.short}
        </span>
      </div>
    </button>
  );
}

/** One-line version for the month grid. */
export function PostChip({ post, selected, onClick }: { post: Post; selected: boolean; onClick: () => void }) {
  const s = STATUS_META[post.status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-white/[0.08]",
        selected ? "bg-white/[0.1] text-white" : "text-white/80",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
      <span className="shrink-0 text-fog tabular-nums">{formatTime(istParts(post.scheduledAt).minutes).replace(" ", "")}</span>
      <span className="truncate">{post.title}</span>
    </button>
  );
}
