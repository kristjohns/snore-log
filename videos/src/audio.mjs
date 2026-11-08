// Builds the soundtrack: narration placed on the timeline, synthesised sound
// effects, and a soft ambient music bed that ducks under the voice.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { rng } from './lib/anim.mjs';

export const SR = 48000;
const TAU = Math.PI * 2;

// ---------- helpers ----------

function decode(path) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${path}: ${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
}

function addInto(bus, src, at, gain = 1, pan = 0) {
  // bus: [L, R]
  const start = Math.round(at * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  const [L, R] = bus;
  for (let i = 0; i < src.length; i++) {
    const j = start + i;
    if (j < 0 || j >= L.length) continue;
    L[j] += src[i] * gl;
    R[j] += src[i] * gr;
  }
}

function env(n, attack, release, shape = 2) {
  const out = new Float32Array(n);
  const a = Math.max(1, Math.round(attack * SR));
  for (let i = 0; i < n; i++) {
    const x = i < a ? i / a : Math.pow(Math.max(0, 1 - (i - a) / Math.max(1, n - a)), shape);
    out[i] = x;
  }
  return out;
}

// Biquad band-pass (RBJ cookbook), in place.
function bandpass(buf, f0, q) {
  const w = (TAU * f0) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

function lowpass1(buf, fc) {
  const a = Math.exp((-TAU * fc) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y = (1 - a) * buf[i] + a * y;
    buf[i] = y;
  }
  return buf;
}

// ---------- sound effects ----------

const SFX = {
  tick() {
    const n = Math.round(0.09 * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = Math.sin(TAU * 1500 * t) * Math.exp(-t * 60) * 0.6 + Math.sin(TAU * 2900 * t) * Math.exp(-t * 90) * 0.25;
    }
    return out;
  },
  tock() {
    const n = Math.round(0.1 * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = Math.sin(TAU * 900 * t) * Math.exp(-t * 55) * 0.45;
    }
    return out;
  },
  beep() {
    const n = Math.round(0.22 * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.min(1, t / 0.006) * Math.exp(-t * 14);
      out[i] = (Math.sin(TAU * 880 * t) + 0.3 * Math.sin(TAU * 1760 * t)) * e * 0.5;
    }
    return out;
  },
  go() {
    const n = Math.round(0.6 * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.min(1, t / 0.006) * Math.exp(-t * 6);
      out[i] = (Math.sin(TAU * 1318.5 * t) + 0.7 * Math.sin(TAU * 1760 * t) + 0.25 * Math.sin(TAU * 2637 * t)) * e * 0.35;
    }
    return out;
  },
  chime() {
    // C6-E6-G6 bell arpeggio
    const n = Math.round(2.4 * SR), out = new Float32Array(n);
    const notes = [1046.5, 1318.5, 1568.0];
    notes.forEach((f, k) => {
      const off = Math.round(k * 0.09 * SR);
      for (let i = 0; i + off < n; i++) {
        const t = i / SR;
        const e = Math.min(1, t / 0.004) * Math.exp(-t * 2.6);
        const v = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 4) + 0.15 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 8);
        out[i + off] += v * e * 0.22;
      }
    });
    return out;
  },
  pop() {
    const n = Math.round(0.14 * SR), out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = 720 * Math.exp(-t * 18) + 260;
      ph += (TAU * f) / SR;
      out[i] = Math.sin(ph) * Math.min(1, t / 0.003) * Math.exp(-t * 30) * 0.5;
    }
    return out;
  },
  whoosh() {
    const n = Math.round(0.9 * SR), noise = new Float32Array(n);
    const r = rng(11);
    for (let i = 0; i < n; i++) noise[i] = r() * 2 - 1;
    // sweep a band-pass by processing in chunks
    const out = new Float32Array(n);
    const chunk = 1024;
    for (let s = 0; s < n; s += chunk) {
      const p = s / n;
      const f = 300 + 2600 * Math.sin(Math.PI * p);
      const part = bandpass(noise.subarray(Math.max(0, s - 256), Math.min(n, s + chunk)), f, 1.4);
      for (let i = 0; i < chunk && s + i < n; i++) {
        const j = i + Math.min(256, s);
        out[s + i] = part[j] * Math.sin(Math.PI * ((s + i) / n)) ** 2 * 0.5;
      }
    }
    return out;
  },
  snore() {
    // An inhaled snore: a flutter of ~30 pulses per second through throat resonances.
    const dur = 1.7, n = Math.round(dur * SR);
    const r = rng(5);
    const src = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f0 = 30 + 6 * Math.sin(TAU * 0.6 * t) + 3 * (r() - 0.5);
      ph += f0 / SR;
      const pulse = ph % 1 < 0.12 ? 1 : 0;
      src[i] = pulse * 0.9 + (r() * 2 - 1) * 0.35;
    }
    const a = bandpass(src, 220, 2.2), b = bandpass(src, 620, 3.5), c = bandpass(src, 1300, 4);
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / dur / SR * SR;
      const x = i / n;
      const shape = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5;
      e[i] = (a[i] * 1.0 + b[i] * 0.55 + c[i] * 0.2) * shape;
    }
    lowpass1(e, 2500);
    // normalise
    let m = 0;
    for (const v of e) m = Math.max(m, Math.abs(v));
    for (let i = 0; i < n; i++) e[i] = (e[i] / m) * 0.55;
    return e;
  },
  breathIn() {
    const n = Math.round(1.6 * SR), out = new Float32Array(n);
    const r = rng(3);
    for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
    const f = bandpass(out, 1800, 0.7);
    for (let i = 0; i < n; i++) f[i] *= Math.sin(Math.PI * (i / n)) ** 2 * 0.25;
    return f;
  },
};

