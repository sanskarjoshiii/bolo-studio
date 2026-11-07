"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Check, Loader2, Mail, X } from "lucide-react";
import type { Client, ConnectionStatus } from "@bolo/core";
import { api } from "./hooks";
import { ErrorNote } from "./controls";
import { TelegramCard } from "./connections-view";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

export type PendingInvite = { id: string; companyId: string; companyName: string; invitedByName: string; role: string; canApprove: boolean };

const field =
  "mt-1 w-full rounded-lg bg-white/[0.05] px-3 py-2.5 text-[14px] text-white ring-1 ring-white/[0.1] outline-none placeholder:text-white/30 focus:ring-lime/60";

/** First stop for a new account: create a company, or join one that invited you. */
export function OnboardingView({ name, invites, hasCompanies }: { name: string; invites: PendingInvite[]; hasCompanies: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [primary, setPrimary] = useState("#1F3A5F");
  const [accent, setAccent] = useState("#C9A227");
  const [company, setCompany] = useState("");
  // Step 2 (after the company exists): connect Telegram, or skip
  const [created, setCreated] = useState<Pick<Client, "id" | "name"> | null>(null);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy("create");
    setError(null);
    try {
      const c = await api<Client>("/api/companies", "POST", { ...f, primary, accent });
      setCreated({ id: c.id, name: c.name });
      setBusy(null);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const respond = async (invite: PendingInvite, accept: boolean) => {
    setBusy(invite.id);
    setError(null);
    try {
      await api(`/api/invites/${invite.id}`, "POST", { accept });
      window.location.assign(accept ? `/studio/${invite.companyId}` : "/onboarding");
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  if (created) return <TelegramStep company={created} />;

  return (
    <main className="min-h-dvh bg-night px-4 py-10 text-white" style={{ backgroundImage: "radial-gradient(900px 500px at 20% -10%, rgba(38,92,68,0.55), transparent 60%)" }}>
      <div className="mx-auto w-full max-w-[560px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[16px] font-semibold text-lime">
            <LogoMark className="size-6" /> <span className="text-white">Bolo Studio</span>
          </span>
          {hasCompanies ? (
            <Link href="/dashboard" className="flex items-center gap-1.5 text-[13px] text-fog hover:text-white">
              <ArrowLeft className="size-3.5" /> Back to the studio
            </Link>
          ) : (
            <SwitchAccount label="Back to login" />
          )}
        </div>
        <h1 className="mt-10 text-[26px] font-medium tracking-tight">Welcome, {name.split(" ")[0]}.</h1>
        <p className="mt-1 text-[12.5px] text-fog">
          Not you, or signed up with the wrong details? <SwitchAccount label="Use a different account" inline />
        </p>
        <p className="mt-1 text-[14px] text-fog">
          {hasCompanies ? "Add another company, or join one you were invited to." : "Set up your company — it takes a minute. You can change all of it later in Brand Kit."}
        </p>

        <div className="mt-4">
          <ErrorNote error={error} onClose={() => setError(null)} />
        </div>

        {invites.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-[13px] font-medium tracking-[0.06em] text-fog uppercase">
              <Mail className="size-3.5" /> Invites for you
            </h2>
            <ul className="mt-3 space-y-2">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{i.companyName}</p>
                    <p className="text-[12px] text-fog">
                      {i.invitedByName} invited you as {i.role}
                      {i.canApprove ? " · can approve posts" : ""}
                    </p>
                  </div>
                  <button onClick={() => respond(i, false)} disabled={busy !== null} className="grid size-9 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white" aria-label={`Decline ${i.companyName}`}>
                    <X className="size-4" />
                  </button>
                  <button onClick={() => respond(i, true)} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg bg-lime px-3 py-2 text-[13px] font-medium text-night disabled:opacity-60">
                    {busy === i.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Join
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form onSubmit={create} className="mt-8 space-y-4 rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/[0.08]">
          <h2 className="flex items-center gap-2 text-[15px] font-medium">
            <Building2 className="size-4 text-lime" /> Create a company
          </h2>
          <label className="block">
            <span className="text-[12px] text-white/75">Company name</span>
            <input name="name" required maxLength={60} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Pushpam Infra" className={field} />
          </label>
          <label className="block">
            <span className="text-[12px] text-white/75">What you do, and where</span>
            <input name="sector" maxLength={80} placeholder="Real estate · Pune" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Colour label="Main brand colour" value={primary} onChange={setPrimary} />
            <Colour label="Accent colour" value={accent} onChange={setAccent} />
          </div>
          <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: primary }}>
            <span className="grid size-10 place-items-center rounded-lg text-[16px] font-semibold" style={{ background: accent, color: primary }}>
              {(company.trim()[0] ?? "B").toUpperCase()}
            </span>
            <span className="text-[15px] font-medium text-white">{company.trim() || "Your company"}</span>
          </div>
          <button type="submit" disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2.5 text-[14px] font-medium text-night disabled:opacity-60">
            {busy === "create" && <Loader2 className="size-4 animate-spin" />} Create company
          </button>
          <p className="text-center text-[12px] text-fog">Next: connect Telegram for approvals — then Instagram and the rest, a click or two each.</p>
        </form>
      </div>
    </main>
  );
}

/** Step 2: where approvals go. Telegram now, or later from Connections. */
function TelegramStep({ company }: { company: Pick<Client, "id" | "name"> }) {
  const [s, setS] = useState<ConnectionStatus["telegram"] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/connect/telegram?company=${company.id}`).then((x) => x.json()).catch(() => null);
    if (r && typeof r.connected === "boolean") setS(r);
  }, [company.id]);
  useEffect(() => void load(), [load]);
  const next = `/studio/${company.id}/connections?welcome=1`;

  return (
    <main className="min-h-dvh bg-night px-4 py-10 text-white" style={{ backgroundImage: "radial-gradient(900px 500px at 20% -10%, rgba(38,92,68,0.55), transparent 60%)" }}>
      <div className="mx-auto w-full max-w-[560px]">
        <span className="flex items-center gap-2 text-[16px] font-semibold text-lime">
          <LogoMark className="size-6" /> <span className="text-white">Bolo Studio</span>
        </span>
        <ol className="mt-8 flex items-center gap-2 text-[12px]">
          {["Company", "Approvals on Telegram", "Connections"].map((label, i) => (
            <li key={label} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1", i === 0 ? "bg-lime/10 text-lime" : i === 1 ? "bg-white/[0.09] text-white" : "text-fog")}>
              {i === 0 ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>} {label}
            </li>
          ))}
        </ol>
        <h1 className="mt-6 text-[24px] font-medium tracking-tight">{company.name} is ready.</h1>
        <p className="mt-1 text-[14px] text-fog">Where should posts go for approval? Your team, your client — or just you — approve on Telegram with one tap.</p>

        <div className="mt-6">
          {s ? (
            <TelegramCard client={company} s={s} manager onConnected={load} />
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-fog">
              <Loader2 className="size-4 animate-spin" /> Loading
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <a href={next} className="text-[13px] text-fog hover:text-white">
            {s?.connected ? "" : "Skip for now — you can approve in the studio"}
          </a>
          <a href={next} className={cn("flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium", s?.connected ? "bg-lime text-night" : "bg-white/[0.08] text-white hover:bg-white/[0.12]")}>
            Continue <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </main>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] text-white/75">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 ring-1 ring-white/[0.1]">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded border-0 bg-transparent" aria-label={label} />
        <span className="font-mono text-[13px] text-white/80">{value}</span>
      </span>
    </label>
  );
}

/** Signs out and goes back to the login page — for an account made with the wrong details. */
function SwitchAccount({ label, inline = false }: { label: string; inline?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout", "POST").catch(() => null);
        window.location.assign("/login");
      }}
      className={cn(
        "inline-flex items-center gap-1.5 disabled:opacity-50",
        inline ? "text-lime hover:underline" : "text-[13px] text-fog hover:text-white",
      )}
    >
      {!inline && (busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowLeft className="size-3.5" />)}
      {label}
    </button>
  );
}
