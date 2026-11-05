import { useId } from "react";
import { cn } from "@/lib/cn";

const W = 1440;
const H = 600;

type Wave = [amp: number, freq: number, phase: number];

function ridge(x: number, base: number, waves: Wave[]) {
  return waves.reduce((y, [a, f, p]) => y + a * Math.sin((x / W) * Math.PI * 2 * f + p), base);
}

function hill(base: number, waves: Wave[], step = 12) {
  let d = `M0 ${ridge(0, base, waves).toFixed(1)}`;
  for (let x = step; x <= W; x += step) d += ` L${x} ${ridge(x, base, waves).toFixed(1)}`;
  return `${d} L${W} ${H} L0 ${H}Z`;
}

/** Contour lines that follow a hill's surface — reads as mown grass rows. */
function stripes(base: number, waves: Wave[], count: number, gap: number) {
  const lines: string[] = [];
  for (let i = 1; i <= count; i++) {
    const off = i * gap + i * i * 0.6;
    let d = "";
    for (let x = 0; x <= W; x += 16) {
      const y = ridge(x, base, waves) + off + 6 * Math.sin((x / W) * Math.PI * 3 + i);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)} `;
    }
    lines.push(d);
  }
  return lines;
}

const TREES: Wave[] = [
  [10, 3, 0.4],
  [6, 11, 1.2],
  [4, 23, 2.1],
  [3, 41, 0.7],
];
const FAR: Wave[] = [
  [26, 1.2, 0.8],
  [10, 3.1, 2.2],
];
const MID: Wave[] = [
  [40, 0.9, 2.6],
  [14, 2.3, 0.3],
];
const FRONT: Wave[] = [
  [46, 0.7, 4.1],
  [12, 1.9, 1.4],
];

export function Hills({ tone = "mist", fade = false, className }: { tone?: "mist" | "bright"; fade?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const bright = tone === "bright";
  // Short, wide containers crop the top of the scene; fade lets it melt into the section instead of a hard edge
  const mask = fade ? "linear-gradient(to bottom, transparent, #000 40%)" : undefined;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className={cn("pointer-events-none block h-full w-full", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      aria-hidden
    >
      <defs>
        <filter id={`${id}-haze`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bright ? "#8fb0a8" : "#b6c8bd"} />
          <stop offset="1" stopColor={bright ? "#a9c39a" : "#c9d6cd"} />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bright ? "#8fbc5f" : "#97b88a"} />
          <stop offset="1" stopColor={bright ? "#5f8f3e" : "#6e9a63"} />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bright ? "#7fb04a" : "#6f9d55"} />
          <stop offset="0.6" stopColor={bright ? "#4f8530" : "#4a7a38"} />
          <stop offset="1" stopColor={bright ? "#3a6a24" : "#3a6430"} />
        </linearGradient>
        <linearGradient id={`${id}-fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef2f0" stopOpacity="0" />
          <stop offset="0.45" stopColor="#eef2f0" stopOpacity="0.75" />
          <stop offset="1" stopColor="#eef2f0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* distant tree line, hazy */}
      <path d={hill(250, TREES, 6)} fill={bright ? "#5c7f6f" : "#7d9387"} opacity={bright ? 0.45 : 0.35} filter={`url(#${id}-haze)`} />
      <path d={hill(300, FAR)} fill={`url(#${id}-far)`} filter={`url(#${id}-soft)`} />
      <rect x="0" y="200" width={W} height="200" fill={`url(#${id}-fog)`} />

      <path d={hill(380, MID)} fill={`url(#${id}-mid)`} />
      {stripes(380, MID, 7, 14).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={5} />
      ))}

      <path d={hill(470, FRONT)} fill={`url(#${id}-front)`} />
      {stripes(470, FRONT, 9, 13).map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i % 2 ? "#ffffff" : "#1d3a14"} strokeOpacity={i % 2 ? 0.07 : 0.09} strokeWidth={6} />
      ))}
    </svg>
  );
}