const sfxCache = new Map();
function sfx(name) {
  if (!sfxCache.has(name)) {
    if (!SFX[name]) throw new Error(`Unknown sound effect ${name}`);
    sfxCache.set(name, SFX[name]());
  }
  return sfxCache.get(name);
}

// ---------- music ----------

// Band-limited saw wavetable.
const TABLE = 4096;
const SAW = (() => {
  const t = new Float32Array(TABLE);
  for (let k = 1; k <= 14; k++) for (let i = 0; i < TABLE; i++) t[i] += Math.sin((TAU * k * i) / TABLE) / k;
  let m = 0;
  for (const v of t) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < TABLE; i++) t[i] /= m;
  return t;
})();

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const PROGRESSIONS = {
  // Each chord: MIDI notes. Warm, unresolved, sleepy.
  calm: [
    [48, 55, 59, 62, 64], // Cmaj9
    [45, 52, 55, 59, 60], // Am(add9)
    [41, 48, 52, 55, 57], // Fmaj7(add9)
    [43, 50, 54, 57, 59], // G6/9-ish
  ],
};

function freeverb(L, R, wet = 0.32, room = 0.86, damp = 0.35) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
  const aps = [556, 441, 341, 225];
  const proc = (inp, spread) => {
    const n = inp.length, out = new Float32Array(n);
    for (const len0 of combs) {
      const len = len0 + spread;
      const buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = inp[i] * 0.015 + store * room;
        out[i] += y;
        if (++idx >= len) idx = 0;
      }
    }
    for (const len0 of aps) {
      const len = len0 + spread;
      const buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const b = buf[idx];
        const x = out[i];
        out[i] = -x + b;
        buf[idx] = x + b * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
    return out;
  };
  const wl = proc(L, 0), wr = proc(R, 23);
  for (let i = 0; i < L.length; i++) {
    L[i] = L[i] * (1 - wet) + wl[i] * wet * 3;
    R[i] = R[i] * (1 - wet) + wr[i] * wet * 3;
  }
}

