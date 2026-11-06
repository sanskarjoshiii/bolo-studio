// bolo — how the content agents (Claude Code agents in Switch rooms) read and write posts.
// Every write goes through @bolo/core, so the same Brand Guard and approval rules apply as in
// the dashboard. Agents can never approve: approval only comes from the client.
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  createIdea,
  getClientStudio,
  listClients,
  loadStore,
  loadClient,
  postRef,
  previewBrandGuard,
  readStore,
  repoRoot,
  kitDirFor,
  setting,
  signToken,
  submitForApproval,
  updatePost,
  WorkflowError,
  type Caption,
  type Platform,
  type Post,
  type PostFormat,
  type ReelScript,
} from "@bolo/core";
import { formatSlot, istIso, LAYOUTS } from "@bolo/core/shared";

const HELP = `bolo — Bolo Studio commands for content agents

  bolo clients                              list clients and their rooms
  bolo kit <client>                         Brand Kit summary + folder to read (rules, tone, products)
  bolo posts <client> [--status draft]      posts for a client
  bolo show <ref>                           one post in full (ref = #p1a2b3 or post id)
  bolo idea <client> <text…> [--by NAME]    new idea → draft (use for ideas dictated in the room)

  bolo brief <ref> [--title T] [--format Post|Carousel|Story|Reel] [--platforms instagram,facebook,linkedin,youtube]
                   [--at "YYYY-MM-DD HH:mm"] [--tag diwali] [--creative-text "Luxe 28 · ₹78 L onwards*"] [--brief TEXT]
  bolo captions <ref> --lang EN --text "…"  set one language's caption (repeat per language)
  bolo captions <ref> --file captions.json  set all: [{"lang":"EN","text":"…"},{"lang":"मराठी","text":"…"}]
  bolo slides <ref> --file slides.json      carousel: [{"headline":"3 reasons","text":"…"}, …] (1–10, slide 1 = cover)
  bolo reel-script <ref> --file script.json  {"voiceLang":"mr-IN","speaker":"priya","cta":"Book a site visit",
                                              "scenes":[{"text":"On-screen line","voice":"What the voice says"}]}

  bolo layout <ref> <name>                  pick the design: hero, split, editorial, offer, bold, festive (or auto)
  bolo image <ref>                          render the brand template: post 1080×1350, story 1080×1920, one PNG per carousel slide
  bolo reel <ref> [--no-voice]              render the reel / story video MP4 (Remotion + Sarvam voiceover)
  bolo check <ref>                          Brand Guard dry run — nothing changes
  bolo submit <ref>                         Brand Guard → if it passes, the package goes to the client on Telegram

Client ids come from: bolo clients. Times are IST.`;

// ---------- args ----------

function parse(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

const flag = (f: Record<string, string | true>, k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);

function out(value: unknown) {
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

// ---------- lookups ----------

function resolvePost(ref: string | undefined): Post {
  if (!ref) throw new WorkflowError(400, "Give a post ref, e.g. #p1a2b3 (see: bolo posts <client>).");
  const r = ref.trim().replace(/^#?/, "#").toLowerCase();
  const posts = readStore().posts;
  const post = posts.find((p) => postRef(p) === r) ?? posts.find((p) => p.id === ref.trim());
  if (!post) throw new WorkflowError(404, `No post ${ref}.`);
  return post;
}

function resolveClient(id: string | undefined) {
  if (!id) throw new WorkflowError(400, `Give a client: ${listClients().map((c) => c.id).join(", ")}`);
  const c = loadClient(id) ?? listClients().find((x) => x.name.toLowerCase() === id.toLowerCase() || x.short.toLowerCase() === id.toLowerCase());
  if (!c) throw new WorkflowError(404, `No client “${id}”. Clients: ${listClients().map((x) => x.id).join(", ")}`);
  return c;
}

const summary = (p: Post) => ({
  ref: postRef(p),
  id: p.id,
  status: p.status,
  title: p.title,
  format: p.format,
  platforms: p.platforms,
  slot: `${formatSlot(p.scheduledAt)} IST`,
});

/** Paths are relative to where the agent ran the command (npm moves cwd to the repo root). */
const userPath = (p: string) => (isAbsolute(p) ? p : resolve(process.env.INIT_CWD ?? process.cwd(), p));

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(userPath(path), "utf8")) as T;
  } catch (e) {
    throw new WorkflowError(400, `Couldn't read JSON from ${path}: ${(e as Error).message}`);
  }
}

/** "2026-11-06 19:30" (IST) → ISO with +05:30 */
function parseAt(s: string) {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) throw new WorkflowError(400, `Use --at "YYYY-MM-DD HH:mm" (IST), got “${s}”.`);
  return istIso(m[1], Number(m[2]) * 60 + Number(m[3]));
}

