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

export const PLATFORM_SHORT: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};
