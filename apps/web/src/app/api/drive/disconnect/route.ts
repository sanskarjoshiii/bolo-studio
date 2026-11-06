import { disconnectDrive } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

export async function POST(req: Request) {
  return handle(async (me) => {
    const { company } = await body<{ company: string }>(req);
    authorizeManage(me, company);
    await disconnectDrive(company);
    return { ok: true };
  });
}
