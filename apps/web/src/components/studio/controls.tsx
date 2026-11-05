"use client";

import type { Client } from "@bolo/core";
import { cn } from "@/lib/cn";

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-lime" : "bg-white/15")}
    >
      <span className={cn("absolute top-[3px] size-3 rounded-full transition-all", on ? "left-[15px] bg-night" : "left-[3px] bg-white/60")} />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className={cn("flex rounded-lg bg-white/[0.05] p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-[12px] transition-colors",
            o === value ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-fog hover:text-white/80",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[10.5px] font-medium tracking-[0.08em] text-fog uppercase">{children}</p>
      {action}
    </div>
  );
}

export function ClientMark({ client, className }: { client: Pick<Client, "name" | "mark">; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-md text-[11px] font-semibold", client.mark.font === "brand" && "font-brand", className)}
      style={{ background: client.mark.bg, color: client.mark.fg }}
    >
      {client.name[0]}
    </span>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.06]", className)}>{children}</div>;
}

export function ErrorNote({ error, onClose }: { error: string | null; onClose?: () => void }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-200 ring-1 ring-red-400/20">
      {error}
      {onClose && (
        <button onClick={onClose} className="text-red-200/70 hover:text-red-100" aria-label="Dismiss">
          ×
        </button>
      )}
    </p>
  );
}
