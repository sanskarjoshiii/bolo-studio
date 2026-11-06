export type ReelScene = {
  /** Big on-screen line. */
  text: string;
  /** Voiceover line, shown as the subtitle. */
  voice?: string;
  /** URL of this scene's voice clip (served locally during the render). */
  audio?: string;
  /** Background photo URL (client's real media); brand colour when absent. */
  background?: string;
  frames: number;
};

export type ReelProps = {
  brand: {
    name: string;
    kicker: string;
    primary: string;
    accent: string;
    bg: string;
    text: string;
    fontHead: string;
    fontBody: string;
  };
  scenes: ReelScene[];
  end: { title: string; cta: string; footnote: string; frames: number };
  /** Background music URL (brand-kits/<client>/music.mp3), mixed quietly under the voice. */
  music?: string;
  /** Output size; the template scales to it. Default 1080 × 1920. */
  size?: { w: number; h: number };
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const totalFrames = (p: ReelProps) => p.scenes.reduce((n, s) => n + s.frames, 0) + p.end.frames;
