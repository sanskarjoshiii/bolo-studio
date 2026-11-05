import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Bot, CircleCheck, CircleDashed, HardDrive, Mic, PlugZap, Send, Share2, Volume2, type LucideIcon } from "lucide-react";
import {
  agentName,
  driveStatus,
  findRoomByName,
  getClientStudio,
  listIntegrations,
  postizConfig,
  repoRoot,
  setting,
  telegramConfigured,
  type PostizIntegration,
} from "@bolo/core";
import { formatSlot, PLATFORM_SHORT } from "@bolo/core/shared";
import { DriveButtons } from "@/components/studio/drive-buttons";
import { platformIcon, platformLabel } from "@/components/ui/platform-icons";
import { STATUS_META } from "@/lib/status";
import { currentUser } from "@/lib/auth";
import { cn } from "@/lib/cn";

type Health = { switch?: { registered: boolean; status: string; error: string | null; listening: string[] } };

async function publisherHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${setting("PUBLISHER_PORT") || "4100"}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

export default async function ConnectionsPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ drive?: string }> }) {
  const { clientId } = await params;
  const { drive: driveResult } = await searchParams;
  const me = await currentUser();
  const { client, posts } = getClientStudio(clientId);
  const [health, postiz, drive] = [await publisherHealth(), postizConfig(), driveStatus()];

  let integrations: PostizIntegration[] | null = null;
  let postizError: string | null = null;
  if (postiz.configured) {
    try {
      integrations = await listIntegrations();
    } catch (e) {
      postizError = (e as Error).message;
    }
  }

  const sw = health?.switch;
  const listening = (name: string) => Boolean(sw?.listening?.some((l) => l.replace(/^\w+:\s*/, "").replace(/^#/, "").toLowerCase() === name.replace(/^#/, "").toLowerCase()));
  const approvalsRoom = findRoomByName(client.rooms.approvals);
  const writer = agentName("writer");
  const designer = agentName("designer");
  const workspaces = [writer, designer].every((a) => existsSync(join(repoRoot(), "agents", "workspace", a, "CLAUDE.md")));
  const queue = posts.filter((p) => p.status === "scheduled" || p.status === "live").sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <main className="thin-scrollbar min-w-0 flex-1 overflow-y-auto rounded-2xl bg-night-2/60 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.05] px-6 py-4">
        <h1 className="text-[18px] font-medium tracking-tight">Connections</h1>
        <p className="mt-0.5 text-[12.5px] text-fog">Everything Bolo Studio talks to. Keys go in the repo-root <span className="font-mono">.env</span> — never in a chat. Full guide: docs/setup.md</p>
      </div>

      {driveResult && (
        <p className={cn("mx-6 mt-4 rounded-lg px-3 py-2 text-[12.5px]", driveResult === "connected" ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100")}>
          {driveResult === "connected" ? "Google Drive connected — client folders are ready." : `Google Drive: ${driveResult}. Try again, and check the OAuth client in Google Cloud.`}
        </p>
      )}

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Conn
          icon={PlugZap}
          title="Switch + Publisher"
          ok={sw?.status === "connected" && listening(client.rooms.approvals)}
          status={!health ? "Publisher not running" : sw?.status === "connected" ? "Connected" : sw?.registered ? `Switch: ${sw?.status}` : "Not registered"}
          what="Relays approvals between the studio and the client's Telegram group; hands ideas to the agents."
        >
          <Line ok={Boolean(health)} text={health ? "Publisher running on :4100" : "Start it: npm run studio (or npm run dev:publisher)"} />
          <Line ok={Boolean(sw?.registered)} text={sw?.registered ? "Registered as bolo-publisher" : "npm run switch:register -- --local"} />
          <Line ok={Boolean(listening(client.rooms.approvals))} text={`In “${client.rooms.approvals}”${listening(client.rooms.approvals) ? "" : " — type !invite-agent bolo-publisher there"}`} />
          <Line ok={Boolean(listening(client.rooms.work))} text={`In ${client.rooms.work}${listening(client.rooms.work) ? "" : " — type !invite-agent bolo-publisher there"}`} />
          {sw?.error && <p className="mt-1 text-[11.5px] text-amber-200/90">{sw.error}</p>}
        </Conn>

        <Conn
          icon={Send}
          title="Telegram previews"
          ok={telegramConfigured() && Boolean(approvalsRoom?.externalId)}
          status={telegramConfigured() ? (approvalsRoom?.externalId ? "Ready" : "Waiting for group id") : "Token missing"}
          what="Sends the actual image, slides or video to the client's group with the approval message (Switch relays text only)."
        >
          <Line ok={telegramConfigured()} text={telegramConfigured() ? "TELEGRAM_BOT_TOKEN set" : "Add TELEGRAM_BOT_TOKEN to .env — the same token you gave Switch (BotFather)"} />
          <Line ok={Boolean(approvalsRoom?.externalId)} text={approvalsRoom?.externalId ? `Group id known for “${client.rooms.approvals}”` : "Learned automatically once the Publisher is in the group"} />
        </Conn>

        <Conn
          icon={Share2}
          title="Postiz — publishing"
          ok={postiz.configured && !postizError}
          status={postiz.configured ? (postizError ? "Unreachable" : "Connected") : "Dry-run mode"}
          what="Publishes approved posts to Instagram, Facebook, LinkedIn and YouTube. Without it, approvals are recorded but nothing is posted."
        >
          <Line ok={postiz.configured} text={postiz.configured ? postiz.url : "bash infra/postiz/setup.sh → POSTIZ_API_KEY in .env"} />
          {postizError && <p className="text-[11.5px] text-red-200">{postizError}</p>}
          <ul className="mt-2 space-y-1">
            {client.channels.map((c) => {
              const Icon = platformIcon[c.platform];
              const match = integrations?.find((i) => i.id === c.postizIntegrationId);
              return (
                <li key={c.platform} className="flex items-center gap-2 text-[12px]">
                  <Icon className="size-3.5 text-white/70" />
                  <span className="w-20 text-white/80">{platformLabel[c.platform].split(" ")[0]}</span>
                  {c.postizIntegrationId ? (
                    <span className="text-emerald-300">{match?.name ?? "mapped"}</span>
                  ) : (
                    <span className="text-fog">no postizIntegrationId in client.json</span>
                  )}
                </li>
              );
            })}
          </ul>
          {integrations && integrations.length > 0 && (
            <details className="mt-2 text-[11.5px] text-fog">
              <summary className="cursor-pointer">Channels in Postiz (copy an id into client.json)</summary>
              <ul className="mt-1 space-y-0.5 font-mono">
                {integrations.map((i) => (
                  <li key={i.id}>
                    {i.name ?? i.identifier} — {i.id}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Conn>

        <Conn
          icon={HardDrive}
          title="Google Drive — references"
          ok={drive.connected}
          status={drive.connected ? `Connected${drive.email ? ` · ${drive.email}` : ""}` : drive.configured ? "Not connected" : "OAuth client missing"}
          what="Reference images and clips live in Drive (Bolo Studio / client / References); approved media are archived to Published."
        >
          <Line ok={drive.configured} text={drive.configured ? "GOOGLE_CLIENT_ID / SECRET set" : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env (Google Cloud → OAuth client, Web)"} />
          {drive.clients[clientId] && (
            <p className="text-[12px]">
              <a href={drive.clients[clientId].references} target="_blank" rel="noreferrer" className="text-lime hover:underline">
                References folder
              </a>{" "}
              ·{" "}
              <a href={drive.clients[clientId].published} target="_blank" rel="noreferrer" className="text-lime hover:underline">
                Published folder
              </a>
            </p>
          )}
          {me?.role === "admin" ? (
            <DriveButtons connected={drive.connected} configured={drive.configured} />
          ) : (
            <p className="text-[11.5px] text-fog">An admin connects Drive.</p>
          )}
        </Conn>

        <Conn
          icon={Volume2}
          title="Sarvam AI — reel voiceover"
          ok={Boolean(setting("SARVAM_API_KEY"))}
          status={setting("SARVAM_API_KEY") ? "Ready" : "Key missing"}
          what="Marathi, Hindi and English voices for reels and story videos; subtitles stay in sync with each scene."
        >
          <Line ok={Boolean(setting("SARVAM_API_KEY"))} text={setting("SARVAM_API_KEY") ? "SARVAM_API_KEY set" : "dashboard.sarvam.ai → API keys → SARVAM_API_KEY in .env (reels render silent until then)"} />
        </Conn>

        <Conn
          icon={Bot}
          title="Content agents (Claude Code in Switch)"
          ok={workspaces && Boolean(listening(client.rooms.work))}
          status={workspaces ? "Workspaces ready" : "Run npm run agents:setup"}
          what={`@${writer} writes briefs, captions and scripts; @${designer} renders media and sends it to Brand Guard.`}
        >
          <Line ok={workspaces} text={workspaces ? "agents/workspace/* created" : "npm run agents:setup"} />
          <p className="text-[12px] leading-relaxed text-white/75">
            Switch Console → Your Agents → + → name <span className="font-mono">{writer}</span> / <span className="font-mono">{designer}</span>, provider Claude Code, Directory{" "}
            <span className="font-mono text-[11px]">agents\workspace\&lt;name&gt;</span>, “Who can talk” incl. agents. Then in {client.rooms.work}:{" "}
            <span className="font-mono">!invite-agent {writer}</span>, <span className="font-mono">!invite-agent {designer}</span>.
          </p>
        </Conn>

        <Conn icon={Mic} title="Wispr Flow — voice" ok status="No setup in Bolo" what="Dictation that types into any text box — no key, no API.">
          <ul className="list-disc space-y-1 pl-4 text-[12px] text-white/75">
            <li>Create → “Your idea”: speak the brief</li>
            <li>Editor: captions and reel voice lines</li>
            <li>{client.rooms.work}: talk to @{writer}</li>
            <li>The client can dictate “change #ref: …” in Telegram</li>
          </ul>
        </Conn>
      </div>

      <section className="mx-6 mb-6 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
        <p className="text-[13px] font-medium">Publishing queue · {client.name}</p>
        {queue.length === 0 ? (
          <p className="mt-2 text-[12px] text-fog">Nothing scheduled yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {queue.map((p) => {
              const st = STATUS_META[p.status];
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("size-1.5 shrink-0 rounded-full", st.dot)} />
                  <Link href={`/studio/${client.id}/post/${p.id}`} className="min-w-0 flex-1 truncate text-[12.5px] hover:underline">
                    {p.title}
                  </Link>
                  <span className="shrink-0 text-[11px] text-fog">
                    {p.format} · {p.platforms.map((x) => PLATFORM_SHORT[x]).join(" + ")} · {formatSlot(p.scheduledAt)}
                    {p.dryRun ? " · dry run" : ""}
                  </span>
                  <span className={cn("shrink-0 text-[11px]", st.text)}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Conn({ icon: Icon, title, ok, status, what, children }: { icon: LucideIcon; title: string; ok: boolean; status: string; what: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-lime" strokeWidth={1.75} />
        <p className="flex-1 text-[13.5px] font-medium">{title}</p>
        <span className={cn("rounded-md px-2 py-0.5 text-[11px]", ok ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-200")}>{status}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-fog">{what}</p>
      {children && <div className="mt-3 space-y-1.5">{children}</div>}
    </section>
  );
}

function Line({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className="flex items-start gap-2 text-[12px]">
      {ok ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-300" /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-fog" />}
      <span className={ok ? "text-white/80" : "text-white/70"}>{text}</span>
    </p>
  );
}

