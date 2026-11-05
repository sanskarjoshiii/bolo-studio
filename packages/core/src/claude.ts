import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, loadClient } from "./brand-kit";
import { runBrandGuard } from "./brand-guard";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { formatSlot, LAYOUT_IDS, LAYOUTS } from "./shared";
import { readStore, updateStore } from "./store";
import type { Caption, Client, Post, ReelScript, Slide } from "./types";

// Claude writes the post: brief, headline, text on the creative, captions per language, plus
// carousel slides or reel scenes. It runs through the Claude Code CLI in headless mode
// (`claude -p`), so it uses the Claude login already on this machine — no API key. Tools are
// disabled and the answer must match a JSON schema; Brand Guard then checks it and Claude gets
// one chance to fix what Brand Guard can't fix itself.

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
  };
  const required = ["title", "brief", "creativeText", "tag", "captions"];
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

const SYSTEM = `You are the Strategist and Copywriter of Bolo Studio, a content studio at 7P Infomedia (Pune, India).
You turn one spoken idea into a finished social post for a client, strictly following that client's Brand Kit.

Rules:
- Follow brand.md (tone), rules.md (never/always — obey every line), products.md (facts, prices, RERA), audience.md, examples.md, protocol.md.
- Never invent facts, prices, dates or numbers that aren't in the Brand Kit or the idea.
- title: punchy headline printed big on the image, max 40 characters, no hashtags, no emoji.
- creativeText: short text printed on the image, segments separated by " · " (e.g. "Luxe 28 · 2 & 3 BHK · ₹78 L onwards*").
  Every price is followed by "onwards*".
- captions: one per language. Use the languages the idea asks for; if it doesn't say and the audience reads Marathi, write
  "MR + EN" (natural Marathi-English mix, Roman script) and "EN". Each caption: hook line, short body, the call to action
  required by rules.md, then hashtags (Instagram max 8). Every price "onwards*" and the caption ends with "*T&C apply" when a price appears.
- Stories have no caption on Instagram: put the message AND the required call to action in creativeText too.
- Carousel slides: slide 1 is the cover hook, one idea per slide, last slide is the call to action. Headline max 45 characters, text max 80.
- Reel scenes: 3–6 scenes, the first is a hook that works in 2 seconds. "text" = short on-screen line (max 6 words);
  "voice" = what the voiceover says, written in the voice language's own script (Marathi/Hindi in Devanagari; English words may mix in).
- layout (posts, stories, carousels): pick the design that fits the message —
${LAYOUT_IDS.map((id) => `  ${id}: ${LAYOUTS[id].hint}`).join("\n")}
  Photo layouts (hero, split) only when ATTACHED REFERENCES lists photos; a festival greeting without an offer → festive.
- Respond only with the JSON object.`;

function kitText(client: Client) {
  return client.files
    .filter((f) => f.name.endsWith(".md") || f.name === "tokens.json")
    .map((f) => `=== ${f.name} ===\n${f.content.trim()}`)
    .join("\n\n");
}

function prompt(post: Post, client: Client, fixes?: string[]) {
  const refs = (post.media ?? []).filter((m) => m.source !== "template");
  const idea = post.thread.find((m) => !m.from.match(/^(Brand Guard|Publisher|Telegram|Switch|Drive|Claude)$/))?.text ?? post.title;
  return [
    `CLIENT: ${client.name} (${client.sector})`,
    `FORMAT: ${post.format}`,
    `PLATFORMS: ${post.platforms.join(", ")}`,
    `POST TIME: ${formatSlot(post.scheduledAt)} IST`,
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

/** Run Claude Code headless with a JSON schema; returns the structured output. */
export function runClaude(input: { system: string; prompt: string; schema: object; timeoutMs?: number }): Promise<unknown> {
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
    const child = spawn(bin, args, { cwd: work, windowsHide: true, env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new WorkflowError(409, "Claude took too long (over 3 minutes) — try again."));
    }, input.timeoutMs ?? 180_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) =>
      reject(new WorkflowError(409, `Claude Code isn't available (${e.message}). Install it and run “claude auth login”, or set CLAUDE_BIN in .env.`)),
    );
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out) as { is_error?: boolean; result?: string; structured_output?: unknown; subtype?: string };
        if (j.is_error) return reject(new WorkflowError(409, `Claude: ${String(j.result ?? j.subtype).slice(0, 200)}`));
        if (j.structured_output) return resolve(j.structured_output);
        return resolve(JSON.parse(String(j.result ?? "")));
      } catch {
        reject(new WorkflowError(409, `Claude gave no usable answer${err ? ` — ${err.trim().split("\n").at(-1)?.slice(0, 200)}` : ""}. Is Claude Code signed in (claude auth login)?`));
      }
    });
    child.stdin.end(input.prompt);
  });
}

/** Normalise Claude's answer into post fields (defensive: trims, caps lengths, keeps valid enums). */
export function toWritten(raw: unknown, format: Post["format"]): Written {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const captions = (Array.isArray(o.captions) ? o.captions : [])
    .map((c) => ({ lang: s((c as Caption).lang, 20) || "EN", text: s((c as Caption).text, 2200) }))
    .filter((c) => c.text);
  if (!captions.length && format !== "Story") throw new WorkflowError(409, "Claude didn't write a caption — try again.");
  const out: Written = {
    title: s(o.title, 80) || "Untitled",
    brief: s(o.brief, 600),
    creativeText: s(o.creativeText, 200),
    tag: s(o.tag, 30).replace(/^#/, ""),
    captions,
  };
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
 * Claude writes the post. Brand Guard checks the draft; anything it can't auto-fix goes back to
 * Claude once. The result is saved as a draft — nothing is sent from here.
 */
export async function writeWithClaude(postId: string): Promise<Written> {
  const post = readStore().posts.find((p) => p.id === postId);
  if (!post) throw new WorkflowError(404, "Post not found.");
  const client = loadClient(post.clientId);
  if (!client) throw new WorkflowError(404, "Client not found.");

  let written = toWritten(await runClaude({ system: SYSTEM, prompt: prompt(post, client), schema: writeSchema(post.format) }), post.format);
  const failing = (w: Written) =>
    runBrandGuard({ ...post, ...w, platforms: post.platforms, format: post.format }, client, { autoFix: true })
      .checks.filter((c) => !c.ok)
      .map((c) => `${c.label}${c.detail ? ` — ${c.detail}` : ""}`);

  const problems = failing(written);
  if (problems.length) {
    written = toWritten(await runClaude({ system: SYSTEM, prompt: prompt(post, client, problems), schema: writeSchema(post.format) }), post.format);
  }

  await updateStore((data) => {
    const p = data.posts.find((x) => x.id === postId);
    if (!p) return;
    p.title = written.title;
    p.brief = written.brief;
    p.creativeText = written.creativeText;
    p.tag = written.tag ? `#${written.tag}` : p.tag;
    p.captions = written.captions;
    if (written.layout) p.layout = written.layout;
    if (written.slides?.length) p.slides = written.slides;
    if (written.reel) p.reel = written.reel;
    p.checks = [];
    p.thread.push({
      from: "Claude",
      text: `Wrote the brief, headline and ${written.captions.map((c) => c.lang).join(" and ")} caption${written.captions.length > 1 ? "s" : ""}${written.slides ? `, ${written.slides.length} slides` : ""}${written.reel ? `, ${written.reel.scenes.length} reel scenes (${written.reel.voiceLang})` : ""}${problems.length ? ` — revised once for: ${problems.join("; ")}` : ""}.`,
      at: new Date().toISOString(),
    });
    p.updatedAt = new Date().toISOString();
  });
  return written;
}
