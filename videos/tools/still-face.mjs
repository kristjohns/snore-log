// Test stills of the front face in several poses.
import { writeFileSync } from 'node:fs';
import { newCanvas, background, text, C } from '../src/lib/draw.mjs';
import { drawFace, faceDefaults } from '../src/lib/face.mjs';
const [cv, ctx] = newCanvas();
background(ctx, 3);
const poses = [
  ['rest', {}],
  ['say Ah (uvula lift)', { open: 1, uvulaLift: 1, tongue: 1 }],
  ['tongue up', { open: 0.7, tongueUp: 1 }],
  ['tongue down', { open: 0.8, tongueDown: 1, tongue: 1 }],
  ['cheek finger', { finger: 1, fingerSide: 1, cheekR: 1, open: 0.1 }],
  ['lip press', { press: 1, glow: 1, glowAt: 'lips' }],
  ['balloon', { balloon: 0.8 }],
  ['asleep', { eyes: 0 }],
];
poses.forEach(([n, p], i) => {
  const x = 240 + (i % 4) * 480, y = 300 + Math.floor(i / 4) * 520;
  ctx.save(); ctx.translate(x, y); ctx.scale(0.62, 0.62);
  drawFace(ctx, { ...faceDefaults(), ...p }, 1);
  ctx.restore();
  text(ctx, n, x, y - 230, { size: 26, weight: 700, color: C.amber, align: 'center' });
});
writeFileSync(process.argv[2], cv.toBuffer('image/png'));
