// Render the explainer clips:  node --import tsx video/explainer/render.mts [stills]
//   (no argument) → out/s2-problem.mp4, out/s3-idea.mp4, out/s4-switch.mp4
//   stills        → a few PNG frames per clip in out/stills, for checking the layout quickly
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(join(out, "stills"), { recursive: true });

/** A free port — so Remotion never lands on the studio's port 3000. */
const freePort = () =>
  new Promise<number>((ok, no) => {
    const s = createServer();
    s.on("error", no);
    s.listen(0, () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => ok(port));
    });
  });

const serveUrl = await bundle({ entryPoint: join(here, "src", "index.tsx") });
const stillsMode = process.argv.includes("stills");
const only = process.argv.find((a) => a.startsWith("s") && a.includes("-"));

const STILLS: Record<string, number[]> = {
  "s2-problem": [2.5, 7, 9.6, 13.2, 16.5],
  "s3-idea": [1.2, 3.5, 8, 12.5],
  "s4-switch": [7.5, 16.5, 19, 21.5, 26, 34.5],
  "s6-why": [4.5, 9.5, 13.5, 17.5],
};
/** Clips rendered with no background: ProRes 4444 .mov (editors) + VP9 .webm (browsers), both with alpha. */
const TRANSPARENT = new Set(["s6-why"]);

for (const id of Object.keys(STILLS)) {
  if (only && only !== id) continue;
  const composition = await selectComposition({ serveUrl, id, port: await freePort() });
  if (stillsMode) {
    for (const s of STILLS[id]) {
      await renderStill({ composition, serveUrl, output: join(out, "stills", `${id}-${s}s.png`), frame: Math.round(s * 30), port: await freePort() });
    }
    console.log(`stills: ${id}`);
  } else if (TRANSPARENT.has(id)) {
    await renderMedia({ composition, serveUrl, codec: "prores", proResProfile: "4444", imageFormat: "png", pixelFormat: "yuva444p10le", outputLocation: join(out, `${id}.mov`), port: await freePort() });
    await renderMedia({ composition, serveUrl, codec: "vp9", imageFormat: "png", pixelFormat: "yuva420p", crf: 18, outputLocation: join(out, `${id}.webm`), port: await freePort() });
    console.log(`rendered ${id}.mov + ${id}.webm (transparent)`);
  } else {
    let last = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 16,
      outputLocation: join(out, `${id}.mp4`),
      port: await freePort(),
      onProgress: ({ progress }) => {
        const p = Math.floor(progress * 10) * 10;
        if (p !== last) process.stdout.write(`${id} ${(last = p)}%\r`);
      },
    });
    console.log(`\nrendered ${id}.mp4`);
  }
}
