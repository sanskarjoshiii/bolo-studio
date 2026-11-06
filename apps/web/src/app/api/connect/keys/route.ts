import { setAiConnection, setSarvamKey, WorkflowError, type AiProvider } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

/** Paste-a-key connections: Sarvam AI (voiceovers) and the AI agent (Claude or OpenAI). Keys are checked, then stored encrypted. */
export async function POST(req: Request) {
  return handle(async (me) => {
    const b = await body<{ company: string; kind: "sarvam" | "ai"; key: string; provider?: AiProvider; model?: string }>(req);
    authorizeManage(me, b.company);
    if (b.kind === "sarvam") await setSarvamKey(b.company, b.key ?? "");
    else if (b.kind === "ai") await setAiConnection(b.company, { provider: b.provider ?? "anthropic", key: b.key ?? "", model: b.model });
    else throw new WorkflowError(400, "Unknown connection.");
    return { ok: true };
  });
}
