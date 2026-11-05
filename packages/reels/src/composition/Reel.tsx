import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import type { ReelProps, ReelScene } from "./types";

// Brand fonts used across the demo Brand Kits (tokens.json fontHead / fontBody)
const inter = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const playfair = loadPlayfair("normal", { weights: ["600", "700"], subsets: ["latin"] });

const FONTS: Record<string, string> = {
  Inter: inter.fontFamily,
  "Playfair Display": playfair.fontFamily,
};
const font = (name: string) => `${FONTS[name] ?? `"${name}"`}, ${inter.fontFamily}, sans-serif`;

/** Long lines step down so they always fit the 1080 px frame. */
const headlineSize = (text: string) => (text.length <= 18 ? 132 : text.length <= 34 ? 104 : text.length <= 60 ? 80 : 64);

export const Reel: React.FC<ReelProps> = ({ brand, scenes, end }) => {
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
    </AbsoluteFill>
  );
};

function Scene({ scene, brand, index, total }: { scene: ReelScene; brand: ReelProps["brand"]; index: number; total: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [scene.frames - 8, scene.frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progress = interpolate(frame, [0, scene.frames], [0, 1], { extrapolateRight: "clamp" });
  const glowX = interpolate(frame, [0, scene.frames], [30, 70]);

  return (
    <AbsoluteFill>
      {scene.background ? (
        <>
          <Img src={scene.background} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + progress * 0.08})` }} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, ${brand.primary}cc 0%, ${brand.primary}33 40%, ${brand.primary}e6 100%)` }} />
        </>
      ) : (
        <AbsoluteFill
          style={{
            background: `radial-gradient(900px 900px at ${glowX}% 78%, ${brand.accent}55, transparent 60%), linear-gradient(180deg, ${brand.primary}, ${brand.primary})`,
          }}
        />
      )}

      {/* story-style progress */}
      <div style={{ position: "absolute", top: 72, left: 64, right: 64, display: "flex", gap: 10 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 8, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: 150,
          left: 80,
          fontFamily: font(brand.fontBody),
          fontSize: 40,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: brand.accent,
        }}
      >
        {brand.kicker}
      </div>

      <div
        style={{
          position: "absolute",
          top: 300,
          left: 80,
          right: 80,
          fontFamily: font(brand.fontHead),
          fontWeight: 700,
          fontSize: headlineSize(scene.text),
          lineHeight: 1.05,
          color: brand.bg,
          textWrap: "balance",
          opacity: enter * exit,
          transform: `translateY(${(1 - enter) * 60}px)`,
        }}
      >
        {scene.text}
      </div>

      {/* subtitle = the voice line; skipped when it would just repeat the on-screen text */}
      {scene.voice && scene.voice.trim().toLowerCase() !== scene.text.trim().toLowerCase() && (
        <div style={{ position: "absolute", left: 90, right: 90, bottom: 560, textAlign: "center", opacity: exit }}>
          <span
            style={{
              fontFamily: font(brand.fontBody),
              fontWeight: 700,
              fontSize: 52,
              lineHeight: 1.55,
              color: "#fff",
              background: brand.primary,
              padding: "6px 18px",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {scene.voice}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
}

function EndCard({ brand, end }: { brand: ReelProps["brand"]; end: ReelProps["end"] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: brand.primary, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 90 }}>
      <AbsoluteFill style={{ background: `radial-gradient(800px 800px at 50% 40%, ${brand.accent}40, transparent 65%)` }} />
      <div style={{ fontFamily: font(brand.fontHead), fontWeight: 700, fontSize: 112, color: brand.bg, lineHeight: 1.05, transform: `scale(${0.9 + pop * 0.1})` }}>
        {end.title}
      </div>
      {end.cta && (
        <div
          style={{
            marginTop: 70,
            fontFamily: font(brand.fontBody),
            fontWeight: 700,
            fontSize: 50,
            color: brand.primary,
            background: brand.accent,
            borderRadius: 999,
            padding: "26px 56px",
            opacity: pop,
          }}
        >
          {end.cta}
        </div>
      )}
      {end.footnote && (
        <div style={{ position: "absolute", bottom: 120, fontFamily: font(brand.fontBody), fontSize: 34, color: `${brand.bg}aa` }}>{end.footnote}</div>
      )}
    </AbsoluteFill>
  );
}
