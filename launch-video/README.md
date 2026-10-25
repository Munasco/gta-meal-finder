# GTA Meal Finder launch film

`out/gta-meal-finder-launch.mp4`: 1920 × 1080, 24 fps, 79 s, mastered to −14 LUFS with a −1 dBTP ceiling.

Structure follows the Muse ad reference (intro icon grid → "Introducing" → kinetic headline → slam on the drop →
three "AI that…" chapters → outro and end card), cut to a 115 BPM track generated with Gemini Lyria 3
(`public/audio/music.wav`, trimmed at bar boundaries so the drop lands at 14.5 s and the real ending closes the film).
Voice lines are Gemini TTS (`public/audio/vo-*.wav`, provenance chunks stripped); scene beats are placed around their real lengths.
Screen captures in `public/rec` are real recordings of the app.

- `bun install` then `bunx remotion studio` to preview, `bun run render` for the master (then the ffmpeg mastering step in the session notes).
