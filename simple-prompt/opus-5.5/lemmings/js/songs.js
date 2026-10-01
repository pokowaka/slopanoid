/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — songs.js
 * One song per genre world, written as tracker patterns (64 steps = 4 bars
 * of 16ths). Five stem channels: DRUMS, BASS, CHORDS, LEAD, FULL.
 *
 * Notation (one char per 16th step):
 *   lead / mel : scale degrees 0-9 then a-e (=10..14) in the world scale,
 *                '-' = hold, '.' = rest
 *   bass       : chord-relative: r root, o octave, f fifth, t third,
 *                l low fifth; or `bassDeg` in absolute scale degrees
 *   chord      : x strike, '-' hold, '.' off
 *   arp        : chord-tone cycle (0,1,2 = triad; 3,4,5 = +octave)
 *   drums      : per-voice 16-char bar strings (x / o / g=ghost)
 *   brk        : jungle break chops - hex slice index per step
 * Chords are semitone offsets from the world root.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const bar4 = (s) => (Array.isArray(s) ? s : [s, s, s, s]);

  BT.SONGS = [
    /* ---------------- WORLD 1 : AMIGA CHIP GARDEN (C maj pent) ---------------- */
    {
      title: 'PAULA\'S GARDEN PARTY',
      inst: { kick: 'chipKick', snare: 'chipSnare', hat: 'chipHat', open: 'chipHat', bass: 'chipBass', chord: 'chipArp', lead: 'chipLead', full: 'chipArpHi', foot: 'chipBlip' },
      order: [0, 1, 0, 2],
      patterns: [
        {
          chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
          drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', fill: { s: '....x.......x.xx' } },
          bass: 'r.o.r.o.r.o.r.or',
          chord: 'x-------x-------',
          lead: '5-7-8-7-5---3-5-' + '4---5-4-2---0-2-' + '4-5-7---5-4-5---' + '3-4-3-1-3-----..',
          arp: '01234321',
        },
        {
          chords: [[-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-3, 0, 4]],
          drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.', fill: { s: '....x...x.x.xxxx' } },
          bass: 'r.r.o.r.r.r.o.f.',
          chord: 'x---x---x---x---',
          lead: '7.7.5.7.9-7-5-4-' + '5.5.3.5.7-5-3-2-' + '3.3.1.3.4-3-1-0-' + '2-4-5-7-9-------',
          arp: '0123',
        },
        {
          chords: [[-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2]],
          drums: { k: 'x.........x.....', s: '........x.......', h: '..x...x...x...x.', fill: { s: '....x.x.x.xxxxxx' } },
          bass: 'r---o---r---o---',
          chord: 'x---------------',
          lead: '9-------7---5---' + '7-------5---4---' + '5---7---8---a---' + '8-------7-8-6---',
          arp: '02130213',
        },
      ],
    },
    /* ---------------- WORLD 2 : ACID WAREHOUSE (E phrygian) ---------------- */
    {
      title: 'SQUELCH FACTORY 303',
      inst: { kick: 'kick909', snare: 'clap', hat: 'hat', open: 'hatOpen', bass: 'acid', chord: 'stab', lead: 'fmLead', full: 'acidHi', foot: 'fmPluck' },
      order: [0, 0, 1, 2],
      patterns: [
        {
          chords: [[0, 3, 7], [0, 3, 7], [1, 5, 8], [0, 3, 7]],
          drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.', fill: { s: '....x.......x.xx' } },
          bassDeg: '0.70.0.3.07.0.5.' + '0.70.0.3.07.2.3.' + '1.81.1.3.18.1.5.' + '0.70.3.5.7-5-3-2',
          acc: '^..^...^..^....^' + '^..^...^..^..^..' + '^..^...^..^....^' + '^...^...^.^.^.^.',
          sld: '..~.......~.....' + '..~.......~.....' + '..~.......~.....' + '.........~.~.~..',
          chord: '..x...x...x...x.',
          lead: '7...7...8...7...' + '................' + '7...7...8...9-8-' + '7...............',
          arp: '0303',
        },
        {
          chords: [[0, 3, 7], [1, 5, 8], [3, 7, 10], [1, 5, 8]],
          drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.', fill: { s: '....x...x.x.xxxx' } },
          bassDeg: '07.0.30.7.0.5.3.' + '18.1.31.8.1.5.3.' + '3a.3.53.a.3.7.5.' + '18.1.31.8.5.3.1.',
          acc: '^.^...^...^...^.' + '^.^...^...^...^.' + '^.^...^...^...^.' + '^.^...^.^.^.^.^.',
          sld: '.~.......~......' + '.~.......~......' + '.~.......~......' + '.~.....~.~.~.~..',
          chord: 'x..x..x...x..x..',
          lead: '9-8-7...9-8-7...' + '8-7-5...8-7-5...' + 'a-9-8...a-9-8...' + 'b---a---9---8---',
          arp: '012',
        },
        {
          chords: [[5, 8, 12], [3, 7, 10], [1, 5, 8], [0, 3, 7]],
          drums: { k: 'x.......x.......', s: '................', h: '..x...x...x...x.', o: '................', fill: { k: 'x.x.x.x.xxxxxxxx', s: 'x.x.x.x.xxxxxxxx' } },
          bassDeg: '3---3---3-3-3---' + '2---2---2-2-2---' + '1---1---1-1-1---' + '0-0-0-0-0000000',
          acc: '^.......^.^.^...' + '^.......^.^.^...' + '^.......^.^.^...' + '^.^.^.^.^^^^^^^^',
          sld: '................' + '................' + '................' + '................',
          chord: 'x---------------',
          lead: 'a-------9-------' + '9-------8-------' + '8-------7-------' + '7---------------',
          arp: '0123',
        },
      ],
    },
    /* ---------------- WORLD 3 : SYNTHWAVE SUNSET (D dorian) ---------------- */
    {
      title: 'CHROME HORIZON',
      inst: { kick: 'kick808', snare: 'gatedSnare', hat: 'hat', open: 'hatOpen', bass: 'synthBass', chord: 'pad', lead: 'sawLead', full: 'synthArp', foot: 'synthPluck' },
      order: [0, 1, 0, 2],
      patterns: [
        {
          chords: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [5, 9, 12]],
          drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', fill: { s: '....x.......xxxx' } },
          bass: 'rrorrrorrrorrror',
          chord: 'x---------------',
          lead: '7-------9---8-7-' + '9-------a---9-8-' + '6-------8---7-6-' + '5-------3-4-5-7-',
          arp: '0123',
        },
        {
          chords: [[0, 3, 7], [5, 9, 12], [7, 10, 14], [-2, 2, 5]],
          drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', fill: { s: '....x...x.xxxxxx' } },
          bass: 'r.ror.ror.ror.ro',
          chord: 'x-------x-------',
          lead: '4-7-9-7-4-7-9-a-' + 'a-------9-7-5---' + '4-8-b-8-4-8-b-c-' + 'd-------c-b-9---',
          arp: '0132',
        },
        {
          chords: [[3, 7, 10], [5, 9, 12], [0, 3, 7], [0, 3, 7]],
          drums: { k: 'x...............', s: '............x...', h: '..x...x...x...x.', fill: { k: 'x...x...x...x...', s: '....x...x.x.xxxx' } },
          bass: 'r---------------',
          chord: 'x---------------',
          lead: '9---------------' + 'a-------b---c---' + '7---------------' + '................',
          arp: '012345',
        },
      ],
    },
    /* ---------------- WORLD 4 : JUNGLE BREAKBEAT CAVES (A min pent) ---------------- */
    {
      title: 'AMEN BIOLUMINESCENCE',
      inst: { kick: 'kick808', snare: 'snare', hat: 'hat', open: 'hatOpen', bass: 'sub', chord: 'rhodes', lead: 'flute', full: 'reese', foot: 'marimba' },
      order: [0, 1, 0, 2],
      patterns: [
        {
          chords: [[0, 3, 7, 10], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9]],
          drums: {},
          brk: ['0123456789abcdef', '0123456789a2cde4', '0123456789abcdef', '01234567c4c4ccc4'],
          bass: 'r---------r-o---',
          chord: 'x-----x---------',
          lead: '5-------6-5-3---' + '2-----3-4-------' + '3-------5-6-7---' + '6-----5-4-------',
          arp: '0213',
        },
        {
          chords: [[0, 3, 7], [-5, -2, 2], [-4, 0, 3], [-2, 2, 5]],
          drums: {},
          brk: ['0123456789abcdef', '01234c4c89ab4c4f', '0123456789abc4ef', '0.2.4.6.4c4c4ccc'],
          bass: 'r-----r---o-r---',
          chord: 'x---x---x---x---',
          lead: '7-8-7-5-7-------' + '6-7-6-4-3-------' + '5-6-5-3-2-3-5---' + '8-------7-------',
          arp: '0123',
        },
        {
          chords: [[-4, 0, 3, 7], [-2, 2, 5, 9], [0, 3, 7, 10], [0, 3, 7, 10]],
          drums: { k: 'x.........x.....' },
          brk: ['................', '................', '0123456789abcdef', '0123c4c4c4c4cccc'],
          bass: 'r---------------',
          chord: 'x---------------',
          lead: '9---------------' + '8-------7-------' + '5---------------' + '................',
          arp: '012345',
        },
      ],
    },
    /* ---------------- WORLD 5 : GRAND ORCHESTRAL FINALE (F lydian) ---------------- */
    {
      title: 'SYMPHONY FOR A TRIBE',
      inst: { kick: 'granCassa', snare: 'snareRoll', hat: 'triangle', open: 'cymbal', bass: 'celli', chord: 'strings', lead: 'brass', full: 'celesta', foot: 'pizz' },
      timpani: true,
      order: [0, 1, 0, 2],
      patterns: [
        {
          chords: [[0, 4, 7], [2, 6, 9], [4, 7, 11], [-5, -1, 2]],
          drums: { t: 'x.......x...x...', h: '....x.......x...', fill: { t: 'x.......x.x.xxxx', s: '........xxxxxxxx' } },
          bass: 'r---r---r---o---',
          chord: 'x---------------',
          lead: '4-------7---4---' + '5-------8---5---' + '6---7---8---9---' + 'b-------9---8---',
          arp: '0123',
        },
        {
          chords: [[-3, 0, 4], [2, 6, 9], [-5, -1, 2], [0, 4, 7]],
          drums: { t: 'x...x...x...x...', h: 'x...x...x...x...', k: 'x...............', fill: { s: '....xxxxxxxxxxxx' } },
          bass: 'r-r-r-r-o-o-r-r-',
          chord: 'x-------x-------',
          lead: '9-8-9-b-9-8-7---' + '8-7-8-a-8-7-5---' + '7-5-4-5-7-8-9---' + '7---------------',
          arp: '012345',
        },
        {
          chords: [[0, 4, 7], [2, 6, 9], [0, 4, 7], [2, 6, 9]],
          drums: { t: 'x.x.x.x.x.x.x.x.', k: 'x.......x.......', o: 'x...............', fill: { t: 'xxxxxxxxxxxxxxxx', o: 'x.......x.......' } },
          bass: 'r.r.r.r.r.r.r.r.',
          chord: 'x---x---x---x---',
          lead: '7---9---b---9---' + '8---a---c---a---' + '9---b---d---b---' + 'c-----------8---',
          arp: '0123454321',
        },
      ],
    },
  ];

  /* Compile a song into per-step cells (used by the scheduler + tracker view). */
  const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  BT.noteName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + Math.floor(m / 12 - 1);
  const degOf = (ch) => {
    if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
    if (ch >= 'a' && ch <= 'e') return ch.charCodeAt(0) - 87;
    return null;
  };

  BT.compileSong = function (worldIdx, levelIdx) {
    const world = BT.WORLDS[worldIdx], src = BT.SONGS[worldIdx];
    const root = world.root;
    const rot = (levelIdx || 0) % src.order.length;
    const order = src.order.slice(rot).concat(src.order.slice(0, rot));
    const pats = src.patterns.map((p) => {
      const cells = [[], [], [], [], []]; // DRUMS BASS CHORDS LEAD FULL
      for (let s = 0; s < 64; s++) for (let c = 0; c < 5; c++) cells[c][s] = null;
      const chordAt = (s) => p.chords[Math.floor(s / 16) % p.chords.length];
      // drums
      for (let b = 0; b < 4; b++) {
        const isFill = b === 3 && p.drums.fill;
        for (let i = 0; i < 16; i++) {
          const s = b * 16 + i, hits = [];
          for (const k of ['k', 's', 'h', 'o', 't']) {
            let str = p.drums[k];
            if (isFill && p.drums.fill[k] !== undefined) str = p.drums.fill[k];
            if (!str) continue;
            const ch = bar4(str)[b][i];
            if (ch && ch !== '.') hits.push({ v: k, acc: ch === 'x' ? 1 : 0.5 });
          }
          if (p.brk) {
            const ch = bar4(p.brk)[b][i];
            if (ch && ch !== '.') hits.push({ v: 'brk', slice: parseInt(ch, 16), acc: 1 });
          }
          if (s === 0 && b === 0) hits.push({ v: 'c', acc: 0.7 });
          if (hits.length) cells[0][s] = { hits };
        }
      }
      // bass
      const bassRoot = (ch) => root - 24 + ((((ch[0] % 12) + 12) % 12));
      if (p.bassDeg) {
        for (let s = 0; s < 64; s++) {
          const ch = p.bassDeg[s], d = degOf(ch);
          if (d === null) { if (ch === '-' && s > 0) { for (let q = s - 1; q >= 0; q--) if (cells[1][q]) { cells[1][q].len++; break; } } continue; }
          cells[1][s] = { n: BT.degToMidi(world, d, -2), len: 1, acc: p.acc && p.acc[s] === '^', sld: p.sld && p.sld[s] === '~' };
        }
      } else {
        for (let s = 0; s < 64; s++) {
          const ch = p.bass[s % p.bass.length], cd = chordAt(s), r = bassRoot(cd);
          let n = null;
          if (ch === 'r') n = r; else if (ch === 'o') n = r + 12; else if (ch === 'f') n = r + (cd[2] - cd[0]);
          else if (ch === 't') n = r + (cd[1] - cd[0]); else if (ch === 'l') n = r - 5;
          if (n !== null) cells[1][s] = { n, len: 1 };
          else if (ch === '-') { for (let q = s - 1; q >= 0; q--) if (cells[1][q]) { cells[1][q].len++; break; } }
        }
      }
      // chords
      for (let s = 0; s < 64; s++) {
        const ch = p.chord[s % p.chord.length];
        if (ch === 'x') cells[2][s] = { notes: chordAt(s).map((o) => root + o), len: 1 };
        else if (ch === '-') { for (let q = s - 1; q >= 0 && q >= s - 16; q--) if (cells[2][q]) { cells[2][q].len++; break; } }
      }
      // lead
      let last = null;
      for (let s = 0; s < 64; s++) {
        const ch = p.lead[s], d = degOf(ch);
        if (d !== null) last = cells[3][s] = { n: BT.degToMidi(world, d, 1), len: 1 };
        else if (ch === '-' && last) last.len++;
        else last = null;
      }
      // full mix: arpeggio over the chord, +1 octave
      for (let s = 0; s < 64; s++) {
        const a = p.arp[s % p.arp.length], cd = chordAt(s), k = +a;
        const n = root + 12 + cd[k % cd.length] + 12 * Math.floor(k / cd.length);
        cells[4][s] = { n, len: 1 };
      }
      return { cells, chords: p.chords };
    });
    return { world, src, order, pats, root, bpm: world.bpm };
  };
})(typeof window !== 'undefined' ? window : globalThis);
