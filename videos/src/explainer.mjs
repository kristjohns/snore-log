// Video 1: why we snore, and which at-home fixes have research behind them.

import { clamp, lerp, ease, prog, keys, smooth, window as win } from './lib/anim.mjs';
import {
  C, W, H, text, card, pill, ring, arrow, soundWaves, zzz, drawGlow, rgba, mix, roundRect, revealLines, DISPLAY,
  sparkle,
} from './lib/draw.mjs';
import { drawHead, defaultState, geometry, LM } from './lib/anatomy.mjs';
import { drawFace, faceDefaults } from './lib/face.mjs';
import { icon, badge } from './lib/icons.mjs';
import { headline, studyCard, beforeAfter, callout, checkRow, stat, badgeRow } from './lib/ui.mjs';

export const meta = {
  name: 'snoring-explained',
  title: 'Why we snore, and what actually helps at home',
  voice: 'af_heart',
  speed: 0.95,
  mix: { musicGain: 0.5, duckTo: 0.32 },
};

// ---------- shared helpers ----------

const HEAD_CX = 340, HEAD_CY = 470;

function head(ctx, state, t, x, y, s, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.translate(-HEAD_CX, -HEAD_CY);
  const g = drawHead(ctx, state, t);
  ctx.restore();
  return g;
}

// Map a point in head-local coordinates to the screen.
function toScreen(p, x, y, s, rot = 0) {
  const dx = (p[0] - HEAD_CX) * s, dy = (p[1] - HEAD_CY) * s;
  const c = Math.cos(rot), sn = Math.sin(rot);
  return [x + dx * c - dy * sn, y + dx * sn + dy * c];
}

// Snoring happens on the in-breath: one snore every `period` seconds.
const SNORE_LEN = 1.7;
function snoreEnv(lt, start, period) {
  if (lt < start) return 0;
  const ph = (lt - start) % period;
  if (ph > SNORE_LEN) return 0;
  const x = ph / SNORE_LEN;
  return Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5;
}
function snoreTimes(start, period, end) {
  const out = [];
  for (let t = start; t < end - SNORE_LEN; t += period) out.push(t);
  return out;
}

// Visibility of a block that lives from cue i to cue j (or segment end).
function span(lt, seg, i, j = null, fade = 0.45) {
  const a = seg.c(i) - 0.15;
  const b = j == null ? seg.dur : seg.c(j) - 0.1;
  return win(lt, a, b, fade, fade);
}

const sub = (ctx, s, x, y, alpha = 1, opts = {}) =>
  text(ctx, s, x, y, { size: 30, weight: 500, color: C.muted, alpha, maxWidth: 760, lineHeight: 1.35, ...opts });

// ---------- 1. Title ----------

function drawIntro(ctx, lt, seg) {
  // Moon
  const mx = 1600, my = 230;
  drawGlow(ctx, mx, my, 260, '#ffe2a8', 0.35);
  icon(ctx, 'moon', mx, my, 190, '#ffe9bf');

  // Sleeping face, snoring
  const s = snoreEnv(lt, 0.4, 3.4);
  const f = { ...faceDefaults(), eyes: 0, open: 0.18 * s, cheekL: 0.15 * s, cheekR: 0.15 * s };
  ctx.save();
  ctx.translate(540, 600);
  ctx.rotate(-0.08);
  const sc = 1.05 + 0.01 * Math.sin(lt * 0.8);
  ctx.scale(sc, sc);
  drawFace(ctx, f, lt);
  ctx.restore();
  soundWaves(ctx, 640, 690, lt * 1.6, { color: C.tissue, alpha: s, maxR: 220, spread: 0.7, dir: -0.15 });
  zzz(ctx, 760, 380, lt, { alpha: 0.9, size: 64 });

  const p = prog(lt, 1.2, 1.4);
  headline(ctx, 'What the research says', 'Why we snore', 1000, 470, p, { size: 104, color: C.amber });
  const q = ease.outCubic(clamp((lt - 2.0) / 1.2));
  text(ctx, 'and what actually helps at home', 1000, 680, { size: 50, weight: 500, color: C.ink, alpha: q, rise: (1 - q) * 20 });
  const r = ease.outCubic(clamp((lt - seg.c(1)) / 1.0));
  pill(ctx, 1000, 770, 'Causes', { color: C.violet, alpha: r });
  pill(ctx, 1140, 770, 'Home fixes that work', { color: C.good, alpha: r });
  pill(ctx, 1450, 770, 'When to see a doctor', { color: C.bad, alpha: r });
}

// ---------- 2. How snoring happens ----------

function drawAirway(ctx, lt, seg) {
  const sleep = prog(lt, seg.c(2) + 0.6, 3.0);
  const snoring = clamp((lt - seg.c(3)) / 0.8);
  const env = snoreEnv(lt, seg.c(3) + 0.3, 3.0);
  const state = {
    ...defaultState(),
    air: prog(lt, 0.6, 1.5),
    airSpeed: 1 + sleep * 0.6 + env * 1.2,
    fall: sleep * 0.85,
    sag: sleep,
    flutter: env * snoring,
    glowAir: span(lt, seg, 1, 2) * 0.9,
    glowPalate: env * snoring * 0.8,
  };
  const X = 560, Y = 560, S = 1.18;
  const geo = head(ctx, state, lt, X, Y, S);

  // Labels on the anatomy (they make way for the panel on the right)
  const panelIn = prog(lt, seg.c(1) - 0.3, 0.8);
  const lab = (i, name, lm, lx, ly) => {
    const [ax, ay] = toScreen(lm, X, Y, S);
    callout(ctx, ax, ay, lx, ly, name, clamp((lt - seg.c(0) - 0.6 - i * 0.9) / 0.8) * (1 - panelIn), { size: 30 });
  };
  lab(0, 'Nose', LM.nose, 1060, 300);
  lab(1, 'Soft palate', [372, 470], 1060, 470);
  lab(2, 'Tongue', [450, 520], 1060, 640);
  lab(3, 'Airway', [316, 560], 1060, 810);

  // Sound coming out of the nose and mouth while snoring
  if (state.flutter > 0) {
    const [sx, sy] = toScreen([612, 450], X, Y, S);
    soundWaves(ctx, sx + 20, sy, lt * 2.2, { color: C.tissue, alpha: state.flutter, maxR: 260, spread: 0.8, dir: 0 });
    const [vx, vy] = toScreen(geo.velum.tip, X, Y, S);
    drawGlow(ctx, vx, vy, 120, C.tissue, state.flutter * 0.6);
  }

  // Right panel
  const px = 1180;
  const g = geo.gap(552);
  const width = isFinite(g.w) ? g.w : 0;
  const wv = 0.12 + 0.88 * clamp(width / 48);
  const pa = panelIn;
  if (pa > 0.002) {
  card(ctx, px, 150, 640, 230, { alpha: pa });
  text(ctx, 'AIRWAY BEHIND THE TONGUE', px + 40, 210, { size: 22, weight: 700, color: C.muted, tracking: 3, alpha: pa });
  roundRect(ctx, px + 40, 250, 560, 44, 22);
  ctx.save();
  ctx.globalAlpha *= pa;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  const col = mix(C.bad, C.air, wv);
  roundRect(ctx, px + 40, 250, Math.max(44, 560 * wv), 44, 22);
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.restore();
  text(ctx, sleep > 0.5 ? 'Narrow' : 'Open', px + 40, 345, { size: 34, weight: 700, color: col, alpha: pa });
  pill(ctx, px + 600, 340, sleep > 0.5 ? 'ASLEEP' : 'AWAKE', { color: sleep > 0.5 ? C.violet : C.good, alpha: pa, align: 'right', size: 22 });
  }

  const rows = [
    [1, 'Awake, throat muscles hold the airway open.', C.good],
    [2, 'Asleep, they relax. The soft palate and tongue sag back.', C.violet],
    [3, 'Air speeds up through the gap and the soft tissue flutters. That is the snore.', C.tissue],
  ];
  rows.forEach(([i, s, c], k) => {
    const a = ease.outCubic(clamp((lt - seg.c(i) + 0.2) / 0.7));
    if (a <= 0) return;
    const y = 470 + k * 150;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate((1 - a) * 30, 0);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(px + 18, y - 12, 9, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, s, px + 50, y, { size: 32, weight: 550, maxWidth: 590, lineHeight: 1.3 });
    ctx.restore();
  });
}

