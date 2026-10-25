import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { easeIn, rise } from "../anim";
import { Device } from "../components/Device";
import { Chip, Headline, Kicker } from "../components/Type";
import { COLORS } from "../config";
import { s } from "../timeline";

export interface Callout {
  text: string;
  x: number;
  y: number;
  at: number; // seconds into the chapter
  until: number;
  icon?: string;
  tone?: "ink" | "brand" | "warn";
}

/**
 * One product chapter in the reference's rhythm: a short title card, then the screen capture in a device
 * frame with timed callouts and a lower-third kicker. All times are seconds from the chapter start.
 */
export const Chapter: React.FC<{
  title: string;
  accent?: string;
  kicker: string;
  clip: string;
  clipStart?: number;
  length: number; // chapter length in seconds
  titleFor?: number;
  zoom?: [number, number, number, number];
  origin?: [number, number];
  callouts?: Callout[];
  children?: React.ReactNode;
}> = ({ title, accent, kicker, clip, clipStart = 0, length, titleFor = 2.0, zoom, origin, callouts = [], children }) => {
  const f = useCurrentFrame();
  const titleEnd = s(titleFor);
  const end = s(length);
  const fadeOut = rise(f, end - 8, end, easeIn);
  return (
    <AbsoluteFill style={{ background: COLORS.bg, opacity: 1 - fadeOut }}>
      {f < titleEnd + 6 && <Headline text={title} accent={accent} from={0} out={titleEnd - 6} size={116} />}
      {f >= titleEnd - 4 && (
        <AbsoluteFill style={{ transform: `translateY(0px)` }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <DeviceAt start={titleEnd - 4} clip={clip} clipStart={clipStart} zoom={zoom} origin={origin} />
          </div>
          {callouts.map((c, i) => (
            <Chip key={i} text={c.text} x={c.x} y={c.y} from={s(c.at)} to={s(c.until)} icon={c.icon} tone={c.tone} />
          ))}
          <Kicker text={kicker} from={titleEnd + 4} to={end - 4} />
          {children}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** Device whose local clock starts at `start` (so it slides in when the title leaves and the clip begins there). */
const DeviceAt: React.FC<{ start: number; clip: string; clipStart: number; zoom?: [number, number, number, number]; origin?: [number, number] }> = ({ start, clip, clipStart, zoom, origin }) => (
  <Sequence from={start} layout="none">
    <Device src={clip} startFrom={clipStart} zoom={zoom} origin={origin} enter={14} />
  </Sequence>
);
