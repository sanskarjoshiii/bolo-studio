"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, FileText, Plus } from "lucide-react";
import type { Client, ClientSettings, Post } from "@bolo/core";
import { api, useAction } from "./hooks";
import { ClientMark, ErrorNote, SectionLabel, Segmented, Toggle } from "./controls";
import { platformIcon, platformLabel, TelegramIcon } from "@/components/ui/platform-icons";

const CADENCE = ["Daily", "3x/week", "Custom"] as const;

export function SidePanel({ client, settings, posts }: { client: Client; settings: ClientSettings; posts: Post[] }) {
  const [local, setLocal] = useState(settings);
  const { run, error, clearError } = useAction();

  const save = (patch: Partial<ClientSettings>) => {
    setLocal((s) => ({ ...s, ...patch })); // optimistic
    run(() => api(`/api/clients/${client.id}/settings`, "PATCH", patch)).then((r) => {
      if (!r) setLocal(settings);
    });
  };

  const pipeline = (["draft", "brand-check", "awaiting", "scheduled"] as const).map((s) => posts.filter((p) => p.status === s).length);

  return (
    <aside className="thin-scrollbar flex w-[284px] shrink-0 flex-col gap-6 overflow-y-auto rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <div>
        <p className="text-[19px] font-medium tracking-tight text-white">{client.name}</p>
        <p className="mt-0.5 text-[12px] text-fog">{client.sector}</p>
      </div>

      <section>
        <SectionLabel
          action={
            <Link href={`/studio/${client.id}/publishing`} className="text-[11.5px] text-lime hover:underline">
              Manage
            </Link>
          }
        >
          Channels
        </SectionLabel>
        <div className="mt-3 flex gap-4">
          {client.channels.map((c) => {
            const Icon = platformIcon[c.platform];
            return (
              <div key={c.platform} className="w-[58px] text-center" title={`${platformLabel[c.platform]} · ${c.handle}`}>
                <div className="relative mx-auto w-fit">
                  <ClientMark client={client} className="size-10 rounded-full text-[14px]" />
                  <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-night-2 ring-2 ring-night">
                    <Icon className="size-2.5 text-white" />
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[10.5px] text-white/70">{platformLabel[c.platform].split(" ")[0]}</p>
              </div>
            );
          })}
        </div>
        <Link
          href={`/studio/${client.id}/publishing`}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2.5 text-[12.5px] text-white/80 transition-colors hover:bg-white/[0.04]"
        >
          Connect channel via Postiz <Plus className="size-3.5" />
        </Link>
      </section>

      <section className="space-y-4">
        <SectionLabel action={<span className="font-mono text-[10px] text-fog">protocol.md</span>}>Posting protocol</SectionLabel>

        <div>
          <p className="mb-2 text-[12px] text-white/80">Approvers</p>
          <div className="space-y-1.5">
            {client.approvers.map((a) => (
              <div key={a.handle} className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-2">
                <span className="grid size-7 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white">
                  {a.name
                    .replace(/^(Dr|Mr|Ms|Mrs)\.\s*/, "")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[12px] text-white">
                    {a.name}
                    {a.backup && <span className="ml-1 text-[10px] text-fog">backup</span>}
                  </p>
                  <p className="truncate text-[10.5px] text-fog">{a.handle}</p>
                </div>
                <TelegramIcon className="size-3.5 text-[#5eb5e8]" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] text-white/80">Posting cadence</p>
          <Segmented options={CADENCE} value={local.cadence} onChange={(cadence) => save({ cadence })} />
        </div>

        <div>
          <p className="mb-2 text-[12px] text-white/80">Best times (IST)</p>
          <ul className="space-y-1 rounded-lg bg-white/[0.05] px-3 py-2">
            {client.bestTimes.map((b) => (
              <li key={b.label} className="flex items-center gap-2 text-[11.5px]">
                <Clock className="size-3 shrink-0 text-fog" />
                <span className="truncate text-fog">{b.label}</span>
                <span className="ml-auto shrink-0 text-white">{b.time.split(",")[0]}</span>
              </li>
            ))}
          </ul>
        </div>

        <ToggleRow label="Schedule ideas at best times" on={local.useBestTimes} onChange={(v) => save({ useBestTimes: v })} />
        <ToggleRow label="Remind approver after 4h" hint="Escalates to account manager at 24h" on={local.remindApprover} onChange={(v) => save({ remindApprover: v })} />
        <ToggleRow label="Brand Guard auto-fix" hint="“onwards”, RERA no., hashtags — always listed" on={local.autoFix} onChange={(v) => save({ autoFix: v })} />
        <ErrorNote error={error} onClose={clearError} />
      </section>

      <section>
        <SectionLabel action={<span className="text-[10.5px] text-fog">{client.files.length} files</span>}>Brand Kit</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {client.files.map((f) => (
            <Link
              key={f.name}
              href={`/studio/${client.id}/brand-kit?file=${encodeURIComponent(f.name)}`}
              className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10.5px] text-white/75 hover:bg-white/[0.09] hover:text-white"
            >
              <FileText className="size-3 text-fog" />
              {f.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-auto rounded-xl bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-3.5 ring-1 ring-white/[0.07]">
        <p className="text-[13px] font-medium text-white">Pipeline</p>
        <div className="mt-3 grid grid-cols-4 gap-1 text-center">
          {[
            ["Producing", pipeline[0]],
            ["Checking", pipeline[1]],
            ["Approval", pipeline[2]],
            ["Queued", pipeline[3]],
          ].map(([l, n]) => (
            <div key={l} className="rounded-lg bg-white/[0.04] py-2">
              <p className="text-[16px] font-medium tabular-nums">{n}</p>
              <p className="text-[9.5px] text-fog">{l}</p>
            </div>
          ))}
        </div>
        <Link
          href={`/studio/${client.id}/approvals`}
          className="mt-3.5 flex w-full items-center justify-between border-t border-white/[0.07] pt-3 text-[12px] text-white/85 hover:text-white"
        >
          Open approval queue <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </aside>
  );
}

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="leading-tight">
        <p className="text-[12px] text-white/85">{label}</p>
        {hint && <p className="mt-0.5 text-[10.5px] text-fog">{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}
