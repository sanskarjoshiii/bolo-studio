// §4 How it works: Switch at the centre, on AWS · 35 s — one diagram that keeps building.
//  0– 8  "In Switch, each client gets two rooms: a work room for us and our AI agents, and an
//         approvals room linked to their Telegram."
//  8–17  "bolo-writer and bolo-designer are Claude Code agents in Switch that write and design from
//         the client's Brand Kit. bolo-publisher is our own Switch agent."
// 17–23  "It sends each post to the client's Telegram, and their approve comes back through Switch."
// 23–27  "With Wispr Flow, we just speak our ideas."
// 27–35  "It runs on AWS: one EC2 server in Mumbai with Docker and HTTPS, and MongoDB Atlas for the data."
import { AbsoluteFill } from "remotion";
import { Box, C, Caption, Edge, Node, Packet, Title, Wave, useT } from "./kit";

// Layout (1344 × 1080)
const WISPR: [number, number] = [230, 190];
const TG: [number, number] = [1150, 190];
const WRITER: [number, number] = [230, 490];
const DESIGNER: [number, number] = [450, 490];
const PUBLISHER: [number, number] = [680, 490];
const BRIDGE: [number, number] = [1150, 490];
const KIT: [number, number] = [230, 830];
const ATLAS: [number, number] = [495, 830];
const STUDIO: [number, number] = [775, 830];
const IG: [number, number] = [1085, 735];
const FB: [number, number] = [1085, 830];
const LI: [number, number] = [1085, 925];

export function SwitchScene() {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Title title="How it works" sub="Switch at the centre" at={0} />

      {/* ── 0–8 s · Switch: two rooms per client ─────────────────────────────── */}
      <Box x={40} y={300} w={1264} h={335} at={0.4} dur={1.1} label="Switch" color={C.violet} labelSize={19} tint={0.02} />
      <Box x={70} y={342} w={720} h={265} at={1.6} label="#client-work · team + agents" color={C.blue} radius={16} tint={0.03} labelAlign="right" />
      <Box x={826} y={342} w={448} h={265} at={3.1} label="approvals · Telegram" color={C.telegram} radius={16} tint={0.03} />
      <Node x={BRIDGE[0]} y={BRIDGE[1]} at={4.0} kind="Telegram bridge" name="approvals room" color={C.telegram} nameSize={23} />
      <Edge points={[BRIDGE, TG]} at={4.9} dur={0.8} label="linked" labelAt={0.16} color={C.telegram} />
      <Node x={TG[0]} y={TG[1]} at={5.5} kind="Client's Telegram" name="group" color={C.telegram} pulses={[19.7]} />

      {/* ── 8–17 s · the agents in the work room ──────────────────────────────── */}
      <Node x={WRITER[0]} y={WRITER[1]} at={8.4} kind="Claude Code agent" name="bolo-writer" pulses={[24.9]} />
      <Node x={DESIGNER[0]} y={DESIGNER[1]} at={9.3} kind="Claude Code agent" name="bolo-designer" />
      <Node x={KIT[0]} y={KIT[1]} at={11.4} kind="Brand Kit" name="tone · rules · colours" color={C.violet} nameSize={22} />
      <Edge points={[WRITER, KIT]} at={11.8} dur={0.7} label="reads" labelAt={0.4} color={C.violet} />
      <Edge points={[DESIGNER, KIT]} at={12.2} dur={0.7} label="reads" labelAt={0.4} color={C.violet} />
      <Node x={PUBLISHER[0]} y={PUBLISHER[1]} at={14.0} kind="Our Switch agent" name="bolo-publisher" color={C.violet} pulses={[14.2, 22.3]} />
      <Node x={STUDIO[0]} y={STUDIO[1]} at={15.2} kind="Web app" name="Bolo Studio" color={C.ink} />
      <Edge points={[PUBLISHER, STUDIO]} at={15.4} dur={0.8} label="bolo API" labelAt={0.5} />

      {/* ── 17–23 s · the post goes to Telegram, "approve" comes back ─────────── */}
      <Edge points={[PUBLISHER, BRIDGE]} at={17.2} dur={0.8} label="sends" labelAt={0.42} color={C.telegram} />
      <Packet points={[PUBLISHER, BRIDGE, TG]} from={17.9} to={19.7} color={C.telegram} label="post + image" />
      <Packet points={[TG, BRIDGE, PUBLISHER]} from={20.2} to={22.3} color={C.green} label="approve #p1a2b" />

      {/* ── 23–27 s · Wispr Flow: ideas are spoken ─────────────────────────────── */}
      <Node
        x={WISPR[0]}
        y={WISPR[1]}
        at={23.2}
        kind="Wispr Flow"
        name="you speak"
        color={C.pink}
        size={66}
        inner={<Wave color={C.pink} active={t > 23.2 && t < 27.2} />}
      />
      <Edge points={[WISPR, WRITER]} at={23.7} dur={0.8} label="the idea" labelAt={0.8} color={C.pink} />
      <Packet points={[WISPR, WRITER]} from={24.2} to={24.9} color={C.pink} />

      {/* ── 27–35 s · AWS: EC2 Mumbai, Docker, HTTPS, MongoDB Atlas ────────────── */}
      <Box x={40} y={690} w={900} h={268} at={27.3} dur={1.1} label="AWS · EC2 Mumbai · Docker · HTTPS" color={C.orange} tint={0.035} labelSize={18} />
      <Node x={ATLAS[0]} y={ATLAS[1]} at={30.2} kind="Database" name="MongoDB Atlas" color={C.green} />
      <Edge points={[STUDIO, ATLAS]} at={30.6} dur={0.6} label="data" color={C.green} />
      <Node x={IG[0]} y={IG[1]} at={32.0} kind="" name="Instagram" layout="side" size={34} nameSize={22} />
      <Node x={FB[0]} y={FB[1]} at={32.3} kind="" name="Facebook" layout="side" size={34} nameSize={22} />
      <Node x={LI[0]} y={LI[1]} at={32.6} kind="" name="LinkedIn" layout="side" size={34} nameSize={22} />
      <Edge points={[STUDIO, IG]} at={31.7} dur={0.5} gap={[44, 26]} />
      <Edge points={[STUDIO, FB]} at={32.0} dur={0.5} gap={[44, 26]} label="publishes" labelAt={0.45} />
      <Edge points={[STUDIO, LI]} at={32.3} dur={0.5} gap={[44, 26]} />

      <Caption
        items={[
          { from: 0.4, to: 4.6, text: "each client → two rooms in Switch" },
          { from: 4.6, to: 8, text: "the approvals room is linked to the client's Telegram" },
          { from: 8, to: 11.3, text: "bolo-writer · bolo-designer — Claude Code agents" },
          { from: 11.3, to: 13.9, text: "they work from the client's Brand Kit" },
          { from: 13.9, to: 17, text: "bolo-publisher — our own Switch agent" },
          { from: 17, to: 20.1, text: "each post goes to the client's Telegram" },
          { from: 20.1, to: 23, text: "“approve” comes back through Switch" },
          { from: 23, to: 27, text: "ideas are spoken with Wispr Flow" },
          { from: 27, to: 30.2, text: "live on AWS · EC2 Mumbai · Docker · HTTPS" },
          { from: 30.2, to: 35, text: "data in MongoDB Atlas" },
        ]}
      />
    </AbsoluteFill>
  );
}
