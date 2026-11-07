// Drawing kit for the explainer clips: white canvas, thin grey edges, ring nodes with a small
// uppercase type label above and a mono name below, label pills on edges, and one caption pill at
// the bottom that follows the voice-over. Everything is timed in seconds.
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadDeva } from "@remotion/google-fonts/NotoSansDevanagari";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const deva = loadDeva("normal", { weights: ["500", "600", "700"], subsets: ["devanagari"] });

export const W = 1344;
export const H = 1080;
export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

export const FONT = {
  sans: `${inter.fontFamily}, ${deva.fontFamily}, system-ui, sans-serif`,
  mono: `${mono.fontFamily}, ${deva.fontFamily}, ui-monospace, monospace`,
  deva: `${deva.fontFamily}, ${inter.fontFamily}, sans-serif`,
};

export const C = {
  bg: "#FFFFFF",
  ink: "#111418",
  sub: "#6B7280",
  faint: "#9AA1AB",
  line: "#C7CDD4",
  border: "#E2E6EA",
  blue: "#3B63D9",
  violet: "#7048E8",
  red: "#E0483A",
  green: "#2F9E5B",
  orange: "#F08C00",
  telegram: "#229ED9",
  pink: "#D6336C",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Current time in seconds. */
export function useT() {
  return useCurrentFrame() / FPS;
}

/** 0 → 1 spring from `at` seconds (no bounce unless asked). */
export function useIn(at: number, bouncy = false) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - sec(at), fps, config: bouncy ? { damping: 16, stiffness: 170, mass: 0.7 } : { damping: 200 } });
}

/** 0 → 1 eased between two times. */
export function useBetween(a: number, b: number, ease = Easing.inOut(Easing.cubic)) {
  const t = useT();
  return interpolate(t, [a, b], [0, 1], { ...clamp, easing: ease });
}

export const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

// ---------------------------------- text ----------------------------------

