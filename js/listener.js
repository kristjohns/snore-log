// Microphone capture and YAMNet classification.
// Emits a loudness reading every 100 ms and a classification every 0.5 s.
import { AudioClassifier, FilesetResolver } from "../vendor/mediapipe/audio_bundle.js";

export const RATE = 16000;
const CHUNK = 1600; // 100 ms
const WINDOW = 15600; // 0.975 s, YAMNet's input length
const HOP_CHUNKS = 5; // classify every 0.5 s
const RING_SECONDS = 40; // longer than the longest clip
const SNORING = "Snoring";

let classifierPromise = null;

// Loads the WebAssembly runtime and the model once. Safe to call repeatedly.
export function loadClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const files = await FilesetResolver.forAudioTasks(new URL("../vendor/mediapipe/wasm", import.meta.url).href);
      return AudioClassifier.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL("../model/yamnet.tflite", import.meta.url).href },
        scoreThreshold: 0,
      });
    })();
    classifierPromise.catch(() => (classifierPromise = null));
  }
  return classifierPromise;
}

export class Listener {
  constructor() {
    this.ring = new Float32Array(RATE * RING_SECONDS);
    this.written = 0;
    this.onLevel = null; // (timeMs, db)
    this.onFrame = null; // (timeMs, snoreScore, topLabel, topScore)
    this.onState = null; // ("running" | "interrupted" | "ended")
  }

  // Call from a tap: iOS only starts audio in response to one.
  async start() {
    this.classifier = await loadClassifier();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const ctx = (this.ctx = new AudioContext({ latencyHint: "playback" }));
    await ctx.audioWorklet.addModule(new URL("./capture-worklet.js", import.meta.url));

    const source = ctx.createMediaStreamSource(this.stream);
    // Two 2nd-order low-passes make a 4th-order anti-aliasing filter for the resampler.
    const lp1 = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 7000, Q: 0.54 });
    const lp2 = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 7000, Q: 1.31 });
    this.node = new AudioWorkletNode(ctx, "capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = new GainNode(ctx, { gain: 0 }); // keeps the graph pulled without playing anything
    source.connect(lp1).connect(lp2).connect(this.node).connect(mute).connect(ctx.destination);
    this.node.port.onmessage = (e) => this.handleChunk(e.data);

    const track = this.stream.getAudioTracks()[0];
    track.onended = () => this.onState?.("ended");
    track.onmute = () => this.onState?.("interrupted");
    track.onunmute = () => this.onState?.(ctx.state === "running" ? "running" : "interrupted");
    ctx.onstatechange = () => this.onState?.(ctx.state === "running" ? "running" : ctx.state === "closed" ? "ended" : "interrupted");
    await ctx.resume();
    this.onState?.(ctx.state === "running" ? "running" : "interrupted");
  }

  get running() {
    const track = this.stream?.getAudioTracks()[0];
    return this.ctx?.state === "running" && track?.readyState === "live" && !track.muted;
  }

  // Tries to continue after a phone call, Siri or an alarm took the microphone.
  async resume() {
    const track = this.stream?.getAudioTracks()[0];
    if (!track || track.readyState === "ended") {
      this.stop();
      await this.start();
      return;
    }
    await this.ctx.resume();
  }

  stop() {
    this.node?.port.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.ctx = this.stream = this.node = null;
    this.anchor = null;
  }

  // Wall-clock time of a sample position. Re-anchors after the page was suspended.
  timeOf(sampleIndex) {
    const now = Date.now();
    const expected = this.anchor && this.anchor.ms + ((sampleIndex - this.anchor.samples) / RATE) * 1000;
    if (!this.anchor || Math.abs(expected - now) > 3000) {
      this.anchor = { ms: now, samples: sampleIndex };
      return now;
    }
    return expected;
  }

  handleChunk(chunk) {
    const start = this.written % this.ring.length;
    const first = Math.min(chunk.length, this.ring.length - start);
    this.ring.set(chunk.subarray(0, first), start);
    if (first < chunk.length) this.ring.set(chunk.subarray(first), 0);
    this.written += chunk.length;
    const time = this.timeOf(this.written);

    let sum = 0;
    for (const s of chunk) sum += s * s;
    this.onLevel?.(time, 10 * Math.log10(sum / chunk.length + 1e-12));

    if (this.written % (CHUNK * HOP_CHUNKS) === 0 && this.written >= WINDOW) this.classify(time);
  }

  classify(time) {
    const result = this.classifier.classify(this.recent(WINDOW), RATE);
    const cats = result[0]?.classifications[0]?.categories || [];
    const snore = cats.find((c) => c.categoryName === SNORING)?.score ?? 0;
    const top = cats[0];
    this.onFrame?.(time, snore, top?.categoryName || "", top?.score || 0);
  }

  // The most recent `length` samples, oldest first.
  recent(length) {
    length = Math.min(length, this.written, this.ring.length);
    const out = new Float32Array(length);
    const end = this.written % this.ring.length;
    const start = (end - length + this.ring.length) % this.ring.length;
    if (start < end) out.set(this.ring.subarray(start, end));
    else {
      out.set(this.ring.subarray(start));
      out.set(this.ring.subarray(0, end), this.ring.length - start);
    }
    return out;
  }
}
