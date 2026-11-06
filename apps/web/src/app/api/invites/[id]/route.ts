import { respondInvite } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/** Accept or decline an invite sent to me. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    const { accept } = await body<{ accept: boolean }>(req);
    return respondInvite(id, me, Boolean(accept));
  });
}
