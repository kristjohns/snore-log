"""Builds a 5-minute test "night" from the ESC-50 clips in test/audio.

Timeline (mm:ss): quiet with a cough at 0:30, snoring 0:50-2:50, quiet with a dog
and a knock at 3:00 and 3:20, snoring 3:40-4:40, quiet until 5:00.
Usage: python3 test/make-night.py <out.wav>
"""
import glob
import os
import sys
import wave

import numpy as np

RATE = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)


def load(path):
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
        rate = w.getframerate()
    t = np.arange(int(len(data) * RATE / rate)) / RATE
    return np.interp(t, np.arange(len(data)) / rate, data).astype(np.float32)


def at_peak(x, dbfs):
    return x * (10 ** (dbfs / 20) / (np.abs(x).max() + 1e-9))


def room_noise(n):
    # Brownish noise like a quiet bedroom, about -58 dBFS RMS.
    x = np.cumsum(rng.normal(size=n)).astype(np.float32)
    x -= np.convolve(x, np.ones(4801) / 4801, mode="same")
    return x * (10 ** (-58 / 20) / np.sqrt(np.mean(x**2)))


night = room_noise(300 * RATE)


def place(clip, start_s):
    i = int(start_s * RATE)
    n = min(len(clip), len(night) - i)
    night[i : i + n] += clip[:n]


snores = sorted(glob.glob(os.path.join(HERE, "audio", "snoring--*.wav")))
pos = 50.0
for path in snores[:24]:
    place(at_peak(load(path), -14), pos)
    pos += 5
pos = 220.0
for path in snores[24:36]:
    place(at_peak(load(path), -20), pos)
    pos += 5
place(at_peak(load(sorted(glob.glob(os.path.join(HERE, "audio", "coughing--*.wav")))[4]), -12), 30)
place(at_peak(load(sorted(glob.glob(os.path.join(HERE, "audio", "dog--*.wav")))[3]), -12), 180)
place(at_peak(load(sorted(glob.glob(os.path.join(HERE, "audio", "door_wood_knock--*.wav")))[2]), -12), 200)

pcm = (np.clip(night, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(pcm.tobytes())
print(f"wrote {sys.argv[1]}: {len(pcm) / RATE:.0f} s")
