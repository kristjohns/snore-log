// node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIP, NightAnalyzer, clipLength, summarize, factorEffects, timelineBins, isSnoringMinute } from "../js/analysis.js";

// Simulates a night: quiet room at -60 dBFS, with `sound(t)` returning
// { db, snore, label, score } for louder moments.
function simulate(minutes, sound, opts) {
  const a = new NightAnalyzer(opts);
  for (let k = 1; k < minutes * 600; k++) {
    const t = k / 10;
    const s = sound(t);
    a.level(t, s ? s.db : -60 + Math.sin(k) * 0.5);
    if (k % 5 === 0 && t >= 1) {
      // A window counts as snoring when the sound fills enough of the last 0.975 s.
      const w = sound(t - 0.3);
      a.frame(t, w ? w.snore : 0.01, w ? w.label : "Silence", w ? w.score : 0.8);
    }
  }
  a.finish();
  return a;
}

// Snores every 4 s, each lasting 1.5 s, 30 dB above the room.
const snoring = (t) => (t % 4 < 1.5 ? { db: -30, snore: 0.9, label: "Snoring", score: 0.9 } : null);

test("rhythmic snoring counts as snoring minutes, a single snore does not", () => {
  const a = simulate(10, (t) => {
    if (t >= 120 && t < 300) return snoring(t);
    if (t >= 420 && t < 421.5) return { db: -40, snore: 0.9, label: "Snoring", score: 0.9 };
    if (t >= 480 && t < 481) return { db: -35, snore: 0.0, label: "Cough", score: 0.8 };
    return null;
  });
  const night = { start: 0, end: 600000, minutes: a.minutes };
  const s = summarize(night);
  assert.equal(s.snoringMin, 3);
  assert.deepEqual([2, 3, 4].map((i) => isSnoringMinute(a.minutes[i])), [true, true, true]);
  assert.equal(isSnoringMinute(a.minutes[7]), false);
  assert.equal(s.episodes, 1);
  assert.equal(s.longestEpisodeMin, 3);
  assert.equal(s.tiers[3], 3, "30 dB above the room is loud");
  assert.equal(s.loudestDb, 30);
  assert.deepEqual(s.sounds, [["Cough", 1]]);
  assert.equal(s.recordedMin, 10);
  assert.ok(Math.abs(s.snoringPct - 0.3) < 0.01);
  // 45 snores in minutes 2-4 plus the single one in minute 7.
  assert.equal(s.events, 46);
});

test("quiet snoring is a lighter tier", () => {
  const a = simulate(5, (t) => (t >= 60 && t < 240 && t % 4 < 1.5 ? { db: -50, snore: 0.6, label: "Snoring", score: 0.6 } : null));
  const s = summarize({ start: 0, end: 300000, minutes: a.minutes });
  assert.equal(s.snoringMin, 3);
  assert.equal(s.tiers[1], 3);
});

test("sensitivity threshold filters weak scores", () => {
  const weak = (t) => (t % 4 < 1.5 ? { db: -40, snore: 0.2, label: "Breathing", score: 0.5 } : null);
  assert.equal(summarize({ start: 0, end: 180000, minutes: simulate(3, weak, { threshold: 0.3 }).minutes }).snoringMin, 0);
  assert.equal(summarize({ start: 0, end: 180000, minutes: simulate(3, weak, { threshold: 0.15 }).minutes }).snoringMin, 3);
});

test("minutes without audio are reported as gaps", () => {
  const a = simulate(3, () => null);
  const minutes = [...a.minutes];
  minutes[5] = a.minutes[2];
  const s = summarize({ start: 0, end: 6 * 60000, minutes });
  assert.deepEqual(s.gaps, [[3, 5]]);
  const bins = timelineBins({ start: 0, end: 6 * 60000, minutes }, 2);
  assert.deepEqual(bins.map((b) => b.recorded), [2, 1, 1]);
});

test("factor effects compare nights with and without a tag", () => {
  const n = (pct, tags) => ({ tags, summary: { recordedMin: 400, snoringPct: pct } });
  const rows = factorEffects([n(0.3, ["Alcohol"]), n(0.2, ["Alcohol"]), n(0.1, []), n(0.05, ["Nasal strip"])]);
  const alcohol = rows.find((r) => r.tag === "Alcohol");
  assert.equal(alcohol.withN, 2);
  assert.ok(Math.abs(alcohol.withPct - 0.25) < 1e-9);
  assert.ok(Math.abs(alcohol.withoutPct - 0.075) < 1e-9);
  assert.equal(rows[0].tag, "Alcohol");
});

test("loud frames next to snoring are not other sounds; one bark with two labels counts once", () => {
  const a = simulate(4, (t) => {
    if (t >= 60 && t < 120) {
      if (t % 4 < 1.5) return { db: -30, snore: 0.9, label: "Snoring", score: 0.9 };
      if (t % 4 < 2.5) return { db: -35, snore: 0.05, label: "Breathing", score: 0.7 };
    }
    if (t >= 180 && t < 182) return { db: -30, snore: 0, label: t < 181 ? "Animal" : "Dog", score: t < 181 ? 0.9 : 0.8 };
    return null;
  });
  assert.deepEqual(summarize({ start: 0, end: 240000, minutes: a.minutes }).sounds, [["Animal", 1]]);
});

test("clips follow the snoring, between 12 and 30 seconds", () => {
  // Clip starts 4 s before the first snore at 0 s.
  const start = -CLIP.before;
  // A single snore: the clip ends at the 12 s minimum.
  assert.equal(clipLength(start, 5, 1), null);
  assert.equal(clipLength(start, 8, 1), 12);
  // Snoring for 14 s: kept going while snores keep coming, ends 3 s after the last one.
  assert.equal(clipLength(start, 14, 13), null, "still snoring");
  assert.equal(clipLength(start, 18, 14), null, "pause between breaths");
  assert.equal(clipLength(start, 20, 14), 21);
  // Snoring that goes on: cut at 30 s.
  assert.equal(clipLength(start, 26, 25.5), 30);
});

test("the version shown in Settings matches the service worker's", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal(html.match(/>Version (\d+)</)[1], sw.match(/const VERSION = "v(\d+)"/)[1]);
});
