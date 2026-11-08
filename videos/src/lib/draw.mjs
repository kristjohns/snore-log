// Drawing primitives shared by both videos: theme, background, text, cards,
// rings and icons. All drawing goes through a plain Canvas 2D context.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { clamp, lerp, ease, rng, noise1 } from './anim.mjs';

export const W = 1920;
export const H = 1080;

GlobalFonts.loadSystemFonts?.();

export const C = {
  bg0: '#060a1c',
  bg1: '#0e1638',
  bg2: '#1b1748',
  ink: '#f4f6ff',
  muted: '#aab4da',
  dim: '#6d78a3',
  line: 'rgba(170,180,230,0.18)',
  card: 'rgba(22,30,70,0.62)',
  cardEdge: 'rgba(160,175,255,0.22)',
  air: '#45e0d0',
  airSoft: 'rgba(69,224,208,0.35)',
  tissue: '#ff7f91',
  amber: '#ffc56b',
  violet: '#9d8cff',
  good: '#6ee7a8',
  bad: '#ff6b78',
  skin: '#f2c4a8',
  skinShade: '#d9a084',
};

export const FONT = 'Inter';
export const DISPLAY = 'Inter Display';

export function font(size, weight = 500, family = FONT) {
  // Skia only accepts the standard weights 100…900 in steps of 100.
  const w = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  return `${w} ${size}px ${family}`;
}

export function newCanvas(w = W, h = H) {
  const c = createCanvas(w, h);
  return [c, c.getContext('2d')];
}

// ---------- colour ----------

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------- background ----------

const STAR_COUNT = 260;
const stars = (() => {
  const r = rng(7);
  return Array.from({ length: STAR_COUNT }, () => ({
    x: r() * W,
    y: r() * H,
    s: 0.5 + Math.pow(r(), 3) * 2.2,
    p: r() * 10,
    f: 0.3 + r() * 1.2,
  }));
})();

let glowSprite = null;
export function glow(color = '#ffffff', size = 128) {
  // Cached radial glow sprites keyed by colour.
  glowSprite ??= new Map();
  const key = color + size;
  if (glowSprite.has(key)) return glowSprite.get(key);
  const [c, x] = newCanvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, 1));
  g.addColorStop(0.25, rgba(color, 0.45));
  g.addColorStop(1, rgba(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  glowSprite.set(key, c);
  return c;
}

export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glow(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// Night-sky backdrop with slowly drifting nebula light and twinkling stars.
export function background(ctx, t, opts = {}) {
  const { hue = 0, starAlpha = 1 } = opts;
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, C.bg0);
  g.addColorStop(0.6, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const drift = t * 0.02;
  drawGlow(ctx, W * (0.18 + 0.05 * Math.sin(drift * 3)), H * 0.25, 700, hue ? '#2a7fbf' : '#3d2fa8', 0.35);
  drawGlow(ctx, W * (0.85 + 0.04 * Math.cos(drift * 2)), H * 0.8, 800, '#16627a', 0.3);
  drawGlow(ctx, W * 0.6, H * (0.1 + 0.05 * Math.sin(drift * 5)), 500, '#5a2f8f', 0.18);

  if (starAlpha > 0) {
    ctx.save();
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.p);
      ctx.globalAlpha = starAlpha * tw * (0.35 + s.s / 3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------- shapes ----------

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function card(ctx, x, y, w, h, opts = {}) {
  const { r = 28, fill = C.card, edge = C.cardEdge, alpha = 1, accent = null, shadow = true } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
  }
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = edge;
  ctx.stroke();
  if (accent) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 8, h);
    ctx.restore();
  }
  ctx.restore();
}

export function pill(ctx, x, y, text, opts = {}) {
  const { size = 24, color = C.air, alpha = 1, fill = null, weight = 650, pad = 18, align = 'left' } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight);
  const w = ctx.measureText(text).width + pad * 2;
  const h = size * 1.75;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  roundRect(ctx, x0, y - h / 2, w, h, h / 2);
  ctx.fillStyle = fill ?? rgba(color, 0.16);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x0 + pad, y + 1);
  ctx.restore();
  return w;
}

// ---------- text ----------