export function music(duration, opts = {}) {
  const { chordLen = 8, seed = 1, pluck = true } = opts;
  const n = Math.ceil(duration * SR) + SR * 2;
  const L = new Float32Array(n), R = new Float32Array(n);
  const prog = PROGRESSIONS.calm;
  const chords = Math.ceil(duration / chordLen) + 1;
  const r = rng(seed);

  // Pads: each chord fades in and out with overlap.
  for (let c = 0; c < chords; c++) {
    const notes = prog[c % prog.length];
    const t0 = c * chordLen - 1.5;
    const len = chordLen + 3;
    const s0 = Math.max(0, Math.round(t0 * SR)), s1 = Math.min(n, Math.round((t0 + len) * SR));
    notes.forEach((m, k) => {
      const voices = [-7, 0, 6].map((cents) => ({ f: midi(m + 12) * Math.pow(2, cents / 1200), ph: r() }));
      const pan = (k / (notes.length - 1)) * 1.2 - 0.6;
      const amp = (k === 0 ? 0.05 : 0.035);
      let lp = 0;
      const a = Math.exp((-TAU * 900) / SR);
      for (let i = s0; i < s1; i++) {
        const t = (i - t0 * SR) / SR;
        const e = Math.min(1, t / 2.6) * Math.min(1, (len - t) / 2.8);
        if (e <= 0) continue;
        let v = 0;
        for (const vo of voices) {
          vo.ph += vo.f / SR;
          v += SAW[((vo.ph % 1) * TABLE) | 0];
        }
        lp = (1 - a) * v + a * lp;
        const s = lp * amp * e * e;
        L[i] += s * (1 - pan * 0.5);
        R[i] += s * (1 + pan * 0.5);
      }
    });
    // Soft sub bass on the root
    const f = midi(notes[0] - 12);
    for (let i = s0; i < s1; i++) {
      const t = (i - t0 * SR) / SR;
      const e = Math.min(1, t / 2.5) * Math.min(1, (len - t) / 2.5);
      if (e <= 0) continue;
      const v = Math.sin(TAU * f * t) * 0.06 * e;
      L[i] += v;
      R[i] += v;
    }
  }

  // Gentle bell plucks drifting over the chords.
  if (pluck) {
    for (let t = 2; t < duration; t += 1.0) {
      if (r() < 0.45) continue;
      const c = Math.floor((t + 1.5) / chordLen);
      const notes = prog[c % prog.length];
      const m = notes[1 + Math.floor(r() * (notes.length - 1))] + 24;
      const f = midi(m);
      const s0 = Math.round(t * SR), len = Math.round(2.2 * SR);
      const pan = r() * 1.4 - 0.7;
      const amp = 0.022 + r() * 0.012;
      for (let i = 0; i < len && s0 + i < n; i++) {
        const tt = i / SR;
        const e = Math.min(1, tt / 0.004) * Math.exp(-tt * 2.2);
        const v = (Math.sin(TAU * f * tt) + 0.2 * Math.sin(TAU * f * 2 * tt) * Math.exp(-tt * 5)) * amp * e;
        L[s0 + i] += v * (1 - pan * 0.6);
        R[s0 + i] += v * (1 + pan * 0.6);
      }
    }
  }

  freeverb(L, R);
  return [L, R];
}

// ---------- mix ----------

export function mixSoundtrack(tl, voiceDir, outPath, opts = {}) {
  const { musicGain = 0.55, duckTo = 0.35, sfxGain = 0.8, voiceGain = 1.0 } = opts;
  const n = Math.ceil((tl.duration + 0.5) * SR);
  const voice = [new Float32Array(n), new Float32Array(n)];
  const fx = [new Float32Array(n), new Float32Array(n)];

  const clips = new Map();
  for (const v of tl.voice) {
    if (!clips.has(v.key)) clips.set(v.key, decode(`${voiceDir}/${v.key}.wav`));
    addInto(voice, clips.get(v.key), v.t, voiceGain * v.gain);
  }
  for (const e of tl.sfx) addInto(fx, sfx(e.type), e.t, sfxGain * (e.gain ?? 1), e.pan ?? 0);

  // Ducking envelope from voice activity, smoothed.
  const active = new Float32Array(n);
  for (const v of tl.voice) {
    const a = Math.max(0, Math.round((v.t - 0.25) * SR)), b = Math.min(n, Math.round((v.t + v.dur + 0.35) * SR));
    for (let i = a; i < b; i++) active[i] = 1;
  }
  const duck = new Float32Array(n);
  let d = 1;
  const att = Math.exp(-1 / (0.12 * SR)), rel = Math.exp(-1 / (0.9 * SR));
  for (let i = 0; i < n; i++) {
    const target = active[i] ? duckTo : 1;
    const k = target < d ? att : rel;
    d = target + (d - target) * k;
    duck[i] = d;
  }

  const [mL, mR] = music(tl.duration + 0.5, opts.music);
  const L = new Float32Array(n), R = new Float32Array(n);
  const fadeOut = Math.round(3 * SR);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (1.5 * SR), (n - i) / fadeOut);
    const m = musicGain * duck[i] * fade;
    L[i] = voice[0][i] + fx[0][i] + (mL[i] ?? 0) * m;
    R[i] = voice[1][i] + fx[1][i] + (mR[i] ?? 0) * m;
  }
  // Soft clip safety
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i] * 0.95);
    R[i] = Math.tanh(R[i] * 0.95);
  }
  writeWav(outPath, L, R);
}

function writeWav(path, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  writeFileSync(path, buf);
}

export { sfx as sfxSamples, writeWav };
