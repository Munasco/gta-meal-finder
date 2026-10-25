import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CLIPS, COLORS } from "./config";
import { Chapter } from "./scenes/Chapter";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { DURATION, T, VO, s } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Music sits under the voice: dip to 35 % around each line with short ramps. */
const musicVolume = (f: number) => {
  let v = interpolate(f, [0, 6, DURATION - 24, DURATION], [0, 0.9, 0.9, 0.9], clamp);
  for (const line of VO) {
    const a = s(line.at) - 8;
    const b = s(line.at + line.dur) + 10;
    const duck = interpolate(f, [a, a + 8, b - 8, b], [1, 0.38, 0.38, 1], clamp);
    v *= duck;
  }
  return v;
};

const voVolume = (len: number) => (f: number) => interpolate(f, [0, 2, len - 2, len], [0, 1, 1, 0], clamp);

export const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Audio src={staticFile("audio/music.wav")} volume={musicVolume} />
      {VO.map((line, i) => (
        <Sequence key={i} from={s(line.at)} durationInFrames={s(line.dur) + 2}>
          <Audio src={staticFile(line.file)} volume={voVolume(s(line.dur) + 2)} />
        </Sequence>
      ))}

      <Sequence from={s(T.intro.from)} durationInFrames={s(T.intro.to) - s(T.intro.from)}>
        <Intro />
      </Sequence>

      <Sequence from={s(T.prompt.from)} durationInFrames={s(T.prompt.to) - s(T.prompt.from)}>
        <Chapter
          title="Just say it."
          kicker="Describe the meal. Budget included. Shame optional."
          clip={CLIPS.prompt}
          clipStart={2.8}
          length={T.prompt.to - T.prompt.from}
          titleFor={1.8}
          zoom={[s(6.5), s(10.5), 1, 1.12]}
          origin={[0.5, 0.62]}
          callouts={[
            { text: "Decision-1 reads it", x: 1500, y: 300, at: 6.4, until: 9.2, icon: "🧠", tone: "brand" },
            { text: "chicken · $40 · hungry hungry", x: 1500, y: 390, at: 7.6, until: 10.4, icon: "🍗" },
            { text: "Health first. Fries last.", x: 440, y: 760, at: 8.8, until: 11.0, icon: "🥦", tone: "brand" },
          ]}
        />
      </Sequence>

      <Sequence from={s(T.combo.from)} durationInFrames={s(T.combo.to) - s(T.combo.from)}>
        <Chapter
          title="AI that does the math."
          accent="the math."
          kicker="Net cost before tax and fees. Tip your driver."
          clip={CLIPS.combo}
          clipStart={3.6}
          length={T.combo.to - T.combo.from}
          titleFor={1.9}
          zoom={[s(4), s(9), 1, 1.16]}
          origin={[0.82, 0.3]}
          callouts={[
            { text: "Big back? We got you", x: 1430, y: 260, at: 3.4, until: 6.4, icon: "🍽️", tone: "warn" },
            { text: "BOGO: 2nd main free. Cardio extra.", x: 1380, y: 350, at: 5.2, until: 8.4, icon: "🏷️", tone: "brand" },
            { text: "Math done. Wallet alive.", x: 1430, y: 440, at: 7.0, until: 10.0, icon: "💸" },
          ]}
        />
      </Sequence>

      <Sequence from={s(T.menu.from)} durationInFrames={s(T.menu.to) - s(T.menu.from)}>
        <Chapter
          title="AI that reads the menu."
          accent="reads the menu."
          kicker="USDA components + Decision-1. Scored like the lab, not the vibes."
          clip={CLIPS.sheet}
          clipStart={4.7}
          length={T.menu.to - T.menu.from}
          titleFor={1.8}
          zoom={[s(3), s(8), 1, 1.18]}
          origin={[0.9, 0.35]}
          callouts={[
            { text: "Calories · protein · sodium · fibre", x: 500, y: 300, at: 3.2, until: 6.2, icon: "🧪", tone: "brand" },
            { text: "Why the score, not just the score", x: 500, y: 390, at: 4.6, until: 7.6, icon: "📈" },
            { text: "Bilirubin lens (ask your doctor)", x: 500, y: 480, at: 6.0, until: 8.6, icon: "🩸", tone: "warn" },
          ]}
        />
      </Sequence>

      <Sequence from={s(T.gta.from)} durationInFrames={s(T.gta.to) - s(T.gta.from)}>
        <Chapter
          title="AI that knows the GTA."
          accent="the GTA."
          kicker="400+ restaurants from 46 points. Nearest first."
          clip={CLIPS.map}
          clipStart={3.8}
          length={T.gta.to - T.gta.from}
          titleFor={1.8}
          zoom={[s(2), s(6), 1, 1.14]}
          origin={[0.3, 0.3]}
          callouts={[
            { text: "Range in km", x: 1380, y: 260, at: 2.6, until: 5.0, icon: "📍", tone: "brand" },
            { text: "Etobicoke to Oshawa", x: 1380, y: 350, at: 4.2, until: 7.0, icon: "🗺️" },
            { text: "Deep link. No 1 a.m. scrolling.", x: 1380, y: 440, at: 6.4, until: 8.4, icon: "🔗", tone: "brand" },
          ]}
        />
      </Sequence>

      <Sequence from={s(T.outro.from)} durationInFrames={DURATION - s(T.outro.from)}>
        <Outro />
      </Sequence>
      {/* a hair of dark at the very end so the cut to black is clean */}
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [DURATION - 6, DURATION], [0, 1], clamp), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
