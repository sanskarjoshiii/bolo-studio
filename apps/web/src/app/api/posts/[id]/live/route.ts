import { markLive } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/** Manual "it's live" for dry-run posts; real posts are marked by the Postiz webhook on the Publisher. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const b = await body<{ permalink?: string }>(req);
    return markLive({ postId: id, permalink: b.permalink?.trim() || undefined });
  });
}
