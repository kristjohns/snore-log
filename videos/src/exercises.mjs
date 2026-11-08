// Video 2: a follow-along routine of the oropharyngeal exercises used in the
// snoring trial (Ieto et al., Chest 2015), plus two extras from the earlier
// sleep apnea trial (Guimarães et al., AJRCCM 2009). Every repetition and hold
// runs in real time.

import { clamp, lerp, ease, prog, window as win } from './lib/anim.mjs';
import {
  C, W, H, text, card, pill, ring, arrow, drawGlow, rgba, mix, roundRect, DISPLAY, sparkle, soundWaves,
} from './lib/draw.mjs';
import { drawHead, defaultState } from './lib/anatomy.mjs';
import { drawFace, faceDefaults } from './lib/face.mjs';
import { icon, badge } from './lib/icons.mjs';
import { headline, checkRow, badgeRow } from './lib/ui.mjs';

export const meta = {
  name: 'snoring-exercises',
  title: 'Snoring exercise routine: follow along',
  voice: 'af_heart',
  speed: 0.95,
  mix: { musicGain: 0.42, duckTo: 0.45, sfxGain: 0.8 },
};

const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];

// ---------- the exercises ----------
// phases: [label, seconds, effort from, effort to]. Effort 0..1 drives the pose.

const EX = [
  {
    id: 'slide', name: 'Tongue slide', icon: 'tongue', reps: 20,
    steps: ['Tongue tip on the ridge behind your top front teeth', 'Slide it back along the roof of your mouth', 'Bring it forward again'],
    say: 'Exercise one: the tongue slide. Put the tip of your tongue on the roof of your mouth, just behind your top front teeth. Slide it backward along the roof of your mouth, as far as it comfortably goes, then bring it forward again. We’ll do twenty.',
    phases: [['Tip behind teeth', 0.4, 0, 0], ['Slide back', 1.1, 0, 1], ['Hold', 0.4, 1, 1], ['Forward', 0.8, 1, 0], ['', 0.3, 0, 0]],
    head: (e) => ({ tipUp: 1, slide: e, glowTongue: 0.35 + 0.65 * e }),
    face: (e) => ({ open: 0.5, tongueUp: 1 - 0.35 * e }),
    target: 'Tongue',
  },
  {
    id: 'suck', name: 'Tongue press', icon: 'tongue', reps: 20,
    steps: ['Suck your whole tongue up against the roof of your mouth', 'Press it flat and firm', 'Let go'],
    say: 'Exercise two: the tongue press. Suck your whole tongue up against the roof of your mouth, so it lies flat against it, and press firmly. Hold for a moment, then let go. Twenty times.',
    phases: [['Suck up', 0.6, 0, 1], ['Press', 1.4, 1, 1], ['Release', 0.6, 1, 0], ['', 0.4, 0, 0]],
    head: (e) => ({ suck: e, glowTongue: e }),
    face: (e) => ({ open: 0.5, tongueSuck: e, tongue: 1 - e }),
    target: 'Tongue',
  },
  {
    id: 'down', name: 'Tongue push-down', icon: 'tongue', reps: 20,
    steps: ['Tongue tip touching your bottom front teeth', 'Push the back of your tongue down to the floor of your mouth', 'Relax'],
    say: 'Exercise three: the tongue push-down. Keep the tip of your tongue touching the back of your bottom front teeth. Now push the back of your tongue down, against the floor of your mouth. Then relax. Twenty times.',
    phases: [['Push down', 0.7, 0, 1], ['Hold', 1.3, 1, 1], ['Relax', 0.6, 1, 0], ['', 0.4, 0, 0]],
    head: (e) => ({ down: e, jaw: 0.35, glowTongue: e }),
    face: (e) => ({ open: 0.55, tongueDown: e, tongue: 1 }),
    target: 'Back of the tongue',
  },
  {
    id: 'ah', name: 'Soft palate lift', icon: 'palate', reps: 20,
    steps: ['Open your mouth', 'Say a short, strong “AH”', 'Feel the back of the roof of your mouth lift'],
    say: 'Exercise four: the soft palate lift. Open your mouth and say a short, strong “Ah”. You should feel the back of the roof of your mouth lift up. Say it on every count, twenty times.',
    phases: [['“AH!”', 0.35, 0, 1], ['Hold', 0.65, 1, 1], ['Relax', 0.6, 1, 0], ['', 0.9, 0, 0]],
    head: (e) => ({ lift: e, jaw: 0.35 + 0.65 * e, glowPalate: e }),
    face: (e) => ({ open: 0.3 + 0.7 * e, uvulaLift: e, tongue: 1 }),
    target: 'Soft palate',
  },
  {
    id: 'cheek', name: 'Cheek press', icon: 'cheek', reps: 10, sides: true,
    steps: ['Hook a clean finger inside your cheek', 'Gently push the cheek outward', 'Squeeze the cheek back in against the finger'],
    say: 'Exercise five: the cheek press. Hook a clean finger inside your cheek, and gently push the cheek outward. Now squeeze your cheek muscle back in, against the finger. Then relax. Ten times on the right side, then ten on the left.',
    phases: [['Squeeze in', 0.6, 0, 1], ['Hold', 1.2, 1, 1], ['Relax', 0.6, 1, 0], ['', 0.6, 0, 0]],
    target: 'Cheek muscle',
  },
];

