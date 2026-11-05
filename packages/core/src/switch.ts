import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { setting } from "./env";

// Outbound side of the Switch integration, usable from any process (web app or Publisher).
// The Publisher keeps data/switch-rooms.json up to date as it learns which rooms it's in;
// anything that wants to post into a client's room looks the room up by name here.

/** externalId: the messaging app's own chat id (Telegram chat id for Telegram rooms). */
export type RoomInfo = { id: string; name: string; externalId?: string; app?: string };

function dataDir() {
  return process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data");
}

const roomsFile = () => join(dataDir(), "switch-rooms.json");

export function knownRooms(): RoomInfo[] {
  const f = roomsFile();
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as RoomInfo[]) : [];
}

export function rememberRooms(rooms: RoomInfo[]) {
  const byId = new Map(knownRooms().map((r) => [r.id, r]));
  for (const r of rooms) byId.set(r.id, { ...byId.get(r.id), ...r, externalId: r.externalId ?? byId.get(r.id)?.externalId, app: r.app ?? byId.get(r.id)?.app });
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${roomsFile()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify([...byId.values()], null, 2));
  renameSync(tmp, roomsFile());
}

export function switchConfig() {
  repoRoot(); // loads .env
  const url = setting("SWITCH_BRIDGE_URL").replace(/\/$/, "");
  const id = setting("SWITCH_AGENT_ID");
  const key = setting("SWITCH_AGENT_API_KEY");
  return { url, id, key, configured: Boolean(url && id && key) };
}

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
// Switch names bridged rooms "<App>: <channel>", e.g. "Telegram: Pushpam × 7P Approvals";
// Brand Kits write Mattermost channels as "#pushpam-work"
const stripApp = (s: string) => s.replace(/^\s*(telegram|mattermost|slack|discord|microsoft teams|teams)\s*:\s*/i, "").replace(/^\s*#/, "");

/** True when two room names refer to the same channel, ignoring the "Telegram: " style prefix. */
export function sameRoom(a: string, b: string) {
  return norm(stripApp(a)) === norm(stripApp(b));
}

export function findRoomByName(name: string) {
  return knownRooms().find((r) => sameRoom(r.name, name));
}

export type Delivery = { ok: true } | { ok: false; reason: string };

/**
 * Post a message as the Publisher into the room with this name. Never throws — a missing chat
 * connection must not block the workflow — but says why delivery failed so callers can show it.
 */
export async function postToRoom(roomName: string, content: string): Promise<Delivery> {
  const cfg = switchConfig();
  if (!cfg.configured) return { ok: false, reason: "Publisher isn't registered with Switch (npm run switch:register)" };
  const room = findRoomByName(roomName);
  if (!room) return { ok: false, reason: `the Publisher hasn't joined “${roomName}” yet — start it and !invite-agent @bolo-publisher there` };
  try {
    const res = await fetch(`${cfg.url}/agents/${cfg.id}/message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: room.id, content }),
    });
    if (res.ok) return { ok: true };
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    console.error(`Switch post to “${roomName}” failed: ${res.status} ${detail}`);
    return { ok: false, reason: `Switch answered ${res.status}${detail ? `: ${detail}` : ""}` };
  } catch (e) {
    console.error(`Switch post to “${roomName}” failed:`, (e as Error).message);
    return { ok: false, reason: `Switch unreachable at ${cfg.url} — is the local server running?` };
  }
}
