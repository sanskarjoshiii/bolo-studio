"use client";

import { motion } from "motion/react";
import { AtSign, CalendarClock, ChevronDown, Info, MessagesSquare, Mic, MoreVertical, Plus, Send, Smile, ToggleRight } from "lucide-react";
import { Hills } from "./hills";
import { ButtonLink, Eyebrow } from "./primitives";
import { Reveal } from "@/components/ui/reveal";
import { TelegramIcon } from "@/components/ui/platform-icons";

const STACK = [
  { name: "Switch", icon: ToggleRight },
  { name: "Mattermost", icon: MessagesSquare },
  { name: "Telegram", icon: TelegramIcon },
  { name: "Postiz", icon: CalendarClock },
  { name: "Wispr Flow", icon: Mic },
];

export function StackRow() {
  return (
    <section className="bg-paper px-5 pt-16 pb-6 md:pt-20">
      <Reveal className="mx-auto max-w-[1100px] text-center">
        <h2 className="text-[22px] font-medium tracking-[-0.02em] md:text-[26px]">Runs on an Open Stack Your Team Can Own</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3 md:gap-5">
          {STACK.map(({ name, icon: Icon }) => (
            <div
              key={name}
              className="flex items-center gap-2.5 rounded-xl bg-mist/80 px-5 py-3.5 text-[17px] font-semibold tracking-tight text-ink/75 md:px-7 md:py-4 md:text-[19px]"
            >
              <Icon className="size-5" strokeWidth={2.25} />
              {name}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function About() {
  return (
    <section id="how" className="relative overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 px-5 pt-20 pb-12 md:grid-cols-2 md:pt-28">
        <Reveal>
          <Eyebrow icon={Info}>About Bolo Studio</Eyebrow>
          <h2 className="mt-5 text-[38px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[48px]">
            Simplifying Content
            <br />
            <span className="em">Production for Agencies</span>
          </h2>
          <p className="mt-6 max-w-[400px] text-[15px] leading-relaxed text-muted">
            One spoken idea becomes captions, carousels and a reel, checked against each client&apos;s Brand Kit before
            anyone outside your team sees it.
          </p>

          <dl className="mt-9 flex divide-x divide-line">
            {[
              ["~15 min", "Idea to scheduled"],
              ["6", "AI agents per room"],
              ["3", "Languages: MR · HI · EN"],
            ].map(([v, l]) => (
              <div key={l} className="px-6 first:pl-0">
                <dt className="text-[24px] font-medium tracking-tight">{v}</dt>
                <dd className="mt-1.5 text-[12px] text-muted">{l}</dd>
              </div>
            ))}
          </dl>

          <ButtonLink href="#features" className="mt-10">
            Explore Features
          </ButtonLink>
        </Reveal>

        <Reveal delay={0.15} className="relative md:pl-10">
          <RoomCard />
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute top-[38%] -left-2 hidden w-[190px] rounded-xl border border-line bg-white p-2.5 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.35)] lg:-left-16 lg:block"
          >
            {[
              ["Copywriter", "3 captions ready", true],
              ["Visual Designer", "Rendering 5 slides", false],
              ["Reel Producer", "Voiceover · 20s", false],
            ].map(([name, status, done]) => (
              <div key={name as string} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
                <span className="grid size-6 place-items-center rounded-full bg-mist text-[9px] font-semibold text-forest">
                  {(name as string).split(" ").map((w) => w[0]).join("")}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[11px] font-medium">{name}</p>
                  <p className="truncate text-[9px] text-muted">{status}</p>
                </div>
                <span className={`size-1.5 rounded-full ${done ? "bg-leaf" : "animate-pulse bg-sage"}`} />
              </div>
            ))}
          </motion.div>
        </Reveal>
      </div>

      <div className="h-[110px] md:h-[150px]">
        <Hills tone="bright" />
      </div>
    </section>
  );
}

function RoomCard() {
  return (
    <div className="ml-auto max-w-[420px] rounded-2xl border border-line bg-white p-5 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-pushpam font-brand text-[13px] text-pushpam-gold">P</span>
          <p className="flex items-center gap-1 text-[14px] font-medium">
            #pushpam-work <ChevronDown className="size-3.5 text-muted" />
          </p>
        </div>
        <MoreVertical className="size-4 text-muted" />
      </div>

      <div className="mt-4 flex gap-5 border-b border-line text-[11px] text-muted">
        <span className="border-b-2 border-ink pb-2 font-medium text-ink">Thread</span>
        <span>Brand Kit</span>
        <span>Files</span>
      </div>

      <div className="space-y-4 pt-4 text-left">
        <div className="flex gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mist text-[10px] font-semibold">AK</span>
          <div>
            <p className="text-[11px] font-medium">
              Akshay <span className="font-normal text-muted">· via Wispr</span>
            </p>
            <p className="mt-1 text-[12px] leading-snug text-ink/80">
              Diwali campaign for Luxe 28, family feel, one carousel and one reel, Marathi plus English, post Friday evening.
            </p>
          </div>
        </div>

        <div className="flex flex-row-reverse gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-forest text-white">
            <AtSign className="size-3.5" />
          </span>
          <div className="text-right">
            <p className="text-[11px] font-medium">Strategist</p>
            <div className="mt-1 rounded-xl bg-mist/70 px-3 py-2 text-left text-[11px] leading-relaxed text-ink/80">
              Brief: Carousel (5 slides) + Reel (20s) · IG / FB / LinkedIn · Fri 6 Nov, 7:30 PM.
              <br />
              <span className="text-forest">@Copywriter @Visual-Designer @Reel-Producer</span> go.
            </div>
            <p className="mt-1 text-[9px] text-muted">2 min</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
        <Plus className="size-4 text-muted" />
        <span className="flex-1 text-[12px] text-muted">Speak or type an idea…</span>
        <Smile className="size-4 text-muted" />
        <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
          <Send className="size-4" />
        </span>
      </div>
    </div>
  );
}
