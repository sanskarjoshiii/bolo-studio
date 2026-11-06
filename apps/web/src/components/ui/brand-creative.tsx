import type { Post } from "@bolo/core";
import { autoLayout, sizeFor, type BrandTokens, type Layout } from "@bolo/core/shared";
import { contentFromPost } from "@/components/ui/mini-creative";
import { cn } from "@/lib/cn";

/**
 * Designed post creatives drawn from a company's design tokens (tokens.json → BrandTokens).
 * The same component renders the live preview in the studio and the full-size PNG on
 * /render/[id], so text always comes from the post and is spelled right.
 *
 * Every size is in container units of the shorter side (cqmin), so one design works from a
 * thumbnail to a 1920 px render and at any ratio — portrait, square, landscape or custom. Wide
 * frames switch the photo layouts to side-by-side.
 */

export type Orientation = "tall" | "square" | "wide";

/** Text, art direction and slide position a layout prints. */
export type Design = {
  kicker: string;
  headline: string;
  /** Supporting line(s) without the price and the legal footnote. */
  sub: string;
  /** "₹78 L onwards*" — pulled out of the text so the offer layout can badge it. */
  price?: string;
  /** RERA no. and similar legal text — always printed small. */
  footnote: string;
  brandName: string;
  /** The headline word set in the accent colour (from the writer), if any. */
  highlight?: string;
  /** Button label (from the writer), if any. */
  cta?: string;
  orientation: Orientation;
  /** Carousels only. */
  slide?: { index: number; total: number; role: "cover" | "inner" | "cta" };
};

type DesignSource = Pick<Post, "title" | "creativeText" | "format" | "slides" | "layout" | "size" | "design">;

/** Which reference photo a slide uses: they rotate when there are fewer photos than slides. */
export function photoIndex(slide: number, count: number) {
  return count > 0 ? Math.max(0, slide) % count : -1;
}

export function orientationOf(w: number, h: number): Orientation {
  return w > h * 1.2 ? "wide" : h > w * 1.2 ? "tall" : "square";
}

/**
 * Layout and text for one frame of a post. Carousels: slide 1 is the cover in the post's
 * layout, inner slides are numbered, and the last slide (3+ slides) is a call to action.
 */
export function postDesign(post: DesignSource, brand: BrandTokens, hasPhoto: boolean, slide = 0): { layout: Layout; design: Design } {
  const c = contentFromPost(post, brand.kicker, slide);
  const segs = (c.footer ?? "")
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);
  const price = segs.find((s) => /₹/.test(s));
  const size = sizeFor(post);
  const design: Design = {
    kicker: c.kicker ?? brand.kicker,
    headline: c.headline ?? post.title,
    sub: segs.filter((s) => s !== price).join(" · "),
    price,
    footnote: c.footnote ?? "",
    brandName: brand.name,
    highlight: post.design?.highlight,
    cta: post.design?.cta,
    orientation: orientationOf(size.w, size.h),
  };

  let layout = autoLayout(post, hasPhoto);
  // Photo layouts need a photo; without one the editorial layout carries the same message
  if (!hasPhoto && (layout === "hero" || layout === "split")) layout = price ? "offer" : "editorial";
  // Offer without a price has nothing to badge
  if (layout === "offer" && !price) layout = hasPhoto ? "hero" : "editorial";

  if (c.slide && c.slide.total > 1) {
    const { index, total } = c.slide;
    const role = index === 0 ? "cover" : index === total - 1 && total > 2 ? "cta" : "inner";
    design.slide = { index, total, role };
  }
  return { layout, design };
}

/* --------------------------------- tokens --------------------------------- */

const FONT_VARS: Record<string, string> = {
  Inter: "var(--font-inter)",
  "Playfair Display": "var(--font-playfair)",
};
const fontOf = (name: string) => `${FONT_VARS[name] ?? `"${name}"`}, var(--font-inter), ui-sans-serif, system-ui, sans-serif`;
const isSerif = (name: string) => /playfair|serif|garamond|lora|fraunces|cormorant|libre baskerville/i.test(name);
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const shade = (c: string, pct: number) => `color-mix(in srgb, ${c} ${100 - pct}%, #000)`;

