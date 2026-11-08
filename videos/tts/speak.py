"""Speak every narration line with Kokoro TTS.

Usage: python speak.py CUES.json OUT_DIR MODEL.onnx VOICES.bin

CUES.json is a list of {key, text, voice, speed}. Each line becomes
OUT_DIR/<key>.wav (24 kHz mono) with leading and trailing silence trimmed, and
OUT_DIR/durations.json maps key -> seconds. Lines that already exist are
skipped, so editing one line only re-speaks that line.
"""

import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def trim(samples, sr, threshold=0.008, pad=0.04):
    loud = np.where(np.abs(samples) > threshold)[0]
    if len(loud) == 0:
        return samples
    a = max(0, loud[0] - int(pad * sr))
    b = min(len(samples), loud[-1] + int(pad * sr))
    return samples[a:b]


def main():
    cues_path, out_dir, model, voices = sys.argv[1:5]
    os.makedirs(out_dir, exist_ok=True)
    cues = json.load(open(cues_path))
    dur_path = os.path.join(out_dir, "durations.json")
    durations = json.load(open(dur_path)) if os.path.exists(dur_path) else {}
    kokoro = Kokoro(model, voices)
    for i, cue in enumerate(cues):
        path = os.path.join(out_dir, cue["key"] + ".wav")
        if os.path.exists(path) and cue["key"] in durations:
            continue
        samples, sr = kokoro.create(cue["text"], voice=cue["voice"], speed=cue["speed"], lang="en-us")
        samples = trim(np.asarray(samples, dtype=np.float32), sr)
        sf.write(path, samples, sr)
        durations[cue["key"]] = round(len(samples) / sr, 3)
        print(f"[{i + 1}/{len(cues)}] {durations[cue['key']]:.2f}s  {cue['text'][:70]}", flush=True)
    json.dump(durations, open(dur_path, "w"), indent=1)


if __name__ == "__main__":
    main()
