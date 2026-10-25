export const FPS = 24;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BRAND = "Meal Finder";
export const URL = "gta-meal-finder.vercel.app";

export const COLORS = {
  bg: "#fbfcfe",
  grey: "#f3f3f5",
  ink: "#0a0a0a",
  muted: "#6b6b70",
  brand: "#059669",
  brandSoft: "#d1fae5",
  card: "#ffffff",
  warn: "#d97706",
};

import media from "./media-durations.json";

/** Media files with a measured length (scripts/media-durations.mjs writes the JSON). */
export type MediaFile = keyof typeof media;

export const measured = (file: MediaFile): number => {
  const seconds = media[file];
  if (!(seconds > 0)) throw new Error(`No measured duration for ${file}; run \`bun run durations\`.`);
  return seconds;
};

export interface Clip {
  src: MediaFile;
  seconds: number;
}

const clip = (src: MediaFile): Clip => ({ src, seconds: measured(src) });

/** Screen captures (1752 × 986, 24 fps) in public/rec. */
export const CLIPS = {
  prompt: clip("rec/1-prompt.mp4"),
  combo: clip("rec/2-combo.mp4"),
  sheet: clip("rec/3-sheet.mp4"),
  map: clip("rec/4-map.mp4"),
  dishes: clip("rec/5-dishes.mp4"),
} as const;
