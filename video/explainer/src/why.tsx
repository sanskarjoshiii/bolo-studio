// §6 Why it works · 18 s · rendered with a transparent background (no canvas colour).
//  0– 7  "It runs with one command, and sixty-seven tests pass."
//  7–18  "Switch holds it all together. What took an agency a day now takes one sentence and one tap."
import { AbsoluteFill, interpolate } from "remotion";
import { C, Caption, Edge, FONT, Node, Packet, Title, W, Wave, useIn, useT } from "./kit";

const CMD: [number, number] = [230, 370];
const STUDIO: [number, number] = [672, 370];
const TESTS: [number, number] = [1114, 370];
const IDEA: [number, number] = [230, 700];
const SWITCH: [number, number] = [672, 700];
const CLIENT: [number, number] = [1114, 700];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function Prompt() {
  return <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 19, color: C.ink, letterSpacing: "-0.04em" }}>&gt;_</div>;
}

function Check({ color }: { color: string }) {
  return <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 26, color, lineHeight: 1 }}>✓</div>;
}

/** "≈ 1 day" gets struck through, then "one sentence + one tap" replaces it. */
function Verdict() {
  const t = useT();
  const day = useIn(10.2);
  const strike = interpolate(t, [11.6, 12.1], [0, 1], clamp);
  const dayOut = interpolate(t, [12.3, 12.7], [1, 0.35], clamp);
  const now = useIn(12.4, true);
  return (
    <div style={{ position: "absolute", top: 820, left: 0, width: W, display: "flex", justifyContent: "center", alignItems: "center", gap: 34 }}>
      <div style={{ position: "relative", opacity: day * dayOut, transform: `translateY(${(1 - day) * 10}px)` }}>
        <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 44, color: C.red, letterSpacing: "-0.02em" }}>≈ 1 day</span>
        <div style={{ position: "absolute", left: -6, top: "54%", height: 4, width: `calc(${strike * 100}% + 12px)`, background: C.red, borderRadius: 2 }} />
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: 40, color: C.faint, opacity: now }}>→</div>
      <div style={{ opacity: now, transform: `scale(${0.92 + now * 0.08})` }}>
        <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 44, color: C.green, letterSpacing: "-0.02em" }}>1 sentence + 1 tap</span>
      </div>
    </div>
  );
}

export function Why() {
  const t = useT();
  const passed = Math.round(interpolate(t, [3.6, 5.8], [0, 67], { ...clamp, easing: (x) => 1 - (1 - x) ** 2 }));
  const allGreen = t >= 5.8;
  return (
    <AbsoluteFill>
      <Title title="Why it works" sub="one command · one room · one tap" at={0} />

      {/* ── 0–7 s · one command, 67 tests ─────────────────────────────────────── */}
      <Node x={CMD[0]} y={CMD[1]} at={0.4} kind="One command" name="npm run demo" inner={<Prompt />} />
      <Edge points={[CMD, STUDIO]} at={1.2} dur={0.7} label="starts" />
      <Node x={STUDIO[0]} y={STUDIO[1]} at={1.8} kind="Web app" name="Bolo Studio" color={C.blue} pulses={[2.0, 15.0]} />
      <Edge points={[STUDIO, TESTS]} at={2.8} dur={0.7} label="checked by" />
      <Node
        x={TESTS[0]}
        y={TESTS[1]}
        at={3.3}
        kind="Automated tests"
        name={`${passed} / 67 passing`}
        color={allGreen ? C.green : C.ink}
        pulses={[5.8]}
        inner={allGreen ? <Check color={C.green} /> : undefined}
      />

      {/* ── 7–18 s · Switch holds it together; a day → one sentence + one tap ──── */}
      <Node x={SWITCH[0]} y={SWITCH[1]} at={7.2} kind="Switch" name="the team room" color={C.violet} size={76} pulses={[7.5, 13.3, 14.4]} />
      <Edge points={[SWITCH, STUDIO]} at={7.8} dur={0.7} label="agents" color={C.violet} gap={[96, 92]} />
      <Node
        x={IDEA[0]}
        y={IDEA[1]}
        at={8.4}
        kind="Wispr Flow"
        name="you speak"
        color={C.pink}
        size={66}
        inner={<Wave color={C.pink} active={t > 8.4 && t < 13.4} />}
      />
      <Edge points={[IDEA, SWITCH]} at={8.8} dur={0.6} label="1 sentence" color={C.pink} />
      <Node x={CLIENT[0]} y={CLIENT[1]} at={9.2} kind="Client · Telegram" name="approves" color={C.telegram} pulses={[13.6]} />
      <Edge points={[CLIENT, SWITCH]} at={9.6} dur={0.6} label="1 tap" color={C.telegram} />

      <Packet points={[IDEA, SWITCH]} from={12.6} to={13.3} color={C.pink} />
      <Packet points={[CLIENT, SWITCH]} from={13.7} to={14.4} color={C.green} label="approve" />
      <Packet points={[SWITCH, STUDIO]} from={14.4} to={15.0} color={C.violet} />

      <Verdict />

      <Caption
        items={[
          { from: 0.3, to: 2.8, text: "one command starts Bolo Studio" },
          { from: 2.8, to: 7, text: "67 automated tests — all green" },
          { from: 7, to: 10.1, text: "Switch holds it all together" },
          { from: 10.1, to: 18, text: "a day of work → one sentence and one tap" },
        ]}
      />
    </AbsoluteFill>
  );
}
