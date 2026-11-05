import { readStore, WorkflowError } from "@bolo/core";
import { body, handle } from "@/lib/api-route";
import { startAutoProduce } from "@/lib/pipeline";

/** "Write with Claude" on an existing draft: Claude writes, media renders, optionally sends to the client. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    const { send = false } = await body<{ send?: boolean }>(req).catch(() => ({ send: false }));
    const post = readStore().posts.find((p) => p.id === id);
    if (!post) throw new WorkflowError(404, "Post not found.");
    if (post.status !== "draft" && post.status !== "brand-check") throw new WorkflowError(409, "Only drafts can be rewritten.");
    startAutoProduce(id, { origin: new URL(req.url).origin, send, by: me.name });
    return { started: true };
  });
}
