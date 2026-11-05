import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClient } from "./brand-kit";
import { runBrandGuard, type GuardInput } from "./brand-guard";

const pushpam = loadClient("pushpam-demo")!;
const clinic = loadClient("clinic-demo")!;

const draft = (over: Partial<GuardInput> = {}): GuardInput => ({
  format: "Carousel",
  platforms: ["instagram"],
  creativeText: "Luxe 28 · Diwali at home",
  captions: [{ lang: "EN", text: "Luxe 28 — 2 & 3 BHK from ₹78 L. Book a site visit this weekend." }],
  ...over,
});

const check = (r: ReturnType<typeof runBrandGuard>, id: string) => r.checks.find((c) => c.id === id)!;

test("auto-fix adds “onwards”, the T&C footnote and the RERA number", () => {
  const r = runBrandGuard(draft(), pushpam, { autoFix: true });
  assert.equal(r.passed, true);
  assert.match(r.captions[0].text, /₹78 L onwards/);
  assert.match(r.captions[0].text, /\*T&C apply$/);
  assert.match(r.creativeText, /RERA P52100012345/);
  assert.ok(check(r, "price").fixed);
  assert.ok(check(r, "rera").fixed);
});

test("without auto-fix the same draft fails instead of being changed", () => {
  const input = draft();
  const r = runBrandGuard(input, pushpam, { autoFix: false });
  assert.equal(r.passed, false);
  assert.equal(check(r, "price").ok, false);
  assert.equal(check(r, "rera").ok, false);
  assert.equal(r.captions[0].text, input.captions[0].text);
});

test("an existing “onwards” is left alone", () => {
  const r = runBrandGuard(draft({ captions: [{ lang: "EN", text: "Luxe 28 from ₹78 L onwards*. Site visit Sunday.\n*T&C apply" }] }), pushpam, {
    autoFix: true,
  });
  assert.equal(check(r, "price").fixed, undefined);
  assert.equal((r.captions[0].text.match(/onwards/g) ?? []).length, 1);
});

test("“पासून” counts as “onwards” in Marathi captions", () => {
  const r = runBrandGuard(draft({ captions: [{ lang: "मराठी", text: "लक्स २८ — ₹78 L पासून. site visit करा.\n*T&C apply" }] }), pushpam, {
    autoFix: true,
  });
  assert.equal(check(r, "price").fixed, undefined);
  assert.doesNotMatch(r.captions[0].text, /onwards/);
});

test("trimming hashtags doesn't leave a dangling space before the footnote", () => {
  const tags = Array.from({ length: 10 }, (_, i) => `#t${i}`).join(" ");
  const r = runBrandGuard(draft({ captions: [{ lang: "EN", text: `Luxe 28 from ₹78 L. Site visit Sunday. ${tags}` }] }), pushpam, { autoFix: true });
  assert.doesNotMatch(r.captions[0].text, / \n/);
});

test("banned claims and competitors always fail — never silently rewritten", () => {
  const r = runBrandGuard(
    draft({ captions: [{ lang: "EN", text: "Luxe 28: guaranteed returns, better than Skyline Habitat. Site visit today." }] }),
    pushpam,
    { autoFix: true },
  );
  assert.equal(check(r, "banned").ok, false);
  assert.equal(check(r, "competitors").ok, false);
  assert.equal(r.passed, false);
});

test("every caption variant of a project post needs the site visit CTA", () => {
  const r = runBrandGuard(
    draft({
      captions: [
        { lang: "MR + EN", text: "Luxe 28 madhe navin ghar. Site visit this weekend." },
        { lang: "EN", text: "Your new home at Luxe 28." },
      ],
    }),
    pushpam,
    { autoFix: true },
  );
  assert.equal(check(r, "cta").ok, false);
  assert.match(check(r, "cta").detail!, /EN/);
});

test("non-project posts skip RERA and CTA rules", () => {
  const r = runBrandGuard(draft({ creativeText: "Shubh Deepavali", captions: [{ lang: "EN", text: "Shubh Deepavali from Pushpam Infra." }] }), pushpam, {
    autoFix: true,
  });
  assert.equal(r.passed, true);
  assert.equal(check(r, "rera"), undefined);
  assert.equal(check(r, "cta"), undefined);
});

test("hashtags over the platform limit are trimmed when auto-fix is on", () => {
  const tags = Array.from({ length: 11 }, (_, i) => `#t${i}`).join(" ");
  const r = runBrandGuard(draft({ creativeText: "Shubh Deepavali", captions: [{ lang: "EN", text: `Hello ${tags}` }] }), pushpam, { autoFix: true });
  assert.equal(r.captions[0].text.match(/#\w+/g)!.length, 8);
  assert.ok(check(r, "hashtags-instagram").fixed);
});

test("clinic: cure claims are softened, missing registration number fails", () => {
  const r = runBrandGuard(
    { format: "Reel", platforms: ["instagram"], creativeText: "", captions: [{ lang: "EN", text: "This habit cures dry eyes." }] },
    clinic,
    { autoFix: true },
  );
  assert.match(r.captions[0].text, /helps with dry eyes/);
  assert.equal(check(r, "replace").ok, true);
  assert.equal(check(r, "text-Reg. No.").ok, false);
});
