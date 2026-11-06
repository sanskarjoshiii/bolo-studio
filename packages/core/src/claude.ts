import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runAI, type AiRequest } from "./ai";
import { repoRoot } from "./brand-kit";
import { loadClient } from "./companies";
import { runBrandGuard } from "./brand-guard";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { formatSlot, LANG_LABEL, LANG_NAME, languagePlan, LAYOUT_IDS, LAYOUTS, sizeFor, VOICE_CODE } from "./shared";
import { readStore, updateStore } from "./store";
import type { Caption, Client, Post, ReelScript, Slide } from "./types";

// The AI writes the post: brief, headline, text on the creative, captions per language, design
// hints, plus carousel slides or reel scenes. It runs on the company's own AI key (ai.ts), or on
// this machine's Claude Code login for the agency's own companies. The answer must match a JSON
// schema; Brand Guard then checks it and the AI gets one chance to fix what it can't fix itself.

const VOICE_LANGS = ["mr-IN", "hi-IN", "en-IN", "gu-IN", "ta-IN", "te-IN", "kn-IN", "bn-IN"];
const SPEAKERS = ["priya", "ritu", "neha", "kavya", "shreya", "shubh", "rahul", "aditya", "rohan", "amit"];

/** The Claude Code executable: CLAUDE_BIN, else the npm-installed native binary, else `claude` on PATH. */
export function claudeBin() {
  const configured = setting("CLAUDE_BIN");
  if (configured) return configured;
  if (process.platform === "win32") {
    const npm = join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(npm)) return npm;
  }
  return "claude";
}

export function claudeAvailable() {
  const bin = claudeBin();
  return bin === "claude" || existsSync(bin);
}

export type Written = {
  title: string;
  brief: string;
  creativeText: string;
  tag: string;
  captions: Caption[];
  layout?: string;
  /** The one word of the headline set in the accent colour, and a 2–4 word button label. */
  design?: { highlight?: string; cta?: string };
  slides?: Slide[];
  reel?: ReelScript;
};

/** JSON schema the answer must match — exported for tests. */
export function writeSchema(format: Post["format"]) {
  const props: Record<string, unknown> = {
    title: { type: "string", description: "Headline printed big on the creative, max 40 characters" },
    brief: { type: "string", description: "Goal · audience · angle, 1–3 short lines" },
    creativeText: { type: "string", description: "Short text on the creative: product · key line · price onwards*" },
    tag: { type: "string", description: "One tag without #" },
    captions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: { lang: { type: "string" }, text: { type: "string" } },
        required: ["lang", "text"],
        additionalProperties: false,
      },
    },
    highlight: { type: "string", description: "One word copied exactly from the title to set in the accent colour (empty for none)" },
    cta: { type: "string", description: "Call-to-action button text, 2–4 words, in the post's first language" },
  };
  const required = ["title", "brief", "creativeText", "tag", "captions", "highlight", "cta"];
  if (format !== "Reel") {
    props.layout = { type: "string", enum: LAYOUT_IDS, description: "Designed layout for the image" };
    required.push("layout");
  }
  if (format === "Carousel") {
    props.slides = {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: { headline: { type: "string" }, text: { type: "string" } },
        required: ["headline", "text"],
        additionalProperties: false,
      },
    };
    required.push("slides");
  }
  if (format === "Reel") {
    props.reel = {
      type: "object",
      properties: {
        voiceLang: { type: "string", enum: VOICE_LANGS },
        speaker: { type: "string", enum: SPEAKERS },
        cta: { type: "string" },
        scenes: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            properties: { text: { type: "string" }, voice: { type: "string" } },
            required: ["text", "voice"],
            additionalProperties: false,
          },
        },
      },
      required: ["voiceLang", "speaker", "cta", "scenes"],
      additionalProperties: false,
    };
    required.push("reel");
  }
  return { type: "object", properties: props, required, additionalProperties: false };
}

