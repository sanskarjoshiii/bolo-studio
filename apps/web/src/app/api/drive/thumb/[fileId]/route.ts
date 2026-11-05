import { NextResponse } from "next/server";
import { driveThumbnail } from "@bolo/core";
import { currentUser } from "@/lib/auth";

/** Drive thumbnails need the connected account's token, so they're proxied for signed-in users. */
export async function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  if (!(await currentUser())) return new NextResponse(null, { status: 401 });
  const { fileId } = await params;
  const t = await driveThumbnail(fileId).catch(() => null);
  if (!t) return new NextResponse(null, { status: 404 });
  return new NextResponse(t.bytes, { headers: { "Content-Type": t.type, "Cache-Control": "private, max-age=600" } });
}
