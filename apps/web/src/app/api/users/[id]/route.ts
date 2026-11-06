import { deleteUser, updateUser, WorkflowError, type Role } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

type Ctx = { params: Promise<{ id: string }> };

/** Admins edit anyone; everyone can edit their own name, Telegram handle and password (not role). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async (me) => {
    const b = await body<{ name?: string; role?: Role; telegram?: string; password?: string; username?: string }>(req);
    if (me.role !== "admin" && me.id !== id) throw new WorkflowError(403, "Only admins can edit other people.");
    if (me.role !== "admin" && b.role) throw new WorkflowError(403, "Only admins can change roles.");
    return updateUser(id, b);
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(
    async (me) => {
      if (me.id === id) throw new WorkflowError(409, "You can't delete your own account.");
      await deleteUser(id);
      return { id };
    },
    { admin: true },
  );
}
