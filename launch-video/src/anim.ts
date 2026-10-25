import { Easing, interpolate } from "remotion";

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Keyframe helper on a local frame. */
export const k = (f: number, frames: number[], values: number[], easing = easeOut) => interpolate(f, frames, values, { ...clamp, easing });

/** 0→1 over [from, to]. */
export const rise = (f: number, from: number, to: number, easing = easeOut) => k(f, [from, to], [0, 1], easing);

/** Fade-in then fade-out window. */
export const window = (f: number, from: number, to: number, fade = 6) => Math.min(rise(f, from, from + fade), 1 - rise(f, to - fade, to, easeIn));
