/* BEAT TRIBE - core: namespace, constants, colour helpers, seeded RNG.
 * Every file attaches to the single global `BT` and also loads under Node
 * (tools/*.js run the simulation headlessly to verify the solution demos). */
(function (g) {
  'use strict';
  var BT = g.BT = g.BT || {};

  BT.W = 320; BT.H = 200;          // Amiga OCS low-res framebuffer
  BT.VIEW_H = 160;                 // playfield height (panel uses the bottom 40 rows)
  BT.LH = 160;                     // level height in pixels
  BT.FPS = 60;                     // fixed simulation rate
  BT.TICK = 4;                     // frames per lemming logic tick (15 Hz, like the original)
  BT.BLOCK = 16;                   // width of one note-block column
  BT.SKILLS = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
  BT.STEMS = ['DRUMS', 'BASS', 'CHORDS', 'LEAD', 'FULL MIX'];

  // Colours are packed for a little-endian Uint32 view of ImageData (ABGR).
  BT.rgb = function (r, gr, b) { return ((255 << 24) | (b << 16) | (gr << 8) | r) >>> 0; };
  BT.hex = function (h) { return BT.rgb((h >> 16) & 255, (h >> 8) & 255, h & 255); };
  BT.mix = function (a, b, t) {
    var ar = a & 255, ag = (a >> 8) & 255, ab = (a >> 16) & 255;
    var br = b & 255, bg = (b >> 8) & 255, bb = (b >> 16) & 255;
    return BT.rgb((ar + (br - ar) * t) | 0, (ag + (bg - ag) * t) | 0, (ab + (bb - ab) * t) | 0);
  };
  BT.mul = function (c, f) {
    var r = (c & 255) * f, gr = ((c >> 8) & 255) * f, b = ((c >> 16) & 255) * f;
    return BT.rgb(r > 255 ? 255 : r | 0, gr > 255 ? 255 : gr | 0, b > 255 ? 255 : b | 0);
  };
  BT.grey = function (c, t) {
    var r = c & 255, gr = (c >> 8) & 255, b = (c >> 16) & 255, l = (r * 77 + gr * 150 + b * 29) >> 8;
    return BT.rgb((r + (l - r) * t) | 0, (gr + (l - gr) * t) | 0, (b + (l - b) * t) | 0);
  };
  BT.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  BT.WHITE = BT.hex(0xffffff); BT.BLACK = BT.hex(0x000000);

  // Deterministic integer hash -> [0,1). Used for all procedural textures.
  BT.hash = function (x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Smooth value noise.
  BT.noise = function (x, y, sc, seed) {
    var fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    var a = BT.hash(x0, y0, seed), b = BT.hash(x0 + 1, y0, seed), c = BT.hash(x0, y0 + 1, seed), d = BT.hash(x0 + 1, y0 + 1, seed);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  // mulberry32: the only randomness the simulation is allowed to use.
  function RNG(seed) { this.s = (seed >>> 0) || 1; }
  RNG.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (n) { return (this.next() * n) | 0; };
  BT.RNG = RNG;

  var NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  BT.noteName = function (m) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };
})(typeof window !== 'undefined' ? window : globalThis);
