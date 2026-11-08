// Renders test stills of the head cutaway: node tools/still-head.mjs out.png
import { writeFileSync } from 'node:fs';
import { newCanvas, background, text, C } from '../src/lib/draw.mjs';
import { drawHead, defaultState } from '../src/lib/anatomy.mjs';

const out = process.argv[2] || 'head.png';
const [cv, ctx] = newCanvas();
background(ctx, 3);
const states = [
  ['rest', {}],
  ['asleep', { fall: 0.7, sag: 0.8, air: 1, flutter: 1 }],
  ['tongue slide', { slide: 1, glowTongue: 1 }],
  ['suck', { suck: 1, glowTongue: 1 }],
  ['down', { down: 1, glowTongue: 1, jaw: 0.6 }],
  ['say A', { lift: 1, jaw: 1, glowPalate: 1 }],
];
states.forEach(([name, s], i) => {
  const st = { ...defaultState(), air: 0.8, ...s };
  ctx.save();
  ctx.translate(20 + (i % 3) * 640, 10 + Math.floor(i / 3) * 530);
  ctx.scale(0.64, 0.64);
  drawHead(ctx, st, 1.234);
  ctx.restore();
  text(ctx, name, 40 + (i % 3) * 640, 50 + Math.floor(i / 3) * 530, { size: 30, weight: 700, color: C.amber });
});
writeFileSync(out, cv.toBuffer('image/png'));
