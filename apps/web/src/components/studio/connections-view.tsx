"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, CircleCheck, ExternalLink, HardDrive, Loader2, Sparkles, Unplug, Volume2 } from "lucide-react";
import type { Client, ConnectionStatus } from "@bolo/core";
import { api, useAction } from "./hooks";
import { ErrorNote } from "./controls";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TelegramIcon } from "@/components/ui/platform-icons";
import { ScrollMain } from "@/components/ui/smooth-scroll";
import { cn } from "@/lib/cn";

type Flash = { kind: string; ok: boolean; text: string };

const field =
  "w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[13px] text-white ring-1 ring-white/[0.08] outline-none placeholder:text-white/30 focus:ring-lime/50";

/**
 * The client's connections — Telegram, Instagram & Facebook, LinkedIn, Google Drive, Sarvam AI and
 * the AI agent. Each card says in plain words what it does and how to connect it in a click or two.
 */
export function ConnectionsView({ client, status, manager, flash, welcome }: { client: Client; status: ConnectionStatus; manager: boolean; flash: Flash[]; welcome: boolean }) {
  const done = [status.telegram.connected, status.meta.connected, status.linkedin.connected && !status.linkedin.expired, status.drive.connected && !status.drive.shared, status.sarvam.connected, status.ai.connected];
  const count = done.filter(Boolean).length;

  return (
    <ScrollMain>
      <div className="border-b border-white/[0.05] px-6 py-4">
        <h1 className="text-[18px] font-medium tracking-tight">Connections</h1>
        <p className="mt-0.5 text-[12.5px] text-fog">
          Connect {client.name}&apos;s accounts once — then Bolo Studio sends previews for approval, posts for you and stores your files.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lime transition-[width] duration-700" style={{ width: `${(count / done.length) * 100}%` }} />
          </div>
          <span className="text-[12px] text-fog">
            {count} of {done.length} connected
          </span>
        </div>
      </div>

      {welcome && (
        <p className="mx-6 mt-4 rounded-lg bg-lime/10 px-3 py-2.5 text-[12.5px] text-lime">
          {client.name} is set up. Connect what you use below — every step takes a minute. You can come back here any time.
        </p>
      )}
      {flash.map((f) => (
        <p key={f.kind} className={cn("mx-6 mt-4 rounded-lg px-3 py-2 text-[12.5px]", f.ok ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100")}>
          {f.kind === "drive" ? "Google Drive" : f.kind === "meta" ? "Facebook & Instagram" : "LinkedIn"}: {f.text}
        </p>
      ))}
      {!manager && <p className="mx-6 mt-4 rounded-lg bg-white/[0.05] px-3 py-2 text-[12.5px] text-fog">Only the company&apos;s owner or admins can connect or disconnect accounts.</p>}

      <div className="grid gap-4 p-6 xl:grid-cols-2">
        <TelegramCard client={client} s={status.telegram} manager={manager} />
        <MetaCard client={client} s={status.meta} manager={manager} />
        <LinkedInCard client={client} s={status.linkedin} manager={manager} />
        <DriveCard client={client} s={status.drive} manager={manager} />
        <SarvamCard client={client} s={status.sarvam} manager={manager} />
        <AiCard client={client} s={status.ai} manager={manager} />
      </div>
    </ScrollMain>
  );
}

// ---------- building blocks ----------

function Card({
  icon,
  title,
  what,
  ok,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  what: string;
  ok: boolean;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl bg-white/[0.035] p-5 ring-1 transition-colors", ok ? "ring-emerald-400/20" : "ring-white/[0.07]")}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06]">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14.5px] font-medium">{title}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]", ok ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.07] text-fog")}>
              {ok && <Check className="size-3" />}
              {status}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fog">{what}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-white/80">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10.5px] text-lime tabular-nums">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Connected({ lines }: { lines: (string | null | false)[] }) {
  return (
    <div className="space-y-1 rounded-lg bg-emerald-400/[0.06] px-3 py-2.5">
      {lines.filter(Boolean).map((l) => (
        <p key={String(l)} className="flex items-start gap-2 text-[12.5px] text-white/85">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-300" /> {l}
        </p>
      ))}
    </div>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="rounded-lg bg-amber-300/[0.07] px-3 py-2 text-[12px] leading-relaxed text-amber-100/90">
      {what} isn&apos;t switched on for Bolo Studio yet — ask Bolo Studio support to enable it. The connect button appears here once it is.
    </p>
  );
}

const primary = "inline-flex w-fit items-center gap-2 rounded-lg bg-lime px-4 py-2 text-[13px] font-medium text-night hover:brightness-95 disabled:opacity-50";

