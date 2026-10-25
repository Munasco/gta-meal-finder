"""Measure narration, render the scenes, assemble picture + narration + music, master to -14 LUFS / -1 dBTP."""
import json, os, subprocess, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
LEAD, TAIL = 0.5, 0.9
TAIL_FOR = {"11-close": 3.0}
KEYS = [k for k, _ in json.load(open("lines.json"))]
SCENES = [f"S{i+1:02d}" for i in range(len(KEYS))]

def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode().strip())

def measure():
    d = {k: round(dur(f"vo/{k}.wav"), 3) for k in KEYS}
    json.dump(d, open("vo-durations.json", "w"), indent=1)
    print("narration:", d, "total", round(sum(d.values()), 1))
    return d

def render(only=None):
    scenes = only or SCENES
    subprocess.run(["manim", "-r", "1920,1080", "--fps", "30", "--disable_caching", "-v", "WARNING", "explainer.py", *scenes], check=True)

def loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "loudnorm=I=-14:TP=-1:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    return json.loads(out[out.index("{"):out.rindex("}") + 1])

def master(src, dst):
    """Two-pass loudnorm to -14 LUFS / -1 dBTP, then a true-peak limiter, written as 24-bit WAV."""
    m = loudness(src)
    af = (f"loudnorm=I=-14:TP=-1:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
          f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000,alimiter=limit=0.8:level=0:attack=5:release=80")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", af, "-c:a", "pcm_s24le", dst], check=True)
    r = loudness(dst)
    print(f"master: {r['input_i']} LUFS, true peak {r['input_tp']} dBTP")

def music_bed():
    """The generated piano clip crossfaded into itself once: long enough for the film, no hard loop point."""
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "music.mp3", "-i", "music.mp3", "-filter_complex", "[0:a][1:a]acrossfade=d=5:c1=tri:c2=tri[a]", "-map", "[a]", "music-bed.wav"], check=True)

def assemble(d):
    music_bed()
    clips = [f"media/videos/explainer/1080p30/{s}.mp4" for s in SCENES]
    starts, t = [], 0.0
    for k, c in zip(KEYS, clips):
        cd = dur(c)
        expect = LEAD + d[k] + TAIL_FOR.get(k, TAIL)
        # Manim rounds every play/wait to whole frames, so a scene can drift a few hundred ms from the plan;
        # narration is placed at the measured clip start, and the clip must still outlast its narration.
        assert abs(cd - expect) < 0.6 and cd >= LEAD + d[k] + 0.3, f"{k}: clip {cd:.2f}s vs expected {expect:.2f}s"
        starts.append(t)
        t += cd
    total = t
    open("concat.txt", "w").write("".join(f"file '{c}'\n" for c in clips))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "video.mp4"], check=True)
    # narration: each clip faded 70 ms in/out and delayed to its scene start + LEAD; music looped under it.
    inputs, filters, labels = [], [], []
    for i, (k, s) in enumerate(zip(KEYS, starts)):
        inputs += ["-i", f"vo/{k}.wav"]
        ms = int((s + LEAD) * 1000)
        filters.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.07,afade=t=out:st={d[k]-0.07:.3f}:d=0.07,adelay={ms}|{ms}[v{i}]")
        labels.append(f"[v{i}]")
    n = len(KEYS)
    inputs += ["-i", "music-bed.wav"]  # the clip crossfaded into itself once: long enough, no hard loop point
    filters.append(f"[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{total:.3f},afade=t=in:d=2,afade=t=out:st={total-4:.3f}:d=4,volume=-21dB[m]")
    filters.append("".join(labels) + f"[m]amix=inputs={n+1}:normalize=0:dropout_transition=0[mix]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "[mix]", "-ar", "48000", "mix.wav"], check=True)
    master("mix.wav", "mix-mastered.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "video.mp4", "-i", "mix-mastered.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "eat-healthier-explainer.mp4"], check=True)
    print("film:", round(total, 1), "s ->", os.path.abspath("eat-healthier-explainer.mp4"))
    json.dump({"starts": dict(zip(KEYS, starts)), "total": total}, open("timeline.json", "w"), indent=1)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "measure": measure()
    elif cmd == "render": render(sys.argv[2:] or None)
    elif cmd == "assemble": assemble(json.load(open("vo-durations.json")))
    else:
        d = measure(); render(); assemble(d)
