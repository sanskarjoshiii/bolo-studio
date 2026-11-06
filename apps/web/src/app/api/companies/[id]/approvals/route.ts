import { updateApprovals } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** Telegram approvers (usernames, no account needed) and "Anyone in this group can approve". */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizeManage(me, id);
    return updateApprovals(id, await body<{ telegram?: string[]; anyoneInGroup?: boolean }>(req));
  });
}
