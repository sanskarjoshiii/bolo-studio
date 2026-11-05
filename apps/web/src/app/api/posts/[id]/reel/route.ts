import { spawn } from "node:child_process";
import { join } from "node:path";
import { readStore, repoRoot, WorkflowError } from "@bolo/core";
import { body, handle } from "@/lib/api-route";

export const maxDuration = 300;

/**
 * Render the post's reel (Remotion + Sarvam voiceover) by running `bolo reel` in its own
 * process — keeps the heavy renderer out of the web server and identical to the agents' path.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (me) => {
    const { voice = true } = await body<{ voice?: boolean }>(req).catch(() => ({ voice: true }));
    const post = readStore().posts.find((p) => p.id === id);
    if (!post) throw new WorkflowError(404, "Post not found.");
    if (post.format !== "Reel" && post.format !== "Story") throw new WorkflowError(400, "Videos are for reels and stories — switch the format first.");

    const root = repoRoot();
    const args = ["--import", "tsx", join(root, "packages", "cli", "src", "index.ts"), "reel", id, ...(voice ? [] : ["--no-voice"])];
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, BOLO_AGENT_NAME: me.name }, windowsHide: true });
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const timer = setTimeout(() => child.kill(), 290_000);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(log);
        else reject(new WorkflowError(409, (log.match(/Error: (.+)/)?.[1] ?? log.trim().split("\n").at(-1) ?? "Reel render failed").slice(0, 300)));
      });
      child.on("error", (e) => reject(new WorkflowError(409, e.message)));
    });
    return { post: readStore().posts.find((p) => p.id === id), log: output.slice(-2000) };
  });
}
