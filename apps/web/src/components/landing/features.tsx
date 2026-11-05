import { ArrowUpRight, CalendarDays, Check, ChevronDown, Layers, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { Eyebrow } from "./primitives";
import { Reveal } from "@/components/ui/reveal";
import { FacebookIcon, InstagramIcon, LinkedinIcon } from "@/components/ui/platform-icons";
import { MiniCreative } from "@/components/ui/mini-creative";

export function Features() {
  return (
    <section id="features" className="bg-paper px-5 py-24 md:py-32">
      <Reveal className="mx-auto max-w-[620px] text-center">
        <Eyebrow icon={Layers} className="border-0 bg-transparent shadow-none">
          Core Studio Tools
        </Eyebrow>
        <h2 className="mt-3 text-[38px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[52px]">
          Everything You Need to
          <br />
          <span className="em">Ship Content by Voice</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[460px] text-[15px] leading-relaxed text-muted">
          Brief, write, design, check, approve and publish — handled by agents that share one room and one Brand Kit.
        </p>
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-[1100px] gap-10 md:grid-cols-3 md:gap-7">
        <Reveal delay={0}>
          <Shell>
            <BriefVisual />
          </Shell>
          <Copy title="Voice to Brief" body="Speak an idea with Wispr. The Strategist turns it into a brief with platforms, formats, language and post time." />
        </Reveal>
        <Reveal delay={0.1}>
          <Shell>
            <GuardVisual />
          </Shell>
          <Copy title="Brand Guard Checks" body="Every draft is checked against rules.md — RERA number, price wording, colours, banned claims — before the client sees it." />
        </Reveal>
        <Reveal delay={0.2}>
          <Shell>
            <ScheduleVisual />
          </Shell>
          <Copy title="Approve & Auto-Publish" body="The client replies “approve” on Telegram. The Publisher schedules it in Postiz and posts the live link back." />
        </Reveal>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="h-[310px] overflow-hidden rounded-2xl bg-white/70 p-4 ring-1 ring-line/70">{children}</div>;
}

function Copy({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 px-2">
      <h3 className="text-[22px] font-medium tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

const WAVE = [6, 10, 18, 28, 20, 34, 46, 30, 22, 40, 52, 38, 26, 16, 30, 44, 36, 22, 14, 24, 34, 20, 12, 8, 14, 10, 6];

function BriefVisual() {
  return (
    <div className="h-full rounded-xl bg-white p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium">New brief</p>
          <p className="text-[10px] text-muted">From: Akshay · 0:42 voice</p>
        </div>
        <ArrowUpRight className="size-4" />
      </div>
      <div className="mt-3 flex h-[96px] items-center justify-center gap-[3px] rounded-lg bg-gradient-to-br from-[#cfe3c4] via-[#9cc28d] to-[#5f9257]">
        {WAVE.map((h, i) => (
          <span key={i} className="w-[4px] rounded-full bg-white/85" style={{ height: h * 1.4 }} />
        ))}
      </div>
      <p className="mt-3 text-[10.5px] leading-snug text-muted">
        Diwali campaign for Luxe 28 · carousel (5) + reel (20s) · Marathi + English
      </p>
      <p className="mt-2 text-[10px] text-muted">Post time</p>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[10.5px]">
        <CalendarDays className="size-3.5 text-muted" />
        Fri, 6 Nov · 7:30 PM IST
        <ChevronDown className="ml-auto size-3.5 text-muted" />
      </div>
    </div>
  );
}

function GuardVisual() {
  return (
    <div className="relative h-full">
      <div className="absolute top-1 left-1 z-10 w-[120px] rounded-xl bg-forest p-3 text-white shadow-lg">
        <span className="grid size-7 place-items-center rounded-full bg-white/15">
          <ShieldCheck className="size-4" />
        </span>
        <p className="mt-3 flex items-center gap-1 text-[20px] font-medium">
          6/6 <Check className="size-3.5 text-sage" />
        </p>
        <p className="text-[10px] text-white/70">Checks passed</p>
      </div>

      <div className="absolute top-10 right-0 bottom-2 left-14 rounded-2xl bg-mist/60 p-2">
        <div className="flex h-full flex-col rounded-xl bg-white p-4 pt-10">
          <p className="pl-14 text-[9px] text-muted">Brand score</p>
          <p className="mt-1 flex items-center gap-1 pl-14 text-[22px] font-medium">
            98% <TrendingUp className="size-3.5 text-leaf" />
          </p>
          <svg viewBox="0 0 160 50" className="mt-2 w-full">
            <path d="M2 38 C 20 38, 26 18, 44 22 S 70 44, 88 34 S 112 6, 124 12 S 146 30, 158 26" fill="none" stroke="#1f3b26" strokeWidth="2" />
            <circle cx="124" cy="12" r="3.5" fill="#6f9b6c" stroke="#fff" strokeWidth="1.5" />
          </svg>
          <div className="mt-auto rounded-lg bg-mist/80 px-2 py-1.5 text-center text-[9.5px] text-ink/80">
            Auto-fixed: added “onwards” to slide 3
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleVisual() {
  const rows = [
    { variant: "carousel" as const, title: "Luxe 28 · Diwali carousel", when: "Fri 7:30 PM", icons: [InstagramIcon, FacebookIcon] },
    { variant: "reel" as const, title: "Diwali at home · reel", when: "Fri 7:30 PM", icons: [InstagramIcon] },
    { variant: "linkedin" as const, title: "Possession update", when: "Sat 10:00 AM", icons: [LinkedinIcon] },
  ];
  return (
    <div className="h-full rounded-xl bg-white p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium">Schedule</p>
        <span className="grid size-7 place-items-center rounded-full bg-forest text-white">
          <Plus className="size-4" />
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div key={r.title} className={`flex items-center gap-3 rounded-lg p-1.5 ${i === 0 ? "bg-mist/70" : ""}`}>
            <MiniCreative variant={r.variant} className="h-[52px] w-[44px] shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium">{r.title}</p>
              <p className="mt-0.5 text-[10px] text-muted">{r.when}</p>
            </div>
            <div className="flex gap-1 text-muted">
              {r.icons.map((I, k) => (
                <I key={k} className="size-3.5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
