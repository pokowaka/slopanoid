/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * art_bosses.js — the five showpiece bosses, built as independent parts.
 *
 * Technique: every part is modelled from lit volumes (spheres, tapered limbs and
 * "inflated" polygon masks) shaded with an ordered-dither ramp lookup and a fixed
 * upper-left light, composited layer by layer with dark separation lines, then
 * finished with hand-placed pixels (faces, teeth, rivets) and a 1px outline.
 * Everything is deterministic (seeded noise only) and builds in a few ms.
 *
 * Sprites face RIGHT. See the ASSEMBLY notes above each boss for the offsets the
 * parts were designed around.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.Bitmap) return;

  var Bitmap = GNG.Bitmap, C = GNG.C, bayer = GNG.bayer;
  var OUT = C.outline;

  /* ====================================================================== *
   *  TOOLKIT
   * ====================================================================== */

  // Light from the upper-left, leaning toward the viewer.
  var LX = -0.56, LY = -0.66, LZ = 0.5;
  (function () { var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= l; LY /= l; LZ /= l; })();

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Custom ramp (dark -> light) from colour names; lets shadows hue-shift across engine ramps. */
  function ramp() {
    var a = [], i;
    for (i = 0; i < arguments.length; i++) a.push(GNG.col(arguments[i]));
    return a;
  }

  /** Dithered ramp lookup. d = dither strength (0 = hard bands, 1 = full 4x4 ordered dither). */
  function sh(r, v, x, y, d) {
    var n = r.length - 1;
    var i = Math.floor(v * n + 0.5 + (bayer(x, y) - 0.5) * (d === undefined ? 0.7 : d));
    return r[i < 0 ? 0 : (i > n ? n : i)];
  }

  /** Lambert term (-1..1) -> tone (0..1) between o.lo and o.hi. */
  function tone(l, o) {
    var t = clamp01((l + 0.5) / 1.45);
    t = Math.pow(t, o.gamma || 1.25);
    var lo = o.lo === undefined ? 0.12 : o.lo, hi = o.hi === undefined ? 0.9 : o.hi;
    return lo + (hi - lo) * t;
  }

  function put(dst, x, y, r, v, o, l) {
    if (o.tex) v += o.tex(x, y);
    if (o.rim && l < -0.3) v += o.rim * clamp01((-0.3 - l) * 2.5);      // bounce light on the shadow edge
    if (o.fade) v += o.fade(x, y);
    dst.pset(x, y, sh(r, clamp01(v), x, y, o.d));
  }

  /** Lit ellipsoid. */
  function ball(dst, cx, cy, rx, ry, r, o) {
    o = o || {};
    var x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x, y;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var u = (x - cx) / rx, v = (y - cy) / ry, d2 = u * u + v * v;
      if (d2 > 1) continue;
      var l = u * LX + v * LY + Math.sqrt(1 - d2) * LZ;
      put(dst, x, y, r, tone(l, o), o, l);
    }
  }

  /** Lit tapered limb (sphere-swept segment) from (ax,ay) radius ar to (bx,by) radius br. */
  function limb(dst, ax, ay, ar, bx, by, br, r, o) {
    o = o || {};
    var x0 = Math.floor(Math.min(ax - ar, bx - br)), x1 = Math.ceil(Math.max(ax + ar, bx + br));
    var y0 = Math.floor(Math.min(ay - ar, by - br)), y1 = Math.ceil(Math.max(ay + ar, by + br));
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, x, y;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var t = clamp01(((x - ax) * dx + (y - ay) * dy) / L2);
      var rr = ar + (br - ar) * t, ex = x - (ax + dx * t), ey = y - (ay + dy * t);
      var d2 = (ex * ex + ey * ey) / (rr * rr);
      if (d2 > 1) continue;
      var l = (ex / rr) * LX + (ey / rr) * LY + Math.sqrt(1 - d2) * LZ;
      put(dst, x, y, r, tone(l, o), o, l);
    }
  }

  /**
   * "Inflate" an arbitrary mask (any non-zero pixel of bitmap m) into a lit, rounded relief.
   * o.R = edge rounding radius in px, o.bevel = straight chamfer instead of round, o.k = relief strength.
   */
  function puff(dst, m, r, o) {
    o = o || {};
    var w = m.w, h = m.h, src = m.data, n = w * h, D = new Float32Array(n), Hf = new Float32Array(n);
    var i, x, y, v, a, INF = 1e5;
    for (i = 0; i < n; i++) D[i] = src[i] ? INF : 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!src[i]) continue;
      v = D[i];
      a = x > 0 ? D[i - 1] + 3 : 3; if (a < v) v = a;
      a = y > 0 ? D[i - w] + 3 : 3; if (a < v) v = a;
      a = (x > 0 && y > 0) ? D[i - w - 1] + 4 : 4; if (a < v) v = a;
      a = (x < w - 1 && y > 0) ? D[i - w + 1] + 4 : 4; if (a < v) v = a;
      D[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; if (!src[i]) continue;
      v = D[i];
      a = x < w - 1 ? D[i + 1] + 3 : 3; if (a < v) v = a;
      a = y < h - 1 ? D[i + w] + 3 : 3; if (a < v) v = a;
      a = (x < w - 1 && y < h - 1) ? D[i + w + 1] + 4 : 4; if (a < v) v = a;
      a = (x > 0 && y < h - 1) ? D[i + w - 1] + 4 : 4; if (a < v) v = a;
      D[i] = v;
    }
    var Rr = o.R || 6, t, d;
    for (i = 0; i < n; i++) {
      if (!src[i]) { Hf[i] = 0; continue; }
      d = D[i] / 3 - 0.5;
      t = d / Rr; if (t > 1) t = 1; else if (t < 0) t = 0;
      Hf[i] = o.bevel ? t * Rr : Rr * Math.sqrt(1 - (1 - t) * (1 - t));
    }
    var passes = o.blur === undefined ? 1 : o.blur, T2;
    while (passes-- > 0) {
      T2 = new Float32Array(n);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; if (!src[i]) continue;
        var s = 0, c = 0, xx, yy;
        for (yy = -1; yy <= 1; yy++) for (xx = -1; xx <= 1; xx++) {
          var X = x + xx, Y = y + yy;
          if (X < 0 || Y < 0 || X >= w || Y >= h) { c++; continue; }
          s += Hf[Y * w + X]; c++;
        }
        T2[i] = s / c;
      }
      Hf = T2;
    }
    var k = o.k === undefined ? 1 : o.k;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!src[i]) continue;
      var gx = ((x < w - 1 ? Hf[i + 1] : 0) - (x > 0 ? Hf[i - 1] : 0)) * 0.5 * k;
      var gy = ((y < h - 1 ? Hf[i + w] : 0) - (y > 0 ? Hf[i - w] : 0)) * 0.5 * k;
      var il = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      var l = (-gx * LX - gy * LY + LZ) * il;
      put(dst, x, y, r, tone(l, o), o, l);
    }
  }

  /** New scratch mask the size of bitmap `like`; fn draws on it with colour 1. */
  function mask(like, fn) { var m = new Bitmap(like.w, like.h); fn(m); return m; }

  /** Fill a mask with a per-pixel tone function v(x,y) -> 0..1. */
  function fillMask(dst, m, r, vf, d) {
    var w = m.w, h = m.h, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (m.data[y * w + x]) dst.pset(x, y, sh(r, clamp01(vf(x, y)), x, y, d));
    }
  }

  /** Streaky directional noise (fur, wood, cloth folds). sx/sy = frequency across x / y. */
  function grain(seed, amp, sx, sy) {
    return function (x, y) { return (GNG.noise2(x * sx, y * sy, seed) - 0.5) * 2 * amp; };
  }

  /** Chunky cell noise: breaks tone bands into jagged tufts (fur) without fine-grain speckle. */
  function chunk(seed, amp, cw, ch) {
    return function (x, y) {
      var cx = Math.floor(x / cw), cy = Math.floor((y + (cx & 1) * (ch >> 1)) / ch);
      return (GNG.hash2(cx, cy, seed) - 0.5) * 2 * amp;
    };
  }

  /**
   * Layered sprite builder. part(edge, fn): fn draws on a blank layer; the layer is
   * composited on top, and wherever its rim crosses existing art a dark separation
   * line (colour `edge`) is drawn — the classic selective inner outline.
   */
  function Art(w, h) { this.w = w; this.h = h; this.b = new Bitmap(w, h); }
  Art.prototype.part = function (edge, fn) {
    var t = new Bitmap(this.w, this.h);
    fn(t);
    var b = this.b, w = this.w, h = this.h, td = t.data, bd = b.data, x, y, i;
    if (edge !== null && edge !== undefined) {
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        if (td[i] || !bd[i]) continue;
        if ((x > 0 && td[i - 1]) || (x < w - 1 && td[i + 1]) || (y > 0 && td[i - w]) || (y < h - 1 && td[i + w])) bd[i] = edge;
      }
    }
    b.blit(t, 0, 0);
    return this;
  };
  /** Finish: 1px outline, register. */
  Art.prototype.done = function (name, ax, ay, outline) {
    this.b.outline(outline === undefined ? OUT : outline);
    return GNG.regSprite(name, this.b, { ax: ax, ay: ay });
  };

  /**
   * Stamp hand-placed pixels. rows = array of strings; legend maps chars to palette indices.
   * '.' / ' ' = leave alone, '_' = erase to transparent.
   */
  function stamp(dst, x0, y0, legend, rows, flip) {
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(flip ? row.length - 1 - x : x);
        if (ch === '.' || ch === ' ') continue;
        if (ch === '_') { if (x0 + x >= 0 && y0 + y >= 0 && x0 + x < dst.w && y0 + y < dst.h) dst.data[(y0 + y) * dst.w + x0 + x] = 0; continue; }
        var c = legend[ch];
        if (c === undefined) { GNG.artWarnings.push('art_bosses: unknown stamp char "' + ch + '"'); continue; }
        dst.pset(x0 + x, y0 + y, c);
      }
    }
  }
  function legend(obj) { var o = {}; for (var k in obj) o[k] = GNG.col(obj[k]); return o; }

  /** Register a hand-drawn ASCII sprite (rows array or template string) with an automatic 1px outline. */
  function ascii(name, lg, art, ax, ay, noOutline) {
    var bmp = GNG.parseArt(lg, art, name);
    if (!noOutline) bmp.outline(OUT);
    return GNG.regSprite(name, bmp, { ax: ax, ay: ay });
  }

  /** Set a list of pixels [x,y, x,y, ...] to one colour. */
  function pix(dst, c, pts) { for (var i = 0; i + 1 < pts.length; i += 2) dst.pset(pts[i], pts[i + 1], c); }
  /** Polyline. */
  function path(dst, c, pts) { for (var i = 0; i + 3 < pts.length; i += 2) dst.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c); }
  /** Only recolour pixels that are already opaque (keeps the silhouette). */
  function tint(dst, c, pts) {
    for (var i = 0; i + 1 < pts.length; i += 2) if (dst.get(pts[i], pts[i + 1])) dst.pset(pts[i], pts[i + 1], c);
  }
  function tintLine(dst, c, x0, y0, x1, y1) {
    var t = new Bitmap(dst.w, dst.h), i;
    t.line(x0, y0, x1, y1, 1);
    for (i = 0; i < t.data.length; i++) if (t.data[i] && dst.data[i]) dst.data[i] = c;
  }
  /** 2x2 rivet / stud. */
  function rivet(dst, x, y, r) {
    dst.pset(x, y, r[r.length - 1]); dst.pset(x + 1, y, r[r.length - 3]);
    dst.pset(x, y + 1, r[r.length - 3]); dst.pset(x + 1, y + 1, r[1]);
  }
  /** Small triangular tuft / spike added to a mask: base centre (x,y), tip (x+dx,y+dy), half-width hw. */
  function tuft(m, x, y, dx, dy, hw) {
    var l = Math.sqrt(dx * dx + dy * dy) || 1, px = -dy / l * hw, py = dx / l * hw;
    m.poly([[x + px, y + py], [x + dx, y + dy], [x - px, y - py]], 1);
    m.line(x, y, x + dx, y + dy, 1);
  }

  /** Step an existing pixel's shade along ramp r by `delta` (keeps silhouette + underlying shading). */
  function nudge(dst, x, y, r, delta) {
    var c = dst.get(x, y); if (!c) return;
    var i = r.indexOf(c); if (i < 0) return;
    i += delta; if (i < 0) i = 0; else if (i >= r.length) i = r.length - 1;
    dst.pset(x, y, r[i]);
  }
  /** Scatter short downward fur strokes (dark stroke + light root tick) over pixels of ramp r. */
  function furMarks(dst, r, seed, step, len) {
    var rng = GNG.makeRng(seed), x, y, k;
    for (y = 0; y < dst.h; y += step) for (x = 0; x < dst.w; x += step) {
      var px = x + ((rng() * step) | 0), py = y + ((rng() * step) | 0), L = len - 1 + ((rng() * 2) | 0);
      var slant = rng() < 0.5 ? -1 : 1;
      for (k = 0; k < L; k++) nudge(dst, px + ((k * slant) >> 1), py + k, r, -1);
      nudge(dst, px - slant, py, r, 1);
    }
  }

  /* ====================================================================== *
   *  BOSS 1 — THE THREE-HEADED MONKEY  (stage 1, "Look behind you!")
   *
   *  ASSEMBLY (offsets from the body anchor = bottom-centre, facing right):
   *    neck stumps (start of the b1_neck0 chains): (-20,-48)  (0,-52)  (+20,-48)
   *    heads rest ~18-26 px above their stump; chain the 10px neck balls 6-7 px apart.
   * ====================================================================== */

  var FUR = ramp('dusk0', 'dusk1', 'brown1', 'brown2', 'brown3', 'brown4', 'brown5', 'tan5');
  var HIDE = ramp('night1', 'zombie0', 'zombie1', 'zombie2', 'zombie3', 'zombie4', 'zombie5', 'zombie6');
  var GORE = ramp('red0', 'red1', 'red2', 'red3', 'red4', 'red5');
  var BONE = GNG.RAMPS.bone, STEEL = GNG.RAMPS.steel, REDR = GNG.RAMPS.red;

  function b1Body(br) {
    var W = 76, H = 63, A = new Art(W, H), S = 1.08, OX = 0.8, OY = -0.2;
    var fur = chunk(11, 0.075, 2, 3);
    var E = FUR[0], ES = HIDE[0];
    var FO = { lo: 0.1, hi: 0.96, gamma: 1.45, tex: fur, d: 0.25, rim: 0.1 };
    var FD = { lo: 0.08, hi: 0.7, gamma: 1.4, tex: fur, d: 0.25 };          // far side, in shadow
    // design space is 68x58; everything is scaled by S onto the real canvas
    function X(v) { return v * S + OX; }
    function Y(v) { return v * S + OY; }
    function PX(v) { return Math.round(v * S + OX); }
    function PY(v) { return Math.round(v * S + OY); }
    function B(t, cx, cy, rx, ry, r, o) { ball(t, X(cx), Y(cy), rx * S, ry * S, r, o); }
    function Lm(t, ax, ay, ar, bx, by, b2, r, o) { limb(t, X(ax), Y(ay), ar * S, X(bx), Y(by), b2 * S, r, o); }
    function TL(t, c, x0, y0, x1, y1) { tintLine(t, c, PX(x0), PY(y0), PX(x1), PY(y1)); }
    function fist(fx, fy, sc, o) {
      // back of the hand, then four knuckles planted on the ground
      A.part(ES, function (t) { B(t, fx, fy - 3.6 * sc, 7.6 * sc, 4.6 * sc, HIDE, o); });
      [-5.4, -1.8, 1.8, 5.4].forEach(function (dx) {
        A.part(ES, function (t) { B(t, fx + dx * sc, fy, 2.5 * sc, 3.2 * sc, HIDE, o); });
      });
    }

    // far arm (viewer's right) — behind the torso
    A.part(null, function (t) {
      Lm(t, 61, 35, 7, 58.5, 46, 6.6, FUR, FD);
      Lm(t, 57, 23 - br, 8, 61, 35, 7, FUR, FD);
      B(t, 56.5, 21 - br, 9, 8.5, FUR, FD);
      Lm(t, 65, 36, 2, 67, 40, 0.5, FUR, FD);                      // elbow tuft
    });
    fist(58, 53, 0.92, { lo: 0.08, hi: 0.7, d: 0.5 });

    // hips / rump in shadow, legs and feet
    A.part(E, function (t) { B(t, 36, 44, 19, 10, FUR, { lo: 0, hi: 0.32, tex: fur, d: 0.25 }); });
    [[27, 7.5, 0.9], [45.5, 6.4, 0.7]].forEach(function (f) {
      var cx = f[0], rx = f[1], hi = f[2];
      A.part(E, function (t) { B(t, cx, 45.5, rx, 7.5, FUR, { lo: 0.02, hi: hi * 0.62, tex: fur, d: 0.25 }); });
      A.part(ES, function (t) { B(t, cx, 53, rx, 3.6, HIDE, { lo: 0.15, hi: hi, d: 0.5 }); });
      [-3.6, 0, 3.6].forEach(function (dx) {
        A.part(ES, function (t) { B(t, cx + dx * rx / 7.5, 55, 1.9, 1.6, HIDE, { lo: 0.25, hi: hi, d: 0.3 }); });
      });
    });

    // torso: great shoulder hump + rib cage
    A.part(E, function (t) {
      B(t, 36, 34, 20 + br, 14.5, FUR, { lo: 0, hi: 0.6, tex: fur, d: 0.25 });
      B(t, 35, 24 - br, 26.5, 17 + br, FUR, FO);
      // ragged tufts along the back line
      Lm(t, 25, 10 - br, 2.2, 23, 5 - br, 0.5, FUR, FO); Lm(t, 45, 10 - br, 2.2, 47, 5 - br, 0.5, FUR, FO);
      Lm(t, 49, 12 - br, 2, 52, 8 - br, 0.5, FUR, FO); Lm(t, 21, 12 - br, 2, 19, 8 - br, 0.5, FUR, FO);
    });

    // bare, leathery chest: abdomen then pecs (near pec larger)
    A.part(ES, function (t) { B(t, 37, 37, 12.5 + br, 10.5, HIDE, { lo: 0.1, hi: 0.66, d: 0.6 }); });
    A.part(ES, function (t) { B(t, 45 + br, 26.5, 8.6, 7.4, HIDE, { lo: 0.14, hi: 0.76, d: 0.6 }); });
    A.part(ES, function (t) { B(t, 29.5 - br, 26.5, 10, 8, HIDE, { lo: 0.16, hi: 0.9, d: 0.6 }); });
    var b = A.b;
    TL(b, HIDE[1], 37, 34.5, 37, 45);                               // linea alba + abs
    TL(b, HIDE[1], 30.5, 38, 36, 39); TL(b, HIDE[1], 38, 39, 44, 38);
    TL(b, HIDE[1], 32, 42, 36, 42.6); TL(b, HIDE[1], 38, 42.6, 42, 42);
    // stitched scar across the near pec
    TL(b, HIDE[1], 24, 22, 32, 30);
    [[25, 22], [24, 24], [27, 24], [26, 26], [29, 26], [28, 28], [31, 28], [30, 30]].forEach(function (q) { tint(b, HIDE[0], [PX(q[0]), PY(q[1])]); });
    // rot hole with exposed ribs on the far flank
    A.part(ES, function (t) {
      var m = mask(t, function (m) { m.ellipse(X(46.5), Y(37), 4.6 * S, 5.4 * S, 1); m.ellipse(X(44), Y(39.5), 2.6 * S, 2.6 * S, 1); m.ellipse(X(48.5), Y(33.5), 2.2 * S, 2 * S, 1); });
      fillMask(t, m, GORE, function (x, y) { return 0.1 + (y - Y(32)) * 0.02; }, 0.4);
      [[34, 4], [37.2, 4], [40.4, 3]].forEach(function (q, i) {
        var y = PY(q[0]);
        path(t, BONE[q[1]], [PX(42), y + 1, PX(44.5), y, PX(48), y, PX(50.5), y + 1]);
        pix(t, BONE[q[1] + 2], [PX(44.5), y, PX(44.5) + 1, y]);
        if (!t.get(PX(42), y + 1)) { /* keep rib ends inside the hole */ }
      });
      // clip ribs to the wound
      for (var i = 0; i < t.data.length; i++) if (t.data[i] && !m.data[i]) t.data[i] = 0;
    });

    // pirate sash (knot on the near hip) + ragged loincloth
    A.part(GORE[0], function (t) {
      var m = mask(t, function (m) {
        m.poly([[X(20), Y(41)], [X(28), Y(43)], [X(44), Y(43)], [X(52), Y(41)], [X(53), Y(45)], [X(44), Y(48)], [X(28), Y(48)], [X(19), Y(45)]], 1);
        m.poly([[X(29), Y(47)], [X(42), Y(47)], [X(43), Y(52)], [X(40), Y(56)], [X(38), Y(52)], [X(35), Y(56)], [X(32), Y(52)], [X(30), Y(55)], [X(28), Y(51)]], 1);
      });
      puff(t, m, REDR, { R: 3, lo: 0.1, hi: 0.72, tex: grain(5, 0.1, 0.5, 0.2), fade: function (x, y) { return -(y - Y(44)) * 0.018 - (x - X(34)) * 0.004; } });
      TL(t, REDR[1], 31, 49.4, 31, 52); TL(t, REDR[1], 36, 49.4, 36, 53); TL(t, REDR[1], 40, 49.4, 40, 53);
    });
    A.part(GORE[0], function (t) {     // knot + tail
      B(t, 22, 44.5, 3.2, 3, REDR, { lo: 0.2, hi: 0.85 });
      Lm(t, 21, 47, 2.2, 19, 53, 1.2, REDR, { lo: 0.15, hi: 0.7 });
    });
    stamp(b, PX(34), PY(42), legend({ o: 'bone6', p: 'bone4', k: 'night0', w: 'white' }), [
      '.wooo.',
      'wooooo',
      'okooko',
      'ookkoo',
      '.oooo.',
      '.pkpk.'
    ]);

    // near arm (viewer's left) — in front: forearm, upper arm, deltoid
    A.part(E, function (t) {
      Lm(t, 7.5, 36, 8.2, 10.5, 45.5, 7.4, FUR, FO);
      Lm(t, 2.5, 38, 2.2, 1.5, 43, 0.5, FUR, FO);                  // elbow tufts
      Lm(t, 4, 41, 2, 2.5, 46, 0.5, FUR, FO);
    });
    A.part(E, function (t) { Lm(t, 11, 24 - br, 8.6, 8, 33.5, 7.6, FUR, FO); });
    A.part(E, function (t) { B(t, 11.5, 20.5 - br, 10.5, 9.6, FUR, FO); });
    fist(11, 53, 1.06, { lo: 0.18, hi: 0.95, d: 0.5 });
    // broken shackle + dangling chain on the near wrist
    A.part(STEEL[0], function (t) {
      var c = new Bitmap(W, H), y0 = PY(42);
      Lm(c, 8.4, 38, 9.2, 10.8, 47, 8.6, STEEL, { lo: 0.1, hi: 0.86, gamma: 1.2, d: 0.3 });
      t.blitPart(c, 0, y0, W, 5, 0, y0);
      tint(t, STEEL[1], [PX(6), y0 + 3, PX(12), y0 + 3, PX(16), y0 + 3]);
      tint(t, STEEL[7], [PX(5), y0, PX(5) + 1, y0, PX(5) + 2, y0]);
      for (var x = 0; x < W; x++) if (t.get(x, y0 + 4)) t.pset(x, y0 + 4, STEEL[1]);
    });
    stamp(b, PX(18), PY(44.5), legend({ s: 'steel4', d: 'steel1', h: 'steel6', k: 'outline' }), [
      'khk..',
      'ksdk.',
      'kshk.',
      '.ksdk',
      '.kshk',
      '.khsk',
      '..kk.'
    ]);

    // three ragged neck stumps
    [[15, 11], [35, 7], [54, 12]].forEach(function (p, i) {
      var x = p[0], y = p[1] - br;
      A.part(E, function (t) {
        B(t, x, y, 6.2, 4.6, FUR, i === 2 ? { lo: 0.05, hi: 0.8, tex: fur, d: 0.25 } : FO);
        Lm(t, x - 5, y - 1, 1.6, x - 7, y - 4, 0.4, FUR, FO); Lm(t, x + 5, y - 1, 1.6, x + 7, y - 4, 0.4, FUR, FO);
        t.ellipse(X(x), Y(y - 2), 3.8 * S, 2 * S, GORE[0]);
        t.ellipse(X(x), Y(y - 2.2), 2.6 * S, 1.2 * S, GORE[1]);
        pix(t, BONE[3], [PX(x), PY(y - 2.6), PX(x) + 1, PY(y - 2.6)]);
      });
    });
    return A;
  }

  /* --- heads: 0 idle, 1 roaring, 2 hurt (hand-placed pixels) --- */
  var L1 = GNG.makeLegend({
    1: 'dusk1', 2: 'brown1', 3: 'brown2', 4: 'brown3', 5: 'brown4', 6: 'brown5', 7: 'tan5',
    a: 'zombie0', b: 'zombie1', c: 'zombie2', d: 'zombie3', e: 'zombie4', f: 'zombie5', g: 'zombie6',
    o: 'bone6', p: 'bone4', q: 'bone2', t: 'bone7', u: 'bone5',
    W: 'white', Y: 'hotyellow', O: 'hotorange', r: 'red0', R: 'red2', T: 'red4'
  });
  var B1_TOP = [
    '........................',
    '.........76.............',
    '.......77665............',
    '.....7766655544.........',
    '...oo766665554443.......',
    '..ooop6666555444332.....',
    '..opq26665555444333.....',
    '..p26555544444433332....',
    '..5544666655555444433...',
    '..44332111111111111112..'
  ];
  var B1_MID = [
    '.eac321cdcbbcdeedbbccb1.',
    '.dac221acefffeeffedddcb.',
    '.ccb221cefggfeaaeeaadcb.',
    '..43221dfgggffedeedddcb.',
    '..54321ceffffeeeedddccb.'
  ];
  ascii('b1_head0', L1, B1_TOP.concat([
    '.efd432baaYWabcbaYWab2..',
    '.fad321cbaOYabccaOYac21.'
  ], B1_MID, [
    '...5321bdeeteedddddtcbb.',
    '...4321caaauaaaaaaauaab.',
    '....3211bcddeedddcccba..',
    '....4321bccdddcccbbba...',
    '.....321.abbccbbbaaa....',
    '......2.................',
    '........................'
  ]), 12, 12);
  ascii('b1_head1', L1, B1_TOP.concat([
    '.efd432baaWWabcbaWWab2..',
    '.fad321cbaYWabccaYWac21.'
  ], B1_MID, [
    '...5321battrtrtrtrttrab.',
    '...4321batrrrrrrrrrtrab.',
    '....3211artRTTTRrrtrab..',
    '....4321batrtRtrtrtab...',
    '.....321bcddeedddccba...',
    '......2..bccddcccbba....',
    '........................'
  ]), 12, 12);
  ascii('b1_head2', L1, B1_TOP.concat([
    '.efd432bcaaccbcbccaac2..',
    '.fad321ccccaacccaaccc21.'
  ], B1_MID, [
    '...5321baaaaaaaaaaaaaab.',
    '...4321catutututututuab.',
    '....3211baaaaaaaaaaaaa..',
    '....4321bccdddcccbbba...',
    '.....321.abbccbbbaaa....',
    '......2.................',
    '........................'
  ]), 12, 12);

  /* --- neck segment: furry vertebra ball --- */
  (function () {
    var A = new Art(10, 10);
    A.part(null, function (t) {
      ball(t, 4.5, 4.5, 3.6, 3.6, FUR, { lo: 0.1, hi: 0.98, gamma: 1.3, tex: chunk(9, 0.06, 2, 2), d: 0.2, rim: 0.12 });
    });
    A.done('b1_neck0', 5, 5);
  })();

  b1Body(0).done('b1_body0', 37, 63);
  b1Body(1).done('b1_body1', 37, 63);

  /* ====================================================================== *
   *  BOSS 2 — THE DRAGON OF DAVENTRY  (stage 2)
   *
   *  ASSEMBLY: a chain following a path — head, ~6 x b2_seg0, ~4 x b2_seg1, b2_tail0.
   *  Space seg0 about 11 px apart and seg1 about 8 px apart; draw tail-first so each
   *  part overlaps the one behind it and the head goes on last. The neck joins the head
   *  12 px behind / 1 px above its centre anchor. The fire leaves the mouth at about
   *  (+12,+6) from the head anchor (open frame). The tail spade points away from the head.
   * ====================================================================== */

  var DRG = ramp('green0', 'green1', 'green2', 'green3', 'green4', 'green5', 'green6', 'green7');
  var BEL = ramp('brown1', 'sand1', 'sand2', 'sand3', 'sand4', 'sand5', 'sand6', 'sand7');

  function rotPts(pts, cx, cy, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return pts.map(function (p) { return [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]; });
  }

  /* --- head: f 0 closed, 1 open / breathing fire, 2 hurt --- */
  function b2Head(f) {
    var W = 38, H = 28, A = new Art(W, H), b = A.b;
    var HX = 12, HY = 16.5, ang = f === 1 ? 0.29 : (f === 2 ? 0.19 : 0);
    function R(pts) { return rotPts(pts, HX, HY, ang); }

    // far horn (in shadow)
    A.part(null, function (t) {
      limb(t, 18, 6.8, 1.9, 14, 3, 1.1, BONE, { lo: 0.1, hi: 0.5, d: 0.2 });
      limb(t, 14, 3, 1.1, 12, 1.4, 0.5, BONE, { lo: 0.1, hi: 0.5, d: 0.2 });
    });
    // webbed frill behind the jaw: dark red membrane, three bone spines
    A.part(null, function (t) {
      var m = mask(t, function (m) {
        m.poly([[12, 14], [1.5, 16], [4.6, 18.4], [2.4, 21.6], [6, 22.2], [7, 25.6], [10, 22.8], [13.5, 21]], 1);
      });
      puff(t, m, REDR, { R: 2.2, lo: 0.14, hi: 0.66, d: 0.3 });
      [[1.5, 16], [2.4, 21.6], [7, 25.6]].forEach(function (q) {
        tintLine(t, BONE[5], 11, 17, q[0], q[1]);
        tint(t, BONE[7], [Math.round(q[0]), Math.round(q[1])]);
      });
    });
    // mouth interior (visible when the jaw drops)
    if (ang > 0) {
      A.part(null, function (t) {
        var tip = R([[31, 16.8]])[0], x, y;
        var m = mask(t, function (m) { m.poly([[HX, HY - 0.5], [32, 16], tip, [HX, HY + 1]], 1); });
        var G = GNG.RAMPS.glow, order = [4, 3, 2, 1, 0];
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          if (!m.data[y * W + x]) continue;
          var half = Math.max(0.6, (x - HX) * Math.tan(ang) * 0.5), mid = HY + half;
          var cl = Math.abs(y - mid) / half, u = (x - 14) / 17;
          if (f === 1) {
            // furnace breath: glow bands (colour-cycled by the game), hottest along the centre line
            var band = Math.floor(cl * 2 + u * 1.6 + bayer(x, y) * 0.8);
            t.pset(x, y, band > 4 ? GORE[1] : G[order[band]]);
          } else {
            t.pset(x, y, sh(GORE, 0.05 + (1 - cl) * 0.5 * (1 - u), x, y, 0.5));
          }
        }
      });
    }
    // lower jaw (rotates about the hinge)
    A.part(DRG[0], function (t) {
      var m = mask(t, function (m) {
        m.poly(R([[11, 16.5], [34, 16.8], [35.2, 18.2], [32, 20.2], [22, 21.2], [13, 21.2], [9.5, 19]]), 1);
        m.poly(R([[23, 20], [26, 20], [23.6, 22.8]]), 1);        // chin barbs
        m.poly(R([[28, 19.6], [31, 19.6], [28.8, 22]]), 1);
      });
      puff(t, m, DRG, { R: 2.6, lo: 0.1, hi: 0.8, d: 0.35 });
      var u = mask(t, function (u) { u.poly(R([[12, 18.7], [33.5, 18.9], [32, 20.2], [22, 21.2], [13, 21.2], [10.5, 19.6]]), 1); });
      for (var i = 0; i < u.data.length; i++) {
        if (!u.data[i] || !t.data[i]) continue;
        var k = DRG.indexOf(t.data[i]);
        if (k >= 0) t.data[i] = BEL[Math.min(7, k + 2 - (((i % W) % 3 === 0) ? 2 : 0))];
      }
    });
    // skull + snout
    A.part(DRG[0], function (t) {
      var m = mask(t, function (m) {
        m.ellipse(13, 12, 7.5, 6.5, 1);
        m.poly([[15, 6], [23, 8], [33.5, 10.8], [36, 12.8], [36, 15.2], [34, 16.5], [12, 16.5], [9, 12]], 1);
        m.ellipse(18.5, 8, 5, 2.4, 1);
        m.ellipse(33, 11, 2.3, 1.9, 1);
        m.poly([[29, 10], [30.6, 7.4], [31.4, 10.4]], 1);            // nose horn
      });
      puff(t, m, DRG, { R: 5.5, lo: 0.1, hi: 0.98, gamma: 1.15, d: 0.35, rim: 0.1 });
      // cheek scales + snout scutes
      var x, y;
      for (y = 9; y < 16; y++) for (x = 6; x < 15; x++) {
        if (((y & 1) === 0) && ((x + (y >> 1) * 2) % 4 === 0)) { nudge(t, x, y, DRG, -2); nudge(t, x + 1, y + 1, DRG, -1); nudge(t, x - 1, y + 1, DRG, -1); }
      }
      for (x = 22; x < 33; x += 3) { nudge(t, x, Math.round(8.4 + (x - 22) * 0.27), DRG, 1); nudge(t, x + 1, Math.round(9.6 + (x - 22) * 0.27), DRG, -1); }
      // lip shadow
      for (x = 14; x < 35; x++) nudge(t, x, 16, DRG, -1);
    });
    // near horn (ridged)
    A.part(DRG[0], function (t) {
      limb(t, 12, 8.2, 2.6, 6.8, 4.8, 1.8, BONE, { lo: 0.25, hi: 1, d: 0.2 });
      limb(t, 6.8, 4.8, 1.8, 2, 2.2, 0.6, BONE, { lo: 0.25, hi: 1, d: 0.2 });
      for (var k = 0; k < 4; k++) { var hx = Math.round(10.4 - k * 2.2), hy = Math.round(8.4 - k * 1.45); nudge(t, hx, hy, BONE, -2); nudge(t, hx, hy - 1, BONE, -2); }
    });
    // brow spike behind the eye
    A.part(DRG[0], function (t) {
      limb(t, 14.5, 9.4, 1.4, 11.2, 9.6, 0.4, DRG, { lo: 0.3, hi: 0.9, d: 0.2 });
    });
    var Lg = legend({ k: 'green0', Y: 'hotyellow', W: 'white', O: 'hotorange', K: 'black', g: 'green3', G: 'green5' });
    if (f === 2) {
      stamp(b, 15, 9, Lg, [
        'kkkkkkk',
        'kgGGgkk',
        '.kkkkk.'
      ]);
    } else {
      stamp(b, 15, 9, Lg, [
        'kkkkkk..',
        'kOYKYWkk',
        '.kOKYYk.',
        '..kkkk..'
      ]);
    }
    // nostril
    pix(b, DRG[0], [33, 11, 34, 11, 34, 12]); pix(b, DRG[7], [32, 10, 33, 10]);
    // teeth: upper fangs hang from the lip, lower fangs rise from the jaw
    var WH = GNG.C.white;
    [[17, 2], [21, 2], [25, 2], [29, 3], [33, 2]].forEach(function (q) {
      for (var k = 0; k < q[1]; k++) b.pset(q[0], 16 + k, (k === q[1] - 1 && q[1] > 2) ? BONE[5] : WH);
    });
    (ang > 0 ? [[19, 2], [23, 2], [27, 3], [31, 2]] : [[23, 2], [31, 2]]).forEach(function (q) {
      var base = R([[q[0], 17.2]])[0], x = Math.round(base[0]), y = Math.round(base[1]);
      for (var k = 0; k < q[1]; k++) b.pset(x, y - k, WH);
    });
    return A;
  }
  b2Head(0).done('b2_head0', 19, 14);
  b2Head(1).done('b2_head1', 19, 14);
  b2Head(2).done('b2_head2', 19, 14);

  /* --- body segments: scaled ball, plated belly crescent, dorsal thorn --- */
  function b2Seg(name, n, r, spike) {
    var A = new Art(n, n), c = (n - 1) / 2, cy = n - 1.5 - r, top = cy - r;
    A.part(DRG[0], function (t) {
      ball(t, c, cy, r, r, DRG, { lo: 0.1, hi: 1, gamma: 1.15, d: 0.3, rim: 0.14 });
      var x, y, i, px, dx, edge, th;
      // scales: staggered crescents on the back
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
        if (y > cy + r * 0.25 || y < cy - r * 0.72) continue;
        if (((y % 3) === 0) && ((x + ((y / 3) | 0) * 2) % 4 === 0)) { nudge(t, x, y, DRG, -2); nudge(t, x - 1, y - 1, DRG, -1); nudge(t, x + 1, y - 1, DRG, -1); }
      }
      // plated belly: a crescent hugging the underside, on the sand ramp
      for (x = 0; x < n; x++) {
        dx = (x - c) / r; if (Math.abs(dx) >= 1) continue;
        edge = cy + r * Math.sqrt(1 - dx * dx);
        th = r * 0.62 * (1 - dx * dx * 0.9);
        for (y = Math.ceil(edge - th); y <= Math.floor(edge); y++) {
          px = t.get(x, y); if (!px) continue;
          i = DRG.indexOf(px); if (i < 0) continue;
          t.pset(x, y, BEL[Math.min(7, i + 2 - ((x % 3) === 0 ? 2 : 0))]);
        }
      }
    });
    // dorsal thorn (leans back) with a red web behind it
    A.part(DRG[0], function (t) {
      t.poly([[c - spike * 1.45, top + 3.4], [c - spike * 0.7, 2.2], [c + 0.4, top + 3.6]], REDR[2]);
      t.poly([[c - spike * 1.45 + 1.4, top + 3.4], [c - spike * 0.66, 3.4], [c - 0.6, top + 3.6]], REDR[4]);
      limb(t, c + 1.2, top + 3, 1.9, c - spike * 0.25, top * 0.5 + 1.6, 1.1, BONE, { lo: 0.3, hi: 1, d: 0.2 });
      limb(t, c - spike * 0.25, top * 0.5 + 1.6, 1.1, c - spike * 0.7, 1.5, 0.4, BONE, { lo: 0.3, hi: 1, d: 0.2 });
    });
    A.done(name, n >> 1, n >> 1);
  }
  b2Seg('b2_seg0', 18, 6.5, 4.2);
  b2Seg('b2_seg1', 14, 4.8, 3.2);

  /* --- tail spade (points left, away from the head) --- */
  (function () {
    var A = new Art(18, 14);
    A.part(null, function (t) {
      var m = mask(t, function (m) {
        m.poly([[1, 6.5], [9, 1], [11.4, 1.6], [9.6, 4.6], [16.4, 3.8], [16.4, 9.2], [9.6, 8.4], [11.4, 11.4], [9, 12], [1, 6.5]], 1);
      });
      puff(t, m, DRG, { R: 3, lo: 0.12, hi: 0.98, d: 0.3 });
      tintLine(t, DRG[7], 4, 6, 15, 6); tintLine(t, DRG[1], 4, 7, 15, 7);
      tint(t, BONE[6], [1, 6, 2, 6, 3, 6, 2, 5]); tint(t, BONE[4], [1, 7, 2, 7, 3, 7]);
      tint(t, REDR[3], [9, 2, 10, 2, 9, 11, 10, 11, 10, 3, 10, 10]); tint(t, REDR[5], [9, 1, 10, 1]);
    });
    A.done('b2_tail0', 9, 7);
  })();

  /* ====================================================================== *
   *  BOSS 3 — THE SHADOW VIZIER  (stage 3)
   *
   *  ASSEMBLY: b3_body floats (anchor = centre); bob it +-3 px. The two hands hover
   *  independently, resting about (+-34, +2) from the body centre; draw the rear hand
   *  mirrored. Smoke at the hem is dithered and deliberately has no outline.
   * ====================================================================== */

  var ROBE = ramp('night0', 'night1', 'indigo1', 'indigo2', 'purple2', 'purple3', 'purple4', 'purple5');
  var TURB = ramp('indigo2', 'indigo3', 'indigo4', 'indigo5', 'indigo6', 'indigo7', 'mist7', 'white');
  var VSK = ramp('dusk0', 'dusk1', 'maroon2', 'skin1', 'skin2', 'skin3', 'skin4', 'skin5');
  var GOLD = GNG.RAMPS.gold;

  function b3Body(f) {
    var W = 48, H = 56, A = new Art(W, H), b = A.b;
    var cloth = grain(31, 0.07, 0.55, 0.12);
    var RO = { R: 5, lo: 0.08, hi: 0.86, d: 0.5, tex: cloth };
    var sway = f ? 1 : 0, sg = f ? -1 : 1;
    var SM = { lo: 0.06, hi: 0.74, gamma: 1.3, d: 0.6 };

    // billowing skirt of smoke (the solid upper billows are outlined with the body)
    A.part(null, function (t) {
      ball(t, 24 + sg * 4.5, 49.6, 6.4, 5.2, ROBE, SM);
      ball(t, 24 - sg * 4, 47.4, 8, 6.4, ROBE, SM);
      ball(t, 24 + sg * 2, 44.5, 11.4, 6.4, ROBE, SM);
    });

    // high collar wings behind the head: red lining, gold rim
    [-1, 1].forEach(function (s) {
      A.part(null, function (t) {
        var tipY = 11 - sway * (s > 0 ? 1 : 0);
        var m = mask(t, function (m) { m.poly([[24 + s * 9, 27], [24 + s * 14, tipY], [24 + s * 6.5, 17], [24 + s * 3, 25]], 1); });
        puff(t, m, REDR, { R: 3, lo: 0.1, hi: s < 0 ? 0.7 : 0.5, d: 0.4 });
        tintLine(t, GOLD[s < 0 ? 5 : 3], 24 + s * 9.6, 26, 24 + s * 14, tipY);
        tintLine(t, ROBE[2], 24 + s * 10.6, 26, 24 + s * 15, tipY + 1);
      });
    });

    // robe: chest tapering to the waist
    A.part(ROBE[0], function (t) {
      var m = mask(t, function (m) {
        m.poly([[9, 24], [18, 22], [30, 22], [39, 24], [41, 30], [36, 35], [35, 42], [13, 42], [12, 35], [7, 30]], 1);
      });
      puff(t, m, ROBE, RO);
      // inner garment + gold-edged opening
      t.poly([[22.4, 30], [26.6, 30], [26.4, 38], [22.6, 38]], ROBE[0]);
      tintLine(t, GOLD[5], 21.6, 31, 22, 38); tintLine(t, GOLD[3], 27.4, 31, 27, 38);
    });
    // broad gold collar-necklace (so the black goatee reads against it)
    A.part(ROBE[0], function (t) {
      var m = mask(t, function (m) { m.poly([[17.5, 23], [31.5, 23], [29, 29.5], [24.5, 33.5], [20, 29.5]], 1); });
      puff(t, m, GOLD, { R: 3, lo: 0.2, hi: 0.95, d: 0.4 });
      tintLine(t, GOLD[2], 19, 26, 24.5, 31); tintLine(t, GOLD[2], 30, 26, 24.5, 31);
    });
    stamp(b, 23, 30, legend({ g: 'gold5', G: 'gold7', d: 'gold1', r: 'hotred', R: 'red2', w: 'white' }), [
      'dwrd',
      'drRd',
      '.dd.'
    ]);

    // sash with gold studs
    A.part(ROBE[0], function (t) {
      var m = mask(t, function (m) { m.poly([[12, 38], [36, 38], [36.5, 42.5], [11.5, 42.5]], 1); });
      puff(t, m, REDR, { R: 2.2, lo: 0.15, hi: 0.8, d: 0.4 });
      for (var x = 13; x < 36; x += 4) tint(t, GOLD[5], [x, 40, x + 1, 40]);
      tintLine(t, GOLD[4], 12, 38, 36, 38);
    });

    // pointed shoulder mantles with gold trim
    [[-1, 0.9], [1, 0.62]].forEach(function (sd) {
      var s = sd[0];
      A.part(ROBE[0], function (t) {
        var m = mask(t, function (m) {
          m.poly([[24 + s * 9, 22.5], [24 + s * 17, 20.5], [24 + s * 22.4, 17 - sway], [24 + s * 21.4, 24], [24 + s * 16.5, 29.5], [24 + s * 9.5, 29]], 1);
        });
        puff(t, m, ROBE, { R: 4, lo: 0.1, hi: sd[1] + 0.06, d: 0.5, tex: cloth });
        tintLine(t, GOLD[s < 0 ? 5 : 3], 24 + s * 21.4, 24, 24 + s * 16.5, 29.4);
        tintLine(t, GOLD[s < 0 ? 4 : 2], 24 + s * 16.5, 29.4, 24 + s * 10, 29);
        tint(t, GOLD[7], [Math.round(24 + s * 22.4), Math.round(17 - sway), Math.round(24 + s * 21.6), Math.round(18 - sway)]);
      });
    });

    // head: gaunt face, hand-placed features, pointed goatee
    A.part(ROBE[0], function (t) {
      ball(t, 24.5, 19, 5.6, 6.6, VSK, { lo: 0.2, hi: 0.85, d: 0.3 });
    });
    stamp(b, 19, 14, legend({ 1: 'dusk1', 2: 'maroon2', 3: 'skin1', 4: 'skin2', 5: 'skin3', 6: 'skin4', k: 'night0', n: 'indigo3',
      Y: 'hotyellow', W: 'white', O: 'hotorange', r: 'red1' }), [
      '.355666554 .'.replace(' ', '2'),
      '.kk5666554kk'.slice(0, 12).replace(/k$/, 'k'),
      '.3kk565kk32.',
      f ? '.3WWW65WWW1.' : '.3OYW65WYO1.',
      '.433565322 .'.replace(' ', '1'),
      '.455566433..',
      '.344353332..',
      '.kkk444kkk..',
      '.k34rrr32k..',
      '..3455432...',
      '...kkkkk....',
      '...knkkk....',
      '....knk.....',
      '....kkk.....',
      '.....kk.....',
      '......kk....'
    ]);

    // turban: wrapped cloth, ruby and plume
    A.part(ROBE[0], function (t) {
      var m = mask(t, function (m) {
        m.ellipse(24, 8.5, 10.5, 6.6, 1);
        m.ellipse(24, 5, 6, 3.6, 1);
        m.rect(15, 9, 19, 4, 1);
      });
      puff(t, m, TURB, { R: 6, lo: 0.1, hi: 1, gamma: 1.1, d: 0.4 });
      // wrap creases fanning from the jewel
      [[26, 11, 15, 6], [26, 10, 19, 3], [27, 10, 26, 2], [28, 10, 33, 4], [28, 11, 34, 8]].forEach(function (q) {
        var c = new Bitmap(W, H), i;
        c.line(q[0], q[1], q[2], q[3], 1);
        for (i = 0; i < c.data.length; i++) if (c.data[i] && t.data[i]) { nudge(t, i % W, (i / W) | 0, TURB, -2); nudge(t, (i % W) - 1, (i / W) | 0, TURB, 1); }
      });
      for (var x = 14; x < 35; x++) nudge(t, x, 13, TURB, -2);
    });
    stamp(b, 25, 8, legend({ g: 'gold5', G: 'gold7', d: 'gold2', r: 'hotred', R: 'red2', w: 'white' }), [
      '.gG.',
      'gwrd',
      'grRd',
      '.dd.'
    ]);
    // plume
    A.part(ROBE[0], function (t) {
      limb(t, 27, 7, 1.6, 30 + sway, 2.6, 1.2, REDR, { lo: 0.3, hi: 0.95, d: 0.3 });
      limb(t, 30 + sway, 2.6, 1.2, 33 + sway * 2, 1.6, 0.5, REDR, { lo: 0.3, hi: 0.95, d: 0.3 });
    });

    b.outline(OUT);

    // trailing wisps: dithered, unoutlined puffs that thin out toward the tail
    var wisps = [[24 - sg * 3.4, 52.2, 4.6, 3.4, 0.78], [24 + sg * 3, 54, 3, 2, 0.55], [24 - sg * 9.5, 51.6, 2.2, 1.8, 0.5],
      [24 + sg * 11, 49.5, 1.8, 1.5, 0.45], [24 - sg * 1, 55, 1.6, 1, 0.4], [24 + sg * 9, 53.4, 1.3, 1, 0.4]];
    wisps.forEach(function (q) {
      var t = new Bitmap(W, H), i, x, y;
      ball(t, q[0], q[1], q[2], q[3], ROBE, { lo: 0.1, hi: 0.7, d: 0.6 });
      for (i = 0; i < t.data.length; i++) {
        if (!t.data[i]) continue;
        x = i % W; y = (i / W) | 0;
        if (b.data[i] && b.data[i] !== OUT) continue;
        if (bayer(x, y) < q[4]) b.data[i] = t.data[i];
      }
    });
    return GNG.regSprite('b3_body' + f, b, { ax: 24, ay: 28 });
  }
  b3Body(0);
  b3Body(1);

  /* --- the Vizier's disembodied hands: 0 open relaxed palm, 1 casting claw + magic glow --- */
  function b3Hand(f) {
    var A = new Art(20, 20), b = A.b, E = VSK[0];
    var SK = { lo: 0.22, hi: 0.92, d: 0.3, rim: 0.1 };
    function cuff(pts, x0, y0, x1, y1) {
      A.part(null, function (t) {
        var m = mask(t, function (m) { m.poly(pts, 1); });
        puff(t, m, ROBE, { R: 2.6, lo: 0.3, hi: 1, d: 0.4 });
        tintLine(t, GOLD[5], x0, y0, x1, y1);
        tint(t, GOLD[7], [Math.round(x0), Math.round(y0)]);
      });
    }
    function finger(pts, r0, r1) {
      A.part(E, function (t) {
        for (var i = 0; i + 3 < pts.length; i += 2) {
          var k0 = i / (pts.length - 2), k1 = (i + 2) / (pts.length - 2);
          limb(t, pts[i], pts[i + 1], lerp(r0, r1, k0), pts[i + 2], pts[i + 3], lerp(r0, r1, k1), VSK, SK);
        }
      });
    }
    if (f === 0) {
      cuff([[5.5, 14.4], [13.6, 14.4], [15.4, 18], [3.6, 18]], 5.6, 14.6, 13.6, 14.6);
      finger([6.3, 9.5, 4.3, 4.4], 1.5, 1.05);
      finger([8.5, 8.6, 7.8, 2.4], 1.5, 1.05);
      finger([10.9, 8.6, 11.3, 2], 1.5, 1.05);
      finger([13.1, 9.4, 14.4, 3.6], 1.45, 1.05);
      A.part(E, function (t) {
        limb(t, 9.6, 12.4, 3, 9.6, 14.6, 2.6, VSK, SK);
        ball(t, 9.7, 10.4, 4.7, 3.7, VSK, SK);
      });
      finger([13.2, 11.8, 16, 10, 17.6, 7.6], 1.6, 1.05);
      // palm creases, nails, rings
      tint(b, VSK[2], [7, 11, 8, 12, 9, 12, 10, 11, 11, 11, 12, 10]);
      tint(b, VSK[7], [4, 4, 8, 2, 11, 2, 14, 3, 18, 7]);
      tint(b, GOLD[6], [7, 6, 8, 6]); tint(b, GOLD[3], [9, 6]);
      tint(b, GOLD[6], [10, 5]); tint(b, C.hotred, [11, 5]); tint(b, GOLD[3], [12, 5]);
      tint(b, GOLD[5], [15, 10]); tint(b, GOLD[3], [16, 11]);
      b.outline(OUT);
    } else {
      cuff([[2.2, 11.2], [6.6, 15.4], [3.8, 18.4], [0.8, 15]], 2.6, 11.6, 6.4, 15.2);
      // far fingers first, then palm, near fingers and thumb curl around the charge
      finger([8.6, 7.6, 12, 3.2, 15.6, 2.6, 17.4, 4.6], 1.5, 0.9);
      A.part(E, function (t) {
        limb(t, 5, 13.6, 2.6, 7, 11.6, 2.8, VSK, SK);
        ball(t, 8.2, 10.4, 4, 4.2, VSK, SK);
      });
      finger([9.6, 8, 13.4, 5.4, 16.6, 5.8, 18, 8], 1.5, 0.9);
      finger([9.6, 13, 12.6, 16.2, 16, 16.6, 17.6, 14.6], 1.6, 0.9);
      tint(b, GOLD[6], [11, 5, 12, 4]); tint(b, C.hotred, [11, 4]);
      tint(b, GOLD[6], [11, 15]); tint(b, GOLD[3], [12, 16]);
      tint(b, VSK[7], [17, 4, 18, 8, 17, 14]);
      b.outline(OUT);
      // the charge: palette-cycled glow, no outline
      var G = GNG.RAMPS.glow, x, y, d;
      for (y = 6; y <= 14; y++) for (x = 10; x <= 18; x++) {
        d = Math.sqrt((x - 14.2) * (x - 14.2) + (y - 10.4) * (y - 10.4));
        if (d > 3.7) continue;
        if (b.get(x, y) && b.get(x, y) !== OUT && d > 2.2) continue;
        if (d > 3 && bayer(x, y) > 0.5) continue;
        b.pset(x, y, d < 1 ? C.white : (d < 2 ? G[4] : (d < 3 ? G[3] : G[2])));
      }
      pix(b, G[4], [19, 5, 16, 1, 12, 18, 19, 12]);
    }
    return GNG.regSprite('b3_hand' + f, b, { ax: 10, ay: 10 });
  }
  b3Hand(0);
  b3Hand(1);

  /* ====================================================================== *
   *  BOSS 4 — MEGA-BLOCKER  (stage 4, a giant zombie Lemming "Blocker")
   *
   *  ASSEMBLY: single-piece sprites, 72x72, anchor bottom-centre (36,72), seen
   *  frontally (symmetric enough to mirror freely). Feet stand on row 70.
   *    b4_body0..1  idle: arms out, breathing + foot tap
   *    b4_stomp0    airborne: knees up, robe flaring (feet end ~5 px above the anchor)
   *    b4_ohno0..1  hands on head, shaking: about to detonate
   *    b4_hurt0     recoiling
   *  Hands (for hit boxes / shockwaves) sit at about (+-31,-37) in the idle frames.
   * ====================================================================== */

  var ROBE4 = ramp('night0', 'night1', 'blue1', 'blue2', 'blue3', 'blue4', 'blue5', 'blue6');
  var HAIR4 = ramp('green0', 'green1', 'green2', 'green3', 'green4', 'toxic3', 'toxic4', 'toxic6');

  function b4(name, p) {
    var W = 72, H = 72, A = new Art(W, H), b = A.b;
    var br = p.br || 0, lean = p.lean || 0, fl = p.flare || 0;
    var hcx = 36 + (p.hx || 0) + lean, hcy = 23.5 - br + (p.hy || 0);
    var sy = 33 - br;                                    // shoulder line
    var E = ROBE4[0], ES = HIDE[0];
    var cloth = grain(41, 0.06, 0.5, 0.11);
    var rot = function (x, y) { return (GNG.noise2(x * 0.33, y * 0.33, 77) - 0.5) * 0.2; };
    var SKN = { lo: 0.14, hi: 0.92, d: 0.45, tex: rot, rim: 0.1 };
    var SKF = { lo: 0.1, hi: 0.72, d: 0.45, tex: rot };

    // ---- legs + feet -------------------------------------------------
    [-1, 1].forEach(function (s) {
      var o = s < 0 ? SKN : SKF, tuck = p.legs === 'tuck';
      var tap = (s > 0 && p.tap) ? 1 : 0;
      var hipx = 36 + s * 7.5, hipy = 56, kx, ky, fx, fy;
      if (tuck) { kx = 36 + s * 15; ky = 59; fx = 36 + s * 17.5; fy = 64; }
      else { kx = 36 + s * 8.5; ky = 64; fx = 36 + s * 10; fy = 67.6 - tap; }
      A.part(ES, function (t) { limb(t, hipx, hipy, 4.6, kx, ky, 4, HIDE, o); });
      A.part(ES, function (t) {
        ball(t, fx, fy, 6.2, 2.9, HIDE, o);
        if (tap) ball(t, fx + 3, fy - 1.2, 3, 2.2, HIDE, o);
      });
      // toes
      [-3.6, 0, 3.6].forEach(function (dx) { tint(A.b, HIDE[1], [Math.round(fx + dx + 1.8), Math.round(fy + 1.6), Math.round(fx + dx + 1.8), Math.round(fy + 2.4)]); });
      // ankle shackle
      A.part(STEEL[0], function (t) {
        var c = new Bitmap(W, H), yy = Math.round(ky - 2.6);
        limb(c, hipx, hipy, 5.4, kx, ky, 4.9, STEEL, { lo: 0.15, hi: s < 0 ? 0.9 : 0.7, d: 0.3 });
        t.blitPart(c, 0, yy, W, 3, 0, yy);
      });
    });

    // ---- robe: blue bell with a ragged, hazard-striped hem -------------
    var hemY = 58 - (p.legs === 'tuck' ? 4 : 0), hl = 15 - fl, hr = 57 + fl;
    A.part(E, function (t) {
      var m = mask(t, function (m) {
        var pts = [[26 + lean, sy], [46 + lean, sy], [52.5 + lean * 0.6 + fl * 0.3, sy + 12], [hr, hemY]], i, n = 8;
        for (i = 0; i <= n; i++) pts.push([hr - (hr - hl) * i / n, hemY + ((i & 1) ? 4.6 : 1.2) - (fl ? Math.sin(i / n * Math.PI) * -1.5 : 0)]);
        pts.push([hl, hemY], [19.5 + lean * 0.6 - fl * 0.3, sy + 12]);
        m.poly(pts, 1);
        m.ellipse(36 + lean * 0.5, sy + 14 + br * 0.5, 17.5 + br * 0.6, 13, 1);            // pot belly
      });
      puff(t, m, ROBE4, { R: 9, lo: 0.08, hi: 0.95, d: 0.5, tex: cloth, rim: 0.08 });
      // hazard band along the hem
      var x, y, c, k, base = Math.round(hemY - 3);
      for (x = 0; x < W; x++) for (y = base; y < base + 3; y++) {
        c = t.get(x, y); if (!c) continue;
        k = ROBE4.indexOf(c);
        t.pset(x, y, (((x + y) >> 2) & 1) ? ROBE4[0] : GOLD[Math.max(2, Math.min(6, k))]);
      }
      // folds
      [[24, 44, 21, 55], [31, 50, 30, 56], [42, 50, 43, 56], [48, 44, 51, 55]].forEach(function (q) {
        var c2 = new Bitmap(W, H), i;
        c2.line(q[0] + lean * 0.5, q[1], q[2], q[3] - (p.legs === 'tuck' ? 4 : 0) - 3, 1);
        for (i = 0; i < c2.data.length; i++) if (c2.data[i] && t.data[i]) { nudge(t, i % W, (i / W) | 0, ROBE4, -1); nudge(t, (i % W) + 1, (i / W) | 0, ROBE4, 1); }
      });
    });

    // ---- bolted-on, cracked STOP sign ---------------------------------
    var px = Math.round(26 + lean * 0.7), py = Math.round(sy + 6 + br);
    A.part(E, function (t) {
      stamp(t, px, py, legend({ S: 'steel6', s: 'steel3', d: 'steel1', h: 'red5', R: 'red4', r: 'red3', m: 'red2', w: 'white', g: 'bone5', x: 'red0', b: 'steel7' }), [
        '....SSSSSSSSSSSSS....',
        '...ShhhhhRRRRRRxRs...',
        '..SbhRRRRRRRRRxxRbs..',
        '.ShRRRRRRRRRRRRxrrrs.',
        'SRRwwwRwwwRwwwRxwwrrs',
        'SRRwRRRRwRRwRwxRwRwrs',
        'SRRwwwRRwRRwRwxrwwwrs',
        'SRRRRgRRgRRgRgrxgrrms',
        'SRrgggRrgrrgggrxgrmms',
        '.srrrrrrrrrrrrxrmmms.',
        '..sbrrrrrrrrmxxmmbd..',
        '...srrrrmmmmmxmmmd...',
        '....sddddddddxddd....'
      ]);
    });

    // ---- arms ---------------------------------------------------------
    function arm(s) {
      var pose = s < 0 ? p.armL : p.armR, o = s < 0 ? SKN : SKF;
      var RO = { lo: 0.1, hi: s < 0 ? 0.95 : 0.78, d: 0.5, tex: cloth };
      function mx(x) { return s < 0 ? x + lean : 72 - x + lean; }
      var J;                                   // [shoulder, elbow, wrist, hand, finger dir]
      if (pose === 'head') J = [25, sy + 3, 13, sy - 2, 18.4 + (s < 0 ? (p.hx || 0) : -(p.hx || 0)), hcy - 8, 22 + (s < 0 ? (p.hx || 0) : -(p.hx || 0)), hcy - 11.6, 1.2, -0.5];
      else if (pose === 'up') J = [25, sy + 3, 14, sy - 4, 9.4, sy - 14, 8, sy - 18, -0.3, -1];
      else if (pose === 'down') J = [25, sy + 3, 15, sy + 9, 9, sy + 15, 7, sy + 18, -0.6, 0.8];
      else J = [25, sy + 3, 14, sy + 2 - (p.raise || 0) * 0.5, 7.6, sy + 1.6 - (p.raise || 0), 5.3, sy + 0.6 - (p.raise || 0), 0, -1];
      A.part(ES, function (t) {              // forearm + hand
        limb(t, mx(J[2]), J[3], 3.5, mx(J[4]), J[5], 3.1, HIDE, o);
      });
      A.part(E, function (t) {               // sleeve, flared at the elbow
        limb(t, mx(J[0]), J[1], 5.6, mx(J[2]), J[3], 4.9, ROBE4, RO);
      });
      A.part(STEEL[0], function (t) {        // riveted wrist clamp
        var ex = J[4] - J[2], ey = J[5] - J[3], l = Math.sqrt(ex * ex + ey * ey) || 1;
        ex /= l; ey /= l;
        // a slice of a slightly fatter steel limb, cut square across the forearm
        var c = new Bitmap(W, H), i, x, y, d;
        limb(c, mx(J[2]), J[3], 4.4, mx(J[4]), J[5], 4, STEEL, { lo: 0.2, hi: s < 0 ? 0.95 : 0.75, d: 0.3 });
        for (i = 0; i < c.data.length; i++) {
          if (!c.data[i]) continue;
          x = i % W; y = (i / W) | 0;
          d = (x - mx(J[4])) * (s < 0 ? ex : -ex) + (y - J[5]) * ey;
          if (d > -3.4 && d <= 0.2) t.data[i] = c.data[i];
        }
      });
      A.part(ES, function (t) {
        ball(t, mx(J[6]), J[7], 3.5, 3.9, HIDE, o);
      });
      // splayed fingers ("STOP!")
      A.part(ES, function (t) {
        var fx = J[8], fy = J[9], l = Math.sqrt(fx * fx + fy * fy) || 1, nx, ny, k;
        fx /= l; fy /= l; nx = -fy; ny = fx;
        for (k = -1; k <= 1; k++) {
          var bx = J[6] + nx * k * 2.3 + fx * 2.4, by = J[7] + ny * k * 2.3 + fy * 2.4;
          limb(t, mx(bx), by, 1.25, mx(bx + fx * 3 + nx * k * 0.9), by + fy * 3 + ny * k * 0.9, 0.9, HIDE, o);
        }
      });
    }
    if (p.armL !== 'head') arm(-1);
    if (p.armR !== 'head') arm(1);

    // ---- neck bolts ---------------------------------------------------
    [-1, 1].forEach(function (s) {
      A.part(STEEL[0], function (t) {
        var bx = hcx + s * 11, by = hcy + 7.4;
        limb(t, bx, by, 2, bx + s * 3.6, by, 2, STEEL, { lo: 0.2, hi: s < 0 ? 1 : 0.8, d: 0.2 });
        t.rect(Math.round(bx + s * 3.6 - 0.5), Math.round(by - 3), 2, 6, STEEL[s < 0 ? 5 : 3]);
        t.pset(Math.round(bx + s * 3.6 - 0.5), Math.round(by - 3), STEEL[7]);
        t.rect(Math.round(bx + s * 3.6 - 0.5), Math.round(by + 2), 2, 1, STEEL[1]);
      });
    });

    // ---- head ---------------------------------------------------------
    A.part(ES, function (t) {
      ball(t, hcx, hcy + 1, 12.6, 10.6, HIDE, { lo: 0.16, hi: 0.95, d: 0.45, tex: rot, rim: 0.1 });
      ball(t, hcx - 0.5, hcy + 6.6, 9.6, 5.6, HIDE, { lo: 0.2, hi: 0.86, d: 0.45, tex: rot });         // jowls
    });
    // bolted skull plate over the far eye
    A.part(ES, function (t) {
      var m = mask(t, function (m) { m.poly([[hcx + 1.6, hcy - 6], [hcx + 11.6, hcy - 5], [hcx + 12, hcy + 2.4], [hcx + 8, hcy + 3.6], [hcx + 2.4, hcy + 2.6]], 1); });
      puff(t, m, STEEL, { R: 2, bevel: true, lo: 0.2, hi: 0.78, d: 0.3 });
    });
    var fx0 = Math.round(hcx), fy0 = Math.round(hcy);
    rivet(b, fx0 + 2, fy0 + 1, STEEL); rivet(b, fx0 + 10, fy0 + 1, STEEL);
    var Lf = legend({ k: 'night0', K: 'black', x: 'outline', W: 'white', Y: 'hotyellow', y: 'gold5', R: 'hotred', r: 'red2', d: 'red0', T: 'red4',
      o: 'bone6', p: 'bone4', q: 'bone2', a: 'zombie1', c: 'zombie3', e: 'zombie5', g: 'zombie6', s: 'steel2', S: 'steel5' });
    // eyes: f 0 baleful, 1 wide ("OH NO!"), 2 hurt
    var face = p.face || 0;
    if (face === 0) {
      stamp(b, fx0 - 10, fy0 - 3, Lf, [
        'kkk.....',
        'akkkkkk.',
        '.kyYWWkk',
        '.kYKKWWk',
        '.kyKKYWk',
        '.akyYYk.',
        '..akkka.'
      ]);
      stamp(b, fx0 + 4, fy0 - 3, Lf, [
        '.kkk.',
        'kdrdk',
        'krRrk',
        'kdrdk',
        '.kkk.'
      ]);
    } else if (face === 1) {
      stamp(b, fx0 - 10, fy0 - 5, Lf, [
        '..kkkk..',
        '.kWWWWk.',
        'kWWWWWWk',
        'kWWKKWWk',
        'kWWKKWWk',
        'kyWWWWyk',
        '.kyWWyk.',
        '..kkkk..'
      ]);
      stamp(b, fx0 + 3, fy0 - 4, Lf, [
        '..kkk..',
        '.kRRRk.',
        'kRRWRRk',
        'kRWWWRk',
        'kRRWRRk',
        '.kRRRk.',
        '..kkk..'
      ]);
    } else {
      stamp(b, fx0 - 10, fy0 - 3, Lf, [
        'kk......',
        'akkk....',
        '.aakkkk.',
        '.akkkka.',
        'akkkaa..',
        'kka.....'
      ]);
      stamp(b, fx0 + 4, fy0 - 3, Lf, [
        '.kkk.',
        'kdddk',
        'kdrdk',
        'kdddk',
        '.kkk.'
      ]);
    }
    // bulbous lemming nose
    A.part(ES, function (t) { ball(t, hcx - 1.4, hcy + 3.4, 3.3, 2.7, HIDE, { lo: 0.3, hi: 1, d: 0.3 }); });
    // mouth
    if (face === 0) {
      stamp(b, fx0 - 8, fy0 + 7, Lf, [
        'akkkkkkkkkkkkkka',
        'kkopkokkopkopokk',
        '.akkkpkkokkkkka.',
        '...aakkkkkkaa...'
      ]);
    } else if (face === 1) {
      stamp(b, fx0 - 7, fy0 + 6, Lf, [
        '..kkkkkkkkkk..',
        '.kopokoopkook.',
        'kkdddrrrrdddkk',
        'kdddrrTTrrdddk',
        'kkddrTTTTrddkk',
        '.kokddrrddkok.',
        '..kkopkkpokk..',
        '....kkkkkk....'
      ]);
    } else {
      stamp(b, fx0 - 8, fy0 + 6, Lf, [
        '.kkkkkkkkkkkkk..',
        'kopkopokpokopokk',
        'kdddrrrrrrrdddk.',
        'kkokpokdopkpokk.',
        '..kkkkkkkkkkk...'
      ]);
    }
    // stitches on the near cheek
    tint(b, HIDE[1], [fx0 - 11, fy0 + 4, fx0 - 10, fy0 + 5, fx0 - 9, fy0 + 6]);
    tint(b, HIDE[0], [fx0 - 11, fy0 + 5, fx0 - 9, fy0 + 5, fx0 - 10, fy0 + 4, fx0 - 10, fy0 + 6]);

    // ---- the iconic green hair mop -------------------------------------
    A.part(HAIR4[0], function (t) {
      var m = mask(t, function (m) {
        m.ellipse(hcx, hcy - 10.6, 15.6, 7.2, 1);
        m.ellipse(hcx - 12.8, hcy - 5.4, 4, 6.6, 1);
        m.ellipse(hcx + 12.8, hcy - 5.4, 4, 6.6, 1);
        m.ellipse(hcx - 4, hcy - 15, 8, 4.6, 1);
        // fringe + flyaway tufts
        tuft(m, hcx - 9, hcy - 5.6, -1, 3, 2.2); tuft(m, hcx - 3.6, hcy - 5.6, 0.6, 2.6, 2.2); tuft(m, hcx + 1.6, hcy - 5.6, -0.6, 3.4, 2);
        tuft(m, hcx + 7, hcy - 5.6, 0.6, 2.4, 2.2);
        tuft(m, hcx - 15, hcy - 1, -1.4, 4.4, 2); tuft(m, hcx + 15, hcy - 1, 1.4, 4.4, 2);
        tuft(m, hcx - 14, hcy - 12, -3.6, -2.4, 2.2); tuft(m, hcx + 13, hcy - 13, 3.6, -2.6, 2.2);
        tuft(m, hcx + 3, hcy - 17, 3, -3, 2.4); tuft(m, hcx - 6, hcy - 18, -2, -2.2, 2.2);
      });
      puff(t, m, HAIR4, { R: 7.5, lo: 0.1, hi: 1, gamma: 1.15, d: 0.4, tex: grain(23, 0.1, 0.9, 0.16), rim: 0.1 });
      furMarks(t, HAIR4, 61, 4, 3);
    });

    if (p.armL === 'head') arm(-1);
    if (p.armR === 'head') arm(1);
    return A.done(name, 36, 72);
  }

  b4('b4_body0', { armL: 'out', armR: 'out' });
  b4('b4_body1', { armL: 'out', armR: 'out', br: 1, tap: 1 });
  b4('b4_stomp0', { armL: 'out', armR: 'out', raise: 5, legs: 'tuck', flare: 4, face: 0, hy: -1 });
  b4('b4_ohno0', { armL: 'head', armR: 'head', face: 1, hx: -1 });
  b4('b4_ohno1', { armL: 'head', armR: 'head', face: 1, hx: 1, br: 1 });
  b4('b4_hurt0', { armL: 'up', armR: 'down', face: 2, lean: -2, hx: -1, hy: -1 });

  /* ====================================================================== *
   *  BOSS 6 — ASTAROTH-LECHUCK-9000  (final boss)
   *
   *  A frontal, symmetric demon overlord built from overlays. Astaroth: horns and a
   *  second face in the belly. LeChuck: tricorn with skull emblem, burning ghost
   *  beard, tattered pirate coat. HAL 9000: a black panel with a red lens grafted
   *  into the chest.
   *
   *  ASSEMBLY (offsets from the b6_body anchor = bottom-centre, x right, y up negative;
   *  draw in this order):
   *    b6_wing0   root (4,60)      at (+34,-74), mirrored at (-34,-74)   — behind everything
   *    b6_body0/1 anchor (56,104)  at (0,0)
   *    b6_arm0/1  shoulder (8,8)   at (+40,-78), mirrored at (-40,-78)   — over the body
   *    b6_belly0/1 centre          at (0,-36)
   *    b6_eye0..2  centre          at (0,-62)
   *    b6_head0..2 centre          at (0,-92)
   *  The body carries the coat shoulders + bone spikes; the arm sprite starts with a
   *  torn sleeve cap that sits on top of them, so arms may bob / slam down freely.
   *  Fire colours: the belly's throat uses glow0..7 (palette-cycled); the beard is
   *  static teal ghost-fire; the HAL lens is plain red / white-hot.
   * ====================================================================== */

  var DEM = ramp('dusk0', 'dusk1', 'dusk2', 'dusk3', 'maroon3', 'red3', 'red4', 'red6');
  var COAT = ramp('night0', 'night1', 'slate1', 'slate2', 'slate3', 'slate4', 'slate5', 'slate6');
  var HAT = ramp('black', 'night0', 'night1', 'night2', 'slate2', 'slate3', 'slate4', 'slate5');
  var FLM = ramp('teal1', 'teal2', 'teal3', 'teal4', 'teal5', 'teal6', 'teal7', 'white');
  var MEM = ramp('dusk0', 'dusk1', 'dusk2', 'dusk3', 'dusk4', 'dusk5');
  var LEATH = ramp('dusk0', 'brown0', 'brown1', 'brown2', 'brown3', 'brown4');
  var SILK = ramp('night0', 'purple0', 'purple1', 'purple2', 'purple3', 'purple4', 'purple5', 'purple6');

  function demTex(seed) { return function (x, y) { return (GNG.noise2(x * 0.3, y * 0.3, seed) - 0.5) * 0.14; }; }

  /** Distance (px) from every mask pixel to the mask edge (3-4 chamfer). */
  function edgeDist(m) {
    var w = m.w, h = m.h, src = m.data, n = w * h, D = new Float32Array(n), i, x, y, v, a, INF = 1e5;
    for (i = 0; i < n; i++) D[i] = src[i] ? INF : 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!src[i]) continue;
      v = D[i];
      a = x > 0 ? D[i - 1] + 3 : 3; if (a < v) v = a;
      a = y > 0 ? D[i - w] + 3 : 3; if (a < v) v = a;
      a = (x > 0 && y > 0) ? D[i - w - 1] + 4 : 4; if (a < v) v = a;
      a = (x < w - 1 && y > 0) ? D[i - w + 1] + 4 : 4; if (a < v) v = a;
      D[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; if (!src[i]) continue;
      v = D[i];
      a = x < w - 1 ? D[i + 1] + 3 : 3; if (a < v) v = a;
      a = y < h - 1 ? D[i + w] + 3 : 3; if (a < v) v = a;
      a = (x < w - 1 && y < h - 1) ? D[i + w + 1] + 4 : 4; if (a < v) v = a;
      a = (x > 0 && y < h - 1) ? D[i + w - 1] + 4 : 4; if (a < v) v = a;
      D[i] = v / 3;
    }
    return D;
  }

  /** Emissive fill (flames): bright core fading to a dark rim. o.R = depth of the rim falloff. */
  function fire(dst, m, r, o) {
    var D = edgeDist(m), w = m.w, i, x, y, v;
    for (i = 0; i < D.length; i++) {
      if (!m.data[i]) continue;
      x = i % w; y = (i / w) | 0;
      v = o.lo + (o.hi - o.lo) * Math.min(1, (D[i] - 0.4) / o.R);
      if (o.fade) v += o.fade(x, y);
      dst.pset(x, y, sh(r, clamp01(v), x, y, o.d === undefined ? 0.5 : o.d));
    }
  }

  /** Cloth crease: a dark line with a light edge beside it, only over pixels of ramp r. */
  function crease(t, r, x0, y0, x1, y1) {
    var c = new Bitmap(t.w, t.h), i;
    c.line(x0, y0, x1, y1, 1);
    for (i = 0; i < c.data.length; i++) if (c.data[i] && t.data[i]) { nudge(t, i % t.w, (i / t.w) | 0, r, -1); nudge(t, (i % t.w) + 1, (i / t.w) | 0, r, 1); }
  }

  /** Tapering, curling flame tongue / lock added to a mask. */
  function tongue(m, x0, y0, x1, y1, w, bend) {
    var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1;
    var cx = (x0 + x1) / 2 - dy / l * bend, cy = (y0 + y1) / 2 + dx / l * bend, n = Math.ceil(l * 2), i, t, u, x, y, r;
    for (i = 0; i <= n; i++) {
      t = i / n; u = 1 - t;
      x = u * u * x0 + 2 * u * t * cx + t * t * x1; y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      r = w * (1 - t * 0.94);
      if (r > 0.6) m.ellipse(x, y, r, r, 1);
      m.pset(Math.round(x), Math.round(y), 1);
    }
  }

  /* --- body: 0 / 1 = breathing --- */
  function b6Body(f) {
    var W = 112, H = 104, A = new Art(W, H), b = A.b, br = f ? 1 : 0;
    var E = DEM[0], EC = COAT[0], CX = 55.5;
    var hideTex = demTex(91), cloth = grain(53, 0.07, 0.5, 0.1);
    function mx(s, x) { return s < 0 ? x : 111 - x; }
    function sk(s, hi) { return { lo: 0.12, hi: (hi || 1) * (s < 0 ? 1 : 0.88), gamma: 1.1, d: 0.5, tex: hideTex, rim: 0.12 }; }
    function mpoly(m, s, pts) { m.poly(pts.map(function (q) { return [mx(s, q[0]), q[1]]; }), 1); }

    // coat lining glimpsed between the legs
    A.part(null, function (t) {
      var m = mask(t, function (m) {
        var pts = [[34, 72], [77, 72], [80, 93]], i, n = 11;
        for (i = 0; i <= n; i++) pts.push([80 - 49 * i / n, ((i + f) & 1) ? 98.5 : 94]);
        pts.push([31, 93]);
        m.poly(pts, 1);
      });
      fillMask(t, m, SILK, function (x, y) { return 0.1 + (y - 78) * 0.012 - Math.abs(x - CX) * 0.003 + cloth(x, y); }, 0.5);
    });
    // tattered coat tails
    [1, -1].forEach(function (s) {
      A.part(EC, function (t) {
        var sw = f ? 1 : 0;
        var m = mask(t, function (m) {
          mpoly(m, s, [[22, 58], [44, 62], [46, 88], [43, 96 + sw], [38.5, 92], [34, 99 - sw], [28.5, 93], [23, 100], [17.5, 94 + sw], [12, 98 - sw], [8, 89], [13, 74]]);
        });
        puff(t, m, COAT, { R: 6, lo: 0.08, hi: s < 0 ? 0.85 : 0.62, d: 0.5, tex: cloth });
        crease(t, COAT, mx(s, 15), 76, mx(s, 13), 92); crease(t, COAT, mx(s, 20), 80, mx(s, 20.5), 95); crease(t, COAT, mx(s, 41), 70, mx(s, 41.5), 90);
      });
    });

    // pelvis, rib cage, trapezius
    A.part(E, function (t) {
      ball(t, CX, 77, 25, 11, DEM, { lo: 0.04, hi: 0.45, d: 0.5, tex: hideTex });
      ball(t, CX, 47 - br * 0.5, 32 + br * 0.6, 21, DEM, { lo: 0.08, hi: 0.8, gamma: 1.2, d: 0.5, tex: hideTex, rim: 0.1 });
    });
    A.part(E, function (t) { ball(t, CX, 25.5 - br, 21, 9, DEM, sk(-1, 0.85)); });
    [1, -1].forEach(function (s) {
      A.part(E, function (t) { ball(t, mx(s, 39.5 - br * 0.5), 39 - br, 16.5, 12.5, DEM, sk(s)); });
    });
    // battle scars on the near pec
    tintLine(b, DEM[1], 32, 34 - br, 39, 45 - br); tintLine(b, DEM[1], 36, 33 - br, 42, 42 - br);
    tintLine(b, DEM[1], 77, 35 - br, 72, 44 - br);
    // ribs / serratus under the pecs
    [52, 56, 60].forEach(function (y, i) { tintLine(b, DEM[1], 27 + i, y, 33 + i, y + 2); tintLine(b, DEM[1], 84 - i, y, 78 - i, y + 2); tintLine(b, DEM[5], 27 + i, y - 1, 32 + i, y + 1); });

    // open coat front, red turned-out lapels, gold braid and buttons
    [1, -1].forEach(function (s) {
      var hi = s < 0 ? 0.95 : 0.72, g = s < 0 ? 5 : 4;
      A.part(EC, function (t) {
        var m = mask(t, function (m) {
          mpoly(m, s, [[21, 23 - br], [33, 21.5 - br], [30.5, 32], [27.5, 44], [27, 56], [26, 67], [25, 76], [18, 79], [13, 70], [17, 56], [15.5, 44], [11.5, 33], [11, 27 - br]]);
        });
        puff(t, m, COAT, { R: 5, lo: 0.1, hi: hi, d: 0.5, tex: cloth });
        var e = [[27.5, 44], [27, 56], [26, 67], [25, 76]], i;
        for (i = 0; i + 1 < e.length; i++) tintLine(t, GOLD[g], mx(s, e[i][0] - 0.6), e[i][1], mx(s, e[i + 1][0] - 0.6), e[i + 1][1]);
        [[23, 48], [22.5, 57], [21.5, 66]].forEach(function (q) { rivet(t, Math.round(mx(s, q[0])) - (s > 0 ? 1 : 0), q[1], GOLD); });
        // folds + a torn seam
        crease(t, COAT, mx(s, 16), 34, mx(s, 19.5), 52); crease(t, COAT, mx(s, 21), 46, mx(s, 20), 64);
        tintLine(t, COAT[1], mx(s, 17), 62, mx(s, 15.5), 73);
      });
      A.part(EC, function (t) {
        var m = mask(t, function (m) { mpoly(m, s, [[33, 21.5 - br], [31, 32], [28, 43.5], [23, 33], [24.5, 24 - br]]); });
        puff(t, m, SILK, { R: 3, lo: 0.3, hi: hi * 0.95, d: 0.4 });
        tintLine(t, GOLD[g], mx(s, 24.5), 25 - br, mx(s, 23.4), 33); tintLine(t, GOLD[g], mx(s, 23.4), 33, mx(s, 28), 43);
      });
    });

    // legs: wide squat stance, bone knee spurs, three-clawed feet
    [1, -1].forEach(function (s) {
      var o = sk(s), bo = { lo: 0.3, hi: s < 0 ? 1 : 0.85, d: 0.2 };
      A.part(E, function (t) { limb(t, mx(s, 43), 79, 11.5, mx(s, 27.5), 86.5, 10.2, DEM, o); });
      A.part(E, function (t) { limb(t, mx(s, 27.5), 88, 8.8, mx(s, 26), 95.5, 7.2, DEM, o); });
      A.part(E, function (t) { limb(t, mx(s, 20), 85, 2.6, mx(s, 12.5), 80.5, 0.5, BONE, bo); });
      A.part(E, function (t) { ball(t, mx(s, 25), 97.7, 11.5, 4.6, DEM, o); });
      [-8, -1, 6].forEach(function (dx) {
        A.part(E, function (t) { limb(t, mx(s, 25 + dx), 98.8, 2.5, mx(s, 25 + dx - 1.4), 101.5, 0.8, BONE, bo); });
      });
    });

    // belt slung under the gut + ragged loincloth
    A.part(E, function (t) {
      var pts = [[36.5, 78.5], [45, 86], [55.5, 89], [66, 86], [74.5, 78.5]], i;
      for (i = 0; i + 1 < pts.length; i++) limb(t, pts[i][0], pts[i][1], 2.7, pts[i + 1][0], pts[i + 1][1], 2.7, LEATH, { lo: 0.2, hi: 0.9, d: 0.3 });
      [[42, 83], [47, 87], [63, 87], [68, 83]].forEach(function (q) { rivet(t, q[0], q[1], GOLD); });
    });
    A.part(SILK[0], function (t) {
      var m = mask(t, function (m) { m.poly([[46, 89], [65, 89], [66.5, 96], [63, 100.5], [60, 95.5], [55.5, 101.5], [51, 95.5], [48, 100.5], [44.5, 96]], 1); });
      puff(t, m, SILK, { R: 3, lo: 0.2, hi: 0.85, d: 0.4, tex: cloth });
      tintLine(t, SILK[1], 51, 91, 50, 96); tintLine(t, SILK[1], 60, 91, 61, 96); tintLine(t, SILK[1], 55.5, 92, 55.5, 98);
      tintLine(t, GOLD[4], 46, 90, 65, 90);
    });

    // the gut (the belly face overlay lands here)
    A.part(E, function (t) {
      ball(t, CX, 67.5, 23.5 + br * 0.5, 18, DEM, { lo: 0.1, hi: 0.92, gamma: 1.2, d: 0.5, tex: hideTex, rim: 0.14 });
    });
    stamp(b, 51, 85, legend({ G: 'gold7', g: 'gold5', d: 'gold3', D: 'gold1', k: 'dusk0', w: 'white', r: 'hotred', R: 'red2' }), [
      '.GGggggd.',
      'GgkkkkkdD',
      'GgkwrRkdD',
      'gdkrRRkdD',
      'gdkkkkkdD',
      '.ddddddD.'
    ]);

    // HAL 9000: scar-tissue rim, bolted steel frame, black glass, lens socket, speaker grille
    A.part(E, function (t) {
      var m = mask(t, function (m) { m.rect(43, 28, 26, 29, 1); m.rect(44, 27, 24, 31, 1); });
      puff(t, m, DEM, { R: 2.4, lo: 0.3, hi: 1, d: 0.4 });
    });
    A.part(E, function (t) {
      var m = mask(t, function (m) { m.rect(45, 30, 22, 25, 1); }), x, y;
      puff(t, m, STEEL, { R: 1.5, bevel: true, lo: 0.25, hi: 0.85, d: 0.3 });
      t.rect(47, 32, 18, 21, C.black);
      t.rect(48, 32, 6, 2, GNG.col('blue4')); t.rect(55, 32, 8, 2, BONE[6]);                    // the nameplate
      t.ellipse(CX, 41.5, 7.6, 7.6, STEEL[1]); t.ellipse(CX, 41.5, 6.4, 6.4, C.black);
      t.ellipse(CX, 41.5, 2.2, 2.2, REDR[2]);
      for (y = 51; y <= 52; y++) for (x = 49; x <= 62; x++) if ((x + y) & 1) t.pset(x, y, STEEL[2]);
      rivet(t, 45, 30, STEEL); rivet(t, 65, 30, STEEL); rivet(t, 45, 53, STEEL); rivet(t, 65, 53, STEEL);
    });
    // cables plugged into the flesh
    path(b, C.hotyellow, [43, 49, 41, 50, 39, 53, 38, 57]); path(b, GOLD[2], [43, 50, 41, 51, 40, 53, 39, 57]);
    path(b, GNG.col('blue5'), [68, 49, 70, 50, 72, 53, 73, 57]); path(b, GNG.col('blue2'), [68, 50, 70, 51, 71, 53, 72, 57]);

    // high collar points either side of the neck
    [1, -1].forEach(function (s) {
      A.part(EC, function (t) {
        var m = mask(t, function (m) { mpoly(m, s, [[37, 26 - br], [30.5, 11.5 - br], [41, 17.5 - br], [46.5, 26 - br]]); });
        puff(t, m, COAT, { R: 3, lo: 0.15, hi: s < 0 ? 0.95 : 0.7, d: 0.4 });
        tintLine(t, GOLD[s < 0 ? 5 : 4], mx(s, 36.6), 25 - br, mx(s, 31), 12.5 - br);
      });
    });
    // coat shoulders with bone spikes punching through
    [1, -1].forEach(function (s) {
      var bo = { lo: 0.25, hi: s < 0 ? 1 : 0.82, d: 0.2 };
      A.part(EC, function (t) { ball(t, mx(s, 17), 27 - br, 11, 9, COAT, { lo: 0.12, hi: s < 0 ? 1 : 0.75, d: 0.45, tex: cloth }); });
      [[10.5, 22.5, 4.5, 11], [17, 19.5, 16.5, 7.5], [23.5, 21, 26.5, 11.5]].forEach(function (q) {
        A.part(EC, function (t) { limb(t, mx(s, q[0]), q[1] - br, 2.8, mx(s, q[2]), q[3] - br, 0.5, BONE, bo); });
      });
    });
    return A.done('b6_body' + f, 56, 104);
  }
  b6Body(0);
  b6Body(1);

  /* --- head: 0 glaring, 1 roaring, 2 hurt --- */
  function b6Head(f) {
    var W = 44, H = 48, A = new Art(W, H), b = A.b, E = DEM[0];
    var jaw = f === 1 ? 3 : 0, sway = f === 1 ? 1.5 : (f === 2 ? -2.5 : 0), hy = f === 2 ? 1 : 0, hx = f === 2 ? 1 : 0;
    var hideTex = demTex(17);
    function mx(s, x) { return s < 0 ? x : 43 - x; }
    function rep(ch, n) { var s = ''; while (n-- > 0) s += ch; return s; }

    // skull + jaw
    A.part(E, function (t) {
      ball(t, 21.5, 23.5 + hy, 12.4, 10, DEM, { lo: 0.2, hi: 1, gamma: 1.1, d: 0.45, tex: hideTex, rim: 0.12 });
      ball(t, 21.5, 29.4 + hy + jaw, 10, 5.6, DEM, { lo: 0.16, hi: 0.86, d: 0.45 });
    });
    // cheekbones
    A.part(null, function (t) {
      ball(t, 14.6, 24.6 + hy, 3.6, 2.2, DEM, { lo: 0.55, hi: 1.05, d: 0.4 });
      ball(t, 28.4, 24.6 + hy, 3.6, 2.2, DEM, { lo: 0.45, hi: 0.9, d: 0.4 });
    });
    var Lf = legend({ a: 'dusk0', b: 'dusk1', c: 'dusk2', d: 'dusk3', e: 'maroon3', f: 'maroon4', g: 'maroon5', h: 'maroon6',
      K: 'black', Y: 'hotyellow', W: 'white', O: 'hotorange', R: 'hotred', r: 'red3', m: 'red0', n: 'red1', t: 'white', o: 'bone5', p: 'bone3' });
    var nose = [
      rep('.', 11) + 'hg' + rep('.', 11),
      rep('.', 10) + 'hhgf' + rep('.', 10),
      '.....b...ahhgfa...b.....',
      '....b....aaefaa....b....'
    ];
    stamp(b, 10, 16 + hy, Lf, (f === 2 ? [
      '.aa..................aa.',
      '.haaaa............aaaah.',
      '.gaaaaaaa......aaaaaaag.',
      '..aabaaaaa....aaaaabaa..',
      '...aaaabaaa..aaabaaaa...',
      '.....aaaaaa..aaaaaa.....',
      '....g......hg......g....'
    ] : [
      '.aa..................aa.',
      '.haaaa............aaaah.',
      '.gaRRaaaa......aaaaRRag.',
      '..aOYYWaaa....aaaWYYOa..',
      '..aROYYWWaa..aaWWYYORa..',
      '...aaROYYaa..aaYYORaa...',
      '....gaaaaa.hg.aaaaag....'
    ]).concat(nose));

    // LeChuck's burning ghost beard: dark outer flame, white-hot inner licks
    A.part(null, function (t) {
      var by = 33 + hy + jaw, streak = grain(71, 0.07, 0.9, 0.2), fl = f === 1 ? 1.6 : 0;
      var T = [
        [21.5, by + 1, 22 + sway, 45.6, 4.2, 1.6],
        [15.6, by + 1, 13 + sway - fl, 44, 3.6, -2],
        [27.4, by + 1, 30.4 + sway + fl, 43.4, 3.6, 2],
        [11.6, by - 0.5, 6.2 + sway - fl, 40.5 + fl, 3.2, 2.4],
        [31.4, by - 0.5, 37.2 + sway + fl, 39.5 + fl, 3.2, -2.6],
        [10, by - 4.5, 4.4 - fl * 0.5, by - 1, 2.3, 1.6],
        [33, by - 4.5, 38.8 + fl * 0.5, by - 1.6, 2.3, -1.6]
      ];
      var outer = mask(t, function (m) {
        m.ellipse(21.5, by + 0.5, 11.4, 3.8, 1);
        m.ellipse(10.4, by - 4, 2.5, 4.6, 1); m.ellipse(32.6, by - 4, 2.5, 4.6, 1);
        T.forEach(function (q) { tongue(m, q[0], q[1], q[2], q[3], q[4], q[5]); });
      });
      var inner = mask(t, function (m) {
        m.ellipse(21.5, by + 0.6, 8.8, 2.2, 1);
        T.forEach(function (q, i) {
          var k = i < 5 ? 0.62 : 0.5;
          tongue(m, q[0], q[1] + (i < 5 ? 0 : 1), lerp(q[0], q[2], k), lerp(q[1], q[3], k), q[4] * 0.5, q[5] * 0.6);
        });
      });
      var D = edgeDist(outer);
      fillMask(t, outer, FLM, function (x, y) { return 0.45 - (y - by) * 0.012 + streak(x, y) - (D[y * W + x] < 1.2 ? 0.14 : 0); }, 0.5);
      fillMask(t, inner, FLM, function (x, y) { return 0.8 - (y - by) * 0.03 + streak(x, y); }, 0.6);
    });

    // mouth (on top of the beard): 0 snarl of interlocking fangs, 1 roaring maw, 2 gritted grimace
    var WH = C.white, x, y, u, yc, k;
    A.part(FLM[0], function (t) {           // the muzzle pushes through the flames
      if (f === 1) ball(t, 21.5, 31.8, 11, 6.9, DEM, { lo: 0.2, hi: 0.9, d: 0.45 });
      else ball(t, 21.5, 29.6 + hy, 10.4, 4.6, DEM, { lo: 0.36, hi: 0.95, d: 0.45 });
    });
    if (f !== 1) pix(b, DEM[1], [16, 27 + hy, 15, 28 + hy, 27, 27 + hy, 28, 28 + hy]);
    if (f !== 1) {
      var x0 = f ? 12 : 13, x1 = f ? 31 : 30;
      for (x = x0; x <= x1; x++) {
        u = (x - 21.5) / 9; yc = Math.round(29.3 + hy + (f ? 0.6 : 1.5) * u * u); k = (x - x0) % 4;
        b.pset(x, yc - 2, E); b.pset(x, yc + 2, E);
        b.pset(x, yc - 1, k < 2 ? WH : E);
        b.pset(x, yc, k === 0 ? WH : (k === 2 ? BONE[5] : (f ? BONE[3] : REDR[0])));
        b.pset(x, yc + 1, k >= 2 ? BONE[6] : E);
        if (f) { b.pset(x, yc + 2, k >= 2 ? BONE[4] : E); b.pset(x, yc + 3, E); }
      }
      // long canines overlap the lower lip
      [x0 + 1, x1 - 2].forEach(function (cx) {
        var uu = (cx + 0.5 - 21.5) / 9, cy = Math.round(29.3 + hy + (f ? 0.6 : 1.5) * uu * uu);
        b.rect(cx, cy - 1, 2, 3, WH); b.pset(cx + (cx < 21 ? 0 : 1), cy + 2, WH); b.pset(cx + (cx < 21 ? 1 : 0), cy + 2, BONE[4]);
        b.pset(cx - 1, cy, E); b.pset(cx + 2, cy, E);
      });
      pix(b, E, [x0 - 1, 30 + hy, x0 - 1, 31 + hy, x0 - 2, 32 + hy, x1 + 1, 30 + hy, x1 + 1, 31 + hy, x1 + 2, 32 + hy]);
    } else {
      for (y = 26; y <= 37; y++) for (x = 11; x <= 32; x++) {
        var ex = (x - 21.5) / 8.8, ey = (y - 31.6) / 4.9, d = Math.sqrt(ex * ex + ey * ey);
        if (d > 1.16) continue;
        if (d > 0.96) { b.pset(x, y, E); continue; }
        // gullet: black-red, with a tongue catching the light
        var td = Math.sqrt((x - 21.5) * (x - 21.5) / 30 + (y - 34.2) * (y - 34.2) / 5);
        b.pset(x, y, td < 0.75 ? REDR[4] : (td < 1 ? REDR[3] : sh(REDR, 0.18 - d * 0.16, x, y, 0.6)));
      }
      [[14, 2], [16, 4], [19, 2], [24, 2], [26, 4], [29, 2]].forEach(function (q) {
        var e2 = (q[0] + 0.5 - 21.5) / 8.8, top = Math.ceil(31.6 - 4.9 * 0.96 * Math.sqrt(Math.max(0, 1 - e2 * e2))), j;
        for (j = 0; j < q[1]; j++) { b.pset(q[0], top + j, WH); if (j < q[1] - 1) b.pset(q[0] + 1, top + j, j < q[1] - 2 ? WH : BONE[5]); }
      });
      [[15, 2], [17, 3], [20, 2], [23, 2], [25, 3], [28, 2]].forEach(function (q) {
        var e2 = (q[0] + 0.5 - 21.5) / 8.8, bot = Math.floor(31.6 + 4.9 * 0.96 * Math.sqrt(Math.max(0, 1 - e2 * e2))), j;
        for (j = 0; j < q[1]; j++) { b.pset(q[0], bot - j, BONE[6]); if (j < q[1] - 1) b.pset(q[0] + 1, bot - j, BONE[4]); }
      });
    }

    // tricorn: black felt, gold braid, skull and crossbones
    A.part(HAT[0], function (t) {
      var top = [[5.5, 18], [7.5, 12.5], [12.5, 7.6], [17.5, 6.6], [21.5, 2.2], [25.5, 6.6], [30.5, 7.6], [35.5, 12.5], [37.5, 18]], i;
      var m = mask(t, function (m) {
        m.poly(top.concat([[32.5, 16.2], [21.5, 14.2], [10.5, 16.2]]).map(function (q) { return [q[0] + hx, q[1] + hy]; }), 1);
      });
      puff(t, m, HAT, { R: 4.5, lo: 0.16, hi: 1, d: 0.45 });
      for (i = 0; i + 1 < top.length; i++) tintLine(t, GOLD[i < 4 ? 5 : 3], top[i][0] + hx, top[i][1] + hy + 1, top[i + 1][0] + hx, top[i + 1][1] + hy + 1);
      stamp(t, 17 + hx, 8 + hy, legend({ w: 'white', o: 'bone5', k: 'black' }), [
        'o..wwww..o',
        '.owwwwwwo.',
        '..wkwwkw..',
        '.owwkkwwo.',
        'o..wkkw..o'
      ]);
    });

    // horns sweep out from the temples, in front of the hat brim
    [1, -1].forEach(function (s) {
      A.part(E, function (t) {
        var o = { lo: 0.22, hi: s < 0 ? 1 : 0.82, d: 0.25 };
        var P = [[8.4, 21.8, 3.3], [3.9, 17.6, 3], [2.6, 10.5, 1.9], [4.6, 4.4, 0.6]], i, x;
        for (i = P.length - 2; i >= 0; i--) limb(t, mx(s, P[i][0]), P[i][1] + hy, P[i][2], mx(s, P[i + 1][0]), P[i + 1][1] + hy, P[i + 1][2], BONE, o);
        for (i = 0; i < 5; i++) for (x = 0; x < W; x++) nudge(t, x, 19 + hy - i * 3, BONE, -2);
      });
    });
    return A.done('b6_head' + f, 22, 24);
  }
  b6Head(0);
  b6Head(1);
  b6Head(2);

  /* --- the face in the belly: 0 sinister grin, 1 maw open with a glowing throat --- */
  function b6Belly(f) {
    var W = 36, H = 26, A = new Art(W, H), b = A.b, E = DEM[0], C0 = 17.5, x, y;
    var up = f ? 1 : 0;
    A.part(null, function (t) {
      var m = mask(t, function (m) {
        m.ellipse(C0, 12.6, 16.2, 11, 1);
        tuft(m, 5, 5.4, -2.6, -3.4, 2.4); tuft(m, 30, 5.4, 2.6, -3.4, 2.4);
      });
      puff(t, m, DEM, { R: 9, lo: 0.2, hi: 0.96, d: 0.5, tex: demTex(91), rim: 0.1 });
    });
    // cheeks
    A.part(null, function (t) {
      ball(t, 7, 13.4, 4, 3, DEM, { lo: 0.4, hi: 1, d: 0.4 });
      ball(t, 28, 13.4, 4, 3, DEM, { lo: 0.3, hi: 0.86, d: 0.4 });
    });
    // angry brow ridges
    A.part(E, function (t) { limb(t, 4.6, 5.4 - up, 2.5, 14.6, 8.6 - up, 2.1, DEM, { lo: 0.3, hi: 1, d: 0.4 }); });
    A.part(E, function (t) { limb(t, 30.4, 5.4 - up, 2.5, 20.4, 8.6 - up, 2.1, DEM, { lo: 0.25, hi: 0.86, d: 0.4 }); });
    var Lf = legend({ a: 'dusk0', b: 'dusk1', Y: 'hotyellow', W: 'white', O: 'hotorange', R: 'hotred', r: 'red2' });
    var eye = f ? [
      'aaaaaaa..',
      'aRYWWYaa.',
      '.aOYWWYa.',
      '..aROYOa.',
      '...aaaa..'
    ] : [
      'aaaaaa...',
      '.aOYWYaa.',
      '..aROYOa.',
      '...aaaa..'
    ];
    stamp(b, 5, 8 - up, Lf, eye); stamp(b, 22, 8 - up, Lf, eye, true);
    // nostril slits
    pix(b, E, [15, 11, 16, 12, 20, 11, 19, 12]);
    pix(b, DEM[7], [17, 10, 18, 10]);
    var WH = C.white, G = GNG.RAMPS.glow;
    if (!f) {
      // wide interlocking-fang grin
      for (x = 4; x <= 31; x++) {
        var u = (x - C0) / 13.5, yc = Math.round(14.6 + 5.4 * (1 - u * u)), k = (x - 4) % 4;
        b.pset(x, yc - 2, E); b.pset(x, yc + 2, E);
        b.pset(x, yc - 1, k < 2 ? WH : E); b.pset(x, yc, (k === 0 || k === 2) ? (k === 0 ? WH : BONE[5]) : E); b.pset(x, yc + 1, k >= 2 ? BONE[6] : E);
      }
      pix(b, E, [3, 14, 3, 13, 4, 13, 32, 14, 32, 13, 31, 13, 4, 15, 31, 15]);
    } else {
      // open maw: glowing throat (palette-cycled), fangs above and below
      for (y = 10; y <= 24; y++) for (x = 3; x <= 32; x++) {
        var ex = (x - C0) / 12.8, ey = (y - 17.6) / 6.2, d = Math.sqrt(ex * ex + ey * ey);
        if (d > 1.12) continue;
        if (d > 0.94) { b.pset(x, y, E); continue; }
        var band = Math.floor(d * 5.2 + bayer(x, y) * 0.7);
        b.pset(x, y, band >= 4 ? GORE[1] : G[[4, 3, 2, 1][band]]);
      }
      [[7, 2], [10.5, 3], [14, 4], [21, 4], [24.5, 3], [28, 2]].forEach(function (q) {
        var tx = Math.round(q[0]), ex = (tx - C0) / 12.8, top = Math.ceil(17.6 - 6.2 * 0.94 * Math.sqrt(Math.max(0, 1 - ex * ex / 0.88))), k;
        for (k = 0; k < q[1]; k++) { b.pset(tx, top + k, WH); if (k < q[1] - 1) b.pset(tx + 1, top + k, BONE[5]); }
      });
      [[9, 2], [12.5, 3], [16, 3], [19, 3], [22.5, 3], [26, 2]].forEach(function (q) {
        var tx = Math.round(q[0]), ex = (tx - C0) / 12.8, bot = Math.floor(17.6 + 6.2 * 0.94 * Math.sqrt(Math.max(0, 1 - ex * ex / 0.88))), k;
        for (k = 0; k < q[1]; k++) { b.pset(tx, bot - k, WH); if (k < q[1] - 1) b.pset(tx + 1, bot - k, BONE[5]); }
      });
    }
    return A.done('b6_belly' + f, 18, 13, E);
  }
  b6Belly(0);
  b6Belly(1);

  /* --- HAL 9000 lens: 0 dim, 1 bright, 2 white-hot flare --- */
  function b6Eye(f) {
    var A = new Art(16, 16), b = A.b, c = 7.5, x, y, d, col;
    A.part(null, function (t) { ball(t, c, c, 6.9, 6.9, STEEL, { lo: 0.2, hi: 1.05, gamma: 1.1, d: 0.3 }); });
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      d = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
      if (d > 5.7) { if (f === 2 && d < 6.9 && bayer(x, y) < 0.5) b.pset(x, y, GNG.col('red5')); continue; }
      if (d > 4.8) { b.pset(x, y, f === 2 ? REDR[3] : STEEL[1]); continue; }
      var dd = d + (bayer(x, y) - 0.5) * 0.7;
      if (f === 0) col = dd < 0.9 ? C.hotred : (dd < 1.9 ? REDR[3] : (dd < 3 ? REDR[1] : (dd < 4 ? REDR[0] : C.black)));
      else if (f === 1) col = dd < 0.9 ? C.hotyellow : (dd < 1.9 ? C.hotorange : (dd < 3.1 ? C.hotred : (dd < 4.1 ? REDR[3] : REDR[1])));
      else col = dd < 2.3 ? C.white : (dd < 3.3 ? C.hotyellow : (dd < 4.2 ? C.hotorange : C.hotred));
      b.pset(x, y, col);
    }
    if (f < 2) pix(b, C.white, [5, 4, 4, 5]); if (f === 0) pix(b, STEEL[4], [5, 5]);
    b.outline(OUT);
    if (f === 2) {
      // lens flare spikes burn over the bezel and outline
      for (d = 3; d <= 7; d++) {
        col = d < 6 ? C.white : C.hotyellow;
        b.pset(7 - d, 7, col); b.pset(8 + d, 8, col); b.pset(7, 7 - d, col); b.pset(8, 8 + d, col);
        b.pset(7 - d, 8, d < 5 ? C.white : C.hotorange); b.pset(8 + d, 7, d < 5 ? C.white : C.hotorange);
        b.pset(8, 7 - d, d < 5 ? C.white : C.hotorange); b.pset(7, 8 + d, d < 5 ? C.white : C.hotorange);
      }
      pix(b, C.hotyellow, [3, 3, 12, 12, 3, 12, 12, 3]); pix(b, C.hotorange, [2, 2, 13, 13, 2, 13, 13, 2]);
    }
    return GNG.regSprite('b6_eye' + f, b, { ax: 8, ay: 8 });
  }
  b6Eye(0);
  b6Eye(1);
  b6Eye(2);

  /* --- arm (the boss's own left; mirror for the other): 0 hanging, 1 raised with the claw open --- */
  function b6Arm(f) {
    var W = 40, H = 56, A = new Art(W, H), b = A.b, E = DEM[0], EC = COAT[0];
    var SK = { lo: 0.12, hi: 1, gamma: 1.1, d: 0.5, tex: demTex(29), rim: 0.12 };
    var BO = { lo: 0.3, hi: 1, d: 0.2 };
    var SH = [11, 11], EL = f ? [24, 31] : [16.5, 25.5], WR = f ? [28, 19.5] : [21.5, 38];
    var dx = WR[0] - EL[0], dy = WR[1] - EL[1], l = Math.sqrt(dx * dx + dy * dy);
    dx /= l; dy /= l;
    var nx = -dy, ny = dx;
    var HD = [WR[0] + dx * 6.5, WR[1] + dy * 6.5];
    function dir(a) { var c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return [dx * c + nx * s, dy * c + ny * s]; }
    function finger(a, off, r0, l1, l2, hook) {
      // a = direction (deg from the forearm axis), off = sideways offset of the knuckle, r0 = knuckle distance
      var v = dir(a), bx = HD[0] + v[0] * r0 + nx * off, by = HD[1] + v[1] * r0 + ny * off;
      var kx = bx + v[0] * l1, ky = by + v[1] * l1, h = dir(a + hook);
      A.part(E, function (t) { limb(t, bx, by, 2.3, kx, ky, 2, DEM, SK); });
      A.part(E, function (t) { limb(t, kx, ky, 1.8, kx + h[0] * l2, ky + h[1] * l2, 0.4, BONE, BO); });
    }
    function cuff() {
      // pirate cuff: flared, gold braid, two buttons
      A.part(EC, function (t) {
        var p0x = WR[0] - dx * 5.6, p0y = WR[1] - dy * 5.6, p1x = WR[0] + dx * 0.6, p1y = WR[1] + dy * 0.6;
        var m = mask(t, function (m) {
          m.poly([[p0x + nx * 6.9, p0y + ny * 6.9], [p1x + nx * 8.8, p1y + ny * 8.8], [p1x - nx * 8.8, p1y - ny * 8.8], [p0x - nx * 6.9, p0y - ny * 6.9]], 1);
        });
        puff(t, m, COAT, { R: 3, lo: 0.12, hi: 1, d: 0.45 });
        tintLine(t, GOLD[5], p1x + nx * 8.8 - dx, p1y + ny * 8.8 - dy, p1x - nx * 8.8 - dx, p1y - ny * 8.8 - dy);
        tintLine(t, GOLD[2], p1x + nx * 8.8, p1y + ny * 8.8, p1x - nx * 8.8, p1y - ny * 8.8);
        rivet(t, Math.round(WR[0] - dx * 3.8 - nx * 3 - 0.5), Math.round(WR[1] - dy * 3.8 - ny * 3 - 0.5), GOLD);
        rivet(t, Math.round(WR[0] - dx * 3.8 + nx * 3 - 0.5), Math.round(WR[1] - dy * 3.8 + ny * 3 - 0.5), GOLD);
      });
    }
    function hand() {
      A.part(E, function (t) { ball(t, HD[0], HD[1], 6.4, 5.9, DEM, SK); });
      if (f) {
        // open claw: thumb toward the head, four fingers fanned
        finger(-104, 0, 4.4, 2.2, 3.6, 14);
        finger(-62, 0, 4.6, 2.6, 4, 10); finger(-28, 0, 4.8, 3, 4.2, 6); finger(4, 0, 4.8, 3, 4, -6); finger(31, 0, 4.4, 2.4, 3.6, -10);
        // palm pads
        tint(b, DEM[2], [Math.round(HD[0] - 1), Math.round(HD[1] + 1), Math.round(HD[0]), Math.round(HD[1] + 2), Math.round(HD[0] + 1), Math.round(HD[1] + 2), Math.round(HD[0] + 2), Math.round(HD[1] + 1)]);
      } else {
        finger(52, 4.2, 3, 1.8, 3.4, 30);
        finger(10, -4.6, 4, 2, 3.6, 22); finger(5, -1.6, 4.4, 2.2, 3.8, 22); finger(0, 1.4, 4.4, 2.2, 3.8, 22); finger(-5, 4.4, 4, 2, 3.6, 22);
        // knuckles
        tint(b, DEM[7], [Math.round(HD[0] - 3), Math.round(HD[1] + 2), Math.round(HD[0]), Math.round(HD[1] + 3), Math.round(HD[0] + 3), Math.round(HD[1] + 2)]);
      }
    }

    // upper arm + biceps
    A.part(E, function (t) {
      limb(t, SH[0], SH[1], 8, EL[0], EL[1], 6.8, DEM, SK);
      ball(t, lerp(SH[0], EL[0], 0.56) + 1.4, lerp(SH[1], EL[1], 0.56), 8.3, 7.6, DEM, SK);
    });
    // elbow spur
    A.part(E, function (t) {
      if (f) limb(t, EL[0] + 1, EL[1] + 5.5, 2.4, EL[0] + 3.5, EL[1] + 12.5, 0.5, BONE, BO);
      else limb(t, EL[0] + 5.5, EL[1] - 1, 2.4, EL[0] + 12.5, EL[1] - 5, 0.5, BONE, BO);
    });
    // forearm: thick near the elbow
    A.part(E, function (t) {
      limb(t, EL[0], EL[1], 7, WR[0], WR[1], 5.4, DEM, SK);
      ball(t, EL[0] + dx * 4.4, EL[1] + dy * 4.4, 7.5, 7.5, DEM, SK);
    });
    // sinew lines
    tintLine(b, DEM[2], EL[0] + dx * 2 + nx * 2, EL[1] + dy * 2 + ny * 2, EL[0] + dx * 8 + nx * 1, EL[1] + dy * 8 + ny * 1);
    cuff();
    hand();

    // torn sleeve cap over the shoulder joint, gold epaulette with fringe
    A.part(EC, function (t) {
      var m = mask(t, function (m) {
        m.ellipse(9.6, 8.8, 8, 6.6, 1);
        m.poly([[1.8, 9], [17.6, 9], [19, 13.5], [16.4, 17.6], [13.8, 14.4], [11, 18.4], [8, 14.8], [5, 17.4], [2.2, 13]], 1);
      });
      puff(t, m, COAT, { R: 5, lo: 0.14, hi: 1, d: 0.45, tex: grain(53, 0.07, 0.5, 0.1) });
    });
    A.part(EC, function (t) {
      var m = mask(t, function (m) { m.ellipse(9.6, 4.6, 6.4, 1.9, 1); }), x, y;
      puff(t, m, GOLD, { R: 1.6, lo: 0.2, hi: 0.9, d: 0.3 });
      for (x = 4; x <= 15; x++) {
        for (y = 10; y >= 2; y--) if (t.get(x, y)) break;
        if (y < 2) continue;
        t.pset(x, y + 1, (x & 1) ? GOLD[4] : GOLD[1]); t.pset(x, y + 2, (x & 1) ? GOLD[3] : GOLD[1]);
        if (x % 3 === 0) t.pset(x, y + 3, GOLD[2]);
      }
    });
    return A.done('b6_arm' + f, 8, 8);
  }
  b6Arm(0);
  b6Arm(1);

  /* --- tattered bat wing (drawn behind the body; root at 4,60) --- */
  (function () {
    var W = 64, H = 72, A = new Art(W, H), b = A.b, E = DEM[0];
    var R0 = [6.4, 60.4], WR = [25, 11.5];
    var tips = [[60, 4.5], [61, 29], [52.5, 50.5], [33.5, 65.5]], inner = [10, 67.5];
    var rng = GNG.makeRng(606), veins = grain(7, 0.09, 0.25, 0.25), i;

    function panel(a, c, extra, hi) {
      A.part(MEM[0], function (t) {
        var m = mask(t, function (m) {
          var pts = [WR, a], k, n = 7, mxp = (a[0] + c[0]) / 2, myp = (a[1] + c[1]) / 2;
          var qx = mxp + (WR[0] - mxp) * 0.42, qy = myp + (WR[1] - myp) * 0.42;
          for (k = 1; k < n; k++) {
            var u = k / n, v = 1 - u;
            pts.push([v * v * a[0] + 2 * v * u * qx + u * u * c[0], v * v * a[1] + 2 * v * u * qy + u * u * c[1]]);
          }
          pts.push(c);
          if (extra) pts = pts.concat(extra);
          m.poly(pts, 1);
          // tatters: notches bitten out of the trailing edge, moth holes in the membrane
          for (k = 0; k < 3; k++) {
            var uu = 0.2 + rng() * 0.6, vv = 1 - uu;
            var ex = vv * vv * a[0] + 2 * vv * uu * qx + uu * uu * c[0], ey = vv * vv * a[1] + 2 * vv * uu * qy + uu * uu * c[1];
            m.ellipse(ex, ey, 1.2 + rng() * 1.6, 1.4 + rng() * 2, 0);
          }
          var hu = 0.3 + rng() * 0.4, hv = 0.45 + rng() * 0.25;
          var hx = WR[0] + ((a[0] + (c[0] - a[0]) * hu) - WR[0]) * hv, hy = WR[1] + ((a[1] + (c[1] - a[1]) * hu) - WR[1]) * hv;
          m.ellipse(hx, hy, 1.4 + rng() * 1.2, 1 + rng() * 1.4, 0);
        });
        puff(t, m, MEM, { R: 6, lo: 0.1, hi: hi, d: 0.5, tex: veins, k: 0.8 });
      });
    }
    for (i = 0; i < 3; i++) panel(tips[i], tips[i + 1], null, 0.95 - i * 0.1);
    panel(tips[3], inner, [R0], 0.62);

    // arm bone, finger bones, joints
    var BN = { lo: 0.15, hi: 0.95, gamma: 1.2, d: 0.4, rim: 0.1 };
    tips.forEach(function (tp, k) {
      A.part(E, function (t) {
        limb(t, WR[0], WR[1], 2.2, tp[0], tp[1], 0.8, DEM, { lo: 0.2, hi: 1 - k * 0.08, d: 0.4 });
      });
      pix(b, BONE[6], [Math.round(tp[0]), Math.round(tp[1])]);
    });
    A.part(E, function (t) {
      limb(t, R0[0], R0[1], 4.6, 12, 37.5, 3.6, DEM, BN);
      limb(t, 12, 37.5, 3.6, WR[0], WR[1], 2.8, DEM, BN);
    });
    A.part(E, function (t) { ball(t, WR[0], WR[1], 3.8, 3.6, DEM, BN); });
    // thumb claw
    A.part(E, function (t) {
      limb(t, WR[0] - 1, WR[1] - 3, 1.9, WR[0] - 3, WR[1] - 7, 1.1, BONE, { lo: 0.3, hi: 1, d: 0.2 });
      limb(t, WR[0] - 3, WR[1] - 7, 1.1, WR[0] - 1.6, WR[1] - 9.4, 0.4, BONE, { lo: 0.3, hi: 1, d: 0.2 });
    });
    A.done('b6_wing0', 4, 60);
  })();

})();
