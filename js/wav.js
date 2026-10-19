// Small audio helpers for saved clips.

export function levelDb(samples, from = 0, to = samples.length) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return 10 * Math.log10(sum / Math.max(1, to - from) + 1e-12);
}

// Loudest 100 ms stretch of a clip, in dBFS.
export function peakDb(samples, rate) {
  const win = Math.round(rate / 10);
  let peak = -120;
  for (let i = 0; i + win <= samples.length; i += win) peak = Math.max(peak, levelDb(samples, i, i + win));
  return peak;
}

// Boosts quiet recordings so they can be heard on playback: peak at -3 dBFS, at most +30 dB.
export function normalize(samples) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const gain = Math.min(10 ** (30 / 20), 10 ** (-3 / 20) / max);
  return samples.map((s) => s * gain);
}

// 16-bit mono PCM WAV.
export function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
