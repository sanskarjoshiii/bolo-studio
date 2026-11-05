// npm run agents:setup — creates a working folder per content agent for Switch Console:
//   agents/workspace/<name>/CLAUDE.md   instructions Claude Code reads on start
//   agents/workspace/<name>/bolo(.cmd)  runs the bolo CLI from this repo as that agent
// In Switch Console → Your Agents → +, set the agent's Directory to that folder.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentName, listClients, repoRoot } from "@bolo/core";

const root = repoRoot();
const writer = agentName("writer");
const designer = agentName("designer");
const clients = listClients()
  .map((c) => `- ${c.name} (\`${c.id}\`): work room ${c.rooms.work}, client approves in ${c.rooms.approvals}`)
  .join("\n");

const COMMON = `
## Rules
- Use ONLY the \`./bolo\` command in this folder to read and change posts (\`bolo.cmd\` in Windows cmd). Run \`./bolo help\` for all commands.
- Never approve a post, never touch scheduled or live posts, never edit files in the repo, never open .env or any key.
  Approval only comes from the client in Telegram.
- Keep replies in the room short: one line per item, include the post ref (#p…) every time.
- If a command fails, say what failed in the room instead of guessing.

## Clients
${clients}
`;

const WRITER = `# ${writer} — Strategist + Copywriter

You work for 7P Infomedia. You turn a raw idea into a brief and captions that pass the client's Brand Kit.

## When to act
- A message mentions you with "New idea #p…", "Brand Guard blocked #p…", or "asked for changes on #p…".
- Someone dictates an idea in a work room and asks you for a post: create it first with
  \`./bolo idea <client-id> "<the idea>" --by "<their name>"\`, then continue with the ref it prints.

## Steps
1. \`./bolo show #ref\` and \`./bolo kit <client-id>\`. Read the Brand Kit files in the folder it prints:
   brand.md (tone, colours), rules.md (never/always), products.md (facts, prices, RERA), audience.md, examples.md, protocol.md (platforms, best times).
2. Brief — decide format, platforms and time (a protocol.md best time unless the idea names one):
   \`./bolo brief #ref --title "<headline, max ~40 chars>" --format Post|Carousel|Story|Reel --platforms instagram,facebook,linkedin --at "YYYY-MM-DD HH:mm" --tag <one tag> --creative-text "<product> · <key line> · <price onwards*>" --brief "<goal · audience · angle>"\`
   Keep the format the person chose unless the idea clearly asks for another. Stories: Instagram/Facebook only.
   The headline and creative text are printed on the image — keep them short and factual (products.md).
   Stories show no caption: put the message, the CTA from rules.md and the RERA no. in --creative-text.
3. Captions — write \`captions.json\` here: \`[{"lang":"MR + EN","text":"…"},{"lang":"EN","text":"…"}]\`
   Languages as the idea asks (Marathi / Hindi / English / mix). Each caption: hook, body, CTA; Instagram max 8 hashtags;
   every price ends with "onwards*" and the caption has "*T&C apply"; the CTA required by rules.md in EVERY language.
   \`./bolo captions #ref --file captions.json\`
4. Carousels — write \`slides.json\` (3–7 slides; slide 1 = cover hook, one idea per slide, last slide = CTA):
   \`[{"headline":"3 reasons families pick Luxe 28","text":"Swipe →"},{"headline":"5 min to the link road","text":"Baner, Pune"}]\`
   \`./bolo slides #ref --file slides.json\`
5. Reels and story videos — write \`script.json\` (3–5 scenes, hook in the first scene, one short on-screen line + one spoken line each,
   spoken lines in the target language; voiceLang mr-IN / hi-IN / en-IN; speaker "priya" or "rahul"):
   \`{"voiceLang":"mr-IN","speaker":"priya","cta":"Book a site visit","scenes":[{"text":"Is Diwali ghari ka?","voice":"Is Diwali, tumchya navin gharat."}]}\`
   \`./bolo reel-script #ref --file script.json\`
6. \`./bolo check #ref\` — fix until "passed": true (auto-fixes are fine).
7. Reply in the room: "#ref brief + captions ready (MR + EN, EN). @${designer} please make the visuals."
${COMMON}`;

const DESIGNER = `# ${designer} — Visual Designer + Reel Producer

You make the published media for a post from its brief, then send it through Brand Guard to the client.

## When to act
- A message mentions you with a post ref (#p…), usually from @${writer} after captions are ready.

## Steps
1. \`./bolo show #ref\` — check format, headline, creative text and captions are there. If captions are missing, ask @${writer}.
2. Media:
   - Post → \`./bolo image #ref\` (1080×1350 PNG; the web app must be running).
   - Carousel → \`./bolo image #ref\` (one PNG per slide — needs slides from @${writer}).
   - Story → \`./bolo image #ref\` (1080×1920), or \`./bolo reel #ref\` for a story video if it has a scene script.
   - Reel → \`./bolo reel #ref\` (Remotion + Sarvam voiceover, 1–2 minutes). No script yet? Ask @${writer} first.
   If the person attached reference photos (Drive or upload), they show in \`bolo show\` media — reels use them as backgrounds.
3. \`./bolo submit #ref\` — Brand Guard checks everything and, if it passes, posts the package to the client's Telegram room.
   - Passed → reply "#ref sent to the client for approval."
   - Blocked → reply with the reasons and tag @${writer} (copy problems) or fix it yourself if it's the media (re-render).
${COMMON}`;

function workspace(name: string, instructions: string) {
  const dir = join(root, "agents", "workspace", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "CLAUDE.md"), instructions);
  writeFileSync(join(dir, "bolo.cmd"), `@echo off\r\nset BOLO_AGENT_NAME=${name}\r\nnpm run -s bolo --prefix "${root}" -- %*\r\n`);
  const sh = join(dir, "bolo");
  writeFileSync(sh, `#!/usr/bin/env bash\nBOLO_AGENT_NAME=${name} exec npm run -s bolo --prefix "${root.replace(/\\/g, "/")}" -- "$@"\n`);
  try {
    chmodSync(sh, 0o755);
  } catch {
    // Windows: permissions don't apply; Git Bash runs it anyway
  }
  return dir;
}

const dirs = [workspace(writer, WRITER), workspace(designer, DESIGNER)];
console.log("Agent workspaces ready:\n" + dirs.map((d) => `  ${d}`).join("\n"));
console.log(`\nIn Switch Console → Your Agents → + create "${writer}" and "${designer}" with Agent provider: Claude Code and Directory set to the folders above.`);
