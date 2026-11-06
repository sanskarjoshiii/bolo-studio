import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-publish-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
delete process.env.AUTH_SECRET;

const { readStore, updateStore } = await import("./store");
const { publishDirect } = await import("./publish");

// Any network call here would mean a post went out — none may happen
let networkCalls = 0;
globalThis.fetch = (async () => {
  networkCalls++;
  return new Response("{}", { status: 500 });
}) as typeof fetch;

async function scheduledDirectPost(claim?: { by: string; at: string }) {
  const id = readStore().posts[0].id;
  await updateStore((d) => {
    const p = d.posts.find((x) => x.id === id)!;
    p.status = "scheduled";
    p.publish = { via: "direct", claim };
    p.thread = [];
  });
  return id;
}

test("a post another server is publishing right now is left alone", async () => {
  const id = await scheduledDirectPost({ by: "other-server", at: new Date().toISOString() });
  await publishDirect(id);
  const p = readStore().posts.find((x) => x.id === id)!;
  assert.equal(p.publish?.claim?.by, "other-server", "the claim isn't stolen");
  assert.equal(p.thread.length, 0, "nothing happened");
  assert.equal(networkCalls, 0);
});

test("a stale claim (the other server died) is taken over", async () => {
  const id = await scheduledDirectPost({ by: "dead-server", at: new Date(Date.now() - 60 * 60_000).toISOString() });
  await publishDirect(id);
  const p = readStore().posts.find((x) => x.id === id)!;
  assert.equal(p.publish?.claim, undefined, "claim released after the attempt");
  assert.equal(p.publish?.attempts ?? 0, 0, "no platform is connected in this test, so nothing was tried");
});
