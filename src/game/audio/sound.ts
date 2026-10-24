/** Synthesised sound effects (no audio files). Created lazily on first user gesture. */
export class SoundBoard {
  private ctx: AudioContext | null = null;
  private last = new Map<string, number>();
  muted = false;

  private ac() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if ((this.last.get(key) ?? 0) + ms > now) return false;
    this.last.set(key, now); return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number) {
    const ac = this.ac(); if (!ac || this.muted) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  }

  private noise(dur: number, vol: number, freq: number) {
    const ac = this.ac(); if (!ac || this.muted) return;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = "bandpass"; f.frequency.value = freq; g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(ac.destination); src.start();
  }

  unlock() { this.ac(); }
  chuff() { if (this.throttle("chuff", 350)) this.noise(0.18, 0.12, 900); }
  deliver() { if (this.throttle("deliver", 120)) this.tone(1320, 0.12, "triangle", 0.05); }
  build() { this.noise(0.08, 0.25, 2500); this.tone(220, 0.1, "square", 0.04); }
  bell() { this.tone(880, 1.2, "sine", 0.12); setTimeout(() => this.tone(660, 1.2, "sine", 0.1), 180); }
  whistle() { if (this.throttle("whistle", 2000)) this.tone(740, 0.6, "sawtooth", 0.04, 700); }
  clank() { this.noise(0.25, 0.3, 400); this.tone(90, 0.3, "square", 0.06); }
  horn() { this.tone(110, 1.6, "sawtooth", 0.1, 70); }
  error() { this.tone(180, 0.15, "square", 0.05); }
}
