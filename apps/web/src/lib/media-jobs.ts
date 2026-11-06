import "server-only";
import { execFile, spawn } from "node:child_process";
import { join } from "node:path";
import { chromium } from "playwright";
import { addMedia, prepareForRender, readStore, removeMedia, repoRoot, setting, signToken, WorkflowError, type Post } from "@bolo/core";
import { creativeTextHash, sizeFor } from "@bolo/core/shared";

// Media production shared by the Generate buttons, the automatic pipeline and the agents.
// Every job takes an AbortSignal (Cancel in the studio) and reports progress 0–1.

export type JobOpts = { signal?: AbortSignal; onProgress?: (fraction: number, step?: string) => void };

export class CancelledError extends WorkflowError {
  constructor() {
    super(409, "Cancelled.");
  }
}

export const throwIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new CancelledError();
};

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Render the brand design with the post's own text to real PNGs at the post's size — one for a
 * post or story, one per slide for a carousel — replacing earlier renders (uploads are kept).
 */
export async function renderImages(id: string, origin: string, opts: JobOpts = {}): Promise<Post> {
  const found = readStore().posts.find((p) => p.id === id);
  if (!found) throw new WorkflowError(404, "Post not found.");
  if (found.status === "scheduled" || found.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");
  if (found.format === "Reel") throw new WorkflowError(400, "Reels are videos — use Generate reel.");
  const post = await prepareForRender(id); // RERA no. etc. on the text before it's drawn
  const size = sizeFor(post);
  // The headless browser opens the render page on this server directly, not through the public domain
  const base = (setting("BOLO_INTERNAL_URL") || origin).replace(/\/$/, "");
  const count = post.format === "Carousel" ? Math.max(1, post.slides?.length ?? 1) : 1;
  throwIfCancelled(opts.signal);

  const browser = await chromium.launch().catch((e: Error) => {
    throw new WorkflowError(409, `Renderer unavailable — run “npx playwright install chromium”. (${e.message.split("\n")[0]})`);
  });
  const stop = () => void browser.close().catch(() => undefined);
  opts.signal?.addEventListener("abort", stop, { once: true });
  const pngs: Buffer[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
    for (let i = 0; i < count; i++) {
      throwIfCancelled(opts.signal);
      opts.onProgress?.(i / count, count > 1 ? `Designing slide ${i + 1} of ${count}…` : undefined);
      const token = signToken({ pid: id, kind: "render", w: size.w, h: size.h }, 120);
      // "load", not "networkidle": the dev server keeps a hot-reload connection open forever
      const res = await page.goto(`${base}/render/${id}?t=${encodeURIComponent(token)}&slide=${i}`, { waitUntil: "load", timeout: 60_000 });
      if (!res?.ok()) throw new WorkflowError(409, `Render page failed (${res?.status()}).`);
      await page.evaluate(async () => {
        await document.fonts.ready;
        // every <img> (reference photos) decoded before the screenshot
        await Promise.all([...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
      });
      pngs.push(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size.w, height: size.h } }));
    }
  } catch (e) {
    throwIfCancelled(opts.signal); // a closed browser throws — report it as the cancel it was
    throw e;
  } finally {
    opts.signal?.removeEventListener("abort", stop);
    await browser.close().catch(() => undefined);
  }
  throwIfCancelled(opts.signal);
  opts.onProgress?.(1);

  const previous = (post.media ?? []).filter((m) => m.source === "template" && m.kind === "image");
  let result: Post = post;
  for (const [i, png] of pngs.entries()) {
    result = await addMedia(id, {
      name: `${slug(post.title)}${count > 1 ? `-slide-${i + 1}` : ""}-${size.w}x${size.h}.png`,
      type: "image/png",
      bytes: new Uint8Array(png),
      source: "template",
      textHash: creativeTextHash(post),
      w: size.w,
      h: size.h,
    });
  }
  for (const m of previous) result = await removeMedia(id, m.file);
  return result;
}

/** Stop a child process and everything it started (Remotion runs Chrome and ffmpeg). */
function killTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => undefined);
  else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  }
}

/**
 * Render the reel / story video (Remotion + Sarvam voiceover) by running `bolo reel` in its own
 * process — keeps the heavy renderer out of the web server, same path as the agents. Progress is
 * read from its log ("Voice 2/4…", "  40%").
 */
export async function renderVideo(id: string, opts: JobOpts & { voice: boolean; by: string }): Promise<Post> {
  const post = readStore().posts.find((p) => p.id === id);
  if (!post) throw new WorkflowError(404, "Post not found.");
  if (post.format !== "Reel" && post.format !== "Story") throw new WorkflowError(400, "Videos are for reels and stories — switch the format first.");
  throwIfCancelled(opts.signal);

  const root = repoRoot();
  const args = ["--import", "tsx", join(root, "packages", "cli", "src", "index.ts"), "reel", id, ...(opts.voice ? [] : ["--no-voice"])];
  await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, BOLO_AGENT_NAME: opts.by },
      windowsHide: true,
      detached: process.platform !== "win32", // own process group, so a cancel stops Chrome and ffmpeg too
    });
    let log = "";
    let cancelled = false;
    const onAbort = () => {
      cancelled = true;
      killTree(child.pid);
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const onData = (d: Buffer) => {
      log += d;
      for (const line of d.toString().split(/\r?\n/)) {
        const voice = line.match(/Voice (\d+)\/(\d+)/);
        const pct = line.match(/^\s+(\d{1,3})%\s*$/);
        if (voice) opts.onProgress?.((Number(voice[1]) / Number(voice[2])) * 0.25, `Recording the voiceover (${voice[1]}/${voice[2]})…`);
        else if (/Bundling/.test(line)) opts.onProgress?.(0.27, "Preparing the reel template…");
        else if (pct) opts.onProgress?.(0.3 + (Number(pct[1]) / 100) * 0.7, `Rendering the video — ${pct[1]}%`);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => killTree(child.pid), 290_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      if (cancelled) return reject(new CancelledError());
      if (code === 0) resolve(log);
      else reject(new WorkflowError(409, (log.match(/Error: (.+)/)?.[1] ?? log.trim().split("\n").at(-1) ?? "Video render failed").slice(0, 300)));
    });
    child.on("error", (e) => reject(new WorkflowError(409, e.message)));
  });
  return readStore().posts.find((p) => p.id === id)!;
}
