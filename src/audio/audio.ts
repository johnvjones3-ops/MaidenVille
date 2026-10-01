// AudioManager: a warm, original Web Audio palette — marimba-like notes, bells, soft percussion and chimes.
// Created only after the first user gesture. No samples, no voices, no commercial songs.

type Wave = OscillatorType;

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private sfx!: GainNode;
  private music!: GainNode;
  private master!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private beat = 0;
  private nextBeatTime = 0;
  private musicOn = false;
  sfxVolume = 0.8;
  musicVolume = 0.5;
  muted = false;
  /** Musical intensity 0..1 (adds percussion as a run speeds up). */
  intensity = 0;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC() as AudioContext;
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready() {
    return !!this.ctx;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.sfxVolume * 0.6, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicVolume * 0.32, t, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, opts: { type?: Wave; gain?: number; when?: number; attack?: number; out?: AudioNode; detune?: number; slide?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = (opts.when ?? ctx.currentTime) + 0.005;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(opts.out ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Marimba-ish: a sine plus a quick high partial. */
  private mallet(freq: number, when?: number, gain = 0.25, out?: AudioNode) {
    this.tone(freq, 0.45, { type: 'sine', gain, when, out });
    this.tone(freq * 4, 0.08, { type: 'sine', gain: gain * 0.25, when, out });
  }

  private bell(freq: number, when?: number, gain = 0.18, out?: AudioNode) {
    this.tone(freq, 1.6, { type: 'sine', gain, when, out, attack: 0.002 });
    this.tone(freq * 2.76, 0.9, { type: 'sine', gain: gain * 0.35, when, out });
    this.tone(freq * 5.4, 0.4, { type: 'sine', gain: gain * 0.15, when, out });
  }

  private noise(dur: number, gain: number, filterFreq: number, when?: number, type: BiquadFilterType = 'highpass', out?: AudioNode) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t = (when ?? ctx.currentTime) + 0.003;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out ?? this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- sound effects
  star(combo: number) {
    const n = 79 + PENTA[combo % 6];
    this.tone(midi(n), 0.22, { type: 'triangle', gain: 0.14 });
    this.tone(midi(n + 12), 0.15, { type: 'sine', gain: 0.07 });
  }
  step() {
    this.noise(0.04, 0.05, 1800, undefined, 'bandpass');
  }
  jump() {
    this.tone(360, 0.22, { type: 'sine', gain: 0.18, slide: 2.2 });
  }
  land() {
    this.noise(0.07, 0.08, 600, undefined, 'lowpass');
  }
  slide() {
    this.noise(0.3, 0.09, 2500, undefined, 'bandpass');
  }
  lane() {
    this.noise(0.08, 0.04, 3000, undefined, 'highpass');
  }
  bump() {
    this.tone(220, 0.25, { type: 'triangle', gain: 0.22, slide: 0.6 });
    this.tone(160, 0.3, { type: 'sine', gain: 0.18, slide: 0.7 });
  }
  pop() {
    this.tone(900, 0.12, { type: 'sine', gain: 0.2, slide: 0.4 });
    this.noise(0.1, 0.1, 4000);
  }
  powerup() {
    const now = this.ctx?.currentTime ?? 0;
    [72, 76, 79, 84].forEach((n, i) => this.mallet(midi(n), now + i * 0.07, 0.2));
  }
  letter(i: number) {
    const now = this.ctx?.currentTime ?? 0;
    this.bell(midi(76 + PENTA[i]), now, 0.16);
  }
  word() {
    const now = this.ctx?.currentTime ?? 0;
    [72, 76, 79, 84, 88].forEach((n, i) => this.mallet(midi(n), now + i * 0.1, 0.24));
    this.bell(midi(96), now + 0.55, 0.12);
  }
  stamp() {
    const now = this.ctx?.currentTime ?? 0;
    this.bell(midi(84), now, 0.15);
    this.bell(midi(88), now + 0.15, 0.13);
  }
  churchBell() {
    const now = this.ctx?.currentTime ?? 0;
    this.bell(midi(67), now, 0.12);
    this.bell(midi(64), now + 0.7, 0.1);
  }
  mission() {
    const now = this.ctx?.currentTime ?? 0;
    [67, 71, 74, 79].forEach((n, i) => this.mallet(midi(n), now + i * 0.09, 0.22));
  }
  pickup() {
    this.mallet(midi(79), undefined, 0.2);
  }
  click() {
    this.tone(880, 0.06, { type: 'sine', gain: 0.08 });
  }
  countdown(final: boolean) {
    this.mallet(midi(final ? 84 : 72), undefined, 0.25);
  }
  results() {
    const now = this.ctx?.currentTime ?? 0;
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.mallet(midi(n), now + i * 0.08, 0.2));
  }
  birds() {
    const now = this.ctx?.currentTime ?? 0;
    for (let i = 0; i < 3; i++) this.tone(2400 + Math.random() * 800, 0.08, { type: 'sine', gain: 0.03, when: now + i * 0.11, slide: 1.3 });
  }

  // ---- music: a gentle generative marimba loop in a major pentatonic
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.beat = 0;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      while (this.nextBeatTime < this.ctx.currentTime + 0.25) {
        this.scheduleBeat(this.beat, this.nextBeatTime);
        this.beat++;
        this.nextBeatTime += 60 / 112 / 2; // eighth notes at 112 bpm
      }
      this.musicTimer = window.setTimeout(tick, 60);
    };
    tick();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleBeat(b: number, t: number) {
    const bar = Math.floor(b / 8) % 4;
    const step = b % 8;
    const roots = [60, 65, 57, 67]; // C F Am G-ish
    const root = roots[bar];
    const pattern = [0, -1, 2, 4, -1, 2, 5, -1];
    const p = pattern[step];
    if (p >= 0) this.mallet(midi(root + 12 + PENTA[p]), t, 0.11, this.music);
    if (step === 0 || step === 4) this.tone(midi(root - 12), 0.5, { type: 'triangle', gain: 0.12, when: t, out: this.music });
    if (this.intensity > 0.2) {
      if (step % 2 === 0) this.noise(0.05, 0.035 * this.intensity, 6000, t, 'highpass', this.music);
      if (step === 2 || step === 6) this.noise(0.12, 0.05 * this.intensity, 900, t, 'bandpass', this.music);
    }
    if (step === 7 && bar === 3) this.bell(midi(84), t, 0.05, this.music);
  }
}