const EXTRAS = [
  {
    id: 'lips', name: 'Lip press', icon: 'lips', hold: 30,
    steps: ['Close your lips', 'Press them firmly together', 'Hold for 30 seconds'],
    say: 'Extra one: the lip press. Close your lips and press them firmly together. Hold the pressure for thirty seconds.',
    target: 'Lip muscles',
  },
  {
    id: 'balloon', name: 'Balloon breaths', icon: 'balloon', reps: 5,
    steps: ['Balloon between your lips', 'Breathe in deeply through your nose', 'Blow hard into the balloon'],
    say: 'Extra two, if you have a balloon. Keep it between your lips the whole time. Breathe in deeply through your nose, then blow out hard into the balloon. Five breaths.',
    phases: [['Breathe in through your nose', 3.5, 0, 0], ['Blow!', 3.2, 0, 1], ['', 1.3, 1, 1]],
    target: 'Breathing muscles',
  },
];

const ALL = [...EX, ...EXTRAS];
const periodOf = (ex) => ex.phases.reduce((s, p) => s + p[1], 0);
const SWITCH = 5; // seconds to swap sides in the cheek exercise

function effortAt(ex, u) {
  // u: seconds into the repetition → [effort, phaseIndex, phaseProgress]
  let t = 0;
  for (let i = 0; i < ex.phases.length; i++) {
    const [, d, a, b] = ex.phases[i];
    if (u < t + d || i === ex.phases.length - 1) {
      const p = clamp((u - t) / d);
      return [lerp(a, b, ease.inOutSine(p)), i, p];
    }
    t += d;
  }
  return [0, 0, 0];
}

function repsDuration(ex) {
  if (ex.hold) return ex.hold;
  const per = periodOf(ex);
  return ex.sides ? ex.reps * per * 2 + SWITCH : ex.reps * per;
}

// Where are we inside an exercise's active time?
function repState(ex, lt) {
  if (ex.hold) return { rep: 0, side: 0, effort: clamp(lt / 0.6) * (1 - clamp((lt - ex.hold + 0.5) / 0.5)), phase: 0, pp: lt / ex.hold, switching: false };
  const per = periodOf(ex);
  let t = lt, side = 0, switching = false;
  if (ex.sides) {
    const half = ex.reps * per;
    if (t >= half && t < half + SWITCH) switching = true;
    if (t >= half + SWITCH) { side = 1; t -= half + SWITCH; }
    else if (switching) t = half - 0.001;
  }
  const rep = Math.min(ex.reps - 1, Math.floor(t / per));
  const [effort, phase, pp] = effortAt(ex, t - rep * per);
  return { rep, side, effort: switching ? 0 : effort, phase, pp, switching, per };
}

// ---------- drawing pieces ----------

const VIEW = { x: 60, y: 170, w: 940, h: 840 };
const HEAD_FOCUS = [430, 485];
const HEAD_ZOOM = 1.55;

function insideView(ctx, state, lt, opts = {}) {
  const { label = 'INSIDE VIEW', target = null, alpha = 1, focus = HEAD_FOCUS, zoom = HEAD_ZOOM } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, { fill: 'rgba(8,12,34,0.75)' });
  ctx.save();
  roundRect(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 28);
  ctx.clip();
  ctx.translate(VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h / 2 + 20);
  ctx.scale(zoom, zoom);
  ctx.translate(-focus[0], -focus[1]);
  drawHead(ctx, { ...defaultState(), brain: 0.0, ...state }, lt);
  ctx.restore();
  pill(ctx, VIEW.x + 30, VIEW.y + 40, label, { size: 18, color: C.muted, fill: 'rgba(8,12,34,0.85)' });
  if (target) pill(ctx, VIEW.x + VIEW.w - 30, VIEW.y + 40, `Working: ${target}`, { size: 18, color: C.amber, align: 'right', fill: 'rgba(8,12,34,0.85)' });
  ctx.restore();
}

