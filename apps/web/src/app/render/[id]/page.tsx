import { readFileSync } from "node:fs";
import { notFound } from "next/navigation";
import { brandTokens, loadClient, mediaPath, readStore, verifyToken } from "@bolo/core";
import { BrandCreative, photoIndex, postDesign } from "@/components/ui/brand-creative";

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
  const client = post && loadClient(post.clientId);
  if (!post || !client) notFound();

  // Reference photos (uploads / Drive) go into the design; inlined so the renderer needs no login
  const photos = (post.media ?? []).filter((m) => m.kind === "image" && m.source !== "template");
  const n = Number(slide ?? 0);
  const pick = photos[photoIndex(n, photos.length)];
  const photo = pick ? `data:${pick.type};base64,${readFileSync(mediaPath(post.id, pick.file)).toString("base64")}` : undefined;
  const brand = brandTokens(client);
  const { layout, design } = postDesign(post, brand, photos.length > 0, n);

  return (
    <div style={{ width: token.w, height: token.h, overflow: "hidden" }}>
      <BrandCreative brand={brand} layout={layout} design={design} photo={photo} className="h-full w-full" />
    </div>
  );
}