const agentName = () => process.env.BOLO_AGENT_NAME || "bolo-agent";

/** Calls the web app as an agent (for rendering, which runs there). */
async function web<T>(path: string, method: "POST" = "POST"): Promise<T> {
  const base = (setting("BOLO_WEB_URL") || "http://localhost:3000").replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method, headers: { "x-bolo-agent": signToken({ kind: "agent", name: agentName() }, 300) } });
  } catch {
    throw new WorkflowError(409, `The web app isn't reachable at ${base} — start it with: npm run dev`);
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new WorkflowError(409, body.error ?? `Web app answered ${res.status}`);
  return body;
}

// ---------- commands ----------

async function main() {
  repoRoot();
  await loadStore();
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parse(rest);

  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
      return out(HELP);

    case "clients":
      return out(listClients().map((c) => ({ id: c.id, name: c.name, workRoom: c.rooms.work, approvalsRoom: c.rooms.approvals, channels: c.channels.map((x) => x.platform) })));

    case "kit": {
      const c = resolveClient(pos[0]);
      return out({
        client: c.name,
        folder: kitDirFor(c.id),
        read: c.files.map((f) => f.name),
        approvers: c.approvers.map((a) => `${a.name} ${a.handle}`),
        platforms: c.channels.map((x) => x.platform),
        bestTimesIST: c.bestTimes.map((b) => `${b.label}: ${b.time}`),
        products: c.products,
        rera: c.reraNumbers,
        automatedChecks: c.checks,
      });
    }

    case "posts": {
      const c = resolveClient(pos[0]);
      const status = flag(flags, "status");
      return out(getClientStudio(c.id).posts.filter((p) => !status || p.status === status).map(summary));
    }

    case "show": {
      const p = resolvePost(pos[0]);
      const c = loadClient(p.clientId)!;
      return out({
        ...summary(p),
        client: c.id,
        brandKit: kitDirFor(c.id),
        brief: p.brief ?? null,
        tag: p.tag,
        creativeText: p.creativeText,
        layout: p.layout ?? "auto",
        captions: p.captions,
        reel: p.reel ?? null,
        slides: p.slides ?? null,
        media: (p.media ?? []).map((m) => `${m.kind} ${m.name}${m.source === "template" ? " (rendered)" : ""}`),
        note: p.note ?? null,
        failingChecks: p.checks.filter((x) => !x.ok).map((x) => `${x.label}${x.detail ? ` — ${x.detail}` : ""}`),
        thread: p.thread.slice(-6).map((m) => `${m.from}: ${m.text}`),
      });
    }

    case "idea": {
      const c = resolveClient(pos[0]);
      const text = pos.slice(1).join(" ");
      const p = await createIdea({ clientId: c.id, text, author: flag(flags, "by") ?? agentName() });
      return out(`Created ${postRef(p)} “${p.title}” for ${c.name} — ${formatSlot(p.scheduledAt)} IST. Next: bolo brief ${postRef(p)} …`);
    }

    case "brief": {
      const p = resolvePost(pos[0]);
      const platforms = flag(flags, "platforms")
        ?.split(",")
        .map((s) => s.trim().toLowerCase())
        .map((s) => ({ ig: "instagram", fb: "facebook", li: "linkedin", yt: "youtube" })[s] ?? s) as Platform[] | undefined;
      const updated = await updatePost(p.id, {
        title: flag(flags, "title"),
        format: flag(flags, "format") as PostFormat | undefined,
        platforms,
        scheduledAt: flag(flags, "at") ? parseAt(flag(flags, "at")!) : undefined,
        tag: flag(flags, "tag"),
        creativeText: flag(flags, "creative-text"),
        brief: flag(flags, "brief"),
      });
      return out({ updated: summary(updated), brief: updated.brief ?? null, creativeText: updated.creativeText });
    }

    case "captions": {
      const p = resolvePost(pos[0]);
      let captions: Caption[];
      const file = flag(flags, "file");
      if (file) captions = readJson<Caption[]>(file);
      else {
        const lang = flag(flags, "lang");
        const text = flag(flags, "text");
        if (!lang || !text) throw new WorkflowError(400, 'Use --lang EN --text "…" or --file captions.json');
        captions = [...p.captions.filter((c) => c.lang.toLowerCase() !== lang.toLowerCase()), { lang, text }];
      }
      if (!Array.isArray(captions) || captions.some((c) => !c?.lang || typeof c.text !== "string")) {
        throw new WorkflowError(400, 'Captions must be [{"lang":"EN","text":"…"}].');
      }
      const updated = await updatePost(p.id, { captions });
      return out(`${postRef(updated)} captions: ${updated.captions.map((c) => `${c.lang} (${c.text.length} chars)`).join(", ")}. Check: bolo check ${postRef(updated)}`);
    }

    case "slides": {
      const p = resolvePost(pos[0]);
      const file = flag(flags, "file");
      if (!file) throw new WorkflowError(400, 'Use --file slides.json — [{"headline":"…","text":"…"}]');
      const slides = readJson<{ headline: string; text?: string }[]>(file);
      const updated = await updatePost(p.id, { slides, format: "Carousel" });
      return out(`${postRef(updated)} carousel: ${updated.slides!.length} slides. Render: bolo image ${postRef(updated)}`);
    }

    case "reel-script": {
      const p = resolvePost(pos[0]);
      const file = flag(flags, "file");
      const json = flag(flags, "json");
      if (!file && !json) throw new WorkflowError(400, "Use --file script.json (or --json '{…}').");
      let reel: ReelScript;
      try {
        reel = file ? readJson<ReelScript>(file) : (JSON.parse(json!) as ReelScript);
      } catch (e) {
        throw new WorkflowError(400, `Invalid reel script: ${(e as Error).message}`);
      }
      const updated = await updatePost(p.id, { reel, format: p.format === "Story" ? "Story" : "Reel" });
      return out(`${postRef(updated)} reel script: ${updated.reel!.scenes.length} scenes${updated.reel!.voiceLang ? `, voice ${updated.reel!.voiceLang}` : ""}. Render: bolo reel ${postRef(updated)}`);
    }

    case "layout": {
      const p = resolvePost(pos[0]);
      const name = (pos[1] ?? "").toLowerCase();
      if (!name || (name !== "auto" && !(name in LAYOUTS))) {
        return out(`Layouts: ${Object.entries(LAYOUTS).map(([id, l]) => `${id} — ${l.hint}`).join("; ")}; auto — picked from the text and photos.`);
      }
      const updated = await updatePost(p.id, { layout: name === "auto" ? "" : name });
      return out(`${postRef(updated)} layout: ${updated.layout ?? "auto"}. Render it: bolo image ${postRef(updated)}`);
    }

    case "image": {
      const p = resolvePost(pos[0]);
      const updated = await web<Post>(`/api/posts/${p.id}/render`);
      const imgs = (updated.media ?? []).filter((m) => m.kind === "image" && m.source === "template");
      return out(`${postRef(p)} rendered ${imgs.length} image${imgs.length === 1 ? "" : "s"}: ${imgs.map((m) => m.name).join(", ")}. Preview it in the dashboard.`);
    }

    case "reel": {
      const p = resolvePost(pos[0]);
      // Imported lazily: Remotion is heavy and only this command needs it
      const { renderReel } = await import("@bolo/reels");
      const updated = await renderReel(p.id, { voice: flags["no-voice"] ? false : undefined, log: (m) => console.log(m) });
      const vid = (updated.media ?? []).filter((m) => m.kind === "video").at(-1);
      return out(`${postRef(p)} reel attached: ${vid?.name} (${((vid?.size ?? 0) / 1e6).toFixed(1)} MB).`);
    }

    case "check": {
      const p = resolvePost(pos[0]);
      const r = previewBrandGuard(p.id);
      return out({
        ref: r.ref,
        passed: r.passed,
        failing: r.checks.filter((c) => !c.ok).map((c) => `${c.label}${c.detail ? ` — ${c.detail}` : ""}`),
        wouldAutoFix: r.checks.filter((c) => c.fixed).map((c) => c.fixed),
      });
    }

    case "submit": {
      const p = resolvePost(pos[0]);
      if (!(p.media ?? []).length && p.platforms.some((x) => x === "instagram" || x === "youtube")) {
        console.log(`Note: ${postRef(p)} has no image/video yet — Instagram/YouTube need one before it can publish (bolo image / bolo reel).`);
      }
      const r = await submitForApproval(p.id);
      return out(
        r.status === "awaiting"
          ? `✅ ${postRef(r)} passed Brand Guard and was sent to the client for approval.`
          : `❌ ${postRef(r)} blocked by Brand Guard:\n${r.checks
              .filter((c) => !c.ok)
              .map((c) => `• ${c.label}${c.detail ? ` — ${c.detail}` : ""}`)
              .join("\n")}`,
      );
    }

    default:
      throw new WorkflowError(400, `Unknown command “${cmd}”. Run: bolo help`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof WorkflowError ? `Error: ${e.message}` : e);
  process.exit(1);
});

