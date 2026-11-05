import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-claude-"));
process.env.BOLO_IGNORE_ENV_FILE = "1";

const { toWritten, writeSchema } = await import("./claude");
const wf = await import("./workflow");
const { resetStore } = await import("./store");

test("schema asks for slides only on carousels and scenes only on reels", () => {
  assert.ok(!("slides" in writeSchema("Post").properties));
  assert.deepEqual(writeSchema("Carousel").required.at(-1), "slides");
  assert.deepEqual(writeSchema("Reel").required.at(-1), "reel");
});

test("normalises Claude's answer: trims, strips #, keeps valid voices", () => {
  const w = toWritten(
    {
      title: "  Weekend site visits  ",
      brief: "Goal · families",
      creativeText: "Luxe 28 · ₹78 L onwards*",
      tag: "#sitevisit",
      captions: [{ lang: "EN", text: " Visit us " }, { lang: "MR", text: "" }],
      reel: { voiceLang: "xx-YY", speaker: "nobody", cta: "Book now", scenes: [{ text: "Hook", voice: "नमस्कार" }, { text: "", voice: "skip" }] },
    },
    "Reel",
  );
  assert.equal(w.title, "Weekend site visits");
  assert.equal(w.tag, "sitevisit");
  assert.deepEqual(w.captions, [{ lang: "EN", text: "Visit us" }]);
  assert.equal(w.reel?.voiceLang, "en-IN");
  assert.equal(w.reel?.speaker, "priya");
  assert.equal(w.reel?.scenes.length, 1);
});

test("an answer without captions is refused (stories may skip them)", () => {
  assert.throws(() => toWritten({ title: "x", captions: [] }, "Post"), /caption/);
  assert.doesNotThrow(() => toWritten({ title: "x", captions: [] }, "Story"));
});

test("a Claude idea starts as a draft that shows it's being written", async () => {
  resetStore();
  const post = await wf.createIdea({ clientId: "pushpam-demo", text: "Diwali site visit offer", author: "Kamran", format: "Post", mode: "claude" });
  assert.equal(post.status, "draft");
  assert.match(post.job?.step ?? "", /Claude/);
});
