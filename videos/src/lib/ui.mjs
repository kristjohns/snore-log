// Reusable on-screen elements for the scenes.

import { clamp, lerp, ease, prog } from './anim.mjs';
import { C, card, text, pill, font, rgba, drawGlow, roundRect, wrap, DISPLAY } from './draw.mjs';
import { badge, icon } from './icons.mjs';

// Small coloured kicker over a large title, sliding up into place.
export function headline(ctx, kicker, title, x, y, p, opts = {}) {
  const { size = 72, color = C.air, align = 'left', maxWidth = 0 } = opts;
  const a = ease.outCubic(clamp(p * 1.6));
  const b = ease.outCubic(clamp(p * 1.6 - 0.25));
  if (kicker) text(ctx, kicker.toUpperCase(), x, y, { size: 26, weight: 700, color, alpha: a, rise: (1 - a) * 20, tracking: 4, align });
  return text(ctx, title, x, y + size * 1.15, { size, weight: 700, family: DISPLAY, alpha: b, rise: (1 - b) * 30, align, maxWidth, lineHeight: 1.1 });
}

// A study summary card: tag pill, title, citation and a few facts.
export function studyCard(ctx, x, y, w, h, s, p, opts = {}) {
  const a = ease.outCubic(clamp(p * 1.5));
  if (a <= 0) return;
  ctx.save();
  ctx.translate(0, (1 - a) * 40);
  card(ctx, x, y, w, h, { alpha: a, accent: s.color ?? C.air });
  ctx.globalAlpha *= a;
  let yy = y + 52;
  if (s.tag) {
    pill(ctx, x + 40, yy, s.tag, { size: 20, color: s.color ?? C.air });
    yy += 52;
  }
  yy += text(ctx, s.title, x + 40, yy + 18, { size: s.titleSize ?? 38, weight: 700, maxWidth: w - 80, family: DISPLAY, lineHeight: 1.15 });
  if (s.cite) {
    text(ctx, s.cite, x + 40, yy + 18, { size: 22, weight: 500, color: C.dim, maxWidth: w - 80 });
    yy += 40;
  }
  ctx.restore();
  return yy;
}