// Top-down view of the mouth for the cheek exercise.
function cheekDiagram(ctx, effort, side, lt, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, { fill: 'rgba(8,12,34,0.75)' });
  const cx = VIEW.x + VIEW.w / 2, cy = VIEW.y + VIEW.h / 2 + 10;
  const s = side === 0 ? 1 : -1; // which cheek (screen side)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.74, 0.74);
  ctx.translate(-cx, -cy);
  // Face outline from above
  ctx.fillStyle = '#d9a084';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 40, 330, 360, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9b49a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 40, 300, 330, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mouth cavity (dark), front is up
  const push = (k) => (k === s ? 34 * (1 - 0.55 * effort) : 0);
  ctx.fillStyle = '#3a0c18';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 250);
  ctx.bezierCurveTo(cx + 200 + push(1), cy - 240, cx + 230 + push(1), cy + 60, cx + 170, cy + 200);
  ctx.lineTo(cx - 170, cy + 200);
  ctx.bezierCurveTo(cx - 230 - push(-1), cy + 60, cx - 200 - push(-1), cy - 240, cx, cy - 250);
  ctx.fill();
  // Cheek muscle bands (buccinator)
  for (const k of [-1, 1]) {
    const active = k === s;
    const g = active ? effort : 0;
    ctx.save();
    ctx.strokeStyle = mix('#c4505f', '#ff8a6a', g);
    ctx.lineWidth = 36 + g * 10;
    ctx.lineCap = 'round';
    if (active) { ctx.shadowColor = C.amber; ctx.shadowBlur = 40 * g; }
    ctx.beginPath();
    ctx.moveTo(cx + k * 150, cy - 210);
    ctx.bezierCurveTo(cx + k * (250 + push(k)), cy - 150, cx + k * (262 + push(k)), cy + 40, cx + k * 200, cy + 190);
    ctx.stroke();
    ctx.restore();
    // fibre lines
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * (160 + i * 4), cy - 190 + i * 6);
      ctx.bezierCurveTo(cx + k * (240 + push(k) + i * 6), cy - 130, cx + k * (250 + push(k) + i * 6), cy + 40, cx + k * (195 + i * 3), cy + 170);
      ctx.stroke();
    }
  }
  // Teeth arch
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (0.08 + (i / 13) * 0.84);
    const tx = cx - Math.cos(a) * 170, ty = cy + 120 - Math.sin(a) * 300;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-a + Math.PI / 2);
    ctx.fillStyle = '#fbfaf5';
    roundRect(ctx, -16, -12, 32, 24, 8);
    ctx.fill();
    ctx.restore();
  }
  // Tongue
  const tg = ctx.createRadialGradient(cx, cy, 20, cx, cy + 40, 160);
  tg.addColorStop(0, '#f0858c');
  tg.addColorStop(1, '#c84a5c');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 50, 110, 170, 0, 0, Math.PI * 2);
  ctx.fill();
  // Finger between teeth and cheek
  const fx = cx + s * (210 + push(s) * 0.6), fy = cy - 60;
  ctx.fillStyle = '#eab093';
  ctx.strokeStyle = '#c98f74';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(fx, fy - 40, 28, 120, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f6c9b1';
  ctx.beginPath();
  ctx.ellipse(fx + s * 2, fy - 140, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arrows: finger pushes out, muscle squeezes in
  const ax = cx + s * 330;
  arrow(ctx, fx + s * 30, fy + 60, ax + s * 40, fy + 60, { color: '#c9d0f0', width: 7, head: 20, alpha: 0.85 });
  arrow(ctx, ax + s * 150, fy - 20, ax + s * 50, fy - 20, { color: C.amber, width: 9, head: 24, alpha: 0.3 + 0.7 * effort });
  ctx.restore();
  text(ctx, 'FRONT OF THE MOUTH', cx, VIEW.y + 100, { size: 18, color: C.dim, align: 'center', tracking: 3 });
  // Legend
  const ly = VIEW.y + VIEW.h - 46;
  arrow(ctx, VIEW.x + 60, ly, VIEW.x + 120, ly, { color: '#c9d0f0', width: 6, head: 16 });
  text(ctx, 'Finger pushes the cheek out', VIEW.x + 140, ly + 8, { size: 24, color: C.muted });
  arrow(ctx, VIEW.x + 560, ly, VIEW.x + 500, ly, { color: C.amber, width: 7, head: 18, alpha: 0.4 + 0.6 * effort });
  text(ctx, 'Cheek squeezes in', VIEW.x + 580, ly + 8, { size: 24, weight: 700, color: C.amber, alpha: 0.6 + 0.4 * effort });
  pill(ctx, VIEW.x + 30, VIEW.y + 40, 'VIEW FROM ABOVE', { size: 18, color: C.muted, fill: 'rgba(8,12,34,0.85)' });
  pill(ctx, VIEW.x + VIEW.w - 30, VIEW.y + 40, 'Working: Cheek muscle', { size: 18, color: C.amber, align: 'right' });
  ctx.restore();
}

const MIRROR = { x: 1040, y: 170, w: 400, h: 470 };

function mirrorView(ctx, f, lt, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, { fill: 'rgba(30,38,90,0.6)' });
  ctx.save();
  roundRect(ctx, MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, 28);
  ctx.clip();
  ctx.translate(MIRROR.x + MIRROR.w / 2, MIRROR.y + MIRROR.h / 2 + 30);
  ctx.scale(0.66, 0.66);
  drawFace(ctx, { ...faceDefaults(), ...f }, lt);
  ctx.restore();
  pill(ctx, MIRROR.x + 24, MIRROR.y + 36, 'MIRROR VIEW', { size: 16, color: C.muted });
  ctx.restore();
}

const RING = { x: 1660, y: 405, r: 160 };

function poseFor(ex, effort, side = 0) {
  if (ex.id === 'cheek') {
    const fs = side === 0 ? 1 : -1;
    return {
      head: {},
      face: { finger: 1, fingerSide: fs, open: 0.12, [fs > 0 ? 'cheekR' : 'cheekL']: 1 - 0.6 * effort, glow: effort },
    };
  }
  if (ex.id === 'lips') return { head: { lips: effort, glowLips: effort }, face: { press: effort, glow: effort, glowAt: 'lips' } };
  if (ex.id === 'balloon') return { head: {}, face: {} };
  return { head: ex.head(effort), face: ex.face(effort) };
}

