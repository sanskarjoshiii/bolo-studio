"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Bot, Clapperboard, GalleryHorizontalEnd, HardDrive, Image as ImageIcon, Loader2, Mic, PenLine, Smartphone, Sparkles, Upload, X } from "lucide-react";
import type { Client, DriveFile, Platform, Post, PostFormat } from "@bolo/core";
import { FORMAT_INFO, FORMATS, istIso, istParts } from "@bolo/core/shared";
import { api } from "./hooks";
import { ErrorNote } from "./controls";
import { DrivePicker } from "./drive-picker";
import { PhonePreview } from "./phone-preview";
import { platformIcon, platformLabel } from "@/components/ui/platform-icons";
import { cn } from "@/lib/cn";

const FORMAT_ICON: Record<PostFormat, typeof ImageIcon> = { Post: ImageIcon, Carousel: GalleryHorizontalEnd, Story: Smartphone, Reel: Clapperboard };
const FORMAT_HINT: Record<PostFormat, string> = {
  Post: "One designed image with a caption",
  Carousel: "Up to 10 swipeable slides",
  Story: "Full-screen image or short video, 24 h",
  Reel: "Vertical video with voiceover and subtitles",
};

const toLocal = (iso: string) => {
  const p = istParts(iso);
  return `${p.dateKey}T${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};

export function CreateView({
  client,
  defaultSlot,
  drive,
  agentsRoomKnown,
}: {
  client: Client;
  defaultSlot: string;
  drive: { connected: boolean; folderUrl: string | null };
  agentsRoomKnown: boolean;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<PostFormat>("Post");
  const [text, setText] = useState("");
  const allowedPlatforms = useMemo(
    () => client.channels.map((c) => c.platform).filter((p) => (FORMAT_INFO[format].platforms as readonly string[]).includes(p)),
    [client, format],
  );
  const [platforms, setPlatforms] = useState<Platform[]>(allowedPlatforms);
  const [when, setWhen] = useState(toLocal(defaultSlot));
  const [mode, setMode] = useState<"claude" | "agents" | "self">("claude");
  const [autoSend, setAutoSend] = useState(true);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFormat = (f: PostFormat) => {
    setFormat(f);
    const allowed = client.channels.map((c) => c.platform).filter((p) => (FORMAT_INFO[f].platforms as readonly string[]).includes(p));
    setPlatforms((cur) => {
      const kept = cur.filter((p) => allowed.includes(p));
      return kept.length ? kept : allowed;
    });
  };

  const preview = {
    id: "preview",
    title: text.trim().split(/[.!?\n]/)[0].slice(0, 60) || `Your ${format.toLowerCase()} headline`,
    creativeText: "",
    format,
    slides: format === "Carousel" ? [{ headline: text.trim().slice(0, 60) || "Slide 1" }, { headline: "Slide 2" }, { headline: "Slide 3" }] : undefined,
    creative: client.id === "clinic-demo" ? "clinic" : client.id === "my-brand" ? "personal" : "carousel",
    media: [],
    captions: [],
  } satisfies Parameters<typeof PhonePreview>[0]["post"];

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const [d, t] = when.split("T");
      const [hh, mm] = t.split(":").map(Number);
      const { post } = await api<{ post: Post; failed: string[] }>("/api/ideas", "POST", {
        clientId: client.id,
        text,
        format,
        platforms,
        scheduledAt: istIso(d, hh * 60 + mm),
        mode,
        autoSend,
        driveFileIds: driveFiles.map((f) => f.id),
      });
      for (const f of localFiles) {
        const form = new FormData();
        form.append("file", f);
        await fetch(`/api/posts/${post.id}/media`, { method: "POST", body: form });
      }
      router.push(`/studio/${client.id}/post/${post.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-6 py-4">
        <h1 className="text-[18px] font-medium tracking-tight">Create for {client.name}</h1>
        <p className="mt-0.5 text-[12.5px] text-fog">Say the idea once — the agents (or you) turn it into a finished post, Brand Guard checks it, the client approves on Telegram.</p>
      </div>

      <div className="grid gap-8 p-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-7">
          <Section n={1} title="What are you making?">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {FORMATS.map((f) => {
                const Icon = FORMAT_ICON[f];
                const possible = client.channels.some((c) => (FORMAT_INFO[f].platforms as readonly string[]).includes(c.platform));
                return (
                  <button
                    key={f}
                    disabled={!possible}
                    onClick={() => pickFormat(f)}
                    className={cn(
                      "rounded-xl p-4 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-35",
                      format === f ? "bg-lime/10 ring-lime/60" : "bg-white/[0.035] ring-white/[0.07] hover:bg-white/[0.06]",
                    )}
                  >
                    <Icon className={cn("size-5", format === f ? "text-lime" : "text-white/70")} strokeWidth={1.75} />
                    <p className="mt-3 text-[14px] font-medium">{f}</p>
                    <p className="text-[11px] text-fog">{FORMAT_INFO[f].ratio} · {FORMAT_INFO[f].size}</p>
                    <p className="mt-1.5 text-[11.5px] leading-snug text-white/65">{possible ? FORMAT_HINT[f] : `${client.name} has no channel for this`}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section n={2} title="Your idea">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={`e.g. Diwali ${format.toLowerCase()} for Luxe 28, family feel, Marathi plus English, site visit this weekend`}
              className="w-full resize-y rounded-xl bg-white/[0.05] p-4 text-[14px] leading-relaxed ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50"
            />
            <p className="mt-2 flex items-center gap-2 text-[12px] text-fog">
              <Mic className="size-3.5 text-lime" /> Dictate it with <span className="text-white/85">Wispr Flow</span> — click in the box and hold your Wispr shortcut. Marathi, Hindi or English.
            </p>
          </Section>

          <Section n={3} title="Where and when">
            <div className="flex flex-wrap gap-2">
              {allowedPlatforms.map((p) => {
                const Icon = platformIcon[p];
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))}
                    className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] ring-1", on ? "bg-white/[0.09] ring-lime/50" : "bg-white/[0.03] text-fog ring-white/[0.07]")}
                  >
                    <Icon className="size-3.5" /> {platformLabel[p]}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex max-w-[280px] flex-col gap-1">
              <span className="text-[12px] text-fog">Post time (IST) — defaults to the best time in protocol.md</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] [color-scheme:dark] ring-1 ring-white/[0.08] outline-none focus:ring-lime/50"
              />
            </label>
          </Section>

          <Section n={4} title="References (optional)" hint="Photos, renders, logos or clips to use in this post">
            <div className="flex flex-wrap gap-2">
              {drive.connected ? (
                <button onClick={() => setPicker(true)} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-[12.5px] hover:bg-white/[0.1]">
                  <HardDrive className="size-3.5" /> Choose from Google Drive
                </button>
              ) : (
                <a href={`/studio/${client.id}/connections`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[12.5px] text-fog ring-1 ring-white/[0.07] hover:text-white">
                  <HardDrive className="size-3.5" /> Connect Google Drive for references
                </a>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-[12.5px] hover:bg-white/[0.1]">
                <Upload className="size-3.5" /> From this computer
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                  className="sr-only"
                  onChange={(e) => setLocalFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])].slice(0, 10))}
                />
              </label>
            </div>
            {(driveFiles.length > 0 || localFiles.length > 0) && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {driveFiles.map((f) => (
                  <Chip key={f.id} icon={HardDrive} label={f.name} onRemove={() => setDriveFiles((cur) => cur.filter((x) => x.id !== f.id))} />
                ))}
                {localFiles.map((f, i) => (
                  <Chip key={`${f.name}-${i}`} icon={Upload} label={f.name} onRemove={() => setLocalFiles((cur) => cur.filter((_, k) => k !== i))} />
                ))}
              </ul>
            )}
          </Section>

          <Section n={5} title="Who writes it?">
            <div className="grid gap-3 lg:grid-cols-3">
              <ModeCard
                on={mode === "claude"}
                onClick={() => setMode("claude")}
                icon={Sparkles}
                title="Claude writes it now"
                badge="Recommended"
                body={`Claude reads ${client.name}'s Brand Kit and writes the brief, captions${format === "Carousel" ? ", slides" : format === "Reel" ? ", reel scenes" : ""}; Bolo renders the ${format === "Reel" ? "video" : "image"} — about a minute.`}
              />
              <ModeCard
                on={mode === "agents"}
                onClick={() => setMode("agents")}
                icon={Bot}
                title="Switch agents"
                body={`bolo-writer and bolo-designer pick it up in ${client.rooms.work} — you and the team can chat with them there.`}
                warn={agentsRoomKnown ? undefined : "The Publisher isn't in the work room yet — see Connections."}
              />
              <ModeCard on={mode === "self"} onClick={() => setMode("self")} icon={PenLine} title="I'll write it" body="Opens the editor: captions, slides or reel scenes, media — then send it yourself." />
            </div>
            {mode === "claude" && (
              <label className="mt-3 flex items-center gap-2 text-[12.5px] text-white/85">
                <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="size-4 accent-lime" />
                Send it to {client.rooms.approvals} automatically when Brand Guard passes
                <span className="text-fog">(off: you review it first)</span>
              </label>
            )}
          </Section>

          <ErrorNote error={error} onClose={() => setError(null)} />
          <div className="flex items-center gap-3">
            <button
              onClick={create}
              disabled={busy || !text.trim() || !platforms.length}
              className="flex items-center gap-2 rounded-xl bg-lime px-6 py-3 text-[14px] font-medium text-night hover:brightness-95 disabled:opacity-40"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} {mode === "claude" ? `Create ${format.toLowerCase()} with Claude` : `Create ${format.toLowerCase()}`}
            </button>
            <span className="text-[12px] text-fog">{!text.trim() ? "Add the idea first" : !platforms.length ? "Pick at least one platform" : "Nothing is posted until the client approves."}</span>
          </div>
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <p className="mb-3 text-center text-[11px] font-medium tracking-[0.08em] text-fog uppercase">Preview</p>
          <PhonePreview post={preview} client={client} />
        </aside>
      </div>

      <AnimatePresence>
        {picker && (
          <DrivePicker
            clientId={client.id}
            folderUrl={drive.folderUrl}
            initial={driveFiles.map((f) => f.id)}
            confirmLabel="Use selected"
            onClose={() => setPicker(false)}
            onPick={(files) => setDriveFiles(files)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2.5 text-[14.5px] font-medium">
        <span className="grid size-6 place-items-center rounded-full bg-white/[0.08] text-[11.5px] text-lime">{n}</span>
        {title}
        {hint && <span className="text-[12px] font-normal text-fog">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function ModeCard({ on, onClick, icon: Icon, title, body, warn, badge }: { on: boolean; onClick: () => void; icon: typeof Bot; title: string; body: string; warn?: string; badge?: string }) {
  return (
    <button onClick={onClick} className={cn("rounded-xl p-4 text-left ring-1 transition", on ? "bg-lime/10 ring-lime/60" : "bg-white/[0.035] ring-white/[0.07] hover:bg-white/[0.06]")}>
      <p className="flex items-center gap-2 text-[13.5px] font-medium">
        <Icon className={cn("size-4", on ? "text-lime" : "text-white/70")} /> {title}
        {badge && <span className="ml-auto rounded bg-lime/15 px-1.5 py-0.5 text-[10px] text-lime">{badge}</span>}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">{body}</p>
      {warn && <p className="mt-2 text-[11.5px] text-amber-200/90">{warn}</p>}
    </button>
  );
}

function Chip({ icon: Icon, label, onRemove }: { icon: typeof HardDrive; label: string; onRemove: () => void }) {
  return (
    <li className="flex max-w-[240px] items-center gap-1.5 rounded-lg bg-white/[0.06] py-1 pr-1 pl-2.5 text-[12px]">
      <Icon className="size-3 shrink-0 text-fog" />
      <span className="truncate">{label}</span>
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="grid size-5 place-items-center rounded text-fog hover:bg-white/10 hover:text-white">
        <X className="size-3" />
      </button>
    </li>
  );
}