// ---------- 3. What makes it worse ----------

const FACTORS = [
  { icon: 'bed', title: 'On your back', sub: 'Gravity pulls the tongue back', color: C.violet },
  { icon: 'wine', title: 'Alcohol', sub: 'Relaxes throat muscles more', color: C.amber },
  { icon: 'scale', title: 'Extra weight', sub: 'More tissue around the airway', color: '#f2cf7a' },
  { icon: 'nose', title: 'Blocked nose, smoking', sub: 'Swollen, irritated lining', color: C.tissue },
];

function drawWorse(ctx, lt, seg) {
  const k = (i) => win(lt, seg.c(i + 1) - 0.2, i < 3 ? seg.c(i + 2) - 0.2 : seg.dur, 0.6, 0.6);
  const back = k(0), alcohol = k(1), weight = k(2), nose = k(3);
  const rot = -Math.PI / 2 * ease.inOutCubic(back);
  const state = {
    ...defaultState(),
    air: 0.7,
    fall: Math.max(back, alcohol * 0.8, weight * 0.5),
    sag: Math.max(back, alcohol),
    wall: weight,
    swell: nose,
    glowNose: nose * 0.6,
    flutter: Math.max(alcohol, back) * 0.5 * (0.6 + 0.4 * Math.sin(lt * 7)),
  };
  const X = 520 + back * 30, Y = 560 + back * 40, S = 0.98 - back * 0.08;
  head(ctx, state, lt, X, Y, S, rot);
  if (back > 0.05) {
    // gravity arrows
    for (let i = 0; i < 3; i++) {
      const ax = X - 60 + i * 70, ay = Y - 250;
      arrow(ctx, ax, ay, ax, ay + 90, { color: C.violet, alpha: back, progress: clamp((lt - seg.c(1) - 0.4 - i * 0.15) / 0.8) });
    }
    text(ctx, 'gravity', X + 120, Y - 200, { size: 28, weight: 650, color: C.violet, alpha: back });
  }
  if (alcohol > 0.05) {
    const [gx, gy] = [X + 260, Y - 280];
    drawGlow(ctx, gx, gy, 90, C.amber, alcohol * 0.4);
    icon(ctx, 'wine', gx, gy, 120, C.amber, { alpha: alcohol });
  }

  // Factor cards
  const x0 = 1040, y0 = 200;
  FACTORS.forEach((f, i) => {
    const appear = ease.outCubic(clamp((lt - seg.c(0) - 0.3 - i * 0.18) / 0.7));
    const active = k(i);
    const cx = x0 + (i % 2) * 420, cy = y0 + Math.floor(i / 2) * 330;
    ctx.save();
    ctx.translate(cx + 190, cy + 140);
    const s = 1 + active * 0.05;
    ctx.scale(s, s);
    ctx.translate(-(cx + 190), -(cy + 140));
    ctx.globalAlpha *= appear * (0.45 + 0.55 * Math.max(active, lt > seg.dur - 2 ? 1 : 0, lt < seg.c(1) ? 1 : 0));
    card(ctx, cx, cy, 380, 280, { edge: active > 0.3 ? rgba(f.color, 0.9) : undefined });
    if (active > 0) drawGlow(ctx, cx + 90, cy + 90, 120, f.color, active * 0.35);
    badge(ctx, f.icon, cx + 90, cy + 90, 52, f.color);
    const th = text(ctx, f.title, cx + 34, cy + 190, { size: 32, weight: 700, maxWidth: 330 });
    text(ctx, f.sub, cx + 34, cy + 190 + th + 2, { size: 23, weight: 500, color: C.muted, maxWidth: 330 });
    ctx.restore();
  });
}

// ---------- 4. Exercises: the evidence ----------

function exerciseLoop(lt) {
  // Cycles through the tongue and palate exercises for the illustration.
  const p = (lt % 12) / 12;
  const seg = Math.floor(p * 4), ph = (p * 4) % 1;
  const pulse = Math.sin(Math.PI * clamp(ph * 1.2)) ** 0.8;
  const s = defaultState();
  if (seg === 0) { s.tipUp = 1; s.slide = pulse; }
  if (seg === 1) s.suck = pulse;
  if (seg === 2) { s.down = pulse; s.jaw = 0.4 * pulse; }
  if (seg === 3) { s.lift = pulse; s.jaw = pulse; }
  s.glowTongue = seg < 3 ? pulse : 0;
  s.glowPalate = seg === 3 ? pulse : 0;
  return s;
}

