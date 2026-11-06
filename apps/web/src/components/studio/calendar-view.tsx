"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Client, Post, PostStatus } from "@bolo/core";
import { addDays, DOW, formatWeekRange, istParts, MONTHS, weekDays, weekStart } from "@bolo/core/shared";
import { Segmented } from "./controls";
import { useNow } from "./hooks";
import { PostCard, PostChip } from "./post-card";
import { PostDrawer } from "./post-drawer";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn } from "@/lib/cn";

export type CalendarMode = "day" | "week" | "month";
const MODES = ["day", "week", "month"] as const;

const START = 8;
const END = 23;
const HOUR_H = 50;
const COL_MIN = 138;
const OPEN_AT = 10; // keeps the 7:30 PM protocol.md slot in view on a laptop screen
const CARD_MIN = 190; // minutes a card occupies on the grid, used to put clashing posts side by side

const topFor = (min: number) => ((min - START * 60) / 60) * HOUR_H;

export function CalendarView({
  client,
  posts,
  mode,
  anchor,
  today,
  filter,
  selectedId,
  pending,
}: {
  client: Client;
  /** Published posts only. */
  posts: Post[];
  /** How many are approved (Drafts) and waiting (Approvals) — linked from the header. */
  pending: { drafts: number; approvals: number };
  mode: CalendarMode;
  /** Day shown (day mode), Monday of the week (week mode) or 1st of the month (month mode). */
  anchor: string;
  today: string;
  filter: PostStatus | "all";
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const selected = posts.find((p) => p.id === selectedId) ?? null;
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, posts.filter((p) => p.status === s).length])) as Record<PostStatus, number>;

  const step = (dir: 1 | -1) => {
    if (mode === "day") go({ date: addDays(anchor, dir) });
    else if (mode === "week") go({ week: addDays(anchor, dir * 7) });
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
      go({ month: d });
    }
  };

  const a = istParts(`${anchor}T12:00:00+05:30`);
  const title =
    mode === "day" ? `${DOW[a.dow]} ${a.day} ${MONTHS[a.month]}` : mode === "week" ? formatWeekRange(anchor) : `${MONTHS[a.month]} ${a.year}`;

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-white/[0.05] px-4 py-3">
        <p className="min-w-[150px] text-[15px] font-medium tracking-tight">
          {title}
          {mode !== "month" && <span className="ml-2 text-[12px] font-normal text-fog">{a.year}</span>}
        </p>
        <div className="flex items-center gap-1">
          <NavBtn label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </NavBtn>
          <button
            onClick={() => go({ date: null, week: null, month: null })}
            className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/85 hover:bg-white/[0.09]"
          >
            Today
          </button>
          <NavBtn label="Next" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </NavBtn>
        </div>

        <div className="ml-auto">
          <Segmented
            options={MODES}
            value={mode}
            labels={{ day: "Day", week: "Week", month: "Month" }}
            onChange={(v) => go({ view: v === "week" ? null : v, date: null, week: null, month: null })}
            className="w-[200px]"
          />
        </div>

        <p className="order-last flex w-full flex-wrap items-center gap-x-1.5 text-[12px] text-fog">
          <span className={cn("size-1.5 rounded-full", STATUS_META.live.dot)} />
          {counts.live} published {counts.live === 1 ? "post" : "posts"} — the calendar shows only what&apos;s live on social media.
          {pending.drafts > 0 && (
            <Link href={`/studio/${client.id}/drafts`} className="text-lime hover:underline">
              {pending.drafts} approved in Drafts
            </Link>
          )}
          {pending.drafts > 0 && pending.approvals > 0 && <span>·</span>}
          {pending.approvals > 0 && (
            <Link href={`/studio/${client.id}/approvals`} className="text-lime hover:underline">
              {pending.approvals} in Approvals
            </Link>
          )}
        </p>
      </div>

      {mode === "month" ? (
        <MonthGrid posts={posts} monthStart={anchor} today={today} filter={filter} selectedId={selectedId} onSelect={(id) => go({ post: id })} />
      ) : (
        <TimeGrid
          client={client}
          posts={posts}
          days={mode === "day" ? [{ key: anchor, dow: DOW[a.dow], date: a.day }] : weekDays(anchor)}
          today={today}
          filter={filter}
          selectedId={selectedId}
          onSelect={(id) => go({ post: id })}
        />
      )}

      <AnimatePresence>
        {selected && <PostDrawer key={selected.id} post={selected} client={client} onClose={() => go({ post: null })} />}
      </AnimatePresence>
    </main>
  );
}

function NavBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid size-7 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white">
      {children}
    </button>
  );
}

type DayItem =
  | { kind: "card"; post: Post; start: number; lane: number; lanes: number }
  | { kind: "stack"; start: number; posts: Post[] };

/**
 * Groups posts whose cards would overlap. Small groups sit side by side; bigger ones collapse
 * into one list so cards never get squeezed unreadably thin.
 */
function layoutDay(dayPosts: Post[], maxLanes: number): DayItem[] {
  const sorted = [...dayPosts]
    .map((post) => ({ post, start: istParts(post.scheduledAt).minutes }))
    .sort((a, b) => a.start - b.start);
  const clusters: { start: number; end: number; items: typeof sorted }[] = [];
  for (const it of sorted) {
    const last = clusters.at(-1);
    if (last && it.start < last.end) {
      last.items.push(it);
      last.end = Math.max(last.end, it.start + CARD_MIN);
    } else {
      clusters.push({ start: it.start, end: it.start + CARD_MIN, items: [it] });
    }
  }
  return clusters.flatMap((c): DayItem[] =>
    c.items.length > maxLanes
      ? [{ kind: "stack", start: c.start, posts: c.items.map((i) => i.post) }]
      : c.items.map((i, lane) => ({ kind: "card", post: i.post, start: i.start, lane, lanes: c.items.length })),
  );
}