/** Google Fonts stylesheet for brand fonts the app doesn't bundle (Inter and Playfair are bundled). */
export function brandFontsHref(brand: Pick<BrandTokens, "fontHead" | "fontBody">) {
  const fams = [...new Set([brand.fontHead, brand.fontBody])].filter((f) => f && !FONT_VARS[f] && /^[\w ]{2,40}$/.test(f));
  if (!fams.length) return null;
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`).join("&")}&display=block`;
}

/** WCAG relative luminance of a #rgb / #rrggbb colour; null for anything else. */
function luminance(c: string) {
  const m = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 21; // unknown format — trust the brand
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/**
 * Layouts on the primary colour: when the brand accent is too close to it (e.g. dark teal on
 * teal), the accent falls back to the light brand background so kickers and badges stay legible.
 */
function onPrimary(brand: BrandTokens): BrandTokens {
  if (contrast(brand.accent, brand.primary) >= 2.5) return brand;
  const light = (luminance(brand.primary) ?? 0) < 0.4;
  return { ...brand, accent: light ? brand.bg : brand.text };
}
/**
 * Layouts on the light background: an accent too pale to read on it (yellow on cream) is darkened
 * until it reads — same hue, so it still looks like the brand.
 */
function onLight(brand: BrandTokens): BrandTokens {
  const c = contrast(brand.accent, brand.bg);
  if (c >= 3) return brand;
  return { ...brand, accent: shade(brand.accent, c >= 2 ? 30 : 45) };
}

/** Text drawn on an accent-filled badge or button. */
const inkOn = (brand: BrandTokens) => (contrast(brand.primary, brand.accent) >= 3 ? brand.primary : (luminance(brand.accent) ?? 1) > 0.4 ? "#111111" : "#ffffff");

/** Headline size in cqmin: long headlines step down so they always fit. */
const headSize = (text: string, big: number) => {
  const n = text.length;
  const s = n <= 14 ? big : n <= 24 ? big * 0.8 : n <= 40 ? big * 0.64 : big * 0.5;
  return `${s.toFixed(2)}cqmin`;
};

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}₹%]/gu, "");

/** The word in the accent colour: the writer's pick, else one with a number or ₹, else none on short headlines. */
function emphasisIndex(words: string[], highlight?: string) {
  if (highlight) {
    const i = words.findIndex((w) => norm(w) === norm(highlight));
    if (i >= 0) return i;
  }
  const i = words.findIndex((w) => /\d|₹/.test(w));
  return i >= 0 ? i : words.length > 3 ? words.length - 1 : -1;
}

