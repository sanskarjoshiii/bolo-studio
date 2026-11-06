import { updateKit, WorkflowError, type BrandKitFile, type ClientMeta } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** Edit the Brand Kit: company details, colours, and any of its files. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    authorizeManage(me, id);
    const b = await body<{ meta?: Partial<ClientMeta>; files?: BrandKitFile[]; removeFiles?: string[] }>(req);
    // Switch rooms are set by Bolo Studio admins (they bridge the groups in Switch Console)
    if (b.meta?.rooms && me.role !== "admin") throw new WorkflowError(403, "Switch rooms are set by Bolo Studio admins.");
    return updateKit(id, b);
  });
}
