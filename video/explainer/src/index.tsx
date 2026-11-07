import { Composition, registerRoot } from "remotion";
import { FPS, H, W } from "./kit";
import { Problem } from "./problem";
import { Idea } from "./idea";
import { SwitchScene } from "./switch";
import { Why } from "./why";

// The three explainer clips of the demo video (docs/video-script.md §2–§4), 1344 × 1080 —
// 70 % of a 1920 × 1080 frame, the presenter takes the rest.
function Root() {
  return (
    <>
      <Composition id="s2-problem" component={Problem} width={W} height={H} fps={FPS} durationInFrames={17 * FPS} />
      <Composition id="s3-idea" component={Idea} width={W} height={H} fps={FPS} durationInFrames={13 * FPS} />
      <Composition id="s4-switch" component={SwitchScene} width={W} height={H} fps={FPS} durationInFrames={35 * FPS} />
      <Composition id="s6-why" component={Why} width={W} height={H} fps={FPS} durationInFrames={18 * FPS} />
    </>
  );
}

registerRoot(Root);
