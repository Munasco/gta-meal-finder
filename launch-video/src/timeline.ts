import { FPS } from "./config";

/** Seconds → frames. */
export const s = (sec: number) => Math.round(sec * FPS);

// Music (public/audio/music.wav, 115 BPM, bar ≈ 2.09 s): drop at 14.5 s, steady beat to ~45 s, a quiet
// breakdown 46–52 s, the final section from ~56 s, ending on a button at 79.5 s.
export const DROP = 14.5;
export const END = 79.04;

export const T = {
  intro: { from: 0, to: 16.2 },        // icon, food grid, Introducing, kinetic headline, slam on the drop
  prompt: { from: 16.2, to: 27.5 },    // "Just say it." — typing, Decision-1 pills, results
  combo: { from: 27.5, to: 38.3 },     // "AI that does the math." — BOGO combo, big backs
  menu: { from: 38.3, to: 46.5 },      // "AI that reads the menu." — nutrition sheet, lens
  gta: { from: 46.5, to: 56.0 },       // "AI that knows the GTA." — map, range (quiet breakdown)
  outro: { from: 56.0, to: END },      // dishes, claim, big backs, end card (final section)
} as const;

/** Voice lines (public/audio/vo-N.wav). Scene beats sit around their real lengths. */
export const VO = [
  { file: "audio/vo-1.wav", at: T.prompt.from + 2.2, dur: 2.76 },
  { file: "audio/vo-2.wav", at: T.combo.from + 2.3, dur: 4.6 },
  { file: "audio/vo-3.wav", at: T.menu.from + 2.0, dur: 5.88 },
  { file: "audio/vo-4.wav", at: T.gta.from + 2.0, dur: 4.64 },
  { file: "audio/vo-5.wav", at: T.outro.from + 5.2, dur: 3.72 },
] as const;

export const DURATION = s(END);
