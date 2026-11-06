import { disconnectDrive, disconnectSocial, disconnectTelegram, removeConnection, WorkflowError } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

const KINDS = ["telegram", "meta", "linkedin", "drive", "sarvam", "ai"] as const;

/** Disconnect one of the company's connections. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const { company, kind } = await body<{ company: string; kind: (typeof KINDS)[number] }>(req);
    authorizeManage(me, company);
    if (!KINDS.includes(kind)) throw new WorkflowError(400, "Unknown connection.");
    if (kind === "telegram") await disconnectTelegram(company);
    else if (kind === "meta" || kind === "linkedin") await disconnectSocial(company, kind);
    else if (kind === "drive") await disconnectDrive(company);
    else await removeConnection(company, kind);
    return { ok: true };
  });
}