function drawExercises(ctx, lt, seg) {
  // Head doing exercises on the right throughout.
  const st = exerciseLoop(lt);
  const hp = win(lt, 0, seg.c(5) - 0.5, 0.6, 0.5);
  ctx.save();
  ctx.globalAlpha *= hp;
  head(ctx, { ...st, air: 0.4 }, lt, 1480, 590, 1.0);
  ctx.restore();

  // c0: headline
  const a0 = span(lt, seg, 0, 1);
  headline(ctx, 'The strongest home evidence', 'Exercise your mouth and throat', 120, 380, prog(lt, 0.3, 1.2) * a0, { size: 84, maxWidth: 860 });
  sub(ctx, 'Myofunctional therapy: daily tongue, soft-palate and cheek exercises.', 120, 640, a0 * prog(lt, 1.4, 1));

  // c1..c2: the 2015 trial
  const a1 = span(lt, seg, 1, 3);
  if (a1 > 0) {
    ctx.save();
    ctx.globalAlpha *= a1;
    studyCard(ctx, 100, 150, 900, 220, {
      tag: 'RANDOMIZED TRIAL · 2015', title: 'Oropharyngeal exercises for snoring',
      cite: 'Ieto et al., Chest 148:683 · 39 adults who snore', color: C.air,
    }, prog(lt, seg.c(1), 1));
    const a1b = span(lt, seg, 1, 2);
    badgeRow(ctx, [
      { icon: 'clock', label: '8 minutes', color: C.air },
      { icon: 'repeat', label: '3 times a day', color: C.air },
      { icon: 'calendar', label: '3 months', color: C.air },
    ], 240, 540, 300, prog(lt, seg.c(1) + 1.2, 1.6) * a1b);
    const a2 = span(lt, seg, 2, 3);
    if (a2 > 0) {
      ctx.globalAlpha *= a2;
      beforeAfter(ctx, 110, 470, 880, { label: 'Snores per hour', before: 99.5, after: 48.2, max: 110 }, prog(lt, seg.c(2), 2.4));
      beforeAfter(ctx, 110, 680, 880, { label: 'Total snoring power per hour', before: 60.4, after: 31.0, max: 110 }, prog(lt, seg.c(2) + 1.2, 2.4), { color: C.good });
      const n = ease.outCubic(clamp((lt - seg.c(2) - 4) / 1));
      text(ctx, 'Comparison group (nasal strips + breathing exercises): no significant change.', 110, 930, { size: 25, weight: 500, color: C.muted, alpha: n, maxWidth: 880 });
    }
    ctx.restore();
  }

  // c3: two more studies
  const a3 = span(lt, seg, 3, 4);
  if (a3 > 0) {
    ctx.save();
    ctx.globalAlpha *= a3;
    studyCard(ctx, 100, 120, 900, 380, {
      tag: 'REVIEW OF 9 STUDIES · 2018', title: '211 adults: snoring got quieter and less frequent',
      cite: 'Camacho et al., Eur Arch Otorhinolaryngol 275:849', color: C.violet,
    }, prog(lt, seg.c(3), 1));
    stat(ctx, 300, 420, '−51%', 'snoring loudness score', prog(lt, seg.c(3) + 1.2, 1), { color: C.violet, size: 70 });
    const t2 = seg.c(3) + (seg.e(3) - seg.c(3)) * 0.45;
    studyCard(ctx, 100, 550, 900, 300, {
      tag: 'RANDOMIZED TRIAL · 2025', title: '125 people, 6 weeks: bed partners rated snoring lower than with a sham exercise',
      cite: 'Abu Alheija et al., Acta Oto-Laryngologica 145:857', color: C.good, titleSize: 34,
    }, prog(lt, t2, 1));
    ctx.restore();
  }

  // c4: honest caveats
  const a4 = span(lt, seg, 4, 5);
  if (a4 > 0) {
    ctx.save();
    ctx.globalAlpha *= a4;
    card(ctx, 100, 170, 900, 640, { accent: C.amber });
    text(ctx, 'THE FINE PRINT', 150, 250, { size: 24, weight: 700, color: C.amber, tracking: 3 });
    const lines = [
      ['warning', 'The studies are small.', C.amber],
      ['cross', 'Not every trial found a benefit (one in people with obesity saw no clear change).', C.bad],
      ['check', 'Free, safe, and low effort.', C.good],
      ['calendar', 'Works like physiotherapy: daily practice for weeks to months.', C.air],
    ];
    lines.forEach(([ic, s, c], i) => {
      const q = ease.outCubic(clamp((lt - seg.c(4) - 0.3 - i * 0.9) / 0.7));
      icon(ctx, ic, 190, 340 + i * 120, 48, c, { alpha: q });
      text(ctx, s, 250, 352 + i * 120, { size: 30, weight: 550, alpha: q, maxWidth: 700, lineHeight: 1.25 });
    });
    ctx.restore();
  }

  // c5: pointer to video 2
  const a5 = span(lt, seg, 5);
  if (a5 > 0) {
    const q = ease.outBack(clamp((lt - seg.c(5)) / 0.9));
    ctx.save();
    ctx.globalAlpha *= a5;
    ctx.translate(W / 2, 520);
    ctx.scale(0.85 + 0.15 * q, 0.85 + 0.15 * q);
    card(ctx, -520, -250, 1040, 500, { accent: C.air });
    drawGlow(ctx, -300, 0, 200, C.air, 0.35);
    ctx.beginPath();
    ctx.arc(-300, 0, 110, 0, Math.PI * 2);
    ctx.fillStyle = rgba(C.air, 0.18);
    ctx.fill();
    icon(ctx, 'play', -292, 0, 120, C.air);
    text(ctx, 'VIDEO 2', -120, -70, { size: 26, weight: 700, color: C.air, tracking: 4 });
    text(ctx, 'The follow-along routine', -120, 0, { size: 52, weight: 700, family: DISPLAY });
    text(ctx, 'Every exercise, timed and counted.', -120, 70, { size: 32, weight: 500, color: C.muted });
    ctx.restore();
  }
}

// ---------- 5. Sleep on your side ----------

