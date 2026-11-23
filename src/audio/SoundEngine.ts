/**
 * Procedural Web Audio API Stadium Sound Engine for PES Football.
 * Zero external audio assets needed — synthesizes authentic stadium crowd,
 * referee whistles, crisp ball strikes, woodwork clangs, net swishes, and goal roars.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdRunning = false;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Pink-ish noise for warm stadium ambience
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 2.8;
    }
    this.noiseBuffer = buffer;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setTargetAtTime(m ? 0 : 0.045, this.ctx.currentTime, 0.1);
    }
  }

  public startCrowdAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || this.crowdRunning) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.045;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.crowdFilter = filter;
    this.crowdGain = gain;
    this.crowdRunning = true;
  }

  public setCrowdExcitement(level: number) {
    // level: 0 (calm) to 1 (huge chance / goal)
    if (!this.ctx || !this.crowdGain || !this.crowdFilter || this.muted) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, level));
    this.crowdGain.gain.setTargetAtTime(0.04 + clamped * 0.14, now, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(580 + clamped * 680, now, 0.25);
  }

  public playKick(power = 0.5, isFinesse = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Low punch thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isFinesse ? 'triangle' : 'sine';
    const startFreq = 135 + power * 65;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);

    gain.gain.setValueAtTime(0.24 + power * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    // Crisp leather slap transient
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = isFinesse ? 1400 : 900;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.12 + power * 0.16, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.06);
    }
  }

  public playPostClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [420, 865, 1340];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.22 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  public playNetSwish() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.25);
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.3);
  }

  public playSlideTackle() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(420, now + 0.32);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.35);
  }

  public playWhistle(kind: 'short' | 'kickoff' | 'halftime' | 'fulltime' = 'short') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const blast = (offset: number, duration: number, pitch = 2780) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now + offset);
      osc2.frequency.setValueAtTime(pitch * 1.015, now + offset);

      // Referee pea-whistle trill
      lfo.frequency.value = 34;
      lfoGain.gain.value = 85;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.13, now + offset + 0.02);
      gain.gain.setValueAtTime(0.12, now + offset + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      lfo.start(now + offset);
      osc.start(now + offset);
      osc2.start(now + offset);
      lfo.stop(now + offset + duration + 0.02);
      osc.stop(now + offset + duration + 0.02);
      osc2.stop(now + offset + duration + 0.02);
    };

    if (kind === 'short') {
      blast(0, 0.22);
    } else if (kind === 'kickoff') {
      blast(0, 0.38, 2820);
    } else if (kind === 'halftime') {
      blast(0, 0.22, 2780);
      blast(0.3, 0.55, 2860);
    } else {
      blast(0, 0.2, 2780);
      blast(0.28, 0.2, 2780);
      blast(0.56, 0.72, 2900);
    }
  }

  public playGoalRoar() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Stadium crowd explosion
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1450, now + 0.4);
    filter.frequency.linearRampToValueAtTime(920, now + 2.6);
    filter.Q.value = 0.55;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.18);
    gain.gain.setValueAtTime(0.26, now + 1.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.9);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 3.0);

    // Classic PES broadcast goal horn stinger chord
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      g.gain.setValueAtTime(0.001, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.045, now + i * 0.04 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
      osc.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 1.3);
    });
  }

  public playSaveImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const soundEngine = new SoundEngine();

