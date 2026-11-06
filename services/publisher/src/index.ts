import { serve } from "@hono/node-server";
import { Hono, type MiddlewareHandler } from "hono";
import { knownRooms, listIntegrations, loadStore, markLive, postizConfig, repoRoot, switchConfig, WorkflowError } from "@bolo/core";
import { handleRoomMessage, type RoomMessage } from "./room";
import { SwitchAgent } from "./switch-agent";
import { bridgeUrl } from "./switch-config";
import { writeEnv } from "./env-file";

repoRoot(); // locate the repo and load .env before reading config
await loadStore();

const app = new Hono();
const secret = process.env.PUBLISHER_WEBHOOK_SECRET ?? "";

// Live Switch connection — the Publisher listens in every room it has been invited to.
let agent: SwitchAgent | null = null;
// Switch Console can pick new ports when it restarts its local server — keep .env (read by the
// web app) pointing at the current one.
try {
  const live = bridgeUrl();
  if (process.env.SWITCH_AGENT_ID && live !== (process.env.SWITCH_BRIDGE_URL ?? "").replace(/\/$/, "")) {
    writeEnv({ SWITCH_BRIDGE_URL: live });
    console.log(`Switch: bridge moved → ${live} (.env updated)`);
  }
} catch {
  // no local server and no configured URL — reported by /health
}
if (switchConfig().configured) {
  agent = new SwitchAgent();
  agent.start();
} else {
  console.log("Switch: not registered yet — run `npm run switch:register -- --local`, then restart.");
}

app.onError((err, c) => {
  if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

// Webhooks must carry the shared secret; never accept unauthenticated scheduling triggers.
const requireSecret: MiddlewareHandler = async (c, next) => {
  if (!secret || c.req.header("x-bolo-secret") !== secret) return c.json({ error: "Bad secret" }, 401);
  await next();
};
app.use("/switch/*", requireSecret);
app.use("/webhooks/*", requireSecret);

app.get("/health", (c) => {
  const { configured, url } = postizConfig();
  return c.json({
    ok: true,
    postiz: { configured, url: url || null, mode: configured ? "live" : "dry-run" },
    switch: {
      registered: switchConfig().configured,
      status: agent?.status ?? "not-registered",
      error: agent?.lastError ?? null,
      rooms: knownRooms().map((r) => r.name),
      listening: (agent?.claimedRooms ?? []).map((id) => knownRooms().find((r) => r.id === id)?.name ?? id),
    },
  });
});

/** Local-only diagnostics: raw Switch response shapes (no credentials). Refuses non-local callers. */
app.get("/debug/switch", async (c) => {
  const ip = (c.env as { incoming?: { socket?: { remoteAddress?: string } } })?.incoming?.socket?.remoteAddress ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) return c.json({ error: "Local only" }, 403);
  if (!agent) return c.json({ error: "Switch not registered" }, 400);
  return c.json(await agent.diagnostics());
});

app.get("/integrations", async (c) => {
  if (!postizConfig().configured) return c.json({ error: "POSTIZ_API_KEY not set" }, 400);
  return c.json(await listIntegrations());
});

/** Test relay for approval-room messages (the live path is the Switch WebSocket). */
app.post("/switch/messages", async (c) => {
  const body = await c.req.json<Partial<RoomMessage>>();
  if (!body.room || !body.author || !body.text) return c.json({ error: "room, author and text are required" }, 400);
  return c.json(await handleRoomMessage(body as RoomMessage));
});

/**
 * Postiz → Publisher when a post goes out. Field names vary between Postiz
 * versions, so accept the common ones and match on our id or Postiz's.
 */
app.post("/webhooks/postiz", async (c) => {
  const b = await c.req.json<Record<string, unknown>>();
  const status = String(b.status ?? b.state ?? "published").toLowerCase();
  if (!["published", "publish", "success", "live"].includes(status)) return c.json({ ignored: true, status });

  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const post = await markLive({
    postId: str(b.boloPostId),
    postizId: str(b.postizId) ?? str(b.postId) ?? str(b.id),
    permalink: str(b.permalink) ?? str(b.releaseURL) ?? str(b.url),
  });
  return c.json({ ok: true, post: { id: post.id, status: post.status } });
});

const port = Number(process.env.PUBLISHER_PORT ?? 4100);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Publisher on http://localhost:${port} · Postiz ${postizConfig().configured ? "connected" : "dry-run (no POSTIZ_API_KEY)"}`);
});

process.on("SIGINT", () => {
  agent?.stop();
  process.exit(0);
});
