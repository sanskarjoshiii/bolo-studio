import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-int-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";
process.env.POSTIZ_API_KEY = "";

const { postizBody, providerSettings, captionFor, publishMedia } = await import("./postiz");
const { sendMediaToRoom, previewMedia } = await import("./telegram");
const { rememberRooms } = await import("./switch");
const { multipartBody } = await import("./drive");
const { resetStore } = await import("./store");
const media = await import("./media");
import type { Post } from "./types";

const base = (over: Partial<Post> = {}): Post => ({
  id: "t1",
  clientId: "pushpam-demo",
  title: "Diwali at home",
  format: "Post",
  platforms: ["instagram", "linkedin"],
  creative: "carousel",
  creativeText: "",
  scheduledAt: "2030-01-01T19:30:00+05:30",
  tag: "#x",
  status: "scheduled",
  captions: [{ lang: "EN", text: "Luxe 28 #a #b #c #d #e" }],
  checks: [],
  thread: [],
  createdAt: "",
  updatedAt: "",
  ...over,
});

test("Postiz settings: Instagram story vs post, LinkedIn carousel, YouTube title", () => {
  assert.equal(providerSettings("instagram", base({ format: "Story" })).post_type, "story");
  assert.equal(providerSettings("instagram", base()).post_type, "post");
  assert.equal(providerSettings("linkedin", base({ format: "Carousel" })).post_as_images_carousel, true);
  assert.equal(providerSettings("youtube", base({ format: "Reel", title: "Is Diwali ghari ka?" })).title, "Is Diwali ghari ka?");
});

test("Postiz captions: none on stories, max 3 hashtags on LinkedIn", () => {
  assert.equal(captionFor("instagram", base({ format: "Story" })), "");
  assert.equal(captionFor("linkedin", base()), "Luxe 28 #a #b #c");
  assert.equal(captionFor("instagram", base()), "Luxe 28 #a #b #c #d #e");
});

test("Postiz body: future → schedule, past → publish now", () => {
  const ch = [{ platform: "instagram" as const, postizIntegrationId: "ig1" }];
  const future = postizBody(base(), ch, [{ id: "m", path: "/p.png" }], new Date("2029-01-01"));
  assert.equal(future.type, "schedule");
  assert.equal(future.posts[0].integration.id, "ig1");
  assert.deepEqual(future.posts[0].value[0].image, [{ id: "m", path: "/p.png" }]);
  assert.equal(postizBody(base({ scheduledAt: "2020-01-01T10:00:00+05:30" }), ch, [], new Date("2029-01-01")).type, "now");
});

test("what gets published per format", () => {
  const img = (n: number) => ({ file: `i${n}.png`, name: `i${n}.png`, type: "image/png", kind: "image" as const, size: 1 });
  const vid = { file: "v.mp4", name: "v.mp4", type: "video/mp4", kind: "video" as const, size: 1 };
  assert.equal(publishMedia(base({ format: "Carousel", media: [img(1), img(2), img(3)] })).length, 3);
  assert.equal(publishMedia(base({ format: "Post", media: [img(1), img(2)] })).length, 1);
  assert.deepEqual(publishMedia(base({ format: "Reel", media: [img(1), vid] })), [vid]);
  assert.deepEqual(publishMedia(base({ format: "Reel", media: [img(1)] })), []);
  assert.deepEqual(publishMedia(base({ format: "Story", media: [img(1)] })), [img(1)]);
  assert.deepEqual(previewMedia(base({ format: "Story", media: [img(1), vid] })), [vid]);
});

test("Telegram: album for carousel slides, sent to the group id Switch reported", async () => {
  resetStore();
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  await media.addMedia("pp-sitevisit", { name: "s1.png", type: "image/png", bytes: PNG });
  const post = await media.addMedia("pp-sitevisit", { name: "s2.png", type: "image/png", bytes: PNG });
  const carousel = { ...post, format: "Carousel" as const };

  assert.match((await sendMediaToRoom("Pushpam × 7P Approvals", carousel)).ok ? "" : "no token", /no token/);

  process.env.TELEGRAM_BOT_TOKEN = "123:abc";
  assert.equal((await sendMediaToRoom("Pushpam × 7P Approvals", carousel)).ok, false); // group id unknown yet
  rememberRooms([{ id: "r1", name: "Telegram: Pushpam × 7P Approvals", externalId: "-5248966709", app: "Telegram" }]);

  const calls: { url: string; form: FormData }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, form: init.body as FormData });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await sendMediaToRoom("Pushpam × 7P Approvals", carousel);
    assert.equal(r.ok, true);
    assert.match(calls[0].url, /bot123:abc\/sendMediaGroup$/);
    assert.equal(calls[0].form.get("chat_id"), "-5248966709");
    const items = JSON.parse(String(calls[0].form.get("media"))) as { media: string; caption?: string }[];
    assert.deepEqual(items.map((i) => i.media), ["attach://file0", "attach://file1"]);
    assert.match(items[0].caption!, /#p[0-9a-f]{5}/);

    calls.length = 0;
    await sendMediaToRoom("Pushpam × 7P Approvals", { ...carousel, format: "Post" });
    assert.match(calls[0].url, /sendPhoto$/); // a post shows one image (up to 10 for carousels)
  } finally {
    globalThis.fetch = real;
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test("Drive multipart upload body", () => {
  const body = multipartBody({ name: "a.png", parents: ["F"] }, "image/png", new Uint8Array([1, 2, 3]), "B").toString("latin1");
  assert.match(body, /^--B\r\nContent-Type: application\/json; charset=UTF-8\r\n\r\n\{"name":"a.png","parents":\["F"\]\}\r\n--B\r\nContent-Type: image\/png\r\n\r\n\x01\x02\x03\r\n--B--$/);
});
