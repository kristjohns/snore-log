// Build steps for one video.
//
//   node src/build.mjs <video> cues            list narration lines for TTS
//   node src/build.mjs <video> render [--workers N]
//   node src/build.mjs <video> stills 12.5 40 …   PNG frames for checking
//   node src/build.mjs <video> audio
//   node src/build.mjs <video> mux
//
// <video> is "explainer" or "exercises".

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { newCanvas, background, W, H } from './lib/draw.mjs';
import { window as fadeWindow } from './lib/anim.mjs';
import { collectCues, buildTimeline, findSegment, toSrt } from './timeline.mjs';
import { mixSoundtrack } from './audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;

const [video, step, ...rest] = process.argv.slice(2);
if (!video || !step) {
  console.error('usage: node src/build.mjs <explainer|exercises> <cues|render|stills|audio|mux> [...]');
  process.exit(1);
}
const spec = await import(`./${video}.mjs`);
const BUILD = path.join(ROOT, 'build', video);
const VOICE = path.join(BUILD, 'voice');
mkdirSync(BUILD, { recursive: true });

function arg(name, def) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : def;
}

function timeline() {
  const durPath = path.join(VOICE, 'durations.json');
  const durations = existsSync(durPath) ? JSON.parse(readFileSync(durPath, 'utf8')) : {};
  return buildTimeline(spec, durations);
}

function drawFrame(ctx, tl, t) {
  const seg = findSegment(tl, t);
  const lt = t - seg.start;
  background(ctx, t, spec.meta.background ?? {});
  ctx.save();
  ctx.globalAlpha = seg.noFade ? 1 : fadeWindow(lt, 0, seg.dur, seg.fadeIn ?? 0.45, seg.fadeOut ?? 0.45);
  seg.draw(ctx, lt, seg, { t, tl });
  ctx.restore();
  spec.overlay?.(ctx, t, tl, seg);
}

async function renderRange(tl, f0, f1, out) {
  const [cv, ctx] = newCanvas();
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-g', String(FPS * 4), out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    drawFrame(ctx, tl, f / FPS);
    if (!ff.stdin.write(cv.data())) await new Promise((r) => ff.stdin.once('drain', r));
    if (f1 - f0 > 300 && (f - f0) % 900 === 0) process.stdout.write(`  frame ${f}/${f1}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
}

if (step === 'cues') {
  const cues = collectCues(spec);
  writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(cues, null, 1));
  console.log(`${cues.length} narration lines → build/${video}/cues.json`);
} else if (step === 'render') {
  const tl = timeline();
  const frames = Math.ceil(tl.duration * FPS);
  const from = Number(arg('from', 0)), to = Number(arg('to', tl.duration));
  const f0 = Math.floor(from * FPS), f1 = Math.min(frames, Math.ceil(to * FPS));
  const workers = Number(arg('workers', 1));
  const worker = arg('worker', null);
  console.log(`${video}: ${tl.duration.toFixed(1)} s, frames ${f0}–${f1}`);
  if (worker != null) {
    await renderRange(tl, f0, f1, arg('out'));
  } else if (workers > 1) {
    const per = Math.ceil((f1 - f0) / workers);
    const parts = [];
    await Promise.all(Array.from({ length: workers }, (_, k) => {
      const a = f0 + k * per, b = Math.min(f1, a + per);
      const out = path.join(BUILD, `part-${k}.mp4`);
      parts.push(out);
      return new Promise((res, rej) => {
        const p = spawn(process.execPath, [fileURLToPath(import.meta.url), video, 'render', '--worker', String(k),
          '--from', String(a / FPS), '--to', String(b / FPS), '--out', out], { stdio: 'inherit' });
        p.on('close', (c) => (c === 0 ? res() : rej(new Error(`worker ${k} failed`))));
      });
    }));
    const list = path.join(BUILD, 'parts.txt');
    writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(BUILD, 'video.mp4')], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(1);
    for (const p of parts) rmSync(p);
  } else {
    await renderRange(tl, f0, f1, path.join(BUILD, 'video.mp4'));
  }
  writeFileSync(path.join(BUILD, 'timeline.json'), JSON.stringify({
    duration: tl.duration,
    segments: tl.segments.map((s) => ({ id: s.id, start: +s.start.toFixed(2), dur: +s.dur.toFixed(2) })),
  }, null, 1));
} else if (step === 'stills') {
  const tl = timeline();
  const [cv, ctx] = newCanvas();
  const dir = arg('dir', path.join(BUILD, 'stills'));
  mkdirSync(dir, { recursive: true });
  const times = rest.filter((x) => !x.startsWith('--') && !isNaN(Number(x)) && rest[rest.indexOf(x) - 1] !== '--dir').map(Number);
  // Segment names also work: "seg:ex1-reps+12" = 12 s into that segment.
  for (const x of rest.filter((x) => x.startsWith('seg:'))) {
    const [id, off] = x.slice(4).split('+');
    const s = tl.segments.find((s) => s.id === id);
    if (!s) throw new Error(`no segment ${id}`);
    times.push(s.start + Number(off ?? 0));
  }
  for (const t of times) {
    drawFrame(ctx, tl, t);
    const f = path.join(dir, `${video}-${t.toFixed(2)}.png`);
    writeFileSync(f, cv.toBuffer('image/png'));
    console.log(f);
  }
  if (rest.includes('--list')) for (const s of tl.segments) console.log(`${s.start.toFixed(1).padStart(7)}  ${s.dur.toFixed(1).padStart(5)}  ${s.id}`);
  console.log(`total ${tl.duration.toFixed(1)} s`);
} else if (step === 'audio') {
  const tl = timeline();
  mixSoundtrack(tl, VOICE, path.join(BUILD, 'audio.wav'), spec.meta.mix ?? {});
  writeFileSync(path.join(BUILD, 'captions.srt'), toSrt(tl));
  console.log(`audio → build/${video}/audio.wav (${tl.duration.toFixed(1)} s)`);
} else if (step === 'mux') {
  const out = path.join(ROOT, 'out', `${spec.meta.name}.mp4`);
  mkdirSync(path.dirname(out), { recursive: true });
  const srt = path.join(BUILD, 'captions.srt');
  const r = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', path.join(BUILD, 'video.mp4'), '-i', path.join(BUILD, 'audio.wav'), '-i', srt,
    '-map', '0:v', '-map', '1:a', '-map', '2:s',
    '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
    '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-metadata:s:a:0', 'language=eng',
    '-metadata', `title=${spec.meta.title}`, '-movflags', '+faststart', '-shortest', out,
  ], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
  writeFileSync(path.join(ROOT, 'out', `${spec.meta.name}.srt`), readFileSync(srt));
  console.log(`→ out/${spec.meta.name}.mp4`);
} else {
  console.error(`unknown step ${step}`);
  process.exit(1);
}