const SYSTEM = `You are the strategist, copywriter and art director of Bolo Studio, a content studio in Pune, India.
You turn one spoken idea into a finished social post for a client, following that client's Brand Kit exactly.

How to write:
- The Brand Kit is the source of truth: brand.md (voice), rules.md (never/always — every line applies), products.md (facts,
  prices, RERA numbers), audience.md, examples.md, protocol.md. Never invent facts, prices, dates, numbers or offers that
  aren't in the Brand Kit or the idea.
- Write like a sharp local copywriter, not a template. Concrete beats generic: name the place, the product, the number,
  the day. Avoid filler and stock phrases ("unlock", "elevate", "dream home awaits", "look no further", "game-changer",
  "in today's world"), exclamation-mark stacks and emoji in headlines. One idea per post.
- title: the headline printed big on the image — max 40 characters, no hashtags, no emoji, sentence case.
- highlight: one word copied exactly from the title that carries the message (a number, the place, the offer); the
  design sets it in the accent colour. Leave it empty when no single word deserves it.
- cta: the button on the design, 2–4 words ("Book a site visit", "Call to book").
- creativeText: the short supporting text printed on the image, segments separated by " · "
  (e.g. "Luxe 28 · 2 & 3 BHK · ₹78 L onwards*"). Every price is followed by "onwards*".
- captions: one per language in LANGUAGES, in that order, each labelled with its tab name (given in LANGUAGES).
  Marathi and Hindi captions are written in Devanagari; English words that people actually say may mix in.
  Each caption: a hook line, a short body, the call to action rules.md requires, then hashtags (Instagram max 8).
  When a price appears, every price says "onwards*" and the caption ends with "*T&C apply".
- Stories have no caption on Instagram: the message AND the required call to action go in creativeText too.
- Carousel slides: slide 1 is the cover hook, one idea per slide, the last slide is the call to action.
  Headline max 45 characters, supporting text max 80.
- Reel scenes: 3–6 scenes; the first is a hook that works in 2 seconds. "text" is the short on-screen line (max 6 words),
  in the second language of LANGUAGES when there are two (so viewers who don't speak the voice language still follow),
  else the first. "voice" is what the voiceover says, in the first language, in its own script. voiceLang is the
  first language's voice code.
- layout (posts, stories, carousels): pick the design that fits the message —
${LAYOUT_IDS.map((id) => `  ${id}: ${LAYOUTS[id].hint}`).join("\n")}
  Photo layouts (hero, split) only when ATTACHED REFERENCES lists photos; a festival greeting without an offer → festive.
  On wide sizes (landscape, 16:9) prefer split or editorial; on tall sizes any layout works.
- Respond only with the JSON object.`;

function kitText(client: Client) {
  return client.files
    .filter((f) => f.name.endsWith(".md") || f.name === "tokens.json")
    .map((f) => `=== ${f.name} ===\n${f.content.trim()}`)
    .join("\n\n");
}

/** "Marathi (tab: मराठी, voice: mr-IN) then English (tab: EN)" — or the Brand Kit default. */
export function languageLine(languages?: string) {
  const plan = languagePlan(languages);
  if (!plan) return "LANGUAGES: as the idea asks; if it doesn't say, the Brand Kit's usual languages (brand.md), else English (tab: EN).";
  return `LANGUAGES: ${plan.langs.map((l, i) => `${LANG_NAME[l]} (tab: ${LANG_LABEL[l]}${i === 0 ? `, voice code: ${VOICE_CODE[l]}` : ""})`).join(", then ")}`;
}

