// Runs on the audio thread. Resamples the microphone to 16 kHz (the rate YAMNet
// expects) and posts 100 ms chunks to the page. The graph low-passes the signal
// at 7 kHz before it gets here, so linear interpolation does not alias.
const OUT_RATE = 16000;
const CHUNK = 1600;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / OUT_RATE;
    this.pos = 0; // next read position, relative to the current block (may be in [-1, 0))
    this.prev = 0; // last sample of the previous block
    this.buf = new Float32Array(CHUNK);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || ch.length === 0) return true;
    let p = this.pos;
    while (p < ch.length - 1) {
      const i = Math.floor(p);
      const f = p - i;
      const a = i < 0 ? this.prev : ch[i];
      const b = ch[i + 1];
      this.buf[this.n++] = a + (b - a) * f;
      if (this.n === CHUNK) {
        this.port.postMessage(this.buf, [this.buf.buffer]);
        this.buf = new Float32Array(CHUNK);
        this.n = 0;
      }
      p += this.step;
    }
    this.pos = p - ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}

registerProcessor("capture", CaptureProcessor);
