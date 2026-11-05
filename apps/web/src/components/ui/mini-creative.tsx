import { Play } from "lucide-react";
import { cn } from "@/lib/cn";

export type CreativeVariant =
  | "carousel"
  | "floorplan"
  | "reel"
  | "linkedin"
  | "festive"
  | "clinic"
  | "clinic-reel"
  | "personal"
  | "personal-reel";

const VARIANTS = ["carousel", "floorplan", "reel", "linkedin", "festive", "clinic", "clinic-reel", "personal", "personal-reel"] as const;

/** Store values are plain strings; unknown templates fall back to the carousel preview. */
export function toVariant(v: string): CreativeVariant {
  return (VARIANTS as readonly string[]).includes(v) ? (v as CreativeVariant) : "carousel";
}

/** Text a template prints. Omitted fields fall back to the demo copy used on the landing page. */
export type CreativeContent = { kicker?: string; headline?: string; footer?: string; footnote?: string; slide?: { index: number; total: number } };

/**
 * Derive template text from a post: headline from its title, the rest from "text on the creative".
 * For carousels, `slide` picks one slide: its headline and supporting line replace the post's.
 */
export function contentFromPost(
  post: { title: string; creativeText: string; format?: string; slides?: { headline: string; text?: string }[] },
  fallbackKicker: string,
  slide = 0,
): CreativeContent {
  const base = baseContent(post, fallbackKicker);
  const slides = post.format === "Carousel" ? (post.slides ?? []) : [];
  if (!slides.length) return base;
  const s = slides[Math.min(slide, slides.length - 1)];
  return { ...base, headline: s.headline, footer: s.text ?? (slide === 0 ? base.footer : ""), slide: { index: Math.min(slide, slides.length - 1), total: slides.length } };
}

function baseContent(post: { title: string; creativeText: string }, fallbackKicker: string): CreativeContent {
  const segs = post.creativeText
    .split(/\n| · /)
    .map((s) => s.trim())
    .filter(Boolean);
  // "Diwali at home — Luxe 28" → "Diwali at home"; "Is Diwali ghari ka? — reel" → "Is Diwali ghari ka?";
  // but "Tower B — slab 14 complete" keeps its meaning
  const split = post.title.match(/^(.*?)\s[—–-]\s(.+)$/);
  const headline =
    split && (/^(reel|carousel|post)$/i.test(split[2].trim()) || split[2].trim().toLowerCase() === segs[0]?.toLowerCase())
      ? split[1].trim()
      : post.title.trim();
  const footnote = segs.find((s) => /^RERA\b|Reg\. No\./i.test(s));
  const kicker = segs[0] && segs[0] !== footnote && segs[0].length <= 28 && segs[0].toLowerCase() !== headline.toLowerCase() ? segs[0] : fallbackKicker;
  const footer = segs.filter((s) => s !== kicker && s !== footnote && s.toLowerCase() !== headline.toLowerCase()).join(" · ");
  // Empty strings (not undefined) so a real post never inherits the demo copy
  return { kicker, headline, footer, footnote: footnote ?? "" };
}

/**
 * Post creative rendered from a client's design tokens — the same idea the Visual Designer
 * agent uses (HTML/CSS + tokens.json), so text is always spelled right and on-brand.
 * Text scales with the container (cqw) so one component works from 44px to 1080px.
 */
export function MiniCreative({ variant, content = {}, className }: { variant: CreativeVariant; content?: CreativeContent; className?: string }) {
  return <div className={cn("relative overflow-hidden [container-type:inline-size]", className)}>{TEMPLATES[variant](content)}</div>;
}

/** Long headlines step down so they still fit the frame. */
const hl = (text: string, big: string, small: string) => (text.length > 22 ? small : big);

