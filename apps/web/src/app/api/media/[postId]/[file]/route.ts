import { NextResponse } from "next/server";
import { canAccess, readMedia, readStore, WorkflowError } from "@bolo/core";
import { currentUser } from "@/lib/auth";

/** Serve an attached file to members of the post's company only. */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string; file: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { postId, file } = await params;
  const post = readStore().posts.find((p) => p.id === postId);
  const media = post?.media?.find((m) => m.file === file);
  if (!post || !media || !canAccess(me, post.clientId)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const bytes = readMedia(postId, file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": media.type, "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="${file}"` },
    });
  } catch (e) {
    if (e instanceof WorkflowError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
