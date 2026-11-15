/* BEAT TRIBE - tracker song data (pure data, no Web Audio here).
 *
 * Each world has one song: an order list chaining 64-step patterns (4 bars of 1/16).
 * Every channel belongs to a stem (0 DRUMS, 1 BASS, 2 CHORDS, 3 LEAD, 4 FULL MIX),
 * stems are unlocked in audio.js as lemmings are saved.
 *
 * Pattern notation, one character per 1/16 step ('|' and spaces are ignored):
 *   drums : x hit, X accent, o ghost, . nothing
 *   notes : 0-9 a-z = degree of the world's 7-note mode above the channel base
 *           (7 = one octave up), '-' sustain, '.' rest
 *   chords: a letter from song.chords, '-' sustain, '.' rest
 *   a channel may be [notes, flags]: flags 'a' accent, 's' slide, 'b' both (TB-303 style)
 * `root` = chord root (mode degree) of each of the 4 bars; blockers drone on it. */
(function (g) {
  'use strict';
  var BT = g.BT;

  var S = BT.SONGS = {};

  // ------------------------------------------------------------------ TRAINING MEADOW (C major, 108)
  S.meadow = {
    chans: [
      { n: 'KICK', stem: 0, inst: 'kickchip', vol: 0.9 },
      { n: 'SNAR', stem: 0, inst: 'snarechip', vol: 0.7 },
      { n: 'HAT', stem: 0, inst: 'hatchip', vol: 0.35 },
      { n: 'BASS', stem: 1, inst: 'tri', base: 36, vol: 0.5 },
      { n: 'ARP', stem: 2, inst: 'chiparp', base: 60, vol: 0.4, chord: true },
      { n: 'LEAD', stem: 3, inst: 'pulse', base: 72, vol: 0.46, send: 0.25 },
      { n: 'BELL', stem: 4, inst: 'pulse2', base: 72, vol: 0.4, send: 0.5, pan: 0.4 }
    ],
    chords: { C: [0, 2, 4], F: [3, 5, 7], G: [4, 6, 8], A: [5, 7, 9] },
    pats: {
      A: { root: [0, 0, 3, 4],
        KICK: 'x.......x.......|x.......x..x....|x.......x.......|x.......x.x.....',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......x.xx',
        HAT:  'x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.xx',
        BASS: '0.0.7.0.0.0.7.4.|0.0.7.0.0.1.2.2.|3.3.a.3.3.3.a.3.|4.4.b.4.4.5.6.6.',
        ARP:  'C-.C-.C.C-.C-.C.|C-.C-.C.C-.C-.C.|F-.F-.F.F-.F-.F.|G-.G-.G.G-.G-.G.',
        LEAD: '2-4-5-4-2-..0-1-|2-2-1-0-1---....|5-5-7-5-4-..2-4-|5-4-2-4-1---....',
        BELL: '..7...9...b...9.|..7...9...8...7.|..a...c...e...c.|..b...d...8...b.' },
      B: { root: [5, 3, 0, 4],
        KICK: 'x.......x.......|x.......x..x....|x.......x.......|x.......x.x.....',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.....x.xxxx',
        HAT:  'x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.o.|x.o.x.o.x.o.x.o.',
        BASS: '5.5.c.5.5.5.c.5.|3.3.a.3.3.3.a.3.|0.0.7.0.0.0.7.0.|4.4.b.4.4.4.5.6.',
        ARP:  'A-.A-.A.A-.A-.A.|F-.F-.F.F-.F-.F.|C-.C-.C.C-.C-.C.|G-.G-.G.G-.G-.G.',
        LEAD: '7-7-5-4-5---4-2-|5-..5-4-2-1-0---|2-4-7-4-2-4-7---|8-7-5-4-1---....',
        BELL: '..c...e...c...9.|..a...c...a...7.|..7...9...b...e.|..b...d...b...8.' }
    },
    order: ['A', 'A', 'B', 'A']
  };

  // ------------------------------------------------------------------ AMIGA CHIP GARDEN (D major, 126)
  S.garden = {
    chans: [
      { n: 'KICK', stem: 0, inst: 'kickchip', vol: 0.95 },
      { n: 'SNAR', stem: 0, inst: 'snarechip', vol: 0.75 },
      { n: 'HAT', stem: 0, inst: 'hatchip', vol: 0.34 },
      { n: 'BASS', stem: 1, inst: 'tri', base: 38, vol: 0.5 },
      { n: 'ARP', stem: 2, inst: 'chiparp', base: 62, vol: 0.42, chord: true, pan: -0.25 },
      { n: 'LEAD', stem: 3, inst: 'pulse', base: 74, vol: 0.44, send: 0.3 },
      { n: 'ECHO', stem: 4, inst: 'pulse2', base: 62, vol: 0.3, send: 0.45, pan: 0.35 },
      { n: 'CRSH', stem: 4, inst: 'crash', vol: 0.4 }
    ],
    chords: { D: [0, 2, 4], B: [5, 7, 9], G: [3, 5, 7], A: [4, 6, 8], F: [2, 4, 6] },
    pats: {
      A: { root: [0, 5, 3, 4],
        KICK: 'x.......x.x.....|x.......x.x.....|x.......x.x.....|x.......x.x...x.',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......x.xx',
        HAT:  'x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.',
        BASS: '0.7.0.7.0.7.0.7.|5.c.5.c.5.c.5.c.|3.a.3.a.3.a.3.a.|4.b.4.b.4.b.6.b.',
        ARP:  'D-.D-.D-D-.D-.D-|B-.B-.B-B-.B-.B-|G-.G-.G-G-.G-.G-|A-.A-.A-A-.A-.A-',
        LEAD: '4-..4-5-4-2-0-..|2-..2-4-2-1-0-1-|2-..2-4-5-7-5-4-|5---4---1-2-4---',
        ECHO: '2-------7-------|2-------7-------|0-------5-------|1-------6-------',
        CRSH: 'X...............|................|................|................' },
      B: { root: [3, 4, 2, 5],
        KICK: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.x.',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......xxxx',
        HAT:  '..x...x...x...x.|..x...x...x...x.|..x...x...x...x.|..x...x...x...x.',
        BASS: '3.a.3.a.3.a.3.a.|4.b.4.b.4.b.4.b.|2.9.2.9.2.9.2.9.|5.c.5.c.5.c.4.b.',
        ARP:  'G--------------.|A--------------.|F--------------.|B--------------.',
        LEAD: '7---5-4-5---4-2-|4---2-1-2---1-0-|2-4-5-4-2-4-5-7-|9---7---5---4---',
        ECHO: '5-------7-------|6-------8-------|4-------6-------|5-------7-------',
        CRSH: 'X...............|................|................|................' },
      C: { root: [3, 4, 0, 0],
        KICK: 'x.......x.x.....|x.......x.x.....|x.......x.x.....|x.......x.x.x.x.',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......x.xx',
        HAT:  'x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.|x.xxx.x.x.xxx.x.',
        BASS: '3.a.3.a.3.a.3.a.|4.b.4.b.4.b.4.b.|0.7.0.7.0.7.0.7.|0.7.0.7.0.0.4.6.',
        ARP:  'G-.G-.G-G-.G-.G-|A-.A-.A-A-.A-.A-|D-.D-.D-D-.D-.D-|D-.D-.D-D-.D-.D-',
        LEAD: '7-5-7-9-7-5-4-5-|8-6-8-b-8-6-4-6-|7---9---b---9-7-|7-----------....',
        ECHO: '5-------7-------|6-------8-------|4-------7-------|9-------7-------',
        CRSH: 'X...............|................|X...............|................' },
      D: { root: [5, 3, 4, 4],
        KICK: 'x.......x.......|x.......x.......|x...x...x...x...|x.x.x.x.xxxxxxxx',
        SNAR: '................|................|....x.......x...|....x.x.x.xxxxxx',
        HAT:  'x...x...x...x...|x...x...x...x...|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx',
        BASS: '5...5...5...5...|3...3...3...3...|4...4...4...4...|4.4.4.4.4.4.4.4.',
        ARP:  'B-------B-------|G-------G-------|A-------A-------|A---A---A-A-A-A-',
        LEAD: '5-......5-......|4-......4-......|1-..1-..2-..2-..|4-4-4-4-6-6-8-8-',
        ECHO: '................|................|................|................',
        CRSH: '................|................|................|................' }
    },
    order: ['A', 'A', 'B', 'A', 'C', 'D', 'A', 'B']
  };

  // ------------------------------------------------------------------ ACID WAREHOUSE (A Phrygian, 132)
  S.acid = {
    chans: [
      { n: 'KICK', stem: 0, inst: 'kick909', vol: 1.0 },
      { n: 'CLAP', stem: 0, inst: 'clap', vol: 0.6 },
      { n: 'HAT', stem: 0, inst: 'hat909', vol: 0.3 },
      { n: 'OHAT', stem: 0, inst: 'ohat', vol: 0.3 },
      { n: 'BASS', stem: 1, inst: 'subpulse', base: 33, vol: 0.8 },
      { n: 'STAB', stem: 2, inst: 'stab', base: 45, vol: 0.7, chord: true, send: 0.4 },
      { n: '303', stem: 3, inst: 'acid', base: 45, vol: 0.5, send: 0.3 },
      { n: '303B', stem: 4, inst: 'acid2', base: 57, vol: 0.3, send: 0.45, pan: 0.3 },
      { n: 'RIDE', stem: 4, inst: 'ride', vol: 0.22 }
    ],
    chords: { a: [7, 9, 11], b: [8, 10, 12], g: [6, 8, 10], d: [3, 5, 7] },
    pats: {
      A: { root: [0, 0, 0, 6],
        KICK: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x.x.',
        CLAP: '....x.......x...|....x.......x...|....x.......x...|....x.......x..x',
        HAT:  'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx',
        OHAT: '..x...x...x...x.|..x...x...x...x.|..x...x...x...x.|..x...x...x...x.',
        BASS: '..0...0...0...0.|..0...0...0..0.7|..0...0...0...0.|..6...6...6..6.6',
        STAB: 'a.....a.........|......b.....a...|a.....a.........|..g...g...b.a...',
        '303': ['00.7.00.1.0.60.7|00.7.00.2.1.00.4|00.7.00.1.0.60.7|00.0.01.0.1.2468',
                '....aa......s..a|.a..a...a.s.....|....aa......s..a|.....a....a.sssb'],
        '303B': '....9...........|..........9.7...|....9.......b...|9...9...9.9.9999',
        RIDE: 'X...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x...x...' },
      B: { root: [0, 1, 0, 6],
        KICK: 'x...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x..xx.x.',
        CLAP: '....x.......x...|....x.......x...|....x.......x...|....x.......xxxx',
        HAT:  'x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx|x.xxx.xxx.xxx.xx',
        OHAT: '..x...x...x...x.|..x...x...x...x.|..x...x...x...x.|..x...x...x...x.',
        BASS: '..0...0...0...0.|..1...1...1..1.1|..0...0...0...0.|..6...6...6.6.6.',
        STAB: 'a..a..a...a.....|b..b..b...b.....|a..a..a...a.....|g..g..g...b.a.a.',
        '303': ['77.0.77.8.7.60.4|88.1.88.7.8.a8.7|77.0.77.8.7.60.4|66.4.66.4.6.789b',
                'a...a...a.s.s...|a...a...a.s.s...|a...a...a.s.s...|a...a.....a.sssb'],
        '303B': '..7.....7...9.7.|..8.....8...a.8.|..7.....7...9.7.|..6.....6...6789',
        RIDE: 'X...x...x...x...|x...x...x...x...|x...x...x...x...|x...x...x.x.x.x.' },
      C: { root: [0, 0, 0, 0],
        KICK: 'x...............|x...............|x.......x.......|x...x...x.x.xxxx',
        CLAP: '................|................|............x...|....x...x.x.xxxx',
        HAT:  'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.xxx.xxx.xxx.xx|xxxxxxxxxxxxxxxx',
        OHAT: '................|................|..x...x...x...x.|..x...x...x...x.',
        BASS: '0---------------|0---------------|0-------0-------|0---0---0-0-0-0-',
        STAB: 'a...............|........b.......|a...............|a...a...a.a.a.a.',
        '303': ['0...........0.0.|0...........1.0.|0.......0...0.07|0.0.0.0.00000000',
                '............s...|............s...|..............sa|a.a.a.a.aaaaaaab'],
        '303B': '................|................|....9.......9...|9.9.9.9.9999bbbb',
        RIDE: 'X...............|................|................|................' }
    },
    order: ['A', 'A', 'B', 'A', 'C', 'B', 'A', 'B']
  };

  // ------------------------------------------------------------------ SYNTHWAVE SUNSET (D Dorian, 104)
  S.sunset = {
    chans: [
      { n: 'KICK', stem: 0, inst: 'kickbig', vol: 1.0 },
      { n: 'SNAR', stem: 0, inst: 'gated', vol: 0.75 },
      { n: 'HAT', stem: 0, inst: 'hat909', vol: 0.26 },
      { n: 'TOM', stem: 0, inst: 'tom', base: 38, vol: 0.7, pan: -0.3 },
      { n: 'BASS', stem: 1, inst: 'sawbass', base: 38, vol: 0.7 },
      { n: 'PAD', stem: 2, inst: 'pad', base: 50, vol: 0.22, chord: true, send: 0.2 },
      { n: 'LEAD', stem: 3, inst: 'fmlead', base: 74, vol: 0.34, send: 0.5 },
      { n: 'ARP', stem: 4, inst: 'pluck', base: 62, vol: 0.32, send: 0.45, pan: 0.3 }
    ],
    chords: { d: [0, 2, 4, 6], g: [3, 5, 7], a: [4, 6, 8], c: [6, 8, 10], f: [2, 4, 6, 8] },
    pats: {
      A: { root: [0, 3, 0, 6],
        KICK: 'x.....x.x.......|x.....x.x.......|x.....x.x.......|x.....x.x.....x.',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......x...',
        HAT:  'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
        TOM:  '................|................|................|............b.74',
        BASS: '0.0.0.0.0.0.0.7.|3.3.3.3.3.3.3.a.|0.0.0.0.0.0.7.0.|6.6.6.6.6.6.6.d.',
        PAD:  'd--------------.|g--------------.|d--------------.|c--------------.',
        LEAD: '4-------7-----6-|5-----------4-5-|7-------9-----8-|8-------------..',
        ARP:  '0247024702470247|357a357a357a357a|0247024702470247|68ad68ad68ad68ad' },
      B: { root: [2, 6, 3, 4],
        KICK: 'x.....x.x.......|x.....x.x.......|x.....x.x.......|x.....x.x...x...',
        SNAR: '....x.......x...|....x.......x...|....x.......x...|....x.......x.xx',
        HAT:  'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
        TOM:  '................|................|................|........b.b.7.4.',
        BASS: '2.2.2.2.2.2.2.9.|6.6.6.6.6.6.6.6.|3.3.3.3.3.3.3.3.|4.4.4.4.4.4.4.b.',
        PAD:  'f--------------.|c--------------.|g--------------.|a--------------.',
        LEAD: '9-----8-7-----6-|8-------6---4---|5-----6-7-----8-|8---7---6---4---',
        ARP:  '2469246924692469|68ad68ad68ad68ad|357a357a357a357a|468b468b468b468b' },
      C: { root: [0, 0, 3, 3],
        KICK: 'x...............|x...............|x.......x.......|x...x...x...x.x.',
        SNAR: '................|............x...|....x.......x...|....x.......xxxx',
        HAT:  '..x...x...x...x.|..x...x...x...x.|x.x.x.x.x.x.x.x.|x.x.x.x.xxxxxxxx',
        TOM:  '................|................|................|b.b.7.7.4.4.0.0.',
        BASS: '0---------------|0---------------|3---------------|3-------3.3.3.3.',
        PAD:  'd--------------.|d--------------.|g--------------.|g--------------.',
        LEAD: '....4---7---9---|8-----------....|....5---7---a---|9-------8-------',
        ARP:  '0.4.7.4.0.4.7.4.|0.4.7.4.0.4.7.9.|3.5.7.5.3.5.7.5.|357a357a357a357a' }
    },
    order: ['A', 'A', 'B', 'A', 'C', 'B', 'A', 'B']
  };

  // ------------------------------------------------------------------ JUNGLE BREAKBEAT CAVES (F minor, 168)
  S.cave = {
    chans: [
      { n: 'KICK', stem: 0, inst: 'kickjungle', vol: 1.0 },
      { n: 'SNAR', stem: 0, inst: 'snarebreak', vol: 0.8 },
      { n: 'RIDE', stem: 0, inst: 'hatbreak', vol: 0.3, pan: 0.2 },
      { n: 'SUB', stem: 1, inst: 'sub', base: 29, vol: 0.45 },
      { n: 'PAD', stem: 2, inst: 'pad', base: 53, vol: 0.24, chord: true, send: 0.3 },
      { n: 'BELL', stem: 3, inst: 'bell', base: 77, vol: 0.36, send: 0.55 },
      { n: 'STAB', stem: 4, inst: 'stab', base: 65, vol: 0.4, chord: true, send: 0.4, pan: -0.3 },
      { n: 'SHKR', stem: 4, inst: 'shaker', vol: 0.3, pan: 0.4 }
    ],
    chords: { f: [0, 2, 4, 6], d: [5, 7, 9], e: [6, 8, 10], b: [3, 5, 7] },
    pats: {
      A: { root: [0, 0, 5, 6],
        KICK: 'x.x.......xx....|x.x.......x.....|x.x.......xx....|x.x......x..x...',
        SNAR: '....x..o.o..x..o|....x..o.o..x.xx|....x..o.o..x..o|....x..o.ox.x.xx',
        RIDE: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
        SUB:  '0-----------0---|0-------6---0---|5-----------5---|6-------6---4---',
        PAD:  'f--------------.|f--------------.|d--------------.|e--------------.',
        BELL: '7-....6-7-....4-|....7-6-4-..3-2-|7-....6-7-....9-|a-..9-..7-..6-..',
        STAB: '..f.....f.......|..f.....f..f....|..d.....d.......|..e.....e..e.e..',
        SHKR: 'xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo' },
      B: { root: [3, 0, 5, 6],
        KICK: 'x.x.......xx....|x.x.....x.x.....|x.x.......xx....|x..x..x.....x...',
        SNAR: '....x..o.o..x..o|....x..x.x..x..x|....x..o.o..x..o|..x..x..x.xxx.xx',
        RIDE: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
        SUB:  '3-----------3---|0-------0---2---|5---------------|6-------4-6-7---',
        PAD:  'b--------------.|f--------------.|d--------------.|e--------------.',
        BELL: '3-....4-6-....4-|7-..6-..4-..2-..|7-....9-a-....9-|b-..a-..9-7-6-4-',
        STAB: '..b.....b.......|..f.....f..f....|..d.....d.......|..e..e..e..e.e.e',
        SHKR: 'xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo' },
      C: { root: [0, 0, 0, 0],
        KICK: 'x...............|x.........x.....|x.x.......xx....|x.x.......x.....',
        SNAR: '................|............x...|....x..o.o..x..o|....x..o.ox.xxxx',
        RIDE: 'x...x...x...x...|x...x...x...x...|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.',
        SUB:  '0---------------|0---------------|0-----------0---|0-------6---4---',
        PAD:  'f--------------.|f--------------.|f--------------.|e--------------.',
        BELL: '7-....9-b-......|9-....7-6-......|7-....9-b-....e-|d-..b-..9-..7-..',
        STAB: '................|................|..f.....f.......|..e.....e..e.e..',
        SHKR: '................|................|xoxoxoxoxoxoxoxo|xoxoxoxoxoxoxoxo' }
    },
    order: ['A', 'A', 'B', 'A', 'C', 'B', 'A', 'B']
  };

  // ------------------------------------------------------------------ GRAND ORCHESTRAL FINALE (G Lydian, 96)
  S.hall = {
    chans: [
      { n: 'TIMP', stem: 0, inst: 'timp', base: 31, vol: 0.75 },
      { n: 'SNAR', stem: 0, inst: 'snareorch', vol: 0.5 },
      { n: 'CYMB', stem: 0, inst: 'crash', vol: 0.45 },
      { n: 'CELL', stem: 1, inst: 'cello', base: 31, vol: 0.5 },
      { n: 'STRG', stem: 2, inst: 'strings', base: 55, vol: 0.28, chord: true, send: 0.25 },
      { n: 'BRAS', stem: 3, inst: 'brass', base: 67, vol: 0.4, send: 0.3 },
      { n: 'GLOK', stem: 4, inst: 'glock', base: 79, vol: 0.3, send: 0.5, pan: 0.35 },
      { n: 'CHOR', stem: 4, inst: 'choir', base: 55, vol: 0.26, chord: true, send: 0.3, pan: -0.3 }
    ],
    chords: { g: [0, 2, 4], a: [1, 3, 5], e: [5, 7, 9], d: [4, 6, 8], b: [2, 4, 6], G: [0, 4, 7], A: [1, 5, 8], E: [5, 9, 12], D: [4, 8, 11], B: [2, 6, 9] },
    pats: {
      A: { root: [0, 1, 0, 4],
        TIMP: '0.......4...0...|0.......4...0...|0.......4...0...|4.......4.4.4444',
        SNAR: '....o.....o.ooo.|....o.....o.ooo.|....o.....o.ooo.|....o...o.o.xxxx',
        CYMB: 'X...............|................|................|................',
        CELL: '0-------0---4---|1-------1---5---|0-------0---2---|4-------4---6---',
        STRG: 'g--------------.|a--------------.|g--------------.|d--------------.',
        BRAS: '4---4-4-7-------|8---8-8-a-------|b-----a-9---7---|8-------------..',
        GLOK: '0.2.4.7.4.2.4.7.|1.3.5.8.5.3.5.8.|0.2.4.7.4.2.4.7.|4.6.8.b.8.6.8.b.',
        CHOR: 'G--------------.|A--------------.|G--------------.|D--------------.' },
      B: { root: [5, 1, 4, 0],
        TIMP: '5.......5...5...|1.......1...1...|4.......4...4...|0.......0.0.0000',
        SNAR: '....o.....o.ooo.|....o.....o.ooo.|....o.....o.ooo.|....o...o.o.xxxx',
        CYMB: 'X...............|................|................|................',
        CELL: '5-------5---9---|1-------1---5---|4-------4---8---|0-------0---4---',
        STRG: 'e--------------.|a--------------.|d--------------.|g--------------.',
        BRAS: '7---9---b-------|a---8---a---c---|b-----a-8---6---|7-------------..',
        GLOK: '5.7.9.c.9.7.9.c.|1.3.5.8.5.3.5.8.|4.6.8.b.8.6.8.b.|0.2.4.7.4.2.4.7.',
        CHOR: 'E--------------.|A--------------.|D--------------.|G--------------.' },
      C: { root: [0, 2, 1, 4],
        TIMP: '0...............|2...............|1.......1.......|4...4...4.4.4444',
        SNAR: '................|................|....o.....o.ooo.|..o.o.o.oooxxxxx',
        CYMB: '................|................|................|............X...',
        CELL: '0---------------|2---------------|1-------1-------|4---4---4-4-4-4-',
        STRG: 'g--------------.|b--------------.|a--------------.|d--------------.',
        BRAS: '....7---9---b---|9-----------....|....8---a---c---|b-------8-------',
        GLOK: '0.4.7.4.b.7.4.7.|2.6.9.6.d.9.6.9.|1.5.8.5.c.8.5.8.|4.8.b.8.f.b.8.b.',
        CHOR: 'G--------------.|B--------------.|A--------------.|D--------------.' }
    },
    order: ['A', 'A', 'B', 'A', 'C', 'B']
  };

  // ------------------------------------------------------------------ compile
  function strip(s) { return s.replace(/[|\s]/g, ''); }
  function compile(key, song, world) {
    var pn, ci, ch, pat, raw, notes, flags, row, c, f, cells, cur, n, k;
    song.key = key; song.rows = {};
    for (pn in song.pats) {
      pat = song.pats[pn]; song.rows[pn] = [];
      if (!pat.root || pat.root.length !== 4) throw new Error(key + '/' + pn + ': needs 4 chord roots');
      for (ci = 0; ci < song.chans.length; ci++) {
        ch = song.chans[ci]; raw = pat[ch.n]; cells = new Array(64); cur = null;
        if (raw === undefined) throw new Error(key + '/' + pn + ': missing channel ' + ch.n);
        notes = strip(typeof raw === 'string' ? raw : raw[0]);
        flags = typeof raw === 'string' ? null : strip(raw[1]);
        if (notes.length !== 64 || (flags && flags.length !== 64)) throw new Error(key + '/' + pn + '/' + ch.n + ': pattern is ' + notes.length + ' steps, expected 64');
        for (row = 0; row < 64; row++) {
          c = notes.charAt(row); f = flags ? flags.charAt(row) : '.';
          if (c === '.') { cur = null; continue; }
          if (c === '-') { if (cur) cur.len++; continue; }
          cur = { v: 0.8, len: 1, acc: f === 'a' || f === 'b', sl: f === 's' || f === 'b' };
          if (ch.base === undefined) {                                  // drum
            cur.v = c === 'X' ? 1 : c === 'o' ? 0.42 : 0.8; cur.m = 0; cur.txt = c === 'o' ? '.o.' : c === 'X' ? '###' : '-x-';
          } else if (ch.chord) {
            k = song.chords[c];
            if (!k) throw new Error(key + '/' + pn + '/' + ch.n + ': unknown chord ' + c);
            cur.m = k.map(function (d) { return BT.modeMidi(world, ch.base, d); });
            cur.txt = BT.noteName(cur.m[0]).slice(0, 2).replace('-', '') + (k.length > 3 ? '7' : '') + '*';
            while (cur.txt.length < 3) cur.txt += '*';
          } else {
            n = parseInt(c, 36);
            if (isNaN(n)) throw new Error(key + '/' + pn + '/' + ch.n + ': bad note ' + c);
            cur.m = BT.modeMidi(world, ch.base, n);
            cur.txt = BT.noteName(cur.m);
          }
          cells[row] = cur;
        }
        song.rows[pn].push(cells);
      }
    }
    song.order.forEach(function (p) { if (!song.rows[p]) throw new Error(key + ': order references unknown pattern ' + p); });
  }
  BT.WORLDS.forEach(function (w) { compile(w.key, S[w.key], w); w.song = S[w.key]; });

  // Pattern position helpers shared by the sim (drone pitch), the audio engine and the mixer view.
  BT.songPos = function (song, step) {
    var o = Math.floor(step / 64) % song.order.length;
    return { ord: o, pat: song.order[o], row: ((step % 64) + 64) % 64 };
  };
  BT.songRootMidi = function (world, step) {
    var p = BT.songPos(world.song, step), deg = world.song.pats[p.pat].root[p.row >> 4];
    return 36 + ((world.root + world.mode[deg]) % 12);
  };
})(typeof window !== 'undefined' ? window : globalThis);
