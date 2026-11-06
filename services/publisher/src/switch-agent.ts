import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import { agentName, getStudio, knownRooms, postToRoom, rememberRooms, repoRoot, sameRoom, WorkflowError } from "@bolo/core";

// The Publisher works for the agency across every company (Switch is a platform service).
const AGENCY = { id: "agent:bolo-publisher", role: "admin" as const };
import { handleRoomMessage } from "./room";
import { agentCredentials, bridgeUrl } from "./switch-config";

// Live connection to Switch (docs: switch-rooms/internals/agent-connection + agent-events).
// The server pings every 2s and drops a connection that misses 6s of pongs, so pongs are
// sent before any event is processed.

type Frame = { type?: string; [k: string]: unknown };
type ConnState = { connectionId: string; cursor?: number; generation?: number };

const stateFile = () => join(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), "switch-connection.json");

function loadState(): ConnState {
  const f = stateFile();
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")) as ConnState;
  return { connectionId: randomUUID() };
}

function saveState(s: ConnState) {
  const f = stateFile();
  mkdirSync(join(f, ".."), { recursive: true });
  writeFileSync(f, JSON.stringify(s, null, 2));
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Registry name used by `npm run switch:register`. */
const PUBLISHER_NAME = "bolo-publisher";

/**
 * Telegram @username of a message sender. The Telegram bridge builds participant ids from the
 * sender's real account: "@switch-telegram-<bridge_id>-<username>:<server>" (seen live; Switch
 * exposes no other username field). Display names can be spoofed, so only this id is trusted,
 * and only when its bridge id matches the bridge the message arrived through.
 */
export function telegramHandle(senderId: string, bridgeId: string | undefined) {
  const m = senderId.match(/^@switch-telegram-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([A-Za-z0-9_]{5,32}):[^\s]+$/i);
  if (!m || (bridgeId && m[1].toLowerCase() !== bridgeId.toLowerCase())) return null;
  return `@${m[2]}`;
}
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);

export class SwitchAgent {
  private ws: WebSocket | null = null;
  private state = loadState();
  private stopped = false;
  private backoff = 1000;
  private readonly cred = agentCredentials();
  private readonly base = bridgeUrl();
  status: "connecting" | "connected" | "disconnected" | "stopped" = "disconnected";
  lastError: string | null = null;
  /** Last frames received (type + payload shape), for /switch/debug. Never includes credentials. */
  recentFrames: { at: string; type: string; sample: string }[] = [];

  private roomTimer: NodeJS.Timeout | null = null;

  start() {
    this.stopped = false;
    this.open();
    // A room the Publisher was just invited to sends nothing to an unclaimed connection,
    // so look for new rooms periodically as well as on events.
    this.roomTimer = setInterval(() => {
      if (this.status === "connected") void this.syncRooms();
    }, 30_000);
  }

  stop() {
    this.stopped = true;
    this.status = "stopped";
    if (this.roomTimer) clearInterval(this.roomTimer);
    this.ws?.close(1000);
  }

  // ---------- connection ----------

