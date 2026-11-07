"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { ChevronDown, Heart, MessageCircle, Mic, Send, TrendingUp } from "lucide-react";
import { Hills } from "./hills";
import { ButtonLink, Eyebrow } from "./primitives";
import { LogoMark } from "@/components/ui/logo";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const visualRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: visualRef, offset: ["start end", "end start"] });
  // Side cards drift up faster than the phone, and the activity card slides in — as in the reference scroll
  const cardsY = useTransform(scrollYProgress, [0.3, 0.8], [0, -150]);
  const phoneY = useTransform(scrollYProgress, [0.3, 0.8], [0, -60]);
  const activityY = useTransform(scrollYProgress, [0.45, 0.75], [80, 0]);
  const activityOpacity = useTransform(scrollYProgress, [0.45, 0.65], [0, 1]);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-paper via-[#edf1ef] to-[#e3e9e5]">
      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-10 text-center md:pt-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <Eyebrow icon={Mic}>Voice-first content studio</Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: 0.08, ease }}
          className="mt-6 max-w-[1000px] text-[40px] leading-[1.05] font-medium tracking-[-0.035em] sm:text-[56px] md:text-[68px]"
        >
          Speak One Idea. <span className="em">Ship Every Post,</span>
          <br className="hidden sm:block" /> Brand-Checked and Approved
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.18, ease }}
          className="mt-6 max-w-[540px] text-[15px] leading-relaxed text-muted"
        >
          AI agents write, design, make reels and brand-check your idea. Your client approves on Telegram, and it goes
          live on Instagram, Facebook, LinkedIn and YouTube.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.26, ease }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <ButtonLink href="/dashboard">Open the Studio</ButtonLink>
          <ButtonLink href="/api/auth/demo" variant="ghost">
            Try the Demo
          </ButtonLink>
          <ButtonLink href="#how" variant="ghost">
            See How It Works
          </ButtonLink>
        </motion.div>
      </div>

      {/* Visual */}
      <div ref={visualRef} className="relative mt-14 h-[460px] md:mt-16 md:h-[560px]">
        <div className="absolute inset-x-0 bottom-0 h-[78%]">
          <Hills />
        </div>

        <div className="relative mx-auto h-full max-w-[1000px]">
          {/* Phone */}
          <motion.div style={{ y: phoneY }} className="absolute left-1/2 top-0 w-[250px] -translate-x-1/2 md:w-[320px]">
            <motion.div
              initial={{ opacity: 0, y: 120 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.3, ease }}
            >
              <Phone activityY={activityY} activityOpacity={activityOpacity} />
            </motion.div>
          </motion.div>

          {/* Left card — platforms */}
          <motion.div
            style={{ y: cardsY }}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.6, ease }}
            className="absolute top-[150px] left-[4%] hidden w-[220px] md:block lg:left-[2%]"
          >
            <PlatformsCard />
          </motion.div>

          {/* Right card — languages */}
          <motion.div
            style={{ y: cardsY }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.7, ease }}
            className="absolute top-[115px] right-[4%] hidden w-[250px] md:block lg:right-[2%]"
          >
            <LanguagesCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Phone with a reel being produced ---------- */

