# Eat Healthier explainer (Manim)

A five-minute lesson, in the spirit of a 3Blue1Brown video, on how the app turns "looking for the healthiest Chipotle" into a ranked answer: the decision-model read of the sentence, the indexed search, decomposing a menu item into reference foods, the weighted sum, the six-line score with its caps, the biomarker lenses, the three public indices and the restaurant rank. Every number on screen is the engine's real output for Chipotle's High Protein · High Fibre Bowl (73), Burrito (55) and Quesadilla (42).

## Build

```bash
brew install manim ffmpeg          # Manim Community; no LaTeX needed (all text is Pango)
python3 build.py                   # measure narration → render 11 scenes at 1080p30 → assemble → master
```

Steps can be run alone: `build.py measure`, `build.py render S05 S06`, `build.py assemble`. The master targets −14 LUFS integrated with a −1 dBTP ceiling.

## How timing works

`lines.json` holds the narration. `vo/*.wav` are the Gemini TTS reads (voice Charon); `build.py measure` writes their lengths to `vo-durations.json`. Each scene lasts `LEAD + narration + TAIL` seconds and places its beats with `self.cue("phrase")`, which estimates when a phrase is spoken from its character position in the line. Swap a line, re-record it, re-run: nothing is re-timed by hand, and a scene whose animations overrun its narration fails the render instead of freezing.

`music.mp3` is a Lyria 3 piano bed; `assemble` crossfades it into itself so the loop point is inaudible and ducks it about 20 dB under the voice.
