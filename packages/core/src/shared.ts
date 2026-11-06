// Pure helpers that are safe to import from client components (no fs, no env).
// All scheduling happens in IST, the timezone every protocol.md is written in.

const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Shift a Date so its UTC fields read as IST wall-clock time. */
function asIst(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
}

export type IstParts = { dateKey: string; minutes: number; dow: number; day: number; month: number; year: number };

export function istParts(input: string | Date): IstParts {
  const d = asIst(typeof input === "string" ? new Date(input) : input);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return {
    dateKey: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dow,
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
  };
}

/** "YYYY-MM-DD" + minutes after midnight IST → ISO string with +05:30 offset. */
export function istIso(dateKey: string, minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${dateKey}T${hh}:${mm}:00+05:30`;
}

export function addDays(dateKey: string, n: number) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday of the IST week containing `input`. */
export function weekStart(input: string | Date = new Date()) {
  const p = istParts(input);
  return addDays(p.dateKey, -p.dow);
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return { key, dow: DOW[i], date: Number(key.slice(8, 10)) };
  });
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Fri 6 Nov · 7:30 PM" */
export function formatSlot(iso: string) {
  const p = istParts(iso);
  return `${DOW[p.dow]} ${p.day} ${MONTHS[p.month]} · ${formatTime(p.minutes)}`;
}

export function formatWeekRange(start: string) {
  const a = istParts(`${start}T12:00:00+05:30`);
  const b = istParts(`${addDays(start, 6)}T12:00:00+05:30`);
  return a.month === b.month ? `${a.day} – ${b.day} ${MONTHS[a.month]}` : `${a.day} ${MONTHS[a.month]} – ${b.day} ${MONTHS[b.month]}`;
}

/** "7:30 PM" → 1170 */
export function parseClock(text: string): number | null {
  const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2] ?? 0);
}

/** FNV-1a — small, deterministic, no crypto needed in the browser. */
function fnv(text: string) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Fingerprint of the text a template render printed — detects renders gone stale. */
export function creativeTextHash(p: { title: string; creativeText: string }) {
  return fnv(`${p.title}\n${p.creativeText}`).toString(16);
}

/**
 * Short reference clients quote when several posts wait: "approve #p3f9a2". Derived from the
 * post id but never words from it, so it can't be mistaken for a content hashtag like #diwali.
 */
export const postRef = (p: { id: string }) => `#p${fnv(p.id).toString(16).padStart(8, "0").slice(0, 5)}`;

export const FORMATS = ["Post", "Carousel", "Story", "Reel"] as const;

/** What each format is and where it can be published (Stories: Instagram/Facebook only). */
export const FORMAT_INFO = {
  Post: { label: "Post", ratio: "4:5", size: "1080 × 1350", platforms: ["instagram", "facebook", "linkedin"], video: false },
  Carousel: { label: "Carousel", ratio: "4:5", size: "up to 10 slides", platforms: ["instagram", "facebook", "linkedin"], video: false },
  Story: { label: "Story", ratio: "9:16", size: "1080 × 1920", platforms: ["instagram", "facebook"], video: true },
  Reel: { label: "Reel", ratio: "9:16", size: "1080 × 1920 video", platforms: ["instagram", "facebook", "youtube"], video: true },
} as const satisfies Record<(typeof FORMATS)[number], { label: string; ratio: string; size: string; platforms: readonly string[]; video: boolean }>;

/**
 * Output sizes offered for every post, carousel, story and reel (plus Custom). Pixel sizes are the
 * ones each platform recommends; video sizes are even numbers, as H.264 requires.
 */
export const SIZE_PRESETS = [
  { id: "portrait", label: "Portrait 4:5", hint: "Instagram & Facebook feed", w: 1080, h: 1350 },
  { id: "square", label: "Square 1:1", hint: "Feed, LinkedIn, Facebook", w: 1080, h: 1080 },
  { id: "vertical", label: "Vertical 9:16", hint: "Stories, Reels, Shorts", w: 1080, h: 1920 },
  { id: "tall", label: "Tall 3:4", hint: "Instagram grid", w: 1080, h: 1440 },
  { id: "landscape", label: "Landscape 1.91:1", hint: "Instagram & Facebook link posts", w: 1080, h: 566 },
  { id: "linkedin", label: "LinkedIn 1.91:1", hint: "LinkedIn feed image", w: 1200, h: 628 },
  { id: "facebook", label: "Facebook cover", hint: "Facebook page cover", w: 1640, h: 624 },
  { id: "wide", label: "Widescreen 16:9", hint: "YouTube video, presentations", w: 1920, h: 1080 },
  { id: "youtube-thumb", label: "YouTube thumbnail", hint: "16:9 thumbnail", w: 1280, h: 720 },
  { id: "pinterest", label: "Pinterest 2:3", hint: "Pins and posters", w: 1000, h: 1500 },
] as const;
export type SizePresetId = (typeof SIZE_PRESETS)[number]["id"];

/** The size a format renders at when nobody picked one. */
export const DEFAULT_SIZE: Record<(typeof FORMATS)[number], { w: number; h: number; preset: SizePresetId }> = {
  Post: { w: 1080, h: 1350, preset: "portrait" },
  Carousel: { w: 1080, h: 1350, preset: "portrait" },
  Story: { w: 1080, h: 1920, preset: "vertical" },
  Reel: { w: 1080, h: 1920, preset: "vertical" },
};

/** The post's render size: the one picked, else the format's default. */
export function sizeFor(p: { format: (typeof FORMATS)[number]; size?: { w: number; h: number; preset?: string } }) {
  return p.size?.w && p.size?.h ? { w: p.size.w, h: p.size.h, preset: p.size.preset } : DEFAULT_SIZE[p.format];
}

/**
 * Normalise a requested size: integers 320–4096 px. Videos (reels, story videos) get even numbers
 * and at most 1920 on the short side — what H.264 encoders and the platforms accept.
 */
export function validSize(s: { w: number; h: number; preset?: string }, video: boolean): { w: number; h: number; preset?: string } | null {
  let w = Math.round(Number(s.w));
  let h = Math.round(Number(s.h));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 320 || h < 320 || w > 4096 || h > 4096) return null;
  if (video) {
    if (Math.min(w, h) > 1920) return null;
    w -= w % 2;
    h -= h % 2;
  }
  const preset = SIZE_PRESETS.find((p) => p.id === s.preset && p.w === w && p.h === h)?.id ?? (s.preset === "custom" ? "custom" : SIZE_PRESETS.find((p) => p.w === w && p.h === h)?.id ?? "custom");
  return { w, h, preset };
}

