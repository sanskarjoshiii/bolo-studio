import { findUserByLogin, inviteMember, WorkflowError, type MemberRole } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/**
 * Invite someone who already has a Bolo Studio account, by email or username. They get a
 * notification and join when they accept.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizeManage(me, id);
    const b = await body<{ login: string; role?: MemberRole; canApprove?: boolean }>(req);
    if (!b.login?.trim()) throw new WorkflowError(400, "Enter their email or username.");
    const target = findUserByLogin(b.login);
    if (!target) throw new WorkflowError(404, `No Bolo Studio account matches “${b.login.trim()}”. Ask them to sign up first, then invite them.`);
    if (target.id === me.id) throw new WorkflowError(409, "That's you.");
    const invite = await inviteMember(id, me, target, { role: b.role, canApprove: b.canApprove });
    return { invite, user: { name: target.name, username: target.username } };
  });
}
