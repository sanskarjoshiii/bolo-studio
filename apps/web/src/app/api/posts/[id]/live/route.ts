import { markLive } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** Manual "it's live" for dry-run posts; real posts are marked live by the publisher. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    const b = await body<{ permalink?: string }>(req);
    return markLive({ postId: id, permalink: b.permalink?.trim() || undefined });
  });
}
