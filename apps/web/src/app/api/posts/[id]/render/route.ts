import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";
import { startMediaJob } from "@/lib/pipeline";

/** Render the brand design to PNGs (post, story, or one per carousel slide) — runs in the background. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    startMediaJob(id, "images", { origin: new URL(req.url).origin, byId: me.id });
    return { started: true };
  });
}
