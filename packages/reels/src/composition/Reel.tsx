import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { totalFrames, type ReelProps, type ReelScene } from "./types";

// Brand fonts used across the demo Brand Kits (tokens.json fontHead / fontBody)
const inter = loadInter("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
const playfair = loadPlayfair("normal", { weights: ["600", "700"], subsets: ["latin"] });

const FONTS: Record<string, string> = {
  Inter: inter.fontFamily,
  "Playfair Display": playfair.fontFamily,
};
const font = (name: string) => `${FONTS[name] ?? `"${name}"`}, ${inter.fontFamily}, sans-serif`;
const isSerif = (name: string) => /playfair|serif/i.test(name);

type Brand = ReelProps["brand"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const shade = (c: string, pct: number) => `color-mix(in srgb, ${c} ${100 - pct}%, #000)`;

/** Long lines step down so they always fit the 1080 px frame. */
const headlineSize = (text: string) => (text.length <= 14 ? 150 : text.length <= 24 ? 120 : text.length <= 40 ? 94 : 72);

/** "₹78 L onwards*" / "70% open space" / "5 min to the link road" → the number to count up to. */
function statOf(text: string) {
  const m = text.match(/^(.*?)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const value = Number(m[2]);
  // Prices, percentages and measured numbers count up; names like "Luxe 28" don't
  const measured = /^\s*(\+|L|Lakh|lakh|Cr|crore|min|mins|minutes|km|acres?|sq\.?\s?ft|years?|yrs|floors?|towers?|families|homes|flats)(?![a-z])/.test(m[3]);
  if (!(/₹\s*$/.test(m[1]) || /^\s*%/.test(m[3]) || measured)) return null;
  return { before: m[1], value, decimals: m[2].includes(".") ? 1 : 0, after: m[3] };
}

/** The word that gets the accent colour: one with a number or ₹, else the last word. */
function emphasisIndex(words: string[]) {
  const i = words.findIndex((w) => /\d|₹/.test(w));
  return i >= 0 ? i : words.length > 2 ? words.length - 1 : -1;
}

export const Reel: React.FC<ReelProps> = (props) => {
  const { brand, scenes, end, music } = props;
  const total = totalFrames(props);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: brand.primary }}>
      {scenes.map((scene, i) => {
        const start = from;
        from += scene.frames;
        return (
          <Sequence key={i} from={start} durationInFrames={scene.frames} name={`Scene ${i + 1}`}>
            <Scene scene={scene} brand={brand} index={i} total={scenes.length} />
            {scene.audio && <Audio src={scene.audio} />}
          </Sequence>
        );
      })}
      <Sequence from={from} durationInFrames={end.frames} name="End card">
        <EndCard brand={brand} end={end} />
      </Sequence>
      {music && <Audio src={music} volume={(f) => interpolate(f, [0, 20, total - 30, total], [0, 0.12, 0.12, 0], clamp)} />}
    </AbsoluteFill>
  );
};

/* ---------------------------------- scenes ---------------------------------- */

