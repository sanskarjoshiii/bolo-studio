import { existsSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { Bot, CircleCheck, CircleDashed, KeyRound, Mic, PlugZap, Share2, type LucideIcon } from "lucide-react";
import {
  agentName,
  findRoomByName,
  getClientStudio,
  linkedinRedirectUri,
  listIntegrations,
  metaRedirectUri,
  postizConfig,
  repoRoot,
  setting,
  telegramUpdatesMode,
  type PostizIntegration,
} from "@bolo/core";
import { platformIcon, platformLabel } from "@/components/ui/platform-icons";
import { PlatformRooms } from "@/components/studio/platform-rooms";
import { ScrollMain } from "@/components/ui/smooth-scroll";
import { requireUserPage } from "@/lib/auth";
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

/**
 * Bolo Studio's own services — admins only. Clients never see or set these: Switch (agents and
 * rooms), Postiz, Wispr Flow, and the developer apps behind every client connection.
 */
export default async function PlatformPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}/platform`);
  if (me.role !== "admin") notFound();
  const { client } = getClientStudio(clientId);
  const [health, postiz] = [await publisherHealth(), postizConfig()];
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
  const writer = agentName("writer");
  const designer = agentName("designer");
  const workspaces = [writer, designer].every((a) => existsSync(join(repoRoot(), "agents", "workspace", a, "CLAUDE.md")));
  const has = (...keys: string[]) => keys.every((k) => Boolean(setting(k)));
  const publicUrl = setting("BOLO_PUBLIC_URL");

  const switches: { label: string; ok: boolean; detail: string }[] = [
    { label: "Telegram bot", ok: has("TELEGRAM_BOT_TOKEN"), detail: `TELEGRAM_BOT_TOKEN — the bot Switch bridges; Bolo sends the image/video previews with it. Replies go through Switch (${telegramUpdatesMode() === "off" ? "Switch-first" : `Bolo reads the bot: ${telegramUpdatesMode()}`})` },
    { label: "Facebook & Instagram", ok: has("META_APP_ID", "META_APP_SECRET"), detail: `META_APP_ID / META_APP_SECRET — Meta app with Facebook Login; redirect URI ${metaRedirectUri()}` },
    { label: "LinkedIn", ok: has("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"), detail: `LINKEDIN_CLIENT_ID / SECRET — app with “Sign In with LinkedIn” + “Share on LinkedIn”; redirect URI ${linkedinRedirectUri()}` },
    { label: "Google Drive", ok: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), detail: "GOOGLE_CLIENT_ID / SECRET — OAuth web client; redirect URI …/api/drive/callback" },
    { label: "Public media URL (Instagram)", ok: /^https:\/\//.test(publicUrl), detail: publicUrl ? `BOLO_PUBLIC_URL = ${publicUrl}` : "BOLO_PUBLIC_URL — public https address Instagram downloads media from" },
    { label: "Encryption key", ok: has("BOLO_ENCRYPTION_KEY"), detail: "BOLO_ENCRYPTION_KEY — 32 random bytes; without it keys are encrypted with a key derived from the session secret" },
    { label: "Database", ok: has("MONGODB_URI"), detail: has("MONGODB_URI") ? `MongoDB Atlas · database ${setting("MONGODB_DB") || "bolo_studio"}` : "Files on this server — set MONGODB_URI to use MongoDB Atlas (docs/deploy-aws.md step 2)" },
  ];

  return (
    <ScrollMain>
      <div className="border-b border-white/[0.05] px-6 py-4">
        <h1 className="text-[18px] font-medium tracking-tight">Platform</h1>
        <p className="mt-0.5 text-[12.5px] text-fog">Bolo Studio&apos;s own services — only admins see this page. Keys go in the server&apos;s .env (AWS: Secrets Manager), never in a chat.</p>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Section icon={KeyRound} title="Client connections — what the platform needs" ok={switches.every((x) => x.ok)}>
          {switches.map((x) => (
            <Line key={x.label} ok={x.ok} text={`${x.label}: ${x.detail}`} />
          ))}
        </Section>

        <Section icon={PlugZap} title={`Switch rooms · ${client.name}`} ok={listening(client.rooms.approvals)}>
          <PlatformRooms companyId={client.id} companyName={client.name} rooms={client.rooms} />
          <Line ok={listening(client.rooms.approvals)} text={listening(client.rooms.approvals) ? "The Publisher is in the approvals room — clients can reply approve / change / reject there" : "Not joined yet: in Switch Console, bridge the client's Telegram group as this room, then type !invite-agent bolo-publisher in it"} />
        </Section>

        <Section icon={PlugZap} title="Switch + Publisher" ok={sw?.status === "connected"}>
          <p className="text-[12px] text-fog">Relays your Switch rooms and hands ideas to the agents. Status: {!health ? "Publisher not running" : sw?.status === "connected" ? "Connected" : sw?.registered ? `Switch: ${sw?.status}` : "Not registered"}</p>
          <Line ok={Boolean(health)} text={health ? "Publisher running on :4100" : "Start it: npm run studio (or npm run dev:publisher)"} />
          <Line ok={Boolean(sw?.registered)} text={sw?.registered ? "Registered as bolo-publisher" : "npm run switch:register -- --local"} />
          {client.rooms.approvals && <Line ok={listening(client.rooms.approvals)} text={`In “${client.rooms.approvals}”${listening(client.rooms.approvals) ? "" : " — type !invite-agent bolo-publisher there"}`} />}
          {client.rooms.work && <Line ok={listening(client.rooms.work)} text={`In ${client.rooms.work}${listening(client.rooms.work) ? "" : " — type !invite-agent bolo-publisher there"}`} />}
          {sw?.error && <p className="text-[11.5px] text-amber-200/90">{sw.error}</p>}
          {client.rooms.work && !findRoomByName(client.rooms.work) && <p className="text-[11.5px] text-fog">The Publisher hasn&apos;t seen {client.rooms.work} yet.</p>}
        </Section>

        <Section icon={Bot} title="Content agents (Claude Code in Switch)" ok={workspaces && listening(client.rooms.work)}>
          <Line ok={workspaces} text={workspaces ? "agents/workspace/* created" : "npm run agents:setup"} />
          <p className="text-[12px] leading-relaxed text-white/75">
            Switch Console → Your Agents → + → name <span className="font-mono">{writer}</span> / <span className="font-mono">{designer}</span>, provider Claude Code, Directory <span className="font-mono text-[11px]">agents\workspace\&lt;name&gt;</span>. Then in {client.rooms.work}:{" "}
            <span className="font-mono">!invite-agent {writer}</span>, <span className="font-mono">!invite-agent {designer}</span>.
          </p>
        </Section>

        <Section icon={Share2} title="Postiz (optional)" ok={postiz.configured && !postizError}>
          <p className="text-[12px] text-fog">Only used for channels a client hasn&apos;t connected directly (e.g. YouTube). Direct connections (Connections page) come first.</p>
          <Line ok={postiz.configured} text={postiz.configured ? postiz.url : "Not set — direct publishing and dry runs only"} />
          {postizError && <p className="text-[11.5px] text-red-200">{postizError}</p>}
          <ul className="space-y-1">
            {client.channels.map((c) => {
              const Icon = platformIcon[c.platform];
              const match = integrations?.find((i) => i.id === c.postizIntegrationId);
              return (
                <li key={c.platform} className="flex items-center gap-2 text-[12px]">
                  <Icon className="size-3.5 text-white/70" />
                  <span className="w-20 text-white/80">{platformLabel[c.platform].split(" ")[0]}</span>
                  <span className={c.postizIntegrationId ? "text-emerald-300" : "text-fog"}>{c.postizIntegrationId ? (match?.name ?? "mapped") : "not mapped"}</span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section icon={Mic} title="Wispr Flow — voice" ok>
          <p className="text-[12px] text-white/75">Dictation that types into any text box — nothing to connect. Your team uses it in Create, the editor and Telegram.</p>
        </Section>
      </div>
    </ScrollMain>
  );
}

function Section({ icon: Icon, title, ok, children }: { icon: LucideIcon; title: string; ok: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-lime" strokeWidth={1.75} />
        <p className="flex-1 text-[13.5px] font-medium">{title}</p>
        <span className={cn("rounded-md px-2 py-0.5 text-[11px]", ok ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-200")}>{ok ? "OK" : "Needs setup"}</span>
      </div>
      {children}
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
