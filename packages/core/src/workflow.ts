import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./brand-kit";
import { clientsFor, loadClient, managersOf, pushNotification } from "./companies";
import { runBrandGuard } from "./brand-guard";
import { planPublish } from "./publish";
import { findRoomByName, postToRoom, switchConfig, type Delivery } from "./switch";
import { approvalButtons, chatFor, sendMediaToChat, sendText } from "./telegram";
import { archiveToDrive } from "./drive";
import { DEFAULT_SETTINGS } from "./seed";
import { addDays, creativeTextHash, FORMAT_INFO, FORMATS, formatSlot, istIso, istParts, LANGUAGE_IDS, LAYOUTS, parseClock, PLATFORM_SHORT, postRef, sizeFor, validSize } from "./shared";
import { readStore, updateStore } from "./store";
import type { Caption, Client, ClientSettings, LanguageOption, Platform, Post, PostFormat, ReelScript, Size, Slide, StudioData } from "./types";
import type { User } from "./users";

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

/** Companies this account can open, with their posts (platform admins: every company). */
export function getStudio(user: Pick<User, "id" | "role">) {
  const data = readStore();
  return clientsFor(user).map((client) => ({
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
  /**
   * "claude" — Claude writes it in the app right away (then media, Brand Guard, Telegram);
   * "agents" — handed to bolo-writer in the Switch work room; "self" — a person writes it in the editor.
   */
  mode?: "claude" | "agents" | "self";
  /** Output size; empty → the format's default. */
  size?: Size;
  languages?: LanguageOption;
  /** User id of the author (gets the notifications). */
  authorId?: string;
};

function checkSize(size: Size | undefined, format: PostFormat) {
  if (!size) return undefined;
  const ok = validSize(size, format === "Reel" || format === "Story");
  if (!ok) throw new WorkflowError(400, "Size: width and height 320–4096 px (videos: even numbers, at most 1920 on the short side).");
  return ok;
}

function checkLanguages(l: string | undefined) {
  if (!l) return undefined;
  if (!(LANGUAGE_IDS as string[]).includes(l)) throw new WorkflowError(400, `Languages must be one of ${LANGUAGE_IDS.join(", ")}.`);
  return l as LanguageOption;
}

export async function createIdea(input: NewContent): Promise<Post> {
  const text = input.text.trim();
  if (!text) throw new WorkflowError(400, "Say or type an idea first.");
  const client = requireClient(input.clientId);
  const format = input.format ?? guessFormat(text);
  if (!FORMATS.includes(format)) throw new WorkflowError(400, `Format must be ${FORMATS.join(", ")}.`);
  const size = checkSize(input.size, format);
  const languages = checkLanguages(input.languages);
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
      size,
      languages,
      createdBy: input.authorId,
      thread: [{ from: input.author, text, at: nowIso() }],
      note:
        mode === "agents"
          ? `Sent to @${agentName("writer")} in ${client.rooms.work} — the brief and captions appear here when ready`
          : mode === "claude"
            ? undefined
            : "New idea — add captions and media, then run Brand Guard",
      job: mode === "claude" ? { step: "Writing the brief and captions…", at: nowIso(), progress: 2, startedAt: nowIso(), by: input.authorId } : undefined,
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
  layout?: string;
  /** null clears it (back to the format's default). */
  size?: Size | null;
  languages?: LanguageOption | null;
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
    if (patch.layout !== undefined) {
      if (patch.layout && !(patch.layout in LAYOUTS)) throw new WorkflowError(400, `Layout must be ${Object.keys(LAYOUTS).join(", ")}.`);
      post.layout = patch.layout || undefined;
    }
    if (patch.reel) post.reel = patch.reel;
    if (patch.slides) post.slides = patch.slides.map((s) => ({ headline: s.headline.trim(), text: s.text?.trim() || undefined }));
    if (patch.size !== undefined) post.size = patch.size === null ? undefined : checkSize(patch.size, format);
    if (patch.languages !== undefined) post.languages = patch.languages === null ? undefined : checkLanguages(patch.languages);
    // A format change can leave platforms the new format can't use (e.g. LinkedIn stories)
    if (patch.format && !patch.platforms) {
      const allowed = platformsFor(client, patch.format);
      post.platforms = post.platforms.filter((p) => allowed.includes(p));
      if (!post.platforms.length) post.platforms = allowed;
    }

    // Any content change invalidates the previous check and any pending approval
    if (patch.captions || patch.creativeText !== undefined || patch.title !== undefined || patch.reel || patch.format || patch.slides || patch.size !== undefined) {
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
    // Same for the size: a render made before the size changed is the wrong shape
    const want = sizeFor(post);
    const wrongSize = (post.media ?? []).filter((m) => m.source === "template" && m.w && m.h && (m.w !== want.w || m.h !== want.h));
    if (wrongSize.length) {
      post.checks.push({
        id: "size",
        label: `Media is ${want.w} × ${want.h}`,
        ok: false,
        detail: `${wrongSize.length} file(s) were rendered at another size — generate the media again.`,
      });
    }
    const passed = guard.passed && !stale.length && !wrongSize.length;

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
    for (const userId of approverIds(client)) {
      pushNotification(data, userId, {
        kind: "approval",
        title: `Ready for your approval: ${post.title}`,
        body: `${post.format} · ${schedSummary(post)} IST · ${guard.checks.length} brand checks passed`,
        companyId: client.id,
        href: `/studio/${client.id}/approvals?post=${post.id}`,
      });
    }
    return post;
  }).then(async (post) => {
    const client = requireClient(post.clientId);
    if (post.status === "awaiting") {
      await sendMediaFirst(post, client);
      await announce(post, approvalPackage(post, Boolean(chatFor(client.id)?.own)), { buttons: true });
      await toWorkRoom(post, `✅ ${postRef(post)} ${post.title} passed Brand Guard and is waiting for approval.`);
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
 * The approver sees what they approve: the image / slides / video go to the company's Telegram
 * group before the approval text. No Telegram connected → nothing to send (approval happens in
 * the studio); a failed send is noted on the post, never blocks it.
 */
async function sendMediaFirst(post: Post, client: Client) {
  const chat = chatFor(client.id, client.rooms.approvals);
  if (!chat) return;
  const sent = await sendMediaToChat(chat.chatId, post);
  if (!sent.ok) {
    await updateStore((data) => {
      const p = data.posts.find((x) => x.id === post.id);
      p?.thread.push({ from: "Telegram", text: `⚠ Preview not attached: ${sent.reason}`, at: nowIso() });
    });
  }
}

/** Show (or clear, with null) what automatic production is doing right now. */
export function setJob(
  id: string,
  step: string | null,
  note?: string,
  opts: { progress?: number; by?: string; done?: { ok: boolean; title: string; body?: string } } = {},
) {
  return updateStore((data) => {
    const p = findPost(data, id);
    const prev = p.job;
    p.job = step
      ? {
          step,
          at: nowIso(),
          progress: Math.max(0, Math.min(100, Math.round(opts.progress ?? prev?.progress ?? 0))),
          startedAt: prev?.startedAt ?? nowIso(),
          by: opts.by ?? prev?.by,
        }
      : undefined;
    if (note !== undefined) p.note = note || undefined;
    p.updatedAt = nowIso();
    const by = opts.by ?? prev?.by ?? p.createdBy;
    if (opts.done && by) {
      pushNotification(data, by, {
        kind: opts.done.ok ? "job-done" : "job-failed",
        title: opts.done.title,
        body: opts.done.body,
        companyId: p.clientId,
        href: `/studio/${p.clientId}/post/${p.id}`,
      });
    }
    return p;
  });
}

/** Everything being generated right now in these companies — the progress dock polls this. */
export function activeJobs(companyIds: string[]) {
  const ids = new Set(companyIds);
  return readStore()
    .posts.filter((p) => p.job && ids.has(p.clientId))
    .map((p) => ({ id: p.id, clientId: p.clientId, title: p.title, format: p.format, step: p.job!.step, progress: p.job!.progress ?? 0, at: p.job!.at, startedAt: p.job!.startedAt ?? p.job!.at }));
}

/** Status notes for the team and agents in the client's work room (best effort). */
async function toWorkRoom(post: Post, text: string) {
  const client = loadClient(post.clientId);
  if (client) await postToRoom(client.rooms.work, text);
}

const handleKey = (h: string) => h.replace(/^@/, "").trim().toLowerCase();

/** Who is acting: a studio account (userId) and/or a Telegram username (handle). */
/**
 * Who is acting: a studio account (userId) and/or a Telegram username (handle). `inGroup` is set
 * only by the Telegram bot, for a message from the company's own connected chat.
 */
export type Actor = { handle?: string; userId?: string; name?: string; inGroup?: boolean };

export function findApprover(client: Client, who: string | Actor) {
  const a: Actor = typeof who === "string" ? { handle: who } : who;
  const listed =
    (a.userId ? client.approvers.find((x) => x.userId === a.userId) : undefined) ??
    (a.handle && handleKey(a.handle) ? client.approvers.find((x) => x.handle && handleKey(x.handle) === handleKey(a.handle!)) : undefined);
  // A Telegram-only approver is recorded with the name Telegram shows for them ("Meera (@client_manager)")
  if (listed) return !listed.userId && a.name ? { ...listed, name: a.name } : listed;
  // "Anyone in this group can approve": whoever tapped in the company's own Telegram chat
  if (a.inGroup && client.groupApproves) return { name: a.name || a.handle || "Telegram group", handle: a.handle ?? "", backup: false };
  return undefined;
}

/** Studio accounts that approve this company's posts (they get "ready for approval" notifications). */
const approverIds = (client: Client) => client.approvers.map((a) => a.userId).filter((x): x is string => Boolean(x));

/** The message the approver sees in Telegram — one short line per item, no tables (Telegram won't render them). */
function approvalPackage(post: Post, withButtons: boolean) {
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
    withButtons
      ? "Tap a button below — or reply in the studio's Approvals."
      : `Reply here:\n✅ approve ${postRef(post)}\n✏️ change ${postRef(post)}: <what to change>\n⛔ reject ${postRef(post)}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n")
    .slice(0, 3900); // Telegram splits above 4096
}

/**
 * A status line for the company's Telegram: its own connected group (through Bolo's bot), else the
 * Switch approvals room. Neither connected → skipped quietly. Never fails the workflow.
 */
async function announce(post: Post, text: string, opts: { buttons?: boolean } = {}) {
  const client = loadClient(post.clientId);
  if (!client) return;
  const chat = chatFor(client.id, client.rooms.approvals);
  let delivery: Delivery;
  let where: string;
  if (chat?.own) {
    delivery = await sendText(chat.chatId, text, opts.buttons ? { reply_markup: approvalButtons(post.id) } : {});
    where = "Telegram";
  } else if (switchConfig().configured && client.rooms.approvals) {
    delivery = await postToRoom(client.rooms.approvals, text);
    where = client.rooms.approvals;
  } else return;
  if (!delivery.ok) {
    // Make a missed delivery visible on the post instead of failing silently
    await updateStore((data) => {
      const p = data.posts.find((x) => x.id === post.id);
      p?.thread.push({ from: "Telegram", text: `⚠ Not delivered to ${where}: ${delivery.reason}`, at: nowIso() });
    });
  }
}

/** Send the approval package to the company's Telegram again (e.g. it wasn't delivered). */
export async function resendApproval(id: string) {
  const post = findPost(readStore(), id);
  if (post.status !== "awaiting") throw new WorkflowError(409, "Only posts waiting for approval can be resent.");
  const client = requireClient(post.clientId);
  const chat = chatFor(client.id, client.rooms.approvals);
  if (!chat && !(switchConfig().configured && findRoomByName(client.rooms.approvals))) {
    throw new WorkflowError(409, "Telegram isn't connected for this company — connect it in Connections, or approve in the studio.");
  }
  await sendMediaFirst(post, client);
  const delivery = chat?.own
    ? await sendText(chat.chatId, approvalPackage(post, true), { reply_markup: approvalButtons(post.id) })
    : await postToRoom(client.rooms.approvals, approvalPackage(post, false));
  if (!delivery.ok) throw new WorkflowError(409, `Not delivered: ${delivery.reason}`);
  return updateStore((data) => {
    const p = findPost(data, id);
    p.thread.push({ from: "Brand Guard", text: "Resent to Telegram.", at: nowIso() });
    return p;
  });
}

/**
 * A message from the client's Telegram approvals room (relayed by Switch), or an approver
 * acting from the dashboard. "approve" schedules the post; "change: …" sends it back.
 */
export async function clientReply(id: string, input: Actor & { text: string; via?: "telegram" | "dashboard" }) {
  const text = input.text.trim();
  const snapshot = findPost(readStore(), id);
  const client = requireClient(snapshot.clientId);
  const approver = findApprover(client, input);
  const who = approver?.name ?? input.name ?? input.handle ?? "Someone";

  if (/^approve\b/i.test(text)) return approve(id, input, input.via);
  const reject = text.match(/^reject\b(?:\s*#\w+)?\s*:?\s*([\s\S]*)$/i);
  if (reject) return rejectPost(id, input, reject[1].trim(), input.via);

  const change = text.match(/^change\b(?:\s*#\w+)?\s*:\s*([\s\S]+)$/i);
  if (change && !approver) throw new WorkflowError(403, "Only this company's approvers can request changes.");

  const post = await updateStore((data) => {
    const post = findPost(data, id);
    post.thread.push({ from: who, text, at: nowIso(), client: true });
    if (change && post.status === "awaiting") {
      post.status = "draft";
      post.note = `Change requested: ${change[1].trim()}`;
      post.thread.push({ from: "Brand Guard", text: "Noted → sent back to the right agent. I'll re-check and resend.", at: nowIso() });
      tellTeam(data, post, { kind: "changes", title: `${who} asked for changes: ${post.title}`, body: change[1].trim() });
    }
    post.updatedAt = nowIso();
    return post;
  });
  if (change && post.status === "draft") {
    await announce(post, `Noted ${postRef(post)} → sent back to the team: “${change[1].trim()}”. I'll re-check and resend.`);
    await toWorkRoom(
      post,
      `✏️ ${who} asked for changes on ${postRef(post)} ${post.title}: “${change[1].trim()}”\n@${agentName("writer")} please update it (bolo show ${postRef(post)}), then bolo submit ${postRef(post)}`,
    );
  }
  return post;
}

/** Notify the post's author and the company's owners/admins (inside a running updateStore). */
function tellTeam(data: StudioData, post: Post, n: { kind: Parameters<typeof pushNotification>[2]["kind"]; title: string; body?: string }, except?: string) {
  const ids = new Set([post.createdBy, ...managersOf(post.clientId)].filter((x): x is string => Boolean(x) && x !== except));
  for (const userId of ids) pushNotification(data, userId, { ...n, companyId: post.clientId, href: `/studio/${post.clientId}/post/${post.id}` });
}

/** An approver turns the post down: it goes back to production with the reason, nothing is scheduled. */
export async function rejectPost(id: string, who: Actor, reason: string, via: "telegram" | "dashboard" = "dashboard") {
  const snapshot = findPost(readStore(), id);
  const client = requireClient(snapshot.clientId);
  const approver = findApprover(client, who);
  if (!approver) throw new WorkflowError(403, "Only this company's approvers can reject a post.");
  if (snapshot.status !== "awaiting") throw new WorkflowError(409, "This post isn't waiting for approval.");
  const post = await updateStore((data) => {
    const post = findPost(data, id);
    post.status = "draft";
    post.note = `Rejected by ${approver.name}${reason ? `: ${reason}` : ""}`;
    post.thread.push({ from: approver.name, text: `reject${reason ? `: ${reason}` : ""}${via === "dashboard" ? " (from the studio)" : ""}`, at: nowIso(), client: true });
    post.updatedAt = nowIso();
    tellTeam(data, post, { kind: "changes", title: `${approver.name} rejected ${post.title}`, body: reason || undefined }, approver.userId);
    return post;
  });
  await toWorkRoom(post, `⛔ ${approver.name} rejected ${postRef(post)} ${post.title}${reason ? `: “${reason}”` : ""}.`);
  return post;
}

export async function approve(id: string, who: string | Actor, via: "telegram" | "dashboard" = "telegram") {
  const snapshot = findPost(readStore(), id);
  const client = requireClient(snapshot.clientId);
  const approver = findApprover(client, who);
  if (!approver) throw new WorkflowError(403, "Only this company's approvers can approve.");
  if (snapshot.status !== "awaiting") throw new WorkflowError(409, "This post isn't waiting for approval.");

  // Decide how it goes out (direct / Postiz / dry run) outside the store lock; then record it.
  const result = await planPublish(snapshot, client);

  const post = await updateStore((data) => {
    const post = findPost(data, id);
    post.status = "scheduled";
    post.postizId = result.postizId;
    post.dryRun = result.dryRun;
    post.publish = { via: result.via };
    post.note = result.skipped?.length ? `Not connected, so not posted there: ${result.skipped.join(", ")}` : undefined;
    post.updatedAt = nowIso();
    post.thread.push({ from: approver.name, text: via === "dashboard" ? "approve (from the studio)" : "approve", at: nowIso(), client: true });
    post.thread.push({
      from: "Publisher",
      text: `Scheduled ✅ ${schedSummary(post)}${result.via === "direct" ? " — Bolo posts it at that time" : result.dryRun ? ` (dry run — ${result.reason})` : " via Postiz"}`,
      at: nowIso(),
    });
    tellTeam(data, post, { kind: "approved", title: `Approved: ${post.title}`, body: `${approver.name} approved it — goes out ${formatSlot(post.scheduledAt)} IST. It's in Drafts until then.` }, approver.userId);
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
    tellTeam(data, post, { kind: "live", title: `Posted: ${post.title}`, body: post.permalink ?? `${post.platforms.map((x) => PLATFORM_SHORT[x]).join(" + ")} · it's on the calendar now.` });
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
