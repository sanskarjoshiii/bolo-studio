"use client";

// Speak the idea instead of typing it. Two ways, picked with a toggle (remembered on this computer):
//  · Wispr Flow — the desktop app types into any box while you hold its shortcut. A website can't
//    install or switch it on, so this mode explains the shortcut and links to the download.
//  · Browser mic — built-in speech recognition (Chrome / Edge), nothing to install.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Mic, MicOff, Sparkles } from "lucide-react";
import type { LanguageOption } from "@bolo/core";
import { cn } from "@/lib/cn";

type Way = "wispr" | "browser";
type Lang = "mr" | "hi" | "en";

const KEY = "bolo.voice";
const SPEECH_LANG: Record<Lang, string> = { mr: "mr-IN", hi: "hi-IN", en: "en-IN" };
const LANG_LABEL: Record<Lang, string> = { mr: "मराठी", hi: "हिंदी", en: "English" };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function read(): Way {
  try {
    return localStorage.getItem(KEY) === "browser" ? "browser" : "wispr";
  } catch {
    return "wispr";
  }
}

export function VoiceInput({
  languages,
  onText,
  focusBox,
}: {
  languages?: LanguageOption;
  /** Called with each finished phrase from the browser mic. */
  onText: (phrase: string) => void;
  /** Puts the cursor in the idea box (Wispr types wherever the cursor is). */
  focusBox: () => void;
}) {
  const [way, setWay] = useState<Way>("wispr");
  const [mac, setMac] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    setWay(read());
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    setSupported(!!recognitionClass());
  }, []);

  // Follow the post's first language until the person picks one.
  useEffect(() => {
    const first = (languages?.split("+")[0] ?? "en") as Lang;
    setLang(first);
  }, [languages]);

  useEffect(() => () => rec.current?.stop(), []);

  const choose = (w: Way) => {
    setWay(w);
    setProblem(null);
    if (w === "wispr") stop();
    try {
      localStorage.setItem(KEY, w);
    } catch {}
  };

  const stop = () => {
    rec.current?.stop();
    rec.current = null;
    setListening(false);
    setInterim("");
  };

  const start = () => {
    const R = recognitionClass();
    if (!R) return setProblem("This browser can't listen — use Chrome or Edge, or switch to Wispr Flow.");
    setProblem(null);
    const r = new R();
    r.lang = SPEECH_LANG[lang];
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onText(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setProblem("Microphone blocked — allow it in the address bar, then try again.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setProblem(`The mic stopped (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="mt-2.5 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] text-fog">
          <Mic className="size-3.5 text-lime" /> Speak it
        </span>
        <div role="radiogroup" aria-label="How to speak the idea" className="flex rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/[0.07]">
          {(
            [
              ["wispr", "Wispr Flow"],
              ["browser", "Browser mic"],
            ] as const
          ).map(([w, label]) => (
            <button
              key={w}
              role="radio"
              aria-checked={way === w}
              onClick={() => choose(w)}
              className={cn("rounded-md px-2.5 py-1 text-[12px] transition", way === w ? "bg-lime/15 text-lime" : "text-fog hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
        {way === "browser" && (
          <div className="flex gap-1">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  if (listening) stop();
                }}
                className={cn("rounded-md px-2 py-1 text-[12px] ring-1", lang === l ? "bg-white/[0.09] ring-lime/40" : "text-fog ring-white/[0.06] hover:text-white")}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        )}
      </div>

      {way === "wispr" ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] leading-relaxed text-white/75">
          <button onClick={focusBox} className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-white hover:bg-white/[0.11]">
            <Sparkles className="size-3.5 text-lime" /> Put the cursor in the box
          </button>
          <span>
            then hold <Kbd>{mac ? "fn" : "Ctrl"}</Kbd>
            {!mac && (
              <>
                {" "}+ <Kbd>Win</Kbd>
              </>
            )}{" "}
            and speak — Marathi, Hindi or English. Let go and the text appears.
          </span>
          <a href="https://wisprflow.ai" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-lime hover:underline">
            Don&apos;t have Wispr Flow? Get it free <ExternalLink className="size-3" />
          </a>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px]">
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-40",
              listening ? "bg-red-500/90 text-white" : "bg-lime text-night hover:brightness-95",
            )}
          >
            {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            {listening ? "Stop" : `Start speaking (${LANG_LABEL[lang]})`}
          </button>
          {listening && (
            <span className="flex items-center gap-1.5 text-fog">
              <span className="size-2 animate-pulse rounded-full bg-red-400" />
              {interim || "Listening…"}
            </span>
          )}
          {!supported && <span className="text-amber-200/90">This browser can&apos;t listen — use Chrome or Edge, or Wispr Flow.</span>}
        </div>
      )}
      {problem && <p className="mt-2 text-[11.5px] text-amber-200/90">{problem}</p>}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded bg-white/[0.09] px-1.5 py-0.5 font-mono text-[11px] text-white ring-1 ring-white/[0.1]">{children}</kbd>;
}
