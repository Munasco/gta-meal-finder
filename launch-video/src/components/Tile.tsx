import { COLORS } from "../config";

/** The app icon: a white tile with a fork-and-knife mark in brand green. */
export const Tile: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: "linear-gradient(170deg, #ffffff 0%, #f1f2f4 100%)",
      boxShadow: `0 ${size * 0.03}px ${size * 0.07}px rgba(0,0,0,0.16), 0 ${size * 0.008}px ${size * 0.02}px rgba(0,0,0,0.08)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  </div>
);
