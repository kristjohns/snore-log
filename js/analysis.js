// Turns the detector's raw output (loudness every 100 ms, a YAMNet score every 0.5 s)
// into snore events, per-minute buckets and a night summary.
// No browser APIs here, so the logic can be tested in Node.

export const HOP_S = 0.5;

// Minimum YAMNet "Snoring" score for a 0.975 s window to count as a snore.
export const SENSITIVITY = { low: 0.5, normal: 0.3, high: 0.15 };

// A minute counts as snoring when it holds at least this much snoring. One stray
// snore-like sound is not enough; snoring repeats with each breath.
const MIN_EVENTS_PER_MINUTE = 2;
const MIN_SNORE_FRAMES_PER_MINUTE = 3;

// Loudness of a snoring minute, in dB above the room's background noise.
export const TIERS = [
  { id: 1, name: "Light", min: -Infinity },
  { id: 2, name: "Moderate", min: 15 },
  { id: 3, name: "Loud", min: 25 },
];

// Labels that describe the room rather than something that happened in it.
const BACKGROUND_LABELS = new Set([
  "Silence", "Inside, small room", "Inside, large room or hall", "White noise", "Pink noise",
  "Static", "Hum", "Mains hum", "Noise", "Environmental noise", "Outside, rural or natural",
  "Outside, urban or manmade", "Snoring",
]);
const OTHER_SOUND_MARGIN_DB = 15;
const OTHER_SOUND_MIN_SCORE = 0.3;
const NEAR_SNORE_S = 3;

