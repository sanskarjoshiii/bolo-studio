import { deletePost, updatePost, type PostPatch } from "@bolo/core";
import { authorizePost } from "@/lib/access";
import { body, handle } from "@/lib/api-route";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return updatePost(id, await body<PostPatch>(req));
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async (me) => {
    authorizePost(me, id);
    return deletePost(id);
  });
}