/** Language plans. The first language leads: it's the reel voice and the first caption. */
export const LANGUAGE_OPTIONS = [
  { id: "mr+en", label: "Marathi + English", langs: ["mr", "en"] },
  { id: "hi+en", label: "Hindi + English", langs: ["hi", "en"] },
  { id: "hi+mr", label: "Hindi + Marathi", langs: ["hi", "mr"] },
  { id: "mr", label: "Marathi", langs: ["mr"] },
  { id: "hi", label: "Hindi", langs: ["hi"] },
  { id: "en", label: "English", langs: ["en"] },
] as const;
export const LANGUAGE_IDS = LANGUAGE_OPTIONS.map((l) => l.id) as string[];

export const LANG_NAME = { mr: "Marathi", hi: "Hindi", en: "English" } as const;
/** Caption tab labels the studio and Brand Guard show. */
export const LANG_LABEL = { mr: "मराठी", hi: "हिंदी", en: "EN" } as const;
/** Sarvam voice codes. */
export const VOICE_CODE = { mr: "mr-IN", hi: "hi-IN", en: "en-IN" } as const;

export function languagePlan(id?: string) {
  return LANGUAGE_OPTIONS.find((l) => l.id === id) ?? null;
}

/** Designed layouts for posts, stories and carousel covers (apps/web brand-creative.tsx draws them). */
export const LAYOUTS = {
  hero: { label: "Photo hero", hint: "Full-bleed photo, headline over a brand gradient — best with a real photo" },
  split: { label: "Split", hint: "Photo on top, brand panel with the headline below" },
  editorial: { label: "Editorial", hint: "Light, premium: big serif headline and an arch-framed photo" },
  offer: { label: "Offer", hint: "Price badge front and centre — launches, offers, price drops" },
  bold: { label: "Bold type", hint: "Huge headline with one highlighted word — tips, facts, hooks" },
  festive: { label: "Festive", hint: "Festival greeting: glow, rays and a rangoli ring" },
} as const;
export type Layout = keyof typeof LAYOUTS;
export const LAYOUT_IDS = Object.keys(LAYOUTS) as Layout[];

/** Layout when nobody picked one: festival → festive, photo → hero, a price → offer, else editorial. */
export function autoLayout(p: { title: string; creativeText: string; layout?: string }, hasPhoto: boolean): Layout {
  if (p.layout && p.layout in LAYOUTS) return p.layout as Layout;
  const text = `${p.title} ${p.creativeText}`;
  if (/(diwali|deepavali|navratri|dussehra|ganesh|holi|eid|christmas|new year|shubh|padwa|gudi|sankranti|festive)/i.test(text) && !/₹/.test(text)) return "festive";
  if (hasPhoto) return "hero";
  if (/₹|onwards/i.test(p.creativeText)) return "offer";
  return "editorial";
}

export const PLATFORM_SHORT: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export type BrandTokens = {
  name: string;
  kicker: string;
  primary: string;
  accent: string;
  bg: string;
  text: string;
  fontHead: string;
  fontBody: string;
  radius: number;
};

/** Design tokens from the client's tokens.json, with fallbacks from its avatar colours. */
export function brandTokens(client: { name: string; short: string; products: string[]; mark: { bg: string; fg: string }; files: { name: string; content: string }[] }): BrandTokens {
  let t: Record<string, string | number> = {};
  try {
    t = JSON.parse(client.files.find((f) => f.name === "tokens.json")?.content ?? "{}");
  } catch {
    t = {};
  }
  const str = (k: string, d: string) => (typeof t[k] === "string" && t[k] ? String(t[k]) : d);
  return {
    name: client.name,
    kicker: client.products[0] ?? client.short,
    primary: str("primary", client.mark.bg),
    accent: str("accent", client.mark.fg),
    bg: str("bg", "#ffffff"),
    text: str("text", "#111111"),
    fontHead: str("fontHead", "Inter"),
    fontBody: str("fontBody", "Inter"),
    radius: typeof t.radius === "number" ? t.radius : 16,
  };
}