const TEMPLATES: Record<CreativeVariant, (c: CreativeContent) => React.ReactNode> = {
  carousel: ({ kicker = "Luxe 28", headline = "Diwali at home", footer = "2 & 3 BHK · ₹78 L onwards*", footnote = "RERA P52100012345", slide }) => (
    <div className="absolute inset-0 bg-pushpam">
      <div className="absolute -right-[20%] -bottom-[25%] size-[90%] rounded-full bg-pushpam-gold/25 blur-[8cqw]" />
      <div className="absolute inset-[7cqw] flex flex-col">
        <span className="text-[6cqw] tracking-[0.2em] text-pushpam-gold/90 uppercase">{kicker}</span>
        <p className={cn("mt-[4cqw] max-w-[85%] font-brand leading-[1] font-semibold text-balance text-pushpam-cream", hl(headline, "text-[15cqw]", "text-[10cqw]"))}>
          {headline}
        </p>
        <span className="mt-auto text-[5cqw] text-pushpam-cream/75">{footer}</span>
        {footnote && <span className="text-[4cqw] text-pushpam-cream/50">{footnote}</span>}
      </div>
      {slide && slide.total > 1 && (
        <div className="absolute top-[7cqw] right-[7cqw] flex gap-[1.5cqw]">
          {Array.from({ length: slide.total }, (_, i) => (
            <span key={i} className={cn("size-[2.4cqw] rounded-full", i === slide.index ? "bg-pushpam-gold" : "bg-pushpam-cream/30")} />
          ))}
        </div>
      )}
    </div>
  ),
  floorplan: ({ kicker = "Luxe 28", headline = "3 BHK floor plans", footnote }) => (
    <div className="absolute inset-0 bg-pushpam-cream">
      <svg viewBox="0 0 100 80" className="absolute right-[6cqw] bottom-[8cqw] w-[62%] text-pushpam" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="96" height="76" />
        <path d="M2 40h38V2M40 40v38M40 52h58M70 52V2M70 26h28M20 40v-8M40 18h-8M58 52v-8M84 52v8" />
      </svg>
      <div className="absolute top-[7cqw] left-[7cqw] max-w-[70%]">
        <span className="text-[5.5cqw] tracking-[0.16em] text-pushpam-gold uppercase">{kicker}</span>
        <p className={cn("mt-[3cqw] font-brand leading-[1.05] font-semibold text-balance text-pushpam", hl(headline, "text-[12cqw]", "text-[9cqw]"))}>{headline}</p>
      </div>
      {footnote && <span className="absolute bottom-[3cqw] left-[7cqw] text-[3.5cqw] text-pushpam/60">{footnote}</span>}
    </div>
  ),
  reel: ({ headline = "Is Diwali ghari ka?" }) => (
    <div className="absolute inset-0 bg-gradient-to-b from-[#2b4a72] via-pushpam to-[#13253d]">
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#0b1626] to-transparent" />
      <div className="absolute top-1/2 left-1/2 grid size-[26cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 backdrop-blur">
        <Play className="size-[11cqw] fill-white text-white" />
      </div>
      <div className="absolute right-[8cqw] bottom-[16cqw] left-[8cqw] text-center">
        <span className="bg-pushpam px-[1.5cqw] text-[7cqw] leading-[1.5] font-bold text-white [box-decoration-break:clone]">{headline}</span>
      </div>
    </div>
  ),
  linkedin: ({ kicker = "Site update · Nov", headline = "Tower B slab 14 done", footer = "72% structure complete" }) => (
    <div className="absolute inset-0 bg-pushpam-cream">
      <div className="absolute inset-[7cqw] flex flex-col">
        <span className="text-[5.5cqw] tracking-[0.16em] text-pushpam uppercase">{kicker}</span>
        <p className={cn("mt-[4cqw] font-brand leading-[1.05] font-semibold text-balance text-pushpam", hl(headline, "text-[12cqw]", "text-[9cqw]"))}>{headline}</p>
        <div className="mt-auto" />
        {/* progress bar only when the text states a real percentage */}
        {footer.match(/(\d{1,3})%/) && (
          <div className="h-[3cqw] overflow-hidden rounded-full bg-pushpam/15">
            <div className="h-full bg-pushpam-gold" style={{ width: `${Math.min(100, Number(footer.match(/(\d{1,3})%/)![1]))}%` }} />
          </div>
        )}
        <span className="mt-[2cqw] text-[5cqw] text-pushpam/70">{footer}</span>
      </div>
    </div>
  ),
  festive: ({ headline = "Shubh Deepavali" }) => (
    <div className="absolute inset-0 bg-[#13253d]">
      <div className="absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_50%_110%,rgba(201,162,39,0.18)_0deg_6deg,transparent_6deg_14deg)]" />
      <div className="absolute bottom-[14cqw] left-1/2 size-[18cqw] -translate-x-1/2 rounded-full bg-[#f5c451] shadow-[0_0_18cqw_6cqw_rgba(245,196,81,0.45)]" />
      <p className="absolute inset-x-[8cqw] top-[12cqw] text-center font-brand text-[12cqw] leading-[1.05] font-semibold text-balance text-pushpam-cream">{headline}</p>
    </div>
  ),
  clinic: ({ kicker = "Sunrise Eye Clinic", headline = "Free eye check-up camp", footer = "Sun · 9 AM – 1 PM" }) => (
    <div className="absolute inset-0 bg-[#eef8f6]">
      <div className="absolute -top-[20%] -right-[20%] size-[70%] rounded-full bg-[#0e7c7b]/15" />
      <div className="absolute inset-[7cqw] flex flex-col">
        <span className="text-[5.5cqw] font-semibold tracking-[0.12em] text-[#0e7c7b] uppercase">{kicker}</span>
        <p className={cn("mt-[4cqw] leading-[1.05] font-semibold tracking-tight text-balance text-[#0b3b3a]", hl(headline, "text-[12cqw]", "text-[9.5cqw]"))}>{headline}</p>
        <div className="mt-auto" />
        {footer && <span className="inline-flex w-fit rounded-full bg-[#0e7c7b] px-[3cqw] py-[1.2cqw] text-[5.5cqw] text-white">{footer}</span>}
      </div>
    </div>
  ),
  "clinic-reel": ({ headline = "20-20-20 rule for screen eyes" }) => (
    <div className="absolute inset-0 bg-gradient-to-b from-[#0e7c7b] to-[#0b3b3a]">
      <div className="absolute top-1/2 left-1/2 grid size-[26cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20">
        <Play className="size-[11cqw] fill-white text-white" />
      </div>
      <div className="absolute right-[8cqw] bottom-[16cqw] left-[8cqw] text-center">
        <span className="bg-white px-[1.5cqw] text-[7cqw] leading-[1.5] font-bold text-[#0b3b3a] [box-decoration-break:clone]">{headline}</span>
      </div>
    </div>
  ),
  personal: ({ kicker = "#HowISwitch", headline, footer = "Kamran Pathan · Bolo Studio" }) => (
    <div className="absolute inset-0 bg-[#111a14]">
      <div className="absolute inset-[7cqw] flex flex-col">
        <span className="text-[5.5cqw] text-lime">{kicker}</span>
        {headline ? (
          <p className={cn("mt-[4cqw] leading-[1.08] font-semibold tracking-tight text-balance text-white", hl(headline, "text-[11cqw]", "text-[8.5cqw]"))}>{headline}</p>
        ) : (
          <p className="mt-[4cqw] text-[11cqw] leading-[1.08] font-semibold tracking-tight text-white">
            4 days.
            <br />6 agents.
            <br />
            <span className="font-serif font-normal italic">One room.</span>
          </p>
        )}
        <span className="mt-auto text-[5cqw] text-white/55">{footer}</span>
      </div>
    </div>
  ),
  "personal-reel": ({ headline = "Speak once. Ship everywhere." }) => (
    <div className="absolute inset-0 bg-gradient-to-b from-[#24402c] to-[#0d1710]">
      <div className="absolute top-1/2 left-1/2 grid size-[26cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15">
        <Play className="size-[11cqw] fill-white text-white" />
      </div>
      <div className="absolute right-[8cqw] bottom-[16cqw] left-[8cqw] text-center">
        <span className="bg-lime px-[1.5cqw] text-[7cqw] leading-[1.5] font-bold text-[#111a14] [box-decoration-break:clone]">{headline}</span>
      </div>
    </div>
  ),
};
