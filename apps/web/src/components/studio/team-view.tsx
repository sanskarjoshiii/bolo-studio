"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import type { User } from "@bolo/core";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";
import { TelegramIcon } from "@/components/ui/platform-icons";
import { cn } from "@/lib/cn";

const input =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50";

export function TeamView({ me, users, approverOf }: { me: User; users: User[]; approverOf: Record<string, string[]> }) {
  const isAdmin = me.role === "admin";

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-5 py-4">
        <h1 className="text-[17px] font-medium tracking-tight">Team & account</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Everyone signs in with their own account. Approving from the dashboard needs a Telegram username that&apos;s listed as an approver in the client&apos;s protocol.md.
        </p>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-xl bg-white/[0.035] ring-1 ring-white/[0.06]">
          <ul className="divide-y divide-white/[0.05]">
            {users.map((u) => (
              <li key={u.id}>
                <UserRow user={u} me={me} approverOf={approverOf[u.id] ?? []} />
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <MyAccount me={me} />
          {isAdmin && <AddUser />}
        </div>
      </div>
    </main>
  );
}

function UserRow({ user, me, approverOf }: { user: User; me: User; approverOf: string[] }) {
  const { run, pending, error, clearError } = useAction();
  const canAdmin = me.role === "admin" && me.id !== user.id;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-semibold">
        {user.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">
          {user.name} {user.id === me.id && <span className="text-[11px] font-normal text-fog">(you)</span>}
        </p>
        <p className="truncate text-[11.5px] text-fog">{user.email}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={cn("inline-flex items-center gap-1", user.telegram ? "text-white/75" : "text-fog")}>
            <TelegramIcon className="size-3 text-[#5eb5e8]" /> {user.telegram ?? "no Telegram"}
          </span>
          {approverOf.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-lime/10 px-1.5 py-0.5 text-lime/90">
              <ShieldCheck className="size-3" /> approves {approverOf.join(", ")}
            </span>
          )}
        </p>
        <ErrorNote error={error} onClose={clearError} />
      </div>
      {canAdmin ? (
        <div className="flex items-center gap-1.5">
          <select
            value={user.role}
            disabled={pending}
            onChange={(e) => run(() => api(`/api/users/${user.id}`, "PATCH", { role: e.target.value }))}
            className="rounded-md bg-white/[0.06] px-2 py-1 text-[12px] text-white [color-scheme:dark] outline-none"
            aria-label={`Role for ${user.name}`}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            disabled={pending}
            onClick={() => confirm(`Remove ${user.name}?`) && run(() => api(`/api/users/${user.id}`, "DELETE"))}
            aria-label={`Remove ${user.name}`}
            className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-fog capitalize">{user.role}</span>
      )}
    </div>
  );
}

function MyAccount({ me }: { me: User }) {
  const { run, pending, error, clearError } = useAction();
  const [telegram, setTelegram] = useState(me.telegram ?? "");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const r = await run(() => api(`/api/users/${me.id}`, "PATCH", { telegram, ...(password ? { password } : {}) }));
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
    <form onSubmit={save} className="space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="text-[13px] font-medium">Your account</p>
      <label className="block">
        <span className="text-[11.5px] text-fog">Telegram username</span>
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

function AddUser() {
  const { run, pending, error, clearError } = useAction();
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setDone(null);
    const r = await run(() => api("/api/users", "POST", f));
    if (r) {
      form.reset();
      setDone(`Added ${f.name}. Share the password with them privately; they can change it after signing in.`);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <UserPlus className="size-4 text-lime" /> Add a teammate
      </p>
      <input name="name" required placeholder="Name" className={input} />
      <input name="email" type="email" required placeholder="Email" className={input} />
      <input name="password" type="text" required minLength={8} placeholder="Starting password (8+ characters)" className={input} />
      <input name="telegram" placeholder="Telegram username (optional)" className={input} />
      <select name="role" defaultValue="member" className={cn(input, "[color-scheme:dark]")}>
        <option value="member">Member — creates and edits posts</option>
        <option value="admin">Admin — also manages the team</option>
      </select>
      <ErrorNote error={error} onClose={clearError} />
      {done && <p className="text-[12px] text-emerald-300">{done}</p>}
      <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2 text-[13px] font-medium text-night disabled:opacity-50">
        {pending && <Loader2 className="size-4 animate-spin" />} Add teammate
      </button>
    </form>
  );
}