export function wrap(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

// Text that rises and fades in, word-group by line.
export function text(ctx, str, x, y, opts = {}) {
  const {
    size = 40, weight = 500, color = C.ink, family = FONT, align = 'left', maxWidth = 0,
    lineHeight = 1.25, alpha = 1, rise = 0, baseline = 'alphabetic', shadow = false, tracking = 0,
  } = opts;
  if (alpha <= 0) return 0;
  ctx.save();
  ctx.font = font(size, weight, family);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (tracking) ctx.letterSpacing = `${tracking}px`;
  const lines = maxWidth ? wrap(ctx, str, maxWidth) : String(str).split('\n');
  ctx.fillStyle = color;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  lines.forEach((ln, i) => {
    ctx.globalAlpha = alpha;
    ctx.fillText(ln, x, y + i * size * lineHeight + rise);
  });
  ctx.restore();
  return lines.length * size * lineHeight;
}

// Lines appear one after another starting at `t0`.
export function revealLines(ctx, lines, x, y, t, t0, opts = {}) {
  const { size = 40, gap = 0.18, dur = 0.6, lineHeight = 1.35, ...rest } = opts;
  let yy = y;
  lines.forEach((ln, i) => {
    const p = ease.outCubic(clamp((t - t0 - i * gap) / dur));
    text(ctx, ln, x, yy, { size, alpha: p * (rest.alpha ?? 1), rise: (1 - p) * 24, ...rest });
    yy += size * lineHeight;
  });
  return yy;
}

// ---------- progress ring ----------

export function ring(ctx, x, y, r, p, opts = {}) {
  const { width = 18, color = C.air, track = 'rgba(255,255,255,0.08)', glowAlpha = 0.6, alpha = 1 } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (p > 0.001) {
    const a0 = -Math.PI / 2;
    const a1 = a0 + Math.PI * 2 * clamp(p);
    ctx.shadowColor = color;
    ctx.shadowBlur = 24 * glowAlpha;
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, color);
    g.addColorStop(1, mix(color, '#ffffff', 0.35));
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.stroke();
    // bright head
    const hx = x + Math.cos(a1) * r, hy = y + Math.sin(a1) * r;
    ctx.shadowBlur = 0;
    drawGlow(ctx, hx, hy, width * 2.2, color, 0.9 * glowAlpha);
  }
  ctx.restore();
}

// ---------- smooth closed / open curves ----------

// Catmull-Rom through points → bezier path.
export function spline(ctx, pts, closed = false, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}

// Sample a Catmull-Rom curve (for particles moving along a path).
export function sampleSpline(pts, steps = 20) {
  const out = [];
  const n = pts.length;
  const P = (i) => pts[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  // cumulative length
  let L = 0;
  const lens = [0];
  for (let i = 1; i < out.length; i++) {
    L += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
    lens.push(L);
  }
  return { pts: out, lens, length: L };
}

export function pointAt(path, u) {
  const d = clamp(u) * path.length;
  const { lens, pts } = path;
  let lo = 0, hi = lens.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lens[mid] < d) lo = mid; else hi = mid;
  }
  const seg = lens[hi] - lens[lo] || 1;
  const f = (d - lens[lo]) / seg;
  const x = lerp(pts[lo][0], pts[hi][0], f), y = lerp(pts[lo][1], pts[hi][1], f);
  const ang = Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0]);
  return [x, y, ang];
}

// ---------- arrows ----------

export function arrow(ctx, x0, y0, x1, y1, opts = {}) {
  const { color = C.amber, width = 6, head = 18, alpha = 1, curve = 0, dash = null, progress = 1 } = opts;
  if (alpha <= 0 || progress <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  const mx = (x0 + x1) / 2 - (y1 - y0) * curve, my = (y0 + y1) / 2 + (x1 - x0) * curve;
  // quadratic point at progress
  const q = (t) => [
    (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1,
    (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1,
  ];
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const N = 24;
  for (let i = 1; i <= N; i++) {
    const [x, y] = q((i / N) * progress);
    ctx.lineTo(x, y);
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.setLineDash([]);
  const [ex, ey] = q(progress);
  const [px, py] = q(Math.max(0, progress - 0.04));
  const a = Math.atan2(ey - py, ex - px);
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(a) * head * 0.6, ey + Math.sin(a) * head * 0.6);
  ctx.lineTo(ex + Math.cos(a + 2.5) * head, ey + Math.sin(a + 2.5) * head);
  ctx.lineTo(ex + Math.cos(a - 2.5) * head, ey + Math.sin(a - 2.5) * head);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- sound waves ----------

export function soundWaves(ctx, x, y, t, opts = {}) {
  const { color = C.tissue, count = 4, spread = 0.9, maxR = 160, alpha = 1, dir = 0, speed = 1 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const ph = ((t * speed + i / count) % 1);
    const r = 20 + ph * maxR;
    ctx.globalAlpha = alpha * (1 - ph) * 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5 * (1 - ph) + 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, dir - spread, dir + spread);
    ctx.stroke();
  }
  ctx.restore();
}

// "Z z z" floating up.
export function zzz(ctx, x, y, t, opts = {}) {
  const { alpha = 1, size = 56, color = C.violet } = opts;
  if (alpha <= 0) return;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3) % 1;
    const a = Math.sin(ph * Math.PI) * alpha;
    text(ctx, 'z', x + ph * 90 + Math.sin(ph * 6 + i) * 10, y - ph * 160, {
      size: size * (0.6 + ph * 0.7), weight: 700, family: DISPLAY, color, alpha: a,
    });
  }
}

// ---------- confetti-free sparkle burst ----------

export function sparkle(ctx, x, y, p, opts = {}) {
  const { color = C.amber, n = 14, r = 120, alpha = 1 } = opts;
  if (p <= 0 || p >= 1) return;
  const rr = rng(Math.floor(x * 13 + y * 7));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr() * 0.4;
    const d = ease.outCubic(p) * r * (0.6 + rr() * 0.6);
    const s = (1 - p) * (4 + rr() * 5);
    ctx.globalAlpha = alpha * (1 - p);
    ctx.fillStyle = i % 2 ? color : '#ffffff';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export { noise1 };
