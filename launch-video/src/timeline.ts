import { FPS, measured, type MediaFile } from "./config";

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
  menu: { from: 38.3, to: 47.5 },      // "AI that reads the menu." — nutrition sheet, lens
  gta: { from: 47.5, to: 56.0 },       // "AI that knows the GTA." — map, range (quiet breakdown)
  outro: { from: 56.0, to: END },      // dishes, claim, big backs, end card (final section)
} as const;

/** A voice line placed `offset` seconds into its chapter; it must end before the chapter does. */
const vo = (file: MediaFile, chapter: { from: number; to: number }, offset: number) => {
  const dur = measured(file);
  const at = chapter.from + offset;
  if (at + dur > chapter.to - 0.3) throw new Error(`${file} (${dur}s) runs past its chapter (ends ${(at + dur).toFixed(2)}s, chapter ends ${chapter.to}s)`);
  return { file, at, dur };
};

/** Voice lines (public/audio/vo-N.wav); lengths come from the files, so a re-recorded line re-times itself. */
export const VO = [
  vo("audio/vo-1.wav", T.prompt, 2.0),
  vo("audio/vo-2.wav", T.combo, 2.3),
  vo("audio/vo-3.wav", T.menu, 1.2),
  vo("audio/vo-4.wav", T.gta, 1.8),
  vo("audio/vo-5.wav", T.outro, 5.2),
];

/** Outro beats (seconds into the outro) follow voice line 5: card out, grid reprise, end card. */
export const BIG_BACKS_OUT = VO[4].at - T.outro.from + VO[4].dur + 0.2;
export const GRID_OUT = BIG_BACKS_OUT + 4.8;
export const END_CARD = GRID_OUT + 0.4;
if (END_CARD + 6 > END - T.outro.from) throw new Error(`Outro beats run past the film: end card at ${END_CARD.toFixed(1)}s of ${(END - T.outro.from).toFixed(1)}s`);

export const DURATION = s(END);
