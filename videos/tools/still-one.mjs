// One large still of the head: node tools/still-one.mjs out.png '{"fall":0.5}'
import { writeFileSync } from 'node:fs';
import { newCanvas, background } from '../src/lib/draw.mjs';
import { drawHead, defaultState } from '../src/lib/anatomy.mjs';
const [cv, ctx] = newCanvas(1000, 1000);
background(ctx, 3);
ctx.translate(-120, -150); ctx.scale(1.35, 1.35);
drawHead(ctx, { ...defaultState(), ...JSON.parse(process.argv[3] || '{}') }, Number(process.argv[4] || 1.234));
writeFileSync(process.argv[2], cv.toBuffer('image/png'));