function balloonPose(lt, active) {
  // During the active part: inhale through the nose, then blow.
  const per = periodOf(EXTRAS[1]);
  const k = Math.min(4, Math.floor(lt / per));
  const u = lt - k * per;
  const [, phase, pp] = effortAt(EXTRAS[1], u);
  const inhale = phase === 0, blow = phase === 1;
  const before = 0.15 + k * 0.17;
  const size = active ? (blow ? before + 0.17 * ease.outCubic(pp) : phase === 2 ? before + 0.17 : before) : 0.15;
  return {
    head: {
      air: inhale ? Math.sin(Math.PI * pp) : 0, airSpeed: 1.6,
      lift: blow ? 1 : 0, glowPalate: blow ? Math.sin(Math.PI * pp) : 0, lips: blow ? 0.6 : 0.3, jaw: 0.08,
    },
    face: { balloon: size, cheekL: blow ? 0.5 : 0, cheekR: blow ? 0.5 : 0 },
    k, phase, pp,
  };
}

// The steps card with the current phase highlighted.
function stepsCard(ctx, ex, lt, opts = {}) {
  const { phaseLabel = null, phaseP = 0, alpha = 1, active = -1 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, 1040, 680, 820, 330);
  if (phaseLabel != null) {
    const pl = phaseLabel || ' ';
    text(ctx, pl.toUpperCase(), 1450, 790, { size: 64, weight: 800, family: DISPLAY, align: 'center', color: phaseLabel ? C.ink : C.dim, tracking: 2 });
    roundRect(ctx, 1110, 840, 680, 14, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    if (phaseLabel) {
      roundRect(ctx, 1110, 840, Math.max(14, 680 * clamp(phaseP)), 14, 7);
      ctx.fillStyle = C.amber;
      ctx.fill();
    }
    ex.steps.forEach((s, i) => {
      text(ctx, `${i + 1}. ${s}`, 1110, 910 + i * 34, { size: 22, color: i === active ? C.ink : C.dim, maxWidth: 700, weight: i === active ? 650 : 500 });
    });
  } else {
    ex.steps.forEach((s, i) => {
      const q = ease.outCubic(clamp((lt - 1.2 - i * 0.6) / 0.6));
      ctx.save();
      ctx.globalAlpha *= q;
      ctx.beginPath();
      ctx.arc(1110, 752 + i * 92, 24, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.air, 0.18);
      ctx.fill();
      text(ctx, String(i + 1), 1110, 761 + i * 92, { size: 24, weight: 700, color: C.air, align: 'center' });
      text(ctx, s, 1150, 762 + i * 92, { size: 29, weight: 550, maxWidth: 680, rise: (1 - q) * 14 });
      ctx.restore();
    });
  }
  ctx.restore();
}

function titleBlock(ctx, ex, lt, kicker) {
  const p = prog(lt, 0.1, 0.9);
  text(ctx, kicker, 64, 82, { size: 24, weight: 700, color: C.air, tracking: 4, alpha: p });
  text(ctx, ex.name, 64, 140, { size: 56, weight: 700, family: DISPLAY, alpha: p, rise: (1 - p) * 20 });
}

function kickerFor(ex) {
  const i = EX.indexOf(ex);
  if (i >= 0) return `EXERCISE ${i + 1} OF ${EX.length}`;
  return `EXTRA ${EXTRAS.indexOf(ex) + 1} OF ${EXTRAS.length}`;
}

// ---------- screens ----------

function demoEffort(ex, lt) {
  // Slow demonstration loop while the instructions are read.
  if (ex.hold) return clamp((lt - 1.5) / 0.8);
  const per = periodOf(ex) * 1.35;
  const u = ((lt - 1.0) % per + per) % per;
  return effortAt(ex, u / 1.35)[0];
}

function drawExIntro(ctx, lt, seg) {
  const ex = seg.ex;
  titleBlock(ctx, ex, lt, kickerFor(ex));
  const a = prog(lt, 0.2, 0.8);
  if (ex.id === 'balloon') {
    const bp = balloonPose(lt % 8, true);
    insideView(ctx, bp.head, lt, { target: ex.target, alpha: a });
    mirrorView(ctx, { ...bp.face, balloon: bp.face.balloon * 0.6 + 0.1 }, lt, a);
  } else {
    const e = demoEffort(ex, lt);
    const pose = poseFor(ex, e, 0);
    if (ex.id === 'cheek') cheekDiagram(ctx, e, 0, lt, a);
    else insideView(ctx, pose.head, lt, { target: ex.target, alpha: a });
    mirrorView(ctx, pose.face, lt, a);
  }
  // Ring shows what is coming
  ctx.save();
  ctx.globalAlpha *= a;
  ring(ctx, RING.x, RING.y, RING.r, 0, { width: 16 });
  const big = ex.hold ? `${ex.hold}` : `${ex.reps}${ex.sides ? '×2' : ''}`;
  text(ctx, big, RING.x, RING.y + 30, { size: 110, weight: 800, family: DISPLAY, align: 'center' });
  text(ctx, ex.hold ? 'seconds' : ex.sides ? 'each side' : ex.id === 'balloon' ? 'breaths' : 'repetitions', RING.x, RING.y + 80, { size: 26, color: C.muted, align: 'center' });
  ctx.restore();
  stepsCard(ctx, ex, lt, { alpha: a });
}

function drawReady(ctx, lt, seg) {
  const ex = seg.ex;
  titleBlock(ctx, ex, 5, kickerFor(ex));
  const pose = ex.id === 'balloon' ? balloonPose(0, false) : poseFor(ex, 0, 0);
  if (ex.id === 'cheek') cheekDiagram(ctx, 0, 0, lt);
  else insideView(ctx, pose.head, lt, { target: ex.target });
  mirrorView(ctx, pose.face, lt);
  ring(ctx, RING.x, RING.y, RING.r, 0, { width: 16 });
  const n = 3 - Math.floor(lt - 1.0);
  if (lt >= 1.0 && n >= 1) {
    const f = (lt - 1.0) % 1;
    const s = 1.4 - 0.4 * ease.outBack(clamp(f * 3));
    ctx.save();
    ctx.translate(RING.x, RING.y);
    ctx.scale(s, s);
    text(ctx, String(n), 0, 45, { size: 140, weight: 800, family: DISPLAY, align: 'center', color: C.amber, alpha: 1 - clamp((f - 0.7) / 0.3) });
    ctx.restore();
  } else {
    text(ctx, 'Get ready', RING.x, RING.y + 16, { size: 44, weight: 700, align: 'center', color: C.muted });
  }
  stepsCard(ctx, ex, 99, { phaseLabel: '', phaseP: 0 });
}

function drawReps(ctx, lt, seg) {
  const ex = seg.ex;
  titleBlock(ctx, ex, 5, kickerFor(ex));
  const total = repsDuration(ex);
  if (ex.id === 'balloon') {
    const bp = balloonPose(lt, true);
    insideView(ctx, bp.head, lt, { target: ex.target });
    mirrorView(ctx, bp.face, lt);
    ring(ctx, RING.x, RING.y, RING.r, lt / total, { width: 16, color: C.air });
    ring(ctx, RING.x, RING.y, RING.r - 34, bp.pp, { width: 8, color: bp.phase === 1 ? C.amber : C.violet, glowAlpha: 0.3 });
    text(ctx, String(bp.k + 1), RING.x, RING.y + 30, { size: 120, weight: 800, family: DISPLAY, align: 'center' });
    text(ctx, `of ${ex.reps}`, RING.x, RING.y + 80, { size: 28, color: C.muted, align: 'center' });
    const label = ex.phases[bp.phase][0];
    stepsCard(ctx, ex, lt, { phaseLabel: label, phaseP: bp.pp, active: bp.phase === 0 ? 1 : bp.phase === 1 ? 2 : -1 });
    return;
  }
  const st = repState(ex, lt);
  const pose = poseFor(ex, st.effort, st.side);
  if (ex.id === 'cheek') cheekDiagram(ctx, st.effort, st.side, lt);
  else insideView(ctx, pose.head, lt, { target: ex.target });
  mirrorView(ctx, pose.face, lt);

  // Rings: whole exercise, and the current repetition.
  ring(ctx, RING.x, RING.y, RING.r, lt / total, { width: 16, color: C.air });
  if (ex.hold) {
    const left = Math.max(0, Math.ceil(ex.hold - lt));
    text(ctx, String(left), RING.x, RING.y + 36, { size: 130, weight: 800, family: DISPLAY, align: 'center', color: left <= 3 ? C.amber : C.ink });
    text(ctx, 'seconds', RING.x, RING.y + 84, { size: 28, color: C.muted, align: 'center' });
    stepsCard(ctx, ex, lt, { phaseLabel: lt < ex.hold - 0.5 ? 'Press and hold' : 'Relax', phaseP: lt / ex.hold, active: 2 });
  } else if (st.switching) {
    text(ctx, 'Switch', RING.x, RING.y + 16, { size: 56, weight: 800, family: DISPLAY, align: 'center', color: C.amber });
    text(ctx, 'to the left cheek', RING.x, RING.y + 64, { size: 26, color: C.muted, align: 'center' });
    stepsCard(ctx, ex, lt, { phaseLabel: 'Switch sides', phaseP: 0 });
  } else {
    ring(ctx, RING.x, RING.y, RING.r - 34, (st.phase + st.pp) / ex.phases.length, { width: 8, color: C.amber, glowAlpha: 0.3 });
    const pop = 1 + 0.12 * (1 - ease.outCubic(clamp((lt - (st.side && ex.sides ? ex.reps * periodOf(ex) + SWITCH : 0) - st.rep * periodOf(ex)) / 0.35)));
    ctx.save();
    ctx.translate(RING.x, RING.y);
    ctx.scale(pop, pop);
    text(ctx, String(st.rep + 1), 0, 36, { size: 130, weight: 800, family: DISPLAY, align: 'center' });
    ctx.restore();
    text(ctx, `of ${ex.reps}${ex.sides ? (st.side ? ' · left' : ' · right') : ''}`, RING.x, RING.y + 84, { size: 28, color: C.muted, align: 'center' });
    const label = ex.phases[st.phase][0];
    const active = ex.id === 'slide' ? [0, 1, 1, 2, -1][st.phase] : ex.id === 'ah' ? [1, 2, 2, -1, -1][st.phase] : ex.id === 'cheek' ? [2, 2, -1, -1][st.phase] : [0, 1, 2, -1][st.phase];
    stepsCard(ctx, ex, lt, { phaseLabel: label, phaseP: st.pp, active });
  }
}

function drawRest(ctx, lt, seg) {
  const next = seg.next;
  const p = prog(lt, 0, 0.6);
  text(ctx, 'NICE WORK', W / 2, 250, { size: 28, weight: 700, color: C.good, tracking: 6, align: 'center', alpha: p });
  text(ctx, 'Rest', W / 2, 360, { size: 120, weight: 800, family: DISPLAY, align: 'center', alpha: p });
  sparkle(ctx, W / 2, 320, clamp(lt / 1.2), { color: C.good, n: 18, r: 260 });
  ring(ctx, W / 2, 600, 120, 1 - lt / seg.dur, { width: 14, color: C.violet });
  text(ctx, String(Math.max(1, Math.ceil(seg.dur - lt))), W / 2, 630, { size: 90, weight: 800, family: DISPLAY, align: 'center' });
  if (next) {
    const q = prog(lt, 0.8, 0.8);
    card(ctx, W / 2 - 420, 790, 840, 160, { alpha: q, accent: C.air });
    badge(ctx, next.icon, W / 2 - 330, 870, 48, C.air, { alpha: q });
    text(ctx, 'UP NEXT', W / 2 - 250, 850, { size: 22, weight: 700, color: C.air, tracking: 4, alpha: q });
    text(ctx, next.name, W / 2 - 250, 905, { size: 46, weight: 700, family: DISPLAY, alpha: q });
  }
}

// ---------- intro, extras, meals, outro ----------

function drawWelcome(ctx, lt, seg) {
  headline(ctx, 'Follow along', 'Anti-snoring exercise routine', 120, 200, prog(lt, 0.3, 1.2), { size: 92, color: C.amber, maxWidth: 1400 });
  const a1 = win(lt, seg.c(1) - 0.3, seg.c(3) - 0.2, 0.6, 0.5);
  if (a1 > 0) {
    ctx.save();
    ctx.globalAlpha *= a1;
    badgeRow(ctx, [
      { icon: 'clock', label: '~8 minutes', color: C.air },
      { icon: 'repeat', label: '3 times a day', color: C.air },
      { icon: 'calendar', label: 'for 3 months', color: C.air },
    ], 320, 560, 420, prog(lt, seg.c(1) + 0.5, 1.6), { r: 70, size: 32 });
    const q = prog(lt, seg.c(1) + 4.0, 1);
    text(ctx, 'In the 2015 trial, snores per hour roughly halved.', W / 2, 820, { size: 34, color: C.muted, align: 'center', alpha: q });
    ctx.restore();
  }
  const a2 = win(lt, seg.c(2) - 0.3, seg.c(3) - 0.2, 0.5, 0.5);
  if (a2 > 0) {
    ctx.save();
    ctx.globalAlpha *= a2;
    ctx.fillStyle = 'rgba(6,10,28,0.85)';
    ctx.fillRect(0, 380, W, 560);
    const tips = [['sleepy', 'Sit up straight, shoulders relaxed'], ['check', 'Wash your hands'], ['clock', 'Move slowly and firmly'], ['warning', 'Stop if anything hurts']];
    tips.forEach(([ic, s], i) => {
      const q = ease.outCubic(clamp((lt - seg.c(2) - 0.2 - i * 1.0) / 0.6));
      const x = 180 + (i % 2) * 820, y = 520 + Math.floor(i / 2) * 200;
      badge(ctx, ic, x, y, 54, i === 3 ? C.bad : C.air, { alpha: q });
      text(ctx, s, x + 90, y + 14, { size: 38, weight: 600, alpha: q, rise: (1 - q) * 16 });
    });
    ctx.restore();
  }
  const a3 = win(lt, seg.c(3) - 0.2, seg.dur, 0.5, 0.5);
  if (a3 > 0) {
    ctx.save();
    ctx.globalAlpha *= a3;
    EX.forEach((ex, i) => {
      const q = ease.outBack(clamp((lt - seg.c(3) - 0.2 - i * 0.25) / 0.6));
      const x = 230 + i * 365;
      ctx.save();
      ctx.translate(x, 600);
      ctx.scale(q, q);
      card(ctx, -160, -170, 320, 340, { alpha: clamp(q) });
      badge(ctx, ex.icon, 0, -50, 64, C.air);
      text(ctx, String(i + 1), -130, -120, { size: 26, weight: 800, color: C.dim });
      text(ctx, ex.name, 0, 70, { size: 32, weight: 700, align: 'center', maxWidth: 280 });
      text(ctx, ex.sides ? '10 each side' : `${ex.reps} reps`, 0, 125, { size: 24, color: C.muted, align: 'center' });
      ctx.restore();
    });
    ctx.restore();
  }
}

function drawExtrasIntro(ctx, lt, seg) {
  headline(ctx, 'Core routine done', 'Two optional extras', 120, 300, prog(lt, 0.2, 1.2), { size: 96, color: C.good });
  text(ctx, 'From the earlier trial of these exercises in people with sleep apnea (Guimarães et al., 2009).', 120, 560, { size: 32, color: C.muted, alpha: prog(lt, 1.2, 1), maxWidth: 1300 });
  EXTRAS.forEach((ex, i) => {
    const q = prog(lt, 2 + i * 0.4, 0.8);
    card(ctx, 120 + i * 560, 660, 520, 220, { alpha: q, accent: C.violet });
    badge(ctx, ex.icon, 220 + i * 560, 770, 56, C.violet, { alpha: q });
    text(ctx, ex.name, 300 + i * 560, 760, { size: 38, weight: 700, alpha: q });
    text(ctx, ex.hold ? '30-second hold' : '5 breaths', 300 + i * 560, 806, { size: 26, color: C.muted, alpha: q });
  });
}

function drawMeals(ctx, lt, seg) {
  headline(ctx, 'At every meal', 'Chew and swallow like this', 120, 170, prog(lt, 0.2, 1.2), { size: 80, color: C.amber });
  // Face chewing, alternating sides
  const chew = Math.sin(lt * 5) * 0.5 + 0.5;
  const side = Math.floor(lt / 2.4) % 2;
  const f = { open: chew * 0.22, smileL: side ? chew * 0.3 : 0, smileR: side ? 0 : chew * 0.3, cheekL: side ? chew * 0.3 : 0, cheekR: side ? 0 : chew * 0.3 };
  ctx.save();
  ctx.translate(500, 640);
  ctx.scale(0.95, 0.95);
  drawFace(ctx, { ...faceDefaults(), ...f }, lt);
  ctx.restore();
  const items = [
    ['chew', 'Chew on both sides, alternating'],
    ['tongue', 'Swallow with your tongue up against the roof of your mouth'],
    ['check', 'Teeth together, lips relaxed'],
  ];
  items.forEach(([ic, s], i) => checkRow(ctx, 960, 420 + i * 170, s, clamp((lt - seg.c(0) - 1 - i * 2.2) / 0.9), { iconName: ic, size: 34, maxWidth: 760 }));
}

function drawOutro(ctx, lt, seg) {
  headline(ctx, 'Session complete', 'Well done!', 120, 220, prog(lt, 0.2, 1.2), { size: 110, color: C.good });
  sparkle(ctx, 500, 280, clamp(lt / 1.6), { color: C.good, n: 22, r: 320 });
  const rows = [
    ['repeat', 'Three times a day: morning, afternoon, evening'],
    ['calendar', 'Keep going for weeks, ideally 3 months'],
    ['phone', 'Track your nights with Snore Log'],
    ['doctor', 'Pauses, gasping or daytime sleepiness? See a doctor'],
  ];
  rows.forEach(([ic, s], i) => {
    const t = seg.c(0) + 1.5 + i * ((seg.e(0) - seg.c(0) - 1.5) / rows.length);
    checkRow(ctx, 140, 500 + i * 120, s, clamp((lt - t) / 0.9), { iconName: ic, size: 36, color: i === 3 ? C.bad : C.good });
  });
  const z = prog(lt, seg.dur - 4, 1);
  text(ctx, 'Based on Ieto et al., Chest 2015 and Guimarães et al., Am J Respir Crit Care Med 2009. General information, not medical advice.', W / 2, 1010, { size: 22, color: C.dim, align: 'center', alpha: z });
}

// ---------- segments ----------

const segs = [];

segs.push({
  id: 'welcome', draw: drawWelcome, lead: 1.2, tail: 1.6, gap: 0.8,
  cues: [
    { text: 'Welcome. This is a follow-along routine of mouth and throat exercises for snoring.' },
    { text: 'It comes from a randomized trial where people did these exercises for about eight minutes, three times a day. After three months, the number of snores per hour had roughly halved.' },
    { text: 'Sit up straight, with your shoulders relaxed. Wash your hands, because one exercise uses a finger. Move slowly and firmly, and stop if anything hurts.' },
    { text: "There are five exercises, and I'll count every repetition for you. Let's begin." },
  ],
  sfx: (s) => [{ t: s.dur - 0.6, type: 'whoosh', gain: 0.4 }],
});

function addExercise(ex, next) {
  segs.push({
    id: `${ex.id}-intro`, ex, draw: drawExIntro, lead: 1.0, tail: 1.4, noFade: false, fadeOut: 0,
    cues: [{ text: ex.say }],
  });
  segs.push({
    id: `${ex.id}-ready`, ex, draw: drawReady, dur: 4.0, noFade: true,
    cues: [{ text: 'Get ready.', at: 0.05, caption: false }],
    sfx: () => [1.0, 2.0, 3.0].map((t) => ({ t, type: 'beep', gain: 0.7 })),
  });
  const dur = repsDuration(ex);
  const cues = [];
  const sfx = [{ t: 0, type: 'go', gain: 0.6 }];
  if (ex.hold) {
    cues.push({ text: 'Press, and hold.', at: 0.2 });
    cues.push({ text: 'Twenty seconds.', at: ex.hold - 20.2, caption: false });
    cues.push({ text: 'Ten more seconds.', at: ex.hold - 10.2, caption: false });
    cues.push({ text: 'Three.', at: ex.hold - 3, caption: false });
    cues.push({ text: 'Two.', at: ex.hold - 2, caption: false });
    cues.push({ text: 'One.', at: ex.hold - 1, caption: false });
    cues.push({ text: 'And relax.', at: ex.hold - 0.1, caption: false });
  } else if (ex.id === 'balloon') {
    const per = periodOf(ex);
    for (let k = 0; k < ex.reps; k++) {
      cues.push({ text: k === 0 ? 'Breathe in through your nose.' : `${NUM[k]}. Breathe in.`, at: k * per + 0.1, caption: false });
      cues.push({ text: 'And blow.', at: k * per + ex.phases[0][1], caption: false });
      sfx.push({ t: k * per + ex.phases[0][1], type: 'tick', gain: 0.4 });
    }
  } else {
    const per = periodOf(ex);
    const sides = ex.sides ? 2 : 1;
    for (let sd = 0; sd < sides; sd++) {
      const off = sd * (ex.reps * per + SWITCH);
      for (let r = 0; r < ex.reps; r++) {
        const t = off + r * per;
        cues.push({ text: `${NUM[r]}.`, at: t + 0.02, caption: false, speed: 1.0, gain: 0.9 });
        sfx.push({ t, type: 'tick', gain: 0.35 });
        // soft cue when it is time to let go
        const relIdx = ex.phases.findIndex((p) => p[2] === 1 && p[3] === 0);
        if (relIdx > 0) {
          const rt = ex.phases.slice(0, relIdx).reduce((s, p) => s + p[1], 0);
          sfx.push({ t: t + rt, type: 'tock', gain: 0.25 });
        }
      }
      if (ex.sides && sd === 0) {
        cues.push({ text: 'Switch to the left side.', at: ex.reps * per + 0.6 });
        sfx.push({ t: ex.reps * per + SWITCH - 1.0, type: 'beep', gain: 0.5 });
      }
    }
  }
  segs.push({ id: `${ex.id}-reps`, ex, draw: drawReps, dur, noFade: true, cues, sfx: () => sfx });
  if (next) {
    segs.push({
      id: `${ex.id}-rest`, ex, next, draw: drawRest, dur: 8, fadeIn: 0.3,
      cues: [{ text: `Rest. Next up: the ${next.name.toLowerCase()}.`, at: 0.6 }],
      sfx: () => [{ t: 0, type: 'chime', gain: 0.7 }],
    });
  }
}

EX.forEach((ex, i) => addExercise(ex, EX[i + 1] ?? null));

segs.push({
  id: 'extras', draw: drawExtrasIntro, lead: 0.8, tail: 1.4,
  cues: [{ text: "That's the core routine done. If you have a couple more minutes, here are two extras from an earlier trial of these exercises, in people with sleep apnea." }],
  sfx: () => [{ t: 0, type: 'chime', gain: 0.7 }],
});
addExercise(EXTRAS[0], EXTRAS[1]);
addExercise(EXTRAS[1], null);

segs.push({
  id: 'meals', draw: drawMeals, lead: 0.8, tail: 2.0,
  cues: [{ text: 'One more habit for mealtimes. Chew on both sides of your mouth, taking turns. And when you swallow, keep your teeth together and your tongue up against the roof of your mouth, without squeezing your lips.' }],
  sfx: () => [{ t: 0, type: 'chime', gain: 0.6 }],
});

segs.push({
  id: 'outro', draw: drawOutro, lead: 0.8, tail: 5.0,
  cues: [{ text: "Well done, that's one session. Do it three times a day: morning, afternoon and evening. Keep going for at least a few weeks; in the trial, people practiced for three months. Use Snore Log to see if your snoring changes. And if someone notices you stop breathing or gasp at night, or you're very sleepy during the day, see a doctor." }],
  sfx: () => [{ t: 0.2, type: 'chime', gain: 0.8 }],
});

export const segments = segs;

// ---------- overlay: progress through the session ----------

export function overlay(ctx, t, tl, seg) {
  if (seg.id === 'welcome' || seg.id === 'outro') return;
  // bottom progress bar
  const y = H - 10;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, y, W, 10);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, C.air);
  g.addColorStop(1, C.good);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W * (t / tl.duration), 10);
  // exercise chips, top right
  const chips = ALL.map((ex) => tl.segments.find((s) => s.id === `${ex.id}-intro`)?.start ?? 0);
  const ends = ALL.map((ex) => {
    const s = tl.segments.find((s) => s.id === `${ex.id}-reps`);
    return s ? s.start + s.dur : 0;
  });
  ALL.forEach((ex, i) => {
    const x = W - 64 - (ALL.length - 1 - i) * 58, cy = 92;
    const done = t >= ends[i], now = t >= chips[i] && !done;
    ctx.beginPath();
    ctx.arc(x, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = done ? rgba(C.good, 0.25) : now ? rgba(C.amber, 0.25) : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = done ? C.good : now ? C.amber : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (done) icon(ctx, 'check', x, cy, 24, C.good, { width: 12 });
    else text(ctx, i < EX.length ? String(i + 1) : '+', x, cy + 8, { size: 20, weight: 700, align: 'center', color: now ? C.amber : C.dim });
  });
  const left = Math.max(0, tl.duration - t);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  text(ctx, `${mm}:${String(ss).padStart(2, '0')} left`, W - 64 - (ALL.length - 1) * 58 - 40, 100, { size: 22, color: C.dim, align: 'right' });
}
