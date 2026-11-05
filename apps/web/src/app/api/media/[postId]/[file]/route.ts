import { NextResponse } from "next/server";
import { readMedia, readStore, WorkflowError } from "@bolo/core";
import { currentUser } from "@/lib/auth";

/** Serve an attached file to signed-in users only. */
export async function GET(_req: Request, { params }: { params: Promise<{ postId: string; file: string }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { postId, file } = await params;
  const media = readStore()
    .posts.find((p) => p.id === postId)
    ?.media?.find((m) => m.file === file);
  if (!media) return NextResponse.json({ error: "File not found." }, { status: 404 });
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
