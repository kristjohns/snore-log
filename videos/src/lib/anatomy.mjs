// Side-view cutaway of the head and upper airway, facing right.
// Local coordinates: about 640 × 820. The tongue and soft palate are built from
// poses that blend together, so exercises and sleep states are just numbers.

import { clamp, lerp, ease, noise1 } from './anim.mjs';
import { C, rgba, mix, spline, sampleSpline, pointAt, drawGlow } from './draw.mjs';

// ---------- static outlines ----------

const SKIN = [
  [170, 830], [150, 680], [112, 548], [66, 410], [66, 250], [140, 110], [290, 42], [440, 70],
  [520, 160], [552, 245], [544, 286], [578, 350], [616, 404], [602, 430], [566, 436],
  [573, 470], [567, 490], [567, 493], [572, 512], [550, 540], [566, 590], [544, 628], [474, 644],
  [444, 694], [450, 830],
];
const SKIN_LOWER_FROM = 16; // index of the first point that moves with the jaw

const SKULL_OUT = [
  [96, 420], [82, 270], [150, 135], [292, 72], [432, 98], [505, 178], [528, 250], [500, 268],
  [430, 252], [370, 280], [300, 300], [210, 330], [150, 380],
];
const BRAIN = [
  [120, 392], [106, 278], [166, 160], [292, 100], [420, 122], [482, 192], [494, 236], [430, 230],
  [370, 255], [300, 272], [214, 300], [160, 345],
];

const NASAL = [
  [600, 428], [588, 400], [566, 356], [530, 320], [470, 306], [410, 308], [372, 320], [348, 344],
  [330, 386], [318, 440], [372, 446], [392, 430], [452, 426], [520, 430], [566, 436],
];

// Oral cavity, pharynx, larynx and trachea. The tongue and palates are drawn on top.
const ORAL = [
  [534, 470], [506, 452], [452, 445], [392, 450], [350, 446], [326, 420], [308, 470], [300, 540],
  [300, 610], [306, 664], [322, 700], [336, 742], [340, 840], [398, 840], [396, 742], [384, 684],
  [370, 652], [392, 622], [432, 592], [490, 548], [530, 516],
];

// Posterior pharyngeal wall (front edge of the tissue in front of the spine).
const WALL = [
  [372, 296], [344, 328], [326, 380], [314, 440], [304, 500], [300, 560], [301, 620], [306, 664],
];

const HARD_PALATE = [
  [538, 444], [530, 430], [470, 424], [400, 426], [384, 434], [392, 446], [452, 442], [504, 450],
  [530, 466], [542, 462],
];

const MANDIBLE = [
  [524, 532], [538, 528], [548, 552], [549, 592], [537, 614], [518, 615], [507, 596], [509, 556],
];

const TURBINATES = [
  [[520, 336], [480, 324], [440, 324], [424, 332], [452, 340], [496, 342]],
  [[548, 362], [500, 348], [440, 344], [408, 354], [440, 366], [510, 370]],
  [[562, 410], [510, 398], [446, 396], [408, 406], [446, 418], [520, 420]],
];

// ---------- tongue poses ----------
// Closed outline: tip → dorsum → back → base → root → floor of mouth → tip.

const TONGUE_REST = [
  [528, 504], [512, 484], [476, 466], [432, 459], [396, 465], [370, 483], [354, 516], [348, 560],
  [352, 604], [380, 624], [430, 614], [478, 592], [506, 566], [522, 534],
];

