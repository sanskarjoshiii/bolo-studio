import { NextResponse } from "next/server";
import { refreshStore, readMedia, readStore, verifyToken } from "@bolo/core";

/**
 * A media file at a signed, expiring public link — Instagram's publishing API downloads from a URL.
 * Only links signed by the publisher (kind "media", this post, this file) work.
 */
export async function GET(req: Request, { params }: { params: Promise<{ postId: string; file: string }> }) {
  await refreshStore();
  const { postId, file } = await params;
  const t = verifyToken<{ kind: string; pid: string; f: string }>(new URL(req.url).searchParams.get("t") ?? undefined);
  if (t?.kind !== "media" || t.pid !== postId || t.f !== file) return new NextResponse(null, { status: 403 });
  const media = readStore().posts.find((p) => p.id === postId)?.media?.find((m) => m.file === file);
  if (!media) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(readMedia(postId, file)), { headers: { "Content-Type": media.type, "Cache-Control": "private, max-age=600" } });
}
