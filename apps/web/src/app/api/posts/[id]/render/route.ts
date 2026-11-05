import { chromium } from "playwright";
import { addMedia, prepareForRender, readStore, removeMedia, signToken, WorkflowError, type Post } from "@bolo/core";
import { creativeTextHash } from "@bolo/core/shared";
import { handle } from "@/lib/api-route";

export const maxDuration = 120;

// Instagram/Facebook feed 4:5 · stories 9:16
const SIZE = { feed: { w: 1080, h: 1350 }, vertical: { w: 1080, h: 1920 } } as const;

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Visual Designer path: render the brand template with the post's own text to real PNGs —
 * one for a post or story, one per slide for a carousel — replacing earlier renders
 * (uploaded files are kept).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const found = readStore().posts.find((p) => p.id === id);
    if (!found) throw new WorkflowError(404, "Post not found.");
    if (found.status === "scheduled" || found.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");
    if (found.format === "Reel") throw new WorkflowError(400, "Reels are videos — use Generate reel.");
    const post = await prepareForRender(id); // RERA no. etc. on the text before it's drawn
    const size = post.format === "Story" ? SIZE.vertical : SIZE.feed;
    const count = post.format === "Carousel" ? Math.max(1, post.slides?.length ?? 1) : 1;
    const origin = new URL(req.url).origin;

    const browser = await chromium.launch().catch((e: Error) => {
      throw new WorkflowError(409, `Renderer unavailable — run “npx playwright install chromium”. (${e.message.split("\n")[0]})`);
    });
    const pngs: Buffer[] = [];
    try {
      const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
      for (let i = 0; i < count; i++) {
        const token = signToken({ pid: id, kind: "render", ...size }, 120);
        const res = await page.goto(`${origin}/render/${id}?t=${encodeURIComponent(token)}&slide=${i}`, { waitUntil: "networkidle" });
        if (!res?.ok()) throw new WorkflowError(409, `Render page failed (${res?.status()}).`);
        await page.evaluate(() => document.fonts.ready);
        pngs.push(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size.w, height: size.h } }));
      }
    } finally {
      await browser.close();
    }

    const previous = (post.media ?? []).filter((m) => m.source === "template" && m.kind === "image");
    let result: Post = post;
    for (const [i, png] of pngs.entries()) {
      result = await addMedia(id, {
        name: `${slug(post.title)}${count > 1 ? `-slide-${i + 1}` : ""}-${size.w}x${size.h}.png`,
        type: "image/png",
        bytes: new Uint8Array(png),
        source: "template",
        textHash: creativeTextHash(post),
      });
    }
    for (const m of previous) result = await removeMedia(id, m.file);
    return result;
  });
}
