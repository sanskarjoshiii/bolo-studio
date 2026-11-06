import "server-only";
import { readStore, setJob, submitForApproval, WorkflowError, writeWithClaude } from "@bolo/core";
import { CancelledError, renderImages, renderVideo, throwIfCancelled } from "./media-jobs";

// "AI writes it": idea → AI (brief, captions, slides / scenes) → media → Brand Guard → the client's
// approval. Runs in the background; progress (0–100) and the current step are saved on the post,
// so the editor and the progress dock show them from any page. Cancel aborts whatever is running.

type Run = { controller: AbortController; by?: string };
// On globalThis: Next bundles API routes and pages separately, each with its own module copy
const g = globalThis as typeof globalThis & { __boloRuns?: Map<string, Run> };
const running = (g.__boloRuns ??= new Map<string, Run>());

export function isRunning(id: string) {
  return running.has(id);
}

export function startAutoProduce(id: string, opts: { origin: string; send: boolean; by: string; byId?: string }) {
  if (running.has(id)) throw new WorkflowError(409, "This post is already being generated.");
  const run: Run = { controller: new AbortController(), by: opts.byId };
  running.set(id, run);
  void autoProduce(id, run.controller.signal, opts).finally(() => running.delete(id));
}

/** "Generate image / slides / reel" buttons: the media step alone, as a cancellable background job. */
export function startMediaJob(id: string, kind: "images" | "video", opts: { origin: string; voice?: boolean; byId?: string }) {
  if (running.has(id)) throw new WorkflowError(409, "This post is already being generated.");
  const post = readStore().posts.find((p) => p.id === id);
  if (!post) throw new WorkflowError(404, "Post not found.");
  if (post.status === "scheduled" || post.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");
  if (kind === "images" && post.format === "Reel") throw new WorkflowError(400, "Reels are videos — use Generate reel.");
  if (kind === "video" && post.format !== "Reel" && post.format !== "Story") throw new WorkflowError(400, "Videos are for reels and stories — switch the format first.");
  const run: Run = { controller: new AbortController(), by: opts.byId };
  running.set(id, run);
  const signal = run.controller.signal;
  void (async () => {
    let last = 0;
    let pending: Promise<unknown> = Promise.resolve();
    const onProgress = (f: number, text?: string) => {
      last = Math.max(last, Math.round(5 + f * 90));
      const at = last;
      pending = pending.then(() => setJob(id, text ?? (kind === "video" ? "Rendering the video…" : "Designing…"), undefined, { progress: at, by: opts.byId }));
    };
    try {
      await setJob(id, kind === "video" ? "Making the video…" : "Designing…", undefined, { progress: 3, by: opts.byId });
      if (kind === "video") await renderVideo(id, { voice: opts.voice ?? true, by: opts.byId ?? "studio", signal, onProgress });
      else await renderImages(id, opts.origin, { signal, onProgress });
      await pending;
      await setJob(id, null, "", { done: { ok: true, title: `${kind === "video" ? "Video" : "Design"} ready: ${post.title}` } });
    } catch (e) {
      await pending.catch(() => undefined);
      if (e instanceof CancelledError || signal.aborted) await setJob(id, null, "Generation cancelled").catch(() => undefined);
      else await setJob(id, null, `Media failed: ${(e as Error).message}`, { done: { ok: false, title: `Media failed: ${post.title}`, body: (e as Error).message.slice(0, 200) } }).catch(() => undefined);
    } finally {
      running.delete(id);
    }
  })();
}

/**
 * Stop generation. A run in this process is aborted (the AI request, browser or video renderer is
 * killed); a job left over from a restart is simply cleared.
 */
export async function cancelJob(id: string) {
  const run = running.get(id);
  if (run) {
    run.controller.abort();
    return { cancelled: true };
  }
  const post = readStore().posts.find((p) => p.id === id);
  if (post?.job) await setJob(id, null, "Generation cancelled");
  return { cancelled: Boolean(post?.job) };
}

/** Milestones: writing 3→40, media 42→90, Brand Guard + sending 92→99. */
async function autoProduce(id: string, signal: AbortSignal, { origin, send, byId }: { origin: string; send: boolean; by: string; byId?: string }) {
  let last = 0;
  const step = (text: string, progress: number) => {
    last = Math.max(last, progress);
    return setJob(id, text, undefined, { progress: last, by: byId });
  };
  let title = readStore().posts.find((p) => p.id === id)?.title ?? "Your post";
  try {
    await step("Writing the brief, headline and captions…", 3);
    await writeWithClaude(id, { signal });
    throwIfCancelled(signal);

    const post = readStore().posts.find((p) => p.id === id)!;
    title = post.title;
    if (post.format === "Reel") {
      await step("Making the reel — voiceover first…", 42);
      let pending: Promise<unknown> = Promise.resolve();
      await renderVideo(id, {
        voice: true,
        by: byId ?? "studio",
        signal,
        // log lines arrive fast — save progress one write at a time, never out of order
        onProgress: (f, text) => (pending = pending.then(() => step(text ?? "Rendering the video…", 42 + f * 48))),
      });
      await pending;
    } else {
      const label = post.format === "Carousel" ? `Designing ${post.slides?.length ?? 1} slides…` : post.format === "Story" ? "Designing the story…" : "Designing the image…";
      await step(label, 42);
      let pending: Promise<unknown> = Promise.resolve();
      await renderImages(id, origin, { signal, onProgress: (f, text) => (pending = pending.then(() => step(text ?? label, 42 + f * 48))) });
      await pending;
    }
    throwIfCancelled(signal);

    if (!send) {
      await setJob(id, null, "Ready — review it, then Check & send for approval", { done: { ok: true, title: `Ready to review: ${title}`, body: "Generated — check it, then send it for approval." } });
      return;
    }
    await step("Brand Guard check, then sending for approval…", 92);
    const result = await submitForApproval(id);
    await setJob(id, null, result.status === "awaiting" ? "" : "Brand Guard needs a fix — see the checks, edit, then send again", {
      done:
        result.status === "awaiting"
          ? { ok: true, title: `Sent for approval: ${title}`, body: "Generated, brand-checked and waiting in Approvals." }
          : { ok: false, title: `Needs a fix: ${title}`, body: "Brand Guard found something it couldn't fix on its own." },
    });
  } catch (e) {
    if (e instanceof CancelledError || signal.aborted) {
      await setJob(id, null, "Generation cancelled").catch(() => undefined);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`auto-produce ${id}:`, msg);
    await setJob(id, null, `Automatic creation stopped: ${msg}`, { done: { ok: false, title: `Generation stopped: ${title}`, body: msg.slice(0, 200) } }).catch(() => undefined);
  }
}
