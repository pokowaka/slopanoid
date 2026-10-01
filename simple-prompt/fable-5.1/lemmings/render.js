/* =====================================================================
   Lemmings: Beat Tribe — software renderer (render.js)
   320x200 per-pixel Uint32 framebuffer -> ImageData -> canvas (nearest-neighbour).
   Everything (font, sprites, terrain textures, backgrounds, UI) is drawn in code.
   ===================================================================== */
(function (root) {
  'use strict';
  var BT = root.BT;
  var FW = 320, FH = 200, VH = 160;

  function C(hex) { return (0xff000000 | ((hex & 0xff) << 16) | (hex & 0xff00) | ((hex >> 16) & 0xff)) >>> 0; }
  function lerpC(a, b, t) { // a,b hex rgb
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (((ar + (br - ar) * t) & 255) << 16) | (((ag + (bg - ag) * t) & 255) << 8) | ((ab + (bb - ab) * t) & 255);
  }
  function shade(hex, f) { // multiply brightness
    var r = Math.min(255, ((hex >> 16) & 255) * f) | 0, g = Math.min(255, ((hex >> 8) & 255) * f) | 0, b = Math.min(255, (hex & 255) * f) | 0;
    return (r << 16) | (g << 8) | b;
  }
  function grey(hex, amt) { // desaturate toward luma
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, l = (r * 0.3 + g * 0.59 + b * 0.11) * 0.8;
    return lerpC(hex, (l << 16) | (l << 8) | l, amt);
  }
  function hash2(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

  /* ---------------- 4x5 bitmap font ---------------- */
  var FONT_SRC = {
    'A': '.##.#..######..##..#', 'B': '###.#..####.#..####.', 'C': '.####...#...#....###', 'D': '###.#..##..##..####.', 'E': '#####...###.#...####',
    'F': '#####...###.#...#...', 'G': '.####...#.###..#.###', 'H': '#..##..######..##..#', 'I': '###..#...#...#..###.', 'J': '..#...#...#.#..#.##.',
    'K': '#..##.#.##..#.#.#..#', 'L': '#...#...#...#...####', 'M': '#..##########..##..#', 'N': '#..###.##.###..##..#', 'O': '.##.#..##..##..#.##.',
    'P': '###.#..####.#...#...', 'Q': '.##.#..##..##.#..###', 'R': '###.#..####.#.#.#..#', 'S': '.####....##....####.', 'T': '####.#...#...#...#..',
    'U': '#..##..##..##..#.##.', 'V': '#..##..##..#.##..#..', 'W': '#..##..##..######..#', 'X': '#..##..#.##.#..##..#', 'Y': '#..##..#.##..#...#..',
    'Z': '####...#..#..#..####', '0': '.##.#.###.####.#.##.', '1': '.#..##...#...#..###.', '2': '###....#.##.#...####', '3': '###....#.##....####.',
    '4': '#..##..#####...#...#', '5': '#####...###....####.', '6': '.##.#...###.#..#.##.', '7': '####...#..#..#...#..', '8': '.##.#..#.##.#..#.##.',
    '9': '.##.#..#.###...#.##.', ' ': '....................', '.': '.............#...#..', ',': '.............#...#..', ':': '.....#.......#......',
    '!': '.#...#...#.......#..', '?': '###....#.##......#..', '-': '........####........', '+': '.....#..###..#......', '/': '...#..#..#..#...#...',
    '%': '#..#..#..#..#..#....', '(': '..#..#...#...#....#.', ')': '#....#....#...#..#..', "'": '.#...#..............', '<': '...#..#.#...#....#..',
    '>': '#....#....#...#..#..', '[': '##..#...#...#...##..', ']': '.##...#...#...#..##.', '=': '....####....####....', '*': '.....#.####..#.#..#.',
    '_': '................####', '"': '#.#.#.#.............', '#': '.#.######.#.####.#.#'
  };
  var FONT = {};
  for (var ch in FONT_SRC) { var s = FONT_SRC[ch], rows = []; for (var r = 0; r < 5; r++) { var bits = 0; for (var c = 0; c < 4; c++) if (s[r * 4 + c] === '#') bits |= (8 >> c); rows.push(bits); } FONT[ch] = rows; }

  /* ---------------- Renderer ---------------- */
  function Renderer(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    canvas.width = FW; canvas.height = FH;
    this.img = this.ctx.createImageData(FW, FH);
    this.fb = new Uint32Array(this.img.data.buffer);
    this.crt = true; this.frame = 0;
    this.bg = null; this.bgW = 0; this.bgWorld = -1;
    this.flashes = []; this.particles = []; this.texts = [];
  }
  Renderer.prototype.clear = function (c) { this.fb.fill(c); };
  Renderer.prototype.px = function (x, y, c) { if (x >= 0 && x < FW && y >= 0 && y < FH) this.fb[y * FW + x] = c; };
  Renderer.prototype.rect = function (x, y, w, h, c) {
    var x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(FW, x + w), y1 = Math.min(FH, y + h), fb = this.fb;
    for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) fb[yy * FW + xx] = c;
  };
  Renderer.prototype.box = function (x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); };
  Renderer.prototype.text = function (s, x, y, c, shadow) {
    s = String(s).toUpperCase();
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]] || FONT['?'];
      for (var r = 0; r < 5; r++) for (var cc = 0; cc < 4; cc++) if (g[r] & (8 >> cc)) { if (shadow !== undefined) this.px(x + i * 5 + cc + 1, y + r + 1, shadow); this.px(x + i * 5 + cc, y + r, c); }
    }
  };
  Renderer.prototype.textC = function (s, cx, y, c, shadow) { this.text(s, Math.round(cx - s.length * 5 / 2), y, c, shadow); };
  Renderer.prototype.bigText = function (s, x, y, c, shadow) { // 2x scaled
    s = String(s).toUpperCase();
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]] || FONT['?'];
      for (var r = 0; r < 5; r++) for (var cc = 0; cc < 4; cc++) if (g[r] & (8 >> cc)) {
        var px = x + i * 10 + cc * 2, py = y + r * 2;
        if (shadow !== undefined) this.rect(px + 1, py + 1, 2, 2, shadow);
        this.rect(px, py, 2, 2, c);
      }
    }
  };
  Renderer.prototype.bigTextC = function (s, cx, y, c, shadow) { this.bigText(s, Math.round(cx - s.length * 10 / 2), y, c, shadow); };

  /* ---------------- Background generation per world ---------------- */
  Renderer.prototype.buildBackground = function (level) {
    var W = level.width, wi = level.world, world = BT.WORLDS[wi];
    var bg = new Uint32Array(W * VH), x, y, c;
    var rng = BT.makeRng(level.seed * 31 + 5);
    var stars = []; for (var i = 0; i < 60; i++) stars.push([Math.floor(rng() * W), Math.floor(rng() * 90), rng()]);
    for (y = 0; y < VH; y++) {
      var t = y / VH;
      for (x = 0; x < W; x++) {
        if (wi === 0) { // bright sky, distant hills
          c = lerpC(world.bg[0], world.bg[1], t * 1.1);
          var hill = 118 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.051 + 1) * 6;
          if (y > hill) c = lerpC(0x2a5a9a, 0x3a7ad0, (y - hill) / 50);
          var hill2 = 132 + Math.sin(x * 0.033 + 2) * 8; if (y > hill2) c = 0x224a80;
          if (hash2(x >> 3, y >> 3) > 0.985 && y < 80) c = 0xffffff;
        } else if (wi === 1) { // dark warehouse, girders & smoke
          c = lerpC(world.bg[0], world.bg[1], t);
          var gy = (y % 40), gx = (x % 48);
          if (gy < 3) c = 0x2c2c3c; if (gx < 3 && y < 150) c = 0x30303e;
          if ((gy < 3 || gx < 3) && ((x + y) % 7 === 0)) c = 0x44445a;
          var smoke = Math.sin(x * 0.05 + y * 0.09) + Math.sin(x * 0.013 - y * 0.03); if (smoke > 1.3 && y > 60) c = lerpC(c, 0x3a3448, 0.5);
          if (((x >> 4) + (y >> 4)) % 9 === 0 && (x & 15) === 8 && (y & 15) === 8) c = [0xff2fa0, 0x29e6ff, 0x8dff2a][(x >> 4) % 3];
        } else if (wi === 2) { // sunset gradient, sun, chrome grid
          c = lerpC(world.bg[0], world.bg[1], Math.pow(t, 1.4));
          var dx = x % 320 - 160, dy = y - 70; var sunR = 44;
          if (dx * dx + dy * dy < sunR * sunR) { c = lerpC(0xffd23c, 0xff3c8c, (dy + sunR) / (2 * sunR)); if (dy > 0 && ((y >> 1) % 3 === 0) && dy > 8) c = lerpC(c, world.bg[0], 0.6); }
          if (y > 100) { var gz = (y - 100) / 60, gl = Math.abs(((x - 160 + 1600) % 40) - 20) / Math.max(1, gz * 20); var hy = Math.floor(16 / (1.05 - gz * 0.95)) ; c = lerpC(0x1a0a3a, 0x2a1050, gz); if (((y - 100) % Math.max(2, Math.floor(8 - gz * 6))) === 0 || (Math.abs(((x * (1 + gz * 3)) % 40) - 20) < 1.2)) c = lerpC(0x2ee6e6, 0xff3c8c, gz); if (hy < 0) c = 0; }
          if (y < 60 && hash2(x, y) > 0.995) c = 0xffffff;
        } else if (wi === 3) { // bioluminescent cave
          c = lerpC(world.bg[0], world.bg[1], t);
          var cav = Math.sin(x * 0.03) * 10 + Math.sin(x * 0.07 + 3) * 6 + Math.sin(y * 0.1) * 3;
          if (y < 20 + cav) c = 0x0a1420;
          var glow = hash2(x >> 2, y >> 2); if (glow > 0.992) c = [0x1fd0a8, 0x40e0ff, 0x9c5cff][Math.floor(glow * 1000) % 3]; else if (glow > 0.985) c = lerpC(c, 0x1fd0a8, 0.25);
          var vine = Math.sin(x * 0.2 + y * 0.05); if (vine > 0.98 && y < 100) c = 0x1a5a3a;
        } else { // marble concert hall
          c = lerpC(world.bg[0], world.bg[1], t);
          var col = x % 64; var arch = Math.sqrt(Math.max(0, 1 - Math.pow((col - 32) / 30, 2))) * 30;
          if (col < 6 || col > 58) c = lerpC(0x506080, 0x8090b0, (col < 6 ? col : 64 - col) / 6);
          else if (y < 70 - arch) c = lerpC(0x303c58, 0x404c68, hash2(x >> 2, y >> 2) * 0.4);
          if (y > 140 && ((x >> 3) + (y >> 3)) % 2 === 0) c = lerpC(c, 0x8898b8, 0.2);
          if (y < 70 - arch && hash2(x, y) > 0.996) c = 0xffe080;
        }
        bg[y * W + x] = C(c);
      }
    }
    this.bg = bg; this.bgW = W; this.bgWorld = wi;
  };

  /* ---------------- Terrain + world draw ---------------- */
  Renderer.prototype.drawWorld = function (sim, cam, beatPhase, frame) {
    var W = sim.W, terr = sim.terrain, fb = this.fb, bg = this.bg, world = sim.world, cols = world.colors;
    var pulse = Math.max(0, 1 - beatPhase * 2.5) * 0.14;
    var steel = world.steel, sil = sim.silence, front = sil ? sil.front : -1e9, sdir = sil ? sil.dir : 1;
    var palette = this.paletteCache || (this.paletteCache = {});
    var key = world.name; if (!palette[key]) { var p = []; for (var i = 0; i < 7; i++) p.push(cols[i]); palette[key] = p; }
    var cam0 = Math.round(cam);
    for (var y = 0; y < VH; y++) {
      var row = y * W, frow = y * FW;
      for (var sx = 0; sx < FW; sx++) {
        var x = sx + cam0; if (x < 0 || x >= W) { fb[frow + sx] = C(0x000000); continue; }
        var t = terr[row + x], c;
        var inSil = sil && ((x - front) * sdir < 0) && y >= sil.y0 && y <= sil.y1;
        var silAmt = inSil ? Math.min(1, Math.abs(x - front) / 28 + 0.35) : 0;
        if (t === 0) {
          fb[frow + sx] = bg[row + x];
          if (inSil) { var bc = fb[frow + sx]; var r0 = bc & 255, g0 = (bc >> 8) & 255, b0 = (bc >> 16) & 255; var l0 = (r0 * 0.3 + g0 * 0.59 + b0 * 0.11) * 0.6; r0 = r0 + (l0 - r0) * silAmt; g0 = g0 + (l0 - g0) * silAmt; b0 = b0 + (l0 - b0) * silAmt; fb[frow + sx] = (0xff000000 | (b0 << 16) | (g0 << 8) | r0) >>> 0; }
          continue;
        }
        var above = y > 0 ? terr[row - W + x] : 1;
        if (t === BT.T.STEEL) { c = steel; var rv = ((x & 7) === 3 && (y & 7) === 3) ? 1.5 : (((x & 7) === 0 || (y & 7) === 0) ? 0.75 : 1); c = shade(c, rv); if (above === 0) c = shade(c, 1.4); }
        else if (t === BT.T.OWR || t === BT.T.OWL) {
          c = shade(cols[0], 0.7); var ax = (t === BT.T.OWR) ? (x + (frame >> 2)) : (-x + (frame >> 2)); var m = ((ax & 15)), dy = Math.abs((y & 7) - 3);
          if (m === dy || m === dy + 1) c = world.accent; else c = lerpC(c, 0x000000, 0.35);
          if (above === 0) c = shade(c, 1.3);
        } else {
          c = cols[(t - 1) % 7];
          var h = hash2(x, y); var tex = 0.86 + h * 0.22;
          if ((x & 7) === 0) tex *= 0.8;          // note-block boundaries
          if (above === 0) tex = 1.45;             // top edge highlight
          else if (y > 0 && terr[row - W + x] !== 0 && (y > 1 && terr[row - 2 * W + x] === 0)) tex = 1.15;
          if (x >= 0 && terr[row + x - 1] === 0 || terr[row + x + 1] === 0) tex *= 1.12;
          c = shade(c, tex * (1 + pulse));
        }
        if (inSil) c = grey(c, silAmt);
        fb[frow + sx] = C(c);
      }
    }
    // Note flashes (lemming-triggered blocks)
    for (var f = this.flashes.length - 1; f >= 0; f--) {
      var fl = this.flashes[f]; fl.t--; if (fl.t <= 0) { this.flashes.splice(f, 1); continue; }
      var bx0 = (fl.x & ~7) - cam0, a = fl.t / 12;
      for (var yy = fl.y; yy < Math.min(VH, fl.y + 6); yy++) for (var xx = bx0; xx < bx0 + 8; xx++) {
        if (xx < 0 || xx >= FW) continue; var wx = xx + cam0; if (wx < 0 || wx >= W) continue; if (terr[yy * W + wx] === 0) continue;
        var pc = fb[yy * FW + xx]; var r = pc & 255, g = (pc >> 8) & 255, b = (pc >> 16) & 255;
        r = Math.min(255, r + 160 * a); g = Math.min(255, g + 160 * a); b = Math.min(255, b + 120 * a);
        fb[yy * FW + xx] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
      }
    }
    // Silence front shimmer
    if (sil) { var fx = Math.round(front) - cam0; for (var y2 = sil.y0; y2 < Math.min(VH, sil.y1 + 1); y2++) { var wob = Math.round(Math.sin(y2 * 0.3 + frame * 0.1) * 2); if ((y2 + frame) % 3) this.px(fx + wob, y2, C(0x9a9aa0)); this.px(fx + wob - sdir, y2, C(0x606068)); } }
  };
  Renderer.prototype.addFlash = function (x, y) { this.flashes.push({ x: x, y: y, t: 12 }); if (this.flashes.length > 64) this.flashes.shift(); };

  /* ---------------- Hazards, hatch, exit ---------------- */
  Renderer.prototype.drawObjects = function (sim, cam, frame) {
    var cam0 = Math.round(cam), hz = sim.hazards, lv = sim.level, i, x, y;
    for (i = 0; i < hz.length; i++) {
      var h = hz[i], sx = h.x - cam0; if (sx + h.w < 0 || sx > FW) continue;
      if (h.type === 'water') {
        for (y = h.y; y < Math.min(VH, h.y + h.h); y++) for (x = h.x; x < h.x + h.w; x++) {
          var wave = Math.sin(x * 0.4 + frame * 0.12 + y) > 0.6; var d = (y - h.y) / h.h;
          var c = lerpC(0x3a8ae0, 0x10306a, d); if (y === h.y && ((x + (frame >> 2)) & 3) < 2) c = 0xa0e0ff; else if (wave) c = lerpC(c, 0x80c0ff, 0.5);
          var px = x - cam0; if (px >= 0 && px < FW) { var old = this.fb[y * FW + px]; var r = old & 255, g = (old >> 8) & 255, b = (old >> 16) & 255; var nr = (c >> 16) & 255, ng = (c >> 8) & 255, nb = c & 255; this.fb[y * FW + px] = (0xff000000 | (((b + nb * 2) / 3 | 0) << 16) | (((g + ng * 2) / 3 | 0) << 8) | ((r + nr * 2) / 3 | 0)) >>> 0; }
        }
      } else if (h.type === 'fire') {
        for (y = h.y - 6; y < Math.min(VH, h.y + h.h); y++) for (x = h.x; x < h.x + h.w; x++) {
          var fl = hash2(x, y + (frame >> 1)) + hash2(x >> 1, (y + frame) >> 2); var top = h.y - 6 + Math.abs(Math.sin(x * 0.5 + frame * 0.2)) * 6;
          if (y < top) continue; var dd = (y - h.y + 6) / (h.h + 6);
          var fc = fl > 1.3 ? 0xffff80 : (fl > 0.9 ? 0xff9a20 : (fl > 0.6 ? 0xe03010 : 0x801000)); if (y >= h.y) fc = lerpC(0xff6a10, 0xa02000, (y - h.y) / h.h); if (fl > 1.5 && y > h.y) fc = 0xffd040;
          this.px(x - cam0, y, C(fc));
        }
      } else if (h.type === 'crusher') {
        var closed = sim.crusherClosed(h); var p = (sim.frame + (h.phase || 0)) % h.period; var cl = h.closed || 30;
        var drop = closed ? (p < 6 ? p / 6 : (p > cl - 10 ? (cl - p) / 10 : 1)) : 0; drop = Math.max(0, Math.min(1, drop));
        var pistonY = h.y - 4 + Math.round(drop * (h.h - 2));
        this.rect(h.x - 2 - cam0, h.y - 6, h.w + 4, 3, C(0x50545c)); // rail
        this.rect(h.x + (h.w >> 1) - 2 - cam0, h.y - 4, 4, pistonY - h.y + 4, C(0x7a7e88)); // piston rod
        this.rect(h.x - cam0, pistonY, h.w, 5, C(0x9a9ea8)); this.rect(h.x - cam0, pistonY + 5, h.w, 2, C(0x3a3e48)); // head
        for (x = 0; x < h.w; x += 4) this.px(h.x + x + 1 - cam0, pistonY + 2, C(0xff4040));
        if (closed && drop >= 1 && (frame & 2)) this.rect(h.x - cam0, h.y + h.h - 1, h.w, 1, C(0xffffff));
      }
    }
    // hatch (entrance trapdoor)
    var e = lv.entrance, ex = e.x - cam0, ey = e.y - 4, open = sim.hatchOpen ? Math.min(6, (sim.frame - 20) >> 2) : 0;
    this.rect(ex - 10, ey - 10, 20, 8, C(0x6a6a7a)); this.rect(ex - 9, ey - 9, 18, 6, C(0x8a8a9a)); this.box(ex - 10, ey - 10, 20, 8, C(0x303040));
    this.rect(ex - 8, ey - 2, 16 - open * 2, 2, C(0x404050)); this.rect(ex - 8 + open, ey - 2 + open, 2, 2, C(0x404050));
    this.px(ex - 7, ey - 7, C(0xff4040)); this.px(ex + 6, ey - 7, C(sim.hatchOpen ? 0x40ff40 : 0xff4040));
    // exit door
    var xe = lv.exit, dx = xe.x - cam0, dy = xe.y, acc = sim.world.accent, lit = sim.exitFlash > 0;
    this.rect(dx - 7, dy - 16, 14, 16, C(0x2a2a3a)); this.box(dx - 7, dy - 16, 14, 16, C(lit ? acc : 0x8a8a9a));
    this.rect(dx - 5, dy - 13, 10, 13, C(lit ? lerpC(0x101020, acc, 0.5) : 0x101020));
    for (var k = 0; k < 3; k++) { var on = ((frame >> 3) + k) % 3 === 0 || lit; this.px(dx - 4 + k * 4, dy - 15, C(on ? acc : 0x404040)); this.px(dx - 3 + k * 4, dy - 15, C(on ? acc : 0x404040)); }
    this.rect(dx - 9, dy - 18, 18, 2, C(0x8a8a9a)); this.text('EXIT', dx - 9, dy - 24, C(acc), C(0x000000));
    if (lit) for (var q = 0; q < 6; q++) this.px(dx - 6 + ((frame * 3 + q * 5) % 12), dy - 14 - ((frame + q * 3) % 12), C(0xffffff));
  };

  /* ---------------- Lemming sprites ---------------- */
  var HAIR = C(0x40e040), SKIN = C(0xf0c0a0), ROBE = C(0x3050e0), ROBE2 = C(0x2030a0), BOOT = C(0x202030), WHITE = C(0xffffff);
  Renderer.prototype.drawLemming = function (l, cam, beatPhase, frame, hover) {
    var cam0 = Math.round(cam), x = l.x - cam0, y = l.y, d = l.dir, self = this;
    if (x < -8 || x > FW + 8) return;
    var bob = (beatPhase < 0.25) ? 1 : 0; // head bob in time with the tempo
    function P(ox, oy, c) { self.px(x + ox * d, y + oy, c); }
    function R(ox, oy, w, h, c) { for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) P(ox + xx, oy + yy, c); }
    var st = l.state, a = l.anim;
    if (st === 'exploding') return;
    if (st === 'splat') { R(-3, -1, 7, 1, ROBE); R(-2, -2, 5, 1, HAIR); R(-4, 0, 9, 1, C(0x40a040)); return; }
    if (st === 'drown') { var sink = Math.min(9, l.t); R(-1, -9 + sink, 3, 1, HAIR); R(-1, -7 + sink, 3, 2, ROBE); if ((frame >> 2) & 1) P(2, -10 + sink, C(0xa0e0ff)); if (sink > 2) P(-2, -11 + sink, C(0xa0e0ff)); return; }
    if (st === 'burn') { var fc = (frame & 2) ? C(0xff9a20) : C(0xffff60); R(-2, -9, 5, 1, HAIR); R(-1, -8, 3, 2, l.t > 4 ? C(0x202020) : SKIN); R(-2, -6, 5, 5, l.t > 2 ? C(0x303030) : ROBE); for (var q = 0; q < 4; q++) P(-2 + q, -10 - ((frame + q * 3) % 5), fc); return; }
    if (st === 'exiting') { var hop = Math.round(Math.abs(Math.sin(l.t * 0.9)) * 3); y -= hop; }
    var hy = -9 - bob; // hair top
    if (st === 'floater') { // umbrella
      R(-4, -16, 9, 1, C(0xffd040)); R(-3, -17, 7, 1, C(0xff6040)); R(-2, -18, 5, 1, C(0xffd040)); P(0, -15, C(0x806040)); P(0, -14, C(0x806040)); P(0, -13, C(0x806040)); P(0, -12, C(0x806040));
    }
    // legs
    var walkF = (a >> 1) & 3;
    if (st === 'walker' || st === 'basher' || st === 'miner' || st === 'climber' || st === 'exiting' || st === 'builder') {
      if (walkF === 0) { P(-1, 0, BOOT); P(1, 0, BOOT); P(0, -1, ROBE2); }
      else if (walkF === 1) { P(0, 0, BOOT); P(0, -1, ROBE2); }
      else if (walkF === 2) { P(-2, 0, BOOT); P(2, 0, BOOT); P(-1, -1, ROBE2); P(1, -1, ROBE2); }
      else { P(0, 0, BOOT); P(0, -1, ROBE2); }
    } else if (st === 'faller') { P(-1, 0, BOOT); P(1, 0, BOOT); }
    else { P(-1, 0, BOOT); P(1, 0, BOOT); P(0, -1, ROBE2); }
    // robe
    R(-2, -6, 5, 5, ROBE); P(-2, -2, ROBE2); P(2, -2, ROBE2);
    // head
    R(-1, -8, 3, 2, SKIN); P(1, -7, C(0x000000)); // eye
    R(-2, hy, 5, 1, HAIR); R(-1, hy - 1, 3, 1, HAIR); P(-2, hy + 1, HAIR); P(0, hy + 1, HAIR);
    if (l.climber && st !== 'climber') P(-2, hy + 2, C(0xf0f080));
    if (l.floater && st !== 'floater') P(2, hy + 2, C(0xffd040));
    // arms / skill specific
    switch (st) {
      case 'walker': case 'exiting': P(2, -5 + ((a >> 1) & 1), SKIN); break;
      case 'faller': P(-3, -8, SKIN); P(3, -8, SKIN); P(-3, -9, SKIN); P(3, -9, SKIN); break;
      case 'floater': P(-2, -8, SKIN); P(2, -8, SKIN); P(-2, -9, SKIN); P(2, -9, SKIN); break;
      case 'climber': P(1, -9 - (a & 1), SKIN); P(1, -5 + (a & 1), SKIN); break;
      case 'builder': { var bp = l.t % 10; P(2, -5 + (bp < 5 ? 0 : 2), SKIN); P(3, -4 + (bp < 5 ? 0 : 2), SKIN); if (bp < 5) R(3, -3, 3, 1, C(0xd0a060)); break; }
      case 'basher': { var sw = (l.t >> 1) & 1; P(3, -6 + sw * 2, SKIN); P(4, -6 + sw * 2, SKIN); if (sw) { P(5, -4, C(0xc0a060)); P(5, -5, C(0xc0a060)); } break; }
      case 'miner': { var mp = (l.t / 3 | 0) & 1; P(2, -7 + mp * 3, SKIN); for (var k = 0; k < 4; k++) P(2 + k, -8 + k + mp * 3, C(0xc0c0d0)); break; }
      case 'digger': { var dp = (l.t / 3 | 0) & 1; P(-3, -4 + dp, SKIN); P(3, -4 + dp, SKIN); P(-3, -3 + dp, C(0xc0c0d0)); P(3, -3 + dp, C(0xc0c0d0)); for (var dq = 0; dq < 3; dq++) P(-4 + dq * 4, 1 + ((frame + dq * 2) % 3), C(0xc0a070)); break; }
      case 'blocker': R(-4, -6, 2, 1, SKIN); R(3, -6, 2, 1, SKIN); break;
      case 'shrugger': P(-3, -7 + (a & 1), SKIN); P(3, -7 + (a & 1), SKIN); break;
      case 'ohno': { var sh = (frame & 2) ? 1 : -1; P(-3 + sh, -8, SKIN); P(3 + sh, -8, SKIN); P(-2, -7, C(0x000000)); R(-1, -8, 3, 2, C(0xfff0e0)); break; }
    }
    // bomber countdown number
    if (l.bomb >= 0 && st !== 'ohno') { var secs = Math.ceil(l.bomb / 15); this.text(String(secs), x - 2, y - 17, WHITE, C(0x000000)); }
    if (hover) { this.box(x - 5, y - 12, 11, 14, (frame & 4) ? WHITE : C(0xffd040)); }
  };

  /* ---------------- Particles & floating text ---------------- */
  Renderer.prototype.burst = function (x, y, n, cols, speed) {
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + hash2(i, n) * 0.5, sp = speed * (0.4 + hash2(i, y));
      this.particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - speed * 0.6, c: C(cols[i % cols.length]), t: 30 + ((i * 7) % 25) });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  };
  Renderer.prototype.floatText = function (x, y, s, c) { this.texts.push({ x: x, y: y, s: s, c: C(c), t: 40 }); };
  Renderer.prototype.drawParticles = function (cam, speedMul) {
    var cam0 = Math.round(cam);
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i]; p.x += p.vx * speedMul; p.y += p.vy * speedMul; p.vy += 0.12 * speedMul; p.t -= speedMul;
      if (p.t <= 0 || p.y > VH) { this.particles.splice(i, 1); continue; }
      this.px(Math.round(p.x) - cam0, Math.round(p.y), p.c);
    }
    for (var j = this.texts.length - 1; j >= 0; j--) {
      var tx = this.texts[j]; tx.t -= speedMul; tx.y -= 0.3 * speedMul; if (tx.t <= 0) { this.texts.splice(j, 1); continue; }
      this.textC(tx.s, Math.round(tx.x) - cam0, Math.round(tx.y), tx.c, C(0x000000));
    }
  };

  /* ---------------- Icons for the skill panel ---------------- */
  var ICONS = {
    rateDown: ['........', '........', '..####..', '........', '........'],
    rateUp: ['...##...', '...##...', '.######.', '...##...', '...##...'],
    climber: ['......#.', '....###.', '..###...', '.##.....', '#.......'],
    floater: ['.######.', '#......#', '...##...', '...##...', '..#..#..'],
    bomber: ['...#....', '..#.#...', '.#####..', '.#####..', '..###...'],
    blocker: ['#..##..#', '#.####.#', '########', '#.####.#', '#..##..#'],
    builder: ['.....###', '...###..', '.###....', '###.....', '........'],
    basher: ['........', '.##..#..', '####.##.', '.##..#..', '........'],
    miner: ['......#.', '.....##.', '..####..', '.##.....', '#.......'],
    digger: ['..#..#..', '..#..#..', '.######.', '..####..', '...##...'],
    pause: ['.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.'],
    nuke: ['..####..', '.######.', '..####..', '...##...', '..####..'],
    ff: ['#...#...', '##..##..', '###.###.', '##..##..', '#...#...']
  };
  Renderer.prototype.icon = function (name, x, y, c) {
    var ic = ICONS[name]; if (!ic) return;
    for (var r = 0; r < ic.length; r++) for (var cc = 0; cc < ic[r].length; cc++) if (ic[r][cc] === '#') this.px(x + cc, y + r, c);
  };

  /* ---------------- Minimap, scope ---------------- */
  Renderer.prototype.drawMinimap = function (sim, cam, x0, y0, w, h) {
    var W = sim.W, sx = w / W, sy = h / VH, terr = sim.terrain, cols = sim.world.colors;
    this.rect(x0, y0, w, h, C(0x080810));
    for (var py = 0; py < h; py++) for (var px = 0; px < w; px++) {
      var tx = Math.floor(px / sx), ty = Math.floor(py / sy); var t = terr[ty * W + tx];
      if (t) this.px(x0 + px, y0 + py, C(t === BT.T.STEEL ? 0x808088 : shade(cols[(t - 1) % 7] || cols[0], 0.8)));
    }
    if (sim.silence) { var fx = Math.round(sim.silence.front * sx); if (sim.silence.dir < 0) this.rect(x0 + fx, y0, w - fx, h, C(0x50505a)); else this.rect(x0, y0, fx, h, C(0x50505a)); }
    for (var i = 0; i < sim.lemmings.length; i++) { var l = sim.lemmings[i]; if (!l.alive) continue; this.px(x0 + Math.floor(l.x * sx), y0 + Math.floor((l.y - 4) * sy), C(l.state === 'blocker' ? 0xff4040 : 0x40ff40)); }
    this.px(x0 + Math.floor(sim.level.exit.x * sx), y0 + Math.floor((sim.level.exit.y - 6) * sy), C(sim.world.accent));
    this.box(x0 + Math.floor(cam * sx), y0, Math.max(2, Math.floor(FW * sx)), h, C(0xffffff));
  };
  Renderer.prototype.drawScope = function (audio, x0, y0, w, h, accent) {
    this.rect(x0, y0, w, h, C(0x04060a));
    var spec = audio.spectrum(), sc = audio.scope();
    if (spec) { for (var i = 0; i < w; i += 2) { var bi = Math.floor(Math.pow(i / w, 1.6) * 160); var v = spec[bi] / 255 * (h - 2); this.rect(x0 + i, y0 + h - 1 - v, 2, v + 1, C(lerpC(0x203060, accent, v / h))); } }
    if (sc) { var step = Math.floor(sc.length / w / 2); for (var x = 0; x < w; x++) { var s = sc[Math.min(sc.length - 1, x * step)] / 255; var yy = y0 + Math.round((1 - s) * (h - 1)); this.px(x0 + x, yy, C(0xa0ffd0)); } }
    this.box(x0 - 1, y0 - 1, w + 2, h + 2, C(0x404858));
  };

  /* ---------------- Present ---------------- */
  Renderer.prototype.present = function () {
    if (this.crt) { var fb = this.fb; for (var y = 1; y < FH; y += 2) { var o = y * FW; for (var x = 0; x < FW; x++) { var c = fb[o + x]; fb[o + x] = (c & 0xff000000) | ((c >> 1) & 0x7f7f7f) | ((c >> 2) & 0x3f3f3f); } } }
    this.ctx.putImageData(this.img, 0, 0);
    this.frame++;
  };

  root.BT_RENDER = { Renderer: Renderer, C: C, lerpC: lerpC, shade: shade, FW: FW, FH: FH, VH: VH, FONT: FONT };
})(typeof window !== 'undefined' ? window : this);
