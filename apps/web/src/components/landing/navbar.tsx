"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const links = [
  { href: "#", label: "Home" },
  { href: "#features", label: "Features", caret: true },
  { href: "#agents", label: "Agents" },
  { href: "#teams", label: "For Teams" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-30">
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-14 md:py-7">
        <Link href="/" aria-label="Bolo Studio home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 text-[14px] text-ink/75 md:flex">
          {links.map((l, i) => (
            <li key={l.label}>
              <a href={l.href} className={cn("inline-flex items-center gap-1 transition-colors hover:text-ink", i === 0 && "font-medium text-ink")}>
                {l.label}
                {l.caret && <ChevronDown className="size-3.5" strokeWidth={1.75} />}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-6 md:flex">
          <Link href="/dashboard" className="text-[14px] text-ink/75 hover:text-ink">
            Login
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-white hover:bg-ink/85">
            Open Studio
          </Link>
        </div>

        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="mx-5 rounded-xl border border-line bg-white p-4 shadow-lg md:hidden">
          {links.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-[15px]">
              {l.label}
            </a>
          ))}
          <Link href="/dashboard" className="mt-2 block rounded-lg bg-ink px-4 py-2.5 text-center text-[14px] font-medium text-white">
            Open Studio
          </Link>
        </div>
      )}
    </header>
  );
}
