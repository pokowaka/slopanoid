/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * backdrops_a.js — procedurally painted parallax backdrops for stages 1-3 and the
 * parchment world map. Everything is built from seeded noise, ordered-dither
 * gradients, silhouette generators and hand-placed pixels: no external assets.
 *
 * Contract (art bible, section F):
 *   GNG.Backdrops.register(stage, function (info) { return { sky, layers:[far,mid,near], lightning }; })
 *   GNG.Backdrops.registerMap(function () { return { bmp, nodes }; })
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.Backdrops || !GNG.Bitmap) return;

  var Bitmap = GNG.Bitmap, C = GNG.C;
  var SKY = GNG.RAMPS.sky, LIQ = GNG.RAMPS.liq, GLOW = GNG.RAMPS.glow;
  // local aliases: keeps the hot loops free of global look-ups
  var M = Math, floor = M.floor, ceil = M.ceil, round = M.round, sqrt = M.sqrt, exp = M.exp, pow = M.pow,
    sin = M.sin, cos = M.cos, abs = M.abs, min = M.min, max = M.max, PI = M.PI;
  var F32 = Float32Array, I16 = Int16Array;

  /* ====================================================================== *
   *  TOOLKIT
   * ====================================================================== */

  var BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** 4x4 ordered-dither threshold (same matrix as GNG.bayer). */
  function bayer(x, y) { return (BAY[((y & 3) << 2) | (x & 3)] + 0.5) * 0.0625; }
  /** Dithered pick from a ramp (array of palette indices), v in 0..1 — same result as GNG.shade. */
  function shade(r, v, x, y) {
    var n = r.length - 1, i = floor(v * n + (BAY[((y & 3) << 2) | (x & 3)] + 0.5) * 0.0625);
    return r[i < 0 ? 0 : (i > n ? n : i)];
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mod(a, n) { a %= n; return a < 0 ? a + n : a; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function gauss(t, s) { return exp(-(t * t) / (2 * s * s)); }

  /** Tileable value noise on a pre-hashed lattice: period px (x) / py (y) lattice cells. */
  function makeNoise(seed, px, py) {
    var g = new F32(px * py), r = GNG.makeRng(seed), i;
    for (i = 0; i < g.length; i++) g[i] = r();
    return function (x, y) {
      var xi = floor(x), yi = floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var x0 = xi % px; if (x0 < 0) x0 += px;
      var y0 = yi % py; if (y0 < 0) y0 += py;
      var x1 = x0 + 1; if (x1 === px) x1 = 0;
      var y1 = y0 + 1; if (y1 === py) y1 = 0;
      var a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  /** Tileable fractal noise; x,y in base-lattice units, base period px / py cells. */
  function makeFbm(seed, px, py, oct) {
    var ns = [], o;
    for (o = 0; o < oct; o++) ns.push(makeNoise(seed + o * 131, px << o, py << o));
    return function (x, y) {
      var s = 0, a = 0.5, n = 0;
      for (var i = 0; i < oct; i++) { s += a * ns[i](x, y); n += a; a *= 0.5; x *= 2; y *= 2; }
      return s / n;
    };
  }

  /** Tapered thick line (quad) — tree limbs, masts, spars. */
  function limb(b, x0, y0, x1, y1, w0, w1, c) {
    if (w0 > 1.3 || w1 > 1.3) {
      var dx = x1 - x0, dy = y1 - y0, l = sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / l * 0.5, ny = dx / l * 0.5;
      b.poly([[x0 + nx * w0, y0 + ny * w0], [x1 + nx * w1, y1 + ny * w1],
              [x1 - nx * w1, y1 - ny * w1], [x0 - nx * w0, y0 - ny * w0]], c);
    }
    b.line(x0, y0, x1, y1, c);
  }

  /** Sagging rope between two points. */
  function rope(b, x0, y0, x1, y1, sag, c) {
    var n = max(4, ceil(abs(x1 - x0) / 6)), px = x0, py = y0;
    for (var i = 1; i <= n; i++) {
      var t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t) + sag * 4 * t * (1 - t);
      b.line(px, py, x, y, c);
      px = x; py = y;
    }
  }

  /** '#'-mask from rows of text (ragged rows are fine). */
  function mask(rows) {
    var w = 0, i, x;
    for (i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    var m = new Bitmap(w, rows.length);
    for (i = 0; i < rows.length; i++) for (x = 0; x < rows[i].length; x++) {
      var ch = rows[i].charAt(x);
      m.data[i * w + x] = ch === '#' ? 1 : (ch === '+' ? 2 : (ch === 'o' ? 3 : 0));
    }
    return m;
  }

  /** Stamp a mask with its bottom-centre at (x,y); `shear` leans it (px sideways per px of height). */
  function stamp(b, m, x, y, shear, c, c2, c3) {
    for (var r = 0; r < m.h; r++) {
      var off = round(shear * (m.h - 1 - r));
      for (var q = 0; q < m.w; q++) {
        var k = m.data[r * m.w + q];
        if (k) b.pset(x - (m.w >> 1) + q + off, y - m.h + 1 + r, k === 1 ? c : (k === 2 ? (c2 || c) : (c3 || c)));
      }
    }
  }

  /**
   * Moonlight rim: pixels of colour `body` whose upper/left neighbour is empty get a highlight
   * (both empty -> rim2). `keep(x,y)` can thin the effect out so it never reads as an outline.
   */
  function rimLight(b, body, rim, rim2, keep, x0, x1) {
    var w = b.w, h = b.h, d = b.data, x, y, i;
    x0 = max(1, x0 === undefined ? 1 : x0); x1 = min(w, x1 === undefined ? w : x1);
    for (y = 1; y < h; y++) {
      for (x = x0; x < x1; x++) {
        i = y * w + x;
        if (d[i] !== body) continue;
        var up = d[i - w] === 0, lf = d[i - 1] === 0;
        if (!up && !lf) continue;
        if (keep && !keep(x, y)) continue;
        d[i] = (up && lf) ? rim2 : rim;
      }
    }
  }

  /** Recursive crooked dead tree silhouette rooted at (x,y), about `h` px tall. */
  function deadTree(b, x, y, h, seed, c, lean, minTw) {
    var r = GNG.makeRng(seed);
    var tw = max(minTw || 3, h * 0.085);
    // root flare
    b.poly([[x - tw * 1.5, y + 2], [x - tw * 0.55, y - h * 0.10], [x + tw * 0.55, y - h * 0.10], [x + tw * 1.6, y + 2]], c);
    b.line(x - tw * 1.5, y + 1, x - tw * 2.4, y + 3, c); b.line(x + tw * 1.5, y + 1, x + tw * 2.6, y + 3, c);
    function seg(x0, y0, ang, len, th, depth) {
      var kink = (r() - 0.5) * 0.7;
      var xm = x0 + sin(ang) * len * 0.5, ym = y0 - cos(ang) * len * 0.5;
      var a2 = ang + kink;
      var x1 = xm + sin(a2) * len * 0.5, y1 = ym - cos(a2) * len * 0.5;
      limb(b, x0, y0, xm, ym, th, th * 0.85, c);
      limb(b, xm, ym, x1, y1, th * 0.85, th * 0.68, c);
      if (depth <= 0 || len < 3) return;
      var n = (depth > 2 && r() < 0.4) ? 3 : 2;
      for (var i = 0; i < n; i++) {
        var side = i === 0 ? -1 : (i === 1 ? 1 : (r() < 0.5 ? -0.3 : 0.3));
        var na = a2 * 0.55 + side * (0.38 + r() * 0.55);
        if (na > 1.9) na = 1.9; if (na < -1.9) na = -1.9;
        seg(x1, y1, na, len * (0.60 + r() * 0.24), max(1, th * (i === 2 ? 0.5 : 0.66)), depth - 1);
      }
      if (depth > 1 && r() < 0.6) {    // a stub / broken snag off the side
        var sa = a2 + (r() < 0.5 ? -1 : 1) * (0.9 + r() * 0.5);
        limb(b, xm, ym, xm + sin(sa) * len * 0.3, ym - cos(sa) * len * 0.3, max(1, th * 0.4), 1, c);
      }
    }
    seg(x, y - h * 0.08, (lean || 0) + (r() - 0.5) * 0.25, h * 0.36, tw, 5);
  }

  /* ====================================================================== *
   *  STAGE 1 — LeChuck's Ghost Ship & Mêlée Graveyard (moonlit Caribbean night)
   * ====================================================================== */

  var SKY1 = [[4, 6, 24], [7, 11, 36], [11, 19, 52], [16, 29, 68], [24, 43, 86], [36, 61, 104], [54, 84, 124], [82, 114, 148]];
  var MOON = [C.slate[4], C.mist[4], C.bone[4], C.bone[5], C.bone[6], C.bone[7]];

  function drawMoon(b, cx, cy, R, seed) {
    var W = b.w, fM = makeFbm(seed, 8, 8, 4), x, y;
    for (y = cy - R - 1; y <= cy + R + 1; y++) {
      for (x = cx - R - 1; x <= cx + R + 1; x++) {
        var dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 > (R + 0.3) * (R + 0.3)) continue;
        var nx = dx / R, ny = dy / R, nz = sqrt(max(0, 1 - nx * nx - ny * ny));
        var l = nx * -0.40 + ny * -0.48 + nz * 0.78;
        var v = 0.60 + 0.42 * l;
        var m = fM(x / 20 + 1.7, y / 20 + 4.1);
        v -= 0.26 * sstep(0.50, 0.60, m);                 // maria
        v -= 0.10 * sstep(0.62, 0.70, fM(x / 9 + 9, y / 9 + 2));
        v -= 0.22 * sstep(0.86, 1.0, sqrt(d2) / R);  // limb darkening
        b.data[y * W + mod(x, W)] = shade(MOON, clamp(v, 0, 1), x, y);
      }
    }
    // craters: dark crescent on the lit side, bright lip on the far side
    var cr = [[-0.42, -0.30, 4], [0.22, -0.52, 3], [0.36, 0.18, 5], [-0.16, 0.44, 3], [-0.58, 0.20, 2], [0.02, -0.06, 2], [0.56, -0.22, 2]];
    for (var i = 0; i < cr.length; i++) {
      var ox = round(cx + cr[i][0] * R), oy = round(cy + cr[i][1] * R), rr = cr[i][2];
      for (var a = 0; a < 24; a++) {
        var an = a / 24 * PI * 2, px = round(ox + cos(an) * rr), py = round(oy + sin(an) * rr);
        var lit = cos(an) * 0.64 + sin(an) * 0.77;      // + = lower-right
        b.data[py * W + mod(px, W)] = lit > 0.25 ? C.bone[7] : (lit < -0.25 ? C.mist[4] : C.bone[5]);
      }
    }
  }

  function far1(info, fx) {
    var W = 512, H = 200, HZ = 124;
    var b = new Bitmap(W, H), d = b.data;
    var range = max(0, ((info.levelW || 3200) - 320) * fx);
    var mx = round(clamp(76 + range, 150, 262)), my = 50, R = 31;
    var fC = makeFbm(1101, 8, 16, 4), fS = makeFbm(1102, 8, 8, 3), nU = makeNoise(1103, 4, 8);
    var N = W * (HZ + 1), vv = new F32(N), cm = new Uint8Array(N);
    var x, y, i, v, dx, dy, dm;

    function mdx(x) { var q = x - mx; if (q > W / 2) q -= W; else if (q < -W / 2) q += W; return q; }

    /* sky gradient + moon halo + faint high veils (value field; turned into SKY colours below) */
    for (y = 0; y <= HZ; y++) {
      var g = 0.10 + 0.72 * pow(y / HZ, 1.9);
      for (x = 0; x < W; x++) {
        i = y * W + x;
        dx = mdx(x); dy = y - my; dm = sqrt(dx * dx + dy * dy);
        var out = max(0, dm - R);
        v = g + 0.34 * exp(-out / 22) + 0.11 * exp(-out / 72) + (fS(x / 64, y / 50) - 0.5) * 0.08;
        var u = x / 128;
        var env = max(gauss(y - (40 + (nU(u, 0.5) - 0.5) * 30), 12) * 0.8, gauss(y - (100 + (nU(u, 4.5) - 0.5) * 14), 6));
        env *= sstep(R + 4, R + 40, dm);
        var th = lerp(0.95, 0.40, env), c = sstep(th, th + 0.12, fC((x + y * 1.6) / 64, y / 15));
        if (c > 0.01) { v = lerp(v, v * 0.55 + 0.04, c * 0.85); if (c > 0.3) cm[i] = 2; }
        vv[i] = v;
      }
    }

    /* cumulus banks: overlapping moonlit puffs with flat, dark bases */
    function bank(cx, baseY, len, hgt, seed) {
      var rr = GNG.makeRng(seed), puffs = [], n = max(6, round(len / 4.5)), j, nb = makeNoise(seed + 5, 64, 2);
      for (j = 0; j < n; j++) {
        var t = rr() * 2 - 1, taper = 1 - t * t, pr, py;
        if (j % 3 === 0) {             // long low shelf puffs: stretch the base into tails
          pr = hgt * (0.16 + 0.14 * rr());
          py = baseY - pr * 0.7;
          t *= 1.25;
        } else {
          pr = hgt * (0.22 + 0.38 * rr()) * (0.35 + 0.65 * taper);
          py = baseY - pr * (0.45 + rr() * 0.5) - rr() * hgt * 0.42 * taper;
        }
        puffs.push({ x: cx + t * len / 2, y: py, r: pr, e: 1.25 + rr() * 0.6 });
      }
      puffs.sort(function (p, q) { return p.y - q.y; });
      for (j = 0; j < n; j++) {
        var p = puffs[j], rx = p.r * p.e;
        for (var yy = floor(p.y - p.r); yy <= p.y + p.r; yy++) {
          if (yy < 0 || yy > HZ) continue;
          for (var xx = floor(p.x - rx); xx <= p.x + rx; xx++) {
            var ddx = (xx - p.x) / p.e, ddy = yy - p.y;
            if (ddx * ddx + ddy * ddy > p.r * p.r) continue;
            var base = baseY + (nb(xx / 9, 0.5) - 0.5) * 3;
            if (yy > base) continue;
            var wx = mod(xx, W), ii = yy * W + wx;
            var qx = mdx(wx), qy = yy - my, md = sqrt(qx * qx + qy * qy) + 0.001;
            if (md < R + 5) continue;
            var lx = -qx / md * 0.62, ly = -qy / md * 0.62 - 0.72, ll = sqrt(lx * lx + ly * ly) || 1;
            var l = (ddx * lx + ddy * ly) / (ll * p.r);
            var prox = exp(-md / 105);
            var belly = (0.10 + 0.72 * pow(yy / HZ, 1.9)) * 0.50 + 0.035 + 0.06 * prox;
            var w = belly + sstep(-0.25, 0.9, l) * (0.25 + 0.42 * prox) - 0.05 * sstep(base - 3, base, yy);
            vv[ii] = w; cm[ii] = 1;
          }
        }
      }
    }
    bank(mx - 150, 46, 150, 22, 1120);
    bank(mx + 128, 34, 120, 17, 1121);
    bank(mx + 128, 84, 170, 19, 1122);
    bank(mx - 128, 95, 130, 14, 1123);
    bank(mx - 20, 8, 190, 13, 1124);
    bank(mx + 235, 12, 110, 14, 1125);
    bank(mx - 236, 76, 70, 10, 1126);

    for (i = 0; i < N; i++) d[i] = shade(SKY, clamp(vv[i], 0, 1), i % W, (i / W) | 0);

    /* stars */
    var rs = GNG.makeRng(1104);
    for (i = 0; i < 320; i++) {
      x = (rs() * W) | 0; y = (pow(rs(), 1.4) * (HZ - 12)) | 0;
      var mag = rs();
      if (cm[y * W + x]) continue;
      dx = mdx(x); dy = y - my;
      if (dx * dx + dy * dy < (R + 16) * (R + 16)) continue;
      if (mag < 0.5) d[y * W + x] = SKY[5];
      else if (mag < 0.82) d[y * W + x] = SKY[7];
      else if (mag < 0.95 || y < 2 || x < 2 || x > W - 3) d[y * W + x] = C.steel[5];
      else {
        d[y * W + x] = C.white;
        d[y * W + x - 1] = SKY[6]; d[y * W + x + 1] = SKY[6]; d[(y - 1) * W + x] = SKY[6]; d[(y + 1) * W + x] = SKY[6];
      }
    }

    drawMoon(b, mx, my, R, 1106);

    /* thin cloud streaks drifting across the moon (dark where backlit, silver-lined at the rim) */
    function streak(cx, cy, len, th, seed, lift) {
      var nT = makeNoise(seed, 64, 4);
      for (var xx = cx - len; xx <= cx + len; xx++) {
        var uu = (xx - cx) / len, taper = pow(1 - uu * uu, 0.7);
        var mid = cy + (nT(xx / 26, 0.5) - 0.5) * 6;
        var hh = th * taper * (0.5 + 1.0 * nT(xx / 8, 1.5));
        for (var yy = floor(mid - hh); yy <= ceil(mid + hh); yy++) {
          if (yy < 0 || yy > HZ) continue;
          var q = (yy - mid) / (hh + 0.001), a = 1 - q * q;
          if (a < bayer(xx, yy) * 0.85) continue;
          var ddx = mdx(mod(xx, W)), ddy = yy - my, dd = sqrt(ddx * ddx + ddy * ddy);
          var over = 1 - sstep(R - 3, R + 4, dd);                    // 1 = in front of the disc
          var near = 1 - sstep(R, R + 70, dd);
          var vs = vv[yy * W + mod(xx, W)];
          var vc = lerp(lerp(vs + (lift || 0.1), 0.86, near), 0.50, over) + (q < -0.2 ? 0.16 : (q > 0.4 ? -0.10 : 0));
          d[yy * W + mod(xx, W)] = shade(SKY, clamp(vc, 0, 1), xx, yy);
        }
      }
    }
    streak(mx + 16, my + 13, 62, 3.6, 1107);
    streak(mx - 26, my - 15, 34, 2.2, 1108);
    streak(mx + 58, my - 4, 30, 2.0, 1109);
    // long stratus bars low over the horizon
    streak(mx - 200, 110, 70, 2.4, 1114, -0.2);
    streak(mx + 150, 114, 90, 2.2, 1115, -0.22);
    streak(mx - 60, 117, 50, 1.6, 1116, -0.2);
    streak(mx + 250, 104, 46, 2.0, 1117, -0.18);

    /* the sea: dark body + palette-cycled glints, moon-glitter path under the moon */
    var BODY = [C.night[0], C.night[1], C.night[2], C.night[3], C.night[4]];
    var rw = GNG.makeRng(1110);
    for (y = HZ + 1; y < H; y++) {
      var ts = (y - HZ) / (H - 1 - HZ), pw = 4 + ts * 30;
      for (x = 0; x < W; x++) {
        dx = mdx(x);
        v = 0.64 - 0.44 * pow(ts, 0.55) + gauss(dx, pw * 1.7) * 0.13 * (1 - ts * 0.5) + (fS(x / 32, y / 6) - 0.5) * 0.14;
        d[y * W + x] = shade(BODY, clamp(v, 0, 1), x, y);
      }
      var rowLen = 2 + ts * 9, ph = floor((y - HZ) * 0.9);
      x = (rw() * 10) | 0;
      while (x < W) {
        var L = 1 + ((rw() * rowLen) | 0);
        var inPath = gauss(mdx(x + (L >> 1)), pw);
        if (rw() < 0.08 + 0.74 * inPath * (1 - ts * 0.35)) {
          var ci = (ph + ((rw() * 3) | 0)) & 7, hot = inPath > 0.6 && rw() < 0.46 * (1 - ts * 0.7);
          var hc = (ts < 0.14 && rw() < 0.5) ? C.bone[5] : (rw() < 0.35 ? C.mist[4] : C.slate[4]);
          for (i = 0; i < L && x + i < W; i++) d[y * W + x + i] = hot ? hc : LIQ[ci];
        }
        x += L + 1 + ((rw() * (2 + ts * 12 * (1 - inPath * 0.8))) | 0);
      }
    }
    for (x = 0; x < W; x++) {   // horizon: a thin bright line of sky-glow on the water
      d[(HZ + 1) * W + x] = shade(BODY, 0.8 + gauss(mdx(x), 30) * 0.2, x, HZ + 1);
    }

    /* far-off islets on the horizon (hazy), one with a volcano */
    var HAZE = [C.night[3], C.night[4], C.slate[2]];
    function islet(x0, x1, hgt, seed, peak) {
      var nI = makeNoise(seed, 32, 2);
      for (var xx = x0; xx <= x1; xx++) {
        var uu = (xx - x0) / (x1 - x0), hh = sin(uu * PI) * hgt * (0.6 + 0.8 * nI(xx / 9, 0.5));
        if (peak) hh += gauss(uu - 0.62, 0.09) * peak;
        for (var yy = round(HZ + 1 - hh); yy <= HZ + 1; yy++) d[yy * W + mod(xx, W)] = shade(HAZE, 0.25 + 0.5 * bayer(xx >> 1, yy), xx, yy);
      }
    }
    islet(36, 92, 4, 1111, 0);
    islet(404, 470, 5, 1112, 11);
    islet(300, 322, 2.5, 1113, 0);
    d[(HZ - 15) * W + 445] = C.ember[2]; d[(HZ - 15) * W + 446] = C.ember[3]; d[(HZ - 16) * W + 445] = C.maroon[2];

    return b;
  }

  /* ---------------------------------------------------------------- MID 1 */

  function mid1() {
    var W = 1024, H = 112, WL = 92;
    var b = new Bitmap(W, H), d = b.data;
    var RK = [C.night[1], C.night[2], C.night[3], C.night[4], C.slate[2]];
    var PK = C.night[1];
    var fR = makeFbm(1201, 16, 4, 4), fK = makeFbm(1206, 64, 4, 4), nH = makeNoise(1203, 32, 32), nJ = makeNoise(1204, 256, 32);
    var hs = new F32(W + 8), top = new I16(W), x, y, i;
    for (i = 0; i < W; i++) top[i] = WL;
    var r = GNG.makeRng(1205);

    function land(pts, o) {
      var x0 = pts[0][0], x1 = pts[pts.length - 1][0], k = 0, h;
      for (x = x0; x <= x1; x++) {
        while (k < pts.length - 2 && x > pts[k + 1][0]) k++;
        var a = pts[k], c = pts[k + 1], t = (x - a[0]) / (c[0] - a[0]);
        h = lerp(a[1], c[1], t);
        h += (fR(x / 64, 0.4 + o.seed) - 0.5) * o.rough * min(1, h / 6);
        if (o.jungle) h += (1 + 3.5 * pow(nJ(x / 4.5, o.seed), 2)) * min(1, h / 5) * o.jungle;
        hs[x] = max(0, h);
      }
      for (x = x0; x <= x1; x++) {
        h = hs[x];
        if (h < 0.6) continue;
        var yt = WL - round(h);
        var sm = (hs[min(x1, x + 5)] - hs[max(x0, x - 5)]) / 10;      // macro slope: + faces the moonlit left
        for (y = yt; y < WL; y++) {
          var dep = y - yt, v;
          if (o.jungle) {
            // canopy: soft clumps lit from above
            v = 0.26 + (nJ(x / 5, y / 4 + 3) - 0.5) * 0.42 + (nJ(x / 13, y / 9 + 11) - 0.5) * 0.3 + 0.14 * exp(-dep / 5);
          } else {
            // rock: relief-shade a displacement field (tall ribs and gullies) with light from the upper-left
            var rel = (fK((x + 1.5) / 16, y / 30) - fK((x - 1.5) / 16, y / 30)) * 1.9 + (fK(x / 16, (y + 1.5) / 30) - fK(x / 16, (y - 1.5) / 30)) * 1.1;
            v = 0.33 + rel + clamp(sm * 0.10, -0.12, 0.12) + (nH(x / 32, y / 4) - 0.5) * 0.12;
          }
          if (dep === 0) v += 0.24; else if (dep < 3) v += 0.09;
          v -= 0.10 * dep / 70;
          v += 0.09 * sstep(WL - 9, WL, y);                              // sea haze at the foot
          d[y * W + x] = shade(RK, clamp(v, 0, 1), x, y);
        }
        if (yt < top[x]) top[x] = yt;
        if ((x + (x >> 2)) % 3) d[WL * W + x] = C.night[4];              // surf line
        var rl = min(12, h * 0.34 + 2);                                   // reflection
        for (y = WL + 1; y < WL + rl; y++) if (bayer(x >> 1, y) < 0.85 * (1 - (y - WL) / rl)) d[y * W + x] = y & 1 ? C.night[1] : C.night[2];
      }
    }
    function ground(x) { return top[clamp(x | 0, 0, W - 1)]; }
    function lit(x, y, k) { b.pset(x, y, k === undefined ? GLOW[3 + ((r() * 3) | 0)] : k); }

    function house(x, w, h, o) {
      o = o || {};
      var gy = max(ground(x), ground(x + w - 1)) + 1, y0 = gy - h, rh = o.roof || max(3, (w * 0.42) | 0);
      b.rect(x, y0, w, h + 1, C.night[2]);
      b.rect(x, y0, max(1, (w * 0.4) | 0), h + 1, C.night[3]);
      b.poly([[x - 1, y0], [x + w / 2 - 0.5, y0 - rh], [x + w, y0]], C.night[1]);
      b.line(x - 1, y0, x + ((w / 2) | 0) - 1, y0 - rh + 1, C.night[4]);
      if (o.chimney) b.rect(x + w - 3, y0 - rh + 1, 2, rh - 1, C.night[1]);
      var nwin = o.win === undefined ? 1 + ((w / 7) | 0) : o.win;
      for (var j = 0; j < nwin; j++) {
        var wx = x + 2 + round(j * (w - 4) / max(1, nwin)) + ((r() * 2) | 0), wy = y0 + 2 + ((r() * max(1, h - 5)) | 0);
        var kc = o.warm && r() < o.warm ? (r() < 0.5 ? C.orange[4] : C.gold[4]) : undefined;
        lit(wx, wy, kc); if (r() < 0.6) lit(wx, wy + 1, kc);
      }
    }
    function palm(x, h, lean) {
      var gy = ground(x), px = x, py = gy, j, k;
      for (j = 1; j <= h; j++) {
        var t = j / h, nx = round(x + lean * t * t), ny = gy - j;
        b.line(px, py, nx, ny, PK); px = nx; py = ny;
      }
      for (j = 0; j < 7; j++) {
        var a = (j / 6 - 0.5) * 2.7 + (r() - 0.5) * 0.2, L = 5 + ((r() * 3) | 0), fx0 = px, fy0 = py;
        for (k = 1; k <= L; k++) {
          var u = k / L, fx1 = px + sin(a) * L * u * 1.1, fy1 = py - cos(a) * L * u * 0.6 + u * u * L * (0.2 + 0.62 * abs(sin(a)));
          b.line(fx0, fy0, fx1, fy1, PK); fx0 = fx1; fy0 = fy1;
        }
      }
      b.pset(px - 1, py + 1, PK); b.pset(px + 1, py + 1, PK);     // coconuts
    }
    function farShip(cx) {
      var K = C.night[2], K2 = C.night[3], hw = 24, dk = WL - 6;
      b.poly([[cx - hw - 4, dk], [cx - hw + 3, WL], [cx + hw - 2, WL], [cx + hw + 3, dk - 5], [cx + hw - 9, dk - 5], [cx + hw - 10, dk]], K);
      b.line(cx - hw - 4, dk, cx + hw - 10, dk, K2);
      b.line(cx - hw - 4, dk, cx - hw - 18, dk - 6, K);                       // bowsprit
      var ms = [[cx - 14, 34], [cx + 1, 42], [cx + 14, 30]];
      for (var m = 0; m < 3; m++) {
        var mx2 = ms[m][0], mh = ms[m][1];
        b.rect(mx2, dk - mh, 1, mh, K);
        for (var q = 0; q < 3; q++) {
          var yy = dk - mh + 5 + q * 10, yw = 6 + q * 2 + (m === 1 ? 2 : 0);
          if (yy > dk - 8) break;
          b.rect(mx2 - yw, yy, yw * 2 + 1, 1, K);
          if ((m + q) % 2 === 0) b.rect(mx2 - yw + 1, yy + 1, yw * 2 - 1, 1, K2);   // furled canvas
          else { for (var z = -yw + 1; z < yw; z++) if (bayer(mx2 + z, yy) < 0.6) b.rect(mx2 + z, yy + 1, 1, 2 + ((z * 7 + q * 3) & 3), K2); }
        }
        b.line(mx2, dk - mh, mx2 + (m === 2 ? 13 : -15), dk - 1, K2);          // stays
        b.pset(mx2 + 1, dk - mh, K); b.pset(mx2 + 2, dk - mh + 1, K);          // pennant
      }
      b.line(cx - hw - 17, dk - 6, cx - 14, dk - 30, K2);
      b.pset(cx + hw, dk - 7, GLOW[4]); b.pset(cx + hw, dk - 6, GLOW[3]);      // stern lantern
      b.pset(cx - 5, dk + 2, GLOW[3]); b.pset(cx + 7, dk + 2, GLOW[5]);
      for (y = WL + 1; y < WL + 9; y++) for (x = cx - hw; x < cx + hw; x++) if (bayer(x >> 1, y) < 0.6 * (1 - (y - WL) / 9)) b.pset(x, y, C.night[1]);
      for (y = WL + 2; y < WL + 8; y += 2) b.pset(cx + hw, y, GLOW[2]);
    }

    /* masts of ships at anchor behind the low spit (drawn first; the land overlaps their hulls) */
    var mastX = [58, 70, 86];
    for (i = 0; i < mastX.length; i++) {
      var mh0 = 28 + i * 6;
      b.rect(mastX[i], WL - mh0, 1, mh0, C.night[2]);
      b.rect(mastX[i] - 5, WL - mh0 + 5, 11, 1, C.night[2]); b.rect(mastX[i] - 4, WL - mh0 + 14, 9, 1, C.night[2]);
      b.line(mastX[i], WL - mh0, mastX[i] - 9, WL - 4, C.night[3]);
    }

    /* island A: Mêlée headland — dock & tavern, village, church, winding path, lookout crag */
    land([[40, 0], [52, 4], [92, 7], [112, 10], [140, 15], [176, 22], [214, 30], [244, 36], [262, 42], [274, 50], [284, 54],
          [294, 63], [304, 67], [314, 75], [326, 80], [340, 79], [350, 76], [361, 74], [363, 57], [366, 40], [371, 26],
          [379, 16], [393, 9], [412, 4], [434, 0]], { seed: 1, rough: 7 });
    // the lookout ledge overhangs the sea
    b.poly([[365, WL - 67], [354, WL - 60], [359, WL - 49], [365, WL - 47]], 0);
    for (y = WL - 67; y < WL - 46; y++) for (x = 352; x < 362; x++) if (d[y * W + x] && !d[y * W + x + 1]) d[y * W + x] = C.night[1];
    // sea stacks off the cliff
    land([[442, 0], [446, 10], [451, 13], [457, 0]], { seed: 2, rough: 3 });
    land([[464, 0], [468, 5], [472, 0]], { seed: 3, rough: 2 });
    /* island B: jungle ridge with the governor's mansion and skull rock */
    land([[606, 0], [610, 8], [614, 13], [620, 14], [626, 12], [630, 6], [634, 0]], { seed: 4, rough: 2 });
    land([[650, 0], [666, 6], [700, 16], [742, 23], [790, 19], [828, 29], [868, 38], [896, 36], [924, 24], [948, 13], [972, 5], [992, 0]],
      { seed: 5, rough: 8, jungle: 1 });

    /* village */
    house(98, 22, 9, { roof: 7, win: 4, warm: 0.5 });                // the tavern on the waterfront
    b.rect(94, WL - 2, 30, 1, C.night[1]);                           // its jetty
    for (x = 95; x < 124; x += 5) b.rect(x, WL - 2, 1, 4, C.night[1]);
    b.pset(121, ground(121) - 6, GLOW[4]);                            // lantern over the door
    house(128, 9, 6, { warm: 0.3 }); house(142, 11, 7, { chimney: 1 }); house(157, 8, 6, { warm: 0.4 });
    house(170, 12, 8, { chimney: 1, warm: 0.3 }); house(187, 9, 6); house(200, 10, 7, { warm: 0.5 });
    house(234, 9, 6, { chimney: 1 }); house(248, 8, 6, { warm: 0.3 }); house(264, 7, 5);
    // church with steeple
    (function () {
      var x0 = 212, gy = ground(x0 + 6) + 1;
      b.rect(x0, gy - 9, 14, 10, C.night[2]); b.rect(x0, gy - 9, 5, 10, C.night[3]);
      b.poly([[x0 - 1, gy - 9], [x0 + 6.5, gy - 14], [x0 + 14, gy - 9]], C.night[1]);
      b.rect(x0 + 10, gy - 22, 5, 22, C.night[2]); b.rect(x0 + 10, gy - 22, 2, 22, C.night[3]);
      b.poly([[x0 + 9, gy - 22], [x0 + 12.5, gy - 33], [x0 + 15, gy - 22]], C.night[1]);
      b.rect(x0 + 12, gy - 37, 1, 5, C.night[1]); b.rect(x0 + 11, gy - 36, 3, 1, C.night[1]);
      lit(x0 + 12, gy - 18); lit(x0 + 4, gy - 5); lit(x0 + 4, gy - 4); lit(x0 + 7, gy - 5);
    })();
    // zig-zag path climbing to the lookout (moonlit dust)
    var pth = [[268, 6], [286, 14], [278, 22], [300, 30], [292, 40], [314, 48], [308, 58], [326, 64]];
    for (i = 0; i < pth.length - 1; i++) {
      var n = max(abs(pth[i + 1][0] - pth[i][0]), abs(pth[i + 1][1] - pth[i][1]));
      for (var j = 0; j <= n; j++) {
        x = round(lerp(pth[i][0], pth[i + 1][0], j / n)); y = ground(268) + 4 - round(lerp(pth[i][1], pth[i + 1][1], j / n));
        y = max(y, ground(x) + 2);
        if ((x + y) & 1) b.pset(x, y, C.slate[2]); else b.pset(x, y, C.night[4]);
      }
    }
    // the lookout: ruined arch, signal fire, crooked flagpole
    (function () {
      var gx = 338, gy = ground(gx);
      b.rect(gx - 12, gy - 9, 2, 10, PK); b.rect(gx - 6, gy - 7, 2, 8, PK); b.rect(gx - 12, gy - 10, 6, 2, PK); b.pset(gx - 5, gy - 9, PK);
      b.line(gx + 12, ground(gx + 12), gx + 14, gy - 16, PK); b.rect(gx + 15, gy - 16, 5, 2, PK); b.rect(gx + 15, gy - 14, 3, 1, PK);
      b.pset(gx + 2, gy - 1, GLOW[4]); b.pset(gx + 3, gy - 1, GLOW[3]); b.pset(gx + 2, gy - 2, GLOW[5]); b.pset(gx + 3, gy - 3, GLOW[2]);
      b.pset(gx + 1, gy, PK); b.pset(gx + 4, gy, PK);
      for (var q = 0; q < 14; q++) { var ax = gx + 2 + round((r() - 0.5) * 9), ay = gy - 2 - round(r() * 6); if (!d[ay * W + ax]) d[ay * W + ax] = GLOW[0]; }
      deadTree(b, gx - 22, ground(gx - 22) + 1, 15, 1207, PK, 0.3, 1.2);
    })();
    palm(120, 13, -3); palm(151, 11, 2); palm(226, 12, -3); palm(383, 13, -4); palm(404, 10, 3); palm(74, 9, 2);

    /* island B dressing */
    (function () {
      var x0 = 852, gy = ground(x0 + 12) + 2;
      b.rect(x0, gy - 11, 26, 12, C.night[2]); b.rect(x0, gy - 11, 9, 12, C.night[3]);
      b.poly([[x0 - 2, gy - 11], [x0 + 13, gy - 18], [x0 + 28, gy - 11]], C.night[1]);
      b.line(x0 - 2, gy - 11, x0 + 12, gy - 18, C.night[4]);
      for (var j = 0; j < 5; j++) b.rect(x0 + 2 + j * 5, gy - 6, 1, 7, C.night[4]);          // portico columns
      lit(x0 + 4, gy - 9); lit(x0 + 9, gy - 9); lit(x0 + 14, gy - 9); lit(x0 + 19, gy - 9, C.gold[4]); lit(x0 + 23, gy - 9);
      lit(x0 + 13, gy - 14);
    })();
    house(806, 9, 6, { warm: 0.4 }); house(820, 8, 6);
    var palms = [[672, 12, -3], [690, 15, 4], [716, 13, -4], [738, 16, 3], [764, 12, -3], [786, 15, 4], [838, 13, -4], [892, 16, 4], [914, 13, 3], [936, 12, -3], [958, 11, 3], [980, 9, -2]];
    for (i = 0; i < palms.length; i++) palm(palms[i][0], palms[i][1], palms[i][2]);
    // skull rock: eye sockets, nose and teeth
    (function () {
      var gx = 620, gy = WL - 12;
      b.rect(gx - 4, gy + 3, 2, 2, C.night[0]); b.rect(gx + 1, gy + 3, 2, 2, C.night[0]); b.pset(gx - 1, gy + 6, C.night[0]);
      for (var j = -3; j <= 2; j += 2) b.pset(gx + j, gy + 9, C.night[0]);
    })();

    farShip(540);
    // a rowboat and a marker buoy in the open water near the seam
    b.rect(1004, WL - 1, 9, 2, C.night[2]); b.pset(1003, WL - 2, C.night[2]); b.pset(1013, WL - 2, C.night[2]); b.pset(1008, WL - 3, C.night[2]); b.pset(1008, WL - 4, C.night[2]);
    b.rect(14, WL - 3, 2, 4, C.night[2]); b.pset(14, WL - 5, GLOW[4]); b.pset(15, WL - 4, C.night[2]);

    // window light spilling onto the water below the waterfront
    for (i = 0; i < 9; i++) {
      x = 96 + i * 3 + ((r() * 2) | 0);
      for (y = WL + 1; y < WL + 7; y += 2) if (r() < 0.6) b.pset(x, y, GLOW[(1 + r() * 3) | 0]);
    }
    return b;
  }

  /* --------------------------------------------------------------- NEAR 1 */

  var GRAVES = [
    mask(['....#....', '...###...', '...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...', '...###...',
          '...###...', '...###...', '...###...', '...###...', '...###...', '..#####..']),
    mask(['.....###.....', '.....###.....', '...#######...', '..##.###.##..', '.##..###..##.', '#############', '#############',
          '#############', '.##..###..##.', '..##.###.##..', '...#######...', '.....###.....', '.....###.....', '.....###.....',
          '.....###.....', '.....###.....', '.....###.....', '....#####....', '...#######...']),
    mask(['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...', '...##...', '...##...',
          '...##...', '...##...', '...##...']),
    mask(['...####...', '..######..', '.########.', '.########.', '##########', '##########', '##########', '##########',
          '##########', '##########', '##########', '##########']),
    mask(['.....##.....', '....####....', '...######...', '.##########.', '############', '############', '############',
          '############', '############', '############', '############', '############', '############', '############']),
    mask(['.######.', '########', '########', '########', '########', '########', '########', '########']),
    mask(['...#...', '...#...', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '.#####.',
          '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '#######', '#######', '#######']),
    mask(['...###...', '...###...', '...###...', '######...', '######...', '...###...', '...###...', '...###...', '...###...',
          '...###...', '...###...', '..#####..']),
    mask(['..#####..', '.#######.', '.#.###.#.', '.#.###.#.', '.#######.', '..##.##..', '..#####..', '...###...', '#..###..#',
          '.#######.', '..#####..', '.#.###.#.', '#..###..#', '...###...', '...###...', '...###...']),
    // tall ringed cross
    mask(['.......###.......', '.......###.......', '.......###.......', '.....#######.....', '....##.###.##....', '...##..###..##...',
          '..##...###...##..', '#################', '#################', '#################', '..##...###...##..', '...##..###..##...',
          '....##.###.##....', '.....#######.....', '.......###.......', '.......###.......', '.......###.......', '.......###.......',
          '.......###.......', '.......###.......', '.......###.......', '.......###.......', '......#####......', '......#####......',
          '.....#######.....', '....#########....', '....#########....', '...###########...']),
    // weeping angel on a plinth
    mask(['......###......', '.....#####.....', '.....#####.....', '......###......', '.#...#####...#.', '.##.#######.##.',
          '.#############.', '.#############.', '.#############.', '.##.#######.##.', '.##.#######.##.', '.#..#######..#.',
          '.#..#######..#.', '....#######....', '....#######....', '....#######....', '...#########...', '...#########...',
          '...#########...', '..###########..', '..###########..', '.#############.', '.#############.', '###############',
          '###############']),
    // wide double headstone
    mask(['..####....####..', '.######..######.', '################', '################', '################', '################',
          '################', '################', '################', '################']),
    // stubby wooden cross with a hat hung on it
    mask(['..####..', '.######.', '########', '...##...', '########', '########', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...'])
  ];

  function near1(info, fx, fy) {
    var levelW = info.levelW || 3200, levelH = info.levelH || 208;
    var shipStart = (info.marks && typeof info.marks.shipStart === 'number') ? info.marks.shipStart : levelW * 0.55;
    var W = ceil(max(0, levelW - 320) * fx) + 320 + 16;
    var H = 200 + ceil(max(0, levelH - 200) * fy) + 1;
    var T = round(shipStart * fx);
    var b = new Bitmap(W, H), d = b.data;
    var K = C.night[0], KL = C.black, x, y, i;
    var r = GNG.makeRng(1301);
    var fG = makeFbm(1302, 64, 2, 3), nB = makeNoise(1303, 512, 2), fE = makeFbm(1304, 128, 8, 3);
    var gy = new I16(W);
    var EARTH = [C.night[0], C.night[0], C.night[1], C.night[2]];

    /* ---- graveyard hill ---- */
    var gEnd = min(W, T + 60);
    for (x = 0; x < W; x++) {
      var g = 150 + (fG(x / 130, 0.5) - 0.5) * 34 + (nB(x / 14, 0.5) - 0.5) * 4;
      g += sstep(T - 70, T + 50, x) * 70;             // the shore falls away toward the dock
      gy[x] = round(g);
    }
    function gAt(px) { return gy[clamp(round(px), 0, W - 1)]; }

    // ruined chapel: gable wall with an empty pointed window, crumbling side wall
    function chapel(cx) {
      var by = gAt(cx) + 2;
      b.poly([[cx - 26, by], [cx - 26, by - 40], [cx - 21, by - 45], [cx - 18, by - 52], [cx, by - 74], [cx + 18, by - 52], [cx + 22, by - 47], [cx + 26, by - 40], [cx + 26, by]], K);
      b.rect(cx - 1, by - 84, 3, 12, K); b.rect(cx - 5, by - 80, 11, 2, K);              // cross on the gable
      // tall pointed window with a mullion and one surviving bar of tracery (see-through)
      for (var yy = 0; yy < 32; yy++) {
        var hw = yy < 12 ? round(7 * sqrt(yy / 12)) : 7;
        for (var xx = -hw; xx <= hw; xx++) if (xx !== 0 && !(yy > 14 && (yy - 14) % 8 === 0)) d[(by - 56 + yy) * W + cx + xx] = 0;
      }
      for (yy = 0; yy < 5; yy++) for (xx = -2 + (yy > 3 ? 1 : 0); xx <= 2 - (yy > 3 ? 1 : 0); xx++) d[(by - 66 + yy) * W + cx + xx] = 0;   // oculus
      b.rect(cx - 31, by - 34, 6, 34, K); b.rect(cx - 33, by - 12, 3, 12, K);              // buttress
      // broken side wall stepping down to the right, with a second window
      var sw = [[26, 36], [40, 36], [40, 29], [52, 29], [52, 19], [61, 19], [61, 10], [72, 10], [72, 4], [82, 4], [82, 0]];
      var pts = [[cx + 26, by]];
      for (var j = 0; j < sw.length; j++) pts.push([cx + sw[j][0], by - sw[j][1]]);
      pts.push([cx + 82, by]);
      b.poly(pts, K);
      for (yy = 0; yy < 15; yy++) {
        hw = yy < 5 ? 1 + (yy >> 1) : 3;
        for (xx = -hw; xx <= hw; xx++) d[(by - 27 + yy) * W + cx + 33 + xx] = 0;
      }
      b.rect(cx + 60, by - 3, 9, 4, K); b.rect(cx + 88, by - 2, 6, 3, K);                 // rubble
    }
    // small mausoleum
    function crypt(cx) {
      var by = gAt(cx) + 2;
      b.rect(cx - 17, by - 3, 35, 4, K); b.rect(cx - 14, by - 22, 29, 20, K);
      b.poly([[cx - 18, by - 22], [cx, by - 34], [cx + 18, by - 22]], K);
      b.rect(cx - 1, by - 41, 3, 8, K); b.rect(cx - 3, by - 39, 7, 2, K);
      for (var yy = 0; yy < 13; yy++) { var hw = yy < 3 ? 1 + yy : 3; for (var xx = -hw; xx <= hw; xx++) d[(by - 17 + yy) * W + cx + xx] = KL; }
      b.rect(cx - 11, by - 20, 2, 17, C.night[1]); b.rect(cx + 10, by - 20, 2, 17, C.night[1]);
    }
    // gibbet: post, arm, hanging cage
    function gibbet(cx) {
      var by = gAt(cx) + 1;
      limb(b, cx, by, cx + 1, by - 56, 3, 2, K);
      limb(b, cx, by - 54, cx + 24, by - 56, 2, 2, K);
      b.line(cx + 1, by - 43, cx + 12, by - 55, K);
      b.line(cx + 20, by - 55, cx + 20, by - 48, KL);
      for (var j = 0; j < 4; j++) b.line(cx + 15 + j * 3, by - 47, cx + 15 + j * 3, by - 31, KL);
      b.rect(cx + 15, by - 48, 10, 1, K); b.rect(cx + 15, by - 31, 10, 2, K); b.rect(cx + 15, by - 40, 10, 1, KL);
      b.rect(cx + 18, by - 45, 4, 4, K); b.rect(cx + 19, by - 41, 2, 8, K);               // the late occupant
    }
    function fence(x0, x1) {
      for (var xx = x0; xx < x1; xx++) {
        var by = gAt(xx);
        if (by > H) continue;
        b.pset(xx, by - 9, KL); b.pset(xx, by - 3, KL);
        if (xx % 4 === 0 && r() > 0.1) { b.line(xx, by, xx, by - 12, KL); b.pset(xx, by - 13, KL); }
        if (xx % 32 === 0) { b.rect(xx - 1, by - 15, 3, 16, K); b.rect(xx - 2, by - 16, 5, 2, K); }
      }
    }
    function crow(cx, cy, flip) {
      var s = flip ? -1 : 1;
      b.rect(cx - 2, cy - 2, 4, 2, KL); b.pset(cx + 2 * s, cy - 3, KL); b.pset(cx + 3 * s, cy - 3, KL); b.pset(cx - 3 * s, cy - 1, KL); b.pset(cx - 4 * s, cy, KL);
    }
    function mound(cx) {       // fresh grave with a shovel stuck in it
      var by = gAt(cx) + 1;
      b.ellipse(cx, by, 9, 4, K);
      b.line(cx + 5, by - 3, cx + 8, by - 15, KL); b.line(cx + 6, by - 15, cx + 10, by - 16, KL); b.rect(cx + 4, by - 5, 3, 3, K);
    }
    function signpost(cx) {    // crooked signboard
      var by = gAt(cx) + 1;
      limb(b, cx, by, cx + 2, by - 19, 2, 2, K);
      b.poly([[cx - 6, by - 18], [cx + 9, by - 20], [cx + 10, by - 13], [cx - 5, by - 11]], K);
      d[(by - 15) * W + cx - 2] = 0; d[(by - 16) * W + cx + 2] = 0; d[(by - 15) * W + cx + 5] = 0;
    }

    var lastBig = -200, chapelX = T > 500 ? round(T * 0.42) : (T > 240 ? round(T * 0.5) : -999);
    var reserved = [];
    if (chapelX > 0) { chapel(chapelX); reserved.push([chapelX - 40, chapelX + 100]); }
    if (T > 500) {
      var cx1 = round(T * 0.17); crypt(cx1); reserved.push([cx1 - 24, cx1 + 24]);
      var gx1 = round(T * 0.76); gibbet(gx1); reserved.push([gx1 - 8, gx1 + 32]);
      fence(round(T * 0.26), round(T * 0.34)); fence(round(T * 0.58), round(T * 0.68));
    }
    function isReserved(px) { for (var q = 0; q < reserved.length; q++) if (px > reserved[q][0] && px < reserved[q][1]) return true; return false; }
    x = 10;
    while (x < T - 26) {
      var base = gy[x] + 1, busy = isReserved(x);
      if (!busy && x - lastBig > 150 + r() * 90) {
        deadTree(b, x, base, 62 + r() * 46, 1310 + x, K, (r() - 0.5) * 0.5);
        if (r() < 0.5) crow(x + round((r() - 0.5) * 30), base - 40 - round(r() * 14), r() < 0.5);
        lastBig = x;
        x += 14 + ((r() * 10) | 0);
        continue;
      }
      if (!busy) {
        var roll = r();
        if (roll < 0.07 && x - lastBig > 50) deadTree(b, x, base, 24 + r() * 18, 1410 + x, K, (r() - 0.5) * 0.7, 2);
        else if (roll < 0.11) mound(x);
        else if (roll < 0.14) signpost(x);
        else {
          var gi = (r() * GRAVES.length) | 0;
          if (gi >= 9 && r() < 0.45) gi = (r() * 9) | 0;                  // the big monuments are rarer
          stamp(b, GRAVES[gi], x, base, (r() - 0.5) * (gi === 10 ? 0.12 : 0.5), K);
          if (r() < 0.10) crow(x + 1, base - GRAVES[gi].h, r() < 0.5);
        }
      }
      x += 9 + ((r() * 15) | 0) + (r() < 0.22 ? 16 + ((r() * 26) | 0) : 0);
    }
    // the hill itself (drawn last so stones sink into it), with moon-silvered turf at the crest
    for (x = 0; x < gEnd; x++) {
      if (gy[x] >= H) continue;
      for (y = gy[x]; y < H; y++) {
        var dp = y - gy[x];
        d[y * W + x] = shade(EARTH, 0.22 + 0.5 * exp(-dp / 3.5) + (fE(x / 28, y / 9) - 0.5) * 0.55, x, y);
      }
      if (r() < 0.45) b.rect(x, gy[x] - 1 - ((r() * 3) | 0), 1, 3, K);       // grass tufts
    }

    /* ---- dock between the graveyard and the ship ---- */
    var dk = T + 4;
    if (dk + 100 < W) {
      b.rect(dk - 22, 151, 118, 3, K);
      for (x = dk - 18; x < dk + 96; x += 19) { b.rect(x, 151, 3, H - 151, K); b.line(x + 3, 160, x + 19, 154, KL); b.line(x, 154, x + 19, 162, KL); }
      b.rect(dk + 2, 141, 9, 10, K); b.rect(dk + 12, 144, 7, 7, K); b.rect(dk + 4, 135, 6, 6, K);        // crates
      b.rect(dk + 60, 141, 4, 10, K); b.rect(dk + 59, 140, 6, 2, K);                                    // bollard
      limb(b, dk + 36, 151, dk + 37, 112, 2, 2, K); b.line(dk + 37, 113, dk + 44, 111, K); b.line(dk + 44, 111, dk + 44, 115, KL);
      b.rect(dk + 42, 115, 5, 6, KL); b.rect(dk + 43, 116, 3, 4, GLOW[4]); b.pset(dk + 44, 117, GLOW[3]);   // dock lantern
    }

    /* ---- the ghost ship: bulwark, bowsprit, masts, yards, torn sails, ratlines ---- */
    var SAIL = [C.night[1], C.night[2], C.slate[1], C.slate[2], C.mist[1]];
    var bow = T + 96, RAIL = 152;
    var fH = makeFbm(1320, 64, 16, 3), nT = makeNoise(1321, 512, 4);

    function sail(xc, yTop, wTop, hgt, seed, tilt, tatter) {
      var hw = wTop >> 1, s0 = seed * 3.7, reef = round(hgt * 0.3);
      for (var xx = xc - hw; xx <= xc + hw; xx++) {
        if (xx < 0 || xx >= W) continue;
        var u = (xx - xc) / hw;
        var y0 = round(yTop + tilt * (xx - xc)) + 1;
        var foot = hgt * (0.80 + 0.2 * u * u);
        var rag = nT(xx / 7 + s0, 0.5), rag2 = nT(xx / 2.3 + s0, 1.5);
        var len = foot * (1 - tatter * 0.75 * sstep(0.35, 0.8, rag)) + (rag2 - 0.5) * 7 * tatter;
        if (rag > 0.86 - tatter * 0.1) len = foot * 0.12;                       // ripped right up to the yard
        for (var yy = y0; yy < y0 + len; yy++) {
          if (yy < 0 || yy >= H) continue;
          var q = (yy - y0) / hgt;
          var hole = fH(xx / 22 + s0, yy / 18 + s0);
          if (hole > 0.60 - tatter * 0.06 + (1 - q) * 0.10) continue;          // moth-eaten holes, more toward the foot
          var fold = nT(xx / 10 + s0, 2.4 + q * 0.9) + 0.5 * nT(xx / 4.3 + s0, 1.1 + q * 0.5);
          var v = 0.40 + (fold - 0.75) * 0.42 + (1 - q) * 0.16 - u * 0.09 + (hole - 0.45) * 0.45;
          if (yy - y0 < 2) v -= 0.2;
          if (((xx - xc + 520) % 14) === 0 && (yy & 1)) v -= 0.14;            // sailcloth seams
          if (yy - y0 === reef) v -= 0.12;
          d[yy * W + xx] = shade(SAIL, clamp(v, 0, 1), xx, yy);
        }
      }
    }
    function furled(xc, y0, wTop, tilt, seed) {
      var hw = wTop >> 1;
      for (var xx = xc - hw + 3; xx <= xc + hw - 3; xx++) {
        var yy = round(y0 + tilt * (xx - xc)) + 1, th = 2 + round(nT(xx / 9 + seed, 3.5) * 3);
        for (var j = 0; j < th; j++) b.pset(xx, yy + j, shade(SAIL, 0.5 - j * 0.12 + nT(xx / 3, 1.2) * 0.2, xx, yy + j));
        if ((xx - xc) % 14 === 0) b.rect(xx, yy, 1, th + 1, KL);                 // gaskets
      }
      for (var k2 = 0; k2 < 5; k2++) {                                            // dangling tatters
        var tx = xc - hw + 8 + ((nT(k2 * 3.1 + seed, 0.2) * (wTop - 16)) | 0), tl = 4 + ((nT(k2 * 1.7 + seed, 2.2) * 12) | 0);
        for (j = 0; j < tl; j++) if (bayer(tx, j) < 0.8) b.pset(tx + ((j / 3) | 0) % 2, round(y0 + tilt * (tx - xc)) + 3 + j, SAIL[2]);
      }
    }
    function yard(xc, yc, w, tilt) {
      var hw = w >> 1;
      limb(b, xc - hw, yc - tilt * hw, xc + hw, yc + tilt * hw, 2.4, 2.4, K);
      b.rect(xc - 2, yc - 2, 5, 5, K);
      // lifts: thin ropes from the yard arms up to the mast
      b.line(xc - hw + 2, yc - tilt * hw, xc, yc - 22, KL); b.line(xc + hw - 2, yc + tilt * hw, xc, yc - 22, KL);
    }
    function lantern(lx, ly) {
      b.line(lx, ly - 4, lx, ly, KL);
      b.rect(lx - 1, ly, 3, 5, KL); b.pset(lx, ly + 1, GLOW[4]); b.pset(lx, ly + 2, GLOW[3]); b.pset(lx, ly + 3, GLOW[5]);
      for (var yy = -5; yy <= 9; yy++) for (var xx = -6; xx <= 6; xx++) {
        var dd = sqrt(xx * xx + (yy - 2) * (yy - 2));
        if (dd > 1.5 && dd < 6.5 && d[(ly + yy) * W + lx + xx] === 0 && bayer(lx + xx, ly + yy) < 0.42 - dd * 0.06) b.pset(lx + xx, ly + yy, GLOW[dd < 3.5 ? 1 : 0]);
      }
    }
    function shrouds(xm, yTop, yBot, spread, n) {
      for (var s = -1; s <= 1; s += 2) {
        for (var j = 1; j <= n; j++) b.line(xm + s * 2, yTop, xm + s * (spread * (0.42 + 0.58 * j / n)), yBot, KL);
        for (var yy = yTop + 7; yy < yBot - 1; yy += 4) {
          var t = (yy - yTop) / (yBot - yTop);
          var xa = xm + s * (2 + (spread * (0.42 + 0.58 / n) - 2) * t), xb = xm + s * (2 + (spread - 2) * t);
          b.line(xa, yy, xb, yy + (s > 0 ? 0 : 0), KL);
        }
      }
    }
    function mast(xm, o) {
      var top = o.top, plat = o.plat;
      limb(b, xm, H, xm, plat, 7, 5.4, K);
      limb(b, xm, plat + 4, xm, top, 4.2, 2, K);
      for (var yy = H - 10; yy > plat + 8; yy -= 17) b.rect(xm - 3, yy, 7, 1, KL);           // iron hoops
      // fighting top / crow's nest
      b.rect(xm - 9, plat, 19, 3, K); b.rect(xm - 7, plat + 3, 15, 1, K);
      if (o.nest) { b.rect(xm - 9, plat - 6, 19, 1, KL); for (var j = -9; j <= 9; j += 3) b.rect(xm + j, plat - 6, 1, 6, KL); }
      shrouds(xm, plat + 2, RAIL + 1, o.spread || 44, 4);
      if (top > 2) {                                                                        // topmast shrouds
        for (j = 1; j <= 2; j++) { b.line(xm - 1, top + 10, xm - j * 4 - 1, plat, KL); b.line(xm + 1, top + 10, xm + j * 4 + 1, plat, KL); }
        for (yy = top + 16; yy < plat - 1; yy += 4) { var t = (yy - top - 10) / (plat - top - 10); b.line(xm - 1 - 8 * t, yy, xm + 1 + 8 * t, yy, KL); }
      }
      // yards + canvas
      for (j = 0; j < o.yards.length; j++) {
        var Y = o.yards[j];
        if (Y.kind === 'sail') sail(xm, Y.y, Y.w - 6, Y.h, o.seed + j * 7, Y.tilt || 0, Y.tatter === undefined ? 0.6 : Y.tatter);
        yard(xm, Y.y, Y.w, Y.tilt || 0);
        if (Y.kind === 'furled') furled(xm, Y.y, Y.w, Y.tilt || 0, o.seed + j * 7);
        if (Y.lamp) lantern(xm + Y.lamp * ((Y.w >> 1) - 4), round(Y.y + (Y.tilt || 0) * Y.lamp * ((Y.w >> 1) - 4)) + 5);
      }
      // re-draw the mast over the canvas so it stays a crisp dark line
      limb(b, xm, plat + 4, xm, max(top, 0), 4.2, 2.6, K);
      limb(b, xm, H, xm, plat, 7, 5.4, K);
      if (o.flag && top > 4) {                                                              // tattered pennant / Jolly Roger
        b.rect(xm, top - 12, 1, 13, KL);
        for (var fx2 = 0; fx2 < 22; fx2++) {
          var wob = round(sin(fx2 * 0.5) * 1.5), fh = o.flag === 2 ? 11 : max(1, 6 - (fx2 >> 2));
          for (var fy2 = 0; fy2 < fh; fy2++) if (!(fx2 > 15 && bayer(fx2, fy2) < (fx2 - 15) / 8)) b.pset(xm + 1 + fx2, top - 12 + fy2 + wob, K);
        }
        if (o.flag === 2) { b.rect(xm + 8, top - 9, 5, 4, C.slate[2]); b.rect(xm + 9, top - 5, 3, 1, C.slate[2]); b.pset(xm + 9, top - 8, K); b.pset(xm + 11, top - 8, K);
          b.line(xm + 6, top - 4, xm + 14, top - 2, C.slate[2]); b.line(xm + 14, top - 4, xm + 6, top - 2, C.slate[2]); }
      }
    }

    if (bow + 60 < W) {
      // bulwark with a balustrade rail and plank seams
      for (x = bow; x < W; x++) {
        var rise = round(14 * pow(max(0, 1 - (x - bow) / 46), 2));        // sheer at the bow
        b.rect(x, RAIL + 6 - rise, 1, H - RAIL - 6 + rise, K);
        b.rect(x, RAIL - rise, 1, 2, K);
        if ((x - bow) % 6 < 2) b.rect(x, RAIL + 2 - rise, 1, 4, K);
        if ((x - bow) % 64 === 20) b.rect(x - 1, RAIL - 4 - rise, 4, 5, K);                // belaying posts
      }
      for (y = RAIL + 13; y < H; y += 8) for (x = bow + 6; x < W; x++) if (((x * 7 + y * 3) % 61) > 4) d[y * W + x] = C.night[1];
      // stem, figurehead and bowsprit thrusting out over the dock
      b.poly([[bow + 2, RAIL - 12], [bow - 12, RAIL - 22], [bow - 16, RAIL - 30], [bow - 12, RAIL - 30], [bow - 5, RAIL - 22], [bow + 10, RAIL - 8]], K);
      b.poly([[bow, H], [bow - 10, RAIL + 12], [bow - 13, RAIL - 6], [bow - 12, RAIL - 22], [bow + 3, RAIL - 12], [bow + 3, H]], K);
      limb(b, bow + 24, RAIL - 8, bow - 96, RAIL - 50, 4.5, 2, K);
      // figurehead: a horned skull under the bowsprit
      b.rect(bow - 23, RAIL - 27, 7, 6, K); b.rect(bow - 22, RAIL - 21, 5, 2, K); d[(RAIL - 25) * W + bow - 22] = 0; d[(RAIL - 25) * W + bow - 19] = 0;
      b.line(bow - 23, RAIL - 27, bow - 26, RAIL - 31, K); b.line(bow - 17, RAIL - 27, bow - 15, RAIL - 31, K);
      rope(b, bow - 94, RAIL - 49, bow - 13, RAIL + 4, 3, KL); rope(b, bow - 60, RAIL - 37, bow - 12, RAIL - 2, 2, KL);
      rope(b, bow - 80, RAIL - 44, dk + 62, 141, 10, KL);                                  // mooring line to the bollard

      // masts
      var mi = 0, mxp = bow + 96, prevTop = null, prevX = 0;
      while (mxp < W + 60) {
        var kind = mi % 3, o = { seed: 40 + mi * 13, spread: 42 + (kind === 1 ? 6 : 0) };
        if (kind === 0) {
          o.top = 10; o.plat = 62; o.nest = 0; o.flag = 1;
          o.yards = [{ y: 34, w: 96, kind: 'furled', tilt: -0.05 }, { y: 80, w: 136, kind: 'sail', h: 46, tatter: 0.75, tilt: 0.04, lamp: -1 }];
        } else if (kind === 1) {
          o.top = -30; o.plat = 46; o.nest = 1;
          o.yards = [{ y: 14, w: 120, kind: 'sail', h: 44, tatter: 0.5, tilt: -0.03 }, { y: 74, w: 156, kind: 'sail', h: 54, tatter: 0.85, tilt: 0.05, lamp: 1 }];
        } else {
          o.top = 16; o.plat = 70; o.nest = 1; o.flag = 2;
          o.yards = [{ y: 40, w: 88, kind: 'sail', h: 34, tatter: 0.9, tilt: 0.08 }, { y: 92, w: 124, kind: 'furled', tilt: -0.06, lamp: -1 }];
        }
        mast(mxp, o);
        var topY = max(o.top, 0) + 6;
        if (prevTop !== null) {                                                           // stays between masts, with rags
          rope(b, prevX, prevTop, mxp, o.plat + 2, 7, KL);
          rope(b, prevX, prevTop + 30, mxp, topY, 5, KL);
          for (i = 0; i < 4; i++) {
            var rx = round(lerp(prevX, mxp, 0.2 + i * 0.17)), tt = (rx - prevX) / (mxp - prevX);
            var ry = round(lerp(prevTop, o.plat + 2, tt) + 7 * 4 * tt * (1 - tt));
            for (var j2 = 0; j2 < 3 + ((r() * 9) | 0); j2++) if (r() < 0.8) b.pset(rx + ((j2 >> 1) & 1), ry + 1 + j2, SAIL[1 + (j2 & 1)]);
          }
        } else {
          // jib stays from the bowsprit to the foremast, one carrying a torn staysail
          rope(b, bow - 92, RAIL - 48, mxp, topY, 2, KL);
          rope(b, bow - 52, RAIL - 34, mxp, o.plat, 2, KL);
          for (x = bow - 40; x < mxp - 14; x++) {
            var tj = (x - (bow - 52)) / (mxp - (bow - 52)), ya = lerp(RAIL - 34, o.plat, tj) + 2;
            var jl = (x - (bow - 40)) * 0.62 * (0.55 + 0.6 * nT(x / 8, 0.7));
            if (nT(x / 5, 3.3) > 0.78) jl *= 0.2;
            for (y = round(ya); y < ya + jl && y < RAIL - 6; y++) {
              if (fH(x / 20, y / 16) > 0.62) continue;
              d[y * W + x] = shade(SAIL, 0.40 + sin(x * 0.3 + y * 0.12) * 0.14 + (ya + jl - y) / 120, x, y);
            }
          }
        }
        prevTop = topY; prevX = mxp;
        mxp += 196 + ((r() * 52) | 0);
        mi++;
      }
    }

    /* moonlight catching the upper-left edges of everything solid */
    var fRim = makeFbm(1330, 64, 16, 2);
    rimLight(b, K, C.night[2], C.night[4], function (px, py) { return fRim(px / 24, py / 24) > 0.36; });

    /* low ground fog: thin wisps drifting between the graves */
    var fF = makeFbm(1331, 64, 16, 3);
    for (x = 0; x < gEnd; x++) {
      var cy = gy[x], fade = 1 - sstep(T - 50, T + 30, x);
      for (y = cy - 12; y < min(H, cy + 16); y++) {
        var band = 1 - abs(y - (cy + 1)) / 14;
        var f = (fF(x / 72, y / 5.5) - 0.44) * 5 * band * fade;
        if (f > bayer(x, y)) d[y * W + x] = (f > 1.1 && ((x + y) & 1)) ? C.slate[2] : C.slate[1];
      }
    }
    return b;
  }

  GNG.Backdrops.register(0, function (info) {
    info = info || {};
    var fxFar = 0.05, fxNear = 0.5, fyNear = 0.1;
    return {
      sky: SKY1,
      layers: [
        { bmp: far1(info, fxFar), fx: fxFar, fy: 0, y: 0, wrap: true },
        { bmp: mid1(), fx: 0.18, fy: 0.04, y: 46, wrap: true },
        { bmp: near1(info, fxNear, fyNear), fx: fxNear, fy: fyNear, y: 0, wrap: false, fill: C.night[0] }
      ],
      lightning: true,
      lightningRate: 0.25        // advisory: rare distant flashes
    };
  });


  /* ====================================================================== *
   *  STAGE 2 — The Haunted Moat of Daventry (violent thunderstorm night)
   * ====================================================================== */

  var SKY2 = [[9, 7, 20], [15, 12, 31], [22, 19, 44], [30, 28, 58], [40, 40, 72], [54, 56, 88], [72, 78, 108], [100, 110, 136]];

  /**
   * Cumulus bank built from overlapping elliptical puffs, each lit from the direction of a light
   * source (lx,ly) and from above, with a flat dark base. Writes values into the field vv (W wide,
   * rows 0..yMax) and marks the mask cm. o: { cx, baseY, len, hgt, seed, lx, ly, skipR, belly, gain }.
   */
  function puffBank(vv, cm, W, yMax, o) {
    var rr = GNG.makeRng(o.seed), puffs = [], n = max(6, round(o.len / 4.5)), j, nb = makeNoise(o.seed + 5, 64, 2);
    for (j = 0; j < n; j++) {
      var t = rr() * 2 - 1, taper = 1 - t * t, pr, py;
      if (j % 3 === 0) { pr = o.hgt * (0.16 + 0.14 * rr()); py = o.baseY - pr * 0.7; t *= 1.25; }
      else { pr = o.hgt * (0.22 + 0.38 * rr()) * (0.35 + 0.65 * taper); py = o.baseY - pr * (0.45 + rr() * 0.5) - rr() * o.hgt * 0.42 * taper; }
      puffs.push({ x: o.cx + t * o.len / 2, y: py, r: pr, e: 1.25 + rr() * 0.6 });
    }
    puffs.sort(function (p, q) { return p.y - q.y; });
    for (j = 0; j < n; j++) {
      var p = puffs[j], rx = p.r * p.e;
      for (var yy = floor(p.y - p.r); yy <= p.y + p.r; yy++) {
        if (yy < 0 || yy > yMax) continue;
        for (var xx = floor(p.x - rx); xx <= p.x + rx; xx++) {
          var ddx = (xx - p.x) / p.e, ddy = yy - p.y;
          if (ddx * ddx + ddy * ddy > p.r * p.r) continue;
          var base = o.baseY + (nb(xx / 9, 0.5) - 0.5) * 3 + (nb(xx / 31, 1.5) - 0.5) * (o.ragged || 0);
          if (yy > base) continue;
          var wx = mod(xx, W), ii = yy * W + wx;
          var qx = wx - o.lx; if (qx > W / 2) qx -= W; else if (qx < -W / 2) qx += W;
          var qy = yy - o.ly, md = sqrt(qx * qx + qy * qy) + 0.001;
          if (md < o.skipR) continue;
          var lx = -qx / md * 0.62, ly = -qy / md * 0.62 - 0.72, ll = sqrt(lx * lx + ly * ly) || 1;
          var l = (ddx * lx + ddy * ly) / (ll * p.r), prox = exp(-md / 105);
          // the crown of the bank takes the light; puffs low in the mass sit in its shadow
          var crown = o.crown ? 1 - o.crown + o.crown * pow(clamp((o.baseY - yy) / o.hgt, 0, 1), 0.8) : 1;
          vv[ii] = o.belly(yy, prox) + sstep(-0.25, 0.9, l) * o.gain(prox) * crown - 0.05 * sstep(base - 3, base, yy);
          cm[ii] = 1;
        }
      }
    }
  }

  function far2(info, fx) {
    var W = 512, H = 200, HZ = 152;
    var b = new Bitmap(W, H), d = b.data;
    var fS = makeFbm(2103, 8, 16, 4), nR = makeNoise(2104, 8, 2);
    var range = max(0, ((info.levelW || 3200) - 320) * fx);
    var mx = round(clamp(110 + range * 0.5, 120, 250)), my = 48;
    var N = W * HZ, vv = new F32(N), cm = new Uint8Array(N), x, y, i, v, j;
    var rc = GNG.makeRng(2108);

    function mdx(x) { var q = x - mx; if (q > W / 2) q -= W; else if (q < -W / 2) q += W; return q; }

    /* high veil behind everything: wind-torn streaks, glowing where the moon is smothered */
    for (y = 0; y < HZ; y++) {
      var t = y / HZ;
      for (x = 0; x < W; x++) {
        var dx = mdx(x), dy = y - my, dm = sqrt(dx * dx + dy * dy);
        var glow = exp(-(dm * dm) / (2 * 40 * 40));
        v = 0.16 + 0.32 * t + 0.34 * sstep(0.5, 0.86, t) + glow * 0.56 + (fS((x + y * 2.2) / 64, y / 11) - 0.5) * (0.22 + 0.2 * glow);
        if (dm < 15) v += 0.22 * sstep(15, 7, dm);                 // a glimpse of the disc itself
        vv[y * W + x] = v;
      }
    }
    /* three ranks of thunderheads, far to near: each darker and heavier than the last */
    function rank(count, y0, y1, len0, len1, h0, h1, belly, gain, skipR) {
      var list = [];
      for (j = 0; j < count; j++) list.push({ cx: (j + rc() * 0.8) * W / count, baseY: lerp(y0, y1, rc()), len: lerp(len0, len1, rc()), hgt: lerp(h0, h1, rc()), seed: 2110 + ((rc() * 9999) | 0) });
      list.sort(function (p, q) { return q.baseY - p.baseY; });
      for (j = 0; j < count; j++) {
        var o = list[j];
        o.lx = mx; o.ly = my; o.skipR = skipR; o.belly = belly; o.gain = gain; o.crown = 0.7; o.ragged = 8;
        puffBank(vv, cm, W, HZ - 1, o);
      }
    }
    rank(6, 94, 116, 100, 170, 15, 22, function (yy, pr) { return 0.24 + 0.10 * pr; }, function (pr) { return 0.24 + 0.36 * pr; }, 0);
    rank(5, 58, 88, 150, 250, 28, 40, function (yy, pr) { return 0.12 + 0.09 * pr; }, function (pr) { return 0.30 + 0.46 * pr; }, 15);
    rank(4, 20, 48, 220, 330, 38, 52, function (yy, pr) { return 0.04 + 0.05 * pr; }, function (pr) { return 0.24 + 0.44 * pr; }, 11);

    for (y = 0; y < HZ; y++) for (x = 0; x < W; x++) {
      i = y * W + x; v = vv[i];
      if (cm[i]) v += (fS(x / 32, y / 8) - 0.5) * 0.10;               // a little turbulence inside the masses
      // rain curtains slanting down from the deck
      var rz = sstep(0.50, 0.70, nR((x + y * 0.55) / 64, 0.5)) * sstep(60, 110, y);
      if (rz > 0) {
        v = lerp(v, 0.44, rz * 0.5);
        if (((x + ((y * 0.55) | 0)) % 5) === 0 && ((x * 7 + y * 13) % 11) < 6) v += 0.10 * rz;
      }
      d[i] = shade(SKY, clamp(v, 0, 1), x, y);
    }

    /* distant jagged mountains (ordinary colours: they stay black against the lightning) */
    var nM = makeNoise(2105, 64, 2), nW = makeNoise(2107, 64, 16);
    function ridge(u) { return 1 - abs(2 * nM(u, 0.5) - 1); }
    function range2(baseY, amp, k, off, ramp, lo, hi) {
      var hsm = new F32(W), xx, yy;
      for (xx = 0; xx < W; xx++) {
        var u = xx / W;
        hsm[xx] = amp * (0.50 * ridge(u * k + off) + 0.30 * ridge(u * k * 3 + off * 2.3) + 0.14 * ridge(u * k * 8 + off * 3.1) + 0.06 * ridge(u * k * 20 + off));
      }
      for (xx = 0; xx < W; xx++) {
        var top = round(baseY - hsm[xx]);
        for (yy = top; yy < H; yy++) {
          var dep = yy - top;
          // light/shadow boundary runs down from each peak slanting to the right -> facets, not stripes
          var sx = xx - dep * 0.55 + (nW(xx / 8, yy / 8) - 0.5) * 5;
          var s0 = mod(floor(sx), W), slope = hsm[(s0 + 2) % W] - hsm[mod(s0 - 2, W)];
          var vv2 = (slope > 0 ? hi : lo) + (bayer(xx >> 1, yy >> 1) - 0.5) * 0.12 - min(0.2, dep * 0.006);
          if (dep < 1) vv2 += 0.12;
          d[yy * W + xx] = shade(ramp, clamp(vv2, 0, 1), xx, yy);
        }
      }
    }
    range2(152, 60, 5, 0.3, [C.night[1], C.night[2], C.night[3], C.slate[1]], 0.36, 0.74);
    range2(162, 38, 7, 4.1, [C.night[0], C.night[1], C.night[2]], 0.25, 0.80);
    // black pine forest across the valley floor
    var nF = makeNoise(2106, 128, 64), FOREST = [C.black, C.night[0], C.night[1]];
    for (x = 0; x < W; x++) {
      var ft = 170 + round((nF(x / 32, 0.5) - 0.5) * 10) - ((x % 5 === 2) ? 3 + ((nF(x / 4, 1.5) * 4) | 0) : (x % 5 === 1 || x % 5 === 3) ? 1 : 0);
      for (y = ft; y < H; y++) d[y * W + x] = shade(FOREST, 0.3 + (nF(x / 4, y / 4) - 0.5) * 0.6, x, y);
    }
    return b;
  }

  /* ---------------------------------------------------------------- MID 2 */

  function mid2() {
    var W = 1024, H = 176;
    var b = new Bitmap(W, H), d = b.data, x, y, i, j;
    var ST = [C.night[0], C.slate[0], C.slate[1], C.slate[2]];
    var RKC = [C.night[0], C.night[1], C.slate[0], C.slate[1]];
    var r = GNG.makeRng(2201);
    var fK = makeFbm(2202, 64, 8, 4), fR = makeFbm(2203, 32, 2, 3);
    var gy = new I16(W);

    function stone(px, py, v) { if (px >= 0 && px < W && py >= 0 && py < H) d[py * W + px] = shade(ST, v < 0 ? 0 : (v > 1 ? 1 : v), px, py); }
    function brick(px, py) { var row = (py / 3) | 0; return (GNG.hash2((px + (row & 1) * 2) >> 2, row, 77) - 0.5) * 0.14; }
    function win(px, py, h, p) {        // arrow slit / window: lit with torchlight, or dead black
      var litc = r() < (p === undefined ? 0.5 : p);
      for (var q = 0; q < h; q++) b.pset(px, py + q, litc ? GLOW[3 + ((r() * 3) | 0)] : C.night[0]);
      return litc;
    }
    function flag(px, py, len, col) {    // storm-blown pennant (wind from the left)
      b.rect(px, py - 1, 1, 6, C.night[0]);
      for (var q = 1; q <= len; q++) {
        var wy = py + round(sin(q * 0.9) * 1.2 - q * 0.12), hh = q < len * 0.6 ? 3 : (q < len - 1 ? 2 : 1);
        for (var k = 0; k < hh; k++) b.pset(px + q, wy + k, (k === 0) ? col[1] : col[0]);
      }
    }
    function cone(xc, yBase, w, h, fl) {
      var hw = w / 2;
      for (y = 0; y < h; y++) {
        var ww = hw * (1 - y / h), yy = yBase - y;
        for (x = round(xc - ww); x <= round(xc + ww); x++) {
          var u = ww < 0.5 ? 0.5 : (x - (xc - ww)) / (2 * ww);
          stone(x, yy, u < 0.16 ? 0.62 : (u < 0.5 ? 0.36 - (y & 1) * 0.06 : 0.08));
        }
      }
      b.rect(xc, yBase - h - 3, 1, 4, C.night[0]);
      if (fl) flag(xc, yBase - h - 6, fl, [C.maroon[1], C.maroon[2]]);
    }
    function cren(x0, x1, yTop, v) {     // parapet with merlons
      for (x = x0; x <= x1; x++) {
        stone(x, yTop, v + 0.12); stone(x, yTop + 1, v);
        if (((x - x0) % 4) < 2) { stone(x, yTop - 1, v + 0.1); stone(x, yTop - 2, v + 0.16); }
      }
    }
    function tower(xc, w, yTop, o) {
      o = o || {};
      var hw = w / 2, yBot = (o.yBot !== undefined) ? o.yBot : max(gy[clamp(round(xc - hw), 0, W - 1)], gy[clamp(round(xc + hw), 0, W - 1)]) + 3;
      for (y = yTop; y <= yBot; y++) {
        var ww = hw + (o.batter ? max(0, y - (yBot - 16)) * 0.13 : 0);
        for (x = round(xc - ww); x <= round(xc + ww); x++) {
          var u = (x - (xc - ww)) / (2 * ww + 0.001);
          stone(x, y, 0.78 - 0.46 * u + 0.16 * exp(-u * 10) + brick(x, y) - (y - yTop < 2 ? 0.12 : 0));
        }
      }
      if (o.top === 'cone') {
        for (x = round(xc - hw - 1); x <= round(xc + hw + 1); x++) { stone(x, yTop, 0.3); stone(x, yTop - 1, 0.5 - 0.3 * (x - xc + hw) / w); }
        cone(xc, yTop - 2, w + 4, o.roofH || round(w * 1.1), o.flag);
      } else if (o.top === 'cren') {
        for (y = yTop - 3; y < yTop; y++) for (x = round(xc - hw - 1); x <= round(xc + hw + 1); x++) stone(x, y, 0.8 - 0.46 * (x - xc + hw + 1) / (w + 2) + (y === yTop - 1 ? -0.2 : 0));
        cren(round(xc - hw - 1), round(xc + hw + 1), yTop - 4, 0.62);
      }
      for (j = 0; j < (o.slits || 0); j++) win(round(xc - hw * 0.3 + (j % 2) * hw * 0.7), yTop + 6 + j * round((yBot - yTop - 12) / max(1, o.slits)), 3, o.litP);
    }
    function wall(x0, x1, yTop0, yTop1, o) {
      o = o || {};
      for (x = x0; x <= x1; x++) {
        var yt = round(lerp(yTop0, yTop1, (x - x0) / max(1, x1 - x0)));
        if (o.step) yt = round(yTop0 + floor((x - x0) / o.step) * (yTop1 - yTop0) / max(1, floor((x1 - x0) / o.step)));
        var yb = gy[clamp(x, 0, W - 1)] + 3;
        for (y = yt; y <= yb; y++) stone(x, y, 0.56 + brick(x, y) - 0.10 * sstep(yt, yb, y) - (y - yt === 2 ? 0.14 : 0));
        if (((x - x0) % 5) < 3) { stone(x, yt - 1, 0.66); stone(x, yt - 2, 0.74); stone(x, yt - 3, 0.80); }
      }
      for (x = x0 + 5; x < x1 - 3; x += 9 + ((r() * 4) | 0)) win(x, round(lerp(yTop0, yTop1, (x - x0) / (x1 - x0))) + 6, 3, o.litP === undefined ? 0.3 : o.litP);
    }

    /* the crag: a periodic skyline with relief-shaded rock below it */
    var prof = [[0, 152], [50, 146], [96, 134], [128, 122], [146, 116], [158, 119], [166, 150], [184, 152], [192, 112], [204, 104], [260, 101],
      [330, 99], [420, 99], [480, 101], [530, 104], [566, 110], [590, 122], [612, 140], [640, 150], [672, 152], [700, 138], [726, 128],
      [760, 124], [790, 130], [820, 144], [850, 152], [890, 150], [930, 140], [960, 134], [990, 140], [1024, 152]];
    for (x = 0, j = 0; x < W; x++) {
      while (j < prof.length - 2 && x >= prof[j + 1][0]) j++;
      var pa = prof[j], pb = prof[j + 1], pt = (x - pa[0]) / (pb[0] - pa[0]);
      gy[x] = round(lerp(pa[1], pb[1], pt) + (fR(x / 32, 0.5) - 0.5) * 9);
    }
    for (x = 0; x < W; x++) {
      for (y = gy[x]; y < H; y++) {
        var dep = y - gy[x];
        var rel = (fK((x + 1.5) / 16, y / 22) - fK((x - 1.5) / 16, y / 22)) * 2.2 + (fK(x / 16, (y + 1.5) / 22) - fK(x / 16, (y - 1.5) / 22)) * 1.4;
        var v = 0.42 + rel + (dep < 1 ? 0.25 : (dep < 3 ? 0.1 : 0)) - min(0.28, dep * 0.006);
        d[y * W + x] = shade(RKC, v < 0 ? 0 : (v > 1 ? 1 : v), x, y);
      }
    }

    /* stone bridge over the gorge to the gatehouse */
    for (x = 138; x <= 197; x++) { for (y = 108; y <= 112; y++) stone(x, y, 0.6 + brick(x, y) - (y === 112 ? 0.2 : 0)); if ((x % 5) < 3) { stone(x, 107, 0.7); stone(x, 106, 0.78); } }
    for (y = 113; y < 156; y++) for (x = 170; x <= 175; x++) stone(x, y, 0.62 - (x - 170) * 0.06 + brick(x, y));
    var spans = [[150, 170], [176, 196]];
    for (i = 0; i < 2; i++) {
      var sa = spans[i][0], sb = spans[i][1], cxs = (sa + sb) / 2, rxs = (sb - sa) / 2;
      for (x = sa; x <= sb; x++) {
        var ya = 113 + (1 - sqrt(max(0, 1 - pow((x - cxs) / rxs, 2)))) * 16;
        for (y = 113; y <= ya; y++) stone(x, y, 0.44 + brick(x, y));
      }
    }

    /* the castle of Daventry, left to right */
    // gatehouse: twin drum towers, gate with portcullis
    for (y = 74; y <= 108; y++) for (x = 211; x <= 226; x++) stone(x, y, 0.52 + brick(x, y) - (y === 76 ? 0.14 : 0));
    cren(211, 226, 72, 0.6);
    for (y = 92; y <= 107; y++) for (x = 214; x <= 223; x++) { var ah = y - 92, aw = ah < 4 ? 2 + ah : 5; if (abs(x - 218.5) < aw) d[y * W + x] = ((x & 1) && y < 104) ? C.slate[0] : C.black; }
    win(218, 81, 3, 1); win(219, 81, 3, 1);
    tower(204, 14, 62, { top: 'cone', roofH: 15, flag: 9, batter: 1, slits: 3 });
    tower(233, 14, 62, { top: 'cone', roofH: 15, flag: 8, batter: 1, slits: 3 });
    // west curtain wall
    wall(241, 300, 82, 80);
    // chapel / great hall behind the east wall: pitched roof, lancets, rose window
    for (y = 60; y <= 102; y++) for (x = 410; x <= 466; x++) {
      var ridge = 60 + abs(x - 438) * 0.42;
      if (y < ridge) continue;
      if (y < 73) stone(x, y, x < 438 ? 0.34 - ((x + y) & 1) * 0.05 : 0.12); else stone(x, y, 0.5 + brick(x, y));
    }
    for (x = 418; x <= 458; x += 8) if (x !== 434 && x !== 442) { win(x, 80, 6, 0.75); }
    for (y = -3; y <= 3; y++) for (x = -3; x <= 3; x++) if (x * x + y * y <= 10) d[(84 + y) * W + 438 + x] = (x === 0 || y === 0) ? GLOW[2] : GLOW[3 + ((x * x + y * y) > 4 ? 0 : 1)];
    b.rect(438, 52, 1, 8, C.night[0]); b.rect(436, 54, 5, 1, C.night[0]);
    // east curtain wall stepping down the crag, postern tower
    wall(489, 560, 86, 96, { step: 18 });
    tower(567, 10, 82, { top: 'cone', roofH: 11, flag: 6, slits: 2 });
    // beacon tower with a brazier
    tower(478, 18, 56, { top: 'cren', batter: 1, slits: 4, litP: 0.6 });
    b.rect(475, 48, 7, 2, C.night[0]); b.rect(477, 50, 3, 2, C.night[0]);
    b.pset(476, 47, GLOW[3]); b.pset(477, 47, GLOW[4]); b.pset(478, 47, GLOW[4]); b.pset(479, 47, GLOW[5]); b.pset(480, 47, GLOW[3]);
    b.pset(477, 46, GLOW[5]); b.pset(478, 46, GLOW[4]); b.pset(479, 46, GLOW[3]); b.pset(478, 45, GLOW[3]); b.pset(477, 44, GLOW[2]);
    for (i = 0; i < 16; i++) { var hx = 478 + round((r() - 0.5) * 12), hy = 44 - round(r() * 7); if (!d[hy * W + hx]) d[hy * W + hx] = GLOW[(r() * 2) | 0]; }
    // the wizard's tower: slender, tallest, with a jettied top chamber
    tower(396, 11, 34, { slits: 5, litP: 0.35, batter: 1 });
    for (y = 22; y <= 35; y++) for (x = 388; x <= 404; x++) { var jt = y > 31 ? (y - 31) : 0; if (x >= 388 + jt && x <= 404 - jt) stone(x, y, 0.8 - 0.46 * (x - 388) / 16 + brick(x, y)); }
    cone(396, 21, 21, 18, 10);
    b.pset(394, 27, GLOW[4]); b.pset(394, 28, GLOW[3]); b.pset(399, 27, GLOW[5]); b.pset(399, 28, GLOW[4]);
    // the keep: massive square donjon with corner bartizans and a stair turret
    for (y = 40; y <= 103; y++) for (x = 300; x <= 368; x++) {
      var ku = (x - 300) / 68;
      stone(x, y, 0.64 - 0.16 * ku + (x < 303 ? 0.16 : 0) - (x > 364 ? 0.16 : 0) + brick(x, y) - (y === 43 ? 0.16 : 0) - 0.06 * sstep(60, 103, y));
    }
    cren(299, 369, 38, 0.66);
    for (i = 0; i < 3; i++) for (j = 0; j < 4; j++) {
      var kx = 311 + j * 15, ky = 50 + i * 13;
      if (i < 2 && (j === 1 || j === 2)) continue;
      if (win(kx, ky, 4, 0.55)) { b.pset(kx + 1, ky + 1, GLOW[4]); b.pset(kx + 1, ky + 2, GLOW[3]); b.pset(kx + 1, ky + 3, GLOW[3]); } else b.rect(kx + 1, ky + 1, 1, 3, C.night[0]);
    }
    // heraldic banner hung down the keep
    for (y = 47; y <= 72; y++) for (x = 330; x <= 338; x++) {
      if (y > 68 && abs(x - 334) < (y - 68)) continue;
      d[y * W + x] = (x === 330 || x === 338) ? C.maroon[0] : ((x + y) & 1 ? C.maroon[1] : C.maroon[2]);
    }
    b.rect(333, 53, 3, 5, C.gold[2]); b.rect(332, 54, 5, 1, C.gold[2]); b.pset(334, 59, C.gold[2]); b.rect(329, 46, 11, 1, C.night[0]);
    // bartizans
    for (i = 0; i < 2; i++) {
      var bx = i ? 368 : 300;
      for (y = 30; y <= 50; y++) for (x = bx - 4; x <= bx + 4; x++) { var bt = y > 45 ? (y - 45) : 0; if (abs(x - bx) <= 4 - bt) stone(x, y, 0.8 - 0.46 * (x - bx + 4) / 8 + brick(x, y)); }
      cone(bx, 29, 12, 11, i ? 0 : 0);
      win(bx, 36, 3, 0.5);
    }
    tower(334, 15, 24, { yBot: 38, top: 'cone', roofH: 15, flag: 11, slits: 0 });
    win(332, 29, 3, 0.9); win(336, 29, 3, 0.4);

    /* ruined watchtower on the next hill */
    (function () {
      var xc = 744, by = gy[xc] + 3;
      for (y = by - 44; y <= by; y++) for (x = xc - 7; x <= xc + 7; x++) {
        var broken = by - 44 + max(0, (x - xc + 7)) * 1.7 + ((x * 5) % 3);
        if (y < broken) continue;
        stone(x, y, 0.78 - 0.46 * (x - xc + 7) / 14 + brick(x, y));
      }
      for (y = 0; y < 6; y++) for (x = -1; x <= 1; x++) if (!(y === 0 && x !== 0)) d[(by - 26 + y) * W + xc - 2 + x] = 0;      // window open to the sky
      b.rect(xc + 9, by - 2, 4, 3, ST[1]); b.rect(xc + 15, by - 1, 3, 2, ST[1]); b.rect(xc - 13, by - 2, 3, 3, ST[2]);
    })();
    /* standing stones on the far hill */
    (function () {
      var xs = [938, 946, 953, 963, 972, 980], hsz = [9, 12, 12, 10, 13, 8];
      for (i = 0; i < xs.length; i++) {
        var by = gy[xs[i]] + 2;
        for (y = by - hsz[i]; y <= by; y++) for (x = xs[i] - 1; x <= xs[i] + 2; x++) stone(x + (((by - y) / 5) | 0) * (i % 2 ? 1 : 0), y, 0.7 - 0.3 * (x - xs[i] + 1) / 3);
      }
      for (x = 945; x <= 956; x++) for (y = 0; y < 3; y++) stone(x, gy[946] + 2 - 13 - y, 0.66 - y * 0.12);
    })();
    /* storm-stripped trees and black pines on the hills */
    function pine(px, h) {
      var by = gy[clamp(px, 0, W - 1)] + 2;
      for (y = 0; y < h; y++) { var ww = ((y % 4) + y * 0.3) * 0.55; for (x = round(px - ww); x <= round(px + ww); x++) b.pset(x, by - h + y, x < px ? C.night[1] : C.night[0]); }
      b.rect(px, by - 2, 1, 3, C.night[0]);
    }
    var pines = [8, 20, 30, 44, 62, 74, 88, 104, 620, 632, 648, 660, 676, 800, 812, 826, 840, 856, 870, 884, 900, 914, 1000, 1012];
    for (i = 0; i < pines.length; i++) pine(pines[i], 11 + ((r() * 9) | 0));
    var trees = [[118, 20], [696, 22], [716, 16], [772, 24], [790, 15], [926, 18], [992, 20], [584, 14], [606, 18]];
    for (i = 0; i < trees.length; i++) deadTree(b, trees[i][0], gy[trees[i][0]] + 2, trees[i][1], 2210 + i, C.night[0], (r() - 0.5) * 0.6, 1.3);
    return b;
  }

  /* --------------------------------------------------------------- NEAR 2 */

  function near2() {
    var W = 1024, H = 128;
    var b = new Bitmap(W, H), d = b.data, x, y, i;
    b.rect(0, 100, W, 28, C.night[0]);
    return b;
  }

  GNG.Backdrops.register(1, function (info) {
    info = info || {};
    var fxFar = 0.05;
    return {
      sky: SKY2,
      layers: [
        { bmp: far2(info, fxFar), fx: fxFar, fy: 0, y: 0, wrap: true },
        { bmp: mid2(), fx: 0.2, fy: 0.04, y: 22, wrap: true, fill: C.night[0] },
        { bmp: near2(), fx: 0.5, fy: 0.1, y: 76, wrap: true, fill: C.night[0] }
      ],
      lightning: true,
      lightningRate: 1.0         // advisory: frequent, violent flashes
    };
  });

  /* ====================================================================== *
   *  STAGE 3 — The Jaffar Spike Catacombs (moonlit Persian dungeon vault)
   *
   *  The level is three stacked corridors, so the backdrop is seen through three
   *  horizontal slits (screen y ~12-64, ~76-128, ~140-192). Each slit gets its own
   *  subject: moonlit windows + hanging lamps / the horseshoe arcade / shafts, torches, urns.
   * ====================================================================== */

  var SKY3 = [[8, 6, 28], [13, 11, 44], [20, 20, 62], [30, 34, 84], [46, 56, 110], [70, 88, 138], [104, 128, 170], [150, 176, 208]];
  var WALL3 = [C.night[0], C.slate[0], C.night[2], C.slate[1], C.slate[2], C.slate[3]];     // slate in moonlight
  var WALL3B = [C.night[0], C.slate[0], C.gray[0], C.bone[0], C.slate[2], C.slate[3]];      // weathered sandstone

  /* ---------------------------------------------------------------- FAR 3 */

  function far3() {
    var W = 512, H = 200, b = new Bitmap(W, H), d = b.data;
    var vv = new F32(W * H), ov = new Uint8Array(W * H), rb = new Uint8Array(W * H), x, y, i, k, v;
    var fS = makeFbm(3101, 8, 4, 4), nP = makeNoise(3102, 128, 50);
    var CYC = 56, R = 44, OFF = 8, JAMB = 74, HW = 32, SILL = 148, FLOOR = 194, SL = 0.5;
    var K = C.night[0];

    /** edge distance of a pointed horseshoe recess (negative = inside); dx measured from the bay axis */
    function archE(dx, y) {
      if (y >= JAMB) return abs(dx) - HW;
      var dy = y - CYC, a = sqrt((dx - OFF) * (dx - OFF) + dy * dy), c = sqrt((dx + OFF) * (dx + OFF) + dy * dy);
      return (a > c ? a : c) - R;
    }
    function fix(px, py, c) { if (px >= 0 && px < W && py >= 0 && py < H) ov[py * W + px] = c; }
    function add(px, py, dv) { if (px >= 0 && px < W && py >= 0 && py < H) vv[py * W + px] += dv; }

    /* the wall: huge blocks in running bond, pilasters on the bay lines, a horseshoe recess per bay */
    for (y = 0; y < H; y++) {
      var row = y >> 4, ly = y & 15, sh = (row & 1) << 4, depth = y / H;
      for (x = 0; x < W; x++) {
        i = y * W + x;
        var lx = (x + sh) & 31, col = ((x + sh) >> 5) & 15;
        var bx = x & 127, dx = bx - 64, s = bx < 64 ? bx : bx - 128;
        var grain = (fS(x / 64, y / 50) - 0.5) * 0.26 + (nP(x / 4, y / 4) - 0.5) * 0.07;
        v = 0.52 - 0.22 * depth + grain;
        if (s >= -12 && s < 12) {                      // pilaster
          var pr = (y + 6) % 12;
          rb[i] = 1;
          v += 0.04 + (GNG.hash2(x >> 7, ((y + 6) / 12) | 0, 33) - 0.5) * 0.08;
          if (pr === 11) v -= 0.14; else if (pr === 0) v += 0.05;
          v += s < -9 ? 0.13 : (s > 8 ? -0.13 : -s * 0.004);
          if (y >= 16 && y < 22) v += y === 16 ? 0.14 : (y === 21 ? -0.12 : 0.06);
          if (y >= SILL - 1 && y < SILL + 5) v += y === SILL - 1 ? 0.14 : (y === SILL + 4 ? -0.12 : 0.06);
        } else {
          v += (GNG.hash2(col, row, 31) - 0.5) * 0.12;
          if (GNG.hash2(col, row, 37) < 0.17) rb[i] = 1;
          if (ly === 15 || lx === 31) v -= 0.14; else if (ly === 0 || lx === 0) v += 0.05;
          if (s >= 12 && s < 19) v -= 0.09 * (1 - (s - 12) / 7);         // the pilaster's shadow
          var e = archE(dx, y);
          if (y < SILL) {
            if (e < 0) {                               // recess: back wall in shadow, lit right reveal
              v -= 0.19;
              if (y < 6 || archE(dx - 6, y - 6) >= 0) v -= 0.10;
              if (archE(dx + 3, y) >= 0) v += 0.15;
              if (y >= SILL - 3) v += 0.12;
            } else if (e < 7 && y < JAMB) {            // archivolt of alternating voussoirs
              var vi = floor((M.atan2(y - CYC, dx) + PI) / (PI / 14));
              v = 0.53 - 0.22 * depth + grain + ((vi & 1) ? 0.09 : -0.06) + (e < 1.2 ? 0.08 : (e >= 6 ? -0.14 : 0));
              rb[i] = vi & 1;
            } else if (y >= JAMB && y < JAMB + 5 && e < 9) v += y === JAMB ? 0.15 : (y === JAMB + 4 ? -0.1 : 0.07);   // impost
            else if (y >= JAMB && e < 4) v += e >= 3 ? -0.10 : 0.07;                                              // jamb moulding
          } else if (abs(dx) < HW + 7) {
            if (y < SILL + 4) { v += y === SILL ? 0.17 : (y === SILL + 3 ? -0.12 : 0.07); rb[i] = 1; }            // sill ledge
            else if (y < SILL + 9) v -= 0.08;
          }
        }
        if (y < 10) v -= 0.14 * (1 - y / 10);
        if (y >= FLOOR) v = 0.20 + grain + (y === FLOOR ? 0.12 : 0) - ((x & 63) === 20 ? 0.08 : 0);
        vv[i] = v;
      }
    }

    /* windows: night sky (SKY slot), a far-off skyline, iron bars */
    var wins = [];
    function skyline(ddx) {
      var h = 3;
      if (ddx === -8 || ddx === -7) h = 14; else if (ddx === -9 || ddx === -6) h = 10;
      if (ddx >= 0 && ddx <= 8) h = max(h, 3 + sqrt(max(0, 17 - (ddx - 4) * (ddx - 4))) + (ddx === 4 ? 2 : 0));
      return h;
    }
    function windowAt(cx, kind) {
      var y0 = kind ? 19 : 23, y1 = 66, hw = kind ? 14 : 10, hy = kind ? 38 : 34;
      function inside(ddx, yy, grow) {
        if (yy > y1 + grow) return false;
        if (yy >= hy) return abs(ddx) <= hw + grow;
        var dy = yy - hy;
        if (!kind) return ddx * ddx + dy * dy <= (hw + grow + 0.5) * (hw + grow + 0.5);
        var rr = 20 + grow; return (abs(ddx) + 6) * (abs(ddx) + 6) + dy * dy <= rr * rr;
      }
      for (y = y0 - 4; y <= y1 + 4; y++) for (x = cx - hw - 4; x <= cx + hw + 4; x++) {
        var ddx = x - cx;
        i = y * W + x;
        if (inside(ddx, y, 0)) {
          var t = (y - y0) / (y1 - y0), c = shade(SKY, clamp(0.12 + 0.74 * pow(t, 1.4), 0, 1), x, y);
          if (GNG.hash2(x, y, 3105 + cx) < 0.03 && t < 0.62) c = SKY[7];
          if (y1 - y < skyline(ddx)) c = SKY[1];
          if (kind) {                                   // pierced stone lattice (jali)
            var p = mod(ddx + y, 6), q = mod(ddx - y, 6);
            if (p < 2 || q < 2 || !inside(ddx, y, -2)) c = (p === 0 || q === 0) ? C.slate[0] : K;
          } else if (ddx === -5 || ddx === 0 || ddx === 5 || y === 41 || y === 54) c = K;
          ov[i] = c;
        } else if (inside(ddx, y, 3)) {
          // splayed reveal: moonlight pours in towards the lower right
          vv[i] += (inside(ddx - 3, y - 3, 0) ? 0.20 : -0.08);
        }
      }
      wins.push({ x0: cx - hw, x1: cx + hw, y0: y0 + 2, y1: y1, gain: kind ? 0.27 : 0.36, bars: kind ? 3 : 5 });
    }
    windowAt(64, 0); windowAt(192, 1); windowAt(320, 0);
    // crescent moon behind the bars of the first window
    for (y = 26; y <= 40; y++) for (x = 58; x <= 73; x++) {
      var m1 = (x - 67) * (x - 67) + (y - 32) * (y - 32), m2 = (x - 69.4) * (x - 69.4) + (y - 31) * (y - 31);
      i = y * W + x;
      if (ov[i] === K || !ov[i]) continue;
      if (m1 <= 27 && m2 > 20) ov[i] = m1 > 20 ? C.bone[5] : C.bone[6];
      else if (m1 <= 80 && m2 > 20) ov[i] = shade(SKY, clamp(0.5 - m1 / 300, 0, 1), x, y);
    }

    /* moonlight shafts slanting down to the right through the dusty air */
    for (k = 0; k < wins.length; k++) {
      var w = wins[k], full = min(w.y1 - w.y0, (w.x1 - w.x0) / SL);
      for (y = w.y0; y < FLOOR; y++) {
        var xe = min(W - 1, ceil(w.x1 + SL * (y - w.y0)));
        for (x = w.x0; x <= xe; x++) {
          var lo = max(w.y0, y - (x - w.x0) / SL), hi = min(w.y1, y, y - (x - w.x1) / SL);
          if (hi <= lo) continue;
          var ym = (lo + hi) / 2, sx = x - SL * (y - ym) - w.x0;
          var I = (hi - lo) / full * exp(-(y - ym) / 150);
          if (mod(sx + 0.6, w.bars) < 1.4) I *= 0.55;
          I *= 0.8 + 0.4 * nP(x / 6 - y / 12, y / 9);                    // drifting dust
          vv[y * W + x] += w.gain * I;
        }
      }
    }

    /* bay 4: a blind recess with a tattered banner and a long crack */
    (function () {
      var cx = 448;
      for (x = cx - 12; x <= cx + 12; x++) fix(x, 29, x === cx - 12 || x === cx + 12 ? C.slate[1] : K);
      for (x = cx - 9; x <= cx + 9; x++) {
        var end = 92 - ((GNG.hash2(x >> 1, 3, 3110) * 12) | 0) - (abs(x - cx) < 3 ? 6 : 0);
        for (y = 30; y <= end; y++) {
          var fold = sin(x * 0.9 + y * 0.05) * 0.5 + 0.5, cc = fold > 0.72 ? C.maroon[2] : (fold > 0.3 ? C.maroon[1] : C.maroon[0]);
          if (GNG.hash2(x, y, 3111) < 0.04 && y > 60) continue;           // moth holes
          fix(x, y, cc);
        }
      }
      // emblem: crescent and star
      for (y = -5; y <= 5; y++) for (x = -5; x <= 5; x++) {
        if (x * x + y * y <= 26 && (x - 2) * (x - 2) + y * y > 15) fix(cx + x - 1, 48 + y, C.rust[2]);
      }
      fix(cx + 3, 48, C.rust[3]);
      var px = cx + 14, py = 98, rc = GNG.makeRng(3112);
      for (k = 0; k < 44; k++) { fix(px, py, K); if (k % 9 === 4) fix(px + 1, py, K); py++; px += rc() < 0.3 ? -1 : (rc() < 0.25 ? 1 : 0); }
    })();

    /* bay 1: a prisoner who never made the 60 minutes, still in his shackles */
    (function () {
      var sk = mask([
        '#.........#',
        '#.........#',
        '.#.......#.',
        '.#..###..#.',
        '..#.#+#.#..',
        '..#.###.#..',
        '...#.+.#...',
        '....###....',
        '...#####...',
        '....#+#....',
        '...#####...',
        '....#+#....',
        '...#####...',
        '.....#.....',
        '....###....',
        '...#.#.#...',
        '...#...#...',
        '...#...#...',
        '...+...+...',
        '...#...#...',
        '..##...##..']);
      var cx = 44, by = 124;
      for (y = 0; y < sk.h; y++) for (x = 0; x < sk.w; x++) {
        var q = sk.data[y * sk.w + x];
        if (q) fix(cx - 5 + x, by - sk.h + 1 + y, q === 1 ? (x < 5 ? C.bone[2] : C.bone[1]) : C.bone[0]);
      }
      for (y = by - sk.h - 9; y <= by - sk.h; y++) { fix(cx - 5 + ((y & 1) ? 0 : -1), y, K); fix(cx + 5 + ((y & 1) ? 0 : 1), y, K); }
      fix(cx - 6, by - sk.h - 10, C.slate[2]); fix(cx + 6, by - sk.h - 10, C.slate[2]);
    })();

    /* bay 2: a little niche with an urn under the lattice */
    (function () {
      var cx = 192;
      for (y = 92; y <= 118; y++) for (x = -9; x <= 9; x++) {
        var inn = y >= 102 ? abs(x) <= 7 : x * x + (y - 102) * (y - 102) <= 81;
        if (!inn) continue;
        ov[y * W + cx + x] = 0; vv[y * W + cx + x] = (x > 5 || y > 116) ? 0.34 : 0.06;
      }
      for (y = 105; y <= 116; y++) {
        var uw = y < 107 ? 2 : (y < 108 ? 1 : (y < 115 ? 3.6 - abs(y - 111) * 0.5 : 2));
        for (x = -ceil(uw); x <= ceil(uw); x++) if (abs(x) <= uw) vv[y * W + cx + x] = x < 0 ? 0.52 : 0.34;
      }
    })();

    /* bay 3: empty chains and wall rings */
    (function () {
      var cx = 320, xs = [-14, 13];
      for (k = 0; k < 2; k++) {
        var x0 = cx + xs[k], len = k ? 30 : 38;
        fix(x0, 84, C.slate[2]); fix(x0 - 1, 85, K); fix(x0 + 1, 85, K); fix(x0, 86, K);
        for (y = 87; y < 87 + len; y++) fix(x0 + ((y >> 1) & 1), y, (y & 3) === 0 ? C.slate[1] : K);
        fix(x0 - 1, 87 + len, K); fix(x0 + 2, 87 + len, K); fix(x0 - 1, 88 + len, K); fix(x0 + 2, 88 + len, K); fix(x0, 89 + len, K); fix(x0 + 1, 89 + len, K);
      }
    })();

    /* drain grates in the plinth: black arches with bars (something is watching from one of them) */
    for (k = 0; k < 4; k++) {
      var gx = 64 + k * 128 + (k & 1 ? 18 : -16);
      for (y = 170; y < FLOOR; y++) for (x = -11; x <= 11; x++) {
        var dd = y >= 181 ? abs(x) : sqrt(x * x + (y - 181) * (y - 181));
        if (dd <= 8) fix(gx + x, y, ((x + 8) % 4 === 0 && !(k === 2 && x === 0 && y > 180)) ? C.slate[0] : C.black);
        else if (dd <= 10.5) add(gx + x, y, x < 0 || y < 176 ? 0.10 : -0.06);
      }
      for (y = FLOOR - 1; y > FLOOR - 4; y--) add(gx - 12, y, -0.1);
      if (k === 1) { fix(gx - 3, 184, C.maroon[3]); fix(gx + 2, 184, C.maroon[3]); }
    }
    /* damp streaks under the sills */
    for (x = 0; x < W; x++) {
      var st = nP(x / 2, 20.5);
      if (st < 0.66) continue;
      var sl = 10 + ((st - 0.66) * 120) | 0;
      for (y = SILL + 4; y < min(FLOOR, SILL + 4 + sl); y++) vv[y * W + x] -= 0.07 * (1 - (y - SILL - 4) / sl);
    }

    for (i = 0; i < W * H; i++) d[i] = ov[i] || shade(rb[i] ? WALL3B : WALL3, clamp(vv[i], 0, 1), i % W, (i / W) | 0);
    return b;
  }

  /* ---------------------------------------------------------------- MID 3 */

  function mid3() {
    var W = 1024, H = 200, SP = 64, CY = 104, RI = 25, RO = 32, SPR = 113, TOP = 66, FLOOR = 193;
    var b = new Bitmap(W, H), d = b.data, N = W * H;
    var mat = new Uint8Array(N), vv = new F32(N), nn = new Int8Array(N);
    var STN = [C.night[0], C.brown[0], C.tan[0], C.brown[1], C.brown[2], C.sand[1], C.sand[2]];
    var BRK = [C.night[0], C.maroon[0], C.maroon[1], C.rust[1], C.maroon[2], C.rust[2], C.rust[3]];
    var IRN = [C.black, C.night[0], C.night[0], C.brown[0], C.tan[0], C.brown[1], C.tan[1]];
    var BON = [C.night[0], C.bone[0], C.bone[0], C.bone[1], C.bone[1], C.bone[2], C.bone[3]];
    var RAMP = [null, STN, BRK, IRN, BON];
    var CS = [C.black, C.night[0], C.night[1], C.slate[0], C.night[2], C.slate[1]];
    var COLD = [null, CS, [C.black, C.night[0], C.dusk[0], C.night[1], C.dusk[1], C.slate[1]], [C.black, C.black, C.night[0], C.night[1], C.slate[0], C.slate[1]],
      [C.night[0], C.slate[0], C.bone[0], C.slate[1], C.bone[1], C.bone[2]]];
    var AMB = 0.27, lights = [], x, y, i, k;

    function put(px, py, m, v, n) {
      if (py < 0 || py >= H) return;
      px = mod(px, W);
      var q = py * W + px; mat[q] = m; vv[q] = v; nn[q] = n || 0;
    }
    function fix(px, py, c) { if (py < 0 || py >= H) return; px = mod(px, W); mat[py * W + px] = 9; d[py * W + px] = c; }
    function clear(px, py) { if (py < 0 || py >= H) return; mat[py * W + mod(px, W)] = 0; }

    /* the arcade: horseshoe arches of striped voussoirs on slender columns, cornice and stepped merlons */
    for (y = TOP - 10; y < H; y++) {
      for (x = 0; x < W; x++) {
        var dxa = ((x + 32) & 63) - 32, cxo = (x & 63) - 32, dy = y - CY;
        var m = 0, v = 0, n = 0, acx = abs(cxo + 0.0);
        if (y < TOP) {                                  // stepped merlons
          var mm = abs((x & 15) - 7.5), hh = TOP - y;
          if (mm < (hh <= 4 ? 6 : (hh <= 7 ? 4 : 2))) { m = 1; v = 0.5 + ((x & 15) < 8 && mm > (hh <= 4 ? 4.6 : (hh <= 7 ? 2.6 : 0.6)) ? 0.22 : 0) - (hh === 1 ? 0.1 : 0); }
        } else if (y < TOP + 6) {                       // cornice
          m = 1; hh = y - TOP;
          v = hh === 0 ? 0.86 : (hh === 1 ? 0.7 : (hh === 2 ? 0.58 : (hh === 3 ? ((x & 3) < 2 ? 0.66 : 0.28) : (hh === 4 ? 0.5 : 0.3))));
        } else if (y <= SPR) {
          var dist = sqrt(dxa * dxa + dy * dy);
          if (dist >= RO) {                             // spandrel masonry
            var cr = ((y - TOP) / 6) | 0;
            m = 1; v = 0.5;
            if ((y - TOP) % 6 === 5) v -= 0.14; else if ((x + cr * 5) % 10 === 0) v -= 0.12;
          } else if (dist >= RI) {                      // the arch ring
            var af = (M.atan2(dy, dxa) + 2 * PI) / (PI / 9), ai = floor(af);
            m = (ai & 1) ? 1 : 2; v = (ai & 1) ? 0.72 : 0.66;
            if (af - ai < 0.12) v -= 0.2;
            if (dist < RI + 1.3) v -= 0.16; else if (dist >= RO - 1.2) v -= 0.1;
            n = round(dxa / RO * -60);                   // the soffit faces its own centre
          }
        } else if (y <= SPR + 4) {                      // impost block
          if (abs(cxo) <= 9) { m = 1; v = y === SPR + 1 ? 0.84 : (y === SPR + 4 ? 0.4 : 0.62); n = cxo * 4; }
        } else if (y <= SPR + 11) {                     // capital
          hh = (y - SPR - 5) / 6;
          var cw = lerp(8, 4, hh);
          if (abs(cxo) <= cw) { m = 1; v = 0.56 + (((x + y) & 1) ? 0.12 : 0); n = round(cxo / cw * 80); }
        } else if (y === SPR + 12) {
          if (abs(cxo) <= 5) { m = 1; v = 0.8; n = cxo * 14; }
        } else if (y < FLOOR - 7) {                     // shaft
          if (abs(cxo) <= 3) { m = 1; v = 0.62 - ((y % 23) === 5 ? 0.14 : 0); n = round(cxo / 3.5 * 100); }
        } else if (y < FLOOR - 4) {
          if (abs(cxo) <= 5) { m = 1; v = 0.66; n = cxo * 16; }
        } else if (y < FLOOR) {
          if (abs(cxo) <= 6) { m = 1; v = y === FLOOR - 4 ? 0.8 : 0.52; n = cxo * 12; }
        } else {
          m = 1; v = y === FLOOR ? 0.8 : 0.5 - (y - FLOOR) * 0.04 - ((x & 31) === 9 ? 0.15 : 0);
        }
        if (m) { i = y * W + x; mat[i] = m; vv[i] = v; nn[i] = n; }
      }
    }

    /* a collapsed stretch: one column snapped, its two arches gone, rubble on the floor */
    (function () {
      var xb = 32 + SP * 10;
      for (y = TOP - 10; y < 126; y++) {
        var l = xb - 44 + ((GNG.hash2((y / 3) | 0, 1, 3207) * 10) | 0) + (y > 100 ? (y - 100) * 0.7 : 0);
        var rgt = xb + 40 - ((GNG.hash2((y / 3) | 0, 2, 3207) * 10) | 0) - (y > 100 ? (y - 100) * 0.7 : 0);
        for (x = floor(l); x <= rgt; x++) clear(x, y);
      }
      for (x = xb - 7; x <= xb + 7; x++) for (y = 126; y < 163 + (x - xb) * 1.4 + (x & 1) * 2; y++) clear(x, y);
      for (x = xb - 34; x <= xb + 40; x++) {
        var hp = 13 * exp(-pow((x - xb - 6) / 19, 2)) + 5 * exp(-pow((x - xb + 24) / 6, 2)) + (GNG.hash2(x >> 2, 0, 3209) - 0.5) * 3;
        for (y = FLOOR - round(hp); y < FLOOR; y++) {
          var cell = GNG.hash2((x + ((y >> 2) & 1) * 3) / 7 | 0, y >> 2, 3210);
          put(x, y, 1, 0.42 + cell * 0.3 - ((y & 3) === 3 ? 0.16 : 0) - (((x + ((y >> 2) & 1) * 3) % 7) === 0 ? 0.14 : 0) + (y === FLOOR - round(hp) ? 0.14 : 0), 0);
        }
      }
      // a fallen drum of the shaft
      for (y = -4; y <= 4; y++) for (x = -6; x <= 6; x++) if (x * x * 0.45 + y * y <= 16) put(xb - 46 + x, FLOOR - 5 + y, 1, 0.6 - y * 0.05, x * 14);
    })();

    /* iron: chains, cages, the half-raised slicer gate */
    function chain(cx, y0, y1) {
      for (var yy = y0; yy <= y1; yy++) {
        if ((yy & 3) < 2) put(cx, yy, 3, 0.75, 0);
        else { put(cx - 1, yy, 3, 0.9, -60); put(cx + 1, yy, 3, 0.55, 60); }
      }
    }
    function lamp(cx, yt) {
      var rows = ['....#....', '...###...', '..#####..', '.#######.', '.#o#o#o#.', '.#ooooo#.', '.#o#o#o#.', '.#ooooo#.', '.#######.', '..#####..', '...###...', '....#....', '....#....'];
      chain(cx, 0, yt - 1);
      for (var ry = 0; ry < rows.length; ry++) for (var rx = 0; rx < 9; rx++) {
        var ch = rows[ry].charAt(rx);
        if (ch === '#') put(cx - 4 + rx, yt + ry, 3, rx < 4 ? 1.0 : 0.7, (rx - 4) * 20);
        else if (ch === 'o') fix(cx - 4 + rx, yt + ry, GLOW[2 + ((rx + ry * 2) % 3)]);
      }
      lights.push({ x: cx, y: yt + 6, I: 0.8, s: 12, halo: 10 });
    }
    function cage(cx, yt, bones) {
      chain(cx, 0, yt - 1);
      var hw = 7, hgt = 25;
      for (var yy = 0; yy <= hgt; yy++) {
        var ww = yy < 5 ? round(sqrt(49 - (5 - yy) * (5 - yy) * 1.9)) : hw;
        for (var xx = -ww; xx <= ww; xx++) {
          var bar = (xx === -ww || xx === ww || ((xx + 9) % 3 === 0 && yy >= 3)), ring = (yy === 5 || yy === 15 || yy >= hgt - 1);
          if (bar || ring || yy === 0) put(cx + xx, yt + yy, 3, ring ? 0.8 : 0.65, xx * 12);
        }
      }
      if (bones) {
        var sk = mask(['..###..', '..#+#..', '..###..', '...#...', '.#####.', '#.#+#.#', '#.###.#', '#..#..#', '..###..', '..#.#..', '.##.#..', '.#..##.', '.#...#.']);
        for (yy = 0; yy < sk.h; yy++) for (xx = 0; xx < sk.w; xx++) {
          var q = sk.data[yy * sk.w + xx], tx = cx - 3 + xx, ty = yt + hgt - 2 - sk.h + 1 + yy;
          if (q && !mat[ty * W + mod(tx, W)]) put(tx, ty, 4, q === 1 ? 0.8 : 0.3, (xx - 3) * 20);
        }
      }
    }
    lamp(138, 30); lamp(458, 24); lamp(790, 34);
    cage(292, 22, true); cage(934, 16, false);
    var chs = [[40, 22], [70, 9], [204, 34], [228, 15], [372, 12], [560, 28], [604, 46], [706, 18], [868, 30], [992, 12]];
    for (k = 0; k < chs.length; k++) {
      chain(chs[k][0], 0, chs[k][1]);
      if (k % 3 === 0) {             // hook
        var hx = chs[k][0], hy = chs[k][1] + 1;
        put(hx, hy, 3, 0.8, 0); put(hx, hy + 1, 3, 0.8, 0); put(hx + 1, hy + 2, 3, 0.7, 0); put(hx + 1, hy + 3, 3, 0.7, 0); put(hx, hy + 4, 3, 0.7, 0); put(hx - 1, hy + 4, 3, 0.7, 0); put(hx - 2, hy + 3, 3, 0.9, 0);
      } else if (k % 3 === 1) {      // open shackle ring
        hx = chs[k][0]; hy = chs[k][1] + 1;
        put(hx - 1, hy, 3, 0.9, 0); put(hx + 1, hy, 3, 0.6, 0); put(hx - 2, hy + 1, 3, 0.9, 0); put(hx + 2, hy + 1, 3, 0.6, 0); put(hx - 2, hy + 2, 3, 0.9, 0); put(hx + 2, hy + 2, 3, 0.6, 0); put(hx - 1, hy + 3, 3, 0.7, 0); put(hx, hy + 3, 3, 0.7, 0);
      }
    }
    // slicer gate, half raised, in the arch between columns 5 and 6
    (function () {
      var gcx = SP * 6, gb = 150;
      for (x = gcx - 27; x <= gcx + 27; x++) {
        var ddx = x - gcx, bar = (ddx + 27) % 6 === 0;
        var topY = CY - round(sqrt(max(0, RI * RI - ddx * ddx)));
        if (abs(ddx) > 22) topY = SPR + 5;
        for (y = topY; y <= gb + (bar ? 5 : 0); y++) {
          if (mat[y * W + x]) continue;
          if (bar && y > gb) { put(x, y, 3, 0.95, 0); if (y < gb + 3) { put(x - 1, y, 3, 0.9, -50); put(x + 1, y, 3, 0.5, 50); } continue; }
          if (bar || (y % 9) === 6 || y === gb) put(x, y, 3, bar ? 0.75 : 0.6, 0);
        }
      }
    })();

    /* urns and a heap of skulls between the columns */
    function urn(cx, hgt, wmax, mt) {
      for (var yy = 0; yy < hgt; yy++) {
        var t = yy / (hgt - 1), pr;
        if (t < 0.07) pr = 0.5; else if (t < 0.2) pr = 0.3;
        else if (t < 0.5) pr = lerp(0.3, 1, sstep(0.2, 0.5, t));
        else if (t < 0.93) pr = lerp(1, 0.28, pow((t - 0.5) / 0.43, 1.6));
        else pr = 0.48;
        var ww = pr * wmax;
        for (var xx = -ceil(ww); xx <= ceil(ww); xx++) if (abs(xx) <= ww) {
          var band = (t > 0.4 && t < 0.46) || (t > 0.6 && t < 0.64);
          put(cx + xx, FLOOR - hgt + yy, band ? 1 : mt, 0.66 - t * 0.12 - (band ? 0.05 : 0), round(xx / (ww + 0.5) * 100));
        }
      }
      // handles
      var hy0 = FLOOR - hgt + round(hgt * 0.2);
      for (yy = 0; yy < round(hgt * 0.22); yy++) { put(cx - round(wmax * 0.55) - (yy > 0 && yy < round(hgt * 0.22) - 1 ? 1 : 0), hy0 + yy, mt, 0.7, -80); put(cx + round(wmax * 0.55) + (yy > 0 && yy < round(hgt * 0.22) - 1 ? 1 : 0), hy0 + yy, mt, 0.5, 80); }
    }
    urn(64 * 2 + 12, 22, 7, 2); urn(64 * 2 - 6, 15, 5, 1); urn(64 * 8 - 8, 24, 8, 2); urn(64 * 13 + 6, 18, 6, 1); urn(64 * 13 - 12, 23, 7, 2); urn(64 * 15 + 4, 20, 6.5, 2);
    function skull(cx, cy) {
      var sk = mask(['.###.', '#####', '#+#+#', '.###.', '.#+#.']);
      for (var yy = 0; yy < 5; yy++) for (var xx = 0; xx < 5; xx++) {
        var q = sk.data[yy * 5 + xx];
        if (q) put(cx - 2 + xx, cy - 4 + yy, 4, q === 1 ? 0.75 - xx * 0.05 : 0.15, (xx - 2) * 30);
      }
    }
    var sks = [[250, 0], [256, 0], [262, 0], [253, -4], [259, -4], [256, -8], [246, 0], [610, 0], [616, 0], [613, -4], [880, 0]];
    for (k = 0; k < sks.length; k++) skull(sks[k][0], FLOOR - 1 + sks[k][1]);

    /* torches in iron cups on some of the columns */
    var FL = ['...1...', '..121..', '..232..', '.12421.', '.23432.', '.13431.', '..232..'];
    function torch(col) {
      var cx = 32 + SP * col, ty = 152;
      for (x = -3; x <= 3; x++) put(cx + x, ty, 3, 1.0, x * 25);
      for (x = -2; x <= 2; x++) { put(cx + x, ty + 1, 3, 0.8, x * 30); }
      put(cx - 1, ty + 2, 3, 0.8, -40); put(cx, ty + 2, 3, 0.8, 0); put(cx + 1, ty + 2, 3, 0.6, 40);
      put(cx, ty + 3, 3, 0.7, 0); put(cx, ty + 4, 3, 0.7, 0); put(cx, ty + 5, 3, 0.6, 0);
      for (y = 0; y < FL.length; y++) for (x = 0; x < 7; x++) {
        var ch = FL[y].charAt(x);
        if (ch !== '.') fix(cx - 3 + x, ty - 7 + y, GLOW[+ch]);
      }
      lights.push({ x: cx, y: ty - 4, I: 1.3, s: 27, halo: 14 });
    }
    var tcols = [1, 4, 7, 12, 14];
    for (k = 0; k < tcols.length; k++) torch(tcols[k]);

    /* light it: cold moonlit ambient from the upper left, warm pools round every flame */
    var warm = new F32(N);
    for (k = 0; k < lights.length; k++) {
      var L = lights[k], rad = 100;
      for (y = max(0, L.y - rad); y < min(H, L.y + rad); y++) {
        for (x = L.x - rad; x <= L.x + rad; x++) {
          var wx = mod(x, W);
          i = y * W + wx;
          var ddx = x - L.x, ddy = y - L.y, ds = sqrt(ddx * ddx + ddy * ddy);
          if (mat[i] === 0) {                           // glow hanging in the dusty air
            if (ds < L.halo && ds > 1.5) {
              var hv = pow(1 - ds / L.halo, 1.3);
              if (bayer(x, y) < hv * 0.9) { d[i] = ds < L.halo * 0.38 ? C.rust[2] : (ds < L.halo * 0.66 ? C.rust[1] : C.rust[0]); mat[i] = 9; }
            }
            continue;
          }
          if (mat[i] === 9) continue;
          warm[i] += L.I * exp(-ds / L.s) * (1 + 0.6 * nn[i] / 100 * clamp(ddx / -10, -1, 1));
        }
      }
    }
    for (i = 0; i < N; i++) {
      var mt = mat[i];
      if (!mt || mt === 9) continue;
      x = i % W; y = (i / W) | 0;
      var wm = warm[i], cold = AMB * (1 - 0.5 * nn[i] / 100);
      if (bayer(x + 2, y + 1) < wm / 0.17) d[i] = shade(RAMP[mt], clamp(vv[i] * min(1, 0.12 + wm * 0.95), 0, 1), x, y);
      else d[i] = shade(COLD[mt], clamp(vv[i] * cold * 2.5, 0, 1), x, y);
    }
    return b;
  }

  /* --------------------------------------------------------------- NEAR 3 */

  function near3() {
    var W = 1024, H = 200, b = new Bitmap(W, H), d = b.data, x, y;
    var K = C.night[0], J = C.black, RIM = C.night[2], RIM2 = C.slate[1];
    var nE = makeNoise(3301, 64, 64);

    function body(px, py, edge) {
      if (py < 0 || py >= H) return;
      px = mod(px, W);
      var c = K;
      if ((py % 22) === 21 || ((px + ((py / 22) | 0) * 9) % 18) === 0) c = J;
      if (edge === 1) c = nE(px / 3, py / 5) > 0.42 ? ((py & 1) ? RIM : RIM2) : RIM;
      else if (edge === 2) c = (px + py) & 1 ? RIM : K;
      d[py * W + px] = c;
    }
    /** massive square pier, floor to vault, with an impost block and a spreading plinth */
    function pier(cx, hw, sy) {
      for (y = 0; y < H; y++) {
        var ww = hw + (y > 172 ? min(6, ((y - 172) / 3 | 0) * 2 + 2) : 0) + (y >= sy - 8 && y < sy ? (y >= sy - 3 ? 2 : 4) : 0);
        for (x = -ww; x <= ww; x++) body(cx + x, y, x === -ww ? 1 : (x === -ww + 1 ? 2 : 0));
        if (y === sy - 8) for (x = -ww; x <= ww; x++) body(cx + x, y, x < 2 ? 1 : 0);
      }
    }
    /**
     * Arch haunch springing from (sx, sy) and sweeping up out of the top of the screen towards dir
     * (+1 right / -1 left). `brk` (radians, optional) snaps it off in blocky voussoir steps.
     */
    function arch(sx, sy, dir, Rm, th, brk) {
      var cxx = sx + dir * Rm, VA = 0.17;
      for (y = 0; y <= sy; y++) for (x = 0; x <= Rm; x++) {
        var px = cxx - dir * x, dy = y - sy, rr = sqrt(x * x + dy * dy);
        if (rr < Rm - th || rr > Rm) continue;
        var ang = M.atan2(-dy, x);                      // 0 at the springing, rising towards the crown
        var course = ((Rm - rr) / (th / 3)) | 0;        // 0 = intrados course
        if (brk !== undefined) {
          var lim = (floor(brk / VA) + [2, 1, 0][course > 2 ? 2 : course]) * VA + (course === 1 ? VA * 0.5 : 0);
          if (ang > lim) continue;
        }
        var vj = floor((ang + (course === 1 ? VA * 0.5 : 0)) / VA) !== floor((ang + (course === 1 ? VA * 0.5 : 0) + 1.3 / rr) / VA);
        var cj = (((Rm - rr) / (th / 3)) | 0) !== (((Rm - rr + 1) / (th / 3)) | 0);
        px = mod(px, W);
        d[y * W + px] = (vj || cj) ? J : K;
        if (rr > Rm - 1.3 && dir > 0 && !vj) d[y * W + px] = (x + y) & 1 ? RIM : K;     // moon rim on the left-facing soffit
        else if (rr < Rm - th + 1.3 && dir < 0 && !vj && ((x + y) & 3) === 0) d[y * W + px] = RIM;
      }
    }
    function chain(cx, y0, y1) {
      for (y = y0; y <= y1; y++) {
        if ((y % 6) < 3) { d[y * W + cx] = K; d[y * W + cx + 1] = K; }
        else { d[y * W + cx - 1] = (y % 6) === 4 ? RIM : K; d[y * W + cx + 2] = K; if ((y % 6) !== 4) { d[y * W + cx] = K; d[y * W + cx + 1] = K; } }
      }
    }

    pier(150, 17, 66);
    arch(150 + 21, 62, 1, 86, 15);
    arch(150 - 21, 62, -1, 86, 15);
    pier(690, 15, 60);
    arch(690 - 19, 56, -1, 78, 14);
    arch(690 + 19, 56, 1, 78, 14, 0.3);
    // snapped-off column on its plinth
    (function () {
      var cx = 430;
      for (y = 122; y < H; y++) {
        var ww = y > 186 ? 13 : (y > 181 ? 11 : (y > 178 ? 10 : 8));
        for (x = -ww; x <= ww; x++) {
          var top = 122 + (x < -3 ? 0 : (x < 2 ? 7 : (x < 5 ? 4 : 13)));
          if (y < top) continue;
          body(cx + x, y, x === -ww ? 1 : (x === -ww + 1 ? 2 : 0));
          if (y === top && x >= -3) d[y * W + cx + x] = RIM;
        }
      }
    })();
    // heavy chains with a meat hook and a ring
    chain(422, 0, 44);
    var hk = ['..##..', '..##..', '..##..', '...##.', '....##', '....##', '#...##', '##.##.', '.###..'];
    for (y = 0; y < hk.length; y++) for (x = 0; x < 6; x++) if (hk[y].charAt(x) === '#') d[(45 + y) * W + 420 + x] = x < 2 && y > 5 ? RIM : K;
    chain(904, 0, 26);
    for (y = -5; y <= 5; y++) for (x = -5; x <= 5; x++) { var q = x * x + y * y; if (q <= 30 && q >= 12) d[(32 + y) * W + 904 + x] = (x < -1 && y < 1 && q > 20) ? RIM : K; }
    chain(948, 0, 12);
    return b;
  }

  GNG.Backdrops.register(2, function () {
    return {
      sky: SKY3,
      layers: [
        { bmp: far3(), fx: 0.05, fy: 0, y: 0, wrap: true },
        { bmp: mid3(), fx: 0.2, fy: 0, y: 0, wrap: true },
        { bmp: near3(), fx: 0.5, fy: 0, y: 0, wrap: true }
      ],
      lightning: false,
      lightningRate: 0           // an interior: no flashes, the torches (GLOW cycle) do the flickering
    };
  });

  /* ====================================================================== *
   *  THE WORLD MAP — an ink-drawn parchment chart of the cursed museum isle
   *
   *  Layout contract: clear parchment for the game's text above the neatline
   *  (y 6..22) and below it (y 170..194); six stage nodes on a dotted path.
   * ====================================================================== */

  var MAP_NODES = [{ x: 50, y: 142 }, { x: 94, y: 102 }, { x: 140, y: 138 }, { x: 188, y: 94 }, { x: 236, y: 126 }, { x: 282, y: 78 }];
  var TINY = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111'
  };

  function buildMap() {
    var W = 320, H = 200, N = W * H, b = new Bitmap(W, H), d = b.data, x, y, i, k, j;
    var PAP = [C.brown[0], C.brown[1], C.tan[1], C.tan[2], C.tan[3], C.tan[4], C.tan[5], C.tan[6], C.tan[7]];
    var SEAP = [C.brown[0], C.brown[1], C.tan[1], C.tan[2], C.tan[3], C.bone[3], C.bone[4], C.bone[5], C.bone[6]];
    var WRM = [C.brown[0], C.brown[1], C.sand[1], C.sand[2], C.sand[3], C.sand[4], C.sand[5], C.sand[6], C.tan[7]];
    var INK = C.brown[0], INK2 = C.brown[1], INK3 = C.brown[2], FADE = C.tan[3], FADE2 = C.tan[4], RED = C.maroon[3];
    var LEG = {
      '#': INK, '%': INK2, '+': INK3, ':': FADE, ',': FADE2, 'o': C.tan[6], 'w': C.tan[7], 'r': RED, 'R': C.rust[3],
      'b': C.mist[5], 'B': C.mist[4], 'g': C.olive[4], 'G': C.zombie[4], 'e': GLOW[2], 'f': GLOW[3], 'F': GLOW[4]
    };
    var FX0 = 9, FY0 = 26, FX1 = 310, FY1 = 167;                 // the neatline (map frame)
    var nodes = MAP_NODES;
    var fP = makeFbm(4001, 8, 8, 4), fE = makeFbm(4002, 16, 16, 3), fL = makeFbm(4003, 8, 8, 4), nF = makeNoise(4004, 64, 64);
    var pv = new F32(N), warm = new Uint8Array(N), edge = new F32(N), land = new Uint8Array(N), resv = new Uint8Array(N);
    var base = new Uint8Array(N);

    function hyp(a, c) { return sqrt(a * a + c * c); }
    function inMap(px, py) { return px > FX0 + 2 && px < FX1 - 2 && py > FY0 + 2 && py < FY1 - 2; }
    function ink(px, py, c) { px = round(px); py = round(py); if (inMap(px, py)) d[py * W + px] = c; }
    function iline(x0, y0, x1, y1, c) {
      var n = max(abs(x1 - x0), abs(y1 - y0)) | 0;
      for (var q = 0; q <= n; q++) ink(x0 + (x1 - x0) * (n ? q / n : 0), y0 + (y1 - y0) * (n ? q / n : 0), c);
    }
    function art(rows, x0, y0) {
      for (var ry = 0; ry < rows.length; ry++) for (var rx = 0; rx < rows[ry].length; rx++) {
        var c = LEG[rows[ry].charAt(rx)];
        if (c !== undefined) ink(x0 + rx, y0 + ry, c);
      }
    }
    function text(str, x0, y0, c) {
      for (var q = 0; q < str.length; q++) {
        var g = TINY[str.charAt(q)];
        if (g) for (var p = 0; p < 15; p++) if (g.charAt(p) === '1') ink(x0 + q * 4 + (p % 3), y0 + ((p / 3) | 0), c);
      }
    }
    function reserve(x0, y0, x1, y1) { for (var ry = max(0, y0); ry <= min(H - 1, y1); ry++) for (var rx = max(0, x0); rx <= min(W - 1, x1); rx++) resv[ry * W + rx] = 1; }
    function isFree(px, py, rw, rh) {
      for (var ry = py; ry < py + rh; ry++) for (var rx = px; rx < px + rw; rx++) if (!inMap(rx, ry) || resv[ry * W + rx]) return false;
      return true;
    }
    /** outlined shape from an inside-test: paper fill, ink edge */
    function shape(x0, y0, x1, y1, inside, fill, line) {
      for (var sy = y0; sy <= y1; sy++) for (var sx = x0; sx <= x1; sx++) {
        if (!inside(sx, sy)) continue;
        var edgePx = !inside(sx - 1, sy) || !inside(sx + 1, sy) || !inside(sx, sy - 1) || !inside(sx, sy + 1);
        ink(sx, sy, edgePx ? line : (typeof fill === 'function' ? fill(sx, sy) : fill));
      }
    }

    /* ---- the sheet: fibres, stains, fold creases, scorched and torn edges ---- */
    var rings = [[207, 62, 15], [84, 150, 9], [300, 150, 12]];
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        var e = min(x, W - 1 - x, y, H - 1 - y) + 0.5 - 1.0 - fE(x / 20, y / 20) * 3.4 - nF(x / 2.5, y / 2.5 + 40) * 1.6;
        // tears and dog-ears (kept clear of the two text bands)
        e -= 9 * gauss(hyp(x - 0, y - 121), 5) + 7 * gauss(hyp(x - 232, y - 199), 4) + 8 * gauss(hyp(x - 319, y - 54), 5) + 6 * gauss(hyp(x - 319, y - 132), 3)
          + 10 * gauss(hyp(x - 319, y - 0), 7) + 9 * gauss(hyp(x - 0, y - 199), 6) + 6 * gauss(hyp(x - 0, y - 40), 3.5) + 6 * gauss(hyp(x - 70, y - 199), 3);
        edge[i] = e;
        var v = 0.865 + (fP(x / 64, y / 64) - 0.5) * 0.17 + (nF(x / 1.5, y / 1.5) - 0.5) * 0.04 + (nF(x / 11, y / 1.3 + 20) - 0.5) * 0.035;
        var st = fP(x / 64 + 3.3, y / 64 + 1.7);
        if (st > 0.58) { warm[i] = 1; v -= min(0.06, (st - 0.58) * 0.8); }
        for (k = 0; k < rings.length; k++) {
          var rd = hyp(x - rings[k][0], y - rings[k][1]) + (nF(x / 7, y / 7 + k * 9) - 0.5) * 3, rr = rings[k][2];
          if (rd < rr + 0.8) { warm[i] = 1; v -= rd > rr - 1.4 ? 0.075 : 0.022; }
        }
        // fold creases: a rubbed-light line with a shadow beside it
        var cv = [107, 214];
        for (k = 0; k < 2; k++) {
          var cxv = round(cv[k] + (nF(y / 30, 3.5 + k) - 0.5) * 2.4);
          if (x === cxv && nF(y / 5, 7.5 + k) > 0.22) v += 0.07; else if (x === cxv + 1) v -= 0.075; else if (x === cxv + 2) v -= 0.03;
        }
        var cyh = round(99 + (nF(x / 30, 11.5) - 0.5) * 2.4);
        if (y === cyh && nF(x / 5, 13.5) > 0.22) v += 0.07; else if (y === cyh + 1) v -= 0.075; else if (y === cyh + 2) v -= 0.03;
        v += 0.035 * (gauss(hyp(x - 107, y - 99), 5) + gauss(hyp(x - 214, y - 99), 5));           // rubbed-pale patches where folds cross
        var ee = max(e, 0);
        v -= 0.56 * exp(-ee / 1.7) + 0.13 * exp(-ee / 6.5);
        pv[i] = v;
      }
    }

    /* ---- the island: union of lobes with a fractal coast ---- */
    var BL = [[62, 136, 27, 23], [94, 98, 35, 29], [140, 127, 34, 24], [188, 88, 40, 31], [238, 116, 29, 25], [284, 72, 27, 27], [150, 105, 74, 31], [263, 98, 15, 13], [214, 44, 12, 6.5]];
    var SEA = [[25, 150, 15], [36, 58, 20], [193, 152, 24], [284, 150, 26], [238, 60, 12], [130, 44, 30]];
    for (y = FY0 + 3; y < FY1 - 2; y++) {
      for (x = FX0 + 3; x < FX1 - 2; x++) {
        var f = -9;
        for (k = 0; k < BL.length; k++) {
          var q = 1 - pow((x - BL[k][0]) / BL[k][2], 2) - pow((y - BL[k][1]) / BL[k][3], 2);
          if (q > f) f = q;
        }
        f += (fL(x / 40, y / 40) - 0.5) * 1.0;
        for (k = 0; k < SEA.length; k++) f -= 1.6 * gauss(hyp(x - SEA[k][0], y - SEA[k][1]), SEA[k][2] * 0.6);
        for (k = 0; k < nodes.length; k++) f += 1.4 * gauss(hyp(x - nodes[k].x, y - nodes[k].y), 7);
        f -= 2.5 * exp(-(min(x - FX0, FX1 - x, y - FY0, FY1 - y) - 3) / 2.5);       // keep the coast off the frame
        land[y * W + x] = f > 0 ? 1 : 0;
      }
    }
    // remove specks: tiny islands / ponds smaller than a few pixels
    for (k = 0; k < 2; k++) for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      i = y * W + x;
      var nb = land[i - 1] + land[i + 1] + land[i - W] + land[i + W];
      if (land[i] && nb <= 1) land[i] = 0; else if (!land[i] && nb >= 3) land[i] = 1;
    }
    /** chamfer distance (px) to the nearest pixel where mask === val */
    function distTo(val) {
      var D = new F32(N), BIG = 999;
      for (i = 0; i < N; i++) D[i] = land[i] === val ? 0 : BIG;
      for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
        i = y * W + x;
        var m = D[i];
        if (D[i - 1] + 1 < m) m = D[i - 1] + 1;
        if (D[i - W] + 1 < m) m = D[i - W] + 1;
        if (D[i - W - 1] + 1.4 < m) m = D[i - W - 1] + 1.4;
        if (D[i - W + 1] + 1.4 < m) m = D[i - W + 1] + 1.4;
        D[i] = m;
      }
      for (y = H - 2; y > 0; y--) for (x = W - 2; x > 0; x--) {
        i = y * W + x;
        m = D[i];
        if (D[i + 1] + 1 < m) m = D[i + 1] + 1;
        if (D[i + W] + 1 < m) m = D[i + W] + 1;
        if (D[i + W + 1] + 1.4 < m) m = D[i + W + 1] + 1.4;
        if (D[i + W - 1] + 1.4 < m) m = D[i + W - 1] + 1.4;
        D[i] = m;
      }
      return D;
    }
    var dSea = distTo(1), dLand = distTo(0);     // dSea: how far out to sea; dLand: how far inland

    /* ---- lay down paper, sea wash and coast ---- */
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (edge[i] < 0) { d[i] = C.black; base[i] = d[i]; continue; }
        var pvv = pv[i], c, im = inMap(x, y);
        if (im && !land[i]) {
          var ds = dSea[i];
          pvv -= 0.012 + 0.05 * exp(-ds / 5);
          c = shade(bayer(x + 2, y + 3) < 0.62 ? SEAP : (warm[i] ? WRM : PAP), clamp(pvv, 0, 1), x, y);
          if (bayer(x + 1, y + 2) < 0.62 * exp(-ds / 5.5)) c = ds < 4.5 ? C.mist[4] : C.mist[5];
        } else {
          if (im) pvv += 0.035 - 0.05 * exp(-dLand[i] / 2.5);
          c = shade(warm[i] ? WRM : PAP, clamp(pvv, 0, 1), x, y);
        }
        d[i] = c; base[i] = c;
      }
    }
    function erase(px, py) { px = round(px); py = round(py); if (inMap(px, py)) d[py * W + px] = base[py * W + px]; }

    /* ---- reserved boxes: landmarks, ornaments, labels (nothing gets scattered there) ---- */
    reserve(12, 132, 46, 164); reserve(60, 108, 90, 142); reserve(68, 62, 120, 104); reserve(121, 106, 159, 142);
    reserve(165, 52, 214, 96); reserve(214, 100, 258, 130); reserve(250, 28, 309, 82); reserve(16, 32, 56, 80);
    reserve(160, 138, 230, 165); reserve(257, 131, 309, 165); reserve(96, 32, 176, 44); reserve(200, 32, 226, 50);

    /* ---- the dotted road through the six stages ---- */
    var wp = [[50, 142], [56, 130], [68, 114], [94, 102], [113, 105], [127, 121], [140, 138], [160, 131], [171, 110], [188, 94], [208, 97], [225, 111], [236, 126], [254, 119], [268, 99], [282, 78]];
    var road = [];
    for (k = 0; k < wp.length - 1; k++) {
      var p0 = wp[max(0, k - 1)], p1 = wp[k], p2 = wp[k + 1], p3 = wp[min(wp.length - 1, k + 2)];
      for (j = 0; j < 24; j++) {
        var t = j / 24, t2 = t * t, t3 = t2 * t;
        road.push([
          0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    road.push(wp[wp.length - 1]);
    for (k = 0; k < road.length; k++) reserve(round(road[k][0]) - 4, round(road[k][1]) - 4, round(road[k][0]) + 4, round(road[k][1]) + 4);

    /* ---- sea: rhumb lines from the compass, coast ripples, wave squiggles ---- */
    var CPX = 36, CPY = 58;
    for (k = 0; k < 16; k++) {
      var ra = k / 16 * PI * 2 + PI / 16;
      for (j = 22; j < 330; j++) {
        x = round(CPX + cos(ra) * j); y = round(CPY + sin(ra) * j);
        if (!inMap(x, y)) continue;
        i = y * W + x;
        if (!land[i] && dSea[i] > 2 && (j % 9) < 7) d[i] = base[i] === C.mist[4] || base[i] === C.mist[5] ? C.mist[3] : C.bone[3];
      }
    }
    for (y = FY0 + 3; y < FY1 - 2; y++) for (x = FX0 + 3; x < FX1 - 2; x++) {
      i = y * W + x;
      if (land[i]) {
        if (dLand[i] <= 1) d[i] = INK2;                                   // the coastline
        else if (dLand[i] < 5 && GNG.hash2(x, y, 4010) < 0.10) d[i] = FADE2;     // beach stipple
        continue;
      }
      var ds2 = dSea[i], hs = GNG.hash2((x + y * 2) >> 3, (y * 2 - x) >> 3, 4011);
      if (ds2 >= 2.6 && ds2 < 3.6 && hs > 0.25) d[i] = INK3;
      else if (ds2 >= 5.4 && ds2 < 6.3 && hs > 0.5) d[i] = FADE;
    }
    var rw = GNG.makeRng(4012);
    for (y = FY0 + 6; y < FY1 - 6; y += 9) for (x = FX0 + 6; x < FX1 - 10; x += 17) {
      var wx = x + ((rw() * 10) | 0), wy = y + ((rw() * 6) | 0);
      if (land[wy * W + wx] || dSea[wy * W + wx] < 9 || !isFree(wx - 1, wy - 2, 9, 4)) continue;
      var wc = rw() < 0.5 ? INK3 : FADE;
      ink(wx, wy, wc); ink(wx + 1, wy - 1, wc); ink(wx + 2, wy - 1, wc); ink(wx + 3, wy, wc); ink(wx + 4, wy + 1, wc); ink(wx + 5, wy + 1, wc); ink(wx + 6, wy, wc);
    }

    /* ---- land: ink mountains, woods and tufts, scattered clear of everything else ---- */
    var MT = ['....#....', '...#:#...', '..#.:,#..', '.#..:,:#.', '#...:,:,#'];
    var HL = ['..+++..', '.+..:+.', '+...:,+'];
    var TR = ['..+..', '.+,+.', '.+,+.', '+,,:+', '+++++', '..#..'];
    var TR2 = ['.+++.', '+w,,+', '+,,:+', '.+++.', '..#..'];
    var fM = makeFbm(4013, 8, 8, 2);
    for (y = FY0 + 6; y < FY1 - 8; y += 7) for (x = FX0 + 6; x < FX1 - 12; x += 10) {
      var gx = x + ((rw() * 5) | 0) + ((y / 7) & 1) * 4, gy = y + ((rw() * 3) | 0), mv = fM(gx / 40, gy / 40);
      if (!land[gy * W + gx] || dLand[(gy + 2) * W + gx + 4] < 6) continue;
      if (mv > 0.51) { if (isFree(gx - 1, gy - 1, 11, 7)) { art(MT, gx, gy); reserve(gx, gy, gx + 8, gy + 4); } }
      else if (mv > 0.44) { if (isFree(gx, gy, 7, 3)) { art(HL, gx, gy + 1); reserve(gx, gy, gx + 6, gy + 3); } }
    }
    for (y = FY0 + 5; y < FY1 - 8; y += 5) for (x = FX0 + 5; x < FX1 - 8; x += 6) {
      gx = x + ((rw() * 3) | 0) + ((y / 5) & 1) * 3; gy = y + ((rw() * 2) | 0); mv = fM(gx / 40 + 5.5, gy / 40 + 2.5);
      if (!land[gy * W + gx] || dLand[(gy + 3) * W + gx + 2] < 5) continue;
      if (mv > 0.53) { if (isFree(gx, gy, 5, 6)) { art(mv > 0.6 ? TR : TR2, gx, gy); reserve(gx, gy, gx + 4, gy + 4); } }
      else if (rw() < 0.10 && isFree(gx, gy, 3, 2)) { ink(gx, gy, FADE); ink(gx + 2, gy, FADE); ink(gx + 1, gy + 1, FADE); }
    }

    /* ---- the road itself: red ink dots with a little clearing round each ---- */
    var acc = 0, last = road[0];
    for (k = 1; k < road.length; k++) {
      acc += hyp(road[k][0] - last[0], road[k][1] - last[1]); last = road[k];
      if (acc < 5) continue;
      acc = 0;
      x = round(road[k][0]); y = round(road[k][1]);
      for (j = -1; j <= 2; j++) for (i = -1; i <= 2; i++) erase(x + i, y + j);
      ink(x, y, RED); ink(x + 1, y, RED); ink(x, y + 1, RED); ink(x + 1, y + 1, C.maroon[2]);
    }

    /* ================= landmarks ================= */

    /* 1 — LeChuck's ghost ship (black sails) in the bay, and the graveyard on the hill */
    art([
      '.............#................',
      '.............##...............',
      '.............#................',
      '......#......#................',
      '......##.....#................',
      '......#...#######.............',
      '......#...#%%%%%#.............',
      '...######.#%%%%%#.............',
      '...#%%%%#.##.#.##.............',
      '...#%%%%#....#................',
      '...#%%%%#.#########...........',
      '...##.#.#.#%%www%%#......#....',
      '......#...#%w%w%w%#.....#.....',
      '......#...#%%www%%#....#......',
      '......#...#%%w%w%%#...#.......',
      '#####.#...##.#.#.##..#........',
      '#ooo#.#......#......#.........',
      '#o,o#########################.',
      '#oooooo,oooooo,oooooo,ooooo#..',
      '.#o#o#o#o#o#o#o#o#o#o#oooo#...',
      '..#ooooooooooooooooooooo,#....',
      '...#####################......'], 13, 136);
    for (x = 12; x < 45; x++) if (((x * 7) % 5) < 3) ink(x, 158 + ((x >> 2) & 1), x > 15 && x < 37 ? C.mist[3] : INK3);
    // ghostly vapour trailing from the rigging
    art(['..G.....', '.G.G..G.', 'G...GG..'], 15, 132); art(['.G..', 'G.G.', '...G'], 33, 137); art(['G.', '.G', 'G.'], 44, 146);
    // graveyard: crosses, headstones, a dead tree
    (function () {
      var gxs = [[64, 134, 0], [70, 139, 1], [75, 133, 0], [80, 138, 1], [68, 128, 1], [74, 127, 0]];
      for (k = 0; k < gxs.length; k++) {
        var px = gxs[k][0], py = gxs[k][1];
        if (gxs[k][2]) art(['.#.', '###', '.#.', '.#.', '.#.'], px, py - 4);
        else art(['.##.', '#oo#', '#o,#', '#o,#'], px, py - 3);
        ink(px - 1, py + 1, FADE); ink(px, py + 1, INK3); ink(px + 1, py + 1, INK3); ink(px + 2, py + 1, FADE);
      }
      art([
        '.#.....#..',
        '..#.#.#...',
        '#..##.#..#',
        '.#..##..#.',
        '..#.#.##..',
        '...###....',
        '....##....',
        '....##....',
        '....##....',
        '...####...'], 77, 116);
    })();

    /* 2 — the castle of Daventry inside its moat */
    (function () {
      var cx = 94, cy = 92;
      for (y = cy - 10; y <= cy + 10; y++) for (x = cx - 26; x <= cx + 26; x++) {
        var q = pow((x - cx) / 24, 2) + pow((y - cy) / 8.5, 2), qi = pow((x - cx) / 17, 2) + pow((y - cy) / 4.6, 2);
        if (q > 1.0) continue;
        if (qi <= 1.0) { ink(x, y, qi > 0.78 ? INK3 : C.tan[6]); continue; }
        ink(x, y, q > 0.86 ? INK2 : (((x + y * 3) % 7) < 2 && q < 0.8 ? C.mist[3] : (bayer(x, y) < 0.55 ? C.mist[4] : C.mist[5])));
      }
      art([
        '..............#...............',
        '..............#rrr............',
        '..............#rr.............',
        '..............#...............',
        '.............###..............',
        '............#####.............',
        '...#.......#######.......#....',
        '...#rr.....#ooooo#.......#rr..',
        '...#.......#o##oo#.......#....',
        '..###......#o##oo#......###...',
        '.#####.....#ooooo#.....#####..',
        '#######....#oo#oo#....#######.',
        '.#ooo#.#.#.#ooooo#.#.#.#oo,#..',
        '.#o#o###################o#,#..',
        '.#ooo#oooooooooooooooo,#oo,#..',
        '.#ooo#oo#ooo####ooo#oo,#oo,#..',
        '.#o#o#ooooo#:::%#ooooo,#o#,#..',
        '.#ooo#ooooo#:::%#ooooo,#oo,#..',
        '.###########:::%############..'], cx - 15, cy - 17);
      // drawbridge to the south bank
      for (y = cy + 2; y <= cy + 9; y++) { ink(cx - 2, y, INK); ink(cx + 2, y, INK); ink(cx - 1, y, (y & 1) ? C.tan[6] : INK3); ink(cx, y, (y & 1) ? C.tan[6] : INK3); ink(cx + 1, y, (y & 1) ? C.tan[6] : INK3); }
    })();

    /* 3 — the Persian palace over the spike catacombs */
    art([
      '...............#................',
      '..............#.#...............',
      '...............#................',
      '...............#................',
      '..............###...............',
      '.............#ooo#..............',
      '....#.......#ooooo#.......#.....',
      '....#......#oooo,o,#......#.....',
      '...###.....#ooooo,o#.....###....',
      '..#ooo#....#oooo,o,#....#oo,#...',
      '..#oo,#.....#ooo,o#.....#oo,#...',
      '...###...#############...###....',
      '...#o#...#ooooooooooo#...#o#....',
      '...#o#...#o#o#o#o#o#,#...#o#....',
      '...#,#...#ooooooooo,,#...#,#....',
      '...#o#...#oo##ooo##o,#...#o#....',
      '...#o#...#o#rr#o#rr#,#...#o#....',
      '...#o#####o#rr#o#rr#,#####o#....',
      '...#ooooooo#rr#o#rr#ooooooo#....',
      '...#########################....'], 124, 116);
    // the spikes: a saw of iron teeth either side of the gate path
    for (k = 0; k < 2; k++) {
      var sx0 = k ? 147 : 120;
      for (j = 0; j < 4; j++) {
        x = sx0 + j * 4 + 1;
        ink(x, 136, INK); ink(x, 137, INK); ink(x - 1, 138, INK); ink(x, 138, C.tan[7]); ink(x + 1, 138, INK); ink(x - 1, 139, INK); ink(x, 139, FADE2); ink(x + 1, 139, INK);
      }
      for (x = sx0 - 1; x <= sx0 + 16; x++) ink(x, 140, INK);
    }

    /* 4 — the crusher foundry: saw-tooth sheds, smokestack, gears */
    (function () {
      var x0 = 168, y0 = 71;
      art([
        '........................####',
        '........................#oo#',
        '........................####',
        '........................#o,#',
        '........................#o,#',
        '........................####',
        '....#......#......#.....#o,#',
        '...##.....##.....##.....#o,#',
        '..#o#....#o#....#o#.....#o,#',
        '.#oo#...#oo#...#oo#.....####',
        '#ooo#..#ooo#..#ooo#.....#o,#',
        '#ooo#.#oooo#.#oooo#.....#o,#',
        '#ooo##ooooo##ooooo#######o,#',
        '#oooooooooooooooooooooo,#o,#',
        '#o###o###o###o###o###oo,#o,#',
        '#o#,#o#,#o#,#o#,#o#,#oo,#o,#',
        '#o###o###o###o###o###oo,#o,#',
        '#oooooooooooooooooooooo,#o,#',
        '#ooooooooo#####oooooooo,#o,#',
        '#ooooooooo#:::#oooooooo,#o,#',
        '#ooooooooo#:::#oooooooo,#o,#',
        '############################'], x0, y0);
      // smoke curling away north-east
      art([
        '.........##........',
        '........#oo#.##....',
        '.....##.#ooo#oo#...',
        '....#oo##ooooo,#.##',
        '....#oooo#oo,,#.#o#',
        '.....#ooo,###...#,#',
        '..##..#,,#.......#.',
        '.#oo#..##..........',
        '.#o,#..............',
        '..##...............'], x0 + 23, y0 - 11);
      // gears
      art([
        '.....###.....',
        '.##..#o#..##.',
        '.#o###o###o#.',
        '..#ooooooo#..',
        '..#oo###oo#..',
        '###o#,,,#o###',
        '#ooo#,#,#o,,#',
        '###o#,,,#o###',
        '..#oo###o,#..',
        '..#oooooo,#..',
        '.#o###,###,#.',
        '.##..#,#..##.',
        '.....###.....'], x0 + 30, y0 + 8);
      art(['..#.#..', '.#####.', '##o,o##', '.#,#,#.', '##o,,##', '.#####.', '..#.#..'], x0 + 40, y0 + 2);
    })();

    /* 5 — the Phobos bunker: skull over the blast door, beacon mast, craters, a nukage pool */
    (function () {
      var x0 = 220, y0 = 109;
      shape(x0 - 5, y0 + 11, x0 + 6, y0 + 17, function (sx, sy) { return pow((sx - x0) / 5.4, 2) + pow((sy - y0 - 14) / 2.6, 2) <= 1; },
        function (sx, sy) { return ((sx + sy) & 1) ? C.toxic[4] : C.olive[4]; }, INK2);
      art([
        '..........................r.....',
        '..........................#.....',
        '.......#############......#.....',
        '......#ooooooooooooo#....###....',
        '.....#ooo#######oooo,#....#.....',
        '....#ooo##ooooo##oooo,#...#.....',
        '...#oooo#ooooooo#ooooo,#..#.....',
        '..#ooooo#o##o##o#oooooo,#.#.....',
        '.#oooooo#o##o##o#ooooooo,##.....',
        '#ooooooo#ooo#ooo#oooooooo,#.....',
        '#ooooooo##o#o#o##ooooooooo,#....',
        '#oooooooo#######oooooooooo,#....',
        '#ooooooooo#:::#ooooooooooo,#....',
        '#ooooooooo#:::#ooooooooooo,#....',
        '############################....'], x0 + 2, y0);
      art(['.+++.', '+...+', '.+++.'], x0 + 31, y0 + 3); art(['.++.', '+..+', '.++.'], x0 + 33, y0 + 16);
    })();

    /* 6 — the throne of Astaroth-LeChuck-9000 on its volcano */
    (function () {
      var cx = 281, by = 78, ty = 52, hwT = 13, hwB = 26, pl = -1, pr = -1;
      for (y = ty; y <= by; y++) {
        var tt = (y - ty) / (by - ty), hw = hwT + (hwB - hwT) * pow(tt, 1.5);
        var xl = round(cx - hw - (nF(y / 3, 30.5) - 0.5) * 1.8), xr = round(cx + hw + (nF(y / 3, 40.5) - 0.5) * 1.8);
        for (x = xl; x <= xr; x++) {
          var u = (x - xl) / (xr - xl), c = C.tan[7];
          if (u > 0.60 && ((x + y * 2) % 4) === 0) c = INK3;
          else if (u > 0.60) c = ((x + y) & 1) && u > 0.78 ? FADE : FADE2;
          else if (u < 0.34 && ((x * 3 - y * 2 + 90) % 11) === 0 && y > ty + 3) c = FADE;
          ink(x, y, c);
        }
        for (x = min(xl, pl < 0 ? xl : pl); x <= max(xl, pl < 0 ? xl : pl); x++) ink(x, y, INK);
        for (x = min(xr, pr < 0 ? xr : pr); x <= max(xr, pr < 0 ? xr : pr); x++) ink(x, y, INK);
        pl = xl; pr = xr;
      }
      // lava running down from the gate (GLOW slot: it flickers on the map screen)
      var lv = [[cx - 2, -0.55, 4031], [cx, 0.1, 4032], [cx + 3, 0.6, 4033]];
      for (k = 0; k < lv.length; k++) {
        var lx = lv[k][0], end = by - 2 - (k === 1 ? 12 : k * 2);
        for (y = ty; y <= end; y++) {
          lx += lv[k][1] + (GNG.hash2(y, k, lv[k][2]) - 0.5) * 1.5;
          ink(lx, y, y < ty + 13 ? GLOW[(y + k) % 3 + 2] : ((y & 1) ? RED : C.rust[3]));
          if (y < ty + 17) ink(lx + 1, y, (y & 1) ? RED : C.rust[3]);
        }
      }
      art([
        '#.......................#',
        '##.....................##',
        '.##.........#.........##.',
        '.###.......###.......###.',
        '..###.....#####.....###..',
        '..####...#######...####..',
        '..#oo#..#########..#o,#..',
        '..#oo#...#ooooo#...#o,#..',
        '..#oo#..##ooooo##..#o,#..',
        '..#oo####ooooooo####o,#..',
        '..#oo#ooo##ooo##ooo#o,#..',
        '..#oo#oo###ooo###oo#o,#..',
        '..#oo#ooo##ooo##ooo#o,#..',
        '..#oo#oooooo#oooooo#o,#..',
        '..#oo#oo#o#o#o#o#oo#o,#..',
        '..#oo#oo#########oo#o,#..',
        '..#oo##efffFFFfffe##o,#..',
        '..#ooo#effFFFFFffe#oo,#..',
        '.#######################.'], cx - 12, ty - 18);
      // bats wheeling round the towers
      var bats = [[cx - 21, ty - 13], [cx - 26, ty - 6], [cx - 17, ty - 3], [cx + 17, ty - 15], [cx + 21, ty - 7]];
      for (k = 0; k < bats.length; k++) art(k & 1 ? ['#.#', '.#.'] : ['.#.#.', '#.#.#'], bats[k][0], bats[k][1]);
    })();

    /* ================= ornaments ================= */

    /* compass rose */
    (function () {
      function point(a, len, wd) {
        for (var sy = floor(CPY - len); sy <= CPY + len; sy++) for (var sx = floor(CPX - len); sx <= CPX + len; sx++) {
          var ux = sx - CPX, uy = sy - CPY, al = ux * cos(a) + uy * sin(a), ac = -ux * sin(a) + uy * cos(a);
          if (al < 0 || al > len) continue;
          var lim = wd * (1 - al / len);
          if (abs(ac) > lim + 0.2) continue;
          ink(sx, sy, (abs(ac) > lim - 0.75 || al > len - 1.2) ? INK : (ac > 0 ? INK2 : C.tan[7]));
        }
      }
      for (y = -15; y <= 15; y++) for (x = -15; x <= 15; x++) {
        var rr = hyp(x, y);
        if (abs(rr - 12) < 0.55) ink(CPX + x, CPY + y, INK2);
        else if (abs(rr - 10) < 0.5 && ((M.atan2(y, x) * 16 / PI + 32) | 0) & 1) ink(CPX + x, CPY + y, INK3);
        else if (rr < 12) erase(CPX + x, CPY + y);
      }
      for (k = 0; k < 4; k++) point(k * PI / 2 + PI / 4, 9, 2.6);
      for (k = 0; k < 4; k++) point(k * PI / 2, k === 3 ? 18 : 15, 3.4);
      ink(CPX, CPY, INK);
      text('N', CPX - 1, CPY - 25, INK);
    })();

    /* sea serpent, and the customary warning */
    (function () {
      var wy = 154, sx0 = 168, GR = C.zombie[5], GD = C.olive[4];
      LEG.G = GR; LEG.g = GD;
      function hump(hcx, ro, ri) {
        for (var sy = wy - ro - 2; sy <= wy; sy++) for (var sx = hcx - ro - 1; sx <= hcx + ro + 1; sx++) {
          var rr = hyp(sx - hcx, sy - wy);
          if (rr > ro + 0.45 || rr < ri - 0.45) { if (rr > ro + 0.45 && rr < ro + 1.7 && sy < wy - ro * 0.45 && ((sx - hcx + 40) % 3) === 0) ink(sx, sy, INK); continue; }
          ink(sx, sy, (rr > ro - 0.6 || rr < ri + 0.55) ? INK : (rr < ri + 1.6 ? C.tan[7] : (((sx + sy) & 1) ? GD : GR)));
        }
      }
      art([
        '.........#..#.....',
        '........##.##.....',
        '.....########.....',
        '...##GGGGGGGG#....',
        '.##GGG#GGGGGGG#...',
        '#GGGGGGGGGGGGgG#..',
        '#G#w#w#w##GGGgG#..',
        '.#.......#GGGgG#..',
        'r.r......#GGgGG#..',
        '.r.#w#w###GGgG#...',
        '...#GGGGGGGgG#....',
        '....######GgG#....',
        '.........#GgG#....',
        '.........#GgG#....'], sx0, wy - 13);
      hump(sx0 + 27, 7, 3.6); hump(sx0 + 42, 5.5, 2.6);
      art(['......#', '....##.', '#..#G#.', '##.#G#.', '#G##G#.', '.#GGg#.', '..#Gg#.', '..#Gg#.'], sx0 + 49, wy - 7);
      for (x = sx0 + 6; x < sx0 + 60; x++) if (((x * 5) % 7) < 4) ink(x, wy + 1 + ((x >> 1) & 1), C.mist[3]);
      text('HERE BE DRAGONS', sx0, wy + 5, INK2);
    })();
    text('MARE INCOGNITUM', 106, 36, INK3);
    // a treasure islet: one palm and the X that marks the spot
    art(['.##.##.', '#.###.#', '#..#..#', '...#...', '..#....', '..#....'], 206, 39); art(['r.r', '.r.', 'r.r'], 217, 43);


    /* cartouche: skull and floppy disk, the arms of the Cursed PC Gaming Museum */
    (function () {
      var x0 = 260, y0 = 133, w = 46, h = 30;
      for (y = y0; y < y0 + h; y++) for (x = x0; x < x0 + w; x++) {
        var lx = x - x0, ly = y - y0, cr = (lx < 3 || lx >= w - 3) && (ly < 3 || ly >= h - 3);
        var cd = cr ? hyp((lx < 3 ? lx : w - 1 - lx) - 0, (ly < 3 ? ly : h - 1 - ly) - 0) : 9;
        if (cr && cd < 2.6) continue;                                        // scooped corners
        var brd = lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1 || (cr && cd < 3.6);
        var in2 = (lx === 2 || lx === w - 3) && ly > 3 && ly < h - 4 || (ly === 2 || ly === h - 3) && lx > 3 && lx < w - 4;
        ink(x, y, brd ? INK : (in2 ? INK3 : (bayer(x, y) < 0.6 ? C.tan[7] : C.tan[6])));
      }
      art([
        '..#######..',
        '.#ooooooo#.',
        '#ooooooooo#',
        '#o##ooo##o#',
        '#o###o###o#',
        '#o##ooo##o#',
        '#oooo#oooo#',
        '.#ooo#ooo#.',
        '..#ooooo#..',
        '..#o#o#o#..',
        '..#o#o#o#..',
        '...#####...'], x0 + 7, y0 + 5);
      art([
        '##########.',
        '#%#,,,,#%%#',
        '#%#,,#,#%%#',
        '#%#,,#,#%%#',
        '#%######%%#',
        '#%%%%%%%%%#',
        '#%#######%#',
        '#%#wwwww#%#',
        '#%#w++rw#%#',
        '#%#wwwww#%#',
        '###########'], x0 + 28, y0 + 5);
      art(['#.#', '.#.', '#.#'], x0 + 21, y0 + 9);
      text('ANNO MCMXC', x0 + 4, y0 + 20, INK2);
    })();

    /* stage sites: a small ink ring where the game plants its marker */
    for (k = 0; k < nodes.length; k++) {
      for (y = -3; y <= 3; y++) for (x = -3; x <= 3; x++) {
        var nr = hyp(x, y);
        if (nr <= 3.3) ink(nodes[k].x + x, nodes[k].y + y, nr > 2.3 ? INK : (nr < 1.2 ? RED : C.tan[7]));
      }
    }

    var NUM = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    for (k = 0; k < nodes.length; k++) {
      var nw = NUM[k].length * 4 - 1, nx0 = nodes[k].x - (nw >> 1), ny0 = nodes[k].y + 6;
      for (y = ny0 - 2; y <= ny0 + 6; y++) for (x = nx0 - 2; x <= nx0 + nw + 1; x++) erase(x, y);
      text(NUM[k], nx0, ny0, INK2);
    }

    /* ---- the neatline: double rule with a chequered scale between ---- */
    for (x = FX0; x <= FX1; x++) for (y = FY0; y <= FY1; y++) {
      var fd = min(x - FX0, FX1 - x, y - FY0, FY1 - y);
      if (fd > 2 || edge[y * W + x] < 2.5) continue;
      var run = (fd === x - FX0 || fd === FX1 - x) ? y : x;
      d[y * W + x] = fd === 0 ? INK2 : (fd === 2 ? INK3 : (((run / 6) | 0) & 1 ? INK2 : base[y * W + x]));
    }

    /* scorch marks eat whatever ink is near the edge */
    for (i = 0; i < N; i++) if (edge[i] >= 0 && edge[i] < 2.2) d[i] = base[i];
    // `path` / `pathStops` are optional extras: the drawn road as a polyline (72 samples per leg) and
    // the sample index of each node, for walking Arthur's icon along the dots instead of a straight line.
    return {
      bmp: b,
      nodes: nodes.map(function (n) { return { x: n.x, y: n.y }; }),
      path: road.map(function (q) { return { x: round(q[0]), y: round(q[1]) }; }),
      pathStops: nodes.map(function (n, q) { return q * 72; })
    };
  }

  GNG.Backdrops.registerMap(buildMap);

})();