function Emphasis({ text, color, highlight }: { text: string; color: string; highlight?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const at = emphasisIndex(words, highlight);
  return (
    <>
      {words.map((w, i) => (
        <span key={i} style={i === at ? { color } : undefined}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

type Props = { brand: BrandTokens; layout: Layout; design: Design; photo?: string; className?: string };

export function BrandCreative({ brand: tokens, layout, design, photo, className }: Props) {
  const role = design.slide?.role;
  // Editorial and inner slides sit on the light background; everything else on the primary colour
  const light = role === "inner" || (role !== "cta" && layout === "editorial");
  const brand = light ? onLight(tokens) : onPrimary(tokens);
  const view: ViewProps = { brand, design, photo, wide: design.orientation === "wide" };
  const fonts = brandFontsHref(tokens);
  const body = role === "inner" ? <Inner {...view} /> : role === "cta" ? <Cta {...view} /> : LAYOUT_VIEWS[layout](view);
  return (
    <div
      className={cn("relative overflow-hidden [container-type:size]", className)}
      style={{ fontFamily: fontOf(brand.fontBody), background: brand.bg, color: brand.text, WebkitFontSmoothing: "antialiased", textRendering: "optimizeLegibility" }}
    >
      {fonts && <link rel="stylesheet" href={fonts} precedence="default" />}
      {body}
      {design.slide && <Dots brand={brand} slide={design.slide} light={role !== "inner"} />}
    </div>
  );
}

type ViewProps = { brand: BrandTokens; design: Design; photo?: string; wide: boolean };
type View = (p: ViewProps) => React.ReactNode;

/* ------------------------------ building blocks ------------------------------ */

function Head({ brand, design, color, accent, size, className, weight }: { brand: BrandTokens; design: Design; color: string; accent: string; size: string; className?: string; weight?: number }) {
  const serif = isSerif(brand.fontHead);
  return (
    <p
      className={cn("leading-[1.02] text-balance", className)}
      style={{ fontFamily: fontOf(brand.fontHead), fontSize: size, color, fontWeight: weight ?? (serif ? 600 : 700), letterSpacing: serif ? "-0.01em" : "-0.03em" }}
    >
      <Emphasis text={design.headline} color={accent} highlight={design.highlight} />
    </p>
  );
}

function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <span className="flex items-center gap-[2cqmin] text-[3.4cqmin] font-semibold tracking-[0.2em] uppercase" style={{ color }}>
      <span className="h-[0.35cqmin] w-[5cqmin]" style={{ background: color }} />
      {text}
    </span>
  );
}

function Sub({ design, color, className }: { design: Design; color: string; className?: string }) {
  const text = [design.sub, design.price].filter(Boolean).join(" · ");
  return text ? (
    <p className={cn("text-[4.1cqmin] leading-snug", className)} style={{ color }}>
      {text}
    </p>
  ) : null;
}

/** Legal footnote left, brand wordmark right — the same footer on every layout. */
function Footer({ design, color, brandColor, className }: { design: Design; color: string; brandColor: string; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-[4cqmin]", className)}>
      <span className="text-[2.5cqmin] leading-tight" style={{ color }}>
        {design.footnote}
      </span>
      <span className="shrink-0 text-[2.9cqmin] font-semibold tracking-[0.14em] uppercase" style={{ color: brandColor }}>
        {design.brandName}
      </span>
    </div>
  );
}

function CtaPill({ brand, text, className }: { brand: BrandTokens; text: string; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-[1.6cqmin] rounded-full px-[3.6cqmin] py-[1.8cqmin] text-[3.5cqmin] font-semibold", className)} style={{ background: brand.accent, color: inkOn(brand) }}>
      {text} <span aria-hidden>→</span>
    </span>
  );
}

function Photo({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- data URIs and auth-gated media
  return <img src={src} alt="" className={cn("absolute inset-0 size-full object-cover", className)} style={style} />;
}

const PAD = "inset-[6.5cqmin]";

/* --------------------------------- layouts --------------------------------- */

const LAYOUT_VIEWS: Record<Layout, View> = {
  hero: ({ brand, design, photo, wide }) => (
    <div className="absolute inset-0" style={{ background: brand.primary }}>
      {photo && <Photo src={photo} />}
      <div
        className="absolute inset-0"
        style={{
          background: wide
            ? `linear-gradient(90deg, ${shade(brand.primary, 30)} 0%, ${mix(brand.primary, 82)} 42%, ${mix(brand.primary, 10)} 75%)`
            : `linear-gradient(180deg, ${mix(brand.primary, 30)} 0%, ${mix(brand.primary, 5)} 30%, ${mix(brand.primary, 70)} 60%, ${shade(brand.primary, 30)} 100%)`,
        }}
      />
      <div className={cn("absolute flex flex-col", PAD)} style={wide ? { right: "45%" } : undefined}>
        <Kicker text={design.kicker} color={brand.accent} />
        <div className="mt-auto">
          <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, wide ? 11 : 12.5)} />
          <Sub design={design} color="rgba(255,255,255,0.86)" className="mt-[3cqmin] max-w-[92%]" />
          {design.cta && <CtaPill brand={brand} text={design.cta} className="mt-[4.5cqmin]" />}
          <Footer design={design} color="rgba(255,255,255,0.6)" brandColor="rgba(255,255,255,0.8)" className="mt-[5cqmin]" />
        </div>
      </div>
    </div>
  ),

  split: ({ brand, design, photo, wide }) => (
    <div className={cn("absolute inset-0 flex", wide ? "flex-row" : "flex-col")} style={{ background: brand.primary }}>
      <div className={cn("relative overflow-hidden", wide ? "w-1/2" : "h-[57%]")}>
        {photo && <Photo src={photo} />}
        <span
          className="absolute top-[5cqmin] left-[5cqmin] px-[2.4cqmin] py-[1cqmin] text-[3cqmin] font-semibold tracking-[0.16em] uppercase"
          style={{ background: brand.accent, color: inkOn(brand), borderRadius: `${Math.min(brand.radius, 24) / 10.8}cqmin` }}
        >
          {design.kicker}
        </span>
      </div>
      <div className={cn("relative flex flex-1 flex-col", wide ? "justify-center p-[6.5cqmin]" : "px-[6.5cqmin] pt-[5.5cqmin] pb-[5.5cqmin]")}>
        <div className={cn("absolute h-[0.8cqmin] w-[14cqmin]", wide ? "top-[6.5cqmin] left-[6.5cqmin]" : "top-0 left-[6.5cqmin] -translate-y-1/2")} style={{ background: brand.accent }} />
        <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, wide ? 9.5 : 9.5)} />
        <Sub design={design} color="rgba(255,255,255,0.8)" className="mt-[2.5cqmin]" />
        {design.cta && <CtaPill brand={brand} text={design.cta} className="mt-[4cqmin]" />}
        <Footer design={design} color="rgba(255,255,255,0.55)" brandColor="rgba(255,255,255,0.75)" className={wide ? "mt-[6cqmin]" : "mt-auto pt-[3cqmin]"} />
      </div>
    </div>
  ),

  editorial: ({ brand, design, photo, wide }) => (
    <div className="absolute inset-0" style={{ background: brand.bg }}>
      <div className="absolute -top-[16%] -right-[18%] aspect-square w-[70cqmin] rounded-full" style={{ background: mix(brand.accent, 14) }} />
      {photo && (
        <div
          className={cn("absolute overflow-hidden", wide ? "top-[6.5cqmin] right-[6.5cqmin] bottom-[6.5cqmin] w-[38%]" : "right-[6.5cqmin] bottom-[15cqmin] h-[47%] w-[42%]")}
          style={{ borderRadius: "999px 999px 2cqmin 2cqmin", boxShadow: `0 0 0 1.2cqmin ${brand.bg}, 0 0 0 1.5cqmin ${mix(brand.accent, 60)}` }}
        >
          <Photo src={photo} />
        </div>
      )}
      <div className={cn("absolute flex flex-col", PAD)}>
        <Kicker text={design.kicker} color={brand.accent} />
        <Head
          brand={brand}
          design={design}
          color={brand.primary}
          accent={brand.accent}
          size={headSize(design.headline, photo ? 10.5 : 13)}
          className={cn("mt-[5cqmin]", photo ? (wide ? "max-w-[56%]" : "max-w-[52%]") : "max-w-[92%]")}
        />
        <Sub design={design} color={mix(brand.text, 75)} className={cn("mt-[3cqmin]", photo ? "max-w-[50%]" : "max-w-[85%]")} />
        {design.cta && <CtaPill brand={{ ...brand, accent: brand.primary, primary: brand.bg }} text={design.cta} className="mt-[4cqmin]" />}
        <Footer design={design} color={mix(brand.text, 55)} brandColor={brand.primary} className={cn("mt-auto", photo && wide && "max-w-[56%]")} />
      </div>
    </div>
  ),

  offer: ({ brand, design, photo, wide }) => (
    <div className="absolute inset-0" style={{ background: brand.primary }}>
      {photo && <Photo src={photo} style={{ opacity: 0.32 }} />}
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at ${wide ? "78% 50%" : "70% 62%"}, ${mix(brand.accent, 26)}, transparent 58%)` }} />
      <div className={cn("absolute flex flex-col", PAD)} style={wide ? { right: "42%" } : undefined}>
        <Kicker text={design.kicker} color={brand.accent} />
        <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, 11)} className="mt-[4cqmin] max-w-[92%]" />
        {design.sub && <p className="mt-[3cqmin] max-w-[82%] text-[4cqmin] leading-snug text-white/80">{design.sub}</p>}
        {design.cta && <CtaPill brand={brand} text={design.cta} className="mt-[4.5cqmin]" />}
        <div className={cn("mt-auto", !wide && "max-w-[48%]")}>
          <Footer design={{ ...design, brandName: wide ? design.brandName : "" }} color="rgba(255,255,255,0.6)" brandColor="rgba(255,255,255,0.8)" />
        </div>
      </div>
      {design.price && (
        <div
          className={cn("absolute grid aspect-square w-[40cqmin] place-items-center rounded-full p-[4cqmin] text-center", wide ? "top-1/2 right-[8cqmin] -translate-y-1/2" : "right-[6.5cqmin] bottom-[6.5cqmin]")}
          style={{ background: brand.accent, color: inkOn(brand), boxShadow: `0 0 0 1.6cqmin ${mix(brand.accent, 30)}` }}
        >
          <span className="text-[6.2cqmin] leading-[1.05] font-bold text-balance" style={{ fontFamily: fontOf(brand.fontHead) }}>
            {design.price}
          </span>
        </div>
      )}
    </div>
  ),

  bold: ({ brand, design, wide }) => (
    <div className="absolute inset-0" style={{ background: brand.primary }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, transparent 55%, ${shade(brand.primary, 25)})` }} />
      <div className={cn("absolute flex flex-col", PAD)}>
        <Kicker text={design.kicker} color={mix("#ffffff", 70)} />
        <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, wide ? 14 : 16)} weight={800} className={cn("mt-auto leading-[0.96]", wide && "max-w-[78%]")} />
        <Sub design={design} color="rgba(255,255,255,0.82)" className="mt-[4cqmin] max-w-[90%] text-[4.3cqmin]" />
        {design.cta && <CtaPill brand={brand} text={design.cta} className="mt-[4.5cqmin]" />}
        <Footer design={design} color="rgba(255,255,255,0.55)" brandColor="rgba(255,255,255,0.7)" className="mt-[5cqmin]" />
      </div>
    </div>
  ),

  festive: ({ brand, design }) => (
    <div className="absolute inset-0" style={{ background: shade(brand.primary, 30) }}>
      <div className="absolute inset-0" style={{ background: `repeating-conic-gradient(from 0deg at 50% 108%, ${mix(brand.accent, 16)} 0deg 6deg, transparent 6deg 14deg)` }} />
      <div className="absolute bottom-[9cqmin] left-1/2 aspect-square w-[44cqmin] -translate-x-1/2 rounded-full" style={{ border: `0.7cqmin dotted ${mix(brand.accent, 70)}` }} />
      <div className="absolute bottom-[15cqmin] left-1/2 aspect-square w-[32cqmin] -translate-x-1/2 rounded-full" style={{ border: `0.45cqmin solid ${mix(brand.accent, 45)}` }} />
      <div className="absolute bottom-[23cqmin] left-1/2 aspect-square w-[15cqmin] -translate-x-1/2 rounded-full" style={{ background: "#f5c451", boxShadow: "0 0 16cqmin 5cqmin rgba(245,196,81,0.42)" }} />
      <div className="absolute inset-x-[8cqmin] top-[9cqmin] flex flex-col items-center text-center">
        <Kicker text={design.kicker} color={brand.accent} />
        <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, 12)} className="mt-[4cqmin]" />
        {design.sub && <p className="mt-[3cqmin] text-[4cqmin] leading-snug text-white/80">{design.sub}</p>}
      </div>
      <Footer design={design} color="rgba(255,255,255,0.55)" brandColor="rgba(255,255,255,0.75)" className="absolute inset-x-[6.5cqmin] bottom-[4cqmin]" />
    </div>
  ),
};

