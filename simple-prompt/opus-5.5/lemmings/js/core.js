/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — core.js
 * Shared namespace, constants, seeded RNG and the five genre worlds.
 * This file (like terrain.js, sim.js, levels.js, demos.js) has no DOM
 * dependency so the whole simulation can run headless under Node for
 * solution verification (see tools/verify.js).
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = (G.BT = G.BT || {});

  BT.SCREEN_W = 320;
  BT.SCREEN_H = 200;
  BT.PLAY_H = 160;           // play-field height == level height
  BT.FPS = 60;

  BT.SKILLS = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
  BT.SKILL_NAMES = ['CLIMBER', 'FLOATER', 'BOMBER', 'BLOCKER', 'BUILDER', 'BASHER', 'MINER', 'DIGGER'];
  BT.STEMS = ['DRUMS', 'BASS', 'CHORDS', 'LEAD', 'FULL'];
  BT.STEM_SHORT = ['DRM', 'BAS', 'CHD', 'LEA', 'FUL'];

  /* Mulberry32 — tiny, fast, fully deterministic 32-bit PRNG. */
  BT.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Integer hash noise (stateless) used for textures and terrain edges. */
  BT.hash2 = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s | 0) * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
  BT.vnoise = function (x, s) { // smooth 1-D value noise
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return BT.hash2(i, 7, s) * (1 - u) + BT.hash2(i + 1, 7, s) * u;
  };
  BT.vnoise2 = function (x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = BT.hash2(ix, iy, s), b = BT.hash2(ix + 1, iy, s);
    const c = BT.hash2(ix, iy + 1, s), d = BT.hash2(ix + 1, iy + 1, s);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
  };

  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

  /* ------------------------------------------------------------------------
   * THE FIVE GENRE WORLDS
   *  scale  : semitone offsets — each world is locked to one scale so any
   *           combination of terrain notes is consonant.
   *  tpb    : lemming-ticks per beat. The lemming logic clock is derived from
   *           the song clock, so the tribe literally walks to the tempo.
   * ---------------------------------------------------------------------- */
  BT.WORLDS = [
    {
      id: 0, key: 'garden', name: 'AMIGA CHIP GARDEN', genre: '4-CHANNEL CHIPTUNE',
      scaleName: 'C MAJOR PENTATONIC', scale: [0, 2, 4, 7, 9], root: 60, bpm: 125, tpb: 8,
      deg: [0xe0583c, 0xf0a030, 0xf0d848, 0x60c050, 0x4890e0].map(hex),
      sky: [0x2a3a9c, 0x6a8ce8, 0xb8d8ff].map(hex), accent: hex(0x80ff60),
    },
    {
      id: 1, key: 'acid', name: 'ACID WAREHOUSE', genre: 'TB-303 ACID HOUSE',
      scaleName: 'E PHRYGIAN', scale: [0, 1, 3, 5, 7, 8, 10], root: 52, bpm: 128, tpb: 8,
      deg: [0xff3cc8, 0x30e8ff, 0xa8ff30, 0xffe030, 0xff8a20, 0xa060ff, 0x3c7cff].map(hex),
      sky: [0x07060c, 0x14101e, 0x241a30].map(hex), accent: hex(0xa8ff30),
    },
    {
      id: 2, key: 'synth', name: 'SYNTHWAVE SUNSET', genre: 'ANALOG SYNTHWAVE',
      scaleName: 'D DORIAN', scale: [0, 2, 3, 5, 7, 9, 10], root: 50, bpm: 108, tpb: 8,
      deg: [0xff4fa0, 0xb04cff, 0x40e0ff, 0x4060ff, 0xff40ff, 0xff9a40, 0x40ffc0].map(hex),
      sky: [0x1a0638, 0x7a1a78, 0xff7a4a].map(hex), accent: hex(0xff4fa0),
    },
    {
      id: 3, key: 'jungle', name: 'JUNGLE BREAKBEAT CAVES', genre: 'JUNGLE / DRUM & BASS',
      scaleName: 'A MINOR PENTATONIC', scale: [0, 3, 5, 7, 10], root: 57, bpm: 170, tpb: 6,
      deg: [0x20e0b8, 0x98f040, 0x9a58ff, 0x40a8ff, 0xff58b8].map(hex),
      sky: [0x020a0c, 0x06181c, 0x0a2a26].map(hex), accent: hex(0x40ffd0),
    },
    {
      id: 4, key: 'hall', name: 'GRAND ORCHESTRAL FINALE', genre: 'SYNTHESIZED ORCHESTRA',
      scaleName: 'F LYDIAN', scale: [0, 2, 4, 6, 7, 9, 11], root: 53, bpm: 96, tpb: 10,
      deg: [0xf4ead4, 0xeab4b0, 0xe8c460, 0xacdcbc, 0xc4b4ec, 0xacccf4, 0xf4c49c].map(hex),
      sky: [0x100c1c, 0x2c2040, 0x5a4468].map(hex), accent: hex(0xffd870),
    },
  ];

  /* Octave band from height: high ground sings high. */
  BT.octaveBand = function (y) { return y < 56 ? 1 : y < 108 ? 0 : -1; };

  BT.degToMidi = function (world, deg, oct) {
    const n = world.scale.length;
    const o = Math.floor(deg / n);
    return world.root + 12 * (oct + o) + world.scale[((deg % n) + n) % n];
  };
})(typeof window !== 'undefined' ? window : globalThis);
