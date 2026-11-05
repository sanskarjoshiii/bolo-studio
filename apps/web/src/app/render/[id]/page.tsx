import { notFound } from "next/navigation";
import { loadClient, readStore, verifyToken } from "@bolo/core";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";

export const dynamic = "force-dynamic";

/**
 * Full-size creative for the headless renderer. Not linked anywhere; it only renders with
 * a short-lived signed token issued by POST /api/posts/[id]/render.
 */
export default async function RenderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; slide?: string }> }) {
  const { id } = await params;
  const { t, slide } = await searchParams;
  const token = verifyToken<{ pid: string; kind: string; w: number; h: number }>(t);
  if (!token || token.kind !== "render" || token.pid !== id) notFound();
  const post = readStore().posts.find((p) => p.id === id);
  if (!post) notFound();
  const client = loadClient(post.clientId);

  return (
    <div style={{ width: token.w, height: token.h, overflow: "hidden" }}>
      <MiniCreative variant={toVariant(post.creative)} content={contentFromPost(post, client?.short ?? "", Number(slide ?? 0))} className="h-full w-full" />
    </div>
  );
}
