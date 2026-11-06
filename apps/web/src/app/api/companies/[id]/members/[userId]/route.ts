import { canManage, removeMember, updateMember, WorkflowError, type MemberRole } from "@bolo/core";
import { authorizeCompany, authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** Change a member's role or whether they can approve. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, userId } = await params;
  return handle(async (me) => {
    authorizeManage(me, id);
    const b = await body<{ role?: MemberRole; canApprove?: boolean }>(req);
    return updateMember(id, userId, b);
  });
}

/** Remove a member — or leave the company yourself. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, userId } = await params;
  return handle(async (me) => {
    authorizeCompany(me, id);
    if (userId !== me.id && !canManage(me, id)) throw new WorkflowError(403, "Only the owner or admins can remove people.");
    return removeMember(id, userId);
  });
}