const TONGUE_POSES = {
  // Tip lifted onto the ridge just behind the upper front teeth.
  tipUp: [
    [528, 462], [516, 456], [478, 470], [432, 470], [392, 476], [366, 494], [352, 526], [348, 566],
    [354, 606], [382, 624], [430, 612], [478, 588], [508, 562], [524, 512],
  ],
  // Tip slid back along the roof of the mouth.
  slide: [
    [470, 449], [452, 450], [436, 462], [412, 478], [384, 486], [360, 502], [346, 530], [344, 568],
    [352, 606], [382, 624], [430, 612], [478, 588], [500, 560], [492, 498],
  ],
  // Whole tongue sucked flat against the palate.
  suck: [
    [526, 466], [506, 454], [466, 448], [426, 448], [394, 454], [370, 470], [354, 508], [350, 560],
    [354, 606], [382, 624], [430, 612], [478, 588], [508, 560], [524, 512],
  ],
  // Back of the tongue pushed down to the floor, tip on the lower teeth.
  down: [
    [530, 506], [508, 496], [470, 494], [432, 500], [398, 512], [376, 530], [362, 556], [356, 586],
    [358, 612], [384, 626], [430, 614], [478, 590], [508, 564], [524, 532],
  ],
  // Relaxed in sleep: the base falls back toward the throat wall.
  fall: [
    [526, 506], [502, 490], [460, 480], [414, 476], [372, 486], [340, 506], [318, 540], [312, 578],
    [326, 614], [374, 628], [430, 612], [478, 588], [508, 562], [522, 532],
  ],
};

// ---------- soft palate poses (centreline from the hard palate back) ----------

const VELUM = {
  rest: [[388, 440], [366, 458], [350, 486], [340, 516]],
  lift: [[388, 440], [366, 440], [346, 432], [328, 424]],
  sag: [[388, 440], [360, 468], [334, 500], [316, 530]],
};
const VELUM_THICK = [22, 20, 15, 10];

function blend(base, poses, weights) {
  return base.map((p, i) => {
    let x = p[0], y = p[1];
    for (const k in weights) {
      const w = weights[k];
      if (!w) continue;
      const q = poses[k][i];
      x += (q[0] - p[0]) * w;
      y += (q[1] - p[1]) * w;
    }
    return [x, y];
  });
}

function rotateAbout(pts, cx, cy, a, weightFn = () => 1) {
  if (!a) return pts;
  return pts.map(([x, y]) => {
    const w = weightFn(x, y);
    const aa = a * w;
    const c = Math.cos(aa), s = Math.sin(aa);
    const dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}

const JAW_PIVOT = [330, 330];

export const defaultState = () => ({
  jaw: 0,
  tipUp: 0, slide: 0, suck: 0, down: 0, fall: 0,
  lift: 0, sag: 0,
  flutter: 0,
  wall: 0, // extra tissue on the throat walls (weight)
  swell: 0, // nasal swelling (blocked nose)
  lips: 0, // lips pressed
  glowTongue: 0, glowPalate: 0, glowLips: 0, glowAir: 0, glowNose: 0,
  air: 0, // airflow particles visibility
  airSpeed: 1,
  brain: 1,
});

// ---------- geometry helpers ----------

function velumOutline(state, t) {
  const w = { lift: state.lift, sag: state.sag };
  let line = blend(VELUM.rest, VELUM, w);
  // Flutter: distal part vibrates perpendicular to the palate.
  if (state.flutter > 0) {
    const f = Math.sin(t * Math.PI * 2 * 5.2) * 0.7 + Math.sin(t * Math.PI * 2 * 8.3) * 0.3;
    line = line.map(([x, y], i) => {
      const k = (i / (line.length - 1)) ** 1.6;
      return [x - f * 9 * k * state.flutter, y + f * 4 * k * state.flutter];
    });
  }
  const left = [], right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const th = VELUM_THICK[i] / 2;
    left.push([line[i][0] + nx * th, line[i][1] + ny * th]);
    right.push([line[i][0] - nx * th, line[i][1] - ny * th]);
  }
  return { line, outline: [...left, ...right.reverse()], tip: line[line.length - 1] };
}

function tongueOutline(state, t) {
  let pts = blend(TONGUE_REST, TONGUE_POSES, {
    tipUp: state.tipUp, slide: state.slide, suck: state.suck, down: state.down, fall: state.fall,
  });
  if (state.flutter > 0) {
    const f = Math.sin(t * Math.PI * 2 * 5.2 + 1.3);
    pts = pts.map(([x, y], i) => (i >= 5 && i <= 8 ? [x - f * 2.5 * state.flutter, y] : [x, y]));
  }
  // The front of the tongue moves with the jaw.
  return rotateAbout(pts, JAW_PIVOT[0], JAW_PIVOT[1], state.jaw * 0.2, (x) => clamp((x - 360) / 160));
}

function wallLine(state) {
  return WALL.map(([x, y]) => {
    const k = clamp((y - 360) / 200) * (1 - clamp((y - 620) / 60));
    return [x + state.wall * 22 * k, y];
  });
}

// Airway centreline from the nostril to the windpipe.
const AIR_PATH = [
  [600, 432], [580, 404], [544, 386], [490, 382], [430, 381], [380, 380], [346, 400],
  [326, 448], [318, 510], [320, 570], [326, 628], [342, 680], [360, 740], [368, 820],
];

function polyXAtY(poly, y, side = 'min') {
  // The extreme x of a polygon's edges crossing height y.
  let best = side === 'min' ? Infinity : -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    best = side === 'min' ? Math.min(best, x) : Math.max(best, x);
  }
  return best;
}

