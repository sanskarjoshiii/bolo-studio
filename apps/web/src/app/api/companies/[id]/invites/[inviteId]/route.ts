import { cancelInvite } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { handle } from "@/lib/api-route";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  const { id, inviteId } = await params;
  return handle(async (me) => {
    authorizeManage(me, id);
    return cancelInvite(id, inviteId);
  });
}
