import { createIdea, importFromDrive, readStore, type NewContent } from "@bolo/core";
import { body, handle } from "@/lib/api-route";
import { startAutoProduce } from "@/lib/pipeline";

/** New content from the composer: idea + format + platforms + time, Drive references, and who writes it. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const b = await body<Omit<NewContent, "author"> & { driveFileIds?: string[]; autoSend?: boolean }>(req);
    const post = await createIdea({
      clientId: b.clientId,
      text: b.text ?? "",
      author: me.name,
      format: b.format,
      platforms: b.platforms,
      scheduledAt: b.scheduledAt,
      mode: b.mode,
    });
    const failed: string[] = [];
    for (const id of (b.driveFileIds ?? []).slice(0, 10)) {
      await importFromDrive(post.id, id).catch((e: Error) => failed.push(e.message));
    }
    // Claude mode: write → media → Brand Guard → Telegram, in the background (editor shows progress)
    if (b.mode === "claude") startAutoProduce(post.id, { origin: new URL(req.url).origin, send: b.autoSend !== false, by: me.name });
    return { post: readStore().posts.find((p) => p.id === post.id) ?? post, failed };
  });
}
