/* BEAT TRIBE - software renderer.
 * Everything is plotted into a 320x200 Uint32Array framebuffer (ImageData view):
 * procedural parallax backgrounds, the destructible terrain with beat pulse /
 * note-block flashes / Silence desaturation, objects, lemmings and the panel.
 * No canvas drawing API is used, so the very same code renders PNGs under Node. */
(function (g) {
  'use strict';
  var BT = g.BT, hex = BT.hex, mix = BT.mix, hash = BT.hash, noise = BT.noise, clamp = BT.clamp;
  var S = BT.ST, Font = BT.Font, SP = BT.Sprites, WHITE = BT.WHITE, BLACK = BT.BLACK;
  var fb = null, FW = 320, FH = 200;
  var R = BT.Render = {};

  R.target = function (buf, w, h) { fb = buf; FW = w; FH = h; R.fb = buf; R.W = w; R.H = h; };

  // ------------------------------------------------------------ primitives
  R.clear = function (c) { fb.fill(c); };
  R.px = function (x, y, c) { if (x >= 0 && x < FW && y >= 0 && y < FH) fb[y * FW + x] = c; };
  R.rect = function (x, y, w, h, c) {
    var x1 = Math.min(FW, x + w), y1 = Math.min(FH, y + h), yy;
    if (x < 0) x = 0; if (y < 0) y = 0;
    if (x1 <= x) return;
    for (yy = y; yy < y1; yy++) fb.fill(c, yy * FW + x, yy * FW + x1);
  };
  R.frame = function (x, y, w, h, c) { R.rect(x, y, w, 1, c); R.rect(x, y + h - 1, w, 1, c); R.rect(x, y, 1, h, c); R.rect(x + w - 1, y, 1, h, c); };
  R.shade = function (x, y, w, h, c, t) {                    // blend a rectangle towards colour c
    var x1 = Math.min(FW, x + w), y1 = Math.min(FH, y + h), xx, yy, i;
    if (x < 0) x = 0; if (y < 0) y = 0;
    for (yy = y; yy < y1; yy++) for (xx = x, i = yy * FW + x; xx < x1; xx++, i++) fb[i] = mix(fb[i], c, t);
  };
  R.bevel = function (x, y, w, h, face, hi, lo) {
    R.rect(x, y, w, h, face); R.rect(x, y, w, 1, hi); R.rect(x, y, 1, h, hi); R.rect(x, y + h - 1, w, 1, lo); R.rect(x + w - 1, y, 1, h, lo);
  };
  R.text = function (s, x, y, c, sh) {
    var i, gl, r, k, px, py;
    s = String(s);
    for (i = 0; i < s.length; i++, x += 6) {
      gl = Font.glyph(s.charAt(i)); if (!gl) continue;
      for (r = 0; r < 7; r++) for (k = 0; k < 5; k++) if (gl[r * 5 + k]) {
        px = x + k; py = y + r;
        if (sh !== undefined && px + 1 < FW && py + 1 < FH && px + 1 >= 0 && py + 1 >= 0) fb[(py + 1) * FW + px + 1] = sh;
      }
      for (r = 0; r < 7; r++) for (k = 0; k < 5; k++) if (gl[r * 5 + k]) {
        px = x + k; py = y + r;
        if (px >= 0 && px < FW && py >= 0 && py < FH) fb[py * FW + px] = c;
      }
    }
  };
  R.textC = function (s, cx, y, c, sh) { R.text(s, Math.round(cx - Font.width(String(s)) / 2), y, c, sh); };
  R.textR = function (s, rx, y, c, sh) { R.text(s, rx - Font.width(String(s)), y, c, sh); };
  // Scaled text; col may be a function(row, charIndex) for gradients.
  R.big = function (s, x, y, sc, col, sh) {
    var i, gl, r, k, c;
    for (i = 0; i < s.length; i++, x += 6 * sc) {
      gl = Font.glyph(s.charAt(i)); if (!gl) continue;
      if (sh !== undefined) for (r = 0; r < 7; r++) for (k = 0; k < 5; k++) if (gl[r * 5 + k]) R.rect(x + k * sc + sc, y + r * sc + sc, sc, sc, sh);
      for (r = 0; r < 7; r++) for (k = 0; k < 5; k++) if (gl[r * 5 + k]) {
        c = typeof col === 'function' ? col(r, i) : col;
        R.rect(x + k * sc, y + r * sc, sc, sc, c);
        if (sc > 2) R.rect(x + k * sc, y + r * sc, sc, 1, mix(c, WHITE, 0.45));
      }
    }
  };
  R.cell = function (cell, x, y, pal) {
    var cx, cy, v, px, py;
    for (cy = 0; cy < 16; cy++) {
      py = y + cy; if (py < 0 || py >= FH) continue;
      for (cx = 0; cx < 16; cx++) {
        v = cell[cy * 16 + cx]; if (!v) continue;
        px = x + cx; if (px < 0 || px >= FW) continue;
        fb[py * FW + px] = pal[v];
      }
    }
  };

  // ------------------------------------------------------------ parallax backgrounds (512x160, generated once)
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var BW = 512, TAU = Math.PI * 2;
  function grad(b, stops) {
    var x, y, i, t, c0, c1, q;
    for (y = 0; y < 160; y++) {
      i = 0; while (i < stops.length - 2 && y >= stops[i + 1][0]) i++;
      t = clamp((y - stops[i][0]) / (stops[i + 1][0] - stops[i][0]), 0, 1);
      c0 = hex(stops[i][1]); c1 = hex(stops[i + 1][1]);
      for (x = 0; x < BW; x++) {
        q = Math.floor(t * 7 + BAYER[(y & 3) * 4 + (x & 3)] / 16) / 7;
        b[y * BW + x] = mix(c0, c1, clamp(q, 0, 1));
      }
    }
  }
  function per(x, k, ph) { return Math.sin(x / BW * TAU * k + (ph || 0)); }
  function disc(b, cx, cy, r, fn) {
    var x, y, dx, dy, c;
    for (y = cy - r; y <= cy + r; y++) for (x = cx - r; x <= cx + r; x++) {
      dx = x - cx; dy = y - cy;
      if (dx * dx + dy * dy <= r * r && y >= 0 && y < 160) { c = fn(x, y, Math.sqrt(dx * dx + dy * dy) / r); if (c !== undefined) b[y * BW + ((x % BW) + BW) % BW] = c; }
    }
  }
  function stars(b, maxY, col, seed) {
    for (var y = 0; y < maxY; y++) for (var x = 0; x < BW; x++) if (hash(x, y, seed) > 0.9975) b[y * BW + x] = mix(hex(col), BLACK, hash(x, y, seed + 1) * 0.6);
  }
  function hills(b, base, amp, k1, k2, ph, col, tree) {
    var x, y, top, c = hex(col), tx, th;
    for (x = 0; x < BW; x++) {
      top = Math.round(base + amp * per(x, k1, ph) + amp * 0.45 * per(x, k2, ph * 2.3));
      if (tree) { tx = x % 37; th = hash((x / 37) | 0, 3, tree) > 0.45 ? 9 + ((hash((x / 37) | 0, 5, tree) * 8) | 0) : 0; if (th && tx < 9) top -= Math.max(0, th - Math.abs(tx - 4) * (th / 4.5)) | 0; }
      for (y = Math.max(0, top); y < 160; y++) b[y * BW + x] = c;
    }
  }
  var BG = {
    meadow: function (b) {
      grad(b, [[0, 0x1a1238], [70, 0x4a2850], [125, 0x8c4c58], [160, 0x9c6058]]);
      stars(b, 50, 0xd8c8e8, 3);
      disc(b, 128, 112, 20, function (x, y, d) { return hex(d < 0.75 ? 0xffd890 : 0xf8a868); });
      hills(b, 112, 12, 2, 5, 0.4, 0x3c2240, 7);
      hills(b, 134, 9, 3, 7, 1.7, 0x2a1830, 0);
    },
    garden: function (b) {
      grad(b, [[0, 0x051826], [80, 0x0c3c44], [160, 0x18584c]]);
      stars(b, 64, 0xb0e8d8, 5);
      disc(b, 400, 30, 12, function (x, y, d) { return hex(hash(x >> 1, y >> 1, 9) > 0.8 ? 0xb8c8a0 : 0xe8f0c8); });
      for (var i = 0; i < 6; i++) disc(b, (i * 97 + 40) % BW, 44 + (i * 13) % 26, 9 + (i % 3) * 4, function (x, y, d) { return ((x + y) & 1) && d < 0.9 ? hex(0x14504e) : undefined; });
      hills(b, 104, 13, 2, 5, 0.9, 0x0c3836, 11);
      hills(b, 130, 9, 3, 8, 2.1, 0x082826, 0);
    },
    acid: function (b) {
      var x, y, n;
      grad(b, [[0, 0x06060a], [160, 0x0e0f18]]);
      for (y = 0; y < 160; y++) for (x = 0; x < BW; x++) {
        n = noise(x, y, 38, 71) * 0.6 + noise(x + (y >> 1), y, 13, 72) * 0.4;
        if (n > 0.6 && ((x + y) & 1)) b[y * BW + x] = hex(0x161928);
        if (x % 128 < 7) b[y * BW + x] = hex(x % 128 === 0 || x % 128 === 6 ? 0x1c2030 : (y % 12 === 3 && x % 128 === 3) ? 0x2c3248 : 0x12141e);
        if ((y >= 26 && y < 32) || (y >= 100 && y < 106)) b[y * BW + x] = hex(y === 26 || y === 100 ? 0x20243a : (x % 16 === 8 && (y === 29 || y === 103)) ? 0x2c3248 : 0x121420);
        if (y > 32 && y < 100 && Math.abs(((x % 128) - 7) * 68 / 121 - (y - 32)) < 1.2 && x % 128 > 7) b[y * BW + x] = hex(0x10121c);
        if (y >= 152) b[y * BW + x] = hex(((x + y) >> 3) & 1 ? 0x2c2a0c : 0x0c0c10);
      }
      [[60, 52, 0x80206c], [230, 64, 0x1c6c74], [390, 48, 0x70681c]].forEach(function (s) {
        for (y = -7; y <= 7; y++) for (x = -16; x <= 16; x++) {
          var edge = Math.abs(x) === 16 || Math.abs(y) === 7, c = hex(s[2]);
          b[(s[1] + y) * BW + s[0] + x] = edge ? c : mix(b[(s[1] + y) * BW + s[0] + x], c, ((x + y) & 1) ? 0.22 : 0.1);
        }
      });
    },
    sunset: function (b) {
      var x, y, k, d, c, m = hex(0x8c2078);
      grad(b, [[0, 0x0a0420], [48, 0x2a0a46], [92, 0x6a1858], [112, 0xa83460]]);
      stars(b, 56, 0xf0d0ff, 13);
      disc(b, 256, 98, 46, function (xx, yy) {
        var gap = yy - 82;
        if (yy >= 112) return undefined;
        if (gap > 0 && (gap % 8) < gap / 7) return undefined;
        return mix(hex(0xffe868), hex(0xff3c88), clamp((yy - 52) / 60, 0, 1));
      });
      for (x = 0; x < BW; x++) {                                    // distant mountains
        k = 112 - Math.max(0, 16 - Math.abs(((x + 90) % 256) - 60) * 0.4) - Math.max(0, 11 - Math.abs(((x + 200) % 256) - 30) * 0.55);
        if (Math.abs(x - 256) > 56) for (y = Math.round(k); y < 112; y++) b[y * BW + x] = hex(0x1c0838);
      }
      for (y = 112; y < 160; y++) for (x = 0; x < BW; x++) {      // perspective grid
        d = (y - 111) / 48; c = hex(0x100620);
        k = (x - 256) / (d * 2.4 + 0.35);
        if (Math.abs(k / 26 - Math.round(k / 26)) * 26 * (d * 2.4 + 0.35) < 0.6) c = m;
        if (y === 112 || y === 114 || y === 117 || y === 122 || y === 129 || y === 138 || y === 149) c = y < 118 ? hex(0xd848a0) : m;
        b[y * BW + x] = c;
      }
    },
    cave: function (b) {
      var x, y, i, top, bot, cx, cy;
      grad(b, [[0, 0x03060a], [160, 0x0a1a22]]);
      for (x = 0; x < BW; x++) {
        top = Math.round(20 + 14 * per(x, 3, 1) + 10 * per(x, 11, 2) + 6 * Math.abs(per(x, 23, 0.5)));
        bot = Math.round(138 - 10 * per(x, 4, 2.2) - 8 * Math.abs(per(x, 17, 1.1)));
        for (y = 0; y < top; y++) b[y * BW + x] = hex(((x + y) & 3) === 0 ? 0x0e242c : 0x0a1c24);
        for (y = bot; y < 160; y++) b[y * BW + x] = hex(((x + y * 2) & 3) === 0 ? 0x0c2028 : 0x08181e);
      }
      for (i = 0; i < 18; i++) {                                    // glowing mushrooms & crystals
        cx = (i * 61 + 23) % BW; cy = Math.round(136 - 10 * per(cx, 4, 2.2) - 8 * Math.abs(per(cx, 17, 1.1)));
        if (i % 3 === 2) { for (y = 0; y < 9; y++) for (x = -(y >> 1); x <= (y >> 1); x++) b[(cy - 9 + y) * BW + (cx + x + BW) % BW] = hex(x < 0 ? 0x7040b0 : 0x48287c); continue; }
        disc(b, cx, cy - 4, 8, function (xx, yy, d) { return ((xx + yy) & 1) ? hex(0x0e3c3a) : undefined; });
        for (x = -3; x <= 3; x++) { b[(cy - 5) * BW + (cx + x + BW) % BW] = hex(0x38d8b8); if (Math.abs(x) < 3) b[(cy - 6) * BW + (cx + x + BW) % BW] = hex(0x80f8e0); }
        for (y = -4; y < 0; y++) b[(cy + y) * BW + cx] = hex(0x1c6c64);
      }
      for (y = 30; y < 130; y++) for (x = 0; x < BW; x++) if (hash(x, y, 91) > 0.9985) b[y * BW + x] = hex(0x2c8c8c);
    },
    hall: function (b) {
      var x, y, bx, a, cx;
      grad(b, [[0, 0x0e0816], [160, 0x24121e]]);
      for (y = 0; y < 160; y++) for (x = 0; x < BW; x++) {
        bx = x % 128;
        a = 44 - Math.sqrt(Math.max(0, 59 * 59 - (bx - 69) * (bx - 69))) * 0.62;      // arch between columns
        if (bx >= 10 && y < a) b[y * BW + x] = hex(0x1a1224);
        if (bx >= 22 && bx < 116 && y >= a && y < 62 + 6 * Math.sin(bx * 0.4)) b[y * BW + x] = hex(bx % 8 < 2 ? 0x2a0810 : bx % 8 < 5 ? 0x3c0e1a : 0x4a1220);
        if (bx < 10) b[y * BW + x] = hex(y % 40 === 0 ? 0x3c3048 : bx === 0 || bx === 9 ? 0x201828 : bx % 3 === 1 ? 0x362c42 : 0x2a2034);
        if (y >= 150) b[y * BW + x] = hex(((x >> 4) + (y >> 2)) & 1 ? 0x2c2030 : 0x241a28);
      }
      for (cx = 69; cx < BW; cx += 128) {
        disc(b, cx, 84, 15, function (xx, yy, d) { return ((xx + yy) & 1) && d > 0.25 ? hex(0x4c3c18) : undefined; });
        for (x = -4; x <= 4; x += 2) { b[84 * BW + cx + x] = hex(0xffe890); b[83 * BW + cx + x] = hex(0xf8c040); }
        for (y = 62; y < 82; y++) b[y * BW + cx] = hex(0x5c4c20);
      }
    }
  };
  var bgCache = {};
  function bgFor(world) {
    var b = bgCache[world.key];
    if (!b) { b = bgCache[world.key] = new Uint32Array(BW * 160); BG[world.key](b); }
    return b;
  }
  R.bgFor = bgFor;

  // ------------------------------------------------------------ objects
  var WOOD = hex(0x8c5c2c), WOODD = hex(0x5c3818);
  function drawHatch(h, cam, f, world) {
    var x = h.x - cam, y = h.y, open = clamp((f - 40) / 45, 0, 1), ac = hex(world.accent), dk = mix(ac, BLACK, 0.6), w, i;
    if (x < -20 || x > FW + 20) return;
    R.rect(x - 15, y - 2, 31, 4, dk); R.rect(x - 15, y - 2, 31, 1, ac); R.rect(x - 15, y + 1, 31, 1, mix(dk, BLACK, 0.4));
    R.rect(x - 15, y + 2, 3, 7, dk); R.rect(x + 13, y + 2, 3, 7, dk);
    for (i = -12; i <= 12; i += 6) R.px(x + i, y, ac);
    w = Math.round(12 * (1 - open));
    if (w > 0) { R.rect(x - 12, y + 2, w, 3, WOOD); R.rect(x + 13 - w, y + 2, w, 3, WOOD); R.rect(x - 12, y + 4, w, 1, WOODD); R.rect(x + 13 - w, y + 4, w, 1, WOODD); }
    else { R.rect(x - 12, y + 2, 2, 9, WOOD); R.rect(x + 11, y + 2, 2, 9, WOOD); R.px(x - 11, y + 10, WOODD); R.px(x + 11, y + 10, WOODD); }
  }
  function drawExit(e, cam, f, sim) {
    var x = e.x - cam, y = e.y, ac = hex(sim.world.accent), bp = (f % sim.bf) / sim.bf, pulse = Math.max(0, 1 - bp * 2), iy, ix, t, k;
    if (x < -20 || x > FW + 20) return;
    var stone = mix(ac, hex(0x404050), 0.75), dark = mix(stone, BLACK, 0.45), lite = mix(stone, WHITE, 0.35);
    for (iy = y - 12; iy <= y; iy++) for (ix = x - 5; ix <= x + 5; ix++) {
      t = (iy - (y - 12)) / 12; k = 0.12 + (0.35 + 0.4 * pulse) * t * (1 - Math.abs(ix - x) / 9);
      R.px(ix, iy, mix(hex(0x06060c), ac, k));
    }
    R.rect(x - 8, y - 13, 3, 14, stone); R.rect(x + 6, y - 13, 3, 14, stone);
    R.rect(x - 8, y - 13, 1, 14, lite); R.rect(x + 8, y - 13, 1, 14, dark);
    R.rect(x - 9, y - 16, 19, 3, stone); R.rect(x - 9, y - 16, 19, 1, lite); R.rect(x - 9, y - 14, 19, 1, dark);
    R.rect(x - 2, y - 15, 5, 1, ac);
    for (k = -1; k <= 1; k += 2) {                                         // torches
      ix = x + k * 8; t = (hash(k, f >> 2, 31) * 3) | 0;
      R.px(ix, y - 17, hex(0xf06018)); R.px(ix, y - 18, hex(0xffa020)); R.px(ix + (t - 1), y - 19, hex(0xffe060));
      if (t) R.px(ix, y - 20, hex(0xffe060));
    }
  }
  function drawFire(z, cam, f) {
    var x = z.x - cam, y = z.y, dx, hgt, k, c;
    if (x < -12 || x > FW + 12) return;
    R.rect(x - 7, y + 1, 15, 2, hex(0x282830)); R.rect(x - 7, y + 1, 15, 1, hex(0x585868));
    for (dx = -5; dx <= 5; dx++) {
      hgt = 4 + ((hash(dx, f >> 2, 77) * 9) | 0) - Math.abs(dx);
      for (k = 0; k < hgt; k++) { c = k < hgt * 0.35 ? 0xfff090 : k < hgt * 0.7 ? 0xffa020 : 0xe03818; R.px(x + dx, y - k, hex(c)); }
    }
  }
  function drawCrusher(c, cam, world) {
    var x = c.x - cam, t = c.t || 0, per = c.per || 1, pos, yb, i;
    if (x < -12 || x > FW + 12) return;
    pos = t < 10 ? 1 : t < 40 ? 1 - (t - 10) / 30 : t > per - 5 ? (t - (per - 5)) / 5 : 0;
    yb = Math.round(c.y0 + 9 + (c.y1 - (c.y0 + 9)) * pos);                 // bottom row of the stomper
    var st = hex(0x9098a8), dk = hex(0x404858), hi = hex(0xe0e8f0);
    R.rect(x - 9, c.y0 - 3, 19, 3, dk); R.rect(x - 9, c.y0 - 3, 19, 1, st);
    for (i = c.y0; i < yb - 8; i++) { R.px(x - 1, i, (i & 1) ? st : dk); R.px(x + 1, i, (i & 1) ? dk : st); }
    R.rect(x - 7, yb - 8, 15, 7, st); R.rect(x - 7, yb - 8, 15, 1, hi); R.rect(x - 7, yb - 2, 15, 1, dk);
    R.rect(x - 5, yb - 6, 11, 2, hex(0xf8d020)); for (i = -5; i <= 5; i += 4) R.rect(x + i, yb - 6, 2, 2, hex(0x202020));
    for (i = -7; i <= 7; i++) R.px(x + i, yb - 1 + ((i + 8) & 1), hi);
  }
  function drawLiquids(sim, cam, f, VW) {
    var L = sim.objs.liquids, i, z, sx, lx, y, top, d, c, wat;
    for (i = 0; i < L.length; i++) {
      z = L[i]; wat = z.kind === 'water';
      var hi = hex(wat ? 0xb0e0ff : 0xfff0a0), c1 = hex(wat ? 0x2c70e0 : 0xf06810), c2 = hex(wat ? 0x103078 : 0x801008), spk = hex(wat ? 0x60a8f8 : 0xffc040);
      for (sx = Math.max(0, z.x0 - cam); sx < Math.min(VW, z.x1 - cam); sx++) {
        lx = sx + cam;
        top = z.y + ((Math.sin(lx * 0.37 + f * 0.09) + Math.sin(lx * 0.13 - f * 0.05)) > 0.35 ? 1 : 0);
        for (y = top; y < 160; y++) {
          d = y - top;
          c = d === 0 ? hi : hash(lx >> 1, (y + (wat ? 0 : (f >> 4))) >> 1, 3 + (f >> 4) % 5) > (wat ? 0.93 : 0.88) ? spk : mix(c1, c2, Math.min(1, d / 13));
          fb[y * FW + sx] = c;
        }
      }
    }
  }

  // ------------------------------------------------------------ lemmings
  function lemCell(l, sim) {
    var A = l.dir > 0 ? SP.R : SP.L, f = sim.frame, bp = (f % sim.bf) / sim.bf, t = l.t;
    switch (l.st) {
      case S.WALK: return A.walk[l.slow ? ((f >> 3) + l.i * 3) & 7 : (bp * 8) & 7];     // steps locked to the beat
      case S.FALL: return A.fall[(f >> 2) & 3];
      case S.FLOAT: return A.float[(f >> 4) & 3];
      case S.CLIMB: return A.climb[t & 7];
      case S.HOIST: return A.hoist[Math.min(3, t)];
      case S.BUILD: return A.build[((t % 12) * 8 / 12) | 0];
      case S.SHRUG: return A.shrug[(t >> 1) & 3];
      case S.BASH: return A.bash[(t + 7) % 8];
      case S.MINE: return A.mine[((((t + 5) % 6) * 8 / 6) | 0)];
      case S.DIG: return A.dig[((((t + 3) % 4) * 2) + ((f >> 3) & 1)) & 7];
      case S.BLOCK: return A.block[(bp * 4) & 3];
      case S.OHNO: return A.ohno[(f >> 2) & 3];
      case S.SPLAT: return A.splat[Math.min(5, (t * 6 / 16) | 0)];
      case S.DROWN: return A.drown[Math.min(7, t >> 1)];
      case S.BURN: return A.burn[Math.min(7, t >> 1)];
      case S.EXIT: return A.exit[Math.min(7, (t * 8 / 14) | 0)];
    }
    return null;
  }
  R.lemCell = lemCell;

  // ------------------------------------------------------------ the playfield
  var colAdd = new Uint8Array(4096);
  R.playfield = function (sim, cam, o) {
    var T = sim.T, world = sim.world, f = sim.frame, VW = FW, tw = T.w, x, y, i, ti, fi, c, a, r, gg, b, m;
    var mat = T.mat, col = T.col, glow = T.glow, deco = T.deco, bg = bgFor(world), p0 = Math.floor(cam * 0.35);
    o = o || {};
    for (y = 0; y < 160; y++) for (x = 0, fi = y * FW, ti = y * BW; x < VW; x++) fb[fi + x] = bg[ti + ((p0 + x) & 511)];
    drawLiquids(sim, cam, f, VW);

    // terrain: subtle pulse on every beat, bright flash on triggered note blocks
    var bp = (f % sim.bf) / sim.bf, pulse = bp < 0.35 ? (1 - bp / 0.35) : 0;
    pulse = pulse * pulse * 30;
    for (x = 0; x < VW; x++) { i = (cam + x) >> 4; colAdd[x] = Math.min(255, pulse + (i < sim.nb ? sim.flash[i] * 110 : 0)); }
    for (y = 0; y < 160; y++) {
      ti = y * tw + cam; fi = y * FW;
      for (x = 0; x < VW && cam + x < tw; x++, ti++, fi++) {
        m = mat[ti];
        if (!m) { if (deco[ti]) fb[fi] = deco[ti]; continue; }
        c = col[ti]; a = (colAdd[x] * glow[ti]) >> 8;
        if (a) {
          r = (c & 255) + a; gg = ((c >> 8) & 255) + a; b = ((c >> 16) & 255) + a;
          c = (0xff000000 | ((b > 255 ? 255 : b) << 16) | ((gg > 255 ? 255 : gg) << 8) | (r > 255 ? 255 : r)) >>> 0;
        }
        fb[fi] = c;
      }
    }

    var ob = sim.objs;
    drawExit(ob.exit, cam, f, sim);
    for (i = 0; i < ob.fires.length; i++) drawFire(ob.fires[i], cam, f);
    for (i = 0; i < ob.crushers.length; i++) drawCrusher(ob.crushers[i], cam, world);
    drawHatch(ob.hatch, cam, f, world);

    // lemmings
    var L = sim.lems, l, cellp, sx, pal, hasSil = sim.silSrc.length > 0, s;
    for (i = 0; i < L.length; i++) {
      l = L[i]; if (l.st === S.GONE) continue;
      sx = l.x - cam; if (sx < -10 || sx > VW + 10) continue;
      s = hasSil ? sim.sil[clamp(l.x >> 4, 0, sim.nb - 1)] : 0;
      l.slow = s > 0.5;
      cellp = lemCell(l, sim); if (!cellp) continue;
      pal = l === o.hover ? SP.PAL_HOT : (s > 0.5 || l.panic) ? SP.PAL_GREY : SP.PAL;
      R.cell(cellp, sx - 7 + (l.panic && (f & 4) ? 1 : 0), l.y - 15, pal);
      if (l.fuse > 0) R.text(String(Math.ceil(l.fuse / 60)), sx - 2, l.y - 19 - (l.st === S.FLOAT ? 6 : 0), WHITE, BLACK);
      if (l.panic && (f & 8)) R.text('?', sx - 2, l.y - 19, hex(0xd0d0d8));
    }

    // particles (owned by the game layer; purely cosmetic)
    var ps = o.parts, p;
    if (ps) for (i = 0; i < ps.length; i++) { p = ps[i]; R.px((p.x - cam) | 0, p.y | 0, p.c); if (p.big) R.px(((p.x - cam) | 0) + 1, p.y | 0, p.c); }

    // the Silence: drain the colour, add drifting grey static
    if (hasSil) {
      var sil = sim.sil, nb = sim.nb, fbk, b0, k, lum, st = hex(0xa8a8b0);
      for (x = 0; x < VW; x++) {
        fbk = (cam + x - 8) / 16; b0 = Math.floor(fbk);
        s = sil[clamp(b0, 0, nb - 1)]; s += (sil[clamp(b0 + 1, 0, nb - 1)] - s) * (fbk - b0);
        if (s < 0.03) continue;
        k = (s * 235) | 0;
        for (y = 0, fi = x; y < 160; y++, fi += FW) {
          c = fb[fi]; r = c & 255; gg = (c >> 8) & 255; b = (c >> 16) & 255;
          lum = ((r * 77 + gg * 150 + b * 29) >> 8) * 3 + 0x58 >> 2;
          r += ((lum - r) * k) >> 8; gg += ((lum - gg) * k) >> 8; b += ((lum - b) * k) >> 8;
          fb[fi] = hash(cam + x, y, f >> 2) < s * 0.05 ? st : (0xff000000 | (b << 16) | (gg << 8) | r) >>> 0;
        }
      }
    }
  };

  // ------------------------------------------------------------ bottom panel
  var LAY = R.LAY = { BW: 16, BY: 170, BH: 30, N: 13, MAP: { x: 212, y: 171, w: 106, h: 18 }, AN: { x: 212, y: 191, w: 106, h: 8 } };
  R.buttonAt = function (x, y) { if (y < LAY.BY || y >= LAY.BY + LAY.BH || x < 0 || x >= LAY.N * LAY.BW) return -1; return (x / LAY.BW) | 0; };
  R.inMap = function (x, y) { var m = LAY.MAP; return x >= m.x && x < m.x + m.w && y >= m.y - 1 && y < m.y + m.h + 1; };
  var ICON = null;
  function icons() {
    if (!ICON) ICON = [SP.R.climb[0], SP.R.float[0], SP.R.ohno[1], SP.R.block[2], SP.R.build[0], SP.R.bash[0], SP.R.mine[2], SP.R.dig[2]];
    return ICON;
  }
  var mm = { ver: -1, T: null, buf: new Uint32Array(106 * 18) };
  function minimap(sim, cam, f) {
    var M = LAY.MAP, T = sim.T, x, y, lx, ly, i, n, c, sx, sy, L = sim.objs.liquids, k;
    if (mm.T !== T || (mm.ver !== T.ver && f % 6 === 0)) {
      mm.T = T; mm.ver = T.ver;
      for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) {
        lx = (x * T.w / M.w) | 0; ly = (y * 160 / M.h) | 0; n = 0; c = 0;
        for (sy = 0; sy < 9; sy += 4) for (sx = 0; sx < (T.w / M.w); sx += 3) { i = (ly + sy) * T.w + lx + (sx | 0); if (T.mat[i]) { n++; c = T.col[i]; } }
        k = 0;
        if (!n) for (i = 0; i < L.length; i++) if (lx >= L[i].x0 && lx < L[i].x1 && ly + 4 >= L[i].y) k = hex(L[i].kind === 'water' ? 0x2050b0 : 0xc04010);
        mm.buf[y * M.w + x] = n ? mix(c, BLACK, n > 1 ? 0.15 : 0.45) : k ? k : hex(0x08080e);
      }
    }
    for (y = 0; y < M.h; y++) for (x = 0; x < M.w; x++) fb[(M.y + y) * FW + M.x + x] = mm.buf[y * M.w + x];
    var e = sim.objs.exit, h = sim.objs.hatch, blink = (f >> 3) & 1;
    R.rect(M.x + ((e.x * M.w / T.w) | 0) - 1, M.y + ((e.y * M.h / 160) | 0) - 1, 2, 2, blink ? hex(0xffff60) : hex(0xc08020));
    R.rect(M.x + ((h.x * M.w / T.w) | 0) - 1, M.y + ((h.y * M.h / 160) | 0), 3, 1, WHITE);
    for (i = 0; i < sim.lems.length; i++) {
      var l = sim.lems[i]; if (l.st === S.GONE) continue;
      R.px(M.x + ((l.x * M.w / T.w) | 0), M.y + clamp(((l.y - 4) * M.h / 160) | 0, 0, M.h - 1), l.st === S.BLOCK ? hex(0xff6060) : hex(0x60ff60));
    }
    if (sim.silSrc.length) for (x = 0; x < M.w; x++) { k = sim.sil[clamp(((x * T.w / M.w) | 0) >> 4, 0, sim.nb - 1)]; if (k > 0.3) for (y = (x & 1); y < M.h; y += 2) fb[(M.y + y) * FW + M.x + x] = mix(fb[(M.y + y) * FW + M.x + x], hex(0x9c9ca4), k * 0.7); }
    R.frame(M.x + ((cam * M.w / T.w) | 0), M.y - 1, Math.max(4, Math.round(FW * M.w / T.w)), M.h + 2, WHITE);
  }
  function analyser(an, world, f, bp) {
    var A = LAY.AN, x, v, h, ac = hex(world ? world.accent : 0x60e890), y, i, n;
    R.rect(A.x, A.y, A.w, A.h, hex(0x06060c));
    if (an && an.freq) {
      n = an.freq.length;
      for (x = 0; x < A.w; x += 2) {
        i = Math.min(n - 1, Math.floor(Math.pow(x / A.w, 1.7) * n * 0.6) + 1);
        v = an.freq[i] / 255; h = Math.round(v * A.h);
        for (y = 0; y < h; y++) R.px(A.x + x, A.y + A.h - 1 - y, mix(ac, hex(0xff4060), y / A.h));
      }
      if (an.wave) for (x = 0; x < A.w; x++) {
        v = (an.wave[Math.floor(x * an.wave.length / A.w)] - 128) / 128;
        R.px(A.x + x, A.y + clamp(Math.round(A.h / 2 - v * A.h), 0, A.h - 1), WHITE);
      }
    } else {
      for (x = 0; x < A.w; x += 2) { h = 1 + Math.round(Math.max(0, 1 - bp * 3) * 3 * hash(x, 0, 5)); for (y = 0; y < h; y++) R.px(A.x + x, A.y + A.h - 1 - y, mix(ac, BLACK, 0.5)); }
    }
  }
  function nukeIcon(x, y, hot) {
    var w = hot ? hex(0xffffff) : hex(0xe8e8e8), o = hex(0xff9020), rr = hex(0xe83020);
    R.rect(x + 4, y, 7, 1, w); R.rect(x + 2, y + 1, 11, 1, w); R.rect(x + 1, y + 2, 13, 2, o); R.rect(x + 2, y + 4, 11, 1, rr);
    R.rect(x + 4, y + 2, 3, 1, w); R.rect(x + 6, y + 5, 3, 5, o); R.rect(x + 7, y + 5, 1, 5, w);
    R.rect(x + 4, y + 10, 7, 1, rr); R.rect(x + 2, y + 11, 11, 1, o); R.rect(x + 5, y + 7, 5, 1, rr);
  }
  /* ui: { skill, paused, ff, nukeArm, hover, hoverN, cam, an, pressed, demo } */
  R.panel = function (sim, ui) {
    var world = sim.world, f = sim.frame, ac = hex(world.accent), i, x, sel, k, cnt, face, bp = (f % sim.bf) / sim.bf;
    var bgc = hex(0x181828), hi = hex(0x70709c), lo = hex(0x08080e), txt = hex(0xd8d8f0), dim = hex(0x70708c);
    R.rect(0, 160, FW, 40, bgc); R.rect(0, 160, FW, 1, hi);
    // status line
    var hv = ui.hover, name = '';
    if (hv) {
      name = BT.ST_NAMES[hv.st];
      if (hv.st === S.WALK || hv.st === S.FALL) name = hv.climber && hv.floater ? 'ATHLETE' : hv.climber ? 'CLIMBER' : hv.floater ? 'FLOATER' : name;
      if (hv.panic) name = 'PANIC!';
      if (ui.hoverN > 1) name += ' ' + ui.hoverN;
    } else if (ui.demo) name = (f >> 5) & 1 ? 'DEMO' : '';
    R.text(name, 2, 162, ac);
    R.text('OUT ' + sim.active(), 68, 162, txt);
    R.text('IN ' + Math.floor(sim.saved * 100 / sim.num) + '%', 110, 162, sim.saved * 100 >= sim.level.need * sim.num ? hex(0x60ff60) : txt);
    var left = Math.max(0, Math.ceil((sim.timeFrames - f) / 60)), ss = left % 60;
    R.text('TIME ' + ((left / 60) | 0) + '-' + (ss < 10 ? '0' : '') + ss, 158, 162, left < 30 && (f & 16) ? hex(0xff5050) : txt);
    for (i = 0; i < 5; i++) {                                   // stem LEDs: D B C L F
      k = i < sim.stems;
      R.rect(222 + i * 7, 162, 6, 7, k ? mix(ac, WHITE, i === sim.stems - 1 ? Math.max(0, 0.6 - bp) : 0) : hex(0x282838));
      R.px(222 + i * 7, 162, k ? WHITE : dim);
    }
    R.text('~' + sim.groove, 262, 162, hex(0xffe060));
    // buttons
    var IC = icons(), labels = [String(sim.rrMin), String(sim.rr)];
    for (i = 0; i < LAY.N; i++) {
      x = i * LAY.BW; sel = false; cnt = null; face = hex(0x30304a);
      if (i >= 2 && i <= 9) { k = BT.SKILLS[i - 2]; cnt = sim.skills[k]; sel = ui.skill === k; }
      if (i === 10) sel = ui.paused; if (i === 11) sel = ui.nukeArm || sim.nuked; if (i === 12) sel = ui.ff;
      if (sel) face = mix(ac, hex(0x30304a), 0.55);
      if (ui.pressed === i) face = mix(face, WHITE, 0.25);
      R.bevel(x, LAY.BY, LAY.BW, LAY.BH, face, sel ? WHITE : hi, lo);
      if (i < 2) {
        R.textC(labels[i], x + 8, LAY.BY + 3, txt);
        R.rect(x + 4, LAY.BY + 19, 8, 2, ac); if (i === 1) R.rect(x + 7, LAY.BY + 16, 2, 8, ac);
      } else if (i <= 9) {
        R.textC(cnt > 0 ? String(cnt) : '-', x + 8, LAY.BY + 3, cnt > 0 ? (sel ? WHITE : txt) : dim);
        R.cell(IC[i - 2], x, LAY.BY + 13, cnt > 0 ? SP.PAL : SP.PAL_GREY);
      } else if (i === 10) {
        R.rect(x + 4, LAY.BY + 12, 3, 11, sel ? WHITE : txt); R.rect(x + 9, LAY.BY + 12, 3, 11, sel ? WHITE : txt);
      } else if (i === 11) {
        nukeIcon(x, LAY.BY + 11, sel);
        if (ui.nukeArm && (f & 8)) R.textC('?', x + 8, LAY.BY + 2, hex(0xff5050));
      } else {
        for (k = 0; k < 5; k++) { R.rect(x + 3 + k, LAY.BY + 13 + k, 1, 9 - 2 * k, sel ? WHITE : txt); R.rect(x + 9 + k, LAY.BY + 13 + k, 1, 9 - 2 * k, sel ? WHITE : txt); }
      }
    }
    R.rect(LAY.N * LAY.BW, 169, FW - LAY.N * LAY.BW, 31, hex(0x101018));
    minimap(sim, ui.cam || 0, f);
    analyser(ui.an, world, f, bp);
  };

  // ------------------------------------------------------------ cursor
  R.cursor = function (x, y, box, c) {
    var i;
    c = c || WHITE;
    if (box) {
      for (i = 0; i < 3; i++) {
        R.px(x - 6 + i, y - 6, c); R.px(x - 6, y - 6 + i, c); R.px(x + 6 - i, y - 6, c); R.px(x + 6, y - 6 + i, c);
        R.px(x - 6 + i, y + 6, c); R.px(x - 6, y + 6 - i, c); R.px(x + 6 - i, y + 6, c); R.px(x + 6, y + 6 - i, c);
      }
    } else {
      for (i = 2; i < 6; i++) { R.px(x - i, y, c); R.px(x + i, y, c); R.px(x, y - i, c); R.px(x, y + i, c); }
      R.px(x, y, BLACK);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
