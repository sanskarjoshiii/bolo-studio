import { importFromDrive } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

/** Attach a Drive reference to the post. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => importFromDrive(id, (await body<{ fileId: string }>(req)).fileId));
}
