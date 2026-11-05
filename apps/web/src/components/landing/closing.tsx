"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleHelp, Minus, Plus, Rocket } from "lucide-react";
import { Hills } from "./hills";
import { ButtonLink, Eyebrow } from "./primitives";
import { Reveal } from "@/components/ui/reveal";
import { Logo } from "@/components/ui/logo";
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from "@/components/ui/platform-icons";

const FAQ = [
  {
    q: "What is Bolo Studio used for?",
    a: "Turning a spoken content idea into finished, brand-checked posts and reels — then getting client approval on Telegram and scheduling them across Instagram, Facebook, LinkedIn and YouTube.",
  },
  {
    q: "Can I schedule posts in advance?",
    a: "Yes. After the client replies “approve”, the Publisher agent creates a scheduled post in Postiz at the best time from that client’s protocol.md, and posts the live link back when it goes out.",
  },
  {
    q: "Does my client need to learn a new tool?",
    a: "No. Clients stay in a Telegram group they already use. They only see final, checked drafts and reply with “approve” or “change: …” — voice notes work too.",
  },
  {
    q: "How do you stop brand or compliance mistakes?",
    a: "Each client has a Brand Kit (brand.md, rules.md, products.md, tokens.json). Brand Guard checks every draft against it — RERA number, price wording, banned claims, colours — before anything reaches the client.",
  },
  {
    q: "Can multiple team members and agents work together?",
    a: "Yes. Everyone shares a Switch room. Agents can run on different laptops; single-holder roles (Strategist, Brand Guard, Publisher) make sure work is never duplicated.",
  },
  {
    q: "Which platforms are supported?",
    a: "Instagram (posts, carousels, reels), Facebook Pages, LinkedIn and YouTube Shorts through Postiz’s official OAuth integrations. X and Threads are available too.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(1);

  return (
    <section id="faq" className="bg-paper px-5 py-20 md:py-28">
      <Reveal className="mx-auto max-w-[620px] text-center">
        <Eyebrow icon={CircleHelp} className="border-0 bg-transparent shadow-none">
          Quick Help Center
        </Eyebrow>
        <h2 className="mt-3 text-[38px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[50px]">
          Questions Agencies
          <br />
          <span className="em">Ask Before Switching</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[440px] text-[15px] leading-relaxed text-muted">
          How the agents, Brand Kits, approvals and publishing fit together.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-12 max-w-[620px] space-y-2.5">
        {FAQ.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="rounded-xl bg-white ring-1 ring-line/70">
              <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[14px]">
                {f.q}
                {isOpen ? <Minus className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-[13px] leading-relaxed text-muted">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}

export function Cta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-paper to-[#e7eee9] pt-20 md:pt-28">
      <Reveal className="relative z-10 mx-auto max-w-[640px] px-5 text-center">
        <Eyebrow icon={Rocket}>Speak Once</Eyebrow>
        <h2 className="mt-5 text-[40px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[56px]">
          Start Shipping Content
          <br />
          <span className="em">by Voice Today</span>
        </h2>
        <p className="mx-auto mt-5 max-w-[360px] text-[14px] leading-relaxed text-muted">
          From idea to a scheduled, client-approved post in about fifteen minutes of active work.
        </p>
        <ButtonLink href="/dashboard" className="mt-8">
          Open the Studio
        </ButtonLink>
      </Reveal>
      <div className="-mt-6 h-[220px] md:-mt-10 md:h-[320px]">
        <Hills tone="bright" fade />
      </div>
    </section>
  );
}

const COLS = [
  { title: "Product", links: ["Dashboard", "Agents", "Brand Kits", "Approvals", "Publishing"] },
  { title: "Resources", links: ["Setup Guide", "Architecture", "Brand Kit Template", "Build Blog"] },
  { title: "Hackathon", links: ["Flip the Switch", "Code with Wispr", "#HowISwitch", "GitHub Repo"] },
  { title: "Legal", links: ["Privacy Policy", "Terms", "Data & Security"] },
];

export function Footer() {
  return (
    <footer className="bg-paper px-5 pt-16 pb-8 md:pt-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="grid gap-10 md:grid-cols-2">
          <h3 className="text-[32px] leading-[1.1] font-medium tracking-[-0.03em] md:text-[38px]">
            Follow the Build of
            <br />
            <span className="em">Bolo Studio, Day by Day</span>
          </h3>
          <form className="md:justify-self-end" onSubmit={(e) => e.preventDefault()}>
            <p className="text-[15px] font-medium">Get the build log</p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                required
                placeholder="Enter your email"
                className="w-full min-w-0 rounded-lg bg-white px-4 py-2.5 text-[13px] ring-1 ring-line outline-none focus:ring-forest md:w-[280px]"
              />
              <button className="shrink-0 rounded-lg bg-forest px-5 py-2.5 text-[13px] font-medium text-white hover:bg-forest-2">Subscribe</button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              By subscribing you agree to our <span className="underline">Privacy Policy</span>.
            </p>
          </form>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-[260px] text-[12.5px] leading-relaxed text-muted">
              A voice-first content studio where AI agents and your team work in one Switch room.
            </p>
            <div className="mt-5 flex gap-2">
              {[InstagramIcon, FacebookIcon, LinkedinIcon, YoutubeIcon].map((I, k) => (
                <a key={k} href="#" aria-label="Social link" className="grid size-8 place-items-center rounded-full bg-white ring-1 ring-line hover:bg-mist">
                  <I className="size-3.5" />
                </a>
              ))}
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-[13px] font-medium">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-[12.5px] text-muted hover:text-ink">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 text-center text-[11.5px] text-muted">© 2026 Bolo Studio · Built for Flip the Switch by 7P Infomedia.</p>
      </div>
    </footer>
  );
}
