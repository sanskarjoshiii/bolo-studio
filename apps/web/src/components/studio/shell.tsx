"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CalendarDays, CheckCheck, FileClock, LogOut, Palette, PlugZap, Plus, Server, SquarePen, UserRound, Users } from "lucide-react";
import type { Client } from "@bolo/core";
import { api } from "./hooks";
import { ClientMark } from "./controls";
import { useMe } from "./me";
import { JobsDock, NavProgress } from "./live";
import { NotificationsBell } from "./notifications";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

export type ClientTab = Pick<Client, "id" | "name" | "mark" | "rooms"> & { awaiting: number; checking: number; scheduled: number };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function StudioShell({
  clients,
  clientId,
  isAdmin,
  manager,
  children,
}: {
  clients: ClientTab[];
  clientId: string;
  /** Bolo Studio staff: also sees the agents and the platform services. */
  isAdmin: boolean;
  /** Owner/admin of this company. */
  manager: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = clients.find((c) => c.id === clientId)!;
  const base = `/studio/${clientId}`;

  const rail = [
    { href: base, icon: CalendarDays, label: "Calendar", hint: "Published posts", exact: true },
    { href: `${base}/create`, icon: SquarePen, label: "Create" },
    { href: `${base}/approvals`, icon: CheckCheck, label: "Approvals", hint: "Waiting for approval and in production", badge: active.awaiting + active.checking },
    { href: `${base}/drafts`, icon: FileClock, label: "Drafts", hint: "Approved, waiting to be posted", count: active.scheduled },
    { href: `${base}/brand-kit`, icon: Palette, label: "Brand Kit" },
    { href: `${base}/connections`, icon: PlugZap, label: "Connections" },
    { href: `${base}/team`, icon: Users, label: "Team" },
    ...(isAdmin
      ? [
          { href: `${base}/agents`, icon: Bot, label: "Agents", hint: "Admin" },
          { href: `${base}/platform`, icon: Server, label: "Platform", hint: "Admin — Switch, Postiz, Wispr Flow" },
        ]
      : []),
  ];
  // Keep the current section when switching company tabs
  const section = pathname.slice(base.length);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-night text-white"
      style={{
        backgroundImage:
          "radial-gradient(1100px 600px at 15% -10%, rgba(38,92,68,0.55), transparent 60%), radial-gradient(900px 700px at 105% 110%, rgba(30,84,60,0.45), transparent 60%)",
      }}
    >
      <NavProgress />
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:px-4">
        <Link href="/" aria-label="Bolo Studio home" className="grid size-9 place-items-center text-lime">
          <LogoMark className="size-6" />
        </Link>

        <nav className="no-scrollbar ml-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto md:ml-4" aria-label="Companies">
          {clients.map((c) => {
            const on = c.id === clientId;
            return (
              <Link
                key={c.id}
                href={`/studio/${c.id}${section}`}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl py-1.5 pr-3 pl-2 text-[13px] transition-colors",
                  on ? "bg-white/[0.08] text-white ring-1 ring-white/[0.08]" : "bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                )}
              >
                <ClientMark client={c} className="size-5 text-[10px]" />
                {c.name}
                {c.awaiting > 0 && (
                  <span className="grid min-w-4 place-items-center rounded-full bg-amber-300/90 px-1 text-[10px] font-semibold text-night" title={`${c.awaiting} waiting for approval`}>
                    {c.awaiting}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/onboarding"
            title="Add a company"
            aria-label="Add a company"
            className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/[0.03] text-fog hover:bg-white/[0.06] hover:text-white"
          >
            <Plus className="size-4" />
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href={`${base}/create`} className="flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-[13px] font-medium text-night hover:brightness-95">
            <Plus className="size-3.5" /> <span className="hidden sm:inline">Create</span>
          </Link>
          <NotificationsBell />
          <div className="relative ml-0.5">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="grid size-8 place-items-center rounded-full bg-[#2c4a39] text-[11px] font-semibold ring-1 ring-white/15 hover:ring-white/30"
            >
              {initials(me.name)}
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-10 right-0 z-50 w-[250px] rounded-xl bg-[#0f2219] p-1.5 shadow-xl ring-1 ring-white/10">
                  <div className="px-3 py-2">
                    <p className="truncate text-[13px] font-medium">{me.name}</p>
                    <p className="truncate text-[11.5px] text-fog">
                      @{me.username} · {me.email}
                    </p>
                    <p className="mt-1 text-[11px] text-fog">
                      {isAdmin ? "Bolo Studio admin" : manager ? "Owner / admin of this company" : "Member"}
                      {me.telegram ? ` · ${me.telegram}` : ""}
                    </p>
                  </div>
                  <Link href={`${base}/team#account`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] hover:bg-white/[0.06]">
                    <UserRound className="size-3.5 text-fog" /> Your account
                  </Link>
                  <Link href="/onboarding" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] hover:bg-white/[0.06]">
                    <Plus className="size-3.5 text-fog" /> Add or join a company
                  </Link>
                  <button
                    onClick={async () => {
                      await api("/api/auth/logout", "POST");
                      window.location.assign("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] hover:bg-white/[0.06]"
                  >
                    <LogOut className="size-3.5 text-fog" /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <nav aria-label="Sections" className="hidden w-12 shrink-0 flex-col items-center gap-1 rounded-2xl bg-white/[0.035] py-3 ring-1 ring-white/[0.06] md:flex">
          {rail.map(({ href, icon: Icon, label, hint, exact, badge, count }) => {
            const on = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                title={hint ? `${label} — ${hint}` : label}
                aria-label={label}
                aria-current={on ? "page" : undefined}
                prefetch
                className={cn(
                  "group relative grid size-9 place-items-center rounded-xl transition-colors",
                  on ? "bg-white/[0.09] text-white" : "text-fog hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
                {!!badge && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-300" />}
                {!badge && !!count && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-lime" />}
                <span className="pointer-events-none absolute left-11 z-50 hidden rounded-md bg-[#0f2219] px-2 py-1 text-[11.5px] whitespace-nowrap text-white shadow-lg ring-1 ring-white/10 group-hover:block">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {children}
      </div>

      {/* mobile section bar */}
      <nav aria-label="Sections" className="no-scrollbar flex justify-around gap-1 overflow-x-auto border-t border-white/[0.06] px-2 py-2 md:hidden">
        {rail.map(({ href, icon: Icon, label, exact }) => {
          const on = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={label} href={href} aria-label={label} className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-white/[0.09] text-white" : "text-fog")}>
              <Icon className="size-[18px]" strokeWidth={1.75} />
            </Link>
          );
        })}
      </nav>

      <JobsDock />
    </div>
  );
}