function prompt(post: Post, client: Client, fixes?: string[]) {
  const refs = (post.media ?? []).filter((m) => m.source !== "template");
  const idea = post.thread.find((m) => !m.from.match(/^(Brand Guard|Publisher|Telegram|Switch|Drive|Claude|AI)$/))?.text ?? post.title;
  const size = sizeFor(post);
  return [
    `CLIENT: ${client.name} (${client.sector})`,
    `FORMAT: ${post.format}`,
    `SIZE: ${size.w} × ${size.h} px (${size.w > size.h * 1.2 ? "wide" : size.h > size.w * 1.2 ? "tall" : "square-ish"})`,
    `PLATFORMS: ${post.platforms.join(", ")}`,
    `POST TIME: ${formatSlot(post.scheduledAt)} IST`,
    languageLine(post.languages),
    `IDEA (spoken by the team): ${idea}`,
    refs.length ? `ATTACHED REFERENCES: ${refs.map((m) => `${m.name} (${m.kind})`).join(", ")}` : "ATTACHED REFERENCES: none (no photos)",
    "",
    "BRAND KIT:",
    kitText(client),
    fixes?.length ? `\nYOUR PREVIOUS DRAFT FAILED THESE BRAND CHECKS — FIX ALL OF THEM:\n${fixes.map((f) => `- ${f}`).join("\n")}` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Stop a child and what it started (Windows keeps grandchildren alive otherwise). */
function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => undefined);
  else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

/** Run Claude Code headless with a JSON schema; returns the structured output. Cancellable. */
export function runClaude(input: AiRequest): Promise<unknown> {
  const bin = claudeBin();
  const work = join(process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data"), ".cache", "claude");
  mkdirSync(work, { recursive: true }); // neutral cwd: no project CLAUDE.md or settings leak into the answer
  const args = [
    "-p",
    "--output-format",
    "json",
    "--tools",
    "",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--system-prompt",
    input.system,
    "--json-schema",
    JSON.stringify(input.schema),
  ];
  const model = setting("CLAUDE_MODEL");
  if (model) args.push("--model", model);

  return new Promise((resolve, reject) => {
    if (input.signal?.aborted) return reject(new WorkflowError(409, "Cancelled."));
    const child = spawn(bin, args, { cwd: work, windowsHide: true, env: process.env });
    let out = "";
    let err = "";
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () => {
      killTree(child.pid);
      done(() => reject(new WorkflowError(409, "Cancelled.")));
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      killTree(child.pid);
      done(() => reject(new WorkflowError(409, "Claude took too long (over 3 minutes) — try again.")));
    }, input.timeoutMs ?? 180_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) =>
      done(() =>
        reject(new WorkflowError(409, `No AI connected, and Claude Code isn't available here (${e.message}). Connect an AI agent in Connections.`)),
      ),
    );
    child.on("close", () =>
      done(() => {
        try {
          const j = JSON.parse(out) as { is_error?: boolean; result?: string; structured_output?: unknown; subtype?: string };
          if (j.is_error) return reject(new WorkflowError(409, `Claude: ${String(j.result ?? j.subtype).slice(0, 200)}`));
          if (j.structured_output) return resolve(j.structured_output);
          return resolve(JSON.parse(String(j.result ?? "")));
        } catch {
          reject(new WorkflowError(409, `Claude gave no usable answer${err ? ` — ${err.trim().split("\n").at(-1)?.slice(0, 200)}` : ""}. Is Claude Code signed in (claude auth login)?`));
        }
      }),
    );
    child.stdin.end(input.prompt);
  });
}

