"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Film,
  HardDrive,
  ImageIcon,
  Info,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  RotateCw,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { Caption, Client, Media, Post } from "@bolo/core";
import { formatSlot, istIso, istParts, postRef } from "@bolo/core/shared";
import { api, useAction } from "./hooks";
import { useApproverFor } from "./me";
import { DrivePicker } from "./drive-picker";
import { ErrorNote } from "./controls";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";
import { platformIcon, platformLabel, TelegramIcon } from "@/components/ui/platform-icons";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/cn";

const EDITABLE = new Set(["draft", "brand-check", "awaiting"]);

export function PostDrawer({ post, client, onClose }: { post: Post; client: Client; onClose: () => void }) {
  const { run, pending, error, clearError } = useAction();
  const [lang, setLang] = useState(0);
  const [editing, setEditing] = useState(post.status === "draft" && post.captions.length === 0);

  const s = STATUS_META[post.status];
  const failing = post.checks.filter((c) => !c.ok).length;
  const caption = post.captions[Math.min(lang, post.captions.length - 1)];
  const canEdit = EDITABLE.has(post.status);
  // Older drafts carry a note implying an agent was working; no agent fills drafts until one is set up in Switch
  const note = post.note?.startsWith("Strategist is turning") ? "New idea — add captions and media, then run Brand Guard" : post.note;

  const submit = () => run(() => api(`/api/posts/${post.id}/submit`, "POST"));
  const remove = () => {
    if (confirm(`Delete “${post.title}”?`)) run(() => api(`/api/posts/${post.id}`, "DELETE")).then((r) => r && onClose());
  };

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="thin-scrollbar absolute top-0 right-0 bottom-0 z-30 flex w-full max-w-[420px] flex-col overflow-y-auto rounded-2xl bg-[#0f2219]/95 ring-1 ring-white/[0.08] backdrop-blur-xl"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#0f2219]/95 p-4 backdrop-blur-xl">
        <div className="min-w-0">
          <span className={cn("inline-flex items-center gap-1.5 text-[11px]", s.text)}>
            <span className={cn("size-1.5 rounded-full", s.dot)} />
            {s.label}
            {post.dryRun && post.status !== "draft" && <span className="rounded bg-white/10 px-1 text-[9.5px] text-fog">dry run</span>}
          </span>
          <h2 className="mt-1 truncate text-[16px] font-medium text-white">{post.title}</h2>
          <p className="text-[11.5px] text-fog">
            {post.format} · {formatSlot(post.scheduledAt)} IST
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Link
            href={`/studio/${client.id}/post/${post.id}`}
            className="flex h-8 items-center gap-1 rounded-lg bg-white/[0.07] px-2.5 text-[12px] text-white hover:bg-white/[0.12]"
          >
            <Maximize2 className="size-3.5" /> Open editor
          </Link>
          {(post.status === "draft" || post.status === "brand-check") && (
            <button onClick={remove} aria-label="Delete post" className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-red-300">
              <Trash2 className="size-4" />
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-fog hover:bg-white/[0.06] hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="space-y-5 px-4 pb-4">
        {post.media?.[0] ? (
          <MediaView post={post} media={post.media[0]} className={cn("mx-auto rounded-xl", post.format === "Reel" ? "w-[58%]" : "w-full")} />
        ) : (
          <MiniCreative
            variant={toVariant(post.creative)} content={contentFromPost(post, client.short)}
            className={cn("mx-auto rounded-xl", post.format === "Reel" ? "aspect-[9/16] w-[58%]" : "aspect-[4/5] w-full", post.status === "draft" && "opacity-60")}
          />
        )}

        <MediaSection post={post} editable={canEdit} />

        {note && (
          <p className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-white/80">
            {post.status === "draft" ? <Info className="size-3.5 shrink-0 text-lime" /> : <AlertCircle className="size-3.5 shrink-0 text-sky-300" />}
            {note}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {post.platforms.map((p) => {
            const I = platformIcon[p];
            return (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-white/80">
                <I className="size-3" /> {platformLabel[p]}
              </span>
            );
          })}
        </div>

        {post.brief && (
          <section>
            <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Brief</p>
            <p className="mt-2 rounded-lg bg-white/[0.04] p-3 text-[12px] leading-relaxed whitespace-pre-line text-white/80">{post.brief}</p>
          </section>
        )}

        {editing ? (
          <ContentEditor post={post} onDone={() => setEditing(false)} />
        ) : (
          <section>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Caption</p>
              <div className="flex items-center gap-1">
                {post.captions.map((c, i) => (
                  <button
                    key={c.lang + i}
                    onClick={() => setLang(i)}
                    className={cn("rounded-md px-2 py-0.5 text-[10.5px]", i === lang ? "bg-white/[0.1] text-white" : "text-fog hover:text-white")}
                  >
                    {c.lang}
                  </button>
                ))}
                {canEdit && (
                  <button onClick={() => setEditing(true)} aria-label="Edit content" className="ml-1 grid size-6 place-items-center rounded-md text-fog hover:bg-white/[0.08] hover:text-white">
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            </div>
            {caption ? (
              <p className="mt-2 rounded-lg bg-white/[0.04] p-3 text-[12.5px] leading-relaxed whitespace-pre-line text-white/85">{caption.text}</p>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-white/10 p-3 text-[12px] text-fog">No caption yet.</p>
            )}
            {post.creativeText && (
              <p className="mt-2 text-[11px] text-fog">
                On creative: <span className="text-white/75">{post.creativeText.replace(/\n/g, " · ")}</span>
              </p>
            )}
          </section>
        )}

        {post.checks.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Brand Guard</p>
              <span className={cn("text-[11px]", failing ? "text-amber-200" : "text-emerald-300")}>
                {post.checks.length - failing}/{post.checks.length} passed
              </span>
            </div>
            <ul className="mt-2 divide-y divide-white/[0.05] rounded-lg bg-white/[0.04]">
              {post.checks.map((c) => (
                <li key={c.id} className="px-3 py-2">
                  <p className="flex items-center gap-2 text-[12px] text-white/85">
                    {c.ok ? <Check className="size-3.5 shrink-0 text-emerald-300" /> : <AlertCircle className="size-3.5 shrink-0 text-amber-300" />}
                    {c.label}
                  </p>
                  {c.fixed && (
                    <p className="mt-1 flex items-start gap-1.5 pl-5.5 text-[11px] text-fog">
                      <Wrench className="mt-0.5 size-3 shrink-0" /> Auto-fixed: {c.fixed}
                    </p>
                  )}
                  {c.detail && !c.ok && <p className="mt-1 pl-5.5 text-[11px] text-amber-200/80">{c.detail}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {post.thread.length > 0 && (
          <section>
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-fog uppercase">
              <TelegramIcon className="size-3 text-[#5eb5e8]" /> {client.rooms.approvals}
            </p>
            <ul className="mt-2 space-y-2">
              {post.thread.map((m, i) => (
                <li
                  key={i}
                  className={cn("rounded-lg px-3 py-2 text-[12px] leading-snug", m.client ? "ml-8 bg-lime/10 text-white" : "mr-8 bg-white/[0.05] text-white/85")}
                >
                  <p className="mb-0.5 flex justify-between gap-2 text-[10.5px] text-fog">
                    <span className={m.client ? "text-lime/90" : ""}>{m.from}</span>
                    <span>{formatSlot(m.at)}</span>
                  </p>
                  {m.text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 mt-auto space-y-2 border-t border-white/[0.06] bg-[#0f2219]/95 p-4 backdrop-blur-xl">
        <ErrorNote error={error} onClose={clearError} />

        {(post.status === "draft" || post.status === "brand-check") && !editing && (
          <button
            onClick={submit}
            disabled={pending || post.captions.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2.5 text-[13px] font-medium text-night hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : post.status === "brand-check" ? <RotateCw className="size-4" /> : <ShieldCheck className="size-4" />}
            {post.captions.length === 0 ? "Add a caption to run Brand Guard" : post.status === "brand-check" ? "Re-run Brand Guard" : "Run Brand Guard & send to client"}
          </button>
        )}

        {post.status === "awaiting" && <ResendButton post={post} client={client} />}
        {post.status === "awaiting" && <ClientReply post={post} client={client} />}

        {post.status === "scheduled" && post.dryRun && <MarkLive post={post} />}
        {post.status === "scheduled" && !post.dryRun && (
          <p className="text-center text-[12px] text-fog">Queued in Postiz · goes live {formatSlot(post.scheduledAt)}</p>
        )}

        {post.status === "live" &&
          (post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.08] py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.12]"
            >
              <ExternalLink className="size-4" /> View live post
            </a>
          ) : (
            <p className="text-center text-[12px] text-fog">Live — no link reported.</p>
          ))}
      </footer>
    </motion.aside>
  );
}

function ContentEditor({ post, onDone }: { post: Post; onDone: () => void }) {
  const { run, pending, error, clearError } = useAction();
  const [captions, setCaptions] = useState<Caption[]>(post.captions.length ? post.captions : [{ lang: "EN", text: "" }]);
  const [creativeText, setCreativeText] = useState(post.creativeText);
  const [title, setTitle] = useState(post.title);
  const [format, setFormat] = useState(post.format);
  const p = istParts(post.scheduledAt);
  const [when, setWhen] = useState(`${p.dateKey}T${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`);

  const save = async () => {
    const [d, t] = when.split("T");
    const [hh, mm] = t.split(":").map(Number);
    const r = await run(() => api(`/api/posts/${post.id}`, "PATCH", { title, format, captions, creativeText, scheduledAt: istIso(d, hh * 60 + mm) }));
    if (r) onDone();
  };

  const setCap = (i: number, patch: Partial<Caption>) => setCaptions((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  return (
    <section className="space-y-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
      <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Edit content</p>

      <div className="flex gap-2">
        <label className="block min-w-0 flex-1">
          <span className="text-[11px] text-fog">Headline (printed on the creative)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="mt-1 w-full rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12.5px] text-white ring-1 ring-white/[0.08] outline-none focus:ring-lime/50"
          />
        </label>
        <label className="block w-[108px] shrink-0">
          <span className="text-[11px] text-fog">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Post["format"])}
            className="mt-1 w-full rounded-lg bg-white/[0.05] px-2 py-2 text-[12.5px] text-white [color-scheme:dark] ring-1 ring-white/[0.08] outline-none"
          >
            <option value="Post">Post</option>
            <option value="Carousel">Carousel</option>
            <option value="Reel">Reel</option>
          </select>
        </label>
      </div>

      {captions.map((c, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              value={c.lang}
              onChange={(e) => setCap(i, { lang: e.target.value })}
              aria-label="Language"
              className="w-24 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-lime/50"
            />
            {captions.length > 1 && (
              <button onClick={() => setCaptions((cs) => cs.filter((_, k) => k !== i))} className="text-[11px] text-fog hover:text-red-300">
                Remove
              </button>
            )}
          </div>
          <textarea
            value={c.text}
            onChange={(e) => setCap(i, { text: e.target.value })}
            rows={4}
            placeholder="Caption — hook, body, CTA, hashtags"
            className="w-full resize-y rounded-lg bg-white/[0.05] p-2.5 text-[12.5px] leading-relaxed text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50"
          />
        </div>
      ))}
      <button onClick={() => setCaptions((cs) => [...cs, { lang: "मराठी", text: "" }])} className="flex items-center gap-1 text-[11.5px] text-lime hover:underline">
        <Plus className="size-3" /> Add language
      </button>

      <label className="block">
        <span className="text-[11px] text-fog">Text on the creative</span>
        <input
          value={creativeText}
          onChange={(e) => setCreativeText(e.target.value)}
          placeholder="e.g. Luxe 28 · Diwali at home · ₹78 L onwards*"
          className="mt-1 w-full rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50"
        />
      </label>

      <label className="block">
        <span className="text-[11px] text-fog">Post time (IST)</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 w-full rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12px] text-white [color-scheme:dark] ring-1 ring-white/[0.08] outline-none focus:ring-lime/50"
        />
      </label>

      <ErrorNote error={error} onClose={clearError} />
      <div className="flex justify-end gap-2">
        {post.captions.length > 0 && (
          <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-[12px] text-fog hover:text-white">
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={pending || captions.every((c) => !c.text.trim())}
          className="rounded-lg bg-white/[0.1] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/[0.15] disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
      </div>
      {post.status === "awaiting" && <p className="text-[10.5px] text-amber-200/80">Saving withdraws the current approval request.</p>}
    </section>
  );
}

/**
 * Approvals normally arrive from the client's Telegram room. An approver listed in
 * protocol.md can also act here — always under their own name.
 */
export function ClientReply({ post, client }: { post: Post; client: Client }) {
  const { run, pending, error, clearError } = useAction();
  const approver = useApproverFor(client);
  const [change, setChange] = useState("");
  const reply = (text: string) => run(() => api(`/api/posts/${post.id}/reply`, "POST", { text }));

  if (!approver) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[12px] leading-relaxed text-white/80">
        <TelegramIcon className="mt-0.5 size-3.5 shrink-0 text-[#5eb5e8]" />
        <span>
          Waiting for {client.approvers.map((a) => a.name).join(" / ")} in <span className="text-white">{client.rooms.approvals}</span>. They reply{" "}
          <span className="font-mono text-lime/90">approve {postRef(post)}</span> there.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ErrorNote error={error} onClose={clearError} />
      <p className="flex items-center gap-2 text-[11px] text-fog">
        <TelegramIcon className="size-3 text-[#5eb5e8]" /> You&apos;re an approver ({approver.handle}) — acting here is recorded as you.
      </p>
      <div className="flex gap-2">
        <input
          value={change}
          onChange={(e) => setChange(e.target.value)}
          placeholder="change: slide 3 price should say onwards"
          className="min-w-0 flex-1 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50"
        />
        <button
          onClick={() => change.trim() && reply(`change: ${change.replace(/^change:\s*/i, "")}`)}
          disabled={pending || !change.trim()}
          className="rounded-lg bg-white/[0.08] px-3 text-[12px] text-white hover:bg-white/[0.12] disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <button
        onClick={() => reply("approve")}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime py-2.5 text-[13px] font-medium text-night hover:brightness-95 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve as {approver.name.split(" ")[0]}
      </button>
    </div>
  );
}

export const mediaUrl = (post: Post, m: Media) => `/api/media/${post.id}/${encodeURIComponent(m.file)}`;

export function MediaView({ post, media, className }: { post: Post; media: Media; className?: string }) {
  return media.kind === "video" ? (
    <video src={mediaUrl(post, media)} controls playsInline className={cn("bg-black", className)} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file; next/image can't fetch it
    <img src={mediaUrl(post, media)} alt={`${post.title} creative`} className={cn("object-cover", className)} />
  );
}

/** What actually gets published: rendered template, a designer's file, a Drive reference, or a reel MP4. */
export function MediaSection({ post, editable, drive }: { post: Post; editable: boolean; drive?: { connected: boolean; folderUrl?: string | null } }) {
  const { run, pending, error, clearError } = useAction();
  const [busy, setBusy] = useState<"upload" | "render" | "reel" | "drive" | null>(null);
  const [voice, setVoice] = useState(true);
  const [picker, setPicker] = useState(false);
  const media = post.media ?? [];
  const video = post.format === "Reel" || post.format === "Story";
  const imageLabel =
    post.format === "Carousel" ? `Generate ${Math.max(1, post.slides?.length ?? 1)} slide${(post.slides?.length ?? 1) > 1 ? "s" : ""}` : post.format === "Story" ? "Story image" : "Generate image";
  const videoLabel = post.format === "Story" ? "Story video" : "Generate reel";

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("upload");
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.append("file", f);
      await run(async () => {
        const res = await fetch(`/api/posts/${post.id}/media`, { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
        return data;
      });
    }
    setBusy(null);
  };

  const render = async () => {
    setBusy("render");
    await run(() => api(`/api/posts/${post.id}/render`, "POST"));
    setBusy(null);
  };

  const renderReel = async () => {
    setBusy("reel");
    await run(() => api(`/api/posts/${post.id}/reel`, "POST", { voice }));
    setBusy(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Media · published files</p>
        <span className="text-[11px] text-fog">{media.length || "none yet"}</span>
      </div>
      {media.length > 0 && (
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {media.map((m) => (
            <li key={m.file} className="group relative aspect-square overflow-hidden rounded-lg bg-black/30 ring-1 ring-white/[0.08]">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(post, m)} alt={m.name} className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-[10px] text-fog">
                  <Film className="mb-1 size-4" />
                  MP4
                </span>
              )}
              {editable && (
                <button
                  onClick={() => run(() => api(`/api/posts/${post.id}/media?file=${encodeURIComponent(m.file)}`, "DELETE"))}
                  aria-label={`Remove ${m.name}`}
                  className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {post.format !== "Reel" && (
            <MediaButton onClick={render} disabled={pending} busy={busy === "render"} icon={ImageIcon}>
              {busy === "render" ? "Rendering…" : imageLabel}
            </MediaButton>
          )}
          {video && (
            <MediaButton onClick={renderReel} disabled={pending} busy={busy === "reel"} icon={Film}>
              {busy === "reel" ? "Rendering video…" : videoLabel}
            </MediaButton>
          )}
          <label className={cn(BTN, "cursor-pointer", pending && "pointer-events-none opacity-50")}>
            {busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload file
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
          </label>
          {drive?.connected ? (
            <MediaButton onClick={() => setPicker(true)} disabled={pending} busy={busy === "drive"} icon={HardDrive}>
              From Drive
            </MediaButton>
          ) : (
            <span className={cn(BTN, "cursor-default text-fog")} title="Connect Google Drive in Connections">
              <HardDrive className="size-3.5" /> Drive not connected
            </span>
          )}
        </div>
      )}
      {editable && video && (
        <label className="mt-2 flex items-center gap-2 text-[11.5px] text-fog">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="accent-lime" />
          Sarvam voiceover {post.reel ? `(${post.reel.voiceLang ?? "en-IN"}, ${post.reel.scenes.length} scenes)` : "(from the caption)"} · takes 30–90 s
        </label>
      )}
      <ErrorNote error={error} onClose={clearError} />
      <AnimatePresence>
        {picker && (
          <DrivePicker
            clientId={post.clientId}
            folderUrl={drive?.folderUrl}
            onClose={() => setPicker(false)}
            onPick={async (files) => {
              setBusy("drive");
              for (const f of files) await run(() => api(`/api/posts/${post.id}/drive`, "POST", { fileId: f.id }));
              setBusy(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

const BTN = "flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] py-2 text-[12px] text-white/85 hover:bg-white/[0.1] disabled:opacity-50";

function MediaButton({ children, onClick, disabled, busy, icon: Icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; icon: typeof Film }) {
  return (
    <button onClick={onClick} disabled={disabled} className={BTN}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />} {children}
    </button>
  );
}

export function ResendButton({ post, client }: { post: Post; client: Client }) {
  const { run, pending, error, clearError } = useAction();
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-1.5">
      <ErrorNote error={error} onClose={clearError} />
      <button
        onClick={async () => {
          setSent(false);
          if (await run(() => api(`/api/posts/${post.id}/resend`, "POST"))) setSent(true);
        }}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.06] py-2 text-[12px] text-white/85 hover:bg-white/[0.1] disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <TelegramIcon className="size-3.5 text-[#5eb5e8]" />}
        {sent ? `Sent to ${client.rooms.approvals}` : `Resend to ${client.rooms.approvals}`}
      </button>
    </div>
  );
}

export function MarkLive({ post }: { post: Post }) {
  const { run, pending, error, clearError } = useAction();
  const [link, setLink] = useState("");
  return (
    <div className="space-y-2">
      <ErrorNote error={error} onClose={clearError} />
      <p className="text-[11px] text-fog">Dry run — Postiz isn&apos;t connected, so nothing was posted. Mark it live manually:</p>
      <div className="flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://instagram.com/p/…"
          className="min-w-0 flex-1 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[12px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50"
        />
        <button
          onClick={() => run(() => api(`/api/posts/${post.id}/live`, "POST", { permalink: link }))}
          disabled={pending}
          className="rounded-lg bg-white/[0.08] px-3 text-[12px] text-white hover:bg-white/[0.12] disabled:opacity-40"
        >
          Mark live
        </button>
      </div>
    </div>
  );
}
