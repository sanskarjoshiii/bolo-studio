import { connectionStatus, startTelegramConnect } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** Start connecting Telegram: a one-time code and the "add the bot to your group" link. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const { company } = await body<{ company: string }>(req);
    authorizeManage(me, company);
    return startTelegramConnect(company);
  });
}

/** Polled by the Connections page while the client adds the bot to their group. */
export async function GET(req: Request) {
  return handle(async (me) => {
    const company = new URL(req.url).searchParams.get("company") ?? "";
    authorizeManage(me, company);
    return connectionStatus(company).telegram;
  });
}
