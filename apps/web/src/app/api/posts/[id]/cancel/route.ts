import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";
import { cancelJob } from "@/lib/pipeline";

/** Stop whatever is being generated for this post. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return cancelJob(id);
  });
}
