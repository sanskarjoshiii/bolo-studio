import { submitForApproval } from "@bolo/core";
import { handle } from "@/lib/api-route";

/** Run Brand Guard; passes → sent to the client's approvals room, fails → back to the agents. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => submitForApproval(id));
}
