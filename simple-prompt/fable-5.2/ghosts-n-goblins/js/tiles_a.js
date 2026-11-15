/*
 * tiles_a.js — tilesets + decorative props for stages 1-3 of
 * "Ghosts 'n Goblins: The Cursed PC Gaming Museum".
 *
 *   stage 1 (index 0)  LeChuck's Ghost Ship & Mêlée Graveyard
 *   stage 2 (index 1)  The Haunted Moat of Daventry
 *   stage 3 (index 2)  The Jaffar Spike Catacombs
 *
 * Everything is generated at stage load from seeded noise + small hand-drawn ASCII decals.
 * No DOM, no Math.random(): deterministic, and fine under the Node preview sandbox.
 *
 * Seamless-tiling contract used by every opaque interior tile: whatever crosses a tile edge
 * (noise, wood grain, the brick that straddles the border) is generated from tile-periodic,
 * variant-independent data; the per-variant detail lives inside the tile and fades out
 * before the edge. Any variant can therefore sit next to any other.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.Tiles || !GNG.Bitmap) return;

  var Bitmap = GNG.Bitmap, RAMPS = GNG.RAMPS, imul = Math.imul;
  function col(n) { return GNG.col(n); }

  /* Local copies of the engine's hash2 / noise2 / fbm / bayer (bit-identical output). They are called
     ~10^5 times per stage and going through the global object is slow in the Node vm sandbox. */
  function hash2(x, y, seed) {
    var h = (imul(x | 0, 374761393) + imul(y | 0, 668265263) + imul((seed | 0) + 1, 1274126177)) | 0;
    h = imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function noise2(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed, octaves) {
    var sum = 0, amp = 0.5, norm = 0, o = octaves || 4;
    for (var i = 0; i < o; i++) { sum += amp * noise2(x, y, (seed | 0) + i * 17); norm += amp; amp *= 0.5; x *= 2; y *= 2; }
    return sum / norm;
  }
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
  var K = col('outline');

  /* ====================================================================== *
   *  generic helpers
   * ====================================================================== */

  function tile() { var b = new Bitmap(16, 16); b.ax = 0; b.ay = 0; return b; }
  /**
   * Frame list for an animated prop. Built with the global Array constructor (not a literal) so that
   * engine.js' `instanceof Array` test also holds inside the Node vm sandbox, where array literals
   * belong to a different realm than the injected global `Array`.
   */
  function frames() { var a = new Array(), i; for (i = 0; i < arguments.length; i++) a.push(arguments[i]); return a; }
  function clampi(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /** Shade `v` (float index into ramp array) -> palette index. d = ordered-dither strength 0..1. */
  function sh(ramp, v, x, y, d) {
    var i = d ? Math.floor(v + 0.5 + (bayer(x, y) - 0.5) * d) : Math.round(v);
    return ramp[i < 0 ? 0 : (i >= ramp.length ? ramp.length - 1 : i)];
  }

  /** 0 at the tile border, 1 from 3px inside: fades per-variant detail out before the edge. */
  function win(t) { var m = t < 15 - t ? t : 15 - t; if (m >= 3) return 1; m /= 3; return m * m * (3 - 2 * m); }

  /** Value noise that wraps every 16px (lattice spacing cx, cy px; both must divide 16). */
  function pnoise(x, y, cx, cy, seed) {
    var nx = 16 / cx, ny = 16 / cy, fx = x / cx, fy = y / cy;
    var xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = ((xi % nx) + nx) % nx, y0 = ((yi % ny) + ny) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
    var a = hash2(x0, y0, seed), b = hash2(x1, y0, seed), c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /** 1D value noise along t that wraps every 16px; `row` selects an independent strand. */
  function pn1(t, cell, seed, row) {
    var n = 16 / cell, f = t / cell, i = Math.floor(f), u = f - i;
    u = u * u * (3 - 2 * u);
    var a = hash2(((i % n) + n) % n, row, seed), b = hash2((((i + 1) % n) + n) % n, row, seed);
    return a + (b - a) * u;
  }

  /** Legend: digits 0-7 = shades of `rampName`; k = outline, w = white; extra = 'x:colour y:colour'. */
  function legend(rampName, extra) {
    var o = { k: 'outline', w: 'white' }, i;
    if (rampName) for (i = 0; i < 8; i++) o[String(i)] = rampName + i;
    if (extra) {
      var parts = extra.split(/\s+/);
      for (i = 0; i < parts.length; i++) { if (!parts[i]) continue; var kv = parts[i].split(':'); o[kv[0]] = kv[1]; }
    }
    return GNG.makeLegend(o);
  }
  function art(lg, rows) { return GNG.parseArt(lg, rows, 'tiles_a'); }
  function stamp(b, x, y, lg, rows) { b.blit(art(lg, rows), x, y); }

  /** palette index -> shade number within its ramp (or -1) */
  var SHADE_OF = (function () {
    var t = new Int8Array(256), i, n;
    for (i = 0; i < 256; i++) t[i] = -1;
    for (n in RAMPS) for (i = 0; i < 8; i++) t[RAMPS[n][i]] = i;
    return t;
  })();
  /** Re-colour opaque pixels where fn(x,y) is true into `ramp`, keeping their shade (+shift). */
  function reramp(b, ramp, shift, fn) {
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var c = b.data[y * b.w + x];
      if (!c || SHADE_OF[c] < 0 || !fn(x, y)) continue;
      b.data[y * b.w + x] = ramp[clampi(SHADE_OF[c] + (shift | 0), 0, ramp.length - 1)];
    }
  }
  /** Darken (n<0) / lighten (n>0) ramp pixels where fn is true. */
  function relight(b, n, fn) {
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var c = b.data[y * b.w + x], s = SHADE_OF[c];
      if (!c || s < 0 || !fn(x, y)) continue;
      b.data[y * b.w + x] = c - s + clampi(s + n, 0, 7);
    }
  }

  /** Shift every row of a bitmap sideways by fn(y) pixels (leaning tombstones...). */
  function shearRows(src, fn) {
    var out = new Bitmap(src.w, src.h), x, y;
    for (y = 0; y < src.h; y++) {
      var dx = fn(y) | 0;
      for (x = 0; x < src.w; x++) { var c = src.data[y * src.w + x]; if (c) out.pset(x + dx, y, c); }
    }
    return out;
  }

  /**
   * Auto-shade a silhouette (any non-zero pixel of `m`) as a chunky carved solid lit from the
   * upper-left: bright rim on up/left edges, dark rim on down/right edges, mottled faces.
   */
  function shadeSil(m, ramp, o) {
    var w = m.w, h = m.h, out = new Bitmap(w, h), x, y;
    function inside(x, y) { return x >= 0 && y >= 0 && x < w && y < h && m.data[y * w + x] !== 0; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!m.data[y * w + x]) continue;
      var v = o.base;
      var e1 = !inside(x - 1, y) || !inside(x, y - 1), e2 = !inside(x + 1, y) || (!inside(x, y + 1) && y < h - 1);
      if (e1 && !e2) v += o.hi; else if (e2 && !e1) v -= o.lo;
      else if (!e1 && !e2) {
        var f1 = !inside(x - 2, y) || !inside(x, y - 2) || !inside(x - 1, y - 1);
        var f2 = !inside(x + 2, y) || (!inside(x, y + 2) && y < h - 2) || !inside(x + 1, y + 1);
        if (f1 && !f2) v += o.hi * 0.45; else if (f2 && !f1) v -= o.lo * 0.5;
      }
      v += (noise2(x / 3 + 0.4, y / 3 + 0.8, o.seed) - 0.5) * 2 * o.rough;
      if (o.grad) v -= o.grad * (y / h);
      out.data[y * w + x] = sh(ramp, v, x, y, o.dither || 0);
    }
    return out;
  }

  /** Horizontal wooden board on rows y0..y1: lit top edge, dark underside, streaky grain. */
  function board(b, x0, y0, x1, y1, o) {
    var x, y, n = y1 - y0 + 1;
    for (y = y0; y <= y1; y++) {
      var r = y - y0, off = o.prof ? o.prof[r < o.prof.length ? r : o.prof.length - 1] : (r === 0 ? 1 : (r === n - 1 && n > 1 ? -1 : 0));
      for (x = x0; x <= x1; x++) {
        var g = noise2(x / 5 + o.seed * 0.71, 0.5, o.seed * 13 + y * 7);
        b.pset(x, y, sh(o.ramp, o.base + off + (g > 0.66 ? -0.9 : (g < 0.22 ? 0.5 : 0)), x, y, o.dither || 0));
      }
    }
  }
  /** Vertical wooden board on columns x0..x1: lit left edge, dark right edge, vertical grain. */
  function vboard(b, x0, y0, x1, y1, o) {
    var x, y, n = x1 - x0 + 1;
    for (x = x0; x <= x1; x++) {
      var r = x - x0, off = o.prof ? o.prof[r < o.prof.length ? r : o.prof.length - 1] : (r === 0 ? 1 : (r === n - 1 && n > 1 ? -1 : 0));
      for (y = y0; y <= y1; y++) {
        var g = noise2(0.5, y / 5 + o.seed * 0.71, o.seed * 13 + x * 7);
        b.pset(x, y, sh(o.ramp, o.base + off + (g > 0.66 ? -0.9 : (g < 0.22 ? 0.5 : 0)), x, y, o.dither || 0));
      }
    }
  }

  /** Twisted rope, 2px wide, running down from (x,y0) to y1. */
  function vrope(b, x, y0, y1, c1, c2) {
    for (var y = y0; y <= y1; y++) { b.pset(x, y, (y & 1) ? c1 : c2); b.pset(x + 1, y, (y & 1) ? c2 : c1); }
  }
  /** Twisted rope, 2px thick, running right from (x0,y). */
  function hrope(b, x0, x1, y, c1, c2) {
    for (var x = x0; x <= x1; x++) { b.pset(x, y, (x & 1) ? c1 : c2); b.pset(x, y + 1, (x & 1) ? c2 : c1); }
  }

  /** Small embedded stone: lit upper-left, dark lower-right, with a contact shadow. */
  function pebble(b, cx, cy, rx, ry, ramp, base, shadowCol) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
        if (d <= 1) b.pset(x, y, ramp[clampi(Math.round(base - (dx + dy) * 1.25), 0, ramp.length - 1)]);
        else if (shadowCol && d <= 2.3 && dx + dy > 0.2) b.pset(x, y, shadowCol);
      }
    }
  }
  /** Thin root / crack: light line with a dark line just below it. */
  function rootLine(b, pts, c1, c2) {
    var i;
    if (c2) for (i = 0; i + 1 < pts.length; i++) b.line(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, c2);
    for (i = 0; i + 1 < pts.length; i++) b.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c1);
  }
  /** Jagged fracture: dark polyline with a lit lip on its lower-right side. */
  function crackLine(b, pts, dark, lip) {
    var i;
    if (lip) for (i = 0; i + 1 < pts.length; i++) b.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], lip);
    for (i = 0; i + 1 < pts.length; i++) b.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], dark);
  }

  /* ---------------------------------------------------------------------- *
   *  soil: bump-mapped lumpy earth (lens-shaped clods, lit from the upper-left)
   * ---------------------------------------------------------------------- */
  function soilField(seedC, seedV) {
    return function (x, y) {
      x &= 15; y &= 15;
      var hc = pnoise(x, y, 8, 4, seedC) * 0.55 + pnoise(x, y, 4, 2, seedC + 7) * 0.45;
      var wv = win(x) * win(y);
      if (wv <= 0) return hc;
      var hv = noise2(x / 6 + 3.7, y / 3.2 + 1.3, seedV) * 0.55 + noise2(x / 3 + 0.4, y / 1.9 + 0.9, seedV + 5) * 0.45;
      return hc + (hv - hc) * wv;
    };
  }
  function soilTile(variant, o) {
    var b = tile(), h = soilField(o.seed, o.seed + 31 + variant * 17), x, y, F = new Float32Array(18 * 18);
    for (y = -1; y <= 16; y++) for (x = -1; x <= 16; x++) F[(y + 1) * 18 + x + 1] = h(x, y);
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      var l = F[y * 18 + x] - F[(y + 2) * 18 + x + 2];
      b.data[y * 16 + x] = sh(o.ramp, o.base + l * o.gain + (F[(y + 1) * 18 + x + 1] - 0.5) * o.amb, x, y, o.dither);
    }
    return b;
  }

  /** Grass cap painted over the top rows of a soil tile. o.ramp = 6 greens dark->light. */
  function turf(b, variant, o) {
    var x, y, g = o.ramp, dp = o.depth;
    for (x = 0; x < 16; x++) {
      var hv = hash2(x, variant * 3 + 1, o.seed), hb = hash2(x, variant * 3 + 2, o.seed + 5);
      var tooth = hv < 0.2 ? 2 : (hv < 0.52 ? 1 : 0), d = dp + tooth;
      var bo = hb < 0.22 ? -1 : (hb > 0.76 ? 1 : 0);
      for (y = 0; y < d; y++) {
        var lv;
        if (y === 0) lv = 4 + (bo > 0 ? 1 : 0) - (hb < 0.1 ? 1 : 0);
        else if (y === 1) lv = 3 + (bo > 0 ? 1 : 0) - (bo < 0 ? 1 : 0);
        else if (y < dp - 1) lv = 2 + (bo > 0 ? 1 : 0);
        else if (y === dp - 1) lv = (bo > 0 ? 2 : 1) + (hash2(x, y, o.seed + 9 + variant) > 0.6 ? 1 : 0);
        else lv = y === d - 1 ? 0 : 1;
        b.data[y * 16 + x] = g[lv];
      }
      b.data[d * 16 + x] = o.shadow;
      if (hash2(x, variant + 40, o.seed) < 0.5) b.data[(d + 1) * 16 + x] = o.shadow2;
    }
  }

  /* ---------------------------------------------------------------------- *
   *  masonry: coursed blocks with bevelled faces
   *    o.courses = [[y0, y1], ...]   block rows (inclusive); row y1+1 is the bed joint
   *    lay[c]    = { j: [x...], cross: bool }   head-joint columns of course c.
   *                cross=false -> j must contain 15 (joint on the tile border);
   *                cross=true  -> a block straddles the border: its look is shared by all variants.
   * ---------------------------------------------------------------------- */
  function face(b, x0, y0, x1, y1, p) {
    var x, y, v, n, sp;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      v = p.base;
      n = p.shared ? pnoise(x, y, 4, 4, p.seed) : noise2(x / 3.5 + 0.3, y / 3.5 + 0.7, p.seed);
      v += (n - 0.5) * 2 * p.rough;
      sp = hash2(x, y, p.seed + 3);
      if (sp > 1 - p.pit) v -= 1; else if (sp < p.pit * 0.6) v += 0.7;
      if (y === y0) v += p.hi; else if (y === y1 && y1 - y0 >= 2) v -= p.lo;
      if (!p.openL && x === x0) v += p.hi * 0.6;
      if (!p.openR && x === x1) v -= p.lo * 0.8;
      b.data[y * 16 + x] = sh(p.ramp, v, x, y, p.dither);
    }
  }
  function masonry(o, lay, vseed) {
    var b = tile(), ci, j;
    b.clear(o.mortar);
    for (ci = 0; ci < o.courses.length; ci++) {
      if (o.skip && o.skip[ci]) continue;
      var y0 = o.courses[ci][0], y1 = o.courses[ci][1], L = lay[ci], J = L.j.slice().sort(function (a, c) { return a - c; });
      var spans = [], start = 0;
      for (j = 0; j < J.length; j++) { if (J[j] - 1 >= start) spans.push([start, J[j] - 1]); start = J[j] + 1; }
      if (start <= 15) spans.push([start, 15]);
      for (j = 0; j < spans.length; j++) {
        var s = spans[j], cl = !!L.cross && s[0] === 0, cr = !!L.cross && s[1] === 15, shared = cl || cr;
        var seed = shared ? o.seed + ci * 13 : o.seed + 100 + vseed * 31 + ci * 13 + j * 7;
        var base = o.base + (o.cbase ? o.cbase[ci] : 0) + (shared ? 0 : (hash2(j, ci, seed) - 0.5) * 2 * o.vary);
        face(b, s[0], y0, s[1], y1, {
          ramp: o.ramp, base: base, seed: seed, shared: shared, openL: cl, openR: cr,
          hi: o.hi, lo: o.lo, rough: o.rough, pit: o.pit, dither: o.dither
        });
        // worn corners (never on the shared ends that touch the border)
        if (o.chip) {
          if (!cl && hash2(s[0], y0, seed + 5) < o.chip) b.data[y0 * 16 + s[0]] = o.mortar;
          if (!cr && hash2(s[1], y0, seed + 6) < o.chip) b.data[y0 * 16 + s[1]] = o.mortar;
          if (!cl && hash2(s[0], y1, seed + 7) < o.chip) b.data[y1 * 16 + s[0]] = o.mortar;
          if (!cr && hash2(s[1], y1, seed + 8) < o.chip) b.data[y1 * 16 + s[1]] = o.mortar;
        }
      }
    }
    return b;
  }

  /** Pointed stake / spike body. shade(u, t, x, y): u 0 left..1 right, t 0 tip..1 base. */
  function spike(b, xl, xr, tx, ty, yb, shade) {
    for (var y = ty; y <= yb; y++) {
      var t = (y - ty) / Math.max(1, yb - ty);
      var a = Math.round(tx + (xl - tx) * t), c = Math.round(tx + (xr - tx) * t);
      for (var x = a; x <= c; x++) b.pset(x, y, shade(c > a ? (x - a) / (c - a) : 0.5, t, x, y));
    }
  }

  /* ---------------------------------------------------------------------- *
   *  dead tree: limbs are tapered capsules shaded as cylinders, bark streaks along the limb
   * ---------------------------------------------------------------------- */
  function treeBuf(w, h) { var v = new Float32Array(w * h); for (var i = 0; i < v.length; i++) v[i] = -1; return { w: w, h: h, v: v }; }
  function limb(buf, pts, seed) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], c = pts[i + 1], dx = c[0] - a[0], dy = c[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len, nx = -uy, ny = ux, rm = Math.max(a[2], c[2]) + 1;
      var x0 = Math.max(0, Math.floor(Math.min(a[0], c[0]) - rm)), x1 = Math.min(buf.w - 1, Math.ceil(Math.max(a[0], c[0]) + rm));
      var y0 = Math.max(0, Math.floor(Math.min(a[1], c[1]) - rm)), y1 = Math.min(buf.h - 1, Math.ceil(Math.max(a[1], c[1]) + rm));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var t = ((x - a[0]) * ux + (y - a[1]) * uy) / len;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var qx = a[0] + dx * t, qy = a[1] + dy * t, ex = x - qx, ey = y - qy, d = Math.sqrt(ex * ex + ey * ey);
        var r = a[2] + (c[2] - a[2]) * t;
        if (d > r + 0.2) continue;
        var s = (ex * nx + ey * ny) / Math.max(r, 0.6);
        s = s < -1 ? -1 : (s > 1 ? 1 : s);
        var z = Math.sqrt(1 - s * s);
        var lit = (nx * s) * -0.6 + (ny * s) * -0.62 + z * 0.5;
        var along = (x - a[0]) * ux + (y - a[1]) * uy;
        var bark = hash2(Math.floor(s * r + 40), Math.floor(along / 4.5) + i * 9, seed);
        buf.v[y * buf.w + x] = 0.42 + lit * 0.52 + (bark - 0.5) * 0.22;
      }
    }
  }
  function treeBitmap(buf, ramp, dither) {
    var b = new Bitmap(buf.w, buf.h), n = ramp.length;
    for (var y = 0; y < buf.h; y++) for (var x = 0; x < buf.w; x++) {
      var v = buf.v[y * buf.w + x];
      if (v < 0) continue;
      b.data[y * buf.w + x] = sh(ramp, v * (n - 1), x, y, dither);
    }
    return b;
  }

  /* ====================================================================== *
   *  STAGE 1 — LeChuck's Ghost Ship & Mêlée Graveyard
   * ====================================================================== */
  function buildStage1() {
    var BR = RAMPS.brown, GR = RAMPS.green, TN = RAMPS.tan, SL = RAMPS.slate, MI = RAMPS.mist, BN = RAMPS.bone,
      OL = RAMPS.olive, ST = RAMPS.steel, RU = RAMPS.rust, RD = RAMPS.red, GD = RAMPS.gold;
    var SOIL = [col('dusk1'), BR[1], BR[2], BR[3], BR[4], BR[5]];
    var GRASS = [GR[1], GR[2], GR[3], GR[4], GR[5], GR[6]];
    var GY = RAMPS.gray;
    var soilO = { ramp: SOIL, seed: 101, base: 1.85, gain: 3.4, amb: 2.3, dither: 0.5 };
    var turfO = { ramp: GRASS, seed: 131, depth: 4, shadow: SOIL[0], shadow2: SOIL[1] };
    var LBONE = legend('bone');
    var LMIST = legend('mist', '1:slate1');

    /* ---------------- solid: graveyard earth ---------------- */
    function earthDecor(b, v) {
      if (v === 0) {
        pebble(b, 4.5, 10.5, 1.7, 1.2, GY, 2.9, SOIL[0]);
        pebble(b, 11.5, 4.5, 1, 0.8, GY, 2.6, SOIL[0]);
      } else if (v === 1) {
        rootLine(b, [[2, 5], [5, 6], [8, 5], [11, 7], [13, 7]], TN[2], SOIL[0]);
        b.pset(5, 6, TN[3]); b.pset(8, 5, TN[3]); b.pset(9, 4, TN[2]); b.pset(10, 3, TN[1]);
      } else if (v === 2) {
        stamp(b, 4, 8, LBONE, ['.455.', '4...3']);
        b.pset(5, 10, SOIL[0]); b.pset(8, 10, SOIL[0]);
        stamp(b, 11, 3, LBONE, ['45', '.3']);
      } else {
        pebble(b, 10.5, 9.5, 1.3, 1, GY, 2.7, SOIL[0]);
        rootLine(b, [[3, 3], [5, 5], [5, 8]], TN[2], null);
        b.pset(6, 6, SOIL[0]); b.pset(6, 9, SOIL[0]); b.pset(5, 9, TN[1]);
      }
    }
    function earth(v) { var b = soilTile(v, soilO); earthDecor(b, v); return b; }
    function earthTop(v) {
      var b = soilTile(v + 4, soilO), i;
      // rootlets dangling under the turf
      var RT = [[[3, 4], [10, 6], [13, 3]], [[5, 5], [12, 4]], [[2, 3], [7, 6], [14, 4]], [[4, 4], [9, 3], [12, 6]]][v];
      for (i = 0; i < RT.length; i++) {
        var rx = RT[i][0], n = RT[i][1];
        for (var k = 0; k < n; k++) {
          var xx = rx + ((k === 2 || k === 3) ? 1 : 0);
          b.pset(xx, 5 + k, k < n - 1 ? TN[2] : TN[1]);
          if (k < n - 1) b.pset(xx + 1, 5 + k + 1, SOIL[0]);
        }
      }
      if (v === 1) pebble(b, 8.5, 11.5, 1.5, 1.1, GY, 2.8, SOIL[0]);
      if (v === 3) stamp(b, 5, 11, LBONE, ['.45.', '4..3']);
      turf(b, v, turfO);
      return b;
    }

    /* ---------------- alt: ship hull / worn deck ---------------- */
    var STR = [[0, 3], [5, 9], [11, 14]];          // strakes; seams on rows 4, 10, 15
    var HBASE = [2.9, 2.5, 2.8];
    function nail(b, x, y) { b.pset(x, y, ST[1]); b.pset(x, y + 1, RU[2]); }
    function hull(v, top) {
      var b = tile(), s, x, y;
      b.clear(BR[0]);
      for (s = top ? 1 : 0; s < 3; s++) {
        var y0 = STR[s][0], y1 = STR[s][1];
        for (y = y0; y <= y1; y++) for (x = 0; x < 16; x++) {
          var g = pn1(x, 8, 211 + s * 5, y) * 0.6 + pn1(x, 4, 223 + s * 5, y) * 0.4, wv = win(x);
          if (wv > 0) {
            var gv = noise2(x / 7 + 1.3, 0.5, 300 + v * 37 + y * 11) * 0.6 + noise2(x / 3.5 + 0.2, 0.5, 340 + v * 37 + y * 11) * 0.4;
            g += (gv - g) * wv;
          }
          var val = HBASE[s] + (y === y0 ? 0.9 : 0) - (y === y1 ? 0.8 : 0) + (g > 0.63 ? -1 : (g < 0.3 ? 0.5 : 0));
          if (top && s === 1 && y === y0) val -= 1.5;      // shadow of the deck lip
          b.data[y * 16 + x] = sh(BR, val, x, y, 0.35);
        }
      }
      function butt(s, x) {
        var y0 = STR[s][0], y1 = STR[s][1];
        for (var y = y0; y <= y1; y++) { b.pset(x, y, BR[0]); b.pset(x + 1, y, BR[y === y0 ? 5 : 4]); b.pset(x - 1, y, BR[2]); }
        nail(b, x - 3, y0 + 1); nail(b, x + 3, y0 + 1);
      }
      function slime(x, y, n, c) { for (var i = 0; i < n; i++) if (b.data[(y + i) * 16 + x] !== BR[0]) b.pset(x, y + i, c); }
      function knot(x, y) { b.pset(x, y, BR[1]); b.pset(x + 1, y, BR[1]); b.pset(x - 1, y, BR[4]); b.pset(x + 2, y, BR[2]); b.pset(x, y - 1, BR[2]); b.pset(x + 1, y - 1, BR[2]); }
      if (v === 0) {
        butt(1, 6);
        slime(11, 5, 3, OL[3]); slime(12, 5, 2, OL[2]); slime(10, 5, 1, OL[2]);
        knot(3, 13);
        if (!top) { nail(b, 2, 1); nail(b, 13, 1); }
      } else if (v === 1) {
        if (!top) butt(0, 10); else nail(b, 4, 7);
        b.pset(3, 9, BR[0]); b.pset(4, 9, BR[0]); b.pset(5, 9, BR[1]);      // rot notch above the seam
        b.pset(11, 13, BN[4]); b.pset(12, 13, BN[3]); b.pset(13, 12, BN[4]); b.pset(11, 14, BR[1]);   // barnacles
        slime(7, 11, 2, OL[2]);
      } else if (v === 2) {
        butt(2, 8);
        slime(2, 5, 2, OL[3]); slime(3, 5, 3, OL[2]); slime(4, 5, 1, OL[3]);
        if (!top) knot(11, 2);
        nail(b, 12, 7);
      } else {
        for (x = 3; x <= 10; x++) b.pset(x, x < 7 ? 7 : 8, BR[1]);          // long split in the plank
        b.pset(11, 8, BR[2]);
        slime(5, 11, 3, OL[2]); slime(6, 11, 2, OL[3]);
        if (!top) { nail(b, 5, 1); nail(b, 12, 2); }
        nail(b, 13, 12);
      }
      return b;
    }
    function deck(v) {
      var b = hull(v, true), x;
      for (x = 0; x < 16; x++) {
        var joint = (x & 7) === 7, wear = hash2(x, v, 707);
        b.pset(x, 0, joint ? TN[3] : TN[wear < 0.16 ? 4 : (wear > 0.82 ? 6 : 5)]);
        b.pset(x, 1, joint ? BR[2] : TN[hash2(x, v + 9, 708) < 0.22 ? 3 : 4]);
        b.pset(x, 2, joint ? BR[1] : ((x & 7) === 0 ? TN[4] : TN[3]));
        b.pset(x, 3, joint ? BR[1] : BR[3]);
        b.pset(x, 4, BR[0]);
      }
      b.pset(3 + (v & 1), 2, BR[1]); b.pset(11 + ((v >> 1) & 1), 2, BR[1]);
      return b;
    }

    /* ---------------- back: crypt stone wall ---------------- */
    var cryptO = {
      ramp: [SL[0], SL[1], SL[2], SL[3]], mortar: SL[0], courses: [[0, 4], [6, 9], [11, 14]],
      base: 1.3, vary: 0.22, hi: 0.5, lo: 0.4, rough: 0.3, pit: 0.03, dither: 0.9, seed: 500, chip: 0
    };
    var cryptLay = [
      [{ j: [5], cross: true }, { j: [8], cross: true }, { j: [3, 11], cross: true }],
      [{ j: [9], cross: true }, { j: [2, 13], cross: true }, { j: [7], cross: true }],
      [{ j: [13], cross: true }, { j: [6], cross: true }, { j: [11], cross: true }],
      [{ j: [1, 9], cross: true }, { j: [12], cross: true }, { j: [3], cross: true }]
    ];
    function crypt(v) {
      var b = masonry(cryptO, cryptLay[v], v);
      if (v === 1) { crackLine(b, [[5, 6], [6, 8], [5, 9]], SL[0], null); }
      if (v === 2) { reramp(b, RAMPS.zombie, 0, function (x, y) { return y >= 11 && x >= 2 && x <= 7 && hash2(x, y, 77) < 0.55; }); }
      if (v === 3) { b.pset(11, 2, SL[0]); b.pset(12, 2, SL[0]); b.pset(12, 3, SL[0]); }
      return b;
    }

    /* ---------------- backAlt: ship-cabin plank wall ---------------- */
    function cabin(v) {
      var b = tile(), s, x, y, VB = [[0, 3], [5, 9], [11, 14]], R = [K, BR[0], BR[1], BR[2], BR[3]];
      b.clear(BR[0]);
      for (s = 0; s < 3; s++) for (x = VB[s][0]; x <= VB[s][1]; x++) for (y = 0; y < 16; y++) {
        var g = pn1(y, 8, 611 + s * 3, x) * 0.6 + pn1(y, 4, 617 + s * 3, x) * 0.4, wv = win(y);
        if (wv > 0) { var gv = noise2(0.5, y / 6 + 2.1, 650 + v * 29 + x * 7) * 0.6 + noise2(0.5, y / 3 + 0.6, 690 + v * 29 + x * 7) * 0.4; g += (gv - g) * wv; }
        var val = [2.2, 1.9, 2.15][s] + (x === VB[s][0] ? 0.55 : 0) - (x === VB[s][1] ? 0.4 : 0) + (g > 0.66 ? -0.7 : (g < 0.26 ? 0.4 : 0));
        b.data[y * 16 + x] = sh(R, val, x, y, 0.5);
      }
      // horizontal batten nailed across the boards (same rows in every variant -> runs unbroken)
      for (x = 0; x < 16; x++) {
        var gb = pn1(x, 8, 633, 1) * 0.6 + pn1(x, 4, 635, 2) * 0.4;
        b.pset(x, 5, BR[gb > 0.7 ? 2 : 3]); b.pset(x, 6, BR[gb < 0.3 ? 3 : 2]); b.pset(x, 7, BR[1]); b.pset(x, 8, K);
        if (b.data[9 * 16 + x] !== BR[0]) b.pset(x, 9, BR[1]);
      }
      b.pset(2, 6, K); b.pset(7, 6, K); b.pset(13, 6, K);
      if (v === 0) { b.pset(7, 12, K); b.pset(8, 12, BR[0]); b.pset(6, 12, BR[2]); b.pset(7, 11, BR[2]); }
      else { for (y = 0; y < 4; y++) b.pset(12 + (y > 1 ? 1 : 0), y, K); b.pset(2, 13, K); b.pset(2, 12, BR[2]); }
      return b;
    }

    /* ---------------- platform: wooden plank ---------------- */
    function plat(kind) {
      var b = tile(), x0 = kind === 0 ? 1 : 0, x1 = kind === 2 ? 14 : 15, x, y;
      board(b, x0, 0, x1, 4, { ramp: BR, base: 4, seed: 801 + kind * 3, prof: [1.8, 0.9, 0, -0.5, -1.5] });
      for (x = x0; x <= x1; x++) b.pset(x, 5, K);
      if (kind !== 2) { b.pset(15, 0, BR[4]); for (y = 1; y <= 4; y++) b.pset(15, y, BR[1]); }
      if (kind === 0) {
        b.pset(1, 0, BR[4]); for (y = 1; y <= 4; y++) { b.pset(1, y, BR[y < 3 ? 3 : 2]); b.pset(0, y, K); }
        vrope(b, 3, 0, 5, TN[5], TN[3]); b.pset(3, 6, TN[4]); b.pset(4, 6, TN[2]); b.pset(3, 7, TN[3]); b.pset(3, 8, TN[2]);
        b.pset(12, 2, ST[1]);
      } else if (kind === 2) {
        b.pset(14, 0, BR[4]); for (y = 1; y <= 4; y++) { b.pset(14, y, BR[2]); b.pset(15, y, K); }
        vrope(b, 11, 0, 5, TN[5], TN[3]); b.pset(11, 6, TN[4]); b.pset(12, 6, TN[2]); b.pset(12, 7, TN[3]);
        b.pset(3, 2, ST[1]);
      } else { b.pset(3, 2, ST[1]); b.pset(12, 2, ST[1]); }
      return b;
    }

    /* ---------------- ladder: rope ladder ---------------- */
    function ladder() {
      var b = tile(), i, y;
      vrope(b, 3, 0, 15, TN[5], TN[3]); vrope(b, 11, 0, 15, TN[5], TN[3]);
      for (i = 0; i < 2; i++) {
        y = 3 + i * 8;
        b.rect(2, y, 12, 1, BR[5]); b.rect(2, y + 1, 12, 1, BR[3]);
        b.pset(2, y, BR[4]); b.pset(13, y, BR[4]); b.pset(13, y + 1, BR[2]);
        b.pset(3, y, TN[6]); b.pset(4, y, TN[4]); b.pset(11, y, TN[6]); b.pset(12, y, TN[4]);
        b.pset(3, y + 1, TN[4]); b.pset(4, y + 1, TN[2]); b.pset(11, y + 1, TN[4]); b.pset(12, y + 1, TN[2]);
        b.pset(3, y + 2, TN[2]); b.pset(4, y + 2, TN[2]); b.pset(11, y + 2, TN[2]); b.pset(12, y + 2, TN[2]);
        b.pset(6 + i * 3, y + 1, BR[2]);
      }
      return b;
    }

    /* ---------------- spikes: sharpened wooden stakes ---------------- */
    function stakes(v) {
      var b = tile(), i, x, y;
      var S = v === 0 ? [[1, 5, 2], [6, 3, 8], [11, 6, 13]] : [[1, 6, 3], [6, 4, 7], [11, 3, 12]];   // x0, tipY, tipX
      var WOOD = [BR[5], BR[4], BR[3], BR[2]], CUT = [TN[6], TN[5], TN[4], BR[4]], WD = [1, 1, 2, 2, 3, 3];
      for (i = 0; i < 3; i++) {
        var x0 = S[i][0], ty = S[i][1], tx = S[i][2];
        for (y = ty; y < 16; y++) {
          var r = y - ty, wd = r < 6 ? WD[r] : 4, xa = clampi(tx - (wd >> 1), x0, x0 + 4 - wd);
          for (x = xa; x < xa + wd; x++) {
            var u = x - x0, c = r < 6 ? CUT[clampi(x - xa + (wd < 3 ? 0 : 1) + (x - xa === wd - 1 && wd > 1 ? 1 : 0), 0, 3)] : WOOD[u];
            if (r >= 6 && hash2(x, y, 900 + v * 7 + i) < 0.14) c = BR[u < 2 ? 3 : 1];
            b.pset(x, y, c);
          }
        }
      }
      // blood on one tip
      var bi = v === 0 ? 1 : 2, bx = S[bi][2], by = S[bi][1];
      b.pset(bx, by, RD[4]); b.pset(bx, by + 1, RD[4]); b.pset(bx, by + 2, RD[3]); b.pset(bx - 1, by + 3, RD[3]); b.pset(bx, by + 4, RD[2]);
      b.outline(K);
      // lashing rope across the palisade
      hrope(b, 0, 15, 12, TN[4], TN[2]);
      for (x = 0; x < 16; x++) if (b.data[14 * 16 + x] && b.data[14 * 16 + x] !== K) b.pset(x, 14, BR[1]);
      return b;
    }

    /* ---------------- cracked ---------------- */
    function cracks(b, top) {
      var D = K, L = SOIL[4];
      crackLine(b, [[7, top ? 0 : 0], [6, 3], [8, 6], [7, 9], [9, 12], [8, 15]], D, L);
      crackLine(b, [[8, 6], [11, 8], [13, 7]], D, null);
      crackLine(b, [[7, 9], [4, 11], [3, 13]], D, null);
      b.pset(12, 8, L); b.pset(4, 12, L);
      if (top) { b.pset(6, 0, D); b.pset(8, 0, D); b.pset(7, 1, D); b.pset(6, 1, GRASS[1]); b.pset(8, 1, GRASS[1]); b.pset(5, 0, GRASS[2]); b.pset(9, 0, GRASS[2]); }
      else { b.pset(6, 0, D); }
      // secondary hairlines
      crackLine(b, [[2, top ? 6 : 2], [3, top ? 8 : 5]], SOIL[0], null);
      crackLine(b, [[12, 11], [13, 14]], SOIL[0], null);
    }
    function crackedTop() { var b = soilTile(8, soilO); turf(b, 1, turfO); cracks(b, true); return b; }
    function crackedIn() { var b = soilTile(9, soilO); cracks(b, false); return b; }

    /* ---------------- bridge: rope-bridge plank ---------------- */
    function bridge(v) {
      var b = tile(), i, x;
      hrope(b, 0, 15, 3, TN[5], TN[3]);
      for (x = 0; x < 16; x++) b.pset(x, 5, (x & 3) === 1 ? TN[2] : 0);
      for (i = 0; i < 2; i++) {
        var x0 = i * 8, dy = (v === 1 && i === 1) ? 1 : 0;
        board(b, x0, dy, x0 + 6, 2 + dy, { ramp: BR, base: 4, seed: 850 + i + v * 5, prof: [1.7, 0.4, -1.2] });
        b.pset(x0 + 3, dy, TN[5]); b.pset(x0 + 3, 1 + dy, TN[4]); b.pset(x0 + 3, 2 + dy, TN[3]);     // lashing
        b.pset(x0, 2 + dy, BR[2]); b.pset(x0 + 6, 2 + dy, BR[2]);
        if (dy) { b.pset(x0 + 7, 0, 0); }
      }
      if (v === 1) {
        // split plank + frayed rope
        b.pset(2, 0, K); b.pset(1, 1, K); b.pset(2, 1, BR[2]); b.pset(1, 2, K); b.pset(5, 0, BR[3]); b.pset(5, 1, K); b.pset(4, 2, K);
        b.pset(12, 1, K); b.pset(13, 2, K); b.pset(12, 2, BR[2]); b.pset(13, 3, K);
        b.pset(7, 5, TN[4]); b.pset(7, 6, TN[3]); b.pset(6, 7, TN[3]); b.pset(7, 3, TN[2]); b.pset(7, 4, 0);
        b.pset(10, 5, TN[3]); b.pset(10, 6, TN[2]);
      }
      return b;
    }

    /* ---------------- conveyor: plank treadmill on log rollers ---------------- */
    function conveyor(f) {
      var b = tile(), x, y, i;
      b.clear(K);
      for (x = 0; x < 16; x++) {
        var ph = ((x - f * 2) % 8 + 8) % 8, gap = ph >= 6;
        b.pset(x, 0, gap ? BR[1] : (ph === 0 ? TN[6] : TN[5]));
        b.pset(x, 1, gap ? BR[0] : BR[ph === 5 ? 3 : 4]);
        b.pset(x, 2, gap ? K : BR[2]);
        var pb = ((x + f * 2) % 8 + 8) % 8, gb = pb >= 6;       // return run moves the other way
        b.pset(x, 13, gb ? K : BR[2]); b.pset(x, 14, gb ? K : BR[1]); b.pset(x, 15, K);
      }
      for (i = 0; i < 2; i++) {
        var cx = 3.5 + i * 8, cy = 7.5, a = f * Math.PI / 8;
        for (y = 4; y <= 11; y++) for (x = i * 8; x < i * 8 + 8; x++) {
          var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
          if (d > 3.9) { b.pset(x, y, y < 8 ? BR[0] : K); continue; }
          var c = d > 2.9 ? (dx + dy < -1 ? BR[5] : (dx + dy > 2 ? BR[2] : BR[4])) : BR[3];
          // rotating cross-cut marks
          var ang = Math.atan2(dy, dx) - a, q = Math.abs(Math.sin(ang * 2));
          if (d <= 2.9 && d > 0.8 && q < 0.38) c = BR[1];
          if (d <= 0.8) c = ST[3];
          b.pset(x, y, c);
        }
      }
      b.rect(0, 3, 16, 1, K); b.rect(0, 12, 16, 1, K);
      return b;
    }

    /* ---------------- props ---------------- */
    var stoneO = { base: 3.3, hi: 1.5, lo: 1.5, rough: 0.35, dither: 0.35, grad: 0.5 };
    function stone(m, seed) { return shadeSil(m, MI, { base: stoneO.base, hi: stoneO.hi, lo: stoneO.lo, rough: stoneO.rough, dither: stoneO.dither, grad: stoneO.grad, seed: seed }); }
    function mossFoot(b, seed, rows) {
      reramp(b, OL, -1, function (x, y) { return y >= b.h - rows && hash2(x, y, seed) < 0.25 + 0.6 * ((y - (b.h - rows)) / rows); });
    }
    function tufts(b, list) {      // [[x, h, shade], ...] little grass blades at the foot
      for (var i = 0; i < list.length; i++) for (var k = 0; k < list[i][1]; k++) b.pset(list[i][0], b.h - 1 - k, GRASS[clampi(list[i][2] + (k === list[i][1] - 1 ? 1 : 0), 0, 5)]);
    }

    function graveRound() {
      var m = new Bitmap(16, 20), x, y;
      for (y = 1; y < 20; y++) for (x = 2; x <= 13; x++) {
        if (y < 7) { var dx = x - 7.5, dy = y - 7; if (dx * dx + dy * dy > 6.2 * 6.2) continue; }
        m.data[y * 16 + x] = 1;
      }
      var b = stone(m, 901);
      stamp(b, 3, 6, LMIST, ['11..1.11.', '1.1.1.1.1', '11..1.11.', '1.1.1.1..', '1.1.1.1..']);
      b.hline(4, 13, 7, SL[2]); b.hline(5, 15, 5, SL[2]);
      crackLine(b, [[11, 2], [10, 4], [11, 5]], MI[1], null);
      mossFoot(b, 31, 5);
      b.outline(K);
      tufts(b, [[1, 2, 2], [2, 3, 3], [4, 1, 2], [9, 2, 2], [13, 3, 3], [14, 2, 2], [15, 1, 1]]);
      return b;
    }
    function graveTilt() {
      var m = new Bitmap(18, 20), x, y;
      for (y = 1; y < 20; y++) for (x = 1; x <= 11; x++) {
        if (y < 6 && Math.abs(x - 6) > (y - 1) * 1.25 + 0.6) continue;
        if (y < 8 && x >= 10 && (x - 10) + (7 - y) >= 2) continue;        // broken corner
        m.data[y * 18 + x] = 1;
      }
      var b = stone(m, 911);
      stamp(b, 4, 7, LMIST, ['.111.', '11111', '1.1.1', '11111', '.1.1.']);
      b.hline(3, 14, 6, SL[2]); b.hline(4, 16, 4, SL[2]);
      crackLine(b, [[2, 9], [3, 11], [2, 13]], MI[1], null);
      mossFoot(b, 37, 5);
      b = shearRows(b, function (yy) { return Math.round((19 - yy) * 0.26); });
      b.outline(K);
      tufts(b, [[0, 2, 2], [1, 1, 3], [3, 2, 2], [8, 1, 2], [11, 3, 3], [12, 2, 2], [13, 1, 2]]);
      return b;
    }
    function graveCross() {
      var m = new Bitmap(16, 24), x, y;
      function R(x0, y0, x1, y1) { for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) m.data[yy * 16 + xx] = 1; }
      R(6, 1, 9, 19); R(1, 6, 14, 9); R(4, 18, 11, 20); R(3, 21, 12, 23);
      for (y = 1; y < 15; y++) for (x = 1; x < 15; x++) { var d = Math.sqrt((x - 7.5) * (x - 7.5) + (y - 7.5) * (y - 7.5)); if (d >= 4.5 && d <= 5.5) m.data[y * 16 + x] = 1; }
      var b = stone(m, 921);
      crackLine(b, [[7, 11], [8, 13], [7, 15]], MI[1], null);
      b.pset(7, 7, MI[2]); b.pset(8, 7, MI[2]); b.pset(7, 8, MI[2]); b.pset(8, 8, MI[5]);
      mossFoot(b, 41, 6);
      b.outline(K);
      tufts(b, [[1, 2, 2], [2, 3, 3], [3, 1, 2], [12, 2, 3], [13, 3, 2], [14, 1, 2]]);
      return b;
    }

    function deadTree() {
      var buf = treeBuf(48, 64);
      // roots
      limb(buf, [[21, 59, 3], [14, 62, 2], [8, 63.4, 1.1]], 3);
      limb(buf, [[26, 59, 3], [33, 62, 2.2], [40, 63.4, 1.1]], 4);
      // low branches (behind the trunk)
      limb(buf, [[24, 45, 2.4], [31, 41, 1.8], [37, 42, 1.2], [41, 46, 0.6]], 5);
      limb(buf, [[20, 47, 2.2], [14, 44, 1.8], [11, 44.5, 1.4]], 6);
      // trunk
      limb(buf, [[24, 63, 6], [23, 56, 5.2], [21, 48, 4.6], [21, 40, 4.2], [23, 33, 4]], 1);
      // main limbs
      limb(buf, [[22, 34, 3.4], [15, 27, 2.8], [10, 19, 2.1], [7, 11, 1.4], [3, 6, 0.6]], 7);
      limb(buf, [[24, 34, 3.2], [31, 29, 2.6], [38, 25, 2], [42, 17, 1.4], [45, 9, 0.8], [44, 4, 0.4]], 8);
      limb(buf, [[23, 33, 3.2], [25, 24, 2.6], [23, 15, 1.9], [25, 8, 1.2], [23, 2, 0.5]], 9);
      // twigs
      limb(buf, [[10, 19, 1.2], [4, 17, 0.8], [1, 13, 0.4]], 10);
      limb(buf, [[7, 11, 1], [9, 5, 0.6], [8, 1, 0.4]], 11);
      limb(buf, [[23, 15, 1.2], [18, 10, 0.8], [17, 5, 0.4]], 12);
      limb(buf, [[25, 8, 0.9], [29, 4, 0.5]], 13);
      limb(buf, [[38, 25, 1.3], [44, 26, 0.9], [46.5, 30, 0.5]], 14);
      limb(buf, [[42, 17, 1], [37, 12, 0.7], [36, 7, 0.4]], 15);
      limb(buf, [[15, 27, 1.2], [10, 28, 0.8], [7, 32, 0.5]], 16);
      limb(buf, [[31, 29, 1.2], [33, 22, 0.8], [31, 17, 0.4]], 17);
      var b = treeBitmap(buf, [K, col('dusk1'), BR[1], BR[2], BR[3], TN[3]], 0.45);
      // hollow + scowl in the bark
      b.rect(19, 41, 2, 2, K); b.pset(18, 41, BR[1]); b.rect(23, 40, 2, 2, K); b.pset(25, 40, BR[1]);
      b.pset(20, 46, K); b.pset(21, 47, K); b.pset(22, 47, K); b.pset(23, 46, K); b.pset(24, 46, K); b.pset(22, 48, BR[1]);
      b.pset(11, 43, TN[4]); b.pset(10, 44, TN[5]); b.pset(10, 45, TN[3]);      // snapped stub: pale heartwood
      b.outline(K);
      return b;
    }

    function fence() {
      var b = new Bitmap(32, 16), i, x, y;
      for (x = 0; x < 32; x++) { b.pset(x, 5, ST[3]); b.pset(x, 6, ST[1]); b.pset(x, 12, ST[3]); b.pset(x, 13, ST[1]); }
      for (i = 0; i < 8; i++) {
        if (i === 3 || i === 4) continue;
        x = i * 4 + 1;
        var broken = i === 6, lean = i === 1 ? 1 : 0;
        for (y = broken ? 4 : 2; y < 16; y++) { var xx = x + (lean && y < 5 ? 1 : 0); b.pset(xx, y, ST[3]); b.pset(xx + 1, y, ST[1]); }
        if (!broken) {
          x += lean;
          b.pset(x, 0, ST[5]); b.pset(x + 1, 0, ST[3]);
          b.pset(x - 1, 1, ST[4]); b.pset(x, 1, ST[4]); b.pset(x + 1, 1, ST[2]); b.pset(x + 2, 1, ST[1]);
        }
      }
      // centre post with a ball finial
      for (y = 3; y < 16; y++) { b.pset(14, y, ST[4]); b.pset(15, y, ST[3]); b.pset(16, y, ST[2]); b.pset(17, y, ST[1]); }
      b.pset(15, 0, ST[5]); b.pset(16, 0, ST[3]);
      b.pset(14, 1, ST[5]); b.pset(15, 1, ST[4]); b.pset(16, 1, ST[3]); b.pset(17, 1, ST[1]);
      b.pset(15, 2, ST[3]); b.pset(16, 2, ST[1]);
      b.rect(13, 5, 6, 1, ST[4]); b.rect(13, 6, 6, 1, ST[1]); b.rect(13, 12, 6, 1, ST[4]); b.rect(13, 13, 6, 1, ST[1]);
      return b;
    }

    function lantern() {
      var LL = legend('steel', 'a:glow2 b:glow3 c:glow4 d:glow5 e:glow6 m:brown4 n:brown2 o:brown3 p:brown5');
      return art(LL, [
        '....kk....',
        '...k43k...',
        '..k4332k..',
        '.k443221k.',
        'k44332211k',
        '.kabccdek.',
        '.kbcwwcdk.',
        '.kbcwwcdk.',
        '.kabccdek.',
        'k33222111k',
        '.kk3221kk.',
        '...kpnk...',
        '..kkmnkk..',
        '..kpmnnk..',
        '..kkmnkk..',
        '...kmnk...',
        '...kpnk...',
        '...kmnk...',
        '...kmnk...',
        '...kmok...',
        '...kpnk...',
        '...kmnk...',
        '...konk...',
        '...kmnk...',
        '...kpnk...',
        '...kmnk...',
        '...kmnk...',
        '...kmok...',
        '...kpnk...',
        '...kmnk...',
        '...kmnk...',
        '..kpmnnk..',
        '.kpmmonnk.',
        '.kmmoonnk.'
      ]);
    }

    function crate() {
      var b = new Bitmap(16, 16), i;
      b.rect(0, 0, 16, 16, K);
      board(b, 3, 3, 12, 7, { ramp: BR, base: 3, seed: 61, prof: [0.6, 0, 0, 0, -0.8] });
      board(b, 3, 8, 12, 12, { ramp: BR, base: 3, seed: 67, prof: [0.6, 0, 0, 0, -0.8] });
      // frame
      board(b, 1, 1, 14, 2, { ramp: BR, base: 4.4, seed: 71, prof: [1.2, -0.6] });
      board(b, 1, 13, 14, 14, { ramp: BR, base: 4.2, seed: 73, prof: [0.6, -1.4] });
      vboard(b, 1, 3, 2, 12, { ramp: BR, base: 4.4, seed: 75, prof: [1, -0.6] });
      vboard(b, 13, 3, 14, 12, { ramp: BR, base: 4.0, seed: 77, prof: [0.4, -1.2] });
      for (i = 3; i <= 12; i++) { b.pset(i, 3, BR[1]); b.pset(3, i, BR[1]); }      // shadow cast by the frame
      b.pset(2, 2, ST[1]); b.pset(13, 2, ST[1]); b.pset(2, 13, ST[1]); b.pset(13, 13, ST[1]);
      stamp(b, 5, 6, legend('gold', 'n:brown1'), ['....5n', '...55.', '.455..', '44....']);
      return b;
    }

    function barrelUp(b, x0, y0, w, h, lite) {
      var x, y;
      for (y = 0; y < h; y++) {
        var inset = (y === 0 || y === h - 1) ? 2 : ((y < 3 || y > h - 4) ? 1 : 0);
        var xa = x0 + inset, xb = x0 + w - 1 - inset, hoop = (y === 2 || y === 3 || y === h - 4 || y === h - 3);
        for (x = xa; x <= xb; x++) {
          var u = (x - xa) / (xb - xa), lv = u < 0.1 ? 3 : (u < 0.38 ? 5 : (u < 0.62 ? 4 : (u < 0.85 ? 3 : 2)));
          lv += lite;
          var c;
          if (hoop) c = ST[clampi(lv - 1 - (y === 3 || y === h - 3 ? 1 : 0), 1, 5)];
          else { c = BR[clampi(lv, 1, 6)]; if (((x - x0) % 3) === 2) c = BR[clampi(lv - 2, 1, 6)]; }
          if (y === 0) c = TN[clampi(lv, 2, 5)];
          b.pset(x, y0 + y, c);
        }
      }
    }
    function barrels() {
      var b = new Bitmap(24, 24), x, y;
      barrelUp(b, 1, 10, 11, 14, 0);
      barrelUp(b, 12, 11, 11, 13, -1);
      // third barrel on its side, end towards us
      var cx = 12, cy = 6.5;
      for (y = 0; y < 14; y++) for (x = 5; x < 20; x++) {
        var dx = x - cx + 0.5, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 6.3) continue;
        var c;
        if (d > 5.2) c = ST[dx + dy < -3 ? 5 : (dx + dy > 3 ? 2 : 3)];
        else if (d > 4.3) c = BR[dx + dy < -2 ? 3 : (dx + dy > 2 ? 2 : 2)];
        else { c = BR[dx + dy < -2 ? 6 : (dx + dy > 3 ? 4 : 5)]; if (y === 4 || y === 8) c = BR[3]; }
        b.pset(x, y, c);
      }
      b.pset(11, 6, BR[1]); b.pset(12, 6, BR[1]);
      // spigot + a drip of caustic grog
      b.pset(11, 10, ST[4]); b.pset(12, 10, ST[2]); b.pset(11, 11, ST[3]); b.pset(12, 11, ST[1]);
      b.outline(K);
      b.pset(11, 13, RAMPS.toxic[4]); b.pset(11, 14, RAMPS.toxic[3]); b.pset(11, 16, RAMPS.toxic[4]);
      return b;
    }

    function mast() {
      var b = tile(), x, y, LV = [3, 5, 5, 4, 4, 3, 3, 2];
      b.ax = 8; b.ay = 16;
      for (y = 0; y < 16; y++) {
        b.pset(3, y, K); b.pset(12, y, K);
        for (x = 4; x <= 11; x++) {
          var g = pn1(y, 8, 955, x) * 0.6 + pn1(y, 4, 957, x) * 0.4;
          b.pset(x, y, BR[clampi(LV[x - 4] + (g > 0.66 ? -1 : 0), 1, 6)]);
        }
      }
      // rope woolding
      for (y = 6; y <= 9; y++) for (x = 3; x <= 12; x++) {
        var lv = x < 5 ? 4 : (x < 8 ? 5 : (x < 10 ? 4 : 3));
        b.pset(x, y, TN[((x + y) & 1) ? lv : lv - 2]);
      }
      for (x = 3; x <= 12; x++) { b.pset(x, 5, K); b.pset(x, 10, K); }
      b.pset(2, 7, K); b.pset(2, 8, K); b.pset(13, 7, K); b.pset(13, 8, K);
      for (x = 4; x <= 11; x++) b.pset(x, 11, BR[clampi(LV[x - 4] - 2, 1, 6)]);
      return b;
    }

    function sail() {
      var w = 72, h = 48, b = new Bitmap(w, h), x, y, i;
      var CL = [MI[0], MI[1], MI[2], MI[3], MI[4], MI[5]];
      var FOOT = [];
      for (x = 0; x < w; x++) {
        var uu = (x - 4) / 63, yb = 41 - 4 * Math.sin(uu * Math.PI), seg = Math.floor(x / 3), rr = hash2(seg, 3, 733);
        FOOT.push(yb + (rr < 0.25 ? 5 * hash2(seg, 4, 733) + 1 : (rr > 0.8 ? -3 * hash2(seg, 5, 733) : 0)));
      }
      function bottomAt(x) { return FOOT[x]; }
      for (y = 6; y < h; y++) {
        var vv = (y - 6) / 35, inset = 3.2 * Math.sin(Math.min(1, vv) * Math.PI);
        for (x = 4; x <= 67; x++) {
          if (x < 4 + inset || x > 67 - inset) continue;
          if (y > bottomAt(x)) continue;
          // rips climbing up from the foot
          if ((x === 15 || (x === 16 && y > 36)) && y > 30) continue;
          if ((x === 41 || (x === 42 && y > 30) || (x === 40 && y > 34)) && y > 24) continue;
          if (x === 58 && y > 31) continue;
          var u = (x - 4) / 63;
          var fold = Math.sin(x * 0.4 + Math.sin(y * 0.13) * 1.3 + 0.6);
          var val = 2.75 + fold * 0.85 + (1 - vv) * 0.45 - u * 0.55;
          val -= fbm(x / 13, y / 13, 741, 3) > 0.56 ? 0.8 : 0;                   // grime
          if (((x - 4) % 11) === 10) val -= 0.7;                                     // sailcloth seams
          if (y > bottomAt(x) - 2) val -= 0.8;                                       // dark frayed foot
          b.data[y * w + x] = sh(CL, val, x, y, 0.6);
        }
      }
      // patch
      for (y = 12; y <= 17; y++) for (x = 24; x <= 30; x++) if (b.data[y * w + x]) b.data[y * w + x] = (x === 24 || y === 12) ? MI[4] : ((x === 30 || y === 17) ? MI[1] : MI[3]);
      b.outline(K);
      // moth-eaten holes (cut after outlining so the sky shows through), with dark frayed rims
      var HOLES = [[20, 25, 4, 5, 1], [50, 15, 3.2, 3, 2], [56, 31, 4.5, 3.5, 3], [31, 33, 2.6, 3.4, 4], [10, 14, 2, 2.4, 5]];
      for (i = 0; i < HOLES.length; i++) {
        var H = HOLES[i];
        for (y = Math.floor(H[1] - H[3] - 2); y <= H[1] + H[3] + 2; y++) for (x = Math.floor(H[0] - H[2] - 2); x <= H[0] + H[2] + 2; x++) {
          var ddx = (x - H[0]) / H[2], ddy = (y - H[1]) / H[3], dd = ddx * ddx + ddy * ddy + (hash2(x, y, 750 + H[4]) - 0.5) * 0.5;
          if (dd < 1) b.pset(x, y, 0);
          else if (dd < 1.9 && b.get(x, y) && b.get(x, y) !== K) b.pset(x, y, ddx + ddy > 0 ? MI[4] : MI[1]);
        }
      }
      // yard (spar) with lashings
      for (x = 1; x <= 70; x++) {
        var thin = (x < 7 || x > 64);
        b.pset(x, thin ? 2 : 1, K); b.pset(x, thin ? 5 : 6, K);
        if (!thin) b.pset(x, 2, BR[5]);
        b.pset(x, 3, BR[thin ? 5 : 4]); b.pset(x, 4, BR[thin ? 2 : 3]);
        if (!thin) b.pset(x, 5, BR[2]);
      }
      b.pset(0, 3, K); b.pset(0, 4, K); b.pset(71, 3, K); b.pset(71, 4, K);
      for (i = 0; i < 7; i++) { x = 8 + i * 9; for (y = 1; y <= 6; y++) { b.pset(x, y, y === 1 || y === 6 ? TN[2] : TN[(y & 1) ? 5 : 3]); b.pset(x + 1, y, y === 1 || y === 6 ? TN[2] : TN[(y & 1) ? 3 : 5]); } }
      // sheets from the clews
      b.line(5, 42, 1, 47, TN[3]); b.line(66, 42, 70, 47, TN[3]);
      return b;
    }

    function flag(f) {
      var b = new Bitmap(24, 18), c, r, x, y;
      var EM = [
        '...............',
        '.....wwwww.....',
        '....wwwwwww....',
        '....wkkwkkw....',
        '....wwwkwww....',
        '.w...wwwww...w.',
        '..ww.wkwkw.ww..',
        '....ww...ww....',
        '......www......',
        '....ww...ww....',
        '..ww.......ww..'
      ];
      for (c = 0; c < 15; c++) {
        var amp = Math.min(1.2, c * 0.18), ph = c * 0.42 + 0.3 + (f ? Math.PI : 0);
        var dy = Math.round(Math.sin(ph) * amp), slope = Math.cos(ph);
        for (r = 0; r < 11; r++) {
          if (c >= 13 && hash2(c, r, 771) < (c === 14 ? 0.5 : 0.22)) continue;      // tattered fly
          x = 9 + c; y = 2 + r + dy;
          var e = EM[r].charAt(c), col1;
          if (e === 'w') col1 = slope < -0.4 ? BN[4] : BN[6];
          else if (e === 'k') col1 = K;
          else col1 = r === 0 ? SL[3] : (slope > 0.45 ? SL[3] : (slope < -0.45 ? K : (r === 10 ? SL[1] : SL[2])));
          b.pset(x, y, col1);
        }
      }
      // staff with a gold ball, standing on the mast cap
      for (y = 2; y <= 15; y++) { b.pset(7, y, BR[5]); b.pset(8, y, BR[3]); }
      b.pset(7, 0, GD[6]); b.pset(8, 0, GD[4]); b.pset(7, 1, GD[4]); b.pset(8, 1, GD[2]);
      for (x = 6; x <= 17; x++) { b.pset(x, 16, BR[x < 9 ? 5 : 4]); b.pset(x, 17, BR[x < 15 ? 3 : 2]); }
      b.pset(6, 16, 0); b.pset(17, 16, 0);
      b.pset(6, 1, K); b.pset(9, 1, K); b.pset(6, 0, K); b.pset(9, 0, K);
      return b;
    }

    function rail() {
      var L = legend('brown');
      var b = art(L, [
        '6666666666666666',
        '5555545555555455',
        '3333333333333333',
        'kkkkkkkkkkkkkkkk',
        '..k54k....k54k..',
        '.k5543k..k5543k.',
        '.k5432k..k5432k.',
        '..k53k....k53k..',
        '..k53k....k53k..',
        '.k5432k..k5432k.',
        '4444444444444444',
        '2222222222222222'
      ]);
      return b;
    }

    function sign() {
      var b = new Bitmap(24, 24), x, y;
      vboard(b, 3, 1, 5, 23, { ramp: BR, base: 3.6, seed: 91, prof: [1.2, 0, -1.2] });       // post
      board(b, 6, 2, 21, 3, { ramp: BR, base: 4, seed: 93, prof: [1, -1] });                // arm
      b.pset(22, 2, BR[4]); b.pset(22, 3, BR[2]);
      b.pset(6, 4, BR[3]); b.pset(7, 5, BR[3]); b.pset(6, 5, BR[2]); b.pset(6, 6, BR[2]);   // knee brace
      b.pset(10, 4, ST[4]); b.pset(10, 5, ST[2]); b.pset(19, 4, ST[4]); b.pset(19, 5, ST[2]);   // chains
      // board
      b.rect(8, 6, 14, 13, BR[4]);
      board(b, 9, 7, 20, 17, { ramp: BR, base: 1.6, seed: 95, prof: [0, 0] });
      for (x = 8; x <= 21; x++) { b.pset(x, 6, BR[5]); b.pset(x, 18, BR[2]); }
      for (y = 6; y <= 18; y++) { b.pset(8, y, BR[5]); b.pset(21, y, BR[2]); }
      b.pset(8, 6, BR[6]); b.pset(21, 18, BR[1]);
      // foaming grog mug
      stamp(b, 10, 8, legend('tan', 'g:toxic4 G:toxic3 s:steel2 h:tan3'), [
        '.wwww.....',
        'wwwwww....',
        'w5665wkkk.',
        'gs33s4k.k.',
        'g5665hk.k.',
        'Gs33s4kkk.',
        '.5665h....',
        '.4554h....',
        '..hhh.....'
      ]);
      b.outline(K);
      return b;
    }

    var props = {
      grave_cross: graveCross(), grave_round: graveRound(), grave_tilt: graveTilt(), dead_tree: deadTree(),
      fence: fence(), lantern: lantern(), crate: crate(), barrels: barrels(), mast: mast(), sail: sail(),
      flag: frames(flag(0), flag(1)), rail: rail(), sign: sign()
    };

    return {
      solid: [earth(0), earth(1), earth(2), earth(3)],
      solidTop: [earthTop(0), earthTop(1), earthTop(2), earthTop(3)],
      alt: [hull(0), hull(1), hull(2), hull(3)],
      altTop: [deck(0), deck(1), deck(2), deck(3)],
      back: [crypt(0), crypt(1), crypt(2), crypt(3)],
      backAlt: [cabin(0), cabin(1)],
      platform: [plat(0), plat(1), plat(2)],
      ladder: [ladder()],
      spikes: [stakes(0), stakes(1)],
      cracked: [crackedTop(), crackedIn()],
      bridge: [bridge(0), bridge(1)],
      conveyor: [conveyor(0), conveyor(1), conveyor(2), conveyor(3)],
      props: props
    };
  }

  /* ====================================================================== *
   *  helpers shared by stages 2 + 3
   * ====================================================================== */

  /** Silhouette mask (for shadeSil) from a predicate. */
  function maskOf(w, h, fn) {
    var m = new Bitmap(w, h), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (fn(x, y)) m.data[y * w + x] = 1;
    return m;
  }

  /**
   * Torch flame, 7x10, three frames. The body uses GLOW slots (palette-cycled by the engine, so it
   * shimmers between frame changes); the rim is static ember and the heart static yellow, which keeps
   * the flame readable at every phase of the cycle.
   */
  var FLAME_ART = [
    ['...a...', '...a...', '..ab...', '..abb..', '.abcba.', '.abcba.', 'abcdcba', 'abdwdba', '.adwda.', '..awa..'],
    ['.......', '....a..', '...ab..', '...bba.', '..abba.', '.abccba', '.abcdca', 'abcwdba', '.adwda.', '..awa..'],
    ['..a....', '.......', '..aa...', '..aba..', '.abba..', 'abccba.', 'acdcba.', 'abdwcba', '.adwda.', '..awa..']
  ];
  var flameLegend = null;
  function flame(f) {
    if (!flameLegend) flameLegend = legend(null, 'a:ember3 b:glow1 c:glow2 d:glow3 w:hotyellow');
    return art(flameLegend, FLAME_ART[f]);
  }

  /** Fallback conveyor: plate belt running over two spoked rollers. A = body ramp, T = lit top ramp. */
  function beltTile(f, A, T, hub) {
    var b = tile(), x, y, i;
    b.clear(K);
    for (x = 0; x < 16; x++) {
      var ph = ((x - f * 2) % 8 + 8) % 8, gap = ph >= 6;
      b.pset(x, 0, gap ? A[1] : (ph === 0 ? T[6] : T[5]));
      b.pset(x, 1, gap ? A[0] : A[ph === 5 ? 3 : 4]);
      b.pset(x, 2, gap ? K : A[2]);
      var pb = ((x + f * 2) % 8 + 8) % 8, gb = pb >= 6;       // return run moves the other way
      b.pset(x, 13, gb ? K : A[2]); b.pset(x, 14, gb ? K : A[1]); b.pset(x, 15, K);
    }
    for (i = 0; i < 2; i++) {
      var cx = 3.5 + i * 8, cy = 7.5, a = f * Math.PI / 8;
      for (y = 4; y <= 11; y++) for (x = i * 8; x < i * 8 + 8; x++) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 3.9) { b.pset(x, y, y < 8 ? A[0] : K); continue; }
        var c = d > 2.9 ? (dx + dy < -1 ? A[5] : (dx + dy > 2 ? A[2] : A[4])) : A[3];
        var ang = Math.atan2(dy, dx) - a, q = Math.abs(Math.sin(ang * 2));
        if (d <= 2.9 && d > 0.8 && q < 0.38) c = A[1];
        if (d <= 0.8) c = hub;
        b.pset(x, y, c);
      }
    }
    b.rect(0, 3, 16, 1, K); b.rect(0, 12, 16, 1, K);
    return b;
  }

  /** One-way stone ledge (kind 0 left end, 1 middle, 2 right end) resting on corbels. R = 8-shade ramp. */
  function ledgeTile(kind, R, seed) {
    var b = tile(), x0 = kind === 0 ? 1 : 0, x1 = kind === 2 ? 14 : 15, x, y;
    for (x = x0; x <= x1; x++) {
      var w = hash2(x, kind, seed), j = (x === 7 && kind !== 1) || (x === 11 && kind === 1);
      b.pset(x, 0, j ? R[4] : R[w < 0.18 ? 5 : (w > 0.84 ? 7 : 6)]);
      b.pset(x, 1, j ? R[1] : R[hash2(x, kind, seed + 1) < 0.3 ? 4 : 5]);
      b.pset(x, 2, j ? R[1] : R[4]);
      b.pset(x, 3, R[hash2(x, kind, seed + 2) < 0.3 ? 2 : 3]);
      b.pset(x, 4, R[2]);
      b.pset(x, 5, K);
    }
    function corbel(m) {      // m(x) mirrors it for the right end
      var C = [[2, 8], [2, 7], [2, 6], [2, 4], [2, 3]], r, xx;
      for (r = 0; r < C.length; r++) {
        for (xx = C[r][0]; xx <= C[r][1]; xx++) b.pset(m(xx), 5 + r, R[xx === C[r][0] ? 4 : (xx === C[r][1] ? 1 : (r === 0 ? 2 : 3))]);
        b.pset(m(C[r][1] + 1), 5 + r, K); b.pset(m(1), 5 + r, K);
      }
      for (xx = 2; xx <= 3; xx++) b.pset(m(xx), 10, K);
    }
    if (kind === 0) { for (y = 0; y <= 4; y++) b.pset(0, y, K); corbel(function (xx) { return xx; }); }
    if (kind === 2) { for (y = 0; y <= 4; y++) b.pset(15, y, K); corbel(function (xx) { return 15 - xx; }); }
    return b;
  }

  /** Heavy fracture pattern for the 'cracked' tiles: lip = lit crack edge, hair = hairline, chip = chip floor. */
  function fractureLines(b, lip, hair, chip) {
    crackLine(b, [[8, 0], [7, 3], [9, 6], [7, 9], [8, 12], [7, 15]], K, lip);
    crackLine(b, [[9, 6], [12, 7], [14, 9]], K, null);
    crackLine(b, [[7, 9], [4, 10], [2, 12]], K, null);
    crackLine(b, [[3, 2], [4, 4]], hair, null);
    crackLine(b, [[12, 11], [13, 13]], hair, null);
    b.pset(13, 8, lip); b.pset(3, 11, lip);
    b.pset(10, 12, K); b.pset(11, 12, K); b.pset(10, 13, K); b.pset(11, 13, chip);      // a chip knocked out
  }

  /** Vertical chain, 4px wide links (front oval / edge-on bar), starting at (x, y0) for n links. */
  function chainLinks(b, x, y0, n, lg) {
    for (var i = 0; i < n; i++) {
      var y = y0 + i * 8;
      stamp(b, x, y, lg, ['.65.', '6..3', '5..3', '5..3', '4..2', '.32.']);
      stamp(b, x + 1, y + 5, lg, ['53', '52', '42', '42']);
    }
  }

  /* ====================================================================== *
   *  STAGE 2 — The Haunted Moat of Daventry
   * ====================================================================== */
  function buildStage2() {
    var BR = RAMPS.brown, GR = RAMPS.green, TN = RAMPS.tan, SL = RAMPS.slate, MI = RAMPS.mist, BN = RAMPS.bone,
      OL = RAMPS.olive, ST = RAMPS.steel, RU = RAMPS.rust, RD = RAMPS.red, GD = RAMPS.gold, ZO = RAMPS.zombie, SKY = RAMPS.sky;
    var WHITE = col('white');
    var SOIL = [col('dusk1'), col('dusk2'), BR[1], BR[2], BR[3], BR[4]];      // earth with cursed violet shadows
    var GRASS = [GR[0], GR[1], GR[2], GR[3], GR[4], ZO[5]];
    var STONE = [SL[0], SL[1], SL[2], SL[3], SL[4], SL[5], SL[6], SL[7]];
    var soilO = { ramp: SOIL, seed: 1104, base: 2.35, gain: 3.2, amb: 2.2, dither: 0.5 };
    var turfO = { ramp: GRASS, seed: 1131, depth: 4, shadow: SOIL[0], shadow2: SOIL[1] };
    var LBONE = legend('bone'), LGOLD = legend('gold'), LSTEEL = legend('steel');

    function mossy(b, seed, dens, fn) { reramp(b, ZO, -1, function (x, y) { return fn(x, y) && hash2(x, y, seed) < dens; }); }

    /* ---------------- alt: dark fairytale earth, mossy grass ---------------- */
    function loam(v) {
      var b = soilTile(v, soilO), D = SOIL[0];
      if (v === 0) {
        pebble(b, 5.5, 9.5, 1.8, 1.3, SL, 3.4, D);
        pebble(b, 11.5, 4.5, 1, 0.8, SL, 3, D);
      } else if (v === 1) {
        rootLine(b, [[2, 8], [5, 7], [8, 8], [11, 7], [13, 8]], TN[2], D);
        b.pset(8, 9, TN[1]); b.pset(8, 10, TN[1]); b.pset(9, 11, BR[2]);
      } else if (v === 2) {
        pebble(b, 10.5, 10.5, 1.3, 1, SL, 3.1, D);
        rootLine(b, [[3, 4], [5, 6], [5, 9]], TN[2], null);
        b.pset(6, 7, D); b.pset(6, 10, D); b.pset(5, 10, TN[1]);
      } else if (v === 3) {
        pebble(b, 4.5, 4.5, 1.2, 0.9, SL, 3, D);
        b.pset(11, 11, BN[4]); b.pset(12, 11, BN[5]); b.pset(13, 12, BN[4]); b.pset(12, 12, D);      // bone splinter
      } else if (v === 4) {
        rootLine(b, [[9, 3], [11, 5], [12, 8], [11, 11]], TN[2], null);
        b.pset(12, 6, D); b.pset(13, 9, D); b.pset(10, 12, TN[1]);
      } else if (v === 5) {
        pebble(b, 7.5, 6.5, 1.5, 1.1, SL, 3.2, D);
        pebble(b, 12.5, 12.5, 0.9, 0.7, SL, 2.8, D);
      } else if (v === 6) {
        stamp(b, 5, 5, LBONE, ['.566.', '56665', '5k5k4', '.554.', '.4.4.']);      // somebody failed this quest
        b.pset(10, 7, D); b.pset(10, 8, D); b.pset(6, 10, D); b.pset(8, 10, D);
      } else {
        stamp(b, 4, 7, LGOLD, ['.56....', '5.65554', '.54..4.']);                  // a buried golden key
        b.pset(11, 9, D); b.pset(9, 10, D); b.pset(5, 10, D);
      }
      return b;
    }
    function loamTop(v, shroom) {
      var b = soilTile(v + 8, soilO), i, k, x;
      var RT = [[[4, 3], [11, 5]], [[2, 4], [8, 3], [13, 5]], [[6, 5], [12, 3]], [[3, 3], [9, 5], [14, 3]]][v];
      for (i = 0; i < RT.length; i++) for (k = 0; k < RT[i][1]; k++) {
        var xx = RT[i][0] + (k >= 2 ? 1 : 0);
        b.pset(xx, 5 + k, k < RT[i][1] - 1 ? TN[2] : TN[1]);
        if (k < RT[i][1] - 1) b.pset(xx + 1, 6 + k, K);
      }
      if (v === 0) pebble(b, 8.5, 11.5, 1.6, 1.1, SL, 3.2, K);
      if (v === 2) stamp(b, 3, 11, LBONE, ['.45.', '4..3']);
      turf(b, v, turfO);
      for (x = 0; x < 16; x++) if (hash2(x, v, 1140) < 0.22) b.pset(x, 1 + (hash2(x, v, 1141) < 0.4 ? 1 : 0), OL[3]);    // moss
      if (shroom) {                                                                // toadstool
        b.pset(10, 0, RD[4]); b.pset(11, 0, RD[3]);
        b.pset(9, 1, RD[4]); b.pset(10, 1, WHITE); b.pset(11, 1, RD[3]); b.pset(12, 1, RD[2]);
        b.pset(10, 2, BN[5]); b.pset(11, 2, BN[3]);
      }
      return b;
    }

    /* ---------------- solid: castle masonry ---------------- */
    var wallO = {
      ramp: STONE, mortar: K, courses: [[0, 6], [8, 14]], base: 3.15, vary: 0.4, hi: 1.0, lo: 0.9,
      rough: 0.5, pit: 0.04, dither: 0.6, seed: 1200, chip: 0.3
    };
    var wallLay = [
      [{ j: [7], cross: true }, { j: [13], cross: true }],
      [{ j: [5], cross: true }, { j: [12], cross: true }],
      [{ j: [9], cross: true }, { j: [3, 14], cross: true }],
      [{ j: [6, 14], cross: true }, { j: [10], cross: true }]
    ];
    function wall(v, vs, plain) {
      var b = masonry(wallO, wallLay[v], vs === undefined ? v : vs);
      if (plain) return b;
      if (v === 0) mossy(b, 1221, 0.55, function (x, y) { return y >= 11 && y <= 14 && (x - 5) * (x - 5) + (y - 14) * (y - 14) * 2 < 16; });
      else if (v === 1) crackLine(b, [[9, 2], [8, 4], [9, 6]], SL[1], null);
      else if (v === 2) relight(b, -1, function (x, y) { return (x === 6 && y >= 1 && y <= 12) || (x === 7 && y >= 2 && y <= 6) || (x === 5 && y >= 9 && y <= 13); });   // rain streak
      else { b.pset(2, 8, K); b.pset(3, 8, K); b.pset(3, 9, K); b.pset(2, 9, SL[1]); mossy(b, 1227, 0.5, function (x, y) { return y <= 2 && x >= 8 && x <= 13; }); }
      return b;
    }
    function flagLip(b, v) {
      var x, off = [0, 3, 5, 2][v & 3];
      for (x = 0; x < 16; x++) {
        var joint = ((x + off) & 7) === 7, after = ((x + off) & 7) === 0, wear = hash2(x, v, 1307);
        b.pset(x, 0, joint ? SL[4] : SL[wear < 0.18 ? 5 : (wear > 0.84 ? 7 : 6)]);
        b.pset(x, 1, joint ? SL[1] : SL[after ? 6 : (hash2(x, v + 9, 1308) < 0.25 ? 4 : 5)]);
        b.pset(x, 2, joint ? SL[1] : SL[after ? 5 : 4]);
        b.pset(x, 3, joint ? K : SL[2]);
        b.pset(x, 4, K);
      }
      relight(b, -1, function (xx, yy) { return yy === 5; });
      // moss creeping out of one joint, a rain glint
      var jx = (7 - off + 16) & 7;
      b.pset(jx, 0, GR[3]); b.pset(jx + 1, 0, GR[4]); b.pset(jx, 1, GR[2]);
      b.pset((jx + 4) & 15, 0, MI[7]);
    }
    function wallTop(v) { var b = wall(v, v + 4, true); flagLip(b, v); return b; }
    // weathering (moss, cracks, rain streaks) is occasional: each layout is listed twice plain, once weathered
    function wallSet() {
      var a = [], i;
      for (i = 0; i < 4; i++) a.push(wall(i, i, true));
      for (i = 0; i < 4; i++) a.push(a[i]);
      for (i = 0; i < 4; i++) a.push(wall(i));
      return a;
    }

    /* ---------------- back: keep interior (small dark bricks) / backAlt: deep wall (big blocks) ---------------- */
    var keepO = {
      ramp: [SL[0], SL[1], SL[2], SL[3]], mortar: K, courses: [[0, 2], [4, 6], [8, 10], [12, 14]],
      base: 1.15, vary: 0.3, hi: 0.55, lo: 0.4, rough: 0.2, pit: 0.02, dither: 0.45, seed: 1500, chip: 0
    };
    var keepLay = [
      [{ j: [3, 11], cross: true }, { j: [7, 14], cross: true }, { j: [2, 10], cross: true }, { j: [6, 13], cross: true }],
      [{ j: [4, 12], cross: true }, { j: [1, 8], cross: true }, { j: [5, 13], cross: true }, { j: [2, 9], cross: true }],
      [{ j: [2, 10], cross: true }, { j: [6, 14], cross: true }, { j: [3, 11], cross: true }, { j: [7], cross: true }],
      [{ j: [5, 13], cross: true }, { j: [1, 9], cross: true }, { j: [4, 12], cross: true }, { j: [8], cross: true }]
    ];
    function keep(v) {
      var b = masonry(keepO, keepLay[v], v);
      if (v === 1) { b.rect(9, 4, 4, 3, K); b.pset(9, 6, SL[0]); b.pset(10, 6, SL[1]); }                 // a brick has fallen out
      if (v === 2) reramp(b, ZO, 0, function (x, y) { return y >= 8 && x >= 4 && x <= 9 && hash2(x, y, 1577) < 0.5; });   // damp
      if (v === 3) crackLine(b, [[6, 4], [7, 6], [6, 8], [7, 10]], K, null);
      return b;
    }
    var deepO = {
      ramp: [SL[0], SL[1], SL[2]], mortar: K, courses: [[0, 6], [8, 14]],
      base: 0.4, vary: 0.25, hi: 0.75, lo: 0.2, rough: 0.2, pit: 0.02, dither: 0.3, seed: 1600, chip: 0
    };
    var deepLay = [
      [{ j: [7], cross: true }, { j: [14], cross: true }],
      [{ j: [9], cross: true }, { j: [2], cross: true }],
      [{ j: [6], cross: true }, { j: [12], cross: true }]
    ];
    function deep(v) {
      var b = masonry(deepO, deepLay[v], v);
      if (v === 1) crackLine(b, [[11, 9], [12, 11], [11, 13]], K, null);
      return b;
    }

    /* ---------------- platform: stone ledge on corbels ---------------- */
    function ledge(kind) { return ledgeTile(kind, SL, 1801); }

    /* ---------------- ladder: pegged wooden ladder ---------------- */
    function ladder() {
      var b = tile(), i, y;
      for (y = 0; y < 16; y++) {
        var g1 = hash2(3, y >> 1, 1851), g2 = hash2(12, y >> 1, 1851);
        b.pset(2, y, BR[5]); b.pset(3, y, BR[g1 < 0.3 ? 3 : 4]); b.pset(4, y, BR[2]);
        b.pset(11, y, BR[5]); b.pset(12, y, BR[g2 < 0.3 ? 3 : 4]); b.pset(13, y, BR[2]);
      }
      for (i = 0; i < 2; i++) {
        y = 2 + i * 8;
        b.rect(5, y, 6, 1, TN[4]); b.rect(5, y + 1, 6, 1, BR[3]); b.rect(5, y + 2, 6, 1, K);
        b.pset(5, y, BR[4]); b.pset(10, y + 1, BR[2]);
        b.pset(3, y, TN[5]); b.pset(12, y, TN[5]); b.pset(3, y + 1, BR[1]); b.pset(12, y + 1, BR[1]);      // pegs
      }
      return b;
    }

    /* ---------------- spikes: iron pikes ---------------- */
    function pikes(v) {
      var b = tile(), i, x, y;
      var S = v === 0 ? [[2, 7], [7, 6], [12, 8]] : [[3, 8], [8, 6], [13, 7]];      // shaft x, tip y
      for (i = 0; i < 3; i++) {
        var sx = S[i][0], ty = S[i][1];
        // leaf-shaped head
        var HW = [[0, 0], [0, 1], [-1, 1], [-1, 2], [-1, 2], [0, 1]];
        for (y = 0; y < HW.length; y++) for (x = sx + HW[y][0]; x <= sx + HW[y][1]; x++) {
          b.pset(x, ty + y, y === 0 ? WHITE : (x <= sx ? ST[x < sx ? 5 : 6] : ST[x === sx + 1 ? 3 : 2]));
        }
        for (y = ty + HW.length; y < 16; y++) { b.pset(sx, y, ST[4]); b.pset(sx + 1, y, ST[2]); }
        b.pset(sx - 1, ty + HW.length, ST[3]); b.pset(sx + 2, ty + HW.length, ST[1]);       // collar
      }
      reramp(b, RU, -1, function (xx, yy) { return yy >= 13 && hash2(xx, yy, 1900 + v) < 0.45; });       // rust at the foot
      var bi = v === 0 ? 1 : 2, bx = S[bi][0], by = S[bi][1];
      b.pset(bx, by, RD[4]); b.pset(bx, by + 1, RD[4]); b.pset(bx + 1, by + 2, RD[3]); b.pset(bx, by + 3, RD[3]); b.pset(bx - 1, by + 4, RD[2]);
      b.outline(K);
      // iron rail tying the pikes together
      for (x = 0; x < 16; x++) { b.pset(x, 12, ST[(x & 7) === 3 ? 6 : 4]); b.pset(x, 13, ST[1]); }
      return b;
    }

    /* ---------------- cracked masonry ---------------- */
    function fracture(b) { fractureLines(b, SL[5], SL[0], SL[1]); }
    function crackedTop() { var b = wall(1, 8); flagLip(b, 1); fracture(b); b.pset(7, 0, K); b.pset(9, 0, K); b.pset(8, 1, K); return b; }
    function crackedIn() { var b = wall(3, 9); fracture(b); return b; }

    /* ---------------- bridge: rotten drawbridge ---------------- */
    function drawbridge(v) {
      var b = tile(), x, y;
      for (x = 0; x < 16; x++) {
        var p = x >> 2, e = x & 3, lite = (hash2(p, v, 1871) - 0.5) * 1.6, broken = v === 1 && p === 2;
        if (e === 3) { b.pset(x, 0, BR[1]); b.pset(x, 1, K); b.pset(x, 2, K); b.pset(x, 3, K); }
        else if (!broken) {
          b.pset(x, 0, lite > 0.3 ? TN[4] : (lite < -0.4 ? BR[4] : TN[3]));
          b.pset(x, 1, BR[clampi(Math.round(4 + lite) + (e === 0 ? 1 : 0), 2, 6)]);
          b.pset(x, 2, BR[clampi(Math.round(3 + lite) - (e === 2 ? 1 : 0), 1, 5)]);
          b.pset(x, 3, BR[1]);
        }
        // the long stringer underneath
        for (y = 4; y <= 7; y++) {
          var g = pn1(x, 8, 1875, y) * 0.6 + pn1(x, 4, 1877, y) * 0.4;
          b.pset(x, y, sh(BR, [3.4, 2.7, 2.3, 1.4][y - 4] + (g > 0.64 ? -0.9 : (g < 0.28 ? 0.6 : 0)), x, y, 0.3));
        }
        b.pset(x, 8, K);
      }
      if (v === 0) {
        // iron strap with rivets
        for (y = 0; y <= 7; y++) { b.pset(5, y, ST[y === 0 ? 5 : 3]); b.pset(6, y, ST[1]); }
        b.pset(5, 2, ST[6]); b.pset(5, 6, ST[6]);
        b.pset(6, 8, ST[1]);
        // moss hanging under the beam
        b.pset(11, 8, OL[3]); b.pset(11, 9, OL[2]); b.pset(12, 8, OL[2]); b.pset(1, 8, OL[2]);
      } else {
        // snapped plank: splinters around the hole, pale broken wood
        b.pset(8, 1, K); b.pset(8, 2, BR[2]); b.pset(8, 3, BR[1]); b.pset(10, 2, TN[4]); b.pset(10, 3, BR[3]); b.pset(9, 3, K);
        b.pset(8, 0, 0); b.pset(9, 0, 0); b.pset(10, 0, 0); b.pset(9, 1, 0); b.pset(10, 1, 0); b.pset(9, 2, K);
        // rope lashing, frayed end dangling
        vrope(b, 13, 0, 8, TN[5], TN[3]);
        b.pset(13, 9, TN[3]); b.pset(14, 10, TN[4]); b.pset(14, 11, TN[2]); b.pset(13, 11, TN[2]);
        b.pset(3, 8, OL[3]); b.pset(3, 9, OL[2]);
        b.pset(4, 5, K); b.pset(5, 5, K); b.pset(6, 6, K);                                 // split in the stringer
      }
      return b;
    }

    /* ---------------- props ---------------- */
    function banner() {
      var b = new Bitmap(16, 32), x, y;
      var CL = [col('maroon1'), RD[1], RD[2], RD[3], RD[4]];
      var EM = [
        '............',
        '..g..gg..g..',
        '..g.gggg.g..',
        '..gggggggg..',
        '..gwggggwg..',
        '..gggggggg..',
        '............',
        '.....gg.....',
        '....g..g....',
        '.....gg.....',
        '.....g......',
        '.....g......',
        '.....gg.....',
        '.....g......',
        '.....gg.....'
      ];
      for (x = 2; x <= 13; x++) {
        var seg = hash2(x >> 1, 7, 1711);
        var yb = 21 + Math.round(Math.abs(x - 7.5) * 1.25) + (seg < 0.3 ? -2 : (seg > 0.8 ? 1 : 0));      // swallow-tail, tattered
        for (y = 3; y <= yb; y++) {
          if (x === 4 && y > 23) continue;                                                 // rip
          var fold = Math.sin((x - 2) * 0.95 + 0.4 + y * 0.06);
          var e = (y >= 6 && y < 6 + EM.length) ? EM[y - 6].charAt(x - 2) : '.', c;
          if (x === 2 || x === 13) c = GD[y & 1 ? 3 : 4];
          else if (e === 'g') c = GD[fold > 0.2 ? 5 : (fold < -0.5 ? 3 : 4)];
          else if (e === 'w') c = WHITE;
          else c = sh(CL, 2.1 + fold * 0.9 - (x > 10 ? 0.5 : 0) - (y === 3 ? 1 : 0), x, y, 0.5);
          if (y >= yb && x !== 2 && x !== 13) c = CL[0];
          b.pset(x, y, c);
        }
      }
      b.pset(10, 17, 0); b.pset(10, 18, 0); b.pset(11, 18, 0); b.pset(9, 18, CL[0]); b.pset(10, 16, CL[0]);      // moth hole
      for (x = 1; x <= 14; x++) { b.pset(x, 1, BR[5]); b.pset(x, 2, BR[2]); }
      b.pset(1, 1, GD[6]); b.pset(1, 2, GD[3]); b.pset(14, 1, GD[5]); b.pset(14, 2, GD[2]);
      b.outline(K);
      return b;
    }

    function torchPost(f) {
      var b = new Bitmap(10, 30);
      b.blit(art(LSTEEL, [
        'k5k....k2k',
        'k54433221k',
        '.k443221k.',
        '..k4321k..',
        '...k42k...',
        '..k5432k..',
        '...k42k...',
        '...k42k...',
        '...k41k...',
        '...k42k...',
        '...k42k...',
        '...k32k...',
        '...k42k...',
        '...k42k...',
        '..k5432k..',
        '...k42k...',
        '...k42k...',
        '..k4332k..',
        '.k43kk21k.',
        'k43k..k21k'
      ]), 0, 10);
      b.blit(flame(f), 1, 1);
      return b;
    }

    function arrowSlit() {
      var m = maskOf(16, 24, function (x, y) {
        if (y < 1 || y > 22) return false;
        var wide = (((y - 1) / 5) | 0) % 2 === 0;        // long and short quoins
        return wide ? (x >= 1 && x <= 14) : (x >= 3 && x <= 12);
      });
      var b = shadeSil(m, STONE, { base: 3.7, hi: 1.4, lo: 1.3, rough: 0.4, dither: 0.4, seed: 1721 }), x, y;
      for (y = 5; y <= 20; y += 5) for (x = 3; x <= 12; x++) b.pset(x, y, SL[1]);
      function hole(xx, yy) {
        return (xx >= 6 && xx <= 9 && yy >= 4 && yy <= 19) || (xx >= 4 && xx <= 11 && yy >= 10 && yy <= 12) ||
          (xx >= 5 && xx <= 10 && (yy === 4 || yy === 5 || yy === 18 || yy === 19) && !((xx === 5 || xx === 10) && (yy === 4 || yy === 19)));
      }
      for (y = 2; y <= 21; y++) for (x = 3; x <= 12; x++) {
        if (hole(x, y)) b.pset(x, y, (!hole(x - 1, y) || !hole(x, y - 1)) ? K : SKY[(bayer(x, y) < 0.5) ? 2 : 3]);
        else if (hole(x - 1, y) || hole(x, y - 1)) b.pset(x, y, SL[6]);      // lit splay
      }
      b.outline(K);
      return b;
    }

    function battlement() {
      var o = {}, k, x, y;
      for (k in wallO) o[k] = wallO[k];
      o.courses = [[4, 8], [10, 14]]; o.seed = 1730;
      var b = masonry(o, [{ j: [0, 15] }, { j: [0, 8, 15] }], 7);
      for (x = 0; x < 16; x++) {
        var w = hash2(x, 3, 1733);
        b.pset(x, 0, SL[w < 0.2 ? 5 : (w > 0.85 ? 7 : 6)]); b.pset(x, 1, SL[w > 0.6 ? 4 : 5]); b.pset(x, 2, SL[3]); b.pset(x, 3, K);
      }
      for (y = 1; y < 16; y++) { b.pset(0, y, K); b.pset(15, y, K); }
      b.ax = 8; b.ay = 16;
      return b;
    }

    function well() {
      var b = new Bitmap(32, 34), x, y;
      var CYL = [3.2, 4.4, 4.9, 4.4, 3.8, 3.3, 2.7, 2.1, 1.5];
      // posts
      vboard(b, 5, 10, 6, 19, { ramp: BR, base: 3.8, seed: 1731, prof: [1, -1] });
      vboard(b, 25, 10, 26, 19, { ramp: BR, base: 3.2, seed: 1733, prof: [1, -1] });
      // stone drum
      for (y = 22; y <= 33; y++) for (x = 4; x <= 27; x++) {
        if (y === 33 && (x === 4 || x === 27)) continue;
        var u = (x - 4) / 23.01, cyl = CYL[Math.floor(u * 9)], r = y - 22, ci = r < 4 ? 0 : (r < 9 ? 1 : 2);
        var bed = r === 4 || r === 9, head = !bed && ((x + (ci & 1) * 4 + 1) % 8) === 0, c;
        if (bed || head) c = SL[cyl < 2.5 ? 0 : 1];
        else c = sh(STONE, cyl + ((r === 0 || r === 5 || r === 10) ? 0.7 : 0) - ((r === 3 || r === 8) ? 0.6 : 0) - (r === 0 ? 1.6 : 0) + (noise2(x / 3, y / 3, 1735) - 0.5) * 0.9, x, y, 0.5);
        b.pset(x, y, c);
      }
      // rim: far lip, dark mouth, lit near lip, front face
      for (x = 8; x <= 23; x++) b.pset(x, 17, SL[4]);
      for (x = 5; x <= 26; x++) b.pset(x, 18, (x >= 9 && x <= 22) ? K : SL[5]);
      for (x = 3; x <= 28; x++) {
        var ur = (x - 3) / 25.01, cr = CYL[Math.floor(ur * 9)];
        b.pset(x, 19, (x >= 7 && x <= 24) ? (x === 7 ? K : SL[0]) : SL[6]);
        b.pset(x, 20, sh(STONE, cr + 2.2, x, 20, 0.3));
        b.pset(x, 21, sh(STONE, cr - 0.2, x, 21, 0.3));
      }
      // windlass, rope, crank
      for (x = 7; x <= 24; x++) { b.pset(x, 12, BR[5]); b.pset(x, 13, BR[2]); }
      for (x = 12; x <= 19; x++) { b.pset(x, 11, TN[(x & 1) ? 5 : 4]); b.pset(x, 12, TN[(x & 1) ? 4 : 2]); b.pset(x, 13, TN[(x & 1) ? 3 : 2]); b.pset(x, 14, TN[2]); }
      b.pset(27, 12, ST[5]); b.pset(28, 12, ST[4]); b.pset(28, 13, ST[3]); b.pset(28, 14, ST[3]); b.pset(29, 14, ST[5]); b.pset(29, 15, ST[2]);
      b.pset(15, 15, TN[5]); b.pset(16, 15, TN[3]);
      // bucket
      for (x = 13; x <= 18; x++) {
        var lv = x < 15 ? 5 : (x < 17 ? 4 : 2);
        b.pset(x, 16, BR[lv]); b.pset(x, 17, ST[lv - 1]); b.pset(x, 18, BR[lv - 1]);
        if (x > 13 && x < 18) b.pset(x, 19, BR[lv - 1]);
      }
      // shingled roof
      for (y = 1; y <= 9; y++) {
        var hw = 8.5 + (y - 1) * 0.75, xl = Math.round(15.5 - hw), xr = Math.round(15.5 + hw), band = (y - 1) >> 1;
        for (x = xl; x <= xr; x++) {
          var edge = ((x + band * 2) % 4) === 0, v = 3.3 + ((y & 1) ? 0.9 : -0.4) - (x > 21 ? 0.9 : 0) + (x < 9 ? 0.5 : 0) - (edge ? 1.2 : 0) + (hash2(x >> 2, band, 1737) - 0.5);
          if (y === 9) v -= 1.2;
          b.pset(x, y, sh(RU, v, x, y, 0.3));
        }
      }
      for (x = 3; x <= 28; x++) b.pset(x, 10, BR[x < 8 ? 2 : 1]);
      b.pset(11, 3, OL[3]); b.pset(12, 3, OL[4]); b.pset(12, 4, OL[3]); b.pset(22, 6, OL[3]); b.pset(23, 7, OL[3]); b.pset(5, 7, OL[4]);       // moss on the roof
      mossy(b, 1739, 0.5, function (xx, yy) { return yy >= 29 && (xx < 12 || xx > 22); });
      b.outline(K);
      // grass at the foot
      var T = [[1, 2, 2], [2, 3, 3], [3, 1, 2], [9, 2, 2], [10, 1, 3], [20, 1, 2], [28, 3, 3], [29, 2, 2], [30, 1, 2]];
      for (x = 0; x < T.length; x++) for (y = 0; y < T[x][1]; y++) b.pset(T[x][0], 33 - y, GRASS[clampi(T[x][2] + (y === T[x][1] - 1 ? 1 : 0), 0, 5)]);
      return b;
    }

    function deadTree() {
      var buf = treeBuf(44, 60);
      limb(buf, [[16, 56, 3], [9, 58.4, 2], [2, 59.4, 1]], 3);
      limb(buf, [[24, 56, 3], [32, 58.4, 2.1], [40, 59.4, 1]], 4);
      limb(buf, [[22, 43, 2.1], [30, 41, 1.6], [35, 44, 1.1], [37, 49, 0.5]], 5);      // drooping bough
      limb(buf, [[18, 46, 2.1], [12, 44, 1.6]], 6);                                    // snapped stub
      limb(buf, [[20, 59, 6], [19, 52, 5], [21, 44, 4.4], [24, 37, 4], [23, 30, 3.6]], 1);
      limb(buf, [[22, 32, 3.2], [15, 26, 2.6], [8, 22, 2], [4, 15, 1.3], [5, 8, 0.6]], 7);
      limb(buf, [[24, 31, 3], [31, 26, 2.4], [37, 19, 1.8], [41, 12, 1.1], [39, 5, 0.5]], 8);
      limb(buf, [[23, 30, 3], [22, 21, 2.4], [25, 13, 1.7], [23, 6, 1], [25, 1, 0.4]], 9);
      limb(buf, [[8, 22, 1.2], [2, 23, 0.7], [0.5, 27, 0.4]], 10);
      limb(buf, [[4, 15, 0.9], [1, 10, 0.5]], 11);
      limb(buf, [[37, 19, 1.2], [42, 21, 0.8], [43, 26, 0.4]], 12);
      limb(buf, [[41, 12, 0.8], [35, 8, 0.5]], 13);
      limb(buf, [[25, 13, 1], [30, 9, 0.7], [32, 4, 0.4]], 14);
      limb(buf, [[22, 21, 1.1], [17, 15, 0.7], [15, 9, 0.4]], 15);
      limb(buf, [[15, 26, 1.2], [11, 30, 0.8], [10, 35, 0.4]], 16);
      limb(buf, [[31, 26, 1.1], [35, 29, 0.7], [36, 33, 0.4]], 17);
      var b = treeBitmap(buf, [K, col('dusk1'), BR[1], BR[2], BR[3], MI[4]], 0.45);
      // hollow with something watching from inside
      b.ellipse(22, 46, 2.4, 3.2, K);
      b.pset(21, 45, col('hotyellow')); b.pset(23, 45, col('hotyellow'));
      b.pset(19, 43, BR[1]); b.pset(20, 42, BR[1]); b.pset(24, 42, BR[1]); b.pset(25, 43, BR[3]);
      b.pset(12, 43, TN[4]); b.pset(11, 44, TN[5]); b.pset(11, 45, TN[3]);              // pale heartwood of the stub
      b.outline(K);
      return b;
    }

    function crest() {
      var m = maskOf(18, 20, function (x, y) {
        if (y < 1 || y > 18 || (y === 1 && (x === 1 || x === 16))) return false;
        var hw = y <= 9 ? 8 : 8 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 9) / 9.6, 2)));
        return Math.abs(x - 8.5) <= hw;
      });
      var b = shadeSil(m, [SL[2], SL[3], SL[4], SL[5], SL[6], SL[7]], { base: 2.5, hi: 1.6, lo: 1.5, rough: 0.35, dither: 0.35, seed: 1741, grad: 0.7 });
      var x, y;
      function inner(xx, yy) { return m.get(xx - 2, yy) && m.get(xx + 2, yy) && m.get(xx, yy - 2) && m.get(xx, yy + 2); }
      relight(b, -2, function (xx, yy) { return inner(xx, yy) && ((xx <= 7 && yy <= 8) || (xx >= 10 && yy >= 11)); });      // quarterly
      for (y = 3; y <= 16; y++) if (inner(8, y)) { b.pset(8, y, SL[1]); b.pset(9, y, SL[6]); }
      for (x = 3; x <= 14; x++) if (inner(x, 9)) { b.pset(x, 9, SL[1]); b.pset(x, 10, SL[6]); }
      b.pset(8, 9, SL[7]); b.pset(9, 9, SL[7]); b.pset(8, 10, SL[7]); b.pset(9, 10, SL[4]);                  // boss
      stamp(b, 11, 4, legend('slate'), ['2.2.2', '22222', '.222.']);                                           // crown
      b.pset(4, 12, SL[2]); b.pset(5, 12, SL[2]); b.pset(6, 12, SL[2]); b.pset(5, 11, SL[2]); b.pset(5, 13, SL[2]); b.pset(5, 14, SL[2]);      // cross
      b.outline(K);
      return b;
    }

    function chain() {
      var b = new Bitmap(6, 32);
      chainLinks(b, 1, 0, 4, LSTEEL);
      b.outline(K);
      return b;
    }

    function plinth() {
      var R = [null, [1, 18], [1, 18], [1, 18], [2, 17], [3, 16], [4, 15], [4, 15], [4, 15], [4, 15], [4, 15], [4, 15], [4, 15], [3, 16], [2, 17], [2, 17], [1, 18], [1, 18]];
      var m = maskOf(20, 18, function (x, y) { return !!R[y] && x >= R[y][0] && x <= R[y][1]; }), x, y;
      var b = shadeSil(m, STONE, { base: 3.9, hi: 1.5, lo: 1.4, rough: 0.4, dither: 0.4, seed: 1751, grad: 0.8 });
      relight(b, -1, function (xx, yy) { return yy === 4 || yy === 6 || yy === 15; });
      for (x = 6; x <= 13; x++) { b.pset(x, 7, SL[2]); b.pset(x, 11, SL[6]); }
      for (y = 7; y <= 11; y++) { b.pset(6, y, SL[2]); b.pset(13, y, SL[6]); }
      b.pset(8, 9, SL[2]); b.pset(9, 9, SL[2]); b.pset(11, 9, SL[2]);
      mossy(b, 1753, 0.5, function (xx, yy) { return yy >= 14 && xx < 9; });
      b.outline(K);
      return b;
    }

    function reeds() {
      var b = new Bitmap(24, 18), i, k;
      var L = [[2, 9, -2], [5, 12, 2], [8, 8, -1], [11, 11, 3], [14, 13, -2], [17, 9, 2], [20, 11, -1], [22, 7, 1]];      // blades: x, height, lean
      for (i = 0; i < L.length; i++) for (k = 0; k < L[i][1]; k++) {
        var t = k / L[i][1];
        b.pset(L[i][0] + Math.round(L[i][2] * t * t), 17 - k, GR[k < 2 ? 1 : (t > 0.7 ? 4 : (i & 1 ? 3 : 2))]);
      }
      var S = [[4, 15, 0], [9, 13, 1], [13, 16, 0], [19, 14, -1]];      // cattails: x, height, lean
      for (i = 0; i < S.length; i++) {
        var h = S[i][1], top = 18 - h;
        for (k = 0; k < h; k++) {
          var xx = S[i][0] + Math.round(S[i][2] * k / h), yy = 17 - k;
          if (yy >= top + 2 && yy <= top + 6) { b.pset(xx, yy, BR[yy === top + 2 ? 5 : 4]); b.pset(xx + 1, yy, BR[yy === top + 6 ? 1 : 2]); }
          else b.pset(xx, yy, yy < top + 2 ? OL[5] : OL[k < 3 ? 2 : 3]);
        }
      }
      b.outline(K);
      return b;
    }

    // the skull and the key are rare finds: the plain variants are listed three times
    var earthSet = [], ei;
    for (ei = 0; ei < 6; ei++) earthSet.push(loam(ei));
    for (ei = 0; ei < 12; ei++) earthSet.push(earthSet[ei % 6]);
    earthSet.push(loam(6)); earthSet.push(loam(7));

    var props = {
      banner: banner(), torch_post: frames(torchPost(0), torchPost(1), torchPost(2)), arrow_slit: arrowSlit(),
      battlement: battlement(), well: well(), dead_tree: deadTree(), crest: crest(), chain: chain(),
      plinth: plinth(), reeds: reeds()
    };

    return {
      solid: wallSet(),
      solidTop: [wallTop(0), wallTop(1), wallTop(2), wallTop(3)],
      alt: earthSet,
      altTop: [loamTop(0), loamTop(1, true), loamTop(2), loamTop(3), loamTop(0), loamTop(1), loamTop(2), loamTop(3)],
      back: [keep(0), keep(1), keep(2), keep(3)],
      backAlt: [deep(0), deep(1), deep(2)],
      platform: [ledge(0), ledge(1), ledge(2)],
      ladder: [ladder()],
      spikes: [pikes(0), pikes(1)],
      cracked: [crackedTop(), crackedIn()],
      bridge: [drawbridge(0), drawbridge(1)],
      conveyor: [beltTile(0, ST, MI, RU[3]), beltTile(1, ST, MI, RU[3]), beltTile(2, ST, MI, RU[3]), beltTile(3, ST, MI, RU[3])],
      props: props
    };
  }

  /* ====================================================================== *
   *  STAGE 3 — The Jaffar Spike Catacombs
   * ====================================================================== */
  function buildStage3() {
    var SA = RAMPS.sand, SL = RAMPS.slate, ST = RAMPS.steel, BN = RAMPS.bone, RU = RAMPS.rust, RD = RAMPS.red,
      NI = RAMPS.night, IN = RAMPS.indigo, BL = RAMPS.blue, TE = RAMPS.teal, ZO = RAMPS.zombie;
    var WHITE = col('white');
    // torch-lit sandstone whose shadows fall into dungeon blue (the Prince-of-Persia palette)
    var SAND = [SL[2], SL[3], SA[1], SA[2], SA[3], SA[4], SA[5], SA[6]];
    var BLUE = [SL[0], SL[1], SL[2], SL[3], SL[4], SL[5]];
    var LED = [SL[0], SL[1], SL[3], SA[2], SA[3], SA[4], SA[6], SA[7]];
    var LSTEEL = legend('steel', 'm:brown4 n:brown2');

    function copyRows(dst, src, y0, y1) { for (var i = y0 * 16; i < (y1 + 1) * 16; i++) dst.data[i] = src.data[i]; }

    /* ---------------- solid: sandstone courses with a slate-blue shadow course ---------------- */
    var COURSES = [[0, 4], [6, 9], [11, 14]];
    var sandO = {
      ramp: SAND, mortar: K, courses: COURSES, cbase: [4.0, 0, 3.7], base: 0, vary: 0.7, hi: 0.9, lo: 0.9,
      rough: 0.5, pit: 0.05, dither: 0.6, seed: 2200, chip: 0.25, skip: [false, true, false]
    };
    var blueO = {
      ramp: BLUE, mortar: K, courses: COURSES, cbase: [0, 2.5, 0], base: 0, vary: 0.35, hi: 0.9, lo: 0.8,
      rough: 0.45, pit: 0.04, dither: 0.6, seed: 2250, chip: 0.2, skip: [true, false, true]
    };
    var dunLay = [
      [{ j: [9], cross: true }, { j: [4, 12], cross: true }, { j: [7], cross: true }],
      [{ j: [6], cross: true }, { j: [1, 10], cross: true }, { j: [13], cross: true }],
      [{ j: [11], cross: true }, { j: [5, 13], cross: true }, { j: [3], cross: true }],
      [{ j: [8], cross: true }, { j: [2, 11], cross: true }, { j: [6, 14], cross: true }]
    ];
    function dun(v, vs, plain) {
      var b = masonry(sandO, dunLay[v], vs === undefined ? v : vs), c = masonry(blueO, dunLay[v], vs === undefined ? v : vs);
      copyRows(b, c, 6, 9);
      if (plain) return b;
      if (v === 1) crackLine(b, [[3, 11], [4, 13], [3, 14]], SL[2], null);
      else if (v === 2) { b.pset(13, 4, K); b.pset(14, 4, K); b.pset(14, 3, SL[3]); }                       // chipped corner
      else if (v === 3) reramp(b, ZO, -1, function (x, y) { return y >= 12 && x >= 9 && x <= 12 && hash2(x, y, 2231) < 0.5; });   // damp
      return b;
    }
    /** Floor slab laid over the top course: bright lit ledge line, dark nosing shadow. */
    function slab(b, v, R) {
      var x, jx = [4, -1, 11, -1][v & 3];
      for (x = 0; x < 16; x++) {
        var w = hash2(x, v, 2307), joint = x === jx;
        b.pset(x, 0, joint ? R[4] : R[w < 0.16 ? 5 : (w > 0.86 ? 7 : 6)]);
        b.pset(x, 1, joint ? R[1] : R[x === jx + 1 ? 7 : (hash2(x, v, 2308) < 0.22 ? 5 : 6)]);
        b.pset(x, 2, joint ? R[1] : R[hash2(x, v, 2309) < 0.3 ? 4 : 5]);
        b.pset(x, 3, joint ? K : R[hash2(x, v, 2310) < 0.35 ? 2 : 3]);
        b.pset(x, 4, R[0]);
        b.pset(x, 5, K);
      }
      relight(b, -1, function (xx, yy) { return yy === 6; });
    }
    var FLOOR = [SL[1], SL[2], SL[3], SA[2], SA[3], SA[4], SA[5], SA[6]];
    function floorTop(v, vs) {
      var b = dun(v, vs === undefined ? v + 4 : vs, v !== 2);
      slab(b, v, FLOOR);
      relight(b, -1, function (xx, yy) { return yy >= 11; });                                        // the soffit course sits in shadow
      if (v === 1) { b.pset(9, 0, FLOOR[4]); b.pset(10, 1, FLOOR[3]); b.pset(10, 2, FLOOR[2]); }         // hairline in the slab
      if (v === 3) { b.pset(5, 0, FLOOR[5]); b.pset(6, 0, FLOOR[4]); b.pset(6, 1, FLOOR[4]); }             // worn dip
      return b;
    }

    // wear is occasional: each layout is listed twice plain, once worn
    function dunSet() {
      var a = [], i;
      for (i = 0; i < 4; i++) a.push(dun(i, i, true));
      for (i = 0; i < 4; i++) a.push(a[i]);
      for (i = 1; i < 4; i++) a.push(dun(i));
      return a;
    }

    /* ---------------- alt: darker slate masonry ---------------- */
    var slateO = {
      ramp: BLUE, mortar: K, courses: COURSES, cbase: [2.7, 2.0, 2.6], base: 0, vary: 0.35, hi: 0.9, lo: 0.8,
      rough: 0.45, pit: 0.04, dither: 0.6, seed: 2300, chip: 0.25
    };
    function slate(v, vs) {
      var b = masonry(slateO, dunLay[(v + 2) & 3], vs === undefined ? v : vs);
      if (v === 0) crackLine(b, [[11, 1], [10, 3], [11, 4]], SL[0], null);
      if (v === 2) { b.pset(2, 9, K); b.pset(3, 9, K); b.pset(2, 8, SL[1]); }
      return b;
    }
    var SLATEFLOOR = [SL[0], SL[1], SL[2], SL[3], SL[4], SL[5], SA[4], SA[5]];      // slate slab, sand-lit edge
    function slateTop(v) { var b = slate(v, v + 4); slab(b, v, SLATEFLOOR); return b; }

    /* ---------------- back: gloom with a few brick outlines (PoP style) ---------------- */
    var DARK = [K, NI[2], SL[1], SL[2]];
    function gloomField(b) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var n = pnoise(x, y, 8, 8, 2501) * 0.6 + pnoise(x, y, 4, 4, 2503) * 0.4;
        b.data[y * 16 + x] = sh(DARK, 0.7 + (n - 0.5) * 1.3, x, y, 0.35);
      }
    }
    function brickMark(b, x, y, w, h) {
      var i;
      for (i = 0; i < w; i++) { b.pset(x + i, y, DARK[2]); b.pset(x + i, y + h - 1, K); }
      for (i = 0; i < h; i++) { b.pset(x, y + i, DARK[2]); b.pset(x + w - 1, y + i, K); }
      b.pset(x, y, DARK[3]);
      for (i = 1; i < w - 1; i++) for (var j = 1; j < h - 1; j++) if (bayer(x + i, y + j) < 0.5) b.pset(x + i, y + j, DARK[1]);
    }
    function gloom(v) {
      var b = tile();
      gloomField(b);
      if (v === 0) { brickMark(b, 2, 2, 8, 5); brickMark(b, 7, 9, 7, 5); }
      else if (v === 1) { brickMark(b, 5, 6, 9, 5); }
      else if (v === 2) { b.pset(4, 10, DARK[2]); b.pset(5, 10, DARK[2]); b.pset(6, 10, DARK[2]); b.pset(4, 11, DARK[2]); b.pset(11, 4, DARK[2]); b.pset(12, 4, DARK[2]); }
      else { brickMark(b, 1, 8, 7, 5); brickMark(b, 9, 2, 6, 5); }
      return b;
    }
    /* ---------------- backAlt: gloom with a faint arabesque (8-point star lattice) ---------------- */
    function arabesque(v) {
      var b = tile(), x, y;
      gloomField(b);
      for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
        var dx = Math.abs(x - 8), dy = Math.abs(y - 8), on = false;
        if (dx + dy === 7 || (Math.max(dx, dy) === 5)) on = true;                   // diamond + square = star
        if (v === 0 ? (dx + dy === 2) : (dx <= 1 && dy <= 1 && dx + dy > 0)) on = true;      // centre rosette
        if ((x === 0 || x === 15) && (y === 0 || y === 15)) on = true;              // corner studs
        if (on) b.data[y * 16 + x] = (dx + dy === 7 && Math.max(dx, dy) > 5) || ((x + y) & 1) ? DARK[2] : DARK[1];
      }
      return b;
    }

    /* ---------------- ladder: iron rungs on chains ---------------- */
    function ladder() {
      var b = tile(), i, y, CH = ['.5.', '5.3', '5.3', '.3.'];
      for (y = 0; y < 16; y++) for (i = 0; i < 3; i++) {
        var ch = CH[y & 3].charAt(i);
        if (ch !== '.') { b.pset(2 + i, y, ST[+ch]); b.pset(11 + i, y, ST[+ch]); }
      }
      for (i = 0; i < 2; i++) {
        y = 2 + i * 8;
        b.rect(2, y, 12, 1, ST[6]); b.rect(2, y + 1, 12, 1, ST[3]); b.rect(4, y + 2, 7, 1, K);
        b.pset(2, y, ST[4]); b.pset(13, y, ST[4]); b.pset(13, y + 1, ST[1]); b.pset(7 + i, y, WHITE);
      }
      return b;
    }

    /* ---------------- spikes: steel needles rising out of holes in the floor ---------------- */
    function needles(v) {
      var b = tile(), i, y;
      var N = v === 0 ? [[1, 8], [4, 6], [7, 9], [10, 6], [13, 8]] : [[1, 7], [4, 9], [7, 6], [10, 8], [13, 7]];      // x, tip y
      for (i = 0; i < N.length; i++) {
        var x = N[i][0], ty = N[i][1];
        for (y = ty; y <= 15; y++) {
          var t = y - ty;
          if (t < 3) b.pset(x, y, t === 0 ? WHITE : ST[6]);
          else { b.pset(x, y, ST[t < 5 ? 6 : 5]); b.pset(x + 1, y, ST[t < 5 ? 3 : 2]); }
        }
      }
      var bi = v === 0 ? 1 : 2, bx = N[bi][0], by = N[bi][1];
      b.pset(bx, by, RD[4]); b.pset(bx, by + 1, RD[4]); b.pset(bx, by + 2, RD[3]); b.pset(bx + 1, by + 4, RD[3]); b.pset(bx, by + 5, RD[2]);
      b.outline(K);
      return b;
    }

    /* ---------------- cracked: loose, fractured slab ---------------- */
    function crackedTop() {
      var b = floorTop(1, 8);
      fractureLines(b, SA[6], SL[2], SL[2]);
      coolLips(b, SA[6]);
      b.pset(7, 0, K); b.pset(9, 0, K); b.pset(8, 1, K);
      return b;
    }
    function crackedIn() { var b = dun(3, 9); fractureLines(b, SA[6], SL[2], SL[2]); coolLips(b, SA[6]); return b; }
    /** The lit crack edges that cross the blue course take a blue highlight instead of a sand one. */
    function coolLips(b, lip) { for (var i = 6 * 16; i < 10 * 16; i++) if (b.data[i] === lip) b.data[i] = SL[5]; }

    /* ---------------- bridge: loose floor tile (it wobbles, then it falls) ---------------- */
    function looseFloor(v) {
      var b = tile(), x, y;
      for (x = 1; x <= 14; x++) {
        var w = hash2(x, v, 2871);
        b.pset(x, 0, FLOOR[w < 0.2 ? 5 : (w > 0.86 ? 7 : 6)]);
        b.pset(x, 1, FLOOR[hash2(x, v, 2872) < 0.25 ? 5 : 6]);
        b.pset(x, 2, FLOOR[hash2(x, v, 2873) < 0.3 ? 4 : 5]);
        b.pset(x, 3, FLOOR[hash2(x, v, 2874) < 0.35 ? 2 : 3]);
        b.pset(x, 4, FLOOR[1]);
        b.pset(x, 5, hash2(x >> 1, v, 2875) < 0.55 ? FLOOR[0] : K);
        if (b.get(x, 5) !== K) b.pset(x, 6, K);
      }
      for (y = 0; y <= 5; y++) { b.pset(0, y, K); b.pset(15, y, K); }
      b.pset(1, 0, FLOOR[4]); b.pset(14, 0, FLOOR[4]);
      if (v === 0) { crackLine(b, [[5, 0], [6, 2], [5, 4]], K, null); b.pset(7, 2, FLOOR[7]); b.pset(11, 3, K); }
      else { crackLine(b, [[10, 0], [9, 2], [10, 4]], K, null); b.pset(11, 2, FLOOR[7]); b.pset(3, 3, K); b.pset(4, 4, K); b.pset(13, 0, K); b.pset(14, 0, K); b.pset(14, 1, K); }
      return b;
    }

    /* ---------------- props ---------------- */
    var CYL10 = [3.6, 6.4, 7, 6.2, 5.4, 4.8, 4.0, 3.2, 2.2, 1.2];
    function cylShade(u) { return CYL10[clampi(Math.floor(u * 10), 0, 9)]; }

    function pillar() {
      var b = new Bitmap(16, 48), x, y;
      function half(yy) {
        if (yy <= 2) return 7;
        if (yy <= 4) return 6;
        if (yy === 5) return 5;
        if (yy === 6) return 6;
        if (yy >= 45) return 7;
        if (yy >= 43) return 6;
        if (yy === 42) return 5;
        if (yy === 41) return 6;
        return 5;
      }
      for (y = 0; y < 48; y++) {
        var hw = half(y), xl = 8 - hw, xr = 7 + hw, shaft = y > 6 && y < 41;
        for (x = xl; x <= xr; x++) {
          var v = cylShade((x - xl) / (xr - xl + 0.001));
          if (y === 0 || y === 3 || y === 6 || y === 41 || y === 43 || y === 45) v += 0.7;       // lit top of each moulding
          if (y === 2 || y === 4 || y === 42 || y === 44) v -= 1.1;                             // undersides
          if (y === 5 || y === 7) v -= 1.8;
          if (shaft) {
            if (y === 18 || y === 30) v -= 2.2; else if (y === 19 || y === 31) v += 0.5;           // drum joints
            if (x === xl + 4 || x === xl + 7) v -= 0.55;                                          // fluting
            v += (noise2(x / 2.5, y / 4, 2701) - 0.5) * 1.0;
          }
          b.pset(x, y, sh(SAND, v, x, y, 0.4));
        }
        b.pset(xl - 1, y, K); b.pset(xr + 1, y, K);
      }
      b.pset(5, 22, SA[2]); b.pset(6, 23, SA[2]); b.pset(6, 24, SA[1]); b.pset(5, 25, SA[2]);          // hairline
      b.pset(11, 34, SL[2]); b.pset(12, 34, K); b.pset(12, 35, K); b.pset(11, 35, SL[3]);        // chip
      // blue faience band under the capital
      for (x = 3; x <= 12; x++) { b.pset(x, 8, (x & 1) ? TE[3] : BL[3]); if (x === 3) b.pset(x, 8, TE[4]); if (x >= 11) b.pset(x, 8, BL[1]); }
      return b;
    }

    function torch(f) {
      var b = new Bitmap(10, 18);
      b.blit(art(LSTEEL, [
        'k5k...k2k.',
        'k54433221k',
        '.k443221k.',
        '..kkmnkk..',
        '.k53mn31k.',
        '..kkmnkk..',
        '...kmnk...',
        '...kmnk...',
        '....kk....'
      ]), 0, 9);
      b.blit(flame(f), 1, 0);
      return b;
    }

    function debris() {
      var o = { k: K, a: BLUE[2], b: BLUE[3], c: BLUE[4], z: BLUE[1] }, i;
      for (i = 0; i < 8; i++) o[String(i)] = SAND[i];
      return art(GNG.makeLegend(o), [
        '.......kkkk.........',
        '.....kk6665k........',
        '....k666554k...kk...',
        '...k6555443k..kcbk..',
        '.kkk5k444332kkcbbak.',
        'k65k54k33322kcbbaazk',
        'k544k43k3221kbbaazzk',
        'k4433k32k211kbaazzzk'
      ]);
    }

    function bones() {
      var b = art(legend('bone'), [
        '....................',
        '..5665..............',
        '.566665...4..5..5...',
        '.6k65k5..4..5..5..4.',
        '.666655..4.4..4..4..',
        '..5k5k...4.4..4..4..',
        '..54545.444444444...',
        '.....3......3...355.',
        '.45555553..3555554..',
        '....................'
      ]);
      b.outline(K);
      return b;
    }

    /**
     * Opening cut into a ragged patch of dungeon brick with a sandstone trim (barred window, potion niche).
     * The corridors have no back-wall tiles, so the prop brings its own bit of wall; it has no outline on
     * purpose, the toothed brick edge melts into the backdrop. open(x,y) = hollow; paint(x,y) colours it.
     */
    function alcove(seed, open, paint) {
      var b = new Bitmap(16, 24), x, y;
      for (y = 0; y < 24; y++) {
        var row = y >> 2, off = (row & 1) * 4, inL = hash2(row, 1, seed) < 0.5 ? 1 : 0, inR = hash2(row, 2, seed) < 0.5 ? 1 : 0;
        for (x = inL; x <= 15 - inR; x++) {
          var bed = (y & 3) === 3, head = ((x + off) & 7) === 7;
          var v = 2.3 + ((y & 3) === 0 ? 0.8 : 0) - ((y & 3) === 2 ? 0.6 : 0) + (hash2((x + off) >> 3, row, seed + 3) - 0.5) * 1.1 - x * 0.03;
          b.pset(x, y, (bed || head) ? K : sh(BLUE, v, x, y, 0.5));
        }
      }
      function near(xx, yy) { return open(xx - 1, yy) || open(xx + 1, yy) || open(xx, yy - 1) || open(xx, yy + 1) || open(xx - 1, yy - 1) || open(xx + 1, yy - 1) || open(xx - 1, yy + 1) || open(xx + 1, yy + 1); }
      for (y = 1; y <= 22; y++) for (x = 1; x <= 14; x++) {
        if (open(x, y)) b.pset(x, y, (!open(x - 1, y) || !open(x, y - 1)) ? K : paint(x, y));
        else if (near(x, y)) b.pset(x, y, SAND[(open(x - 1, y) || open(x, y - 1)) ? 7 : (open(x + 1, y) ? 4 : (open(x, y + 1) ? 6 : 5))]);
      }
      return b;
    }
    function archOpen(x0, x1, yTop, yBot) {
      var cx = (x0 + x1) / 2, r = (x1 - x0) / 2 + 0.3;
      return function (x, y) {
        if (x < x0 || x > x1 || y > yBot || y < yTop) return false;
        if (y >= yTop + r) return true;
        var dx = x - cx, dy = y - (yTop + r);
        return dx * dx + dy * dy <= r * r;
      };
    }
    function bars() {
      var open = archOpen(4, 11, 4, 18);
      var LIGHT = [K, NI[2], NI[3], IN[2], IN[3]];
      var b = alcove(2741, open, function (x, y) {
        // faint moonlight slanting in from the upper right
        var d = (x - 4) * 0.5 - (y - 4) * 0.28 + 1.2;
        return sh(LIGHT, 1.2 + d * 0.55, x, y, 0.8);
      }), y;
      for (y = 4; y <= 18; y++) {
        if (open(6, y)) { b.pset(6, y, ST[4]); if (open(7, y)) b.pset(7, y, ST[1]); }
        if (open(9, y)) { b.pset(9, y, ST[4]); if (open(10, y)) b.pset(10, y, ST[1]); }
      }
      for (var x = 5; x <= 11; x++) { b.pset(x, 11, ST[x === 6 || x === 9 ? 6 : 3]); b.pset(x, 12, ST[1]); }
      return b;
    }
    function niche() {
      var open = archOpen(3, 12, 3, 19);
      var b = alcove(2751, open, function (x, y) {
        if (y >= 18) return y === 18 ? SAND[6] : SAND[4];                               // the shelf
        return sh([K, SL[0], SL[1], SL[2]], 0.5 + (y - 4) * 0.11 + (x - 3) * 0.06, x, y, 0.7);
      });
      b.pset(5, 6, SL[3]); b.pset(6, 7, SL[3]); b.pset(5, 8, SL[3]); b.pset(7, 6, SL[2]);                // cobweb
      b.pset(4, 17, K); b.pset(5, 17, SL[0]);
      return b;
    }

    function urn() {
      var b = new Bitmap(12, 16), x, y;
      var W = [null, [3, 8], [4, 7], [3, 8], [2, 9], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [2, 9], [2, 9], [3, 8], [4, 7], [3, 8]];
      for (y = 1; y < 16; y++) for (x = W[y][0]; x <= W[y][1]; x++) {
        var v = cylShade((x - W[y][0]) / (W[y][1] - W[y][0] + 0.001)) - 1.2;
        if (y === 1 || y === 15) v += 0.8; if (y === 2 || y === 14) v -= 1.4; if (y >= 11) v -= 0.6;
        var c = sh(RU, v, x, y, 0.4);
        if (y === 6 || y === 9) c = RU[v > 3 ? 2 : 1];
        if (y === 7 || y === 8) c = (((x + y) & 1) === 0) ? (v > 3.4 ? SA[6] : (v > 1.8 ? SA[4] : SA[2])) : (v > 3 ? BL[3] : BL[1]);   // painted band
        b.pset(x, y, c);
      }
      b.pset(7, 3, K); b.pset(8, 4, K); b.pset(8, 5, RU[1]);                                               // crack
      b.outline(K);
      return b;
    }

    function arch() {
      var b = new Bitmap(40, 48), x, y, cx = 19.5, cy = 20, R1 = 11.6, R2 = 16.6, HW = 9.5;
      var yj = cy + Math.sqrt(R1 * R1 - HW * HW);                                    // where the horseshoe meets the jambs
      function open(xx, yy) {
        var dx = xx - cx, dy = yy - cy;
        if (yy <= yj) return dx * dx + dy * dy <= R1 * R1;
        return Math.abs(dx) <= HW;
      }
      for (y = 1; y < 48; y++) for (x = 1; x <= 38; x++) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), c;
        if (open(x, y)) {
          // inside: a stair climbing to a doorway full of warm light
          var st = y >= 44 ? 0 : (y >= 41 ? 1 : (y >= 38 ? 2 : (y >= 35 ? 3 : -1)));
          var ady = y - 21, door = Math.abs(dx) <= 5.5 && y < 35 && (y >= 21 || dx * dx + ady * ady <= 5.6 * 5.6);
          if (st >= 0 && Math.abs(dx) <= HW - st) {
            var tread = (y === 44 || y === 41 || y === 38 || y === 35);
            c = tread ? sh([SL[3], SA[1], SA[2], SA[3], SA[4]], 0.6 + st * 1.1 - Math.abs(dx) * 0.12, x, y, 0.5)
              : sh([K, SL[0], SL[1], SL[2], SL[3]], 1.2 + st * 0.6 - Math.abs(dx) * 0.08, x, y, 0.5);
          } else if (door) {
            c = sh([RU[1], RU[2], RU[3], SA[3], SA[4], SA[5], SA[6], SA[7]], 7.4 - (34 - y) * 0.34 - Math.abs(dx) * 0.5, x, y, 0.8);
            if (Math.abs(dx) > 4.6 || (y < 21 && dx * dx + ady * ady > 4.4 * 4.4)) c = RU[1];
          } else c = (st >= 0 || y > 30) ? SL[0] : K;
          if (!open(x - 1, y) || !open(x, y - 1)) c = K;
        } else if (d <= R2 && y <= yj + 2) {
          // voussoirs: alternating sandstone / red brick, like the Mezquita
          var ang = Math.atan2(dy, dx), seg = Math.floor((ang + Math.PI * 2.5) / (Math.PI / 8.5)), fr = (ang + Math.PI * 2.5) / (Math.PI / 8.5) - seg;
          var red = (seg & 1) === 0, lit = 4.2 - dx * 0.11 - dy * 0.05 + (d > R2 - 1.2 ? 0.9 : 0) - (d < R1 + 1.2 ? 1.2 : 0);
          if (fr < 0.14) c = K;
          else c = red ? sh([col('maroon1'), RU[1], RU[2], RU[3], RU[4], RU[5]], lit - 1.2, x, y, 0.4) : sh(SAND, lit + 1.2, x, y, 0.4);
        } else {
          // rectangular frame (alfiz): coursed sandstone, cornice, faience frieze
          var course = (y - 7) % 6, jo = ((x + (((y - 7) / 6) | 0) * 5) % 10) === 0;
          var v = 4.3 - (x - 4) * 0.035 + (noise2(x / 3, y / 3, 2761) - 0.5) * 1.1;
          if (y <= 3) v += y === 1 ? 2 : (y === 3 ? -0.6 : 1);
          else if (y === 4) v = 0.6;
          else if (y === 5 || y === 6) { c = ((x + y) & 1) ? BL[y === 5 ? 4 : 3] : TE[y === 5 ? 4 : 2]; if ((x % 6) === 0) c = SA[6]; }
          else if (course === 5 || jo) v = 1.4;
          else if (course === 0) v += 0.7;
          else if (course === 4) v -= 0.6;
          if (x === 1) v += 1; if (x === 38) v -= 1.5;
          if (d < R2 + 1.3 && y <= yj + 2) v -= 1.6;                                 // shadow hugging the arch
          if (!(y === 5 || y === 6)) c = sh(SAND, v, x, y, 0.5);
        }
        b.pset(x, y, c);
      }
      // engaged columns carrying the arch
      for (y = Math.round(yj) + 1; y < 48; y++) {
        var cap = y <= Math.round(yj) + 3, base = y >= 45;
        for (var side = 0; side < 2; side++) {
          var x0 = side ? 30 : 4, x1 = side ? 35 : 9;
          if (cap || base) { x0 -= 1; x1 += 1; }
          for (x = x0; x <= x1; x++) {
            var cv = cylShade((x - x0) / (x1 - x0 + 0.001)) + (cap && y === Math.round(yj) + 1 ? 0.8 : 0) - (y === Math.round(yj) + 4 ? 2 : 0) + (base && y === 45 ? 0.6 : 0);
            b.pset(x, y, sh(SAND, cv, x, y, 0.4));
          }
          b.pset(x0 - 1, y, K); b.pset(x1 + 1, y, K);
        }
      }
      // keystone jewel
      b.pset(19, 3 + 1, K); b.pset(20, 3 + 1, K); b.pset(19, 5, TE[5]); b.pset(20, 5, TE[3]); b.pset(19, 6, TE[4]); b.pset(20, 6, TE[2]);
      b.outline(K);
      return b;
    }

    var props = {
      pillar: pillar(), torch: frames(torch(0), torch(1), torch(2)), debris: debris(), bones: bones(),
      bars: bars(), urn: urn(), niche: niche(), arch: arch()
    };

    return {
      solid: dunSet(),
      solidTop: [floorTop(0), floorTop(1), floorTop(2), floorTop(3)],
      alt: [slate(0), slate(1), slate(2), slate(3)],
      altTop: [slateTop(0), slateTop(1), slateTop(2), slateTop(3)],
      back: [gloom(0), gloom(1), gloom(2), gloom(3)],
      backAlt: [arabesque(0), arabesque(1)],
      platform: [ledgeTile(0, LED, 2801), ledgeTile(1, LED, 2801), ledgeTile(2, LED, 2801)],
      ladder: [ladder()],
      spikes: [needles(0), needles(1)],
      cracked: [crackedTop(), crackedIn()],
      bridge: [looseFloor(0), looseFloor(1)],
      conveyor: [beltTile(0, ST, SA, RU[3]), beltTile(1, ST, SA, RU[3]), beltTile(2, ST, SA, RU[3]), beltTile(3, ST, SA, RU[3])],
      props: props
    };
  }

  GNG.Tiles.register(0, buildStage1);
  GNG.Tiles.register(1, buildStage2);
  GNG.Tiles.register(2, buildStage3);
})();
