"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Client, Media, Post } from "@bolo/core";
import { brandTokens, sizeFor } from "@bolo/core/shared";
import { contentFromPost, MiniCreative, toVariant } from "@/components/ui/mini-creative";
import { BrandCreative, photoIndex, postDesign } from "@/components/ui/brand-creative";
import { mediaUrl } from "./post-drawer";
import { cn } from "@/lib/cn";

/**
 * What the audience will see, in a phone frame at the format's real ratio: the attached media
 * when there is some (rendered or uploaded), otherwise the live brand template.
 */
export function PhonePreview({
  post,
  client,
  className,
}: {
  post: Pick<Post, "id" | "title" | "creativeText" | "format" | "slides" | "creative" | "media" | "captions" | "layout" | "size" | "design" | "languages">;
  client: Pick<Client, "short" | "name" | "mark" | "products" | "files">;
  className?: string;
}) {
  const vertical = post.format === "Story" || post.format === "Reel";
  const size = sizeFor(post);
  const video = (post.media ?? []).filter((m) => m.kind === "video").at(-1);
  const allImages = (post.media ?? []).filter((m) => m.kind === "image");
  const photos = allImages.filter((m) => m.source !== "template");
  // Same rule as publishing: designed renders when there are any, otherwise the uploaded images
  const designed = allImages.filter((m) => m.source === "template");
  const images = designed.length ? designed : allImages;
  const templateSlides = post.format === "Carousel" ? Math.max(1, post.slides?.length ?? 1) : 1;
  const frames: ({ kind: "media"; media: Media } | { kind: "template"; slide: number })[] =
    vertical && video
      ? [{ kind: "media", media: video }]
      : images.length
        ? images.map((m) => ({ kind: "media" as const, media: m }))
        : Array.from({ length: templateSlides }, (_, i) => ({ kind: "template" as const, slide: i }));
  const [i, setI] = useState(0);
  const at = Math.min(i, frames.length - 1);
  const frame = frames[at];

  return (
    <div className={cn("mx-auto w-full max-w-[300px]", className)}>
      <div className="rounded-[34px] bg-[#0b0f0d] p-2.5 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
        <div className="mb-2 flex items-center gap-2 px-2 pt-1">
          <span className="grid size-6 place-items-center rounded-full text-[10px] font-semibold" style={{ background: client.mark.bg, color: client.mark.fg }}>
            {client.name[0]}
          </span>
          <span className="truncate text-[11px] font-medium text-white">{client.short}</span>
          <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[9.5px] text-white/70">{post.format}</span>
        </div>
        <div className="relative overflow-hidden rounded-[22px] bg-black" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
          {frame.kind === "media" ? (
            frame.media.kind === "video" ? (
              <video key={frame.media.file} src={mediaUrl(post as Post, frame.media)} controls playsInline className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- auth-gated media
              <img src={mediaUrl(post as Post, frame.media)} alt="" className="size-full object-cover" />
            )
          ) : (
            <TemplateFrame post={post} client={client} photos={photos} slide={frame.slide} />
          )}
          {frames.length > 1 && (
            <>
              <button
                onClick={() => setI(Math.max(0, at - 1))}
                disabled={at === 0}
                aria-label="Previous slide"
                className="absolute top-1/2 left-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white disabled:opacity-0"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setI(Math.min(frames.length - 1, at + 1))}
                disabled={at === frames.length - 1}
                aria-label="Next slide"
                className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white disabled:opacity-0"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                {at + 1} / {frames.length}
              </span>
            </>
          )}
        </div>
        {post.format !== "Story" && post.captions[0]?.text && (
          <p className="line-clamp-3 px-2 pt-2.5 pb-1 text-[11px] leading-snug text-white/75">
            <span className="font-semibold text-white">{client.short}</span> {post.captions[0].text}
          </p>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-fog">
        {frame.kind === "media" ? "Attached file — this is what gets published" : "Live template preview — generate or upload to attach the real file"}
      </p>
    </div>
  );
}

/** The live design before anything is rendered — the brand layout with the reference photos in it. */
function TemplateFrame({
  post,
  client,
  photos,
  slide,
}: {
  post: Pick<Post, "id" | "title" | "creativeText" | "format" | "slides" | "creative" | "layout" | "size" | "design">;
  client: Pick<Client, "short" | "name" | "mark" | "products" | "files">;
  photos: Media[];
  slide: number;
}) {
  if (post.format === "Reel") {
    return <MiniCreative variant={toVariant(post.creative)} content={contentFromPost(post, client.short, slide)} className="size-full" />;
  }
  const brand = brandTokens({ ...client, files: client.files ?? [] });
  const { layout, design } = postDesign(post, brand, photos.length > 0, slide);
  const pick = photos[photoIndex(slide, photos.length)];
  return <BrandCreative brand={brand} layout={layout} design={design} photo={pick ? mediaUrl(post as Post, pick) : undefined} className="size-full" />;
}
