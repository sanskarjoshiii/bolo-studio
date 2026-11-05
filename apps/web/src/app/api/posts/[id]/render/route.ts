import { handle } from "@/lib/api-route";
import { renderImages } from "@/lib/media-jobs";

export const maxDuration = 120;

/** Render the brand template to PNGs (post, story, or one per carousel slide). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => renderImages(id, new URL(req.url).origin));
}
