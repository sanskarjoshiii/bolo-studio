import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { addMedia, brandTokens, creativeTextHash, loadClient, mediaPath, prepareForRender, readStore, removeMedia, repoRoot, sizeFor, WorkflowError, type Client, type Post, type ReelScript } from "@bolo/core";
import { speak, ttsConfigured, wavSeconds } from "./tts";
import { FPS, type ReelProps } from "./composition/types";

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, "composition", "index.tsx");

const dataDir = () => process.env.BOLO_DATA_DIR ?? join(repoRoot(), "data");

/** Re-bundle the composition only when its source changed (bundling takes ~10–20 s). */
async function serveUrl(log: (m: string) => void) {
  const out = join(dataDir(), ".cache", "reel-bundle");
  const srcDir = join(here, "composition");
  const newestSrc = Math.max(...readdirSync(srcDir).map((f) => statSync(join(srcDir, f)).mtimeMs));
  const marker = join(out, "index.html");
  if (existsSync(marker) && statSync(marker).mtimeMs > newestSrc) return out;
  log("Bundling reel template…");
  rmSync(out, { recursive: true, force: true });
  return bundle({ entryPoint: ENTRY, outDir: out });
}

function brandOf(client: Client) {
  const { radius: _radius, ...brand } = brandTokens(client);
  return brand;
}

/** "Is Diwali ghari ka? — reel" → "Is Diwali ghari ka?" */
const cleanTitle = (t: string) => t.replace(/\s[—–-]\s(reel|carousel|post)$/i, "").trim();

/** Short on-screen phrase from a voice line: up to the first comma/dash, at most 7 words. */
function keyPhrase(line: string) {
  const head = line.split(/[,—–:]|\s-\s/)[0].trim();
  const words = head.split(/\s+/);
  return words.length > 7 ? `${words.slice(0, 7).join(" ")}…` : head;
}

/**
 * Fallback when no agent wrote a script yet: the headline as the hook, then the first caption's
 * sentences — the key phrase on screen, the full sentence as the voice line and subtitle.
 */
export function defaultScript(post: Post, client: Client): ReelScript {
  const caption = (post.captions[0]?.text ?? "").split("\n")[0];
  const lines = caption
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2)
    .slice(0, 3);
  const title = cleanTitle(post.title);
  return {
    voiceLang: /[ऀ-ॿ]/.test(caption) ? "mr-IN" : "en-IN",
    scenes: [{ text: title, voice: lines[0] ?? title }, ...lines.slice(1).map((l) => ({ text: keyPhrase(l), voice: l }))],
    cta: client.checks.requireCta?.[0] ? `Book a ${client.checks.requireCta[0]}` : undefined,
  };
}

const MIME: Record<string, string> = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/**
 * A port nobody is listening on. Remotion would otherwise start its bundle server at 3000 and, on
 * Windows, can bind 127.0.0.1:3000 even while the studio's Next server holds 0.0.0.0:3000 — Chrome
 * then opens the studio instead of the reel ("window.getStaticCompositions is not defined").
 * Binding the IPv6/IPv4 wildcard here fails for any port already taken on either.
 */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

