"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import { api } from "./hooks";
import { cn } from "@/lib/cn";

// One small request (/api/jobs) keeps the studio live on every page: what's being generated
// (the progress dock), the unread notification count, and a refresh of the page when a job
// finishes. It polls fast while something runs and slowly otherwise, and pauses in hidden tabs.

export type LiveJob = { id: string; clientId: string; title: string; format: string; step: string; progress: number; at: string; startedAt: string; alive: boolean };

type Live = { jobs: LiveJob[]; unread: number; refresh: () => void; jobFor: (postId: string) => LiveJob | undefined };

const LiveContext = createContext<Live>({ jobs: [], unread: 0, refresh: () => undefined, jobFor: () => undefined });
export const useLive = () => useContext(LiveContext);

export function LiveProvider({ initialUnread, children }: { initialUnread: number; children: React.ReactNode }) {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef<Map<string, string>>(new Map());

  const poll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let next = 15_000;
    try {
      if (document.visibilityState === "visible") {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { jobs: LiveJob[]; unread: number };
          setJobs(data.jobs);
          setUnread(data.unread);
          // A job finished (or its step changed) → re-render server data on this page
          const now = new Map(data.jobs.map((j) => [j.id, j.step]));
          const finished = [...previous.current.keys()].some((id) => !now.has(id));
          previous.current = now;
          if (finished) router.refresh();
          if (data.jobs.length) next = 2_000;
        }
      }
    } catch {
      next = 20_000; // offline / server restarting
    }
    timer.current = setTimeout(poll, next);
  }, [router]);

  useEffect(() => {
    void poll();
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const value = useMemo<Live>(() => ({ jobs, unread, refresh: () => void poll(), jobFor: (id) => jobs.find((j) => j.id === id) }), [jobs, unread, poll]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/**
 * Shown progress: the server reports milestones (writing 3→40, design 42→90, sending 92→99); in
 * between, the bar keeps creeping toward the next milestone so it never looks stuck.
 */
export function useSmoothProgress(job: Pick<LiveJob, "progress" | "at"> | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!job) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [job]);
  if (!job) return 0;
  const p = job.progress;
  const cap = p < 40 ? 39 : p < 92 ? Math.min(p + 6, 91) : 99;
  const elapsed = Math.max(0, (now - Date.parse(job.at)) / 1000);
  return Math.min(cap, p + elapsed * (p < 40 ? 0.9 : 0.4));
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/10", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-lime transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, value)}%` }} />
    </div>
  );
}

/** Floating progress for everything being generated — stays put while you move between sections. */
export function JobsDock() {
  const { jobs, refresh } = useLive();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  // The editor for a post already shows its own progress — don't double it there
  const visible = jobs.filter((j) => !pathname.endsWith(`/post/${j.id}`));
  if (!visible.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-[60] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col items-end gap-2 md:bottom-4">
      <AnimatePresence initial={false}>
        {open ? (
          visible.map((j) => <DockCard key={j.id} job={j} onCancelled={refresh} />)
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#0f2219] px-3.5 py-2 text-[12.5px] text-white shadow-xl ring-1 ring-white/10"
          >
            <Loader2 className="size-3.5 animate-spin text-lime" /> {visible.length} generating
          </motion.button>
        )}
      </AnimatePresence>
      {open && (
        <button onClick={() => setOpen(false)} className="pointer-events-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-fog hover:text-white">
          <ChevronDown className="size-3" /> Minimise
        </button>
      )}
    </div>
  );
}

function DockCard({ job, onCancelled }: { job: LiveJob; onCancelled: () => void }) {
  const value = useSmoothProgress(job.alive ? job : undefined);
  const [cancelling, setCancelling] = useState(false);
  const cancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCancelling(true);
    await api(`/api/posts/${job.id}/cancel`, "POST").catch(() => undefined);
    onCancelled();
  };
  return (
    <motion.div layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="pointer-events-auto w-full">
      <Link
        href={`/studio/${job.clientId}/post/${job.id}`}
        className="block rounded-xl bg-[#0f2219]/95 p-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 backdrop-blur-xl transition hover:ring-lime/40"
      >
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-lime" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-white">{job.title}</p>
            <p className="truncate text-[11.5px] text-fog">{job.alive ? job.step : "Stopped — the server restarted"}</p>
          </div>
          <span className="shrink-0 text-[12px] font-medium text-lime tabular-nums">{job.alive ? `${Math.round(value)}%` : ""}</span>
          <button onClick={cancel} disabled={cancelling} aria-label={`Cancel ${job.title}`} title="Cancel" className="-mt-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-md text-fog hover:bg-white/10 hover:text-red-300">
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
        </div>
        {job.alive && <ProgressBar value={value} className="mt-2.5" />}
        <p className="mt-1.5 text-[10.5px] text-fog/80">{job.format} · click to open in the editor</p>
      </Link>
    </motion.div>
  );
}

/**
 * Loader while moving between sections: a thin bar at the top starts the moment an internal link
 * is clicked and finishes when the new page has rendered.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const started = useRef(0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname) return; // same page (tab/filter change) — instant
      started.current = Date.now();
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // A click that didn't navigate (prevented later, or redirected back here) must not leave it stuck
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("idle"), 10_000);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== "loading") return;
    setState("done");
    const t = setTimeout(() => setState("idle"), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish on navigation only
  }, [pathname]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2.5px]">
      <div
        className={cn(
          "h-full bg-lime shadow-[0_0_10px_rgba(217,242,75,0.7)]",
          state === "idle" && "w-0 opacity-0 transition-none",
          state === "loading" && "w-[82%] opacity-100 transition-[width] duration-[2400ms] ease-out",
          state === "done" && "w-full opacity-0 transition-[width,opacity] duration-300",
        )}
      />
    </div>
  );
}
