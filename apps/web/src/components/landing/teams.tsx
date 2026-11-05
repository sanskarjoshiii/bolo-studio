"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Languages, Sparkles, UserRound, Users } from "lucide-react";
import { ButtonLink, Eyebrow } from "./primitives";
import { Reveal } from "@/components/ui/reveal";
import { MiniCreative } from "@/components/ui/mini-creative";
import { LinkedinIcon, TelegramIcon } from "@/components/ui/platform-icons";
import { cn } from "@/lib/cn";

const ITEMS = [
  {
    icon: Building2,
    title: "Built for Agencies With Many Clients",
    body: "Each client gets a Brand Kit, a private work room and a Telegram approvals group. New client? Clone the room template in one click.",
  },
  {
    icon: UserRound,
    title: "Grow Your Personal Brand",
    body: "Run your own #my-brand room for LinkedIn, Instagram, hackathon posts and blogs — same agents, your own tone of voice.",
  },
  {
    icon: Languages,
    title: "Write in Marathi, Hindi and English",
    body: "Captions, subtitles and voiceovers in the language your audience actually speaks — including the Marathi-English mix Pune loves.",
  },
];

export function Teams() {
  const [active, setActive] = useState(0);

  return (
    <section id="teams" className="bg-paper px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 md:grid-cols-[1fr_1.05fr]">
        <Reveal>
          <Eyebrow icon={Users}>Built For Teams</Eyebrow>
          <h2 className="mt-5 text-[38px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[46px]">
            One Studio for Every
            <br />
            <span className="em">Brand You Run</span>
          </h2>

          {/* progress rail */}
          <div className="relative mt-8 h-px max-w-[420px] bg-line">
            <motion.span
              className="absolute -top-[3px] size-[7px] rounded-full bg-ink"
              animate={{ left: `${(active / (ITEMS.length - 1)) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
            <motion.span
              className="absolute top-0 left-0 h-px bg-ink"
              animate={{ width: `${(active / (ITEMS.length - 1)) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
          </div>

          <ul className="mt-4 max-w-[420px]">
            {ITEMS.map((it, i) => {
              const open = i === active;
              return (
                <li key={it.title} className="border-b border-line">
                  <button
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    className="flex w-full items-center gap-3 py-4 text-left text-[14px] font-medium"
                  >
                    <it.icon className={cn("size-4 transition-colors", open ? "text-ink" : "text-muted")} strokeWidth={1.75} />
                    {it.title}
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden pl-7 text-[13px] leading-relaxed text-muted"
                      >
                        <span className="block pb-4">{it.body}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>

          <ButtonLink href="/dashboard" className="mt-9">
            Open the Studio
          </ButtonLink>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative h-[540px] overflow-hidden rounded-3xl bg-gradient-to-b from-[#dfe9e2] via-[#b9d0b6] to-[#7fa679] md:h-[560px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.45 }}
                className="absolute inset-0"
              >
                {active === 0 && <ApprovalScene />}
                {active === 1 && <PersonalScene />}
                {active === 2 && <LanguageScene />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Bubble({ from, children, me = false }: { from: string; children: React.ReactNode; me?: boolean }) {
  return (
    <div className={cn("max-w-[86%] rounded-2xl px-3 py-2 text-[11.5px] leading-snug shadow-sm", me ? "ml-auto bg-forest text-white" : "bg-white/90 text-ink backdrop-blur")}>
      <p className={cn("mb-0.5 text-[10px] font-semibold", me ? "text-sage" : "text-leaf")}>{from}</p>
      {children}
    </div>
  );
}

function ApprovalScene() {
  return (
    <div className="flex h-full flex-col p-5 md:p-7">
      <div className="flex items-center gap-2.5 rounded-2xl bg-white/60 px-3.5 py-2.5 backdrop-blur">
        <span className="grid size-8 place-items-center rounded-full bg-[#2aa3df] text-white">
          <TelegramIcon className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-medium">Pushpam × 7P Approvals</p>
          <p className="text-[10px] text-muted">Client · Account manager · Brand Guard · Publisher</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2.5">
        <MiniCreative variant="carousel" className="h-[92px] w-[74px] shrink-0 rounded-lg" />
        <MiniCreative variant="reel" className="h-[92px] w-[52px] shrink-0 rounded-lg" />
        <MiniCreative variant="festive" className="hidden h-[92px] w-[74px] shrink-0 rounded-lg sm:block" />
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
        <Bubble from="Brand Guard">Diwali campaign ready. Checked RERA no., colours, banned words. Reply approve / change.</Bubble>
        <Bubble from="Mr. Kulkarni" me>
          change: slide 3 price should say “onwards”
        </Bubble>
        <Bubble from="Brand Guard">Updated slide 3. Approve?</Bubble>
        <Bubble from="Mr. Kulkarni" me>
          approve
        </Bubble>
        <Bubble from="Publisher">Scheduled · IG + FB Fri 7:30 PM · LinkedIn Sat 10 AM</Bubble>
      </div>
    </div>
  );
}

function PersonalScene() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-4 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-[#111a14] text-[12px] font-semibold text-lime">KP</span>
          <div className="flex-1 leading-tight">
            <p className="text-[13px] font-medium">Kamran Pathan</p>
            <p className="text-[10px] text-muted">Scheduled · Tue 10:00 AM</p>
          </div>
          <LinkedinIcon className="size-4 text-[#0a66c2]" />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink/85">
          We built Bolo Studio in 4 days for the Flip the Switch hackathon. Six AI agents, one shared room, and our
          clients approve on Telegram. Here&apos;s what I learned about agent roles 👇
        </p>
        <MiniCreative variant="personal" className="mt-3 aspect-[4/5] w-full rounded-xl" />
      </div>
    </div>
  );
}

function LanguageScene() {
  const caps = [
    ["MR + EN", "Is Diwali, tumchya navin gharat. Luxe 28 — 2 & 3 BHK, site visit this weekend."],
    ["मराठी", "या दिवाळीत, तुमच्या नव्या घरात. लक्स २८ — २ व ३ BHK, या आठवड्यात साइट व्हिजिट करा."],
    ["हिन्दी", "इस दिवाली, अपने नए घर में. लक्स 28 — 2 और 3 BHK, इस हफ्ते साइट विज़िट करें."],
    ["English", "This Diwali, in your new home. Luxe 28 — 2 & 3 BHK. Book a site visit this weekend."],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-6 md:p-8">
      <div className="flex items-center gap-2 text-[12px] font-medium text-forest">
        <Sparkles className="size-4" /> Copywriter · 4 caption variants
      </div>
      {caps.map(([lang, text], i) => (
        <motion.div
          key={lang}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 * i }}
          className="rounded-2xl bg-white/90 p-3.5 shadow-sm backdrop-blur"
        >
          <span className="rounded-md bg-mist px-1.5 py-0.5 text-[10px] font-semibold text-forest">{lang}</span>
          <p className="mt-1.5 text-[12.5px] leading-relaxed">{text}</p>
        </motion.div>
      ))}
    </div>
  );
}
