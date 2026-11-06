import { clientReply } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/**
 * Approve, reject or ask for changes from the studio. Who is acting comes from the signed-in
 * account — never from the request — and must be one of the company's approvers (or, when the
 * company has none, its owner).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    const b = await body<{ text: string }>(req);
    return clientReply(id, { userId: me.id, handle: me.telegram, name: me.name, text: b.text ?? "", via: "dashboard" });
  });
}
