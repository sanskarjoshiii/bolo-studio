"use client";

import { useState } from "react";
import type { Notification } from "@bolo/core";
import { api } from "./hooks";
import { useLive } from "./live";
import { NotificationRow } from "./notifications";
import { cn } from "@/lib/cn";

export function NotificationsPage({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { refresh } = useLive();
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unread = items.filter((n) => !n.read).length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Notifications</h1>
          <p className="mt-0.5 text-[13px] text-fog">Invites, approvals, finished generations and posts that went live.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-[12.5px]", filter === f ? "bg-white/[0.1] text-white" : "text-fog hover:text-white")}>
              {f === "all" ? "All" : `Unread · ${unread}`}
            </button>
          ))}
          {unread > 0 && (
            <button
              onClick={async () => {
                await api("/api/notifications/read", "POST", {});
                setItems((cur) => cur.map((n) => ({ ...n, read: true })));
                refresh();
              }}
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-lime hover:bg-white/[0.1]"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl bg-white/[0.035] ring-1 ring-white/[0.07]">
        {shown.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-fog">{filter === "unread" ? "You're all caught up." : "Nothing yet."}</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {shown.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
