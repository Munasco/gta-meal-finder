#!/usr/bin/env bash
# Masters the raw Remotion render to -14 LUFS integrated / -1 dBTP (two-pass loudnorm, then a true-peak limiter).
# Usage: scripts/master.sh [in=out/gta-meal-finder-launch-raw.mp4] [out=out/gta-meal-finder-launch.mp4]
set -euo pipefail
IN="${1:-out/gta-meal-finder-launch-raw.mp4}"
OUT="${2:-out/gta-meal-finder-launch.mp4}"
STATS=$(ffmpeg -hide_banner -nostats -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
read -r MI MTP MLRA MTH OFF < <(echo "$STATS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"],d["target_offset"])')
ffmpeg -hide_banner -loglevel error -y -i "$IN" -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=9:measured_I=${MI}:measured_TP=${MTP}:measured_LRA=${MLRA}:measured_thresh=${MTH}:offset=${OFF}:linear=true,aresample=48000,alimiter=limit=0.8:level=0:attack=5:release=80" \
  -c:a aac -b:a 256k -movflags +faststart "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af loudnorm=I=-14:TP=-1:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' | python3 -c 'import json,sys;d=json.load(sys.stdin);print("master:", d["input_i"], "LUFS, true peak", d["input_tp"], "dBTP")'
