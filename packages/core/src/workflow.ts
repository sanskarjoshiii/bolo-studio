import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listClients, loadClient, repoRoot } from "./brand-kit";
import { runBrandGuard } from "./brand-guard";
import { schedulePost } from "./postiz";
import { postToRoom } from "./switch";
import { sendMediaToRoom } from "./telegram";
import { archiveToDrive } from "./drive";
import { DEFAULT_SETTINGS } from "./seed";
import { addDays, creativeTextHash, FORMAT_INFO, FORMATS, formatSlot, istIso, istParts, parseClock, PLATFORM_SHORT, postRef } from "./shared";
import { readStore, updateStore } from "./store";
import type { Caption, Client, ClientSettings, Platform, Post, PostFormat, ReelScript, Slide, StudioData } from "./types";

import { WorkflowError } from "./errors";
export { WorkflowError };

const nowIso = () => new Date().toISOString();

function requireClient(id: string): Client {
  const c = loadClient(id);
  if (!c) throw new WorkflowError(404, `Unknown client “${id}”.`);
  return c;
}

function findPost(data: StudioData, id: string) {
  const p = data.posts.find((x) => x.id === id);
  if (!p) throw new WorkflowError(404, `Post ${id} not found.`);
  return p;
}

function settingsFor(data: StudioData, clientId: string): ClientSettings {
  return (data.settings[clientId] ??= { ...DEFAULT_SETTINGS });
}

const schedSummary = (p: Post) => `${p.platforms.map((x) => PLATFORM_SHORT[x]).join(" + ")} ${formatSlot(p.scheduledAt)}`;

// ---------- reads ----------

export function getStudio() {
  const data = readStore();
  return listClients().map((client) => ({
    client,
    settings: data.settings[client.id] ?? { ...DEFAULT_SETTINGS },
    posts: data.posts.filter((p) => p.clientId === client.id).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  }));
}

export function getClientStudio(clientId: string) {
  const client = requireClient(clientId);
  const data = readStore();
  return {
    client,
    settings: data.settings[clientId] ?? { ...DEFAULT_SETTINGS },
    posts: data.posts.filter((p) => p.clientId === clientId).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  };
}

// ---------- writes ----------

/** Next protocol.md best time after now (tomorrow or later), so new ideas land on a sensible slot. */
export function nextBestSlot(client: Client, from = new Date()) {
  const times = client.bestTimes.map((b) => parseClock(b.time)).filter((m): m is number => m !== null);
  const minutes = times.length ? Math.max(...times) : 19 * 60 + 30;
  return istIso(addDays(istParts(from).dateKey, 1), minutes);
}

/** Platforms a format can go to, limited to the channels this client has connected. */
export function platformsFor(client: Client, format: PostFormat): Platform[] {
  const allowed = FORMAT_INFO[format].platforms as readonly string[];
  return client.channels.map((c) => c.platform).filter((p) => allowed.includes(p));
}

const guessFormat = (text: string): PostFormat =>
  /\breel\b/i.test(text) ? "Reel" : /\bstory\b/i.test(text) ? "Story" : /\bcarousel\b/i.test(text) ? "Carousel" : "Post";

export type NewContent = {
  clientId: string;
  text: string;
  author: string;
  /** Defaults to a guess from the idea text ("reel", "story", "carousel"). */
  format?: PostFormat;
  platforms?: Platform[];
  scheduledAt?: string;
  /** "agents" hands the idea to bolo-writer in the work room; "self" means a person writes it in the editor. */
  mode?: "agents" | "self";
};

