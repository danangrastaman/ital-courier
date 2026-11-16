// Orbital Courier — all sound, synthesized live with WebAudio.
// One job: every effect and the ambient music loop. No audio files.

/** A tiny pentatonic walk the music sequencer wanders through. */
const MELODY = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 5, 7, 12, 10, 7, 5];
const BASE_FREQ = 220; // A3

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.thrustNodes = null;
    this.musicTimer = null;
    this.melodyStep = 0;
    this.musicOn = false;
  }

  /** Create the context on first user gesture; safe to call any time. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  /** One short oscillator blip with an envelope. */
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Filtered noise burst (crashes, flares, explosions). */
  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  click() { this.blip(660, 0.07, 'square', 0.08); }
  pickup() { this.blip(880, 0.12, 'sine', 0.22, 1320); }
  fuelCell() { this.blip(520, 0.1, 'triangle', 0.18, 780); }

  deliver() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'sine', 0.2), i * 70);
    });
  }

  crash() {
    this.noise(0.35, 0.5, 500);
    this.blip(120, 0.3, 'sawtooth', 0.25, 40);
  }

  alarm() {
    this.blip(440, 0.16, 'square', 0.12, 440);
    setTimeout(() => this.blip(440, 0.16, 'square', 0.12, 440), 200);
  }

  victory() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.35, 'triangle', 0.2), i * 110);
    });
  }

  gameOver() {
    if (!this.ctx || this.muted) return;
    [392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.4, 'sawtooth', 0.14), i * 180);
    });
  }

  /** Looping thruster rumble while a thrust key is held. */
  thrustStart() {
    if (!this.ctx || this.muted || this.thrustNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    gain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.08);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.thrustNodes = { osc, gain };
  }

  thrustStop() {
    if (!this.thrustNodes || !this.ctx) return;
    const { osc, gain } = this.thrustNodes;
    this.thrustNodes = null;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    setTimeout(() => { try { osc.stop(); } catch (err) { /* already stopped */ } }, 300);
  }

  /** A slow generative pad: one soft note every beat, wandering the scale. */
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const step = () => {
      if (!this.musicOn) return;
      if (!this.muted) {
        const semis = MELODY[this.melodyStep % MELODY.length];
        const freq = BASE_FREQ * Math.pow(2, semis / 12);
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 1.7);
        // A low root note under every fourth step.
        if (this.melodyStep % 4 === 0) {
          const root = this.ctx.createOscillator();
          root.type = 'sine';
          root.frequency.value = BASE_FREQ / 2;
          const rg = this.ctx.createGain();
          rg.gain.setValueAtTime(0, t);
          rg.gain.linearRampToValueAtTime(0.4, t + 0.2);
          rg.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
          root.connect(rg);
          rg.connect(this.musicGain);
          root.start(t);
          root.stop(t + 2.3);
        }
      }
      this.melodyStep++;
      this.musicTimer = setTimeout(step, 420);
    };
    step();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }
}