/** Numbered inner carousel slide: big number, headline, supporting text, photo strip or column. */
function Inner({ brand, design, photo, wide }: ViewProps) {
  const n = String((design.slide?.index ?? 0) + 1).padStart(2, "0");
  return (
    <div className="absolute inset-0" style={{ background: brand.bg }}>
      {photo && (
        <div className={cn("absolute overflow-hidden", wide ? "inset-y-0 right-0 w-[40%]" : "inset-x-0 bottom-0 h-[34%]")}>
          <Photo src={photo} />
        </div>
      )}
      <div className={cn("absolute flex flex-col", wide ? "inset-y-[6.5cqmin] left-[6.5cqmin]" : "inset-x-[6.5cqmin] top-[6.5cqmin]")} style={wide ? { right: photo ? "calc(40% + 6.5cqmin)" : "6.5cqmin" } : { bottom: photo ? "38%" : "6.5cqmin" }}>
        <span className="text-[19cqmin] leading-none font-bold" style={{ fontFamily: fontOf(brand.fontHead), color: mix(brand.accent, 85) }}>
          {n}
        </span>
        <Head brand={brand} design={design} color={brand.primary} accent={brand.accent} size={headSize(design.headline, 9.5)} className="mt-[3cqmin]" />
        <Sub design={design} color={mix(brand.text, 78)} className="mt-[3cqmin] text-[4.3cqmin]" />
        <div className="mt-auto">
          <Footer design={design} color={mix(brand.text, 55)} brandColor={mix(brand.primary, 70)} />
        </div>
      </div>
    </div>
  );
}

