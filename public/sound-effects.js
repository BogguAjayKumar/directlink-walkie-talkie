/**
 * Procedural Walkie-Talkie Sound Effects Synthesizer
 * Built with the Web Audio API - 0ms latency, zero external asset downloads.
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.6;
    this.rogerTone = 'motorola'; // 'motorola' | 'nasa' | 'chirp' | 'subtone' | 'squelch' | 'off'
    this.sosOsc = null;
    this.sosGain = null;
    this.sosTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setTone(tone) {
    this.rogerTone = tone;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Tactical mic-open click
  playMicClick() {
    if (!this.enabled || this.rogerTone === 'off') return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // Configurable Roger Beep + Squelch
  playRogerBeep(toneOverride = null) {
    if (!this.enabled) return;
    const tone = toneOverride || this.rogerTone;
    if (tone === 'off') return;
    this.init();

    try {
      const now = this.ctx.currentTime;

      if (tone === 'motorola') {
        // Dual-tone tactical Motorola beep (1209 Hz + 852 Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1209, now);
        gain1.gain.setValueAtTime(this.volume * 0.35, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.065);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(852, now + 0.065);
        gain2.gain.setValueAtTime(this.volume * 0.35, now + 0.065);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.065);
        osc2.stop(now + 0.13);

        this.playSquelchTail(now + 0.13, 0.06);

      } else if (tone === 'nasa') {
        // NASA Quindar outro tone (2475 Hz pure sine wave)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2475, now);
        gain.gain.setValueAtTime(this.volume * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);

        this.playSquelchTail(now + 0.15, 0.07);

      } else if (tone === 'chirp') {
        // Frequency sweep chirp (military radar chirp)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);

        this.playSquelchTail(now + 0.09, 0.05);

      } else if (tone === 'subtone') {
        // Low digital military pulse
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(this.volume * 0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);

        this.playSquelchTail(now + 0.08, 0.04);

      } else if (tone === 'squelch') {
        // Squelch tail only, no electronic tone
        this.playSquelchTail(now, 0.07);
      }
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // Analog radio squelch white noise tail
  playSquelchTail(startTime = null, duration = 0.05) {
    if (!this.enabled) return;
    this.init();
    try {
      const start = startTime || this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Fill with noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter to sound like an RF radio receiver
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 1.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(start);
      noise.stop(start + duration);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // Positive connection chime
  playConnectChime() {
    if (!this.enabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const frequencies = [440, 554.37, 659.25, 880]; // A major arpeggio
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(this.volume * 0.25, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.18);
      });
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // Disconnect / Alert chime
  playDisconnectChime() {
    if (!this.enabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const frequencies = [600, 450, 300];
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = now + idx * 0.08;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(this.volume * 0.2, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.12);
      });
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // Emergency SOS Warble Siren
  playSosSiren() {
    this.stopSosSiren();
    this.init();
    try {
      this.sosOsc = this.ctx.createOscillator();
      this.sosGain = this.ctx.createGain();
      this.sosOsc.type = 'sawtooth';

      const now = this.ctx.currentTime;
      this.sosGain.gain.setValueAtTime(this.volume * 0.45, now);

      let cur = 960;
      this.sosOsc.frequency.setValueAtTime(cur, now);

      this.sosOsc.connect(this.sosGain);
      this.sosGain.connect(this.ctx.destination);
      this.sosOsc.start();

      this.sosTimer = setInterval(() => {
        if (!this.sosOsc || !this.ctx) return;
        cur = (cur === 960) ? 770 : 960;
        try {
          this.sosOsc.frequency.setValueAtTime(cur, this.ctx.currentTime);
        } catch (e) {}
      }, 250);
    } catch (e) {
      console.warn('SOS Siren error:', e);
    }
  }

  stopSosSiren() {
    if (this.sosTimer) {
      clearInterval(this.sosTimer);
      this.sosTimer = null;
    }
    if (this.sosOsc) {
      try {
        const now = this.ctx ? this.ctx.currentTime : 0;
        if (this.sosGain && now) {
          this.sosGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        }
        setTimeout(() => {
          if (this.sosOsc) {
            try { this.sosOsc.stop(); this.sosOsc.disconnect(); } catch (e) {}
            this.sosOsc = null;
          }
        }, 60);
      } catch (e) {
        this.sosOsc = null;
      }
    }
  }

  // Replay Announcement Chirp
  playReplayChirp() {
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.06);
      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  // Tactical RF Radio Biquad Bandpass + Saturation Filter Chain
  createTacticalRadioFilter(customCtx = null) {
    const ctx = customCtx || this.ctx;
    if (!ctx) return null;

    const input = ctx.createGain();
    const output = ctx.createGain();

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 350;
    highpass.Q.value = 0.9;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;
    lowpass.Q.value = 0.9;

    const midBoost = ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 1800;
    midBoost.gain.value = 4.0;
    midBoost.Q.value = 1.4;

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 1.3);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';

    const wetGain = ctx.createGain();
    const dryGain = ctx.createGain();
    wetGain.gain.value = 1.0;
    dryGain.gain.value = 0.0;

    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(midBoost);
    midBoost.connect(shaper);
    shaper.connect(wetGain);
    wetGain.connect(output);

    input.connect(dryGain);
    dryGain.connect(output);

    return {
      input,
      output,
      setFilterActive(active) {
        const now = ctx.currentTime;
        wetGain.gain.setValueAtTime(active ? 1.0 : 0.0, now);
        dryGain.gain.setValueAtTime(active ? 0.0 : 1.0, now);
      }
    };
  }
}

window.soundEffects = new SoundEffects();
