import { createIdea, readStore, type NewContent } from "@bolo/core";
import { authorizeCompany } from "@/lib/access";
import { body, handle } from "@/lib/api-route";
import { startAutoProduce } from "@/lib/pipeline";

/** New content from the composer: idea, format, size, languages, platforms, time, and who writes it. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const b = await body<Omit<NewContent, "author" | "authorId"> & { autoSend?: boolean }>(req);
    authorizeCompany(me, b.clientId);
    const post = await createIdea({
      clientId: b.clientId,
      text: b.text ?? "",
      author: me.name,
      authorId: me.id,
      format: b.format,
      platforms: b.platforms,
      scheduledAt: b.scheduledAt,
      mode: b.mode,
      size: b.size,
      languages: b.languages,
    });
    // AI mode: write → media → Brand Guard → approval, in the background (the dock shows progress)
    if (b.mode === "claude") startAutoProduce(post.id, { origin: new URL(req.url).origin, send: b.autoSend !== false, by: me.name, byId: me.id });
    return { post: readStore().posts.find((p) => p.id === post.id) ?? post };
  });
}
