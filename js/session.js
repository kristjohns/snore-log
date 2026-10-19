// One night of listening: microphone -> analyzer -> stored minutes and clips.
import { Listener, RATE } from "./listener.js";
import { CLIP, NightAnalyzer, SENSITIVITY, clipLength, summarize } from "./analysis.js";
import { encodeWav, normalize, peakDb } from "./wav.js";
import * as db from "./db.js";

const SAVE_EVERY_MS = 60_000;
const CLIP_GAP_S = 5 * 60; // at most one clip started per five minutes
const MAX_CLIPS = 40; // per night; louder clips replace quieter ones

export function newNight({ tags = [], settings }) {
  const start = Date.now();
  return { id: String(start), start, end: null, lastBeat: start, status: "recording", tags, note: "", sensitivity: settings.sensitivity, minutes: [] };
}

export class NightSession {
  constructor(night, settings) {
    this.night = night;
    this.settings = settings;
    this.listener = new Listener();
    this.analyzer = new NightAnalyzer({ threshold: SENSITIVITY[night.sensitivity] ?? SENSITIVITY.normal, minutes: night.minutes });
    this.state = "starting";
    this.lastDb = -120;
    this.lastClipS = -Infinity;
    this.clip = null; // clip being recorded: { startS, floorDb, score }
    this.clips = [];
    this.onChange = null; // called when state, level or counts change
  }

  get snores() {
    return this.analyzer.totalEvents;
  }

  get floorDb() {
    return this.analyzer.floor.value;
  }

  async start() {
    const existing = await db.clipsForNight(this.night.id);
    this.clips = existing.map((c) => ({ id: c.id, peak: c.peakAboveRoom }));
    if (existing.length) this.lastClipS = (existing[existing.length - 1].time - this.night.start) / 1000;

    const sec = (ms) => (ms - this.night.start) / 1000;
    this.listener.onLevel = (ms, dbfs) => {
      this.lastDb = dbfs;
      this.lastLevelAt = ms;
      this.analyzer.level(sec(ms), dbfs);
      this.onChange?.();
    };
    this.listener.onFrame = (ms, snore, label, score) => {
      this.analyzer.frame(sec(ms), snore, label, score);
      this.continueClip(sec(ms));
    };
    this.listener.onState = (state) => {
      this.state = state;
      this.onChange?.();
    };
    this.analyzer.onEventStart = (e) => this.startClip(e);

    await this.listener.start();
    await this.save();
    this.timer = setInterval(() => this.save(), SAVE_EVERY_MS);
  }

  async resume() {
    await this.listener.resume();
  }

  async save() {
    this.night.lastBeat = Date.now();
    this.night.minutes = this.analyzer.minutes;
    await db.putNight(this.night);
  }

  async stop() {
    clearInterval(this.timer);
    this.analyzer.finish();
    if (this.clip && this.lastLevelAt) {
      const c = this.clip;
      this.clip = null;
      const length = Math.min(CLIP.max, (this.lastLevelAt - this.night.start) / 1000 - c.startS);
      await this.saveClip(c, this.listener.recent(Math.round(length * RATE)));
    }
    this.listener.stop();
    this.night.end = Date.now();
    this.night.status = "done";
    this.night.minutes = this.analyzer.minutes;
    this.night.summary = summarize(this.night);
    await db.putNight(this.night);
    return this.night;
  }

  startClip(event) {
    if (!this.settings.saveClips || this.clip || event.start - this.lastClipS < CLIP_GAP_S) return;
    this.lastClipS = event.start;
    this.clip = { startS: event.start - CLIP.before, floorDb: event.floorDb, score: event.peakScore };
  }

  // Saves the clip once the snoring has stopped, or when it reaches the 30 s limit.
  continueClip(nowS) {
    const c = this.clip;
    if (!c) return;
    // Recording was interrupted (screen locked) while the clip was running: drop it.
    if (nowS - c.startS > CLIP.max + 5) {
      this.clip = null;
      return;
    }
    const length = clipLength(c.startS, nowS, this.analyzer.lastSnoreT);
    if (length === null) return;
    this.clip = null;
    const recorded = this.listener.recent(Math.round((nowS - c.startS) * RATE));
    this.saveClip(c, recorded.subarray(0, Math.round(length * RATE))).catch(console.error);
  }

  async saveClip(c, samples) {
    const peak = Math.round(peakDb(samples, RATE) - c.floorDb);
    if (this.clips.length >= MAX_CLIPS) {
      const quietest = this.clips.reduce((a, b) => (b.peak < a.peak ? b : a));
      if (quietest.peak >= peak) return;
      await db.deleteClip(quietest.id);
      this.clips = this.clips.filter((x) => x !== quietest);
    }
    const time = Math.round(this.night.start + c.startS * 1000);
    const clip = {
      id: `${this.night.id}-${time}`,
      nightId: this.night.id,
      time,
      duration: samples.length / RATE,
      peakAboveRoom: peak,
      score: c.score,
      blob: encodeWav(normalize(samples), RATE),
    };
    await db.putClip(clip);
    this.clips.push({ id: clip.id, peak });
  }
}
