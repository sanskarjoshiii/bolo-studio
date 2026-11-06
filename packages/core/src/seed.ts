import { diskKitIds, listDiskClients, readDiskKit } from "./brand-kit";
import { runBrandGuard } from "./brand-guard";
import { addDays, istIso, weekStart } from "./shared";
import type { Caption, Client, ClientSettings, Company, Platform, Post, PostFormat, PostStatus, StudioData, ThreadMsg } from "./types";

// Demo week, generated relative to the current IST week so the dashboard
// always opens on live-looking data. Checks come from the real Brand Guard.

type SeedPost = {
  id: string;
  client: string;
  day: number;
  time: string;
  title: string;
  format: PostFormat;
  platforms: Platform[];
  creative: string;
  creativeText: string;
  tag: string;
  status: PostStatus;
  captions: Caption[];
  thread?: [from: string, text: string, dayOffset: number, time: string, client?: boolean][];
  note?: string;
  permalink?: string;
};

const SEED: SeedPost[] = [
  // ---- Pushpam Infra ----
  {
    id: "pp-floorplans",
    client: "pushpam-demo",
    day: 0,
    time: "19:30",
    title: "Luxe 28 — 3 BHK floor plans",
    format: "Carousel",
    platforms: ["instagram", "facebook"],
    creative: "floorplan",
    creativeText: "Luxe 28 · 3 BHK floor plans · RERA P52100012345",
    tag: "#luxe28",
    status: "live",
    captions: [
      {
        lang: "EN",
        text: "Room to grow, room to gather. Swipe through the 3 BHK floor plans at Luxe 28 — from ₹1.12 Cr onwards*. Book a site visit this weekend.\n*T&C apply\n#luxe28 #baner #pune #3bhk",
      },
    ],
    thread: [["Publisher", "Live 🎉 instagram.com/p/C9xL28a", 0, "19:31"]],
    permalink: "https://instagram.com/p/C9xL28a",
  },
  {
    id: "pp-slab14",
    client: "pushpam-demo",
    day: 1,
    time: "10:00",
    title: "Tower B — slab 14 complete",
    format: "Post",
    platforms: ["linkedin"],
    creative: "linkedin",
    creativeText: "Tower B · slab 14 done · 72% structure complete",
    tag: "#siteupdate",
    status: "live",
    captions: [{ lang: "EN", text: "Tower B has reached slab 14 — 72% of the structure is complete and on schedule for March 2027 possession." }],
    thread: [["Publisher", "Live 🎉 linkedin.com/feed/update/7261", 1, "10:00"]],
    permalink: "https://www.linkedin.com/feed/update/7261",
  },
  {
    id: "pp-sitevisit",
    client: "pushpam-demo",
    day: 3,
    time: "11:00",
    title: "Site visit weekend",
    format: "Post",
    platforms: ["instagram", "facebook"],
    creative: "carousel",
    creativeText: "",
    tag: "#sitevisit",
    status: "draft",
    captions: [],
    note: "Needs captions — write them here or ask the Copywriter in #pushpam-work",
  },
  {
    id: "pp-reel",
    client: "pushpam-demo",
    day: 3,
    time: "19:30",
    title: "Is Diwali ghari ka? — reel",
    format: "Reel",
    platforms: ["instagram"],
    creative: "reel",
    creativeText: "Is Diwali ghari ka? · Luxe 28",
    tag: "#diwali",
    status: "brand-check",
    captions: [
      { lang: "MR + EN", text: "Is Diwali ghari ka? Luxe 28 madhe tumchya navin gharat 🪔 Site visit this weekend." },
      { lang: "EN", text: "Why not celebrate this Diwali at home — your new home at Luxe 28. #diwali #luxe28 #pune #baner #newhome #family #festive #realestate #punerealestate #home" },
    ],
  },
  {
    id: "pp-diwali",
    client: "pushpam-demo",
    day: 4,
    time: "19:30",
    title: "Diwali at home — Luxe 28",
    format: "Carousel",
    platforms: ["instagram", "facebook", "linkedin"],
    creative: "carousel",
    creativeText: "Luxe 28 · Diwali at home · 2 & 3 BHK · ₹78 L onwards*",
    tag: "#diwali",
    status: "awaiting",
    captions: [
      { lang: "MR + EN", text: "Is Diwali, tumchya navin gharat 🪔 Luxe 28 — 2 & 3 BHK from ₹78 L. Site visit this weekend." },
      { lang: "मराठी", text: "या दिवाळीत, तुमच्या नव्या घरात 🪔 लक्स २८ — २ व ३ BHK. या आठवड्यात site visit करा." },
      { lang: "EN", text: "This Diwali, in your new home. Luxe 28 — 2 & 3 BHK from ₹78 L. Book a site visit this weekend." },
    ],
    thread: [
      ["Akshay", "Diwali campaign for Luxe 28, family feel, one carousel and one reel, Marathi plus English, post Friday evening", 2, "10:12"],
      ["Brand Guard", "Diwali campaign ready ✅ Checked RERA no., colours, banned words. Reply: approve / change: <what>", 2, "11:02"],
    ],
  },
  {
    id: "pp-possession",
    client: "pushpam-demo",
    day: 5,
    time: "10:00",
    title: "Possession timeline explained",
    format: "Post",
    platforms: ["linkedin"],
    creative: "linkedin",
    creativeText: "Luxe 28 · Possession timeline · RERA P52100012345",
    tag: "#luxe28",
    status: "scheduled",
    captions: [{ lang: "EN", text: "When will Tower A and B be ready? A clear, month-by-month possession timeline for Luxe 28 buyers. Book a site visit to see progress." }],
    thread: [
      ["R. Kulkarni", "approve", 1, "18:10", true],
      ["Publisher", "Scheduled ✅ LinkedIn Sat 10:00 AM", 1, "18:10"],
    ],
  },
  {
    id: "pp-deepavali",
    client: "pushpam-demo",
    day: 6,
    time: "09:00",
    title: "Shubh Deepavali",
    format: "Post",
    platforms: ["instagram", "facebook"],
    creative: "festive",
    creativeText: "Shubh Deepavali",
    tag: "#festive",
    status: "scheduled",
    captions: [{ lang: "MR + EN", text: "Shubh Deepavali from all of us at Pushpam Infra. May your home glow brighter this year 🪔 #diwali #pune" }],
    thread: [
      ["R. Kulkarni", "approve", 0, "17:22", true],
      ["Publisher", "Scheduled ✅ IG + FB Sun 9:00 AM", 0, "17:22"],
    ],
  },

  // ---- Sunrise Eye Clinic ----
  {
    id: "cl-camp",
    client: "clinic-demo",
    day: 0,
    time: "11:00",
    title: "Free eye check-up camp",
    format: "Post",
    platforms: ["instagram", "facebook"],
    creative: "clinic",
    creativeText: "Free eye check-up camp · Sun 9 AM – 1 PM",
    tag: "#eyecamp",
    status: "live",
    captions: [{ lang: "MR + EN", text: "Free eye check-up camp this Sunday, 9 AM – 1 PM. Mofat netra tapasani — sobat ya kutumbala. Dr. A. Deshpande, Reg. No. MMC 2011/04/1234" }],
    thread: [["Publisher", "Live 🎉 instagram.com/p/C9sE11q", 0, "11:00"]],
    permalink: "https://instagram.com/p/C9sE11q",
  },
  {
    id: "cl-202020",
    client: "clinic-demo",
    day: 2,
    time: "18:00",
    title: "The 20-20-20 rule",
    format: "Reel",
    platforms: ["instagram", "youtube"],
    creative: "clinic-reel",
    creativeText: "20-20-20 rule for screen eyes",
    tag: "#screentime",
    status: "brand-check",
    captions: [{ lang: "EN", text: "Every 20 minutes, look 20 feet away for 20 seconds. This simple habit cures tired, dry eyes." }],
  },
  {
    id: "cl-firecracker",
    client: "clinic-demo",
    day: 4,
    time: "11:00",
    title: "Firecracker eye safety",
    format: "Carousel",
    platforms: ["instagram", "facebook"],
    creative: "clinic",
    creativeText: "Diwali eye safety · 5 tips",
    tag: "#diwalisafety",
    status: "awaiting",
    captions: [
      { lang: "MR + EN", text: "Diwali safe ani sundar 🪔 5 tips to protect your eyes around firecrackers. Emergency? Call us 24×7. Dr. A. Deshpande, Reg. No. MMC 2011/04/1234" },
      { lang: "EN", text: "Enjoy Diwali safely — 5 simple ways to protect your eyes around firecrackers. Emergency line open 24×7. Dr. A. Deshpande, Reg. No. MMC 2011/04/1234" },
    ],
    thread: [["Brand Guard", "Firecracker safety carousel ready ✅ No result claims, doctor reg. no. present. Reply: approve / change: <what>", 2, "10:15"]],
  },
  {
    id: "cl-open",
    client: "clinic-demo",
    day: 6,
    time: "09:00",
    title: "Clinic open on Diwali",
    format: "Post",
    platforms: ["instagram", "facebook"],
    creative: "clinic",
    creativeText: "Open on Diwali · 9 AM – 9 PM",
    tag: "#timings",
    status: "scheduled",
    captions: [{ lang: "EN", text: "We're open on Diwali for eye emergencies, 9 AM – 9 PM. Wishing you a safe and bright festival. Dr. A. Deshpande, Reg. No. MMC 2011/04/1234" }],
    thread: [
      ["Dr. A. Deshpande", "approve", 1, "20:05", true],
      ["Publisher", "Scheduled ✅ IG + FB Sun 9:00 AM", 1, "20:05"],
    ],
  },

  // ---- My Brand ----
  {
    id: "me-4days",
    client: "my-brand",
    day: 1,
    time: "10:00",
    title: "4 days. 6 agents. One room.",
    format: "Post",
    platforms: ["linkedin"],
    creative: "personal",
    creativeText: "4 days. 6 agents. One room.",
    tag: "#HowISwitch",
    status: "live",
    captions: [{ lang: "EN", text: "We're building Bolo Studio for Flip the Switch — six AI agents in one Switch room, clients approving on Telegram. Day 1: 14 briefs, 0 lost ideas. #HowISwitch" }],
    thread: [["Publisher", "Live 🎉 linkedin.com/feed/update/7262", 1, "10:00"]],
    permalink: "https://www.linkedin.com/feed/update/7262",
  },
  {
    id: "me-roles",
    client: "my-brand",
    day: 3,
    time: "10:00",
    title: "Why single-holder roles matter",
    format: "Post",
    platforms: ["linkedin"],
    creative: "personal",
    creativeText: "",
    tag: "#HowISwitch",
    status: "draft",
    captions: [],
    note: "Needs captions — write them here or ask the Copywriter in #my-brand",
  },
  {
    id: "me-reel",
    client: "my-brand",
    day: 5,
    time: "18:00",
    title: "Speak once. Ship everywhere.",
    format: "Reel",
    platforms: ["instagram", "linkedin"],
    creative: "personal-reel",
    creativeText: "Speak once. Ship everywhere.",
    tag: "#buildinpublic",
    status: "scheduled",
    captions: [{ lang: "EN", text: "60 seconds of Bolo Studio: a voice idea becomes a scheduled post in about 15 minutes. #buildinpublic" }],
    thread: [["Publisher", "Scheduled ✅ IG + LinkedIn Sat 6:00 PM", 2, "09:10"]],
  },
];