function Scene({ scene, brand, index, total }: { scene: ReelScene; brand: Brand; index: number; total: number }) {
  const frame = useCurrentFrame();
  const theme = scene.background ? "photo" : index % 3 === 1 ? "light" : "dark";
  const fg = theme === "light" ? brand.primary : brand.bg;
  const stat = statOf(scene.text);
  const progress = interpolate(frame, [0, scene.frames], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Background theme={theme} scene={scene} brand={brand} index={index} />

      {/* story-style progress */}
      <div style={{ position: "absolute", top: 64, left: 56, right: 56, display: "flex", gap: 10 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 7, borderRadius: 8, background: theme === "light" ? mix(brand.primary, 18) : "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: theme === "light" ? brand.primary : "#fff", width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>

      <TopLine brand={brand} fg={fg} />

      {stat ? <StatBlock stat={stat} brand={brand} fg={fg} /> : <KineticHeadline text={scene.text} brand={brand} fg={fg} />}

      {scene.voice && scene.voice.trim().toLowerCase() !== scene.text.trim().toLowerCase() && <Karaoke scene={scene} brand={brand} light={theme === "light"} />}

      {index > 0 && <Wipe brand={brand} />}
    </AbsoluteFill>
  );
}

function Background({ theme, scene, brand, index }: { theme: "photo" | "light" | "dark"; scene: ReelScene; brand: Brand; index: number }) {
  const frame = useCurrentFrame();
  const t = frame / 30;

  if (theme === "photo" && scene.background) {
    const p = interpolate(frame, [0, scene.frames], [0, 1], clamp);
    const zoom = index % 2 ? 1.16 - p * 0.12 : 1.04 + p * 0.12; // alternate push-in / pull-out
    const pan = (index % 2 ? -1 : 1) * p * 40;
    return (
      <AbsoluteFill>
        <Img src={scene.background} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}px)` }} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${mix(brand.primary, 75)} 0%, ${mix(brand.primary, 20)} 30%, ${mix(brand.primary, 35)} 55%, ${mix(brand.primary, 92)} 100%)` }} />
      </AbsoluteFill>
    );
  }

  const light = theme === "light";
  const base = light ? brand.bg : brand.primary;
  const blob = (x: number, y: number, size: number, color: string) => (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle, ${color}, transparent 65%)` }} />
  );
  return (
    <AbsoluteFill style={{ background: light ? base : `linear-gradient(170deg, ${base}, ${shade(base, 35)})`, overflow: "hidden" }}>
      {blob(540 + Math.sin(t * 0.9 + index) * 260, 1450 + Math.cos(t * 0.7) * 120, 1300, mix(brand.accent, light ? 28 : 50))}
      {blob(200 + Math.cos(t * 0.6 + index) * 160, 380 + Math.sin(t * 0.8) * 120, 900, light ? mix(brand.primary, 10) : mix(brand.bg, 9))}
      {blob(950 + Math.sin(t * 0.5) * 120, 900 + Math.cos(t * 0.9 + index) * 200, 700, mix(brand.accent, light ? 14 : 22))}
      <svg
        viewBox="0 0 100 100"
        style={{ position: "absolute", right: -260, top: 360, width: 900, transform: `rotate(${frame * 0.35}deg)`, opacity: light ? 0.18 : 0.28 }}
        fill="none"
        stroke={light ? brand.primary : brand.accent}
        strokeWidth="0.25"
      >
        {[18, 26, 34, 42, 49].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} strokeDasharray={r % 2 ? "1 2" : undefined} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: `repeating-linear-gradient(90deg, ${light ? mix(brand.primary, 4) : mix(brand.bg, 4)} 0 2px, transparent 2px 120px)` }} />
    </AbsoluteFill>
  );
}

function TopLine({ brand, fg }: { brand: Brand; fg: string }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [4, 16], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", top: 120, left: 80, right: 80, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: o }}>
      <span style={{ fontFamily: font(brand.fontBody), fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", textTransform: "uppercase", color: fg }}>{brand.name}</span>
      <span style={{ fontFamily: font(brand.fontBody), fontWeight: 600, fontSize: 28, letterSpacing: "0.16em", textTransform: "uppercase", color: brand.accent, border: `3px solid ${brand.accent}`, borderRadius: 999, padding: "8px 22px" }}>
        {brand.kicker}
      </span>
    </div>
  );
}

/** Words spring up one after another; the key word is set in the accent colour with a growing underline. */
function KineticHeadline({ text, brand, fg }: { text: string; brand: Brand; fg: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/).filter(Boolean);
  const em = emphasisIndex(words);
  const size = headlineSize(text);
  const serif = isSerif(brand.fontHead);
  return (
    <div style={{ position: "absolute", top: 560, left: 80, right: 80, display: "flex", flexWrap: "wrap", columnGap: size * 0.26, rowGap: size * 0.06 }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - 8 - i * 4, fps, config: { damping: 14, stiffness: 140, mass: 0.7 } });
        const line = spring({ frame: frame - 8 - words.length * 4 - 4, fps, config: { damping: 200 } });
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: font(brand.fontHead),
              fontWeight: serif ? 700 : 800,
              fontSize: size,
              lineHeight: 1.04,
              letterSpacing: serif ? "-0.01em" : "-0.035em",
              color: i === em ? brand.accent : fg,
              opacity: s,
              transform: `translateY(${(1 - s) * 90}px) rotate(${(1 - s) * 6}deg)`,
            }}
          >
            {w}
            {i === em && <span style={{ position: "absolute", left: 0, bottom: -size * 0.08, height: size * 0.08, width: `${line * 100}%`, background: brand.accent, borderRadius: 99 }} />}
          </span>
        );
      })}
    </div>
  );
}

/** A number scene: the figure counts up inside a badge that pops in. */
function StatBlock({ stat, brand, fg }: { stat: NonNullable<ReturnType<typeof statOf>>; brand: Brand; fg: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 11, stiffness: 120 } });
  const n = interpolate(frame, [6, 34], [0, stat.value], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shown = stat.decimals ? n.toFixed(1) : Math.round(n).toString();
  const after = stat.after.trim();
  const unit = after.match(/^(Lakh|lakh|crore|Cr|L|%|min|km|\+)(?=[\s*]|$)/)?.[0] ?? "";
  // Only the figure sits in the badge; any words around it become the line underneath
  const currency = stat.before.trim().endsWith("₹") ? "₹" : "";
  const lead = stat.before.trim().replace(/₹$/, "");
  const caption = [lead, after.slice(unit.length)].join(" ").replace(/\s+/g, " ").replace(/^[\s·•|,–-]+|[\s·•|,–-]+$/g, "").trim();
  const textIn = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", top: 420, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div
        style={{
          width: 660,
          height: 660,
          borderRadius: "50%",
          background: brand.accent,
          color: brand.primary,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${pop}) rotate(${(1 - pop) * -25 - 5}deg)`,
          boxShadow: `0 0 0 26px ${mix(brand.accent, 28)}`,
        }}
      >
        <div style={{ fontFamily: font(brand.fontHead), fontWeight: 800, fontSize: 210, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {currency}
          {shown}
          {unit && <span style={{ fontSize: 120 }}>{unit === "%" ? "%" : ` ${unit}`}</span>}
        </div>
      </div>
      {caption && (
        <div style={{ marginTop: 90, maxWidth: 900, fontFamily: font(brand.fontHead), fontWeight: 700, fontSize: 84, lineHeight: 1.1, color: fg, opacity: textIn, transform: `translateY(${(1 - textIn) * 40}px)` }}>
          {caption}
        </div>
      )}
    </div>
  );
}

