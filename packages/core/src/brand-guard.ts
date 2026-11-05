import type { Caption, CheckResult, Client, Post } from "./types";

// Deterministic pre-check that runs before any draft reaches a client.
// The Brand Guard agent (Codex) still reviews tone and visuals; this covers
// everything rules.md marks as machine-checkable.

export type GuardInput = Pick<Post, "captions" | "creativeText" | "platforms" | "format">;
export type GuardResult = { checks: CheckResult[]; captions: Caption[]; creativeText: string; passed: boolean };

const PRICE = /₹\s?\d[\d,.]*(?:\s?(?:L|Lakh|Lakhs|Cr|Crore)\b)?/gi; // only used with .replace (resets lastIndex)
const hasPrice = (t: string) => /₹\s?\d/.test(t);
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const CAPTION_LIMIT: Record<string, number> = { instagram: 2200, facebook: 63206, linkedin: 3000, youtube: 5000 };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, phrase: string) => text.toLowerCase().includes(phrase.toLowerCase());

export function runBrandGuard(input: GuardInput, client: Client, opts: { autoFix: boolean }): GuardResult {
  const rules = client.checks;
  const checks: CheckResult[] = [];
  let captions = input.captions.map((c) => ({ ...c }));
  let creativeText = input.creativeText;
  const allText = () => [creativeText, ...captions.map((c) => c.text)].join("\n");

  // Instagram stories carry no caption: their message lives on the creative, so rules that
  // apply to "every caption" are checked against the creative text instead.
  const story = input.format === "Story";
  const texts = () => (story ? [{ lang: "story", text: creativeText }, ...captions] : captions);

  // 0. there is something to check
  checks.push(
    story
      ? { id: "captions", label: "Text on the story", ok: creativeText.trim().length > 0, detail: creativeText.trim() ? undefined : "Add the text shown on the story." }
      : {
          id: "captions",
          label: "Caption written for every language",
          ok: captions.length > 0 && captions.every((c) => c.text.trim().length > 0),
          detail: captions.length ? undefined : "No caption yet — Copywriter hasn't delivered.",
        },
  );

  // 1. banned claims
  if (rules.banned?.length) {
    const found = rules.banned.filter((b) => has(allText(), b));
    checks.push({ id: "banned", label: "No banned claims (rules.md)", ok: !found.length, detail: found.length ? `Found: ${found.join(", ")}` : undefined });
  }

  // 2. competitor names
  if (rules.competitors?.length) {
    const found = rules.competitors.filter((b) => has(allText(), b));
    checks.push({ id: "competitors", label: "No competitor names", ok: !found.length, detail: found.length ? `Found: ${found.join(", ")}` : undefined });
  }

  // 3. risky words with a safe replacement (e.g. "cures" → "helps with")
  if (rules.replace) {
    const hits = Object.keys(rules.replace).filter((w) => new RegExp(`\\b${escape(w)}\\b`, "i").test(allText()));
    if (hits.length && opts.autoFix) {
      const fix = (t: string) =>
        Object.entries(rules.replace!).reduce((acc, [w, r]) => acc.replace(new RegExp(`\\b${escape(w)}\\b`, "gi"), r), t);
      captions = captions.map((c) => ({ ...c, text: fix(c.text) }));
      creativeText = fix(creativeText);
      checks.push({ id: "replace", label: "No cure or result claims", ok: true, fixed: hits.map((h) => `“${h}” → “${rules.replace![h]}”`).join(", ") });
    } else {
      checks.push({ id: "replace", label: "No cure or result claims", ok: !hits.length, detail: hits.length ? `Found: ${hits.join(", ")}` : undefined });
    }
  }

  // 4. price wording: "onwards" after every price, plus the T&C footnote
  if (rules.price && hasPrice(allText())) {
    const word = rules.price.requireWord;
    const footnote = rules.price.footnote;
    const fixes: string[] = [];
    let ok = true;

    const accepted = [word, ...(rules.price.alsoAccept ?? [])].filter((w): w is string => Boolean(w)).map((w) => w.toLowerCase());

    const fixText = (t: string) => {
      let out = t;
      if (word) {
        out = out.replace(PRICE, (m, offset: number, whole: string) => {
          const after = whole.slice(offset + m.length, offset + m.length + 14).toLowerCase().trimStart();
          if (accepted.some((w) => after.startsWith(w))) return m;
          ok = false;
          if (!opts.autoFix) return m;
          fixes.push(`added “${word}” after ${m.trim()}`);
          return `${m} ${word}`;
        });
      }
      return out;
    };
    captions = captions.map((c) => ({ ...c, text: fixText(c.text) }));
    creativeText = fixText(creativeText);

    if (footnote) {
      captions = captions.map((c) => {
        if (!hasPrice(c.text) || has(c.text, footnote)) return c;
        ok = false;
        if (!opts.autoFix) return c;
        fixes.push(`added “${footnote}” to ${c.lang} caption`);
        return { ...c, text: `${c.text.trimEnd()}\n${footnote}` };
      });
    }

    const fixedAll = !ok && opts.autoFix;
    checks.push({
      id: "price",
      label: `Price says “${word ?? "onwards"}” + ${footnote ?? "T&C"}`,
      ok: ok || fixedAll,
      fixed: fixedAll ? [...new Set(fixes)].join("; ") : undefined,
      detail: !ok && !opts.autoFix ? "A price is missing the required wording." : undefined,
    });
  }

  // Project posts are the ones that mention a product from products.md
  const isProjectPost = client.products.some((p) => has(allText(), p));

  // 5. RERA number on project creatives
  if (rules.requireRera && isProjectPost && client.reraNumbers.length) {
    const present = client.reraNumbers.some((r) => creativeText.includes(r));
    if (!present && opts.autoFix) {
      creativeText = [creativeText.trim(), `RERA ${client.reraNumbers[0]}`].filter(Boolean).join(" · ");
      checks.push({ id: "rera", label: "RERA number on creative", ok: true, fixed: `Added RERA ${client.reraNumbers[0]} to the end card` });
    } else {
      checks.push({ id: "rera", label: "RERA number on creative", ok: present, detail: present ? undefined : "Missing on the creative." });
    }
  }

  // 6. CTA on every caption variant of a project post
  if (rules.requireCta?.length && isProjectPost) {
    const all = texts();
    const missing = all.filter((c) => !rules.requireCta!.some((cta) => has(c.text, cta)));
    checks.push({
      id: "cta",
      label: story ? `“${rules.requireCta[0]}” CTA on the story` : `“${rules.requireCta[0]}” CTA in every caption`,
      ok: all.length > 0 && !missing.length,
      detail: missing.length ? `Missing in: ${missing.map((m) => m.lang).join(", ")} — Copywriter needs to add it.` : undefined,
    });
  }

  // 7. required text (e.g. doctor registration number)
  for (const req of rules.requireText ?? []) {
    const all = texts();
    const missing = all.filter((c) => !has(c.text, req.text));
    checks.push({
      id: `text-${req.text}`,
      label: req.label,
      ok: all.length > 0 && !missing.length,
      detail: missing.length ? `Missing “${req.text}” in: ${missing.map((m) => m.lang).join(", ")}` : undefined,
    });
  }

  // 8. hashtag limits per platform — trims the extras when auto-fix is on
  for (const platform of input.platforms) {
    const max = rules.maxHashtags?.[platform];
    if (max === undefined) continue;
    const over = captions.filter((c) => (c.text.match(HASHTAG) ?? []).length > max);
    if (over.length && opts.autoFix) {
      captions = captions.map((c) => {
        let n = 0;
        const text = c.text.replace(HASHTAG, (tag) => (++n <= max ? tag : ""));
        return { ...c, text: text.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n").trimEnd() };
      });
      checks.push({ id: `hashtags-${platform}`, label: `Max ${max} hashtags on ${platform}`, ok: true, fixed: `Trimmed to ${max} hashtags` });
    } else {
      checks.push({
        id: `hashtags-${platform}`,
        label: `Max ${max} hashtags on ${platform}`,
        ok: !over.length,
        detail: over.length ? `${over.map((c) => c.lang).join(", ")} over the limit` : undefined,
      });
    }
  }

  // 9. platform caption length
  const tooLong = input.platforms.filter((p) => captions.some((c) => c.text.length > (CAPTION_LIMIT[p] ?? Infinity)));
  if (tooLong.length) {
    checks.push({ id: "length", label: "Caption fits platform limits", ok: false, detail: `Too long for ${tooLong.join(", ")}` });
  }

  return { checks, captions, creativeText, passed: checks.every((c) => c.ok) };
}
