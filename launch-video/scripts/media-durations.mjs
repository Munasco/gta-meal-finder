// Measures every voice clip and screen capture with ffprobe so scene timing follows the real files.
// Writes src/media-durations.json; `bun run dev` and `bun run render` run it first.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const out = {};

const seconds = (file) => {
  const sec = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`ffprobe could not measure ${file}`);
  return Math.round(n * 1000) / 1000;
};

for (const f of readdirSync(join(ROOT, "public/audio")).filter((n) => /^vo-\d+\.wav$/.test(n)).sort()) out[`audio/${f}`] = seconds(join(ROOT, "public/audio", f));
for (const f of readdirSync(join(ROOT, "public/rec")).filter((n) => n.endsWith(".mp4")).sort()) out[`rec/${f}`] = seconds(join(ROOT, "public/rec", f));

writeFileSync(join(ROOT, "src/media-durations.json"), JSON.stringify(out, null, 2) + "\n");
console.log(out);
