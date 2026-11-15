/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * backdrops_b.js — parallax backdrops for stages 4-6 and the title-screen background.
 *
 *   stage 4 (index 3)  The Lemmings Crusher Foundry      — furnace hall, gears, chains
 *   stage 5 (index 4)  Phobos E1M1 Necropolis            — red dusk, Mars-rise, UAC base / graveyard
 *   stage 6 (index 5)  Throne of Astaroth-LeChuck-9000   — infernal cathedral, organ, floppy-disk rose windows
 *   title              moonlit graveyard hill + demon castle
 *
 * Everything is painted procedurally at stage load (seeded, deterministic, no assets):
 * float "light fields" + silhouette masks quantised to the palette with ordered dithering,
 * plus hand-placed pixel details. SKY slot colours (sky0..7) are the only ones lightning touches,
 * LIQ / GLOW slot colours are palette-cycled by the game, so fire / molten metal / windows animate for free.
 *
 * Classic script, no DOM access. Loads after engine.js.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.Backdrops || !GNG.Bitmap) return;

  var Bitmap = GNG.Bitmap, C = GNG.C, R = GNG.RAMPS;
  var SKY = R.sky, LIQ = R.liq, GLOW = R.glow;
  var PI = Math.PI, TAU = Math.PI * 2;
  // Math locals (closure slots are much faster than global lookups, esp. in sandboxed contexts)
  var floor = Math.floor, ceil = Math.ceil, round = Math.round, abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow;
  var sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, exp = Math.exp, imul = Math.imul, mmin = Math.min, mmax = Math.max;

  /** Same integer hash as GNG.hash2 -> [0,1). */
  function hash2(x, y, seed) {
    var h = (imul(x | 0, 374761393) + imul(y | 0, 668265263) + imul((seed | 0) + 1, 1274126177)) | 0;
    h = imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** 4x4 ordered-dither threshold in (0,1) — identical to GNG.bayer. */
  function bayer(x, y) { return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }

  /* ====================================================================== *
   *  PAINTER'S TOOLKIT
   * ====================================================================== */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function mod(a, n) { a %= n; return a < 0 ? a + n : a; }

  /** Value noise that repeats every `px` lattice cells along x (px = 0: no wrap) -> seamless layers. */
  function pnoise(x, y, seed, px) {
    var xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = xi, x1 = xi + 1;
    if (px) { x0 = mod(x0, px); x1 = mod(x1, px); }
    var a = hash2(x0, yi, seed), b = hash2(x1, yi, seed), c = hash2(x0, yi + 1, seed), d = hash2(x1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /** Fractal periodic noise in [0,1). px = period (lattice cells) of the first octave. */
  function pfbm(x, y, seed, oct, px) {
    var sum = 0, amp = 0.5, norm = 0;
    for (var i = 0; i < oct; i++) {
      sum += amp * pnoise(x, y, seed + i * 17, px);
      norm += amp; amp *= 0.5; x *= 2; y *= 2; px *= 2;
    }
    return sum / norm;
  }

  /** Ordered-dithered pick from a ramp array; lvl is a FLOAT shade index (0 = darkest). */
  function sh(ramp, lvl, x, y) {
    var i = floor(lvl + bayer(x, y)), n = ramp.length - 1;
    return ramp[i < 0 ? 0 : (i > n ? n : i)];
  }
  /** true with probability t, ordered (decorrelated from sh() by an offset matrix). */
  function dth(t, x, y) { return bayer(x + 2, y + 1) < t; }

  /** Add a soft elliptical glow to a float field (wraps in x). */
  function addGlow(F, w, h, cx, cy, rx, ry, amp) {
    var x0 = floor(cx - rx * 2.6), x1 = ceil(cx + rx * 2.6);
    var y0 = mmax(0, floor(cy - ry * 2.6)), y1 = mmin(h - 1, ceil(cy + ry * 2.6));
    for (var y = y0; y <= y1; y++) {
      var dy = (y - cy) / ry;
      for (var x = x0; x <= x1; x++) {
        var dx = (x - cx) / rx, d = dx * dx + dy * dy;
        if (d < 6.8) F[y * w + mod(x, w)] += amp * exp(-d);
      }
    }
  }

  /** Stamp tiny ASCII pixel art: rows of chars, map char -> palette index ('.' / ' ' skipped). */
  function stamp(b, x, y, rows, map, flip) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], n = row.length;
      for (var k = 0; k < n; k++) {
        var c = map[row.charAt(flip ? n - 1 - k : k)];
        if (c) b.pset(mod(x + k, b.w), y + r, c);
      }
    }
  }

  /** Line `t` pixels thick (thickened across its minor axis). */
  function thick(b, x0, y0, x1, y1, t, c) {
    var steep = abs(y1 - y0) > abs(x1 - x0), o = -((t - 1) >> 1);
    for (var k = 0; k < t; k++) {
      if (steep) b.line(x0 + o + k, y0, x1 + o + k, y1, c);
      else b.line(x0, y0 + o + k, x1, y1 + o + k, c);
    }
  }

  /** Warren lattice girder: 2px chords + zig-zag web. `step` should divide the layer width for seamless wrap. */
  function warren(b, x0, y, w, h, step, c, cw) {
    b.rect(x0, y, w, 2, c); b.rect(x0, y + h - 2, w, 2, c);
    cw = cw || c;
    var half = step >> 1;
    for (var x = x0; x < x0 + w; x += step) {
      b.line(x, y + h - 2, x + half, y + 1, cw); b.line(x + 1, y + h - 2, x + half + 1, y + 1, cw);
      b.line(x + half, y + 1, x + step, y + h - 2, cw); b.line(x + half + 1, y + 1, x + step + 1, y + h - 2, cw);
      b.rect(x, y, 1, h, cw);
    }
  }

  /** Vertical laced column (two chords + zig-zag lacing). */
  function laced(b, x, y0, y1, w, c, cw, step) {
    var t = w >= 12 ? 3 : 2;
    cw = cw || c; step = step || w;
    b.rect(x, y0, t, y1 - y0, c); b.rect(x + w - t, y0, t, y1 - y0, c);
    for (var y = y0, k = 0; y < y1; y += step, k++) {
      if (k & 1) b.line(x + t, y, x + w - t - 1, y + step, cw); else b.line(x + w - t - 1, y, x + t, y + step, cw);
      b.rect(x + t, y, w - 2 * t, 1, cw);
    }
  }

  /** Horizontal pipe, `t` thick, shaded as a cylinder around base level lv (integer); flanges every `fl` px. */
  function pipeH(b, x, y, w, t, ramp, lv, fl) {
    for (var j = 0; j < t; j++) {
      var q = (j + 0.5) / t, l = lv;
      if (t >= 5) { if (q > 0.12 && q < 0.42) l = lv + 1; else if (q > 0.72) l = lv - 1; }
      b.rect(x, y + j, w, 1, ramp[clamp(l, 0, 7)]);
    }
    if (fl) for (var fx = x + (fl >> 1); fx < x + w; fx += fl) {
      b.rect(fx, y - 1, 3, t + 2, ramp[clamp(lv + 1, 0, 7)]); b.rect(fx + 2, y - 1, 1, t + 2, ramp[clamp(lv - 1, 0, 7)]);
    }
  }
  /** Vertical pipe. */
  function pipeV(b, x, y, h, t, ramp, lv, fl) {
    for (var j = 0; j < t; j++) {
      var q = (j + 0.5) / t, l = lv;
      if (t >= 5) { if (q > 0.12 && q < 0.42) l = lv + 1; else if (q > 0.72) l = lv - 1; }
      b.rect(x + j, y, 1, h, ramp[clamp(l, 0, 7)]);
    }
    if (fl) for (var fy = y + (fl >> 1); fy < y + h; fy += fl) {
      b.rect(x - 1, fy, t + 2, 3, ramp[clamp(lv + 1, 0, 7)]); b.rect(x - 1, fy + 2, t + 2, 1, ramp[clamp(lv - 1, 0, 7)]);
    }
  }

  /** Hanging chain of oval links, 3px wide, from y0 down to y1. */
  function chain(b, x, y0, y1, c, c2) {
    for (var y = y0, k = 0; y < y1; y += 3, k++) {
      if (k & 1) { b.rect(x, y, 1, 4, c2); }
      else { b.rect(x - 1, y, 3, 1, c); b.rect(x - 1, y + 3, 3, 1, c); b.rect(x - 1, y, 1, 4, c); b.rect(x + 1, y, 1, 4, c); }
    }
  }

  /** Cog wheel in silhouette (teeth, rim, spokes with see-through gaps, hub). Wraps in x. */
  function gear(b, cx, cy, Rr, n, th, ramp, lv, ph, nsp, grd) {
    var Ro = Rr + th, w = b.w;
    var hub = mmax(3.5, Rr * 0.26), rimW = mmax(3, Rr * 0.2), spW = mmax(1.6, Rr * 0.085);
    for (var y = floor(cy - Ro - 1); y <= ceil(cy + Ro + 1); y++) {
      if (y < 0 || y >= b.h) continue;
      for (var x = floor(cx - Ro - 1); x <= ceil(cx + Ro + 1); x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = sqrt(dx * dx + dy * dy);
        if (r > Ro) continue;
        var a = atan2(dy, dx), l = -99;
        if (r > Rr) {
          var t = a * n / TAU + ph; t -= floor(t);
          var k = (r - Rr) / th;
          if (abs(t - 0.5) < 0.27 - 0.09 * k) l = 0;
        } else if (r > Rr - rimW) {
          l = (r < Rr - rimW + 1.2) ? -1 : 0;
        } else if (r < hub) {
          l = r < hub * 0.38 ? -1 : (r > hub - 1.1 ? 0 : 1);
        } else if (nsp) {
          var s = a * nsp / TAU + ph * 0.37; s -= floor(s);
          var da = (s - 0.5) * TAU / nsp;                      // angle from the nearest spoke axis
          if (abs(r * sin(da)) < spW * (1.25 - 0.45 * (r - hub) / (Rr - rimW - hub + 0.01))) l = 0;
        } else {
          l = -1;                                             // solid web
          var hr = (hub + Rr - rimW) * 0.5, s2 = a * 5 / TAU + ph; s2 -= floor(s2);
          var da2 = (s2 - 0.5) * TAU / 5, hx = r * cos(da2) - hr, hy = r * sin(da2);
          if (hx * hx + hy * hy < (Rr - rimW - hub) * (Rr - rimW - hub) * 0.11) l = -99;   // lightening holes
        }
        if (l > -50) b.data[y * w + mod(x, w)] = sh(ramp, lv + l - (grd || 0) * (dx + dy) / (Ro * 1.414), x, y);   // grd: lit from the upper left
      }
    }
  }

  /**
   * Finishing pass for silhouette art drawn with FLAT ramp colours (the drawn shade acts as a base level).
   * Every ramp-coloured pixel is re-shaded as ramp[level'], ordered-dithered, where
   *   level' = base + bias + rim (near an edge facing the light) - cut (near an edge facing away) + noise + grad(x, y).
   * `bevel` / `bevelCut` = how many pixels the rim / shadow fall off over (a soft chiselled volume for free).
   * Non-ramp pixels (black, outline, hot colours, liq / glow) are left untouched.
   *   o = { lx, ly, rim, cut, bevel, bevelCut, bias, noise, patch, nscale, seed, min, max, grad, map:{rampNo: [indices]}, wrap }
   */
  function relight(bmp, o) {
    var w = bmp.w, h = bmp.h, d = bmp.data, src = new Uint8Array(d);
    var lx = o.lx === undefined ? -1 : o.lx, ly = o.ly === undefined ? -1 : o.ly;
    var rim = o.rim === undefined ? 1 : o.rim, cut = o.cut || 0, bias = o.bias || 0;
    var bev = o.bevel || 1, bevC = o.bevelCut || bev;
    var nAmp = o.noise || 0, nS = o.nscale || 16, seed = o.seed || 1, px = mmax(1, round(w / nS));
    var lo = o.min || 0, hi = o.max === undefined ? 3 : o.max;
    var grad = o.grad || null, map = o.map || null, wrap = o.wrap !== false, patch = o.patch || 0;
    var x, y, xa, ya, i, v;
    // distance (in light-steps) to the lit edge / to the shadowed edge
    var dl = new Uint8Array(w * h), ds = new Uint8Array(w * h);
    for (var pass = 0; pass < 2; pass++) {
      var dist = pass ? ds : dl, sx = pass ? -lx : lx, sy = pass ? -ly : ly, cap = pass ? bevC : bev;
      var yA = sy < 0 ? 0 : h - 1, yB = sy < 0 ? h : -1, yS = sy < 0 ? 1 : -1;
      var xA = sx < 0 ? 0 : w - 1, xB = sx < 0 ? w : -1, xS = sx < 0 ? 1 : -1;
      for (y = yA; y !== yB; y += yS) {
        for (x = xA; x !== xB; x += xS) {
          if (!src[y * w + x]) continue;
          xa = x + sx; ya = y + sy;
          if (wrap) xa = mod(xa, w);
          if (ya < 0 || ya >= h || xa < 0 || xa >= w) v = cap + 1;         // bitmap border is not an edge
          else v = src[ya * w + xa] ? dist[ya * w + xa] + 1 : 1;
          dist[y * w + x] = v > 250 ? 250 : v;
        }
      }
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = src[y * w + x];
        if (i < 24 || i >= 240) continue;
        var r = (i - 24) >> 3, lv = ((i - 24) & 7) + bias, k = y * w + x;
        if (dl[k] <= bev) lv += rim * (1 - (dl[k] - 1) / bev);
        else if (cut && ds[k] <= bevC) lv -= cut * (1 - (ds[k] - 1) / bevC);
        if (nAmp) {
          var nz = pfbm(x / nS, y / nS, seed, 3, px);
          lv += patch ? nAmp * sstep(patch - 0.035, patch + 0.035, nz) : (nz - 0.5) * 2 * nAmp;   // patch: solid stains, not mesh
        }
        if (grad) lv += grad(x, y);
        var li = floor(lv + bayer(x, y));
        if (li < lo) li = lo; else if (li > hi) li = hi;
        if (map && map[r]) { var arr = map[r]; d[k] = arr[li >= arr.length ? arr.length - 1 : li]; }
        else d[k] = 24 + r * 8 + li;
      }
    }
    return bmp;
  }
  /** ramp number (as used by relight's `map`) of a ramp array. */
  function rampNo(ramp) { return (ramp[0] - 24) >> 3; }

  /** Parallax layer y so that the art sits at `base` when the camera rests on the level floor. */
  function layerY(info, base, fy) {
    var lh = (info && info.levelH) || 200;
    return round(base + mmax(0, lh - GNG.H) * fy);
  }
  /** Far-layer scroll factor: pan the whole panorama once over the level without wrapping (clamped). */
  function farFx(info, w, lo, hi) {
    var lw = (info && info.levelW) || 3200;
    return round(clamp((w - GNG.W - 8) / mmax(1, lw - GNG.W), lo, hi) * 1000) / 1000;
  }

  /* ====================================================================== *
   *  STAGE 4 — THE LEMMINGS CRUSHER FOUNDRY
   *  A furnace hall the size of a city: smoke ceiling, blast furnaces, flare
   *  stacks, a Moloch furnace that eats queueing lemmings, rivers of metal.
   * ====================================================================== */

  /** Teardrop flame of GLOW colours; the bands climb as the palette cycles. */
  function flame(b, cx, baseY, w, h, ph) {
    for (var y = baseY - h; y <= baseY; y++) {
      var t = (y - (baseY - h)) / h, hw = (w / 2) * pow(t, 0.75) * (1.2 - 0.25 * t);
      var wob = sin((y + ph) * 0.9) * 0.8 * (1 - t);
      for (var x = round(cx - hw + wob); x <= round(cx + hw + wob); x++) {
        var k = floor((baseY - y) * 0.8 + abs(x - cx) * 0.9 + ph);
        b.pset(mod(x, b.w), y, GLOW[mod(k, 8)]);
      }
    }
  }

  var HOOK_ART = [
    '...###....',
    '...###....',
    '..#####...',
    '..#####...',
    '...###....',
    '....###...',
    '.....###..',
    '#.....###.',
    '##....###.',
    '##....###.',
    '###..###..',
    '.######...',
    '..####....'
  ];
  var BIGHOOK_ART = [
    '.....####.......',
    '....######......',
    '...########.....',
    '...###..###.....',
    '...###..###.....',
    '...########.....',
    '....######......',
    '.....####.......',
    '.....####.......',
    '......####......',
    '.......####.....',
    '........####....',
    '.........####...',
    '##.......####...',
    '###......####...',
    '###......####...',
    '####....####....',
    '.####..#####....',
    '.##########.....',
    '..########......',
    '....####........'
  ];

  GNG.Backdrops.register(3, function (info) {
    var sky = [[10, 6, 9], [20, 9, 10], [33, 12, 10], [50, 17, 10], [72, 25, 10], [98, 36, 10], [130, 52, 13], [166, 74, 22]];
    var rng = GNG.makeRng(0x4F0D);
    var x, y, i, k;

    /* ------------------------------------------------------------ FAR */
    var FW = 640, FH = 200, HOR = 122, FLR = 132;
    var V = new Float32Array(FW * FH), Lg = new Float32Array(FW * FH), D = new Float32Array(FW * FH);
    var pl = new Bitmap(FW, FH);
    // silhouette "materials": sky-ramp level = light * k + c  (so haze and fire-glow carry through the shapes)
    //            k     c    rim depth
    var MAT = [null,
      [0.80, -0.2, 3, 2],     // 1 A   far skyline
      [0.92, 0.25, 3, 2],     // 2 AH  lit trim
      [0.68, -0.35, 2, 2],    // 3 AL  dark trim
      [0.46, -0.2, 7, 3],     // 4 B   big furnaces
      [0.62, 0.45, 7, 3],     // 5 BH
      [0.30, -0.45, 5, 3],    // 6 BL
      [0.26, -0.3, 6, 3],     // 7 FL  shop floor
      [0.92, -0.05, 2, 1]];   // 8 Z   farthest haze
    var A = 1, AH = 2, AL = 3, B = 4, BH = 5, BL = 6, FL = 7, Z = 8;
    function fire(cx, cy, rx, ry, amp) { addGlow(Lg, FW, FH, cx, cy, rx, ry, amp); }
    function plume(cx, cy, rise, drift, amp) {
      for (var s = 0.04; s < 1; s += 0.08) {
        var r = 4 + 17 * s;
        addGlow(V, FW, FH, cx + drift * s * s + sin(s * 9 + cx) * 3, cy - rise * s, r * 1.4, r, amp * (1 - 0.65 * s));
      }
    }
    /** arched furnace mouth full of roiling fire; (cx, by) = bottom centre */
    function mouth(cx, by, hw, hh, ph) {
      for (var yy = by - hh; yy <= by; yy++) for (var xx = cx - hw; xx <= cx + hw; xx++) {
        var dx = (xx - cx) / hw, dy = (by - yy) / hh;
        var inside = dy < 0.5 ? abs(dx) <= 1 : (dx * dx + (dy - 0.5) * (dy - 0.5) * 4 <= 1);
        if (!inside) continue;
        var dist = sqrt((xx - cx) * (xx - cx) + (by - yy) * (by - yy) * 1.7);
        var kk = floor(dist * 0.62 + pnoise(xx / 3.1, yy / 3.1, 5, 0) * 3.4 + ph);
        pl.pset(xx, yy, GLOW[mod(kk, 8)]);
      }
    }
    function spark(sx, sy) { pl.pset(mod(sx, FW), sy, GLOW[(sx * 3 + sy * 5) & 7]); }

    // --- light field: furnace-glow rising to the horizon; smoke banks whose bellies catch the light
    for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) D[y * FW + x] = pfbm(x / 80, y / 40, 11, 4, 8);
    for (y = 0; y < FH; y++) {
      var base = 0.07 + 0.76 * sstep(-24, 118, y), smk = 1 - 0.72 * sstep(60, 126, y);
      var yu = mmax(0, y - 5) * FW, yd = mmin(FH - 1, y + 5) * FW;
      for (x = 0; x < FW; x++) {
        var d0 = D[y * FW + x], n2 = pfbm(x / 160, y / 9, 23, 2, 4);
        V[y * FW + x] = base + ((D[yu + x] - D[yd + x]) * 1.7 + (d0 - 0.5) * 0.30) * smk + (n2 - 0.5) * 0.10;
      }
    }

    // --- plane Z: the farthest stacks, nearly swallowed by the haze ------------------
    for (i = 0; i < 26; i++) {
      var zx = floor(rng() * FW), zh = 14 + floor(rng() * 44), zw = 2 + floor(rng() * 3);
      pl.rect(zx, 118 - zh, zw, zh + 6, Z);
      if (rng() < 0.5) pl.rect(zx - 6 - floor(rng() * 14), 118 - 6 - floor(rng() * 10), 14 + floor(rng() * 16), 20, Z);
    }
    pl.rect(0, 116, FW, 8, Z);

    // --- plane A: hazy skyline ---------------------------------------------------------
    warren(pl, 0, 15, FW, 11, 40, AL, AL);                                   // roof trusses lost in the smoke
    for (x = 20; x < FW; x += 80) pl.rect(x, 0, 2, 15, AL);
    x = 0;
    while (x < FW) {                                                         // sheds with saw-tooth roofs, blocks, tanks
      var bw = 22 + ((rng() * 38) | 0); if (x + bw > FW - 14) bw = FW - x;
      var bh = 7 + ((rng() * 17) | 0), kind = rng();
      pl.rect(x, HOR - bh, bw, bh + 12, A);
      if (kind < 0.4) { for (var sx = x; sx + 10 <= x + bw; sx += 10) pl.poly([[sx, HOR - bh], [sx + 10, HOR - bh], [sx, HOR - bh - 6]], A); }
      else if (kind < 0.7) { pl.rect(x + 4, HOR - bh - 5, 3, 5, A); pl.rect(x + bw - 9, HOR - bh - 3, 5, 3, A); pl.rect(x, HOR - bh, bw, 1, AH); }
      else { pl.ellipse(x + bw / 2, HOR - bh, bw / 2 - 2, 5, A); }
      if (rng() < 0.6) pl.pset(x + 3 + floor(rng() * (bw - 6)), HOR - 2 - floor(rng() * (bh - 3)), GLOW[floor(rng() * 8)]);   // a lit window
      x += bw;
    }
    // chimneys  [x, top, baseW, topW, flare?]
    var stacks = [[30, 60, 8, 5, 0], [50, 38, 10, 6, 1], [228, 52, 8, 5, 0], [336, 32, 10, 6, 1], [354, 64, 7, 5, 0], [588, 46, 9, 6, 0], [612, 72, 7, 5, 0]];
    for (i = 0; i < stacks.length; i++) {
      var st = stacks[i];
      for (y = st[1]; y < HOR; y++) { var sw = lerp(st[3], st[2], (y - st[1]) / (HOR - st[1])); pl.rect(round(st[0] - sw / 2), y, round(sw), 1, A); }
      pl.rect(round(st[0] - st[3] / 2) - 1, st[1], st[3] + 2, 2, AH);
      pl.rect(round(st[0] - st[3] / 2), st[1] + 7, st[3], 1, AL);
      pl.rect(round(st[0] - st[3] / 2), st[1] + 16, st[3] + 1, 1, AL);
      if (st[4]) { flame(pl, st[0], st[1] - 1, 7, 11, i * 3); fire(st[0], st[1] - 6, 22, 18, 0.36); plume(st[0] + 4, st[1] - 14, 26, 40, 0.07); }
      else plume(st[0], st[1] - 4, 34, 46, 0.09);
    }
    // hot-blast stoves (domed cylinders in rows of three)
    var stoves = [[92, 70], [424, 76]];
    for (i = 0; i < stoves.length; i++) {
      var sx0 = stoves[i][0], sy0 = stoves[i][1];
      for (k = 0; k < 3; k++) {
        pl.rect(sx0 + k * 16, sy0, 12, HOR - sy0, A); pl.ellipse(sx0 + k * 16 + 5.5, sy0, 6, 5, A);
        pl.rect(sx0 + k * 16 + 5, sy0 - 10, 2, 6, A);
        pl.rect(sx0 + k * 16, sy0 + 12, 12, 1, AL); pl.rect(sx0 + k * 16, sy0 + 30, 12, 1, AL);
        pl.rect(sx0 + k * 16, sy0, 2, HOR - sy0, AH);
      }
      pl.rect(sx0, sy0 + 20, 46, 3, AL);
    }
    // gasometer
    pl.rect(262, 92, 40, 30, A); pl.ellipse(281.5, 92, 20, 6, A);
    for (k = 0; k <= 4; k++) pl.rect(262 + k * 10 - (k === 4 ? 1 : 0), 78, 1, 14, A);
    pl.rect(262, 78, 40, 1, A); pl.rect(262, 100, 40, 1, AL); pl.rect(262, 110, 40, 1, AL);
    // pipe bridges on trestles
    pl.rect(140, 98, 122, 2, A); for (x = 150; x < 262; x += 28) pl.rect(x, 100, 1, 22, A);
    pl.rect(470, 100, 120, 2, A); for (x = 484; x < 590; x += 28) pl.rect(x, 102, 1, 20, A);
    // a far-off blast furnace with its skip incline
    pl.poly([[533, 122], [531, 96], [538, 64], [552, 64], [559, 96], [557, 122]], A);
    pl.rect(540, 56, 10, 8, A); pl.line(541, 56, 536, 44, A); pl.line(549, 56, 554, 44, A); pl.line(536, 44, 545, 39, A); pl.line(545, 39, 554, 44, A);
    thick(pl, 554, 44, 574, 84, 3, A); pl.rect(570, 84, 9, 20, A); pl.poly([[570, 104], [579, 104], [575, 112], [574, 112]], A);
    thick(pl, 498, 122, 540, 58, 2, A); pl.rect(510, 104, 1, 18, A); pl.rect(522, 86, 1, 36, A);
    pl.rect(528, 96, 34, 1, AH); pl.rect(534, 80, 22, 1, AH);
    pl.pset(545, 108, GLOW[2]); pl.pset(546, 108, GLOW[3]); fire(545, 108, 9, 8, 0.2);

    // --- plane B: the big furnaces -----------------------------------------------------
    // (1) blast furnace
    thick(pl, 62, FLR, 150, 34, 2, B); thick(pl, 68, FLR, 156, 34, 2, B);            // skip incline rails
    for (k = 0; k < 15; k++) pl.line(62 + k * 6, FLR - k * 6.7, 68 + k * 6, FLR - k * 6.7, B);
    pl.rect(84, 108, 2, 24, B); pl.rect(106, 84, 2, 48, B); pl.line(86, 108, 106, 132, B);
    pl.poly([[132, FLR], [132, 112], [128, 104], [128, 96], [144, 40], [176, 40], [192, 96], [192, 104], [188, 112], [188, FLR]], B);
    pl.rect(148, 30, 24, 10, B); pl.rect(154, 22, 12, 8, B);
    thick(pl, 150, 30, 140, 14, 3, B); thick(pl, 170, 30, 180, 14, 3, B); pl.line(140, 14, 160, 6, B); pl.line(160, 6, 180, 14, B);
    pl.rect(138, 10, 5, 4, BH); pl.rect(178, 10, 5, 4, BH);
    thick(pl, 181, 14, 222, 76, 5, B);                                                // downcomer
    pl.rect(214, 76, 18, 34, B); pl.ellipse(222.5, 76, 9, 4, B); pl.poly([[214, 110], [232, 110], [225, 122], [221, 122]], B);
    pl.rect(215, 110, 2, 22, B); pl.rect(229, 110, 2, 22, B);
    for (k = 0; k < 4; k++) {                                                         // platforms round the stack
      var py = 104 - k * 18, hw = 36 - k * 5.4;
      pl.rect(round(160 - hw), py, round(hw * 2), 2, BL);
      pl.rect(round(160 - hw), py - 4, 1, 4, B); pl.rect(round(160 + hw) - 1, py - 4, 1, 4, B);
      pl.rect(round(160 - hw), py - 4, 4, 1, B); pl.rect(round(160 + hw) - 4, py - 4, 4, 1, B);
    }
    for (k = 0; k < 5; k++) pl.rect(150 + k * 5, 44 + k * 13, 1, 9, BL);              // seams down the stack
    pl.rect(125, 108, 70, 5, BH); pl.rect(125, 112, 70, 1, BL);                       // bustle pipe
    for (k = 0; k < 7; k++) pl.pset(136 + k * 8, 116, GLOW[(k * 3) & 7]);            // tuyere peep-holes
    fire(160, 116, 34, 8, 0.12);
    pl.poly([[96, FLR], [96, 119], [132, 111], [132, FLR]], B);                       // cast house roof
    pl.rect(96, 119, 1, 13, BH);
    mouth(197, 131, 5, 9, 2); pl.rect(190, 120, 15, 2, BH);                           // tap hole
    fire(197, 126, 16, 13, 0.36);
    // (2) ladle on a crane, pouring
    pl.rect(296, 0, 1, 70, B); pl.rect(304, 0, 1, 70, B); pl.rect(295, 68, 11, 6, B);
    pl.line(286, 92, 296, 74, B); pl.line(314, 92, 304, 74, B); pl.line(287, 92, 297, 74, B); pl.line(313, 92, 303, 74, B);
    pl.poly([[288, 83], [312, 83], [309, 106], [291, 106]], B); pl.rect(287, 81, 26, 3, BH);
    pl.rect(284, 90, 4, 5, BH); pl.rect(312, 90, 4, 5, BH); pl.rect(290, 95, 20, 1, BL);
    for (x = 289; x <= 310; x++) pl.pset(x, 80, LIQ[mod(x, 8)]);
    for (y = 82; y < 140; y++) { var wv = (y > 92 ? 1 : 0) + (y > 120 ? ((y >> 1) & 1) : 0); pl.pset(314 + wv, y, LIQ[mod(y, 8)]); pl.pset(315 + wv, y, LIQ[mod(y + 3, 8)]); }
    fire(300, 78, 16, 9, 0.22); fire(316, 112, 11, 30, 0.26);
    for (k = 0; k < 9; k++) spark(308 + ((k * 7) % 17), 128 - ((k * 11) % 23));
    // (3) the MOLOCH furnace
    var mx = 470;
    pl.rect(402, 106, 136, 26, B); pl.rect(414, 76, 112, 30, B); pl.rect(426, 54, 88, 22, B);
    pl.poly([[436, 54], [446, 42], [494, 42], [504, 54]], B); pl.rect(462, 34, 16, 8, B); pl.rect(466, 28, 8, 6, B);
    pl.poly([[402, 106], [414, 90], [414, 106]], B); pl.poly([[538, 106], [526, 90], [526, 106]], B);
    pl.poly([[414, 76], [426, 62], [426, 76]], B); pl.poly([[526, 76], [514, 62], [514, 76]], B);
    pl.poly([[417, 78], [428, 78], [421, 50], [414, 20], [406, 20], [411, 50]], B);      // horn stacks
    pl.poly([[523, 78], [512, 78], [519, 50], [526, 20], [534, 20], [529, 50]], B);
    pl.rect(405, 18, 10, 3, BH); pl.rect(525, 18, 10, 3, BH);
    flame(pl, 410, 17, 8, 12, 0); flame(pl, 530, 17, 8, 12, 4);
    fire(410, 10, 18, 16, 0.32); fire(530, 10, 18, 16, 0.32);
    plume(414, 2, 10, 30, 0.05); plume(534, 2, 10, 30, 0.05);
    pl.rect(402, 106, 136, 1, BL); pl.rect(414, 76, 112, 1, BL); pl.rect(426, 54, 88, 1, BH);
    for (k = 0; k < 9; k++) { pl.pset(408 + k * 15, 110, BH); pl.pset(408 + k * 15, 128, BL); }
    for (k = 0; k < 4; k++) { pl.rect(420 + k * 5, 80, 1, 24, BL); pl.rect(505 + k * 5, 80, 1, 24, BL); }   // ribbed cheeks
    for (i = -1; i <= 1; i += 2) {                                                       // eyes
      var ex = mx + i * 21, ey = 68;
      for (y = ey - 7; y <= ey + 7; y++) for (x = ex - 7; x <= ex + 7; x++) {
        var dd = sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
        if (dd <= 7.2) pl.pset(x, y, dd > 6.1 ? BH : GLOW[mod(floor(dd * 1.1 + (i > 0 ? 3 : 0)), 8)]);
      }
      pl.rect(ex - 1, ey - 4, 2, 9, BL);                                                  // slit pupil
      pl.poly([[ex - i * 9, ey - 9], [ex + i * 9, ey - 1], [ex + i * 9, ey - 9]], B);      // angry brow
      fire(ex, ey, 11, 10, 0.2);
    }
    pl.poly([[mx, 74], [mx - 7, 88], [mx + 7, 88]], BL); pl.pset(mx - 3, 86, GLOW[1]); pl.pset(mx + 3, 86, GLOW[5]);
    mouth(mx, 122, 32, 30, 0);                                                           // maw
    pl.rect(mx - 32, 90, 65, 8, B);
    for (k = 0; k < 8; k++) { var tx = mx - 32 + k * 8, tl = (k === 1 || k === 6) ? 11 : 6; pl.poly([[tx, 97], [tx + 8, 97], [tx + 4, 97 + tl]], B); }
    for (k = 0; k < 7; k++) { tx = mx - 28 + k * 8; pl.poly([[tx, 123], [tx + 8, 123], [tx + 4, 116]], B); }
    pl.rect(mx - 36, 122, 73, 3, BH);
    pl.poly([[mx - 24, 125], [mx + 24, 125], [mx + 36, FLR], [mx - 36, FLR]], BL);
    pl.rect(mx - 27, 127, 55, 1, BH); pl.rect(mx - 31, 129, 63, 1, BH); pl.rect(mx - 35, 131, 71, 1, BH);
    fire(mx, 110, 46, 34, 0.55);
    for (k = 0; k < 14; k++) spark(mx - 30 + ((k * 13) % 61), 88 - ((k * 7) % 30));
    pl.rect(380, 112, 22, 4, B); pl.rect(380, 112, 22, 1, BH); pl.rect(380, 112, 4, 20, B);
    pl.rect(538, 112, 24, 4, B); pl.rect(538, 112, 24, 1, BH); pl.rect(558, 112, 4, 20, B);
    // the queue: a catwalk straight into the maw, and the poor souls on it
    pl.rect(322, 110, 116, 2, B); pl.rect(322, 104, 1, 6, B);
    for (x = 332; x < 436; x += 26) { pl.rect(x, 112, 1, 20, B); pl.line(x, 112, x + 8, 120, B); pl.line(x, 112, x - 8, 120, B); }
    var lemMap = { G: R.green[3], S: R.skin[4], B: R.blue[2], b: R.blue[1], U: R.bone[3], u: R.bone[2], '|': R.bone[1] };
    var LEM_A = ['.GG.', 'GGS.', '.BB.', '.BBS', '.b.b'], LEM_B = ['.GG.', 'GGS.', '.BB.', 'SBB.', '..b.'];
    var lemX = [338, 345, 355, 362, 372, 381, 388, 399, 407, 416, 424, 431];
    for (i = 0; i < lemX.length; i++) stamp(pl, lemX[i], 105, (i & 1) ? LEM_A : LEM_B, lemMap);
    stamp(pl, 325, 105, ['.GG..', '.GS..', 'SBBBS', '.BB..', '.b.b.'], lemMap);        // a blocker holding up the line
    stamp(pl, 366, 74, ['..UUU..', '.UUUUU.', 'UuUuUuU', '...|...', '...|...', '..GG...', '.GGS...', '..BB...', '..b.b..'], lemMap);   // floater

    // --- floor: dark shop floor, a river of molten metal with slag crust, an ingot train ---
    pl.rect(0, FLR, FW, FH - FLR, FL);
    for (x = 0; x < FW; x++) {
      var nA = pfbm(x / 40, 0.3, 61, 3, 16), nB = pfbm(x / 32, 7.7, 67, 3, 20);
      var top = 140 + round(nA * 7 - 2), wd = 1 + round(nB * 3.6);
      for (k = 0; k < wd; k++) {
        var yy = top + k, crust = pfbm(x / 5, yy / 2.5, 71, 2, 128);
        if (crust > 0.55) pl.pset(x, yy, R.ember[crust > 0.66 ? 0 : 1]);
        else pl.pset(x, yy, LIQ[mod(floor(x * 0.42 + k * 1.4 + sin(x * 0.17) * 2), 8)]);
      }
      pl.pset(x, top - 1, BH); pl.pset(x, top + wd, BL);
      if ((x & 7) === 0) fire(x, top + wd * 0.5, 13, 6 + wd, 0.05 * wd);
    }
    var bridges = [88, 356, 600];
    for (i = 0; i < bridges.length; i++) { pl.rect(bridges[i], 134, 18, 18, B); pl.rect(bridges[i], 134, 18, 1, BH); pl.rect(bridges[i] - 2, 132, 22, 2, B); }
    for (x = 12; x < FW; x += 64) { pl.rect(x, 166, 40, 1, BL); pl.rect(x + 20, 180, 44, 1, BL); }
    for (k = 0; k < 6; k++) {                                                          // ingot train
      var cxk = 132 + k * 17;
      pl.rect(cxk, 158, 14, 5, B); pl.rect(cxk + 1, 163, 3, 2, BL); pl.rect(cxk + 10, 163, 3, 2, BL); pl.rect(cxk - 3, 161, 3, 1, B);
      for (x = cxk + 2; x < cxk + 12; x++) pl.pset(x, 157, LIQ[mod(x + k * 3, 8)]);
      fire(cxk + 7, 156, 9, 4, 0.1);
    }
    pl.rect(100, 165, 150, 1, BH);
    thick(pl, 202, 131, 246, 139, 2, BL);                                              // launder from the tap hole to the river
    for (x = 202; x <= 246; x++) pl.pset(x, 130 + round((x - 202) * 8 / 44), LIQ[mod(x, 8)]);

    // --- compose: light -> sky ramp, silhouettes as darkened light + fire-rim ------
    var far = new Bitmap(FW, FH), fd = far.data, pd = pl.data;
    var nb = [-1, 0, 1, 0, 0, -1, 0, 1];
    for (y = 0; y < FH; y++) {
      for (x = 0; x < FW; x++) {
        i = y * FW + x;
        var m = pd[i], v = V[i] + Lg[i];
        if (m === 0) { fd[i] = sh(SKY, v * 7, x, y); continue; }
        if (m >= 16) { fd[i] = m; continue; }
        var mt = MAT[m], lv = v * 7 * mt[0] + mt[1], rim = 0, dep = mt[3];
        for (k = 0; k < 8; k += 2) {
          var nx = mod(x + nb[k], FW), ny = y + nb[k + 1];
          if (ny < 0 || ny >= FH) continue;
          var j = ny * FW + nx, mn = pd[j];
          if ((mn === 0 || (mn < 16 && MAT[mn][3] < dep)) && Lg[j] > Lg[i] && Lg[j] > rim) rim = Lg[j];
        }
        lv += rim * mt[2];
        fd[i] = sh(SKY, lv, x, y);
      }
    }

    /* ------------------------------------------------------------ MID */
    // bold, solid machine silhouettes: flat darks, a few drawn highlights, ember rim-light from relight()
    var MW = 1024, MH = 200, M = new Bitmap(MW, MH);
    var RU = R.rust, D0 = RU[1], D1 = RU[2], DK = RU[0];
    function mgear(gx, gy, gr, gn, ph, nsp) { gear(M, gx, gy, gr, gn, 5, RU, 1, ph, nsp, 0); }
    function rivets(x0, y0, n, dx, dy) { for (var q = 0; q < n; q++) M.pset(x0 + q * dx, y0 + q * dy, D1); }

    // low machine horizon
    x = 0;
    while (x < MW) { var mw = 18 + ((rng() * 40) | 0), mh = 8 + ((rng() * 20) | 0); if (x + mw > MW - 10) mw = MW - x; M.rect(x, MH - mh, mw, mh, D0); x += mw; }

    // Layout note: the far layer's Moloch furnace slides behind mid x ~710..1130 during the second half of the
    // level, so that stretch only carries the open gantry crane; the heavy machines live in x 130..700.

    // riser + header pipe feeding a pressure tank
    pipeV(M, 136, 0, MH, 16, RU, 1, 52);
    pipeH(M, 152, 28, 250, 10, RU, 1, 62);
    pipeV(M, 392, 28, 38, 10, RU, 1, 0); M.rect(390, 26, 14, 4, D1);
    M.rect(370, 74, 56, 126, D0); M.ellipse(397.5, 74, 28, 12, D0);
    M.rect(370, 106, 56, 2, D1); M.rect(370, 152, 56, 2, D1); rivets(373, 111, 14, 4, 0); rivets(373, 157, 14, 4, 0);
    M.rect(430, 82, 2, 118, D0); M.rect(438, 82, 2, 118, D0); for (y = 86; y < 200; y += 7) M.rect(430, y, 10, 1, D0);   // ladder
    M.rect(402, 48, 14, 3, D0); M.circ(422, 49, 7, D0); M.circ(422, 49, 6, D0); M.rect(415, 48, 15, 2, D0); M.rect(421, 42, 2, 15, D0);   // valve wheel

    // GIANT gear rising out of the floor + its train
    M.rect(318, 92, 8, 108, D0); M.rect(171, 98, 7, 102, D0);
    thick(M, 322, 150, 282, 200, 5, D0); thick(M, 174, 150, 200, 200, 5, D0);
    mgear(242, 150, 64, 28, 0.0, 8);
    mgear(322, 92, 30, 13, 0.55, 6);
    mgear(175, 98, 16, 7, 0.3, 0);

    // hopper on stilts + inclined conveyor gallery
    thick(M, 580, 178, 528, 44, 7, D0);
    M.rect(568, 150, 3, 50, D0); M.rect(550, 104, 3, 96, D0);
    M.rect(476, 96, 4, 104, D0); M.rect(520, 96, 4, 104, D0); thick(M, 478, 130, 522, 160, 2, D0); thick(M, 522, 130, 478, 160, 2, D0);
    M.rect(472, 44, 56, 52, D0); M.poly([[472, 44], [527, 44], [514, 32], [485, 32]], D0);
    M.poly([[472, 96], [527, 96], [506, 122], [493, 122]], D0); M.rect(495, 122, 10, 12, D0);
    M.rect(472, 62, 56, 1, D1); M.rect(472, 80, 56, 1, D1); rivets(475, 65, 14, 4, 0); rivets(475, 83, 14, 4, 0);

    // the crusher press, its anvil and its drive gear
    M.rect(624, 22, 12, 178, D0); M.rect(684, 22, 12, 178, D0);
    M.rect(616, 16, 88, 16, D0); rivets(620, 20, 11, 8, 0);
    pipeV(M, 652, 32, 50, 16, RU, 1, 0);
    M.poly([[640, 82], [680, 82], [684, 98], [636, 98]], D0);
    for (k = 0; k < 8; k++) M.poly([[636 + k * 6, 98], [642 + k * 6, 98], [639 + k * 6, 104]], D0);
    M.rect(636, 152, 48, 48, D0); M.rect(632, 148, 56, 5, D0);
    M.rect(593, 118, 7, 82, D0);
    mgear(596, 118, 24, 11, 0.6, 5);
    thick(M, 604, 104, 622, 30, 3, D0);                                                // connecting rod

    // gantry crane spanning the seam: box girder on I-beam legs, trolley, big hook, a short catwalk
    M.rect(708, 6, 316, 12, D0); M.rect(0, 6, 116, 12, D0); rivets(712, 10, 39, 8, 0); rivets(0, 10, 14, 8, 0);
    M.rect(716, 18, 10, 182, D0); M.rect(98, 18, 10, 182, D0);
    M.poly([[726, 18], [744, 18], [726, 38]], D0); M.poly([[98, 18], [80, 18], [98, 38]], D0);
    M.rect(912, 0, 30, 7, D0);
    M.rect(923, 18, 1, 40, DK); M.rect(930, 18, 1, 40, DK);
    M.rect(920, 56, 14, 5, D0);
    stamp(M, 919, 61, BIGHOOK_ART, { '#': D0 });
    M.rect(726, 96, 92, 3, D0); M.rect(726, 86, 92, 2, D0);                             // catwalk + rail
    for (x = 734; x < 818; x += 16) M.rect(x, 86, 2, 10, D0);
    M.line(726, 99, 746, 112, D0); M.line(727, 99, 747, 112, D0); M.rect(816, 86, 2, 13, D0);
    for (k = 0; k < 9; k++) { M.rect(818 + k * 5, 96 + k * 5, 6, 2, D0); }             // stairs down
    thick(M, 818, 86, 862, 130, 2, D0); M.rect(860, 130, 3, 70, D0);

    relight(M, { rim: 1.5, bevel: 3, cut: 1, bevelCut: 3, min: 0, max: 3 });
    // lamps & peep-lights (after shading so they stay pure)
    M.rect(800, 18, 3, 4, D0); M.pset(801, 22, GLOW[2]); M.rect(1000, 18, 3, 4, D0); M.pset(1001, 22, GLOW[6]);
    M.pset(499, 38, GLOW[4]); M.pset(397, 66, GLOW[1]); M.pset(660, 22, GLOW[3]); M.pset(144, 60, GLOW[5]);

    /* ------------------------------------------------------------ NEAR */
    var NW = 1024, NH = 200, N = new Bitmap(NW, NH), G = R.gray;
    // overhead crane girder + pipe run
    N.rect(0, 0, NW, 11, G[0]); N.rect(0, 9, NW, 2, G[1]);
    for (x = 16; x < NW; x += 32) N.rect(x, 0, 2, 9, G[1]);
    pipeH(N, 0, 14, NW, 6, G, 0, 64);
    // heavy riveted I-beam columns with lightening holes
    var cols = [118, 468, 826];
    for (i = 0; i < cols.length; i++) {
      var c0 = cols[i] - 11;
      N.rect(c0, 11, 22, NH - 11, G[0]); N.rect(c0, 11, 3, NH - 11, G[1]);
      for (y = 34; y < NH; y += 26) N.ellipse(cols[i] + 0.5, y, 5, 7, 0);
      N.poly([[c0, 11], [c0 - 18, 11], [c0, 34]], G[0]); N.poly([[c0 + 22, 11], [c0 + 40, 11], [c0 + 22, 34]], G[0]);
      N.rect(c0 - 3, 44, 28, 4, G[0]); N.rect(c0 - 3, 122, 28, 4, G[0]);
    }
    // chains [x, length, what]   what: 0 weight, 1 hook, 2 ladle, 3 ladle full of metal
    var ch = [[40, 58, 0], [214, 74, 2], [300, 40, 1], [386, 88, 0], [566, 52, 1], [742, 86, 3], [904, 30, 0], [968, 66, 1]];
    for (i = 0; i < ch.length; i++) {
      var cx = ch[i][0], cl = ch[i][1], cw = ch[i][2], by = 20 + cl;
      for (y = 20, k = 0; y < by; y += 5, k++) {
        if (k & 1) N.rect(cx, y - 1, 2, 7, G[0]);
        else { N.rect(cx - 2, y, 6, 1, G[0]); N.rect(cx - 2, y + 5, 6, 1, G[0]); N.rect(cx - 2, y, 1, 6, G[0]); N.rect(cx + 3, y, 1, 6, G[0]); }
      }
      if (cw === 1) stamp(N, cx - 7, by, BIGHOOK_ART, { '#': G[0] });
      else if (cw >= 2) {
        thick(N, cx, by, cx - 15, by + 14, 2, G[0]); thick(N, cx + 1, by, cx + 16, by + 14, 2, G[0]);
        N.poly([[cx - 17, by + 13], [cx + 18, by + 13], [cx + 13, by + 40], [cx - 12, by + 40]], G[0]);
        N.rect(cx - 18, by + 12, 38, 4, G[1]); N.rect(cx - 15, by + 27, 32, 2, G[1]);
        N.rect(cx - 21, by + 22, 4, 6, G[1]); N.rect(cx + 19, by + 22, 4, 6, G[1]);
        if (cw === 3) {
          for (k = -15; k <= 16; k++) N.pset(cx + k, by + 11, LIQ[mod(k + 32, 8)]);
          for (k = -12; k <= 13; k += 2) N.pset(cx + k, by + 10, LIQ[mod(k + 35, 8)]);
        }
      } else { N.rect(cx - 3, by, 8, 9, G[0]); N.rect(cx - 4, by + 9, 10, 3, G[1]); }
    }
    relight(N, { rim: 1, bevel: 1, cut: 0, min: 0, max: 2, map: (function () { var mm = {}; mm[rampNo(G)] = [C.black, R.maroon[1], R.rust[2]]; return mm; })() });

    var ffx = farFx(info, FW, 0.04, 0.08);
    return {
      sky: sky,
      layers: [
        { bmp: far, fx: ffx, fy: 0, y: 0, wrap: true },
        { bmp: M, fx: 0.25, fy: 0.05, y: layerY(info, 0, 0.05), wrap: true, fill: D0 },
        { bmp: N, fx: 0.5, fy: 0.1, y: layerY(info, 0, 0.1), wrap: true, fill: C.black }
      ],
      lightning: false, cycleLiq: 6, cycleGlow: 5
    };
  });

  /* ====================================================================== *
   *  SHARED PROPS for the necropolis, the cathedral and the title scene
   * ====================================================================== */

  /** Tapered thick segment (tree limbs, stakes, struts). */
  function limb(b, x0, y0, x1, y1, w0, w1, c) {
    if (w0 > 1.3 || w1 > 1.3) {
      var dx = x1 - x0, dy = y1 - y0, l = sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l * 0.5, ny = dx / l * 0.5;
      b.poly([[x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]], c);
    }
    b.line(x0, y0, x1, y1, c);
  }

  /** Crooked dead tree silhouette rooted at (x, y), about `h` px tall. Keep it clear of a wrap seam. */
  function deadTree(b, x, y, h, seed, c, lean, depth) {
    var r = GNG.makeRng(seed), tw = mmax(2.5, h * 0.085);
    b.poly([[x - tw * 1.5, y + 2], [x - tw * 0.55, y - h * 0.10], [x + tw * 0.55, y - h * 0.10], [x + tw * 1.6, y + 2]], c);
    b.line(x - tw * 1.5, y + 1, x - tw * 2.4, y + 3, c); b.line(x + tw * 1.5, y + 1, x + tw * 2.6, y + 3, c);
    function seg(x0, y0, ang, len, th, d) {
      var kink = (r() - 0.5) * 0.7;
      var xm = x0 + sin(ang) * len * 0.5, ym = y0 - cos(ang) * len * 0.5;
      var a2 = ang + kink;
      var x1 = xm + sin(a2) * len * 0.5, y1 = ym - cos(a2) * len * 0.5;
      limb(b, x0, y0, xm, ym, th, th * 0.85, c);
      limb(b, xm, ym, x1, y1, th * 0.85, th * 0.68, c);
      if (d <= 0 || len < 3) return;
      var n = (d > 2 && r() < 0.4) ? 3 : 2;
      for (var i = 0; i < n; i++) {
        var side = i === 0 ? -1 : (i === 1 ? 1 : (r() < 0.5 ? -0.3 : 0.3));
        var na = clamp(a2 * 0.55 + side * (0.38 + r() * 0.55), -1.9, 1.9);
        seg(x1, y1, na, len * (0.60 + r() * 0.24), mmax(1, th * (i === 2 ? 0.5 : 0.66)), d - 1);
      }
      if (d > 1 && r() < 0.6) {                                   // a broken snag off the side
        var sa = a2 + (r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.5);
        limb(b, xm, ym, xm + sin(sa) * len * 0.3, ym - cos(sa) * len * 0.3, mmax(1, th * 0.4), 1, c);
      }
    }
    seg(x, y - h * 0.08, (lean || 0) + (r() - 0.5) * 0.25, h * 0.36, tw, depth || 5);
  }

  /** Copy bitmap `t` so its bottom-centre lands on (x, by), leaning `shear` px sideways per px of height. Wraps in x. */
  function shearBlit(b, t, x, by, shear) {
    for (var r = 0; r < t.h; r++) {
      var off = round(shear * (t.h - 1 - r)), row = r * t.w, yy = by - t.h + 1 + r;
      if (yy < 0 || yy >= b.h) continue;
      for (var q = 0; q < t.w; q++) {
        var c = t.data[row + q];
        if (c) b.data[yy * b.w + mod(x - (t.w >> 1) + q + off, b.w)] = c;
      }
    }
  }

  /** '#'-mask rows -> Bitmap in colour c, enlarged `times` x2 with EPX / Scale2x so hand-drawn curves stay smooth. */
  function maskBmp(rows, c, times) {
    var h = rows.length, w = rows[0].length, b = new Bitmap(w, h), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (rows[y].charAt(x) === '#') b.data[y * w + x] = c;
    for (; times > 0; times--) {
      var o = new Bitmap(w * 2, h * 2), s = b.data, d = o.data;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var P = s[y * w + x], A = y > 0 ? s[(y - 1) * w + x] : 0, D = y < h - 1 ? s[(y + 1) * w + x] : 0;
        var Cc = x > 0 ? s[y * w + x - 1] : 0, B = x < w - 1 ? s[y * w + x + 1] : 0, i = (y * 2) * (w * 2) + x * 2;
        d[i] = (Cc === A && Cc !== D && A !== B) ? A : P;
        d[i + 1] = (A === B && A !== Cc && B !== D) ? B : P;
        d[i + w * 2] = (D === Cc && D !== B && Cc !== A) ? Cc : P;
        d[i + w * 2 + 1] = (B === D && B !== A && D !== Cc) ? D : P;
      }
      b = o; w *= 2; h *= 2;
    }
    return b;
  }

  /**
   * Grave marker, bottom-centre at (x, by), w x h px, leaning by `shear`.  c = stone, c2 = engraving.
   * kind: 0 round slab, 1 latin cross, 2 pointed gothic slab, 3 obelisk, 4 celtic cross, 5 broken slab, 6 trefoil cross, 7 shouldered slab
   */
  function grave(b, x, by, w, h, kind, shear, c, c2) {
    var t = new Bitmap(w + 2, h), cx = (w + 2) >> 1, hw = w >> 1, sw, ay, k;
    var x0 = cx - hw;
    c2 = c2 || c;
    if (kind === 1 || kind === 4 || kind === 6) {
      sw = mmax(2, round(w * 0.26)); ay = round(h * 0.24);
      t.rect(cx - (sw >> 1), 0, sw, h, c); t.rect(x0, ay, w, sw, c);
      t.rect(cx - sw, h - mmax(2, h >> 3), sw * 2, mmax(2, h >> 3), c);
      if (kind === 4) {
        var rr = mmax(3, w * 0.36), yc = ay + sw / 2 - 0.5, xc = cx - 0.5 + (sw & 1) * 0.5;
        for (k = 0; k < 40; k++) {
          var an = k / 40 * TAU, px = round(xc + cos(an) * rr), py = round(yc + sin(an) * rr);
          t.pset(px, py, c); if (w >= 14) t.pset(round(xc + cos(an) * (rr - 1)), round(yc + sin(an) * (rr - 1)), c);
        }
      }
      if (kind === 6) {
        t.rect(cx - (sw >> 1) - 1, 0, sw + 2, 2, c); t.rect(x0, ay - 1, 2, sw + 2, c); t.rect(x0 + w - 2, ay - 1, 2, sw + 2, c);
      }
    } else if (kind === 3) {
      var tw2 = mmax(2, w * 0.3);
      t.poly([[cx - hw * 0.62, h - 4], [cx - tw2 / 2, 5], [cx - 0.5, 0], [cx + tw2 / 2 - 1, 5], [cx + hw * 0.62 - 1, h - 4]], c);
      t.rect(x0, h - 4, w, 4, c); t.rect(x0 + 1, h - 6, w - 2, 2, c);
      t.rect(cx - 1, round(h * 0.3), 1, round(h * 0.3), c2);
    } else {
      var top = kind === 2 ? round(w * 0.55) : (kind === 7 ? round(w * 0.3) : hw);
      t.rect(x0, top, w, h - top, c);
      if (kind === 2) t.poly([[x0, top], [cx - 0.5, 0], [x0 + w - 1, top]], c);
      else if (kind === 7) { t.rect(x0 + 2, top - 2, w - 4, 2, c); t.ellipse(cx - 0.5, top - 1, hw - 3, top - 1, c); }
      else t.ellipse(cx - 0.5, top, hw, top, c);
      if (kind === 5) {                                             // snapped off diagonally
        var cut = round(h * 0.38);
        for (k = 0; k < w + 2; k++) { var jag = cut - round(k * 0.45) + ((k * 7) % 3); if (jag > 0) t.rect(x0 - 1 + k, 0, 1, jag, 0); }
      }
      if (w >= 9 && c2 !== c) {                                     // epitaph: a little cross and worn lines
        var ty = top + 1 + (kind === 5 ? round(h * 0.25) : 0);
        if (kind !== 5) { t.rect(cx - 1, ty, 1, 5, c2); t.rect(cx - 2, ty + 1, 3, 1, c2); ty += 7; }
        for (k = 0; ty + k * 3 < h - 4 && k < 4; k++) t.rect(x0 + 2 + (k & 1), ty + k * 3, w - 5 - ((k * 3) % 4), 1, c2);
      }
    }
    shearBlit(b, t, x, by, shear || 0);
  }

  /** Jagged ridge line, periodic over w: crest y for every column. s1 / s2 (px per lattice cell) must divide w. */
  function ridgeLine(w, base, amp, seed, s1, s2, jag) {
    var H = new Float32Array(w), p1 = round(w / s1), p2 = round(w / s2), p3 = w >> 2;
    for (var x = 0; x < w; x++) {
      var a = pfbm(x / s1, 0.37, seed, 2, p1);
      var r = 1 - abs(2 * pnoise(x / s2, 3.1, seed + 7, p2) - 1);
      H[x] = base - amp * (0.5 * a + 0.5 * r * r) - jag * pnoise(x / 4, 9.3, seed + 13, p3);
    }
    return H;
  }

  /**
   * Paint a craggy mountain range under crest line H down to row `bot`: facets that fall away to the left catch
   * the light, the spurs run down from every peak (sheared lookup of the crest slope).
   *   o = { lv, lit, shade, shear, fall, seed, haze(x, y, t) -> 0..1 probability of the pixel dissolving into what is behind }
   */
  function paintRange(bmp, H, bot, ramp, o) {
    var w = bmp.w, d = bmp.data, p = w >> 3, x, y;
    for (x = 0; x < w; x++) {
      for (y = mmax(0, ceil(H[x])); y < bot; y++) {
        var t = y - H[x];
        if (o.haze && dth(o.haze(x, y, t), x, y)) continue;
        var n = pnoise(x / 8, y / 8, o.seed, p);
        var xs = round(x - t * o.shear + (n - 0.5) * 7);
        var s = H[mod(xs + 2, w)] - H[mod(xs - 2, w)];
        var xs2 = round(x + t * o.shear * 0.7 - (n - 0.5) * 11 + 5);
        var s2 = H[mod(xs2 + 1, w)] - H[mod(xs2 - 1, w)];
        var l = o.lv + (s < 0 ? o.lit : -o.shade) * mmin(1, abs(s) / 2.4) * 0.75
          + (s2 < 0 ? o.lit : -o.shade) * mmin(1, abs(s2) / 1.4) * 0.4 - t * o.fall;
        if (t < 1.2 && s < 0) l += 0.7;
        d[y * w + x] = sh(ramp, l, x, y);
      }
    }
  }

  /** Radar dish seen side-on: parabolic bowl of radius rad aimed along angle `ang` (0 = right, -PI/2 = up), with feed horn. */
  function dish(b, cx, cy, rad, ang, c, c2) {
    var ca = cos(ang), sa = sin(ang), dep = rad * 0.42, x, y;
    for (y = floor(cy - rad - 2); y <= cy + rad + 2; y++) for (x = floor(cx - rad - 2); x <= cx + rad + 2; x++) {
      var dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (abs(v) > rad) continue;
      var f = dep * (v / rad) * (v / rad) - dep * 0.55;                // the bowl surface
      if (u >= f - 1.2 && u <= dep * 0.45 + 0.3) b.pset(mod(x, b.w), y, (u > f + 1.4 && c2) ? c2 : c);
    }
    var fx = cx + ca * rad * 0.95, fy = cy + sa * rad * 0.95;        // focus
    b.line(cx - sa * rad * 0.8 + ca * dep * 0.3, cy + ca * rad * 0.8 + sa * dep * 0.3, fx, fy, c);
    b.line(cx + sa * rad * 0.8 + ca * dep * 0.3, cy - ca * rad * 0.8 + sa * dep * 0.3, fx, fy, c);
    b.rect(round(fx) - 1, round(fy) - 1, 2, 2, c);
  }

  var IMPALED_A = [                    // slumped over the stake, arms hanging
    '......#......',
    '......#......',
    '......#......',
    '....###......',
    '...#####.....',
    '...#####.....',
    '....####.....',
    '..#########..',
    '.###########.',
    '.##.######.##',
    '.##.######.##',
    '##..######..#',
    '##..#####...#',
    '#...#####...#',
    '....#####....',
    '....######...',
    '...###.###...',
    '...##.#.##...',
    '...##.#.###..',
    '..###.#..##..',
    '..##..#..##..',
    '..##..#...#..',
    '..#...#......',
    '......#......'
  ];
  var IMPALED_B = [                    // arms flung up, head thrown back
    '......#......',
    '#.....#.....#',
    '##....#....##',
    '.##..###..##.',
    '.##.#####.##.',
    '..##.####.##.',
    '..#########..',
    '...#######...',
    '....######...',
    '....######...',
    '....######...',
    '....#####....',
    '....#####....',
    '...######....',
    '...###.###...',
    '...##.#.##...',
    '..###.#.##...',
    '..##..#.###..',
    '..##..#..##..',
    '..#...#..#...',
    '......#......',
    '......#......'
  ];
  var CROW_ART = [
    '..##....',
    '.###....',
    '#####...',
    '.#####..',
    '..#####.',
    '...#.###',
    '...#...#'
  ];

  /* ====================================================================== *
   *  STAGE 5 — PHOBOS E1M1 NECROPOLIS
   *  Blood-red dusk over the moon base: Mars-rise behind jagged ranges, drifting
   *  smoke, a UAC skyline that has grown a graveyard, nukage seeping out of the ridge.
   * ====================================================================== */

  GNG.Backdrops.register(4, function (info) {
    var sky = [[12, 3, 8], [26, 5, 11], [44, 8, 13], [66, 12, 14], [92, 19, 15], [122, 30, 16], [156, 46, 20], [194, 72, 30]];
    var rng = GNG.makeRng(0xD003);
    var x, y, i, k;

    /* ------------------------------------------------------------ FAR */
    var FW = 640, FH = 200, HOR = 126;
    var far = new Bitmap(FW, FH), fd = far.data;
    var V = new Float32Array(FW * FH), SM = new Float32Array(FW * FH);
    var MX = 292, MY = HOR + 62, MR = 124;                                  // Mars: a 240 px disc, only its cap is up
    function mdx(xx) { var q = xx - MX; if (q > FW / 2) q -= FW; else if (q < -FW / 2) q += FW; return q; }

    // --- sky: dusk gradient, glow hugging the planet's limb, smoke bands with lit bellies
    for (y = 0; y < HOR + 8; y++) {
      var env = mmax(exp(-(y - 30) * (y - 30) / 420), 0.9 * exp(-(y - 76) * (y - 76) / 160), 0.6 * exp(-(y - 106) * (y - 106) / 60));
      for (x = 0; x < FW; x++) SM[y * FW + x] = sstep(0.47, 0.66, pfbm(x / 80 + y / 150, y / 9, 31, 4, 8)) * env;
    }
    for (y = 0; y < HOR + 8; y++) {
      var g = 0.07 + 0.80 * pow(mmin(1, y / HOR), 1.7), yb = mmin(HOR + 7, y + 3) * FW;
      for (x = 0; x < FW; x++) {
        i = y * FW + x;
        var qx = mdx(x), qy = y - MY, out = mmax(0, sqrt(qx * qx + qy * qy) - MR);
        var v = g + 0.16 * exp(-out / 26) + (pfbm(x / 160, y / 40, 37, 2, 4) - 0.5) * 0.10;
        var s = SM[i];
        v = v * (1 - 0.60 * s) + 0.16 * mmax(0, s - SM[yb + x]);
        V[i] = v;
        fd[i] = sh(SKY, v * 7, x, y);
      }
    }
    // --- sparse stars
    for (i = 0; i < 150; i++) {
      x = floor(rng() * FW); y = floor(pow(rng(), 1.5) * 92); k = rng();
      if (SM[y * FW + x] > 0.08 || V[y * FW + x] > 0.42) continue;
      var qd = mdx(x), qe = y - MY;
      if (qd * qd + qe * qe < (MR + 6) * (MR + 6)) continue;
      fd[y * FW + x] = k < 0.5 ? SKY[4] : (k < 0.8 ? SKY[6] : (k < 0.94 ? SKY[7] : R.sand[5]));
      if (k > 0.97 && x > 0 && x < FW - 1 && y > 0) { fd[y * FW + x - 1] = SKY[5]; fd[y * FW + x + 1] = SKY[5]; fd[(y - 1) * FW + x] = SKY[5]; fd[(y + 1) * FW + x] = SKY[5]; }
    }

    // --- MARS ----------------------------------------------------------------------------
    var MARS = [R.maroon[0], R.maroon[1], R.orange[1], R.rust[3], R.orange[2], R.rust[4], R.rust[5]];
    var ML = new Float32Array(FW * (HOR + 8));                           // level offsets from craters
    //            nx     ny    r
    var craters = [[-0.52, -0.66, 9], [-0.20, -0.80, 14], [0.10, -0.68, 7], [0.30, -0.78, 10], [-0.36, -0.86, 5], [0.52, -0.66, 8],
      [-0.02, -0.91, 4], [0.18, -0.90, 3], [-0.62, -0.60, 4], [0.40, -0.62, 4], [-0.08, -0.62, 5], [0.66, -0.60, 5], [-0.30, -0.66, 3], [0.03, -0.80, 3]];
    for (k = 0; k < craters.length; k++) {
      var ox = MX + craters[k][0] * MR, oy = MY + craters[k][1] * MR, cr = craters[k][2];
      var sq = 0.55 + 0.45 * sqrt(mmax(0, 1 - craters[k][0] * craters[k][0] - craters[k][1] * craters[k][1]));   // foreshortened near the limb
      for (y = floor(oy - cr - 2); y <= oy + cr + 2; y++) for (x = floor(ox - cr - 2); x <= ox + cr + 2; x++) {
        if (y < 0 || y >= HOR + 8) continue;
        var cdx = x - ox, cdy = (y - oy) / sq, cd = sqrt(cdx * cdx + cdy * cdy) / cr;
        if (cd > 1.25) continue;
        var dir = (cdx * 0.64 + cdy * 0.77) / (cd * cr + 0.001);       // + = lower right
        if (cd < 0.8) ML[y * FW + x] += -0.55 + (cr > 6 ? dir * 0.5 * cd : 0);
        else ML[y * FW + x] += dir * (cr > 4 ? 1.5 : 1.1);
        if (cr > 8 && cd < 0.16) ML[y * FW + x] += 1.2;                 // central peak
      }
    }
    for (y = MY - MR - 1; y < HOR + 8; y++) {
      for (x = MX - MR - 1; x <= MX + MR + 1; x++) {
        var ddx = x - MX, ddy = y - MY, d2 = ddx * ddx + ddy * ddy;
        if (d2 > (MR + 0.4) * (MR + 0.4)) continue;
        i = y * FW + x;
        var nx = ddx / MR, ny = ddy / MR, nz = sqrt(mmax(0, 1 - nx * nx - ny * ny)), rr = sqrt(d2) / MR;
        var l = nx * -0.62 + ny * -0.45 + nz * 0.64;
        var lv = 0.4 + 4.0 * pow(mmax(0, l), 0.85);
        var m1 = pfbm(x / 44 + 3.3, y / 30 + 1.7, 41, 4, 0), m2 = pfbm(x / 13 + 7.1, y / 10, 43, 3, 0);
        lv -= 1.5 * sstep(0.50, 0.60, m1);                              // maria
        lv += (m2 - 0.5) * 1.5;
        var cy0 = MY - MR * 0.73 + sin(x * 0.045) * 4 + (m2 - 0.5) * 5; // a Valles-Marineris scar
        if (abs(y - cy0) < 1.6 && x > MX - 30 && x < MX + 62) lv -= 1.5;
        if (ny < -0.955 + (m2 - 0.5) * 0.03) lv += 1.6;                 // polar cap
        lv += ML[i];
        lv -= 1.3 * sstep(0.93, 1.0, rr);
        if (rr > 0.988 && l > 0.25) lv += 2.2;                          // sunlit sliver of atmosphere
        lv = lerp(lv, 3.1, 0.55 * sstep(HOR - 44, HOR, y));             // contrast dies in the horizon haze
        if (dth(mmax(0.5 * sstep(HOR - 14, HOR + 2, y), sstep(0.42, 0.72, SM[i])), x, y)) continue;   // haze + smoke drifting across
        fd[i] = sh(MARS, clamp(lv, 0, 6), x, y);
      }
    }

    // --- the plain: dark regolith, dust streaks, old craters
    var PLN = [C.black, R.maroon[0], R.maroon[1], R.maroon[2]];
    for (y = HOR; y < FH; y++) {
      var dep = (y - HOR) / (FH - HOR);
      for (x = 0; x < FW; x++) {
        var st = pfbm(x / 80, y / (2 + dep * 6), 71, 3, 8);
        fd[y * FW + x] = sh(PLN, 2.3 - dep * 3.2 + (st - 0.5) * 1.5 + 0.9 * exp(-(y - HOR) / 3), x, y);
      }
    }
    for (k = 0; k < 7; k++) {                                            // craters in perspective: dark bowl, lit far wall
      var px0 = 40 + k * 88 + floor(rng() * 40), py0 = HOR + 10 + floor(rng() * 22), prx = 9 + floor(rng() * 12), pry = mmax(2, round(prx * 0.2));
      for (y = py0 - pry; y <= py0 + pry; y++) for (x = px0 - prx; x <= px0 + prx; x++) {
        var e2 = (x - px0) * (x - px0) / (prx * prx) + (y - py0) * (y - py0) / (pry * pry);
        if (e2 > 1) continue;
        far.pset(mod(x, FW), y, e2 > 0.6 && y < py0 ? R.maroon[2] : (e2 > 0.55 && y >= py0 ? R.maroon[1] : (dth(0.6, x, y) ? C.black : R.maroon[0])));
      }
    }

    // --- ranges: a far purple one sinking in the haze, a near dark one framing the planet --------------
    var H1 = ridgeLine(FW, HOR + 2, 50, 51, 80, 40, 6), H2 = ridgeLine(FW, HOR + 14, 66, 57, 160, 32, 4);
    for (x = 0; x < FW; x++) {
      var q = mdx(x) / 100, q2 = mdx(x) / 150;
      H1[x] = HOR + 2 - (HOR + 2 - H1[x]) * (1 - 0.5 * exp(-q * q));
      H2[x] = HOR + 14 - (HOR + 14 - H2[x]) * (1 - 0.95 * exp(-q2 * q2));
    }
    paintRange(far, H1, HOR + 1, [R.dusk[0], R.dusk[1], R.dusk[2], R.maroon[2], R.maroon[3]], {
      lv: 1.6, lit: 1.9, shade: 1.0, shear: 0.5, fall: 0.022, seed: 61
    });
    paintRange(far, H2, HOR + 22, [C.black, R.maroon[0], R.maroon[1], R.maroon[2], R.rust[2]], {
      lv: 1.3, lit: 2.0, shade: 1.1, shear: -0.4, fall: 0.03, seed: 67,
      haze: function (hx, hy, t) { return sstep(HOR + 8, HOR + 22, hy); }
    });

    /* ------------------------------------------------------------ MID */
    var MW = 1024, MH = 120, M = new Bitmap(MW, MH);
    var MA = R.maroon, DU = R.dusk, M0 = MA[0], M1 = MA[1], M2 = MA[2], D1 = DU[1], D0 = DU[0];
    var GY = new Int16Array(MW);
    for (x = 0; x < MW; x++) GY[x] = 98 + round((pfbm(x / 64, 0.5, 77, 2, 16) - 0.5) * 9);
    function gy(xx) { return GY[mod(round(xx), MW)]; }

    // back row (hazier, purple): cooling towers, a geodesic dome, a far mast, the burial mound
    function ctower(cx, w2, h2, c) {
      for (var yy = 0; yy < h2; yy++) { var tt = yy / h2, hw2 = w2 * (0.62 + 0.38 * (tt - 0.35) * (tt - 0.35) / 0.42); M.rect(round(cx - hw2), 100 - h2 + yy, round(hw2 * 2), 1, c); }
    }
    ctower(612, 15, 44, D1); ctower(650, 12, 34, D1); M.rect(596, 88, 80, 14, D1);
    M.ellipse(846, 100, 32, 26, D1); for (k = -2; k <= 2; k++) M.line(846 + k * 12, 100, 846 + k * 5, 75, D0);
    M.rect(820, 87, 53, 1, D0); M.rect(828, 79, 37, 1, D0);
    M.rect(118, 36, 2, 64, D1); M.rect(112, 44, 14, 1, D1); M.rect(114, 54, 10, 1, D1); M.line(119, 40, 102, 100, D1); M.line(119, 40, 136, 100, D1);
    M.rect(960, 70, 64, 30, D1); M.rect(0, 78, 44, 22, D1); M.rect(972, 62, 30, 8, D1); M.rect(984, 50, 2, 12, D1);
    for (x = 300; x < 490; x++) {                                        // mound
      var mh = 20 * sin((x - 300) / 190 * PI) + 3 * pnoise(x / 9, 0.5, 79, 0);
      M.rect(x, round(100 - mh), 1, round(mh) + 2, D1);
    }
    var farG = [[322, 1], [334, 0], [347, 1], [361, 4], [372, 0], [388, 1], [399, 2], [415, 1], [428, 6], [441, 0], [455, 1], [468, 0]];
    for (i = 0; i < farG.length; i++) {
      var fgx = farG[i][0], fgy = round(100 - 20 * sin((fgx - 300) / 190 * PI)) + 1;
      grave(M, fgx, fgy, farG[i][1] ? 5 : 4, 6 + (i * 5) % 4, farG[i][1], ((i * 7) % 5 - 2) * 0.08, D1);
    }

    // ground
    for (x = 0; x < MW; x++) M.rect(x, GY[x], 1, MH - GY[x], M1);

    // A. hangar bunker with buttress fins, hex door, sign; roof dish; pipe to a silo ----------------
    M.poly([[30, 100], [44, 60], [172, 60], [188, 100]], M1);
    M.rect(58, 52, 96, 8, M1); M.rect(64, 48, 30, 4, M1); M.rect(120, 46, 22, 6, M1);
    M.rect(44, 60, 129, 1, M2); M.rect(58, 52, 96, 1, M2);
    for (k = 0; k < 4; k++) { var bx = 50 + k * 36 + (k > 1 ? 14 : 0); M.poly([[bx - 5, 100], [bx, 64], [bx + 3, 64], [bx + 6, 100]], M2); M.rect(bx + 3, 66, 1, 34, M0); }
    M.poly([[100, 100], [100, 80], [105, 74], [121, 74], [126, 80], [126, 100]], M0);           // hex door
    M.rect(104, 78, 18, 1, M2); M.rect(113, 80, 1, 20, M1);
    M.rect(60, 66, 21, 9, M0);                                                                   // "UAC" plate
    stamp(M, 62, 68, ['#.#.###.###', '#.#.#.#.#..', '#.#.###.#..', '#.#.#.#.#..', '###.#.#.###'], { '#': M2 });
    for (k = 0; k < 3; k++) M.rect(140 + k * 9, 68, 5, 2, M0);                                   // slit windows
    M.rect(72, 40, 2, 8, M1); dish(M, 73, 36, 9, -PI * 0.30, M1, M0);
    M.rect(130, 30, 1, 16, M1); M.rect(127, 34, 7, 1, M1);
    pipeH(M, 188, 84, 62, 5, MA, 1, 30); M.rect(204, 89, 2, 12, M1); M.rect(232, 89, 2, 12, M1);
    M.rect(250, 58, 24, 44, M1); M.ellipse(261.5, 58, 12, 6, M1); M.rect(250, 70, 24, 1, M0); M.rect(250, 86, 24, 1, M0);
    M.rect(276, 62, 1, 40, M1); M.rect(279, 62, 1, 40, M1); for (y = 64; y < 100; y += 4) M.rect(276, y, 4, 1, M1);
    M.rect(260, 46, 2, 8, M1);

    // B. the necropolis: crypt, stones, crosses, the impaled -----------------------------------
    M.rect(340, 78, 40, 22, M1); M.poly([[336, 78], [360, 64], [384, 78]], M1); M.rect(336, 78, 49, 2, M2);
    M.rect(359, 54, 3, 11, M1); M.rect(356, 57, 9, 2, M1);
    M.poly([[352, 100], [352, 88], [360, 82], [368, 88], [368, 100]], M0);
    M.rect(343, 82, 3, 18, M2); M.rect(374, 82, 3, 18, M2);
    //            x    w   h  kind shear
    var stones = [[296, 9, 13, 0, -0.10], [308, 7, 16, 1, 0.12], [324, 10, 12, 5, 0.0], [392, 8, 15, 2, 0.14], [404, 9, 20, 4, -0.06],
      [418, 11, 13, 7, 0.10], [432, 7, 12, 1, -0.2], [444, 9, 11, 0, 0.06], [466, 9, 18, 6, 0.10], [480, 8, 10, 5, -0.1],
      [776, 9, 12, 0, 0.12], [788, 11, 22, 3, -0.07], [803, 8, 14, 1, 0.16], [818, 10, 12, 7, -0.08], [846, 15, 34, 4, 0.05],
      [866, 9, 12, 2, -0.14], [878, 8, 15, 6, 0.1], [894, 10, 11, 5, 0.0], [906, 7, 13, 1, -0.12]];
    for (i = 0; i < stones.length; i++) { var sg = stones[i]; grave(M, sg[0], gy(sg[0]) + 1, sg[1], sg[2], sg[3], sg[4], M1, M0); }
    function impale(ix, hgt, art, flip) {
      var by = gy(ix) + 1;
      limb(M, ix, by, ix, by - hgt, 3, 1.5, M1);
      stamp(M, ix - 6, by - hgt - 3, art, { '#': M1 }, flip);
    }
    impale(316, 40, IMPALED_A, false); impale(457, 48, IMPALED_B, false); impale(389, 34, IMPALED_A, true);
    impale(832, 44, IMPALED_B, true); impale(889, 36, IMPALED_A, false); impale(218, 38, IMPALED_B, false);
    for (x = 396; x < 448; x += 6) { M.rect(x, gy(x) - 7, 1, 8, M1); M.pset(x, gy(x) - 8, M1); }          // iron fence
    M.rect(396, 92, 50, 1, M1);

    // C. the antenna mast, guyed, with its comm shack -----------------------------------------
    laced(M, 506, 10, 100, 7, M1, M1, 7);
    M.rect(509, 2, 1, 8, M1); M.rect(498, 22, 23, 1, M1); M.rect(501, 40, 17, 1, M1); M.rect(498, 22, 1, 4, M1); M.rect(520, 22, 1, 4, M1);
    dish(M, 519, 54, 5, -0.2, M1, M0); dish(M, 500, 66, 4, PI + 0.2, M1, M0);
    M.line(509, 14, 474, 99, M1); M.line(509, 14, 548, 99, M1); M.line(509, 44, 490, 99, M1); M.line(510, 44, 532, 99, M1);
    M.rect(520, 84, 30, 16, M1); M.rect(518, 82, 34, 2, M2); M.rect(526, 89, 4, 2, M0); M.rect(536, 89, 4, 2, M0); M.rect(543, 76, 1, 6, M1);

    // D. the main base: stepped bunker, big dish, dome, stacks -------------------------------------
    M.poly([[566, 100], [574, 74], [760, 74], [770, 100]], M1);
    M.poly([[596, 74], [602, 54], [716, 54], [722, 74]], M1);
    M.rect(574, 74, 187, 1, M2); M.rect(602, 54, 115, 1, M2);
    M.rect(626, 42, 34, 12, M1); M.rect(626, 42, 34, 1, M2);
    M.rect(641, 26, 4, 16, M1); dish(M, 643, 20, 22, -PI * 0.36, M1, M0);
    M.ellipse(700, 54, 14, 12, M1); M.rect(699, 36, 1, 7, M1);
    for (k = 0; k < 9; k++) M.rect(608 + k * 12, 60, 6, 2, M0);                                   // window slits
    for (k = 0; k < 7; k++) { M.rect(582 + k * 26, 78, 2, 22, M2); M.rect(584 + k * 26, 78, 1, 22, M0); }
    M.poly([[656, 100], [656, 86], [660, 81], [676, 81], [680, 86], [680, 100]], M0); M.rect(659, 84, 18, 1, M2);
    M.rect(590, 82, 13, 7, M0); stamp(M, 591, 83, ['#.#.###.###', '#.#.#.#.#..', '#.#.###.#..', '#.#.#.#.#..', '###.#.#.###'], { '#': M2 });
    pipeV(M, 734, 40, 34, 6, MA, 1, 0); M.rect(732, 38, 10, 3, M2); pipeV(M, 746, 50, 24, 5, MA, 1, 0); M.rect(744, 48, 9, 3, M2);
    pipeH(M, 716, 66, 20, 4, MA, 1, 0);

    // F. pump station + pipeline over the seam ---------------------------------------------------
    for (k = 0; k < 3; k++) { M.rect(930 + k * 18, 70 - k * 4, 14, 32 + k * 4, M1); M.ellipse(936.5 + k * 18, 70 - k * 4, 7, 4, M1); M.rect(930 + k * 18, 80, 14, 1, M0); }
    M.rect(990, 44, 2, 56, M1); M.rect(986, 50, 10, 1, M1); M.line(991, 48, 978, 100, M1); M.line(991, 48, 1004, 100, M1);
    pipeH(M, 984, 88, 40, 5, MA, 1, 22); pipeH(M, 0, 88, 34, 5, MA, 1, 22);
    M.rect(1010, 93, 2, 9, M1); M.rect(14, 93, 2, 9, M1);
    // E. ruined pylon among the eastern graves
    limb(M, 800, 99, 808, 60, 5, 2, M1); M.line(808, 60, 815, 66, M1); M.line(808, 60, 802, 54, M1);

    relight(M, { rim: 1, bevel: 1, cut: 1, bevelCut: 1, min: 0, max: 4, noise: 0.5, patch: 0.58, nscale: 16, seed: 83,
      grad: function (gx, gyy) { return gyy > 96 ? -(gyy - 96) * 0.12 : 0; } });

    // lights (after shading so they stay pure): red-alert beacons blink through the GLOW cycle
    M.pset(509, 1, GLOW[4]); M.pset(509, 2, GLOW[3]); M.pset(498, 21, GLOW[0]); M.pset(520, 21, GLOW[6]); M.pset(509, 40, GLOW[2]);
    M.pset(130, 29, GLOW[1]); M.pset(260, 45, GLOW[5]); M.pset(699, 35, GLOW[7]); M.pset(990, 43, GLOW[3]); M.pset(543, 75, GLOW[6]);
    M.pset(118, 35, GLOW[2]); M.pset(984, 49, GLOW[0]); M.pset(735, 37, GLOW[5]);
    for (k = 0; k < 9; k++) if (k % 3 !== 1) M.pset(610 + k * 12, 61, GLOW[(k * 3) & 7]);
    for (k = 0; k < 3; k++) M.pset(141 + k * 9, 69, GLOW[(k * 5 + 2) & 7]);
    for (k = 0; k < 8; k++) { M.pset(105 + k * 2, 76, GLOW[k]); M.pset(661 + k * 2, 83, GLOW[7 - k]); }       // door light bars
    M.pset(527, 90, LIQ[2]); M.pset(537, 90, LIQ[5]);

    /* ------------------------------------------------------------ NEAR */
    var NW = 1024, NH = 112, N = new Bitmap(NW, NH), G = R.gray, K = G[0];
    var NY = new Int16Array(NW);
    for (x = 0; x < NW; x++) NY[x] = 84 + round((pfbm(x / 128, 2.5, 91, 3, 8) - 0.5) * 26);
    function ngy(xx) { return NY[mod(round(xx), NW)]; }
    for (x = 0; x < NW; x++) N.rect(x, NY[x], 1, NH - NY[x], K);

    deadTree(N, 96, ngy(96) + 2, 84, 0x7E1, K, -0.12);
    deadTree(N, 548, ngy(548) + 2, 70, 0x7E7, K, 0.2);
    deadTree(N, 934, ngy(934) + 2, 58, 0x7F3, K, -0.3, 4);
    //             x    w   h  kind shear
    var bigs = [[34, 22, 34, 0, -0.08], [150, 18, 40, 4, 0.06], [188, 20, 26, 5, 0.1], [300, 24, 38, 7, -0.05], [338, 16, 30, 1, 0.14],
      [452, 22, 30, 2, 0.09], [640, 26, 40, 0, 0.07], [684, 16, 34, 6, -0.12], [770, 22, 44, 3, 0.04], [846, 20, 28, 5, -0.1], [990, 18, 36, 1, -0.1]];
    for (i = 0; i < bigs.length; i++) { var bg = bigs[i]; grave(N, bg[0], ngy(bg[0]) + 3, bg[1], bg[2], bg[3], bg[4], K, G[1]); }

    for (x = 3; x < NW - 3; x += 5 + ((x * 7) % 9)) {                     // rubble and dead grass break up the ridge line
      var tk = hash2(x, 3, 99);
      if (tk < 0.45) { N.line(x, ngy(x), x - 2, ngy(x) - 4 - (tk * 8 | 0), K); N.line(x + 1, ngy(x), x + 3, ngy(x) - 3, K); N.line(x, ngy(x), x, ngy(x) - 5, K); }
      else if (tk < 0.7) N.rect(x, ngy(x) - 2, 4 + (tk * 9 | 0) % 4, 3, K);
    }
    var smalls = [[70, 1], [126, 0], [274, 6], [420, 1], [476, 5], [578, 1], [712, 0], [806, 1], [912, 2], [960, 5]];
    for (i = 0; i < smalls.length; i++) grave(N, smalls[i][0], ngy(smalls[i][0]) + 2, 9 + (i % 3) * 2, 14 + (i * 5) % 7, smalls[i][1], ((i * 5) % 7 - 3) * 0.06, K, G[1]);
    // broken tech pylons: leaning lattice stumps with torn tops and dangling cable
    function pylon(px, hgt, shear, w) {
      var t = new Bitmap(w + 12, hgt), tx = 6;
      laced(t, tx, 6, hgt, w, K, K, w);
      t.rect(tx - 4, hgt - 5, w + 8, 5, K); t.rect(tx - 2, round(hgt * 0.45), w + 4, 2, K);
      t.poly([[tx, 6], [tx + 2, 0], [tx + 3, 6]], K); t.poly([[tx + w - 4, 6], [tx + w - 1, 2], [tx + w, 6]], K);      // torn chords
      t.line(tx + w, round(hgt * 0.45), tx + w + 5, round(hgt * 0.45) - 6, K);
      shearBlit(N, t, px, ngy(px) + 3, shear);
    }
    pylon(246, 62, 0.22, 12); pylon(726, 50, -0.26, 10); pylon(402, 30, 0.1, 10);
    N.line(260, ngy(246) - 52, 268, ngy(246) - 30, K); N.line(268, ngy(246) - 30, 266, ngy(246) - 18, K);
    dish(N, 598, ngy(598) - 2, 13, -PI * 0.86, K, G[1]);                   // a fallen dish
    N.line(602, ngy(602) - 10, 616, ngy(616), K);
    // toxic barrels
    var barrels = [372, 380, 812];
    for (i = 0; i < barrels.length; i++) { var bxx = barrels[i], bby = ngy(bxx) + 1; N.rect(bxx, bby - 10, 7, 11, K); N.rect(bxx - 1, bby - 8, 9, 1, G[1]); N.rect(bxx - 1, bby - 4, 9, 1, G[1]); }

    relight(N, { rim: 1.7, bevel: 1, cut: 0, min: 0, max: 3, noise: 0.5, nscale: 8, seed: 97,
      map: (function () { var mm = {}; mm[rampNo(G)] = [C.black, R.maroon[0], R.maroon[1], R.maroon[2]]; return mm; })() });

    // nukage: barrels brim, culverts drool into the dark (LIQ cycles -> it flows)
    for (i = 0; i < barrels.length; i++) { bxx = barrels[i]; bby = ngy(bxx) + 1; for (k = 0; k < 5; k++) N.pset(bxx + 1 + k, bby - 10, LIQ[(k + i * 3) & 7]); }
    var vents = [214, 500, 880];
    for (i = 0; i < vents.length; i++) {
      var vx = vents[i], vy = ngy(vx) + 6;
      N.ellipse(vx, vy, 7, 6, R.maroon[1]); N.ellipse(vx + 1, vy, 5, 5, C.black);
      for (k = 0; k < 9; k++) N.pset(vx - 3 + k, vy + 4 + (k === 0 || k === 8 ? -1 : 0), LIQ[(k + i * 2) & 7]);
      for (y = vy + 5; y < NH; y++) {
        N.pset(vx - 1, y, LIQ[mod(i * 3 - y, 8)]); N.pset(vx, y, LIQ[mod(i * 3 - y + 2, 8)]);
        if (y > vy + 9 && (y & 1)) N.pset(vx + 1, y, LIQ[mod(i * 3 - y + 5, 8)]);
      }
      N.pset(vx - 7, vy + 2, R.toxic[1]); N.pset(vx - 6, vy + 4, R.toxic[1]); N.pset(vx + 6, vy + 4, R.toxic[0]); N.pset(vx + 7, vy + 2, R.toxic[0]);
      N.pset(vx - 4, vy - 5, R.toxic[0]); N.pset(vx - 3, vy + 7, R.toxic[1]); N.pset(vx + 3, vy + 8, R.toxic[1]);
    }

    var ffx = farFx(info, FW, 0.04, 0.08);
    return {
      sky: sky,
      layers: [
        { bmp: far, fx: ffx, fy: 0, y: 0, wrap: true },
        { bmp: M, fx: 0.22, fy: 0.05, y: layerY(info, 68, 0.05), wrap: true, fill: C.black },
        { bmp: N, fx: 0.5, fy: 0.1, y: layerY(info, 88, 0.1), wrap: true, fill: C.black }
      ],
      lightning: false, lightningRate: 0, cycleLiq: 7, cycleGlow: 6
    };
  });

  /* ====================================================================== *
   *  STAGE 6 — THRONE OF ASTAROTH-LECHUCK-9000
   *  Nave of an infernal cathedral: storm behind the lancets, rose windows whose
   *  tracery is a 3.5" floppy disk, a pipe organ the size of a galleon, gargoyles.
   * ====================================================================== */

  /** Gothic pointed opening: is (dx, y) inside? hw = half width, ys = springing line, h = rise of the arch, y1 = sill. */
  function inArch(dx, y, hw, ys, h, y1) {
    if (dx < 0) dx = -dx;
    if (dx > hw || y > y1) return false;
    return y >= ys || (ys - y) <= h * pow(1 - dx / hw, 0.55);
  }

  var GARGOYLE_ART = [                 // crouching, facing right, wings half-spread
    '......#.................................',
    '.....##.................................',
    '....###.....#...........................',
    '....###....##...........#...#...........',
    '...####...###..........##..##...........',
    '...####..####..........##.###...........',
    '..#####.#####.........########..........',
    '..###########........###########........',
    '.############.......#############.......',
    '.############......####.##########......',
    '.############......################.##..',
    '#############.....####################..',
    '#############.....###################...',
    '##############....################......',
    '##############...###############........',
    '##############...################.......',
    '###############.####################....',
    '##.#################################....',
    '##..###############################.....',
    '#...#########################...........',
    '#....#######################............',
    '.....########################...........',
    '......########################..........',
    '......#########################.........',
    '.......#########################........',
    '.......##########################.......',
    '........#######################.##......',
    '........######################..###.....',
    '.........####################..####.....',
    '.........###################...####.....',
    '..........##################..#####.....',
    '..........########################......',
    '...........######################.......',
    '.#.........#######################......',
    '##........#########################.....',
    '##.......###########################....',
    '.##....############################.#...',
    '..################################..#...'
  ];

  GNG.Backdrops.register(5, function (info) {
    var sky = [[6, 5, 16], [12, 10, 28], [20, 17, 42], [30, 27, 58], [44, 40, 76], [62, 58, 96], [86, 84, 120], [118, 118, 148]];
    var x, y, i, k;

    /* ------------------------------------------------------------ FAR: the nave wall */
    var FW = 640, FH = 200, BAY = 160, far = new Bitmap(FW, FH), fd = far.data;
    var L = new Float32Array(FW * FH), SP = new Float32Array(FW * FH);
    var WL = [C.black, R.dusk[0], R.dusk[1], R.dusk[2], R.dusk[3]];            // stone
    var PU = [R.purple[0], R.purple[0], R.purple[1], R.purple[2], R.purple[2]]; // stone in the violet light of the roses
    var JB = [R.indigo[0], R.indigo[0], R.indigo[1], R.indigo[2], R.indigo[2]]; // stone catching storm light
    var EM = [C.black, R.maroon[0], R.maroon[1], R.maroon[2], R.maroon[2]];     // stone above the lava
    var TR = R.dusk[0];                                                         // tracery / leading against the glass
    function sky2(xx, yy) {                                                     // the storm outside
      var n = pfbm(xx / 80 + yy / 260, yy / 30, 5, 4, 8), n2 = pfbm(xx / 20, yy / 12, 9, 2, 32);
      return 0.9 + 4.6 * sstep(0.30, 0.78, n) + (n2 - 0.5) * 1.2 - 1.2 * sstep(120, 165, yy);
    }
    function glassSky(xx, yy) { fd[yy * FW + mod(xx, FW)] = sh(SKY, sky2(mod(xx, FW), yy), xx, yy); }

    // --- masonry: courses of blocks, darker in the vault and toward the floor
    for (y = 0; y < FH; y++) {
      var row = floor(y / 10), base = 0.75 + 1.0 * exp(-(y - 96) * (y - 96) / 5200);
      for (x = 0; x < FW; x++) {
        var xo = x + (row & 1) * 10, bx = floor(xo / 20) % 32, v = base + (hash2(bx, row, 7) - 0.5) * 0.9;
        if (y % 10 === 0 || xo % 20 === 0) v -= 0.75; else if (y % 10 === 1 || xo % 20 === 1) v += 0.3;
        v += (pfbm(x / 40, y / 40, 13, 3, 16) - 0.5) * 1.1;
        L[y * FW + x] = v;
      }
    }

    var done = new Uint8Array(FW * FH);
    function add(xx, yy, dv) { if (yy >= 0 && yy < FH) L[yy * FW + mod(xx, FW)] += dv; }
    function setL(xx, yy, vv) { if (yy >= 0 && yy < FH) L[yy * FW + mod(xx, FW)] = vv; }

    /** A pointed window: recess, moulded jamb catching the storm light, then glass via paint(dx, y). */
    function windowArch(cx, hw, ys, h, y1, paint) {
      for (var yy = ys - h - 4; yy <= y1 + 3; yy++) for (var dx = -hw - 4; dx <= hw + 4; dx++) {
        if (yy < 0 || yy >= FH) continue;
        var xx = mod(cx + dx, FW), ii = yy * FW + xx;
        if (inArch(dx, yy, hw, ys, h, y1)) { done[ii] = 1; paint(dx, yy, cx + dx); }
        else if (inArch(dx, yy + 0, hw + 2, ys, h + 3, y1 + 1)) { done[ii] = 2; L[ii] = (dx < 0 || yy > y1) ? 1.3 : 3.1; }   // splayed jamb: the side facing the light glows
        else if (inArch(dx, yy, hw + 4, ys, h + 6, y1 + 3)) L[ii] = L[ii] * 0.4 + 1.5 + (dx < 0 ? 0.5 : -0.5);
      }
    }
    function leadedSky(barEvery, mull) {
      return function (dx, yy, xx) {
        if ((mull && dx === 0) || (yy % barEvery) === 0) fd[yy * FW + mod(xx, FW)] = TR;
        else glassSky(xx, yy);
      };
    }

    // --- the floppy-disk rose
    function rose(cx, cy, ph) {
      var RO = 38, RG = 33;
      for (var yy = cy - RO - 46; yy <= cy + RO + 46; yy++) for (var xx = cx - RO - 46; xx <= cx + RO + 46; xx++) {
        if (yy < 0 || yy >= FH) continue;
        var u = xx - cx, w = yy - cy, r = sqrt(u * u + w * w), ii = yy * FW + mod(xx, FW);
        if (r > RO) { SP[ii] += 1.0 * exp(-(r - RO) / 16); continue; }
        if (r > RG) {                                                    // moulded stone ring
          done[ii] = 3; SP[ii] = 1;
          L[ii] = 2.2 + (r > RO - 1.5 ? -1.0 : 0) + (r < RG + 1.5 ? 1.2 : 0) + (-u - w) / RO * 0.9;
          continue;
        }
        done[ii] = 1;
        var c = TR, au = abs(u), aw = abs(w), g = -1, dim = 0;
        var inF = au <= 22 && aw <= 23 && (u - w) <= 37, inI = au <= 20 && aw <= 21 && (u - w) <= 34;
        if (inF && !inI) g = -1;                                         // the disk's edge = stone tracery
        else if (inI) {
          if (u >= -12 && u <= 10 && w <= -5) {                          // metal shutter with its slot
            if (u === -12 || u === 10 || w === -5) g = -1;
            else if (u >= 2 && u <= 6 && w >= -18 && w <= -8) g = -1;
            else { g = 3 + floor((u + 12) / 3) + ph; dim = 0; }
          } else if (au <= 15 && w >= 3) {                               // label
            if (au === 15 || w === 3) g = -1;
            else if ((w === 8 || w === 12 || w === 16) && au <= 11) g = -1;
            else { g = floor(w / 3) + 5 + ph; dim = 1; }
          } else if ((u >= -19 && u <= -17 && w >= 15 && w <= 18) || (u >= 16 && u <= 18 && w >= 15 && w <= 18)) g = -1;   // write-protect / HD notches
          else { g = floor(r / 4) + ph; dim = 2; }
        } else {                                                         // the lunes round the disk: radial panes
          var a = atan2(w, u) / TAU * 16 + 0.5, fa = a - floor(a);
          if (r > RG - 1.2 || fa < 0.16 || (r > 27 && r < 28.6)) g = -1;
          else { g = floor(a) + ph; dim = 3; }
        }
        if (g >= 0) {
          var lead = dim === 0 ? false : (dim === 1 ? ((xx + yy) & 3) === 0 : (((xx + yy) & 3) === 0 || ((xx - yy) & 3) === 0 || (dim === 3 && ((xx + yy) & 3) === 2)));
          c = lead ? R.purple[dim === 3 ? 0 : 1] : GLOW[mod(g, 8)];
        }
        fd[ii] = c;
      }
    }

    for (k = 0; k < 4; k++) {
      var cx = k * BAY + 80;
      // enclosing recess of the bay
      for (y = 0; y < 170; y++) for (x = -62; x <= 62; x++) {
        var in0 = inArch(x, y, 58, 98, 92, 166), in1 = inArch(x, y, 61, 98, 96, 169);
        if (in0) add(cx + x, y, -0.55);
        else if (in1) setL(cx + x, y, x < 0 ? 2.6 : 1.0);
      }
      if ((k & 1) === 0) {
        rose(cx, 58, k * 2);
        for (i = -2; i <= 2; i++) windowArch(cx + i * 20, 7, 128, 13, 160, leadedSky(11, false));
        for (i = -1; i <= 1; i += 2) {                                   // glowing trefoils in the spandrels
          for (y = -4; y <= 4; y++) for (x = -4; x <= 4; x++) if (x * x + y * y <= 17) {
            var ti = (104 + y) * FW + mod(cx + i * 44 + x, FW);
            done[ti] = 1; fd[ti] = (x * x + y * y > 9) ? TR : (((x + y) & 1) ? R.purple[1] : GLOW[(k * 2 + 4 + (i > 0 ? 3 : 0)) & 7]);
          }
        }
      } else {
        windowArch(cx - 22, 15, 70, 36, 160, leadedSky(14, true));
        windowArch(cx + 22, 15, 70, 36, 160, leadedSky(14, true));
        for (y = -11; y <= 11; y++) for (x = -11; x <= 11; x++) {       // quatrefoil oculus above the pair
          var rr = sqrt(x * x + y * y);
          if (rr > 11.5) continue;
          var qi = (30 + y) * FW + mod(cx + x, FW);
          if (rr > 8.5) { done[qi] = 3; L[qi] = 2.4 + (-x - y) / 11; SP[qi] = 0.8; continue; }
          done[qi] = 1;
          var lobe = mmin(mmin((x - 4) * (x - 4) + y * y, (x + 4) * (x + 4) + y * y), mmin(x * x + (y - 4) * (y - 4), x * x + (y + 4) * (y + 4)));
          fd[qi] = lobe <= 13 ? (((x + y) & 1) ? R.purple[1] : GLOW[(floor(rr / 2) + k) & 7]) : TR;
        }
        for (y = 10; y < 70; y++) for (x = cx - 30; x <= cx + 30; x++) { var od = sqrt((x - cx) * (x - cx) + (y - 30) * (y - 30)); if (od > 11.5) SP[y * FW + x] += 0.6 * exp(-(od - 11) / 9); }
      }
    }

    // --- wall shafts between the bays, capitals, vault ribs, string courses, dado arcade
    for (k = 0; k < 4; k++) {
      var px = k * BAY;
      for (i = 0; i < 2; i++) {                                          // ribs fanning out of the capital
        for (var t = 0; t <= 1; t += 0.004) {
          var rx = (12 + 70 * pow(t, 0.8)) * (i ? 1 : -1), ry = 38 - 58 * pow(t, 1.5);
          for (var j = 0; j < 4; j++) { setL(round(px + rx), round(ry) + j, j === 0 ? 2.9 : (j === 3 ? 0.6 : 1.9)); }
        }
      }
      for (y = 0; y < FH; y++) for (x = -14; x <= 14; x++) {
        var ax = abs(x), lobeC = ax > 8 ? (x < 0 ? -11 : 11) : 0, lobeW = ax > 8 ? 3 : 7.5, tt = (x - lobeC) / lobeW;
        var lv = 2.0 + 1.3 * mmax(0, 1 - abs(tt + 0.45) * 1.25) - 1.1 * mmax(0, tt - 0.25) - (ax > 8 ? 0.35 : 0);
        if (ax === 8) lv = 0.3;
        if (y < 30) lv -= (30 - y) * 0.03;
        if (y >= 34 && y <= 43) lv += (y === 34 || y === 39) ? 1.0 : (y === 43 ? -1.2 : 0.3);      // capital
        if (y >= 164 && y <= 168) lv += y === 164 ? 1.0 : 0.2;
        lv -= 0.9 * sstep(150, 200, y) * 0.6;
        setL(px + x, y, lv); done[y * FW + mod(px + x, FW)] = 3;
      }
      for (y = 34; y <= 43; y++) for (x = -18; x <= 18; x++) if (abs(x) > 14) setL(px + x, y, (y === 34 ? 3.0 : (y === 43 ? 0.5 : 1.9)) - (x > 0 ? 0.6 : 0));
    }
    for (x = 0; x < FW; x++) {
      for (y = 164; y < 169; y++) if (!done[y * FW + x] || done[y * FW + x] === 2) L[y * FW + x] = y === 164 ? 2.7 : (y === 168 ? 0.4 : 1.7);
      var dxa = mod(x, 20) - 10;
      for (y = 172; y < 196; y++) {
        if (done[y * FW + x]) continue;
        if (inArch(dxa, y, 7, 182, 8, 195)) L[y * FW + x] -= 0.7;
        else if (inArch(dxa, y, 8, 182, 9, 196)) L[y * FW + x] += dxa < 0 ? 0.6 : -0.2;
      }
    }

    // --- quantise the stone: violet where the roses shine, indigo on the jambs, embers low down
    for (y = 0; y < FH; y++) {
      var em = 0.75 * sstep(160, 199, y);
      for (x = 0; x < FW; x++) {
        i = y * FW + x;
        if (done[i] === 1) continue;
        var s = mmin(1, SP[i]), lvl = L[i] + s * 1.5 + em * 1.3;
        if (done[i] === 2) fd[i] = sh(JB, lvl, x, y);
        else if (em > 0 && dth(em, x, y)) fd[i] = sh(EM, lvl - 0.6, x, y);
        else if (dth(s * 1.15, x, y)) fd[i] = sh(PU, lvl, x, y);
        else fd[i] = sh(WL, lvl, x, y);
      }
    }

    /* ------------------------------------------------------------ MID: arcade, organ, chains */
    var MW = 1024, MH = 200, M = new Bitmap(MW, MH), md = M.data;
    var NT = R.night, SPAN = 256, PW = 17, SPR = 42, RISE = 38;
    function mset(xx, yy, lv) { if (yy >= 0 && yy < MH) md[yy * MW + mod(xx, MW)] = sh(NT, lv, xx, yy); }
    // arcade arches + spandrels
    for (x = 0; x < MW; x++) {
      var u = abs(mod(x + 128, SPAN) - 128) / 112;      // 0 at the crown of an arch, 1 at the pillar face
      if (u > 1) u = 1;
      var yA = round(SPR - RISE * pow(1 - u, 0.55));
      for (y = 0; y < yA; y++) {
        var dA = yA - y, lvA = 0.9 + (hash2(floor(x / 16), floor(y / 8), 23) - 0.5) * 0.5;
        if (dA <= 8) lvA = dA === 1 ? 3.2 : (dA === 2 ? 2.3 : (dA === 5 ? 0.8 : (dA === 8 ? 2.5 : 1.7)));
        else if (y % 8 === 0) lvA -= 0.4;
        mset(x, y, lvA);
      }
    }
    // colossal clustered piers
    for (k = 0; k < 4; k++) {
      var pcx = 128 + k * SPAN;
      for (y = SPR - 10; y < MH; y++) for (x = -PW; x <= PW; x++) {
        var pax = abs(x), lc = pax > 9 ? (x < 0 ? -13.5 : 13.5) : 0, lw = pax > 9 ? 4 : 9, pt = (x - lc) / lw;
        var plv = 1.5 + 1.8 * mmax(0, 1 - abs(pt + 0.5) * 1.3) - 1.2 * mmax(0, pt - 0.2) - (pax > 9 ? 0.3 : 0);
        if (pax === 9 || pax === 10) plv = pax === 9 ? 0.4 : plv;
        if ((y - SPR) % 46 === 30) plv += 0.8; else if ((y - SPR) % 46 === 31) plv -= 0.9;      // drum joints
        mset(pcx + x, y, plv);
      }
      for (y = SPR - 12; y < SPR + 2; y++) for (x = -PW - 5; x <= PW + 5; x++) {                   // capital
        var cw = PW + 5 - (y > SPR - 4 ? (y - SPR + 4) : 0);
        if (abs(x) > cw) continue;
        mset(pcx + x, y, (y === SPR - 12 ? 3.8 : (y === SPR - 7 ? 3.1 : (y === SPR - 6 ? 0.8 : 2.1))) - (x > 6 ? 1.0 : 0) + (x < -PW ? 0.6 : 0));
      }
      for (y = 176; y < MH; y++) {                                                                 // base
        var bw = y < 180 ? PW + 3 : (y < 188 ? PW + 6 : PW + 9);
        for (x = -bw; x <= bw; x++) mset(pcx + x, y, (y === 176 || y === 180 || y === 188 ? 3.2 : 1.8) - (x > 4 ? 1.0 : 0) - (y > 188 ? 0.5 : 0));
      }
    }

    // --- the organ, filling the arch between two piers -------------------------------------------
    var OX = 512, BR = [C.black, R.brown[0], R.gold[0], R.gold[1], R.gold[2]], W0 = R.brown[0], W1 = R.brown[1], WK = C.black;
    function pipe(px0, w, top, mouth) {
      for (var yy = top; yy <= mouth + 9; yy++) {
        var inset = yy > mouth ? mmin((w >> 1) - 1, (yy - mouth) >> 1) : 0;
        for (var q = inset; q < w - inset; q++) {
          var f = (q + 0.5) / w, lv = f < 0.18 ? 1.6 : (q === ((w * 0.3) | 0) ? (w >= 6 ? 3.3 : 2.8) : (f < 0.75 ? 2.0 : 1.0));
          lv -= 1.4 * sstep(mouth - 24, top - 6, yy);                 // the tops are lost in the gloom
          if (yy === top) lv += 0.8;
          M.pset(px0 + q, yy, sh(BR, lv, px0 + q, yy));
        }
      }
      for (q = 1; q < w - 1; q++) M.pset(px0 + q, mouth, WK);          // mouth: dark slot + bright upper lip
      if (w >= 6) { M.pset(px0 + 1, mouth - 1, BR[4]); M.pset(px0 + 2, mouth - 1, BR[4]); M.pset(px0 + (w >> 1), mouth - 2, BR[3]); }
      else M.pset(px0 + 1, mouth - 1, BR[3]);
    }
    function tower(x0, n, w, tops, corn, mouth, spire) {
      var tw = n * (w + 1) + 3;
      M.rect(x0, corn, tw, 156 - corn, WK);                             // the case, in shadow
      for (var q = 0; q < n; q++) pipe(x0 + 2 + q * (w + 1), w, tops[q], mouth);
      M.rect(x0 - 2, corn - 5, tw + 4, 5, W0); M.rect(x0 - 2, corn - 5, tw + 4, 1, W1); M.rect(x0 - 1, corn, tw + 2, 1, WK);
      for (q = 0; q < n; q++) {                                         // carved pipe shades
        var sx0 = x0 + 2 + q * (w + 1);
        for (var yy = corn + 1; yy < tops[q] - 1; yy++) if (((yy - corn) & 1) === 0 || yy < corn + 3) M.rect(sx0 + (yy & 2 ? 1 : 0), yy, w - 1, 1, W0);
      }
      M.rect(x0, corn, 2, 156 - corn, W0); M.rect(x0, corn, 1, 156 - corn, W1); M.rect(x0 + tw - 2, corn, 2, 156 - corn, W0);
      if (spire) {
        var mx2 = x0 + (tw >> 1);
        M.poly([[x0 - 1, corn - 5], [mx2, corn - 5 - spire], [x0 + tw, corn - 5]], W0);
        M.line(x0 - 1, corn - 5, mx2, corn - 5 - spire, W1);
        M.rect(mx2, corn - 9 - spire, 1, 5, W0); M.rect(mx2 - 1, corn - 7 - spire, 3, 1, W0);
        for (q = 1; q < 4; q++) { M.pset(x0 - 1 + round((mx2 - x0) * q / 4) - 1, corn - 6 - round(spire * q / 4), W1); M.pset(x0 + tw - round((mx2 - x0) * q / 4) + 1, corn - 6 - round(spire * q / 4), W0); }
      } else {
        for (q = 0; q <= 1; q++) { var fx0 = q ? x0 + tw : x0 - 1; M.rect(fx0, corn - 10, 2, 5, W0); M.pset(fx0, corn - 11, W1); }
      }
    }
    M.rect(OX - 100, 150, 201, 50, WK);                                 // plinth of the case
    tower(OX - 96, 5, 6, [68, 60, 52, 60, 68], 46, 138, 0);
    tower(OX + 59, 5, 6, [68, 60, 52, 60, 68], 46, 138, 0);
    tower(OX - 57, 5, 4, [70, 74, 78, 82, 86], 62, 132, 0);
    tower(OX + 30, 5, 4, [86, 82, 78, 74, 70], 62, 132, 0);
    tower(OX - 31, 7, 7, [56, 48, 40, 34, 40, 48, 56], 30, 142, 17);
    // the 9000-series eye in the gable
    M.disc(OX, 22, 3.6, WK); M.circ(OX, 22, 3, W1); M.rect(OX - 1, 21, 3, 3, R.red[2]); M.pset(OX, 22, R.red[4]); M.pset(OX - 1, 21, R.red[3]);
    // impost, panelling, console
    M.rect(OX - 102, 150, 205, 3, W0); M.rect(OX - 102, 150, 205, 1, W1); M.rect(OX - 100, 156, 201, 1, W0);
    for (k = -4; k <= 4; k++) {
      if (k === 0) continue;
      var pnx = OX + k * 22 - 8;
      M.rect(pnx, 160, 17, 1, W0); M.rect(pnx, 160, 1, 34, W0); M.rect(pnx + 16, 160, 1, 34, WK); M.rect(pnx + 3, 164, 11, 1, W0);
      M.poly([[pnx + 3, 190], [pnx + 3, 170], [pnx + 8, 165], [pnx + 13, 170], [pnx + 13, 190]], W0); M.poly([[pnx + 5, 190], [pnx + 5, 171], [pnx + 8, 168], [pnx + 11, 171], [pnx + 11, 190]], WK);
    }
    M.rect(OX - 100, 194, 201, 6, W0); M.rect(OX - 100, 194, 201, 1, W1);
    M.rect(OX - 24, 154, 49, 34, WK); M.rect(OX - 24, 154, 49, 1, W1); M.rect(OX - 25, 154, 1, 34, W0); M.rect(OX + 25, 154, 1, 34, W0);
    M.rect(OX - 13, 157, 27, 8, W0); M.rect(OX - 11, 158, 23, 6, R.tan[1]);                     // music desk + score
    for (k = 0; k < 4; k++) M.rect(OX - 9, 159 + k, 19 - (k & 1) * 6, 1, (k & 1) ? R.tan[1] : R.tan[0]);
    for (k = 0; k < 3; k++) {                                            // three manuals
      for (x = -18; x <= 18; x++) M.pset(OX + x, 168 + k * 3, (x % 3 === 0) ? R.bone[0] : R.bone[k === 0 ? 2 : 1]);
      M.rect(OX - 19, 169 + k * 3, 39, 1, W0);
    }
    for (k = 0; k < 5; k++) { M.pset(OX - 22, 158 + k * 3, BR[3]); M.pset(OX + 22, 158 + k * 3, BR[3]); M.pset(OX - 20, 159 + k * 3, BR[2]); M.pset(OX + 20, 159 + k * 3, BR[2]); }   // stop knobs
    // the organist, from behind: hood, cape, arms on the keys
    M.poly([[OX - 9, 200], [OX - 8, 178], [OX - 4, 170], [OX + 4, 170], [OX + 8, 178], [OX + 9, 200]], R.dusk[0]);
    M.disc(OX, 166, 4.2, R.dusk[0]); M.line(OX - 7, 178, OX - 15, 171, R.dusk[0]); M.line(OX + 7, 178, OX + 15, 171, R.dusk[0]);
    M.line(OX - 7, 179, OX - 15, 172, R.dusk[0]); M.line(OX + 7, 179, OX + 15, 172, R.dusk[0]);
    M.pset(OX - 3, 163, R.dusk[1]); M.pset(OX - 4, 165, R.dusk[1]); M.pset(OX - 4, 172, R.dusk[1]); M.pset(OX - 7, 177, R.dusk[1]); M.pset(OX - 8, 184, R.dusk[1]); M.pset(OX - 8, 191, R.dusk[1]);
    M.rect(OX - 14, 190, 29, 2, W0); M.rect(OX - 12, 192, 2, 8, W0); M.rect(OX + 11, 192, 2, 8, W0);   // bench

    // --- chains, gibbet cages, a wheel chandelier ------------------------------------------------
    function archY(xx) { var uu = mmin(1, abs(mod(xx + 128, SPAN) - 128) / 112); return round(SPR - RISE * pow(1 - uu, 0.55)); }
    function cage(cxx, cy, occupant) {
      var c1 = NT[2], c2 = NT[4];
      chain(M, cxx, archY(cxx) - 1, cy, c1, c2);
      M.rect(cxx - 1, cy, 3, 3, c2); M.poly([[cxx - 10, cy + 10], [cxx, cy + 2], [cxx + 10, cy + 10]], c1); M.line(cxx - 10, cy + 10, cxx, cy + 2, c2);
      if (occupant) {                                                    // somebody did not make it out
        var bo = R.bone[1], bd = R.bone[0], sy = cy + 14;
        M.rect(cxx - 2, sy, 5, 4, bo); M.rect(cxx - 1, sy + 4, 3, 1, bo); M.pset(cxx - 1, sy + 1, C.black); M.pset(cxx + 1, sy + 1, C.black); M.pset(cxx, sy + 3, bd);
        M.rect(cxx, sy + 5, 1, 12, bd);
        for (var rb = 0; rb < 4; rb++) M.rect(cxx - 3, sy + 7 + rb * 2, 7, 1, rb & 1 ? bd : bo);
        M.line(cxx - 3, sy + 7, cxx - 5, sy + 14, bd); M.line(cxx + 3, sy + 7, cxx + 5, sy + 14, bd);
        M.line(cxx - 1, sy + 17, cxx - 3, sy + 24, bd); M.line(cxx + 1, sy + 17, cxx + 3, sy + 24, bd);
      }
      for (var q = -10; q <= 10; q += 5) { var qx = cxx + q; M.rect(qx, cy + 10, 1, 30, q < 0 ? c2 : c1); }
      M.rect(cxx - 10, cy + 10, 21, 1, c2); M.rect(cxx - 10, cy + 24, 21, 1, c1); M.rect(cxx - 11, cy + 39, 23, 3, c1); M.rect(cxx - 11, cy + 39, 23, 1, c2);
      M.rect(cxx - 1, cy + 42, 3, 3, c1);
    }
    cage(212, 56, true); cage(306, 92, false); cage(706, 80, false); cage(986, 64, true); cage(62, 98, true);
    chain(M, 256, archY(256) - 1, 46, NT[2], NT[4]); stamp(M, 251, 46, HOOK_ART, { '#': NT[2] });
    chain(M, 924, archY(924) - 1, 96, NT[2], NT[4]); chain(M, 34, archY(34) - 1, 60, NT[2], NT[4]); stamp(M, 29, 60, HOOK_ART, { '#': NT[2] });
    // wheel chandelier with cursed flames
    var CHX = 790, CHY = 78;
    chain(M, CHX, archY(CHX) - 1, CHY - 22, NT[2], NT[4]);
    M.line(CHX, CHY - 22, CHX - 24, CHY, NT[2]); M.line(CHX, CHY - 22, CHX + 24, CHY, NT[2]); M.line(CHX, CHY - 22, CHX - 8, CHY + 4, NT[2]); M.line(CHX, CHY - 22, CHX + 8, CHY + 4, NT[2]);
    for (k = 0; k < 64; k++) {
      var ca = k / 64 * TAU, ex = round(CHX + cos(ca) * 26), ey = round(CHY + sin(ca) * 5);
      M.pset(ex, ey, sin(ca) > 0 ? NT[4] : NT[2]); M.pset(ex, ey + 1, NT[sin(ca) > 0 ? 3 : 1]); if (sin(ca) > 0) M.pset(ex, ey + 2, NT[1]);
    }
    for (k = 0; k < 7; k++) {
      var fa2 = (k + 0.25) / 7 * TAU, fx2 = round(CHX + cos(fa2) * 26), fy2 = round(CHY + sin(fa2) * 5);
      M.rect(fx2, fy2 - 4, 1, 4, R.bone[1]); M.pset(fx2, fy2 - 5, GLOW[(k * 3) & 7]); M.pset(fx2, fy2 - 6, GLOW[(k * 3 + 1) & 7]);
      if (sin(fa2) > 0) M.pset(fx2, fy2 - 7, GLOW[(k * 3 + 2) & 7]);
    }

    /* ------------------------------------------------------------ NEAR: statues, candelabra, ruin */
    var NW = 1024, NH = 128, N = new Bitmap(NW, NH), G = R.gray, K = G[0], K1 = G[1];
    N.rect(0, NH - 6, NW, 6, K);
    function plinth(cxx, w, h) {
      N.rect(cxx - (w >> 1), NH - h, w, h, K); N.rect(cxx - (w >> 1) - 3, NH - h, w + 6, 4, K); N.rect(cxx - (w >> 1) - 2, NH - 12, w + 4, 12, K);
      N.rect(cxx - (w >> 1) + 3, NH - h + 8, w - 6, 1, K1); N.rect(cxx - (w >> 1) + 3, NH - 16, w - 6, 1, K1);
      N.rect(cxx - (w >> 1) + 3, NH - h + 8, 1, h - 24, K1);
    }
    var garg = maskBmp(GARGOYLE_ART, K, 1), gargF = garg.flipH();
    function gargoyle(cxx, h, flip) {
      plinth(cxx, 62, h);
      shearBlit(N, flip ? gargF : garg, cxx, NH - h - 1, 0);
    }
    gargoyle(150, 30, false); gargoyle(668, 38, true);
    function brokenColumn(cxx, w, h, seed, slope) {
      var x0 = cxx - (w >> 1);
      N.rect(x0 - 4, NH - 10, w + 8, 10, K); N.rect(x0 - 2, NH - 14, w + 4, 4, K);
      for (var q = 0; q < w; q++) {
        var top = NH - h + round(q * slope + hash2(q >> 1, 5, seed) * 6 + (slope < 0 ? -w * slope : 0));
        N.rect(x0 + q, top, 1, NH - 14 - top, (q % 4) === 2 ? K1 : K);
      }
    }
    brokenColumn(470, 32, 60, 3, 0.7); brokenColumn(916, 30, 84, 8, -0.5);
    N.ellipse(526, NH - 13, 9, 8, K); N.rect(526, NH - 21, 22, 17, K); N.ellipse(548, NH - 13, 9, 8, K); N.ellipse(548, NH - 13, 6, 5.5, K1);   // a fallen drum
    for (k = 0; k < 4; k++) N.rect(528 + k * 5, NH - 20, 1, 15, K1);
    function candelabrum(cxx, h) {
      var by = NH - 5, top = by - h + 12;
      N.poly([[cxx - 10, by], [cxx - 3, by - 6], [cxx + 3, by - 6], [cxx + 10, by]], K); N.rect(cxx - 11, by - 1, 23, 2, K);
      N.rect(cxx - 1, top, 3, h - 14, K);
      N.ellipse(cxx + 0.5, by - h * 0.30, 4, 3, K); N.ellipse(cxx + 0.5, by - h * 0.55, 3.2, 2.2, K);
      for (var q = -2; q <= 2; q++) {
        var ax = cxx + q * 9, cupY = top + abs(q) * 6 - (q === 0 ? 5 : 0), armY = top + 16 + abs(q) * 3;
        if (q !== 0) {
          N.rect(mmin(cxx, ax), armY, abs(ax - cxx) + 1, 2, K); N.rect(ax - (q < 0 ? 0 : 1), cupY, 2, armY - cupY + 1, K);
          N.pset(ax + (q < 0 ? -1 : 1), armY + 1, K); N.pset(ax + (q < 0 ? 2 : -2), armY - 1, K);
        }
        N.rect(ax - 2, cupY - 1, 5, 2, K); N.rect(ax - 1, cupY - 7, 3, 6, K1);
      }
    }
    candelabrum(322, 74); candelabrum(808, 66); candelabrum(1004, 58);
    for (x = 706; x < 780; x += 9) { N.rect(x, NH - 26, 3, 20, K); N.ellipse(x + 1, NH - 16, 2.6, 4, K); }                // a stretch of altar rail
    N.rect(700, NH - 30, 84, 4, K); N.rect(700, NH - 30, 4, 26, K); N.rect(780, NH - 30, 4, 26, K);

    relight(N, { lx: -1, ly: 1, rim: 2.5, bevel: 2, cut: 0, min: 0, max: 3, noise: 0.4, nscale: 8, seed: 31,
      grad: function (gx, gyy) { return (gyy - 100) * 0.035; },
      map: (function () { var mm = {}; mm[rampNo(G)] = [C.black, R.maroon[0], R.maroon[1], R.ember[1]]; return mm; })() });

    // eyes, flames, and the lava light licking the floor
    N.rect(150 - 40 + 46, NH - 30 - garg.h + 18, 2, 2, GLOW[2]); N.rect(668 - 40 + 32, NH - 38 - garg.h + 18, 2, 2, GLOW[6]);
    var cands = [[322, 74], [808, 66], [1004, 58]];
    for (i = 0; i < cands.length; i++) {
      var ccx = cands[i][0], ctop = NH - 5 - cands[i][1] + 12;
      for (k = -2; k <= 2; k++) {
        var fx3 = ccx + k * 9, fy3 = ctop + abs(k) * 6 - (k === 0 ? 5 : 0) - 8, g0 = (i * 3 + k + 8) & 7;
        N.pset(fx3, fy3 - 3, GLOW[g0]); N.rect(fx3 - 1, fy3 - 2, 3, 2, GLOW[(g0 + 1) & 7]); N.pset(fx3, fy3 - 2, GLOW[(g0 + 2) & 7]); N.pset(fx3, fy3 - 1, GLOW[(g0 + 3) & 7]);
        N.pset(fx3, fy3, GLOW[(g0 + 2) & 7]);
      }
    }
    for (x = 0; x < NW; x++) {
      var lw2 = pfbm(x / 16, 0.5, 41, 2, 64);
      if (lw2 > 0.42) { N.pset(x, NH - 1, LIQ[mod(floor(x * 0.5), 8)]); if (lw2 > 0.55) N.pset(x, NH - 2, LIQ[mod(floor(x * 0.5) + 3, 8)]); }
      else N.pset(x, NH - 1, R.ember[0]);
    }

    var ffx = farFx(info, FW, 0.04, 0.08);
    return {
      sky: sky,
      layers: [
        { bmp: far, fx: ffx, fy: 0, y: 0, wrap: true },
        { bmp: M, fx: 0.22, fy: 0.05, y: layerY(info, 0, 0.05), wrap: true, fill: C.black },
        { bmp: N, fx: 0.5, fy: 0.1, y: layerY(info, 72, 0.1), wrap: true, fill: C.black }
      ],
      lightning: true, lightningRate: 0.5, cycleLiq: 6, cycleGlow: 5
    };
  });

  /* ====================================================================== *
   *  TITLE BACKGROUND
   *  Moonrise over the graveyard hill; the demon castle across the bay; the late-80s
   *  PC that somebody buried here (and that will not stay buried).
   *  Kept dark and calm where the game prints the logo (y 14..78) and the menu (x 60..260, y 120..190).
   * ====================================================================== */

  /** Full moon: lit sphere, maria, a few craters. */
  function moonDisc(b, cx, cy, Rm, seed) {
    var MO = [R.slate[4], R.mist[4], R.bone[4], R.bone[5], R.bone[6], R.bone[7]], x, y, i;
    for (y = cy - Rm - 1; y <= cy + Rm + 1; y++) for (x = cx - Rm - 1; x <= cx + Rm + 1; x++) {
      var dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
      if (d2 > (Rm + 0.3) * (Rm + 0.3) || y < 0 || y >= b.h || x < 0 || x >= b.w) continue;
      var nx = dx / Rm, ny = dy / Rm, nz = sqrt(mmax(0, 1 - nx * nx - ny * ny));
      var v = 0.58 + 0.42 * (nx * -0.35 + ny * -0.45 + nz * 0.82);
      v -= 0.27 * sstep(0.50, 0.60, pfbm(x / 20 + 1.7, y / 20 + 4.1, seed, 4, 0));
      v -= 0.10 * sstep(0.60, 0.70, pfbm(x / 9 + 9, y / 9 + 2, seed + 3, 3, 0));
      v -= 0.24 * sstep(0.84, 1.0, sqrt(d2) / Rm);
      b.data[y * b.w + x] = sh(MO, clamp(v, 0, 1) * 5, x, y);
    }
    var cr = [[-0.42, -0.30, 4], [0.22, -0.52, 3], [0.36, 0.18, 5], [-0.16, 0.44, 3], [-0.58, 0.20, 2], [0.02, -0.06, 2], [0.56, -0.22, 2]];
    for (i = 0; i < cr.length; i++) {
      var ox = round(cx + cr[i][0] * Rm), oy = round(cy + cr[i][1] * Rm), rr = cr[i][2];
      for (var a = 0; a < 24; a++) {
        var an = a / 24 * TAU, lit = cos(an) * 0.64 + sin(an) * 0.77;
        b.pset(round(ox + cos(an) * rr), round(oy + sin(an) * rr), lit > 0.25 ? R.bone[7] : (lit < -0.25 ? R.mist[4] : R.bone[5]));
      }
    }
  }

  var TINY = {                           // 3x5 chisel font for the epitaph
    R: ['##.', '#.#', '##.', '#.#', '#.#'], I: ['#', '#', '#', '#', '#'], P: ['##.', '#.#', '##.', '#..', '#..'],
    '6': ['.##', '#..', '###', '#.#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '0': ['###', '#.#', '#.#', '#.#', '###'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], '.': ['.', '.', '.', '.', '#'], ' ': ['.', '.', '.', '.', '.']
  };
  function tiny(b, str, x, y, c) {
    for (var i = 0; i < str.length; i++) { var g = TINY[str.charAt(i)]; if (!g) continue; stamp(b, x, y, g, { '#': c }); x += g[0].length + 1; }
  }

  GNG.Backdrops.registerTitle(function () {
    var sky = [[3, 4, 14], [5, 8, 24], [8, 14, 38], [12, 22, 54], [18, 33, 72], [28, 48, 92], [42, 68, 114], [66, 96, 140]];
    var W = 320, H = 200, b = new Bitmap(W, H), d = b.data, x, y, i, k;
    var rng = GNG.makeRng(0x7171), NT = R.night;
    var MX = 56, MY = 88, MR = 29, HZ = 112, SH = HZ + 16;
    function moonOut(xx, yy) { return mmax(0, sqrt((xx - MX) * (xx - MX) + (yy - MY) * (yy - MY)) - MR); }

    // --- sky: deep night, a halo round the rising moon, long stratus lit along the edges that face it
    var CL = new Float32Array(W * SH);
    for (y = 0; y < SH; y++) {
      var env = mmax(0.4 * exp(-(y - 22) * (y - 22) / 90), 0.8 * exp(-(y - 70) * (y - 70) / 110), exp(-(y - 98) * (y - 98) / 90));
      for (x = 0; x < W; x++) CL[y * W + x] = sstep(0.46, 0.66, pfbm(x / 70 + y / 90, y / 8, 3, 4, 0)) * env;
    }
    for (y = 0; y < SH; y++) for (x = 0; x < W; x++) {
      var out = moonOut(x, y), c = CL[y * W + x], cu = CL[mmax(0, y - 2) * W + mmax(0, x - 2)];
      var v = 0.05 + 0.56 * pow(mmin(1, y / HZ), 2.3) + 0.30 * exp(-out / 20) + 0.12 * exp(-out / 64);
      v = v * (1 - 0.5 * c) + mmax(0, c - cu) * (0.14 + 0.5 * exp(-out / 50));
      d[y * W + x] = sh(SKY, v * 7, x, y);
    }
    for (i = 0; i < 110; i++) {                                          // stars: sparse and faint, the logo sits here
      x = floor(rng() * W); y = floor(pow(rng(), 1.3) * 92); k = rng();
      if (CL[y * W + x] > 0.05 || moonOut(x, y) < 26) continue;
      d[y * W + x] = k < 0.55 ? SKY[4] : (k < 0.9 ? SKY[5] : SKY[7]);
    }

    // --- the moon, with cloud streaks drifting across its face
    moonDisc(b, MX, MY, MR, 77);
    function streak(cx, cy, len, th, seed) {
      for (var xx = cx - len; xx <= cx + len; xx++) {
        if (xx < 0 || xx >= W) continue;
        var uu = (xx - cx) / len, taper = pow(1 - uu * uu, 0.7);
        var mid = cy + (pnoise(xx / 26, 0.5, seed, 0) - 0.5) * 7, hh = th * taper * (0.4 + 1.2 * pnoise(xx / 9, 1.5, seed, 0));
        for (var yy = floor(mid - hh); yy <= ceil(mid + hh); yy++) {
          var q = (yy - mid) / (hh + 0.001), a = 1 - q * q;
          if (a < bayer(xx, yy) * 0.9) continue;
          var o2 = moonOut(xx, yy);
          b.pset(xx, yy, sh(SKY, 2.4 + (q < 0 ? 3.0 * q * q : 1.0 * q * q) + 2.0 * exp(-o2 / 12), xx, yy));
        }
      }
    }
    streak(96, 80, 44, 2.6, 5); streak(22, 100, 40, 2.2, 9); streak(60, 67, 22, 1.2, 15);

    // --- the bay: dark water, the moon's road across it
    for (y = HZ; y < SH; y++) for (x = 0; x < W; x++) {
      var wv = hash2(floor((x + y * 5) / (3 + (y - HZ) * 0.5)), y, 21), road = abs(x - MX) < 28 - (y - HZ) * 1.2 + wv * 8;
      var li = mod(floor(x * 0.3 + y * 2.3 + wv * 3), 8);
      if (road && wv > 0.72) d[y * W + x] = R.slate[4];
      else if (road && wv > 0.35) d[y * W + x] = LIQ[4 + ((x + y) & 1)];
      else d[y * W + x] = wv > 0.5 ? LIQ[li] : (wv > 0.25 ? LIQ[(li + 4) & 7] : NT[1]);
    }

    // --- far shore, the crag and the castle on it (moonlit from the left)
    var CRG = [C.black, NT[0], NT[1], NT[2], NT[3], R.slate[2]];
    var pts = [[150, 114], [176, 113], [192, 111], [204, 107], [214, 104], [222, 101], [232, 101], [246, 102], [262, 102], [284, 101], [292, 103], [302, 107], [312, 109], [320, 110]];
    var crest = new Float32Array(W);
    for (x = 0; x < W; x++) crest[x] = HZ + 3;
    for (i = 0; i + 1 < pts.length; i++) for (x = pts[i][0]; x <= pts[i + 1][0] && x < W; x++) {
      crest[x] = lerp(pts[i][1], pts[i + 1][1], (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0])) + (pnoise(x / 5, 0.5, 33, 0) - 0.5) * 3;
    }
    for (x = 0; x < 120; x++) crest[x] = HZ + 1 - 4 * mmax(0, sin(x / 38 + 1.2)) - pnoise(x / 7, 2.5, 35, 0) * 2;    // far shore on the left
    for (x = 0; x < W; x++) {
      for (y = ceil(crest[x]); y < SH; y++) {
        var t = y - crest[x], xs = clamp(round(x + t * 0.5 + (pnoise(x / 6, y / 6, 37, 0) - 0.5) * 6), 1, W - 2);
        var sl = crest[xs + 1] - crest[xs - 1];
        if (x < 130 && y > HZ + 2) continue;
        d[y * W + x] = sh(CRG, 1.2 + (sl < 0 ? 2.2 : -0.7) * mmin(1, abs(sl) / 1.6) - t * 0.09 + (t < 1 ? 1.2 : 0), x, y);
      }
    }
    var cs = new Bitmap(W, H), C1 = NT[1], C0 = NT[0];
    cs.rect(234, 91, 56, 12, C1); for (x = 234; x < 290; x += 4) cs.rect(x, 89, 2, 2, C1);                 // curtain wall
    cs.rect(249, 77, 24, 26, C1); for (x = 249; x < 273; x += 4) cs.rect(x, 75, 2, 2, C1);                 // keep
    cs.rect(236, 72, 9, 31, C1); cs.poly([[234, 72], [240, 60], [246, 72]], C1); cs.rect(234, 72, 13, 1, C0);       // towers
    cs.rect(278, 76, 9, 27, C1); cs.poly([[276, 76], [282, 65], [288, 76]], C1); cs.rect(276, 76, 13, 1, C0);
    cs.rect(257, 69, 7, 8, C1); cs.poly([[255, 69], [260, 60], [265.5, 69]], C1);
    cs.poly([[249, 78], [244, 71], [245, 66], [248, 72], [252, 76]], C1); cs.poly([[272, 78], [277, 71], [276, 66], [273, 72], [269, 76]], C1);   // horns
    cs.rect(240, 57, 1, 4, C1); cs.rect(282, 62, 1, 4, C1);
    cs.rect(224, 96, 10, 7, C1); cs.rect(223, 94, 3, 2, C1); cs.rect(229, 94, 3, 2, C1);                   // barbican
    thick(cs, 198, 112, 226, 102, 2, C1);                                                                  // causeway down to the shore
    for (k = 0; k < 3; k++) cs.rect(203 + k * 8, 111 - k * 3, 2, 7, C1);
    relight(cs, { rim: 2.4, bevel: 1, cut: 1, bevelCut: 1, min: 0, max: 4, wrap: false,
      map: (function () { var mm = {}; mm[rampNo(NT)] = [C.black, NT[0], NT[1], NT[3], R.slate[2]]; return mm; })() });
    cs.rect(241, 57, 3, 2, R.red[2]);                                                                      // pennant
    cs.rect(259, 95, 4, 8, C.black); cs.rect(260, 94, 2, 1, C.black);                                      // gate
    cs.rect(253, 83, 3, 1, GLOW[1]); cs.pset(255, 84, GLOW[2]); cs.rect(266, 83, 3, 1, GLOW[5]); cs.pset(266, 84, GLOW[6]);   // the castle is watching
    cs.pset(240, 79, GLOW[3]); cs.pset(282, 83, GLOW[7]); cs.pset(260, 72, GLOW[0]); cs.pset(240, 90, GLOW[4]); cs.pset(228, 99, GLOW[2]);
    cs.pset(257, 97, GLOW[6]); cs.pset(264, 97, GLOW[1]); cs.pset(283, 93, GLOW[4]);
    b.blit(cs, 0, 0);

    // --- low mist over the water and round the foot of the crag
    for (y = HZ - 12; y < SH; y++) for (x = 0; x < W; x++) {
      var dens = sstep(0.36, 0.70, pfbm(x / 56, y / 5, 17, 3, 0)) * exp(-(y - HZ - 5) * (y - HZ - 5) / 70) * 0.85;
      if (dth(dens, x, y)) d[y * W + x] = sh(SKY, 3.6 + 2.2 * exp(-moonOut(x, y) / 50), x, y);
    }
    // crows on the wing
    var fl = [[118, 94, 0], [196, 84, 1], [211, 93, 0], [150, 86, 1]];
    for (i = 0; i < fl.length; i++) stamp(b, fl[i][0], fl[i][1], fl[i][2] ? ['#...#', '.#.#.', '..#..'] : ['.#.#.', '#.#.#'], { '#': C.black });

    // --- the graveyard hill (mid-ground): dark, moon just catching the crest
    var HL = [C.black, NT[0], NT[1], NT[2], NT[3], R.slate[2]], hy = new Float32Array(W);
    for (x = 0; x < W; x++) {
      hy[x] = 125 - 7 * exp(-(x - 150) * (x - 150) / 13000) + (pnoise(x / 14, 0.5, 51, 0) - 0.5) * 3;
      for (y = ceil(hy[x]); y < H; y++) {
        var ht = y - hy[x], near = 0.55 + 0.75 * exp(-abs(x - MX) / 80);
        d[y * W + x] = sh(HL, 1.25 + 3.0 * near * exp(-ht / 1.8) + (pfbm(x / 26, y / 7, 53, 3, 0) - 0.5) * 1.1 - ht * 0.004, x, y);
      }
    }

    // ground mist pooling in the corners, behind the near mounds (the menu column stays clear)
    for (y = 122; y < 168; y++) for (x = 0; x < W; x++) {
      var side = mmax(1 - sstep(40, 104, x), sstep(214, 280, x));
      if (side <= 0) continue;
      var dn = sstep(0.34, 0.7, pfbm(x / 40 + 7, y / 6, 19, 3, 0)) * exp(-(y - 140) * (y - 140) / 200) * side * 0.62;
      if (dth(dn, x, y)) d[y * W + x] = sh(SKY, 2.3 + 1.6 * exp(-moonOut(x, y) / 60), x, y);
    }

    // --- silhouettes: crest graves, the near mounds with their big stones, trees
    var F = new Bitmap(W, H), G = R.gray, K = G[0], K1 = G[1], mtop = new Int16Array(W).fill(999);
    function hyAt(xx) { return round(hy[clamp(round(xx), 0, W - 1)]); }
    //            x   w   h  kind shear
    var crestG = [[98, 7, 10, 0, 0.1], [121, 8, 15, 1, -0.12], [143, 8, 8, 5, 0], [171, 7, 12, 6, 0.16], [200, 8, 10, 2, -0.08], [224, 7, 16, 3, 0.05], [186, 5, 6, 0, 0], [108, 5, 7, 1, 0.2]];
    for (i = 0; i < crestG.length; i++) grave(F, crestG[i][0], hyAt(crestG[i][0]) + 1, crestG[i][1], crestG[i][2], crestG[i][3], crestG[i][4], K);
    // near mounds (profile tables: x -> top y)
    function mound(tab, seed) {
      for (var q = 0; q + 1 < tab.length; q++) for (var xx = tab[q][0]; xx <= tab[q + 1][0]; xx++) {
        var tt = (xx - tab[q][0]) / (tab[q + 1][0] - tab[q][0]); tt = tt * tt * (3 - 2 * tt);
        var top = round(lerp(tab[q][1], tab[q + 1][1], tt) + (pnoise(xx / 9, 0.5, seed, 0) - 0.5) * 4);
        F.rect(xx, top, 1, H - top, K); mtop[xx] = top;
        if (hash2(xx, 2, seed) < 0.14) { F.line(xx, top, xx - 2, top - 4, K); F.line(xx, top, xx + 1, top - 5, K); F.line(xx, top, xx + 3, top - 3, K); }
      }
    }
    var LM = [[0, 153], [26, 149], [52, 153], [74, 164], [92, 182], [106, 200]], RM = [[214, 200], [230, 184], [248, 170], [270, 160], [296, 155], [319, 152]];
    mound(LM, 59); mound(RM, 67);
    deadTree(F, 11, 154, 124, 0x51, K, 0.16);
    deadTree(F, 313, 156, 78, 0x5D, K, 0.05, 4);
    grave(F, 44, 152, 26, 54, 4, -0.07, K, K1);                           // the big celtic cross against the moon
    grave(F, 74, 167, 15, 22, 0, 0.12, K, K1);
    grave(F, 290, 158, 30, 46, 7, 0.05, K, K);                            // the epitaph stone
    grave(F, 252, 172, 13, 30, 1, 0.15, K, K1);
    grave(F, 232, 186, 11, 15, 2, -0.1, K, K1);
    stamp(F, 37, 91, CROW_ART, { '#': K }, false); stamp(F, 287, 106, CROW_ART, { '#': K }, true);
    relight(F, { rim: 2, bevel: 1, cut: 0, min: 0, max: 3, wrap: false,
      map: (function () { var mm = {}; mm[rampNo(G)] = [C.black, NT[1], NT[3], R.slate[3]]; return mm; })() });
    for (x = 0; x < W; x++) {                                             // moonlit turf along the mound tops
      var mt = mtop[x];
      if (mt > H - 2 || F.get(x, mt - 1)) continue;
      F.pset(x, mt, x < 160 ? NT[3] : R.slate[2]);
      if (dth(0.6, x, mt + 1)) F.pset(x, mt + 1, NT[2]);
      if (dth(0.35, x, mt + 2)) F.pset(x, mt + 2, NT[1]);
      if (dth(0.15, x, mt + 4)) F.pset(x, mt + 4, NT[1]);
    }
    tiny(F, 'R.I.P', 284, 126, NT[3]); tiny(F, '640K', 284, 134, NT[3]); F.rect(282, 142, 19, 1, NT[1]); F.rect(284, 146, 14, 1, NT[1]);
    F.pset(41, 93, GLOW[3]);                                              // crow's eye
    F.rect(74, 141, 2, 4, R.bone[2]); F.pset(74, 140, GLOW[2]); F.pset(75, 139, GLOW[4]); F.pset(74, 139, GLOW[3]); F.pset(75, 140, GLOW[5]);   // a candle somebody still lights
    b.blit(F, 0, 0);

    // --- relics of a late-80s PC, half buried (dark shapes, a few moonlit highlights)
    var T = R.tan, SOIL = C.black;
    // CRT monitor, screen cracked
    var mon = new Bitmap(38, 32);
    mon.rect(1, 0, 36, 25, T[1]); mon.rect(0, 1, 38, 23, T[1]); mon.rect(1, 0, 36, 1, T[3]); mon.rect(0, 1, 1, 22, T[2]); mon.rect(1, 1, 36, 1, T[2]);
    mon.rect(37, 2, 1, 22, T[0]); mon.rect(2, 24, 35, 1, T[0]);
    mon.rect(4, 4, 25, 17, T[0]); mon.rect(5, 5, 23, 15, C.black); mon.rect(6, 4, 21, 17, C.black);
    for (y = 5; y < 20; y++) for (x = 6; x < 27; x++) if (dth(0.5 - (y - 5) * 0.04, x, y)) mon.pset(x, y, R.teal[0]);
    mon.line(8, 7, 11, 6, R.teal[1]); mon.line(7, 9, 9, 8, R.teal[1]);                                     // glass glint
    var cr = [[11, 5], [24, 6], [26, 16], [9, 17], [15, 11], [22, 19]];
    for (i = 0; i < cr.length; i++) mon.line(18, 11, cr[i][0], cr[i][1], i & 1 ? R.mist[3] : R.mist[2]);   // the crack
    mon.pset(18, 11, R.mist[5]); mon.pset(19, 10, R.mist[4]); mon.pset(13, 8, R.mist[3]); mon.pset(22, 14, R.mist[3]);
    mon.rect(8, 17, 3, 1, R.green[3]); mon.rect(12, 17, 2, 1, R.toxic[4]);                                 // C:\>_  still waiting
    for (k = 0; k < 4; k++) mon.rect(31, 6 + k * 3, 4, 1, T[0]);
    mon.pset(32, 20, GLOW[4]); mon.rect(31, 18, 1, 1, T[0]);
    mon.rect(13, 25, 12, 2, T[0]); mon.rect(7, 27, 24, 5, T[1]); mon.rect(7, 27, 24, 1, T[2]); mon.rect(30, 28, 1, 4, T[0]);
    shearBlit(b, mon, 26, 187, 0.14);
    // keyboard
    for (y = 0; y < 8; y++) for (x = 0; x < 38; x++) {
      var kx = 34 + x + (7 - y), ky = 187 + y + round(x * 0.09);
      b.pset(kx, ky, y === 7 ? T[0] : (y === 0 ? T[2] : ((x % 3 === 2 || (y & 1) === 0) ? T[0] : T[1])));
    }
    b.line(34, 190, 30, 188, T[0]);
    // soil thrown back over them
    b.poly([[0, 200], [0, 180], [6, 183], [12, 189], [20, 192], [34, 196], [48, 200]], SOIL);
    b.poly([[58, 200], [62, 194], [70, 190], [80, 192], [92, 200]], SOIL);
    b.pset(6, 182, NT[3]); b.pset(7, 183, NT[3]); b.pset(13, 189, NT[1]); b.pset(63, 193, NT[3]); b.pset(70, 189, NT[3]); b.pset(71, 189, NT[1]);
    // 5.25" floppy leaning on the epitaph stone
    var fd5 = new Bitmap(20, 20), GR = R.gray;
    fd5.rect(0, 0, 20, 20, GR[0]); fd5.rect(0, 0, 20, 1, GR[3]); fd5.rect(0, 0, 1, 20, GR[2]); fd5.rect(19, 1, 1, 19, C.black);
    fd5.rect(2, 2, 13, 4, T[1]); fd5.rect(3, 4, 8, 1, T[0]); fd5.rect(2, 2, 13, 1, T[3]);
    fd5.circ(9, 11, 3, GR[4]); fd5.disc(9, 11, 1.5, C.black); fd5.pset(13, 12, GR[3]);
    fd5.rect(8, 16, 3, 3, C.black); fd5.rect(8, 16, 1, 3, GR[2]); fd5.rect(10, 16, 1, 3, GR[2]); fd5.rect(19, 5, 1, 2, 0);
    shearBlit(b, fd5, 268, 172, -0.22);
    // 3.5" floppy stuck in the ground
    var fd3 = new Bitmap(15, 15), SL = R.slate;
    fd3.rect(0, 0, 15, 15, SL[1]); fd3.rect(0, 0, 14, 1, SL[3]); fd3.rect(0, 0, 1, 15, SL[2]); fd3.pset(14, 0, 0);
    fd3.rect(3, 0, 8, 6, R.steel[3]); fd3.rect(3, 0, 8, 1, R.steel[5]); fd3.rect(7, 1, 2, 4, SL[0]);
    fd3.rect(2, 8, 11, 7, R.bone[1]); fd3.rect(3, 10, 8, 1, R.bone[0]); fd3.rect(3, 12, 6, 1, R.bone[0]);
    shearBlit(b, fd3, 304, 187, 0.2);
    b.poly([[292, 190], [298, 184], [306, 182], [314, 185], [319, 183], [319, 200], [290, 200]], SOIL);
    b.pset(298, 183, NT[3]); b.pset(306, 181, NT[3]); b.pset(307, 181, NT[1]); b.pset(314, 184, NT[3]);
    // joystick
    b.rect(262, 189, 22, 7, GR[1]); b.rect(262, 189, 22, 1, GR[3]); b.rect(262, 195, 22, 1, GR[0]); b.rect(264, 196, 3, 1, GR[0]); b.rect(279, 196, 3, 1, GR[0]);
    b.rect(277, 187, 4, 2, R.red[3]); b.rect(277, 187, 3, 1, R.red[5]);
    b.ellipse(270, 189, 3.5, 1.5, GR[0]);
    thick(b, 270, 188, 267, 175, 2, GR[2]); b.line(267, 188, 264, 175, GR[4]);
    b.disc(265.5, 173, 3.2, R.red[2]); b.pset(264, 171, R.red[5]); b.pset(265, 171, R.red[4]); b.pset(264, 172, R.red[4]);

    return { bmp: b, sky: sky };
  });

})();
