/**
 * Lemmings: Beat Tribe — Real-Time Web Audio Tracker, Synth & Quantizer (audio.js)
 *
 * Features:
 * - Sample-accurate AudioContext.currentTime lookahead scheduler (zero setTimeout note timing)
 * - 5 Genre Worlds x 4 chained 64-step patterns across 5 Gain-controlled Stems
 *   (DRUMS -> BASS -> CHORDS -> LEAD -> FULL MIX unlocked every 20% saved)
 * - Quantized 1/16 & 1/8 Footstep Sequencer with per-note voice limiting & velocity scaling
 * - 8 Distinct Skill Instruments (Climber pluck, Floater pad, Bomber crash + "Oh no!" formant,
 *   Blocker sustained root drone, Builder rising arpeggio, Basher filter sweep, Miner clicks, Digger kick/snare)
 * - Formant-filtered "Let's go!" and "Oh no!" vocal stabs
 * - Stereo Ping-Pong Delay bus, Master DynamicsCompressorNode, and real-time AnalyserNode
 * - Composed Song Recorder & Results-Screen Replayer
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const TerrainMod = BeatTribe.Terrain || (typeof require !== 'undefined' ? require('./terrain.js') : null);
  const WORLD_THEMES = TerrainMod ? TerrainMod.WORLD_THEMES : {};

  const STEM_NAMES = ['DRUMS', 'BASS', 'CHORDS', 'LEAD', 'FULL MIX'];
  const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function midiToTrackerStr(midi) {
    if (midi == null || midi <= 0) return '---';
    const n = Math.round(midi);
    const name = NOTE_NAMES[((n % 12) + 12) % 12];
    const oct = Math.floor(n / 12) - 1;
    return name + oct;
  }

  // Generate 4 chained 64-step tracker patterns per World (1..5)
  function buildWorldSong(worldId) {
    const theme = WORLD_THEMES[worldId] || {
      rootMidi: 48,
      scaleOffsets: [0, 2, 4, 7, 9],
      bpm: 124
    };
    const root = theme.rootMidi;
    const sc = theme.scaleOffsets;
    const degToMidi = (deg, oct = 0) => {
      const len = sc.length;
      const octShift = Math.floor(deg / len);
      const idx = ((deg % len) + len) % len;
      return root + (oct + octShift) * 12 + sc[idx];
    };

    // Each pattern has 64 rows; each row has { drum, bass, chord, lead, full }
    const patterns = [];
    // Chord degree progressions per pattern (4 bars x 16 steps = 64 steps)
    const barRootsByPattern = [
      [0, 0, 3, 4],
      [0, 2, 3, 4],
      [3, 2, 1, 4],
      [0, 4, 2, 3]
    ];

    for (let p = 0; p < 4; p++) {
      const rows = new Array(64);
      const barProg = barRootsByPattern[p];

      for (let s = 0; s < 64; s++) {
        const bar = s >> 4;
        const stepInBar = s & 15;
        const barDeg = barProg[bar];

        let drum = null;
        let bass = null;
        let chord = null;
        let lead = null;
        let full = null;

        if (worldId === 1) {
          // WORLD 1: Amiga Chip Garden (124 BPM, bouncy 4-ch chiptune)
          if (stepInBar === 0 || stepInBar === 8 || (p >= 2 && stepInBar === 10)) drum = 'K';
          else if (stepInBar === 4 || stepInBar === 12) drum = 'S';
          else if ((stepInBar & 1) === 0) drum = 'H';
          else if (p >= 1 && stepInBar === 15) drum = 'O';

          // Bouncy octave chip bass
          if (stepInBar % 2 === 0) {
            const oct = (stepInBar % 4 === 2) ? 1 : 0;
            const walk = (stepInBar === 14) ? barDeg + 1 : barDeg;
            bass = { midi: degToMidi(walk, oct), dur: 0.14 };
          }

          // Amiga 0-4-7 fast chord arpeggio stabs on quarter/syncopated steps
          if (stepInBar === 0 || stepInBar === 6 || stepInBar === 12) {
            chord = {
              midis: [degToMidi(barDeg, 1), degToMidi(barDeg + 2, 1), degToMidi(barDeg + 4, 1)],
              dur: 0.34,
              arp: true
            };
          }

          // Cheerful demoscene square PWM lead
          const leadMotif = [0, -1, 2, 4, 2, -1, 3, 2, 4, -1, 5, 4, 2, -1, 1, 0];
          const m = leadMotif[(stepInBar + p * 2) & 15];
          if (m >= 0 && (p > 0 || bar % 2 === 0 || stepInBar < 12)) {
            lead = { midi: degToMidi(barDeg + m, 2), dur: 0.18 };
          }

          // Full-mix sparkling high counter-arp
          if ((stepInBar & 1) === 1) {
            full = { midi: degToMidi(barDeg + ((stepInBar * 2 + p) % 5), 3), dur: 0.1 };
          }
        } else if (worldId === 2) {
          // WORLD 2: Acid Warehouse (132 BPM, driving 909 four-on-the-floor + squelchy TB-303)
          if (stepInBar % 4 === 0) drum = 'K';
          else if (stepInBar % 4 === 2) drum = 'O';
          else if (stepInBar === 4 || stepInBar === 12) drum = 'S';
          else drum = 'H';
          if (stepInBar === 4 || stepInBar === 12) drum = 'KS'; // 909 kick+snare slam!

          // Hypnotic Phrygian 16th-note TB-303 squelch line with accents & slides!
          const acidDegs = [0, 0, 1, 0, 4, 1, 0, 6, 0, 1, 3, 1, 5, 4, 1, 0];
          const accents  = [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0];
          const octs     = [0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0];
          const d = acidDegs[(stepInBar + p) & 15];
          bass = {
            midi: degToMidi(barDeg + d, octs[stepInBar]),
            dur: 0.13,
            accent: !!accents[stepInBar],
            slide: (stepInBar % 3 === 1)
          };

          // Warehouse minor/Phrygian rave stabs
          if (stepInBar === 0 || stepInBar === 3 || stepInBar === 10) {
            chord = {
              midis: [degToMidi(barDeg, 1), degToMidi(barDeg + 2, 1), degToMidi(barDeg + 4, 1)],
              dur: 0.25
            };
          }

          // Acid warehouse FM synth hook
          if (stepInBar === 2 || stepInBar === 6 || stepInBar === 9 || stepInBar === 14) {
            lead = { midi: degToMidi(barDeg + ((stepInBar + p) % 5), 2), dur: 0.2 };
          }

          if (stepInBar % 2 === 0) {
            full = { midi: degToMidi(barDeg + (stepInBar >> 1), 2), dur: 0.11 };
          }
        } else if (worldId === 3) {
          // WORLD 3: Synthwave Sunset (118 BPM, gated snare + rolling analog bass + lush Dorian pads)
          if (stepInBar === 0 || stepInBar === 8 || (stepInBar === 14 && bar === 3)) drum = 'K';
          else if (stepInBar === 4 || stepInBar === 12) drum = 'S';
          else if (stepInBar % 2 === 0) drum = 'H';
          else if (stepInBar === 15) drum = 'O';

          // Driving 16th rolling Synthwave bass
          const oct = (stepInBar & 1) ? 1 : 0;
          bass = { midi: degToMidi(barDeg, oct), dur: 0.14 };

          // Wide lush sustained Dorian analog pad on bar start
          if (stepInBar === 0) {
            chord = {
              midis: [
                degToMidi(barDeg, 1),
                degToMidi(barDeg + 2, 1),
                degToMidi(barDeg + 4, 1),
                degToMidi(barDeg + 6, 1)
              ],
              dur: 1.85
            };
          }

          // Soaring 80s analog brassy lead melody
          const swLead = [4, -1, -1, 5, 6, -1, 4, -1, 2, -1, 3, 4, -1, 2, 0, -1];
          const sl = swLead[(stepInBar + p * 4) & 15];
          if (sl >= 0) {
            lead = { midi: degToMidi(barDeg + sl, 2), dur: 0.36 };
          }

          // Shimmering bell arpeggio
          const arpCycle = [0, 2, 4, 6, 4, 2, 4, 6];
          if (stepInBar % 2 === 0) {
            full = { midi: degToMidi(barDeg + arpCycle[(stepInBar >> 1) & 7], 3), dur: 0.16 };
          }
        } else if (worldId === 4) {
          // WORLD 4: Jungle Breakbeat Caves (156 BPM, chopped Amen break + deep 808 sub + ethereal pads)
          // Classic Jungle syncopated breakbeat: K . H . S . g K . g K H S . H g
          const amen = ['K', 'H', 'H', 'g', 'S', 'H', 'g', 'K', 'H', 'g', 'K', 'H', 'S', 'O', 'H', 'g'];
          const amenVar = ['K', 'H', 'K', 'H', 'S', 'g', 'H', 'g', 'H', 'K', 'S', 'H', 'g', 'S', 'O', 'g'];
          drum = (bar === 3 || p === 3) ? amenVar[stepInBar] : amen[stepInBar];

          // Deep sustained 808 sub-bass drops
          if (stepInBar === 0 || stepInBar === 10) {
            bass = { midi: degToMidi(barDeg, 0), dur: 0.55, sub: true };
          } else if (stepInBar === 14 && bar % 2 === 1) {
            bass = { midi: degToMidi(barDeg + 3, 0), dur: 0.25, sub: true };
          }

          // Atmospheric floating jungle cavern pads
          if (stepInBar === 0) {
            chord = {
              midis: [degToMidi(barDeg, 1), degToMidi(barDeg + 2, 1), degToMidi(barDeg + 3, 2)],
              dur: 1.5
            };
          }

          // Echoing crystal cave pluck lead
          if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || stepInBar === 12) {
            lead = { midi: degToMidi(barDeg + ((stepInBar + p * 2) % 5), 2), dur: 0.22 };
          }

          if (stepInBar % 4 === 2) {
            full = { midi: degToMidi(barDeg + 4, 3), dur: 0.18 };
          }
        } else {
          // WORLD 5: Grand Orchestral Finale (120 BPM, Lydian #4 symphonic triumph!)
          if (stepInBar === 0 || stepInBar === 12) drum = 'K'; // Concert Timpani!
          else if (stepInBar === 6 && bar >= 2) drum = 'K';
          else if (stepInBar === 4 || stepInBar === 8 || stepInBar === 14) drum = 'S'; // Snare march
          else if (stepInBar === 0 && bar === 0) drum = 'O';

          // Orchestral Contrabass + Tuba foundation
          if (stepInBar === 0 || stepInBar === 8 || stepInBar === 12) {
            bass = {
              midi: degToMidi(stepInBar === 12 ? barDeg + 4 : barDeg, 0),
              dur: stepInBar === 0 ? 0.65 : 0.3
            };
          }

          // Symphonic String Ensemble swells (featuring Lydian raised 4th = degree 3!)
          if (stepInBar === 0 || stepInBar === 8) {
            chord = {
              midis: [
                degToMidi(barDeg, 1),
                degToMidi(barDeg + 2, 1),
                degToMidi(barDeg + 3, 1),
                degToMidi(barDeg + 4, 2)
              ],
              dur: 0.95
            };
          }

          // Heroic French Horn / Solo Violin Lydian fanfare
          const sympLead = [0, -1, 2, -1, 3, 4, 6, -1, 4, -1, 3, 2, 4, -1, 7, -1];
          const sl = sympLead[(stepInBar + p * 2) & 15];
          if (sl >= 0) {
            lead = { midi: degToMidi(barDeg + sl, 2), dur: 0.34 };
          }

          // Harp glissando across every 16th!
          const harp = [0, 2, 3, 4, 6, 7, 9, 11, 9, 7, 6, 4, 3, 2, 4, 6];
          full = { midi: degToMidi(barDeg + harp[stepInBar], 2), dur: 0.16 };
        }

        rows[s] = { drum, bass, chord, lead, full };
      }
      patterns.push(rows);
    }

    return {
      worldId,
      bpm: theme.bpm,
      rootMidi: root,
      scaleOffsets: sc,
      order: [0, 1, 2, 3],
      patterns
    };
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.initialized = false;
      this.masterMuted = false;
      this.paused = false;
      this.speedMultiplier = 1.0;

      // Song & Tracker state
      this.worldId = 1;
      this.song = buildWorldSong(1);
      this.currentOrderIdx = 0;
      this.currentRow = 0;
      this.totalStepsPlayed = 0;
      this.nextStepTime = 0;
      this.lastStepDuration = 0.12;
      this.schedulerTimer = null;

      // Stem unlock & mixer state: [DRUMS, BASS, CHORDS, LEAD, FULL MIX]
      this.savedRatio = 0;
      this.stemUnlocked = [false, false, false, false, false];
      this.stemMuted = [false, false, false, false, false];
      this.stemSolo = [false, false, false, false, false];
      this.stemMeters = [0, 0, 0, 0, 0];

      // Quantized footstep & note queue mapped by target step
      this.quantQueue = new Map(); // stepNumber -> Array<{ midi, degree, pan, vel }>

      // Active Blocker chord-root drone state
      this.droneNodes = null;
      this.blockerCount = 0;

      // Composed Song Recorder & Results Replay state
      this.recording = true;
      this.composedEvents = []; // { step, timeSec, midi, degree, kind, dur }
      this.levelStartStep = 0;
      this.simStepHint = 0;
      this.replaying = false;
      this.replayIndex = 0;
      this.replayStartStep = 0;
      this.replayTotalSteps = 64;

      // Reusable Analyser typed arrays (safe fallback before AudioContext starts)
      this.freqData = new Uint8Array(64);
      this.waveData = new Uint8Array(64);
      this.waveData.fill(128);
    }

    init() {
      if (this.initialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return true;
      }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;

      try {
        this.ctx = new AC();
      } catch (e) {
        return false;
      }

      const ctx = this.ctx;

      // Master Chain: MixBus -> MasterCompressor -> MasterGain -> Analyser -> Destination
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.masterMuted ? 0 : 0.82;

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.72;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveData = new Uint8Array(this.analyser.frequencyBinCount);

      this.mixBus = ctx.createGain();
      this.mixBus.gain.value = 0.9;

      // Stereo Ping-Pong Delay Bus
      this.delaySend = ctx.createGain();
      this.delaySend.gain.value = 0.24;
      const delayL = ctx.createDelay(1.0);
      const delayR = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.185;
      delayR.delayTime.value = 0.275;
      const fbL = ctx.createGain();
      const fbR = ctx.createGain();
      fbL.gain.value = 0.34;
      fbR.gain.value = 0.34;
      const delayLPF = ctx.createBiquadFilter();
      delayLPF.type = 'lowpass';
      delayLPF.frequency.value = 2800;
      const merger = ctx.createChannelMerger(2);

      this.delaySend.connect(delayLPF);
      delayLPF.connect(delayL);
      delayL.connect(delayR);
      delayR.connect(fbL);
      fbL.connect(delayL);
      delayL.connect(merger, 0, 0);
      delayR.connect(merger, 0, 1);
      merger.connect(this.mixBus);

      // Base Pulse Gain (subtle tempo pulse at 0% saved so beat is always felt!)
      this.pulseGain = ctx.createGain();
      this.pulseGain.gain.value = 0.32;
      this.pulseGain.connect(this.mixBus);

      // 5 Stem Channel Groups
      this.stemGains = STEM_NAMES.map(() => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(this.mixBus);
        return g;
      });

      // Live Gameplay SFX / Footsteps / Skill Instruments Bus
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.88;
      this.sfxBus.connect(this.mixBus);

      this.mixBus.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      // Build procedural noise buffer (1.5s white + metallic)
      const len = Math.floor(ctx.sampleRate * 1.5);
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let s = 0x12345678;
      for (let i = 0; i < len; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        data[i] = (s / 0xffffffff) * 2 - 1;
      }

      this.initialized = true;
      this.nextStepTime = ctx.currentTime + 0.04;
      this.updateStemGains();
      this.startScheduler();
      return true;
    }

    startScheduler() {
      if (this.schedulerTimer) clearInterval(this.schedulerTimer);
      const LOOKAHEAD_SEC = 0.10;
      this.schedulerTimer = setInterval(() => {
        if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
        if (this.paused) {
          this.nextStepTime = this.ctx.currentTime + 0.04;
          return;
        }
        const now = this.ctx.currentTime;
        if (this.nextStepTime < now - 0.15) {
          this.nextStepTime = now + 0.02;
        }
        while (this.nextStepTime < now + LOOKAHEAD_SEC) {
          this.scheduleTrackerStep(this.nextStepTime);
          const bpm = this.song.bpm * this.speedMultiplier;
          const stepDur = 60 / (bpm * 4);
          this.lastStepDuration = stepDur;
          this.nextStepTime += stepDur;
          this.totalStepsPlayed++;
          this.currentRow++;
          if (this.currentRow >= 64) {
            this.currentRow = 0;
            this.currentOrderIdx = (this.currentOrderIdx + 1) % this.song.order.length;
          }
        }
      }, 22);
    }

    setWorld(worldId, resetSong = true) {
      this.worldId = worldId;
      this.song = buildWorldSong(worldId);
      if (resetSong) {
        this.currentOrderIdx = 0;
        this.currentRow = 0;
        this.quantQueue.clear();
        this.stopBlockerDrone();
      }
      this.updateStemGains();
    }

    startLevelRecording(worldId) {
      this.replaying = false;
      this.recording = true;
      this.composedEvents = [];
      this.savedRatio = 0;
      this.simStepHint = 0;
      this.stemUnlocked = [false, false, false, false, false];
      this.setWorld(worldId, true);
      this.levelStartStep = this.totalStepsPlayed;
    }

    setSimFrame(frame) {
      const framesPerStep = Math.max(4, 3600 / (this.song.bpm * 4));
      this.simStepHint = Math.floor(frame / framesPerStep);
    }

    // Update unlocked stems based on % of total tribe saved (every 20% unlocks next stem!)
    setSavedPercentage(pct0to100) {
      this.savedRatio = Math.max(0, Math.min(100, pct0to100));
      const thresholds = [20, 40, 60, 80, 100];
      let newlyUnlocked = -1;
      for (let i = 0; i < 5; i++) {
        const shouldUnlock = (pct0to100 + 0.001) >= thresholds[i];
        if (shouldUnlock && !this.stemUnlocked[i]) {
          this.stemUnlocked[i] = true;
          newlyUnlocked = i;
        }
      }
      this.updateStemGains();
      return newlyUnlocked; // -1 or stem index 0..4
    }

    updateStemGains() {
      if (!this.initialized || !this.stemGains) return;
      const now = this.ctx.currentTime;
      const anySolo = this.stemSolo.some(Boolean);
      for (let i = 0; i < 5; i++) {
        let active = this.stemUnlocked[i];
        // Allow manual Solo in the [T] Stem Mixer even before unlock so players can audition!
        if (anySolo) {
          active = this.stemSolo[i];
        } else if (this.stemMuted[i]) {
          active = false;
        }
        const target = active ? 0.85 : 0.0;
        this.stemGains[i].gain.cancelScheduledValues(now);
        this.stemGains[i].gain.setTargetAtTime(target, now, 0.08);
      }
    }

    toggleMute() {
      this.masterMuted = !this.masterMuted;
      if (this.initialized && this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.masterMuted ? 0 : 0.82, this.ctx.currentTime, 0.02);
      }
      return this.masterMuted;
    }

    toggleStemMute(idx) {
      if (idx >= 0 && idx < 5) {
        this.stemMuted[idx] = !this.stemMuted[idx];
        this.updateStemGains();
      }
    }

    toggleStemSolo(idx) {
      if (idx >= 0 && idx < 5) {
        this.stemSolo[idx] = !this.stemSolo[idx];
        this.updateStemGains();
      }
    }

    setPaused(paused) {
      this.paused = !!paused;
      if (this.droneNodes && this.ctx) {
        this.droneNodes.gain.gain.setTargetAtTime(
          this.paused ? 0.0 : 0.14,
          this.ctx.currentTime,
          0.05
        );
      }
    }

    setSpeedMultiplier(mult) {
      this.speedMultiplier = mult > 1 ? 2.0 : 1.0;
    }

    // Beat phase 0..1 within current quarter note (4 tracker 16th steps = 1 beat)
    getBeatPhase(simFrameFallback = 0) {
      if (!this.initialized || !this.ctx || this.ctx.state !== 'running' || this.paused) {
        const framesPerBeat = Math.max(12, Math.round((60 / this.song.bpm) * 60));
        return (simFrameFallback % framesPerBeat) / framesPerBeat;
      }
      const stepDur = this.lastStepDuration || 0.12;
      const fracInStep = 1 - Math.max(0, Math.min(1, (this.nextStepTime - this.ctx.currentTime) / stepDur));
      const stepInBeat = (this.currentRow & 3) + fracInStep;
      return (stepInBeat % 4) / 4;
    }

    getTrackerSnapshot() {
      const patIdx = this.song.order[this.currentOrderIdx] || 0;
      return {
        worldId: this.worldId,
        bpm: Math.round(this.song.bpm * this.speedMultiplier),
        orderIdx: this.currentOrderIdx,
        patternIdx: patIdx,
        row: this.currentRow,
        patterns: this.song.patterns,
        stemNames: STEM_NAMES,
        stemUnlocked: this.stemUnlocked,
        stemMuted: this.stemMuted,
        stemSolo: this.stemSolo,
        stemMeters: this.stemMeters,
        midiToTrackerStr
      };
    }

    sampleAnalyser() {
      // Decay visual stem meters smoothly
      for (let i = 0; i < 5; i++) {
        this.stemMeters[i] *= 0.88;
      }
      if (this.initialized && this.analyser && !this.paused && !this.masterMuted) {
        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getByteTimeDomainData(this.waveData);
      } else {
        this.freqData.fill(0);
        this.waveData.fill(128);
      }
      return { freq: this.freqData, wave: this.waveData };
    }

    // =======================================================================
    // TRACKER STEP SCHEDULER (Sample-accurate on AudioContext.currentTime)
    // =======================================================================
    scheduleTrackerStep(time) {
      const patIdx = this.song.order[this.currentOrderIdx] || 0;
      const rowObj = this.song.patterns[patIdx][this.currentRow];
      const stepDur = 60 / (this.song.bpm * this.speedMultiplier * 4);
      const anySolo = this.stemSolo.some(Boolean);
      const isStemAudible = i => anySolo ? this.stemSolo[i] : (this.stemUnlocked[i] && !this.stemMuted[i]);

      // Subtle quarter-note heartbeat pulse when DRUMS stem is still locked so tempo is unmistakable
      if (!isStemAudible(0) && (this.currentRow & 3) === 0 && !anySolo) {
        this.synthHat(time, false, this.pulseGain, 0.22);
        if ((this.currentRow & 7) === 0) {
          this.synthKick(time, this.pulseGain, 0.35);
        }
      }

      if (rowObj) {
        // STEM 0: DRUMS
        if (rowObj.drum) {
          if (isStemAudible(0)) this.stemMeters[0] = 1.0;
          const dest = this.stemGains[0];
          const d = rowObj.drum;
          if (d === 'K' || d === 'KS') this.synthKick(time, dest, 0.85);
          if (d === 'S' || d === 'KS') this.synthSnare(time, dest, 0.72);
          if (d === 'g') this.synthSnare(time, dest, 0.28); // Jungle ghost snare
          if (d === 'H') this.synthHat(time, false, dest, 0.36);
          if (d === 'O') this.synthHat(time, true, dest, 0.44);
        }

        // STEM 1: BASS
        if (rowObj.bass) {
          if (isStemAudible(1)) this.stemMeters[1] = 0.95;
          this.synthBass(time, rowObj.bass, this.stemGains[1]);
        }

        // STEM 2: CHORDS
        if (rowObj.chord) {
          if (isStemAudible(2)) this.stemMeters[2] = 0.85;
          this.synthChord(time, rowObj.chord, this.stemGains[2], stepDur);
        }

        // STEM 3: LEAD
        if (rowObj.lead) {
          if (isStemAudible(3)) this.stemMeters[3] = 0.9;
          this.synthLead(time, rowObj.lead.midi, rowObj.lead.dur, this.stemGains[3], true);
        }

        // STEM 4: FULL MIX
        if (rowObj.full) {
          if (isStemAudible(4)) this.stemMeters[4] = 0.9;
          this.synthArpPluck(time, rowObj.full.midi, rowObj.full.dur, this.stemGains[4], 0.26);
        }
      }

      // Flush Quantized Footstep Queue for this 1/16 step (with Voice Limiting & Velocity Scaling!)
      const bucket = this.quantQueue.get(this.totalStepsPlayed);
      if (bucket && bucket.length > 0) {
        this.quantQueue.delete(this.totalStepsPlayed);
        // Group identical MIDI pitches and limit max simultaneous voices to 4
        const byMidi = new Map();
        for (const ev of bucket) {
          const prev = byMidi.get(ev.midi);
          if (prev) {
            prev.count++;
            prev.pan = (prev.pan + ev.pan) * 0.5;
          } else {
            byMidi.set(ev.midi, { midi: ev.midi, degree: ev.degree, pan: ev.pan, count: 1 });
          }
        }
        const uniqueNotes = Array.from(byMidi.values()).slice(0, 4);
        const crowdScale = 1 / Math.sqrt(Math.max(1, bucket.length * 0.75));
        for (const n of uniqueNotes) {
          const vel = Math.min(0.32, (0.19 + Math.min(3, n.count) * 0.04) * crowdScale);
          this.synthFootstepTone(time, n.midi, vel, n.pan);
        }
      }

      // Results-screen Composed Song Replay playback!
      if (this.replaying && this.composedEvents.length > 0) {
        const relStep = (this.totalStepsPlayed - this.replayStartStep) % Math.max(16, this.replayTotalSteps);
        if (relStep === 0) this.replayIndex = 0;
        while (
          this.replayIndex < this.composedEvents.length &&
          this.composedEvents[this.replayIndex].step <= relStep
        ) {
          const ev = this.composedEvents[this.replayIndex++];
          if (ev.step === relStep) {
            this.triggerReplayEvent(time, ev);
          }
        }
      }
    }

    // =======================================================================
    // QUANTIZED FOOTSTEPS & RECORDING LOG
    // =======================================================================
    recordComposedEvent(midi, degree, kind, dur = 0.16) {
      if (!this.recording || this.replaying) return;
      if (this.composedEvents.length >= 1600) return;
      const audioStep = Math.max(0, this.totalStepsPlayed - this.levelStartStep);
      const relStep = Math.max(audioStep, this.simStepHint);
      // Avoid recording more than 3 identical-step footstep events so visualizer stays crisp
      if (kind === 'step') {
        let sameStepCount = 0;
        for (let i = this.composedEvents.length - 1; i >= 0 && i >= this.composedEvents.length - 6; i--) {
          if (this.composedEvents[i].step === relStep && this.composedEvents[i].midi === midi) {
            sameStepCount++;
          }
        }
        if (sameStepCount > 0) return;
      }
      this.composedEvents.push({ step: relStep, midi, degree, kind, dur });
    }

    queueFootstep(midi, degree = 0, panX = 0) {
      // Always log into the composed song even if AudioContext isn't resumed yet!
      this.recordComposedEvent(midi, degree, 'step', 0.14);
      if (!this.initialized || this.paused) return;

      // Quantize to the NEXT 1/16th or 1/8th step of the global song clock!
      const quantGrid = (this.worldId === 4) ? 1 : 2; // 1/16 in fast Jungle, tight 1/8-ish/1/16 groove
      const nextStep = Math.ceil((this.totalStepsPlayed + 1) / quantGrid) * quantGrid;
      let list = this.quantQueue.get(nextStep);
      if (!list) {
        list = [];
        this.quantQueue.set(nextStep, list);
      }
      if (list.length < 24) {
        list.push({ midi, degree, pan: Math.max(-0.85, Math.min(0.85, panX)) });
      }
    }

    // =======================================================================
    // SYNTHESIS VOICES (Zero Samples, Pure Web Audio Nodes)
    // =======================================================================
    makePan(panVal) {
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, panVal || 0));
        return p;
      }
      return this.ctx.createGain();
    }

    synthKick(time, dest, amp = 0.8) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = (this.worldId === 5) ? 'triangle' : 'sine';

      const startF = (this.worldId === 2) ? 168 : (this.worldId === 5 ? 98 : 142);
      const endF = (this.worldId === 5) ? 46 : 36;
      const dur = (this.worldId === 5) ? 0.34 : 0.19;

      osc.frequency.setValueAtTime(startF, time);
      osc.frequency.exponentialRampToValueAtTime(endF, time + dur * 0.75);

      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    }

    synthSnare(time, dest, amp = 0.65) {
      const ctx = this.ctx;
      // Pitched body
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, time);
      body.frequency.exponentialRampToValueAtTime(95, time + 0.09);
      bodyGain.gain.setValueAtTime(amp * 0.55, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      body.connect(bodyGain);
      bodyGain.connect(dest);
      body.start(time);
      body.stop(time + 0.11);

      // Noise snap (Synthwave World 3 gets iconic gated-reverb envelope!)
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = (this.worldId === 1) ? 900 : 1400;
      const nGain = ctx.createGain();
      const dur = (this.worldId === 3) ? 0.21 : 0.13;

      nGain.gain.setValueAtTime(amp * 0.65, time);
      if (this.worldId === 3) {
        // Gated reverb plateau then abrupt gate close
        nGain.gain.setValueAtTime(amp * 0.46, time + 0.14);
        nGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      } else {
        nGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      }
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(dest);
      noise.start(time, (time * 13) % 0.8);
      noise.stop(time + dur + 0.02);
    }

    synthHat(time, isOpen, dest, amp = 0.32) {
      const ctx = this.ctx;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6200;
      const gain = ctx.createGain();
      const dur = isOpen ? 0.19 : 0.045;
      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      noise.start(time, (time * 19) % 0.9);
      noise.stop(time + dur + 0.01);
    }

    synthBass(time, noteObj, dest) {
      const ctx = this.ctx;
      const freq = midiToFreq(noteObj.midi);
      const dur = noteObj.dur || 0.16;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      if (this.worldId === 2) {
        // Authentic TB-303 Resonant Acid Bass!
        osc.type = noteObj.accent ? 'sawtooth' : 'square';
        filter.type = 'lowpass';
        filter.Q.value = noteObj.accent ? 14.5 : 9.5;
        const peakCut = noteObj.accent ? freq * 9.5 : freq * 4.8;
        filter.frequency.setValueAtTime(peakCut, time);
        filter.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 1.3), time + dur * 0.88);
      } else if (this.worldId === 4 || noteObj.sub) {
        // Jungle deep 808 sub-bass
        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.value = 260;
      } else if (this.worldId === 1) {
        osc.type = 'square';
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
      } else {
        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.Q.value = 3.0;
        filter.frequency.setValueAtTime(freq * 4.2, time);
        filter.frequency.exponentialRampToValueAtTime(freq * 1.6, time + dur);
      }

      osc.frequency.setValueAtTime(freq, time);
      const peakGain = noteObj.accent ? 0.42 : 0.30;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(peakGain, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    }

    synthChord(time, chordObj, dest, stepDur) {
      const ctx = this.ctx;
      const midis = chordObj.midis;
      const dur = chordObj.dur || 0.5;

      if (chordObj.arp) {
        // Classic Amiga tracker rapid 50Hz chord arpeggio!
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const ticks = Math.max(3, Math.floor(dur / 0.035));
        for (let i = 0; i < ticks; i++) {
          osc.frequency.setValueAtTime(midiToFreq(midis[i % midis.length]), time + i * 0.035);
        }
        gain.gain.setValueAtTime(0.14, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + dur + 0.02);
        return;
      }

      // Warm detuned polyphonic pad
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = (this.worldId === 5) ? 2400 : 1850;
      const gain = ctx.createGain();
      const atk = Math.min(0.12, dur * 0.25);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.13, time + atk);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      filter.connect(gain);
      gain.connect(dest);
      gain.connect(this.delaySend);

      for (let i = 0; i < midis.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = (this.worldId === 4) ? 'triangle' : 'sawtooth';
        osc.frequency.value = midiToFreq(midis[i]);
        osc.detune.value = (i % 2 === 0 ? -7 : 7);
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + dur + 0.03);
      }
    }

    synthLead(time, midi, dur = 0.24, dest = null, useDelay = true) {
      const ctx = this.ctx;
      const out = dest || this.sfxBus;
      const freq = midiToFreq(midi);

      // 2-Operator FM + Subtractive hybrid lead
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      carrier.type = (this.worldId === 1) ? 'square' : (this.worldId === 3 ? 'sawtooth' : 'triangle');
      carrier.frequency.setValueAtTime(freq, time);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * (this.worldId === 2 ? 3.0 : 2.0), time);
      modGain.gain.setValueAtTime(freq * (this.worldId === 1 ? 0.2 : 1.1), time);
      modGain.gain.exponentialRampToValueAtTime(1.0, time + dur * 0.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.19, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      if (useDelay) gain.connect(this.delaySend);

      mod.start(time);
      carrier.start(time);
      mod.stop(time + dur + 0.02);
      carrier.stop(time + dur + 0.02);
    }

    synthArpPluck(time, midi, dur = 0.14, dest = null, amp = 0.22, panVal = 0) {
      const ctx = this.ctx;
      const out = dest || this.sfxBus;
      const freq = midiToFreq(midi);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = this.makePan(panVal);

      osc.type = (this.worldId === 1) ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 5, time);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.4, time + dur);

      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(out);
      gain.connect(this.delaySend);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    }

    synthFootstepTone(time, midi, amp = 0.18, panVal = 0) {
      const ctx = this.ctx;
      // Transpose footstep into sweet melodic mid-high register (+12 semitones)
      const freq = midiToFreq(Math.min(88, midi + 12));
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = this.makePan(panVal);

      const waveTypes = { 1: 'square', 2: 'sawtooth', 3: 'sawtooth', 4: 'sine', 5: 'triangle' };
      osc.type = waveTypes[this.worldId] || 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.Q.value = (this.worldId === 2) ? 6.0 : 2.0;
      filter.frequency.setValueAtTime(freq * 4.2, time);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.2, time + 0.11);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(amp, time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.sfxBus);
      gain.connect(this.delaySend);
      osc.start(time);
      osc.stop(time + 0.13);
    }

    // =======================================================================
    // FORMANT-FILTERED VOCAL STABS: "LET'S GO!" & "OH NO!"
    // =======================================================================
    synthFormantSyllable(time, dur, f0Start, f0End, formants, amp = 0.34) {
      const ctx = this.ctx;
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(f0Start, time);
      src.frequency.linearRampToValueAtTime(f0End, time + dur);

      const outGain = ctx.createGain();
      outGain.gain.setValueAtTime(0.001, time);
      outGain.gain.linearRampToValueAtTime(amp, time + 0.02);
      outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      outGain.connect(this.sfxBus);

      // 3 parallel bandpass formant resonators [F1, F2, F3]
      const qVals = [7, 9, 11];
      const weights = [1.0, 0.7, 0.35];
      for (let i = 0; i < 3; i++) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = qVals[i];
        bp.frequency.setValueAtTime(formants[0][i], time);
        bp.frequency.linearRampToValueAtTime(formants[1][i], time + dur);
        const fg = ctx.createGain();
        fg.gain.value = weights[i];
        src.connect(bp);
        bp.connect(fg);
        fg.connect(outGain);
      }
      src.start(time);
      src.stop(time + dur + 0.02);
    }

    playLetsGo() {
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.02;
      // "LET'S" (/e/ formant + crisp /ts/ sibilant)
      this.synthFormantSyllable(t, 0.16, 330, 360, [[530, 1840, 2480], [500, 1900, 2500]], 0.36);
      this.synthHat(t + 0.13, false, this.sfxBus, 0.30);
      // "GO!" (bright rising /o/ -> /u/ formant!)
      this.synthFormantSyllable(t + 0.21, 0.28, 390, 470, [[480, 920, 2400], [340, 760, 2350]], 0.42);
    }

    playOhNo(panVal = 0) {
      this.recordComposedEvent(60, 0, 'bomb', 0.35);
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.01;
      // "OH" (high panicked pitch) -> "NO!" (classic pitch-dropping formant!)
      this.synthFormantSyllable(t, 0.16, 460, 410, [[500, 900, 2400], [450, 820, 2350]], 0.40);
      this.synthFormantSyllable(t + 0.17, 0.30, 410, 210, [[480, 920, 2400], [320, 680, 2250]], 0.45);
    }

    // =======================================================================
    // THE 8 SKILL INSTRUMENTS
    // =======================================================================

    // 1. CLIMBER: Plucked ascending scale notes
    playSkillClimb(midi, panVal = 0) {
      this.recordComposedEvent(midi + 12, 0, 'climb', 0.12);
      if (!this.initialized || this.paused) return;
      this.synthArpPluck(this.ctx.currentTime + 0.005, midi + 12, 0.13, this.sfxBus, 0.22, panVal);
    }

    // 2. FLOATER: Soft detuned pad swell while drifting down
    playSkillFloat(midi, panVal = 0) {
      this.recordComposedEvent(midi + 12, 2, 'float', 0.35);
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.01;
      this.synthChord(t, { midis: [midi + 12, midi + 19], dur: 0.42 }, this.sfxBus, 0.12);
    }

    // 3. BOMBER: Crash cymbal + sub boom on detonation
    playBomberDetonate(panVal = 0) {
      if (!this.initialized || this.paused) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;

      // Long shimmering crash cymbal
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'highpass';
      bp.frequency.value = 3200;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.48, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      const pan = this.makePan(panVal);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(pan);
      pan.connect(this.sfxBus);
      nGain.connect(this.delaySend);
      noise.start(t);
      noise.stop(t + 0.78);

      // Deep crater boom
      this.synthKick(t, this.sfxBus, 0.95);
    }

    // 4. BLOCKER: Sustained warm drone on the world's chord root, held while blocking!
    syncBlockers(blockerCount) {
      this.blockerCount = blockerCount;
      if (!this.initialized || !this.ctx) return;

      if (blockerCount > 0 && !this.paused) {
        const rootFreq = midiToFreq(this.song.rootMidi);
        if (!this.droneNodes) {
          const ctx = this.ctx;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc2.type = 'triangle';
          osc1.frequency.value = rootFreq;
          osc2.frequency.value = rootFreq * 1.5; // Perfect 5th harmonic!
          osc1.detune.value = -5;
          osc2.detune.value = 5;

          filter.type = 'lowpass';
          filter.Q.value = 3.5;
          filter.frequency.value = rootFreq * 3.2;

          lfo.type = 'sine';
          lfo.frequency.value = this.song.bpm / 60; // Pulses gently with the tempo!
          lfoGain.gain.value = rootFreq * 1.1;
          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);

          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.setTargetAtTime(Math.min(0.18, 0.11 + blockerCount * 0.02), ctx.currentTime, 0.12);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxBus);

          osc1.start();
          osc2.start();
          lfo.start();
          this.droneNodes = { osc1, osc2, lfo, filter, gain };
        } else {
          const now = this.ctx.currentTime;
          this.droneNodes.osc1.frequency.setTargetAtTime(rootFreq, now, 0.05);
          this.droneNodes.osc2.frequency.setTargetAtTime(rootFreq * 1.5, now, 0.05);
          this.droneNodes.gain.gain.setTargetAtTime(
            Math.min(0.18, 0.11 + blockerCount * 0.02),
            now,
            0.1
          );
        }
      } else if (this.droneNodes) {
        this.stopBlockerDrone();
      }
    }

    stopBlockerDrone() {
      if (!this.droneNodes || !this.ctx) return;
      const nodes = this.droneNodes;
      this.droneNodes = null;
      const now = this.ctx.currentTime;
      try {
        nodes.gain.gain.setTargetAtTime(0.0001, now, 0.06);
        nodes.osc1.stop(now + 0.25);
        nodes.osc2.stop(now + 0.25);
        nodes.lfo.stop(now + 0.25);
      } catch (e) {}
    }

    // 5. BUILDER: Rising scale arpeggio, one note per brick laid!
    playSkillBuild(brickIndex, panVal = 0) {
      const sc = this.song.scaleOffsets;
      const oct = Math.floor(brickIndex / sc.length);
      const deg = brickIndex % sc.length;
      const midi = this.song.rootMidi + 12 + oct * 12 + sc[deg];
      this.recordComposedEvent(midi, deg, 'build', 0.18);
      if (!this.initialized || this.paused) return;
      this.synthArpPluck(this.ctx.currentTime + 0.005, midi, 0.20, this.sfxBus, 0.26, panVal);
    }

    playBuilderShrug(panVal = 0) {
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.01;
      const m = this.song.rootMidi + 24;
      this.synthArpPluck(t, m + 2, 0.09, this.sfxBus, 0.16, panVal);
      this.synthArpPluck(t + 0.09, m, 0.12, this.sfxBus, 0.16, panVal);
    }

    // 6. BASHER: Filtered resonant bass sweep as it tunnels horizontally
    playSkillBash(midi, panVal = 0) {
      const bassMidi = Math.max(36, Math.min(55, midi - 12));
      this.recordComposedEvent(bassMidi, 1, 'bash', 0.22);
      if (!this.initialized || this.paused) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;
      const freq = midiToFreq(bassMidi);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const pan = this.makePan(panVal);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.Q.value = 10.0;
      filter.frequency.setValueAtTime(freq * 1.5, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 8.0, t + 0.11);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 0.22);

      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.23);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.24);
    }

    // 7. MINER: Syncopated woody/metallic percussive clicks
    playSkillMine(midi, strikeIdx, panVal = 0) {
      const clickMidi = midi + ((strikeIdx & 1) ? 19 : 12);
      this.recordComposedEvent(clickMidi, 3, 'mine', 0.09);
      if (!this.initialized || this.paused) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pan = this.makePan(panVal);
      osc.type = 'triangle';
      const baseF = midiToFreq(clickMidi);
      osc.frequency.setValueAtTime(baseF * 1.8, t);
      osc.frequency.exponentialRampToValueAtTime(baseF * 0.7, t + 0.055);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.07);
    }

    // 8. DIGGER: Kick drum and snare pattern as it digs straight down!
    playSkillDig(strokeIdx, panVal = 0) {
      this.recordComposedEvent(this.song.rootMidi + ((strokeIdx & 1) ? 7 : 0), 0, 'dig', 0.14);
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.005;
      if ((strokeIdx & 1) === 0) {
        this.synthKick(t, this.sfxBus, 0.58);
      } else {
        this.synthSnare(t, this.sfxBus, 0.48);
      }
    }

    // Steel clang, Exit Door Rising Chord, & On-Beat Groove Sparkle!
    playSteelClang(panVal = 0) {
      if (!this.initialized || this.paused) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.005;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o1.type = 'square';
      o2.type = 'square';
      o1.frequency.value = 890;
      o2.frequency.value = 1318; // metallic inharmonic ring
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o1.connect(g);
      o2.connect(g);
      g.connect(this.sfxBus);
      o1.start(t);
      o2.start(t);
      o1.stop(t + 0.15);
      o2.stop(t + 0.15);
    }

    playExitChord(savedCount) {
      const sc = this.song.scaleOffsets;
      const baseDeg = savedCount % sc.length;
      const m1 = this.song.rootMidi + 12 + sc[baseDeg];
      const m2 = this.song.rootMidi + 12 + sc[(baseDeg + 2) % sc.length] + (baseDeg + 2 >= sc.length ? 12 : 0);
      const m3 = this.song.rootMidi + 24 + sc[baseDeg];
      this.recordComposedEvent(m3, baseDeg, 'exit', 0.28);
      if (!this.initialized || this.paused) return;
      const t = this.ctx.currentTime + 0.005;
      this.synthArpPluck(t, m1, 0.22, this.sfxBus, 0.22, -0.2);
      this.synthArpPluck(t + 0.055, m2, 0.24, this.sfxBus, 0.22, 0.2);
      this.synthArpPluck(t + 0.11, m3, 0.32, this.sfxBus, 0.26, 0.0);
    }

    playStemUnlockFanfare(stemIdx) {
      if (!this.initialized) return;
      const t = this.ctx.currentTime + 0.02;
      const r = this.song.rootMidi + 24;
      const notes = [r, r + 4, r + 7, r + 12];
      for (let i = 0; i < notes.length; i++) {
        this.synthLead(t + i * 0.07, notes[i], 0.26, this.sfxBus, true);
      }
    }

    playGrooveSparkle(streak = 1) {
      if (!this.initialized) return;
      const t = this.ctx.currentTime + 0.005;
      const base = this.song.rootMidi + 36 + Math.min(12, (streak - 1) * 2);
      this.synthArpPluck(t, base, 0.14, this.sfxBus, 0.22, -0.3);
      this.synthArpPluck(t + 0.045, base + 7, 0.18, this.sfxBus, 0.24, 0.3);
    }

    // =======================================================================
    // END-OF-LEVEL COMPOSED SONG REPLAY
    // =======================================================================
    startComposedReplay() {
      this.stopBlockerDrone();
      this.paused = false;
      this.speedMultiplier = 1.0;
      this.recording = false;
      this.replaying = true;
      this.replayIndex = 0;
      this.replayStartStep = this.totalStepsPlayed + 1;
      const lastEv = this.composedEvents[this.composedEvents.length - 1];
      this.replayTotalSteps = Math.max(32, lastEv ? lastEv.step + 16 : 64);
    }

    stopComposedReplay() {
      this.replaying = false;
    }

    getReplayState() {
      const total = Math.max(32, this.replayTotalSteps);
      const cur = this.replaying
        ? ((this.totalStepsPlayed - this.replayStartStep + total) % total)
        : 0;
      return {
        replaying: this.replaying,
        currentStep: cur,
        totalSteps: total,
        events: this.composedEvents
      };
    }

    triggerReplayEvent(time, ev) {
      switch (ev.kind) {
        case 'dig':
          this.synthKick(time, this.sfxBus, 0.48);
          break;
        case 'bash':
          this.synthBass(time, { midi: ev.midi, dur: 0.18, accent: true }, this.sfxBus);
          break;
        case 'build':
        case 'climb':
        case 'exit':
          this.synthArpPluck(time, ev.midi, ev.dur || 0.18, this.sfxBus, 0.24, 0);
          break;
        case 'float':
          this.synthChord(time, { midis: [ev.midi, ev.midi + 7], dur: 0.35 }, this.sfxBus, 0.12);
          break;
        default:
          this.synthFootstepTone(time, ev.midi - 12, 0.20, 0);
          break;
      }
    }
  }

  BeatTribe.Audio = {
    STEM_NAMES,
    midiToFreq,
    midiToTrackerStr,
    buildWorldSong,
    AudioEngine
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Audio;
  }
})(typeof window !== 'undefined' ? window : globalThis);
