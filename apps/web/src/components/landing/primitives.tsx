import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function Eyebrow({ icon: Icon, children, className }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-white/70 px-2.5 py-1 text-[12px] text-ink/80 shadow-[0_1px_0_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      <Icon className="size-3.5 text-muted" strokeWidth={1.75} />
      {children}
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "black";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-medium transition-colors",
        variant === "primary" && "bg-forest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-forest-2",
        variant === "black" && "bg-ink text-white hover:bg-ink/85",
        variant === "ghost" && "bg-white/60 text-ink hover:bg-white",
        className,
      )}
    >
      {children}
      {variant !== "black" && (
        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.75} />
      )}
    </Link>
  );
}
