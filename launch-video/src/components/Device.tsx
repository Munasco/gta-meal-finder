import { OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { k } from "../anim";
import { COLORS } from "../config";

/**
 * A screen capture in a soft device frame. `zoom` scales around `origin` (fractions of the frame) so a
 * scene can push into the part of the UI it talks about. `startFrom` is in seconds of the clip.
 */
export const Device: React.FC<{
  src: string;
  startFrom?: number;
  width?: number;
  zoom?: [number, number, number, number]; // [fromFrame, toFrame, fromScale, toScale]
  origin?: [number, number];
  enter?: number; // local frame where the device finishes sliding in
  exit?: number; // local frame where it starts sliding out
  y?: number;
}> = ({ src, startFrom = 0, width = 1500, zoom, origin = [0.5, 0.4], enter = 14, exit, y = 0 }) => {
  const f = useCurrentFrame();
  const height = Math.round((width * 986) / 1752);
  const slide = k(f, [0, enter], [1, 0]);
  const out = exit !== undefined ? k(f, [exit, exit + 10], [0, 1]) : 0;
  const scale = zoom ? k(f, [zoom[0], zoom[1]], [zoom[2], zoom[3]]) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: (1920 - width) / 2,
        top: (1080 - height) / 2 + y + slide * 70 + out * 60,
        width,
        height,
        opacity: 1 - slide - out,
        borderRadius: 26,
        overflow: "hidden",
        background: COLORS.card,
        boxShadow: "0 30px 80px rgba(10,10,10,0.18), 0 2px 6px rgba(10,10,10,0.08)",
        border: "1px solid rgba(10,10,10,0.08)",
      }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: `${origin[0] * 100}% ${origin[1] * 100}%` }}>
        <OffthreadVideo src={staticFile(src)} startFrom={Math.round(startFrom * 24)} muted style={{ width, height, objectFit: "cover" }} />
      </div>
    </div>
  );
};
