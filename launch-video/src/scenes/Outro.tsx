import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeOut, k, rise } from "../anim";
import { Device } from "../components/Device";
import { Tile } from "../components/Tile";
import { Headline } from "../components/Type";
import { BRAND, CLIPS, COLORS, URL } from "../config";
import { SANS } from "../fonts";
import { BIG_BACKS_OUT, END_CARD, GRID_OUT, s } from "../timeline";

// Outro, local seconds:
//   0–5.0   top-dishes capture with "Eat better. Pay less."
//   5.0–OUT big-backs card ("Cut the big back."), OUT = end of voice line 5 + 0.2 s (≈ 9.8)
//   OUT–15  food grid reprise dissolves in over the card: "Every menu. Every dish. Scored. Even the fries."
//   15–23   end card: tile, brand, URL, "Free · Open source · Side effects: smaller back"
const FOOD = ["🥗", "🍗", "🍣", "🥑", "🍜", "🌮", "🥙", "🍲", "🫐", "🍋", "🥦", "🍛", "🫘", "🍤", "🥬", "🍱", "🥕", "🌯", "🍠", "🧆", "🫒", "🍚", "🥘", "🫑"];

const BigBacks: React.FC<{ f: number }> = ({ f }) => {
  const from = s(5.0);
  const a = rise(f, from, from + 12);
  const line2 = rise(f, from + s(1.4), from + s(1.9));
  const line3 = rise(f, from + s(2.6), from + s(3.1));
  // No group opacity on this dark card: Chrome composites the transformed text lines as their own layers and a
  // faint lighter rectangle shows around them while the group fades. The background and each line fade on their own,
  // and the grid reprise dissolves in on top instead of this card fading out.
  return (
    <AbsoluteFill style={{ background: `rgba(10,10,10,${a})`, alignItems: "center", justifyContent: "center", fontFamily: SANS, color: "#fff" }}>
      <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -7, opacity: a, transform: `translateY(${(1 - a) * 40}px)` }}>Cut the big back.</div>
      <div style={{ fontSize: 72, fontWeight: 600, color: COLORS.brand, marginTop: 10, opacity: line2, transform: `translateY(${(1 - line2) * 24}px)` }}>Keep the portions. Lose the damage.</div>
      <div style={{ fontSize: 34, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginTop: 40, opacity: line3 }}>
        2 mains · 1 side · under $40 · gently
      </div>
    </AbsoluteFill>
  );
};

const GridReprise: React.FC<{ f: number }> = ({ f }) => {
  const from = s(BIG_BACKS_OUT);
  const a = rise(f, from, from + 10);
  const out = rise(f, s(GRID_OUT), s(END_CARD), easeIn);
  const drift = (f - from) * 0.9;
  return (
    <AbsoluteFill style={{ background: COLORS.grey, opacity: a * (1 - out), overflow: "hidden" }}>
      {FOOD.map((e, i) => {
        const col = i % 8;
        const row = Math.floor(i / 8);
        const x = 60 + col * 250 + ((row % 2) * 125 - drift) ;
        const y = 90 + row * 330 + Math.sin((f + i * 7) / 18) * 10;
        return (
          <div key={i} style={{ position: "absolute", left: ((x % 2100) + 2100) % 2100 - 150, top: y, fontSize: 120, opacity: 0.9, filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.12))" }}>
            {e}
          </div>
        );
      })}
      <AbsoluteFill style={{ background: "rgba(251,252,254,0.72)" }} />
      <Headline text="Every menu. Every dish. Scored. Even the fries." accent="Even the fries." from={from + 12} size={104} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const from = s(END_CARD);
  const a = rise(f, from, from + 14);
  const url = rise(f, from + s(0.9), from + s(1.4));
  const tag = rise(f, from + s(1.6), from + s(2.1));
  const settle = k(f, [from, from + s(6)], [1, 1.02], easeOut);
  return (
    <AbsoluteFill style={{ background: COLORS.bg, opacity: a, alignItems: "center", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `translateY(${(1 - a) * 30}px) scale(${settle})` }}>
        <Tile size={160} />
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -7, color: COLORS.ink }}>{BRAND}</div>
      </div>
      <div style={{ fontSize: 56, fontWeight: 600, color: COLORS.brand, marginTop: 36, opacity: url, transform: `translateY(${(1 - url) * 16}px)` }}>{URL}</div>
      <div style={{ fontSize: 32, fontWeight: 500, color: COLORS.muted, marginTop: 26, opacity: tag, letterSpacing: 2, textTransform: "uppercase" }}>
        Free · Open source · Side effects: smaller back
      </div>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {f < s(5.4) && (
        <>
          <Device src={CLIPS.dishes.src} startFrom={5.6} width={1500} enter={10} exit={s(4.6)} zoom={[0, s(5), 1, 1.05]} origin={[0.5, 0.55]} />
          <Headline text="Eat better. Pay less." accent="Pay less." from={s(0.4)} out={s(4.4)} size={96} y={-380} />
        </>
      )}
      {f >= s(5.0) && f < s(BIG_BACKS_OUT + 0.6) && <BigBacks f={f} />}
      {f >= s(BIG_BACKS_OUT) && f < s(END_CARD) && <GridReprise f={f} />}
      {f >= s(END_CARD) && <EndCard f={f} />}
    </AbsoluteFill>
  );
};
