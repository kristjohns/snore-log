// Line icons drawn in a 100 × 100 box. icon(ctx, name, x, y, size, color)
// draws one centred on (x, y).

import { C } from './draw.mjs';

const P = Math.PI;

const ICONS = {
  moon(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 34, 0.9, 2 * P - 0.9 + 0.6, false);
    ctx.arc(66, 38, 26, 2 * P - 0.6, 1.9, true);
    ctx.closePath();
    ctx.fill();
  },
  wine(ctx) {
    ctx.beginPath();
    ctx.moveTo(30, 12); ctx.lineTo(70, 12);
    ctx.bezierCurveTo(72, 40, 64, 56, 50, 58);
    ctx.bezierCurveTo(36, 56, 28, 40, 30, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 32); ctx.lineTo(68, 32);
    ctx.bezierCurveTo(66, 48, 60, 54, 50, 55);
    ctx.bezierCurveTo(40, 54, 34, 48, 32, 32);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(50, 58); ctx.lineTo(50, 84);
    ctx.moveTo(34, 88); ctx.lineTo(66, 88);
    ctx.stroke();
  },
  scale(ctx) {
    ctx.beginPath();
    ctx.roundRect(14, 22, 72, 66, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, 52, 18, P * 1.1, P * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 52); ctx.lineTo(60, 38);
    ctx.stroke();
  },
  cigarette(ctx) {
    ctx.beginPath();
    ctx.roundRect(10, 58, 72, 14, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(66, 58); ctx.lineTo(66, 72);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(86, 54); ctx.bezierCurveTo(80, 44, 92, 38, 86, 26);
    ctx.moveTo(76, 50); ctx.bezierCurveTo(70, 40, 82, 34, 76, 20);
    ctx.stroke();
  },
  nose(ctx) {
    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.bezierCurveTo(48, 40, 36, 56, 28, 66);
    ctx.bezierCurveTo(22, 76, 34, 84, 42, 78);
    ctx.bezierCurveTo(46, 86, 54, 86, 58, 78);
    ctx.bezierCurveTo(66, 84, 78, 76, 72, 66);
    ctx.bezierCurveTo(64, 56, 54, 40, 52, 12);
    ctx.stroke();
  },
  bed(ctx) {
    ctx.beginPath();
    ctx.moveTo(10, 30); ctx.lineTo(10, 84);
    ctx.moveTo(10, 66); ctx.lineTo(90, 66); ctx.lineTo(90, 84);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(18, 46, 22, 14, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(44, 46, 46, 20, 8);
    ctx.stroke();
  },
  side(ctx) {
    // person lying on their side
    ctx.beginPath();
    ctx.arc(24, 44, 11, 0, 2 * P);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(38, 48); ctx.bezierCurveTo(56, 40, 70, 46, 88, 56);
    ctx.moveTo(52, 50); ctx.lineTo(60, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 74); ctx.lineTo(92, 74);
    ctx.stroke();
  },
  didgeridoo(ctx) {
    ctx.beginPath();
    ctx.moveTo(20, 18); ctx.lineTo(82, 80);
    ctx.lineWidth *= 2.2;
    ctx.stroke();
    ctx.lineWidth /= 2.2;
    ctx.beginPath();
    ctx.ellipse(84, 82, 10, 6, P / 4, 0, 2 * P);
    ctx.stroke();
  },
  music(ctx) {
    ctx.beginPath();
    ctx.moveTo(38, 72); ctx.lineTo(38, 20); ctx.lineTo(78, 12); ctx.lineTo(78, 62);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(28, 74, 12, 9, -0.4, 0, 2 * P);
    ctx.ellipse(68, 64, 12, 9, -0.4, 0, 2 * P);
    ctx.fill();
  },
  tape(ctx) {
    ctx.beginPath();
    ctx.moveTo(20, 50); ctx.quadraticCurveTo(50, 62, 80, 50);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.roundRect(28, 38, 44, 24, 4);
    ctx.fill();
    ctx.restore();
  },
  warning(ctx) {
    ctx.beginPath();
    ctx.moveTo(50, 12); ctx.lineTo(90, 84); ctx.lineTo(10, 84); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 38); ctx.lineTo(50, 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(50, 72, 4, 0, 2 * P);
    ctx.fill();
  },
  doctor(ctx) {
    // stethoscope
    ctx.beginPath();
    ctx.moveTo(28, 12); ctx.lineTo(28, 36); ctx.bezierCurveTo(28, 56, 60, 56, 60, 36); ctx.lineTo(60, 12);
    ctx.moveTo(44, 54); ctx.lineTo(44, 66); ctx.bezierCurveTo(44, 86, 76, 86, 76, 66); ctx.lineTo(76, 58);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(76, 50, 9, 0, 2 * P);
    ctx.stroke();
  },
  clock(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 36, 0, 2 * P);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 28); ctx.lineTo(50, 50); ctx.lineTo(66, 58);
    ctx.stroke();
  },
  repeat(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 30, -P * 0.85, P * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 30); ctx.lineTo(24, 46); ctx.lineTo(38, 36);
    ctx.stroke();
  },
  calendar(ctx) {
    ctx.beginPath();
    ctx.roundRect(14, 20, 72, 66, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 40); ctx.lineTo(86, 40);
    ctx.moveTo(32, 12); ctx.lineTo(32, 28);
    ctx.moveTo(68, 12); ctx.lineTo(68, 28);
    ctx.stroke();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(30 + i * 20, 56 + j * 16, 4, 0, 2 * P);
      ctx.fill();
    }
  },
  check(ctx) {
    ctx.beginPath();
    ctx.moveTo(18, 52); ctx.lineTo(40, 74); ctx.lineTo(84, 28);
    ctx.stroke();
  },
  cross(ctx) {
    ctx.beginPath();
    ctx.moveTo(24, 24); ctx.lineTo(76, 76);
    ctx.moveTo(76, 24); ctx.lineTo(24, 76);
    ctx.stroke();
  },
  people(ctx) {
    for (const [x, s] of [[34, 1], [66, 1]]) {
      ctx.beginPath();
      ctx.arc(x, 34, 12 * s, 0, 2 * P);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 20, 84); ctx.bezierCurveTo(x - 20, 56, x + 20, 56, x + 20, 84);
      ctx.stroke();
    }
  },
  dumbbell(ctx) {
    ctx.beginPath();
    ctx.moveTo(30, 50); ctx.lineTo(70, 50);
    ctx.stroke();
    for (const x of [18, 26, 74, 82]) {
      ctx.beginPath();
      ctx.roundRect(x - 4, x === 18 || x === 82 ? 38 : 30, 8, x === 18 || x === 82 ? 24 : 40, 3);
      ctx.fill();
    }
  },
  phone(ctx) {
    ctx.beginPath();
    ctx.roundRect(28, 8, 44, 84, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(44, 16); ctx.lineTo(56, 16);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const h = [14, 26, 18, 32, 10][i];
      ctx.rect(36 + i * 6, 70 - h, 4, h);
    }
    ctx.fill();
  },
  play(ctx) {
    ctx.beginPath();
    ctx.moveTo(34, 20); ctx.lineTo(80, 50); ctx.lineTo(34, 80); ctx.closePath();
    ctx.fill();
  },
  pillow(ctx) {
    ctx.beginPath();
    ctx.moveTo(16, 36);
    ctx.bezierCurveTo(40, 26, 60, 26, 84, 36);
    ctx.bezierCurveTo(90, 50, 90, 56, 84, 66);
    ctx.bezierCurveTo(60, 74, 40, 74, 16, 66);
    ctx.bezierCurveTo(10, 56, 10, 48, 16, 36);
    ctx.stroke();
  },
  lungs(ctx) {
    ctx.beginPath();
    ctx.moveTo(50, 12); ctx.lineTo(50, 46);
    ctx.moveTo(50, 40); ctx.quadraticCurveTo(40, 44, 38, 52);
    ctx.moveTo(50, 40); ctx.quadraticCurveTo(60, 44, 62, 52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38, 30); ctx.bezierCurveTo(14, 36, 10, 84, 22, 86); ctx.bezierCurveTo(34, 88, 42, 80, 42, 60); ctx.closePath();
    ctx.moveTo(62, 30); ctx.bezierCurveTo(86, 36, 90, 84, 78, 86); ctx.bezierCurveTo(66, 88, 58, 80, 58, 60); ctx.closePath();
    ctx.stroke();
  },
  sleepy(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 36, 0, 2 * P);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 44); ctx.quadraticCurveTo(38, 50, 46, 44);
    ctx.moveTo(54, 44); ctx.quadraticCurveTo(62, 50, 70, 44);
    ctx.moveTo(40, 66); ctx.lineTo(60, 66);
    ctx.stroke();
  },
  heart(ctx) {
    ctx.beginPath();
    ctx.moveTo(50, 84);
    ctx.bezierCurveTo(10, 56, 12, 20, 34, 18);
    ctx.bezierCurveTo(44, 17, 50, 26, 50, 30);
    ctx.bezierCurveTo(50, 26, 56, 17, 66, 18);
    ctx.bezierCurveTo(88, 20, 90, 56, 50, 84);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(26, 50); ctx.lineTo(40, 50); ctx.lineTo(46, 38); ctx.lineTo(54, 62); ctx.lineTo(60, 50); ctx.lineTo(74, 50);
    ctx.stroke();
  },
  child(ctx) {
    ctx.beginPath();
    ctx.arc(50, 32, 16, 0, 2 * P);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(26, 88); ctx.bezierCurveTo(26, 56, 74, 56, 74, 88);
    ctx.stroke();
  },
  tongue(ctx) {
    ctx.beginPath();
    ctx.moveTo(20, 30); ctx.quadraticCurveTo(50, 40, 80, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 36);
    ctx.bezierCurveTo(28, 70, 40, 86, 50, 86);
    ctx.bezierCurveTo(60, 86, 72, 70, 70, 36);
    ctx.fill();
  },
  balloon(ctx) {
    ctx.beginPath();
    ctx.ellipse(50, 40, 26, 30, 0, 0, 2 * P);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(50, 70); ctx.quadraticCurveTo(44, 80, 52, 90);
    ctx.stroke();
  },
  lips(ctx) {
    ctx.beginPath();
    ctx.moveTo(12, 50);
    ctx.bezierCurveTo(30, 28, 44, 30, 50, 38);
    ctx.bezierCurveTo(56, 30, 70, 28, 88, 50);
    ctx.bezierCurveTo(70, 74, 30, 74, 12, 50);
    ctx.closePath();
    ctx.fill();
  },
  cheek(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 34, 0, 2 * P);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(84, 50); ctx.lineTo(96, 50);
    ctx.moveTo(90, 44); ctx.lineTo(96, 50); ctx.lineTo(90, 56);
    ctx.stroke();
  },
  palate(ctx) {
    ctx.beginPath();
    ctx.moveTo(14, 40); ctx.quadraticCurveTo(50, 14, 86, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(42, 40); ctx.quadraticCurveTo(50, 70, 58, 40);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(50, 84); ctx.lineTo(50, 64);
    ctx.moveTo(42, 72); ctx.lineTo(50, 64); ctx.lineTo(58, 72);
    ctx.stroke();
  },
  chew(ctx) {
    ctx.beginPath();
    ctx.arc(50, 50, 32, P, 2 * P);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.roundRect(24 + i * 11, 50, 8, 12, 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(14, 78); ctx.lineTo(30, 78);
    ctx.moveTo(70, 78); ctx.lineTo(86, 78);
    ctx.stroke();
  },
};

export function icon(ctx, name, x, y, size = 80, color = C.ink, opts = {}) {
  const { alpha = 1, width = 7 } = opts;
  const fn = ICONS[name];
  if (!fn || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fn(ctx);
  ctx.restore();
}

// Icon inside a soft glowing circle.
export function badge(ctx, name, x, y, r, color, opts = {}) {
  const { alpha = 1, fill = 0.16 } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${fill + 0.06})`);
  g.addColorStop(1, `rgba(255,255,255,${fill * 0.4})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * P);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.6;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  icon(ctx, name, x, y, r * 1.15, color, { alpha });
}

export const ICON_NAMES = Object.keys(ICONS);