function sleeper(ctx, x, y, pose, lt, snore, bolster = 0) {
  // Bed
  ctx.save();
  ctx.fillStyle = '#2a2f63';
  roundRect(ctx, x - 470, y + 40, 940, 90, 26);
  ctx.fill();
  ctx.fillStyle = '#d8dcf5';
  roundRect(ctx, x - 450, y - 10, 900, 70, 30);
  ctx.fill();
  ctx.fillStyle = '#1c2050';
  ctx.fillRect(x - 440, y + 130, 30, 80);
  ctx.fillRect(x + 410, y + 130, 30, 80);
  ctx.fillRect(x - 470, y - 150, 34, 280);
  // Pillow
  ctx.fillStyle = '#f4f2ff';
  ctx.beginPath();
  ctx.ellipse(x - 330, y - 18, 110, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pillow tucked behind the back (peeks out above the body)
  if (bolster > 0) {
    ctx.save();
    ctx.globalAlpha *= bolster;
    ctx.fillStyle = '#c9c4f2';
    roundRect(ctx, x - 230, y - 150 + (1 - bolster) * 60, 420, 120, 60);
    ctx.fill();
    ctx.restore();
  }
  // Blanket / body
  const hump = lerp(40, 120, pose);
  const hip = lerp(0, 70, pose);
  ctx.fillStyle = '#6c5ce7';
  ctx.beginPath();
  ctx.moveTo(x - 250, y + 30);
  ctx.bezierCurveTo(x - 240, y - hump * 0.7, x - 60, y - hump, x + 40 - hip, y - hump * 0.8);
  ctx.bezierCurveTo(x + 160, y - hump * 0.6 - hip * 0.4, x + 330, y - 40, x + 420, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(x - 250, y + 30);
  ctx.bezierCurveTo(x - 240, y - hump * 0.7, x - 60, y - hump, x + 40 - hip, y - hump * 0.8);
  ctx.lineTo(x + 40 - hip, y - hump * 0.8 + 16);
  ctx.bezierCurveTo(x - 60, y - hump + 16, x - 240, y - hump * 0.7 + 16, x - 236, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Head: profile facing up on the back, front face on the side.
  const hx = x - 320, hy = y - 70;
  const flip = Math.cos(Math.PI * pose); // 1 → -1
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(Math.abs(flip) * 0.98 + 0.02, 1);
  if (pose < 0.5) {
    // Profile, nose up
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(30, -50); ctx.quadraticCurveTo(44, -90, 58, -62); ctx.lineTo(48, -46);
    ctx.fill();
    ctx.fillStyle = '#3a2a3f';
    ctx.beginPath();
    ctx.arc(-24, 10, 58, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();
    ctx.strokeStyle = '#5a3a3f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(14, -36, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = '#c95564';
    ctx.beginPath();
    ctx.ellipse(52, -22, 8, 4 + snore * 5, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.scale(0.36, 0.36);
    ctx.rotate(-Math.PI / 2 * 0.35);
    drawFace(ctx, { ...faceDefaults(), eyes: 0 }, lt);
  }
  ctx.restore();
  if (snore > 0) soundWaves(ctx, hx + 70, hy - 60, lt * 2, { color: C.tissue, alpha: snore, maxR: 200, spread: 0.7, dir: -0.9 });
  if (pose > 0.6) zzz(ctx, hx + 60, hy - 90, lt, { alpha: (pose - 0.6) / 0.4, size: 50 });
}

function drawSide(ctx, lt, seg) {
  const roll = prog(lt, seg.c(0) + 4.2, 1.6);
  const snore = snoreEnv(lt, 0.8, 3.0) * (1 - roll);
  const tilt = prog(lt, seg.c(1) + (seg.e(1) - seg.c(1)) * 0.45, 1.6);
  headline(ctx, 'Position', 'Sleep on your side', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.violet });
  // Floor, then the bed: the foot-end legs stay on the floor and the
  // head end lifts onto a block.
  const FX = 1250, FY = 850, ANG = 0.075 * tilt;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(220, FY, 1120, 4);
  ctx.save();
  ctx.translate(FX, FY);
  ctx.rotate(ANG);
  ctx.translate(-FX, -FY);
  sleeper(ctx, 780, 640, roll, lt, snore, prog(lt, seg.c(1) + 0.4, 1.0));
  ctx.restore();
  if (tilt > 0) {
    const lift = Math.sin(ANG) * (FX - 355);
    ctx.save();
    ctx.globalAlpha *= clamp(tilt * 3);
    ctx.fillStyle = '#9b7b55';
    roundRect(ctx, 322, FY - lift + 4, 76, Math.max(2, lift - 4), 6);
    ctx.fill();
    text(ctx, 'a block under the head-end legs', 300, FY + 60, { size: 24, color: C.muted, alpha: clamp(tilt * 2 - 0.5) });
    ctx.restore();
  }

  // Right column facts
  const x = 1380;
  const r0 = prog(lt, seg.c(0) + 1.0, 1);
  card(ctx, x, 260, 460, 240, { alpha: r0, accent: C.violet });
  text(ctx, 'Sleep-lab recordings', x + 40, 320, { size: 24, weight: 700, color: C.violet, alpha: r0 });
  text(ctx, 'Snorers without sleep apnea snored less often and more quietly on their side.', x + 40, 370, { size: 27, alpha: r0, maxWidth: 390, lineHeight: 1.3 });
  text(ctx, 'Nakano et al., Sleep 2003', x + 40, 478, { size: 20, color: C.dim, alpha: r0 });
  const r1 = prog(lt, seg.c(1) + 0.3, 1);
  pill(ctx, x, 570, 'Pillow behind your back', { color: C.ink, alpha: r1, size: 24 });
  const r2 = prog(lt, seg.c(1) + (seg.e(1) - seg.c(1)) * 0.45, 1);
  card(ctx, x, 640, 460, 260, { alpha: r2, accent: C.air });
  text(ctx, 'Head of bed raised ~7.5°', x + 40, 700, { size: 26, weight: 700, color: C.air, alpha: r2 });
  stat(ctx, x + 230, 800, '−32%', 'breathing interruptions (52 people with sleep apnea)', r2, { size: 64, color: C.air });
}

// ---------- 6. Alcohol ----------

function drawAlcohol(ctx, lt, seg) {
  headline(ctx, 'Evenings', 'Go easy on alcohol', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.amber });
  // Glass with sloshing wine and a clock
  const gx = 520, gy = 600;
  const p = prog(lt, 0.4, 1.2);
  ctx.save();
  ctx.globalAlpha *= p;
  drawGlow(ctx, gx, gy - 40, 300, C.amber, 0.25);
  ctx.translate(gx, gy);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-130, -250); ctx.lineTo(130, -250);
  ctx.bezierCurveTo(140, -60, 90, 20, 0, 30);
  ctx.bezierCurveTo(-90, 20, -140, -60, -130, -250);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-130, -250); ctx.lineTo(130, -250);
  ctx.bezierCurveTo(140, -60, 90, 20, 0, 30);
  ctx.bezierCurveTo(-90, 20, -140, -60, -130, -250);
  ctx.clip();
  const slosh = Math.sin(lt * 1.6) * 14;
  const wg = ctx.createLinearGradient(0, -130, 0, 30);
  wg.addColorStop(0, '#d23a5a');
  wg.addColorStop(1, '#7a1230');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(-200, -130 + slosh);
  ctx.quadraticCurveTo(0, -150 - slosh * 0.3, 200, -130 - slosh);
  ctx.lineTo(200, 60); ctx.lineTo(-200, 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, 30); ctx.lineTo(0, 220);
  ctx.moveTo(-100, 230); ctx.lineTo(100, 230);
  ctx.stroke();
  ctx.restore();
  // Clock showing late evening
  const cp = prog(lt, 1.2, 1);
  ctx.save();
  ctx.globalAlpha *= cp;
  ctx.translate(800, 380);
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,26,70,0.9)';
  ctx.fill();
  ctx.strokeStyle = C.violet;
  ctx.lineWidth = 6;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 72, Math.sin(a) * 72);
    ctx.lineTo(Math.cos(a) * 82, Math.sin(a) * 82);
    ctx.stroke();
  }
  const hr = ((22 + lt / 20) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hr) * 46, Math.sin(hr) * 46);
  ctx.stroke();
  const mn = (lt / 60) * Math.PI * 2 * 4 - Math.PI / 2;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mn) * 66, Math.sin(mn) * 66);
  ctx.stroke();
  ctx.restore();

  const x = 1100;
  const r = prog(lt, seg.c(0) + 2.0, 1);
  card(ctx, x, 300, 720, 330, { alpha: r, accent: C.amber });
  stat(ctx, x + 180, 450, '+25%', 'risk of sleep apnea', r, { size: 92, color: C.amber });
  text(ctx, 'People who drank more alcohol, in a review of 21 studies.', x + 360, 420, { size: 27, alpha: r, maxWidth: 320, lineHeight: 1.3 });
  text(ctx, 'Simou et al., Sleep Medicine 2018', x + 360, 580, { size: 20, color: C.dim, alpha: r });
  const r2 = prog(lt, seg.c(1) - 0.2, 1);
  card(ctx, x, 690, 720, 170, { alpha: r2, accent: C.violet });
  icon(ctx, 'doctor', x + 90, 775, 70, C.violet, { alpha: r2 });
  text(ctx, 'Sleeping pills or sedatives? Ask your doctor whether they could make snoring worse.', x + 160, 760, { size: 26, alpha: r2, maxWidth: 520, lineHeight: 1.3 });
}