function Disconnect({ client, kind, label }: { client: Pick<Client, "id">; kind: string; label: string }) {
  const { run, pending, error, clearError } = useAction();
  return (
    <div className="mt-auto space-y-2 pt-1">
      <ErrorNote error={error} onClose={clearError} />
      <button
        onClick={() => confirm(`Disconnect ${label}?`) && run(() => api("/api/connect/disconnect", "POST", { company: client.id, kind }))}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-fog hover:bg-white/[0.06] hover:text-red-200"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />} Disconnect
      </button>
    </div>
  );
}

// ---------- the six connections ----------

type TgLink = { link: string | null; privateLink: string | null; code: string; bot: string | null; listening: boolean };

/** Also used as step 2 of onboarding — `onConnected` replaces the page refresh there. */
export function TelegramCard({ client, s, manager, onConnected }: { client: Pick<Client, "id" | "name">; s: ConnectionStatus["telegram"]; manager: boolean; onConnected?: () => void }) {
  const router = useRouter();
  const [link, setLink] = useState<(TgLink & { mode: "group" | "private" }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"group" | "private" | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // While the client adds the bot, check every 3 s until the chat is linked
  useEffect(() => {
    if (!link || s.connected) return;
    polling.current = setInterval(async () => {
      const r = await fetch(`/api/connect/telegram?company=${client.id}`).then((x) => x.json()).catch(() => null);
      if (r?.connected) {
        if (polling.current) clearInterval(polling.current);
        if (onConnected) onConnected();
        else router.refresh();
      }
    }, 3000);
    const stop = setTimeout(() => polling.current && clearInterval(polling.current), 30 * 60_000);
    return () => {
      if (polling.current) clearInterval(polling.current);
      clearTimeout(stop);
    };
  }, [link, s.connected, client.id, router, onConnected]);

  const start = async (mode: "group" | "private") => {
    setBusy(mode);
    setError(null);
    try {
      const r = await api<TgLink>("/api/connect/telegram", "POST", { company: client.id });
      setLink({ ...r, mode });
      const url = mode === "group" ? r.link : r.privateLink;
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const url = link ? (link.mode === "group" ? link.link : link.privateLink) : null;

  if (s.viaSwitch) return <TelegramViaSwitch s={s} />;

  return (
    <Card
      icon={<TelegramIcon className="size-5 text-[#5eb5e8]" />}
      title="Telegram — previews & approvals"
      what="Every post waiting for approval arrives in Telegram with its image or video. Approvers tap ✅ Approve, ✏️ Changes or ⛔ Reject — no Bolo account needed."
      ok={s.connected}
      status={s.connected ? "Connected" : "Not connected"}
    >
      {s.connected ? (
        <>
          <Connected lines={[s.title ?? "Telegram", "Who can approve: Team → Telegram approvers (or anyone in the group)"]} />
          {manager && <Disconnect client={client} kind="telegram" label="Telegram" />}
        </>
      ) : !s.available ? (
        <Unavailable what="Telegram" />
      ) : (
        <>
          <Steps
            items={[
              <>
                <b className="font-medium text-white">A team or a client approves?</b> Make a Telegram group (or use one you have) with those people, then click{" "}
                <b className="font-medium text-white">Connect a group</b> — Telegram opens — pick the group and tap <b className="font-medium text-white">Add</b>.
              </>,
              <>
                <b className="font-medium text-white">Only you approve?</b> Click <b className="font-medium text-white">Just me</b> — Telegram opens a chat with our bot — tap{" "}
                <b className="font-medium text-white">Start</b>.
              </>,
              "That's it — this card turns green by itself. Then choose who may approve in Team.",
            ]}
          />
          {link && (
            <div className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-[12px] leading-relaxed text-white/80">
              <p className="flex items-center gap-2 text-lime">
                <Loader2 className="size-3.5 animate-spin" /> Waiting for Telegram…
              </p>
              {url && (
                <p className="mt-1">
                  Telegram didn&apos;t open?{" "}
                  <a href={url} target="_blank" rel="noreferrer" className="text-lime underline">
                    Open it here
                  </a>
                  .
                </p>
              )}
              <p className="mt-1 text-fog">
                Or send <span className="font-mono text-white/85">/connect {link.code}</span> to {link.bot ? <span className="font-mono text-white/85">@{link.bot}</span> : "the bot"}
                {link.mode === "group" ? " in your group (add the bot to it first)" : ""}.
              </p>
              {!link.listening && <p className="mt-1 text-amber-200/90">Bolo Studio is still switching Telegram on — your code stays valid for 30 minutes.</p>}
            </div>
          )}
          <ErrorNote error={error} onClose={() => setError(null)} />
          {manager && (
            <div className="mt-auto flex flex-wrap gap-2">
              <button onClick={() => start("group")} disabled={busy !== null} className={primary}>
                {busy === "group" ? <Loader2 className="size-4 animate-spin" /> : <TelegramIcon className="size-4" />} Connect a group
              </button>
              <button
                onClick={() => start("private")}
                disabled={busy !== null}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/[0.08] px-4 py-2 text-[13px] font-medium text-white hover:bg-white/[0.12] disabled:opacity-50"
              >
                {busy === "private" ? <Loader2 className="size-4 animate-spin" /> : <TelegramIcon className="size-4 text-[#5eb5e8]" />} Just me
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/**
 * Switch-first: each company's Telegram group is bridged into a Switch room by the Bolo Studio
 * team, and the Publisher agent in that room turns "approve #ref" into an approval.
 */
function TelegramViaSwitch({ s }: { s: ConnectionStatus["telegram"] }) {
  return (
    <Card
      icon={<TelegramIcon className="size-5 text-[#5eb5e8]" />}
      title="Telegram — previews & approvals"
      what="Every post waiting for approval arrives in your Telegram group with its image or video, posted by Bolo Studio's agent. Approvers reply in the group — no Bolo account needed."
      ok={s.connected}
      status={s.connected ? "Connected" : "Set up by Bolo Studio"}
    >
      {s.connected ? (
        <>
          <Connected lines={[`Group: ${s.title}`, "Who can approve: Team → Telegram approvers (or anyone in the group)"]} />
          <div className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-[12px] leading-relaxed text-white/80">
            <p className="text-white/90">To answer a post, reply in the group:</p>
            <p className="mt-1 font-mono text-[11.5px] text-lime/90">approve #p1a2b3</p>
            <p className="font-mono text-[11.5px] text-lime/90">change #p1a2b3: make the price bigger</p>
            <p className="font-mono text-[11.5px] text-lime/90">reject #p1a2b3</p>
            <p className="mt-1 text-fog">Each post&apos;s #code is in its message. With only one post waiting, “approve” alone is enough.</p>
          </div>
        </>
      ) : (
        <Steps
          items={[
            "Make a Telegram group for approvals (or use one you have) and add the people who approve — your team, your client, or just you.",
            <>
              Send the group&apos;s name to your Bolo Studio contact. They connect it to Bolo{s.room ? <> as “<b className="font-medium text-white">{s.room}</b>”</> : null} — it takes them a minute.
            </>,
            "This card turns green when it's ready. Then choose who may approve in Team → Telegram approvers.",
          ]}
        />
      )}
    </Card>
  );
}

function MetaCard({ client, s, manager }: { client: Client; s: ConnectionStatus["meta"]; manager: boolean }) {
  const { run, pending, error, clearError } = useAction();
  return (
    <Card
      icon={
        <span className="flex -space-x-1">
          <InstagramIcon className="size-[18px] text-[#e1306c]" />
          <FacebookIcon className="size-[18px] text-[#1877f2]" />
        </span>
      }
      title="Instagram & Facebook"
      what="Approved posts, carousels, stories and reels go out on your Facebook Page and Instagram at their time — automatically."
      ok={s.connected}
      status={s.connected ? "Connected" : s.pending ? "Pick a Page" : "Not connected"}
    >
      {s.connected ? (
        <>
          <Connected lines={[`Facebook Page: ${s.pageName}`, s.instagram ? `Instagram: ${s.instagram}` : "No Instagram linked to this Page — see step 1, then reconnect"]} />
          {manager && <Disconnect client={client} kind="meta" label="Instagram & Facebook" />}
        </>
      ) : s.pending ? (
        <>
          <p className="text-[12.5px] text-white/80">Which Page should {client.name} post to?</p>
          <ul className="space-y-1.5">
            {s.pending.map((p) => (
              <li key={p.id}>
                <button
                  disabled={pending || !manager}
                  onClick={() => run(() => api("/api/connect/meta/page", "POST", { company: client.id, pageId: p.id }))}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 text-left ring-1 ring-white/[0.07] hover:bg-white/[0.08]"
                >
                  <span className="text-[13px]">{p.name}</span>
                  <span className="text-[11.5px] text-fog">{p.instagram ? `Instagram @${p.instagram}` : "no Instagram"}</span>
                </button>
              </li>
            ))}
          </ul>
          <ErrorNote error={error} onClose={clearError} />
        </>
      ) : !s.available ? (
        <Unavailable what="Instagram & Facebook" />
      ) : (
        <>
          <Steps
            items={[
              <>Your Instagram must be a <b className="font-medium text-white">Business or Creator</b> account linked to your Facebook Page (Instagram app → Settings → Account type and tools; then link your Page).</>,
              <>Click <b className="font-medium text-white">Continue with Facebook</b> and log in with the account that manages the Page.</>,
              "When Facebook asks, tick your Page and your Instagram account, then Save.",
            ]}
          />
          {manager && (
            <a href={`/api/connect/meta/start?company=${client.id}`} className={cn(primary, "mt-auto")}>
              <FacebookIcon className="size-4" /> Continue with Facebook
            </a>
          )}
        </>
      )}
    </Card>
  );
}

function LinkedInCard({ client, s, manager }: { client: Client; s: ConnectionStatus["linkedin"]; manager: boolean }) {
  const live = s.connected && !s.expired;
  return (
    <Card
      icon={<LinkedinIcon className="size-5 text-[#0a66c2]" />}
      title="LinkedIn"
      what="Approved posts and carousels go out on LinkedIn at their time."
      ok={live}
      status={live ? "Connected" : s.expired ? "Login expired" : "Not connected"}
    >
      {live ? (
        <>
          <Connected lines={[`Posting as ${s.name}`, s.expiresAt && `LinkedIn asks to log in again by ${new Date(s.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — we'll remind you`]} />
          {manager && <Disconnect client={client} kind="linkedin" label="LinkedIn" />}
        </>
      ) : !s.available ? (
        <Unavailable what="LinkedIn" />
      ) : (
        <>
          <Steps
            items={[
              <>Click <b className="font-medium text-white">Continue with LinkedIn</b>.</>,
              "Sign in with the LinkedIn account that should post, then tap Allow.",
            ]}
          />
          {manager && (
            <a href={`/api/connect/linkedin/start?company=${client.id}`} className={cn(primary, "mt-auto")}>
              <LinkedinIcon className="size-4" /> {s.expired ? "Log in to LinkedIn again" : "Continue with LinkedIn"}
            </a>
          )}
        </>
      )}
    </Card>
  );
}

function DriveCard({ client, s, manager }: { client: Client; s: ConnectionStatus["drive"]; manager: boolean }) {
  const own = s.connected && !s.shared;
  const link = (href: string | null, label: string) =>
    href ? (
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lime hover:underline">
        {label} <ExternalLink className="size-3" />
      </a>
    ) : null;
  return (
    <Card
      icon={<HardDrive className="size-5 text-[#34a853]" />}
      title="Google Drive — your designs"
      what={`Every image, carousel and reel made for ${client.name} is saved to your Google Drive automatically, and every approved post gets a copy in Published.`}
      ok={own}
      status={own ? "Connected" : s.shared ? "Using the agency's Drive" : "Not connected"}
    >
      {s.connected && (
        <Connected
          lines={[
            s.email && `Account: ${s.email}`,
            `Folder: Bolo Studio / ${client.name}`,
            s.shared && "Saving to the agency's Drive for now — connect yours to keep the designs in your own account",
          ]}
        />
      )}
      {s.connected && (
        <p className="flex flex-wrap gap-3 text-[12.5px]">
          {link(s.designs, "Designs")}
          {link(s.published, "Published")}
          {!s.designs && !s.published && link(s.folder, "Open folder")}
        </p>
      )}
      {own ? (
        manager && <Disconnect client={client} kind="drive" label="Google Drive" />
      ) : !s.available ? (
        <Unavailable what="Google Drive" />
      ) : (
        <>
          <Steps
            items={[
              <>Click <b className="font-medium text-white">Connect Google Drive</b> and choose your Google account.</>,
              <>Tap <b className="font-medium text-white">Allow</b>. Bolo can only see the files it saves for you — nothing else in your Drive.</>,
              <>A folder “Bolo Studio / {client.name}” appears in your Drive. New designs land in Designs, approved posts in Published.</>,
            ]}
          />
          {manager && (
            <a href={`/api/drive/connect?company=${client.id}`} className={cn(primary, "mt-auto")}>
              <HardDrive className="size-4" /> Connect Google Drive
            </a>
          )}
        </>
      )}
    </Card>
  );
}

function KeyForm({ client, kind, placeholder, extra, label }: { client: Client; kind: "sarvam" | "ai"; placeholder: string; label: string; extra?: Record<string, string> }) {
  const { run, pending, error, clearError } = useAction();
  const [key, setKey] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api("/api/connect/keys", "POST", { company: client.id, kind, key, ...extra }))) setKey("");
      }}
      className="mt-auto space-y-2"
    >
      <div className="flex gap-2">
        <input value={key} onChange={(e) => (setKey(e.target.value), clearError())} type="password" autoComplete="off" placeholder={placeholder} className={field} aria-label={label} />
        <button disabled={pending || key.trim().length < 10} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-lime px-4 text-[13px] font-medium text-night disabled:opacity-40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {pending ? "Checking…" : "Save"}
        </button>
      </div>
      <ErrorNote error={error} onClose={clearError} />
      <p className="text-[11px] text-fog">We test the key first, then store it encrypted. Nobody at Bolo Studio can read it.</p>
    </form>
  );
}

function SarvamCard({ client, s, manager }: { client: Client; s: ConnectionStatus["sarvam"]; manager: boolean }) {
  return (
    <Card
      icon={<Volume2 className="size-5 text-[#ff8a3d]" />}
      title="Sarvam AI — voiceovers"
      what="Natural Marathi, Hindi and English voices for your reels and story videos, with subtitles in sync."
      ok={s.connected}
      status={s.connected ? "Connected" : s.shared ? "Using the agency's key" : "Not connected"}
    >
      {s.connected ? (
        <>
          <Connected lines={[`Key ${s.key}`]} />
          {manager && <Disconnect client={client} kind="sarvam" label="Sarvam AI" />}
        </>
      ) : (
        <>
          <Steps
            items={[
              <>
                Sign up at{" "}
                <a href="https://dashboard.sarvam.ai" target="_blank" rel="noreferrer" className="text-lime underline">
                  dashboard.sarvam.ai
                </a>{" "}
                (free credits to start).
              </>,
              <>Open <b className="font-medium text-white">API Keys</b> → <b className="font-medium text-white">Create key</b> → copy it.</>,
              "Paste it below and tap Save.",
            ]}
          />
          {manager && <KeyForm client={client} kind="sarvam" placeholder="Paste your Sarvam API key" label="Sarvam API key" />}
        </>
      )}
    </Card>
  );
}

const PROVIDERS = [
  { id: "anthropic", label: "Claude", url: "https://platform.claude.com/settings/keys", hint: "sk-ant-…", where: "Claude Console → API keys → Create key" },
  { id: "openai", label: "OpenAI / Codex", url: "https://platform.openai.com/api-keys", hint: "sk-…", where: "OpenAI Platform → API keys → Create new secret key" },
] as const;

function AiCard({ client, s, manager }: { client: Client; s: ConnectionStatus["ai"]; manager: boolean }) {
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["id"]>("anthropic");
  const [model, setModel] = useState("");
  const p = PROVIDERS.find((x) => x.id === provider)!;
  return (
    <Card
      icon={<Sparkles className="size-5 text-lime" />}
      title="AI agent — writes, designs, edits"
      what="One connection for everything creative: it writes captions in your languages, decides the design, lays out images and carousels, and scripts and edits reels — following your Brand Kit."
      ok={s.connected}
      status={s.connected ? `${s.label} connected` : s.local ? "Using the agency's Claude" : "Not connected"}
    >
      {s.connected ? (
        <>
          <Connected lines={[`${s.label} · model ${s.model}`, `Key ${s.key}`]} />
          {manager && <Disconnect client={client} kind="ai" label="the AI agent" />}
        </>
      ) : (
        <>
          <div className="flex gap-1.5">
            {PROVIDERS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setProvider(x.id)}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] ring-1", provider === x.id ? "bg-lime/15 text-lime ring-lime/40" : "text-white/80 ring-white/[0.08] hover:bg-white/[0.06]")}
              >
                <Bot className="size-3.5" /> {x.label}
              </button>
            ))}
          </div>
          <Steps
            items={[
              <>
                Open{" "}
                <a href={p.url} target="_blank" rel="noreferrer" className="text-lime underline">
                  {p.where.split(" → ")[0]}
                </a>{" "}
                and sign in (add a little credit if it asks).
              </>,
              <>{p.where.split(" → ").slice(1).join(" → ")}, then copy the key.</>,
              "Paste it below and tap Save.",
            ]}
          />
          <details className="text-[12px] text-fog">
            <summary className="cursor-pointer select-none">Choose a model (optional)</summary>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "anthropic" ? "claude-opus-5-5 (default)" : "gpt-5 (default)"} className={cn(field, "mt-2")} />
          </details>
          {manager && <KeyForm client={client} kind="ai" placeholder={`Paste your ${p.label} API key (${p.hint})`} label={`${p.label} API key`} extra={{ provider, ...(model.trim() ? { model: model.trim() } : {}) }} />}
        </>
      )}
    </Card>
  );
}
