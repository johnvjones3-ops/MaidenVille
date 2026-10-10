// Original synthesized sound effects and music, built with Web Audio.
// Safari/iPad only allows audio after a user gesture, so `unlock()` runs on the
// first tap, click or key press and again after the tab returns from the background.

import type { SoundName } from '../engine/types';

type Osc = OscillatorType;

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastTick = 0;
  volume = 0.8;
  muted = false;

  constructor() {
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    });
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock() {
    try {
      // iOS 17+: play through the ringer switch like a media app.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    // A silent buffer inside the gesture finishes the unlock on older iOS.
    try {
      const b = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.master || !this.ctx) return;
    const v = this.muted ? 0 : this.volume * this.volume * 0.9;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private get t() {
    return this.ctx!.currentTime + 0.005;
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    { type = 'sine' as Osc, gain = 0.3, attack = 0.005, end = undefined as number | undefined, vibrato = 0, filter = 0 } = {},
  ) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (end) o.frequency.exponentialRampToValueAtTime(end, start + dur);
    if (vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(start);
      lfo.stop(start + dur + 0.1);
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node: AudioNode = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master!);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, { gain = 0.2, freq = 3000, type = 'highpass' as BiquadFilterType, q = 0.7, end = 0, tremolo = 0 } = {}) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (end) f.frequency.exponentialRampToValueAtTime(end, start + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g);
    if (tremolo) {
      const t = c.createGain();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = tremolo;
      lg.gain.value = 0.5;
      t.gain.value = 0.5;
      lfo.connect(lg).connect(t.gain);
      lfo.start(start);
      lfo.stop(start + dur);
      g.connect(t).connect(this.master!);
    } else g.connect(this.master!);
    src.start(start, Math.random() * 0.5);
    src.stop(start + dur + 0.05);
  }

  private bell(freq: number, start: number, dur = 1.2, gain = 0.25) {
    this.tone(freq, start, dur, { gain });
    this.tone(freq * 2.01, start, dur * 0.6, { gain: gain * 0.35 });
    this.tone(freq * 3.0, start, dur * 0.35, { gain: gain * 0.15 });
  }

  /** Wheel peg tick. `speed` is 0..1 and brightens the click when fast. */
  tick(speed = 0.5) {
    if (!this.ready) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastTick < 0.028) return; // spare the speakers when the wheel is flying
    this.lastTick = now;
    const t = this.t;
    this.noise(t, 0.018, { gain: 0.22 + speed * 0.12, freq: 2200, type: 'bandpass', q: 1.2 });
    this.tone(1900 + speed * 500, t, 0.02, { type: 'triangle', gain: 0.08 });
  }

  countdown(final: boolean) {
    if (!this.ready) return;
    this.tone(final ? 1320 : 990, this.t, 0.09, { type: 'square', gain: 0.07, filter: 3000 });
  }

  play(name: SoundName) {
    if (!this.ready) return;
    const t = this.t;
    switch (name) {
      case 'ding':
        this.bell(1318.5, t, 1.1, 0.24);
        break;
      case 'blip':
        this.tone(1046, t, 0.08, { type: 'triangle', gain: 0.1 });
        break;
      case 'buzzer':
        this.tone(110, t, 0.6, { type: 'square', gain: 0.16, filter: 900 });
        this.tone(116.5, t, 0.6, { type: 'sawtooth', gain: 0.12, filter: 900 });
        break;
      case 'wrong':
        this.tone(311, t, 0.22, { type: 'sawtooth', gain: 0.14, filter: 1400 });
        this.tone(233, t + 0.24, 0.42, { type: 'sawtooth', gain: 0.14, filter: 1200 });
        break;
      case 'bankrupt':
        [392, 370, 349].forEach((f, i) => this.tone(f / 2, t + i * 0.32, 0.3, { type: 'sawtooth', gain: 0.17, filter: 1100 }));
        this.tone(330 / 2, t + 0.96, 1.1, { type: 'sawtooth', gain: 0.17, filter: 1000, vibrato: 4 });
        this.noise(t, 0.35, { gain: 0.25, freq: 180, type: 'lowpass' });
        break;
      case 'loseTurn':
        this.tone(523, t, 0.18, { type: 'square', gain: 0.1, filter: 2200 });
        this.tone(392, t + 0.2, 0.36, { type: 'square', gain: 0.1, filter: 2000 });
        break;
      case 'buzzIn':
        this.tone(740, t, 0.16, { type: 'square', gain: 0.13, filter: 4000 });
        this.tone(988, t + 0.12, 0.2, { type: 'square', gain: 0.13, filter: 4000 });
        break;
      case 'solve':
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.5, { type: 'triangle', gain: 0.17 }));
        [523.3, 659.3, 784].forEach((f) => this.tone(f, t + 0.4, 0.9, { type: 'sine', gain: 0.1 }));
        this.noise(t + 0.36, 0.6, { gain: 0.05, freq: 6000 });
        break;
      case 'bigWin':
        this.fanfare(t, true);
        break;
      case 'victory':
        this.victory(t);
        break;
      case 'register':
        this.noise(t, 0.05, { gain: 0.2, freq: 4000 });
        this.bell(2093, t + 0.04, 0.4, 0.12);
        this.bell(2637, t + 0.1, 0.5, 0.12);
        break;
      case 'bell':
        [0, 0.28, 0.56].forEach((d) => this.bell(1760, t + d, 0.9, 0.22));
        break;
      case 'timeUp':
        this.tone(196, t, 0.9, { type: 'sawtooth', gain: 0.16, filter: 700 });
        this.tone(147, t, 0.9, { type: 'square', gain: 0.08, filter: 600 });
        break;
      case 'countdown':
        this.countdown(false);
        break;
      case 'mystery':
        this.noise(t, 1.3, { gain: 0.16, freq: 900, type: 'bandpass', tremolo: 22 });
        this.tone(98, t, 1.3, { type: 'triangle', gain: 0.08 });
        break;
      case 'cash10k':
        this.fanfare(t, false);
        this.play('register');
        break;
      case 'express':
        for (const d of [0, 0.55]) {
          [523, 659, 784].forEach((f) => this.tone(f, t + d, 0.45, { type: 'sawtooth', gain: 0.06, filter: 1800, vibrato: 6, attack: 0.06 }));
        }
        this.noise(t, 1.1, { gain: 0.06, freq: 500, type: 'lowpass', tremolo: 9 });
        break;
      case 'wild':
      case 'prize':
        [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => this.tone(f, t + i * 0.06, 0.4, { type: 'sine', gain: 0.1 }));
        break;
      case 'reveal':
        [784, 988, 1175, 1568].forEach((f) => this.tone(f, t, 0.8, { gain: 0.07 }));
        break;
      case 'whoosh':
        this.noise(t, 0.45, { gain: 0.12, freq: 400, end: 2400, type: 'bandpass', q: 0.8 });
        break;
    }
  }

  private fanfare(t: number, long: boolean) {
    const notes = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, t + i * 0.1, 0.35, { type: 'triangle', gain: 0.15 }));
    const end = t + notes.length * 0.1;
    [523.3, 659.3, 784, 1046.5].forEach((f) => this.tone(f, end, long ? 1.8 : 1, { type: 'sawtooth', gain: 0.05, filter: 2500, vibrato: 3 }));
    this.noise(end, long ? 1.6 : 0.8, { gain: 0.06, freq: 7000 });
  }

  /** A short original victory tune: bright melody over a walking bass. */
  private victory(t: number) {
    const beat = 0.18;
    const mel: [number, number][] = [
      [784, 1], [784, 1], [880, 1], [988, 1], [1046.5, 2], [988, 1], [1046.5, 1],
      [1175, 2], [1046.5, 1], [988, 1], [880, 2], [784, 2],
      [880, 1], [988, 1], [1046.5, 1], [1175, 1], [1318.5, 2], [1175, 1], [1318.5, 1], [1568, 4],
    ];
    let x = t;
    for (const [f, d] of mel) {
      this.tone(f, x, beat * d * 0.95, { type: 'square', gain: 0.06, filter: 3200 });
      this.tone(f, x, beat * d * 0.95, { type: 'triangle', gain: 0.09 });
      x += beat * d;
    }
    const bass = [131, 165, 196, 220, 175, 220, 262, 196, 147, 175, 220, 247, 262, 196, 262];
    bass.forEach((f, i) => this.tone(f, t + i * beat * 2, beat * 1.8, { type: 'triangle', gain: 0.14 }));
    [262, 330, 392, 523].forEach((f) => this.tone(f, x - beat * 4, beat * 6, { type: 'sawtooth', gain: 0.035, filter: 2200, vibrato: 3 }));
    for (let i = 0; i < 16; i++) this.noise(t + i * beat * 2, 0.05, { gain: 0.05, freq: 8000 });
  }
}
