import { clientReply, WorkflowError } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/**
 * An approver acting from the dashboard instead of Telegram. The handle comes from the
 * signed-in account — never from the request — and must be listed in protocol.md.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    if (!me.telegram) throw new WorkflowError(403, "Add your Telegram username to your account to approve from the dashboard.");
    const b = await body<{ text: string }>(req);
    return clientReply(id, { handle: me.telegram, text: b.text ?? "", via: "dashboard" });
  });
}
