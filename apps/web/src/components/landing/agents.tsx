"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ChevronLeft, ChevronRight, Clapperboard, Compass, Palette, PenLine, Quote, Send, ShieldCheck, type LucideIcon } from "lucide-react";
import { Eyebrow } from "./primitives";
import { Reveal } from "@/components/ui/reveal";

type Agent = {
  name: string;
  icon: LucideIcon;
  role: "Single-holder" | "Shared";
  builtWith: string;
  job: string;
  output: string;
};

const AGENTS: Agent[] = [
  {
    name: "Strategist",
    icon: Compass,
    role: "Single-holder",
    builtWith: "Claude Code",
    job: "Turns a raw voice dump into a brief — goal, audience, platforms, formats, language, post time — and plans the weekly calendar.",
    output: "Brief: Carousel (5) + Reel (20s) · IG / FB / LI · Fri 7:30 PM",
  },
  {
    name: "Copywriter",
    icon: PenLine,
    role: "Shared",
    builtWith: "Claude Code",
    job: "Writes platform-wise captions, hooks and CTAs in Marathi, Hindi or English, following the tone in brand.md.",
    output: "3 caption options · max 8 hashtags · LinkedIn without hashtag spam",
  },
  {
    name: "Visual Designer",
    icon: Palette,
    role: "Shared",
    builtWith: "Claude Code + Playwright",
    job: "Builds posts and carousels in HTML/CSS using only tokens.json — so text is always spelled right and colours are always on-brand.",
    output: "5 slides · 1080 × 1350 · Playfair Display + Inter",
  },
  {
    name: "Reel Producer",
    icon: Clapperboard,
    role: "Single-holder",
    builtWith: "Claude Code + Remotion",
    job: "Script with a 2-second hook, scene plan, voiceover, render and burned-in subtitles in the brand font.",
    output: "1080 × 1920 · 20s · Marathi-English voice · < 20 MB",
  },
  {
    name: "Brand Guard",
    icon: ShieldCheck,
    role: "Single-holder",
    builtWith: "Codex",
    job: "Checks every draft against rules.md, fixes small issues itself, and only then sends the package to the client on Telegram.",
    output: "Auto-fixed: added “onwards” · RERA no. present · 6/6 checks",
  },
  {
    name: "Publisher",
    icon: Send,
    role: "Single-holder",
    builtWith: "Custom agent · Switch protocol",
    job: "Acts only on “approve” from approvers named in protocol.md, schedules in Postiz, and posts the live link back.",
    output: "Scheduled · IG + FB Fri 7:30 PM → Live link posted",
  },
];

const at = (i: number) => AGENTS[(i + AGENTS.length) % AGENTS.length];

function SmallCard({ agent }: { agent: Agent }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-line/70"
    >
      <Quote className="size-5 fill-ink text-ink" />
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink/80">{agent.job}</p>
      <div className="mt-5 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-mist">
          <agent.icon className="size-4 text-forest" strokeWidth={1.75} />
        </span>
        <div className="flex-1 leading-tight">
          <p className="text-[12.5px] font-medium">{agent.name}</p>
          <p className="text-[10px] text-muted">{agent.builtWith}</p>
        </div>
        <span className="rounded-md bg-mist px-1.5 py-0.5 text-[9.5px] text-muted">{agent.role}</span>
      </div>
    </motion.div>
  );
}

export function Agents() {
  const [i, setI] = useState(4); // open on Brand Guard — the step clients feel most

  const featured = at(i);

  return (
    <section id="agents" className="bg-paper px-5 py-20 md:py-28">
      <Reveal className="mx-auto flex max-w-[1100px] flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <Eyebrow icon={Bot} className="border-0 bg-transparent px-0 shadow-none">
            Meet the Agents
          </Eyebrow>
          <h2 className="mt-3 text-[38px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[46px]">
            Six Agents Working in
            <br />
            One <span className="em">Shared Switch Room</span>
          </h2>
        </div>
        <p className="max-w-[330px] text-[13.5px] leading-relaxed text-muted">
          Each agent runs on a team member&apos;s laptop and joins the same room. Single-holder roles mean a post can never be
          scheduled twice.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-14 grid max-w-[1100px] gap-4 md:grid-cols-[1fr_0.9fr_1fr]">
        <div className="hidden flex-col gap-4 md:flex">
          <AnimatePresence mode="popLayout">
            <SmallCard key={at(i - 2).name} agent={at(i - 2)} />
            <SmallCard key={at(i - 1).name} agent={at(i - 1)} />
          </AnimatePresence>
        </div>

        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={featured.name}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#2c4a33] via-[#1f3b26] to-[#132617] p-6 text-white"
            >
              <featured.icon className="absolute -top-6 -right-8 size-[220px] text-white/[0.06]" strokeWidth={1} />
              <span className="grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <featured.icon className="size-6" strokeWidth={1.5} />
              </span>
              <p className="mt-6 text-[26px] font-medium tracking-tight">{featured.name}</p>
              <p className="text-[12px] text-white/60">
                {featured.builtWith} · {featured.role}
              </p>

              <div className="mt-auto rounded-xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur">
                <p className="text-[10px] tracking-wide text-sage uppercase">Posts in the room</p>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-white/90">{featured.output}</p>
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-white/75">{featured.job}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => setI((v) => v - 1)} aria-label="Previous agent" className="grid size-8 place-items-center rounded-full text-ink hover:bg-mist">
              <ChevronLeft className="size-4" />
            </button>
            <div className="relative h-px flex-1 bg-line">
              <motion.span
                className="absolute top-0 left-0 h-px bg-ink"
                animate={{ width: `${(((i % 6) + 6) % 6 + 1) / 6 * 100}%` }}
              />
            </div>
            <button onClick={() => setI((v) => v + 1)} aria-label="Next agent" className="grid size-8 place-items-center rounded-full bg-forest text-white hover:bg-forest-2">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="hidden flex-col gap-4 md:flex">
          <AnimatePresence mode="popLayout">
            <SmallCard key={at(i + 1).name} agent={at(i + 1)} />
            <SmallCard key={at(i + 2).name} agent={at(i + 2)} />
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