export const DEFAULT_SETTINGS: ClientSettings = { cadence: "3x/week", useBestTimes: true, remindApprover: true, autoFix: true };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function buildSeed(now = new Date()): StudioData {
  const monday = weekStart(now);
  const clients = new Map<string, Client>(listDiskClients().map((c) => [c.id, c]));
  const at = (day: number, time: string) => istIso(addDays(monday, day), toMin(time));

  const posts: Post[] = SEED.filter((s) => clients.has(s.client)).map((s) => {
    const client = clients.get(s.client)!;
    const thread: ThreadMsg[] = (s.thread ?? []).map(([from, text, d, t, isClient]) => ({ from, text, at: at(d, t), client: isClient }));
    const base: Post = {
      id: s.id,
      clientId: s.client,
      title: s.title,
      format: s.format,
      platforms: s.platforms,
      creative: s.creative,
      creativeText: s.creativeText,
      scheduledAt: at(s.day, s.time),
      tag: s.tag,
      status: s.status,
      captions: s.captions,
      checks: [],
      thread,
      note: s.note,
      permalink: s.permalink,
      dryRun: s.status === "scheduled" || s.status === "live" ? true : undefined,
      postizId: s.status === "scheduled" || s.status === "live" ? `dry-${s.id}` : undefined,
      createdAt: at(0, "09:00"),
      updatedAt: at(0, "09:00"),
    };
    if (s.status === "draft") return base;

    // Seeded "brand-check" posts are checked without auto-fix so the demo shows real failures.
    const guard = runBrandGuard(base, client, { autoFix: s.status !== "brand-check" });
    return {
      ...base,
      captions: guard.captions,
      creativeText: guard.creativeText,
      checks: guard.checks,
      note: s.status === "brand-check" ? `Brand Guard: ${guard.checks.filter((c) => !c.ok).length} issue(s) need an agent` : s.note,
    };
  });

  const settings = Object.fromEntries([...clients.keys()].map((id) => [id, { ...DEFAULT_SETTINGS }]));
  const companies: Company[] = diskKitIds().flatMap((id) => {
    const kit = readDiskKit(id);
    return kit ? [{ id, kit, members: [], connections: {}, createdAt: now.toISOString() }] : [];
  });
  return { version: 3, posts, settings, companies, invites: [], notifications: [], users: [] };
}