  private open() {
    const q = new URLSearchParams({ connection_id: this.state.connectionId, scope: "all", filter: "all" });
    if (this.state.cursor !== undefined) q.set("start_from", String(this.state.cursor));
    if (this.state.generation !== undefined) q.set("expected_generation", String(this.state.generation));
    const url = `${this.base.replace(/^http/, "ws")}/agents/${this.cred.id}/connection/ws?${q}`;

    this.status = "connecting";
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${this.cred.key}` } });
    this.ws = ws;

    ws.on("open", () => {
      this.status = "connected";
      this.backoff = 1000;
      this.lastError = null;
      console.log("Switch: connected");
    });
    ws.on("message", (raw) => this.onFrame(raw.toString()));
    ws.on("unexpected-response", (_req, res) => {
      this.lastError = `Switch refused the connection: HTTP ${res.statusCode}`;
      console.error(this.lastError);
    });
    ws.on("error", (e) => {
      this.lastError = e.message;
    });
    ws.on("close", (code, reason) => this.onClose(code, reason.toString()));
  }

  private onClose(code: number, reason: string) {
    this.status = "disconnected";
    if (this.stopped) return;
    if (code === 4401) {
      this.lastError = "Switch rejected the agent API key (4401). Re-run: npm run switch:register -- --force";
      console.error(this.lastError);
      this.status = "stopped";
      return;
    }
    if (code === 4409) {
      this.lastError = "Another Publisher process took over this connection (4409). This one stops.";
      console.error(this.lastError);
      this.status = "stopped";
      return;
    }
    console.log(`Switch: closed (${code}${reason ? ` ${reason}` : ""}), reconnecting in ${this.backoff / 1000}s`);
    setTimeout(() => this.open(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30_000);
  }

  private send(frame: Frame) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(frame));
  }

  private advance(seq: number | undefined) {
    if (seq !== undefined && (this.state.cursor === undefined || seq > this.state.cursor)) {
      this.state.cursor = seq;
      saveState(this.state);
    }
  }

  private onFrame(raw: string) {
    let f: Frame;
    try {
      f = JSON.parse(raw) as Frame;
    } catch {
      return;
    }

    // Server frames are {event, data, id?}; domain events carry room_id/payload/sequence in data.
    const kind = String(f.event ?? f.type ?? "");
    const d = (f.data && typeof f.data === "object" ? f.data : f) as Frame;
    const seq = num(f.id) ?? num(d.sequence);

    if (kind !== "ping") {
      this.recentFrames = [{ at: new Date().toISOString(), type: kind, sample: raw.slice(0, 800) }, ...this.recentFrames].slice(0, 15);
    }

    switch (kind) {
      case "ping":
        // Answer before anything else — 6s without a pong and the server evicts the connection
        this.send({ type: "pong", cursor: this.state.cursor ?? 0 });
        return;
      case "connection_state": {
        this.state.generation = num(d.generation) ?? this.state.generation;
        const cursor = num(d.cursor);
        if (cursor !== undefined && (this.state.cursor === undefined || cursor > this.state.cursor)) this.state.cursor = cursor;
        saveState(this.state);
        this.claimed = new Set(Array.isArray(d.rooms) ? (d.rooms as unknown[]).map(String) : []);
        void this.syncRooms();
        return;
      }
      case "gap":
        this.advance(num(d.resumed_at));
        return;
      case "evicted": {
        const code = str(d.code) ?? str(d.reason) ?? "";
        if (code === "taken_over") {
          this.lastError = "Another Publisher process took over this connection.";
          this.stop();
        } else {
          this.ws?.close(4000, code); // e.g. heartbeat_lapsed → reconnect and resume from cursor
        }
        return;
      }
      case "refused":
        this.lastError = `Switch refused: ${JSON.stringify(d).slice(0, 300)}`;
        console.error(this.lastError);
        // A stale generation/cursor is the usual cause — start fresh on the next open
        this.state = { connectionId: this.state.connectionId };
        saveState(this.state);
        return;
      case "subscription_changed":
      case "room_released":
        if (Array.isArray(d.rooms)) this.claimed = new Set((d.rooms as unknown[]).map(String));
        void this.syncRooms();
        return;
      case "room_join":
        void this.syncRooms();
        this.advance(seq);
        return;
      case "message":
        void this.onMessage(d).finally(() => this.advance(seq));
        return;
      default:
        this.advance(seq);
    }
  }

  /** Rooms this connection currently covers (from connection_state / subscription_changed). */
  private claimed = new Set<string>();

  /**
   * Learn room names, then make sure every client's approvals and work room is claimed on this
   * connection (POST /connection/subscribe) — a fresh agent starts with no rooms claimed.
   * Work rooms are where the Publisher hands new ideas and Brand Guard results to the agents.
   */
  private async syncRooms() {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.joinBrandKitRooms();
      await this.subscribeRooms();
    } finally {
      this.syncing = false;
    }
  }

  private syncing = false;
  /** Recent room-sync events, newest first (shown in /debug/switch). */
  syncLog: string[] = [];
  private note(m: string) {
    console.log(`Switch: ${m}`);
    this.syncLog = [`${new Date().toISOString().slice(11, 19)} ${m}`, ...this.syncLog].slice(0, 20);
  }
  /** agent@room → retry-after timestamp, so a missing agent isn't re-invited every 30 s. */
  private inviteBackoff = new Map<string, number>();

  /**
   * Brand Kits (client.json) say which rooms each client uses. Join them, and bring the content
   * agents into the work rooms, so nobody has to type !invite-agent by hand.
   */
  private async joinBrandKitRooms() {
    const clients = getStudio(AGENCY).map((s) => s.client);
    const mine = await this.refreshRooms();
    let all: { id: string; name: string }[] | null = null;

    for (const c of clients) {
      for (const [name, kind] of [
        [c.rooms.approvals, "approvals"],
        [c.rooms.work, "work"],
      ] as const) {
        let room = mine.find((r) => sameRoom(r.name, name));
        if (!room) {
          all ??= await this.listAllRooms();
          const found = all.find((r) => sameRoom(r.name, name));
          if (!found) {
            this.note(`room “${name}” not found on the server yet`);
            continue;
          }
          if (await this.invite(found.id, PUBLISHER_NAME, found.name)) room = found;
          else continue;
        }
        if (kind === "work") {
          const present = await this.agentsIn(room.id);
          for (const agent of [agentName("writer"), agentName("designer")]) {
            if (!present.includes(agent)) await this.invite(room.id, agent, room.name);
          }
        }
      }
    }
    await this.refreshRooms();
  }

  private async listAllRooms() {
    try {
      const result = await this.op<unknown>("list_all_rooms");
      const list = (Array.isArray(result) ? result : ((result as { rooms?: unknown[] })?.rooms ?? [])) as Record<string, unknown>[];
      return list.map((r) => ({ id: str(r.room_id) ?? str(r.id) ?? "", name: str(r.name) ?? "" })).filter((r) => r.id && r.name);
    } catch (e) {
      this.note(`list_all_rooms failed — ${(e as Error).message.slice(0, 200)}`);
      return [];
    }
  }

  private async agentsIn(roomId: string): Promise<string[]> {
    try {
      const d = await this.op<{ agent_names?: unknown }>("get_room_detail", { room_id: roomId });
      return Array.isArray(d?.agent_names) ? d.agent_names.map(String) : [];
    } catch {
      return [];
    }
  }

  private async invite(roomId: string, agent: string, roomName: string) {
    const key = `${agent}@${roomId}`;
    if ((this.inviteBackoff.get(key) ?? 0) > Date.now()) return false;
    try {
      await this.op("invite_agent_to_room", { room_id: roomId, agent_name: agent });
      this.note(`added ${agent} to “${roomName}”`);
      this.inviteBackoff.delete(key);
      return true;
    } catch (e) {
      // Usually the agent isn't created in Switch Console yet — try again later
      this.inviteBackoff.set(key, Date.now() + 10 * 60_000);
      this.note(`couldn't add ${agent} to “${roomName}” yet — ${(e as Error).message.slice(0, 200)}`);
      return false;
    }
  }

  /** Claim every Brand Kit room the Publisher belongs to on this connection. */
  private async subscribeRooms() {
    const rooms = knownRooms();
    const wanted = getStudio(AGENCY).flatMap((s) => [s.client.rooms.approvals, s.client.rooms.work]);
    for (const name of wanted) {
      const room = rooms.find((r) => sameRoom(r.name, name));
      if (!room || this.claimed.has(room.id)) continue;
      try {
        const res = await fetch(`${this.base}/agents/${this.cred.id}/connection/subscribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.cred.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ connection_id: this.state.connectionId, room_id: room.id, takeover: true }),
        });
        if (res.ok) {
          this.claimed.add(room.id);
          console.log(`Switch: listening in “${room.name}”`);
        } else {
          this.lastError = `subscribe ${room.name} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
          console.error("Switch:", this.lastError);
        }
      } catch (e) {
        this.lastError = (e as Error).message;
      }
    }
  }

  get claimedRooms() {
    return [...this.claimed];
  }

  // ---------- operations ----------

  private async op<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(`${this.base}/agents/${this.cred.id}/ops/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cred.key}`,
        "Content-Type": "application/json",
        "X-Switch-Connection-Id": this.state.connectionId,
      },
      body: JSON.stringify(args),
    });
    const body = (await res.json().catch(() => ({}))) as { result?: T; detail?: unknown };
    if (!res.ok) throw new Error(`op ${name} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return body.result as T;
  }

  /** Raw shapes from the live server, to check against what the docs describe. */
  async diagnostics() {
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch (e) {
        return { error: (e as Error).message };
      }
    };
    const catalog = await safe(async () => {
      const res = await fetch(`${this.base}/agents/${this.cred.id}/ops`, { headers: { Authorization: `Bearer ${this.cred.key}` } });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    const rooms = await safe(() => this.op("list_rooms"));
    const allRooms = await safe(() => this.listAllRooms());
    return {
      syncLog: this.syncLog,
      list_all_rooms: allRooms,
      status: this.status,
      lastError: this.lastError,
      connectionState: { cursor: this.state.cursor, generation: this.state.generation, claimed: [...this.claimed] },
      catalog,
      list_rooms: rooms,
      recentFrames: this.recentFrames,
    };
  }

  /** Learn the names of the rooms this agent is in, so core can post to “Pushpam × 7P Approvals” by name. */
  async refreshRooms() {
    try {
      const result = await this.op<unknown>("list_rooms");
      const list = (Array.isArray(result) ? result : ((result as { rooms?: unknown[] })?.rooms ?? [])) as Record<string, unknown>[];
      const rooms = list
        .map((r) => ({ id: str(r.room_id) ?? str(r.id) ?? "", name: str(r.name) ?? str(r.title) ?? str(r.display_name) ?? "" }))
        .filter((r) => r.id && r.name);
      if (rooms.length) rememberRooms(rooms);

      // Telegram chat ids let Bolo send the actual media to approval groups (Switch relays text only)
      const known = new Map(knownRooms().map((r) => [r.id, r]));
      for (const r of rooms) {
        if (known.get(r.id)?.externalId) continue;
        try {
          const d = await this.op<Record<string, unknown>>("get_room_detail", { room_id: r.id });
          const externalId = str(d?.external_channel_id) ?? (typeof d?.external_channel_id === "number" ? String(d.external_channel_id) : undefined);
          if (externalId) rememberRooms([{ id: r.id, name: r.name, externalId, app: str(d?.bridge_display_name) ?? r.name.split(":")[0] }]);
        } catch {
          // not a member of every listed room — fine
        }
      }
      return rooms;
    } catch (e) {
      this.lastError = (e as Error).message;
      console.error("Switch: list_rooms failed —", this.lastError);
      return [];
    }
  }

  private roomIdOf(f: Frame) {
    const p = (f.payload ?? {}) as Record<string, unknown>;
    return str(f.room_id) ?? str(p.room_id) ?? str(f.room) ?? "";
  }

  private async roomName(roomId: string) {
    const known = knownRooms().find((r) => r.id === roomId);
    if (known) return known.name;
    try {
      const d = await this.op<Record<string, unknown>>("get_room_detail", { room_id: roomId });
      const name = str(d?.name) ?? str(d?.title) ?? str(d?.display_name);
      if (name) rememberRooms([{ id: roomId, name }]);
      return name ?? null;
    } catch {
      return null;
    }
  }

  // ---------- messages ----------

  private async onMessage(f: Frame) {
    const p = (f.payload ?? f) as Record<string, unknown>;
    const text = (str(p.body) ?? "").trim().replace(/^\//, "");
    if (!/^(approve|change|reject)\b/i.test(text)) return;

    const roomId = this.roomIdOf(f);
    const room = roomId ? await this.roomName(roomId) : null;
    if (!room) return;
    const entry = getStudio(AGENCY).find((s) => sameRoom(s.client.rooms.approvals, room));
    if (!entry) return; // not an approvals room — ignore

    const handle = telegramHandle(str(p.sender) ?? "", str(f.bridge_id));

    try {
      if (!handle && !entry.client.groupApproves) {
        throw new WorkflowError(403, "I couldn't see your Telegram username — set one in Telegram → Settings → Username, then ask your Bolo team to add it as an approver.");
      }
      await handleRoomMessage({ room, author: handle ?? (str(p.sender) ?? "Telegram group"), text });
      // Success messages ("Scheduled ✅", "Noted …") are posted by the workflow itself.
    } catch (e) {
      const msg = e instanceof WorkflowError ? e.message : "Something went wrong scheduling that — the team has been notified.";
      if (!(e instanceof WorkflowError)) console.error(e);
      await postToRoom(room, msg);
    }
  }
}
