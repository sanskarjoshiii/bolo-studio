import { publishNow } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";

export const maxDuration = 300;

/** Drafts → "Post now": publish an approved post immediately through the company's connections. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return publishNow(id);
  });
}
