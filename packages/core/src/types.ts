import type { StoredUser } from "./users";

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

/** Output size of the rendered image or video, in pixels. `preset` names one of SIZE_PRESETS (shared.ts). */
export type Size = { w: number; h: number; preset?: string };

/** Language plan for a post: captions, text on the creative and the reel voice (shared.ts LANGUAGE_OPTIONS). */
export type LanguageOption = "mr+en" | "hi+en" | "hi+mr" | "mr" | "hi" | "en";

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
  /** Pixel size of a rendered file (template renders). */
  w?: number;
  h?: number;
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
  /** Pixel size of the rendered media; empty → the format's default (FORMAT_INFO). */
  size?: Size;
  /** Languages to write in; empty → the Brand Kit's usual languages. */
  languages?: LanguageOption;
  /** Art direction from the writer: the headline word set in the accent colour, and the button label. */
  design?: { highlight?: string; cta?: string };
  /**
   * Automatic production in progress (AI writing, rendering, sending) — shown live in the editor
   * and in the progress dock. `progress` is 0–100; `startedAt` is when the whole run began.
   */
  job?: { step: string; at: string; progress?: number; startedAt?: string; by?: string };
  /** User id of whoever created it (notifications go to them). */
  createdBy?: string;
  /** Brief from the Strategist (goal, audience, notes) — free text shown to the team. */
  brief?: string;
  checks: CheckResult[];
  thread: ThreadMsg[];
  /** What an agent is doing with it right now. */
  note?: string;
  postizId?: string;
  dryRun?: boolean;
  /**
   * How an approved post goes out: "direct" (Bolo publishes through the company's own Facebook /
   * Instagram / LinkedIn connections at its time), "postiz", or "dry" (nothing connected — marked
   * live by hand). `results` per platform; failed publishes retry a few times.
   */
  publish?: {
    via: "direct" | "postiz" | "dry";
    results?: Partial<Record<Platform, { ok: boolean; id?: string; url?: string; error?: string; at: string }>>;
    attempts?: number;
    nextTry?: string;
    /** Which process is publishing it right now — so two servers never post the same thing twice. */
    claim?: { by: string; at: string };
  };
  permalink?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Someone who can approve. `handle` is their Telegram username (may be empty for someone who only
 * approves in the studio); `userId` links a studio account. `owner` marks the fallback: a company
 * with no approvers set is approved by its owner.
 */
export type Approver = { name: string; handle: string; backup: boolean; userId?: string; owner?: boolean };

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

/** client.json — the parts of a Brand Kit that aren't markdown. */
export type ClientMeta = {
  name: string;
  short: string;
  sector: string;
  mark: { bg: string; fg: string; font?: "brand" };
  rooms: { work: string; approvals: string };
  channels: Channel[];
};

export type MemberRole = "owner" | "admin" | "member";

/** A user's place in a company. Owners and admins manage the team, Brand Kit and connections. */
export type Member = { userId: string; role: MemberRole; canApprove: boolean; addedAt: string };

/** Public view of a member, safe to send to the browser. */
export type MemberInfo = Member & { name: string; email: string; username?: string; telegram?: string };

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
  /** Studio accounts in this company (empty for a kit that isn't in the store yet). */
  members: MemberInfo[];
  /** Telegram usernames that approve without a Bolo account. */
  telegramApprovers: string[];
  /** Anyone in the company's connected Telegram group may approve. */
  groupApproves: boolean;
};

/** Encrypted at rest (secrets.ts) — never sent to the browser. */
export type Secret = string;

/**
 * What a company has connected. Platform services (Switch, Postiz, Wispr Flow) are not here —
 * they belong to the Bolo Studio admins and live in .env.
 */
export type Connections = {
  telegram?: { chatId: string; title: string; connectedAt: string; by?: string };
  /** One-time code the client sends in their group to link it (expires). */
  telegramCode?: { code: string; expiresAt: string };
  meta?: {
    userName?: string;
    pageId: string;
    pageName: string;
    pageToken: Secret;
    igUserId?: string;
    igUsername?: string;
    connectedAt: string;
  };
  /** Pages returned by Facebook login, waiting for the client to pick one (expires). */
  metaPending?: { pages: { id: string; name: string; token: Secret; igUserId?: string; igUsername?: string }[]; userName?: string; expiresAt: string };
  linkedin?: { name: string; authorUrn: string; token: Secret; expiresAt: string; connectedAt: string };
  drive?: { refreshToken: Secret; email?: string; folders?: { client: string; designs?: string; published: string; references?: string }; connectedAt: string };
  sarvam?: { key: Secret; connectedAt: string };
  ai?: { provider: "anthropic" | "openai"; key: Secret; model?: string; connectedAt: string };
};

/** A company (client workspace): its Brand Kit, team and connections. */
export type Company = {
  id: string;
  kit: { meta: ClientMeta; files: BrandKitFile[] };
  members: Member[];
  connections: Connections;
  /**
   * Who approves on Telegram without a Bolo account: Telegram usernames (the client's social media
   * manager, their own client…), or everyone in the connected group.
   */
  approvals?: { telegram: string[]; anyoneInGroup: boolean };
  createdAt: string;
  createdBy?: string;
};

export type Invite = {
  id: string;
  companyId: string;
  userId: string;
  invitedBy: string;
  role: MemberRole;
  canApprove: boolean;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  respondedAt?: string;
};

export type NotificationKind = "invite" | "approval" | "approved" | "changes" | "live" | "job-done" | "job-failed" | "connection" | "member" | "info";

export type Notification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Where clicking it goes, e.g. /studio/pushpam-demo/post/abc123 */
  href?: string;
  companyId?: string;
  inviteId?: string;
  read: boolean;
  createdAt: string;
};

export type ClientSettings = {
  cadence: "Daily" | "3x/week" | "Custom";
  useBestTimes: boolean;
  remindApprover: boolean;
  autoFix: boolean;
};

export type StudioData = {
  version: 3;
  posts: Post[];
  settings: Record<string, ClientSettings>;
  companies: Company[];
  invites: Invite[];
  notifications: Notification[];
  /** Studio accounts (password hashes) — never sent to the browser. */
  users: StoredUser[];
};

export type Agent = {
  id: string;
  name: string;
  role: "Single-holder" | "Shared";
  builtWith: string;
  summary: string;
  instructions: string;
};