export function Title({ title, sub, at = 0 }: { title: string; sub?: string; at?: number }) {
  const p = useIn(at);
  return (
    <div style={{ position: "absolute", top: 42, left: 0, width: W, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 46, color: C.ink, letterSpacing: "-0.02em" }}>{title}</div>
      {sub && <div style={{ fontFamily: FONT.sans, fontWeight: 400, fontSize: 25, color: C.sub, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/** Caption pill at the bottom, switching with the voice-over. */
export function Caption({ items }: { items: { from: number; to: number; text: string }[] }) {
  const t = useT();
  const item = items.find((i) => t >= i.from && t < i.to);
  if (!item) return null;
  const fade = 0.22;
  const o = Math.min(interpolate(t, [item.from, item.from + fade], [0, 1], clamp), interpolate(t, [item.to - fade, item.to], [1, 0], clamp));
  const y = interpolate(t, [item.from, item.from + fade], [10, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, width: W, bottom: 34, display: "flex", justifyContent: "center", opacity: o, transform: `translateY(${y}px)` }}>
      <div
        style={{
          fontFamily: FONT.sans,
          fontWeight: 500,
          fontSize: 30,
          color: C.ink,
          background: C.bg,
          border: `1.5px solid ${C.border}`,
          borderRadius: 999,
          padding: "12px 30px",
          boxShadow: "0 6px 24px rgba(17,20,24,0.06)",
          whiteSpace: "nowrap",
        }}
      >
        {item.text}
      </div>
    </div>
  );
}

export function Pill({ x, y, text, at, color = C.sub, size = 20 }: { x: number; y: number; text: string; at: number; color?: string; size?: number }) {
  const p = useIn(at);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${0.9 + p * 0.1})`, opacity: p }}>
      <div style={{ fontFamily: FONT.mono, fontSize: size, color, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: "4px 14px", whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
}

// ---------------------------------- nodes ----------------------------------

type NodeProps = {
  x: number;
  y: number;
  at: number;
  kind: string;
  name: string;
  color?: string;
  size?: number;
  /** Times (s) when the node glows briefly — work arriving. */
  pulses?: number[];
  /** "stack": label above, name below (default). "side": circle with the name to its right. */
  layout?: "stack" | "side";
  nameSize?: number;
  /** Draw this instead of the inner dot (e.g. a waveform). */
  inner?: React.ReactNode;
};

export function Node({ x, y, at, kind, name, color = C.ink, size = 60, pulses = [], layout = "stack", nameSize = 25, inner }: NodeProps) {
  const t = useT();
  const p = useIn(at, true);
  const fade = useIn(at);
  const glow = Math.max(0, ...pulses.map((s) => (t >= s && t < s + 1.1 ? Math.sin(((t - s) / 1.1) * Math.PI) : 0)));
  const ring = (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          left: size / 2,
          top: size / 2,
          width: size * 2,
          height: size * 2,
          borderRadius: "50%",
          background: alpha(color, 0.13),
          transform: `translate(-50%, -50%) scale(${0.5 + glow * 0.6})`,
          opacity: glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `${Math.max(4, size * 0.08)}px solid ${color}`,
          background: C.bg,
          display: "grid",
          placeItems: "center",
          transform: `scale(${p})`,
        }}
      >
        {inner ?? <div style={{ width: size * 0.34, height: size * 0.34, borderRadius: "50%", background: color }} />}
      </div>
    </div>
  );
  const label = <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 15, letterSpacing: "0.16em", color: C.sub, textTransform: "uppercase", whiteSpace: "nowrap" }}>{kind}</div>;
  const title = <div style={{ fontFamily: FONT.mono, fontWeight: 500, fontSize: nameSize, color: C.ink, whiteSpace: "nowrap" }}>{name}</div>;

  if (layout === "side") {
    return (
      <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, display: "flex", alignItems: "center", gap: 18, opacity: fade }}>
        {ring}
        <div>
          {kind && label}
          {title}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", opacity: fade, pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: size / 2 + 14, left: 0, transform: "translateX(-50%)" }}>{label}</div>
      <div style={{ transform: `translate(-50%, -50%)`, position: "absolute" }}>{ring}</div>
      <div style={{ position: "absolute", top: size / 2 + 14, left: 0, transform: "translateX(-50%)", textAlign: "center" }}>{title}</div>
    </div>
  );
}

// ---------------------------------- edges ----------------------------------

type Pt = [number, number];
const segLen = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Shorten a polyline at both ends so it stops at the node rings. */
function trim(points: Pt[], start: number, end: number): Pt[] {
  const pts = points.map((p) => [...p] as Pt);
  const cut = (a: Pt, b: Pt, d: number): Pt => {
    const l = segLen(a, b) || 1;
    return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
  };
  pts[0] = cut(pts[0], pts[1], start);
  const n = pts.length - 1;
  pts[n] = cut(pts[n], pts[n - 1], end);
  return pts;
}

/** Point at fraction f along a polyline, plus the direction there. */
export function along(points: Pt[], f: number): { p: Pt; angle: number } {
  const lens = points.slice(1).map((b, i) => segLen(points[i], b));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const k = lens[i] ? d / lens[i] : 0;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    d -= lens[i];
  }
  return { p: points[points.length - 1], angle: 0 };
}

type EdgeProps = {
  points: Pt[];
  at: number;
  dur?: number;
  label?: string;
  labelAt?: number;
  color?: string;
  dashed?: boolean;
  arrow?: boolean;
  /** Gap left at each end. Default: worked out from the direction so the line never crosses a node's label or name. */
  gap?: [number, number];
  width?: number;
};

/**
 * How far from a node's centre a line must stop. Sideways it only clears the ring; going up it
 * clears the type label above, going down it clears the name below — longer on a slant.
 */
function autoGap(sin: number, leaving: boolean) {
  const s = Math.abs(sin);
  if (s < 0.35) return leaving ? 40 : 44;
  const below = 86; // ring + name
  const above = 72; // ring + type label
  const down = sin > 0;
  const clearance = leaving ? (down ? below : above) : down ? above : below;
  return Math.min(170, clearance / s);
}

export function Edge({ points, at, dur = 0.7, label, labelAt = 0.5, color = C.line, dashed = false, arrow = true, gap, width = 3 }: EdgeProps) {
  const t = useT();
  const first = Math.atan2(points[1][1] - points[0][1], points[1][0] - points[0][0]);
  const n = points.length - 1;
  const last = Math.atan2(points[n][1] - points[n - 1][1], points[n][0] - points[n - 1][0]);
  const [g0, g1] = gap ?? [autoGap(Math.sin(first), true), autoGap(Math.sin(last), false)];
  const pts = trim(points, g0, g1);
  const total = pts.slice(1).reduce((s, b, i) => s + segLen(pts[i], b), 0);
  const p = interpolate(t, [at, at + dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (p <= 0) return null;
  const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0]},${q[1]}`).join(" ");
  const end = along(pts, p);
  const head = 13;
  const a = end.angle;
  const tri = [
    [end.p[0], end.p[1]],
    [end.p[0] - head * Math.cos(a - 0.45), end.p[1] - head * Math.sin(a - 0.45)],
    [end.p[0] - head * Math.cos(a + 0.45), end.p[1] - head * Math.sin(a + 0.45)],
  ]
    .map((q) => q.join(","))
    .join(" ");
  const mid = along(pts, labelAt).p;
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "9 9" : `${total} ${total}`}
          strokeDashoffset={dashed ? 0 : total * (1 - p)}
          opacity={dashed ? p : 1}
        />
        {arrow && p > 0.02 && <polygon points={tri} fill={color} />}
      </svg>
      {label && <Pill x={mid[0]} y={mid[1]} text={label} at={at + dur * 0.55} />}
    </>
  );
}

