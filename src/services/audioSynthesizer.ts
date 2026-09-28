/**
 * Web Audio API Sound Synthesizer
 * Generates ambient sounds (rain, brown noise, white noise, binaural alpha)
 * and harmonic alerts (pomodoro chimes, level-up fanfares, subtle ticks) without any external audio files.
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentAmbientType: string = 'none';

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Harmonious Tibetan / Zen Pomodoro completion chime
   */
  public playChime(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Frequencies for a lush major 9th chime: C5 (523.25), E5 (659.25), G5 (783.99), B5 (987.77), D6 (1174.66)
      const freqs = [523.25, 659.25, 783.99, 1046.50];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + idx * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 2.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 2.6);
      });
    } catch {
      // Audio context might be blocked if no user interaction yet
    }
  }

  /**
   * Short celebratory chord when completing a task or leveling up
   */
  public playSuccessTone(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A major arpeggio

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.85);
      });
    } catch {}
  }

  public playTaskComplete(): void {
    this.playSuccessTone();
  }

  public playLevelUp(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major fanfare

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 1.3);
      });
    } catch {}
  }

  public playTimerStart(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  public playTimerPause(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  /**
   * Start procedural ambient focus noise
   */
  public setAmbientSound(type: 'none' | 'chuva' | 'ruido_branco' | 'ruido_marrom' | 'binaural' | 'cafe', volume: number = 0.5): void {
    this.stopAmbient();
    if (type === 'none') {
      this.currentAmbientType = 'none';
      return;
    }

    try {
      const ctx = this.getContext();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1)) * 0.35, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.ambientGain = masterGain;
      this.currentAmbientType = type;

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      if (type === 'ruido_branco') {
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 4000;

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        this.ambientSource = whiteNoise;
      } else if (type === 'ruido_marrom') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
        const brownNoise = ctx.createBufferSource();
        brownNoise.buffer = noiseBuffer;
        brownNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        brownNoise.connect(filter);
        filter.connect(masterGain);
        brownNoise.start();
        this.ambientSource = brownNoise;
      } else if (type === 'chuva') {
        // Rain simulation: Brown noise base + bandpass filtered rushing stream
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.04 * white)) / 1.04;
          lastOut = output[i];
          output[i] *= 2.5;
        }
        const rainSource = ctx.createBufferSource();
        rainSource.buffer = noiseBuffer;
        rainSource.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1200;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 900;
        bandpass.Q.value = 0.8;

        rainSource.connect(lowpass);
        lowpass.connect(bandpass);
        bandpass.connect(masterGain);
        rainSource.start();
        this.ambientSource = rainSource;
      } else if (type === 'binaural') {
        // Alpha Waves (10 Hz beat frequency difference for calm, focused concentration)
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);

        oscL.type = 'sine';
        oscL.frequency.value = 210; // Left ear: 210 Hz

        oscR.type = 'sine';
        oscR.frequency.value = 220; // Right ear: 220 Hz (Diff = 10Hz Alpha)

        const gL = ctx.createGain();
        const gR = ctx.createGain();
        gL.gain.value = 0.15;
        gR.gain.value = 0.15;

        oscL.connect(gL);
        oscR.connect(gR);
        gL.connect(merger, 0, 0);
        gR.connect(merger, 0, 1);

        merger.connect(masterGain);
        oscL.start();
        oscR.start();
        this.ambientSource = oscL; // store reference
      } else if (type === 'cafe') {
        // Cafe ambience: layered low-frequency rumble with soft mid-band chatter-like filter
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 2.0;
        }
        const cafeSource = ctx.createBufferSource();
        cafeSource.buffer = noiseBuffer;
        cafeSource.loop = true;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 450;
        bandpass.Q.value = 1.2;

        cafeSource.connect(bandpass);
        bandpass.connect(masterGain);
        cafeSource.start();
        this.ambientSource = cafeSource;
      }
    } catch (e) {
      console.warn('Erro ao reproduzir áudio ambiente:', e);
    }
  }

  /**
   * Exam Mode 30-minute interval gentle chime
   */
  public playExamReminderChime(): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [440, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 1.3);
      });
    } catch {}
  }

  public setAmbientVolume(volume: number): void {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(Math.max(0, Math.min(volume, 1)) * 0.35, this.ctx.currentTime);
    }
  }

  public stopAmbient(): void {
    if (this.ambientSource) {
      try {
        (this.ambientSource as AudioScheduledSourceNode).stop();
        this.ambientSource.disconnect();
      } catch {}
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
    this.currentAmbientType = 'none';
  }

  public getActiveAmbient(): string {
    return this.currentAmbientType;
  }
}

export const audioSynthesizer = new AudioSynthesizer();
