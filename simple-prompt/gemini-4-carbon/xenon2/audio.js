(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});

  const NOTE_NAMES = ['C-', 'C#', 'D-', 'Eb', 'E-', 'F-', 'F#', 'G-', 'Ab', 'A-', 'Bb', 'B-'];

  function midiToName(midi) {
    if (midi === null || midi === undefined || midi < 0) return '---';
    const n = NOTE_NAMES[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return n + oct;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Helper note constants (C1 = 24, C2 = 36, C3 = 48, C4 = 60, C5 = 72)
  const N = {
    G1: 31, Ab1: 32, A1: 33, Bb1: 34, B1: 35,
    C2: 36, Cs2: 37, D2: 38, Eb2: 39, E2: 40, F2: 41, Fs2: 42, G2: 43, Ab2: 44, A2: 45, Bb2: 46, B2: 47,
    C3: 48, D3: 50, Eb3: 51, E3: 52, F3: 53, Fs3: 54, G3: 55, Ab3: 56, A3: 57, Bb3: 58, B3: 59,
    C4: 60, D4: 62, Eb4: 63, E4: 64, F4: 65, Fs4: 66, G4: 67, Ab4: 68, A4: 69, Bb4: 70, B4: 71,
    C5: 72, D5: 74, Eb5: 75, F5: 77, G5: 79, Ab5: 80, Bb5: 82, C6: 84
  };

  function cell(midi = null, inst = 0, fx = '...') {
    return { midi, note: midiToName(midi), inst, fx };
  }

  // Build all 7 x 64-step Tracker Patterns ("MEGABLAST: EVOLUTION ODYSSEY")
  function buildPatterns() {
    const patterns = [];

    function makeEmptyPattern(id, name, bpm) {
      const rows = [];
      for (let r = 0; r < 64; r++) {
        const ch = [];
        for (let c = 0; c < 8; c++) ch.push(cell(null, 0, '...'));
        rows.push(ch);
      }
      return { id, name, bpm, rows };
    }

    // Classic John Carpenter "Assault on Precinct 13" / Bomb the Bass Ostinato Bar (16 steps)
    //Syncopated C2 . C2 C2 | Eb2 . C2 . | F2 . C2 C2 | G2 . Bb1 .
    function writePrecinctBassBar(rows, startRow, rootShift = 0, inst = 1) {
      const seq = [
        [0, N.C2, 'C40'], [2, N.C2, 'C34'], [3, N.C2, 'C38'],
        [4, N.Eb2, 'C40'], [6, N.C2, 'C32'],
        [8, N.F2, 'C40'], [10, N.C2, 'C34'], [11, N.C2, 'C38'],
        [12, N.G2, 'C40'], [14, N.Bb1, 'C3A'], [15, N.B1, '304']
      ];
      for (const [off, note, fx] of seq) {
        rows[startRow + off][0] = cell(note + rootShift, inst, fx);
      }
    }

    // Classic 1988 UK Hip-Hop / Electro Breakbeat Bar (16 steps) on CH6, CH7, CH8
    function writeBreakbeatBar(rows, startRow, variant = 0) {
      // Kicks (CH6 = idx 5)
      const kicks = variant === 2
        ? [0, 4, 8, 12, 14] // Rave 4x4 + syncopation
        : [0, 3, 6, 10, 11]; // Iconic Bomb-the-Bass syncopated electro kick!
      for (const k of kicks) {
        rows[startRow + k][5] = cell(N.C2, 6, k === 0 ? 'C40' : 'C38');
      }
      if (variant === 1 && startRow === 48) {
        rows[startRow + 14][5] = cell(N.G1, 11, 'F02'); // 808 Sub-Drop!
      }

      // Snare, Ghost-Notes & Gated Clap (CH7 = idx 6)
      rows[startRow + 4][6] = cell(N.D3, 7, 'C40');
      rows[startRow + 12][6] = cell(N.D3, variant === 1 ? 12 : 7, 'C40'); // 12 = Gated Clap
      // Funky drummer ghost snares!
      rows[startRow + 7][6] = cell(N.D3, 7, 'C16');
      rows[startRow + 9][6] = cell(N.D3, 7, 'C18');
      if (variant >= 1) {
        rows[startRow + 15][6] = cell(N.D3, 7, 'C26');
      }

      // Hi-Hats & 808 Cowbell (CH8 = idx 7)
      for (let s = 0; s < 16; s += 2) {
        const isOpen = (s === 2 || s === 10);
        rows[startRow + s][7] = cell(isOpen ? N.Bb4 : N.Fs4, isOpen ? 13 : 8, isOpen ? 'C32' : 'C2C');
      }
      rows[startRow + 1][7] = cell(N.Fs4, 8, 'C1C');
      rows[startRow + 13][7] = cell(N.Fs4, 8, 'C20');
      // Syncopated 808 Cowbell hits!
      if (variant !== 3) {
        rows[startRow + 3][7] = cell(N.G4, 14, 'C34');
        rows[startRow + 11][7] = cell(N.C5, 14, 'C30');
      }
    }

    // -----------------------------------------------------------------------
    // PATTERN 00: INTRO (CHRONO AWAKENING — PRECINCT 13 PULSE & SCRATCH TEASE)
    // -----------------------------------------------------------------------
    const p0 = makeEmptyPattern(0, '00: INTRO - PRECINCT AWAKEN', 122);
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      // Heartbeat 808 kicks + cowbell pulse
      p0.rows[b + 0][5] = cell(N.C2, 6, 'C40');
      p0.rows[b + 3][5] = cell(N.C2, 6, 'C34');
      p0.rows[b + 8][5] = cell(N.C2, 6, 'C3C');
      if (bar >= 1) p0.rows[b + 12][6] = cell(N.D3, 12, 'C38'); // Gated Reverb Clap
      for (let s = 0; s < 16; s += 4) {
        p0.rows[b + s][7] = cell(N.Fs4, 8, 'C28');
        p0.rows[b + s + 2][7] = cell(N.G4, 14, 'C2A'); // Cowbell tick
      }
      if (bar >= 1) {
        writePrecinctBassBar(p0.rows, b, 0, 1);
      } else {
        p0.rows[b + 0][0] = cell(N.C2, 1, 'C38');
        p0.rows[b + 8][0] = cell(N.C2, 1, 'C38');
      }
      // Atmospheric PWM pad chord swells (CH4)
      if (bar === 0 || bar === 2) {
        p0.rows[b][3] = cell(bar === 0 ? N.C4 : N.Ab3, 4, 'A04');
      }
      // Turntable scratch & vocal stab intro callout!
      if (bar === 1) {
        p0.rows[b + 12][4] = cell(N.C4, 5, 'E92'); // Vinyl Scratch!
        p0.rows[b + 14][4] = cell(N.Eb4, 5, 'E92');
      }
      if (bar === 3) {
        p0.rows[b + 4][4] = cell(N.G4, 6, '3F0'); // Vinyl Backspin!
        p0.rows[b + 8][4] = cell(N.C4, 7, 'F00'); // "MEGA-BLAST!" Formant Vox!
        p0.rows[b + 12][3] = cell(N.C4, 10, 'C40'); // Orch5 Brass Hit!
        p0.rows[b + 14][3] = cell(N.Eb4, 10, 'C40');
        p0.rows[b + 14][5] = cell(N.G1, 11, 'F02'); // Sub-Drop into Main Groove!
      }
    }
    patterns.push(p0);

    // -----------------------------------------------------------------------
    // PATTERN 01: PRECINCT 13 MAIN GROOVE (THE ICONIC MEGABLAST ANTHEM)
    // -----------------------------------------------------------------------
    const p1 = makeEmptyPattern(1, '01: PRECINCT 13 MAIN GROOVE', 122);
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      const shift = bar === 2 ? 5 : (bar === 3 ? 3 : 0); // Cmin -> Cmin -> Fmin -> EbMaj/G
      writePrecinctBassBar(p1.rows, b, shift, 1);
      writeBreakbeatBar(p1.rows, b, bar === 3 ? 1 : 0);

      // Subtle percolating 303 octaves on CH2
      for (let s = 2; s < 16; s += 4) {
        p1.rows[b + s][1] = cell(N.C3 + shift, 2, s === 10 ? 'A0F' : 'C28');
      }

      // Fairlight Orch5 Stabs on CH4
      p1.rows[b + 0][3] = cell(N.C4 + shift, 10, 'C40');
      p1.rows[b + 6][3] = cell(N.Eb4 + shift, 4, 'C34');
      if (bar % 2 === 1) {
        p1.rows[b + 14][3] = cell(N.Bb3 + shift, 10, 'C3C');
      }

      // Scratch & Vocal accents on CH5
      if (bar === 1) {
        p1.rows[b + 13][4] = cell(N.C4, 5, 'E92');
        p1.rows[b + 15][4] = cell(N.F4, 8, 'C40'); // "YEAH!"
      } else if (bar === 3) {
        p1.rows[b + 11][4] = cell(N.D4, 5, 'E92');
        p1.rows[b + 12][4] = cell(N.C4, 7, 'C40'); // "MEGA-BLAST!"
      }
    }
    // Soaring Carpenter / Whittaker Ping-Pong Lead Melody across 64 steps (CH3 = idx 2)
    const p1Lead = [
      [0, N.G4, '442'], [4, N.C5, '443'], [8, N.Bb4, '304'], [12, N.G4, '442'],
      [16, N.F4, 'C3C'], [19, N.G4, 'C38'], [22, N.Eb4, '442'], [26, N.C4, '442'],
      [32, N.Ab4, '442'], [36, N.C5, '443'], [40, N.Bb4, 'C3E'], [44, N.Ab4, 'C3A'],
      [48, N.G4, '047'], [52, N.Bb4, '443'], [56, N.C5, '444'], [60, N.D5, '308']
    ];
    for (const [r, note, fx] of p1Lead) {
      p1.rows[r][2] = cell(note, 3, fx);
    }
    patterns.push(p1);

    // -----------------------------------------------------------------------
    // PATTERN 02: TB-303 ACID BREAKDOWN (HIGH-Q RESONANCE & SLIDES!)
    // -----------------------------------------------------------------------
    const p2 = makeEmptyPattern(2, '02: TB-303 ACID BREAKDOWN', 122);
    const acidRiff = [
      [0, N.C2, 'A0F'], [1, N.C3, '308'], [2, N.Bb2, 'C36'], [3, N.C2, 'C32'],
      [4, N.Eb3, 'A0F'], [5, N.D3, '30C'], [6, N.C2, 'C34'], [7, N.G2, 'A0C'],
      [8, N.Ab2, 'A0F'], [9, N.G2, '308'], [10, N.F2, 'C36'], [11, N.C3, 'A0F'],
      [12, N.Eb3, '30A'], [13, N.C2, 'C30'], [14, N.Bb2, 'A0F'], [15, N.B2, '306']
    ];
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      const tr = bar === 2 ? 3 : 0;
      writeBreakbeatBar(p2.rows, b, 1);
      // Sparse deep sub-bass anchor on beat 1 & 9 so the 303 owns the midrange!
      p2.rows[b + 0][0] = cell(N.C2 + tr, 1, 'C40');
      p2.rows[b + 8][0] = cell(N.F2 + tr, 1, 'C3A');
      p2.rows[b + 12][0] = cell(N.G2 + tr, 1, 'C3C');

      for (const [off, note, fx] of acidRiff) {
        // Sweep 303 cutoff higher every bar in the breakdown!
        const barAccent = bar >= 2 && (off % 2 === 0) ? 'A0F' : fx;
        p2.rows[b + off][1] = cell(note + tr + (bar === 3 && off >= 8 ? 12 : 0), 2, barAccent);
      }

      if (bar === 1 || bar === 3) {
        p2.rows[b + 0][4] = cell(N.C4, 8, 'C40'); // "YEAH!"
        p2.rows[b + 10][4] = cell(N.D4, 5, 'E93'); // Scratch
      }
      if (bar === 3) {
        p2.rows[b + 8][4] = cell(N.G4, 6, '3F0'); // Backspin
        p2.rows[b + 12][4] = cell(N.C4, 7, 'C40'); // "MEGA-BLAST!"
        p2.rows[b + 12][3] = cell(N.C4, 10, 'C40');
        p2.rows[b + 14][3] = cell(N.D4, 10, 'C40');
        p2.rows[b + 15][3] = cell(N.Eb4, 10, 'C40');
      }
    }
    // Shimmering delayed arpeggio pings in background of acid breakdown
    for (let r = 4; r < 64; r += 16) {
      p2.rows[r][2] = cell(N.G5, 3, '037');
      p2.rows[r + 8][2] = cell(N.Eb5, 3, '047');
    }
    patterns.push(p2);

    // -----------------------------------------------------------------------
    // PATTERN 03: BRASS & SCRATCH DROP (FULL BOMB THE BASS PARTY OVERDRIVE!)
    // -----------------------------------------------------------------------
    const p3 = makeEmptyPattern(3, '03: BRASS & SCRATCH DROP', 122);
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      writePrecinctBassBar(p3.rows, b, bar === 2 ? -2 : 0, 1);
      writeBreakbeatBar(p3.rows, b, 1);

      // Iconic syncopated Fairlight ORCH5 Brass Hit riff!
      const stabs = [
        [0, N.C4], [3, N.Eb4], [6, N.F4], [8, N.G4], [11, N.F4], [14, N.Eb4]
      ];
      for (const [off, note] of stabs) {
        p3.rows[b + off][3] = cell(note, 10, 'C40');
      }

      // Turntable Scratch Battle & Formant Vocal Call-and-Response on CH5!
      p3.rows[b + 2][4] = cell(N.C4, 5, 'E92');
      p3.rows[b + 4][4] = cell(N.F4, 5, 'E94');
      p3.rows[b + 7][4] = cell(N.Eb4, 5, 'E92');
      if (bar % 2 === 0) {
        p3.rows[b + 12][4] = cell(N.C4, 7, 'C40'); // "MEGA-BLAST!"
      } else {
        p3.rows[b + 10][4] = cell(N.G4, 6, '3F0'); // Backspin
        p3.rows[b + 13][4] = cell(N.F4, 8, 'C40'); // "YEAH!"
      }

      // Supporting 303 octave bounce
      for (let s = 1; s < 16; s += 2) {
        p3.rows[b + s][1] = cell(s % 4 === 1 ? N.C3 : N.G2, 2, s === 13 ? 'A0F' : 'C2C');
      }
    }
    // Heroic counter-melody on CH3 Lead
    const p3Lead = [
      [0, N.C5, '443'], [3, N.Eb5, 'C40'], [6, N.D5, 'C3C'], [8, N.C5, '442'], [12, N.G4, '442'],
      [16, N.Bb4, '443'], [20, N.C5, 'C40'], [24, N.G4, '037'], [28, N.F4, 'C3A'],
      [32, N.Bb4, '443'], [35, N.D5, 'C40'], [38, N.C5, 'C3C'], [40, N.Bb4, '442'], [44, N.F4, '442'],
      [48, N.G4, '047'], [52, N.C5, '443'], [56, N.D5, '443'], [60, N.Eb5, '444']
    ];
    for (const [r, note, fx] of p3Lead) p3.rows[r][2] = cell(note, 3, fx);
    patterns.push(p3);

    // -----------------------------------------------------------------------
    // PATTERN 04: EVOLUTIONARY BRIDGE (DEMOSCENE CHORD ARPEGGIOS & SOLO)
    // -----------------------------------------------------------------------
    const p4 = makeEmptyPattern(4, '04: EVOLUTIONARY BRIDGE', 122);
    const bridgeRoots = [N.Ab1, N.F1 !== undefined ? N.F1 : 29, N.Eb2, N.G1];
    const bridgeChords = [N.Ab3, N.F3, N.Eb4, N.G3];
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      const root = bridgeRoots[bar];
      writeBreakbeatBar(p4.rows, b, 0);
      // Driving eighth-note melodic bass
      for (let s = 0; s < 16; s += 2) {
        p4.rows[b + s][0] = cell(root + (s % 4 === 2 ? 12 : 0), 1, 'C3C');
      }
      // Lush PWM synth chord pad + tracker arpeggios
      p4.rows[b + 0][3] = cell(bridgeChords[bar], 4, 'C3C');
      p4.rows[b + 8][3] = cell(bridgeChords[bar] + 12, 4, '037');
      // 303 arpeggiated percolation
      for (let s = 0; s < 16; s += 4) {
        p4.rows[b + s + 1][1] = cell(bridgeChords[bar] - 12, 2, 'C2A');
        p4.rows[b + s + 3][1] = cell(bridgeChords[bar] - 5, 2, 'A0C');
      }
    }
    const p4Solo = [
      [0, N.C5, '443'], [4, N.Eb5, '443'], [8, N.G5, '444'], [12, N.F5, '304'],
      [16, N.C5, '443'], [20, N.Ab4, 'C3C'], [24, N.F4, '037'], [28, N.G4, 'C3C'],
      [32, N.Bb4, '443'], [36, N.Eb5, '443'], [40, N.D5, 'C3E'], [44, N.C5, 'C3C'],
      [48, N.D5, '047'], [52, N.B4, '443'], [56, N.G4, '047'], [60, N.D5, '308']
    ];
    for (const [r, note, fx] of p4Solo) p4.rows[r][2] = cell(note, 3, fx);
    p4.rows[60][4] = cell(N.C4, 7, 'C40'); // "MEGA-BLAST!" turnaround!
    patterns.push(p4);

    // -----------------------------------------------------------------------
    // PATTERN 05: BOSS RAVE OVERDRIVE (130 BPM XENITE GUARDIAN ASSAULT!)
    // -----------------------------------------------------------------------
    const p5 = makeEmptyPattern(5, '05: BOSS RAVE OVERDRIVE', 130);
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      const tr = bar === 2 ? 1 : (bar === 3 ? 3 : 0); // Phrygian dark tension C -> Db -> Eb!
      writeBreakbeatBar(p5.rows, b, 2);
      // Relentless offbeat rave bass + Precinct 13 syncopation
      for (let s = 0; s < 16; s++) {
        if (s % 2 === 0) {
          p5.rows[b + s][0] = cell(N.C2 + tr, 1, 'C40');
        } else {
          p5.rows[b + s][1] = cell((s % 4 === 1 ? N.C3 : N.Eb3) + tr, 2, 'A0F');
        }
      }
      // Rave Hoover / Orch5 Stabs!
      p5.rows[b + 0][3] = cell(N.C4 + tr, 10, 'C40');
      p5.rows[b + 3][3] = cell(N.C4 + tr, 10, 'C3C');
      p5.rows[b + 6][3] = cell(N.Eb4 + tr, 10, 'C40');
      p5.rows[b + 12][3] = cell(N.Fs4, 10, 'C40'); // Tritone boss danger stab!

      // Rapid Amiga chip-arpeggio lead on CH3
      for (let s = 0; s < 16; s += 4) {
        p5.rows[b + s][2] = cell(N.C5 + tr + (s === 8 ? 3 : 0), 3, '037');
      }
      if (bar % 2 === 1) {
        p5.rows[b + 8][4] = cell(N.C4, 5, 'E94');
        p5.rows[b + 12][4] = cell(N.C4, bar === 3 ? 7 : 8, 'C40');
      }
    }
    patterns.push(p5);

    // -----------------------------------------------------------------------
    // PATTERN 06: CRISPIN'S ELECTRO-DUB SHOP GROOVE (LAID-BACK PAWNSHOP DUB)
    // -----------------------------------------------------------------------
    const p6 = makeEmptyPattern(6, "06: CRISPIN'S ELECTRO-DUB", 112);
    for (let bar = 0; bar < 4; bar++) {
      const b = bar * 16;
      const tr = bar >= 2 ? 5 : 0; // Warm Cm9 -> Fm9 dub sway
      // Laid-back dub bassline
      p6.rows[b + 0][0] = cell(N.C2 + tr, 1, 'C3C');
      p6.rows[b + 3][0] = cell(N.G2 + tr, 1, 'C30');
      p6.rows[b + 6][0] = cell(N.Eb2 + tr, 1, 'C38');
      p6.rows[b + 10][0] = cell(N.C2 + tr, 1, 'C34');
      p6.rows[b + 14][0] = cell(N.Bb1 + tr, 1, 'C32');

      // Half-time head-nodding beat
      p6.rows[b + 0][5] = cell(N.C2, 6, 'C3A');
      p6.rows[b + 10][5] = cell(N.C2, 6, 'C32');
      p6.rows[b + 8][6] = cell(N.D3, 7, 'C30');
      p6.rows[b + 15][6] = cell(N.D3, 7, 'C16');
      for (let s = 0; s < 16; s += 4) {
        p6.rows[b + s][7] = cell(N.Fs4, 8, 'C20');
        p6.rows[b + s + 2][7] = cell(N.Bb4, 13, 'C1C');
      }
      // Dub chord echo skanks on offbeats!
      p6.rows[b + 4][3] = cell(N.C4 + tr, 4, 'C30');
      p6.rows[b + 12][3] = cell(N.G4 + tr, 4, 'C2C');
      // Liquid low-cutoff 303 bubbles
      p6.rows[b + 2][1] = cell(N.G2 + tr, 2, 'C24');
      p6.rows[b + 11][1] = cell(N.Eb3 + tr, 2, 'C26');
      // Delayed dub melody echoes
      if (bar % 2 === 0) {
        p6.rows[b + 6][2] = cell(N.D5, 3, '442');
        p6.rows[b + 14][2] = cell(N.G4, 3, '442');
      } else if (bar === 3) {
        p6.rows[b + 12][4] = cell(N.C4, 5, 'E91');
      }
    }
    patterns.push(p6);

    return patterns;
  }

  class TrackerAudioEngine {
    constructor() {
      this.ctx = null;
      this.started = false;
      this.playing = true;
      this.masterMuted = false;
      this.masterVolume = 0.78;

      this.patterns = buildPatterns();
      this.songOrder = [0, 1, 2, 3, 4, 1, 3];
      this.orderIdx = 0;
      this.currentPattern = 0;
      this.currentRow = 0;
      this.nextNoteTime = 0;
      this.schedulerTimer = null;

      this.shopMode = false;
      this.bossMode = false;
      this.savedPatternBeforeOverride = 1;
      this.epoch = 1; // 1..5 evolutionary variations
      this.epochTranspose = [0, 0, 2, 1, 4, -1]; // Stage 1..5 semitone shifts

      // 8 Channel descriptors, mute/solo states, and live VU meters
      this.channels = [
        { idx: 0, code: 'CH1', name: 'P13 FM BASS', color: '#38bdf8', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 1, code: 'CH2', name: 'TB-303 ACID', color: '#4ade80', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 2, code: 'CH3', name: 'PINGPONG LD', color: '#f472b6', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 3, code: 'CH4', name: 'ORCH5 / PWM', color: '#fbbf24', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 4, code: 'CH5', name: 'SCRATCH/VOX', color: '#c084fc', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 5, code: 'CH6', name: '808/909 KCK', color: '#fb7185', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 6, code: 'CH7', name: 'BRKBEAT SNR', color: '#fdba74', muted: false, solo: false, vu: 0, lastNote: '---' },
        { idx: 7, code: 'CH8', name: 'HATS & BELL', color: '#fde047', muted: false, solo: false, vu: 0, lastNote: '---' }
      ];

      this.visualQueue = [];
      this.displayPattern = 0;
      this.displayRow = 0;
      this.beatPulse = 0;
      this.freqData = new Uint8Array(64);
      this.waveData = new Uint8Array(128);
      this.openHatGain = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master chain: Music Bus -> Dub Lowpass Filter -> Glue Compressor -> Master Gain -> Analyser -> Destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterMuted ? 0 : this.masterVolume;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4.5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.14;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveData = new Uint8Array(this.analyser.fftSize);

      // Music Dub Filter (sweeps smoothly when docking at Crispin's Shop!)
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 20000;
      this.musicFilter.Q.value = 0.75;

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.75;

      this.musicFilter.connect(this.compressor);
      this.sfxBus.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // 8 Persistent Channel Gains
      this.chanGains = this.channels.map(() => {
        const g = this.ctx.createGain();
        g.gain.value = 1.0;
        g.connect(this.musicFilter);
        return g;
      });

      // Persistent Stereo Ping-Pong Delay for CH3 (Lead) & CH4 dub throws
      this.setupPingPongDelay();

      // Persistent Monophonic Roland TB-303 Acid Synth on CH2!
      this.setupMonophonic303();

      // Pre-computed noise & waveshaper buffers (zero runtime allocation!)
      this.createNoiseBuffers();

      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.started = true;
      this.schedulerTimer = setInterval(() => this.schedule(), 25);
    }

    setupPingPongDelay() {
      const ctx = this.ctx;
      this.delayInput = ctx.createGain();
      this.delayInput.gain.value = 0.42;

      const delayL = ctx.createDelay(1.0);
      const delayR = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.184; // Dotted 16th stereo bounce
      delayR.delayTime.value = 0.184;

      const fbFilter = ctx.createBiquadFilter();
      fbFilter.type = 'lowpass';
      fbFilter.frequency.value = 2900;

      const fbGain = ctx.createGain();
      fbGain.gain.value = 0.44;
      this.delayFeedback = fbGain;

      const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (panL.pan) panL.pan.value = -0.75;
      if (panR.pan) panR.pan.value = 0.75;

      this.delayInput.connect(delayL);
      delayL.connect(panL);
      panL.connect(this.musicFilter);

      delayL.connect(delayR);
      delayR.connect(panR);
      panR.connect(this.musicFilter);

      delayR.connect(fbFilter);
      fbFilter.connect(fbGain);
      fbGain.connect(delayL);
    }

    setupMonophonic303() {
      const ctx = this.ctx;
      this.acidOsc = ctx.createOscillator();
      this.acidOsc.type = 'sawtooth';
      this.acidOsc.frequency.value = midiToFreq(36);

      this.acidFilter = ctx.createBiquadFilter();
      this.acidFilter.type = 'lowpass';
      this.acidFilter.frequency.value = 380;
      this.acidFilter.Q.value = 15.5;

      // Subtle acid diode clipper waveshaper
      this.acidDrive = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = Math.tanh(x * 2.4);
      }
      this.acidDrive.curve = curve;

      this.acidVCA = ctx.createGain();
      this.acidVCA.gain.value = 0.0001;

      this.acidOsc.connect(this.acidFilter);
      this.acidFilter.connect(this.acidDrive);
      this.acidDrive.connect(this.acidVCA);
      this.acidVCA.connect(this.chanGains[1]);
      // Slight ping-pong send for 303 space!
      const acidSend = ctx.createGain();
      acidSend.gain.value = 0.22;
      this.acidVCA.connect(acidSend);
      acidSend.connect(this.delayInput);

      this.acidOsc.start();
    }

    createNoiseBuffers() {
      const sr = this.ctx.sampleRate;
      this.whiteNoise = this.ctx.createBuffer(1, sr * 1.5, sr);
      const data = this.whiteNoise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // 8-bit Amiga Paula crunch curve for sampled Fairlight / Vocal stabs
      const crush = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const x = (i / 256) - 1;
        crush[i] = Math.round(Math.tanh(x * 1.9) * 16) / 16;
      }
      this.amigaCrushCurve = crush;
    }

    isChannelAudible(chIdx) {
      const anySolo = this.channels.some((c) => c.solo);
      if (anySolo) return this.channels[chIdx].solo;
      return !this.channels[chIdx].muted;
    }

    updateChannelGains() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        const target = this.isChannelAudible(i) ? 1.0 : 0.0;
        this.chanGains[i].gain.setTargetAtTime(target, now, 0.015);
      }
    }

    toggleChannelMute(chIdx) {
      this.channels[chIdx].muted = !this.channels[chIdx].muted;
      if (this.channels[chIdx].muted) this.channels[chIdx].solo = false;
      this.updateChannelGains();
    }

    toggleChannelSolo(chIdx) {
      const wasSolo = this.channels[chIdx].solo;
      this.channels[chIdx].solo = !wasSolo;
      if (this.channels[chIdx].solo) this.channels[chIdx].muted = false;
      this.updateChannelGains();
    }

    setMasterMute(muted) {
      this.masterMuted = muted;
      if (this.ctx && this.masterGain) {
        this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
      }
    }

    setEpoch(stageNum) {
      this.epoch = Math.max(1, Math.min(5, stageNum | 0));
      if (this.acidOsc) {
        // Epoch 3 & 4 alternate square/saw 303 character
        this.acidOsc.type = (this.epoch === 4) ? 'square' : 'sawtooth';
      }
    }

    setShopMode(active) {
      if (this.shopMode === active) return;
      this.shopMode = active;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.musicFilter.frequency.cancelScheduledValues(now);
      this.musicFilter.Q.cancelScheduledValues(now);
      if (active) {
        this.savedPatternBeforeOverride = this.currentPattern === 6 ? 1 : this.currentPattern;
        // Smooth warm Electro-Dub Lowpass Filter sweep!
        this.musicFilter.frequency.setValueAtTime(this.musicFilter.frequency.value, now);
        this.musicFilter.frequency.exponentialRampToValueAtTime(1480, now + 0.42);
        this.musicFilter.Q.setTargetAtTime(2.6, now, 0.15);
        this.delayFeedback.gain.setTargetAtTime(0.58, now, 0.15);
        this.currentPattern = 6;
      } else {
        this.musicFilter.frequency.setValueAtTime(Math.max(200, this.musicFilter.frequency.value), now);
        this.musicFilter.frequency.exponentialRampToValueAtTime(20000, now + 0.35);
        this.musicFilter.Q.setTargetAtTime(0.75, now, 0.12);
        this.delayFeedback.gain.setTargetAtTime(0.44, now, 0.15);
        this.currentPattern = this.bossMode ? 5 : this.savedPatternBeforeOverride;
      }
    }

    setBossMode(active) {
      if (this.bossMode === active) return;
      this.bossMode = active;
      if (!this.shopMode) {
        if (active) {
          this.savedPatternBeforeOverride = this.currentPattern;
          this.currentPattern = 5;
        } else {
          this.currentPattern = 1;
        }
      }
    }

    jumpToPattern(patIdx) {
      const clamped = Math.max(0, Math.min(this.patterns.length - 1, patIdx | 0));
      this.currentPattern = clamped;
      this.currentRow = 0;
      const orderPos = this.songOrder.indexOf(clamped);
      if (orderPos >= 0) this.orderIdx = orderPos;
    }

    schedule() {
      if (!this.ctx || !this.playing) return;
      const lookahead = 0.12;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        const pat = this.patterns[this.currentPattern] || this.patterns[1];
        const stepDur = 60 / pat.bpm / 4;
        // Subtle 1988 hip-hop breakbeat swing on odd 16th steps!
        const swingOffset = (this.currentRow & 1) === 1 ? stepDur * 0.07 : 0;
        const triggerTime = this.nextNoteTime + swingOffset;

        this.triggerRow(pat, this.currentRow, triggerTime, stepDur);

        this.visualQueue.push({
          time: triggerTime,
          pattern: this.currentPattern,
          row: this.currentRow,
          isBeat: (this.currentRow & 3) === 0
        });
        if (this.visualQueue.length > 64) this.visualQueue.shift();

        this.nextNoteTime += stepDur;
        this.currentRow++;
        if (this.currentRow >= 64) {
          this.currentRow = 0;
          if (this.shopMode) {
            this.currentPattern = 6;
          } else if (this.bossMode) {
            this.currentPattern = 5;
          } else {
            this.orderIdx = (this.orderIdx + 1) % this.songOrder.length;
            // After Intro (00) plays once, loop through Main -> Acid -> Drop -> Bridge!
            if (this.orderIdx === 0) this.orderIdx = 1;
            this.currentPattern = this.songOrder[this.orderIdx];
          }
        }
      }
    }

    triggerRow(pat, rowIdx, t, stepDur) {
      const row = pat.rows[rowIdx];
      const semi = this.shopMode ? 0 : (this.epochTranspose[this.epoch] || 0);

      for (let ch = 0; ch < 8; ch++) {
        const c = row[ch];
        if (!c || (c.midi === null && c.inst === 0)) continue;

        const audible = this.isChannelAudible(ch);
        // Parse volume effect Cxx (00..40 hex)
        let vel = 0.9;
        if (c.fx && c.fx.startsWith('C')) {
          const hex = parseInt(c.fx.slice(1), 16);
          if (!isNaN(hex)) vel = Math.min(1.0, hex / 64);
        }

        if (audible) {
          this.channels[ch].vu = Math.max(this.channels[ch].vu, 0.35 + vel * 0.65);
        }
        this.channels[ch].lastNote = c.note;

        const pitchedMidi = c.midi !== null ? c.midi + (ch <= 3 ? semi : 0) : 60;

        switch (ch) {
          case 0:
            this.synthPrecinctBass(t, pitchedMidi, stepDur, vel, c.fx);
            break;
          case 1:
            this.synthAcid303(t, pitchedMidi, stepDur, vel, c.fx);
            break;
          case 2:
            this.synthLead(t, pitchedMidi, stepDur, vel, c.fx);
            break;
          case 3:
            if (c.inst === 10) this.synthOrchHit(t, pitchedMidi, vel);
            else this.synthPWMChord(t, pitchedMidi, stepDur * 3.5, vel, c.fx);
            break;
          case 4:
            this.synthScratchOrVox(t, c.inst, pitchedMidi, stepDur, vel);
            break;
          case 5:
            this.synthKick(t, c.inst === 11, vel);
            break;
          case 6:
            if (c.inst === 12) this.synthGatedClap(t, vel);
            else this.synthSnare(t, vel);
            break;
          case 7:
            if (c.inst === 14) this.synthCowbell(t, pitchedMidi, vel);
            else this.synthHiHat(t, c.inst === 13, vel);
            break;
        }
      }
    }

    // CH1: John Carpenter / Precinct 13 Ostinato FM + Analog Saw Bass
    synthPrecinctBass(t, midi, stepDur, vel, fx) {
      const ctx = this.ctx;
      const freq = midiToFreq(midi);
      const dur = stepDur * 1.65;

      const oscSaw = ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(freq, t);
      if (fx && fx.startsWith('3')) {
        oscSaw.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, 1 / 12), t + stepDur);
      }

      // 2-Op FM punch layer
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      const fmRatio = this.epoch === 3 ? 3.0 : 2.0;
      mod.frequency.setValueAtTime(freq * fmRatio, t);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * (this.epoch === 5 ? 2.6 : 1.6), t);
      modGain.gain.exponentialRampToValueAtTime(freq * 0.2, t + dur * 0.8);

      const carrier = ctx.createOscillator();
      carrier.type = 'triangle';
      carrier.frequency.setValueAtTime(freq, t);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = 3.2;
      filt.frequency.setValueAtTime(1750 * vel, t);
      filt.frequency.exponentialRampToValueAtTime(190, t + dur * 0.9);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.34 * vel, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      oscSaw.connect(filt);
      carrier.connect(filt);
      filt.connect(env);
      env.connect(this.chanGains[0]);

      oscSaw.start(t);
      mod.start(t);
      carrier.start(t);
      oscSaw.stop(t + dur + 0.02);
      mod.stop(t + dur + 0.02);
      carrier.stop(t + dur + 0.02);
    }

    // CH2: Persistent Monophonic Roland TB-303 Acid Line (High Q + Cutoff Sweep + Slides)
    synthAcid303(t, midi, stepDur, vel, fx) {
      const freq = midiToFreq(midi);
      const isSlide = fx && fx.startsWith('3');
      const isAccent = fx && fx.startsWith('A');

      this.acidOsc.frequency.cancelScheduledValues(t);
      if (isSlide) {
        this.acidOsc.frequency.exponentialRampToValueAtTime(freq, t + stepDur * 0.72);
      } else {
        this.acidOsc.frequency.setValueAtTime(freq, t);
      }

      // Dynamic resonant cutoff sweep modulated by song progress + accent!
      const lfoSweep = 0.5 + 0.5 * Math.sin(t * 0.9);
      const baseCut = this.shopMode ? 280 : (340 + lfoSweep * 520);
      const peakCut = isAccent
        ? (this.shopMode ? 1200 : 3900)
        : (this.shopMode ? 850 : 1450 + lfoSweep * 1500);

      this.acidFilter.Q.setValueAtTime(isAccent ? 19.5 : 14.0, t);
      this.acidFilter.frequency.cancelScheduledValues(t);
      this.acidFilter.frequency.setValueAtTime(peakCut, t);
      this.acidFilter.frequency.exponentialRampToValueAtTime(baseCut, t + stepDur * (isSlide ? 1.35 : 0.88));

      this.acidVCA.gain.cancelScheduledValues(t);
      this.acidVCA.gain.setValueAtTime(isAccent ? 0.25 : 0.17 * vel, t);
      if (!isSlide) {
        this.acidVCA.gain.exponentialRampToValueAtTime(0.002, t + stepDur * 0.92);
      }
    }

    // CH3: Soaring Analog Lead Synth with Tracker Arpeggio (0xy), Vibrato (4xx) & Ping-Pong Delay
    synthLead(t, midi, stepDur, vel, fx) {
      const ctx = this.ctx;
      const isArp = fx && fx.startsWith('0') && fx !== '000';
      const dur = stepDur * (isArp ? 3.8 : 3.4);
      const baseFreq = midiToFreq(midi);

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'square';
      o2.detune.value = 9;

      if (isArp) {
        // Authentic 50Hz Amiga ProTracker 0xy 3-note chord arpeggio!
        const xSemi = parseInt(fx[1], 16) || 3;
        const ySemi = parseInt(fx[2], 16) || 7;
        const arpNotes = [0, xSemi, ySemi];
        const tick = 0.03;
        const steps = Math.floor(dur / tick);
        for (let i = 0; i < steps; i++) {
          const f = midiToFreq(midi + arpNotes[i % 3]);
          o1.frequency.setValueAtTime(f, t + i * tick);
          o2.frequency.setValueAtTime(f, t + i * tick);
        }
      } else {
        o1.frequency.setValueAtTime(baseFreq, t);
        o2.frequency.setValueAtTime(baseFreq, t);
        if (fx && fx.startsWith('4')) {
          const lfo = ctx.createOscillator();
          const lfoG = ctx.createGain();
          lfo.frequency.value = 6.2;
          lfoG.gain.value = baseFreq * 0.016;
          lfo.connect(lfoG);
          lfoG.connect(o1.frequency);
          lfoG.connect(o2.frequency);
          lfo.start(t);
          lfo.stop(t + dur + 0.02);
        }
      }

      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = 2.2;
      filt.frequency.setValueAtTime(3800, t);
      filt.frequency.exponentialRampToValueAtTime(1400, t + dur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.14 * vel, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      o1.connect(filt);
      o2.connect(filt);
      filt.connect(env);
      env.connect(this.chanGains[2]);
      env.connect(this.delayInput); // Stereo Ping-Pong Delay!

      o1.start(t);
      o2.start(t);
      o1.stop(t + dur + 0.03);
      o2.stop(t + dur + 0.03);
    }

    // CH4A: 1988 Fairlight "ORCH5" Orchestra Hit / Brass Stab!
    synthOrchHit(t, midi, vel) {
      const ctx = this.ctx;
      const dur = 0.28;
      // Classic minor-7th/5th Fairlight orchestral cluster
      const intervals = [0, 3, 7, 12, 15];
      const mix = ctx.createGain();
      mix.gain.setValueAtTime(0.001, t);
      mix.gain.linearRampToValueAtTime(0.18 * vel, t + 0.006);
      mix.gain.exponentialRampToValueAtTime(0.001, t + dur);

      const crush = ctx.createWaveShaper();
      crush.curve = this.amigaCrushCurve;

      const bp = ctx.createBiquadFilter();
      bp.type = 'lowpass';
      bp.Q.value = 3.5;
      bp.frequency.setValueAtTime(4600, t);
      bp.frequency.exponentialRampToValueAtTime(950, t + dur);

      intervals.forEach((semi, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
        const f = midiToFreq(midi + semi);
        // Subtle 1980s sampler pitch-punch envelope
        osc.frequency.setValueAtTime(f * 1.03, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.025);
        osc.detune.value = (idx - 2) * 8;
        osc.connect(bp);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });

      // Orchestral timpani/bow attack transient burst
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = this.whiteNoise;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.14 * vel, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      nSrc.connect(nGain);
      nGain.connect(bp);
      nSrc.start(t);
      nSrc.stop(t + 0.05);

      bp.connect(crush);
      crush.connect(mix);
      mix.connect(this.chanGains[3]);
      mix.connect(this.delayInput);
    }

    // CH4B: Detuned PWM Synth Chords
    synthPWMChord(t, midi, dur, vel, fx) {
      const ctx = this.ctx;
      const intervals = [0, 3, 7, 10];
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(this.shopMode ? 1200 : 2400, t);
      filt.frequency.exponentialRampToValueAtTime(650, t + dur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.09 * vel, t + 0.025);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      intervals.forEach((semi, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.value = midiToFreq(midi + semi);
        osc.detune.value = (i - 1.5) * 11;
        osc.connect(filt);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });

      filt.connect(env);
      env.connect(this.chanGains[3]);
      if (this.shopMode || (fx && fx.startsWith('0'))) {
        env.connect(this.delayInput);
      }
    }

    // CH5: Turntable Vinyl Scratch, Backspin & Formant Vocal Stab ("MEGA-BLAST!" / "YEAH!")
    synthScratchOrVox(t, inst, midi, stepDur, vel) {
      const ctx = this.ctx;
      if (inst === 5 || inst === 6) {
        // TURNTABLE VINYL SCRATCH (5) OR RECORD BACKSPIN (6)
        const isBackspin = inst === 6;
        const dur = isBackspin ? stepDur * 3.6 : stepDur * 1.5;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const noise = ctx.createBufferSource();
        noise.buffer = this.whiteNoise;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 5.5;

        const faderGate = ctx.createGain();

        if (isBackspin) {
          osc.frequency.setValueAtTime(1250, t);
          osc.frequency.exponentialRampToValueAtTime(110, t + dur);
          bp.frequency.setValueAtTime(2800, t);
          bp.frequency.exponentialRampToValueAtTime(380, t + dur);
          faderGate.gain.setValueAtTime(0.22 * vel, t);
          faderGate.gain.exponentialRampToValueAtTime(0.001, t + dur);
        } else {
          // Rapid "fwikka-fwik!" baby/transformer scratch pitch curve!
          const d3 = dur / 3;
          osc.frequency.setValueAtTime(260, t);
          osc.frequency.exponentialRampToValueAtTime(980, t + d3);
          osc.frequency.exponentialRampToValueAtTime(210, t + d3 * 2);
          osc.frequency.exponentialRampToValueAtTime(1120, t + dur);

          bp.frequency.setValueAtTime(900, t);
          bp.frequency.exponentialRampToValueAtTime(2600, t + d3);
          bp.frequency.exponentialRampToValueAtTime(750, t + d3 * 2);
          bp.frequency.exponentialRampToValueAtTime(2900, t + dur);

          // Crossfader transformer cut
          faderGate.gain.setValueAtTime(0.22 * vel, t);
          faderGate.gain.setValueAtTime(0.01, t + d3 * 1.05);
          faderGate.gain.setValueAtTime(0.24 * vel, t + d3 * 1.45);
          faderGate.gain.exponentialRampToValueAtTime(0.001, t + dur);
        }

        const nGain = ctx.createGain();
        nGain.gain.value = 0.35;
        noise.connect(nGain);
        nGain.connect(bp);
        osc.connect(bp);
        bp.connect(faderGate);
        faderGate.connect(this.chanGains[4]);

        osc.start(t);
        noise.start(t);
        osc.stop(t + dur + 0.02);
        noise.stop(t + dur + 0.02);
        return;
      }

      // FORMANT VOCAL STAB SYNTHESIZER: Inst 7 = "MEGA-BLAST!", Inst 8 = "YEAH!"
      const isMegablast = inst === 7;
      const dur = isMegablast ? 0.42 : 0.24;

      const glottis = ctx.createOscillator();
      glottis.type = 'sawtooth';
      const basePitch = isMegablast ? 132 : 165;
      glottis.frequency.setValueAtTime(basePitch * 1.08, t);
      if (isMegablast) {
        // "ME - GA - BLAST!" robotic B-boy vocal pitch contour
        glottis.frequency.setValueAtTime(145, t);
        glottis.frequency.setValueAtTime(130, t + 0.10);
        glottis.frequency.setValueAtTime(162, t + 0.21);
        glottis.frequency.exponentialRampToValueAtTime(112, t + dur);
      } else {
        // "YEAH!" hype stab
        glottis.frequency.setValueAtTime(196, t);
        glottis.frequency.exponentialRampToValueAtTime(138, t + dur);
      }

      // 3 Parallel Vowel Formant Resonators (F1, F2, F3)
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      const f3 = ctx.createBiquadFilter();
      [f1, f2, f3].forEach((f, idx) => {
        f.type = 'bandpass';
        f.Q.value = idx === 0 ? 7.5 : 9.5;
      });

      if (isMegablast) {
        // /e/ ("ME") -> /a/ ("GA") -> /ae/ ("BLAST")
        f1.frequency.setValueAtTime(530, t);
        f2.frequency.setValueAtTime(1840, t);
        f3.frequency.setValueAtTime(2480, t);

        f1.frequency.linearRampToValueAtTime(730, t + 0.12);
        f2.frequency.linearRampToValueAtTime(1090, t + 0.12);

        f1.frequency.setValueAtTime(660, t + 0.21);
        f2.frequency.setValueAtTime(1720, t + 0.21);
        f3.frequency.setValueAtTime(2410, t + 0.21);
      } else {
        // /i/ -> /e/ -> /a/ ("YEAH!")
        f1.frequency.setValueAtTime(320, t);
        f2.frequency.setValueAtTime(2250, t);
        f3.frequency.setValueAtTime(2900, t);
        f1.frequency.exponentialRampToValueAtTime(720, t + dur * 0.65);
        f2.frequency.exponentialRampToValueAtTime(1240, t + dur * 0.65);
      }

      const voxSum = ctx.createGain();
      const crush = ctx.createWaveShaper();
      crush.curve = this.amigaCrushCurve;

      voxSum.gain.setValueAtTime(0.001, t);
      voxSum.gain.linearRampToValueAtTime(0.32 * vel, t + 0.01);
      if (isMegablast) {
        // Syllable articulation dips between ME - GA - BLAST!
        voxSum.gain.setValueAtTime(0.06, t + 0.095);
        voxSum.gain.linearRampToValueAtTime(0.30 * vel, t + 0.115);
        voxSum.gain.setValueAtTime(0.04, t + 0.195);
        voxSum.gain.linearRampToValueAtTime(0.38 * vel, t + 0.22);
      }
      voxSum.gain.exponentialRampToValueAtTime(0.001, t + dur);

      glottis.connect(f1);
      glottis.connect(f2);
      glottis.connect(f3);
      f1.connect(crush);
      f2.connect(crush);
      f3.connect(crush);
      crush.connect(voxSum);
      voxSum.connect(this.chanGains[4]);
      voxSum.connect(this.delayInput);

      // Sibilant "/ST!" consonant burst at the end of "MEGA-BLAST!"
      if (isMegablast) {
        const sib = ctx.createBufferSource();
        sib.buffer = this.whiteNoise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 4200;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.14 * vel, t + 0.31);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.41);
        sib.connect(hp);
        hp.connect(sg);
        sg.connect(this.chanGains[4]);
        sib.start(t + 0.31);
        sib.stop(t + 0.42);
      }

      glottis.start(t);
      glottis.stop(t + dur + 0.02);
    }

    // CH6: Punchy TR-808 / TR-909 Kick & Sub-Drop
    synthKick(t, isSubDrop, vel) {
      const ctx = this.ctx;
      const dur = isSubDrop ? 0.55 : 0.22;
      const osc = ctx.createOscillator();
      osc.type = 'sine';

      if (isSubDrop) {
        osc.frequency.setValueAtTime(115, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + dur);
      } else {
        osc.frequency.setValueAtTime(168, t);
        osc.frequency.exponentialRampToValueAtTime(46, t + 0.055);
        osc.frequency.exponentialRampToValueAtTime(38, t + dur);
      }

      const click = ctx.createOscillator();
      click.type = 'triangle';
      click.frequency.setValueAtTime(920, t);
      click.frequency.exponentialRampToValueAtTime(80, t + 0.015);
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.24 * vel, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.55 * vel, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(env);
      click.connect(clickGain);
      clickGain.connect(env);
      env.connect(this.chanGains[5]);

      osc.start(t);
      click.start(t);
      osc.stop(t + dur + 0.02);
      click.stop(t + 0.025);
    }

    // CH7A: Crispy Breakbeat Snare & Funky Ghost-Notes
    synthSnare(t, vel) {
      const ctx = this.ctx;
      const dur = vel < 0.45 ? 0.09 : 0.17;

      // Drum body shell modes
      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(215, t);
      body.frequency.exponentialRampToValueAtTime(125, t + 0.06);
      const bodyEnv = ctx.createGain();
      bodyEnv.gain.setValueAtTime(0.32 * vel, t);
      bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

      // Crispy snare wires
      const noise = ctx.createBufferSource();
      noise.buffer = this.whiteNoise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1650;
      const nEnv = ctx.createGain();
      nEnv.gain.setValueAtTime(0.34 * vel, t);
      nEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);

      body.connect(bodyEnv);
      bodyEnv.connect(this.chanGains[6]);
      noise.connect(hp);
      hp.connect(nEnv);
      nEnv.connect(this.chanGains[6]);

      body.start(t);
      noise.start(t);
      body.stop(t + 0.09);
      noise.stop(t + dur + 0.02);
    }

    // CH7B: 1988 Multi-Tap Gated Reverb Clap!
    synthGatedClap(t, vel) {
      const ctx = this.ctx;
      const noise = ctx.createBufferSource();
      noise.buffer = this.whiteNoise;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1350;
      bp.Q.value = 1.4;

      const env = ctx.createGain();
      // 4 rapid handclap micro-transients + dense gated reverb tail chopped cleanly!
      env.gain.setValueAtTime(0.36 * vel, t);
      env.gain.setValueAtTime(0.04, t + 0.009);
      env.gain.setValueAtTime(0.36 * vel, t + 0.011);
      env.gain.setValueAtTime(0.04, t + 0.020);
      env.gain.setValueAtTime(0.38 * vel, t + 0.022);
      env.gain.setValueAtTime(0.22 * vel, t + 0.035);
      env.gain.linearRampToValueAtTime(0.16 * vel, t + 0.125); // Dense gated room hold
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.155); // Hard SSL gate shut!

      noise.connect(bp);
      bp.connect(env);
      env.connect(this.chanGains[6]);
      noise.start(t);
      noise.stop(t + 0.17);
    }

    // CH8A: 6-Oscillator Metallic 808 Open/Closed Hi-Hats (with Choke Group!)
    synthHiHat(t, isOpen, vel) {
      const ctx = this.ctx;
      // Closed hat chokes ringing open hat!
      if (!isOpen && this.openHatGain) {
        try {
          this.openHatGain.gain.cancelScheduledValues(t);
          this.openHatGain.gain.setTargetAtTime(0.0001, t, 0.008);
        } catch (_) {}
      }

      const dur = isOpen ? 0.24 : 0.052;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6800;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.18 * vel, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      if (isOpen) this.openHatGain = env;

      // Metallic square ratios + noise sizzle
      const ratios = [300, 522, 800];
      for (const f of ratios) {
        const sq = ctx.createOscillator();
        sq.type = 'square';
        sq.frequency.value = f * 1.45;
        sq.connect(hp);
        sq.start(t);
        sq.stop(t + dur + 0.01);
      }
      const n = ctx.createBufferSource();
      n.buffer = this.whiteNoise;
      n.connect(hp);
      hp.connect(env);
      env.connect(this.chanGains[7]);

      n.start(t);
      n.stop(t + dur + 0.01);
    }

    // CH8B: Authentic Dual-Square TR-808 Cowbell!
    synthCowbell(t, midi, vel) {
      const ctx = this.ctx;
      const scale = midiToFreq(midi) / midiToFreq(N.G4);
      const dur = 0.15;

      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'square';
      o2.type = 'square';
      o1.frequency.value = 540 * scale;
      o2.frequency.value = 800 * scale;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 720 * scale;
      bp.Q.value = 3.2;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.24 * vel, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);

      o1.connect(bp);
      o2.connect(bp);
      bp.connect(env);
      env.connect(this.chanGains[7]);

      o1.start(t);
      o2.start(t);
      o1.stop(t + dur + 0.02);
      o2.stop(t + dur + 0.02);
    }

    // =========================================================================
    // VISUAL SYNC & ANALYSER READOUT (CALLED AT 60 FPS BY HUD & TRACKER MODAL)
    // =========================================================================
    updateVisualSync() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      while (this.visualQueue.length > 0 && this.visualQueue[0].time <= now) {
        const ev = this.visualQueue.shift();
        this.displayPattern = ev.pattern;
        this.displayRow = ev.row;
        if (ev.isBeat) this.beatPulse = 1.0;
      }
      this.beatPulse *= 0.88;
      for (let i = 0; i < 8; i++) {
        this.channels[i].vu *= 0.90;
      }
      if (this.analyser) {
        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getByteTimeDomainData(this.waveData);
      }
    }

    // =========================================================================
    // ARCADE SOUND EFFECTS SYNTHESIZER (CRISP DEDICATED SFX BUS)
    // =========================================================================
    playLaser(style = 'vulcan') {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      if (style === 'plasma') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.09);
        env.gain.setValueAtTime(0.11, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      } else if (style === 'electro') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1550, t);
        osc.frequency.setValueAtTime(880, t + 0.02);
        osc.frequency.setValueAtTime(1920, t + 0.04);
        env.gain.setValueAtTime(0.08, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      } else if (style === 'nashwan') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1320, t);
        osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
        env.gain.setValueAtTime(0.10, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(760, t);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.055);
        env.gain.setValueAtTime(0.08, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      }

      osc.connect(env);
      env.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.1);
    }

    playBounce() {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(980, t + 0.055);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.065);
    }

    playExplosion(size = 1) {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const dur = Math.min(0.85, 0.16 + size * 0.16);
      const n = this.ctx.createBufferSource();
      n.buffer = this.whiteNoise;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(110, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(Math.min(0.4, 0.16 + size * 0.08), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      n.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      n.start(t);
      n.stop(t + dur + 0.02);
    }

    playCashPickup(tier = 1) {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const notes = tier >= 3 ? [60, 64, 67, 72, 76] : [64, 67, 72];
      notes.forEach((m, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(m + 12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, t + i * 0.032);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.032 + 0.08);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t + i * 0.032);
        osc.stop(t + i * 0.032 + 0.09);
      });
    }

    playChronoRewindTick(frameCount) {
      if (!this.ctx || this.masterMuted || (frameCount % 5 !== 0)) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const base = 320 + ((frameCount * 19) % 420);
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.065);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.075);
    }

    playNashwanSiren() {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.22);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.35);
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.58);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.65);
      // Also shout "MEGA-BLAST!" on CH5!
      this.synthScratchOrVox(t + 0.08, 7, 60, 0.12, 1.0);
    }

    playCrispinBlip(seed = 0) {
      if (!this.ctx || this.masterMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      const f = 155 + ((seed * 37) % 130);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.18, t + 0.035);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 920;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  XENON.audio = new TrackerAudioEngine();
})();
