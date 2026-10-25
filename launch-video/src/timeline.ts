import { FPS } from "./config";

/** Seconds → frames. */
export const s = (sec: number) => Math.round(sec * FPS);

// Music: 115 BPM, one bar = 2.09 s. The drop lands at 14.0 s; a quieter stretch runs ~46–55 s; the
// final section starts ~56 s and the track ends on a button at ~79.3 s.
export const DROP = 14.0;
export const END = 79.3;

export const T = {
  intro: { from: 0, to: DROP + 2.2 },          //  0–16.2  icon, grid, Introducing, headline, slam
  prompt: { from: DROP + 2.2, to: 27.5 },       // 16.2–27.5 "Just say it" — typing, Decision-1 pills, results
  combo: { from: 27.5, to: 39.5 },              // 27.5–39.5 "AI that does the math" — BOGO combo, big backs
  menu: { from: 39.5, to: 52.0 },               // 39.5–52   "AI that reads the menu" — nutrition sheet, lens
  gta: { from: 52.0, to: 64.0 },                // 52–64     "AI that knows the GTA" — map, range, top dishes
  outro: { from: 64.0, to: END },               // 64–79.3   claim, big backs, end card
} as const;

/** Voice lines (public/audio/vo-N.wav) and where they start. Scene beats are placed around their real lengths. */
export const VO = [
  { file: "audio/vo-1.wav", at: T.prompt.from + 0.4, dur: 2.76 },
  { file: "audio/vo-2.wav", at: T.combo.from + 2.0, dur: 5.64 },
  { file: "audio/vo-3.wav", at: T.menu.from + 2.0, dur: 5.88 },
  { file: "audio/vo-4.wav", at: T.gta.from + 1.8, dur: 4.64 },
  { file: "audio/vo-5.wav", at: T.outro.from + 3.6, dur: 3.96 },
] as const;

export const DURATION = s(END);
