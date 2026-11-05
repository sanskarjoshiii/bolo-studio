import { resendApproval } from "@bolo/core";
import { handle } from "@/lib/api-route";

/** Re-post the approval package in the client's Telegram room. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => resendApproval(id));
}
