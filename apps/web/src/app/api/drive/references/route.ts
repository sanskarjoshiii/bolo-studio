import { listReferences, uploadReference, WorkflowError } from "@bolo/core";
import { handle } from "@/lib/api-route";

/** Reference images/videos in the client's Drive folder (Bolo Studio/<Client>/References). */
export async function GET(req: Request) {
  const client = new URL(req.url).searchParams.get("client") ?? "";
  return handle(() => listReferences(client));
}

/** Upload a reference from the computer into that Drive folder. */
export async function POST(req: Request) {
  const client = new URL(req.url).searchParams.get("client") ?? "";
  return handle(async () => {
    const file = (await req.formData().catch(() => null))?.get("file");
    if (!(file instanceof File)) throw new WorkflowError(400, "Choose a file.");
    return uploadReference(client, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  });
}
