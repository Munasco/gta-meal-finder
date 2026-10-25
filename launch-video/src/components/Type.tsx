import { useCurrentFrame } from "remotion";
import { easeOut, k, rise } from "../anim";
import { COLORS } from "../config";
import { SANS } from "../fonts";

/** Big centred headline that rises in; optional accent word in brand green. */
export const Headline: React.FC<{ text: string; accent?: string; from?: number; out?: number; size?: number; y?: number; color?: string }> = ({
  text,
  accent,
  from = 0,
  out,
  size = 128,
  y = 0,
  color = COLORS.ink,
}) => {
  const f = useCurrentFrame();
  const inA = rise(f, from, from + 16);
  const outA = out !== undefined ? rise(f, out, out + 8) : 0;
  const parts = accent ? text.split(accent) : [text];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: -size * 0.04,
        lineHeight: 1.02,
        color,
        textAlign: "center",
        opacity: inA * (1 - outA),
        transform: `translateY(${(1 - inA) * 40 + y - outA * 20}px)`,
        padding: "0 120px",
      }}
    >
      <span>
        {parts[0]}
        {accent && <span style={{ color: COLORS.brand }}>{accent}</span>}
        {parts[1]}
      </span>
    </div>
  );
};

/** Small caption chip, pinned to a point, pops in then out. */
export const Chip: React.FC<{ text: string; x: number; y: number; from: number; to: number; icon?: string; tone?: "ink" | "brand" | "warn" }> = ({
  text,
  x,
  y,
  from,
  to,
  icon,
  tone = "ink",
}) => {
  const f = useCurrentFrame();
  const a = Math.min(rise(f, from, from + 8), 1 - rise(f, to - 6, to));
  const pop = k(f, [from, from + 10], [0.85, 1], easeOut);
  const bg = tone === "brand" ? COLORS.brand : tone === "warn" ? COLORS.warn : COLORS.ink;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${pop})`,
        opacity: a,
        fontFamily: SANS,
        fontWeight: 600,
        fontSize: 30,
        color: "#fff",
        background: bg,
        padding: "14px 24px",
        borderRadius: 999,
        boxShadow: "0 12px 30px rgba(10,10,10,0.18)",
        whiteSpace: "nowrap",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      {icon && <span style={{ fontSize: 30 }}>{icon}</span>}
      {text}
    </div>
  );
};

/** Lower-third label used for the chapter titles once the screen is up. */
export const Kicker: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const f = useCurrentFrame();
  const a = Math.min(rise(f, from, from + 10), 1 - rise(f, to - 8, to));
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 44,
        display: "flex",
        justifyContent: "center",
        opacity: a,
        transform: `translateY(${(1 - a) * 16}px)`,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: -1,
        color: COLORS.ink,
      }}
    >
      <span style={{ background: "rgba(255,255,255,0.9)", padding: "10px 26px", borderRadius: 999, border: "1px solid rgba(10,10,10,0.08)" }}>{text}</span>
    </div>
  );
};
