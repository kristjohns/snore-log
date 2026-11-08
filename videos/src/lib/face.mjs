// Front view of a friendly face, the "what you'd see in a mirror" view.
// Local coordinates centred on (0, 0), roughly 520 wide × 660 tall.

import { clamp, lerp } from './anim.mjs';
import { C, rgba, mix, spline, drawGlow } from './draw.mjs';

export const faceDefaults = () => ({
  open: 0, // jaw drop 0..1
  wide: 0, // mouth width -1 (pucker) .. 1 (wide)
  smileL: 0, smileR: 0, // corner lift, viewer's left / right
  press: 0, // lips pressed together
  tongue: 0, // 0 hidden/rest, 1 visible resting on the floor
  tongueUp: 0, // tongue tip lifted to the roof
  tongueDown: 0, // back of tongue pressed down (more tongue surface visible, lower)
  tongueSuck: 0, // whole tongue suctioned up (underside visible)
  uvulaLift: 0,
  cheekL: 0, cheekR: 0, // cheek pushed outward
  cheekIn: 0, // cheeks drawn in
  finger: 0, fingerSide: 1, // 1 = viewer's right
  balloon: 0, // 0 none, >0 balloon size
  eyes: 1, // 1 open, 0 closed
  blink: 0,
  glow: 0, glowAt: null,
});