/** The voice line as a subtitle; words light up in time with the voiceover. */
function Karaoke({ scene, brand, light }: { scene: ReelScene; brand: Brand; light: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (scene.voice ?? "").split(/\s+/).filter(Boolean);
  const spoken = scene.audio ? scene.frames - Math.round(0.35 * fps) : scene.frames - 6;
  const at = Math.min(words.length - 1, Math.floor((frame / Math.max(1, spoken)) * words.length));
  const o = interpolate(frame, [2, 10], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, bottom: 380, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          maxWidth: 940,
          textAlign: "center",
          background: light ? brand.primary : "rgba(0,0,0,0.42)",
          borderRadius: 28,
          padding: "22px 30px",
          fontFamily: font(brand.fontBody),
          fontWeight: 700,
          fontSize: 50,
          lineHeight: 1.45,
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{ color: i === at ? brand.accent : i < at ? "#fff" : "rgba(255,255,255,0.55)" }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Scene change: an accent panel and a brand panel sweep up and off the screen. */
function Wipe({ brand }: { brand: Brand }) {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 13], [0, -105], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const b = interpolate(frame, [0, 9], [0, -105], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (frame > 14) return null;
  return (
    <>
      <AbsoluteFill style={{ background: brand.accent, transform: `translateY(${a}%)` }} />
      <AbsoluteFill style={{ background: brand.primary, transform: `translateY(${b}%)` }} />
    </>
  );
}

/* --------------------------------- end card --------------------------------- */

function EndCard({ brand, end }: { brand: Brand; end: ReelProps["end"] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 12 } });
  const spacing = interpolate(frame, [0, 24], [0.7, 0.3], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cta = spring({ frame: frame - 16, fps, config: { damping: 14 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.025 * cta;
  return (
    <AbsoluteFill style={{ background: shade(brand.primary, 25), alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${frame * 0.6}deg at 50% 46%, ${mix(brand.accent, 13)} 0deg 6deg, transparent 6deg 15deg)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(760px 760px at 50% 46%, ${mix(brand.accent, 40)}, transparent 70%)` }} />
      <div style={{ fontFamily: font(brand.fontBody), fontWeight: 700, fontSize: 34, letterSpacing: `${spacing}em`, textTransform: "uppercase", color: brand.accent, opacity: interpolate(frame, [0, 12], [0, 1], clamp) }}>
        {brand.kicker}
      </div>
      <div style={{ marginTop: 40, padding: "0 80px", fontFamily: font(brand.fontHead), fontWeight: 700, fontSize: 124, lineHeight: 1.02, color: brand.bg, transform: `scale(${0.85 + pop * 0.15})`, opacity: pop }}>
        {end.title}
      </div>
      {end.cta && (
        <div
          style={{
            marginTop: 80,
            fontFamily: font(brand.fontBody),
            fontWeight: 800,
            fontSize: 50,
            color: brand.primary,
            background: brand.accent,
            borderRadius: 999,
            padding: "30px 60px",
            opacity: cta,
            transform: `translateY(${(1 - cta) * 50}px) scale(${pulse})`,
            boxShadow: `0 0 0 ${14 + Math.sin(frame / 5) * 8}px ${mix(brand.accent, 25)}`,
          }}
        >
          {end.cta} →
        </div>
      )}
      {end.footnote && <div style={{ position: "absolute", bottom: 130, fontFamily: font(brand.fontBody), fontSize: 32, color: mix(brand.bg, 65) }}>{end.footnote}</div>}
    </AbsoluteFill>
  );
}
