#!/usr/bin/env bash
# Builds both videos into out/.
# Usage: ./build.sh KOKORO_MODEL.onnx KOKORO_VOICES.bin [python]
set -euo pipefail
cd "$(dirname "$0")"

MODEL=${1:?path to kokoro-v1.0.onnx}
VOICES=${2:?path to voices-v1.0.bin}
PY=${3:-.venv/bin/python}
WORKERS=${WORKERS:-$(nproc 2>/dev/null || echo 4)}

for v in explainer exercises; do
  echo "== $v"
  node src/build.mjs "$v" cues
  "$PY" tts/speak.py "build/$v/cues.json" "build/$v/voice" "$MODEL" "$VOICES"
  node src/build.mjs "$v" render --workers "$WORKERS"
  node src/build.mjs "$v" audio
  node src/build.mjs "$v" mux
done
