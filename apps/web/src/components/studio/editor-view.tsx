"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, Loader2, Mic, Plus, RotateCw, Save, ShieldCheck, Trash2, Wrench } from "lucide-react";
import type { Caption, Client, Platform, Post, PostFormat, ReelScript, Slide } from "@bolo/core";
import { FORMAT_INFO, FORMATS, formatSlot, istIso, istParts, postRef } from "@bolo/core/shared";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";
import { PhonePreview } from "./phone-preview";
import { ClientReply, MarkLive, MediaSection, ResendButton } from "./post-drawer";
import { platformIcon, platformLabel, TelegramIcon } from "@/components/ui/platform-icons";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/cn";

const VOICE_LANGS = [
  ["mr-IN", "Marathi"],
  ["hi-IN", "Hindi"],
  ["en-IN", "English (India)"],
  ["gu-IN", "Gujarati"],
  ["ta-IN", "Tamil"],
  ["te-IN", "Telugu"],
  ["kn-IN", "Kannada"],
  ["bn-IN", "Bengali"],
] as const;
const SPEAKERS = ["priya", "ritu", "neha", "kavya", "shreya", "shubh", "rahul", "aditya", "rohan", "amit"];

const STEPS = ["Idea", "Content", "Media", "Brand Guard", "Client approval", "Scheduled", "Live"] as const;

function stepOf(post: Post) {
  if (post.status === "live") return 6;
  if (post.status === "scheduled") return 5;
  if (post.status === "awaiting") return 4;
  if (post.status === "brand-check") return 3;
  if ((post.media ?? []).length) return 3;
  if (post.captions.length || post.creativeText) return 2;
  return 1;
}