function blob(ctx, pts, fill) {
  ctx.beginPath();
  spline(ctx, pts, true, 0.55);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawFace(ctx, f, t) {
  const jaw = f.open * 46;
  const cheekOut = (side) => (side < 0 ? f.cheekL : f.cheekR);

  // Shoulders / neck
  const sh = ctx.createLinearGradient(0, 260, 0, 420);
  sh.addColorStop(0, '#3b4a8f');
  sh.addColorStop(1, '#232c63');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.moveTo(-300, 440);
  ctx.bezierCurveTo(-290, 330, -170, 300, -80, 290);
  ctx.lineTo(80, 290);
  ctx.bezierCurveTo(170, 300, 290, 330, 300, 440);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.skinShade;
  ctx.beginPath();
  ctx.moveTo(-70, 180 + jaw * 0.3);
  ctx.lineTo(-74, 300);
  ctx.quadraticCurveTo(0, 330, 74, 300);
  ctx.lineTo(70, 180 + jaw * 0.3);
  ctx.closePath();
  ctx.fill();

  // Ears
  for (const s of [-1, 1]) {
    blob(ctx, [[s * 178, -40], [s * 206, -58], [s * 214, -10], [s * 200, 40], [s * 176, 40]], '#e7b296');
    blob(ctx, [[s * 184, -30], [s * 200, -40], [s * 204, -6], [s * 192, 24], [s * 182, 20]], '#d99a80');
  }

  // Head shape: the lower face stretches with the jaw and cheeks.
  const L = 168 + f.cheekL * 22 - f.cheekIn * 10;
  const R = 168 + f.cheekR * 22 - f.cheekIn * 10;
  const head = [
    [0, -250], [120, -226], [178, -130], [182, -20],
    [R, 70], [138 + f.cheekR * 14, 160 + jaw * 0.6], [70, 222 + jaw], [0, 236 + jaw],
    [-70, 222 + jaw], [-138 - f.cheekL * 14, 160 + jaw * 0.6], [-L, 70],
    [-182, -20], [-178, -130], [-120, -226],
  ];
  const hg = ctx.createRadialGradient(-40, -60, 40, 0, 0, 320);
  hg.addColorStop(0, '#f8d6c2');
  hg.addColorStop(0.7, C.skin);
  hg.addColorStop(1, '#d99d82');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 30;
  blob(ctx, head, hg);
  ctx.restore();

  // Cheek blush / bulge highlight
  for (const s of [-1, 1]) {
    const out = cheekOut(s);
    drawGlow(ctx, s * (110 + out * 16), 70, 70 + out * 20, '#ff8a8a', 0.18 + out * 0.25);
    if (f.cheekIn > 0) {
      ctx.save();
      ctx.globalAlpha = f.cheekIn * 0.35;
      ctx.fillStyle = '#b97a64';
      ctx.beginPath();
      ctx.ellipse(s * 120, 80, 26, 50, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Hair
  const hair = [
    [-186, -60], [-196, -170], [-120, -262], [10, -286], [140, -258], [196, -160], [186, -60],
    [160, -150], [80, -190], [-20, -176], [-110, -192], [-164, -140],
  ];
  blob(ctx, hair, '#3a2a3f');
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(10, -150, 120, -2.6, -1.0);
  ctx.stroke();

  // Eyebrows
  ctx.strokeStyle = '#3a2a3f';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 40, -88);
    ctx.quadraticCurveTo(s * 78, -104, s * 112, -90);
    ctx.stroke();
  }

  // Eyes
  const open = clamp(f.eyes * (1 - f.blink));
  for (const s of [-1, 1]) {
    const ex = s * 76, ey = -44;
    if (open > 0.15) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, 30, 20 * open, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#4b3a5e';
      ctx.beginPath();
      ctx.arc(ex + 2, ey + 2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1426';
      ctx.beginPath();
      ctx.arc(ex + 2, ey + 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 7, ey - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#5a3a3f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (open > 0.15) ctx.ellipse(ex, ey, 31, 21 * open, 0, Math.PI, Math.PI * 2);
    else {
      ctx.moveTo(ex - 28, ey);
      ctx.quadraticCurveTo(ex, ey + 14, ex + 28, ey);
    }
    ctx.stroke();
  }

  // Nose
  ctx.strokeStyle = 'rgba(160,95,75,0.6)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-6, -30);
  ctx.quadraticCurveTo(-12, 30, -26, 44);
  ctx.quadraticCurveTo(0, 58, 26, 44);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,80,64,0.5)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 13, 46, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Mouth ----
  const my = 112 + jaw * 0.25;
  const halfW = 56 + f.wide * 18 + f.open * 12 - f.press * 4 - f.balloon * 26;
  const openH = f.open * 104;
  const lift = (s) => (s < 0 ? f.smileL : f.smileR) * 18;
  const lx = -halfW, rx = halfW;
  const ly = my - lift(-1), ry = my - lift(1);
  const upperLipT = 13 - f.press * 6;
  const lowerLipT = 16 - f.press * 6;

  // Opening
  if (openH > 2 && f.balloon <= 0) {
    const top = my - openH * 0.25;
    const bot = my + openH * 0.75 + jaw * 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.bezierCurveTo(-halfW * 0.6, top - 6, halfW * 0.6, top - 6, rx, ry);
    ctx.bezierCurveTo(halfW * 0.7, bot + 6, -halfW * 0.7, bot + 6, lx, ly);
    ctx.closePath();
    const mg = ctx.createRadialGradient(0, (top + bot) / 2, 4, 0, (top + bot) / 2, halfW);
    mg.addColorStop(0, '#3a0c18');
    mg.addColorStop(1, '#6b1f2c');
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.clip();
    const midY = (top + bot) / 2;
    // Uvula at the back, lifts on "Ah"
    const uvY = top + 8 + (bot - top) * 0.22 - f.uvulaLift * (bot - top) * 0.18;
    ctx.fillStyle = '#c95564';
    ctx.beginPath();
    ctx.moveTo(-34, top);
    ctx.quadraticCurveTo(-30, uvY - 8, -10, uvY - 10);
    ctx.quadraticCurveTo(-6, uvY + 16, 0, uvY + 18);
    ctx.quadraticCurveTo(6, uvY + 16, 10, uvY - 10);
    ctx.quadraticCurveTo(30, uvY - 8, 34, top);
    ctx.closePath();
    ctx.fill();
    if (f.uvulaLift > 0) drawGlow(ctx, 0, uvY, 46, C.amber, f.uvulaLift * 0.7);
    // Upper teeth
    ctx.fillStyle = '#fbfaf5';
    ctx.beginPath();
    ctx.ellipse(0, top - 4, halfW * 0.72, 16, 0, 0, Math.PI);
    ctx.fill();
    // Lower teeth
    ctx.beginPath();
    ctx.ellipse(0, bot + 4, halfW * 0.66, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Tongue
    const tv = Math.max(f.tongue, f.tongueUp, f.tongueDown, f.tongueSuck);
    if (tv > 0) {
      const tg = ctx.createLinearGradient(0, midY - 30, 0, bot + 10);
      tg.addColorStop(0, '#f0858c');
      tg.addColorStop(1, '#c84a5c');
      ctx.globalAlpha = clamp(tv * 2);
      // Resting / pressed-down tongue: a mound in the lower mouth.
      const restTop = lerp(midY + 4, bot - 6, f.tongueDown) - f.tongueSuck * 40 - f.tongueUp * 10;
      const tw = halfW * 0.78;
      ctx.fillStyle = tg;
      if (f.tongueUp > 0.02 || f.tongueSuck > 0.02) {
        // Underside of a lifted tongue, tip touching behind the upper teeth.
        const k = Math.max(f.tongueUp, f.tongueSuck);
        const tipY = lerp(restTop, top + 10, k);
        const ug = ctx.createLinearGradient(0, tipY, 0, bot);
        ug.addColorStop(0, '#e88f9b');
        ug.addColorStop(1, '#b85466');
        ctx.fillStyle = ug;
        ctx.beginPath();
        ctx.moveTo(-tw, bot + 10);
        ctx.bezierCurveTo(-tw, tipY + 20, -tw * 0.5, tipY, 0, tipY);
        ctx.bezierCurveTo(tw * 0.5, tipY, tw, tipY + 20, tw, bot + 10);
        ctx.closePath();
        ctx.fill();
        // frenulum and veins
        ctx.strokeStyle = 'rgba(150,50,80,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, tipY + 18);
        ctx.lineTo(0, bot + 6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(110,80,160,0.35)';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 10, tipY + 16);
          ctx.quadraticCurveTo(s * 22, (tipY + bot) / 2, s * 16, bot);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(-tw, bot + 10);
        ctx.bezierCurveTo(-tw, restTop, tw, restTop, tw, bot + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,40,60,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, restTop + 10);
        ctx.lineTo(0, bot);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (f.glow > 0 && f.glowAt === 'tongue') drawGlow(ctx, 0, restTop + 10, 60, C.amber, f.glow * 0.6);
    }
    ctx.restore();
  }

  // Lips
  const lipCol = mix('#d8707c', '#c35a6a', f.press);
  ctx.fillStyle = lipCol;
  if (f.balloon > 0) {
    // Lips rounded around the balloon neck
    ctx.beginPath();
    ctx.ellipse(0, my, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const top = my - openH * 0.25;
    const bot = my + openH * 0.75 + jaw * 0.3;
    // upper lip
    ctx.beginPath();
    ctx.moveTo(lx - 4, ly);
    ctx.bezierCurveTo(-halfW * 0.6, top - upperLipT - 8, -12, top - upperLipT - 4, 0, top - upperLipT + 2);
    ctx.bezierCurveTo(12, top - upperLipT - 4, halfW * 0.6, top - upperLipT - 8, rx + 4, ry);
    ctx.bezierCurveTo(halfW * 0.6, top - 4, -halfW * 0.6, top - 4, lx - 4, ly);
    ctx.closePath();
    ctx.fill();
    // lower lip
    ctx.beginPath();
    ctx.moveTo(lx - 4, ly);
    ctx.bezierCurveTo(-halfW * 0.6, bot + 4, halfW * 0.6, bot + 4, rx + 4, ry);
    ctx.bezierCurveTo(halfW * 0.6, bot + lowerLipT + 8, -halfW * 0.6, bot + lowerLipT + 8, lx - 4, ly);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, bot + lowerLipT * 0.5, halfW * 0.35, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (openH <= 2) {
      ctx.strokeStyle = '#8f3a4a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(0, my + 3, rx, ry);
      ctx.stroke();
    }
  }
  if (f.glow > 0 && f.glowAt === 'lips') drawGlow(ctx, 0, my, 110, C.amber, f.glow * 0.55);

  // Balloon
  if (f.balloon > 0) {
    const r = 30 + f.balloon * 70;
    const bx = 0, by = my + 12 + r * 0.95;
    ctx.save();
    const bg = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
    bg.addColorStop(0, '#9ff3e8');
    bg.addColorStop(1, '#1fa79a');
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(bx, by, r * 0.9, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1fa79a';
    ctx.fillRect(-8, my + 4, 16, by - r - my);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(bx - r * 0.35, by - r * 0.4, r * 0.15, r * 0.25, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Hand with the index finger hooked inside the mouth corner
  if (f.finger > 0) {
    const s = f.fingerSide;
    const k = f.finger;
    const cornerX = s * (halfW - 4), cornerY = my;
    const px = s * (halfW + 120) , py = my + 190 - k * 40; // palm centre
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.6);
    const hand = '#eab093', handShade = '#d39579';
    // forearm
    ctx.fillStyle = '#3b4a8f';
    ctx.beginPath();
    ctx.ellipse(px + s * 50, py + 150, 52, 110, s * -0.35, 0, Math.PI * 2);
    ctx.fill();
    // palm / fist
    ctx.fillStyle = hand;
    ctx.beginPath();
    ctx.ellipse(px, py, 62, 72, s * -0.3, 0, Math.PI * 2);
    ctx.fill();
    // curled fingers
    ctx.fillStyle = handShade;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(px - s * 40, py - 18 + i * 26, 22, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // index finger reaching into the mouth corner
    const tipX = lerp(px - s * 30, cornerX, k), tipY = lerp(py - 60, cornerY, k);
    ctx.strokeStyle = hand;
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(px - s * 24, py - 40);
    ctx.quadraticCurveTo(px - s * 30, tipY + 40, tipX, tipY);
    ctx.stroke();
    // thumb
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(px - s * 10, py + 20);
    ctx.lineTo(px - s * 48, py + 34);
    ctx.stroke();
    ctx.restore();
  }
}
