// Lays a video's segments out in time. Narration cues run one after another
// inside their segment, and the segment lasts as long as its narration needs,
// so the visuals always stay in step with the voice.

import { createHash } from 'node:crypto';

export function voiceKey(text, voice, speed) {
  return createHash('sha1').update(`${voice}|${speed}|${text}`).digest('hex').slice(0, 16);
}

// Every distinct line the narrator says, for the TTS step.
export function collectCues(spec) {
  const out = new Map();
  for (const s of spec.segments) {
    for (const c of s.cues ?? []) {
      const speed = c.speed ?? spec.meta.speed;
      const key = voiceKey(c.say ?? c.text, spec.meta.voice, speed);
      out.set(key, { key, text: c.say ?? c.text, voice: spec.meta.voice, speed });
    }
  }
  return [...out.values()];
}

export function buildTimeline(spec, durations) {
  let t = 0;
  const segments = [];
  const voice = [];
  const sfx = [];
  for (const s of spec.segments) {
    const lead = s.lead ?? 0.7;
    const gapDefault = s.gap ?? 0.5;
    const tail = s.tail ?? 1.1;
    let cursor = lead;
    let natural = 0;
    const cues = (s.cues ?? []).map((c, i) => {
      const speed = c.speed ?? spec.meta.speed;
      const key = voiceKey(c.say ?? c.text, spec.meta.voice, speed);
      const d = durations[key];
      if (d == null) throw new Error(`No narration audio for "${c.text}". Run the tts step.`);
      const start = c.at != null ? c.at : Math.max(cursor, c.after ?? 0);
      const cue = { ...c, id: `${s.id}.${i}`, key, start, dur: d, end: start + d };
      if (c.at == null) {
        cursor = start + d + (c.gap ?? gapDefault);
        natural = Math.max(natural, start + d + tail);
      }
      return cue;
    });
    const dur = typeof s.dur === 'function' ? s.dur(cues) : s.dur ?? Math.max(s.min ?? 0, natural);
    const seg = { ...s, start: t, dur, cues };
    // Helpers for scenes: local start/end time of cue i.
    seg.c = (i) => cues[i]?.start ?? 0;
    seg.e = (i) => cues[i]?.end ?? 0;
    segments.push(seg);
    for (const c of cues) {
      voice.push({ key: c.key, t: t + c.start, dur: c.dur, text: c.text, gain: c.gain ?? 1, caption: c.caption !== false });
    }
    for (const e of s.sfx?.(seg) ?? []) sfx.push({ ...e, t: t + e.t });
    t += dur;
  }
  return { segments, voice, sfx, duration: t };
}

export function findSegment(tl, t) {
  // Binary search over segment starts.
  const s = tl.segments;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].start <= t) lo = mid; else hi = mid - 1;
  }
  return s[lo];
}

const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, '0');
const stamp = (t) => `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)},${pad((t % 1) * 1000, 3)}`;

export function toSrt(tl) {
  return tl.voice
    .filter((v) => v.caption)
    .map((v, i) => `${i + 1}\n${stamp(v.t)} --> ${stamp(v.t + v.dur + 0.3)}\n${v.text}\n`)
    .join('\n');
}
