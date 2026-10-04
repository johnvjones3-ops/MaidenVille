// Synthesized Web Audio: original short music loops and sound effects. No external files.

type Wave = OscillatorType;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) return 0;
  let semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  semi += (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}
/** "C5 . E5 | G5" -> ['C5', '.', 'E5', 'G5'] ('.' holds the previous note, '-' is a rest). */
const seq = (s: string) => s.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);

interface Track {
  bpm: number;
  lead: string[]; // eighth notes
  bass: string[]; // quarter notes
  drums: boolean;
  loop: boolean;
  wave?: Wave;
}

const TRACKS: Record<string, Track> = {
  title: {
    bpm: 108,
    wave: 'triangle',
    drums: false,
    loop: true,
    lead: seq('E5 . G5 . A5 . G5 E5 | D5 . . . C5 . D5 . | E5 . G5 . C6 . B5 A5 | G5 . . . - . . . | A5 . G5 . E5 . D5 C5 | D5 . E5 . G5 . A5 . | G5 . E5 . D5 . E5 . | C5 . . . - . . .'),
    bass: seq('C3 G3 C3 G3 | F2 C3 G2 D3 | A2 E3 A2 E3 | G2 D3 G2 . | F2 C3 F2 C3 | G2 D3 G2 D3 | E2 B2 A2 E3 | C3 G2 C3 .'),
  },
  plaza: {
    bpm: 134,
    drums: true,
    loop: true,
    lead: seq('G4 . C5 D5 E5 . G5 . | E5 D5 C5 . A4 . C5 . | D5 . E5 F5 G5 . A5 G5 | E5 . . . D5 . . . | G4 . C5 D5 E5 . G5 . | A5 G5 E5 . C5 . D5 . | E5 . D5 C5 D5 . E5 D5 | C5 . . . - . . .'),
    bass: seq('C3 G2 C3 G2 | A2 E2 A2 E2 | F2 C3 F2 C3 | G2 D3 G2 B2 | C3 G2 C3 G2 | F2 C3 F2 C3 | G2 D3 G2 D3 | C3 G2 C3 .'),
  },
  night: {
    bpm: 112,
    wave: 'triangle',
    drums: true,
    loop: true,
    lead: seq('A4 . C5 . E5 . D5 C5 | B4 . G4 . A4 . . . | F4 . A4 . C5 . B4 A4 | G4 . E4 . G4 . . . | A4 . C5 . E5 . G5 . | F5 . E5 D5 C5 . B4 . | C5 . A4 . B4 . G4 . | A4 . . . - . . .'),
    bass: seq('A2 E3 A2 E3 | G2 D3 G2 D3 | F2 C3 F2 C3 | E2 B2 E2 G2 | A2 E3 A2 E3 | D3 A2 D3 A2 | F2 C3 G2 D3 | A2 E3 A2 .'),
  },
  arena: {
    bpm: 146,
    drums: true,
    loop: true,
    lead: seq('D5 . D5 F#5 A5 . F#5 . | G5 . E5 . C5 . D5 . | D5 . D5 F#5 A5 . B5 A5 | G5 F#5 E5 . D5 . . . | B4 . D5 . E5 . F#5 . | G5 . A5 . B5 . A5 . | G5 . F#5 . E5 . C5 . | D5 . . . A4 . D5 .'),
    bass: seq('D3 D3 A2 A2 | C3 C3 G2 G2 | D3 D3 A2 A2 | G2 A2 D3 . | G2 G2 D3 D3 | E2 E2 A2 A2 | C3 C3 G2 A2 | D3 A2 D3 .'),
  },
  boss: {
    bpm: 162,
    drums: true,
    loop: true,
    wave: 'sawtooth',
    lead: seq('E5 . E5 . G5 . E5 . | D5 . E5 . B4 . . . | E5 . E5 . G5 . A5 . | B5 . A5 . G5 . F#5 . | E5 . - E5 D5 . - D5 | C5 . - C5 B4 . . . | C5 . D5 . E5 . F#5 . | G5 . F#5 . E5 . D#5 .'),
    bass: seq('E2 E2 E2 E2 | E2 E2 B1 B1 | E2 E2 E2 E2 | G2 G2 F#2 F#2 | C3 C3 C3 C3 | A2 A2 A2 A2 | C3 C3 D3 D3 | B2 B2 B1 B1'),
  },
  clear: { bpm: 150, drums: false, loop: false, lead: seq('C5 E5 G5 C6 . G5 C6 . | D6 . . . . . . .'), bass: seq('C3 G3 C3 .') },
  victory: { bpm: 140, drums: true, loop: false, lead: seq('G5 . G5 A5 B5 . G5 . | C6 . . . E6 . D6 C6 | D6 . . . . . . .'), bass: seq('G2 G2 C3 C3 | G2 . . .') },
  gameover: { bpm: 90, drums: false, loop: false, wave: 'triangle', lead: seq('G4 . F4 . E4 . D4 . | C4 . . . . . . .'), bass: seq('C3 . G2 .') },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  musicOn = true;
  sfxOn = true;
  private track: Track | null = null;
  private trackName = '';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private paused = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.8 : 0;
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }
  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  // ---- music ----------------------------------------------------------------
  play(name: string) {
    if (name === this.trackName && this.track?.loop) return;
    this.stopMusic();
    const t = TRACKS[name];
    this.trackName = name;
    if (!t) return;
    this.track = t;
    this.step = 0;
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.startTimer();
  }

  stopMusic() {
    this.track = null;
    this.trackName = '';
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(p: boolean) {
    this.paused = p;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(p || !this.musicOn ? 0 : 0.32, this.ctx.currentTime, 0.03);
    if (!p && this.track) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
  }

  private startTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule() {
    const ctx = this.ctx;
    const t = this.track;
    if (!ctx || !t) return;
    if (this.paused) {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    const s16 = 60 / t.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const st = this.step;
      const total = t.lead.length * 2;
      if (!t.loop && st >= total) {
        this.stopMusic();
        return;
      }
      const i = st % total;
      if (i % 2 === 0) {
        const li = i / 2;
        const n = t.lead[li];
        if (n !== '.' && n !== '-') {
          let held = 1;
          while (t.lead[(li + held) % t.lead.length] === '.' && held < 8) held++;
          this.tone(t.wave ?? 'square', freq(n), this.nextTime, s16 * 2 * held * 0.92, 0.16, this.musicBus, true);
        }
      }
      if (i % 4 === 0) {
        const bi = (i / 4) % t.bass.length;
        const n = t.bass[bi];
        if (n !== '.' && n !== '-') this.tone('triangle', freq(n), this.nextTime, s16 * 3.6, 0.32, this.musicBus);
      }
      if (t.drums) {
        const b = i % 16;
        if (b === 0 || b === 8 || (b === 10 && (i / 16) % 2 === 1)) this.kick(this.nextTime);
        if (b === 4 || b === 12) this.snare(this.nextTime);
        if (b % 2 === 0) this.hat(this.nextTime, b % 4 === 2 ? 0.05 : 0.025);
      }
      this.step++;
      this.nextTime += s16;
    }
  }

  private tone(w: Wave, f: number, at: number, dur: number, vol: number, bus: AudioNode, soft = false) {
    const ctx = this.ctx!;
    if (f <= 0) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = w;
    o.frequency.value = f;
    let out: AudioNode = o;
    if (soft) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      o.connect(lp);
      out = lp;
    }
    out.connect(g);
    g.connect(bus);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.006);
    g.gain.setTargetAtTime(vol * 0.6, at + 0.03, 0.05);
    g.gain.setTargetAtTime(0, at + dur, 0.03);
    o.start(at);
    o.stop(at + dur + 0.2);
  }

  private noiseHit(at: number, dur: number, vol: number, type: BiquadFilterType, f: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    const g = ctx.createGain();
    src.connect(flt);
    flt.connect(g);
    g.connect(bus);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  private kick(at: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(at);
    o.stop(at + 0.2);
  }
  private snare(at: number) {
    this.noiseHit(at, 0.12, 0.22, 'bandpass', 1800, this.musicBus);
  }
  private hat(at: number, v: number) {
    this.noiseHit(at, 0.04, v, 'highpass', 7000, this.musicBus);
  }

  // ---- effects ------------------------------------------------------------------
  private sweep(w: Wave, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx!;
    const at = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = w;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(at);
    o.stop(at + dur + 0.02);
  }
  private arp(w: Wave, notes: string[], step: number, vol: number, len = step * 1.4) {
    const ctx = this.ctx!;
    notes.forEach((n, i) => this.tone(w, freq(n), ctx.currentTime + i * step, len, vol, this.sfxBus));
  }

  sfx(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'jump':
        this.sweep('square', 260, 640, 0.13, 0.09);
        break;
      case 'bump':
        this.sweep('triangle', 190, 70, 0.12, 0.45);
        this.noiseHit(now, 0.05, 0.25, 'lowpass', 900, this.sfxBus);
        break;
      case 'thud':
        this.sweep('triangle', 110, 50, 0.09, 0.4);
        break;
      case 'coin':
        // net swish + bright ping
        this.noiseHit(now, 0.09, 0.18, 'highpass', 5000, this.sfxBus);
        this.sweep('sine', 1320, 1760, 0.16, 0.18, 0.02);
        break;
      case 'reward':
        this.arp('triangle', ['C5', 'E5', 'G5', 'C6'], 0.05, 0.22);
        break;
      case 'power':
        this.arp('square', ['G4', 'B4', 'D5', 'G5', 'B5', 'D6'], 0.055, 0.1);
        break;
      case 'shrink':
        this.arp('square', ['D6', 'A5', 'F5', 'D5'], 0.07, 0.1);
        break;
      case 'stomp':
        this.sweep('square', 330, 110, 0.12, 0.16);
        this.noiseHit(now, 0.08, 0.2, 'lowpass', 1400, this.sfxBus);
        break;
      case 'kick':
        this.sweep('square', 600, 160, 0.1, 0.12);
        this.noiseHit(now, 0.06, 0.2, 'bandpass', 2400, this.sfxBus);
        break;
      case 'hurt':
        this.sweep('sawtooth', 420, 140, 0.28, 0.14);
        break;
      case 'death':
        this.arp('square', ['E5', 'C5', 'A4', 'F4', 'D4'], 0.13, 0.12, 0.16);
        break;
      case 'checkpoint':
        this.arp('triangle', ['G5', 'C6', 'E6'], 0.08, 0.22, 0.3);
        break;
      case 'secret':
        this.arp('sine', ['E6', 'G6', 'B6', 'E7', 'B6', 'E7'], 0.045, 0.14);
        break;
      case 'break':
        this.noiseHit(now, 0.25, 0.45, 'lowpass', 1200, this.sfxBus);
        this.sweep('square', 200, 60, 0.15, 0.12);
        break;
      case 'oneup':
        this.arp('square', ['E5', 'G5', 'E6', 'C6', 'D6', 'G6'], 0.08, 0.1);
        break;
      case 'star':
        this.arp('triangle', ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'], 0.04, 0.16);
        break;
      case 'lasso': {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(400, now);
        f.frequency.exponentialRampToValueAtTime(3000, now + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        src.connect(f);
        f.connect(g);
        g.connect(this.sfxBus);
        src.start(now);
        src.stop(now + 0.3);
        break;
      }
      case 'boing':
        this.sweep('sine', 180, 620, 0.12, 0.3);
        this.sweep('sine', 620, 300, 0.18, 0.2, 0.12);
        break;
      case 'door':
        this.sweep('sawtooth', 90, 140, 0.35, 0.08);
        this.arp('triangle', ['C5', 'G4'], 0.15, 0.16);
        break;
      case 'launch':
        this.sweep('sine', 420, 160, 0.14, 0.3);
        this.noiseHit(now, 0.06, 0.12, 'bandpass', 1200, this.sfxBus);
        break;
      case 'warn':
        this.tone('square', 880, now, 0.07, 0.08, this.sfxBus);
        this.tone('square', 880, now + 0.12, 0.07, 0.08, this.sfxBus);
        break;
      case 'slam':
        this.sweep('sine', 120, 30, 0.4, 0.6);
        this.noiseHit(now, 0.3, 0.4, 'lowpass', 600, this.sfxBus);
        break;
      case 'hatch':
        this.noiseHit(now, 0.4, 0.25, 'highpass', 3000, this.sfxBus);
        break;
      case 'bosshit':
        for (const f of [523, 787, 1144, 1567]) this.sweep('sine', f, f * 0.98, 0.5, 0.12);
        this.noiseHit(now, 0.15, 0.3, 'bandpass', 2000, this.sfxBus);
        break;
      case 'charge':
        this.sweep('sawtooth', 70, 220, 0.6, 0.12);
        break;
      case 'win':
        this.arp('square', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, 0.1, 0.2);
        break;
      case 'pause':
        this.arp('triangle', ['E5', 'C5'], 0.06, 0.15);
        break;
      case 'select':
        this.tone('triangle', 988, now, 0.05, 0.12, this.sfxBus);
        break;
    }
  }
}
