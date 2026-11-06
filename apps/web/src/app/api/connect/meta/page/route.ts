import { chooseMetaPage } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** The client picked which Facebook Page (and its Instagram) to post to. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const { company, pageId } = await body<{ company: string; pageId: string }>(req);
    authorizeManage(me, company);
    await chooseMetaPage(company, pageId);
    return { ok: true };
  });
}