// ---------- 7. Weight and exercise ----------

function drawWeight(ctx, lt, seg) {
  headline(ctx, 'Body', 'Weight and exercise', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: '#f2cf7a' });
  const cols = [
    { i: 0, x: 110, icon: 'scale', color: '#f2cf7a', tag: 'Heavy snorers', big: '−45%', what: 'snores per hour in men who lost 3 kg or more', cite: 'Braver et al., Chest 1995 · small study' },
    { i: 1, x: 690, icon: 'people', color: C.air, tag: '690 adults · 4 years', big: '−26%', what: 'breathing interruptions in sleep with 10% weight loss', cite: 'Peppard et al., JAMA 2000' },
    { i: 2, x: 1270, icon: 'dumbbell', color: C.good, tag: '12-week trial', big: '32 → 25', what: 'breathing interruptions per hour with exercise, without real weight loss', cite: 'Kline et al., Sleep 2011' },
  ];
  for (const c of cols) {
    const p = prog(lt, seg.c(c.i) + 0.2, 1);
    if (p <= 0) continue;
    ctx.save();
    ctx.translate(0, (1 - p) * 50);
    card(ctx, c.x, 320, 540, 600, { alpha: p, accent: c.color });
    ctx.globalAlpha *= p;
    badge(ctx, c.icon, c.x + 100, 420, 56, c.color);
    text(ctx, c.tag.toUpperCase(), c.x + 180, 430, { size: 21, weight: 700, color: c.color, tracking: 2, maxWidth: 330 });
    stat(ctx, c.x + 270, 610, c.big, '', prog(lt, seg.c(c.i) + 0.8, 1), { size: 110, color: c.color });
    text(ctx, c.what, c.x + 50, 720, { size: 29, weight: 550, maxWidth: 450, lineHeight: 1.3 });
    text(ctx, c.cite, c.x + 50, 880, { size: 20, color: C.dim, maxWidth: 450 });
    ctx.restore();
  }
}

// ---------- 8. Nose and smoking ----------

function dotGrid(ctx, x, y, filled, color, p, label) {
  const n = Math.round(filled * ease.outCubic(clamp(p)));
  for (let i = 0; i < 100; i++) {
    const cx = x + (i % 10) * 34, cy = y + Math.floor(i / 10) * 34;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = i < n ? color : 'rgba(255,255,255,0.1)';
    ctx.fill();
  }
  text(ctx, label, x - 11, y + 380, { size: 26, weight: 600, color: C.muted });
}

function drawNose(ctx, lt, seg) {
  headline(ctx, 'Breathing', 'Clear nose, no smoke', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.tissue });
  const a0 = span(lt, seg, 0, 1);
  if (a0 > 0) {
    ctx.save();
    ctx.globalAlpha *= a0;
    const p = prog(lt, seg.c(0) + 1.5, 2.5);
    dotGrid(ctx, 160, 380, 24, C.tissue, p, 'Smokers');
    dotGrid(ctx, 640, 380, 14, C.air, p, 'Never smoked');
    stat(ctx, 320, 880, '24%', 'snore habitually', p, { size: 72, color: C.tissue });
    stat(ctx, 800, 880, '14%', 'snore habitually', p, { size: 72, color: C.air });
    card(ctx, 1200, 380, 620, 280, { accent: C.tissue });
    text(ctx, '15,555 adults in five countries. Former smokers were in between, at 20%.', 1240, 450, { size: 28, maxWidth: 540, lineHeight: 1.3 });
    text(ctx, 'Franklin et al., Am J Respir Crit Care Med 2004', 1240, 620, { size: 20, color: C.dim });
    ctx.restore();
  }
  const a1 = span(lt, seg, 1);
  if (a1 > 0) {
    const swell = 1 - prog(lt, seg.c(1) + 1.0, 2.0);
    ctx.save();
    ctx.globalAlpha *= a1;
    head(ctx, { ...defaultState(), swell, glowNose: swell * 0.7, air: 0.9, airSpeed: 1 }, lt, 500, 690, 0.78);
    const [nx, ny] = toScreen([470, 380], 500, 690, 0.78);
    callout(ctx, nx, ny, nx + 240, ny - 200, swell > 0.5 ? 'Swollen lining' : 'Clear', prog(lt, seg.c(1) + 0.3, 1), { dot: swell > 0.5 ? C.tissue : C.air });
    card(ctx, 1080, 330, 740, 230, { accent: C.good });
    icon(ctx, 'check', 1160, 445, 64, C.good);
    text(ctx, 'Allergies blocking your nose? Treating them makes breathing easier.', 1230, 425, { size: 28, maxWidth: 540, lineHeight: 1.3 });
    const q = prog(lt, seg.c(1) + (seg.e(1) - seg.c(1)) * 0.5, 1);
    card(ctx, 1080, 600, 740, 260, { accent: C.amber, alpha: q });
    icon(ctx, 'nose', 1160, 720, 64, C.amber, { alpha: q });
    text(ctx, 'Nasal strips open the nose, but studies have not shown much effect on snoring.', 1230, 690, { size: 28, maxWidth: 540, lineHeight: 1.3, alpha: q });
    text(ctx, 'Camacho et al. 2016 · Ieto et al. 2015', 1230, 830, { size: 20, color: C.dim, alpha: q });
    ctx.restore();
  }
}

// ---------- 9. Wind instruments and singing ----------

