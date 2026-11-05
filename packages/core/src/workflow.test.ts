import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolated store per run; POSTIZ_API_KEY unset → Publisher runs in dry-run mode.
process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-"));
process.env.POSTIZ_API_KEY = "";
process.env.BOLO_IGNORE_ENV_FILE = "1"; // never let a real key in .env reach tests

const wf = await import("./workflow");
const { resetStore, readStore } = await import("./store");

before(() => resetStore());

test("seeded posts are consistent with their Brand Guard results", () => {
  for (const p of readStore().posts) {
    if (p.status === "draft") continue;
    const passed = p.checks.every((c) => c.ok);
    assert.equal(passed, p.status !== "brand-check", `${p.id} (${p.status}) checks passed=${passed}`);
  }
});

test("idea → caption → Brand Guard → approval → scheduled (dry run) → live", async () => {
  const idea = await wf.createIdea({ clientId: "pushpam-demo", text: "Weekend site visit carousel for Luxe 28", author: "Akshay" });
  assert.equal(idea.status, "draft");
  assert.equal(idea.format, "Carousel");

  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Luxe 28 from ₹78 L. Book a site visit this Sunday." }] });
  const checked = await wf.submitForApproval(idea.id);
  assert.equal(checked.status, "awaiting", JSON.stringify(checked.checks));
  assert.match(checked.captions[0].text, /onwards/);

  await assert.rejects(() => wf.approve(idea.id, "@random_person"), /Only approvers listed in protocol.md/);

  const scheduled = await wf.clientReply(idea.id, { handle: "@sj_pushpam", text: "approve" }); // backup approver
  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.dryRun, true);
  assert.match(scheduled.thread.at(-1)!.text, /Scheduled ✅/);

  const live = await wf.markLive({ postizId: scheduled.postizId, permalink: "https://instagram.com/p/test" });
  assert.equal(live.status, "live");
});

test("a failing draft stays in brand-check until an agent fixes it", async () => {
  const idea = await wf.createIdea({ clientId: "pushpam-demo", text: "Luxe 28 teaser", author: "Akshay" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Luxe 28 — guaranteed returns!" }] });
  const r = await wf.submitForApproval(idea.id);
  assert.equal(r.status, "brand-check");
  await assert.rejects(() => wf.approve(idea.id, "@rk_pushpam"), /isn't waiting for approval/);
});

test("agents' brief edits are validated against the client", async () => {
  const idea = await wf.createIdea({ clientId: "pushpam-demo", text: "Reel for Luxe 28", author: "bolo-writer" });
  assert.equal(idea.format, "Reel");
  await assert.rejects(() => wf.updatePost(idea.id, { platforms: ["youtube"] }), /Platforms for Pushpam Infra/);
  await assert.rejects(() => wf.updatePost(idea.id, { format: "Video" as never }), /Format must be/);
  await assert.rejects(() => wf.updatePost(idea.id, { reel: { scenes: [{ text: " " }] } }), /needs scenes/);

  const p = await wf.updatePost(idea.id, {
    platforms: ["instagram"],
    tag: "diwali",
    brief: "Goal: site visits · Families in Baner",
    reel: { voiceLang: "mr-IN", scenes: [{ text: "Is Diwali ghari ka?", voice: "Is Diwali, tumchya navin gharat." }] },
  });
  assert.deepEqual(p.platforms, ["instagram"]);
  assert.equal(p.tag, "#diwali");
  assert.equal(p.reel?.scenes.length, 1);

  const preview = wf.previewBrandGuard(idea.id);
  assert.equal(preview.passed, false); // no captions yet
  assert.equal(wf.agentName("writer"), "bolo-writer");
});

test("composer choices: format decides where it can go; stories need text on the creative", async () => {
  const story = await wf.createIdea({ clientId: "pushpam-demo", text: "Open house this Sunday", author: "Kamran", format: "Story", mode: "self" });
  assert.equal(story.format, "Story");
  assert.deepEqual(story.platforms, ["instagram", "facebook"]); // no LinkedIn stories
  assert.match(story.note!, /add captions and media/);
  await assert.rejects(
    () => wf.createIdea({ clientId: "pushpam-demo", text: "x", author: "K", format: "Story", platforms: ["linkedin"] }),
    /can go to: instagram, facebook/,
  );

  let r = await wf.submitForApproval(story.id);
  assert.equal(r.checks.find((c) => c.id === "captions")?.ok, false); // no story text yet
  await wf.updatePost(story.id, { creativeText: "Luxe 28 open house · Sunday 11 AM · Book a site visit · RERA P52100012345" });
  r = await wf.submitForApproval(story.id);
  assert.equal(r.status, "awaiting", JSON.stringify(r.checks.filter((c) => !c.ok)));

  const carousel = await wf.createIdea({ clientId: "pushpam-demo", text: "3 reasons to pick Luxe 28", author: "K", format: "Carousel", mode: "self" });
  assert.equal(carousel.slides?.length, 1);
  await assert.rejects(() => wf.updatePost(carousel.id, { slides: Array.from({ length: 11 }, (_, i) => ({ headline: `S${i}` })) }), /1–10 slides/);
  const s = await wf.updatePost(carousel.id, { slides: [{ headline: "3 reasons", text: " " }, { headline: "Baner location", text: "5 min to the link road" }] });
  assert.deepEqual(s.slides, [{ headline: "3 reasons", text: undefined }, { headline: "Baner location", text: "5 min to the link road" }]);

  // switching a LinkedIn post to a story drops LinkedIn
  const post = await wf.createIdea({ clientId: "pushpam-demo", text: "Tower update", author: "K", format: "Post", platforms: ["linkedin", "instagram"], mode: "self" });
  assert.deepEqual((await wf.updatePost(post.id, { format: "Story" })).platforms, ["instagram"]);
});

test("“change: …” from the client sends the post back to production", async () => {
  const idea = await wf.createIdea({ clientId: "my-brand", text: "Lessons from day 2", author: "Kamran" });
  await wf.updatePost(idea.id, { captions: [{ lang: "EN", text: "Day 2: we split the Publisher into its own service." }] });
  await wf.submitForApproval(idea.id);
  const r = await wf.clientReply(idea.id, { handle: "@pathankamran_03", text: "change: mention the Postiz webhook" });
  assert.equal(r.status, "draft");
  assert.match(r.note!, /Postiz webhook/);
});