function TimeGrid({
  client,
  posts,
  days,
  today,
  filter,
  selectedId,
  onSelect,
}: {
  client: Client;
  posts: Post[];
  days: { key: string; dow: string; date: number }[];
  today: string;
  filter: PostStatus | "all";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hours = Array.from({ length: END - START + 1 }, (_, i) => START + i);
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow();
  const nowParts = now ? istParts(now) : null;

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = topFor(OPEN_AT * 60);
  }, [client.id]);

  const byDay = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) {
      const k = istParts(p.scheduledAt).dateKey;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [posts]);

  const single = days.length === 1;
  const cols = `64px repeat(${days.length}, minmax(${single ? 260 : COL_MIN}px, 1fr))`;

  return (
    <div ref={scroller} className="thin-scrollbar relative min-h-0 flex-1 overflow-auto">
      <div className="relative" style={{ minWidth: 64 + (single ? 260 : COL_MIN) * days.length }}>
        <div className="sticky top-0 z-20 grid border-b border-white/[0.05] bg-[#0b1b14]" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const isToday = d.key === today;
            return (
              <div key={d.key} className="py-2.5 text-center">
                <p className={cn("text-[20px] leading-none font-medium tracking-tight", isToday ? "text-lime" : "text-white")}>{d.date}</p>
                <p className={cn("mt-1 text-[11px]", isToday ? "text-lime/80" : "text-fog")}>{d.dow}</p>
              </div>
            );
          })}
        </div>

        <div className="relative grid" style={{ gridTemplateColumns: cols, height: (END - START) * HOUR_H + 40 }}>
          <div className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-3 -translate-y-1/2 text-[11px] text-fog/80 tabular-nums" style={{ top: topFor(h * 60) + 16 }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {days.map((d, i) => {
            const items = layoutDay(byDay.get(d.key) ?? [], single ? 3 : 2);
            const isToday = d.key === today;
            return (
              <div key={d.key} className={cn("relative border-l border-white/[0.05]", isToday && "bg-white/[0.02]")}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-dashed border-white/[0.05]" style={{ top: topFor(h * 60) + 16 }} />
                ))}

                {nowParts && nowParts.dateKey === d.key && nowParts.minutes >= START * 60 && (
                  <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: topFor(nowParts.minutes) + 16 }}>
                    <span className="-ml-1 size-2 rounded-full bg-lime" />
                    <span className="h-px flex-1 bg-lime/70" />
                  </div>
                )}

                {items.map((item, k) =>
                  item.kind === "card" ? (
                    <motion.div
                      key={item.post.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: filter === "all" || filter === item.post.status ? 1 : 0.18, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.04 * (i + k) }}
                      className="absolute px-1"
                      style={{
                        top: topFor(Math.max(item.start, START * 60)) + 18,
                        left: `${(item.lane / item.lanes) * 100}%`,
                        width: `${(single ? Math.min(1 / item.lanes, 0.5) : 1 / item.lanes) * 100}%`,
                        minWidth: single ? 220 : undefined,
                      }}
                    >
                      <PostCard post={item.post} client={client} selected={item.post.id === selectedId} onClick={() => onSelect(item.post.id)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`stack-${item.start}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.04 * (i + k) }}
                      className="absolute inset-x-1 rounded-[14px] bg-[#4c7a63]/25 p-1.5 ring-1 ring-white/[0.08] backdrop-blur-md"
                      style={{ top: topFor(Math.max(item.start, START * 60)) + 18, maxWidth: single ? 420 : undefined }}
                    >
                      <p className="px-1.5 pt-0.5 pb-1 text-[10.5px] text-fog">{item.posts.length} posts at this time</p>
                      <div className="space-y-0.5">
                        {item.posts.map((p) => (
                          <div key={p.id} className={cn(filter !== "all" && filter !== p.status && "opacity-30")}>
                            <PostChip post={p} selected={p.id === selectedId} onClick={() => onSelect(p.id)} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  posts,
  monthStart,
  today,
  filter,
  selectedId,
  onSelect,
}: {
  posts: Post[];
  monthStart: string;
  today: string;
  filter: PostStatus | "all";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const first = weekStart(`${monthStart}T12:00:00+05:30`);
  const month = monthStart.slice(0, 7);
  const weeks = Array.from({ length: 6 }, (_, w) => weekDays(addDays(first, w * 7))).filter(
    (wk, i) => i < 5 || wk.some((d) => d.key.startsWith(month)),
  );
  const visible = posts.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-auto p-3">
      <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-xl bg-white/[0.05]">
        {DOW.map((d) => (
          <div key={d} className="bg-[#0b1b14] px-2 py-2 text-[11px] text-fog">
            {d}
          </div>
        ))}
        {weeks.flat().map((d) => {
          const dayPosts = visible.filter((p) => istParts(p.scheduledAt).dateKey === d.key);
          const inMonth = d.key.startsWith(month);
          return (
            <div key={d.key} className={cn("min-h-[108px] bg-night-2 p-1.5", !inMonth && "opacity-40")}>
              <p className={cn("mb-1 px-1 text-[12px] tabular-nums", d.key === today ? "font-semibold text-lime" : "text-white/70")}>{d.date}</p>
              <div className="space-y-0.5">
                {dayPosts.map((p) => (
                  <PostChip key={p.id} post={p} selected={p.id === selectedId} onClick={() => onSelect(p.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