/** Last carousel slide: the call to action. */
function Cta({ brand, design }: ViewProps) {
  return (
    <div className="absolute inset-0" style={{ background: brand.primary }}>
      <div className="absolute -bottom-[25%] -left-[20%] aspect-square w-[80cqmin] rounded-full" style={{ background: mix(brand.accent, 20) }} />
      <div className={cn("absolute flex flex-col", PAD)}>
        <Kicker text={design.kicker} color={brand.accent} />
        <Head brand={brand} design={design} color="#fff" accent={brand.accent} size={headSize(design.headline, 11)} className="mt-auto" />
        <Sub design={design} color="rgba(255,255,255,0.85)" className="mt-[3cqmin] text-[4.3cqmin]" />
        <CtaPill brand={brand} text={design.cta || design.brandName} className="mt-[5cqmin] text-[4cqmin]" />
        <Footer design={{ ...design, brandName: design.cta ? design.brandName : "" }} color="rgba(255,255,255,0.55)" brandColor="rgba(255,255,255,0.75)" className="mt-[5cqmin]" />
      </div>
    </div>
  );
}

function Dots({ brand, slide, light }: { brand: BrandTokens; slide: NonNullable<Design["slide"]>; light: boolean }) {
  return (
    <div className="absolute top-[6.5cqmin] right-[6.5cqmin] flex gap-[1.3cqmin]">
      {Array.from({ length: slide.total }, (_, i) => (
        <span
          key={i}
          className="h-[2cqmin] rounded-full transition-all"
          style={{ width: i === slide.index ? "5cqmin" : "2cqmin", background: i === slide.index ? brand.accent : light ? "rgba(255,255,255,0.35)" : mix(brand.primary, 25) }}
        />
      ))}
    </div>
  );
}
