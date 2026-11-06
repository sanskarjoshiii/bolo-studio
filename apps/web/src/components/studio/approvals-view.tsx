"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { AlertCircle, Check, Clock } from "lucide-react";
import type { Client, Post, PostStatus } from "@bolo/core";
import { formatSlot, PLATFORM_SHORT } from "@bolo/core/shared";
import { PostDrawer } from "./post-drawer";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/cn";

const GROUPS: { status: PostStatus; title: string; empty: string }[] = [
  { status: "awaiting", title: "Waiting for approval", empty: "Nothing is waiting for approval." },
  { status: "brand-check", title: "Needs a fix (Brand Guard)", empty: "Nothing is blocked." },
  { status: "draft", title: "In production", empty: "Nothing in production." },
];

export function ApprovalsView({ client, posts, selectedId }: { client: Client; posts: Post[]; selectedId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const select = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("post", id);
    else next.delete("post");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const selected = posts.find((p) => p.id === selectedId) ?? null;

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Approvals</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Everything generated but not approved yet. Approved posts move to Drafts until they go out ·{" "}
          {client.approvers.some((a) => a.owner)
            ? "no approvers set — the owner approves"
            : `approvers: ${client.approvers.map((a) => a.name).join(", ")}`}
        </p>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        {GROUPS.map((g) => {
          const items = posts.filter((p) => p.status === g.status);
          return (
            <section key={g.status}>
              <h2 className="flex items-center gap-2 text-[12px] font-medium tracking-[0.06em] text-fog uppercase">
                <span className={cn("size-1.5 rounded-full", STATUS_META[g.status].dot)} />
                {g.title}
                <span className="text-white/40">{items.length}</span>
              </h2>
              {items.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-[12px] text-fog">{g.empty}</p>
              ) : (
                <ul className="mt-3 grid gap-2 xl:grid-cols-2">
                  {items.map((p) => (
                    <li key={p.id}>
                      <Row post={p} client={client} selected={p.id === selectedId} onClick={() => select(p.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <AnimatePresence>{selected && <PostDrawer key={selected.id} post={selected} client={client} onClose={() => select(null)} />}</AnimatePresence>
    </main>
  );
}

function Row({ post, client, selected, onClick }: { post: Post; client: Client; selected: boolean; onClick: () => void }) {
  const failing = post.checks.filter((c) => !c.ok);
  const fixed = post.checks.filter((c) => c.fixed).length;
  const waitingSince = [...post.thread].reverse().find((m) => m.from === "Brand Guard")?.at;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl bg-white/[0.035] p-2.5 text-left ring-1 transition-colors hover:bg-white/[0.06]",
        selected ? "ring-lime/60" : "ring-white/[0.06]",
      )}
    >
      <div className="h-[64px] w-[52px] shrink-0 overflow-hidden rounded-lg">
        <MiniCreative variant={toVariant(post.creative)} content={contentFromPost(post, client.short)} className={cn("w-full", post.format === "Reel" ? "aspect-[9/16] -translate-y-1/4" : "aspect-[4/5]")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">{post.title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-fog">
          {post.format} · {post.platforms.map((x) => PLATFORM_SHORT[x]).join(" + ")} · {formatSlot(post.scheduledAt)}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px]">
          {post.status === "brand-check" && (
            <>
              <AlertCircle className="size-3 shrink-0 text-amber-300" />
              <span className="truncate text-amber-200/90">{failing.map((f) => f.label).join(" · ")}</span>
            </>
          )}
          {post.status === "awaiting" && (
            <>
              <Check className="size-3 shrink-0 text-emerald-300" />
              <span className="text-white/70">
                {post.checks.length} checks passed{fixed ? ` · ${fixed} auto-fixed` : ""}
              </span>
              {waitingSince && (
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-fog">
                  <Clock className="size-3" /> sent {formatSlot(waitingSince)}
                </span>
              )}
            </>
          )}
          {post.status === "draft" && <span className="truncate text-white/60">{post.job ? `${post.job.step} ${post.job.progress ?? 0}%` : (post.note ?? "Being produced")}</span>}
        </p>
      </div>
    </button>
  );
}