/** Serve render assets over localhost so the headless browser can load them. */
async function assetServer(files: Map<string, string>) {
  const server = createServer((req, res) => {
    const file = files.get(decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, "")));
    if (!file || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}

/**
 * Render the post's reel to a 1080×1920 MP4 and attach it (replacing earlier rendered reels).
 * Voiceover per scene when SARVAM_API_KEY is set, so every subtitle matches its voice clip.
 */
export async function renderReel(postId: string, opts: { voice?: boolean; log?: (m: string) => void } = {}): Promise<Post> {
  const log = opts.log ?? (() => {});
  const found = readStore().posts.find((p) => p.id === postId);
  if (!found) throw new WorkflowError(404, `Post ${postId} not found.`);
  if (found.status === "scheduled" || found.status === "live") throw new WorkflowError(409, "Scheduled and live posts can't be changed here.");
  const post = await prepareForRender(postId); // RERA no. etc. on the end card before it's drawn
  const client = loadClient(post.clientId);
  if (!client) throw new WorkflowError(404, "Client not found.");

  const script = post.reel?.scenes.length ? post.reel : defaultScript(post, client);
  const size = sizeFor(post);
  const useVoice = (opts.voice ?? true) && ttsConfigured(post.clientId) && script.scenes.some((s) => s.voice);
  const work = join(dataDir(), ".cache", "reel-work", `${postId}-${Date.now().toString(36)}`);
  mkdirSync(work, { recursive: true });

  const files = new Map<string, string>();
  const photos = (post.media ?? []).filter((m) => m.kind === "image" && m.source !== "template");
  photos.forEach((m, i) => files.set(`bg-${i}${extname(m.file)}`, mediaPath(post.id, m.file)));

  const server = await assetServer(files);
  try {
    const scenes: ReelProps["scenes"] = [];
    for (const [i, s] of script.scenes.entries()) {
      let frames = Math.round((s.seconds ?? Math.max(2.4, s.text.split(/\s+/).length * 0.42)) * FPS);
      let audio: string | undefined;
      if (useVoice && s.voice) {
        log(`Voice ${i + 1}/${script.scenes.length}…`);
        const wav = await speak(s.voice, { lang: script.voiceLang ?? "en-IN", speaker: script.speaker, companyId: post.clientId });
        const name = `voice-${i}.wav`;
        writeFileSync(join(work, name), wav);
        files.set(name, join(work, name));
        frames = Math.max(frames, Math.ceil((wavSeconds(wav) + 0.35) * FPS));
        audio = `${server.base}/${name}`;
      }
      const bg = photos.length ? `${server.base}/bg-${i % photos.length}${extname(photos[i % photos.length].file)}` : undefined;
      scenes.push({ text: s.text, voice: s.voice, audio, background: bg, frames });
    }

    const footnote = post.creativeText.split(/\n| · /).find((s) => /^RERA\b|Reg\. No\./i.test(s.trim()))?.trim() ?? "";
    const music = join(repoRoot(), "brand-kits", client.id, "music.mp3");
    if (existsSync(music)) files.set("music.mp3", music);
    const props: ReelProps = {
      brand: brandOf(client),
      scenes,
      end: { title: client.name, cta: script.cta ?? "", footnote, frames: Math.round(3.5 * FPS) },
      music: existsSync(music) ? `${server.base}/music.mp3` : undefined,
      size: { w: size.w, h: size.h },
    };

    const url = await serveUrl(log);
    const composition = await selectComposition({ serveUrl: url, id: "Reel", inputProps: props, port: await freePort() });
    const out = join(work, "reel.mp4");
    log(`Rendering ${Math.round(composition.durationInFrames / FPS)}s reel…`);
    let last = -1;
    await renderMedia({
      composition,
      serveUrl: url,
      codec: "h264",
      outputLocation: out,
      inputProps: props,
      port: await freePort(),
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== last) log(`  ${(last = pct)}%`);
      },
    });

    const previous = (post.media ?? []).filter((m) => m.source === "template" && m.kind === "video");
    let result = await addMedia(post.id, {
      name: `${cleanTitle(post.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-reel.mp4`,
      type: "video/mp4",
      bytes: new Uint8Array(readFileSync(out)),
      source: "template",
      textHash: creativeTextHash(post),
      w: size.w,
      h: size.h,
    });
    for (const m of previous) result = await removeMedia(post.id, m.file);
    log(useVoice ? "Done — reel with voiceover attached." : ttsConfigured(post.clientId) ? "Done — silent reel attached." : "Done — silent reel attached (connect Sarvam AI for voiceover).");
    return result;
  } finally {
    await server.close();
    rmSync(work, { recursive: true, force: true });
  }
}

