import { resendApproval } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";

/** Re-send the approval package (media + message) to the client's Telegram. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return resendApproval(id);
  });
}