export async function createIdea(input: NewContent): Promise<Post> {
  const text = input.text.trim();
  if (!text) throw new WorkflowError(400, "Say or type an idea first.");
  const client = requireClient(input.clientId);
  const format = input.format ?? guessFormat(text);
  if (!FORMATS.includes(format)) throw new WorkflowError(400, `Format must be ${FORMATS.join(", ")}.`);
  const possible = platformsFor(client, format);
  if (!possible.length) throw new WorkflowError(400, `${client.name} has no channel that takes a ${format.toLowerCase()}.`);
  const platforms = input.platforms?.length ? input.platforms : possible;
  const bad = platforms.filter((p) => !possible.includes(p));
  if (bad.length) throw new WorkflowError(400, `A ${format.toLowerCase()} for ${client.name} can go to: ${possible.join(", ")}.`);
  if (input.scheduledAt && Number.isNaN(Date.parse(input.scheduledAt))) throw new WorkflowError(400, "Invalid date.");
  const mode = input.mode ?? "agents";

  return updateStore((data) => {
    const { useBestTimes } = settingsFor(data, client.id);
    const post: Post = {
      id: randomUUID().slice(0, 8),
      clientId: client.id,
      title: text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text,
      format,
      platforms,
      creative: client.id === "clinic-demo" ? "clinic" : client.id === "my-brand" ? "personal" : "carousel",
      creativeText: "",
      // Off → tomorrow noon as a placeholder the Strategist will replace
      scheduledAt: input.scheduledAt ?? (useBestTimes ? nextBestSlot(client) : istIso(addDays(istParts(new Date()).dateKey, 1), 12 * 60)),
      tag: "#new",
      status: "draft",
      captions: [],
      checks: [],
      thread: [{ from: input.author, text, at: nowIso() }],
      note:
        mode === "agents"
          ? `Sent to @${agentName("writer")} in ${client.rooms.work} — the brief and captions appear here when ready`
          : "New idea — add captions and media, then run Brand Guard",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (format === "Carousel") post.slides = [{ headline: post.title }];
    data.posts.push(post);
    return post;
  }).then(async (post) => {
    if (mode !== "agents") return post;
    // Hand the idea to the content agents in the client's work room
    const writer = agentName("writer");
    const delivery = await postToRoom(
      client.rooms.work,
      `New ${format.toLowerCase()} ${postRef(post)} from ${input.author}: “${text}”\nPlatforms: ${platforms.join(", ")} · ${formatSlot(post.scheduledAt)} IST\n@${writer} please write the brief and captions${format === "Reel" || format === "Story" ? " and the scene script" : format === "Carousel" ? " and the slides" : ""} — start with: bolo show ${postRef(post)}`,
    );
    if (!delivery.ok) {
      return updateStore((data) => {
        const p = findPost(data, post.id);
        p.note = `Couldn't reach the agents (${delivery.reason}) — write it here instead`;
        return p;
      });
    }
    return post;
  });
}

export type PostPatch = {
  title?: string;
  captions?: Caption[];
  creativeText?: string;
  scheduledAt?: string;
  format?: PostFormat;
  platforms?: Platform[];
  tag?: string;
  brief?: string;
  reel?: ReelScript;
  slides?: Slide[];
};

export function updatePost(id: string, patch: PostPatch) {
  return updateStore((data) => {
    const post = findPost(data, id);
    if (post.status === "scheduled" || post.status === "live") {
      throw new WorkflowError(409, "Scheduled and live posts can't be edited here — change them in Postiz.");
    }
    const client = requireClient(post.clientId);
    if (patch.scheduledAt && Number.isNaN(Date.parse(patch.scheduledAt))) throw new WorkflowError(400, "Invalid date.");
    if (patch.format && !FORMATS.includes(patch.format)) throw new WorkflowError(400, `Format must be ${FORMATS.join(", ")}.`);
    const format = patch.format ?? post.format;
    if (patch.platforms) {
      const allowed = platformsFor(client, format);
      const bad = patch.platforms.filter((p) => !allowed.includes(p));
      if (bad.length || !patch.platforms.length) throw new WorkflowError(400, `Platforms for ${client.name}: ${allowed.join(", ")}.`);
    }
    if (patch.reel && (!Array.isArray(patch.reel.scenes) || !patch.reel.scenes.length || patch.reel.scenes.some((s) => !s?.text?.trim()))) {
      throw new WorkflowError(400, "A reel script needs scenes, each with on-screen text.");
    }
    if (patch.slides && (!Array.isArray(patch.slides) || patch.slides.length > 10 || patch.slides.some((s) => !s?.headline?.trim()))) {
      throw new WorkflowError(400, "Carousels take 1–10 slides, each with a headline.");
    }

    if (patch.captions) post.captions = patch.captions.filter((c) => c.text.trim()).map((c) => ({ lang: c.lang.trim() || "EN", text: c.text }));
    if (patch.title !== undefined) post.title = patch.title.trim() || post.title;
    if (patch.creativeText !== undefined) post.creativeText = patch.creativeText;
    if (patch.scheduledAt) post.scheduledAt = patch.scheduledAt;
    if (patch.format) post.format = patch.format;
    if (patch.platforms) post.platforms = patch.platforms;
    if (patch.tag !== undefined) post.tag = patch.tag.trim() ? `#${patch.tag.trim().replace(/^#/, "")}` : post.tag;
    if (patch.brief !== undefined) post.brief = patch.brief.trim() || undefined;
    if (patch.reel) post.reel = patch.reel;
    if (patch.slides) post.slides = patch.slides.map((s) => ({ headline: s.headline.trim(), text: s.text?.trim() || undefined }));
    // A format change can leave platforms the new format can't use (e.g. LinkedIn stories)
    if (patch.format && !patch.platforms) {
      const allowed = platformsFor(client, patch.format);
      post.platforms = post.platforms.filter((p) => allowed.includes(p));
      if (!post.platforms.length) post.platforms = allowed;
    }

    // Any content change invalidates the previous check and any pending approval
    if (patch.captions || patch.creativeText !== undefined || patch.title !== undefined || patch.reel || patch.format || patch.slides) {
      post.checks = [];
      if (post.status === "awaiting") post.thread.push({ from: "Brand Guard", text: "Draft changed — approval request withdrawn.", at: nowIso() });
      post.status = "draft";
      post.note = "Edited — run Brand Guard to send it again";
    }
    post.updatedAt = nowIso();
    return post;
  });
}

/**
 * Before rendering: apply Brand Guard's auto-fixes to the text printed on the creative (RERA no.,
 * "onwards"), so the image or video already shows what Brand Guard will approve — otherwise the
 * fix lands after the render and the media goes stale.
 */
export function prepareForRender(id: string) {
  return updateStore((data) => {
    const post = findPost(data, id);
    const client = requireClient(post.clientId);
    if (!settingsFor(data, client.id).autoFix) return post;
    const fixed = runBrandGuard(post, client, { autoFix: true }).creativeText;
    if (fixed !== post.creativeText) {
      post.creativeText = fixed;
      post.updatedAt = nowIso();
    }
    return post;
  });
}

/** Brand Guard result without changing anything — agents use it to self-check before submitting. */
export function previewBrandGuard(id: string) {
  const data = readStore();
  const post = findPost(data, id);
  const client = requireClient(post.clientId);
  const guard = runBrandGuard(post, client, { autoFix: settingsFor(data, client.id).autoFix });
  return { ref: postRef(post), passed: guard.passed, checks: guard.checks, captionsAfterFixes: guard.captions, creativeTextAfterFixes: guard.creativeText };
}

/** Brand Guard gate: fixes what it can, then either sends to the client or sends back to the agents. */
export function submitForApproval(id: string) {
  return updateStore((data) => {
    const post = findPost(data, id);
    if (post.status !== "draft" && post.status !== "brand-check") throw new WorkflowError(409, "Only drafts can be sent to Brand Guard.");
    const client = requireClient(post.clientId);
    const { autoFix } = settingsFor(data, client.id);
    const guard = runBrandGuard(post, client, { autoFix });

    post.captions = guard.captions;
    post.creativeText = guard.creativeText;
    post.checks = guard.checks;
    post.updatedAt = nowIso();

    // A template render prints the text as it was then — if Brand Guard (or an edit) changed
    // that text since, the published image would contradict the approved copy.
    const hash = creativeTextHash(post);
    const stale = (post.media ?? []).filter((m) => m.source === "template" && m.textHash !== hash);
    if (stale.length) {
      post.checks.push({
        id: "render",
        label: "Image matches the text on the creative",
        ok: false,
        detail: "The text changed after the media was rendered — re-render it (Generate from template, or bolo image / bolo reel).",
      });
    }
    const passed = guard.passed && !stale.length;

    const fixed = guard.checks.filter((c) => c.fixed);
    if (!passed) {
      const failing = guard.checks.filter((c) => !c.ok);
      post.status = "brand-check";
      post.note = `Brand Guard: ${failing.length} issue(s) need an agent`;
      return post;
    }

    post.status = "awaiting";
    post.note = undefined;
    const fixedLine = fixed.length ? ` Fixed ${fixed.length}: ${fixed.map((f) => f.fixed).join("; ")}.` : "";
    post.thread.push({
      from: "Brand Guard",
      text: `${post.title} ready ✅ ${guard.checks.length} checks passed.${fixedLine} Schedule: ${schedSummary(post)}. Reply: approve / change: <what>`,
      at: nowIso(),
    });
    return post;
  }).then(async (post) => {
    const client = requireClient(post.clientId);
    if (post.status === "awaiting") {
      await sendMediaFirst(post, client.rooms.approvals);
      await announce(post, approvalPackage(post));
      await toWorkRoom(post, `✅ ${postRef(post)} ${post.title} passed Brand Guard and went to ${client.rooms.approvals}.`);
    } else {
      const failing = post.checks.filter((c) => !c.ok).map((c) => `• ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
      await toWorkRoom(
        post,
        `❌ Brand Guard blocked ${postRef(post)} ${post.title}:\n${failing.join("\n")}\n@${agentName("writer")} please fix it, then run: bolo submit ${postRef(post)}`,
      );
    }
    return post;
  });
}

/** Content agents live in a fixed set of names (agents/team.json) so every client room can @mention them. */
export function agentName(role: "writer" | "designer") {
  try {
    const team = JSON.parse(readFileSync(join(repoRoot(), "agents", "team.json"), "utf8")) as Record<string, string>;
    return team[role] ?? `bolo-${role}`;
  } catch {
    return `bolo-${role}`;
  }
}

/**
 * The client approves what they can see: send the image / slides / video to the Telegram group
 * before the approval text. A missing file or token is noted on the post, never blocks it.
 */
async function sendMediaFirst(post: Post, room: string) {
  const sent = await sendMediaToRoom(room, post);
  if (!sent.ok) {
    await updateStore((data) => {
      const p = data.posts.find((x) => x.id === post.id);
      p?.thread.push({ from: "Telegram", text: `⚠ Preview not attached: ${sent.reason}`, at: nowIso() });
    });
  }
}

/** Status notes for the team and agents in the client's work room (best effort). */
async function toWorkRoom(post: Post, text: string) {
  const client = loadClient(post.clientId);
  if (client) await postToRoom(client.rooms.work, text);
}

const handleKey = (h: string) => h.replace(/^@/, "").trim().toLowerCase();

export function findApprover(client: Client, handle: string) {
  return client.approvers.find((a) => handleKey(a.handle) === handleKey(handle));
}

/** The message the client sees in Telegram — one short line per item, no tables (Telegram won't render them). */
function approvalPackage(post: Post) {
  const fixes = post.checks.filter((c) => c.fixed).map((c) => c.fixed);
  const caption = post.captions[0];
  return [
    `${post.title} — ready for approval ✅ ${postRef(post)}`,
    `${post.format} · ${schedSummary(post)} IST`,
    `Checked ${post.checks.length} brand rules${fixes.length ? ` · fixed: ${fixes.join("; ")}` : ""}`,
    "",
    caption ? `Caption (${caption.lang}):\n${caption.text}` : "",
    post.captions.length > 1 ? `(+ ${post.captions.slice(1).map((c) => c.lang).join(", ")} versions)` : "",
    "",
    `Reply: approve ${postRef(post)}  ·  change ${postRef(post)}: <what>`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n")
    .slice(0, 3900); // Telegram splits above 4096
}

/** Post into the client's approvals room through Switch; never fails the workflow. */
async function announce(post: Post, text: string) {
  const client = loadClient(post.clientId);
  if (!client) return;
  const delivery = await postToRoom(client.rooms.approvals, text);
  if (!delivery.ok) {
    // Make a missed delivery visible on the post instead of failing silently
    await updateStore((data) => {
      const p = data.posts.find((x) => x.id === post.id);
      p?.thread.push({ from: "Switch", text: `⚠ Not delivered to ${client.rooms.approvals}: ${delivery.reason}`, at: nowIso() });
    });
  }
}

/** Post the approval package to the client's Telegram room again (e.g. it wasn't delivered). */
export async function resendApproval(id: string) {
  const post = findPost(readStore(), id);
  if (post.status !== "awaiting") throw new WorkflowError(409, "Only posts waiting for approval can be resent.");
  const client = requireClient(post.clientId);
  await sendMediaFirst(post, client.rooms.approvals);
  const delivery = await postToRoom(client.rooms.approvals, approvalPackage(post));
  if (!delivery.ok) throw new WorkflowError(409, `Not delivered: ${delivery.reason}`);
  return updateStore((data) => {
    const p = findPost(data, id);
    p.thread.push({ from: "Brand Guard", text: `Resent to ${client.rooms.approvals}.`, at: nowIso() });
    return p;
  });
}

/**
 * A message from the client's Telegram approvals room (relayed by Switch), or an approver
 * acting from the dashboard. "approve" schedules the post; "change: …" sends it back.
 */
export async function clientReply(id: string, input: { handle: string; text: string; via?: "telegram" | "dashboard" }) {
  const text = input.text.trim();
  const snapshot = findPost(readStore(), id);
  const client = requireClient(snapshot.clientId);
  const approver = findApprover(client, input.handle);

  if (/^approve\b/i.test(text)) return approve(id, input.handle, input.via);

  const change = text.match(/^change\b(?:\s*#\w+)?\s*:\s*([\s\S]+)$/i);
  if (change && !approver) throw new WorkflowError(403, "Only approvers listed in protocol.md can request changes.");

  const post = await updateStore((data) => {
    const post = findPost(data, id);
    post.thread.push({ from: approver?.name ?? input.handle, text, at: nowIso(), client: true });
    if (change && post.status === "awaiting") {
      post.status = "draft";
      post.note = `Change requested: ${change[1].trim()}`;
      post.thread.push({ from: "Brand Guard", text: "Noted → sent back to the right agent. I'll re-check and resend.", at: nowIso() });
    }
    post.updatedAt = nowIso();
    return post;
  });
  if (change && post.status === "draft") {
    await announce(post, `Noted ${postRef(post)} → sent back to the team: “${change[1].trim()}”. I'll re-check and resend.`);
    await toWorkRoom(
      post,
      `✏️ ${approver?.name ?? input.handle} asked for changes on ${postRef(post)} ${post.title}: “${change[1].trim()}”\n@${agentName("writer")} please update it (bolo show ${postRef(post)}), then bolo submit ${postRef(post)}`,
    );
  }
  return post;
}

export async function approve(id: string, handle: string, via: "telegram" | "dashboard" = "telegram") {
  const snapshot = findPost(readStore(), id);
  const client = requireClient(snapshot.clientId);
  const approver = findApprover(client, handle);
  if (!approver) throw new WorkflowError(403, "Only approvers listed in protocol.md can approve.");
  if (snapshot.status !== "awaiting") throw new WorkflowError(409, "This post isn't waiting for approval.");

  // Call Postiz outside the store lock; then record the result.
  const result = await schedulePost(snapshot, client);

  const post = await updateStore((data) => {
    const post = findPost(data, id);
    post.status = "scheduled";
    post.postizId = result.postizId;
    post.dryRun = result.dryRun;
    post.note = undefined;
    post.updatedAt = nowIso();
    post.thread.push({ from: approver.name, text: via === "dashboard" ? "approve (from dashboard)" : "approve", at: nowIso(), client: true });
    post.thread.push({
      from: "Publisher",
      text: `Scheduled ✅ ${schedSummary(post)}${result.dryRun ? ` (dry run — ${result.reason})` : ""}`,
      at: nowIso(),
    });
    return post;
  });
  await announce(post, `Scheduled ✅ ${post.title} ${postRef(post)}\n${schedSummary(post)} IST${result.dryRun ? "\n(dry run — not sent to Postiz)" : ""}`);
  await toWorkRoom(post, `🎉 ${approver.name} approved ${postRef(post)} ${post.title} — scheduled ${schedSummary(post)} IST${result.dryRun ? " (dry run)" : ""}.`);
  // Keep a copy of what was approved in the client's Drive (background; never blocks scheduling)
  void archiveToDrive(post).catch((e: Error) =>
    updateStore((data) => {
      data.posts.find((x) => x.id === post.id)?.thread.push({ from: "Drive", text: `⚠ Not archived: ${e.message}`, at: nowIso() });
    }),
  );
  return post;
}

/** Called by the Postiz webhook (or manually in dry-run mode). */
export async function markLive(input: { postId?: string; postizId?: string; permalink?: string }) {
  const post = await updateStore((data) => {
    const post = data.posts.find((p) => (input.postId && p.id === input.postId) || (input.postizId && p.postizId === input.postizId));
    if (!post) throw new WorkflowError(404, "No post matches that id.");
    if (post.status !== "scheduled") throw new WorkflowError(409, "Only scheduled posts can go live.");
    post.status = "live";
    post.permalink = input.permalink;
    post.updatedAt = nowIso();
    post.thread.push({ from: "Publisher", text: `Live 🎉 ${input.permalink ?? "(no link reported)"}`, at: nowIso() });
    return post;
  });
  await announce(post, `Live 🎉 ${post.title}${post.permalink ? `\n${post.permalink}` : ""}`);
  return post;
}

export function updateSettings(clientId: string, patch: Partial<ClientSettings>) {
  requireClient(clientId);
  return updateStore((data) => {
    const s = settingsFor(data, clientId);
    if (patch.cadence && ["Daily", "3x/week", "Custom"].includes(patch.cadence)) s.cadence = patch.cadence;
    for (const k of ["useBestTimes", "remindApprover", "autoFix"] as const) if (typeof patch[k] === "boolean") s[k] = patch[k];
    return s;
  });
}

export function deletePost(id: string) {
  return updateStore((data) => {
    const post = findPost(data, id);
    if (post.status === "scheduled" || post.status === "live") throw new WorkflowError(409, "Unschedule it in Postiz first.");
    data.posts = data.posts.filter((p) => p.id !== id);
    return { id };
  });
}
