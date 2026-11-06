"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, Check, CheckCheck, Loader2, Mail, Send, Sparkles, UserPlus, X } from "lucide-react";
import type { Notification } from "@bolo/core";
import { api } from "./hooks";
import { useLive } from "./live";
import { cn } from "@/lib/cn";

const ICON: Record<Notification["kind"], typeof Bell> = {
  invite: Mail,
  approval: CheckCheck,
  approved: Check,
  changes: AlertCircle,
  live: Send,
  "job-done": Sparkles,
  "job-failed": AlertCircle,
  connection: Bell,
  member: UserPlus,
  info: Bell,
};

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Bell in the studio header: unread count, the latest notifications, invites answered in place. */
export function NotificationsBell() {
  const { unread, refresh } = useLive();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { notifications: Notification[] }) => alive && setItems(d.notifications))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const markAll = async () => {
    await api("/api/notifications/read", "POST", {});
    setItems((cur) => cur?.map((n) => ({ ...n, read: true })) ?? null);
    refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white"
      >
        <Bell className="size-[17px]" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-lime px-1 text-[9.5px] font-semibold text-night">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setOpen(false)} />
          <div className="absolute top-10 right-0 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl bg-[#0f2219] shadow-xl ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
              <p className="text-[13px] font-medium">Notifications</p>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAll} className="text-[11.5px] text-lime hover:underline">
                    Mark all read
                  </button>
                )}
                <Link href="/notifications" onClick={() => setOpen(false)} className="text-[11.5px] text-fog hover:text-white">
                  See all
                </Link>
              </div>
            </div>
            <div data-lenis-prevent className="thin-scrollbar max-h-[420px] overflow-y-auto">
              {items === null ? (
                <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-fog">
                  <Loader2 className="size-3.5 animate-spin" /> Loading
                </p>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-fog">Nothing yet — approvals, invites and finished posts show up here.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {items.slice(0, 20).map((n) => (
                    <li key={n.id}>
                      <NotificationRow n={n} onDone={() => setOpen(false)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One notification; invites get Join / Decline right here. */
export function NotificationRow({ n, onDone }: { n: Notification; onDone?: () => void }) {
  const router = useRouter();
  const { refresh } = useLive();
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null);
  const Icon = ICON[n.kind] ?? Bell;

  const open = async () => {
    if (!n.read) void api("/api/notifications/read", "POST", { ids: [n.id] }).then(refresh);
    if (n.href) {
      onDone?.();
      router.push(n.href);
    }
  };

  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      await api(`/api/invites/${n.inviteId}`, "POST", { accept });
      setAnswered(accept ? "Joined" : "Declined");
      refresh();
      if (accept && n.companyId) {
        onDone?.();
        window.location.assign(`/studio/${n.companyId}`);
      }
    } catch (e) {
      setAnswered((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex gap-3 px-3.5 py-3 text-left", n.href && "cursor-pointer hover:bg-white/[0.04]", !n.read && "bg-lime/[0.04]")} onClick={n.kind === "invite" ? undefined : open}>
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", n.kind === "job-failed" || n.kind === "changes" ? "bg-amber-300/10 text-amber-200" : "bg-white/[0.06] text-lime")}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[12.5px] leading-snug", n.read ? "text-white/75" : "font-medium text-white")}>{n.title}</p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-fog">{n.body}</p>}
        {n.kind === "invite" && n.inviteId && !n.read && !answered && (
          <div className="mt-2 flex gap-2">
            <button onClick={() => respond(true)} disabled={busy} className="flex items-center gap-1 rounded-md bg-lime px-2.5 py-1 text-[11.5px] font-medium text-night disabled:opacity-60">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Join
            </button>
            <button onClick={() => respond(false)} disabled={busy} className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1 text-[11.5px] text-white/85 hover:bg-white/[0.12]">
              <X className="size-3" /> Decline
            </button>
          </div>
        )}
        {answered && <p className="mt-1 text-[11.5px] text-lime">{answered}</p>}
        <p className="mt-1 text-[10.5px] text-fog/80">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lime" />}
    </div>
  );
}