function drawFun(ctx, lt, seg) {
  headline(ctx, 'Bonus', 'Play or sing', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.good });
  const p0 = prog(lt, seg.c(0) + 0.3, 1);
  const p1 = prog(lt, seg.c(1) + 0.3, 1);
  // Didgeridoo
  ctx.save();
  ctx.globalAlpha *= p0;
  card(ctx, 110, 300, 820, 620, { accent: C.amber });
  ctx.save();
  ctx.translate(330, 600);
  ctx.rotate(-0.5);
  const dg = ctx.createLinearGradient(-200, 0, 200, 0);
  dg.addColorStop(0, '#7a4a2a');
  dg.addColorStop(0.5, '#b0743f');
  dg.addColorStop(1, '#6a3a20');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(-210, -14); ctx.lineTo(190, -30); ctx.lineTo(200, 30); ctx.lineTo(-210, 14);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#f2cf7a' : '#e06b3a';
    ctx.fillRect(-150 + i * 70, -18 - i * 2, 14, 36 + i * 4);
  }
  ctx.restore();
  soundWaves(ctx, 470, 500, lt * 1.3, { color: C.amber, alpha: 0.8, maxR: 140, spread: 0.6, dir: -0.5 });
  text(ctx, 'Didgeridoo', 560, 400, { size: 40, weight: 700 });
  text(ctx, '25 people with sleep apnea practised ~25 minutes a day, about 6 days a week, for 4 months.', 560, 450, { size: 25, maxWidth: 330, lineHeight: 1.3, color: C.muted });
  text(ctx, 'Less daytime sleepiness. Partners reported less disturbed sleep.', 160, 820, { size: 28, weight: 600, maxWidth: 720, lineHeight: 1.3 });
  text(ctx, 'Puhan et al., BMJ 2006', 160, 895, { size: 20, color: C.dim });
  ctx.restore();
  // Singing
  ctx.save();
  ctx.globalAlpha *= p1;
  card(ctx, 990, 300, 820, 620, { accent: C.good });
  for (let i = 0; i < 4; i++) {
    const ph = (lt * 0.35 + i / 4) % 1;
    icon(ctx, 'music', 1180 + i * 60 + Math.sin(ph * 6 + i) * 20, 640 - ph * 260, 70 + i * 6, i % 2 ? C.good : C.air, { alpha: Math.sin(ph * Math.PI) });
  }
  text(ctx, 'Singing exercises', 1430, 400, { size: 40, weight: 700 });
  text(ctx, 'Daily for 3 months, in a randomized trial of snorers.', 1430, 450, { size: 25, maxWidth: 340, lineHeight: 1.3, color: C.muted });
  text(ctx, 'Snoring became less frequent.', 1040, 820, { size: 28, weight: 600, maxWidth: 720 });
  text(ctx, 'Hilton et al., Int J Otolaryngol Head Neck Surg 2013', 1040, 895, { size: 20, color: C.dim });
  ctx.restore();
}

// ---------- 10. Mouth taping ----------

function drawSkip(ctx, lt, seg) {
  headline(ctx, 'Skip it', 'What about mouth tape?', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.bad });
  const p = prog(lt, 0.5, 1.2);
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(520, 600);
  ctx.scale(0.85, 0.85);
  drawFace(ctx, { ...faceDefaults(), press: 1 }, lt);
  ctx.fillStyle = 'rgba(240,240,250,0.92)';
  ctx.rotate(-0.08);
  roundRect(ctx, -90, 92, 180, 44, 6);
  ctx.fill();
  ctx.restore();
  const st = ease.outBack(clamp((lt - seg.c(0) - 3.2) / 0.6));
  if (st > 0) {
    ctx.save();
    ctx.translate(560, 930);
    ctx.rotate(-0.12);
    ctx.scale(st, st);
    ctx.strokeStyle = C.bad;
    ctx.lineWidth = 10;
    ctx.globalAlpha *= clamp(st);
    roundRect(ctx, -170, -60, 340, 120, 18);
    ctx.stroke();
    text(ctx, 'NOT PROVEN', 0, 22, { size: 50, weight: 800, color: C.bad, align: 'center', family: DISPLAY });
    ctx.restore();
  }
  const r = prog(lt, seg.c(0) + 1.2, 1);
  card(ctx, 1080, 330, 740, 520, { alpha: r, accent: C.bad });
  ctx.save();
  ctx.globalAlpha *= r;
  text(ctx, 'SYSTEMATIC REVIEW · 2025', 1130, 400, { size: 22, weight: 700, color: C.bad, tracking: 3 });
  text(ctx, '10 studies, 213 people', 1130, 470, { size: 40, weight: 700, family: DISPLAY });
  const pts = ['Little evidence that it helps.', 'Several studies warned of a risk of suffocation, especially with a blocked nose.'];
  pts.forEach((s, i) => {
    icon(ctx, i ? 'warning' : 'cross', 1160, 560 + i * 100, 46, i ? C.amber : C.bad);
    text(ctx, s, 1210, 572 + i * 100, { size: 28, maxWidth: 560, lineHeight: 1.25 });
  });
  text(ctx, 'Rhee et al., PLOS One 2025', 1130, 810, { size: 20, color: C.dim });
  ctx.restore();
}

// ---------- 11. When to see a doctor ----------

const SIGNS = [
  { icon: 'lungs', label: 'Stops breathing', sub: 'pauses others notice' },
  { icon: 'warning', label: 'Chokes or gasps', sub: 'in their sleep' },
  { icon: 'sleepy', label: 'Very sleepy', sub: 'during the day' },
  { icon: 'heart', label: 'High blood pressure', sub: '' },
  { icon: 'child', label: 'A child who snores', sub: 'most nights' },
];

function drawDoctor(ctx, lt, seg) {
  headline(ctx, 'Important', 'When to see a doctor', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.bad });
  const a0 = prog(lt, seg.c(0) + 0.4, 1);
  card(ctx, 120, 300, 1680, 200, { alpha: a0, accent: C.bad });
  icon(ctx, 'warning', 230, 400, 90, C.bad, { alpha: a0 });
  text(ctx, 'Loud snoring can be a sign of obstructive sleep apnea, where breathing stops again and again during the night.', 320, 385, { size: 34, weight: 550, alpha: a0, maxWidth: 1400, lineHeight: 1.3 });
  const c1 = seg.c(1), e1 = seg.e(1);
  SIGNS.forEach((s, i) => {
    const t = c1 + 0.6 + (i / SIGNS.length) * (e1 - c1 - 2.2);
    const q = clamp((lt - t) / 0.8);
    const cx = 260 + i * 350;
    const sc = ease.outBack(q);
    if (q <= 0) return;
    ctx.save();
    ctx.translate(cx, 680);
    ctx.scale(sc, sc);
    badge(ctx, s.icon, 0, 0, 80, C.bad, { alpha: clamp(q * 2) });
    ctx.restore();
    text(ctx, s.label, cx, 820, { size: 30, weight: 700, align: 'center', alpha: clamp(q * 2) });
    if (s.sub) text(ctx, s.sub, cx, 860, { size: 24, color: C.muted, align: 'center', alpha: clamp(q * 2) });
  });
  const z = prog(lt, e1 - 1.4, 1);
  pill(ctx, W / 2, 960, 'Sleep apnea is common, and very treatable.', { color: C.good, alpha: z, align: 'center', size: 28 });
}

// ---------- 12. The plan ----------

const PLAN = [
  ['tongue', 'Mouth and throat exercises, every day'],
  ['side', 'Sleep on your side'],
  ['wine', 'No alcohol before bed'],
  ['nose', 'Clear nose, no smoking'],
  ['dumbbell', 'Move more, lose a little weight'],
];

