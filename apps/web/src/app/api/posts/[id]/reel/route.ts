import { authorizePost } from "@/lib/access";
import { body, handle } from "@/lib/api-route";
import { startMediaJob } from "@/lib/pipeline";

/** Render the reel / story video (Remotion + Sarvam voiceover) — runs in the background. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    const { voice = true } = await body<{ voice?: boolean }>(req).catch(() => ({ voice: true }));
    startMediaJob(id, "video", { origin: new URL(req.url).origin, voice, byId: me.id });
    return { started: true };
  });
}
