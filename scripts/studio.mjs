// npm run studio — web app (:3000) + Publisher (:4100) in one terminal, in dev mode.
// npm run demo   — the same, but a production build first: every page loads fast (for demos).
// Ctrl+C stops both, including their child processes (Windows keeps them alive otherwise).
import { spawn, execSync } from "node:child_process";

const prod = process.argv.includes("--prod");
if (prod) {
  console.log("Building the studio for the demo (about a minute)…");
  execSync("npm run build", { stdio: "inherit" });
}

const procs = [
  { name: "web      ", color: 36, args: prod ? ["run", "start", "-w", "@bolo/web"] : ["run", "dev"] },
  { name: "publisher", color: 33, args: ["run", prod ? "start" : "dev", "-w", "@bolo/publisher"] },
];

const children = procs.map(({ name, color, args }) => {
  const child = spawn("npm", args, { shell: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FORCE_COLOR: "1" } });
  const prefix = `\x1b[${color}m${name}\x1b[0m │ `;
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) process.stdout.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => process.stdout.write(`${prefix}exited (${code})\n`));
  return child;
});

console.log("\nBolo Studio starting…\n  Studio     http://localhost:3000/dashboard\n  Publisher  http://localhost:4100/health\n  Ctrl+C to stop both\n");

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try {
      if (process.platform === "win32") execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" });
      else process.kill(-c.pid, "SIGTERM");
    } catch {
      c.kill();
    }
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
