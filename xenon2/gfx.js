'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — gfx.js
 *  VGA Mode 13h emulation: 320x200 8-bit indexed framebuffer + 256-colour
 *  palette (with palette cycling & palette-space post FX), primitive drawing,
 *  a 3x5 bitmap font, and an SDF "shader" that bakes Bitmap-Brothers style
 *  chrome / metal / organic sprites with ordered (Bayer) dithering.
 * ===========================================================================*/
const GFX = (() => {
  const W = 320, H = 200;
  const main = { w: W, h: H, px: new Uint8Array(W * H) };
  let T = main;
  const basePal = new Uint8Array(768);
  const pal32 = new Uint32Array(256), palPlain = new Uint32Array(256);
  const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16));
  let c2d = null, img = null, img32 = null;
  const fx = { flash: 0, rewind: 0, red: 0, dim: 0 };

  // 16-entry ramps
  const R = { CHROME: 0, GOLD: 16, FIRE: 32, PLASMA: 48, GREEN: 64, MAG: 80, S0: 96, S1: 112, S2: 128, S3: 144, E0: 160, E1: 176, CYC: 192, SKIN: 224 };
  const C = { OUTLINE: 240, WHITE: 241, RED: 242, YELLOW: 243, GREEN: 244, CYAN: 245, PANEL: 246, PANEL2: 247, ORANGE: 248, PINK: 249, BLACK: 250, GREY1: 251, GREY2: 252, GREY3: 253, BLINK: 254, BLINK2: 255 };

  function setRGB(i, r, g, b) { basePal[i * 3] = Math.max(0, Math.min(255, Math.round(r))); basePal[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g))); basePal[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b))); }
  function getRGB(i) { return [basePal[i * 3], basePal[i * 3 + 1], basePal[i * 3 + 2]]; }
  function ramp(start, keys, n = 16) {
    for (let k = 0; k < n; k++) {
      const p = k / (n - 1) * (keys.length - 1), i0 = Math.min(keys.length - 2, Math.floor(p)), f = p - i0;
      const a = keys[i0], b = keys[i0 + 1];
      setRGB(start + k, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    }
  }
  function initPalette() {
    ramp(R.CHROME, [[0, 0, 0], [16, 20, 42], [58, 76, 120], [150, 172, 208], [255, 255, 255]]);
    ramp(R.GOLD, [[8, 4, 0], [74, 38, 4], [172, 102, 18], [246, 198, 72], [255, 255, 218]]);
    ramp(R.FIRE, [[8, 0, 0], [100, 8, 0], [226, 62, 0], [255, 178, 32], [255, 255, 214]]);
    ramp(R.PLASMA, [[0, 0, 18], [0, 28, 112], [0, 122, 228], [92, 226, 255], [246, 255, 255]]);
    ramp(R.GREEN, [[0, 8, 0], [8, 58, 12], [40, 152, 30], [162, 242, 72], [246, 255, 212]]);
    ramp(R.MAG, [[12, 0, 14], [82, 0, 74], [186, 30, 166], [255, 116, 230], [255, 236, 255]]);
    ramp(R.SKIN, [[4, 14, 10], [20, 62, 42], [62, 134, 84], [146, 206, 124], [232, 255, 214]]);
    for (let i = 96; i < 224; i++) setRGB(i, (i & 15) * 16, (i & 15) * 16, (i & 15) * 16);
    const sp = [[8, 8, 22], [255, 255, 255], [255, 40, 40], [255, 238, 60], [60, 255, 96], [80, 240, 255], [22, 22, 38], [58, 60, 92], [255, 140, 20], [255, 90, 200], [2, 2, 8], [60, 60, 70], [110, 110, 125], [180, 180, 195], [255, 230, 60], [255, 90, 30]];
    sp.forEach((c, k) => setRGB(240 + k, c[0], c[1], c[2]));
  }

  function init(canvas) {
    c2d = canvas.getContext('2d');
    img = c2d.createImageData(W, H); img32 = new Uint32Array(img.data.buffer);
    initPalette(); buildLUTs();
  }
  function buildPal() {
    const f = fx;
    for (let i = 0; i < 256; i++) {
      let r = basePal[i * 3], g = basePal[i * 3 + 1], b = basePal[i * 3 + 2];
      palPlain[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
      if (f.rewind > 0) { const l = r * 0.3 + g * 0.59 + b * 0.11, k = f.rewind; r = r * (1 - k) + (l * 0.5 + 8) * k; g = g * (1 - k) + (l * 0.9 + 18) * k; b = b * (1 - k) + (l * 1.2 + 48) * k; }
      if (f.red > 0) { r = r + (255 - r) * f.red * 0.55; g *= 1 - f.red * 0.5; b *= 1 - f.red * 0.5; }
      if (f.dim > 0) { r *= 1 - f.dim; g *= 1 - f.dim; b *= 1 - f.dim; }
      if (f.flash > 0) { r += (255 - r) * f.flash; g += (255 - g) * f.flash; b += (255 - b) * f.flash; }
      r = r > 255 ? 255 : r | 0; g = g > 255 ? 255 : g | 0; b = b > 255 ? 255 : b | 0;
      pal32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
  }
  function present(sx = 0, sy = 0, wobble = 0, phase = 0) {
    buildPal();
    const px = main.px;
    if (!sx && !sy && !wobble) { for (let i = 0; i < W * H; i++) img32[i] = pal32[px[i]]; }
    else {
      for (let y = 0; y < H; y++) {
        let yy = y - sy; if (yy < 0) yy = 0; else if (yy >= H) yy = H - 1;
        const off = (sx + (wobble ? Math.round(Math.sin(y * 0.09 + phase) * wobble) : 0)) | 0;
        const ro = yy * W, wo = y * W;
        for (let x = 0; x < W; x++) { let xx = x - off; if (xx < 0) xx = 0; else if (xx >= W) xx = W - 1; img32[wo + x] = pal32[px[ro + xx]]; }
      }
    }
    c2d.putImageData(img, 0, 0);
  }
  function makeSurface(w, h) { return { w, h, px: new Uint8Array(w * h) }; }
  function presentSurface(s, ctx2d, imgData) {
    const d = new Uint32Array(imgData.data.buffer);
    for (let i = 0; i < s.w * s.h; i++) d[i] = palPlain[s.px[i]];
    ctx2d.putImageData(imgData, 0, 0);
  }
  function target(s) { T = s || main; }

  // ------------------------------------------------------------ primitives
  function clear(c) { T.px.fill(c); }
  function pset(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < T.w && y < T.h) T.px[y * T.w + x] = c; }
  function pget(x, y) { x |= 0; y |= 0; return (x >= 0 && y >= 0 && x < T.w && y < T.h) ? T.px[y * T.w + x] : 0; }
  function rect(x, y, w, h, c) {
    let x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(T.w, (x + w) | 0), y1 = Math.min(T.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) T.px.fill(c, yy * T.w + x0, yy * T.w + Math.max(x0, x1));
  }
  function hline(x0, x1, y, c) { if (x1 < x0) { const t = x0; x0 = x1; x1 = t; } rect(x0, y, x1 - x0 + 1, 1, c); }
  function line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (;;) {
      pset(x0, y0, c);
      if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function circle(cx, cy, r, c) {
    const r2 = r * r;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const w = Math.sqrt(Math.max(0, r2 - dy * dy)); if (r2 - dy * dy < 0) continue;
      hline(Math.round(cx - w), Math.round(cx + w), Math.round(cy + dy), c);
    }
  }
  function ring(cx, cy, r, c) {
    const n = Math.max(12, Math.ceil(r * 6.3));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pset(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
  }
  function orb(cx, cy, r, base) {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d2 = (dx * dx + dy * dy) / (r * r); if (d2 > 1) continue;
      const x = (cx + dx) | 0, y = (cy + dy) | 0; if (x < 0 || y < 0 || x >= T.w || y >= T.h) continue;
      const nx = dx / r, ny = dy / r, nz = Math.sqrt(1 - d2);
      const diff = Math.max(0, -nx * 0.45 - ny * 0.6 + nz * 0.66), sp = Math.pow(Math.max(0, -nx * 0.3 - ny * 0.4 + nz * 0.87), 24);
      const s = 0.12 + 0.72 * diff + 0.7 * sp;
      let l = Math.round(s * 15 + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5)); l = l < 1 ? 1 : l > 15 ? 15 : l;
      T.px[y * T.w + x] = base + l;
    }
  }
  function glow(cx, cy, r, base, inten = 1) {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy) / r; if (d >= 1) continue;
      const x = (cx + dx) | 0, y = (cy + dy) | 0; if (x < 0 || y < 0 || x >= T.w || y >= T.h) continue;
      const lv = ((1 - d) * (1 - d) * 16 * inten + BAYER[(y & 3) * 4 + (x & 3)] - 0.5) | 0;
      if (lv < 1) continue;
      const l = lv > 15 ? 15 : lv, o = y * T.w + x, cur = T.px[o];
      if ((cur & 0xF0) === base && (cur & 15) >= l) continue;
      T.px[o] = base + l;
    }
  }
  function blit(s, x, y, lut) {
    if (!s) return;
    x = Math.round(x); y = Math.round(y);
    const w = s.w, h = s.h, d = s.d, tw = T.w, th = T.h, px = T.px;
    const x0 = Math.max(0, -x), y0 = Math.max(0, -y), x1 = Math.min(w, tw - x), y1 = Math.min(h, th - y);
    for (let j = y0; j < y1; j++) {
      let si = j * w + x0, di = (y + j) * tw + x + x0;
      for (let i = x0; i < x1; i++, si++, di++) { const v = d[si]; if (v) px[di] = lut ? lut[v] : v; }
    }
  }
  function blitC(s, cx, cy, lut) { if (s) blit(s, cx - (s.w >> 1), cy - (s.h >> 1), lut); }

  // ------------------------------------------------------------ remap LUTs
  const LUT = { flash: new Uint8Array(256), gold: new Uint8Array(256), red: new Uint8Array(256), dark: new Uint8Array(256), ghost: new Uint8Array(256) };
  function buildLUTs() {
    for (let i = 0; i < 256; i++) {
      const base = i & 0xF0, l = i & 15;
      LUT.flash[i] = i ? C.WHITE : 0;
      LUT.gold[i] = i < 16 ? R.GOLD + l : (base === R.PLASMA ? R.FIRE + l : i);
      LUT.red[i] = i < 224 ? R.FIRE + Math.max(1, l) : C.RED;
      LUT.dark[i] = i < 224 ? base + Math.max(1, l - 5) : C.OUTLINE;
      LUT.ghost[i] = i < 224 ? R.PLASMA + Math.max(1, l - 2) : C.CYAN;
    }
    LUT.flash[0] = LUT.gold[0] = LUT.red[0] = LUT.dark[0] = LUT.ghost[0] = 0;
  }

  // ------------------------------------------------------------ 3x5 font
  const FONT = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755',
    N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34652', 7: '71122', 8: '25252', 9: '25316',
    ' ': '00000', '.': '00002', ',': '00024', '!': '22202', '?': '61202', ':': '02020', '-': '00700', '+': '02720', '/': '11244', '%': '51245',
    '$': '36236', '(': '12221', ')': '42224', "'": '22000', '"': '55000', '<': '12421', '>': '42124', '=': '07070', '#': '57575', '*': '05250',
    '&': '25253', '_': '00007', '[': '32223', ']': '62226', '@': '25743', '^': '25000', '~': '03600', '|': '22222',
  };
  function text(s, x, y, c, sh = -1, sc = 1) {
    s = String(s).toUpperCase();
    let cx = x | 0;
    for (let k = 0; k < s.length; k++) {
      const g = FONT[s[k]] || FONT['?'];
      for (let r = 0; r < 5; r++) {
        const bits = g.charCodeAt(r) - 48;
        for (let b = 0; b < 3; b++) if (bits & (4 >> b)) {
          if (sh >= 0) rect(cx + b * sc + sc, y + r * sc + sc, sc, sc, sh);
          rect(cx + b * sc, y + r * sc, sc, sc, c);
        }
      }
      cx += 4 * sc;
    }
    return cx - x;
  }
  const textW = (s, sc = 1) => String(s).length * 4 * sc - sc;
  function textC(s, cx, y, c, sh = -1, sc = 1) { return text(s, Math.round(cx - textW(s, sc) / 2), y, c, sh, sc); }

  // ------------------------------------------------------------ SDF toolkit
  const SDF = {
    circle: (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r,
    ellipse: (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry),
    box: (x, y, cx, cy, hw, hh, r = 0) => { const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r; },
    seg: (x, y, ax, ay, bx, by, r) => { const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay; const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1))); return Math.hypot(pax - bax * h, pay - bay * h) - r; },
    poly: (px, py, v) => {
      const n = v.length / 2; let d = (px - v[0]) ** 2 + (py - v[1]) ** 2, s = 1;
      for (let i = 0, j = n - 1; i < n; j = i, i++) {
        const ex = v[j * 2] - v[i * 2], ey = v[j * 2 + 1] - v[i * 2 + 1], wx = px - v[i * 2], wy = py - v[i * 2 + 1];
        const h = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey))), bx = wx - ex * h, by = wy - ey * h;
        d = Math.min(d, bx * bx + by * by);
        const c1 = py >= v[i * 2 + 1], c2 = py < v[j * 2 + 1], c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
      }
      return s * Math.sqrt(d);
    },
    smin: (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; },
    sub: (a, b) => Math.max(a, -b),
  };
  const M = {
    chrome: { b: R.CHROME, k: 'chrome' }, steel: { b: R.CHROME, k: 'metal' }, gold: { b: R.GOLD, k: 'chrome' }, brass: { b: R.GOLD, k: 'metal' },
    fire: { b: R.FIRE, k: 'glow' }, firem: { b: R.FIRE, k: 'metal' }, plasma: { b: R.PLASMA, k: 'glow' }, plasmam: { b: R.PLASMA, k: 'metal' },
    green: { b: R.GREEN, k: 'glow' }, greenm: { b: R.GREEN, k: 'organic' }, mag: { b: R.MAG, k: 'glow' }, magm: { b: R.MAG, k: 'metal' },
    e0: { b: R.E0, k: 'metal' }, e1: { b: R.E1, k: 'metal' }, e0o: { b: R.E0, k: 'organic' }, e1o: { b: R.E1, k: 'organic' }, e0c: { b: R.E0, k: 'chrome' }, e1c: { b: R.E1, k: 'chrome' },
    skin: { b: R.SKIN, k: 'organic' }, dark: { b: R.CHROME, k: 'dark' }, black: { b: R.CHROME, k: 'flat', s: 0.08 },
  };
  const Lx = -0.45, Ly = -0.65, Lz = 0.62, Ln = Math.hypot(Lx, Ly, Lz);
  const lx = Lx / Ln, ly = Ly / Ln, lz = Lz / Ln;
  const hx0 = lx, hy0 = ly, hz0 = lz + 1, hn = Math.hypot(hx0, hy0, hz0), hx = hx0 / hn, hy = hy0 / hn, hz = hz0 / hn;

  // The "shader": turn a signed-distance grid into lit, dithered palette pixels.
  function shadeGrid(w, h, dist, matFn, opts = {}) {
    const rad = opts.rad || 3, out = new Uint8Array(w * h), hf = new Float32Array(w * h);
    const outline = opts.outline === undefined ? C.OUTLINE : opts.outline;
    for (let i = 0; i < w * h; i++) { const d = dist[i]; if (d < 0) { const t = Math.min(1, -d / rad); hf[i] = Math.sqrt(1 - (1 - t) * (1 - t)); } }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] >= 0) {
        if (outline && ((x > 0 && dist[i - 1] < 0) || (x < w - 1 && dist[i + 1] < 0) || (y > 0 && dist[i - w] < 0) || (y < h - 1 && dist[i + w] < 0))) out[i] = outline;
        continue;
      }
      const m = matFn(x, y, dist[i]); if (!m) continue;
      const hl = x > 0 ? hf[i - 1] : 0, hr = x < w - 1 ? hf[i + 1] : 0, hu = y > 0 ? hf[i - w] : 0, hd = y < h - 1 ? hf[i + w] : 0;
      let nx = (hl - hr) * rad * 0.5, ny = (hu - hd) * rad * 0.5, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const diff = Math.max(0, nx * lx + ny * ly + nz * lz), sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 28);
      let s;
      switch (m.k) {
        case 'chrome': {
          let ry = 2 * nz * ny + (y / h - 0.45) * (opts.grad === undefined ? 1.1 : opts.grad);
          let e; if (ry < -0.02) e = 0.58 + Math.min(0.42, -ry * 0.9); else if (ry < 0.2) e = 0.1 + ry * 0.5; else e = 0.26 + Math.min(0.34, (ry - 0.2) * 0.8);
          s = e * 0.72 + diff * 0.28 + sp * 0.9; break;
        }
        case 'metal': s = 0.1 + 0.68 * diff + 0.55 * sp; break;
        case 'organic': s = 0.07 + 0.74 * diff + 0.22 * sp; break;
        case 'glow': s = 0.5 + 0.5 * hf[i] + 0.25 * sp; break;
        case 'dark': s = 0.05 + 0.3 * diff + 0.5 * sp; break;
        default: s = m.s || 0.5;
      }
      if (m.o) s += m.o;
      if (opts.detail) s += opts.detail(x, y, dist[i]) || 0;
      let l = Math.round(s * 15 + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 1.1); l = l < 1 ? 1 : l > 15 ? 15 : l;
      out[i] = m.b + l;
    }
    return { w, h, d: out };
  }
  function makeSprite(w, h, sdf, matFn, opts) {
    const dist = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dist[y * w + x] = sdf(x + 0.5, y + 0.5);
    return shadeGrid(w, h, dist, matFn, opts);
  }
  function maskToDist(mask, w, h) {
    const INF = 1e6, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? -d[i] + 0.5 : 1;
    return d;
  }
  // Chrome logo text rendered via canvas mask -> distance field -> chrome shader
  function makeLogo(str, px, matFn, opts = {}) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const font = `italic 900 ${px}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
    g.font = font;
    const tw = Math.ceil(g.measureText(str).width + px * 0.4 + 8), th = Math.ceil(px * 1.25 + 6);
    cv.width = tw; cv.height = th;
    g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff';
    if (opts.spacing) { let x = 4; for (const ch of str) { g.fillText(ch, x, 3); x += g.measureText(ch).width + opts.spacing; } }
    else g.fillText(str, 4, 3);
    const id = g.getImageData(0, 0, tw, th).data, mask = new Uint8Array(tw * th);
    let minX = tw, maxX = 0, minY = th, maxY = 0;
    for (let i = 0; i < tw * th; i++) if (id[i * 4 + 3] > 110) { mask[i] = 1; const x = i % tw, y = (i / tw) | 0; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (maxX < minX) return { w: 1, h: 1, d: new Uint8Array(1) };
    const w = maxX - minX + 3, h = maxY - minY + 3, m2 = new Uint8Array(w * h);
    for (let y = 0; y < h - 2; y++) for (let x = 0; x < w - 2; x++) m2[(y + 1) * w + x + 1] = mask[(y + minY) * tw + x + minX];
    const dist = maskToDist(m2, w, h);
    return shadeGrid(w, h, dist, matFn || (() => M.chrome), Object.assign({ rad: Math.max(2, px / 9) }, opts));
  }

  return {
    W, H, R, C, M, SDF, BAYER, LUT, FONT, fx, main,
    init, setRGB, getRGB, ramp, present, makeSurface, presentSurface, target, buildPal,
    clear, pset, pget, rect, hline, line, circle, ring, orb, glow, blit, blitC,
    text, textW, textC, shadeGrid, makeSprite, maskToDist, makeLogo,
    get px() { return T.px; },
  };
})();
