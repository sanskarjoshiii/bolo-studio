import { submitForApproval } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";

/** Run Brand Guard; passes → waiting for the client's approval, fails → back to production. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return submitForApproval(id);
  });
}