// Two horizontal bars: before and after, with values counting.
export function beforeAfter(ctx, x, y, w, d, p, opts = {}) {
  const { color = C.air, alpha = 1 } = opts;
  if (alpha <= 0) return;
  const max = d.max ?? Math.max(d.before, d.after) * 1.1;
  const a = ease.outCubic(clamp(p * 2));
  const grow1 = ease.outCubic(clamp(p * 2 - 0.2));
  const grow2 = ease.outCubic(clamp(p * 2 - 0.55));
  ctx.save();
  ctx.globalAlpha *= alpha * a;
  text(ctx, d.label, x, y, { size: 28, weight: 650, color: C.ink });
  if (d.note) text(ctx, d.note, x + w, y, { size: 22, weight: 500, color: C.dim, align: 'right' });
  const rows = [
    ['Before', d.before, 'rgba(255,255,255,0.28)', grow1],
    ['After 3 months', d.after, color, grow2],
  ];
  rows.forEach(([lbl, v, col, g], i) => {
    const by = y + 26 + i * 64;
    text(ctx, lbl, x, by + 32, { size: 21, weight: 550, color: C.muted });
    const bx = x + 190, bw = (w - 300) * (v / max) * g;
    roundRect(ctx, bx, by + 8, w - 300, 34, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    if (bw > 2) {
      roundRect(ctx, bx, by + 8, Math.max(34, bw), 34, 17);
      ctx.fillStyle = col;
      ctx.shadowColor = i ? col : 'transparent';
      ctx.shadowBlur = i ? 20 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    text(ctx, (v * g).toFixed(d.decimals ?? 1), bx + Math.max(34, bw) + 16, by + 35, { size: 26, weight: 700, color: i ? color : C.muted });
  });
  ctx.restore();
}

// Callout label with a leader line drawn from an anchor point.
export function callout(ctx, ax, ay, lx, ly, label, p, opts = {}) {
  const { color = C.ink, dot = C.amber, align = 'left', size = 30 } = opts;
  if (p <= 0) return;
  const a = ease.outCubic(clamp(p));
  ctx.save();
  ctx.globalAlpha *= a;
  drawGlow(ctx, ax, ay, 22, dot, 0.9);
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(ax, ay, 6, 0, Math.PI * 2);
  ctx.fill();
  const ex = lerp(ax, lx, ease.outCubic(clamp(p * 1.4)));
  const ey = lerp(ay, ly, ease.outCubic(clamp(p * 1.4)));
  ctx.strokeStyle = rgba('#ffffff', 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  const ta = ease.outCubic(clamp(p * 1.6 - 0.5));
  text(ctx, label, lx + (align === 'left' ? 12 : -12), ly + size * 0.35, { size, weight: 650, color, alpha: ta, align });
  ctx.restore();
}

// A checklist row: badge + text, check mark drawing on.
export function checkRow(ctx, x, y, label, p, opts = {}) {
  const { color = C.good, iconName = null, size = 38, sub = null, maxWidth = 1200 } = opts;
  const a = ease.outCubic(clamp(p * 2));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate((1 - a) * -30, 0);
  ctx.beginPath();
  ctx.arc(x + 28, y, 28, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color, 0.15);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.7);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const cp = ease.outCubic(clamp(p * 2 - 0.4));
  if (cp > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = [[x + 15, y + 1], [x + 25, y + 11], [x + 42, y - 10]];
    ctx.moveTo(pts[0][0], pts[0][1]);
    const seg1 = clamp(cp * 2), seg2 = clamp(cp * 2 - 1);
    ctx.lineTo(lerp(pts[0][0], pts[1][0], seg1), lerp(pts[0][1], pts[1][1], seg1));
    if (seg2 > 0) ctx.lineTo(lerp(pts[1][0], pts[2][0], seg2), lerp(pts[1][1], pts[2][1], seg2));
    ctx.stroke();
  }
  if (iconName) icon(ctx, iconName, x + 100, y, 44, C.muted);
  text(ctx, label, x + (iconName ? 140 : 80), y + size * 0.36, { size, weight: 600, maxWidth, lineHeight: 1.2 });
  if (sub) text(ctx, sub, x + (iconName ? 140 : 80), y + size * 0.36 + 36, { size: 24, weight: 500, color: C.dim });
  ctx.restore();
}

// Big number with a label underneath.
export function stat(ctx, x, y, value, label, p, opts = {}) {
  const { color = C.air, size = 96, align = 'center' } = opts;
  const a = ease.outBack(clamp(p * 1.8));
  const f = ease.outCubic(clamp(p * 1.8));
  if (f <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(f);
  ctx.translate(x, y);
  ctx.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a);
  text(ctx, value, 0, 0, { size, weight: 800, family: DISPLAY, color, align });
  ctx.restore();
  text(ctx, label, x, y + 46, { size: 26, weight: 550, color: C.muted, align, alpha: f, maxWidth: 360 });
}

// A row of icon badges with captions.
export function badgeRow(ctx, items, x, y, gap, p, opts = {}) {
  const { r = 56, size = 26 } = opts;
  items.forEach((it, i) => {
    const q = ease.outBack(clamp(p * 2 - i * 0.2));
    const a = clamp(p * 2 - i * 0.2);
    if (a <= 0) return;
    const cx = x + i * gap;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(q, q);
    badge(ctx, it.icon, 0, 0, r, it.color ?? C.air, { alpha: a });
    ctx.restore();
    text(ctx, it.label, cx, y + r + 44, { size, weight: 650, align: 'center', alpha: a });
    if (it.sub) text(ctx, it.sub, cx, y + r + 80, { size: 21, weight: 500, align: 'center', color: C.dim, alpha: a });
  });
}

export { prog };
