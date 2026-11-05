export type Platform = "instagram" | "facebook" | "linkedin" | "youtube";

/**
 * draft        → agents are producing it (or a client asked for changes)
 * brand-check  → Brand Guard found issues it could not fix itself
 * awaiting     → sent to the client's Telegram approvals room
 * scheduled    → approved and queued in Postiz
 * live         → Postiz reported it published
 */
export type PostStatus = "draft" | "brand-check" | "awaiting" | "scheduled" | "live";

/**
 * Post 4:5 image · Carousel 4:5 slides · Story 9:16 image or video · Reel 9:16 video.
 * Stories carry no caption on Instagram — their text lives on the creative.
 */
export type PostFormat = "Post" | "Carousel" | "Story" | "Reel";

/** One carousel slide: headline printed big, optional supporting line. */
export type Slide = { headline: string; text?: string };

export type Caption = { lang: string; text: string };

export type CheckResult = {
  id: string;
  label: string;
  ok: boolean;
  /** Set when Brand Guard changed the draft to make the check pass. */
  fixed?: string;
  detail?: string;
};

export type ThreadMsg = { from: string; text: string; at: string; client?: boolean };

/**
 * A reel, scene by scene. `text` is the big on-screen line; `voice` is what the voiceover says
 * (shown as the subtitle). Scene length follows the voice clip, or `seconds` when silent.
 */
export type ReelScript = {
  /** Sarvam language for the voiceover: mr-IN, hi-IN, en-IN … */
  voiceLang?: string;
  /** Sarvam speaker id, e.g. "priya" (bulbul:v3). */
  speaker?: string;
  scenes: { text: string; voice?: string; seconds?: number }[];
  /** End card call to action, e.g. "Book a site visit this weekend". */
  cta?: string;
};

/** A real file attached to a post (rendered creative, reel, or a designer's upload). */
export type Media = {
  file: string;
  name: string;
  type: string;
  kind: "image" | "video";
  size: number;
  /** "template" = rendered from the post's text; "upload" = a file someone provided. */
  source?: "template" | "upload";
  /** For template renders: creativeTextHash of the text it printed. */
  textHash?: string;
};

export type Post = {
  id: string;
  clientId: string;
  title: string;
  format: PostFormat;
  platforms: Platform[];
  /** Visual template id the Visual Designer rendered (web maps it to a preview). */
  creative: string;
  /** Text that appears on the creative itself — Brand Guard checks it too. */
  creativeText: string;
  /** Designed layout for the rendered image (shared.ts LAYOUTS); empty → picked automatically. */
  layout?: string;
  /** ISO date-time with IST offset. */
  scheduledAt: string;
  tag: string;
  status: PostStatus;
  captions: Caption[];
  /** Files that get published. Empty → the preview is the template only. */
  media?: Media[];
  /** Reel plan written by the Reel Producer / writer agent; rendered by `bolo reel`. */
  reel?: ReelScript;
  /** Carousel slides (slide 1 is the cover). Rendered one PNG per slide. */
  slides?: Slide[];
  /** Automatic production in progress (Claude writing, rendering, sending) — shown live in the editor. */
  job?: { step: string; at: string };
  /** Brief from the Strategist (goal, audience, notes) — free text shown to the team. */
  brief?: string;
  checks: CheckResult[];
  thread: ThreadMsg[];
  /** What an agent is doing with it right now. */
  note?: string;
  postizId?: string;
  dryRun?: boolean;
  permalink?: string;
  createdAt: string;
  updatedAt: string;
};

export type Approver = { name: string; handle: string; backup: boolean };

export type Channel = { platform: Platform; handle: string; postizIntegrationId?: string };

/** Machine-readable part of rules.md (```bolo-checks block). */
export type BrandChecks = {
  banned?: string[];
  competitors?: string[];
  /** word → replacement; flagged, and auto-fixed when auto-fix is on */
  replace?: Record<string, string>;
  /** alsoAccept: same meaning in other languages, e.g. "पासून" for "onwards" */
  price?: { requireWord?: string; alsoAccept?: string[]; footnote?: string };
  requireRera?: boolean;
  maxHashtags?: Partial<Record<Platform, number>>;
  requireCta?: string[];
  requireText?: { text: string; label: string }[];
};

export type BrandKitFile = { name: string; content: string };

export type Client = {
  id: string;
  name: string;
  short: string;
  sector: string;
  mark: { bg: string; fg: string; font?: "brand" };
  rooms: { work: string; approvals: string };
  channels: Channel[];
  approvers: Approver[];
  platforms: string;
  bestTimes: { label: string; time: string }[];
  products: string[];
  reraNumbers: string[];
  checks: BrandChecks;
  files: BrandKitFile[];
};

export type ClientSettings = {
  cadence: "Daily" | "3x/week" | "Custom";
  useBestTimes: boolean;
  remindApprover: boolean;
  autoFix: boolean;
};

export type StudioData = {
  version: 1;
  posts: Post[];
  settings: Record<string, ClientSettings>;
};

export type Agent = {
  id: string;
  name: string;
  role: "Single-holder" | "Shared";
  builtWith: string;
  summary: string;
  instructions: string;
};
