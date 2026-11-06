import { addMedia, removeMedia, WorkflowError } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { handle } from "@/lib/api-route";

type Ctx = { params: Promise<{ id: string }> };

/** Attach a real file (multipart field "file"). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new WorkflowError(400, "Choose a file to upload.");
    return addMedia(id, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const file = new URL(req.url).searchParams.get("file") ?? "";
  return handle(async (me) => {
    authorizePost(me, id);
    return removeMedia(id, file);
  });
}