function Phone({ activityY, activityOpacity }: { activityY: MotionValue<number>; activityOpacity: MotionValue<number> }) {
  return (
    <div className="relative">
      <div className="relative aspect-[9/18.5] overflow-hidden rounded-[46px] border-[7px] border-[#0d0f0e] bg-[#dfe7e2] shadow-[0_40px_80px_-30px_rgba(20,40,25,0.45)]">
        {/* scene */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#93a89e] via-[#bfcdc5] to-[#dde5e0]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%]">
          <Hills tone="bright" />
        </div>

        {/* dynamic island */}
        <div className="absolute top-3 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#0d0f0e]" />

        {/* reel progress */}
        <div className="absolute top-12 right-4 left-4 flex gap-1">
          {[1, 0.55, 0].map((p, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/45">
              <div className="h-full bg-white" style={{ width: `${p * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="absolute top-[60px] left-4 flex items-center gap-2 text-left">
          <div className="grid size-7 place-items-center rounded-full bg-pushpam font-brand text-[11px] text-pushpam-gold">P</div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-white drop-shadow">pushpaminfra</p>
            <p className="text-[9px] text-white/85 drop-shadow">Reel · 20s · Draft</p>
          </div>
        </div>

        {/* glass brand pill */}
        <div className="absolute top-[52%] left-5 flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-2 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] backdrop-blur-md">
          <LogoMark className="size-4" />
          <span className="text-[13px] font-semibold tracking-[0.12em]">BOLO</span>
        </div>

        {/* burned-in subtitle in client brand style (reel-style.md) */}
        <div className="absolute right-6 bottom-[25%] left-6 text-center">
          <span className="inline bg-pushpam px-1.5 py-0.5 text-[12px] leading-[1.7] font-bold text-white [box-decoration-break:clone]">
            Is Diwali, tumchya navin gharat
          </span>
        </div>

        <div className="absolute right-3 bottom-[34%] flex flex-col items-center gap-3 text-white drop-shadow">
          <Heart className="size-4" />
          <MessageCircle className="size-4" />
          <Send className="size-4" />
        </div>

        {/* agent activity — slides in on scroll */}
        <motion.div
          style={{ y: activityY, opacity: activityOpacity }}
          className="absolute right-3 bottom-4 left-3 rounded-2xl bg-white/95 p-3 text-left shadow-lg backdrop-blur"
        >
          <p className="text-[11px] font-medium">Agent activity · this week</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {[
              ["14", "Briefs", "Strategist"],
              ["42", "Captions", "Copywriter"],
              ["9", "Reels", "Reel Producer"],
            ].map(([n, l, a]) => (
              <div key={l} className="rounded-lg border border-line px-2 py-1.5">
                <p className="text-[13px] font-semibold">{n}</p>
                <p className="text-[8px] text-muted">{l}</p>
                <p className="mt-1 truncate text-[8px] text-leaf">{a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* floating schedule card on the phone edge */}
      <ScheduledCard />
    </div>
  );
}

function ScheduledCard() {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    const c = animate(count, 12, { duration: 1.6, delay: 1.1, ease: "easeOut" });
    return () => c.stop();
  }, [count]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1, ease }}
      className="absolute top-[37%] -right-6 w-[150px] rounded-xl bg-white p-3 text-left shadow-[0_20px_40px_-20px_rgba(0,0,0,0.35)] md:-right-10 md:w-[170px]"
    >
      <p className="text-[10px] text-muted">Week of 2 Nov 2026</p>
      <div className="mt-1 flex items-end gap-2">
        <motion.span className="text-[24px] leading-none font-semibold tracking-tight">{rounded}</motion.span>
        <span className="mb-0.5 inline-flex items-center gap-0.5 text-[9px] text-leaf">
          <TrendingUp className="size-2.5" /> +4
        </span>
        <span className="mb-0.5 ml-auto text-right text-[8px] leading-tight text-muted">
          Posts
          <br />
          scheduled
        </span>
      </div>
      <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-mist">
        <div className="w-[50%] bg-ink" />
        <div className="w-[33%] bg-leaf" />
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[8px] whitespace-nowrap text-muted">
        <span>● Live 6</span>
        <span className="text-leaf">● Queued 4</span>
        <span>○ Pending 2</span>
      </div>
    </motion.div>
  );
}

/* ---------- Side cards ---------- */

function PlatformsCard() {
  const rows = [
    { name: "Facebook", pct: 34, bar: "bg-[#c9d1cc]", meta: ["Posts 3", "Live 2", "Queued 1"] },
    { name: "LinkedIn", pct: 58, bar: "bg-leaf", meta: ["Posts 4", "Live 2", "Queued 2"] },
    { name: "Instagram", pct: 86, bar: "bg-ink", meta: ["Reels 3", "Carousels 4", "Posts 2"] },
  ];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.4)]">
      {rows.map((r) => (
        <div key={r.name} className="mb-3 last:mb-0">
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <span className={`size-1.5 rounded-sm ${r.bar}`} />
            {r.name}
          </p>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${r.pct}%` }}
              transition={{ duration: 1.2, delay: 1.1, ease }}
              className={`h-full rounded-full ${r.bar}`}
            />
          </div>
          <div className="mt-1.5 flex gap-2.5 text-[9px] text-muted">
            {r.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const LANGS = [
  { label: "MR + EN", pct: 55, color: "#14261a" },
  { label: "Marathi", pct: 18, color: "#4f7f4c" },
  { label: "Hindi", pct: 14, color: "#8db187" },
  { label: "English", pct: 13, color: "#d3dfd6" },
];

function LanguagesCard() {
  const r = 70;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium">Caption languages</p>
          <p className="text-[10px] text-muted">This month</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px]">
          All <ChevronDown className="size-3" />
        </span>
      </div>

      <div className="relative mx-auto mt-2 w-[170px]">
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[20px] leading-none font-semibold tracking-tight">55%</p>
          <p className="mt-1 text-[9px] text-muted">MR + EN mix</p>
        </div>
      </div>
      <svg viewBox="0 0 180 180" className="w-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f4f2" strokeWidth="38" />
        {LANGS.map((l) => {
          const len = (l.pct / 100) * c;
          const off = acc;
          acc += len;
          return (
            <motion.circle
              key={l.label}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={l.color}
              strokeWidth="38"
              strokeDasharray={`${len} ${c}`}
              initial={{ strokeDashoffset: -off + len }}
              animate={{ strokeDashoffset: -off }}
              transition={{ duration: 1.2, delay: 1.2, ease }}
            />
          );
        })}
      </svg>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        {LANGS.map((l) => (
          <div key={l.label}>
            <span className="mx-auto block size-2 rounded-full border border-line" style={{ background: l.color }} />
            <p className="mt-1 text-[9px] text-muted">{l.label}</p>
            <p className="text-[10px] font-medium">{l.pct}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