function drawPlan(ctx, lt, seg) {
  headline(ctx, 'Your plan', 'Start tonight', 120, 170, prog(lt, 0.2, 1.2), { size: 76, color: C.good });
  const c0 = seg.c(0), e0 = seg.e(0);
  PLAN.forEach(([ic, s], i) => {
    const t = c0 + 1.6 + (i / PLAN.length) * (e0 - c0 - 2.0);
    checkRow(ctx, 140, 360 + i * 120, s, clamp((lt - t) / 0.9), { iconName: ic, size: 38 });
  });
  // Phone with Snore Log
  const p = prog(lt, seg.c(1) - 0.2, 1.2);
  if (p > 0) {
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.translate(1440, 600 + (1 - p) * 80);
    ctx.rotate(0.05);
    roundRect(ctx, -210, -400, 420, 800, 56);
    ctx.fillStyle = '#0a0d22';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,255,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
    text(ctx, 'Snore Log', -160, -300, { size: 36, weight: 700 });
    text(ctx, 'EXAMPLE', 160, -300, { size: 18, weight: 700, color: C.dim, align: 'right', tracking: 2 });
    text(ctx, 'Snoring per night', -160, -250, { size: 22, color: C.muted });
    const vals = [74, 70, 66, 71, 58, 54, 50, 44, 46, 38, 35, 31, 30, 26];
    const bp = prog(lt, seg.c(1) + 0.6, 3);
    vals.forEach((v, i) => {
      const h = v * 3.4 * clamp(bp * vals.length - i);
      const x = -160 + i * 23;
      roundRect(ctx, x, 120 - h, 16, Math.max(1, h), 6);
      ctx.fillStyle = mix(C.tissue, C.air, i / vals.length);
      ctx.fill();
    });
    text(ctx, 'Week 1', -160, 170, { size: 20, color: C.dim });
    text(ctx, 'Week 2', 160, 170, { size: 20, color: C.dim, align: 'right' });
    roundRect(ctx, -160, 230, 320, 90, 45);
    ctx.fillStyle = rgba(C.air, 0.2);
    ctx.fill();
    text(ctx, 'Compare nights', 0, 287, { size: 28, weight: 650, color: C.air, align: 'center' });
    ctx.restore();
  }
}

// ---------- 13. Sources ----------

export const SOURCES = [
  'Ieto V, et al. Effects of oropharyngeal exercises on snoring: a randomized trial. Chest 2015;148(3):683–691.',
  'Guimarães KC, et al. Effects of oropharyngeal exercises on patients with moderate OSA. Am J Respir Crit Care Med 2009;179:962–966.',
  'Camacho M, et al. Oropharyngeal and tongue exercises (myofunctional therapy) for snoring. Eur Arch Otorhinolaryngol 2018;275:849–855.',
  'Camacho M, et al. Myofunctional therapy to treat obstructive sleep apnea: meta-analysis. Sleep 2015;38(5):669–675.',
  'Rueda JR, et al. Myofunctional therapy for obstructive sleep apnoea. Cochrane Database Syst Rev 2020;11:CD013449.',
  'Abu Alheija M, et al. Effects of orolingual myofunctional therapy on snoring: an RCT. Acta Otolaryngol 2025;145(9):857–865.',
  'Sperger T, et al. Effect of myofunctional therapy on snoring in obese patients: a randomized trial. Sleep Sci 2022;15(4):421–428.',
  'Nakano H, et al. Effects of body position on snoring in apneic and nonapneic snorers. Sleep 2003;26(2):169–172.',
  'Souza FJFB, et al. The influence of head-of-bed elevation in patients with OSA. Sleep Breath 2017;21:815–820.',
  'Issa FG, Sullivan CE. Alcohol, snoring and sleep apnea. J Neurol Neurosurg Psychiatry 1982;45:353–359.',
  'Simou E, et al. Alcohol and the risk of sleep apnoea: a systematic review and meta-analysis. Sleep Med 2018;42:38–46.',
  'Braver HM, et al. Treatment for snoring: combined weight loss, sleeping on side, and nasal spray. Chest 1995;107:1283–1288.',
  'Peppard PE, et al. Longitudinal study of moderate weight change and sleep-disordered breathing. JAMA 2000;284:3015–3021.',
  'Kline CE, et al. The effect of exercise training on OSA and sleep quality: an RCT. Sleep 2011;34(12):1631–1640.',
  'Franklin KA, et al. The influence of active and passive smoking on habitual snoring. Am J Respir Crit Care Med 2004;170:799–803.',
  'Kiely JL, et al. Intranasal corticosteroid therapy for obstructive sleep apnoea in patients with co-existing rhinitis. Thorax 2004;59:50–55.',
  'Camacho M, et al. Nasal dilators (Breathe Right strips and NoZovent) for snoring and OSA. Pulm Med 2016:4841310.',
  'Puhan MA, et al. Didgeridoo playing as alternative treatment for OSA: randomised controlled trial. BMJ 2006;332:266–270.',
  'Hilton MP, et al. Singing exercises improve sleepiness and frequency of snoring among snorers: an RCT. Int J Otolaryngol Head Neck Surg 2013;2:97–102.',
  'Rhee J, et al. Mouth taping for mouth breathing, snoring and sleep apnea: a systematic review. PLOS One 2025;20(5):e0323643.',
];

function drawSources(ctx, lt, seg) {
  const p = prog(lt, 0.2, 1);
  text(ctx, 'SOURCES', 120, 130, { size: 26, weight: 700, color: C.air, tracking: 4, alpha: p });
  const scroll = Math.max(0, lt - 3) * 26;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 170, W, 760);
  ctx.clip();
  SOURCES.forEach((s, i) => {
    const y = 230 + i * 64 - scroll;
    const a = clamp((y - 170) / 60) * clamp((930 - y) / 60);
    text(ctx, `${i + 1}.`, 150, y, { size: 24, weight: 700, color: C.dim, alpha: a * p, align: 'right' });
    text(ctx, s, 170, y, { size: 24, weight: 500, color: C.muted, alpha: a * p, maxWidth: 1600 });
  });
  ctx.restore();
  const z = prog(lt, 1.0, 1);
  text(ctx, 'This video is general information, not medical advice. If you might have sleep apnea, see a doctor.', W / 2, 1010, { size: 24, color: C.dim, align: 'center', alpha: z });
}

// ---------- segments ----------

const snoreSfx = (start, period, end, gain = 0.9) => snoreTimes(start, period, end).map((t) => ({ t, type: 'snore', gain }));