const toLocal = (iso: string) => {
  const p = istParts(iso);
  return `${p.dateKey}T${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};

const input =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50";

export function EditorView({ client, post, drive }: { client: Client; post: Post; drive: { connected: boolean; folderUrl: string | null } }) {
  const editable = post.status === "draft" || post.status === "brand-check" || post.status === "awaiting";
  const save = useAction();
  const submit = useAction();

  const [title, setTitle] = useState(post.title);
  const [format, setFormat] = useState<PostFormat>(post.format);
  const [platforms, setPlatforms] = useState<Platform[]>(post.platforms);
  const [when, setWhen] = useState(toLocal(post.scheduledAt));
  const [tag, setTag] = useState(post.tag.replace(/^#/, ""));
  const [brief, setBrief] = useState(post.brief ?? "");
  const [creativeText, setCreativeText] = useState(post.creativeText);
  const [captions, setCaptions] = useState<Caption[]>(post.captions.length ? post.captions : [{ lang: "EN", text: "" }]);
  const [lang, setLang] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(post.slides?.length ? post.slides : [{ headline: post.title }]);
  const [reel, setReelState] = useState<ReelScript>(post.reel ?? { voiceLang: "mr-IN", speaker: "priya", scenes: [{ text: post.title, voice: "" }], cta: "" });
  // The starter scene list isn't a script until someone edits it — don't save or flag it as a change
  const [reelTouched, setReelTouched] = useState(Boolean(post.reel));
  const setReel = (r: ReelScript) => {
    setReelState(r);
    setReelTouched(true);
  };

  const allowed = useMemo(
    () => client.channels.map((c) => c.platform).filter((p) => (FORMAT_INFO[format].platforms as readonly string[]).includes(p)),
    [client, format],
  );
  const isVideo = format === "Reel" || format === "Story";

  const patch = () => {
    const [d, t] = when.split("T");
    const [hh, mm] = t.split(":").map(Number);
    const usedReel = isVideo && reelTouched && reel.scenes.some((s) => s.text.trim());
    return {
      title,
      format,
      platforms: platforms.filter((p) => allowed.includes(p)),
      scheduledAt: istIso(d, hh * 60 + mm),
      tag,
      brief,
      creativeText,
      captions: captions.filter((c) => c.text.trim()),
      ...(format === "Carousel" ? { slides: slides.filter((s) => s.headline.trim()) } : {}),
      ...(usedReel ? { reel: { ...reel, scenes: reel.scenes.filter((s) => s.text.trim()) } } : {}),
    };
  };

  const original = JSON.stringify({
    title: post.title,
    format: post.format,
    platforms: post.platforms,
    scheduledAt: post.scheduledAt,
    tag: post.tag.replace(/^#/, ""),
    brief: post.brief ?? "",
    creativeText: post.creativeText,
    captions: post.captions,
    slides: post.format === "Carousel" ? (post.slides ?? []) : undefined,
    reel: post.reel,
  });
  const current = patch();
  const dirty =
    JSON.stringify({ ...current, slides: format === "Carousel" ? current.slides : undefined, reel: "reel" in current ? current.reel : post.reel }) !== original;

  const doSave = () => save.run(() => api(`/api/posts/${post.id}`, "PATCH", patch()));
  const preview = { ...post, title, creativeText, format, slides: format === "Carousel" ? slides : post.slides, captions: captions.filter((c) => c.text.trim()) };
  const failing = post.checks.filter((c) => !c.ok);
  const s = STATUS_META[post.status];
  const step = stepOf(post);

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      {/* header */}
      <div className="sticky top-0 z-20 border-b border-white/[0.05] bg-[#0b1b14]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/studio/${client.id}`} className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white" aria-label="Back to calendar">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[11.5px]">
              <span className={cn("inline-flex items-center gap-1.5", s.text)}>
                <span className={cn("size-1.5 rounded-full", s.dot)} />
                {s.label}
              </span>
              <span className="font-mono text-fog">{postRef(post)}</span>
              {post.dryRun && post.status !== "draft" && <span className="rounded bg-white/10 px-1 text-[10px] text-fog">dry run</span>}
            </p>
            <h1 className="truncate text-[17px] font-medium tracking-tight">{post.title}</h1>
          </div>
          {editable && (
            <button
              onClick={doSave}
              disabled={!dirty || save.pending}
              className="flex items-center gap-2 rounded-lg bg-white/[0.1] px-4 py-2 text-[13px] font-medium hover:bg-white/[0.15] disabled:opacity-40"
            >
              {save.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {dirty ? "Save changes" : "Saved"}
            </button>
          )}
        </div>
        <ol className="no-scrollbar mt-3 flex gap-1 overflow-x-auto">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]",
                i < step ? "bg-lime/10 text-lime" : i === step ? "bg-white/[0.09] text-white" : "text-fog",
              )}
            >
              {i < step ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {label}
            </li>
          ))}
        </ol>
        <ErrorNote error={save.error} onClose={save.clearError} />
      </div>

      <div className="grid gap-8 p-6 xl:grid-cols-[1fr_340px]">
        {/* ---------- content ---------- */}
        <fieldset disabled={!editable} className="min-w-0 space-y-6 disabled:opacity-70">
          {!editable && (
            <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-fog">
              {post.status === "live" ? "Published — read only." : "Scheduled in Postiz — read only. Change it in Postiz if needed."}
            </p>
          )}

          <Card title="Basics">
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <Field label="Headline — printed big on the creative">
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={input} />
              </Field>
              <Field label="Format">
                <select
                  value={format}
                  onChange={(e) => {
                    const f = e.target.value as PostFormat;
                    setFormat(f);
                    const ok = client.channels.map((c) => c.platform).filter((p) => (FORMAT_INFO[f].platforms as readonly string[]).includes(p));
                    setPlatforms((cur) => (cur.filter((p) => ok.includes(p)).length ? cur.filter((p) => ok.includes(p)) : ok));
                  }}
                  className={cn(input, "[color-scheme:dark]")}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f} · {FORMAT_INFO[f].ratio}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {allowed.map((p) => {
                const Icon = platformIcon[p];
                const on = platforms.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                    className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] ring-1", on ? "bg-white/[0.09] ring-lime/50" : "text-fog ring-white/[0.07]")}
                  >
                    <Icon className="size-3.5" /> {platformLabel[p]}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Post time (IST)">
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cn(input, "[color-scheme:dark]")} />
              </Field>
              <Field label="Tag">
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="diwali" className={input} />
              </Field>
            </div>
          </Card>

          <Card title="Brief" hint="Goal · audience · angle — written by bolo-writer or you">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className={cn(input, "resize-y leading-relaxed")} />
          </Card>

          <Card title={format === "Story" ? "Text on the story" : "Text on the creative"} hint={format === "Story" ? "Stories have no caption — the message, CTA and RERA no. go here" : "Product · offer · price onwards* — the RERA no. is added by Brand Guard"}>
            <input value={creativeText} onChange={(e) => setCreativeText(e.target.value)} placeholder="Luxe 28 · 2 & 3 BHK · ₹78 L onwards*" className={input} />
          </Card>

          {format === "Carousel" && (
            <Card title={`Slides (${slides.length}/10)`} hint="Slide 1 is the cover">
              <ol className="space-y-2">
                {slides.map((sl, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-white/[0.03] p-2 ring-1 ring-white/[0.06]">
                    <span className="mt-2 w-5 shrink-0 text-center text-[12px] text-fog tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input value={sl.headline} onChange={(e) => setSlides((c) => c.map((x, k) => (k === i ? { ...x, headline: e.target.value } : x)))} placeholder="Slide headline" className={input} />
                      <input value={sl.text ?? ""} onChange={(e) => setSlides((c) => c.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} placeholder="Supporting line (optional)" className={input} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => setSlides((c) => swap(c, i, i - 1))} icon={ArrowUp} />
                      <IconBtn label="Move down" disabled={i === slides.length - 1} onClick={() => setSlides((c) => swap(c, i, i + 1))} icon={ArrowDown} />
                      <IconBtn label="Remove slide" disabled={slides.length === 1} onClick={() => setSlides((c) => c.filter((_, k) => k !== i))} icon={Trash2} />
                    </div>
                  </li>
                ))}
              </ol>
              {slides.length < 10 && <AddBtn onClick={() => setSlides((c) => [...c, { headline: "" }])}>Add slide</AddBtn>}
            </Card>
          )}

          {isVideo && (
            <Card title={format === "Story" ? "Story video — scenes (optional)" : "Reel scenes"} hint="Big on-screen line + what the voice says (shown as the subtitle)">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Voice language">
                  <select value={reel.voiceLang ?? "en-IN"} onChange={(e) => setReel({ ...reel, voiceLang: e.target.value })} className={cn(input, "[color-scheme:dark]")}>
                    {VOICE_LANGS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Voice">
                  <select value={reel.speaker ?? "priya"} onChange={(e) => setReel({ ...reel, speaker: e.target.value })} className={cn(input, "capitalize [color-scheme:dark]")}>
                    {SPEAKERS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="End-card CTA">
                  <input value={reel.cta ?? ""} onChange={(e) => setReel({ ...reel, cta: e.target.value })} placeholder="Book a site visit" className={input} />
                </Field>
              </div>
              <ol className="mt-3 space-y-2">
                {reel.scenes.map((sc, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-white/[0.03] p-2 ring-1 ring-white/[0.06]">
                    <span className="mt-2 w-5 shrink-0 text-center text-[12px] text-fog tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input value={sc.text} onChange={(e) => setReel({ ...reel, scenes: reel.scenes.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} placeholder={i === 0 ? "Hook — first 2 seconds" : "On-screen line"} className={input} />
                      <input value={sc.voice ?? ""} onChange={(e) => setReel({ ...reel, scenes: reel.scenes.map((x, k) => (k === i ? { ...x, voice: e.target.value } : x)) })} placeholder="Voice line (subtitle) — dictate with Wispr" className={input} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => setReel({ ...reel, scenes: swap(reel.scenes, i, i - 1) })} icon={ArrowUp} />
                      <IconBtn label="Move down" disabled={i === reel.scenes.length - 1} onClick={() => setReel({ ...reel, scenes: swap(reel.scenes, i, i + 1) })} icon={ArrowDown} />
                      <IconBtn label="Remove scene" disabled={reel.scenes.length === 1} onClick={() => setReel({ ...reel, scenes: reel.scenes.filter((_, k) => k !== i) })} icon={Trash2} />
                    </div>
                  </li>
                ))}
              </ol>
              {reel.scenes.length < 8 && <AddBtn onClick={() => setReel({ ...reel, scenes: [...reel.scenes, { text: "", voice: "" }] })}>Add scene</AddBtn>}
            </Card>
          )}

          <Card title={format === "Story" ? "Caption (optional — stories don't show one)" : "Captions"} hint="One per language · hook, body, CTA, hashtags">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {captions.map((c, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLang(i)}
                  className={cn("rounded-md px-2.5 py-1 text-[12px]", i === lang ? "bg-white/[0.1] text-white" : "text-fog hover:text-white")}
                >
                  {c.lang || "?"}
                </button>
              ))}
              <AddBtn inline onClick={() => { setCaptions((c) => [...c, { lang: "मराठी", text: "" }]); setLang(captions.length); }}>Language</AddBtn>
            </div>
            {captions[lang] && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={captions[lang].lang}
                    onChange={(e) => setCaptions((c) => c.map((x, k) => (k === lang ? { ...x, lang: e.target.value } : x)))}
                    aria-label="Language name"
                    className={cn(input, "w-32")}
                  />
                  {captions.length > 1 && (
                    <button type="button" onClick={() => { setCaptions((c) => c.filter((_, k) => k !== lang)); setLang(0); }} className="text-[12px] text-fog hover:text-red-300">
                      Remove language
                    </button>
                  )}
                </div>
                <textarea
                  value={captions[lang].text}
                  onChange={(e) => setCaptions((c) => c.map((x, k) => (k === lang ? { ...x, text: e.target.value } : x)))}
                  rows={6}
                  placeholder="Hook, body, CTA, hashtags — dictate with Wispr Flow"
                  className={cn(input, "resize-y leading-relaxed")}
                />
                <p className="flex items-center gap-1.5 text-[11.5px] text-fog">
                  <Mic className="size-3 text-lime" /> {captions[lang].text.length} characters · Wispr Flow works in every box here
                </p>
              </div>
            )}
          </Card>
        </fieldset>

        {/* ---------- preview + actions ---------- */}
        <aside className="space-y-5 xl:sticky xl:top-[112px] xl:self-start">
          <PhonePreview post={preview} client={client} />

          <div className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
            {dirty && editable && <p className="mb-2 text-[11.5px] text-amber-200/90">Save your changes before generating media — renders use the saved text.</p>}
            <MediaSection post={post} editable={editable} drive={drive} />
          </div>

          {/* Brand Guard + send */}
          <div className="space-y-3 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Brand Guard</p>
              {post.checks.length > 0 && (
                <span className={cn("text-[11.5px]", failing.length ? "text-amber-200" : "text-emerald-300")}>
                  {post.checks.length - failing.length}/{post.checks.length} passed
                </span>
              )}
            </div>
            {post.checks.length > 0 && (
              <ul className="divide-y divide-white/[0.05] rounded-lg bg-white/[0.03]">
                {post.checks.map((c) => (
                  <li key={c.id} className="px-3 py-2 text-[12px]">
                    <p className="flex items-center gap-2 text-white/85">
                      {c.ok ? <Check className="size-3.5 shrink-0 text-emerald-300" /> : <AlertCircle className="size-3.5 shrink-0 text-amber-300" />}
                      {c.label}
                    </p>
                    {c.fixed && (
                      <p className="mt-1 flex items-start gap-1.5 pl-5.5 text-[11px] text-fog">
                        <Wrench className="mt-0.5 size-3 shrink-0" /> {c.fixed}
                      </p>
                    )}
                    {c.detail && !c.ok && <p className="mt-1 pl-5.5 text-[11px] text-amber-200/80">{c.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
            <ErrorNote error={submit.error} onClose={submit.clearError} />
            {(post.status === "draft" || post.status === "brand-check") && (
              <button
                onClick={() => submit.run(() => api(`/api/posts/${post.id}/submit`, "POST"))}
                disabled={submit.pending || dirty}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2.5 text-[13px] font-medium text-night hover:brightness-95 disabled:opacity-40"
              >
                {submit.pending ? <Loader2 className="size-4 animate-spin" /> : post.status === "brand-check" ? <RotateCw className="size-4" /> : <ShieldCheck className="size-4" />}
                {dirty ? "Save first" : "Check & send to client on Telegram"}
              </button>
            )}
            {post.status === "awaiting" && (
              <>
                <p className="flex items-start gap-2 rounded-lg bg-amber-300/10 px-3 py-2 text-[12px] text-amber-100">
                  <TelegramIcon className="mt-0.5 size-3.5 shrink-0 text-[#5eb5e8]" />
                  Waiting in {client.rooms.approvals} — the client replies <span className="font-mono">approve {postRef(post)}</span>
                </p>
                <ResendButton post={post} client={client} />
                <ClientReply post={post} client={client} />
              </>
            )}
            {post.status === "scheduled" && post.dryRun && <MarkLive post={post} />}
            {post.status === "scheduled" && !post.dryRun && <p className="text-[12px] text-fog">Queued in Postiz · goes live {formatSlot(post.scheduledAt)} IST</p>}
            {post.status === "live" && post.permalink && (
              <a href={post.permalink} target="_blank" rel="noreferrer" className="block rounded-lg bg-white/[0.08] py-2.5 text-center text-[13px] hover:bg-white/[0.12]">
                View live post
              </a>
            )}
          </div>

          {/* activity */}
          <div className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
            <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Activity</p>
            <ul className="mt-2 space-y-2">
              {[...post.thread].reverse().map((m, i) => (
                <li key={i} className={cn("rounded-lg px-3 py-2 text-[12px] leading-snug", m.client ? "bg-lime/10" : "bg-white/[0.04]")}>
                  <p className="mb-0.5 flex justify-between gap-2 text-[10.5px] text-fog">
                    <span className={m.client ? "text-lime/90" : ""}>{m.from}</span>
                    <span>{formatSlot(m.at)}</span>
                  </p>
                  <span className="whitespace-pre-line text-white/85">{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function swap<T>(arr: T[], a: number, b: number) {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
      <h2 className="mb-3 text-[13.5px] font-medium">
        {title} {hint && <span className="ml-1 text-[11.5px] font-normal text-fog">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] text-fog">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ label, onClick, disabled, icon: Icon }: { label: string; onClick: () => void; disabled?: boolean; icon: typeof Trash2 }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-7 place-items-center rounded-md text-fog hover:bg-white/[0.08] hover:text-white disabled:opacity-25">
      <Icon className="size-3.5" />
    </button>
  );
}

function AddBtn({ onClick, children, inline }: { onClick: () => void; children: React.ReactNode; inline?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-1 text-[12px] text-lime hover:underline", !inline && "mt-2")}>
      <Plus className="size-3.5" /> {children}
    </button>
  );
}

