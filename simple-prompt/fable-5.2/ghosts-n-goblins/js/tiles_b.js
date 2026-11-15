/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * tiles_b.js — tilesets + decorative props for stages 4-6:
 *   stage 4 (index 3)  The Lemmings Crusher Foundry
 *   stage 5 (index 4)  Phobos E1M1 Necropolis
 *   stage 6 (index 5)  Throne of Astaroth-LeChuck-9000
 *
 * Classic script, loads after engine.js. Everything is generated at stage load by the
 * builders registered with GNG.Tiles.register(); all randomness is seeded (hash2).
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.Tiles || !GNG.Bitmap) return;

  var Bitmap = GNG.Bitmap, R = GNG.RAMPS;
  var M = Math, floor = M.floor, round = M.round, sqrt = M.sqrt, abs = M.abs, min = M.min, max = M.max,
    sin = M.sin, cos = M.cos, atan2 = M.atan2, imul = M.imul, PI = M.PI;
  var TS = 16;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* ====================================================================== *
   *  SHARED TOOLKIT
   * ====================================================================== */

  function col(n) { return GNG.col(n); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function tile() { var b = new Bitmap(TS, TS); b.ax = 0; b.ay = 0; return b; }
  function bmp(w, h) { return new Bitmap(w, h); }

  /** Deterministic 2D integer hash -> [0,1) (same formula as GNG.hash2). */
  function hash2(x, y, seed) {
    var h = (imul(x | 0, 374761393) + imul(y | 0, 668265263) + imul((seed | 0) + 1, 1274126177)) | 0;
    h = imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** Ordered-dithered shade (same result as GNG.shade); v is in SHADE UNITS 0..7. */
  function sh(r, v, x, y) {
    var i = floor(v + (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16);
    return r[i < 0 ? 0 : (i > 7 ? 7 : i)];
  }
  /** "Hand" shade: flat colours, with a clean 50% checker only where v is near x.5 (no stray specks). */
  function sc(r, v, x, y) {
    var i = floor(v), f = v - i;
    if (f >= 0.75 || (f >= 0.25 && ((x + y) & 1))) i++;
    return r[i < 0 ? 0 : (i > 7 ? 7 : i)];
  }

  /** Legend for ASCII art: digits 0-7 = shades of `ramp`, plus named extras; '.' / ' ' transparent. */
  function LG(ramp, extras) {
    var o = {}, k;
    if (ramp) for (k = 0; k < 8; k++) o[String(k)] = ramp + k;
    if (extras) for (k in extras) o[k] = extras[k];
    return GNG.makeLegend(o);
  }
  /** ASCII art -> Bitmap. Mistakes are reported in GNG.artWarnings by the engine parser. */
  function art(legend, rows, name) { return GNG.parseArt(legend, rows, name || 'tiles_b'); }

  /** 2x2 rivet / bolt head lit from the upper-left (hi, mid, lo = shade numbers of ramp r). */
  function rivet(b, x, y, r, hi, mid, lo) {
    b.pset(x, y, r[hi]); b.pset(x + 1, y, r[mid]); b.pset(x, y + 1, r[mid]); b.pset(x + 1, y + 1, r[lo]);
  }

  /** Cylinder lighting profile across t = 0..1 (highlight near the upper-left third). */
  function cyl(t, lo, hi) {
    var d = t < 0.3 ? (0.3 - t) / 0.3 * 0.75 : (t - 0.3) / 0.7;
    return lo + (hi - lo) * (1 - d * d);
  }

  /** Value noise whose lattice wraps every `period` cells (tileable). */
  function wnoise(x, y, period, seed) {
    var xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
    var y0 = ((yi % period) + period) % period, y1 = (y0 + 1) % period;
    var a = hash2(x0, y0, seed), b2 = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
    return a + (b2 - a) * u + (c - a) * v + (a - b2 - c + d) * u * v;
  }
  /** Tileable fractal noise over one 16px tile (cells of 8, 4 and 2 px). Returns 0..1. */
  function wfbm(x, y, seed) {
    return (wnoise(x / 8, y / 8, 2, seed) * 4 + wnoise(x / 4, y / 4, 4, seed + 31) * 2 + wnoise(x / 2, y / 2, 8, seed + 67)) / 7;
  }
  /**
   * Organic height-field for hash-picked tile variants: every variant shares the same
   * (tileable) outer ring, so ANY variant sits seamlessly next to any other one.
   */
  function organic(x, y, seed, shared) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return wfbm((x + 16) & 15, (y + 16) & 15, shared);
    var d = min(x, 15 - x, y, 15 - y);
    var w = d >= 3 ? 0 : (3 - d) / 3;
    var a = wfbm(x, y, seed);
    return w ? a + (wfbm(x, y, shared) - a) * w : a;
  }

  /** Jagged crack: dark polyline with an optional lit lip on its right-hand side. */
  function crackLine(b, pts, dark, lite) {
    var k;
    if (lite) for (k = 0; k + 1 < pts.length; k++) b.line(pts[k][0] + 1, pts[k][1], pts[k + 1][0] + 1, pts[k + 1][1], lite);
    for (k = 0; k + 1 < pts.length; k++) b.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], dark);
  }

  /** Hanging chain, 6px wide, any height (8px link period -> vertically tileable). */
  function chainProp(h, ramp) {
    var b = bmp(6, h), r = R[ramp], y, p;
    for (y = 0; y < h; y++) {
      p = y & 7;
      if (p === 0) { b.pset(1, y, r[4]); b.pset(2, y, r[6]); b.pset(3, y, r[5]); b.pset(4, y, r[3]); }
      else if (p === 1 || p === 2) { b.pset(1, y, r[5]); b.pset(2, y, r[p === 1 ? 2 : 4]); b.pset(3, y, r[p === 1 ? 1 : 2]); b.pset(4, y, r[2]); }
      else if (p === 3) { b.pset(1, y, r[3]); b.pset(2, y, r[3]); b.pset(3, y, r[2]); b.pset(4, y, r[1]); }
      else { b.pset(2, y, r[p === 4 ? 5 : 4]); b.pset(3, y, r[2]); }
    }
    return b;
  }

  /**
   * Frame list for an animated prop. Built with the global Array constructor (not a literal) so the
   * engine's `instanceof Array` test in GNG.Tiles.build() also holds inside the Node vm sandbox,
   * where array literals belong to a different realm than the injected global `Array`.
   */
  function frames() {
    var a = new Array(), i;
    for (i = 0; i < arguments.length; i++) a.push(arguments[i]);
    return a;
  }

  function emptySet() {
    return { solid: [], solidTop: [], alt: [], altTop: [], back: [], backAlt: [], platform: [], ladder: [], spikes: [], cracked: [], bridge: [], conveyor: [], props: {} };
  }

  /* ====================================================================== *
   *  STAGE 4 — THE LEMMINGS CRUSHER FOUNDRY
   * ====================================================================== */

  function buildFoundry() {
    var st = R.steel, sl = R.slate, ru = R.rust, br = R.brown, go = R.gold, gr = R.green, gy = R.gray, tn = R.tan;
    var em = R.ember, gl = R.glow, lq = R.liq, zo = R.zombie, sd = R.sand, bo = R.bone;
    var OUTL = col('outline'), BLK = col('black'), HOTY = col('hotyellow'), WHITE = col('white');
    var i;

    /* ---------- riveted steel plating: 16px courses, rivet rows along the seams, random butt joints ---------- */
    var COURSE = [5, 4, 4, 3.5, 3, 3, 3, 3, 3, 3, 3, 3, 2.5, 2, 2, 1];
    function plateBody(b, y0) {
      for (var yy = y0; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) b.pset(xx, yy, sc(st, COURSE[yy], xx, yy));
    }
    function rv(b, px, py) {
      b.pset(px, py, st[7]); b.pset(px + 1, py, st[5]); b.pset(px, py + 1, st[5]); b.pset(px + 1, py + 1, st[2]);
      b.pset(px + 2, py + 1, st[2]); b.pset(px + 1, py + 2, st[2]);
    }
    function plateDetail(b, v) {
      if (v === 1) {                               // butt joint with a rivet column on each side
        b.vline(6, 1, 14, st[2]); b.vline(7, 0, 15, st[1]); b.vline(8, 1, 14, st[5]);
        rv(b, 3, 7); rv(b, 11, 7);
      }
      if (v === 2) { b.line(5, 10, 8, 7, st[4]); b.line(8, 10, 10, 8, st[4]); }           // glint
      if (v === 3) { b.pset(3, 4, ru[3]); b.pset(3, 5, ru[3]); b.pset(3, 6, ru[2]); b.pset(4, 4, ru[2]); }   // rust weeping from a rivet
    }
    function steelPlate(v) {
      var b = tile();
      plateBody(b, 0);
      plateDetail(b, v);
      rv(b, 3, 2); rv(b, 11, 2); rv(b, 3, 12); rv(b, 11, 12);
      return b;
    }

    /* ---------- steel floor with hazard-stripe lip ---------- */
    function hazardRow(b, xx, y0) {
      var yel = [HOTY, go[5], go[4], go[3]], blk = [gy[2], gy[1], gy[1], gy[0]];
      for (var k = 0; k < 4; k++) b.pset(xx, y0 + k, ((xx + k + 1) & 7) < 4 ? yel[k] : blk[k]);
    }
    function hazardLip(b) {
      for (var xx = 0; xx < 16; xx++) {
        b.pset(xx, 0, st[7]);
        hazardRow(b, xx, 1);
        b.pset(xx, 5, st[0]);
        b.pset(xx, 6, st[4]);
        b.pset(xx, 7, sc(st, 3.5, xx, 7));
      }
    }
    function steelTop(v) {
      var b = tile();
      plateBody(b, 6);
      hazardLip(b);
      if (v === 1) { b.vline(6, 7, 8, st[2]); b.vline(7, 6, 9, st[1]); b.vline(8, 7, 8, st[5]); }
      if (v === 2) { b.pset(5, 2, st[4]); b.pset(6, 2, st[3]); b.pset(6, 3, st[4]); b.pset(12, 3, st[3]); b.pset(13, 2, st[4]); }   // chipped paint
      if (v === 3) { b.pset(11, 8, ru[3]); b.pset(11, 9, ru[2]); b.pset(11, 10, ru[2]); b.pset(4, 3, st[3]); }
      rv(b, 3, 12); rv(b, 11, 12);
      return b;
    }

    /* ---------- brown "Lemmings dirt": chunky clods lit from the upper-left ---------- */
    var DSH = 900;   // shared-border seed
    function clod(xx, yy, seed) {
      var h = organic(xx, yy, seed, DSH);
      return h < 0.40 ? 2 : (h < 0.63 ? 3 : 4);
    }
    function dirtFill(b, seed) {
      for (var yy = 0; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) {
        var t = clod(xx, yy, seed), ul = clod(xx - 1, yy - 1, seed), c = t;
        if (t > ul) c = t + 1;                       // lit rim of a clod
        else if (t < ul) c = (ul - t > 1) ? 1 : (t === 3 ? 2 : (hash2(xx, yy, seed) < 0.45 ? 1 : 2));   // cast shadow
        else {                                       // grit inside the clods (never on the shared border ring)
          var g = hash2(xx, yy, seed + 5), e = min(xx, 15 - xx, yy, 15 - yy);
          if (e > 0 && g < 0.09) c = t === 2 ? 3 : t - 1;
          else if (e > 0 && g > 0.965 && t === 3) c = 4;
        }
        b.pset(xx, yy, br[c]);
      }
    }
    function pebble(b, px, py) { b.pset(px, py, tn[5]); b.pset(px + 1, py, tn[3]); b.pset(px, py + 1, tn[3]); b.pset(px + 1, py + 1, br[1]); }
    function dirtBits(b, v, minY) {
      if (v === 0 && minY < 6) pebble(b, 5, 6);
      if (v === 1) { b.pset(10, 10, ru[4]); b.pset(11, 10, ru[3]); b.pset(10, 11, br[1]); }                    // ore fleck
      if (v === 2) { pebble(b, 10, 11); if (minY < 4) { b.pset(4, 4, tn[4]); b.pset(5, 5, br[1]); } }
      if (v === 3) { b.pset(6, 9, br[0]); b.pset(7, 9, br[1]); b.pset(6, 10, br[1]); b.pset(7, 10, br[5]); }   // little burrow
    }
    function dirt(v) {
      var b = tile();
      dirtFill(b, [910, 917, 1003, 931][v]);
      dirtBits(b, v, 0);
      return b;
    }
    function dirtTop(v) {
      var b = tile();
      dirtFill(b, [950, 957, 964, 1011][v]);
      dirtBits(b, v, 9);
      for (var xx = 0; xx < 16; xx++) {
        // blade depth: shared at the tile edges so any two variants meet cleanly
        var e = min(xx, 15 - xx), row = e < 2 ? 0 : v + 1;
        var d = 3 + floor(hash2(xx, row, 77) * 3);
        if (xx % 4 === 1) d++;
        b.pset(xx, 0, gr[hash2(xx, row, 78) < 0.3 ? 7 : 6]);
        b.pset(xx, 1, gr[hash2(xx, row, 79) < 0.25 ? 4 : 5]);
        for (var yy = 2; yy < d; yy++) b.pset(xx, yy, gr[yy === d - 1 ? 3 : 4]);
        b.pset(xx, d, gr[2]);
        b.pset(xx, d + 1, br[1]);
      }
      return b;
    }

    /* ---------- dark corrugated factory wall ---------- */
    var CORR = [2, 1, 1, 0];
    function backPanel(v) {
      var b = tile(), xx, yy;
      for (yy = 0; yy < 16; yy++) for (xx = 0; xx < 16; xx++) b.pset(xx, yy, sl[CORR[xx & 3]]);
      if (v === 1 || v === 3) {                    // sheet lap seam along the tile bottom, with bolts
        for (xx = 0; xx < 16; xx++) { b.pset(xx, 14, sl[0]); b.pset(xx, 15, sl[(xx & 3) === 3 ? 1 : 2]); }
        b.pset(4, 11, sl[3]); b.pset(12, 11, sl[3]); b.pset(4, 12, sl[0]); b.pset(12, 12, sl[0]);
      }
      if (v === 2) { b.pset(8, 3, sl[3]); b.pset(8, 4, sl[0]); }
      if (v === 3) {                               // grime weeping down two valleys
        for (yy = 1; yy < 11; yy++) { if (yy < 8) b.pset(5, yy, ru[0]); if (yy > 3) b.pset(10, yy, ru[0]); }
      }
      return b;
    }

    /* ---------- girder lattice (opaque, dark fill) ---------- */
    function lattice(v) {
      var b = tile(), N0 = R.night[0];
      b.clear(N0);
      // diagonals (2px wide), lit edge on top
      for (var k = 0; k < 16; k++) {
        b.pset(k, k, sl[2]); b.pset(k, k + 1, sl[1]);
        if (v === 0) { b.pset(15 - k, k, sl[2]); b.pset(15 - k, k + 1, sl[1]); }
      }
      // frame: beam along the top and the left edge
      b.hline(0, 0, 16, sl[3]); b.hline(0, 1, 16, sl[2]); b.hline(0, 2, 16, sl[0]);
      b.vline(0, 0, 16, sl[3]); b.vline(1, 0, 16, sl[2]); b.vline(2, 3, 13, sl[0]);
      b.pset(1, 1, sl[4]);
      // gusset plate at the crossing
      if (v === 0) { b.rect(6, 7, 4, 4, sl[2]); b.hline(6, 7, 4, sl[3]); b.pset(7, 8, sl[4]); b.pset(8, 9, sl[0]); }
      else { b.pset(5, 1, sl[4]); b.pset(10, 1, sl[4]); b.pset(1, 6, sl[4]); b.pset(1, 11, sl[4]); }
      return b;
    }

    /* ---------- red-oxide girder platform (one-way) ---------- */
    function girder(part) {
      var b = tile();
      for (var xx = 0; xx < 16; xx++) {
        b.pset(xx, 0, ru[6]); b.pset(xx, 1, ru[4]);
        var p = xx & 7;
        // zig-zag web, period 8
        if (p === 0 || p === 7) b.pset(xx, 2, ru[3]);
        if (p === 1 || p === 2 || p === 5 || p === 6) b.pset(xx, 3, ru[3]);
        if (p === 3 || p === 4) b.pset(xx, 4, ru[3]);
        b.pset(xx, 5, ru[3]); b.pset(xx, 6, ru[1]);
      }
      if (part === 0) { b.rect(0, 0, 2, 7, ru[4]); b.vline(0, 0, 7, ru[5]); b.pset(0, 0, ru[6]); b.pset(1, 6, ru[1]); b.pset(0, 6, ru[2]); b.pset(1, 3, ru[6]); }
      if (part === 2) { b.rect(14, 0, 2, 7, ru[3]); b.vline(15, 0, 7, ru[2]); b.pset(14, 0, ru[6]); b.pset(15, 0, ru[5]); b.pset(14, 6, ru[1]); b.pset(15, 6, ru[1]); b.pset(14, 3, ru[5]); }
      return b;
    }

    /* ---------- yellow ladder ---------- */
    function ladder() {
      var b = tile();
      for (var yy = 0; yy < 16; yy++) {
        b.pset(3, yy, go[5]); b.pset(4, yy, go[3]);
        b.pset(11, yy, go[5]); b.pset(12, yy, go[3]);
      }
      for (var k = 0; k < 4; k++) {
        b.hline(5, 1 + k * 4, 6, go[4]); b.hline(5, 2 + k * 4, 6, go[2]);
        b.pset(3, 1 + k * 4, go[6]); b.pset(11, 1 + k * 4, go[6]);
      }
      return b;
    }

    /* ---------- saw-teeth scrap (spikes) ---------- */
    function shard(b, cx, tip, hw, seed) {
      for (var yy = tip; yy < 16; yy++) {
        var t = (yy - tip) / (15 - tip), w = hw * (0.1 + 0.9 * t);
        var xa = round(cx - w), xb = round(cx + w * 0.85);
        var notch = ((yy - tip) % 3) === 2 && yy < 14;
        for (var xx = xa; xx <= xb - (notch ? 1 : 0); xx++) {
          var c = xx < cx ? (xx === xa ? st[7] : st[5]) : (xx === xb ? st[2] : (xx === cx ? st[4] : st[3]));
          if (yy >= 14 && hash2(xx, yy, seed) < 0.55) c = ru[yy === 15 ? 2 : 3];
          b.pset(xx, yy, c);
        }
      }
      b.pset(cx, tip, WHITE);
    }
    function spikes(v) {
      var b = tile();
      if (v === 0) { shard(b, 13, 7, 2.2, 3); shard(b, 3, 5, 2.6, 1); shard(b, 8, 2, 3, 2); }
      else {
        // half-buried circular saw blade
        var cx = 7.5, cy = 17, rr = 10;
        for (var yy = 4; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) {
          var dx = xx - cx, dy = yy - cy, d = sqrt(dx * dx + dy * dy), a = atan2(dy, dx);
          var tooth = ((a / PI * 180 + 360) % 22.5) / 22.5;      // 0..1 across one tooth
          var rim = rr + 3.2 * (1 - tooth);                       // saw profile
          if (d > rim) continue;
          var c = st[4];
          if (d > rr) c = tooth < 0.3 ? st[7] : st[5];
          else if (d > rr - 1.2) c = st[2];
          else if (abs(d - 6.5) < 0.7) c = st[6];
          else if (dx + dy * 0.2 > 2) c = st[3];
          if (yy === 15 && hash2(xx, yy, 9) < 0.5) c = ru[2];
          b.pset(xx, yy, c);
        }
      }
      return b;
    }

    /* ---------- cracked (breakable) floor ---------- */
    function cracked(v) {
      var b = v === 0 ? steelTop(0) : steelPlate(0), xx, yy;
      if (v === 0) {
        // the right-hand slab has dropped by one pixel: broken, misaligned hazard lip
        for (xx = 8; xx < 16; xx++) { for (yy = 5; yy >= 1; yy--) b.pset(xx, yy, b.get(xx, yy - 1)); b.pset(xx, 0, st[1]); b.pset(xx, 1, st[6]); }
        crackLine(b, [[7, 0], [8, 3], [6, 6], [9, 9], [7, 12], [9, 15]], OUTL, st[6]);
        crackLine(b, [[9, 9], [12, 10], [14, 13]], OUTL, st[5]);
        crackLine(b, [[6, 6], [3, 8], [2, 11]], OUTL, st[5]);
        b.pset(7, 1, BLK); b.pset(8, 1, BLK);
      } else {
        crackLine(b, [[8, 0], [7, 4], [9, 7], [6, 11], [8, 15]], OUTL, st[6]);
        crackLine(b, [[9, 7], [13, 6], [15, 8]], OUTL, st[5]);
        crackLine(b, [[7, 4], [3, 5], [0, 3]], OUTL, st[5]);
        crackLine(b, [[6, 11], [3, 13]], OUTL, st[5]);
        crackLine(b, [[9, 7], [12, 11], [13, 14]], OUTL, 0);
      }
      return b;
    }

    /* ---------- steel grate bridge ---------- */
    function grate(v) {
      var b = tile();
      for (var xx = 0; xx < 16; xx++) {
        b.pset(xx, 0, st[6]); b.pset(xx, 1, st[4]);
        if ((xx & 3) < 2) { b.pset(xx, 2, (xx & 3) ? st[3] : st[5]); b.pset(xx, 3, (xx & 3) ? st[2] : st[4]); b.pset(xx, 4, (xx & 3) ? st[2] : st[4]); }
        b.pset(xx, 5, st[3]); b.pset(xx, 6, st[1]);
      }
      if (v === 1) {
        // fracture: zig-zag gap, right half sagging by one pixel
        var sag = bmp(16, 16); sag.blitPart(b, 9, 0, 7, 7, 9, 1, true);
        b.rect(7, 0, 9, 8, 0); b.blit(sag, 0, 0);
        b.pset(7, 0, st[6]); b.pset(7, 1, 0); b.pset(6, 2, 0); b.pset(6, 3, 0); b.pset(7, 3, st[5]); b.pset(7, 4, 0); b.pset(6, 5, 0); b.pset(6, 6, 0);
        b.pset(8, 0, 0); b.pset(8, 1, st[6]); b.pset(8, 2, st[6]); b.pset(9, 1, st[7]);
        b.pset(5, 0, st[7]); b.pset(6, 0, 0); b.pset(6, 1, st[5]);
      }
      return b;
    }

    /* ---------- conveyor belt (4 frames, belt top moves right) ---------- */
    function conveyor(f) {
      var b = tile(), xx, n;
      b.rect(0, 4, 16, 12, st[2]); b.hline(0, 4, 16, st[4]); b.hline(0, 12, 16, st[1]);
      for (xx = 0; xx < 16; xx++) {
        var p = (xx - f * 2) & 7;             // top run -> right
        if (p < 2) { b.pset(xx, 0, p ? go[5] : HOTY); b.pset(xx, 1, go[3]); b.pset(xx, 2, gy[1]); }
        else if (p < 7) { b.pset(xx, 0, p === 2 ? gy[6] : gy[5]); b.pset(xx, 1, gy[3]); b.pset(xx, 2, gy[1]); }
        else { b.pset(xx, 0, gy[1]); b.pset(xx, 1, gy[1]); b.pset(xx, 2, gy[0]); }
        b.pset(xx, 3, OUTL);
        var q = (xx + f * 2) & 7;             // return run -> left
        b.pset(xx, 13, q < 2 ? go[2] : (q === 7 ? gy[0] : gy[2]));
        b.pset(xx, 14, q === 7 ? gy[0] : gy[1]);
        b.pset(xx, 15, OUTL);
      }
      // two rollers with a rotating marker (clockwise)
      var mk = [[0, -2], [2, 0], [0, 2], [-2, 0]], dk = mk[(f + 2) & 3], m = mk[f & 3];
      for (n = 0; n < 2; n++) {
        var cx = 3.5 + n * 8, cy = 8.5;
        b.ellipse(cx, cy, 3.2, 3.2, st[0]);
        b.ellipse(cx, cy, 2.6, 2.6, st[4]);
        b.pset(cx - 1.5, cy - 1.5, st[5]); b.pset(cx - 0.5, cy - 2.5, st[5]); b.pset(cx - 2.5, cy - 0.5, st[5]);
        b.rect(cx - 0.5, cy - 0.5, 2, 2, st[1]);
        b.pset(cx + (m[0] > 0 ? 0.5 : -0.5) + m[0], cy + (m[1] > 0 ? 0.5 : -0.5) + m[1], st[7]);
        b.pset(cx + (dk[0] > 0 ? 0.5 : -0.5) + dk[0], cy + (dk[1] > 0 ? 0.5 : -0.5) + dk[1], st[2]);
      }
      return b;
    }

    /* ====================== PROPS ====================== */

    /* pipes: copper run with a bolted steel coupling */
    var PIPE = [2, 4, 6, 5, 4, 4, 3, 3, 2, 1];              // across the pipe, lit side first
    var FLNG = [3, 5, 7, 6, 5, 5, 4, 4, 4, 3, 2, 1];
    function pipeH() {
      var b = bmp(16, 16), xx, k;
      for (xx = 0; xx < 16; xx++) for (k = 0; k < 10; k++) b.pset(xx, 3 + k, ru[PIPE[k]]);
      for (k = 0; k < 12; k++) { b.pset(6, 2 + k, st[min(7, FLNG[k] + 1)]); b.pset(7, 2 + k, st[FLNG[k]]); b.pset(8, 2 + k, st[FLNG[k]]); b.pset(9, 2 + k, st[max(0, FLNG[k] - 2)]); }
      b.pset(10, 4, ru[2]); b.pset(10, 5, ru[4]); b.pset(10, 6, ru[3]); b.vline(10, 7, 5, ru[2]);     // contact shadow
      b.pset(2, 8, ru[5]); b.pset(13, 9, ru[2]);
      return b;
    }
    function pipeV() {
      var b = bmp(16, 16), yy, k;
      for (yy = 0; yy < 16; yy++) for (k = 0; k < 10; k++) b.pset(3 + k, yy, ru[PIPE[k]]);
      for (k = 0; k < 12; k++) { b.pset(2 + k, 6, st[min(7, FLNG[k] + 1)]); b.pset(2 + k, 7, st[FLNG[k]]); b.pset(2 + k, 8, st[FLNG[k]]); b.pset(2 + k, 9, st[max(0, FLNG[k] - 2)]); }
      b.pset(4, 10, ru[2]); b.pset(5, 10, ru[4]); b.pset(6, 10, ru[3]); b.hline(7, 10, 5, ru[2]);
      b.pset(8, 2, ru[5]); b.pset(9, 13, ru[2]);
      return b;
    }

    /* spinning gear: everything has 8-fold symmetry so a half-pitch step reads as rotation */
    function gear(phase) {
      var b = bmp(32, 32), cx = 15.5, cy = 15.5, N = 8, pitch = 2 * PI / N, xx, yy;
      for (yy = 0; yy < 32; yy++) for (xx = 0; xx < 32; xx++) {
        var dx = xx - cx, dy = yy - cy, d = sqrt(dx * dx + dy * dy);
        var a = atan2(dy, dx) + phase, ta = a / pitch; ta -= floor(ta);          // 0..1 across one tooth pitch
        var off = abs(ta - 0.5);                                                // 0 = tooth centre
        var rOut = 11.2;
        if (off < 0.27 - (d - 11.2) * 0.022) rOut = 14.4;                        // tapered tooth
        if (d > rOut) continue;
        var lit = -(dx + dy) / (d + 0.001) * 0.7071;                             // +1 = facing the light (upper-left)
        var side = lit > 0.3 ? 1 : (lit < -0.3 ? -1 : 0), v;
        if (d < 1.7) { b.pset(xx, yy, OUTL); continue; }                        // axle hole
        if (d < 2.7) v = 3 - side;                                               // axle collar (inner wall)
        else if (d < 4.6) v = 5 + side;                                          // hub boss
        else if (d < 5.5) v = 2;                                                 // groove round the hub
        else if (d < 8.6) {                                                      // recessed web with 8 lightening holes
          var ha = (a + pitch / 2) / pitch; ha -= floor(ha);
          var hx = (ha - 0.5) * pitch * d, hd = sqrt(hx * hx + (d - 7) * (d - 7));
          if (hd < 1.25) { b.pset(xx, yy, OUTL); continue; }
          v = side > 0 ? 2 : 3;
        } else if (d < 9.6) v = 5 + side;                                        // raised rim
        else v = side < 0 ? 3 : 4;                                               // tooth ring face
        if (d > rOut - 1.2) v = side > 0 ? 6 : (side < 0 ? 2 : v);               // outer bevel
        b.pset(xx, yy, st[v]);
      }
      b.outline(OUTL);
      return b;
    }

    function signCrush() {
      return art(LG('gold', { k: 'outline', K: 'black', T: 'steel5', r: 'red4', G: 'green5', p: 'skin6', B: 'blue4' }), [
        '.kkkkkkkkkkkkkk.',
        'k66666666666666k',
        'k644444KK444443k',
        'k644444KK444443k',
        'k64KKKKKKKKKK43k',
        'k64KTKKKKKKKK43k',
        'k64KKKKKKKKKK43k',
        'k644r444444r443k',
        'k6444r4444r4443k',
        'k644444GG444443k',
        'k64444GppG44443k',
        'k6444B4BB4B4443k',
        'k644444BB444443k',
        'k64KKKKKKKKKK43k',
        'k43333333333332k',
        '.kkkkkkkkkkkkkk.'
      ], 'sign_crush');
    }

    function furnace() {
      var b = bmp(48, 40), xx, yy, k;
      var cx = 23.5, cy = 25;
      // chimney stub
      for (yy = 0; yy < 6; yy++) for (xx = 19; xx <= 28; xx++) b.pset(xx, yy, sc(st, cyl((xx - 19) / 9, 1.2, 4.4), xx, yy));
      b.hline(18, 0, 12, st[5]); b.hline(18, 1, 12, st[2]); b.pset(18, 1, st[3]); b.pset(29, 0, st[3]);
      // hood
      for (yy = 6; yy <= 10; yy++) {
        var e = (yy - 5) * 3;
        for (xx = 18 - e; xx <= 29 + e; xx++) {
          var t = (xx - (18 - e)) / (11 + 2 * e);
          b.pset(xx, yy, st[xx - (18 - e) < 3 ? 5 : (t < 0.45 ? 3 : (t < 0.8 ? 2 : 1))]);
        }
      }
      // body plates
      for (yy = 11; yy <= 35; yy++) for (xx = 3; xx <= 44; xx++) {
        var bv = xx < 9 ? 3 : (xx === 9 ? 2.5 : 2);
        b.pset(xx, yy, sc(st, bv, xx, yy));
      }
      b.vline(3, 11, 25, st[4]); b.vline(44, 11, 25, st[0]); b.vline(43, 16, 20, st[1]);
      for (xx = 3; xx <= 44; xx++) hazardRow(b, xx, 11);                                      // hazard band under the hood
      b.hline(4, 10, 40, st[1]); b.hline(3, 15, 42, st[0]); b.hline(4, 16, 40, st[4]);
      for (k = 0; k < 4; k++) { rivet(b, 5, 19 + k * 4, st, 6, 4, 1); rivet(b, 40, 22 + k * 4, st, 4, 3, 0); }
      // brick arch + jambs around the mouth
      for (yy = 11; yy <= 35; yy++) for (xx = 8; xx <= 39; xx++) {
        var dx = xx - cx, dy = yy - cy, d = sqrt(dx * dx + dy * dy);
        var inArch = yy <= cy ? (d >= 10 && d < 14) : (abs(dx) >= 10 && abs(dx) < 14);
        if (!inArch) continue;
        var seg, joint, edgeIn, edgeOut;
        if (yy <= cy) {
          var ang = atan2(-dy, dx) / PI * 180;                 // 0..180
          seg = floor(ang / 18); joint = (ang - seg * 18) < 3.2;
          edgeIn = d < 11; edgeOut = d >= 13;
        } else {
          seg = floor((yy - cy) / 4) + 20; joint = ((yy - floor(cy)) % 4) === 0;
          edgeIn = abs(dx) < 11; edgeOut = abs(dx) >= 13;
        }
        var c = ru[(seg & 1) ? 3 : 2];
        if (joint) c = ru[0];
        else if (edgeIn) c = em[3];                             // fire-lit inner edge
        else if (edgeOut) c = dx + dy < 0 ? ru[5] : ru[1];
        b.pset(xx, yy, c);
      }
      // mouth: hot darkness, rising flame tongues (colour-cycled GLOW), white-hot coals
      var TG = [[14.5, 4, 2.5], [17, 7, 3], [20, 10, 3.2], [23.5, 16, 4.2], [27, 12, 3.6], [30, 8, 3], [32.5, 5, 2.6]];
      for (yy = 14; yy <= 33; yy++) for (xx = 14; xx <= 33; xx++) {
        var ddx = xx - cx, ddy = yy - cy;
        if (yy <= cy && ddx * ddx + ddy * ddy >= 100) continue;
        var h = 2.5, cc;
        for (k = 0; k < TG.length; k++) h = max(h, TG[k][1] * (1 - abs(xx - TG[k][0]) / TG[k][2]));
        var top = 33.5 - h;
        if (yy < top) cc = em[yy < 21 ? 0 : (yy === 21 ? ((xx + yy) & 1) : 1)];
        else {
          var band = min(3, floor((yy - top) / h * 5));
          cc = gl[(7 - band) & 7];                              // tip red ... base brightest; GLOW cycling runs up the tongue
          if (yy >= 32) cc = ((xx + yy) & 1) ? HOTY : em[6];
        }
        b.pset(xx, yy, cc);
      }
      // sparks above the flames
      b.pset(18, 22, gl[5]); b.pset(28, 18, gl[6]); b.pset(21, 17, gl[4]); b.pset(30, 23, gl[7]); b.pset(16, 26, gl[6]); b.pset(25, 15, gl[5]);
      // fire grate + sill
      for (xx = 14; xx <= 33; xx++) { b.pset(xx, 34, st[1]); b.pset(xx, 35, st[0]); }
      for (k = 0; k < 6; k++) { b.vline(15 + k * 3 + (k > 2 ? 1 : 0), 29, 5, OUTL); b.pset(15 + k * 3 + (k > 2 ? 1 : 0), 28, st[1]); }
      b.hline(14, 34, 20, em[4]);
      // gauge
      b.ellipse(40.5, 20.5, 2.6, 2.6, OUTL); b.ellipse(40.5, 20.5, 1.6, 1.6, bo[6]); b.pset(41, 20, col('red4')); b.pset(40, 21, OUTL);
      // plinth
      for (xx = 1; xx <= 46; xx++) { b.pset(xx, 36, st[5]); b.pset(xx, 37, st[3]); b.pset(xx, 38, st[2]); b.pset(xx, 39, st[1]); }
      b.hline(14, 36, 20, col('orange5'));
      b.pset(1, 36, st[6]); b.vline(46, 36, 4, st[1]);
      rivet(b, 4, 37, st, 6, 4, 1); rivet(b, 42, 37, st, 5, 3, 1);
      b.outline(OUTL);
      return b;
    }

    function lamp(f) {
      var L = LG('red', { k: 'outline', w: 'white', o: 'hotorange', d: 'steel1', S: 'steel4', T: 'steel6', z: 'steel3' });
      return art(L, f === 0 ? [
        '........',
        '..kkkk..',
        '.k2322k.',
        '.k3221k.',
        '.k2211k.',
        '.k2111k.',
        '.kkkkkk.',
        '.dSSSSd.',
        'dSTSSSzd',
        'kkkkkkkk'
      ] : [
        '...o....',
        'o.kkkk.o',
        '.k5w54k.',
        '.kw544k.',
        'ok5443ko',
        '.k4433k.',
        '.kkkkkk.',
        '.dSSSSd.',
        'dSTSSSzd',
        'kkkkkkkk'
      ], 'lamp' + f);
    }

    /* Lemmings exit: stone archway with twin torches */
    var FLAME = [[
      '..3..',
      '..4..',
      '.35..',
      '.464.',
      '35753',
      '46764',
      '35653',
      '.343.'
    ], [
      '.3...',
      '.4...',
      '.53..',
      '.4643',
      '.5753',
      '36764',
      '35653',
      '.343.'
    ]];
    function exitDoor(f) {
      var b = bmp(32, 32), xx, yy, k;
      var cx = 15.5, cy = 14;
      // interior darkness with a faint stair
      for (yy = 6; yy <= 26; yy++) for (xx = 10; xx <= 21; xx++) b.pset(xx, yy, yy > 20 ? sh(R.indigo, (yy - 20) / 6 * 1.4, xx, yy) : BLK);
      b.hline(12, 23, 8, R.indigo[2]); b.hline(11, 25, 10, R.indigo[3]);
      // arch ring + pillars (sandstone blocks)
      for (yy = 2; yy <= 26; yy++) for (xx = 4; xx <= 27; xx++) {
        var dx = xx - cx, dy = yy - cy, d = sqrt(dx * dx + dy * dy), c = 0;
        if (yy <= cy) {
          if (d >= 5.6 && d < 10.6) {
            var ang = atan2(-dy, dx) / PI * 180, seg = floor((ang + 15) / 30);
            c = sd[(seg & 1) ? 4 : 3];
            if (abs(ang - 90) < 15) c = sd[5];                                   // keystone
            if (((ang + 15) % 30) < 4.5 && d > 6.4) c = sd[1];
            if (d >= 9.6) c = dx + dy < -2 ? sd[6] : sd[2];
            if (d < 6.5) c = sd[1];
          }
        } else if (abs(dx) >= 5.6 && abs(dx) < 10.6) {
          c = sd[dx < 0 ? 4 : 3];
          if ((yy - 15) % 4 === 3) c = sd[1];
          else if (abs(dx) >= 9.6) c = dx < 0 ? sd[6] : sd[2];
          else if (abs(dx) < 6.5) c = sd[dx < 0 ? 2 : 1];
        }
        if (c) b.pset(xx, yy, c);
      }
      // steps
      for (xx = 4; xx <= 27; xx++) { b.pset(xx, 27, sd[6]); b.pset(xx, 28, sd[3]); }
      for (xx = 1; xx <= 30; xx++) { b.pset(xx, 29, sd[5]); b.pset(xx, 30, sd[3]); b.pset(xx, 31, sd[2]); }
      b.pset(4, 28, sd[4]); b.pset(27, 28, sd[1]); b.pset(1, 30, sd[4]); b.pset(30, 30, sd[1]); b.pset(30, 31, sd[1]);
      for (k = 0; k < 3; k++) { b.pset(8 + k * 7, 30, sd[1]); b.pset(8 + k * 7, 31, sd[1]); }
      // torch poles + cups
      for (k = 0; k < 2; k++) {
        var px = k ? 28 : 3;
        b.vline(px, 12, 17, br[4]); b.vline(px + 1, 12, 17, br[2]);
        b.hline(px - 1, 10, 4, go[5]); b.hline(px - 1, 11, 4, go[3]); b.pset(px + 2, 11, go[2]); b.pset(px - 1, 10, go[6]);
        var fl = art(LG('ember'), FLAME[(f + k) & 1], 'exit_flame');
        b.blit(fl, px - 2 + (k ? 1 : 0), 1, k === 1);
      }
      b.outline(OUTL);
      return b;
    }

    /* Lemmings entrance: wooden trapdoor box, both flaps hanging open */
    function hatch() {
      var b = bmp(40, 16), xx, yy, k;
      var ROW = [4, 5, 4, 3, 1, 4, 3, 3, 1];
      for (yy = 0; yy < 9; yy++) for (xx = 2; xx <= 37; xx++) b.pset(xx, yy, br[ROW[yy]]);
      for (k = 0; k < 6; k++) { b.pset(9 + k * 5, 2, br[2]); b.pset(11 + k * 5, 6, br[2]); b.pset(12 + k * 5, 1, br[5]); }   // wood grain
      // dark opening underneath
      b.rect(8, 6, 24, 3, BLK); b.hline(8, 5, 24, br[1]);
      // steel straps
      for (k = 0; k < 2; k++) {
        var sx = k ? 33 : 4;
        for (yy = 0; yy < 9; yy++) { b.pset(sx, yy, st[5]); b.pset(sx + 1, yy, st[4]); b.pset(sx + 2, yy, st[2]); }
        rivet(b, sx, 1, st, 7, 5, 2); rivet(b, sx, 6, st, 7, 5, 2);
      }
      b.hline(2, 0, 36, br[5]); b.hline(4, 0, 3, st[6]); b.hline(33, 0, 3, st[6]);
      // open flaps: two door leaves hanging from their hinges, slightly splayed
      for (k = 0; k < 7; k++) {
        var o = k > 3 ? 1 : 0;
        b.pset(5 - o, 9 + k, br[5]); b.pset(6 - o, 9 + k, br[4]); b.pset(7 - o, 9 + k, br[3]); b.pset(8 - o, 9 + k, br[1]);
        b.pset(31 + o, 9 + k, br[5]); b.pset(32 + o, 9 + k, br[4]); b.pset(33 + o, 9 + k, br[3]); b.pset(34 + o, 9 + k, br[1]);
      }
      b.hline(5, 11, 4, st[4]); b.hline(31, 11, 4, st[4]); b.pset(5, 11, st[6]); b.pset(31, 11, st[6]);    // iron bands
      b.hline(4, 15, 4, st[3]); b.hline(32, 15, 4, st[3]); b.pset(4, 15, st[5]); b.pset(32, 15, st[5]);
      b.pset(8, 8, st[6]); b.pset(31, 8, st[6]);                                                            // hinge pins
      // a little darkness spilling from the opening
      for (xx = 10; xx <= 29; xx++) if ((xx & 1) === 0) b.pset(xx, 9, BLK);
      b.outline(OUTL);
      return b;
    }

    /* pressure tank with a molten-metal sight glass */
    function tank() {
      var b = bmp(24, 32), xx, yy, k;
      // feed pipe
      for (yy = 0; yy < 4; yy++) for (k = 0; k < 4; k++) b.pset(10 + k, yy, ru[[5, 4, 3, 2][k]]);
      // shell
      for (yy = 3; yy <= 27; yy++) for (xx = 2; xx <= 21; xx++) {
        var dy = yy < 8 ? (8 - yy) / 5.2 : (yy > 24 ? (yy - 24) / 3.6 : 0);
        var hw = 9.6 * sqrt(max(0, 1 - dy * dy));
        if (abs(xx - 11.5) > hw) continue;
        var t = (xx - (11.5 - hw)) / (2 * hw);
        b.pset(xx, yy, sc(zo, cyl(t, 1.4, 5.2) - (yy < 6 ? 0 : 0) , xx, yy));
      }
      // hoops with rivets
      for (k = 0; k < 2; k++) {
        var hy = k ? 23 : 9;
        for (xx = 2; xx <= 21; xx++) if (b.get(xx, hy)) { b.pset(xx, hy, zo[xx < 9 ? 6 : (xx < 16 ? 4 : 2)]); b.pset(xx, hy + 1, zo[xx < 16 ? 2 : 1]); }
        b.pset(5, hy, WHITE); b.pset(10, hy, zo[6]); b.pset(15, hy, zo[5]); b.pset(19, hy, zo[3]);
      }
      // dial gauge
      b.ellipse(8, 15.5, 2.7, 2.7, OUTL); b.ellipse(8, 15.5, 1.7, 1.7, bo[6]); b.pset(8, 15, col('red4')); b.pset(9, 14, col('red4')); b.pset(7, 17, bo[4]);
      // molten-metal sight glass (LIQ colours are palette-cycled)
      b.rect(14, 12, 4, 9, OUTL);
      for (yy = 0; yy < 7; yy++) { b.pset(15, 13 + yy, yy < 2 ? zo[1] : lq[(yy + 2) & 7]); b.pset(16, 13 + yy, yy < 2 ? zo[0] : lq[(yy + 3) & 7]); }
      b.pset(15, 13, zo[3]);
      // legs
      for (k = 0; k < 2; k++) {
        var lx = k ? 17 : 4;
        b.vline(lx, 27, 5, st[4]); b.vline(lx + 1, 27, 5, st[3]); b.vline(lx + 2, 27, 5, st[1]);
      }
      b.hline(7, 29, 10, st[2]); b.hline(7, 30, 10, st[0]);
      b.hline(3, 31, 5, st[2]); b.hline(16, 31, 5, st[2]);
      b.outline(OUTL);
      return b;
    }

    var t = emptySet();
    for (i = 0; i < 4; i++) {
      t.solid.push(steelPlate(i)); t.solidTop.push(steelTop(i));
      t.alt.push(dirt(i)); t.altTop.push(dirtTop(i));
      t.back.push(backPanel(i)); t.conveyor.push(conveyor(i));
    }
    t.backAlt = [lattice(0), lattice(1)];
    t.platform = [girder(0), girder(1), girder(2)];
    t.ladder = [ladder()];
    t.spikes = [spikes(0), spikes(1)];
    t.cracked = [cracked(0), cracked(1)];
    t.bridge = [grate(0), grate(1)];
    t.props = {
      pipe_h: pipeH(), pipe_v: pipeV(),
      gear: frames(gear(0), gear(PI / 8)),
      sign_crush: signCrush(),
      furnace: furnace(),
      chain: chainProp(16, 'steel'),
      lamp: frames(lamp(0), lamp(1)),
      exit: frames(exitDoor(0), exitDoor(1)),
      hatch: hatch(),
      tank: tank()
    };
    return t;
  }

  GNG.Tiles.register(3, buildFoundry);

  /* ====================================================================== *
   *  TOOLKIT II (stages 5-6)
   * ====================================================================== */

  /** Paste ASCII art onto b with its top-left corner at (x, y). */
  function put(b, legend, rows, x, y, flip) { b.blit(art(legend, rows), x, y, !!flip); }

  /** Tiny 3x5 stencil capitals (just the letters the props need). */
  var GLYPH = {
    U: '101101101101111', A: '010101111101101', C: '111100100100111', E: '111100110100111',
    X: '101101010101101', I: '111010010010111', T: '111010010010010'
  };
  function tiny(b, str, x, y, c) {
    for (var n = 0; n < str.length; n++) {
      var g = GLYPH[str.charAt(n)];
      if (g) for (var k = 0; k < 15; k++) if (g.charAt(k) === '1') b.pset(x + n * 4 + (k % 3), y + floor(k / 3), c);
    }
  }

  /** Height field like organic(), with the y axis compressed `sy` times (sy = 2 -> flat strata). */
  function strata(x, y, seed, shared, sy) {
    var xx = x & 15, yy = (y & 15) * sy;
    if (x < 0 || y < 0 || x > 15 || y > 15) return wfbm(xx, yy, shared);
    var d = min(x, 15 - x, y, 15 - y), a = wfbm(xx, yy, seed);
    return d >= 3 ? a : a + (wfbm(xx, yy, shared) - a) * (3 - d) / 3;
  }

  /**
   * Chunky lit rock: the height field is quantised into 4 levels drawn with ramp[1..4]; edges that
   * face the upper-left get a lit rim (one shade up), the opposite edges a cast shadow (one down).
   * `ramp` is any list of >= 6 colour indices, dark to light. Variants sharing `shared` tile seamlessly.
   */
  function rockFill(b, seed, shared, ramp, lv, sy, grit) {
    function L(x, y) { var h = strata(x, y, seed, shared, sy); return h < lv[0] ? 0 : (h < lv[1] ? 1 : (h < lv[2] ? 2 : 3)); }
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var t = L(x, y), ul = L(x - 1, y - 1), c = t + 1;
      if (t > ul) c = t + 2;
      else if (t < ul) c = t;
      else if (grit) {
        var g = hash2(x, y, seed + 5), e = min(x, 15 - x, y, 15 - y);
        if (e > 0 && g < grit) c = t;
        else if (e > 0 && g > 1 - grit * 0.4 && t > 0) c = t + 2;
      }
      b.pset(x, y, ramp[c]);
    }
  }

  /** Generic 4-frame conveyor (belt top moves right) in the stage's own metals. */
  function beltTile(f, body, belt, cleat) {
    var b = tile(), OUTL = col('outline'), x, n;
    b.rect(0, 4, 16, 12, body[2]); b.hline(0, 4, 16, body[4]); b.hline(0, 12, 16, body[1]);
    for (x = 0; x < 16; x++) {
      var p = (x - f * 2) & 7, q = (x + f * 2) & 7;
      b.pset(x, 0, p < 2 ? cleat[5] : (p === 7 ? belt[1] : belt[5]));
      b.pset(x, 1, p < 2 ? cleat[3] : (p === 7 ? belt[1] : belt[3]));
      b.pset(x, 2, belt[p === 7 ? 0 : 1]);
      b.pset(x, 3, OUTL);
      b.pset(x, 13, q < 2 ? cleat[2] : belt[q === 7 ? 0 : 2]);
      b.pset(x, 14, belt[q === 7 ? 0 : 1]);
      b.pset(x, 15, OUTL);
    }
    for (n = 0; n < 2; n++) {
      var cx = 3.5 + n * 8, cy = 8.5, a = f * PI / 2 + n;
      b.ellipse(cx, cy, 3.2, 3.2, body[0]);
      b.ellipse(cx, cy, 2.6, 2.6, body[4]);
      b.pset(cx - 1.5, cy - 1.5, body[6]);
      b.rect(cx - 0.5, cy - 0.5, 2, 2, body[1]);
      b.pset(round(cx - 0.5 + cos(a) * 2), round(cy - 0.5 + sin(a) * 2), body[7]);
    }
    return b;
  }

  /** Small flame, wick at (x, y): 3 frames lean left / straight / right. hot, mid, tip = colour indices. */
  function flame(b, x, y, f, hot, mid, tip, big) {
    var lean = (f % 3) - 1;
    b.pset(x, y, hot); b.pset(x, y - 1, hot);
    b.pset(x, y - 2, mid);
    b.pset(x + lean, y - 3, tip);
    if (big) {
      b.pset(x - 1, y, mid); b.pset(x + 1, y, mid); b.pset(x - 1, y - 1, lean < 0 ? mid : tip); b.pset(x + 1, y - 1, lean > 0 ? mid : tip);
      b.pset(x, y - 3, mid); b.pset(x + lean, y - 4, tip);
      if (f % 3 === 1) b.pset(x, y - 5, tip);
    }
  }

  var SKULL_F = [          // 7x7 skull, front view
    '.66766.',
    '6777765',
    '6777665',
    '6kk6kk5',
    '566k554',
    '.55554.',
    '.4k4k3.'
  ];
  var SKULL_Q = [          // 7x7 skull, three-quarter view (looks right)
    '..6666.',
    '.677776',
    '6777776',
    '67kk6k5',
    '5666k54',
    '.555545',
    '..4k4k.'
  ];

  /* ====================================================================== *
   *  STAGE 5 — PHOBOS E1M1 NECROPOLIS
   * ====================================================================== */

  function buildPhobos() {
    var tn = R.tan, gy = R.gray, st = R.steel, mi = R.mist, ru = R.rust, ma = R.maroon, bo = R.bone, go = R.gold,
      rd = R.red, gl = R.glow, du = R.dusk, br = R.brown, tx = R.toxic, gr = R.green, tl = R.teal;
    var OUTL = col('outline'), BLK = col('black'), HOTY = col('hotyellow'), WHITE = col('white'), HOTR = col('hotred'), HOTG = col('hotgreen');
    var ROCK = [ma[0], ma[1], ma[2], ru[2], ru[3], ru[4], ru[5], ru[6]];
    var DROCK = [du[0], ma[0], ma[0], ma[1], ma[1], ma[2], ma[2], ma[3]];
    var LBONE = LG('bone', { k: 'maroon0' });
    var LDIM = GNG.makeLegend({ '7': 'bone4', '6': 'bone3', '5': 'rust5', '4': 'rust3', '3': 'maroon2', k: 'maroon0' });
    var i;

    /* ---------- UAC wall plating ("STARTAN"): tan panels between gray trim strips ---------- */
    var PROW = [5, 4, 3.5, 3.5, 3, 3, 3, 3, 3, 3, 2.5, 2.5, 2, 1];
    function panel(b, y0) {
      var x, y;
      for (y = y0; y < 14; y++) for (x = 0; x < 16; x++) b.pset(x, y, sc(tn, y === y0 ? 5 : PROW[y], x, y));
      for (y = y0; y < 14; y++) { b.pset(0, y, tn[y === 13 ? 2 : 5]); b.pset(15, y, tn[1]); b.pset(14, y, tn[y === y0 ? 4 : 2]); }
      for (x = 0; x < 16; x++) { b.pset(x, 14, gy[4]); b.pset(x, 15, gy[1]); }
      b.pset(2, 14, gy[6]); b.pset(3, 15, gy[0]); b.pset(10, 14, gy[6]); b.pset(11, 15, gy[0]);
    }
    function wallDetail(b, v, top) {
      var x, y, y0 = top ? 7 : 3;
      if (v === 0) {                               // recessed inner plate
        b.hline(3, y0, 10, tn[1]); b.vline(3, y0, 12 - y0, tn[1]);
        b.hline(4, 11, 9, tn[5]); b.vline(12, y0 + 1, 11 - y0, tn[5]);
        for (y = y0 + 1; y < 11; y++) for (x = 4; x < 12; x++) b.pset(x, y, sc(tn, y === y0 + 1 ? 2 : 2.5, x, y));
      } else if (v === 1) {                        // two narrow panels
        b.vline(7, top ? 6 : 1, top ? 7 : 12, tn[1]); b.vline(8, top ? 6 : 1, top ? 7 : 12, tn[5]);
        rivet(b, 3, y0, tn, 6, 4, 1); rivet(b, 11, y0, tn, 6, 4, 1); rivet(b, 3, 10, tn, 6, 4, 1); rivet(b, 11, 10, tn, 6, 4, 1);
      } else if (v === 2) {                        // bolted plate with a scuff
        rivet(b, 2, y0, tn, 6, 4, 1); rivet(b, 12, y0, tn, 6, 4, 1); rivet(b, 2, 10, tn, 6, 4, 1); rivet(b, 12, 10, tn, 6, 4, 1);
        b.line(6, 10, 9, 7, tn[4]); b.line(8, 10, 10, 8, tn[4]);
      } else if (v === 3) {                        // grime weeping from the trim strip above
        b.vline(5, top ? 6 : 1, top ? 3 : 5, tn[2]); b.vline(6, top ? 6 : 1, top ? 5 : 8, tn[1]); b.vline(11, top ? 6 : 1, 3, tn[2]);
        b.pset(6, top ? 11 : 9, tn[2]);
      } else if (v === 4) {                        // vent grille
        b.rect(3, y0, 10, 12 - y0, tn[1]);
        for (y = y0 + 1; y < 11; y += 2) { b.hline(4, y, 8, gy[0]); b.hline(4, y + 1, 8, tn[4]); }
        b.hline(3, 11, 10, tn[5]); b.vline(12, y0, 12 - y0, tn[4]);
      } else if (v === 5) {                        // fluorescent strip light
        y = top ? 8 : 6;
        b.rect(2, y - 1, 12, 5, gy[1]); b.hline(2, y + 3, 12, tn[5]);
        b.hline(3, y, 10, mi[6]); b.hline(3, y + 1, 10, WHITE); b.hline(3, y + 2, 10, mi[5]);
        b.pset(3, y, tl[4]); b.pset(12, y, tl[4]); b.pset(3, y + 2, tl[3]); b.pset(12, y + 2, tl[3]); b.pset(3, y + 1, mi[6]); b.pset(12, y + 1, mi[6]);
      }
    }
    function techWall(v) { var b = tile(); panel(b, 0); wallDetail(b, v, false); return b; }

    /* ---------- steel deck edge on top of the plating ---------- */
    function techTop(v) {
      var b = tile(), x;
      panel(b, 5);
      wallDetail(b, v, true);
      for (x = 0; x < 16; x++) {
        b.pset(x, 0, st[(x & 3) === 1 ? 7 : 6]);
        b.pset(x, 1, st[5]);
        b.pset(x, 2, st[((x + 1) & 3) < 2 ? 4 : 3]);
        b.pset(x, 3, st[2]);
        b.pset(x, 4, gy[0]);
      }
      return b;
    }

    /* ---------- red Phobos rock, full of the necropolis' dead ---------- */
    var RSH = 1500, RLV = [0.36, 0.5, 0.64];
    function rockBits(b, v, minY) {
      if (v === 0) { b.pset(9, 10, ma[0]); b.pset(10, 10, ma[0]); b.pset(10, 11, ROCK[5]); }
      if (v === 1) put(b, LDIM, ['56.....', '.666...', '..5665.', '....566', '.....5.'], 4, minY ? 9 : 6);          // femur
      if (v === 2 && !minY) { put(b, LDIM, SKULL_Q.slice(0, 5), 6, 8); b.hline(7, 13, 6, ma[0]); }                            // half-buried skull
      if (v === 2 && minY) { b.pset(5, 11, bo[3]); b.pset(6, 11, bo[2]); b.pset(6, 12, ma[0]); }
      if (v === 3) { b.pset(4, 12, bo[3]); b.pset(5, 12, ma[0]); b.pset(11, 9, ROCK[5]); b.pset(12, 10, ma[0]); }
      if (v === 5) put(b, LDIM, SKULL_F, 5, 5);
    }
    function rock(v) {
      var b = tile();
      rockFill(b, [1510, 1517, 1529, 1533, 1543, 1549, 1561, 1571, 1583, 1597][v], RSH, ROCK, RLV, 2, 0.06);
      rockBits(b, v, 0);
      return b;
    }
    function rockTop(v) {
      var b = tile(), x, y;
      rockFill(b, [1550, 1557, 1564, 1571][v], RSH, ROCK, RLV, 2, 0.06);
      rockBits(b, v, 8);
      for (x = 0; x < 16; x++) {
        var e = min(x, 15 - x), row = e < 2 ? 0 : v + 1;
        var d = 2 + floor(hash2(x >> 1, row, 91) * 3);
        b.pset(x, 0, ROCK[hash2(x, row, 92) < 0.35 ? 7 : 6]);
        for (y = 1; y < d; y++) b.pset(x, y, ROCK[y === 1 ? 5 : 4]);
        b.pset(x, d, ROCK[1]);
      }
      return b;
    }

    /* ---------- dark corridor plating (running bond, 16x8 plates) ---------- */
    function techBack(v) {
      var b = tile(), x, y;
      b.clear(gy[1]);
      for (x = 0; x < 16; x++) { b.pset(x, 0, gy[2]); b.pset(x, 7, gy[0]); b.pset(x, 8, gy[2]); b.pset(x, 15, gy[0]); }
      for (y = 0; y < 7; y++) { b.pset(15, y, gy[0]); if (y) b.pset(0, y, gy[2]); }
      for (y = 8; y < 15; y++) { b.pset(7, y, gy[0]); if (y > 8) b.pset(8, y, gy[2]); }
      if (v === 1) { b.pset(2, 2, gy[2]); b.pset(13, 2, gy[2]); b.pset(2, 5, gy[2]); b.pset(13, 5, gy[2]); b.pset(10, 10, gy[2]); b.pset(10, 13, gy[2]); }
      if (v === 2) { for (y = 2; y < 6; y += 2) b.hline(4, y, 8, gy[0]); b.hline(4, 6, 8, gy[2]); }                      // vent
      if (v === 3) { b.rect(10, 10, 4, 3, gy[0]); b.pset(11, 11, tx[3]); b.pset(12, 11, rd[3]); b.hline(1, 11, 4, tn[1]); }   // status LEDs + label
      if (v === 4) { for (y = 9; y < 15; y++) for (x = 9; x < 15; x++) b.pset(x, y, ((x + y) & 3) < 2 ? tn[1] : gy[0]); }      // faded hazard plate
      return b;
    }
    /* ---------- dark crypt rock ---------- */
    function cryptBack(v) {
      var b = tile();
      rockFill(b, [1610, 1617, 1623, 1631, 1637, 1643][v], 1600, DROCK, [0.34, 0.5, 0.68], 2, 0);
      if (v === 3) put(b, GNG.makeLegend({ '7': 'maroon3', '6': 'maroon2', '5': 'maroon2', '4': 'maroon1', '3': 'maroon1', k: 'dusk0' }), SKULL_F, 4, 4);
      return b;
    }

    /* ---------- catwalk (one-way) ---------- */
    function catwalk(part) {
      var b = tile(), x, y;
      for (x = 0; x < 16; x++) {
        b.pset(x, 0, mi[(x & 3) === 2 ? 7 : 6]); b.pset(x, 1, mi[5]); b.pset(x, 2, mi[3]); b.pset(x, 3, OUTL);
        var p = x & 7;                               // X-braced truss, period 8
        b.pset(x, 4 + (p < 4 ? p : 7 - p), mi[4]);
        b.pset(x, 7 - (p < 4 ? p : 7 - p), mi[3]);
        b.pset(x, 8, mi[4]); b.pset(x, 9, mi[1]);
      }
      if (part !== 1) {
        var x0 = part === 0 ? 0 : 13;
        for (y = 0; y < 10; y++) for (x = 0; x < 3; x++) b.pset(x0 + x, y, ((x + y) & 3) < 2 ? (x === 0 ? HOTY : go[4]) : gy[x === 0 ? 2 : 1]);
        b.hline(x0, 0, 3, part === 0 ? mi[7] : mi[6]); b.hline(x0, 9, 3, mi[1]);
      }
      return b;
    }

    function ladder() {
      var b = tile(), y, k;
      for (y = 0; y < 16; y++) { b.pset(3, y, mi[6]); b.pset(4, y, mi[3]); b.pset(11, y, mi[6]); b.pset(12, y, mi[3]); }
      for (k = 0; k < 4; k++) {
        b.hline(5, 1 + k * 4, 6, mi[5]); b.hline(5, 2 + k * 4, 6, mi[2]);
        b.pset(3, 1 + k * 4, WHITE); b.pset(11, 1 + k * 4, WHITE); b.pset(4, 2 + k * 4, mi[1]); b.pset(12, 2 + k * 4, mi[1]);
      }
      return b;
    }

    /* ---------- rebar / sharpened bone (spikes) ---------- */
    function rebar(b, x, tip, lean) {
      for (var y = tip; y < 16; y++) {
        var xx = x + round(lean * (15 - y) / (15 - tip));
        b.pset(xx, y, ((y - tip) % 3) === 2 ? st[4] : st[6]);
        b.pset(xx + 1, y, ((y - tip) % 3) === 2 ? ru[2] : ru[4]);
      }
      b.pset(x + lean, tip, WHITE);
    }
    function spikes(v) {
      var b = tile();
      if (v === 0) {
        rebar(b, 2, 7, 0); rebar(b, 6, 5, 1); rebar(b, 10, 8, -1); rebar(b, 13, 6, 0);
        put(b, LG('gray'), ['..33....443.....', '.4433.34433344..', '3432233322232233'], 0, 13);         // broken concrete footing
      } else {
        put(b, LBONE, [
          '.......7........',
          '..7....76....7..',
          '..76...65....6..',
          '..65..765...76..',
          '.765..654...65.7',
          '.654.7654..765.6',
          '7654.6654..654.6',
          '6654.6543.7654.5',
          '6543.6543.6543.5',
          '5543k5543k5543k4'
        ], 0, 6);
        b.pset(7, 6, rd[4]); b.pset(7, 7, rd[3]); b.pset(13, 7, rd[4]);
      }
      b.outline(OUTL);
      return b;
    }

    /* ---------- cracked "secret" wall ---------- */
    function cracked(v) {
      var b = v === 0 ? techTop(2) : techWall(2);
      if (v === 0) {
        crackLine(b, [[6, 0], [7, 3], [5, 6], [8, 9], [6, 12], [8, 15]], OUTL, tn[6]);
        crackLine(b, [[8, 9], [12, 10], [14, 13]], OUTL, tn[5]);
        crackLine(b, [[5, 6], [2, 8], [1, 11]], OUTL, tn[5]);
      } else {
        crackLine(b, [[8, 0], [6, 4], [9, 7], [6, 11], [8, 15]], OUTL, tn[6]);
        crackLine(b, [[9, 7], [13, 6], [15, 9]], OUTL, tn[5]);
        crackLine(b, [[6, 4], [3, 5], [0, 3]], OUTL, tn[5]);
        crackLine(b, [[6, 11], [2, 13]], OUTL, tn[5]);
        crackLine(b, [[9, 7], [12, 11], [13, 14]], OUTL, 0);
        b.pset(7, 5, BLK); b.pset(8, 6, BLK); b.pset(7, 10, BLK);
      }
      return b;
    }

    /* ---------- rusted grate bridge segment ---------- */
    function grate(v) {
      var b = tile(), x;
      for (x = 0; x < 16; x++) {
        b.pset(x, 0, ru[6]); b.pset(x, 1, ru[4]);
        if ((x & 3) < 2) { b.pset(x, 2, ru[(x & 3) ? 3 : 5]); b.pset(x, 3, ru[(x & 3) ? 2 : 4]); b.pset(x, 4, ru[(x & 3) ? 2 : 3]); }
        b.pset(x, 5, ru[3]); b.pset(x, 6, ru[1]);
      }
      b.vline(0, 0, 7, ru[5]); b.vline(15, 0, 7, ru[1]); b.pset(0, 0, ru[7]);
      b.pset(5, 0, st[5]); b.pset(6, 0, st[6]); b.pset(11, 1, ru[2]); b.pset(12, 5, ru[1]); b.pset(3, 5, ru[5]);
      if (v === 1) {
        var sag = bmp(16, 16); sag.blitPart(b, 9, 0, 7, 7, 9, 1, true);
        b.rect(7, 0, 9, 8, 0); b.blit(sag, 0, 0);
        b.pset(7, 0, ru[6]); b.pset(6, 2, 0); b.pset(6, 3, 0); b.pset(7, 3, ru[5]); b.pset(6, 5, 0); b.pset(6, 6, 0);
        b.pset(8, 1, ru[6]); b.pset(8, 2, ru[6]); b.pset(9, 1, ru[7]); b.pset(5, 0, ru[7]); b.pset(6, 0, 0); b.pset(6, 1, ru[5]);
      }
      return b;
    }

    /* ====================== PROPS ====================== */

    function hazard(b, x, y, k) {                   // one hazard-stripe pixel, shade k = 0 (lit) .. 3
      b.pset(x, y, ((x + y) & 7) < 4 ? [HOTY, go[5], go[4], go[3]][k] : [gy[2], gy[1], gy[1], gy[0]][k]);
    }

    /* tech support column with a running light */
    function column() {
      var b = bmp(16, 48), x, y, k;
      for (y = 6; y < 43; y++) for (x = 3; x <= 12; x++) b.pset(x, y, sc(mi, cyl((x - 3) / 9, 1.2, 5.2), x, y));
      for (k = 0; k < 2; k++) {                     // cap + foot flanges
        var fy = k ? 43 : 1;
        for (y = 0; y < 5; y++) for (x = 1; x <= 14; x++) b.pset(x, fy + y, sc(mi, cyl((x - 1) / 13, 1.5, 6) - (y === 4 ? 2 : (y === 0 ? -1 : 0)), x, y));
      }
      for (x = 3; x <= 12; x++) { b.pset(x, 6, mi[0]); for (y = 0; y < 4; y++) hazard(b, x, 8 + y, x < 6 ? 0 : (x < 10 ? 1 : 3)); b.pset(x, 12, mi[1]); b.pset(x, 42, mi[0]); }
      for (y = 15; y < 38; y++) {                   // light slit: GLOW colours run down the column
        b.pset(6, y, OUTL); b.pset(9, y, mi[6]);
        b.pset(7, y, gl[(y >> 1) & 7]); b.pset(8, y, gl[((y >> 1) + 1) & 7]);
      }
      b.hline(6, 14, 4, OUTL); b.hline(6, 38, 4, mi[6]);
      rivet(b, 4, 39, mi, 7, 5, 2); rivet(b, 10, 39, mi, 5, 3, 1);
      b.outline(OUTL);
      return b;
    }

    /* UAC computer terminal */
    function computer(f) {
      var b = bmp(24, 24), x, y, k;
      for (y = 1; y < 24; y++) for (x = 1; x <= 22; x++) b.pset(x, y, sc(gy, x < 16 ? 3.5 : 3, x, y));
      b.hline(1, 1, 22, gy[6]); b.vline(1, 1, 23, gy[5]); b.vline(22, 2, 22, gy[1]); b.vline(21, 3, 21, gy[2]);
      // main screen
      b.rect(3, 3, 13, 10, OUTL); b.rect(4, 4, 11, 8, gr[0]);
      var LINES = f ? [9, 5, 8, 6] : [9, 5, 8, 3];
      for (k = 0; k < 4; k++) b.hline(5, 5 + k * 2 - (k > 1 ? 1 : 0), LINES[k], k === 0 ? tx[5] : tx[3]);
      b.hline(5, 10, f ? 2 : 6, HOTG);
      if (f) b.rect(11, 9, 2, 2, HOTG);              // cursor
      b.pset(14, 4, gr[3]); b.pset(13, 4, gr[2]); b.pset(14, 5, gr[2]);
      b.hline(3, 13, 13, gy[6]);
      // side panel: status lamps + tape slot
      var ON = [HOTR, HOTY, HOTG], OFF = [rd[1], go[1], gr[1]];
      for (k = 0; k < 3; k++) { b.rect(17, 3 + k * 3, 4, 2, OUTL); b.pset(18, 3 + k * 3, ((k + f) & 1) ? ON[k] : OFF[k]); b.pset(19, 3 + k * 3, ((k + f) & 1) ? ON[k] : OFF[k]); }
      b.hline(17, 12, 4, gy[1]);
      // keyboard shelf
      b.hline(1, 14, 22, gy[7]); b.hline(1, 15, 22, gy[5]); b.hline(1, 16, 22, gy[4]); b.hline(1, 17, 22, gy[0]);
      for (x = 3; x < 20; x += 2) { b.pset(x, 15, gy[1]); b.pset(x + 1, 16, gy[1]); }
      b.pset(1, 14, WHITE);
      // lower cabinet: vent + maker's plate, hazard kick-strip
      for (y = 19; y < 22; y++) b.hline(3, y, 8, y === 20 ? gy[4] : gy[0]);
      b.rect(13, 18, 8, 3, rd[2]); b.hline(13, 18, 8, rd[4]); b.pset(15, 19, bo[6]); b.pset(17, 19, bo[6]); b.pset(18, 19, bo[6]);
      for (x = 1; x <= 22; x++) for (y = 22; y < 24; y++) hazard(b, x, y, y === 22 ? 1 : 3);
      b.outline(OUTL);
      return b;
    }

    function crate() {
      var b = bmp(16, 16), x, y;
      for (y = 1; y < 15; y++) for (x = 1; x < 15; x++) b.pset(x, y, sc(tn, y < 4 ? 3.5 : (y > 11 ? 2.5 : 3), x, y));
      b.hline(1, 1, 14, tn[6]); b.vline(1, 1, 14, tn[5]); b.hline(1, 14, 14, tn[1]); b.vline(14, 1, 14, tn[1]);
      b.hline(2, 3, 12, tn[1]); b.hline(2, 4, 12, tn[5]); b.hline(2, 11, 12, tn[1]); b.hline(2, 12, 12, tn[4]);      // plank seams
      tiny(b, 'UAC', 3, 5, OUTL);
      b.pset(14, 1, tn[4]); b.pset(1, 14, tn[3]);
      rivet(b, 2, 2, st, 7, 5, 2); rivet(b, 12, 2, st, 6, 4, 1); rivet(b, 2, 12, st, 6, 4, 1); rivet(b, 12, 12, st, 5, 3, 1);
      b.hline(3, 13, 9, rd[3]);
      b.rect(0, 0, 16, 1, OUTL); b.rect(0, 15, 16, 1, OUTL); b.rect(0, 0, 1, 16, OUTL); b.rect(15, 0, 1, 16, OUTL);
      return b;
    }

    /* weathered headstone with an inverted cross */
    function tomb() {
      var b = bmp(20, 22), x, y;
      for (y = 1; y < 19; y++) for (x = 4; x <= 15; x++) {
        if (y < 7) { var dx = (x - 9.5) / 6.2, dy = (y - 7) / 6.2; if (dx * dx + dy * dy > 1) continue; }
        var v = 3.6 + (hash2(x >> 1, y >> 1, 41) - 0.5) * 1.2;
        if (x <= 5) v = 5.5; else if (x >= 14) v = 2;
        b.pset(x, y, sc(gy, v, x, y));
      }
      for (x = 4; x <= 15; x++) for (y = 1; y < 8; y++) if (b.get(x, y) && !b.get(x, y - 1)) b.pset(x, y, gy[x < 11 ? 7 : 5]);   // lit top arc
      b.vline(9, 6, 9, gy[1]); b.vline(10, 6, 9, gy[2]); b.vline(11, 7, 8, gy[6]);                                          // inverted cross (carved)
      b.hline(7, 11, 6, gy[1]); b.hline(7, 12, 6, gy[2]); b.hline(7, 13, 2, gy[6]); b.hline(11, 13, 2, gy[6]);
      crackLine(b, [[14, 3], [12, 5], [13, 8]], gy[0], 0);
      b.pset(15, 2, 0); b.pset(15, 3, 0); b.pset(14, 2, 0);                                                                 // chipped shoulder
      for (x = 2; x <= 17; x++) { b.pset(x, 19, gy[x < 5 ? 6 : 5]); b.pset(x, 20, gy[x > 14 ? 2 : 3]); b.pset(x, 21, gy[x > 14 ? 1 : 2]); }
      b.hline(4, 18, 12, gy[1]);
      b.pset(3, 21, ROCK[4]); b.pset(4, 21, ROCK[3]); b.pset(5, 20, ROCK[4]); b.pset(15, 21, ROCK[3]); b.pset(16, 21, ROCK[4]); b.pset(10, 21, ROCK[3]);
      b.pset(6, 15, ROCK[3]); b.pset(6, 16, ROCK[2]);
      b.outline(OUTL);
      return b;
    }

    function skullpole() {
      var b = bmp(10, 32), y;
      for (y = 1; y < 32; y++) { b.pset(4, y, br[(y % 6) === 2 ? 6 : 4]); b.pset(5, y, br[2]); }
      b.pset(5, 1, 0);
      put(b, LBONE, SKULL_F, 1, 3);
      b.pset(3, 10, rd[4]); b.pset(3, 11, rd[3]); b.pset(6, 10, rd[3]); b.pset(4, 11, rd[2]);
      put(b, LBONE, ['65.....66', '.666666..', '65.....5.'], 0, 13);                 // lashed thigh bone
      b.pset(4, 14, br[1]); b.pset(5, 14, br[1]); b.pset(3, 14, tn[4]); b.pset(6, 14, tn[3]);
      put(b, LBONE, SKULL_F.slice(0, 6), 2, 17, true);                          // the lower one has lost its jaw
      b.pset(4, 23, bo[4]); b.pset(7, 23, bo[4]);
      b.pset(5, 24, rd[3]); b.pset(5, 25, rd[2]);
      put(b, GNG.makeLegend({ '5': ROCK[5], '4': ROCK[4], '3': ROCK[3], '2': ROCK[2] }), ['...54....', '.5443.54.', '544332433'], 0, 29);
      b.outline(OUTL);
      return b;
    }

    /* blast door: hazard-striped jambs, alert lamps in the lintel */
    function door() {
      var b = bmp(32, 48), x, y, k;
      var SLAB = [5, 4, 3.5, 3, 3, 3, 2, 1];
      for (y = 8; y < 48; y++) {
        for (x = 0; x < 4; x++) {
          var a = ((x + y) & 7) < 4, c = ((y - x + 64) & 7) < 4;
          b.pset(1 + x, y, a ? [HOTY, go[5], go[4], go[3]][x] : [gy[2], gy[1], gy[1], gy[0]][x]);
          b.pset(27 + x, y, c ? [HOTY, go[5], go[4], go[3]][x] : [gy[2], gy[1], gy[1], gy[0]][x]);
        }
        b.pset(5, y, OUTL); b.pset(26, y, OUTL);
        for (x = 6; x < 26; x++) b.pset(x, y, sc(st, SLAB[(y - 8) & 7] - (x > 20 ? 0.5 : 0), x, y));
      }
      b.vline(15, 8, 40, st[1]); b.vline(16, 8, 40, st[5]);
      for (k = 0; k < 5; k++) { rivet(b, 7, 11 + k * 8, st, 7, 5, 2); rivet(b, 23, 11 + k * 8, st, 6, 4, 1); }
      // name plate across the seam
      b.rect(9, 25, 14, 9, OUTL); b.rect(10, 26, 12, 7, gy[2]); b.hline(10, 26, 12, gy[4]);
      tiny(b, 'UAC', 11, 27, HOTY);
      // claw marks
      for (k = 0; k < 3; k++) { b.line(8 + k * 3, 13, 12 + k * 3, 21, st[1]); b.line(9 + k * 3, 13, 13 + k * 3, 21, st[6]); }
      for (x = 6; x < 26; x++) for (y = 44; y < 48; y++) if (x !== 15 && x !== 16) hazard(b, x, y, y - 44);
      // lintel
      for (y = 1; y < 8; y++) for (x = 1; x < 31; x++) b.pset(x, y, sc(mi, [6, 5, 4, 4, 3.5, 3, 1][y - 1], x, y));
      b.vline(1, 1, 7, mi[7]); b.vline(30, 1, 7, mi[1]);
      for (k = 0; k < 3; k++) {
        b.rect(5 + k * 9, 3, 5, 3, OUTL);
        b.pset(6 + k * 9, 4, gl[(3 + k * 2) & 7]); b.pset(7 + k * 9, 4, gl[(4 + k * 2) & 7]); b.pset(8 + k * 9, 4, gl[(5 + k * 2) & 7]);
      }
      b.outline(OUTL);
      return b;
    }

    function light(f) {
      var L = GNG.makeLegend({ k: 'outline', w: 'white', b: 'glow1', c: 'glow2', d: 'glow3', e: 'glow4',
        '6': 'mist6', '5': 'mist5', '4': 'mist4', '3': 'mist3', '2': 'mist2', '1': 'mist1' });
      return art(L, f === 0 ? [
        '.kkkkkkkkkk.',
        'k6555555542k',
        'k5kkkkkkkk2k',
        'k5kdewwedk2k',
        'k5keewweek2k',
        'k5kdeeeedk2k',
        'k5kkkkkkkk2k',
        'k4333333321k',
        '.kkkkkkkkkk.'
      ] : [
        '.kkkkkkkkkk.',
        'k6555555542k',
        'k5kkkkkkkk2k',
        'k5kcdeedck2k',
        'k5kdeeeedk2k',
        'k5kcddddck2k',
        'k5kkkkkkkk2k',
        'k4333333321k',
        '.kkkkkkkkkk.'
      ], 'light' + f);
    }

    /* three candles guttering on an iron dish */
    function candle(f) {
      var b = bmp(11, 15);
      put(b, LG('bone', { s: 'steel2', S: 'steel4', T: 'steel6', d: 'steel1', k: 'outline' }), [
        '....k....',
        '...765...',
        '...765...',
        '.k.765.k.',
        '76.765.76',
        '76.764.75',
        '75.765.65',
        '65.765.65',
        'TSSSSSSsd',
        '.sSSSSsd.'
      ], 1, 5);
      flame(b, 5, 4, f, HOTY, col('hotorange'), col('ember3'), false);
      flame(b, 2, 7, f + 1, HOTY, col('hotorange'), col('ember3'), false);
      flame(b, 8, 7, f + 2, HOTY, col('hotorange'), col('ember3'), false);
      b.outline(OUTL);
      return b;
    }

    /* summoning seal: the GLOW colours chase round the ring and along the strokes of the star */
    function pentagram() {
      var b = bmp(28, 30), cx = 13.5, cy = 12.5, rr = 11.4, x, y, k, n;
      for (y = 0; y < 26; y++) for (x = 0; x < 28; x++) {
        var dx = x - cx, dy = y - cy, d = sqrt(dx * dx + dy * dy);
        if (d > rr + 0.6) continue;
        if (d > rr - 0.4) b.pset(x, y, rd[2]);
        else if (d > rr - 1.6) { var a = (atan2(dy, dx) / (2 * PI) + 1) % 1; b.pset(x, y, gl[floor(a * 16) & 7]); }
        else b.pset(x, y, BLK);
      }
      var P = [];
      for (k = 0; k < 5; k++) { var an = PI / 2 + k * 2 * PI / 5; P.push([cx + cos(an) * (rr - 1.8), cy + sin(an) * (rr - 1.8)]); }   // point-down star
      for (k = 0; k < 5; k++) {                     // dried-blood channel under every stroke ...
        var q0 = P[k], q1 = P[(k + 2) % 5];
        b.line(q0[0] + 1, q0[1], q1[0] + 1, q1[1], rd[2]); b.line(q0[0], q0[1] + 1, q1[0], q1[1] + 1, rd[2]);
      }
      for (k = 0; k < 5; k++) {                     // ... and the glowing core
        var p0 = P[k], p1 = P[(k + 2) % 5];
        for (n = 0; n <= 22; n++) b.pset(round(p0[0] + (p1[0] - p0[0]) * n / 22), round(p0[1] + (p1[1] - p0[1]) * n / 22), gl[(floor(n / 3) + k * 3) & 7]);
      }
      // blood-stained dais
      for (x = 0; x < 28; x++) {
        if (x > 1 && x < 26) { b.pset(x, 25, gy[5]); b.pset(x, 26, gy[3]); }
        b.pset(x, 27, gy[x < 3 ? 6 : 5]); b.pset(x, 28, gy[3]); b.pset(x, 29, gy[x > 24 ? 1 : 2]);
      }
      for (k = 0; k < 4; k++) { b.pset(5 + k * 6, 28, gy[1]); b.pset(5 + k * 6, 29, gy[1]); }
      b.pset(12, 25, rd[3]); b.pset(13, 25, rd[4]); b.pset(14, 25, rd[3]); b.pset(13, 26, rd[3]); b.pset(13, 27, rd[2]); b.pset(8, 27, rd[3]); b.pset(19, 27, rd[3]); b.pset(19, 28, rd[2]);
      b.outline(OUTL);
      return b;
    }

    function signExit() {
      var b = bmp(22, 10);
      b.rect(0, 0, 22, 10, OUTL);
      b.rect(1, 1, 20, 8, rd[0]);
      b.hline(1, 1, 20, st[5]); b.vline(1, 1, 8, st[4]); b.hline(1, 8, 20, st[1]); b.vline(20, 1, 8, st[2]); b.pset(1, 1, st[7]);
      b.rect(2, 2, 18, 6, BLK);
      tiny(b, 'EXIT', 4, 2, HOTR);
      b.hline(4, 2, 15, col('red6')); b.pset(7, 2, BLK); b.pset(9, 2, BLK); b.pset(11, 2, BLK); b.pset(15, 2, BLK);   // lit top edge of the letters
      b.hline(2, 7, 18, rd[1]);
      return b;
    }

    var t = emptySet();
    var WALLS = [6, 1, 2, 0, 6, 3, 1, 6, 2, 4, 6, 1, 0, 2, 6, 5];   // plain plates dominate; one vent, one strip light
    for (i = 0; i < WALLS.length; i++) t.solid.push(techWall(WALLS[i]));
    for (i = 0; i < 10; i++) t.alt.push(rock(i));
    for (i = 0; i < 4; i++) {
      t.solidTop.push(techTop([6, 1, 2, 3][i]));
      t.altTop.push(rockTop(i));
      t.conveyor.push(beltTile(i, st, gy, go));
    }
    for (i = 0; i < 6; i++) { t.back.push(techBack([0, 1, 2, 3, 0, 4][i])); t.backAlt.push(cryptBack(i)); }
    t.platform = [catwalk(0), catwalk(1), catwalk(2)];
    t.ladder = [ladder()];
    t.spikes = [spikes(0), spikes(1)];
    t.cracked = [cracked(0), cracked(1)];
    t.bridge = [grate(0), grate(1)];
    t.props = {
      column: column(),
      computer: frames(computer(0), computer(1)),
      crate_uac: crate(),
      tomb: tomb(),
      skullpole: skullpole(),
      door: door(),
      light: frames(light(0), light(1)),
      candle: frames(candle(0), candle(1), candle(2)),
      pentagram: pentagram(),
      sign_exit: signExit()
    };
    return t;
  }

  GNG.Tiles.register(4, buildPhobos);

  /* ====================================================================== *
   *  STAGE 6 — THRONE OF ASTAROTH-LECHUCK-9000
   * ====================================================================== */

  /** One dressed stone block (bevelled, speckled); its last column and row are the mortar joint. */
  function stoneBlock(b, x0, y0, w, h, seed, r, base, mortar) {
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c;
      if (x === w - 1 || y === h - 1) c = mortar;
      else if (y === 0) c = r[base + (x === w - 2 ? 1 : 2)];
      else if (x === 0) c = r[base + 1];
      else if (y === h - 2 || x === w - 2) c = r[base - 1];
      else { var n = hash2(x0 + x, y0 + y, seed); c = r[n < 0.13 ? base - 1 : (n > 0.84 ? base + 1 : base)]; }
      b.pset(x0 + x, y0 + y, c);
    }
  }

  var SKULL_S = ['.676.', '67776', '6k6k5', '.565.', '.4k4.'];                                   // 5x5 skull
  var BONE_H = ['76.....67', '.7666665.', '65.....55'];                                         // 9x3 thigh bone
  var BONE_D = ['.76....', '766....', '..65...', '...65..', '....665', '....56.'];              // 7x6 diagonal bone
  var RIB = ['.76665.', '76...65', '6.....5', '5......'];                                       // 7x4 rib
  var FLOPPY11 = [         // 3.5" floppy: 5/4/3/2 body, S/s/d shutter, W/w label, r write-protect tab
    '54SSSSSs44.',
    '54SSSkSs443',
    '54SSSkSs443',
    '54sssssd443',
    '54444444443',
    '54WWWWWWW43',
    '54WwwwwwW43',
    '54WWWWWWW43',
    '54WwwwrwW43',
    '54WWWWWWW43',
    '43333333332'
  ];
  var FLOPPY9 = [
    '54SSSs44.',
    '54SSks443',
    '54sssd443',
    '544444443',
    '5WWWWWW43',
    '5WwwwwW43',
    '5WWWWWW43',
    '5WwwrwW43',
    '433333332'
  ];
  var FLOPPY6 = ['5SSS4.', '5SkS43', '544443', '5WWW43', '5WwW43', '433332'];

  function buildThrone() {
    var du = R.dusk, ma = R.maroon, bo = R.bone, go = R.gold, rd = R.red, ni = R.night, st = R.steel, gl = R.glow,
      br = R.brown, ind = R.indigo, em = R.ember;
    var OUTL = col('outline'), BLK = col('black'), WHITE = col('white'), HOTY = col('hotyellow');
    var HS = [du[0], du[1], du[2], du[3], du[4], ma[4], ma[5], ma[6]];        // hell-stone: dusk shadows, maroon lights
    var BR = [du[0], du[1], du[1], du[2], du[2], du[3], du[3], du[4]];        // the same stone in deep shadow
    var MORT = du[0];
    var LB = LG('bone', { k: 'dusk0', m: 'maroon1' });
    var LCARVE = GNG.makeLegend({ '7': HS[6], '6': HS[5], '5': HS[4], '4': HS[2], '3': HS[2], k: HS[0] });
    var LFLOP = GNG.makeLegend({ '5': 'blue5', '4': 'blue4', '3': 'blue3', '2': 'blue2', S: 'steel6', s: 'steel4', d: 'steel2',
      W: 'bone7', w: 'bone5', r: 'red4', k: 'outline' });
    var i;

    /* ---------- gothic masonry: a tall ashlar course over a thin brick band ---------- */
    function thinCourse(b, seed) { for (var k = 0; k < 3; k++) stoneBlock(b, -4 + k * 8, 10, 8, 6, seed + k, HS, 3, MORT); }
    function masonry(v) {
      var b = tile(), seed = 2000 + v * 13;
      thinCourse(b, seed + 5);
      if (v === 1) { stoneBlock(b, 0, 0, 7, 10, seed, HS, 3, MORT); stoneBlock(b, 7, 0, 9, 10, seed + 1, HS, 3, MORT); }
      else if (v === 4) { stoneBlock(b, 0, 0, 10, 10, seed, HS, 3, MORT); stoneBlock(b, 10, 0, 6, 10, seed + 1, HS, 3, MORT); }
      else stoneBlock(b, 0, 0, 16, 10, seed, HS, 3, MORT);
      if (v === 2) put(b, LCARVE, SKULL_F, 4, 1);                                              // carved skull
      if (v === 3) {                                                                           // bone inlay, set flush
        var bn = art(LB, BONE_H);
        b.blitSolid(bn, 2, 3, false, HS[1]); b.blitSolid(bn, 4, 3, false, HS[1]); b.blitSolid(bn, 3, 2, false, HS[1]); b.blitSolid(bn, 3, 4, false, HS[5]);
        b.blit(art(LDIMB, BONE_H), 3, 3);
      }
      if (v === 5) { crackLine(b, [[11, 1], [9, 4], [10, 8]], HS[0], HS[5]); b.pset(3, 5, HS[1]); b.pset(4, 5, HS[1]); b.pset(4, 6, HS[5]); }
      return b;
    }

    /* ---------- floor: red runner, gold trim, polished obsidian slab ---------- */
    function floorTop(v) {
      var b = tile(), x, y;
      thinCourse(b, 2300 + v * 7);
      for (x = 0; x < 16; x++) {
        b.pset(x, 0, rd[hash2(x, v, 2311) < 0.3 ? 5 : 4]);
        b.pset(x, 1, rd[3]);
        b.pset(x, 2, (x & 3) === 1 ? go[6] : go[(x & 3) === 3 ? 3 : 4]);
        b.pset(x, 3, ind[4]);
        for (y = 4; y < 9; y++) b.pset(x, y, ni[y === 4 ? 2 : (y === 8 ? 0 : 1)]);
        b.pset(x, 9, BLK);
      }
      if (v === 0) { b.line(4, 7, 7, 4, ni[3]); b.line(6, 7, 9, 4, ni[3]); b.pset(8, 4, ind[4]); }       // reflections in the glass
      if (v === 1) { b.vline(7, 3, 6, BLK); b.vline(8, 4, 5, ni[3]); }                                   // slab joint
      if (v === 2) { b.line(9, 7, 12, 4, ni[3]); b.pset(3, 5, ni[3]); b.pset(4, 5, ni[2]); }
      if (v === 3) { b.line(2, 7, 5, 4, ni[3]); b.line(11, 7, 13, 5, ni[2]); b.pset(5, 4, ind[4]); }
      return b;
    }

    /* ---------- ossuary wall, stacked catacomb-fashion: a row of skulls over two rows of thigh-bone ends ---------- */
    var LDIMB = GNG.makeLegend({ '7': 'bone6', '6': 'bone5', '5': 'bone4', '4': 'bone3', '3': 'bone2', k: 'dusk0' });
    var XBONES = ['67...76', '.66.65.', '..665..', '..566..', '.65.65.', '65...55'];
    var KNOB = ['675', '764', '54k'];
    function ossuary(v, top) {
      var b = tile(), x, y, k, r, y0 = top ? 3 : 0, sd = 2410 + v * 17 + (top ? 100 : 0);
      for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) b.pset(x, y, hash2(x >> 1, y >> 1, sd) < 0.45 ? du[1] : du[0]);
      for (k = 0; k < 2; k++) {                                                   // the skull course (8px pitch)
        var kind = floor(hash2(k, 1, sd) * 6), lg = hash2(k, 2, sd) < 0.35 ? LDIMB : LB;
        if (kind === 5) put(b, LDIMB, XBONES, k * 8, y0);
        else put(b, lg, kind < 3 ? SKULL_F : SKULL_Q, k * 8, y0, kind === 4);
      }
      for (r = 0; r < (top ? 1 : 2); r++) for (k = 0; k < 5; k++) {               // bone ends (4px pitch, staggered)
        var kx = k * 4 - (r ? 2 : 0), h = hash2(k & 3, r, sd + 3);
        if (h < 0.1) continue;                                                    // one fell out
        put(b, h < 0.45 ? LDIMB : LB, KNOB, kx, y0 + 8 + r * 4);
      }
      if (top) {
        var CAP = [['6777766677777666', '5666655566666555', 'k555kk4k5555k44k'],
                   ['6677777777776676', '5566666666665565', '4k5k555555k5k45k'],
                   ['6776677776677766', '5665566665566655', 'k55kk5555kk555kk'],
                   ['6777777666777766', '5666666555666655', 'k5555k5k4k5555kk']][v];
        put(b, LB, CAP, 0, 0);
        for (x = 0; x < 16; x += 4) if (hash2(x, 5, sd) < 0.6) { b.pset(x + 1, 15, bo[3]); b.pset(x + 2, 15, bo[2]); }
      }
      return b;
    }

    /* ---------- cathedral wall in deep shadow (running bond) ---------- */
    function darkWall(v) {
      var b = tile(), seed = 2500 + v * 11;
      stoneBlock(b, 0, 0, 16, 8, seed, BR, 2, BLK);
      stoneBlock(b, -8, 8, 16, 8, seed + 1, BR, 2, BLK); stoneBlock(b, 8, 8, 16, 8, seed + 2, BR, 2, BLK);
      if (v === 1) crackLine(b, [[4, 1], [6, 3], [5, 6]], BLK, 0);
      if (v === 2) { b.rect(11, 11, 2, 2, BLK); b.hline(11, 13, 2, du[2]); }                             // putlog hole
      if (v === 3) { b.pset(11, 3, du[3]); b.pset(12, 3, du[2]); b.pset(11, 4, du[2]); b.pset(12, 4, BLK); b.pset(12, 5, BLK); b.pset(11, 5, du[2]); }   // iron ring
      return b;
    }
    /* ---------- blind tracery ---------- */
    function tracery(v) {
      return art(GNG.makeLegend({ '0': 'dusk0', '1': 'dusk1', '2': 'dusk2', k: 'black' }), v === 0 ? [
        '2222222222222222',
        '1kkkkkkkkkkkkkkk',
        '1000000110000000',
        '1000001221000000',
        '1000012002100000',
        '1000120000210000',
        '1001200000021000',
        '1002000220002000',
        '1012002112002100',
        '1020002002000200',
        '1020001221000200',
        '1020000110000200',
        '1020000000000200',
        '1020000000000200',
        '1020000000000200',
        '1020000000000200'
      ] : [
        '2222222222222222',
        '1kkkkkkkkkkkkkkk',
        '1000000000000000',
        '1000001221000000',
        '1000012002100000',
        '1001102002011000',
        '1012210000122100',
        '1020000000000200',
        '1020000000000200',
        '1012210000122100',
        '1001102002011000',
        '1000012002100000',
        '1000001221000000',
        '1000000000000000',
        '1020000000000200',
        '1020000000000200'
      ], 'tracery' + v);
    }

    /* ---------- giant thigh-bone ledge with iron clamps (one-way) ---------- */
    function boneLedge(part) {
      var b;
      if (part === 1) {
        b = tile();
        for (var x = 0; x < 16; x++) {
          b.pset(x, 0, bo[7]); b.pset(x, 1, bo[6]); b.pset(x, 2, bo[5]); b.pset(x, 3, bo[4]); b.pset(x, 4, bo[3]); b.pset(x, 5, OUTL);
        }
        b.pset(3, 2, bo[4]); b.pset(4, 2, bo[4]); b.pset(12, 3, bo[3]); b.pset(13, 1, bo[5]);                // hairline cracks
        for (var k = 0; k < 4; k++) for (var y = 0; y < 7; y++) b.pset(6 + k, y, st[[5, 6, 3, 1][k] - (y > 3 ? 1 : 0)]);
        b.pset(7, 7, st[3]); b.pset(8, 7, st[1]);
        return b;
      }
      b = art(LG('bone', { k: 'outline' }), [
        '.7777.7777777777',
        '7777767766666666',
        '7766666655555555',
        '6666555544444444',
        '6555k55433333333',
        '654kk544kkkkkkkk',
        'k54k.k43k.......',
        '.kk...kk........',
        '................', '................', '................', '................',
        '................', '................', '................', '................'
      ], 'bone_ledge');
      return part === 0 ? b : b.flipH();
    }

    function boneLadder() {
      var rows = [], k;
      for (k = 0; k < 4; k++) rows.push('...64......64...', '..766666666665..', '..544444444443..', '...64......64...');
      return art(LG('bone'), rows, 'bone_ladder');
    }

    /* ---------- black iron spikes ---------- */
    function cone(b, cx, tip, hw) {
      for (var y = tip; y < 16; y++) {
        var w = hw * (y - tip + 0.5) / (16 - tip), xa = round(cx - w), xb = round(cx + w);
        for (var x = xa; x <= xb; x++) b.pset(x, y, x === xa && y > tip ? st[5] : (x <= cx ? st[3] : (x === xb ? st[0] : st[1])));
      }
      b.pset(cx, tip, WHITE); b.pset(cx, tip + 1, st[6]);
    }
    function spikes(v) {
      var b = tile();
      if (v === 0) { cone(b, 2, 7, 2); cone(b, 8, 6, 2.6); cone(b, 13, 8, 2); }
      else { cone(b, 1, 9, 1.4); cone(b, 5, 6, 2.2); cone(b, 10, 7, 2.2); cone(b, 14, 9, 1.4); b.pset(5, 7, rd[4]); b.pset(5, 8, rd[3]); b.pset(4, 10, rd[3]); }
      b.hline(0, 15, 16, st[1]); b.pset(3, 15, st[3]); b.pset(11, 15, st[3]);
      b.outline(OUTL);
      return b;
    }

    /* ---------- cracked hell-stone: embers glow in the fractures ---------- */
    function cracked(v) {
      var b = v === 0 ? floorTop(0) : masonry(0);
      if (v === 0) {
        crackLine(b, [[7, 0], [8, 3], [6, 6], [9, 9], [7, 12], [9, 15]], BLK, em[3]);
        crackLine(b, [[9, 9], [12, 10], [14, 13]], BLK, em[2]);
        crackLine(b, [[6, 6], [3, 8], [2, 11]], BLK, em[2]);
      } else {
        crackLine(b, [[8, 0], [7, 4], [9, 7], [6, 11], [8, 15]], BLK, em[3]);
        crackLine(b, [[9, 7], [13, 6], [15, 8]], BLK, em[2]);
        crackLine(b, [[7, 4], [3, 5], [0, 3]], BLK, em[2]);
        crackLine(b, [[6, 11], [3, 13]], BLK, em[2]);
        b.pset(8, 5, em[4]); b.pset(8, 9, em[4]);
      }
      return b;
    }

    /* ---------- crumbling stone slab (bridge) ---------- */
    function slab(v) {
      var b = tile(), x;
      stoneBlock(b, 0, 0, 16, 8, 2700, HS, 4, HS[1]);
      b.vline(15, 0, 8, 0);
      for (x = 0; x < 15; x++) { b.pset(x, 7, hash2(x, 3, 2701) < 0.45 ? 0 : HS[1]); if (hash2(x, 4, 2701) < 0.2) b.pset(x, 6, HS[1]); }
      b.pset(0, 7, 0); b.pset(14, 7, 0); b.pset(14, 6, HS[1]);
      b.pset(4, 3, HS[2]); b.pset(5, 3, HS[2]); b.pset(10, 2, HS[2]);
      if (v === 1) {
        var sag = bmp(16, 16); sag.blitPart(b, 8, 0, 8, 8, 8, 1, true);
        b.rect(7, 0, 9, 9, 0); b.blit(sag, 0, 0);
        b.pset(6, 0, 0); b.pset(6, 2, 0); b.pset(5, 3, BLK); b.pset(6, 4, 0); b.pset(6, 6, 0); b.pset(8, 1, 0); b.pset(8, 4, 0);
        crackLine(b, [[3, 1], [4, 4], [2, 6]], BLK, 0); crackLine(b, [[11, 2], [12, 5], [11, 7]], BLK, 0);
      }
      return b;
    }

    /* ====================== PROPS ====================== */

    /* gothic pillar: fluted purple marble, gilded rings, a skull for a capital */
    function column() {
      var b = bmp(16, 48), x, y;
      var FLUTE = [3, 6, 4, 6, 4, 5, 3, 4, 2, 1];                                  // lit crest / shaded groove, darker to the right
      for (y = 12; y < 42; y++) for (x = 3; x <= 12; x++) b.pset(x, y, HS[FLUTE[x - 3]]);
      for (x = 2; x <= 13; x++) {                                                 // gilded astragals
        b.pset(x, 12, go[x < 6 ? 6 : (x < 10 ? 4 : 2)]); b.pset(x, 13, go[x < 10 ? 3 : 1]);
        b.pset(x, 40, go[x < 6 ? 6 : (x < 10 ? 4 : 2)]); b.pset(x, 41, go[x < 10 ? 3 : 1]);
      }
      for (y = 42; y < 48; y++) {                                                 // stepped base
        var e = y < 44 ? 2 : 1;
        for (x = e; x <= 15 - e; x++) b.pset(x, y, sc(HS, cyl((x - e) / (15 - 2 * e), 2, 6) - (y === 43 || y === 47 ? 1.5 : 0), x, y));
      }
      for (x = 1; x <= 14; x++) { b.pset(x, 1, HS[x < 10 ? 7 : 5]); b.pset(x, 2, HS[x < 10 ? 5 : 3]); }   // abacus
      put(b, LG('bone', { k: 'outline', e: 'glow4', d: 'glow1' }), [
        '..66777766..',
        '.6777777765.',
        '677777777765',
        '67kk7667kk65',
        '66ke6666ek55',
        '.566k66k655.',
        '..65666654..',
        '..5k5k5k54..',
        '...454544...'
      ], 2, 3);
      b.outline(OUTL);
      return b;
    }

    /* three-armed iron candelabra burning with cursed (GLOW) fire */
    function candelabra(f) {
      var b = bmp(19, 34);
      put(b, LG('bone', { T: 'steel6', S: 'steel4', s: 'steel2', d: 'steel1' }), [
        '........765........',
        '........765........',
        '........765........',
        '..765...765...765..',
        '..765...765...765..',
        '..764...765...764..',
        '.TSSSd.TSSSd.TSSSd.',
        '..sSd...sSd...sSd..',
        '..TS....sSd....Ss..',
        '..TS....sSd....Ss..',
        '..TSs...sSd...sSs..',
        '...TSs..sSd..sSs...',
        '....TSSssSdssSs....',
        '......sssSdss......',
        '........sSd........',
        '.......TSSSd.......',
        '.......sSSSd.......',
        '........sSd........',
        '........sSd........',
        '........sSd........',
        '........sSd........',
        '........sSd........',
        '.......TSSSd.......',
        '......TSSSSSd......',
        '....TSSssSdssSd....',
        '...TSs...S...sSd...',
        '..TSs.........sSd..'
      ], 0, 7);
      flame(b, 9, 6, f, WHITE, gl[4], gl[0], true);
      flame(b, 3, 9, f + 1, WHITE, gl[5], gl[1], true);
      flame(b, 15, 9, f + 2, WHITE, gl[3], gl[7], true);
      b.outline(OUTL);
      return b;
    }

    /* stained-glass window; its rose is the Holy Floppy. All the cursed light is GLOW (palette-cycled). */
    function windowProp() {
      var b = bmp(28, 48), x, y;
      function ins(px, py) {
        var s;
        if (py >= 17) s = min(px - 1, 26 - px);
        else { var dx = px - (px <= 13 ? 17 : 10), dy = py - 17; s = 16 - sqrt(dx * dx + dy * dy); }
        return min(s, 45.5 - py);
      }
      for (y = 0; y < 46; y++) for (x = 0; x < 28; x++) {
        var s = ins(x, y), c;
        if (s < -0.5) continue;
        var lit = x <= 13;
        if (s < 1.5) c = lit ? (s < 0.5 ? HS[7] : HS[5]) : (s < 0.5 ? HS[4] : HS[3]);
        else if (s < 2.5) c = OUTL;
        else {
          var rx = x - 13.5, ry = y - 14, rd2 = sqrt(rx * rx + ry * ry);
          if (rd2 < 8.6) {                                                        // the rose
            if (rd2 > 7.5) c = OUTL;
            else c = gl[floor((atan2(ry, rx) / (2 * PI) + 1) * 8) & 7];
          } else if (y < 24) {                                                    // spandrels
            c = hash2(x >> 1, y >> 1, 2801) < 0.5 ? rd[3] : ind[3];
            if (rd2 < 9.6) c = go[4];
          } else if (y === 24 || x === 13 || x === 14) c = x === 13 && y > 24 ? HS[5] : (x === 14 && y > 24 ? HS[3] : OUTL);
          else {                                                                  // lancets: diamond quarries
            var a = x + y, d = x - y + 64;
            if (a % 6 === 0 || d % 6 === 0) c = OUTL;
            else {
              var pa = floor(a / 6), pd = floor(d / 6), h = hash2(pa, pd, 2802);
              c = h < 0.16 ? rd[3] : (h < 0.3 ? ind[4] : (h < 0.4 ? go[4] : gl[(pa + pd * 3) & 7]));
            }
          }
        }
        b.pset(x, y, c);
      }
      b.rect(7, 8, 13, 13, OUTL); b.pset(7, 8, gl[5]); b.pset(19, 8, gl[7]); b.pset(7, 20, gl[3]); b.pset(19, 20, gl[1]);
      put(b, LFLOP, FLOPPY11, 8, 9);
      for (x = 0; x < 28; x++) { b.pset(x, 45, HS[x < 20 ? 7 : 5]); b.pset(x, 46, HS[x < 20 ? 5 : 3]); b.pset(x, 47, HS[2]); }
      b.outline(OUTL);
      return b;
    }

    /* war banner of the Undead Pirate Demon Computer */
    function banner() {
      var b = bmp(16, 34), x, y;
      for (x = 2; x <= 13; x++) {
        var bot = 26 + round(abs(x - 7.5) * 0.9);
        for (y = 3; y <= bot; y++) {
          var c = sc(rd, 3.3 + sin((x - 2) * 0.95 + y * 0.1) * 0.9 - (y > 21 ? 0.5 : 0) - (y < 5 ? 1 : 0), x, y);
          if (x === 2 || x === 13) c = go[x === 2 ? 5 : 3];
          if (y >= bot - 1) c = go[(x & 1) ? 6 : 3];
          b.pset(x, y, c);
        }
      }
      b.hline(1, 1, 14, go[6]); b.hline(1, 2, 14, go[3]); b.pset(0, 1, go[7]); b.pset(0, 2, go[4]); b.pset(15, 1, go[5]); b.pset(15, 2, go[2]);
      b.line(4, 7, 11, 14, bo[5]); b.line(11, 7, 4, 14, bo[5]);
      b.pset(4, 7, bo[7]); b.pset(11, 7, bo[7]); b.pset(4, 14, bo[6]); b.pset(11, 14, bo[6]);
      put(b, LG('bone', { k: 'red0' }), SKULL_F, 4, 7);
      b.rect(4, 17, 8, 8, rd[0]);
      put(b, LFLOP, FLOPPY6, 5, 18);
      b.outline(OUTL);
      return b;
    }

    /* pipe organ: brass ranks over a carved console; the pipe mouths breathe GLOW */
    function organ() {
      var b = bmp(56, 60), x, y, k;
      var HT = [35, 31, 26, 21, 17, 23, 37, 23, 17, 21, 26, 31, 35];
      for (k = 0; k < 13; k++) {
        var x0 = 2 + k * 4, top = 40 - HT[k];
        for (y = top; y < 40; y++) { b.pset(x0, y, go[5]); b.pset(x0 + 1, y, go[7]); b.pset(x0 + 2, y, go[4]); b.pset(x0 + 3, y, go[2]); }
        b.pset(x0 + 1, top - 1, go[6]); b.pset(x0 + 2, top - 1, go[3]); b.pset(x0, top, go[3]); b.pset(x0 + 3, top, go[1]);
        b.hline(x0, 31, 4, go[2]); b.pset(x0 + 1, 32, go[6]); b.pset(x0 + 2, 32, go[5]);
        b.rect(x0 + 1, 33, 2, 3, OUTL); b.pset(x0 + 1, 34, gl[k & 7]); b.pset(x0 + 2, 34, gl[(k + 1) & 7]);
        b.pset(x0 + 1, 36, go[7]); b.pset(x0 + 2, 36, go[5]);
      }
      for (x = 1; x <= 54; x++) {                                                 // pipe rack
        b.pset(x, 25, br[4]); b.pset(x, 26, br[3]); b.pset(x, 27, br[1]);
        if ((x & 3) === 3) b.pset(x, 26, go[5]);
      }
      put(b, LG('bone', { k: 'outline' }), SKULL_S, 26, 23);
      // console
      for (y = 40; y < 60; y++) for (x = 1; x <= 54; x++) {
        var v = y < 42 ? (y === 40 ? 5 : 3) : (x < 4 ? 4 : (x > 51 ? 2 : 2.5 + (hash2(x >> 2, y, 2900) < 0.3 ? 0.5 : 0)));
        b.pset(x, y, sc(br, v, x, y));
      }
      b.hline(1, 42, 54, br[0]);
      b.rect(10, 43, 36, 5, br[0]);                                               // keydesk
      for (x = 11; x < 45; x++) {
        b.pset(x, 43, (x % 3) === 0 ? OUTL : bo[7]); b.pset(x, 44, (x % 3) === 0 ? OUTL : bo[5]);
        b.pset(x, 46, (x % 3) === 1 ? OUTL : bo[7]); b.pset(x, 47, (x % 3) === 1 ? OUTL : bo[4]);
      }
      for (k = 0; k < 3; k++) {                                                   // stop knobs
        b.pset(5, 44 + k * 2, go[6]); b.pset(7, 44 + k * 2, go[4]); b.pset(48, 44 + k * 2, go[6]); b.pset(50, 44 + k * 2, go[4]);
      }
      for (k = 0; k < 5; k++) {                                                   // blind arcade on the case
        var ax = 7 + k * 9;
        b.rect(ax, 51, 6, 6, br[1]); b.rect(ax + 1, 50, 4, 1, br[1]); b.rect(ax + 2, 49, 2, 1, br[1]);
        b.vline(ax + 6, 51, 6, br[5]); b.pset(ax + 5, 50, br[5]); b.pset(ax + 4, 49, br[5]);
        if (k !== 2) { b.vline(ax + 2, 52, 5, br[0]); b.vline(ax + 3, 52, 5, br[0]); }
      }
      put(b, LG('bone', { k: 'brown0' }), SKULL_S, 25, 51);
      for (x = 4; x <= 51; x++) { b.pset(x, 58, (x % 4) < 3 ? br[4] : br[0]); b.pset(x, 59, br[1]); }    // pedalboard
      b.hline(1, 40, 54, go[4]); b.pset(1, 40, go[6]);
      b.outline(OUTL);
      return b;
    }

    function skulls() {
      var b = bmp(24, 12);
      var L = LG('bone', { k: 'outline' }), LD = GNG.makeLegend({ '7': 'bone6', '6': 'bone5', '5': 'bone4', '4': 'bone3', '3': 'bone2', k: 'outline' });
      function sk(rows, lg, x, y, flip) { var a = art(lg, rows).padded(1); a.outline(OUTL); b.blit(a, x, y, !!flip); }
      sk(SKULL_Q, LD, 4, 0, true); sk(SKULL_F, LD, 11, 0);                         // back row, in shadow
      sk(SKULL_F, L, 0, 4); sk(SKULL_Q, L, 15, 4);
      sk(SKULL_F, L, 7, 4);
      b.pset(1, 11, OUTL); b.pset(22, 11, OUTL);
      return b;
    }

    /* shrine of the Holy Floppy */
    function altar() {
      var b = bmp(32, 22), x, y, k;
      for (y = 15; y < 22; y++) for (x = 4; x <= 27; x++) b.pset(x, y, sc(HS, x < 6 ? 5 : (x > 25 ? 2 : 3.5), x, y));
      b.rect(8, 16, 16, 5, HS[2]); b.hline(8, 16, 16, HS[1]); b.vline(8, 16, 5, HS[1]); b.hline(9, 20, 15, HS[5]); b.vline(23, 17, 4, HS[5]);
      put(b, LB, SKULL_S, 13, 16); b.pset(10, 18, bo[5]); b.pset(11, 18, bo[4]); b.pset(20, 18, bo[5]); b.pset(21, 18, bo[4]);
      for (x = 1; x <= 30; x++) { b.pset(x, 11, HS[x < 22 ? 7 : 6]); b.pset(x, 12, HS[x < 22 ? 6 : 5]); b.pset(x, 13, HS[4]); b.pset(x, 14, HS[1]); }
      b.pset(1, 11, WHITE);
      for (x = 11; x <= 20; x++) {                                                // altar cloth
        b.pset(x, 11, rd[5]); b.pset(x, 12, rd[4]); b.pset(x, 13, rd[x & 1 ? 3 : 4]); b.pset(x, 14, rd[3]); b.pset(x, 15, rd[2]);
        b.pset(x, 16, go[(x & 1) ? 6 : 3]);
      }
      b.pset(24, 14, rd[4]); b.pset(24, 15, rd[3]); b.pset(24, 16, rd[3]); b.pset(6, 14, rd[3]);              // old blood
      put(b, LFLOP, FLOPPY9, 11, 2);
      for (k = 0; k < 2; k++) {
        var cx = k ? 26 : 4;
        b.vline(cx, 7, 4, bo[7]); b.vline(cx + 1, 7, 4, bo[5]); b.pset(cx + 1, 6, bo[6]);
        flame(b, cx, 6, k * 2, WHITE, gl[k ? 3 : 5], gl[k ? 7 : 1], false);
      }
      b.outline(OUTL);
      for (k = 0; k < 8; k++) {                                                   // GLOW rays round the relic
        var an = k * PI / 4 + PI / 8, r1 = k & 1 ? 8 : 7;
        b.pset(round(15 + cos(an) * r1), round(6 + sin(an) * (r1 - 1.5)), gl[k]);
        if (!(k & 1)) b.pset(round(15 + cos(an) * 9.4), round(6 + sin(an) * 7), gl[(k + 2) & 7]);
      }
      return b;
    }

    function hookChain() {
      var b = bmp(8, 40);
      b.blit(chainProp(30, 'steel'), 1, 0);
      put(b, LG('steel'), [
        '...64...',
        '..6543..',
        '...64...',
        '...64...',
        '7..64...',
        '6..64...',
        '65.64...',
        '654653..',
        '.65432..',
        '..432...'
      ], 0, 30);
      b.outline(OUTL);
      return b;
    }

    /* heavy velvet drape on a gilded rod */
    function drape() {
      var b = bmp(32, 40), x, y;
      for (x = 1; x <= 30; x++) {
        var bot = 31 + round(4.5 * abs(sin((x - 1) / 29 * PI * 3)));
        for (y = 3; y <= bot; y++) {
          var ph = x * 0.84 + sin(y * 0.11 + x * 0.05) * 0.8;
          var v = 3 + 1.9 * sin(ph) - (y < 6 ? (6 - y) * 0.5 : 0) - (y - 3) / 60;
          var c = sc(rd, clamp(v, 1, 5.6), x, y);
          if (y >= bot - 1) c = go[y === bot ? ((x & 1) ? 6 : 3) : 4];
          b.pset(x, y, c);
        }
      }
      for (x = 0; x < 32; x++) { b.pset(x, 1, go[x < 22 ? 6 : 5]); b.pset(x, 2, go[x < 22 ? 4 : 2]); }
      b.pset(0, 0, go[5]); b.pset(31, 0, go[4]); b.pset(0, 3, go[3]); b.pset(31, 3, go[2]);
      for (x = 3; x < 30; x += 5) { b.pset(x, 1, br[1]); b.pset(x, 2, br[0]); b.pset(x, 3, rd[1]); }       // curtain rings
      b.outline(OUTL);
      return b;
    }

    var t = emptySet();
    var WALLS = [0, 1, 0, 4, 2, 5, 1, 0, 4, 3];
    for (i = 0; i < WALLS.length; i++) t.solid.push(masonry(WALLS[i]));
    for (i = 0; i < 4; i++) {
      t.solidTop.push(floorTop(i));
      t.alt.push(ossuary(i, false)); t.altTop.push(ossuary(i, true));
      t.back.push(darkWall(i));
      t.conveyor.push(beltTile(i, du, R.gray, bo));
    }
    t.backAlt = [tracery(0), tracery(1)];
    t.platform = [boneLedge(0), boneLedge(1), boneLedge(2)];
    t.ladder = [boneLadder()];
    t.spikes = [spikes(0), spikes(1)];
    t.cracked = [cracked(0), cracked(1)];
    t.bridge = [slab(0), slab(1)];
    t.props = {
      column: column(),
      candelabra: frames(candelabra(0), candelabra(1), candelabra(2)),
      window: windowProp(),
      banner: banner(),
      organ: organ(),
      skulls: skulls(),
      altar: altar(),
      chain: hookChain(),
      drape: drape()
    };
    return t;
  }

  GNG.Tiles.register(5, buildThrone);
})();
