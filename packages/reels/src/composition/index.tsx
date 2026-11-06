import { Composition, registerRoot } from "remotion";
import { Reel } from "./Reel";
import { FPS, HEIGHT, totalFrames, WIDTH, type ReelProps } from "./types";

const sample: ReelProps = {
  brand: {
    name: "Pushpam Infra",
    kicker: "Luxe 28",
    primary: "#1F3A5F",
    accent: "#C9A227",
    bg: "#F7F5F0",
    text: "#1A1A1A",
    fontHead: "Playfair Display",
    fontBody: "Inter",
  },
  scenes: [
    { text: "Is Diwali ghari ka?", voice: "Is Diwali, tumchya navin gharat.", frames: 75 },
    { text: "2 & 3 BHK in Baner", voice: "Luxe 28 — 2 and 3 BHK homes in Baner.", frames: 75 },
  ],
  end: { title: "Pushpam Infra", cta: "Book a site visit", footnote: "RERA P52100012345", frames: 90 },
};

function Root() {
  return (
    <Composition
      id="Reel"
      component={Reel}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={totalFrames(sample)}
      defaultProps={sample}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props),
        // H.264 needs even dimensions
        width: props.size ? Math.round(props.size.w / 2) * 2 : WIDTH,
        height: props.size ? Math.round(props.size.h / 2) * 2 : HEIGHT,
      })}
    />
  );
}

registerRoot(Root);
