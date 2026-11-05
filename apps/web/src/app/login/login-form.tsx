"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/components/studio/hooks";
import { ErrorNote } from "@/components/studio/controls";

export function LoginForm({ setup, next }: { setup: boolean; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (setup && f.password !== f.confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api(setup ? "/api/auth/setup" : "/api/auth/login", "POST", f);
      window.location.assign(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {setup && <Field name="name" label="Your name" autoComplete="name" required />}
      <Field name="email" type="email" label="Email" autoComplete="email" required />
      <Field name="password" type="password" label="Password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 8 : undefined} />
      {setup && (
        <>
          <Field name="confirm" type="password" label="Confirm password" autoComplete="new-password" required />
          <Field name="telegram" label="Telegram username (optional)" placeholder="@pathankamran_03" />
        </>
      )}
      <ErrorNote error={error} />
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2.5 text-[14px] font-medium text-night hover:brightness-95 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {setup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className="block">
      <span className="text-[12px] text-white/75">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg bg-white/[0.05] px-3 py-2.5 text-[14px] text-white ring-1 ring-white/[0.1] outline-none placeholder:text-white/30 focus:ring-lime/60"
      />
    </label>
  );
}