/** Normalise the AI's answer into post fields (defensive: trims, caps lengths, keeps valid enums). */
export function toWritten(raw: unknown, format: Post["format"]): Written {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const captions = (Array.isArray(o.captions) ? o.captions : [])
    .map((c) => ({ lang: s((c as Caption).lang, 20) || "EN", text: s((c as Caption).text, 2200) }))
    .filter((c) => c.text);
  if (!captions.length && format !== "Story") throw new WorkflowError(409, "The AI didn't write a caption — try again.");
  const title = s(o.title, 80) || "Untitled";
  const out: Written = {
    title,
    brief: s(o.brief, 600),
    creativeText: s(o.creativeText, 200),
    tag: s(o.tag, 30).replace(/^#/, ""),
    captions,
  };
  // The highlight must be a word that is really in the headline, or the design can't find it
  const highlight = s(o.highlight, 40);
  const cta = s(o.cta, 40);
  const inTitle = highlight && title.toLowerCase().split(/\s+/).some((w) => w.replace(/[^\p{L}\p{N}₹%]/gu, "") === highlight.toLowerCase().replace(/[^\p{L}\p{N}₹%]/gu, ""));
  if (inTitle || cta) out.design = { ...(inTitle ? { highlight } : {}), ...(cta ? { cta } : {}) };
  if (format !== "Reel" && LAYOUT_IDS.includes(o.layout as never)) out.layout = String(o.layout);
  if (format === "Carousel" && Array.isArray(o.slides)) {
    out.slides = o.slides
      .map((x) => ({ headline: s((x as Slide).headline, 60), text: s((x as Slide).text, 120) || undefined }))
      .filter((x) => x.headline)
      .slice(0, 10);
  }
  if (format === "Reel" && o.reel && typeof o.reel === "object") {
    const r = o.reel as Record<string, unknown>;
    const scenes = (Array.isArray(r.scenes) ? r.scenes : [])
      .map((x) => ({ text: s((x as { text: string }).text, 60), voice: s((x as { voice: string }).voice, 300) }))
      .filter((x) => x.text)
      .slice(0, 8);
    if (scenes.length) {
      out.reel = {
        voiceLang: VOICE_LANGS.includes(String(r.voiceLang)) ? String(r.voiceLang) : "en-IN",
        speaker: SPEAKERS.includes(String(r.speaker)) ? String(r.speaker) : "priya",
        cta: s(r.cta, 60),
        scenes,
      };
    }
  }
  return out;
}

/**
 * The AI writes the post. Brand Guard checks the draft; anything it can't auto-fix goes back to
 * the AI once. The result is saved as a draft — nothing is sent from here.
 */
export async function writeWithClaude(postId: string, opts: { signal?: AbortSignal } = {}): Promise<Written> {
  const post = readStore().posts.find((p) => p.id === postId);
  if (!post) throw new WorkflowError(404, "Post not found.");
  const client = loadClient(post.clientId);
  if (!client) throw new WorkflowError(404, "Client not found.");

  const ask = async (fixes?: string[]) => {
    const { result, provider } = await runAI(client.id, { system: SYSTEM, prompt: prompt(post, client, fixes), schema: writeSchema(post.format), signal: opts.signal }, runClaude);
    return { written: toWritten(result, post.format), provider };
  };
  let { written, provider } = await ask();
  const failing = (w: Written) =>
    runBrandGuard({ ...post, ...w, platforms: post.platforms, format: post.format }, client, { autoFix: true })
      .checks.filter((c) => !c.ok)
      .map((c) => `${c.label}${c.detail ? ` — ${c.detail}` : ""}`);

  const problems = failing(written);
  if (problems.length) ({ written, provider } = await ask(problems));
  if (opts.signal?.aborted) throw new WorkflowError(409, "Cancelled.");

  await updateStore((data) => {
    const p = data.posts.find((x) => x.id === postId);
    if (!p) return;
    p.title = written.title;
    p.brief = written.brief;
    p.creativeText = written.creativeText;
    p.tag = written.tag ? `#${written.tag}` : p.tag;
    p.captions = written.captions;
    p.design = written.design;
    if (written.layout) p.layout = written.layout;
    if (written.slides?.length) p.slides = written.slides;
    if (written.reel) p.reel = written.reel;
    p.checks = [];
    p.thread.push({
      from: provider,
      text: `Wrote the brief, headline and ${written.captions.map((c) => c.lang).join(" and ")} caption${written.captions.length > 1 ? "s" : ""}${written.slides ? `, ${written.slides.length} slides` : ""}${written.reel ? `, ${written.reel.scenes.length} reel scenes (${written.reel.voiceLang})` : ""}${problems.length ? ` — revised once for: ${problems.join("; ")}` : ""}.`,
      at: new Date().toISOString(),
    });
    p.updatedAt = new Date().toISOString();
  });
  return written;
}
