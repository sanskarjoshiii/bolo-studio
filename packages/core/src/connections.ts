import { AI_PROVIDERS, checkAiKey, type AiProvider } from "./ai";
import { getCompany } from "./companies";
import { claudeAvailable } from "./claude";
import { driveStatus } from "./drive";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { decrypt, encrypt, maskKey } from "./secrets";
import { linkedinConfigured, metaConfigured } from "./social";
import { updateStore } from "./store";
import { approvalsViaSwitch, telegramConfigured, telegramUpdatesMode } from "./telegram";
import { findRoomByName } from "./switch";

// What a company has connected, in a form that's safe to send to the browser (no keys or tokens),
// and the key-based connections (Sarvam, AI agent) that the client pastes once.

const nowIso = () => new Date().toISOString();

/** Sarvam key for a company's voiceovers: its own, else the platform's (agency demo). */
export function sarvamKey(companyId?: string) {
  const own = companyId ? getCompany(companyId)?.connections.sarvam : undefined;
  return own ? decrypt(own.key) : setting("SARVAM_API_KEY");
}

/** Check a Sarvam key with one tiny voice request before saving it. */
async function checkSarvamKey(key: string) {
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Namaste", language_code: "hi-IN", model: "bulbul:v3", speaker: "priya", output_audio_codec: "wav" }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res) throw new WorkflowError(409, "Couldn't reach Sarvam AI — check the internet connection and try again.");
  if (res.status === 401 || res.status === 403) throw new WorkflowError(400, "Sarvam rejected that key — copy it again from dashboard.sarvam.ai → API keys.");
  if (!res.ok) throw new WorkflowError(409, `Sarvam answered ${res.status} — the key may be out of credit.`);
}

export async function setSarvamKey(companyId: string, key: string) {
  const k = key.trim();
  if (k.length < 10) throw new WorkflowError(400, "Paste the whole Sarvam API key.");
  await checkSarvamKey(k);
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    c.connections.sarvam = { key: encrypt(k), connectedAt: nowIso() };
  });
}

export async function setAiConnection(companyId: string, input: { provider: AiProvider; key: string; model?: string }) {
  if (!AI_PROVIDERS.some((p) => p.id === input.provider)) throw new WorkflowError(400, "Pick Claude or OpenAI.");
  const key = input.key.trim();
  if (key.length < 20) throw new WorkflowError(400, "Paste the whole API key.");
  const model = input.model?.trim() || undefined;
  if (model && !/^[\w.:-]{2,80}$/.test(model)) throw new WorkflowError(400, "That model name doesn't look right.");
  await checkAiKey(input.provider, key, model); // a bad key fails here, not halfway through a post
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    c.connections.ai = { provider: input.provider, key: encrypt(key), model, connectedAt: nowIso() };
  });
}

export async function removeConnection(companyId: string, which: "sarvam" | "ai") {
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (c) delete c.connections[which];
  });
}

/** Everything the Connections page shows for one company — no secrets. */
export function connectionStatus(companyId: string) {
  const c = getCompany(companyId)?.connections ?? {};
  const drive = driveStatus(companyId);
  const aiProvider = c.ai ? AI_PROVIDERS.find((p) => p.id === c.ai!.provider) : undefined;
  return {
    telegram: (() => {
      const viaSwitch = approvalsViaSwitch() && !c.telegram;
      const room = getCompany(companyId)?.kit.meta.rooms?.approvals || null;
      // Switch-first: "connected" once the Publisher is in this company's approvals room
      const roomReady = Boolean(room && findRoomByName(room));
      return {
        available: telegramConfigured() || approvalsViaSwitch(),
        listening: telegramUpdatesMode() !== "off",
        viaSwitch,
        room,
        roomReady,
        connected: viaSwitch ? roomReady : Boolean(c.telegram),
        title: viaSwitch ? room : (c.telegram?.title ?? null),
        connectedAt: c.telegram?.connectedAt ?? null,
      };
    })(),
    meta: {
      available: metaConfigured(),
      connected: Boolean(c.meta),
      pageName: c.meta?.pageName ?? null,
      instagram: c.meta?.igUsername ? `@${c.meta.igUsername}` : c.meta?.igUserId ? "connected" : null,
      by: c.meta?.userName ?? null,
      pending: c.metaPending && Date.parse(c.metaPending.expiresAt) > Date.now() ? c.metaPending.pages.map((p) => ({ id: p.id, name: p.name, instagram: p.igUsername ?? null })) : null,
    },
    linkedin: {
      available: linkedinConfigured(),
      connected: Boolean(c.linkedin),
      name: c.linkedin?.name ?? null,
      expired: c.linkedin ? Date.parse(c.linkedin.expiresAt) < Date.now() : false,
      expiresAt: c.linkedin?.expiresAt ?? null,
    },
    drive: { available: drive.configured, connected: drive.connected, shared: drive.shared, email: drive.email, folder: drive.folder, designs: drive.designs, published: drive.published },
    sarvam: { connected: Boolean(c.sarvam), shared: !c.sarvam && Boolean(setting("SARVAM_API_KEY")), key: c.sarvam ? maskKey(decrypt(c.sarvam.key)) : null },
    ai: {
      connected: Boolean(c.ai),
      provider: c.ai?.provider ?? null,
      label: aiProvider?.label ?? null,
      model: c.ai?.model ?? aiProvider?.defaultModel ?? null,
      key: c.ai ? maskKey(decrypt(c.ai.key)) : null,
      // The agency's own machine can fall back to its Claude Code login
      local: !c.ai && setting("BOLO_LOCAL_CLAUDE") !== "off" && claudeAvailable(),
    },
  };
}

export type ConnectionStatus = ReturnType<typeof connectionStatus>;
