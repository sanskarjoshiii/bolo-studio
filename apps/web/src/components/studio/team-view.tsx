"use client";

import { useState } from "react";
import { Loader2, LogOut, Mail, Plus, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import type { Client, MemberInfo, MemberRole, User } from "@bolo/core";
import { api, useAction } from "./hooks";
import { ErrorNote, Toggle } from "./controls";
import { TelegramIcon } from "@/components/ui/platform-icons";
import { ScrollMain } from "@/components/ui/smooth-scroll";
import { cn } from "@/lib/cn";

const input =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50";

type Invite = { id: string; name: string; email: string; username: string; role: MemberRole; canApprove: boolean; createdAt: string };

const ROLE_HINT: Record<MemberRole, string> = {
  owner: "Everything, including the team and connections",
  admin: "Team, Brand Kit and connections",
  member: "Creates and edits posts",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function TeamView({ me, client, manager, invites }: { me: User; client: Client; manager: boolean; invites: Invite[] }) {
  const approvers = [...client.members.filter((m) => m.canApprove).map((m) => m.name), ...client.telegramApprovers];
  return (
    <ScrollMain>
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Team · {client.name}</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          {client.groupApproves
            ? "Anyone in the connected Telegram group can approve, and so can the owners."
            : approvers.length
              ? `Approvers: ${approvers.join(", ")} — plus the owners.`
              : "No approvers set — the owner approves posts. Add teammates with “Can approve”, or Telegram approvers below."}
        </p>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white/[0.035] ring-1 ring-white/[0.06]">
            <p className="border-b border-white/[0.05] px-4 py-3 text-[13px] font-medium">Members · {client.members.length}</p>
            <ul className="divide-y divide-white/[0.05]">
              {client.members.map((m) => (
                <li key={m.userId}>
                  <MemberRow member={m} me={me} companyId={client.id} manager={manager} />
                </li>
              ))}
              {client.members.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-fog">No members yet — Bolo Studio admins manage this company.</li>}
            </ul>
          </section>

          {manager && invites.length > 0 && (
            <section className="rounded-xl bg-white/[0.035] ring-1 ring-white/[0.06]">
              <p className="border-b border-white/[0.05] px-4 py-3 text-[13px] font-medium">Invites waiting · {invites.length}</p>
              <ul className="divide-y divide-white/[0.05]">
                {invites.map((i) => (
                  <li key={i.id}>
                    <InviteRow invite={i} companyId={client.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <TelegramApprovers client={client} manager={manager} />
          {manager && <AddMember companyId={client.id} companyName={client.name} />}
          <MyAccount me={me} />
        </div>
      </div>
    </ScrollMain>
  );
}

function MemberRow({ member, me, companyId, manager }: { member: MemberInfo; me: User; companyId: string; manager: boolean }) {
  const { run, pending, error, clearError } = useAction();
  const isMe = member.userId === me.id;
  const patch = (p: Partial<Pick<MemberInfo, "role" | "canApprove">>) => run(() => api(`/api/companies/${companyId}/members/${member.userId}`, "PATCH", p));

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold">{initialsOf(member.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {member.name} {isMe && <span className="text-[11px] font-normal text-fog">(you)</span>}
        </p>
        <p className="truncate text-[11.5px] text-fog">
          @{member.username} · {member.email}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={cn("inline-flex items-center gap-1", member.telegram ? "text-white/75" : "text-fog")}>
            <TelegramIcon className="size-3 text-[#5eb5e8]" /> {member.telegram ?? "no Telegram"}
          </span>
          {member.canApprove && (
            <span className="inline-flex items-center gap-1 rounded bg-lime/10 px-1.5 py-0.5 text-lime/90">
              <ShieldCheck className="size-3" /> approver
            </span>
          )}
        </p>
        <ErrorNote error={error} onClose={clearError} />
      </div>
      {manager ? (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[11.5px] text-fog" title="Can approve or reject posts">
            Can approve
            <Toggle on={member.canApprove} disabled={pending} onChange={(v) => patch({ canApprove: v })} label={`${member.name} can approve`} />
          </label>
          <select
            value={member.role}
            disabled={pending}
            onChange={(e) => patch({ role: e.target.value as MemberRole })}
            title={ROLE_HINT[member.role]}
            className="rounded-md bg-white/[0.06] px-2 py-1 text-[12px] text-white [color-scheme:dark] outline-none"
            aria-label={`Role for ${member.name}`}
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
          <button
            disabled={pending}
            onClick={() => confirm(isMe ? "Leave this company?" : `Remove ${member.name} from the company?`) && run(() => api(`/api/companies/${companyId}/members/${member.userId}`, "DELETE")).then((r) => r && isMe && window.location.assign("/dashboard"))}
            aria-label={isMe ? "Leave company" : `Remove ${member.name}`}
            className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300"
          >
            {isMe ? <LogOut className="size-4" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-fog capitalize">{member.role}</span>
          {isMe && (
            <button
              onClick={() => confirm("Leave this company?") && run(() => api(`/api/companies/${companyId}/members/${me.id}`, "DELETE")).then((r) => r && window.location.assign("/dashboard"))}
              className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300"
              aria-label="Leave company"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InviteRow({ invite, companyId }: { invite: Invite; companyId: string }) {
  const { run, pending } = useAction();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Mail className="size-4 shrink-0 text-fog" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">{invite.name}</p>
        <p className="truncate text-[11.5px] text-fog">
          @{invite.username} · {invite.role}
          {invite.canApprove ? " · can approve" : ""} · waiting for them to accept
        </p>
      </div>
      <button
        disabled={pending}
        onClick={() => run(() => api(`/api/companies/${companyId}/invites/${invite.id}`, "DELETE"))}
        aria-label={`Cancel invite for ${invite.name}`}
        className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function AddMember({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { run, pending, error, clearError } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const [canApprove, setCanApprove] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setDone(null);
    const r = await run(() => api<{ user: { name: string } }>(`/api/companies/${companyId}/members`, "POST", { ...f, canApprove }));
    if (r) {
      form.reset();
      setCanApprove(false);
      setDone(`Invite sent to ${r.user.name}. They'll see it in their notifications and join when they accept.`);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <UserPlus className="size-4 text-lime" /> Add a member
      </p>
      <p className="text-[11.5px] leading-relaxed text-fog">They need a Bolo Studio account. Enter the email or username they signed up with — they&apos;ll get a request to join {companyName}.</p>
      <input name="login" required autoComplete="off" placeholder="Email or username" className={input} onChange={() => (clearError(), setDone(null))} />
      <select name="role" defaultValue="member" className={cn(input, "[color-scheme:dark]")}>
        <option value="member">Member — creates and edits posts</option>
        <option value="admin">Admin — also team, Brand Kit and connections</option>
      </select>
      <label className="flex items-center justify-between gap-3 text-[12.5px] text-white/85">
        Can approve posts
        <Toggle on={canApprove} onChange={setCanApprove} label="Can approve posts" />
      </label>
      <ErrorNote error={error} onClose={clearError} />
      {done && <p className="text-[12px] text-emerald-300">{done}</p>}
      <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2 text-[13px] font-medium text-night disabled:opacity-50">
        {pending && <Loader2 className="size-4 animate-spin" />} Send invite
      </button>
    </form>
  );
}

/**
 * People who approve on Telegram without a Bolo account — the client's social media manager, their
 * own client — or simply everyone in the connected group.
 */
function TelegramApprovers({ client, manager }: { client: Client; manager: boolean }) {
  const { run, pending, error, clearError } = useAction();
  const [handle, setHandle] = useState("");
  const save = (patch: { telegram?: string[]; anyoneInGroup?: boolean }) => run(() => api(`/api/companies/${client.id}/approvals`, "PATCH", patch));
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@/, "");
    if (!h) return;
    if (await save({ telegram: [...client.telegramApprovers, h] })) setHandle("");
  };

  return (
    <section className="space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <TelegramIcon className="size-4 text-[#5eb5e8]" /> Telegram approvers
      </p>
      <p className="text-[11.5px] leading-relaxed text-fog">
        People who approve from your Telegram group — they don&apos;t need a Bolo Studio account. They reply under each post: approve, change: …, or reject.
      </p>
      <label className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[12.5px] text-white/85">
        <span>
          Anyone in the group can approve
          <span className="block text-[11px] text-fog">For a group where everyone is trusted</span>
        </span>
        <Toggle on={client.groupApproves} disabled={!manager || pending} onChange={(v) => save({ anyoneInGroup: v })} label="Anyone in the group can approve" />
      </label>
      {!client.groupApproves && (
        <>
          {client.telegramApprovers.length > 0 ? (
            <ul className="space-y-1">
              {client.telegramApprovers.map((h) => (
                <li key={h} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12.5px]">
                  <span className="font-mono text-white/85">{h}</span>
                  {manager && (
                    <button
                      onClick={() => save({ telegram: client.telegramApprovers.filter((x) => x !== h) })}
                      disabled={pending}
                      aria-label={`Remove ${h}`}
                      className="grid size-6 place-items-center rounded-md text-fog hover:bg-white/[0.06] hover:text-red-300"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11.5px] text-fog">Nobody yet.</p>
          )}
          {manager && (
            <form onSubmit={add} className="flex gap-2">
              <input value={handle} onChange={(e) => (setHandle(e.target.value), clearError())} placeholder="@their_telegram_username" className={input} aria-label="Telegram username" />
              <button disabled={pending || !handle.trim()} className="grid size-9 shrink-0 place-items-center rounded-lg bg-lime text-night disabled:opacity-40" aria-label="Add Telegram approver">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
            </form>
          )}
          <p className="text-[11px] text-fog">Their username is in Telegram → Settings → Username.</p>
        </>
      )}
      <ErrorNote error={error} onClose={clearError} />
    </section>
  );
}

function MyAccount({ me }: { me: User }) {
  const { run, pending, error, clearError } = useAction();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [telegram, setTelegram] = useState(me.telegram ?? "");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const r = await run(() => api(`/api/users/${me.id}`, "PATCH", { name, username, telegram, ...(password ? { password } : {}) }));
    if (r && password) {
      // A new password ends every session, including this one
      window.location.assign("/login");
      return;
    }
    if (r) {
      setPassword("");
      setSaved(true);
    }
  };

  return (
    <form id="account" onSubmit={save} className="scroll-mt-4 space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="text-[13px] font-medium">Your account</p>
      <label className="block">
        <span className="text-[11.5px] text-fog">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "mt-1")} />
      </label>
      <label className="block">
        <span className="text-[11.5px] text-fog">Username — teammates add you by this</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className={cn(input, "mt-1")} />
      </label>
      <label className="block">
        <span className="text-[11.5px] text-fog">Telegram username — lets you approve from Telegram</span>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@yourname" className={cn(input, "mt-1")} />
      </label>
      <label className="block">
        <span className="text-[11.5px] text-fog">New password (leave empty to keep)</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cn(input, "mt-1")} />
      </label>
      <ErrorNote error={error} onClose={clearError} />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[12px] text-emerald-300">Saved</span>}
        <button disabled={pending} className="rounded-lg bg-white/[0.1] px-3 py-1.5 text-[12.5px] font-medium hover:bg-white/[0.15] disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
