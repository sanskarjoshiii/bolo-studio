// §2 The problem · 17 s
// Voice: "A small social media agency in India writes every post twice — in English, and in
// Marathi or Hindi — designs it, chases the client for approval on WhatsApp, and then posts it on
// four different apps. One post can take a whole day, and most of it is copying and chasing."
import { AbsoluteFill, interpolate } from "remotion";
import { C, Caption, Edge, FONT, Node, Packet, Title, W, useIn, useT } from "./kit";

const IDEA: [number, number] = [170, 330];
const EN: [number, number] = [470, 330];
const MR: [number, number] = [780, 330];
const DESIGN: [number, number] = [1110, 330];
const WA: [number, number] = [1110, 610];
const IG: [number, number] = [1110, 860];
const FB: [number, number] = [830, 860];
const LI: [number, number] = [550, 860];
const YT: [number, number] = [270, 860];

function Clock() {
  const t = useT();
  const p = useIn(0.8);
  // 09:00 → 19:30 over the scene: a working day passing
  const minutes = interpolate(t, [0.8, 14.2], [9 * 60, 19 * 60 + 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const label = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const late = t > 14.2;
  return (
    <div style={{ position: "absolute", right: 56, top: 52, textAlign: "right", opacity: p }}>
      <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 14, letterSpacing: "0.16em", color: C.sub }}>TIME</div>
      <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: 34, color: late ? C.red : C.ink }}>{label}</div>
    </div>
  );
}

function Verdict() {
  const p = useIn(14.2, true);
  return (
    <div style={{ position: "absolute", left: 120, top: 520, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 66, color: C.red, letterSpacing: "-0.02em" }}>≈ 1 day</div>
      <div style={{ fontFamily: FONT.sans, fontSize: 27, color: C.sub, marginTop: 2 }}>for one post — mostly copying and chasing</div>
    </div>
  );
}

export function Problem() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Title title="One post, the old way" sub="a typical day at a small agency" at={0} />
      <Clock />

      {/* written twice */}
      <Node x={IDEA[0]} y={IDEA[1]} at={0.8} kind="Idea" name="Diwali offer" color={C.blue} />
      <Edge points={[IDEA, EN]} at={1.3} label="types it" />
      <Node x={EN[0]} y={EN[1]} at={1.9} kind="Caption" name="English" />
      <Edge points={[EN, MR]} at={3.3} label="rewrites" />
      <Node x={MR[0]} y={MR[1]} at={3.9} kind="Caption again" name="मराठी · हिंदी" pulses={[9.2, 10.9]} />

      {/* designed by hand */}
      <Edge points={[MR, DESIGN]} at={5.6} label="designs" />
      <Node x={DESIGN[0]} y={DESIGN[1]} at={6.2} kind="Design" name="by hand" />

      {/* chased on WhatsApp — and sent back, again and again */}
      <Edge points={[DESIGN, WA]} at={7.9} label="sends" />
      <Node x={WA[0]} y={WA[1]} at={8.4} kind="Approval" name="WhatsApp" color={C.red} pulses={[8.6, 10.1]} />
      <Edge points={[WA, MR]} at={9.0} dur={0.6} color={C.red} dashed label="changes…" labelAt={0.55} />
      <Packet points={[WA, MR]} from={9.0} to={9.8} color={C.red} label="change the price" />
      <Packet points={[MR, DESIGN, WA]} from={9.8} to={10.6} color={C.sub} label="sent again" />
      <Packet points={[WA, MR]} from={10.6} to={11.4} color={C.red} label="where's the Marathi one?" />

      {/* posted four times, by hand */}
      <Edge points={[WA, IG]} at={11.5} dur={0.5} label="posts" />
      <Node x={IG[0]} y={IG[1]} at={11.8} kind="Post" name="Instagram" />
      <Edge points={[IG, FB]} at={12.1} dur={0.45} label="copy-paste" />
      <Node x={FB[0]} y={FB[1]} at={12.4} kind="Post" name="Facebook" />
      <Edge points={[FB, LI]} at={12.7} dur={0.45} label="copy-paste" />
      <Node x={LI[0]} y={LI[1]} at={13.0} kind="Post" name="LinkedIn" />
      <Edge points={[LI, YT]} at={13.3} dur={0.45} label="copy-paste" />
      <Node x={YT[0]} y={YT[1]} at={13.6} kind="Post" name="YouTube" />

      <Verdict />

      <Caption
        items={[
          { from: 0.6, to: 3.2, text: "every post is written twice" },
          { from: 3.2, to: 5.6, text: "English — then Marathi or Hindi" },
          { from: 5.6, to: 7.9, text: "designed by hand" },
          { from: 7.9, to: 11.5, text: "approval chased on WhatsApp" },
          { from: 11.5, to: 14.1, text: "posted on four apps, one by one" },
          { from: 14.1, to: 17, text: "one post ≈ one whole day" },
        ]}
      />
      <div style={{ position: "absolute", width: W }} />
    </AbsoluteFill>
  );
}
