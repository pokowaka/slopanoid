/* ============================================================================
 * js/audio.js
 * Procedural Web Audio API OPL3 / YM2151 FM + PSG Arcade Synthesizer
 * - Gothic Baroque Harpsichord, Spooky Pipe Organ, Driving FM Bass & Percussion
 * - 6 Stage Themes + Boss + Title + Classic Stage-Intro Map Jingle
 * - Dynamic Boxer-Shorts Tempo Speedup (+24%) & Octave Shift (+12 Semitones)
 * - 22 Authentic Arcade Sound Effects
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Musical patterns (16 steps per bar, 2 bars = 32 steps per loop; 0 = rest)
  const THEMES = {
    title: {
      bpm: 132,
      lead: [
        62, 0, 65, 69, 74, 0, 73, 74, 76, 74, 70, 69, 67, 65, 64, 61,
        62, 69, 65, 62, 58, 65, 62, 58, 57, 61, 64, 67, 69, 0, 73, 0
      ],
      organ: [
        50, 0, 0, 0, 50, 0, 0, 0, 55, 0, 0, 0, 57, 0, 0, 0,
        50, 0, 0, 0, 46, 0, 0, 0, 45, 0, 0, 0, 45, 0, 49, 0
      ],
      bass: [
        38, 38, 50, 38, 38, 38, 50, 38, 43, 43, 55, 43, 45, 45, 57, 45,
        38, 50, 38, 50, 34, 46, 34, 46, 33, 45, 33, 45, 33, 35, 37, 45
      ],
      drums: 'K.h.S.h.K.K.S.hHK.h.S.h.K.S.K.SS'
    },
    stage1: {
      // Stage 1: LeChuck's Ghost Ship & Melee Graveyard (Baroque G-minor Pirate Jig)
      bpm: 142,
      lead: [
        67, 0, 70, 74, 79, 0, 78, 79, 75, 74, 72, 70, 74, 0, 67, 0,
        72, 75, 79, 75, 70, 74, 79, 74, 69, 72, 75, 74, 70, 0, 66, 69
      ],
      organ: [
        55, 0, 0, 0, 58, 0, 0, 0, 60, 0, 0, 0, 55, 0, 0, 0,
        48, 0, 0, 0, 55, 0, 0, 0, 50, 0, 0, 0, 54, 0, 0, 0
      ],
      bass: [
        43, 0, 55, 43, 43, 0, 50, 43, 48, 0, 60, 48, 43, 0, 55, 43,
        36, 48, 36, 48, 43, 55, 43, 55, 38, 50, 38, 50, 42, 38, 40, 42
      ],
      drums: 'K.h.S.hHK.hKS.h.K.h.S.hHK.S.K.hS'
    },
    stage2: {
      // Stage 2: Haunted Moat of Daventry (Gothic E-minor Renaissance Fugue)
      bpm: 136,
      lead: [
        64, 67, 71, 76, 75, 76, 79, 76, 72, 71, 69, 67, 66, 69, 71, 0,
        64, 67, 71, 74, 72, 71, 69, 67, 66, 64, 63, 66, 64, 0, 76, 0
      ],
      organ: [
        52, 0, 0, 0, 52, 0, 0, 0, 57, 0, 0, 0, 59, 0, 0, 0,
        52, 0, 0, 0, 48, 0, 0, 0, 47, 0, 0, 0, 52, 0, 0, 0
      ],
      bass: [
        40, 52, 40, 52, 40, 52, 43, 52, 45, 57, 45, 57, 47, 59, 47, 45,
        40, 52, 40, 52, 36, 48, 36, 48, 35, 47, 35, 47, 40, 0, 40, 47
      ],
      drums: 'K.h.S.h.K.hKS.hHK.h.S.h.K.K.S.h.'
    },
    stage3: {
      // Stage 3: Jaffar Spike Catacombs (E Phrygian-Dominant Arabian Gothic)
      bpm: 146,
      lead: [
        64, 65, 68, 69, 71, 69, 68, 65, 64, 0, 71, 72, 71, 69, 68, 65,
        69, 71, 72, 76, 75, 76, 72, 71, 69, 68, 65, 68, 64, 0, 64, 0
      ],
      organ: [
        52, 0, 0, 52, 0, 0, 53, 0, 52, 0, 0, 52, 0, 0, 56, 0,
        57, 0, 0, 57, 0, 0, 53, 0, 52, 0, 56, 0, 52, 0, 0, 0
      ],
      bass: [
        40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 41, 40, 44, 41,
        45, 45, 57, 45, 41, 41, 53, 41, 40, 44, 47, 44, 40, 40, 52, 40
      ],
      drums: 'K.K.S.h.K.hKS.K.K.K.S.h.K.S.K.SS'
    },
    stage4: {
      // Stage 4: Lemmings Crusher Foundry (C-minor Clockwork Industrial March + Anvil)
      bpm: 150,
      lead: [
        72, 0, 75, 72, 79, 0, 75, 72, 74, 75, 77, 75, 74, 72, 71, 67,
        72, 74, 75, 77, 79, 80, 79, 75, 74, 72, 71, 74, 72, 0, 60, 0
      ],
      organ: [
        48, 0, 55, 0, 48, 0, 55, 0, 50, 0, 55, 0, 47, 0, 55, 0,
        48, 0, 55, 0, 53, 0, 56, 0, 55, 0, 47, 0, 48, 0, 0, 0
      ],
      bass: [
        36, 48, 36, 48, 36, 48, 39, 48, 38, 50, 38, 50, 35, 47, 35, 47,
        36, 48, 38, 50, 39, 51, 41, 53, 43, 55, 35, 47, 36, 36, 48, 36
      ],
      drums: 'K.h.A.h.K.K.A.hHK.h.A.h.K.A.S.SS'
    },
    stage5: {
      // Stage 5: Phobos E1M1 Necropolis (Driving E-minor Baroque-Metal Riff)
      bpm: 158,
      lead: [
        64, 64, 76, 64, 64, 74, 64, 64, 72, 64, 64, 70, 64, 64, 71, 72,
        64, 64, 76, 64, 64, 74, 64, 64, 72, 64, 70, 0, 70, 0, 67, 66
      ],
      organ: [
        52, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0, 46, 0, 47, 48,
        52, 0, 0, 0, 50, 0, 0, 0, 48, 0, 46, 0, 46, 0, 0, 0
      ],
      bass: [
        40, 40, 52, 40, 40, 50, 40, 40, 48, 40, 40, 46, 40, 40, 47, 48,
        40, 40, 52, 40, 40, 50, 40, 40, 48, 40, 46, 46, 46, 40, 43, 42
      ],
      drums: 'K.hKS.hKK.hKS.hHK.hKS.hKK.S.K.SS'
    },
    boss: {
      // Stage 6 & Bosses: Furious Diminished Demon Throne Toccata
      bpm: 166,
      lead: [
        69, 72, 75, 78, 81, 78, 75, 72, 70, 73, 76, 79, 82, 79, 76, 73,
        69, 75, 72, 78, 75, 81, 78, 84, 83, 80, 76, 74, 71, 68, 69, 0
      ],
      organ: [
        57, 0, 60, 0, 63, 0, 66, 0, 58, 0, 61, 0, 64, 0, 67, 0,
        57, 0, 63, 0, 66, 0, 69, 0, 56, 0, 59, 0, 52, 0, 57, 0
      ],
      bass: [
        33, 45, 33, 45, 36, 48, 39, 51, 34, 46, 34, 46, 37, 49, 40, 52,
        33, 45, 39, 51, 42, 54, 45, 57, 40, 52, 40, 52, 40, 44, 47, 40
      ],
      drums: 'K.K.S.hKK.K.S.K.K.K.S.hKK.S.S.SS'
    }
  };

  class ArcadeAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.noiseBuf = null;

      this.enabled = true;
      this.currentTheme = null;
      this.boxerPanic = false;
      this.stepIndex = 0;
      this.nextNoteTime = 0;
      this.schedulerId = null;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.42 : 0.0;
        this.master.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.48;
        this.musicGain.connect(this.master);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.82;
        this.sfxGain.connect(this.master);

        // Pre-bake 1.0s PSG noise buffer
        const sr = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, sr, sr);
        const data = this.noiseBuf.getChannelData(0);
        let lfsr = 0x7fff;
        for (let i = 0; i < sr; i++) {
          const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (bit << 14);
          data[i] = (lfsr & 1 ? 1 : -1) * 0.6 + (Math.random() * 2 - 1) * 0.4;
        }

        this._startScheduler();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setEnabled(flag) {
      this.enabled = !!flag;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.enabled ? 0.42 : 0.0, this.ctx.currentTime, 0.015);
      }
    }

    toggle() {
      this.unlock();
      this.setEnabled(!this.enabled);
      return this.enabled;
    }

    setTheme(themeName) {
      if (this.currentTheme === themeName) return;
      this.currentTheme = themeName;
      this.stepIndex = 0;
      if (this.ctx) {
        this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.03);
      }
    }

    setBoxerPanic(isPanic) {
      this.boxerPanic = !!isPanic;
    }

    _startScheduler() {
      if (this.schedulerId) return;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.schedulerId = window.setInterval(() => {
        if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
        const theme = THEMES[this.currentTheme];
        if (!theme) {
          this.nextNoteTime = this.ctx.currentTime + 0.05;
          return;
        }
        const horizon = this.ctx.currentTime + 0.12;
        if (this.nextNoteTime < this.ctx.currentTime - 0.1) {
          this.nextNoteTime = this.ctx.currentTime + 0.02;
        }
        while (this.nextNoteTime < horizon) {
          this._scheduleStep(theme, this.stepIndex, this.nextNoteTime);
          const effectiveBpm = theme.bpm * (this.boxerPanic ? 1.24 : 1.0);
          const stepDur = 60 / effectiveBpm / 4; // 16th note
          this.nextNoteTime += stepDur;
          this.stepIndex = (this.stepIndex + 1) & 31;
        }
      }, 30);
    }

    _scheduleStep(theme, step, t) {
      const shift = this.boxerPanic ? 12 : 0;
      const effectiveBpm = theme.bpm * (this.boxerPanic ? 1.24 : 1.0);
      const stepDur = 60 / effectiveBpm / 4;

      const leadMidi = theme.lead[step];
      if (leadMidi > 0) {
        this._voiceHarpsichord(
          midiToFreq(leadMidi + shift),
          t,
          stepDur * (this.boxerPanic ? 0.85 : 1.35),
          0.22,
          this.musicGain
        );
      }

      const organMidi = theme.organ[step];
      if (organMidi > 0) {
        this._voicePipeOrgan(
          midiToFreq(organMidi + shift),
          t,
          stepDur * (this.boxerPanic ? 2.2 : 3.6),
          0.14,
          this.musicGain
        );
      }

      const bassMidi = theme.bass[step];
      if (bassMidi > 0) {
        this._voiceFMBass(
          midiToFreq(bassMidi + (this.boxerPanic ? 12 : 0)),
          t,
          stepDur * 0.92,
          0.28,
          this.musicGain
        );
      }

      const d = theme.drums[step];
      if (d === 'K') this._drumKick(t, 0.34, this.musicGain);
      else if (d === 'S') this._drumSnare(t, 0.24, this.musicGain);
      else if (d === 'h') this._drumHat(t, false, 0.09, this.musicGain);
      else if (d === 'H') this._drumHat(t, true, 0.13, this.musicGain);
      else if (d === 'A') {
        this._drumSnare(t, 0.16, this.musicGain);
        this._anvilPing(t, 520, 0.16, this.musicGain);
      }
    }

    // --- FM Voice 1: Gothic Baroque Harpsichord (2-Op FM Pluck) ---
    _voiceHarpsichord(freq, t, dur, vel, dest) {
      const ctx = this.ctx;
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const car = ctx.createOscillator();
      const out = ctx.createGain();

      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * 3.0, t);
      modGain.gain.setValueAtTime(freq * 3.2, t);
      modGain.gain.exponentialRampToValueAtTime(Math.max(10, freq * 0.18), t + 0.065);

      car.type = 'triangle';
      car.frequency.setValueAtTime(freq, t);

      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(vel, t + 0.005);
      out.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.05, dur));

      mod.connect(modGain);
      modGain.connect(car.frequency);
      car.connect(out);
      out.connect(dest);

      mod.start(t);
      car.start(t);
      const stopT = t + dur + 0.03;
      mod.stop(stopT);
      car.stop(stopT);
    }

    // --- FM Voice 2: Spooky Pipe Organ (Stacked Drawbar Harmonics) ---
    _voicePipeOrgan(freq, t, dur, vel, dest) {
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(vel, t + 0.02);
      out.gain.setValueAtTime(vel * 0.85, t + Math.max(0.03, dur * 0.75));
      out.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.06, dur));
      out.connect(dest);

      const ratios = [1.0, 2.003, 3.0];
      const weights = [0.55, 0.3, 0.15];
      const stopT = t + dur + 0.04;
      for (let i = 0; i < ratios.length; i++) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i === 0 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq * ratios[i], t);
        g.gain.value = weights[i];
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(stopT);
      }
    }

    // --- FM Voice 3: Driving Arcade YM2151 Slap Bass ---
    _voiceFMBass(freq, t, dur, vel, dest) {
      const ctx = this.ctx;
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const car = ctx.createOscillator();
      const out = ctx.createGain();

      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * 2.0, t);
      modGain.gain.setValueAtTime(freq * 4.4, t);
      modGain.gain.exponentialRampToValueAtTime(Math.max(8, freq * 0.35), t + 0.08);

      car.type = 'sine';
      car.frequency.setValueAtTime(freq, t);

      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(vel, t + 0.004);
      out.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.04, dur));

      mod.connect(modGain);
      modGain.connect(car.frequency);
      car.connect(out);
      out.connect(dest);

      const stopT = t + dur + 0.02;
      mod.start(t);
      car.start(t);
      mod.stop(stopT);
      car.stop(stopT);
    }

    _drumKick(t, vel, dest) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.09);
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    _drumSnare(t, vel, dest) {
      if (!this.noiseBuf) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, t);
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t);
      src.stop(t + 0.12);

      // Pitched drum body
      const body = ctx.createOscillator();
      const bg = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(195, t);
      body.frequency.exponentialRampToValueAtTime(88, t + 0.06);
      bg.gain.setValueAtTime(vel * 0.7, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      body.connect(bg);
      bg.connect(dest);
      body.start(t);
      body.stop(t + 0.08);
    }

    _drumHat(t, open, vel, dest) {
      if (!this.noiseBuf) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(6800, t);
      const dur = open ? 0.13 : 0.038;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(hp);
      hp.connect(g);
      g.connect(dest);
      src.start(t);
      src.stop(t + dur + 0.01);
    }

    _anvilPing(t, freq, vel, dest) {
      const ctx = this.ctx;
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      const car = ctx.createOscillator();
      const out = ctx.createGain();
      mod.frequency.setValueAtTime(freq * 1.414, t);
      mg.gain.setValueAtTime(freq * 2.8, t);
      mg.gain.exponentialRampToValueAtTime(12, t + 0.14);
      car.frequency.setValueAtTime(freq, t);
      out.gain.setValueAtTime(vel, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      mod.connect(mg);
      mg.connect(car.frequency);
      car.connect(out);
      out.connect(dest);
      mod.start(t);
      car.start(t);
      mod.stop(t + 0.18);
      car.stop(t + 0.18);
    }

    // --- Classic Stage-Intro Map Jingle ---
    playMapJingle() {
      if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
      this.currentTheme = null; // Pause looping BGM while jingle plays
      const t0 = this.ctx.currentTime + 0.02;
      const notes = [
        // Iconic haunted stage-intro fanfare
        [62, 0.0, 0.14], [62, 0.15, 0.14], [62, 0.3, 0.14],
        [69, 0.46, 0.34], [67, 0.82, 0.16], [65, 1.0, 0.16],
        [64, 1.18, 0.16], [65, 1.36, 0.16], [69, 1.54, 0.34],
        [62, 1.9, 0.55]
      ];
      const bassNotes = [
        [50, 0.0, 0.42], [45, 0.46, 0.35], [43, 0.82, 0.34],
        [45, 1.18, 0.68], [38, 1.9, 0.6]
      ];
      for (const [m, off, dur] of notes) {
        this._voiceHarpsichord(midiToFreq(m), t0 + off, dur, 0.28, this.sfxGain);
      }
      for (const [m, off, dur] of bassNotes) {
        this._voicePipeOrgan(midiToFreq(m), t0 + off, dur, 0.18, this.sfxGain);
        this._drumKick(t0 + off, 0.28, this.sfxGain);
      }
      this._drumSnare(t0 + 0.46, 0.24, this.sfxGain);
      this._drumSnare(t0 + 1.54, 0.24, this.sfxGain);
      this._drumSnare(t0 + 1.9, 0.3, this.sfxGain);
    }

    playVictoryFanfare() {
      if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
      this.currentTheme = null;
      const t0 = this.ctx.currentTime + 0.03;
      const fanfare = [
        [62, 0.0, 0.16], [66, 0.17, 0.16], [69, 0.34, 0.16], [74, 0.51, 0.38],
        [71, 0.92, 0.18], [74, 1.12, 0.18], [78, 1.32, 0.72]
      ];
      for (const [m, off, dur] of fanfare) {
        this._voiceHarpsichord(midiToFreq(m), t0 + off, dur, 0.3, this.sfxGain);
        this._voicePipeOrgan(midiToFreq(m - 12), t0 + off, dur, 0.16, this.sfxGain);
      }
    }

    // --- Procedural Arcade Sound Effects ---
    sfx(type) {
      if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
      const ctx = this.ctx;
      const t = ctx.currentTime;

      switch (type) {
        case 'jump': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(190, t);
          osc.frequency.exponentialRampToValueAtTime(490, t + 0.11);
          g.gain.setValueAtTime(0.14, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.13);
          break;
        }
        case 'doubleJump': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(340, t);
          osc.frequency.exponentialRampToValueAtTime(860, t + 0.13);
          g.gain.setValueAtTime(0.18, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.15);
          break;
        }
        case 'throwLance': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(760, t);
          osc.frequency.exponentialRampToValueAtTime(220, t + 0.085);
          g.gain.setValueAtTime(0.16, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        }
        case 'throwDagger': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1180, t);
          osc.frequency.exponentialRampToValueAtTime(420, t + 0.055);
          g.gain.setValueAtTime(0.14, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.065);
          break;
        }
        case 'throwTorch': {
          this._drumHat(t, true, 0.15, this.sfxGain);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(420, t);
          osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
          g.gain.setValueAtTime(0.14, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.14);
          break;
        }
        case 'torchBurn': {
          if (!this.noiseBuf) break;
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(950, t);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.18, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          src.connect(bp);
          bp.connect(g);
          g.connect(this.sfxGain);
          src.start(t);
          src.stop(t + 0.24);
          break;
        }
        case 'throwAxe': {
          for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(320 - i * 60, t + i * 0.06);
            osc.frequency.exponentialRampToValueAtTime(140, t + i * 0.06 + 0.055);
            g.gain.setValueAtTime(0.13, t + i * 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.06);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.065);
          }
          break;
        }
        case 'throwCross': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(620, t);
          osc.frequency.linearRampToValueAtTime(880, t + 0.07);
          osc.frequency.linearRampToValueAtTime(580, t + 0.14);
          g.gain.setValueAtTime(0.16, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.16);
          break;
        }
        case 'armorShatter': {
          // Iconic metallic crash + descending clattering plates
          this._drumSnare(t, 0.42, this.sfxGain);
          const freqs = [920, 740, 580, 430, 310];
          for (let i = 0; i < freqs.length; i++) {
            this._anvilPing(t + i * 0.048, freqs[i], 0.24, this.sfxGain);
          }
          break;
        }
        case 'armorEject': {
          this._anvilPing(t, 680, 0.26, this.sfxGain);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(520, t + 0.03);
          osc.frequency.exponentialRampToValueAtTime(110, t + 0.22);
          g.gain.setValueAtTime(0.18, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t + 0.03);
          osc.stop(t + 0.25);
          break;
        }
        case 'anvilSlam': {
          this._drumKick(t, 0.5, this.sfxGain);
          this._anvilPing(t, 380, 0.32, this.sfxGain);
          break;
        }
        case 'springBounce': {
          this._anvilPing(t, 520, 0.22, this.sfxGain);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(210, t);
          osc.frequency.exponentialRampToValueAtTime(790, t + 0.18);
          g.gain.setValueAtTime(0.24, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.21);
          break;
        }
        case 'possess': {
          // Eerie ghost-soul FM sweep
          const mod = ctx.createOscillator();
          const mg = ctx.createGain();
          const car = ctx.createOscillator();
          const out = ctx.createGain();
          mod.frequency.setValueAtTime(220, t);
          mod.frequency.exponentialRampToValueAtTime(660, t + 0.35);
          mg.gain.setValueAtTime(280, t);
          car.type = 'sine';
          car.frequency.setValueAtTime(280, t);
          car.frequency.exponentialRampToValueAtTime(840, t + 0.35);
          out.gain.setValueAtTime(0.24, t);
          out.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
          mod.connect(mg);
          mg.connect(car.frequency);
          car.connect(out);
          out.connect(this.sfxGain);
          mod.start(t);
          car.start(t);
          mod.stop(t + 0.4);
          car.stop(t + 0.4);
          break;
        }
        case 'possessEnd': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(720, t);
          osc.frequency.exponentialRampToValueAtTime(240, t + 0.18);
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.21);
          break;
        }
        case 'magicCharge': {
          this._voiceHarpsichord(880, t, 0.1, 0.15, this.sfxGain);
          break;
        }
        case 'magicCast': {
          this._drumKick(t, 0.45, this.sfxGain);
          this._drumSnare(t + 0.02, 0.35, this.sfxGain);
          const chord = [62, 69, 74, 78, 86];
          for (let i = 0; i < chord.length; i++) {
            this._voiceHarpsichord(midiToFreq(chord[i]), t + i * 0.035, 0.45, 0.24, this.sfxGain);
          }
          break;
        }
        case 'chestSpawn': {
          const arp = [69, 73, 76, 81, 85];
          for (let i = 0; i < arp.length; i++) {
            this._voiceHarpsichord(midiToFreq(arp[i]), t + i * 0.045, 0.16, 0.22, this.sfxGain);
          }
          break;
        }
        case 'chestOpen': {
          this._drumSnare(t, 0.22, this.sfxGain);
          this._voiceHarpsichord(midiToFreq(76), t + 0.03, 0.18, 0.24, this.sfxGain);
          this._voiceHarpsichord(midiToFreq(83), t + 0.09, 0.22, 0.24, this.sfxGain);
          break;
        }
        case 'armorEquip': {
          const notes = [60, 64, 67, 72];
          for (let i = 0; i < notes.length; i++) {
            this._voiceHarpsichord(midiToFreq(notes[i]), t + i * 0.055, 0.22, 0.28, this.sfxGain);
          }
          break;
        }
        case 'goldenUpgrade': {
          const notes = [62, 66, 69, 74, 78, 86];
          for (let i = 0; i < notes.length; i++) {
            this._voiceHarpsichord(midiToFreq(notes[i]), t + i * 0.055, 0.32, 0.3, this.sfxGain);
          }
          this._voicePipeOrgan(midiToFreq(50), t, 0.5, 0.22, this.sfxGain);
          break;
        }
        case 'enemyHit': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(240, t);
          osc.frequency.exponentialRampToValueAtTime(95, t + 0.065);
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.075);
          break;
        }
        case 'enemyKill': {
          this._drumSnare(t, 0.28, this.sfxGain);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(340, t);
          osc.frequency.exponentialRampToValueAtTime(65, t + 0.14);
          g.gain.setValueAtTime(0.22, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.16);
          break;
        }
        case 'shieldClink': {
          this._anvilPing(t, 1080, 0.22, this.sfxGain);
          break;
        }
        case 'slicerSnap': {
          this._anvilPing(t, 820, 0.18, this.sfxGain);
          this._drumHat(t, false, 0.15, this.sfxGain);
          break;
        }
        case 'explosion': {
          this._drumKick(t, 0.48, this.sfxGain);
          this._drumSnare(t, 0.42, this.sfxGain);
          break;
        }
        case 'playerDeath': {
          this.currentTheme = null;
          const sad = [69, 68, 67, 66, 64, 57, 50];
          for (let i = 0; i < sad.length; i++) {
            this._voiceHarpsichord(midiToFreq(sad[i]), t + i * 0.09, 0.18, 0.28, this.sfxGain);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  GNG.ArcadeAudio = ArcadeAudio;
})();
