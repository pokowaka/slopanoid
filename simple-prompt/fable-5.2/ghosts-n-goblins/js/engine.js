/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * engine.js — "CURSED-VGA" core: Mode-13h style 320x200 8-bit indexed software
 * framebuffer, 256-colour palette with ramps + palette FX, bitmap / sprite toolkit,
 * bitmap font, input, and the locked 60 Hz main loop.
 *
 * Everything hangs off the single global namespace `GNG`. Pure vanilla JS, no deps.
 * This file is also loadable under Node (vm) for headless tests and art previews.
 */
(function (root) {
  'use strict';

  var GNG = root.GNG = root.GNG || {};

  GNG.W = 320;          // framebuffer width
  GNG.H = 200;          // framebuffer height
  GNG.TILE = 16;        // tile size in pixels
  GNG.FPS = 60;         // locked simulation rate

  /* ====================================================================== *
   *  RNG / NOISE
   * ====================================================================== */

  /** Seeded PRNG (mulberry32). Returns a function yielding floats in [0,1). */
  GNG.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Gameplay RNG (re-seedable so headless tests are deterministic). */
  GNG.rand = GNG.makeRng(0xC0FFEE);
  GNG.seed = function (seed) { GNG.rand = GNG.makeRng(seed); };
  /** Random float in [a,b). */
  GNG.rnd = function (a, b) { return a + GNG.rand() * (b - a); };
  /** Random integer in [a,b] inclusive. */
  GNG.irnd = function (a, b) { return (a + Math.floor(GNG.rand() * (b - a + 1))) | 0; };
  GNG.chance = function (p) { return GNG.rand() < p; };
  GNG.pick = function (arr) { return arr[(GNG.rand() * arr.length) | 0]; };

  /** Deterministic 2D integer hash -> [0,1). */
  GNG.hash2 = function (x, y, seed) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((seed | 0) + 1, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /** Smooth value noise in [0,1). */
  GNG.noise2 = function (x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = GNG.hash2(xi, yi, seed), b = GNG.hash2(xi + 1, yi, seed);
    var c = GNG.hash2(xi, yi + 1, seed), d = GNG.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  /** Fractal noise (octaves of value noise) in [0,1). */
  GNG.fbm = function (x, y, seed, octaves) {
    var sum = 0, amp = 0.5, norm = 0, o = octaves || 4;
    for (var i = 0; i < o; i++) {
      sum += amp * GNG.noise2(x, y, (seed | 0) + i * 17);
      norm += amp; amp *= 0.5; x *= 2; y *= 2;
    }
    return sum / norm;
  };

  /** 4x4 ordered-dither (Bayer) threshold in [0,1) for pixel (x,y). */
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  GNG.bayer = function (x, y) { return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16; };

  GNG.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  GNG.lerp = function (a, b, t) { return a + (b - a) * t; };
  GNG.sign = function (v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); };
  GNG.approach = function (v, target, step) {
    if (v < target) { v += step; return v > target ? target : v; }
    if (v > target) { v -= step; return v < target ? target : v; }
    return v;
  };

  /* ====================================================================== *
   *  PALETTE  (256 entries, VGA DAC style)
   *
   *    0        transparent in sprites (shows as black in the framebuffer)
   *    1..15    classic EGA colours (blue, green, cyan, red, ... white)
   *    16       black         17  outline (blue-black)
   *    18..23   "hot" FX colours: red, orange, yellow, green, cyan, white
   *    24..231  26 ramps x 8 shades (0 = darkest ... 7 = lightest)
   *    232..239 SKY   per-stage sky gradient (lit up by lightning)
   *    240..247 LIQ   per-stage liquid colours (palette-cycled)
   *    248..255 GLOW  per-stage glow colours (palette-cycled: lava, torches)
   * ====================================================================== */

  var RAMP_DEFS = [
    //  name      dark            mid              light
    ['steel',  [14, 18, 38],  [92, 108, 146],  [236, 244, 255]],  // armour, blades
    ['gray',   [14, 14, 18],  [102, 102, 110], [238, 238, 232]],  // neutral stone
    ['brown',  [26, 12, 8],   [122, 74, 40],   [236, 190, 132]],  // wood, earth
    ['tan',    [44, 28, 16],  [170, 138, 92],  [250, 236, 196]],  // parchment
    ['bone',   [38, 34, 48],  [172, 166, 150], [255, 252, 238]],  // bone, ivory
    ['red',    [36, 0, 10],   [188, 28, 28],   [255, 164, 132]],  // blood, Arremer
    ['orange', [52, 10, 0],   [226, 106, 18],  [255, 228, 132]],  // fire-lit things
    ['gold',   [52, 28, 0],   [218, 162, 26],  [255, 250, 180]],  // gold armour, treasure
    ['green',  [2, 26, 16],   [44, 130, 50],   [188, 242, 130]],  // foliage
    ['toxic',  [8, 34, 0],    [98, 210, 18],   [226, 255, 148]],  // nukage, acid
    ['teal',   [0, 26, 34],   [26, 146, 146],  [180, 255, 234]],  // ectoplasm, ghosts
    ['blue',   [4, 8, 50],    [42, 90, 210],   [170, 218, 255]],  // holy flame, water
    ['indigo', [10, 4, 34],   [66, 50, 146],   [180, 170, 250]],  // night
    ['purple', [26, 0, 42],   [138, 42, 170],  [242, 170, 255]],  // magic
    ['pink',   [50, 0, 32],   [218, 66, 138],  [255, 188, 218]],  // strawberries!
    ['skin',   [58, 22, 18],  [210, 130, 98],  [255, 224, 190]],  // Arthur's hide
    ['maroon', [26, 4, 8],    [114, 42, 42],   [218, 146, 130]],  // flesh, hell rock
    ['olive',  [16, 20, 4],   [104, 112, 40],  [218, 218, 138]],  // moss, khaki
    ['slate',  [8, 12, 26],   [64, 82, 108],   [178, 198, 218]],  // dungeon stone
    ['sand',   [50, 28, 16],  [194, 146, 90],  [255, 238, 186]],  // sandstone
    ['rust',   [30, 8, 4],    [154, 74, 34],   [242, 170, 106]],  // rust, copper
    ['zombie', [12, 26, 26],  [96, 138, 106],  [210, 234, 186]],  // undead skin
    ['night',  [0, 0, 10],    [20, 26, 66],    [90, 106, 170]],   // dark silhouettes
    ['dusk',   [18, 0, 18],   [74, 26, 74],    [186, 98, 138]],   // hell silhouettes
    ['mist',   [24, 32, 42],  [120, 146, 154], [226, 242, 242]],  // fog, cloud
    ['ember',  [44, 0, 0],    [255, 72, 0],    [255, 255, 204]]   // fire: red->orange->white
  ];

  var EGA = [
    [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
    [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]
  ];
  var EGA_NAMES = ['egablack', 'egablue', 'egagreen', 'egacyan', 'egared', 'egamagenta', 'egabrown', 'egagray',
    'egadark', 'egalblue', 'egalgreen', 'egalcyan', 'egalred', 'egalmagenta', 'egayellow', 'egawhite'];

  var RAMP_BASE = 24;
  var SKY_BASE = 232, LIQ_BASE = 240, GLOW_BASE = 248;

  GNG.basePal = new Uint8Array(768);     // master palette (r,g,b)*256
  GNG.pal32 = new Uint32Array(256);      // palette after FX, packed for ImageData (ABGR)
  GNG.RAMPS = {};                        // name -> array of 8 palette indices
  GNG.RAMP_NAMES = [];
  var COLOR_NAMES = {};                  // name -> index

  function setBase(i, r, g, b) {
    GNG.basePal[i * 3] = r; GNG.basePal[i * 3 + 1] = g; GNG.basePal[i * 3 + 2] = b;
  }
  GNG.setPalEntry = setBase;

  (function buildPalette() {
    var i, j, k;
    for (i = 0; i < 16; i++) { setBase(i, EGA[i][0], EGA[i][1], EGA[i][2]); COLOR_NAMES[EGA_NAMES[i]] = i; }
    setBase(16, 0, 0, 0); setBase(17, 10, 8, 24);
    setBase(18, 255, 32, 32); setBase(19, 255, 144, 0); setBase(20, 255, 240, 64);
    setBase(21, 64, 255, 64); setBase(22, 64, 255, 255); setBase(23, 255, 255, 255);
    COLOR_NAMES.none = 0; COLOR_NAMES.black = 16; COLOR_NAMES.outline = 17;
    COLOR_NAMES.hotred = 18; COLOR_NAMES.hotorange = 19; COLOR_NAMES.hotyellow = 20;
    COLOR_NAMES.hotgreen = 21; COLOR_NAMES.hotcyan = 22; COLOR_NAMES.white = 23;
    for (i = 0; i < RAMP_DEFS.length; i++) {
      var def = RAMP_DEFS[i], name = def[0], ramp = [];
      for (j = 0; j < 8; j++) {
        var t = j / 7, a, b, u, rgb = [0, 0, 0];
        if (t < 0.5) { a = def[1]; b = def[2]; u = t * 2; } else { a = def[2]; b = def[3]; u = (t - 0.5) * 2; }
        for (k = 0; k < 3; k++) rgb[k] = Math.round(a[k] + (b[k] - a[k]) * u);
        var idx = RAMP_BASE + i * 8 + j;
        setBase(idx, rgb[0], rgb[1], rgb[2]);
        ramp.push(idx);
        COLOR_NAMES[name + j] = idx;
      }
      GNG.RAMPS[name] = ramp;
      GNG.RAMP_NAMES.push(name);
    }
    var sky = [], liq = [], glow = [];
    for (j = 0; j < 8; j++) {
      sky.push(SKY_BASE + j); liq.push(LIQ_BASE + j); glow.push(GLOW_BASE + j);
      COLOR_NAMES['sky' + j] = SKY_BASE + j;
      COLOR_NAMES['liq' + j] = LIQ_BASE + j;
      COLOR_NAMES['glow' + j] = GLOW_BASE + j;
    }
    GNG.RAMPS.sky = sky; GNG.RAMPS.liq = liq; GNG.RAMPS.glow = glow;
  })();

  GNG.SKY_BASE = SKY_BASE; GNG.LIQ_BASE = LIQ_BASE; GNG.GLOW_BASE = GLOW_BASE;

  /**
   * Resolve a colour name to a palette index.
   *   'steel5' (ramp name + shade 0..7), 'sky3', 'liq0', 'glow7',
   *   'black', 'outline', 'white', 'none', 'hotred', 'hotorange', 'hotyellow',
   *   'hotgreen', 'hotcyan', 'egared' ... or a raw number.
   */
  GNG.col = function (name) {
    if (typeof name === 'number') return name | 0;
    var v = COLOR_NAMES[name];
    if (v === undefined) throw new Error('GNG.col: unknown colour "' + name + '"');
    return v;
  };

  /** Shorthand table of well-known indices: GNG.C.black, GNG.C.white, GNG.C.steel[5] ... */
  GNG.C = (function () {
    var C = { none: 0, black: 16, outline: 17, hotred: 18, hotorange: 19, hotyellow: 20, hotgreen: 21, hotcyan: 22, white: 23 };
    for (var n in GNG.RAMPS) C[n] = GNG.RAMPS[n];
    return C;
  })();

  /** Dithered shade from a ramp: v in [0,1] -> palette index (ordered dither between neighbours). */
  GNG.shade = function (ramp, v, x, y) {
    var r = typeof ramp === 'string' ? GNG.RAMPS[ramp] : ramp;
    var f = v * (r.length - 1);
    var i = Math.floor(f + GNG.bayer(x, y));
    if (i < 0) i = 0; else if (i >= r.length) i = r.length - 1;
    return r[i];
  };

  /** Set the three per-stage 8-colour palette slots. Each arg: array of 8 [r,g,b] (or null to keep). */
  GNG.setStagePalette = function (sky, liq, glow) {
    var sets = [[SKY_BASE, sky], [LIQ_BASE, liq], [GLOW_BASE, glow]];
    for (var s = 0; s < 3; s++) {
      var base = sets[s][0], arr = sets[s][1];
      if (!arr) continue;
      for (var i = 0; i < 8; i++) {
        var c = arr[Math.min(i, arr.length - 1)];
        setBase(base + i, c[0], c[1], c[2]);
      }
    }
  };
  (function defaultStagePalette() {
    var sky = [], liq = [], glow = [], i;
    for (i = 0; i < 8; i++) {
      sky.push([8 + i * 6, 10 + i * 8, 40 + i * 14]);
      liq.push([10 + i * 6, 40 + i * 14, 110 + i * 16]);
      glow.push([120 + i * 19, 20 + i * 28, 0 + i * 10]);
    }
    GNG.setStagePalette(sky, liq, glow);
  })();

  /** Rotate `count` palette entries starting at `start` by one step (dir = +1 / -1). Classic colour cycling. */
  GNG.cyclePalette = function (start, count, dir) {
    var p = GNG.basePal, a = start * 3, n = count * 3, t0, t1, t2, i;
    if (dir >= 0) {
      t0 = p[a + n - 3]; t1 = p[a + n - 2]; t2 = p[a + n - 1];
      for (i = n - 1; i >= 3; i--) p[a + i] = p[a + i - 3];
      p[a] = t0; p[a + 1] = t1; p[a + 2] = t2;
    } else {
      t0 = p[a]; t1 = p[a + 1]; t2 = p[a + 2];
      for (i = 0; i < n - 3; i++) p[a + i] = p[a + i + 3];
      p[a + n - 3] = t0; p[a + n - 2] = t1; p[a + n - 1] = t2;
    }
  };

  /** Palette FX state, applied every frame by applyPalette(). All values 0..1. */
  GNG.fx = {
    fade: 0,          // -> black (whole palette)
    flash: 0,         // -> white (whole palette)
    skyFlash: 0,      // -> lightning white-blue (SKY slot only)
    tintR: 0, tintG: 0, tintB: 0, tint: 0,   // lerp whole palette toward a colour
    gray: 0           // desaturate (pause / death)
  };

  GNG.applyPalette = function () {
    var p = GNG.basePal, out = GNG.pal32, fx = GNG.fx;
    var fade = 1 - fx.fade, flash = fx.flash, tint = fx.tint, gray = fx.gray, sf = fx.skyFlash;
    for (var i = 0; i < 256; i++) {
      var r = p[i * 3], g = p[i * 3 + 1], b = p[i * 3 + 2];
      if (sf > 0 && i >= SKY_BASE && i < SKY_BASE + 8) {
        r += (225 - r) * sf; g += (235 - g) * sf; b += (255 - b) * sf;
      }
      if (gray > 0) {
        var l = r * 0.3 + g * 0.59 + b * 0.11;
        r += (l - r) * gray; g += (l - g) * gray; b += (l - b) * gray;
      }
      if (tint > 0) { r += (fx.tintR - r) * tint; g += (fx.tintG - g) * tint; b += (fx.tintB - b) * tint; }
      if (flash > 0) { r += (255 - r) * flash; g += (255 - g) * flash; b += (255 - b) * flash; }
      if (fade < 1) { r *= fade; g *= fade; b *= fade; }
      out[i] = 0xFF000000 | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
    }
  };

  /** Build a 256-entry remap table. `map` = { fromName: toName, ... } or { fromRamp: toRamp } via rampSwap. */
  GNG.makeRemap = function (map) {
    var t = new Uint8Array(256), i;
    for (i = 0; i < 256; i++) t[i] = i;
    for (var k in map) t[GNG.col(isNaN(k) ? k : +k)] = GNG.col(map[k]);
    return t;
  };

  /**
   * Remap table that swaps whole ramps: rampSwap({ steel: 'gold', red: 'purple' }).
   * Optional `shift` moves the shade (+1 lighter / -1 darker), clamped to 0..7.
   */
  GNG.rampSwap = function (pairs, shift) {
    var t = new Uint8Array(256), i;
    for (i = 0; i < 256; i++) t[i] = i;
    shift = shift | 0;
    for (var from in pairs) {
      var a = GNG.RAMPS[from], b = GNG.RAMPS[pairs[from]];
      if (!a || !b) throw new Error('GNG.rampSwap: unknown ramp ' + from + ' -> ' + pairs[from]);
      for (i = 0; i < 8; i++) t[a[i]] = b[GNG.clamp(i + shift, 0, 7)];
    }
    return t;
  };

  /* ====================================================================== *
   *  BITMAP  (8-bit indexed surface; index 0 = transparent when blitted)
   * ====================================================================== */

  function Bitmap(w, h) {
    this.w = Math.max(1, w | 0); this.h = Math.max(1, h | 0);
    this.data = new Uint8Array(this.w * this.h);
    this.ax = this.w >> 1;      // anchor ("hot spot"), default bottom-centre
    this.ay = this.h;
    this.cx0 = 0; this.cy0 = 0; this.cx1 = this.w; this.cy1 = this.h;   // clip rect
  }
  GNG.Bitmap = Bitmap;
  GNG.bitmap = function (w, h) { return new Bitmap(w, h); };

  var BP = Bitmap.prototype;

  BP.setClip = function (x0, y0, x1, y1) {
    this.cx0 = Math.max(0, x0 | 0); this.cy0 = Math.max(0, y0 | 0);
    this.cx1 = Math.min(this.w, x1 | 0); this.cy1 = Math.min(this.h, y1 | 0);
    return this;
  };
  BP.resetClip = function () { this.cx0 = 0; this.cy0 = 0; this.cx1 = this.w; this.cy1 = this.h; return this; };
  BP.clear = function (c) { this.data.fill(c | 0); return this; };

  BP.get = function (x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  };
  BP.pset = function (x, y, c) {
    x |= 0; y |= 0;
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    this.data[y * this.w + x] = c;
  };

  /** Filled rectangle. */
  BP.rect = function (x, y, w, h, c) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    var x0 = x < this.cx0 ? this.cx0 : x, y0 = y < this.cy0 ? this.cy0 : y;
    var x1 = x + w > this.cx1 ? this.cx1 : x + w, y1 = y + h > this.cy1 ? this.cy1 : y + h;
    if (x0 >= x1 || y0 >= y1) return;
    var d = this.data, dw = this.w;
    for (var yy = y0; yy < y1; yy++) d.fill(c, yy * dw + x0, yy * dw + x1);
  };
  /** Rectangle outline (1px). */
  BP.frame = function (x, y, w, h, c) {
    this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
  };
  BP.hline = function (x, y, len, c) { this.rect(x, y, len, 1, c); };
  BP.vline = function (x, y, len, c) { this.rect(x, y, 1, len, c); };

  /** Bresenham line. */
  BP.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy, e2, guard = 0;
    for (;;) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      if (++guard > 4096) break;
      e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  /** Filled ellipse (rx, ry may be fractional). */
  BP.ellipse = function (cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) return;
    var y0 = Math.ceil(cy - ry), y1 = Math.floor(cy + ry);
    for (var y = y0; y <= y1; y++) {
      var t = (y - cy) / ry, s = 1 - t * t;
      if (s < 0) continue;
      var hw = rx * Math.sqrt(s);
      var xa = Math.ceil(cx - hw), xb = Math.floor(cx + hw);
      if (xb >= xa) this.rect(xa, y, xb - xa + 1, 1, c);
    }
  };
  /** Filled disc. */
  BP.disc = function (cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); };
  /** Circle outline. */
  BP.circ = function (cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r <= 0) { this.pset(cx, cy, c); return; }
    var x = r, y = 0, err = 1 - r;
    while (x >= y) {
      this.pset(cx + x, cy + y, c); this.pset(cx - x, cy + y, c);
      this.pset(cx + x, cy - y, c); this.pset(cx - x, cy - y, c);
      this.pset(cx + y, cy + x, c); this.pset(cx - y, cy + x, c);
      this.pset(cx + y, cy - x, c); this.pset(cx - y, cy - x, c);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  };

  /** Filled polygon. pts = [[x,y],[x,y],...] */
  BP.poly = function (pts, c) {
    var n = pts.length, i, minY = Infinity, maxY = -Infinity;
    if (n < 3) return;
    for (i = 0; i < n; i++) { if (pts[i][1] < minY) minY = pts[i][1]; if (pts[i][1] > maxY) maxY = pts[i][1]; }
    minY = Math.max(this.cy0, Math.ceil(minY)); maxY = Math.min(this.cy1 - 1, Math.floor(maxY));
    for (var y = minY; y <= maxY; y++) {
      var xs = [], yc = y + 0.001;
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
        if (xb >= xa) this.rect(xa, y, xb - xa + 1, 1, c);
      }
    }
  };

  /** Ordered-dither fill of a rect mixing c1 (t=0) and c2 (t=1). Colour 0 = leave untouched. */
  BP.dither = function (x, y, w, h, c1, c2, t) {
    for (var yy = y; yy < y + h; yy++) {
      for (var xx = x; xx < x + w; xx++) {
        var c = GNG.bayer(xx, yy) < t ? c2 : c1;
        if (c) this.pset(xx, yy, c);
      }
    }
  };

  /** Sprite blit with transparency (index 0). dx,dy = top-left on this bitmap. */
  BP.blit = function (src, dx, dy, flipX, flipY) {
    dx |= 0; dy |= 0;
    var sw = src.w, sh = src.h;
    var x0 = dx < this.cx0 ? this.cx0 : dx, y0 = dy < this.cy0 ? this.cy0 : dy;
    var x1 = dx + sw > this.cx1 ? this.cx1 : dx + sw, y1 = dy + sh > this.cy1 ? this.cy1 : dy + sh;
    if (x0 >= x1 || y0 >= y1) return;
    var sd = src.data, dd = this.data, dw = this.w, x, y, si, di, c;
    for (y = y0; y < y1; y++) {
      var sy = flipY ? sh - 1 - (y - dy) : y - dy;
      di = y * dw + x0;
      if (flipX) {
        si = sy * sw + (sw - 1 - (x0 - dx));
        for (x = x0; x < x1; x++, di++, si--) { c = sd[si]; if (c) dd[di] = c; }
      } else {
        si = sy * sw + (x0 - dx);
        for (x = x0; x < x1; x++, di++, si++) { c = sd[si]; if (c) dd[di] = c; }
      }
    }
  };

  /** Blit through a 256-entry remap table (palette swap). */
  BP.blitMap = function (src, dx, dy, flipX, table) {
    dx |= 0; dy |= 0;
    var sw = src.w, sh = src.h;
    var x0 = dx < this.cx0 ? this.cx0 : dx, y0 = dy < this.cy0 ? this.cy0 : dy;
    var x1 = dx + sw > this.cx1 ? this.cx1 : dx + sw, y1 = dy + sh > this.cy1 ? this.cy1 : dy + sh;
    if (x0 >= x1 || y0 >= y1) return;
    var sd = src.data, dd = this.data, dw = this.w, x, y, si, di, c;
    for (y = y0; y < y1; y++) {
      di = y * dw + x0;
      if (flipX) {
        si = (y - dy) * sw + (sw - 1 - (x0 - dx));
        for (x = x0; x < x1; x++, di++, si--) { c = sd[si]; if (c) dd[di] = table[c]; }
      } else {
        si = (y - dy) * sw + (x0 - dx);
        for (x = x0; x < x1; x++, di++, si++) { c = sd[si]; if (c) dd[di] = table[c]; }
      }
    }
  };

  /** Blit a sprite as a single flat colour (hit flash, silhouettes). */
  BP.blitSolid = function (src, dx, dy, flipX, color) {
    dx |= 0; dy |= 0;
    var sw = src.w, sh = src.h;
    var x0 = dx < this.cx0 ? this.cx0 : dx, y0 = dy < this.cy0 ? this.cy0 : dy;
    var x1 = dx + sw > this.cx1 ? this.cx1 : dx + sw, y1 = dy + sh > this.cy1 ? this.cy1 : dy + sh;
    if (x0 >= x1 || y0 >= y1) return;
    var sd = src.data, dd = this.data, dw = this.w, x, y, si, di;
    for (y = y0; y < y1; y++) {
      di = y * dw + x0;
      if (flipX) {
        si = (y - dy) * sw + (sw - 1 - (x0 - dx));
        for (x = x0; x < x1; x++, di++, si--) { if (sd[si]) dd[di] = color; }
      } else {
        si = (y - dy) * sw + (x0 - dx);
        for (x = x0; x < x1; x++, di++, si++) { if (sd[si]) dd[di] = color; }
      }
    }
  };

  /**
   * Stippled (checkerboard) blit = 50% "translucency" the 1990 way. phase 0/1 flips the checker.
   * Optional table remaps colours; optional flat `color` overrides (0 = use sprite colours).
   */
  BP.blitStipple = function (src, dx, dy, flipX, phase, table, color) {
    dx |= 0; dy |= 0; phase = phase | 0;
    var sw = src.w, sh = src.h;
    var x0 = dx < this.cx0 ? this.cx0 : dx, y0 = dy < this.cy0 ? this.cy0 : dy;
    var x1 = dx + sw > this.cx1 ? this.cx1 : dx + sw, y1 = dy + sh > this.cy1 ? this.cy1 : dy + sh;
    if (x0 >= x1 || y0 >= y1) return;
    var sd = src.data, dd = this.data, dw = this.w, x, y, c;
    for (y = y0; y < y1; y++) {
      for (x = x0; x < x1; x++) {
        if ((x + y + phase) & 1) continue;
        var sx = flipX ? sw - 1 - (x - dx) : x - dx;
        c = sd[(y - dy) * sw + sx];
        if (c) dd[y * dw + x] = color ? color : (table ? table[c] : c);
      }
    }
  };

  /** Copy a sub-rectangle of src (sx,sy,sw,sh) to (dx,dy). opaque=true ignores transparency (fast). */
  BP.blitPart = function (src, sx, sy, sw, sh, dx, dy, opaque) {
    sx |= 0; sy |= 0; sw |= 0; sh |= 0; dx |= 0; dy |= 0;
    if (sx < 0) { dx -= sx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy; sh += sy; sy = 0; }
    if (sx + sw > src.w) sw = src.w - sx;
    if (sy + sh > src.h) sh = src.h - sy;
    if (dx < this.cx0) { var ox = this.cx0 - dx; sx += ox; sw -= ox; dx = this.cx0; }
    if (dy < this.cy0) { var oy = this.cy0 - dy; sy += oy; sh -= oy; dy = this.cy0; }
    if (dx + sw > this.cx1) sw = this.cx1 - dx;
    if (dy + sh > this.cy1) sh = this.cy1 - dy;
    if (sw <= 0 || sh <= 0) return;
    var sd = src.data, dd = this.data, dw = this.w, srcW = src.w, x, y, si, di, c;
    if (opaque) {
      for (y = 0; y < sh; y++) {
        si = (sy + y) * srcW + sx;
        dd.set(sd.subarray(si, si + sw), (dy + y) * dw + dx);
      }
    } else {
      for (y = 0; y < sh; y++) {
        si = (sy + y) * srcW + sx; di = (dy + y) * dw + dx;
        for (x = 0; x < sw; x++, si++, di++) { c = sd[si]; if (c) dd[di] = c; }
      }
    }
  };

  /** Draw a bitmap tiled horizontally (parallax layer). scrollX = how far the layer has scrolled left. */
  BP.blitWrapX = function (src, scrollX, dy, opaque) {
    var w = src.w, off = Math.floor(scrollX) % w;
    if (off < 0) off += w;
    for (var x = -off; x < this.w; x += w) this.blitPart(src, 0, 0, w, src.h, x, dy, opaque);
  };

  /* --- anchored drawing: (x,y) is where the sprite's anchor lands --- */
  BP.draw = function (spr, x, y, flipX) {
    this.blit(spr, Math.floor(x) - (flipX ? spr.w - spr.ax : spr.ax), Math.floor(y) - spr.ay, flipX);
  };
  BP.drawMap = function (spr, x, y, flipX, table) {
    this.blitMap(spr, Math.floor(x) - (flipX ? spr.w - spr.ax : spr.ax), Math.floor(y) - spr.ay, flipX, table);
  };
  BP.drawSolid = function (spr, x, y, flipX, color) {
    this.blitSolid(spr, Math.floor(x) - (flipX ? spr.w - spr.ax : spr.ax), Math.floor(y) - spr.ay, flipX, color);
  };
  BP.drawStipple = function (spr, x, y, flipX, phase, table, color) {
    this.blitStipple(spr, Math.floor(x) - (flipX ? spr.w - spr.ax : spr.ax), Math.floor(y) - spr.ay, flipX, phase, table, color);
  };

  /* --- whole-bitmap transforms (return NEW bitmaps; anchors are carried over sensibly) --- */
  BP.clone = function () {
    var b = new Bitmap(this.w, this.h);
    b.data.set(this.data); b.ax = this.ax; b.ay = this.ay;
    return b;
  };
  BP.flipH = function () {
    var b = new Bitmap(this.w, this.h), w = this.w, h = this.h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) b.data[y * w + x] = this.data[y * w + (w - 1 - x)];
    b.ax = w - this.ax; b.ay = this.ay;
    return b;
  };
  BP.flipV = function () {
    var b = new Bitmap(this.w, this.h), w = this.w, h = this.h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) b.data[y * w + x] = this.data[(h - 1 - y) * w + x];
    b.ax = this.ax; b.ay = h - this.ay;
    return b;
  };
  /** Rotate 90 degrees clockwise. Anchor is reset to the centre. */
  BP.rot90 = function () {
    var w = this.w, h = this.h, b = new Bitmap(h, w);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) b.data[x * h + (h - 1 - y)] = this.data[y * w + x];
    b.ax = b.w >> 1; b.ay = b.h >> 1;
    return b;
  };
  /** Palette-swapped copy. map = Uint8Array(256) table or {from: to} name/index object. */
  BP.remap = function (map) {
    var t = (map instanceof Uint8Array) ? map : GNG.makeRemap(map);
    var b = this.clone();
    for (var i = 0; i < b.data.length; i++) b.data[i] = t[b.data[i]];
    return b;
  };
  /** Integer upscale copy. */
  BP.scaled = function (n) {
    n = Math.max(1, n | 0);
    var b = new Bitmap(this.w * n, this.h * n), w = this.w, h = this.h;
    for (var y = 0; y < h * n; y++) for (var x = 0; x < w * n; x++) b.data[y * b.w + x] = this.data[((y / n) | 0) * w + ((x / n) | 0)];
    b.ax = this.ax * n; b.ay = this.ay * n;
    return b;
  };
  /** Copy padded by `n` transparent pixels on every side (room for outlines). Anchor shifts with it. */
  BP.padded = function (n) {
    var b = new Bitmap(this.w + 2 * n, this.h + 2 * n);
    b.blit(this, n, n);
    b.ax = this.ax + n; b.ay = this.ay + n;
    return b;
  };
  /**
   * In-place: paint colour `c` on every transparent pixel touching an opaque one
   * (4-neighbourhood; pass diag=true for 8). Classic sprite outline.
   */
  BP.outline = function (c, diag) {
    var w = this.w, h = this.h, src = this.data, out = new Uint8Array(src);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (src[y * w + x]) continue;
        var hit = (x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) ||
          (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x]);
        if (!hit && diag) {
          hit = (x > 0 && y > 0 && src[(y - 1) * w + x - 1]) || (x < w - 1 && y > 0 && src[(y - 1) * w + x + 1]) ||
            (x > 0 && y < h - 1 && src[(y + 1) * w + x - 1]) || (x < w - 1 && y < h - 1 && src[(y + 1) * w + x + 1]);
        }
        if (hit) out[y * w + x] = c;
      }
    }
    this.data.set(out);
    return this;
  };
  /** Bounding box of opaque pixels: {x,y,w,h} or null if empty. */
  BP.bounds = function () {
    var w = this.w, h = this.h, d = this.data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  /* ====================================================================== *
   *  SPRITE REGISTRY  (ASCII pixel art -> indexed bitmaps)
   * ====================================================================== */

  GNG.S = {};                    // name -> Bitmap
  GNG.artWarnings = [];          // problems found while parsing art (shown by preview tools)
  GNG.missingSprites = {};       // names requested but never defined
  var frameCache = {};

  /**
   * Build a legend: { 'k': 'black', 's': 'steel4', 'x': 123 } -> { 'k': 16, 's': 28, 'x': 123 }.
   * '.' and ' ' are always transparent.
   */
  GNG.makeLegend = function (obj) {
    var out = {};
    for (var ch in obj) out[ch] = GNG.col(obj[ch]);
    out['.'] = 0; out[' '] = 0;
    return out;
  };

  /** Parse ASCII art (template string or array of rows) into a Bitmap using a legend. */
  GNG.parseArt = function (legend, art, name) {
    var rows = (typeof art === 'string') ? art.split('\n') : art.slice();
    // strip CR / trailing whitespace noise and empty leading/trailing lines
    for (var r = 0; r < rows.length; r++) rows[r] = rows[r].replace(/\r/g, '').replace(/\s+$/, '');
    while (rows.length && rows[0].replace(/\s/g, '') === '') rows.shift();
    while (rows.length && rows[rows.length - 1].replace(/\s/g, '') === '') rows.pop();
    // common left indentation (template strings inside indented code)
    var indent = Infinity;
    for (r = 0; r < rows.length; r++) {
      if (!rows[r].length) continue;
      var m = rows[r].match(/^ */)[0].length;
      if (m < indent) indent = m;
    }
    if (!isFinite(indent)) indent = 0;
    var w = 0;
    for (r = 0; r < rows.length; r++) { rows[r] = rows[r].slice(indent); if (rows[r].length > w) w = rows[r].length; }
    var ragged = false;
    for (r = 0; r < rows.length; r++) if (rows[r].length !== w) ragged = true;
    if (ragged) GNG.artWarnings.push((name || '?') + ': ragged rows (padded to ' + w + ')');
    var bmp = new Bitmap(w, rows.length || 1);
    for (r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x), c = legend[ch];
        if (c === undefined) {
          GNG.artWarnings.push((name || '?') + ': unknown legend char "' + ch + '" at ' + x + ',' + r);
          c = 13;
        }
        bmp.data[r * w + x] = c;
      }
    }
    return bmp;
  };

  /**
   * Define a sprite from ASCII art.
   *   GNG.defSprite('zombie_walk0', LEGEND, `
   *     ..kkkk..
   *     .kggggk.
   *   `, { ax: 4, ay: 2 });          // opts optional; anchor defaults to bottom-centre
   * opts.outline = colour name/index -> auto outline after parsing (art should leave a 1px margin).
   */
  GNG.defSprite = function (name, legend, art, opts) {
    var bmp = GNG.parseArt(legend, art, name);
    return GNG.regSprite(name, bmp, opts);
  };

  /** Register an already-built bitmap as a named sprite. */
  GNG.regSprite = function (name, bmp, opts) {
    if (opts) {
      if (opts.outline !== undefined && opts.outline !== null) bmp.outline(GNG.col(opts.outline), !!opts.diag);
      if (opts.ax !== undefined) bmp.ax = opts.ax;
      if (opts.ay !== undefined) bmp.ay = opts.ay;
    }
    bmp.name = name;
    GNG.S[name] = bmp;
    frameCache = {};
    return bmp;
  };

  /** Define frames name0, name1, ... from an array of ASCII arts. */
  GNG.defSprites = function (prefix, legend, arts, opts) {
    var out = [];
    for (var i = 0; i < arts.length; i++) out.push(GNG.defSprite(prefix + i, legend, arts[i], opts));
    return out;
  };

  /** Palette-swapped copies of every sprite whose name starts with fromPrefix. */
  GNG.variantSprites = function (fromPrefix, toPrefix, map) {
    var t = (map instanceof Uint8Array) ? map : GNG.makeRemap(map);
    var names = Object.keys(GNG.S);
    for (var i = 0; i < names.length; i++) {
      if (names[i].indexOf(fromPrefix) !== 0) continue;
      var b = GNG.S[names[i]].remap(t);
      GNG.regSprite(toPrefix + names[i].slice(fromPrefix.length), b);
    }
  };

  var placeholder = null;
  function getPlaceholder() {
    if (!placeholder) {
      placeholder = new Bitmap(16, 16);
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        placeholder.data[y * 16 + x] = (((x >> 2) + (y >> 2)) & 1) ? 13 : 5;
      }
      placeholder.name = '(missing)';
    }
    return placeholder;
  }

  /** Fetch a sprite by name. Never returns null: unknown names give a magenta checker placeholder. */
  GNG.spr = function (name) {
    var s = GNG.S[name];
    if (s) return s;
    if (!GNG.missingSprites[name]) GNG.missingSprites[name] = true;
    return getPlaceholder();
  };
  GNG.hasSprite = function (name) { return !!GNG.S[name]; };

  /** Animation frames prefix0, prefix1, ... (as many as exist; at least one entry, maybe the placeholder). */
  GNG.frames = function (prefix) {
    var f = frameCache[prefix];
    if (f) return f;
    f = [];
    for (var i = 0; GNG.S[prefix + i]; i++) f.push(GNG.S[prefix + i]);
    if (!f.length) {
      if (GNG.S[prefix]) f.push(GNG.S[prefix]);
      else { GNG.missingSprites[prefix + '0'] = true; f.push(getPlaceholder()); }
    }
    frameCache[prefix] = f;
    return f;
  };

  /* ====================================================================== *
   *  BITMAP FONT  (5x7 glyphs in a 6x8 cell, upper-case arcade lettering)
   * ====================================================================== */

  var FONT = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
    '"': [0x0A, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x00],
    '#': [0x0A, 0x0A, 0x1F, 0x0A, 0x1F, 0x0A, 0x0A],
    '$': [0x04, 0x0F, 0x14, 0x0E, 0x05, 0x1E, 0x04],
    '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
    '&': [0x0C, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0D],
    '\'': [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    '*': [0x00, 0x04, 0x15, 0x0E, 0x15, 0x04, 0x00],
    '+': [0x00, 0x04, 0x04, 0x1F, 0x04, 0x04, 0x00],
    ',': [0x00, 0x00, 0x00, 0x00, 0x0C, 0x04, 0x08],
    '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
    '/': [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x00],
    '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
    '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
    '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
    '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
    '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
    '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
    '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
    '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
    '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    ':': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
    ';': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x04, 0x08],
    '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
    '=': [0x00, 0x00, 0x1F, 0x00, 0x1F, 0x00, 0x00],
    '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
    '@': [0x0E, 0x11, 0x01, 0x0D, 0x15, 0x15, 0x0E],
    'A': [0x0E, 0x11, 0x11, 0x11, 0x1F, 0x11, 0x11],
    'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
    'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
    'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
    'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
    'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
    'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
    'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
    'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
    'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
    'N': [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
    'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
    'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
    'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
    'S': [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E],
    'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
    'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A],
    'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x11, 0x0A, 0x04, 0x04, 0x04],
    'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
    '[': [0x0E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E],
    '\\': [0x00, 0x10, 0x08, 0x04, 0x02, 0x01, 0x00],
    ']': [0x0E, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0E],
    '^': [0x04, 0x0A, 0x11, 0x00, 0x00, 0x00, 0x00],
    '_': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1F],
    '`': [0x08, 0x04, 0x02, 0x00, 0x00, 0x00, 0x00],
    '{': [0x02, 0x04, 0x04, 0x08, 0x04, 0x04, 0x02],
    '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    '}': [0x08, 0x04, 0x04, 0x02, 0x04, 0x04, 0x08],
    '~': [0x00, 0x00, 0x08, 0x15, 0x02, 0x00, 0x00],
    '\u00C9': [0x02, 0x04, 0x1F, 0x10, 0x1E, 0x10, 0x1F],   // É
    '\u00CA': [0x04, 0x0A, 0x1F, 0x10, 0x1E, 0x10, 0x1F],   // Ê
    '\u00D7': [0x00, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x00],   // ×
    '\u2665': [0x00, 0x0A, 0x1F, 0x1F, 0x0E, 0x04, 0x00],   // ♥
    '\u2190': [0x00, 0x04, 0x08, 0x1F, 0x08, 0x04, 0x00],   // ←
    '\u2192': [0x00, 0x04, 0x02, 0x1F, 0x02, 0x04, 0x00],   // →
    '\u2191': [0x04, 0x0E, 0x15, 0x04, 0x04, 0x04, 0x00],   // ↑
    '\u2193': [0x00, 0x04, 0x04, 0x04, 0x15, 0x0E, 0x04],   // ↓
    '\u2022': [0x00, 0x00, 0x0E, 0x0E, 0x0E, 0x00, 0x00],   // •
    '\u2588': [0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F],   // █
    '\u2620': [0x0E, 0x15, 0x1F, 0x0E, 0x0A, 0x00, 0x00],   // ☠
    '\u266A': [0x04, 0x06, 0x05, 0x04, 0x0C, 0x1C, 0x0C]    // ♪
  };
  var LOWER_ACCENT = { '\u00E9': '\u00C9', '\u00EA': '\u00CA' };
  GNG.FONT = FONT;
  GNG.FONT_W = 6;    // advance
  GNG.FONT_H = 8;    // line height

  function glyphFor(ch) {
    var g = FONT[ch];
    if (g) return g;
    if (LOWER_ACCENT[ch]) return FONT[LOWER_ACCENT[ch]];
    g = FONT[ch.toUpperCase()];
    return g || FONT['?'];
  }

  GNG.textWidth = function (str, scale, spacing) {
    str = String(str);
    return str.length * ((GNG.FONT_W + (spacing | 0)) * (scale || 1)) - (scale || 1);
  };

  function drawTextRaw(bmp, str, x, y, color, scale, grad, spacing) {
    var adv = (GNG.FONT_W + spacing) * scale;
    for (var i = 0; i < str.length; i++) {
      var g = glyphFor(str.charAt(i)), gx = x + i * adv;
      if (gx > bmp.cx1 || gx + adv < bmp.cx0) continue;
      for (var row = 0; row < 7; row++) {
        var bits = g[row];
        if (!bits) continue;
        var c = grad ? grad[row] : color;
        for (var colI = 0; colI < 5; colI++) {
          if (bits & (0x10 >> colI)) {
            if (scale === 1) bmp.pset(gx + colI, y + row, c);
            else bmp.rect(gx + colI * scale, y + row * scale, scale, scale, c);
          }
        }
      }
    }
  }

  /**
   * Draw text.  opts: { align:'left'|'center'|'right', scale:int, shadow:colIdx, outline:colIdx,
   *                     grad:[7 colour indices top->bottom], spacing:int }
   * `color` is a palette index. Returns the x just past the text.
   */
  GNG.text = function (bmp, str, x, y, color, opts) {
    str = String(str);
    opts = opts || {};
    var scale = opts.scale || 1, spacing = opts.spacing | 0;
    var w = GNG.textWidth(str, scale, spacing);
    x = Math.floor(x); y = Math.floor(y);
    if (opts.align === 'center') x -= w >> 1; else if (opts.align === 'right') x -= w;
    if (opts.outline !== undefined && opts.outline !== null) {
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        if (ox || oy) drawTextRaw(bmp, str, x + ox, y + oy, opts.outline, scale, null, spacing);
      }
    }
    if (opts.shadow !== undefined && opts.shadow !== null) {
      drawTextRaw(bmp, str, x + scale, y + scale, opts.shadow, scale, null, spacing);
    }
    drawTextRaw(bmp, str, x, y, color, scale, opts.grad || null, spacing);
    return x + w;
  };

  /* ====================================================================== *
   *  SCREEN  (indexed framebuffer -> canvas)
   * ====================================================================== */

  GNG.fb = new Bitmap(GNG.W, GNG.H);        // THE framebuffer
  GNG.fb.ax = 0; GNG.fb.ay = 0;

  var screen = { canvas: null, ctx: null, image: null, buf32: null, flipY: false };
  GNG.Screen = screen;

  screen.init = function (canvas) {
    screen.canvas = canvas;
    canvas.width = GNG.W; canvas.height = GNG.H;
    screen.ctx = canvas.getContext('2d', { alpha: false });
    screen.ctx.imageSmoothingEnabled = false;
    screen.image = screen.ctx.createImageData(GNG.W, GNG.H);
    screen.buf32 = new Uint32Array(screen.image.data.buffer);
  };

  /** Convert the indexed framebuffer through the (FX-processed) palette into RGBA. */
  GNG.resolveFrame = function (out32, flipY) {
    var fb = GNG.fb.data, pal = GNG.pal32, n = GNG.W * GNG.H, i;
    if (flipY) {
      var W = GNG.W, H = GNG.H;
      for (var y = 0; y < H; y++) {
        var src = (H - 1 - y) * W, dst = y * W;
        for (i = 0; i < W; i++) out32[dst + i] = pal[fb[src + i]];
      }
    } else {
      for (i = 0; i < n; i++) out32[i] = pal[fb[i]];
    }
  };

  /** Push the framebuffer to the canvas. */
  screen.present = function () {
    GNG.applyPalette();
    if (!screen.ctx) return;
    GNG.resolveFrame(screen.buf32, screen.flipY);
    screen.ctx.putImageData(screen.image, 0, 0);
  };

  /* ====================================================================== *
   *  INPUT  (keyboard + mouse -> abstract actions, edge detection per tick)
   * ====================================================================== */

  var Input = GNG.Input = {
    bindings: {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'KeyZ'],
      attack: ['KeyJ', 'KeyX', 'Mouse0'],
      special: ['KeyE', 'KeyC', 'Mouse2'],
      start: ['Enter', 'NumpadEnter'],
      pause: ['KeyP', 'Escape'],
      mute: ['KeyM'],
      crt: ['KeyT', 'F2']
    },
    held: {},        // raw code -> true while physically held
    latched: {},     // raw code -> true if pressed since last tick (so quick taps are never lost)
    cur: {}, prev: {},
    keyQueue: [],    // raw key codes pressed since last takeKeys() (menus, warp digits)
    script: null     // optional function(action) -> bool, used by headless tests / attract mode
  };
  var PREVENT = {
    ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1, Tab: 1, F2: 1,
    KeyE: 0, Enter: 0
  };

  Input.press = function (code) {
    if (!Input.held[code]) { Input.latched[code] = true; Input.keyQueue.push(code); }
    Input.held[code] = true;
  };
  Input.release = function (code) { Input.held[code] = false; };
  Input.reset = function () { Input.held = {}; Input.latched = {}; Input.cur = {}; Input.prev = {}; Input.keyQueue.length = 0; };

  /** Call exactly once per simulation tick, before game logic. */
  Input.tick = function () {
    var b = Input.bindings, a, i, on;
    Input.prev = Input.cur;
    Input.cur = {};
    for (a in b) {
      on = false;
      for (i = 0; i < b[a].length; i++) {
        if (Input.held[b[a][i]] || Input.latched[b[a][i]]) { on = true; break; }
      }
      if (!on && Input.script) on = !!Input.script(a);
      Input.cur[a] = on;
    }
    Input.latched = {};
  };
  Input.down = function (a) { return !!Input.cur[a]; };
  Input.pressed = function (a) { return !!Input.cur[a] && !Input.prev[a]; };
  Input.released = function (a) { return !Input.cur[a] && !!Input.prev[a]; };
  /** Raw key codes (KeyboardEvent.code / 'Mouse0'..) pressed since the previous call. */
  Input.takeKeys = function () { var q = Input.keyQueue; Input.keyQueue = []; return q; };

  Input.attach = function (target, canvas) {
    if (!target || !target.addEventListener) return;
    target.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (PREVENT[e.code]) e.preventDefault();
      if (e.repeat) return;
      Input.press(e.code);
      if (Input.onFirstGesture) Input.onFirstGesture();
    });
    target.addEventListener('keyup', function (e) { Input.release(e.code); });
    target.addEventListener('blur', function () { Input.held = {}; });
    var el = canvas || target;
    el.addEventListener('mousedown', function (e) {
      e.preventDefault();
      Input.press('Mouse' + e.button);
      if (Input.onFirstGesture) Input.onFirstGesture();
    });
    target.addEventListener('mouseup', function (e) { Input.release('Mouse' + e.button); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  /* ====================================================================== *
   *  MAIN LOOP  (fixed 60 Hz simulation, render once per display frame)
   * ====================================================================== */

  var Loop = GNG.Loop = { running: false, acc: 0, last: 0, frame: 0, fps: 60, _fpsT: 0, _fpsN: 0, raf: 0 };
  var STEP = 1000 / GNG.FPS;

  Loop.start = function (update, render) {
    Loop.update = update; Loop.render = render;
    Loop.running = true; Loop.acc = 0; Loop.last = 0;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    function tick(now) {
      if (!Loop.running) return;
      Loop.raf = raf(tick);
      if (!Loop.last) { Loop.last = now; return; }
      var dt = now - Loop.last;
      Loop.last = now;
      if (dt > 100) dt = 100;                              // tab was away: don't spiral
      if (Math.abs(dt - STEP) < 2.5) dt = STEP;            // snap vsync jitter on 60 Hz panels
      Loop.acc += dt;
      var steps = 0;
      while (Loop.acc >= STEP - 0.01 && steps < 5) {
        Input.tick();
        Loop.update();
        Loop.frame++;
        Loop.acc -= STEP;
        steps++;
      }
      if (steps === 5) Loop.acc = 0;
      if (steps > 0) {
        Loop.render();
        Loop._fpsN += steps;
      }
      if (now - Loop._fpsT >= 500) {
        Loop.fps = Math.round(Loop._fpsN * 1000 / (now - Loop._fpsT));
        Loop._fpsT = now; Loop._fpsN = 0;
      }
    }
    Loop.raf = raf(tick);
  };
  Loop.stop = function () { Loop.running = false; };

  /* ---------------------------------------------------------------------- *
   *  Per-stage LIQ / GLOW palettes (fixed by the art bible so tiles, props,
   *  sprites and backdrops all agree). Each is a seamless 8-step loop because
   *  the game colour-cycles these slots. SKY is supplied by each backdrop.
   *  Index 0..5 = stages 1..6, 6 = title / world map.
   * ---------------------------------------------------------------------- */
  var FIRE_LOOP = [[150, 40, 0], [200, 80, 0], [240, 130, 10], [255, 190, 40], [255, 230, 110], [255, 190, 40], [240, 130, 10], [200, 80, 0]];
  GNG.STAGE_PAL = [
    { // 1: moonlit sea / ghost-lantern teal
      liq: [[6, 24, 44], [8, 34, 58], [12, 46, 74], [20, 62, 92], [34, 84, 112], [20, 62, 92], [12, 46, 74], [8, 34, 58]],
      glow: [[20, 90, 70], [30, 120, 90], [50, 160, 110], [90, 200, 140], [150, 240, 180], [90, 200, 140], [50, 160, 110], [30, 120, 90]]
    },
    { // 2: cursed moat (violet-green) / torch fire
      liq: [[24, 10, 48], [36, 16, 70], [52, 26, 96], [60, 60, 120], [70, 110, 130], [60, 60, 120], [52, 26, 96], [36, 16, 70]],
      glow: FIRE_LOOP
    },
    { // 3: blood-dark dungeon pit / torch fire
      liq: [[40, 0, 8], [60, 4, 12], [86, 8, 18], [116, 16, 24], [150, 30, 34], [116, 16, 24], [86, 8, 18], [60, 4, 12]],
      glow: FIRE_LOOP
    },
    { // 4: molten metal / furnace glow
      liq: [[150, 30, 0], [200, 60, 0], [240, 110, 0], [255, 170, 20], [255, 230, 90], [255, 170, 20], [240, 110, 0], [200, 60, 0]],
      glow: [[120, 20, 0], [170, 40, 0], [220, 80, 0], [255, 130, 10], [255, 190, 60], [255, 130, 10], [220, 80, 0], [170, 40, 0]]
    },
    { // 5: toxic nukage / red-alert hell glow
      liq: [[10, 50, 0], [20, 80, 0], [40, 120, 4], [70, 170, 10], [130, 230, 40], [70, 170, 10], [40, 120, 4], [20, 80, 0]],
      glow: [[90, 0, 0], [130, 6, 0], [180, 16, 6], [230, 40, 20], [255, 90, 50], [230, 40, 20], [180, 16, 6], [130, 6, 0]]
    },
    { // 6: hellfire lava / cursed violet energy
      liq: [[90, 0, 10], [140, 6, 6], [200, 30, 0], [245, 80, 0], [255, 160, 30], [245, 80, 0], [200, 30, 0], [140, 6, 6]],
      glow: [[60, 0, 90], [90, 10, 130], [130, 30, 170], [180, 70, 210], [230, 140, 250], [180, 70, 210], [130, 30, 170], [90, 10, 130]]
    },
    { // title / world map
      liq: [[6, 24, 44], [8, 34, 58], [12, 46, 74], [20, 62, 92], [34, 84, 112], [20, 62, 92], [12, 46, 74], [8, 34, 58]],
      glow: FIRE_LOOP
    }
  ];

  /** Load the LIQ/GLOW slots for a stage (0..5, 6 = title/map) and optionally a SKY slot (8 x [r,g,b]). */
  GNG.useStagePalette = function (stage, sky) {
    var sp = GNG.STAGE_PAL[GNG.clamp(stage | 0, 0, GNG.STAGE_PAL.length - 1)];
    GNG.setStagePalette(sky || null, sp.liq, sp.glow);
  };

  /* ====================================================================== *
   *  ENVIRONMENT ART REGISTRIES  (tilesets, parallax backdrops, map, title)
   *
   *  Art modules register per-stage builder functions; the game calls build()
   *  lazily when a stage loads. Missing art falls back to plain procedural
   *  stand-ins so the game always runs.
   * ====================================================================== */

  var TILE_KINDS = ['solid', 'solidTop', 'alt', 'altTop', 'back', 'backAlt', 'platform', 'ladder',
    'spikes', 'cracked', 'bridge', 'conveyor'];
  var FALLBACK_RAMPS = [['brown', 'green'], ['gray', 'olive'], ['slate', 'sand'], ['steel', 'brown'], ['gray', 'maroon'], ['dusk', 'bone']];

  function fbBlock(ramp, seed, lo, hi, top) {
    var b = new Bitmap(16, 16), r = GNG.RAMPS[ramp];
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var v = lo + (hi - lo) * GNG.hash2(x >> 1, y >> 1, seed);
      if (top && y < 3) v = hi + 1 + (y === 0 ? 1 : 0);
      if (x === 15 || y === 15) v -= 1;
      b.data[y * 16 + x] = r[GNG.clamp(Math.round(v), 0, 7)];
    }
    b.ax = 0; b.ay = 0;
    return b;
  }

  function fallbackTiles(stage) {
    var rp = FALLBACK_RAMPS[stage % FALLBACK_RAMPS.length], A = rp[0], B = rp[1], t = {}, i, x, y, b;
    t.solid = []; t.solidTop = []; t.alt = []; t.altTop = []; t.back = []; t.backAlt = [];
    for (i = 0; i < 4; i++) {
      t.solid.push(fbBlock(A, 10 + i, 2, 3.4, false)); t.solidTop.push(fbBlock(A, 20 + i, 2, 3.4, true));
      t.alt.push(fbBlock(B, 30 + i, 2, 3.4, false)); t.altTop.push(fbBlock(B, 40 + i, 2, 3.4, true));
      t.back.push(fbBlock(A, 50 + i, 0.6, 1.4, false));
    }
    t.backAlt.push(fbBlock(B, 60, 0.6, 1.4, false)); t.backAlt.push(fbBlock(B, 61, 0.6, 1.4, false));
    t.platform = [];
    for (i = 0; i < 3; i++) {
      b = new Bitmap(16, 16); b.ax = 0; b.ay = 0;
      b.rect(0, 0, 16, 5, GNG.RAMPS[A][3]); b.rect(0, 0, 16, 1, GNG.RAMPS[A][5]); b.rect(0, 4, 16, 1, GNG.RAMPS[A][1]);
      t.platform.push(b);
    }
    b = new Bitmap(16, 16); b.ax = 0; b.ay = 0;
    b.rect(3, 0, 2, 16, GNG.RAMPS.brown[4]); b.rect(11, 0, 2, 16, GNG.RAMPS.brown[4]);
    for (y = 2; y < 16; y += 4) b.rect(3, y, 10, 1, GNG.RAMPS.brown[5]);
    t.ladder = [b];
    t.spikes = [];
    for (i = 0; i < 2; i++) {
      b = new Bitmap(16, 16); b.ax = 0; b.ay = 0;
      for (x = 0; x < 16; x++) {
        var hgt = 4 + Math.abs(((x + i * 2) % 8) - 4) * 2;
        b.rect(x, 4 + hgt - 4, 1, 16 - hgt, GNG.RAMPS.steel[(x % 8) < 4 ? 5 : 3]);
      }
      t.spikes.push(b);
    }
    t.cracked = [];
    for (i = 0; i < 2; i++) {
      b = fbBlock(A, 70 + i, 2, 3.4, i === 0);
      b.line(3, 1, 7, 8, GNG.RAMPS[A][0]); b.line(7, 8, 5, 15, GNG.RAMPS[A][0]); b.line(7, 8, 13, 12, GNG.RAMPS[A][0]);
      t.cracked.push(b);
    }
    t.bridge = [];
    for (i = 0; i < 2; i++) {
      b = new Bitmap(16, 16); b.ax = 0; b.ay = 0;
      b.rect(0, 0, 16, 6, GNG.RAMPS.brown[3]); b.rect(0, 0, 16, 1, GNG.RAMPS.brown[5]); b.rect(0, 5, 16, 1, GNG.RAMPS.brown[1]);
      b.rect(7, 0, 1, 6, GNG.RAMPS.brown[1]);
      if (i) b.line(2, 0, 5, 5, GNG.RAMPS.brown[0]);
      t.bridge.push(b);
    }
    t.conveyor = [];
    for (i = 0; i < 4; i++) {
      b = fbBlock('steel', 80, 1.5, 2.5, false);
      b.rect(0, 0, 16, 4, GNG.RAMPS.gray[1]);
      for (x = -4; x < 16; x += 4) b.rect(x + i, 1, 2, 2, GNG.RAMPS.gray[4]);
      t.conveyor.push(b);
    }
    t.props = {};
    return t;
  }

  GNG.TILE_KINDS = TILE_KINDS;
  GNG.Tiles = {
    builders: {},
    /** register(stageIndex 0..5, function () { return tileset; }) — see the art contract. */
    register: function (stage, fn) { GNG.Tiles.builders[stage] = fn; },
    /** Build (and validate / complete) the tileset for a stage. */
    build: function (stage) {
      var t = null, fb = fallbackTiles(stage), i, k;
      try { if (GNG.Tiles.builders[stage]) t = GNG.Tiles.builders[stage](); }
      catch (e) { GNG.artWarnings.push('Tiles stage ' + stage + ' threw: ' + e.message); t = null; }
      if (!t) t = {};
      for (i = 0; i < TILE_KINDS.length; i++) {
        k = TILE_KINDS[i];
        if (!t[k] || !t[k].length) { t[k] = fb[k]; if (GNG.Tiles.builders[stage]) GNG.artWarnings.push('Tiles stage ' + stage + ': missing kind ' + k); }
        for (var j = 0; j < t[k].length; j++) { t[k][j].ax = 0; t[k][j].ay = 0; }
      }
      if (!t.props) t.props = {};
      for (k in t.props) if (!(t.props[k] instanceof Array)) t.props[k] = [t.props[k]];
      return t;
    },
    /** Frames of a decorative prop (always an array with >= 1 bitmap). */
    prop: function (tileset, name) {
      var p = tileset && tileset.props && tileset.props[name];
      if (p && p.length) return p;
      if (!GNG.missingSprites['prop:' + name]) GNG.missingSprites['prop:' + name] = true;
      return [getPlaceholder()];
    }
  };

  function fallbackBackdrop(stage, info) {
    var i, x, y, far = new Bitmap(512, 200), mid = new Bitmap(512, 120), near = new Bitmap(512, 100);
    var ramps = ['night', 'night', 'slate', 'rust', 'maroon', 'dusk'], r = GNG.RAMPS[ramps[stage % 6]];
    for (y = 0; y < 200; y++) for (x = 0; x < 512; x++) far.data[y * 512 + x] = GNG.shade('sky', y / 199, x, y);
    for (i = 0; i < 90; i++) far.pset((GNG.hash2(i, 1, 5) * 512) | 0, (GNG.hash2(i, 2, 5) * 110) | 0, GNG.C.white);
    for (x = 0; x < 512; x++) {
      var a = x / 512 * Math.PI * 2;
      var h1 = 60 + Math.sin(a * 3) * 18 + Math.sin(a * 7 + 1) * 9 + GNG.hash2(x >> 3, 0, 3) * 6;
      for (y = Math.round(120 - h1); y < 120; y++) mid.data[y * 512 + x] = r[1];
      var h2 = 40 + Math.sin(a * 5 + 2) * 14 + Math.sin(a * 11) * 6;
      for (y = Math.round(100 - h2); y < 100; y++) near.data[y * 512 + x] = r[0];
    }
    return {
      layers: [
        { bmp: far, fx: 0.06, fy: 0, y: 0, wrap: true },
        { bmp: mid, fx: 0.25, fy: 0.05, y: 60, wrap: true },
        { bmp: near, fx: 0.5, fy: 0.1, y: 100, wrap: true }
      ],
      lightning: stage === 1, cycleLiq: 8, cycleGlow: 6
    };
  }

  GNG.Backdrops = {
    builders: {}, mapBuilder: null, titleBuilder: null,
    /** register(stageIndex 0..5, function (info) { return backdrop; }) — see the art contract. */
    register: function (stage, fn) { GNG.Backdrops.builders[stage] = fn; },
    registerMap: function (fn) { GNG.Backdrops.mapBuilder = fn; },
    registerTitle: function (fn) { GNG.Backdrops.titleBuilder = fn; },
    build: function (stage, info) {
      var b = null;
      info = info || { levelW: 3200, levelH: 208, marks: {} };
      try { if (GNG.Backdrops.builders[stage]) b = GNG.Backdrops.builders[stage](info); }
      catch (e) { GNG.artWarnings.push('Backdrop stage ' + stage + ' threw: ' + e.message); b = null; }
      if (!b || !b.layers || !b.layers.length) b = fallbackBackdrop(stage, info);
      return b;
    },
    buildMap: function () {
      var m = null;
      try { if (GNG.Backdrops.mapBuilder) m = GNG.Backdrops.mapBuilder(); }
      catch (e) { GNG.artWarnings.push('Map art threw: ' + e.message); m = null; }
      if (!m || !m.bmp) {
        var b = new Bitmap(320, 200), x, y;
        for (y = 0; y < 200; y++) for (x = 0; x < 320; x++) {
          b.data[y * 320 + x] = GNG.shade('tan', 0.55 + GNG.fbm(x / 40, y / 40, 9, 3) * 0.3, x, y);
        }
        m = { bmp: b, nodes: [{ x: 40, y: 140 }, { x: 88, y: 100 }, { x: 136, y: 136 }, { x: 184, y: 96 }, { x: 232, y: 132 }, { x: 280, y: 84 }] };
      }
      return m;
    },
    buildTitle: function () {
      var t = null;
      try { if (GNG.Backdrops.titleBuilder) t = GNG.Backdrops.titleBuilder(); }
      catch (e) { GNG.artWarnings.push('Title art threw: ' + e.message); t = null; }
      if (!t || !t.bmp) {
        var b = new Bitmap(320, 200), x, y;
        for (y = 0; y < 200; y++) for (x = 0; x < 320; x++) b.data[y * 320 + x] = GNG.shade('sky', y / 199, x, y);
        t = { bmp: b };
      }
      return t;
    }
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
