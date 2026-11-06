import { managersOf, pushNotification } from "./companies";
import { WorkflowError } from "./errors";
import { publishMedia, schedulePost, type ScheduleResult } from "./postiz";
import { istIso, istParts, PLATFORM_SHORT } from "./shared";
import { directPlatforms, publishTo } from "./social";
import { readStore, updateStore } from "./store";
import type { Client, Post } from "./types";

// What happens after approval: with the company's own connections, Bolo publishes the post itself
// when it's due (the scheduler below); otherwise Postiz, or a dry run that's marked live by hand.

const nowIso = () => new Date().toISOString();
const MAX_ATTEMPTS = 3;
/** This process, for publish claims. */
const ME = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const CLAIM_MS = 10 * 60_000;

export type Plan = ScheduleResult & { via: "direct" | "postiz" | "dry"; skipped?: string[] };

/** Decide how an approved post goes out (called by approve()). */
export async function planPublish(post: Post, client: Client): Promise<Plan> {
  const direct = directPlatforms(client.id);
  const covered = post.platforms.filter((p) => direct.includes(p));
  if (covered.length) {
    const media = publishMedia(post);
    if (!media.length && (post.format === "Reel" || covered.includes("instagram"))) {
      throw new WorkflowError(409, post.format === "Reel" ? "A reel needs its video — generate it (or upload the MP4) first." : "Instagram needs an image or video — generate or upload one first.");
    }
    const skipped = post.platforms.filter((p) => !covered.includes(p)).map((p) => PLATFORM_SHORT[p]);
    return { postizId: `direct-${post.id}`, dryRun: false, via: "direct", skipped };
  }
  const r = await schedulePost(post, client);
  return { ...r, via: r.dryRun ? "dry" : "postiz" };
}

// ---------- scheduler ----------

const g = globalThis as typeof globalThis & { __boloPublishing?: Set<string>; __boloScheduler?: ReturnType<typeof setInterval> };
const inFlight = (g.__boloPublishing ??= new Set<string>());

function due(p: Post, now: number) {
  if (p.status !== "scheduled" || p.publish?.via !== "direct") return false;
  if (Date.parse(p.scheduledAt) > now) return false;
  if ((p.publish.attempts ?? 0) >= MAX_ATTEMPTS) return false;
  return !p.publish.nextTry || Date.parse(p.publish.nextTry) <= now;
}

