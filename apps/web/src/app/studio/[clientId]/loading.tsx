import { LogoMark } from "@/components/ui/logo";

/** Shown the moment you switch sections, while the next one loads — the shell and rail stay put. */
export default function SectionLoading() {
  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]" aria-busy="true" aria-label="Loading">
      <div className="border-b border-white/[0.05] px-6 py-4">
        <div className="h-5 w-44 animate-pulse rounded-md bg-white/[0.07]" />
        <div className="mt-2 h-3.5 w-72 max-w-full animate-pulse rounded-md bg-white/[0.05]" />
      </div>
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-white/[0.035] ring-1 ring-white/[0.05]" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-lime" style={{ animationDuration: "0.9s" }} />
          <LogoMark className="size-6 text-lime" />
        </span>
      </div>
    </main>
  );
}
