import { markNotificationsRead } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/** Mark some (ids) or all of my notifications read. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const { ids } = await body<{ ids?: string[] }>(req).catch(() => ({ ids: undefined }));
    await markNotificationsRead(me.id, Array.isArray(ids) ? ids : undefined);
    return { ok: true };
  });
}