/** A dot (and optional label) travelling along a path — a post, a reply, an idea. */
export function Packet({ points, from, to, color = C.blue, label, size = 16 }: { points: Pt[]; from: number; to: number; color?: string; label?: string; size?: number }) {
  const t = useT();
  if (t < from || t > to + 0.25) return null;
  const f = interpolate(t, [from, to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const o = Math.min(interpolate(t, [from, from + 0.15], [0, 1], clamp), interpolate(t, [to, to + 0.25], [1, 0], clamp));
  const { p } = along(points, f);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: p[0] - size / 2,
          top: p[1] - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 0 6px ${alpha(color, 0.18)}`,
          opacity: o,
        }}
      />
      {label && (
        <div style={{ position: "absolute", left: p[0], top: p[1] - 34, transform: "translate(-50%, -50%)", opacity: o }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 19, fontWeight: 500, color, background: C.bg, border: `1.5px solid ${alpha(color, 0.45)}`, borderRadius: 999, padding: "3px 12px", whiteSpace: "nowrap" }}>
            {label}
          </div>
        </div>
      )}
    </>
  );
}

/** A container (Switch, a room, AWS): the border draws itself, the label sits on the top edge. */
export function Box({
  x,
  y,
  w,
  h,
  at,
  label,
  color,
  dur = 0.9,
  tint = 0.025,
  radius = 22,
  labelSize = 17,
  labelAlign = "left",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  label: string;
  color: string;
  dur?: number;
  tint?: number;
  radius?: number;
  labelSize?: number;
  labelAlign?: "left" | "right";
}) {
  const t = useT();
  const lp = useIn(at + dur * 0.6);
  const p = interpolate(t, [at, at + dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (p <= 0) return null;
  const per = 2 * (w + h);
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <rect x={x} y={y} width={w} height={h} rx={radius} fill={alpha(color, tint * p)} stroke={alpha(color, 0.55)} strokeWidth={2} strokeDasharray={`${per} ${per}`} strokeDashoffset={per * (1 - p)} />
      </svg>
      <div style={{ position: "absolute", ...(labelAlign === "left" ? { left: x + 26 } : { right: W - (x + w) + 26 }), top: y, transform: "translateY(-50%)", opacity: lp }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: labelSize, letterSpacing: "0.14em", textTransform: "uppercase", color, background: C.bg, padding: "2px 10px", whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </>
  );
}

/** Animated voice bars (for Wispr Flow / "speak"). */
export function Wave({ color, bars = 5, height = 22, active = true }: { color: string; bars?: number; height?: number; active?: boolean }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {Array.from({ length: bars }, (_, i) => {
        const v = active ? 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + i * 1.3)) : 0.35;
        return <div key={i} style={{ width: 4, height: height * v, borderRadius: 2, background: color }} />;
      })}
    </div>
  );
}