export function tierFor(dbAboveRoom) {
  let tier = TIERS[0];
  for (const t of TIERS) if (dbAboveRoom >= t.min) tier = t;
  return tier.id;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// Background level: the 20th percentile of each second's quietest 100 ms over the
// last five minutes. Snores, fans switching on and passing cars barely move it.
export class NoiseFloor {
  constructor(windowSeconds = 300) {
    this.windowSeconds = windowSeconds;
    this.secondMins = [];
    this.current = Infinity;
    this.count = 0;
    this.value = null;
  }

  push(db) {
    this.current = Math.min(this.current, db);
    if (this.value === null) this.value = db;
    if (++this.count < 10) return;
    this.secondMins.push(this.current);
    if (this.secondMins.length > this.windowSeconds) this.secondMins.shift();
    this.current = Infinity;
    this.count = 0;
    this.value = percentile(this.secondMins, 0.2);
  }
}

export function emptyMinute(i) {
  return { i, frames: 0, snoreFrames: 0, events: 0, maxDb: -120, snorePeakDb: -120, floorDb: null, sounds: {} };
}

// Consumes one night of detector output. Times are seconds since the night started.
export class NightAnalyzer {
  constructor({ threshold = SENSITIVITY.normal, minutes = [] } = {}) {
    this.threshold = threshold;
    this.floor = new NoiseFloor();
    this.minutes = minutes; // sparse array indexed by minute
    this.event = null; // snore event in progress
    this.sound = null; // other loud sound in progress
    this.lastSnoreT = -Infinity;
    this.recentLevels = []; // [t, db] for the last ~1.5 s
    this.totalEvents = minutes.reduce((n, m) => n + (m ? m.events : 0), 0);
    this.onEventStart = null;
    this.onEventEnd = null;
  }

  minute(t) {
    const i = Math.floor(t / 60);
    return this.minutes[i] || (this.minutes[i] = emptyMinute(i));
  }

  level(t, db) {
    this.floor.push(db);
    const m = this.minute(t);
    if (db > m.maxDb) m.maxDb = db;
    m.floorDb = this.floor.value;
    this.recentLevels.push([t, db]);
    while (this.recentLevels.length && this.recentLevels[0][0] < t - 1.5) this.recentLevels.shift();
  }

  // Loudest 100 ms reading inside the window that ended at t.
  windowPeak(t) {
    let peak = -120;
    for (const [lt, db] of this.recentLevels) if (lt > t - 1 && lt <= t && db > peak) peak = db;
    return peak;
  }

  // One classification of the 0.975 s window ending at t.
  frame(t, snoreScore, label = "", labelScore = 0) {
    const m = this.minute(t);
    m.frames++;
    const peak = this.windowPeak(t);
    const floor = this.floor.value ?? peak;

    if (snoreScore >= this.threshold) {
      m.snoreFrames++;
      if (peak > m.snorePeakDb) m.snorePeakDb = peak;
      if (this.event && t - this.event.lastT <= 2 * HOP_S + 0.01) {
        this.event.lastT = t;
        this.event.peakScore = Math.max(this.event.peakScore, snoreScore);
        this.event.peakDb = Math.max(this.event.peakDb, peak);
      } else {
        this.closeEvent();
        this.event = { start: t - 0.975, lastT: t, peakScore: snoreScore, peakDb: peak, floorDb: floor };
        m.events++;
        this.totalEvents++;
        this.onEventStart?.(this.event);
      }
    } else if (this.event && t - this.event.lastT > 2 * HOP_S + 0.01) {
      this.closeEvent();
    }

    // Other loud sounds (coughs, talking, a dog) for the report. Consecutive loud frames
    // are one sound, named by its most confident label.
    if (this.sound && t - this.sound.lastT > NEAR_SNORE_S) this.closeSound();
    if (snoreScore >= this.threshold) this.lastSnoreT = t;
    else if (!BACKGROUND_LABELS.has(label) && labelScore >= OTHER_SOUND_MIN_SCORE && peak >= floor + OTHER_SOUND_MARGIN_DB) {
      if (this.sound && t - this.sound.lastT <= 2 * HOP_S + 0.01) {
        this.sound.lastT = t;
        if (labelScore > this.sound.score) Object.assign(this.sound, { label, score: labelScore });
      } else {
        this.closeSound();
        this.sound = { label, score: labelScore, start: t - 0.975, lastT: t };
      }
    }
  }

  closeEvent() {
    if (!this.event) return;
    const e = this.event;
    this.event = null;
    this.onEventEnd?.({ ...e, end: e.lastT });
  }

  // Sounds right before, during or after snoring are part of the snoring (breaths, snorts).
  closeSound() {
    const s = this.sound;
    if (!s) return;
    this.sound = null;
    if (this.lastSnoreT >= s.start - NEAR_SNORE_S) return;
    const m = this.minute(s.start);
    m.sounds[s.label] = (m.sounds[s.label] || 0) + 1;
  }

  // Call when the night ends.
  finish() {
    this.closeEvent();
    this.closeSound();
  }
}

export function isSnoringMinute(m) {
  return !!m && m.events >= MIN_EVENTS_PER_MINUTE && m.snoreFrames >= MIN_SNORE_FRAMES_PER_MINUTE;
}

export function minuteTier(m) {
  if (!isSnoringMinute(m)) return 0;
  return tierFor(m.snorePeakDb - (m.floorDb ?? m.snorePeakDb));
}

// Everything the night report shows, from the stored minutes.
export function summarize(night) {
  const minutes = night.minutes || [];
  const total = Math.max(minutes.length, Math.ceil(((night.end || night.lastBeat || night.start) - night.start) / 60000));
  let recorded = 0, snoring = 0, events = 0, loudest = null;
  const tiers = { 1: 0, 2: 0, 3: 0 };
  const sounds = {};
  const gaps = [];
  let gapStart = null;
  for (let i = 0; i < total; i++) {
    const m = minutes[i];
    const rec = m && m.frames > 0;
    if (!rec && gapStart === null) gapStart = i;
    if (rec && gapStart !== null) { gaps.push([gapStart, i]); gapStart = null; }
    if (!m) continue;
    recorded += Math.min(1, m.frames / (60 / HOP_S));
    events += m.events;
    for (const [label, n] of Object.entries(m.sounds || {})) sounds[label] = (sounds[label] || 0) + n;
    if (isSnoringMinute(m)) {
      snoring++;
      const above = m.snorePeakDb - (m.floorDb ?? m.snorePeakDb);
      tiers[tierFor(above)]++;
      if (loudest === null || above > loudest) loudest = above;
    }
  }
  if (gapStart !== null && gapStart < total) gaps.push([gapStart, total]);

  // Episodes: runs of snoring minutes, allowing breaks of up to two quiet minutes.
  const episodes = [];
  let ep = null;
  for (let i = 0; i < total; i++) {
    if (isSnoringMinute(minutes[i])) {
      if (ep && i - ep.end <= 3) { ep.end = i + 1; ep.snoring++; }
      else { ep = { start: i, end: i + 1, snoring: 1 }; episodes.push(ep); }
    }
  }
  const longest = episodes.reduce((a, e) => Math.max(a, e.end - e.start), 0);

  return {
    totalMin: total,
    recordedMin: Math.round(recorded),
    snoringMin: snoring,
    snoringPct: recorded > 0 ? snoring / recorded : 0,
    tiers,
    events,
    loudestDb: loudest === null ? null : Math.round(loudest),
    episodes: episodes.length,
    longestEpisodeMin: longest,
    gaps,
    sounds: Object.entries(sounds).sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

// Groups minutes into bins for the timeline chart.
export function timelineBins(night, binMin) {
  const minutes = night.minutes || [];
  const total = summarize(night).totalMin;
  const bins = [];
  for (let s = 0; s < total; s += binMin) {
    let snoring = 0, recorded = 0, tier = 0;
    for (let i = s; i < Math.min(total, s + binMin); i++) {
      const m = minutes[i];
      if (m && m.frames > 0) recorded++;
      if (isSnoringMinute(m)) { snoring++; tier = Math.max(tier, minuteTier(m)); }
    }
    bins.push({ start: s, len: Math.min(binMin, total - s), snoring, recorded, tier });
  }
  return bins;
}

// For each factor tag, average snoring share on nights with and without it.
export function factorEffects(nights) {
  const done = nights.filter((n) => n.summary && n.summary.recordedMin >= 60);
  const tags = new Set(done.flatMap((n) => n.tags || []));
  const avg = (list) => list.reduce((a, n) => a + n.summary.snoringPct, 0) / list.length;
  const rows = [];
  for (const tag of tags) {
    const withTag = done.filter((n) => (n.tags || []).includes(tag));
    const without = done.filter((n) => !(n.tags || []).includes(tag));
    if (withTag.length < 1 || without.length < 1) continue;
    rows.push({ tag, withPct: avg(withTag), withoutPct: avg(without), withN: withTag.length, withoutN: without.length });
  }
  return rows.sort((a, b) => Math.abs(b.withPct - b.withoutPct) - Math.abs(a.withPct - a.withoutPct));
}
