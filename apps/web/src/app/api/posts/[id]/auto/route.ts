import { WorkflowError } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { body, handle } from "@/lib/api-route";
import { startAutoProduce } from "@/lib/pipeline";

/** "Write with AI" on an existing draft: the AI writes, media renders, optionally sends for approval. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    const post = authorizePost(me, id);
    const { send = false } = await body<{ send?: boolean }>(req).catch(() => ({ send: false }));
    if (post.status !== "draft" && post.status !== "brand-check") throw new WorkflowError(409, "Only posts in production can be rewritten.");
    startAutoProduce(id, { origin: new URL(req.url).origin, send, by: me.name, byId: me.id });
    return { started: true };
  });
}
