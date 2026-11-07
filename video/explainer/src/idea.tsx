// §3 The idea · 13 s
// Voice: "Bolo means speak. With Bolo Studio you speak an idea once. A team of AI agents writes it
// in your languages, designs it in your brand, checks your rules, gets the client's approval on
// Telegram, and publishes it."
import { AbsoluteFill, interpolate } from "remotion";
import { Box, C, Caption, Edge, FONT, Node, Packet, Title, W, Wave, useIn, useT } from "./kit";

const VOICE: [number, number] = [160, 420];
const WRITE: [number, number] = [440, 420];
const DESIGN: [number, number] = [760, 420];
const CHECK: [number, number] = [1090, 420];
const APPROVE: [number, number] = [1090, 730];
const PUBLISH: [number, number] = [760, 730];

/** "बोलो = speak" — big in the middle, then makes room for the diagram. */
function Intro() {
  const t = useT();
  const p = useIn(0.15);
  const out = interpolate(t, [2.2, 2.7], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (t > 2.8) return null;
  return (
    <div style={{ position: "absolute", top: 330, left: 0, width: W, textAlign: "center", opacity: p * out, transform: `translateY(${(1 - out) * -30}px)` }}>
      <div style={{ fontFamily: FONT.deva, fontWeight: 700, fontSize: 150, color: C.ink, lineHeight: 1.1 }}>बोलो</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 38, color: C.sub, marginTop: 10 }}>
        bolo <span style={{ color: C.faint }}>=</span> <span style={{ color: C.pink, fontWeight: 600 }}>speak</span>
      </div>
    </div>
  );
}

export function Idea() {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Intro />
      <Title title="Speak once. Ship everywhere." sub="Bolo means speak" at={2.6} />

      {/* the one spoken idea */}
      <Node
        x={VOICE[0]}
        y={VOICE[1]}
        at={2.8}
        kind="You say it once"
        name="“Diwali offer…”"
        color={C.pink}
        size={72}
        inner={<Wave color={C.pink} active={t > 2.8 && t < 4.4} />}
      />

      {/* the agents' work, one step after another */}
      <Box x={300} y={300} w={950} h={560} at={3.9} label="A team of AI agents" color={C.violet} />
      <Edge points={[VOICE, WRITE]} at={4.0} dur={0.5} />
      <Node x={WRITE[0]} y={WRITE[1]} at={4.4} kind="Writes" name="EN · मराठी · हिंदी" pulses={[4.6]} />
      <Edge points={[WRITE, DESIGN]} at={6.0} dur={0.5} />
      <Node x={DESIGN[0]} y={DESIGN[1]} at={6.4} kind="Designs" name="in your brand" color={C.blue} pulses={[6.6]} />
      <Edge points={[DESIGN, CHECK]} at={7.3} dur={0.5} />
      <Node x={CHECK[0]} y={CHECK[1]} at={7.7} kind="Checks" name="your rules ✓" color={C.green} pulses={[7.9]} />
      <Edge points={[CHECK, APPROVE]} at={8.5} dur={0.5} />
      <Node x={APPROVE[0]} y={APPROVE[1]} at={8.9} kind="Client approves" name="on Telegram" color={C.telegram} pulses={[9.1]} />
      <Edge points={[APPROVE, PUBLISH]} at={10.1} dur={0.5} />
      <Node x={PUBLISH[0]} y={PUBLISH[1]} at={10.5} kind="Publishes" name="IG · FB · LinkedIn" color={C.ink} pulses={[10.7, 11.6]} />

      {/* the idea travelling through */}
      <Packet points={[VOICE, WRITE]} from={4.0} to={4.5} color={C.pink} />
      <Packet points={[WRITE, DESIGN]} from={6.0} to={6.5} color={C.pink} />
      <Packet points={[DESIGN, CHECK]} from={7.3} to={7.8} color={C.pink} />
      <Packet points={[CHECK, APPROVE]} from={8.5} to={9.0} color={C.pink} />
      <Packet points={[APPROVE, PUBLISH]} from={10.1} to={10.6} color={C.pink} />

      <Done />

      <Caption
        items={[
          { from: 0.3, to: 2.4, text: "bolo = speak" },
          { from: 2.6, to: 4.2, text: "you say the idea once" },
          { from: 4.2, to: 6.2, text: "AI agents write it — in your languages" },
          { from: 6.2, to: 7.5, text: "design it in your brand" },
          { from: 7.5, to: 8.7, text: "check your rules" },
          { from: 8.7, to: 10.3, text: "the client approves on Telegram" },
          { from: 10.3, to: 11.3, text: "and it's published" },
          { from: 11.3, to: 13, text: "one sentence → one published post" },
        ]}
      />
    </AbsoluteFill>
  );
}

/** The ending: the same post that took a day. */
function Done() {
  const p = useIn(11.4, true);
  return (
    <div style={{ position: "absolute", left: 360, top: 560, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 34, color: C.green }}>✓ live</div>
      <div style={{ fontFamily: FONT.sans, fontSize: 22, color: C.sub }}>no copy-paste, no chasing</div>
    </div>
  );
}
