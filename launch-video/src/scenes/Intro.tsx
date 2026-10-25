import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeInOut, easeOut, k, rise } from "../anim";
import { Tile } from "../components/Tile";
import { Headline } from "../components/Type";
import { BRAND, COLORS } from "../config";
import { SANS } from "../fonts";
import { DROP, s } from "../timeline";

// Intro, local frames 0 → s(16.2). Paced like the reference:
//   0–2.3 s   icon alone on grey
//   2.3–6.0   camera pulls back, a grid of food flies in around the icon, holds
//   6.0–8.6   fast push-in with blur, cross to "Introducing" + brand
//   8.6–13.6  kinetic headline
//   14.5      "A new kind of food search." slams on the drop
const GRID = [
  ["🥗", "🍗", "🍣", "🥑", "🍜", "🌮", "🥙", "🍲", "🫐"],
  ["🍋", "🥦", "🍛", "🫘", "", "🍤", "🥬", "🍱", "🥕"],
  ["🌯", "🍠", "🧆", "🫒", "", "🍚", "🥘", "🫑", "🍇"],
  ["🍅", "🥒", "🐟", "🍞", "🥣", "🌶️", "🧄", "🍊", "🥜"],
  ["🫛", "🍓", "🍳", "🥥", "🧀", "🍆", "🥝", "🍈", "🌽"],
];
const SX = 214;
const SY = 196;
const CX = 960;
const CY = 540;

const Grid: React.FC<{ f: number }> = ({ f }) => {
  const pull = rise(f, s(2.3), s(4.2), easeInOut); // tile shrinks as the camera pulls back
  const tileSize = k(f, [s(2.3), s(4.2)], [360, 150], easeInOut);
  const pushIn = rise(f, s(6.0), s(6.6), easeIn);
  const scale = 1 + pushIn * 1.6;
  const blur = pushIn * 18;
  return (
    <AbsoluteFill style={{ background: COLORS.grey, transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity: 1 - rise(f, s(6.3), s(6.7)) }}>
      {GRID.map((row, r) =>
        row.map((cell, c) => {
          if (!cell) return null;
          const dx = (c - 4) * SX;
          const dy = (r - 2) * SY;
          const dist = Math.hypot(dx, dy);
          const delay = s(2.5) + (dist / 1100) * s(1.2);
          const a = rise(f, delay, delay + s(0.5));
          const fly = 1 - a;
          return (
            <div
              key={`${r}-${c}`}
              style={{
                position: "absolute",
                left: CX + dx * (1 + fly * 0.9) - 60,
                top: CY + dy * (1 + fly * 0.9) - 60,
                width: 120,
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 86,
                opacity: a * pull,
                transform: `scale(${0.6 + 0.4 * a}) rotate(${fly * 20}deg)`,
                filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.12))",
              }}
            >
              {cell}
            </div>
          );
        })
      )}
      <div style={{ position: "absolute", left: CX - tileSize / 2, top: CY - tileSize / 2 }}>
        <Tile size={tileSize} />
      </div>
    </AbsoluteFill>
  );
};

const Introducing: React.FC<{ f: number }> = ({ f }) => {
  const a = rise(f, s(6.4), s(7.0));
  const out = rise(f, s(8.3), s(8.7), easeIn);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: a * (1 - out), fontFamily: SANS }}>
      <div style={{ fontSize: 44, fontWeight: 500, color: COLORS.muted, letterSpacing: 6, textTransform: "uppercase", transform: `translateY(${(1 - a) * 20}px)` }}>Introducing</div>
      <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 28, transform: `translateY(${(1 - a) * 40}px)` }}>
        <Tile size={132} />
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -7, color: COLORS.ink }}>{BRAND}</div>
      </div>
    </AbsoluteFill>
  );
};

// Kinetic headline: three lines, each word rising on its own beat, inline food tiles like the reference.
const LINES: (string | { emoji: string })[][] = [
  ["Meal", "Finder", { emoji: "🍗" }, "knows"],
  ["what", { emoji: "🧬" }, "your", "body"],
  ["wants", { emoji: "🍽️" }, "tonight"],
];

const Kinetic: React.FC<{ f: number }> = ({ f }) => {
  const start = s(8.6);
  const out = rise(f, s(13.3), s(13.7), easeIn);
  let i = 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - out, transform: `scale(${1 + out * 0.08})`, fontFamily: SANS }}>
      {LINES.map((line, li) => (
        <div key={li} style={{ display: "flex", alignItems: "center", gap: 30, height: 150 }}>
          {line.map((w, wi) => {
            const at = start + i++ * s(0.3);
            const a = rise(f, at, at + s(0.35));
            const style: React.CSSProperties = { opacity: a, transform: `translateY(${(1 - a) * 46}px) scale(${0.92 + 0.08 * a})` };
            return typeof w === "string" ? (
              <span key={wi} style={{ ...style, fontSize: 128, fontWeight: 800, letterSpacing: -6, color: COLORS.ink, lineHeight: 1 }}>
                {w}
              </span>
            ) : (
              <span
                key={wi}
                style={{
                  ...style,
                  width: 118,
                  height: 118,
                  borderRadius: 30,
                  background: "#fff",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 72,
                }}
              >
                {w.emoji}
              </span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};

const Slam: React.FC<{ f: number }> = ({ f }) => {
  const at = s(DROP);
  const hit = rise(f, at - 2, at + 4, easeOut);
  const flash = k(f, [at, at + 10], [1, 0]);
  return (
    <AbsoluteFill style={{ opacity: hit }}>
      <AbsoluteFill style={{ background: COLORS.brand, opacity: flash * 0.9 }} />
      <Headline text="A new kind of food search." from={at - 2} size={118} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.08 - 0.08 * hit})` }} />
    </AbsoluteFill>
  );
};

export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {f < s(6.8) && <Grid f={f} />}
      {f >= s(6.3) && f < s(8.8) && <Introducing f={f} />}
      {f >= s(8.5) && f < s(13.8) && <Kinetic f={f} />}
      {f >= s(DROP) - 2 && <Slam f={f} />}
    </AbsoluteFill>
  );
};
