import { cn } from "@/lib/cn";

/** Waveform mark — "bolo" means "speak". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)} aria-hidden>
      <rect x="2" y="9" width="3.2" height="6" rx="1.6" />
      <rect x="7.6" y="4" width="3.2" height="16" rx="1.6" />
      <rect x="13.2" y="7" width="3.2" height="10" rx="1.6" />
      <rect x="18.8" y="10" width="3.2" height="4" rx="1.6" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight", className)}>
      <LogoMark />
      Bolo Studio
    </span>
  );
}
