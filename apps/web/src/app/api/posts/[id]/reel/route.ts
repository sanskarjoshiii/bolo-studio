import { body, handle } from "@/lib/api-route";
import { renderVideo } from "@/lib/media-jobs";

export const maxDuration = 300;

/** Render the reel / story video (Remotion + Sarvam voiceover). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    const { voice = true } = await body<{ voice?: boolean }>(req).catch(() => ({ voice: true }));
    return { post: await renderVideo(id, { voice, by: me.name }) };
  });
}