/** Publish one direct post to every platform that hasn't succeeded yet. */
export async function publishDirect(postId: string) {
  if (inFlight.has(postId)) return;
  inFlight.add(postId);
  try {
    // Claim it in the store first: with a shared database, another server (or a laptop) may be
    // running the scheduler too — only the one holding the claim publishes.
    const claimed = await updateStore((data) => {
      const p = data.posts.find((x) => x.id === postId);
      if (!p || p.status !== "scheduled" || !p.publish) return false;
      const c = p.publish.claim;
      if (c && c.by !== ME && Date.parse(c.at) > Date.now() - CLAIM_MS) return false;
      p.publish.claim = { by: ME, at: nowIso() };
      return true;
    });
    if (!claimed) return;
    const post = readStore().posts.find((p) => p.id === postId);
    if (!post || post.status !== "scheduled") return;
    const results = { ...(post.publish?.results ?? {}) };
    const targets = post.platforms.filter((p) => directPlatforms(post.clientId).includes(p) && !results[p]?.ok);
    for (const platform of targets) {
      const r = await publishTo(post, platform);
      results[platform] = r.ok ? { ok: true, id: r.id, url: r.url, at: nowIso() } : { ok: false, error: r.error, at: nowIso() };
    }
    const failed = targets.filter((p) => !results[p]?.ok);
    const anyOk = post.platforms.some((p) => results[p]?.ok);

    await updateStore((data) => {
      const p = data.posts.find((x) => x.id === postId);
      if (!p || p.status !== "scheduled") return;
      const attempts = (p.publish?.attempts ?? 0) + (failed.length ? 1 : 0);
      // (the claim is dropped here: done, or free for the next retry)
      p.publish = { via: "direct", results, attempts, nextTry: failed.length ? new Date(Date.now() + attempts * 5 * 60_000).toISOString() : undefined };
      for (const pl of targets) {
        const r = results[pl]!;
        p.thread.push({ from: "Publisher", text: r.ok ? `Posted on ${PLATFORM_SHORT[pl]} ✅${r.url ? ` ${r.url}` : ""}` : `${PLATFORM_SHORT[pl]} failed: ${r.error}`, at: nowIso() });
      }
      if (!failed.length) {
        p.status = "live";
        p.permalink = post.platforms.map((x) => results[x]?.url).find(Boolean);
        p.note = undefined;
        p.thread.push({ from: "Publisher", text: `Live 🎉 ${p.permalink ?? ""}`.trim(), at: nowIso() });
      } else if (attempts >= MAX_ATTEMPTS) {
        p.note = `Couldn't post to ${failed.map((x) => PLATFORM_SHORT[x]).join(", ")} — fix the connection, then Post now`;
      } else {
        p.note = `Retrying ${failed.map((x) => PLATFORM_SHORT[x]).join(", ")} in ${attempts * 5} min`;
      }
      p.updatedAt = nowIso();
      const ids = new Set([p.createdBy, ...managersOf(p.clientId)].filter((x): x is string => Boolean(x)));
      const n =
        !failed.length
          ? { kind: "live" as const, title: `Posted: ${p.title}`, body: p.permalink ?? "It's on the calendar now." }
          : attempts >= MAX_ATTEMPTS
            ? { kind: "job-failed" as const, title: `Couldn't post: ${p.title}`, body: failed.map((x) => `${PLATFORM_SHORT[x]}: ${results[x]?.error}`).join(" · ").slice(0, 300) }
            : null;
      if (n) for (const userId of ids) pushNotification(data, userId, { ...n, companyId: p.clientId, href: `/studio/${p.clientId}/${failed.length ? "drafts" : ""}?post=${p.id}` });
    });
    return { anyOk, failed };
  } finally {
    inFlight.delete(postId);
  }
}

/** One pass: publish everything that's due. */
export async function runDuePosts(now = Date.now()) {
  const ids = readStore().posts.filter((p) => due(p, now)).map((p) => p.id);
  for (const id of ids) await publishDirect(id).catch((e) => console.error(`publish ${id}:`, (e as Error).message));
  return ids.length;
}

/** "Post now" from Drafts: move the time to now and publish straight away. */
export async function publishNow(postId: string) {
  const post = await updateStore((data) => {
    const p = data.posts.find((x) => x.id === postId);
    if (!p) throw new WorkflowError(404, "Post not found.");
    if (p.status !== "scheduled") throw new WorkflowError(409, "Only approved posts in Drafts can be posted now.");
    if (p.publish?.via !== "direct") throw new WorkflowError(409, "This post goes out through Postiz or by hand — connect Facebook, Instagram or LinkedIn in Connections to post directly.");
    const n = istParts(new Date());
    p.scheduledAt = istIso(n.dateKey, n.minutes);
    p.publish = { ...p.publish, attempts: 0, nextTry: undefined };
    p.updatedAt = nowIso();
    return p;
  });
  await publishDirect(post.id);
  return readStore().posts.find((p) => p.id === postId)!;
}

/** Check every 30 s. Runs inside the web server (instrumentation.ts) — one server, one scheduler. */
export function startScheduler(log: (m: string) => void = console.log) {
  if (g.__boloScheduler) return;
  g.__boloScheduler = setInterval(() => void runDuePosts().catch((e) => log(`scheduler: ${(e as Error).message}`)), 30_000);
  log("Publisher: scheduled posts go out automatically (checked every 30 s).");
}
