"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { CalendarClock, Clapperboard, FileClock, GalleryHorizontalEnd, Image as ImageIcon } from "lucide-react";
import type { Client, Post } from "@bolo/core";
import { formatSlot, PLATFORM_SHORT, sizeFor } from "@bolo/core/shared";
import { useNow } from "./hooks";
import { MediaView, PostDrawer } from "./post-drawer";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";
import { ScrollMain } from "@/components/ui/smooth-scroll";
import { cn } from "@/lib/cn";

const ICON = { Post: ImageIcon, Carousel: GalleryHorizontalEnd, Story: ImageIcon, Reel: Clapperboard } as const;

function until(iso: string, now: Date | null) {
  if (!now) return "";
  const m = Math.round((Date.parse(iso) - now.getTime()) / 60_000);
  if (m <= 0) return "going out now";
  if (m < 60) return `in ${m} min`;
  if (m < 48 * 60) return `in ${Math.round(m / 60)} h`;
  return `in ${Math.round(m / 1440)} days`;
}

/** Approved designs and reels that haven't been posted yet — the next stop is the calendar. */
export function DraftsView({ client, posts, selectedId }: { client: Client; posts: Post[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const select = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("post", id);
    else next.delete("post");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const selected = posts.find((p) => p.id === selectedId) ?? null;
  const ordered = [...posts].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="relative flex min-w-0 flex-1">
      <ScrollMain>
        <div className="border-b border-white/[0.05] px-5 py-4">
          <h1 className="text-[17px] font-medium tracking-tight">Drafts</h1>
          <p className="mt-0.5 text-[12px] text-fog">Approved and ready — each goes out at its time, then moves to the calendar.</p>
        </div>
        {ordered.length === 0 ? (
          <div className="grid place-items-center px-6 py-20 text-center">
            <FileClock className="size-8 text-fog" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-medium">Nothing approved is waiting</p>
            <p className="mt-1 max-w-[340px] text-[12.5px] text-fog">When a post is approved in Approvals (or on Telegram), it lands here until it&apos;s published.</p>
          </div>
        ) : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {ordered.map((p) => {
              const media = (p.media ?? []).filter((m) => m.source === "template");
              const shown = media.find((m) => m.kind === "video") ?? media[0] ?? (p.media ?? [])[0];
              const size = sizeFor(p);
              const Icon = ICON[p.format];
              return (
                <li key={p.id}>
                  <button
                    onClick={() => select(p.id)}
                    className={cn("group block w-full overflow-hidden rounded-xl bg-white/[0.035] text-left ring-1 transition hover:bg-white/[0.06]", p.id === selectedId ? "ring-lime/60" : "ring-white/[0.07]")}
                  >
                    <div className="relative grid place-items-center overflow-hidden bg-black/30" style={{ aspectRatio: `${size.w} / ${size.h}`, maxHeight: 420 }}>
                      {shown ? (
                        <MediaView post={p} media={shown} className="size-full" />
                      ) : (
                        <MiniCreative variant={toVariant(p.creative)} content={contentFromPost(p, client.short)} className="aspect-[4/5] w-full" />
                      )}
                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] text-white backdrop-blur">
                        <Icon className="size-3" /> {p.format}
                        {media.length > 1 ? ` · ${media.length}` : ""}
                      </span>
                      <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10.5px] text-white/85 backdrop-blur">
                        {size.w}×{size.h}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-[13px] font-medium">{p.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-fog">
                        <CalendarClock className="size-3.5 text-lime" />
                        {formatSlot(p.scheduledAt)} · <span className="text-white/75">{until(p.scheduledAt, now)}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-fog">
                        {p.platforms.map((x) => PLATFORM_SHORT[x]).join(" + ")}
                        {p.dryRun ? " · not connected — mark live by hand" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollMain>
      <AnimatePresence>{selected && <PostDrawer key={selected.id} post={selected} client={client} onClose={() => select(null)} />}</AnimatePresence>
    </div>
  );
}
