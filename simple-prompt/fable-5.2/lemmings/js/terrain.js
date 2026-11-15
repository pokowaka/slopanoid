/* BEAT TRIBE - destructible terrain bitmap, procedural textures and the level builder.
 * Terrain is one byte of material + one packed colour + one "glow weight" per pixel.
 * Nothing here is loaded from disk: every texture is a pure function of (x, y). */
(function (g) {
  'use strict';
  var BT = g.BT, hex = BT.hex, mix = BT.mix, hash = BT.hash, noise = BT.noise;
  var M = BT.MAT = { AIR: 0, SOLID: 1, STEEL: 2, OWL: 3, OWR: 4, BRICK: 5 };
  var WHITE = BT.WHITE, BLACK = BT.BLACK;
  function mod(a, n) { return ((a % n) + n) % n; }
  function pal(a) { return a.map(hex); }

  // ---------------------------------------------------------------- bitmap
  function Terrain(w) {
    this.w = w; this.h = BT.LH;
    this.mat = new Uint8Array(w * this.h);
    this.col = new Uint32Array(w * this.h);
    this.glow = new Uint8Array(w * this.h);
    this.deco = new Uint32Array(w * this.h);        // non-solid scenery (flowers, lamps, crystals...)
    this.ver = 0;                                   // bumped on every change (minimap cache)
  }
  var Tp = Terrain.prototype;
  // Level sides are solid walls, the sky is open, the floor below the level is a void.
  Tp.solid = function (x, y) {
    if (x < 0 || x >= this.w) return true;
    if (y < 0 || y >= this.h) return false;
    return this.mat[y * this.w + x] !== 0;
  };
  Tp.at = function (x, y) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return 0;
    return this.mat[y * this.w + x];
  };
  Tp.put = function (x, y, m, c, gl) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    var i = y * this.w + x;
    this.mat[i] = m; this.col[i] = c; this.glow[i] = gl || 0; this.ver++;
  };
  Tp.del = function (x, y) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false;
    var i = y * this.w + x, m = this.mat[i], k, j;
    if (m && m !== M.STEEL) {
      this.mat[i] = 0; this.ver++;
      for (k = 1, j = i - this.w; k <= 12 && j >= 0 && !this.mat[j]; k++, j -= this.w) this.deco[j] = 0;   // scenery falls with its ground
      return true;
    }
    return false;
  };
  BT.Terrain = Terrain;

  // ---------------------------------------------------------------- textures
  function tNoise(cols, sc, seed, speck) {          // organic dithered ramp
    var p = pal(cols), n = p.length, sp = speck !== undefined ? hex(speck) : 0;
    return function (x, y) {
      var v = noise(x, y, sc, seed) * 0.72 + hash(x, y, seed + 9) * 0.28;
      if (sp && hash(x >> 1, y >> 1, seed + 5) > 0.965) return sp;
      return p[Math.min(n - 1, (v * n) | 0)];
    };
  }
  function tBrick(cols, bw, bh, seed) {             // [mortar, dark, mid, light]
    var p = pal(cols);
    return function (x, y) {
      var row = Math.floor(y / bh), ox = (row & 1) ? (bw >> 1) : 0;
      var bx = mod(x + ox, bw), by = mod(y, bh), id = Math.floor((x + ox) / bw);
      if (bx === 0 || by === 0) return p[0];
      var h = hash(id, row, seed), c = h < 0.33 ? p[1] : h < 0.75 ? p[2] : p[3];
      if (by === 1 || bx === 1) c = mix(c, WHITE, 0.2);
      else if (by === bh - 1 || bx === bw - 1) c = mix(c, BLACK, 0.22);
      if (hash(x, y, seed + 3) > 0.92) c = mix(c, BLACK, 0.14);
      return c;
    };
  }
  function tGirder(cols) {                          // [dark, mid, light, neon]
    var p = pal(cols);
    return function (x, y) {
      var by = mod(y, 16), bx = mod(x, 16);
      if (by === 0) return p[3];
      if (by === 15 || by === 1) return p[2];
      if (by === 14 || by === 2) return p[1];
      if (mod(x + y, 16) < 2 || mod(x - y, 16) < 2) return p[1];
      if ((bx === 4 || bx === 12) && (by === 5 || by === 10)) return p[2];
      return hash(x, y, 5) > 0.88 ? p[1] : p[0];
    };
  }
  function tPlate(cols, bw, bh) {                   // riveted plates: [edge, mid, light, rivet]
    var p = pal(cols);
    return function (x, y) {
      var bx = mod(x, bw), by = mod(y, bh);
      if (bx === 0 || by === 0) return p[0];
      if (bx === bw - 1 || by === bh - 1) return mix(p[1], BLACK, 0.3);
      if ((bx === 2 || bx === bw - 3) && (by === 2 || by === bh - 3)) return p[3];
      if (bx === 1 || by === 1) return p[2];
      return mod(x + y, 6) === 0 ? p[2] : p[1];
    };
  }
  function tChrome(cols, grid) {                    // vertical chrome gradient bands + grid lines
    var p = pal(cols), n = p.length, gc = hex(grid);
    return function (x, y) {
      var by = mod(y, 24);
      if (mod(x, 16) === 0 || by === 0) return gc;
      if (by === 3) return WHITE;
      var v = by / 24 * (n - 1) + (hash(x, y, 3) - 0.5) * 0.9;
      return p[BT.clamp(Math.round(v), 0, n - 1)];
    };
  }
  function tRock(cols, glows, seed) {               // cave rock with bioluminescent specks + veins
    var p = pal(cols), n = p.length, gl = pal(glows);
    return function (x, y) {
      var v = noise(x, y, 9, seed) * 0.6 + noise(x, y, 3, seed + 1) * 0.25 + hash(x, y, seed + 2) * 0.15;
      var vein = Math.abs(noise(x, y, 14, seed + 7) - 0.5);
      if (vein < 0.012) return gl[0];
      if (hash(x, y, seed + 4) > 0.988) return gl[1 + ((x + y) & 1)];
      return p[Math.min(n - 1, (v * n) | 0)];
    };
  }
  function tMarble(cols, vein) {                    // marble blocks with veins
    var p = pal(cols), n = p.length, vc = hex(vein);
    return function (x, y) {
      var bx = mod(x + ((Math.floor(y / 16) & 1) ? 16 : 0), 32), by = mod(y, 16);
      if (bx === 0 || by === 0) return mix(p[0], BLACK, 0.35);
      var w = Math.sin((x + noise(x, y, 22, 1) * 46) * 0.21 + noise(x, y, 8, 2) * 5 + y * 0.07);
      if (Math.abs(w) < 0.07) return vc;
      var v = noise(x, y, 12, 3) * 0.75 + hash(x, y, 4) * 0.25;
      var c = p[Math.min(n - 1, (v * n) | 0)];
      return (by === 1 || bx === 1) ? mix(c, WHITE, 0.3) : c;
    };
  }
  function tFlute(cols, cw) {                       // fluted columns / drapes
    var p = pal(cols), n = p.length;
    return function (x, y) {
      var bx = mod(x, cw), d = Math.abs(bx - (cw - 1) / 2) / (cw / 2);
      var i = BT.clamp(Math.round((1 - d) * (n - 1) + (hash(x, y, 8) - 0.5) * 0.6), 0, n - 1);
      return mod(y, 32) === 0 ? p[0] : p[i];
    };
  }
  function tPlank(cols) {
    var p = pal(cols);
    return function (x, y) {
      var by = mod(y, 6), row = Math.floor(y / 6);
      if (by === 0) return p[0];
      if (mod(x + row * 13, 29) === 0) return p[0];
      return p[1 + ((hash(x >> 2, row, 6) * 2.99) | 0)];
    };
  }
  function tOneWay(base, dir, arrow) {              // base texture + chevrons pointing `dir`
    var ac = hex(arrow);
    return function (x, y) {
      var ax = mod(x, 12), ay = mod(y, 10), k = dir < 0 ? ax : 11 - ax, d = Math.abs(ay - 4);
      if ((k - 2 === d && d <= 3) || (ay === 4 && k >= 2 && k <= 8)) return ac;
      return mix(base(x, y), BLACK, 0.4);
    };
  }

  // Per-world texture sets: a = main body, b = masonry/structure, c = accent, steel, one-way.
  function theme(a, b, c, steel, arrow) {
    return { a: a, b: b, c: c, steel: steel, owl: tOneWay(b, -1, arrow), owr: tOneWay(b, 1, arrow) };
  }
  var steelGrey = tPlate([0x30343c, 0x7c8494, 0xb8c0cc, 0xe8ecf4], 16, 8);
  BT.THEMES = {
    meadow: theme(tNoise([0x5a3418, 0x6e4420, 0x845428, 0x9a6830], 5, 11, 0xc09058),
      tBrick([0x38383f, 0x6c6c7c, 0x8a8a9c, 0xa4a4b4], 16, 8, 2),
      tPlank([0x4a2c10, 0x8a5a28, 0x9c6a30, 0x7a4e20]), steelGrey, 0xf8e040),
    garden: theme(tNoise([0x4e3a1c, 0x67501f, 0x7f6524, 0x977c2c], 5, 21, 0x3c8c34),
      tBrick([0x2c3440, 0x60748a, 0x7e94a8, 0x9cb4c4], 16, 8, 3),
      tPlank([0x3c2810, 0x7c5424, 0x94682c, 0x6c481c]), steelGrey, 0xf8e040),
    acid: theme(tGirder([0x181c2c, 0x343c58, 0x5c6890, 0xf040c0]),
      tPlate([0x14161c, 0x3a3e48, 0x565c68, 0x8890a0], 20, 10),
      tNoise([0x3c1c10, 0x5c2c14, 0x7c3c18, 0x9c5020], 4, 31, 0xd0f040),
      tPlate([0x202428, 0x6c7480, 0xa0a8b4, 0xf0e040], 16, 8), 0x40f0f0),
    sunset: theme(tChrome([0xe8f4ff, 0x98c8f8, 0x5078e0, 0x3838a8, 0x702890, 0xc040a0], 0xff50c0),
      tBrick([0xff50c0, 0x281848, 0x34205c, 0x402870], 16, 16, 5),
      tChrome([0xfff0a0, 0xffb040, 0xf06030, 0xa02850, 0x501860], 0x40e8f8),
      tPlate([0x181028, 0x585878, 0x9090b8, 0x40e8f8], 16, 8), 0xf8f040),
    cave: theme(tRock([0x10222c, 0x183440, 0x20444c, 0x2c585c], [0x30d0b0, 0x60f8e0, 0xb060f8], 41),
      tRock([0x241838, 0x34224c, 0x442c60, 0x583878], [0xc070f8, 0xf0a0ff, 0x60f8e0], 43),
      tNoise([0x1c4018, 0x286020, 0x388028, 0x50a030], 4, 45, 0xa0f860),
      tPlate([0x101820, 0x485868, 0x7890a0, 0x60f8e0], 16, 8), 0xf8f040),
    hall: theme(tMarble([0xb8b0a0, 0xd0c8b8, 0xe4dccc, 0xf4eee0], 0x8c8894),
      tFlute([0x8c8478, 0xb0a898, 0xd0c8b8, 0xece4d4], 8),
      tFlute([0x581018, 0x7c1820, 0xa02028, 0xc03038], 12),
      tPlate([0x3c3018, 0x9c7c30, 0xd8b048, 0xfff0a0], 16, 8), 0xc02030)
  };

  // ---------------------------------------------------------------- level builder
  function Builder(level) {
    this.level = level;
    this.world = BT.WORLDS[level.world];
    this.th = BT.THEMES[this.world.key];
    this.T = new Terrain(level.width);
    this.objs = { hatch: null, exit: null, liquids: [], fires: [], crushers: [] };
  }
  var Bp = Builder.prototype;
  Bp.tex = function (t) { return typeof t === 'function' ? t : this.th[t]; };
  function val(v, x) { return typeof v === 'function' ? Math.round(v(x)) : v; }

  // Filled rectangle [x0,x1) x [y0,y1).
  Bp.fill = function (t, x0, y0, x1, y1, m) {
    var f = this.tex(t), x, y; m = m || M.SOLID;
    for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) this.T.put(x, y, m, f(x, y));
    return this;
  };
  // Column fill between top(x) and bot(x); both may be numbers or functions.
  Bp.hill = function (t, x0, x1, top, bot, m) {
    var f = this.tex(t), x, y, a, b; m = m || M.SOLID;
    for (x = x0; x < x1; x++) {
      a = val(top, x); b = bot === undefined ? this.T.h : val(bot, x);
      for (y = a; y < b; y++) this.T.put(x, y, m, f(x, y));
    }
    return this;
  };
  Bp.ell = function (t, cx, cy, rx, ry, m) {
    var f = this.tex(t), x, y, dx, dy; m = m || M.SOLID;
    for (y = cy - ry; y <= cy + ry; y++) for (x = cx - rx; x <= cx + rx; x++) {
      dx = (x - cx) / (rx + 0.5); dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) this.T.put(x, y, m, f(x, y));
    }
    return this;
  };
  Bp.cut = function (x0, y0, x1, y1) {
    var x, y;
    for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) this.T.put(x, y, 0, 0);
    return this;
  };
  Bp.cutEll = function (cx, cy, rx, ry) {
    var x, y, dx, dy;
    for (y = cy - ry; y <= cy + ry; y++) for (x = cx - rx; x <= cx + rx; x++) {
      dx = (x - cx) / (rx + 0.5); dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1) this.T.put(x, y, 0, 0);
    }
    return this;
  };
  Bp.steel = function (x0, y0, x1, y1) { return this.fill('steel', x0, y0, x1, y1, M.STEEL); };
  Bp.oneway = function (dir, x0, y0, x1, y1) { return this.fill(dir < 0 ? 'owl' : 'owr', x0, y0, x1, y1, dir < 0 ? M.OWL : M.OWR); };
  // First solid row at column x, scanning down from y0.
  Bp.top = function (x, y0) {
    for (var y = y0 || 0; y < this.T.h; y++) if (this.T.at(x, y)) return y;
    return this.T.h;
  };
  Bp.hatch = function (x, y, dir) { this.objs.hatch = { x: x, y: y, dir: dir || 1 }; return this; };
  // Exit door standing on the ground at column x (searching down from y0).
  Bp.exit = function (x, y0) { this.objs.exit = { x: x, y: this.top(x, y0) - 1 }; return this; };
  Bp.water = function (x0, x1, y) { this.objs.liquids.push({ x0: x0, x1: x1, y: y, kind: 'water' }); return this; };
  Bp.lava = function (x0, x1, y) { this.objs.liquids.push({ x0: x0, x1: x1, y: y, kind: 'lava' }); return this; };
  // Fire pit sitting on the ground at column x.
  Bp.fire = function (x, y0) { this.objs.fires.push({ x: x, y: this.top(x, y0) - 1 }); return this; };
  // Crusher: piston hanging from y0 that slams to the ground at x every `period` beats.
  Bp.crusher = function (x, y0, period, phase) {
    this.objs.crushers.push({ x: x, y0: y0, y1: this.top(x, y0 + 4) - 1, period: period || 4, phase: phase || 0 });
    return this;
  };

  // Bake the score onto the terrain: every 16px column is a note block whose surface
  // is capped in the colour of its scale degree; the body is tinted with the same hue.
  Bp.finish = function () {
    var T = this.T, w = T.w, h = T.h, mel = this.level.melody, world = this.world, x, y, i, m, d, c, gl, base, dc;
    for (x = 0; x < w; x++) {
      dc = BT.degColor(world, mel[(x >> 4) % mel.length]);
      d = 99;
      for (y = 0; y < h; y++) {
        i = y * w + x; m = T.mat[i];
        if (!m) { d = 0; continue; }
        base = T.col[i];
        if (m === M.STEEL) { c = d === 0 ? mix(base, dc, 0.75) : d === 1 ? mix(base, dc, 0.4) : base; gl = d < 2 ? 210 : 20; }
        else if (m === M.OWL || m === M.OWR) { c = d === 0 ? dc : base; gl = d === 0 ? 230 : 40; }
        else if (d === 0) { c = mix(dc, WHITE, 0.32); gl = 255; }
        else if (d === 1) { c = dc; gl = 235; }
        else if (d === 2) { c = mix(dc, BLACK, 0.28); gl = 180; }
        else if (d === 3) { c = mix(base, dc, 0.45); gl = 110; }
        else { c = mix(base, dc, 0.15); gl = 44; }
        if (d > 2 && y + 1 < h && !T.mat[i + w]) c = mix(c, BLACK, 0.4);   // underside shadow
        T.col[i] = c; T.glow[i] = gl;
        d++;
      }
    }
    T.ver++;
    return this;
  };

  // Scatter harmless, non-solid scenery on free surfaces (and under ceilings). Purely visual:
  // the simulation never reads the deco layer.
  var DECO = {
    meadow: { top: ['tuft', 'flower', 'tuft', 'shroom', 'bush', 'flower'], hang: [], cols: [0x38a830, 0x58d048, 0xf04858, 0xf8e040, 0xf0f0f0, 0xe060d8] },
    garden: { top: ['tuft', 'flower', 'bush', 'tuft', 'flower', 'shroom'], hang: [], cols: [0x2c9838, 0x50c850, 0xf8a030, 0xf8f060, 0xf0f0f0, 0x60a0f8] },
    acid: { top: ['barrel', 'cone', 'lamp', 'cone'], hang: ['cable'], cols: [0x30343c, 0xf0d020, 0xf06810, 0xf040c0, 0x40f0f0, 0xf0f0f0] },
    sunset: { top: ['palm', 'post', 'palm', 'post'], hang: [], cols: [0x281848, 0xff50c0, 0x40e8f8, 0xf8f040, 0x702890, 0xffffff] },
    cave: { top: ['gshroom', 'crystal', 'gshroom', 'crystal'], hang: ['drip'], cols: [0x1c6c64, 0x38d8b8, 0x80f8e0, 0x7040b0, 0xc070f8, 0x183440] },
    hall: { top: ['candle', 'urn', 'candle'], hang: ['chain'], cols: [0xd8b048, 0xfff0a0, 0xf89020, 0xe4dccc, 0xa02028, 0x9c7c30] }
  };
  Bp.decorate = function () {
    var T = this.T, w = T.w, h = T.h, set = DECO[this.world.key], o = this.objs, seed = 500 + this.level.index * 37, x, y, i, r, k, ok, c = set.cols.map(hex);
    function D(px, py, col) { if (px >= 0 && px < w && py >= 0 && py < h && !T.mat[py * w + px]) T.deco[py * w + px] = col; }
    function busy(px) {
      var j;
      if (Math.abs(px - o.hatch.x) < 24 || Math.abs(px - o.exit.x) < 18) return true;
      for (j = 0; j < o.fires.length; j++) if (Math.abs(px - o.fires[j].x) < 14) return true;
      for (j = 0; j < o.crushers.length; j++) if (Math.abs(px - o.crushers[j].x) < 16) return true;
      for (j = 0; j < o.liquids.length; j++) if (px >= o.liquids[j].x0 - 2 && px < o.liquids[j].x1 + 2) return true;
      return false;
    }
    var draw = {
      tuft: function (x, y) { D(x, y, c[0]); D(x, y - 1, c[1]); D(x - 1, y, c[1]); D(x + 2, y, c[0]); D(x + 2, y - 1, c[0]); },
      flower: function (x, y, v) { var p = c[2 + (v % 4)]; D(x, y, c[0]); D(x, y - 1, c[0]); D(x, y - 2, c[1]); D(x, y - 3, c[3]); D(x - 1, y - 3, p); D(x + 1, y - 3, p); D(x, y - 4, p); D(x, y - 2, p); D(x + 1, y - 1, c[1]); },
      shroom: function (x, y) { D(x, y, c[4]); D(x, y - 1, c[4]); D(x - 1, y - 2, c[2]); D(x, y - 2, c[2]); D(x + 1, y - 2, c[2]); D(x, y - 3, c[2]); D(x - 2, y - 2, c[2]); D(x + 2, y - 2, c[2]); D(x - 1, y - 3, c[4]); },
      bush: function (x, y) { var a, b; for (a = -3; a <= 3; a++) for (b = 0; b < 4 - (Math.abs(a) >> 1); b++) D(x + a, y - b, hash(x + a, y - b, 3) > 0.5 ? c[0] : c[1]); D(x - 1, y - 3, c[2]); D(x + 2, y - 2, c[3]); },
      barrel: function (x, y) { var a, b; for (b = 0; b < 8; b++) for (a = -2; a <= 2; a++) D(x + a, y - b, b === 0 || b === 7 || b === 4 ? c[0] : ((a + b) & 2) ? c[1] : c[0]); },
      cone: function (x, y) { var b, a; for (b = 0; b < 6; b++) for (a = -(2 - (b >> 1)); a <= 2 - (b >> 1); a++) D(x + a, y - b, b === 2 || b === 3 ? c[5] : c[2]); D(x - 3, y, c[2]); D(x + 3, y, c[2]); },
      lamp: function (x, y, v) { var b, p = c[3 + (v & 1)]; for (b = 0; b < 10; b++) D(x, y - b, c[0]); D(x - 1, y - 10, p); D(x, y - 10, p); D(x + 1, y - 10, p); D(x, y - 11, c[5]); D(x - 1, y, c[0]); D(x + 1, y, c[0]); },
      palm: function (x, y) { var b; for (b = 0; b < 11; b++) D(x + (b > 6 ? 1 : 0), y - b, c[0]); [[-1, -11], [-2, -11], [-3, -10], [-4, -9], [2, -11], [3, -11], [4, -10], [5, -9], [0, -12], [1, -12], [-2, -12], [3, -12]].forEach(function (q, n) { D(x + q[0], y + q[1], n < 8 ? c[1] : c[2]); }); },
      post: function (x, y, v) { var b, p = c[2 + (v & 1)]; for (b = 0; b < 7; b++) D(x, y - b, c[4]); D(x - 1, y - 7, p); D(x, y - 7, c[5]); D(x + 1, y - 7, p); D(x, y - 8, p); D(x, y - 6, p); },
      gshroom: function (x, y) { D(x, y, c[0]); D(x, y - 1, c[0]); D(x, y - 2, c[0]); for (var a = -2; a <= 2; a++) D(x + a, y - 3, c[1]); D(x - 1, y - 4, c[2]); D(x, y - 4, c[2]); D(x + 1, y - 4, c[2]); D(x - 3, y - 2, c[0]); D(x + 3, y - 2, c[0]); },
      crystal: function (x, y) { var b; for (b = 0; b < 7; b++) { D(x, y - b, c[4]); if (b > 0 && b < 5) { D(x - 1, y - b, c[3]); D(x + 1, y - b, c[3]); } } D(x + 3, y, c[3]); D(x + 3, y - 1, c[4]); D(x + 3, y - 2, c[4]); },
      candle: function (x, y) { var b; for (b = 0; b < 7; b++) D(x, y - b, c[0]); D(x - 1, y, c[5]); D(x + 1, y, c[5]); for (b = -2; b <= 2; b++) D(x + b, y - 7, c[0]); D(x - 2, y - 8, c[3]); D(x + 2, y - 8, c[3]); D(x, y - 8, c[3]); D(x - 2, y - 9, c[2]); D(x + 2, y - 9, c[2]); D(x, y - 9, c[1]); },
      urn: function (x, y) { D(x - 1, y, c[5]); D(x, y, c[5]); D(x + 1, y, c[5]); var b; for (b = 1; b < 5; b++) { D(x - 2, y - b, c[3]); D(x - 1, y - b, c[3]); D(x, y - b, c[1]); D(x + 1, y - b, c[3]); D(x + 2, y - b, c[5]); } D(x - 1, y - 5, c[0]); D(x, y - 5, c[0]); D(x + 1, y - 5, c[0]); D(x, y - 6, c[4]); D(x - 1, y - 7, c[4]); D(x + 1, y - 7, c[4]); },
      cable: function (x, y, v) { var n = 4 + (v % 7), b; for (b = 0; b < n; b++) D(x, y + b, c[0]); D(x - 1, y + n, c[1]); D(x, y + n, c[1]); D(x + 1, y + n, c[1]); D(x, y + n + 1, c[5]); },
      drip: function (x, y, v) { var n = 3 + (v % 6), b; for (b = 0; b < n; b++) { D(x, y + b, c[5]); if (b < n / 2) { D(x - 1, y + b, c[5]); D(x + 1, y + b, c[5]); } } D(x, y + n, c[1]); },
      chain: function (x, y, v) { var n = 5 + (v % 6), b; for (b = 0; b < n; b++) D(x, y + b, (b & 1) ? c[0] : c[5]); D(x - 1, y + n, c[0]); D(x, y + n, c[0]); D(x + 1, y + n, c[0]); D(x - 1, y + n - 1, c[2]); D(x + 1, y + n - 1, c[2]); }
    };
    for (x = 6; x < w - 6; x += 3) {
      if (busy(x)) continue;
      for (y = 14; y < h - 1; y++) {
        i = y * w + x;
        if (T.mat[i] && !T.mat[i - w] && set.top.length) {                 // a floor: needs flat ground and headroom
          r = hash(x, y, seed);
          if (r > 0.11) continue;
          ok = T.mat[i - 3] && T.mat[i + 3] && !T.mat[i - w - 3] && !T.mat[i - w + 3];
          for (k = 1; ok && k <= 13; k++) if (T.mat[i - k * w]) ok = false;
          if (ok) { k = (r * 9000) | 0; draw[set.top[k % set.top.length]](x, y - 1, k); }
        } else if (!T.mat[i] && T.mat[i - w] && set.hang.length) {         // a ceiling: needs free air below
          r = hash(x, y, seed + 1);
          if (r > 0.07) continue;
          ok = T.mat[i - w - 2] && T.mat[i - w + 2];
          for (k = 1; ok && k <= 16; k++) if (y + k >= h || T.mat[i + k * w]) ok = false;
          if (ok) { k = (r * 9000) | 0; draw[set.hang[k % set.hang.length]](x, y, k); }
        }
      }
    }
  };

  BT.buildLevel = function (level) {
    var b = new Builder(level);
    level.build(b);
    b.finish();
    if (!b.objs.hatch || !b.objs.exit) throw new Error('level ' + level.id + ' needs a hatch and an exit');
    b.decorate();
    if (!b.objs.hatch || !b.objs.exit) throw new Error('level ' + level.id + ' needs a hatch and an exit');
    return b;
  };
})(typeof window !== 'undefined' ? window : globalThis);