export const segments = [
  {
    id: 'intro', draw: drawIntro, lead: 4.2, tail: 1.4,
    cues: [
      { text: 'Snoring is one of the most common sleep problems. And the person lying next to you often loses as much sleep as you do.' },
      { text: "In this video, we'll look at why snoring happens, and which fixes you can do at home actually have research behind them." },
    ],
    sfx: (s) => [...snoreSfx(0.4, 3.4, 4.2, 1.0), ...snoreSfx(0.4 + 3.4 * 2, 3.4, s.dur, 0.25), { t: s.dur - 0.5, type: 'whoosh', gain: 0.5 }],
  },
  {
    id: 'airway', draw: drawAirway, lead: 1.0, tail: 4.0,
    cues: [
      { text: "Let's look inside. When you breathe in through your nose, air flows down behind the soft palate and the back of the tongue, and into the windpipe." },
      { text: "When you're awake, the muscles of your throat hold this airway open." },
      { text: 'When you fall asleep, those muscles relax. The soft palate and the tongue sag backward, and the airway gets narrower.' },
      { text: 'Air has to speed up to get through the gap, and the soft tissue starts to flutter, like a flag in the wind. That vibration is the sound of snoring.' },
    ],
    sfx: (s) => [...snoreSfx(s.c(3) + 0.3, 3.0, s.dur, 0.45), { t: s.dur - 0.5, type: 'whoosh', gain: 0.5 }],
  },
  {
    id: 'worse', draw: drawWorse, lead: 0.8, tail: 1.6,
    cues: [
      { text: 'Some things make the airway narrower, or the muscles floppier.' },
      { text: 'Sleeping on your back lets gravity pull the tongue and soft palate down toward your throat.', gap: 0.8 },
      { text: 'Alcohol relaxes the throat muscles even more. In a small sleep-lab study, alcohol before bed made habitual snorers start having pauses in their breathing.', gap: 0.8 },
      { text: 'Extra weight adds soft tissue around the airway.', gap: 0.8 },
      { text: 'And a blocked nose, or smoking, can swell and irritate the lining of your nose and throat.' },
    ],
    sfx: (s) => [1, 2, 3, 4].map((i) => ({ t: s.c(i) - 0.15, type: 'pop', gain: 0.6 })),
  },
  {
    id: 'exercises', draw: drawExercises, lead: 0.8, tail: 2.0, gap: 0.7,
    cues: [
      { text: 'So, what helps? The strongest evidence for something you can do at home is, perhaps surprisingly, exercise. For your mouth and throat.' },
      { text: 'In a randomized trial published in 2015, adults who snored did about eight minutes of tongue, soft palate and cheek exercises, three times a day.' },
      { text: "After three months, sleep recordings showed their snores per hour had roughly halved, and so had the total power of their snoring. The comparison group, who used nasal strips and breathing exercises, didn't change significantly." },
      { text: 'A review that pooled nine studies found the same direction: snoring got quieter and less frequent. And a 2025 trial of a hundred and twenty-five people found that six weeks of tongue exercises reduced snoring, as rated by their bed partners.' },
      { text: "The studies are small, and not every one found a benefit. But the exercises are free and safe, and they work like physiotherapy: daily practice, for weeks to months." },
      { text: 'Our second video walks you through the full routine, with a timer for every exercise.' },
    ],
    sfx: (s) => [{ t: s.c(1), type: 'pop', gain: 0.5 }, { t: s.c(2) + 0.2, type: 'pop', gain: 0.5 }, { t: s.c(3), type: 'pop', gain: 0.5 }, { t: s.c(5), type: 'chime', gain: 0.5 }],
  },
  {
    id: 'side', draw: drawSide, lead: 0.8, tail: 2.0,
    cues: [
      { text: 'Next: sleep on your side. In sleep-lab recordings, people who snore without sleep apnea snore less often, and more quietly, when they lie on their side.' },
      { text: 'A pillow behind your back can help you stay there. Raising the head of the bed slightly may also help: in a study of people with sleep apnea, a gentle tilt cut breathing interruptions by about a third.' },
    ],
    sfx: (s) => [...snoreSfx(0.8, 3.0, s.c(0) + 4.2, 0.35)],
  },
  {
    id: 'alcohol', draw: drawAlcohol, lead: 0.8, tail: 1.6,
    cues: [
      { text: 'Go easy on alcohol, especially in the evening. A review of twenty-one studies found that people who drink more have about a twenty-five percent higher risk of sleep apnea.' },
      { text: 'And if you take sleeping pills or sedatives, ask your doctor whether they could be making your snoring worse.' },
    ],
  },
  {
    id: 'weight', draw: drawWeight, lead: 0.8, tail: 1.8,
    cues: [
      { text: "If you're carrying extra weight, losing some can help. In a small study of heavy snorers, men who lost three kilos or more snored about forty-five percent less." },
      { text: 'In a larger study that followed six hundred and ninety adults for four years, losing ten percent of body weight went with about a quarter fewer breathing interruptions in sleep.' },
      { text: 'Exercise itself seems to help too. In a twelve-week trial, people with sleep apnea who did aerobic and strength training had fewer breathing interruptions, even though they barely lost weight.' },
    ],
    sfx: (s) => [0, 1, 2].map((i) => ({ t: s.c(i) + 0.2, type: 'pop', gain: 0.5 })),
  },
  {
    id: 'nose', draw: drawNose, lead: 0.8, tail: 1.8,
    cues: [
      { text: "Keep your nose clear, and don't smoke. In a survey of over fifteen thousand adults, about one in four smokers snored habitually, compared with one in seven people who had never smoked." },
      { text: "If allergies block your nose, treating them can make breathing easier. Nasal strips do open the nose, but studies haven't shown they reduce snoring much." },
    ],
  },
  {
    id: 'fun', draw: drawFun, lead: 0.8, tail: 1.8,
    cues: [
      { text: 'Two fun options also have small trials behind them. Playing the didgeridoo for about twenty-five minutes a day reduced daytime sleepiness in people with sleep apnea, and their partners slept better.' },
      { text: 'And daily singing exercises for three months made snoring less frequent, in a trial of snorers. Both work the muscles of the throat and soft palate.' },
    ],
  },
  {
    id: 'skip', draw: drawSkip, lead: 0.8, tail: 2.0,
    cues: [
      { text: "What about mouth taping? A 2025 review of ten studies found little evidence that it helps, and several studies warned it can be risky, especially if your nose is blocked. We'd skip it." },
    ],
    sfx: (s) => [{ t: s.c(0) + 3.2, type: 'pop', gain: 0.8 }],
  },
  {
    id: 'doctor', draw: drawDoctor, lead: 0.8, tail: 2.2,
    cues: [
      { text: 'One important warning. Loud snoring can be a sign of obstructive sleep apnea, where breathing stops again and again during the night.' },
      { text: "See a doctor if someone notices you stop breathing, choke or gasp in your sleep, if you're very sleepy during the day, or if you have high blood pressure. Children who snore most nights should be checked too. Sleep apnea is common, and very treatable." },
    ],
  },
  {
    id: 'plan', draw: drawPlan, lead: 0.8, tail: 2.6,
    cues: [
      { text: "So here's the plan. Do the mouth and throat exercises every day. Sleep on your side. Skip alcohol before bed. Keep your nose clear, and don't smoke. And if you can, move more and lose a little weight." },
      { text: 'Give it a few weeks, and measure it. Snore Log can record your nights and compare them, so you can see what actually works for you.' },
    ],
    sfx: (s) => [{ t: s.e(1) + 0.3, type: 'chime', gain: 0.6 }],
  },
  { id: 'sources', draw: drawSources, dur: 24, cues: [] },
];
