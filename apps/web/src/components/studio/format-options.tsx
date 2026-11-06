"use client";

import { useState } from "react";
import type { LanguageOption, PostFormat, Size } from "@bolo/core";
import { DEFAULT_SIZE, LANGUAGE_OPTIONS, SIZE_PRESETS } from "@bolo/core/shared";
import { cn } from "@/lib/cn";

const VIDEO: PostFormat[] = ["Reel", "Story"];

/** A tiny frame at the preset's real ratio. */
function Ratio({ w, h, on }: { w: number; h: number; on: boolean }) {
  const scale = 22 / Math.max(w, h);
  return (
    <span className="grid size-6 shrink-0 place-items-center">
      <span className={cn("rounded-[2px] border", on ? "border-lime bg-lime/20" : "border-white/40")} style={{ width: Math.max(6, w * scale), height: Math.max(6, h * scale) }} />
    </span>
  );
}

/**
 * Output size: 10 platform presets and Custom (width × height). `value` undefined means the
 * format's default size.
 */
export function SizePicker({ format, value, onChange, disabled }: { format: PostFormat; value: Size | undefined; onChange: (s: Size | undefined) => void; disabled?: boolean }) {
  const def = DEFAULT_SIZE[format];
  const current = value ?? def;
  const isCustom = current.preset === "custom" || !SIZE_PRESETS.some((p) => p.w === current.w && p.h === current.h);
  const [custom, setCustom] = useState({ w: String(current.w), h: String(current.h) });
  const [showCustom, setShowCustom] = useState(isCustom);
  const video = VIDEO.includes(format);

  const pick = (s: { w: number; h: number; preset: string }) => {
    setShowCustom(false);
    onChange(s.w === def.w && s.h === def.h ? undefined : { w: s.w, h: s.h, preset: s.preset });
  };
  const applyCustom = (next: { w: string; h: string }) => {
    setCustom(next);
    const w = Math.round(Number(next.w));
    const h = Math.round(Number(next.h));
    if (w >= 320 && h >= 320 && w <= 4096 && h <= 4096) onChange({ w, h, preset: "custom" });
  };
  const bad = showCustom && !(Number(custom.w) >= 320 && Number(custom.h) >= 320 && Number(custom.w) <= 4096 && Number(custom.h) <= 4096);

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
        {SIZE_PRESETS.map((p) => {
          const on = !showCustom && current.w === p.w && current.h === p.h;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => pick({ w: p.w, h: p.h, preset: p.id })}
              title={`${p.hint} · ${p.w} × ${p.h}`}
              className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-left ring-1 transition", on ? "bg-lime/10 ring-lime/50" : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06]")}
            >
              <Ratio w={p.w} h={p.h} on={on} />
              <span className="min-w-0">
                <span className={cn("block truncate text-[12px]", on ? "text-white" : "text-white/80")}>
                  {p.label}
                  {p.w === def.w && p.h === def.h && <span className="ml-1 text-[10px] text-fog">default</span>}
                </span>
                <span className="block text-[10.5px] text-fog tabular-nums">
                  {p.w} × {p.h}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true);
            applyCustom(custom);
          }}
          className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-left ring-1 transition", showCustom ? "bg-lime/10 ring-lime/50" : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06]")}
        >
          <span className="grid size-6 place-items-center text-[14px] text-fog">⇲</span>
          <span>
            <span className="block text-[12px] text-white/80">Custom</span>
            <span className="block text-[10.5px] text-fog">width × height</span>
          </span>
        </button>
      </div>
      {showCustom && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-fog">
            Width
            <input inputMode="numeric" value={custom.w} onChange={(e) => applyCustom({ ...custom, w: e.target.value.replace(/\D/g, "") })} className="w-20 rounded-lg bg-white/[0.05] px-2 py-1.5 text-[13px] text-white ring-1 ring-white/[0.08] outline-none focus:ring-lime/50" aria-label="Width in pixels" />
          </label>
          <span className="text-fog">×</span>
          <label className="flex items-center gap-1.5 text-[12px] text-fog">
            Height
            <input inputMode="numeric" value={custom.h} onChange={(e) => applyCustom({ ...custom, h: e.target.value.replace(/\D/g, "") })} className="w-20 rounded-lg bg-white/[0.05] px-2 py-1.5 text-[13px] text-white ring-1 ring-white/[0.08] outline-none focus:ring-lime/50" aria-label="Height in pixels" />
          </label>
          <span className="text-[11.5px] text-fog">px</span>
          <span className={cn("text-[11.5px]", bad ? "text-amber-200" : "text-fog")}>{bad ? "320–4096 px each" : video ? "videos round to even numbers" : ""}</span>
        </div>
      )}
    </fieldset>
  );
}

/** Marathi + English, Hindi + English, Hindi + Marathi, Marathi, Hindi, English — or the Brand Kit's usual. */
export function LanguagePicker({ value, onChange, disabled, allowAuto = true }: { value: LanguageOption | undefined; onChange: (v: LanguageOption | undefined) => void; disabled?: boolean; allowAuto?: boolean }) {
  const options = [...(allowAuto ? [{ id: undefined, label: "Brand Kit default" }] : []), ...LANGUAGE_OPTIONS.map((l) => ({ id: l.id as LanguageOption, label: l.label }))];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            type="button"
            key={o.label}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn("rounded-lg px-3 py-1.5 text-[12.5px] ring-1 transition disabled:opacity-50", on ? "bg-lime/15 text-lime ring-lime/40" : "bg-white/[0.03] text-white/80 ring-white/[0.08] hover:bg-white/[0.06]")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
