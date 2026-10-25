import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./config";
import { Film } from "./Film";
import { DURATION } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition id="Launch" component={Film} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
);