export function geometry(state, t) {
  const tongue = tongueOutline(state, t);
  const velum = velumOutline(state, t);
  const wall = wallLine(state);
  // Width of the pharynx at a few heights: from the throat wall to the
  // nearest of soft palate / tongue.
  const gap = (y) => {
    const wx = polyXAtY(wall, y, 'max');
    const ax = Math.min(polyXAtY(tongue, y, 'min'), polyXAtY(velum.outline, y, 'min'));
    return { wx, ax, w: Math.max(0, ax - wx) };
  };
  return { tongue, velum, wall, gap };
}

// ---------- drawing ----------

function fillPoly(ctx, pts, style, closed = true) {
  ctx.beginPath();
  spline(ctx, pts, closed, 0.5);
  ctx.fillStyle = style;
  ctx.fill();
}

function strokePoly(ctx, pts, style, width, closed = true) {
  ctx.beginPath();
  spline(ctx, pts, closed, 0.5);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
}

// Particles that stream along the airway. Speed rises where it narrows.
function drawAir(ctx, state, geo, t) {
  if (state.air <= 0) return;
  const path = sampleSpline(AIR_PATH, 14);
  // Half-width along the path.
  const N = 60;
  const half = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const [x, y] = pointAt(path, i / N);
    let h = 22;
    if (i / N < 0.36) h = 10 - state.swell * 7; // between the turbinates
    if (y > 420 && y < 640) {
      const g = geo.gap(y);
      if (isFinite(g.w)) h = Math.max(2, g.w / 2);
    }
    if (y >= 640) h = 18;
    half[i] = h;
  }
  // Travel-time warp: particles move slower where wide, faster where narrow.
  const cum = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + Math.sqrt(half[i] + 4);
  const total = cum[N];
  const uAt = (tau) => {
    const target = tau * total;
    let i = 1;
    while (i < N && cum[i] < target) i++;
    const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return (i - 1 + f) / N;
  };
  const halfAt = (u) => half[Math.min(N, Math.round(u * N))];

  const count = 150;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const seed = (i * 0.61803398875) % 1;
    const lane = ((i * 0.7548776662) % 1) * 2 - 1;
    const tau = (seed + t * 0.12 * state.airSpeed) % 1;
    const u = uAt(tau), u2 = uAt(Math.max(0, tau - 0.012));
    const [x, y, a] = pointAt(path, u);
    const [x2, y2, a2] = pointAt(path, u2);
    const h = halfAt(u), h2 = halfAt(u2);
    const narrow = clamp((14 - h) / 12);
    const jitter = noise1(t * 9 + i * 3.1) * narrow * (4 + state.flutter * 8);
    const off = lane * h * 0.8 + jitter;
    const off2 = lane * h2 * 0.8;
    const px = x - Math.sin(a) * off, py = y + Math.cos(a) * off;
    const qx = x2 - Math.sin(a2) * off2, qy = y2 + Math.cos(a2) * off2;
    const fade = Math.sin(Math.PI * clamp(tau * 1.15)) ;
    const col = narrow > 0.3 && state.flutter > 0 ? mix(C.air, C.tissue, narrow * 0.7) : C.air;
    ctx.globalAlpha = state.air * fade * 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
}

