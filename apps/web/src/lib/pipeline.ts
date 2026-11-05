import "server-only";
import { readStore, setJob, submitForApproval, WorkflowError, writeWithClaude } from "@bolo/core";
import { renderImages, renderVideo } from "./media-jobs";

// "Claude writes it": idea → Claude (brief, captions, slides / scenes) → media → Brand Guard →
// the client's Telegram group. Runs in the background; each step is shown live in the editor.

// On globalThis: Next bundles API routes and pages separately, each with its own module copy
const g = globalThis as typeof globalThis & { __boloRunning?: Set<string> };
const running = (g.__boloRunning ??= new Set<string>());

export function isRunning(id: string) {
  return running.has(id);
}

export function startAutoProduce(id: string, opts: { origin: string; send: boolean; by: string }) {
  if (running.has(id)) throw new WorkflowError(409, "Claude is already working on this post.");
  running.add(id);
  void autoProduce(id, opts).finally(() => running.delete(id));
}

async function autoProduce(id: string, { origin, send, by }: { origin: string; send: boolean; by: string }) {
  try {
    await setJob(id, "Claude is writing the brief, headline and captions…");
    await writeWithClaude(id);

    const post = readStore().posts.find((p) => p.id === id)!;
    if (post.format === "Reel") {
      await setJob(id, "Rendering the reel video with voiceover… (1–2 min)");
      await renderVideo(id, { voice: true, by });
    } else {
      await setJob(id, post.format === "Carousel" ? `Rendering ${post.slides?.length ?? 1} slides…` : post.format === "Story" ? "Rendering the story…" : "Rendering the image…");
      await renderImages(id, origin);
    }

    if (!send) {
      await setJob(id, null, "Ready — review it, then Check & send to client");
      return;
    }
    await setJob(id, "Brand Guard check, then sending to the client…");
    const result = await submitForApproval(id);
    await setJob(id, null, result.status === "awaiting" ? "" : "Brand Guard needs a fix — see the checks, edit, then send again");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`auto-produce ${id}:`, msg);
    await setJob(id, null, `Automatic creation stopped: ${msg}`).catch(() => undefined);
  }
}
