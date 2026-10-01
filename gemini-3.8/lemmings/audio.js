// ============================================================================
// Lemmings: Beat Tribe — Amiga OCS & Web Audio API Tracker Engine
// 100% Procedural Synthesis & Multi-Stem Tracker Sequencer
// Zero external samples, zero external libraries.
// ============================================================================

(function(global) {
  'use strict';

  // Musical Note Frequencies (A4 = 440 Hz)
  const NOTE_FREQ = {
    'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'G6': 1567.98, 'A6': 1760.00
  };

  // World Scale Definitions
  const WORLD_SCALES = {
    1: {
      name: 'Major Pentatonic (C, D, E, G, A)',
      degrees: ['C', 'D', 'E', 'G', 'A'],
      baseOctave: 4
    },
    2: {
      name: 'Phrygian Mode (E, F, G, A, B, C, D)',
      degrees: ['E', 'F', 'G', 'A', 'B', 'C', 'D'],
      baseOctave: 3
    },
    3: {
      name: 'Dorian Mode (D, E, F, G, A, B, C)',
      degrees: ['D', 'E', 'F', 'G', 'A', 'B', 'C'],
      baseOctave: 3
    },
    4: {
      name: 'Minor Pentatonic (A, C, D, E, G)',
      degrees: ['A', 'C', 'D', 'E', 'G'],
      baseOctave: 3
    },
    5: {
      name: 'Lydian Mode (F, G, A, B, C, D, E)',
      degrees: ['F', 'G', 'A', 'B', 'C', 'D', 'E'],
      baseOctave: 3
    }
  };

  class BeatTribeAudioEngine {
    constructor() {
      this.ctx = null;
      this.isInitialized = false;
      this.isMuted = false;
      this.isPlaying = false;
      this.isFastForward = false;

      // Master Nodes
      this.masterGain = null;
      this.compressor = null;
      this.analyser = null;

      // Delay Bus
      this.delayNodeL = null;
      this.delayNodeR = null;
      this.delayFeedbackL = null;
      this.delayFeedbackR = null;
      this.delaySendGain = null;

      // 5 Stem Channels: 0: Drums, 1: Bass, 2: Chords, 3: Lead, 4: Full Mix
      this.stemGains = [];
      this.stemMutes = [false, false, false, false, false];
      this.stemSolos = [false, false, false, false, false];
      this.stemUnlocked = [false, false, false, false, false];
      this.stemTargetGains = [0, 0, 0, 0, 0];

      // Procedural Noise Buffer
      this.noiseBuffer = null;

      // Tracker Sequencer State
      this.bpm = 124;
      this.currentWorld = 1;
      this.patternIndex = 0;
      this.currentRow = 0;
      this.nextRowTime = 0;
      this.schedulerTimer = null;
      this.lookaheadMs = 25;
      this.scheduleAheadSec = 0.12;

      // Quantized Footsteps Queue
      this.queuedFootsteps = [];

      // Active Drone (Blocker) Node
      this.droneOsc = null;
      this.droneGain = null;
      this.activeBlockersCount = 0;

      // Visualizer Buffers
      this.timeData = null;
      this.freqData = null;

      // Replay Recording (for results screen playback)
      this.recordedNotes = [];
    }

    init() {
      if (this.isInitialized) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Limiter / Compressor
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      // Master Analyser
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Stereo Ping-Pong Delay Network
      this.delaySendGain = this.ctx.createGain();
      this.delaySendGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

      this.delayNodeL = this.ctx.createDelay(1.0);
      this.delayNodeR = this.ctx.createDelay(1.0);
      this.delayNodeL.delayTime.setValueAtTime(0.24, this.ctx.currentTime); // ~3/16 note
      this.delayNodeR.delayTime.setValueAtTime(0.36, this.ctx.currentTime); // ~1/4 dotted

      this.delayFeedbackL = this.ctx.createGain();
      this.delayFeedbackR = this.ctx.createGain();
      this.delayFeedbackL.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.delayFeedbackR.gain.setValueAtTime(0.35, this.ctx.currentTime);

      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);

      this.delaySendGain.connect(this.delayNodeL);
      this.delaySendGain.connect(this.delayNodeR);
      this.delayNodeL.connect(this.delayFeedbackR);
      this.delayNodeR.connect(this.delayFeedbackL);
      this.delayFeedbackL.connect(this.delayNodeL);
      this.delayFeedbackR.connect(this.delayNodeR);

      this.delayNodeL.connect(delayFilter);
      this.delayNodeR.connect(delayFilter);
      delayFilter.connect(this.masterGain);

      // Create 5 Stem Gain Nodes
      for (let i = 0; i < 5; i++) {
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
        gainNode.connect(this.masterGain);
        this.stemGains.push(gainNode);
      }

      // Procedural Noise Buffer (2.0s loop)
      const bufferSize = this.ctx.sampleRate * 2.0;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.isInitialized = true;
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    setWorld(worldNumber, bpm = 124) {
      this.currentWorld = worldNumber;
      this.bpm = bpm;
      this.resetStems();
    }

    resetStems() {
      this.stemUnlocked = [false, false, false, false, false];
      this.stemTargetGains = [0, 0, 0, 0, 0];
      this.applyStemGains(true);
    }

    unlockStem(stemIndex) {
      if (stemIndex >= 0 && stemIndex < 5 && !this.stemUnlocked[stemIndex]) {
        this.stemUnlocked[stemIndex] = true;
        this.stemTargetGains[stemIndex] = 1.0;
        this.applyStemGains();
        return true;
      }
      return false;
    }

    applyStemGains(instant = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const anySolo = this.stemSolos.some(s => s);

      for (let i = 0; i < 5; i++) {
        let target = this.stemUnlocked[i] ? this.stemTargetGains[i] : 0.0;
        if (this.stemMutes[i]) target = 0.0;
        if (anySolo && !this.stemSolos[i]) target = 0.0;
        if (this.isMuted) target = 0.0;

        const g = this.stemGains[i].gain;
        if (instant) {
          g.setValueAtTime(target, now);
        } else {
          g.cancelScheduledValues(now);
          g.setValueAtTime(g.value, now);
          g.linearRampToValueAtTime(target, now + 0.8);
        }
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0 : 0.75, this.ctx.currentTime);
      }
      return this.isMuted;
    }

    toggleStemMute(idx) {
      this.stemMutes[idx] = !this.stemMutes[idx];
      this.applyStemGains();
      return this.stemMutes[idx];
    }

    toggleStemSolo(idx) {
      this.stemSolos[idx] = !this.stemSolos[idx];
      this.applyStemGains();
      return this.stemSolos[idx];
    }

    setFastForward(active) {
      this.isFastForward = active;
    }

    getEffectiveBpm() {
      return this.isFastForward ? this.bpm * 2 : this.bpm;
    }

    startTracker() {
      if (!this.isInitialized) this.init();
      this.resume();
      this.isPlaying = true;
      this.currentRow = 0;
      this.nextRowTime = this.ctx.currentTime + 0.05;

      if (this.schedulerTimer) clearInterval(this.schedulerTimer);
      this.schedulerTimer = setInterval(() => this.schedulerLoop(), this.lookaheadMs);
    }

    stopTracker() {
      this.isPlaying = false;
      if (this.schedulerTimer) {
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this.stopBlockerDrone();
    }

    schedulerLoop() {
      if (!this.isPlaying || !this.ctx) return;
      const bpm = this.getEffectiveBpm();
      const secondsPerRow = (60.0 / bpm) / 4.0; // 16th note rows

      while (this.nextRowTime < this.ctx.currentTime + this.scheduleAheadSec) {
        this.scheduleTrackerRow(this.currentRow, this.nextRowTime, secondsPerRow);
        this.processQueuedFootsteps(this.nextRowTime);
        this.currentRow = (this.currentRow + 1) % 64;
        if (this.currentRow === 0) {
          this.patternIndex = (this.patternIndex + 1) % 4;
        }
        this.nextRowTime += secondsPerRow;
      }
    }

    // Tracker Pattern Sequencing for the 5 Worlds
    scheduleTrackerRow(row, time, duration) {
      const world = this.currentWorld;

      // 1. DRUMS STEM (Channel 0)
      if (row % 16 === 0 || (world === 4 && (row % 16 === 0 || row % 16 === 10))) {
        this.synthKick(time);
      }
      if (row % 16 === 8 || (world === 4 && (row % 16 === 4 || row % 16 === 12))) {
        this.synthSnare(time, world === 4 ? 1.2 : 0.9);
      }
      if (row % 4 === 2 || (world === 4 && row % 2 === 1)) {
        this.synthHiHat(time, row % 8 === 4);
      }

      // 2. BASS STEM (Channel 1)
      const bassNote = this.getBassPatternNote(world, this.patternIndex, row);
      if (bassNote) {
        const freq = NOTE_FREQ[bassNote] || 110;
        if (world === 2) {
          // TB-303 Acid Bass
          const accent = (row % 8 === 0 || row % 16 === 6);
          const slide = (row % 4 === 3);
          this.synthAcidBass(freq, time, duration * 1.5, accent, slide);
        } else {
          this.synthSubBass(freq, time, duration * 1.2, world);
        }
      }

      // 3. CHORDS STEM (Channel 2)
      if (row % 16 === 0 || row % 16 === 6 || (world === 3 && row % 8 === 0)) {
        const chord = this.getChordNotes(world, this.patternIndex, row);
        if (chord && chord.length) {
          this.synthPadChord(chord, time, duration * 8, world);
        }
      }

      // 4. LEAD STEM (Channel 3)
      const leadNote = this.getLeadPatternNote(world, this.patternIndex, row);
      if (leadNote) {
        const freq = NOTE_FREQ[leadNote] || 440;
        if (world === 1) {
          // Amiga Chiptune Arp
          this.synthChipArp(freq, time, duration * 0.9);
        } else if (world === 3) {
          // Synthwave Pluck / Lead
          this.synthAnalogLead(freq, time, duration * 1.4);
        } else if (world === 4) {
          // Jungle Resonant Flute / Synth
          this.synthJungleLead(freq, time, duration * 1.1);
        } else if (world === 5) {
          // Orchestral Brass / Fanfare
          this.synthBrassLead(freq, time, duration * 1.8);
        } else {
          this.synthAcidLead(freq, time, duration * 1.2);
        }
      }

      // 5. FULL MIX STEM (Channel 4)
      if (row === 62) {
        // Crash / Riser
        this.synthCrash(time);
      }
    }

    // Pattern Data Generation for the 5 Worlds
    getBassPatternNote(world, pattern, row) {
      if (world === 1) {
        // Chip Garden: C4 - G3 - A3 - F3
        const notes = ['C3', null, 'C3', null, 'G2', null, 'G2', 'A2', 'A2', null, 'A2', null, 'F2', null, 'G2', null];
        return notes[row % 16];
      } else if (world === 2) {
        // Acid Warehouse: E Phrygian 303 line
        const notes = ['E2', 'E2', null, 'G2', 'F2', null, 'E2', 'A2', 'E2', null, 'D3', 'C3', 'B2', 'G2', 'A2', 'B2'];
        return notes[row % 16];
      } else if (world === 3) {
        // Synthwave Sunset: D Dorian 16th bass
        const roots = ['D2', 'F2', 'C2', 'G2'];
        const root = roots[Math.floor(row / 16) % roots.length];
        return (row % 2 === 0) ? root : null;
      } else if (world === 4) {
        // Jungle Breakbeat: Sub-bass 808 glides
        if (row === 0) return 'A1';
        if (row === 10) return 'C2';
        if (row === 20) return 'D2';
        if (row === 28) return 'G1';
        return null;
      } else {
        // Grand Orchestral: F Lydian contrabass
        if (row % 16 === 0) {
          const notes = ['F2', 'C2', 'D2', 'G2'];
          return notes[Math.floor(row / 16) % notes.length];
        }
        return null;
      }
    }

    getChordNotes(world, pattern, row) {
      if (world === 1) {
        return ['C4', 'E4', 'G4'];
      } else if (world === 2) {
        return ['E3', 'G3', 'B3'];
      } else if (world === 3) {
        const chords = [
          ['D4', 'F4', 'A4'],
          ['F4', 'A4', 'C5'],
          ['C4', 'E4', 'G4'],
          ['G4', 'B4', 'D5']
        ];
        return chords[Math.floor(row / 16) % chords.length];
      } else if (world === 4) {
        return ['A3', 'C4', 'E4'];
      } else {
        const chords = [
          ['F3', 'A3', 'C4', 'E4'],
          ['G3', 'B3', 'D4', 'F4'],
          ['A3', 'C4', 'E4', 'G4'],
          ['C4', 'E4', 'G4', 'B4']
        ];
        return chords[Math.floor(row / 16) % chords.length];
      }
    }

    getLeadPatternNote(world, pattern, row) {
      if (row % 4 !== 0) return null;
      const step = Math.floor(row / 4) % 16;
      if (world === 1) {
        const mel = ['C5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'A5', 'G5', 'E5'];
        return mel[step];
      } else if (world === 2) {
        const mel = ['E4', null, 'G4', 'F4', null, 'A4', 'B4', 'C5', null, 'B4', 'A4', 'G4', 'F4', null, 'E4', null];
        return mel[step];
      } else if (world === 3) {
        const mel = ['A4', 'D5', 'F5', 'E5', 'D5', 'C5', 'A4', 'G4', 'A4', 'C5', 'D5', 'F5', 'E5', 'D5', 'E5', 'D5'];
        return mel[step];
      } else if (world === 4) {
        const mel = ['A4', null, 'C5', 'D5', null, 'E5', 'G5', null, 'E5', 'D5', null, 'C5', 'A4', null, 'C5', null];
        return mel[step];
      } else {
        const mel = ['C5', 'D5', 'E5', 'G5', 'F5', 'E5', 'D5', 'C5', 'A4', 'C5', 'D5', 'F5', 'E5', 'G5', 'A5', 'C6'];
        return mel[step];
      }
    }

    // =========================================================================
    // SYNTHESIS ENGINES
    // =========================================================================

    // KICK DRUM (Sine pitch sweep + click)
    synthKick(time) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(145, time);
      osc.frequency.exponentialRampToValueAtTime(36, time + 0.08);

      gain.gain.setValueAtTime(0.85, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

      osc.connect(gain);
      gain.connect(this.stemGains[0]);
      osc.start(time);
      osc.stop(time + 0.2);
    }

    // SNARE DRUM (Body sine + bandpassed noise)
    synthSnare(time, snap = 1.0) {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(2000, time);
      bpf.Q.setValueAtTime(1.8, time);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.4 * snap, time);
      nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

      const body = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      body.frequency.setValueAtTime(220, time);
      body.frequency.exponentialRampToValueAtTime(95, time + 0.07);
      bGain.gain.setValueAtTime(0.35 * snap, time);
      bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      src.connect(bpf);
      bpf.connect(nGain);
      nGain.connect(this.stemGains[0]);

      body.connect(bGain);
      bGain.connect(this.stemGains[0]);

      src.start(time);
      src.stop(time + 0.16);
      body.start(time);
      body.stop(time + 0.1);
    }

    // HI-HAT (High-pass filtered noise)
    synthHiHat(time, open = false) {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(7500, time);

      const gain = this.ctx.createGain();
      const dur = open ? 0.28 : 0.045;
      gain.gain.setValueAtTime(0.22, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      src.connect(hpf);
      hpf.connect(gain);
      gain.connect(this.stemGains[0]);

      src.start(time);
      src.stop(time + dur);
    }

    // CRASH CYMBAL
    synthCrash(time) {
      if (!this.ctx || !this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bpf = this.ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(4500, time);
      bpf.Q.setValueAtTime(1.0, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(this.stemGains[4]);
      gain.connect(this.delaySendGain);

      src.start(time);
      src.stop(time + 1.2);
    }

    // TB-303 ACID BASS (Resonant lowpass sweep with accent & slide)
    synthAcidBass(freq, time, duration, accent = false, slide = false) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(accent ? 18 : 12, time);
      const cutoff = accent ? 3400 : 1600;
      filter.frequency.setValueAtTime(cutoff, time);
      filter.frequency.exponentialRampToValueAtTime(140, time + duration * 0.85);

      const vol = accent ? 0.38 : 0.24;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.stemGains[1]);

      osc.start(time);
      osc.stop(time + duration);
    }

    // SUB-BASS (Triangle / sine body)
    synthSubBass(freq, time, duration, world) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = (world === 1) ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.stemGains[1]);

      osc.start(time);
      osc.stop(time + duration);
    }

    // CHIPTUNE PULSE ARPEGGIO LEAD
    synthChipArp(freq, time, duration) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      const arpIntervals = [0, 4, 7, 12];
      const stepTime = 0.035;
      const steps = Math.floor(duration / stepTime);

      for (let i = 0; i < steps; i++) {
        const semi = arpIntervals[i % arpIntervals.length];
        const f = freq * Math.pow(2, semi / 12);
        osc.frequency.setValueAtTime(f, time + i * stepTime);
      }

      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.stemGains[3]);
      gain.connect(this.delaySendGain);

      osc.start(time);
      osc.stop(time + duration);
    }

    // ANALOG SYNTHWAVE LEAD (Detuned saws)
    synthAnalogLead(freq, time, duration) {
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.004, time); // detune +7 cents

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, time);
      filter.frequency.exponentialRampToValueAtTime(800, time + duration);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.stemGains[3]);
      gain.connect(this.delaySendGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    }

    // JUNGLE LEAD (Sine + Vibrato)
    synthJungleLead(freq, time, duration) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.stemGains[3]);
      gain.connect(this.delaySendGain);

      osc.start(time);
      osc.stop(time + duration);
    }

    // ORCHESTRAL BRASS LEAD
    synthBrassLead(freq, time, duration) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, time);
      filter.frequency.linearRampToValueAtTime(3000, time + 0.08); // brass swell
      filter.frequency.exponentialRampToValueAtTime(600, time + duration);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.stemGains[3]);
      gain.connect(this.delaySendGain);

      osc.start(time);
      osc.stop(time + duration);
    }

    // ACID LEAD
    synthAcidLead(freq, time, duration) {
      this.synthAcidBass(freq * 2, time, duration, true, false);
    }

    // LUSH PAD CHORD
    synthPadChord(noteNames, time, duration, world) {
      if (!this.ctx) return;
      noteNames.forEach(name => {
        const freq = NOTE_FREQ[name];
        if (!freq) return;

        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = (world === 1) ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.09, time + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.stemGains[2]);

        osc.start(time);
        osc.stop(time + duration);
      });
    }

    // FORMANT VOCAL SYNTHESIZER ("Oh no!" / "Let's go!")
    playFormantVocal(vowelType, pitch = 220) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      let f1 = 500, f2 = 900;
      if (vowelType === 'no') { f1 = 400; f2 = 1300; }
      if (vowelType === 'letsgo') { f1 = 650; f2 = 1800; }

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, now + 0.38);

      const bp1 = this.ctx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(f1, now);
      bp1.Q.setValueAtTime(6.0, now);

      const bp2 = this.ctx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(f2, now);
      bp2.Q.setValueAtTime(6.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(bp1);
      osc.connect(bp2);
      bp1.connect(gain);
      bp2.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.4);
    }

    // =========================================================================
    // SKILL INSTRUMENTS
    // =========================================================================

    // Climber: Plucked ascending notes
    playClimberChime(degreeIndex = 0) {
      if (!this.ctx) return;
      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];
      const noteName = scale.degrees[degreeIndex % scale.degrees.length] + (scale.baseOctave + 1);
      const freq = NOTE_FREQ[noteName] || 523.25;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    }

    // Floater: Soft pad swell
    playFloaterPad(degreeIndex = 0) {
      if (!this.ctx) return;
      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];
      const noteName = scale.degrees[degreeIndex % scale.degrees.length] + scale.baseOctave;
      const freq = NOTE_FREQ[noteName] || 329.63;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.45);
    }

    // Bomber: Crash cymbal + "Oh no!" formant drop
    playBomberDetonation() {
      if (!this.ctx) return;
      this.playFormantVocal('no', 180);
      this.synthCrash(this.ctx.currentTime);
    }

    // Blocker Drone: Sustained root drone on chord root
    startBlockerDrone() {
      if (!this.ctx) return;
      this.activeBlockersCount++;
      if (this.droneOsc) return;

      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];
      const rootName = scale.degrees[0] + (scale.baseOctave - 1);
      const freq = NOTE_FREQ[rootName] || 110;

      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      this.droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.droneGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc.start();
    }

    stopBlockerDrone() {
      this.activeBlockersCount = Math.max(0, this.activeBlockersCount - 1);
      if (this.activeBlockersCount === 0 && this.droneGain && this.droneOsc) {
        const now = this.ctx.currentTime;
        this.droneGain.gain.linearRampToValueAtTime(0.001, now + 0.4);
        setTimeout(() => {
          if (this.droneOsc && this.activeBlockersCount === 0) {
            try { this.droneOsc.stop(); } catch(e) {}
            this.droneOsc = null;
            this.droneGain = null;
          }
        }, 450);
      }
    }

    // Builder: Rising arpeggio note per brick laid
    playBuilderStep(brickIndex = 0) {
      if (!this.ctx) return;
      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];
      const deg = brickIndex % scale.degrees.length;
      const oct = scale.baseOctave + Math.floor(brickIndex / scale.degrees.length);
      const noteName = scale.degrees[deg] + Math.min(6, oct);
      const freq = NOTE_FREQ[noteName] || 440;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      gain.connect(this.delaySendGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);

      this.recordNoteEvent('builder', noteName, freq);
    }

    // Basher: Filtered resonant bass sweep
    playBasherSweep() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(14, now);
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.18);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.18);
    }

    // Miner: Crisp syncopated metallic clicks
    playMinerClick() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    }

    // Digger: Alternating kick & snare beat
    playDiggerBeat(step = 0) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (step % 2 === 0) {
        this.synthKick(now);
      } else {
        this.synthSnare(now, 0.75);
      }
    }

    // Exit Door: Triumphant rising arpeggio chord
    playExitChime() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];
      const notes = [
        scale.degrees[0] + '4',
        scale.degrees[1 % scale.degrees.length] + '4',
        scale.degrees[2 % scale.degrees.length] + '4',
        scale.degrees[0] + '5'
      ];

      notes.forEach((name, i) => {
        const freq = NOTE_FREQ[name] || 440;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.25, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.delaySendGain);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.35);
      });
    }

    // Groove Bonus Jingle: Sparkle sound on perfect beat timing
    playGrooveBonus() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [880, 1174, 1318, 1760].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.04);

        gain.gain.setValueAtTime(0.2, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.delaySendGain);

        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.2);
      });
    }

    // =========================================================================
    // QUANTIZED FOOTSTEPS ENGINE
    // =========================================================================
    queueFootstep(degree, octave) {
      if (this.queuedFootsteps.length < 8) {
        this.queuedFootsteps.push({ degree, octave });
      }
    }

    processQueuedFootsteps(time) {
      if (!this.queuedFootsteps.length || !this.ctx) return;
      const scale = WORLD_SCALES[this.currentWorld] || WORLD_SCALES[1];

      // Polyphony limiter: max 3 simultaneous steps
      const stepsToPlay = this.queuedFootsteps.splice(0, 3);
      const volScale = 1.0 / Math.sqrt(stepsToPlay.length);

      stepsToPlay.forEach((step, idx) => {
        const deg = (step.degree - 1) % scale.degrees.length;
        const oct = Math.max(2, Math.min(5, scale.baseOctave + step.octave));
        const noteName = scale.degrees[deg] + oct;
        const freq = NOTE_FREQ[noteName] || 330;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + idx * 0.015);

        gain.gain.setValueAtTime(0.12 * volScale, time + idx * 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.015 + 0.12);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time + idx * 0.015);
        osc.stop(time + idx * 0.015 + 0.12);

        this.recordNoteEvent('footstep', noteName, freq);
      });
    }

    // Groove Bonus Window Check (+/- 75ms of beat)
    checkOnBeat() {
      if (!this.ctx) return false;
      const bpm = this.getEffectiveBpm();
      const beatDuration = 60.0 / bpm;
      const currentTime = this.ctx.currentTime;
      const beatFraction = (currentTime % beatDuration) / beatDuration;
      return (beatFraction < 0.15 || beatFraction > 0.85);
    }

    // Record note event for results screen song replay
    recordNoteEvent(type, noteName, freq) {
      this.recordedNotes.push({
        time: this.ctx ? this.ctx.currentTime : 0,
        type,
        noteName,
        freq
      });
      if (this.recordedNotes.length > 500) {
        this.recordedNotes.shift();
      }
    }
  }

  global.BeatTribeAudioEngine = BeatTribeAudioEngine;
  global.WORLD_SCALES = WORLD_SCALES;
  global.NOTE_FREQ = NOTE_FREQ;

})(typeof window !== 'undefined' ? window : global);