function skinOutline(state) {
  if (!state.jaw) return SKIN;
  const a = state.jaw * 0.2;
  return SKIN.map((p, i) => {
    if (i < SKIN_LOWER_FROM || i >= SKIN.length - 1) return p;
    const w = i >= SKIN.length - 3 ? 0.35 : 1;
    return rotateAbout([p], JAW_PIVOT[0], JAW_PIVOT[1], a * w)[0];
  });
}

function jawPt(state, p) {
  return rotateAbout([p], JAW_PIVOT[0], JAW_PIVOT[1], state.jaw * 0.2)[0];
}

export function drawHead(ctx, state, t, opts = {}) {
  const geo = geometry(state, t);
  const SKIN = skinOutline(state);

  // Skin silhouette
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 50;
  const sg = ctx.createLinearGradient(80, 0, 620, 0);
  sg.addColorStop(0, '#c98d74');
  sg.addColorStop(0.7, C.skin);
  sg.addColorStop(1, '#f7d2bb');
  fillPoly(ctx, SKIN, sg, false);
  ctx.restore();

  // Cut surface: a slightly darker tissue tone inside the outline.
  ctx.save();
  ctx.beginPath();
  spline(ctx, SKIN, false, 0.5);
  ctx.clip();
  const cg = ctx.createRadialGradient(380, 470, 40, 380, 470, 520);
  cg.addColorStop(0, '#e9a596');
  cg.addColorStop(1, '#c47b6e');
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, 700, 900);
  ctx.globalAlpha = 1;
  // Rim of skin left visible
  ctx.lineWidth = 16;
  ctx.strokeStyle = rgba('#f2c4a8', 0.9);
  ctx.beginPath();
  spline(ctx, SKIN, false, 0.5);
  ctx.stroke();

  // Skull and brain
  if (state.brain > 0) {
    ctx.globalAlpha = state.brain;
    fillPoly(ctx, SKULL_OUT, '#efe3cf');
    const bg = ctx.createRadialGradient(300, 200, 20, 300, 220, 260);
    bg.addColorStop(0, '#d9c3d9');
    bg.addColorStop(1, '#b79ab8');
    fillPoly(ctx, BRAIN, bg);
    // gyri hints
    ctx.strokeStyle = 'rgba(120,80,120,0.25)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -2.6 + i * 0.32;
      const cx = 300 + Math.cos(a) * 120, cy = 215 + Math.sin(a) * 95;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, a + 1.2, a + 3.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Cervical spine
  for (let i = 0; i < 7; i++) {
    const y = 360 + i * 66;
    const x = 214 + i * 2;
    ctx.fillStyle = '#efe3cf';
    ctx.beginPath();
    ctx.roundRect?.(x, y, 64, 52, 12);
    if (!ctx.roundRect) ctx.rect(x, y, 64, 52);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,110,90,0.35)';
    ctx.fillRect(x + 6, y + 54, 52, 9);
  }

  // Air spaces
  const airCol = '#0b1230';
  fillPoly(ctx, NASAL, airCol);
  fillPoly(ctx, ORAL, airCol);
  if (state.jaw > 0.02) {
    // Open mouth: the gap between the lips and teeth joins the oral cavity.
    const open = [
      [534, 470], [545, 499], [556, 490], [568, 490],
      jawPt(state, [567, 493]), jawPt(state, [552, 495]), jawPt(state, [541, 494]), jawPt(state, [530, 516]),
    ];
    ctx.beginPath();
    open.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = airCol;
    ctx.fill();
  }
  // Throat wall: extra tissue with weight, and a moist mucosa edge.
  if (state.wall > 0) {
    ctx.beginPath();
    ctx.moveTo(WALL[0][0], WALL[0][1]);
    for (const p of geo.wall) ctx.lineTo(p[0], p[1]);
    for (const p of WALL.slice().reverse()) ctx.lineTo(p[0] - 6, p[1]);
    ctx.closePath();
    ctx.fillStyle = mix('#e9a596', '#f2cf7a', clamp(state.wall * 1.4));
    ctx.fill();
  }
  ctx.beginPath();
  spline(ctx, geo.wall, false, 0.5);
  ctx.strokeStyle = 'rgba(255,150,160,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Soft inner glow in the airway
  if (state.glowAir > 0) {
    ctx.save();
    ctx.beginPath();
    spline(ctx, ORAL, true, 0.5);
    spline(ctx, NASAL, true, 0.5);
    ctx.clip();
    drawGlow(ctx, 330, 520, 220, C.air, state.glowAir * 0.5);
    drawGlow(ctx, 470, 360, 200, C.air, state.glowAir * 0.35);
    ctx.restore();
  }

  // Turbinates (swell when the nose is blocked)
  for (const tb of TURBINATES) {
    const cy = tb.reduce((s, p) => s + p[1], 0) / tb.length;
    const sw = tb.map(([x, y]) => [x, y + (y - cy) * state.swell * 1.6]);
    fillPoly(ctx, sw, mix('#d98a80', '#ff6f7f', state.swell * 0.6));
  }
  if (state.glowNose > 0) drawGlow(ctx, 480, 380, 160, C.tissue, state.glowNose * 0.7);

  // Hard palate (bone)
  fillPoly(ctx, HARD_PALATE, '#f3e8d6');
  strokePoly(ctx, HARD_PALATE, 'rgba(150,120,90,0.35)', 2);

  // Soft palate + uvula
  const vg = ctx.createLinearGradient(390, 440, 330, 520);
  vg.addColorStop(0, '#e9877f');
  vg.addColorStop(1, '#f39a92');
  fillPoly(ctx, geo.velum.outline, vg);
  ctx.beginPath();
  ctx.arc(geo.velum.tip[0], geo.velum.tip[1], 8, 0, Math.PI * 2);
  ctx.fillStyle = '#f39a92';
  ctx.fill();
  if (state.glowPalate > 0) {
    drawGlow(ctx, geo.velum.line[2][0], geo.velum.line[2][1], 90, C.amber, state.glowPalate * 0.8);
    strokePoly(ctx, geo.velum.outline, rgba(C.amber, state.glowPalate), 3);
  }

  // Epiglottis
  const epi = [[368, 656], [356, 630], [342, 602], [330, 580], [334, 574], [346, 586], [362, 614], [376, 650]];
  fillPoly(ctx, epi, '#f0a49a');

  // Tongue
  const tg = ctx.createLinearGradient(520, 460, 360, 620);
  tg.addColorStop(0, '#f0767f');
  tg.addColorStop(0.55, '#d94f61');
  tg.addColorStop(1, '#b23c52');
  ctx.save();
  if (state.glowTongue > 0) {
    ctx.shadowColor = rgba(C.amber, 0.9 * state.glowTongue);
    ctx.shadowBlur = 40 * state.glowTongue;
  }
  fillPoly(ctx, geo.tongue, tg);
  ctx.restore();
  // muscle fibres
  ctx.save();
  ctx.beginPath();
  spline(ctx, geo.tongue, true, 0.5);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,20,40,0.22)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const a = -2.2 + i * 0.22;
    ctx.beginPath();
    ctx.moveTo(500, 600);
    ctx.quadraticCurveTo(500 + Math.cos(a) * 120, 600 + Math.sin(a) * 120, 500 + Math.cos(a) * 240, 600 + Math.sin(a) * 200);
    ctx.stroke();
  }
  // highlight along the top
  ctx.strokeStyle = 'rgba(255,220,220,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  spline(ctx, geo.tongue.slice(1, 6), false, 0.5);
  ctx.stroke();
  ctx.restore();
  if (state.glowTongue > 0) strokePoly(ctx, geo.tongue, rgba(C.amber, state.glowTongue), 3.5);

  // Hyoid
  ctx.fillStyle = '#f3e8d6';
  ctx.beginPath();
  ctx.ellipse(392, 636, 16, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Larynx / trachea rings
  ctx.strokeStyle = 'rgba(243,232,214,0.85)';
  ctx.lineWidth = 7;
  for (let i = 0; i < 4; i++) {
    const y = 730 + i * 26;
    ctx.beginPath();
    ctx.moveTo(342 + i * 0.6, y);
    ctx.lineTo(396 + i * 0.4, y + 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#e6d6c0';
  ctx.beginPath();
  ctx.moveTo(384, 660); ctx.lineTo(410, 668); ctx.lineTo(404, 716); ctx.lineTo(392, 714); ctx.closePath();
  ctx.fill();
  // Vocal folds
  ctx.fillStyle = '#e88d86';
  ctx.beginPath();
  ctx.ellipse(366, 706, 22, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Lower jaw group: mandible, lower teeth, lower lip, chin.
  ctx.save();
  ctx.translate(JAW_PIVOT[0], JAW_PIVOT[1]);
  ctx.rotate(state.jaw * 0.2);
  ctx.translate(-JAW_PIVOT[0], -JAW_PIVOT[1]);
  // lower incisor (root sits in the jaw bone)
  fillPoly(ctx, [[533, 540], [530, 518], [535, 499], [541, 494], [547, 500], [545, 520], [541, 540]], '#fbfaf5');
  fillPoly(ctx, MANDIBLE, '#f3e8d6');
  // lower lip
  const press = state.lips;
  const ll = ctx.createLinearGradient(0, 492, 0, 540);
  ll.addColorStop(0, '#d8606e');
  ll.addColorStop(0.55, '#e58e8e');
  ll.addColorStop(1, C.skin);
  fillPoly(ctx, [[566 - press * 2, 492], [572 - press * 3, 510], [560, 532], [544, 536], [548, 512], [552, 494]], ll);
  ctx.restore();

  // Upper incisor, root in the upper jaw bone
  fillPoly(ctx, [[537, 446], [548, 446], [554, 470], [551, 493], [545, 499], [540, 492], [537, 470]], '#fbfaf5');
  fillPoly(ctx, [[528, 430], [552, 436], [556, 458], [538, 466], [526, 452]], '#f3e8d6');
  // upper lip
  const ul = ctx.createLinearGradient(0, 436, 0, 492);
  ul.addColorStop(0, C.skin);
  ul.addColorStop(0.45, '#e58e8e');
  ul.addColorStop(1, '#d8606e');
  fillPoly(ctx, [[566, 436], [574 - press * 3, 466], [567 - press * 2, 491], [556, 490], [555, 466], [556, 444]], ul);
  if (state.glowLips > 0) drawGlow(ctx, 566, 492, 80, C.amber, state.glowLips * 0.8);

  ctx.restore(); // clip

  drawAir(ctx, state, geo, t);

  return geo;
}

// Landmarks in local coordinates, for labels and effects.
export const LM = {
  nose: [520, 380],
  nostril: [600, 432],
  softPalate: [360, 470],
  uvula: [340, 516],
  tongue: [440, 520],
  tongueBase: [352, 560],
  throat: [312, 540],
  wall: [300, 520],
  trachea: [368, 780],
  lips: [570, 492],
  mouth: [600, 490],
};

export { AIR_PATH };
