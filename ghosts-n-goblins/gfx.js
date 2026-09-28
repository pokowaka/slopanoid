'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — gfx.js
 *  CPS-1 style 320x200 true-colour software framebuffer (Uint32 RGBA),
 *  sprite blitter (flip / flash / tint / ghost / clip), primitive drawing,
 *  additive glows, a 5x7 arcade bitmap font and screen-space post FX
 *  (lightning flash, fade, colour tint).
 * ===========================================================================*/
const GFX = (() => {
  const W = 320, H = 200;
  const fb = new Uint32Array(W * H);
  let T = { w: W, h: H, d: fb };
  let c2d = null, img = null, out32 = null;
  const fx = { flash: 0, fade: 0, tintR: 0, tintG: 0, tintB: 0, tintA: 0 };

  const rgb = (r, g, b, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  const hex = s => { const n = parseInt(s.replace('#', ''), 16); return rgb(n >> 16 & 255, n >> 8 & 255, n & 255); };
  const R = c => c & 255, Gc = c => (c >> 8) & 255, B = c => (c >> 16) & 255;
  function mix(c1, c2, t) { return rgb(R(c1) + (R(c2) - R(c1)) * t, Gc(c1) + (Gc(c2) - Gc(c1)) * t, B(c1) + (B(c2) - B(c1)) * t); }
  function shade(c, k) { return rgb(Math.min(255, R(c) * k), Math.min(255, Gc(c) * k), Math.min(255, B(c) * k)); }

  function init(canvas) { c2d = canvas.getContext('2d'); img = c2d.createImageData(W, H); out32 = new Uint32Array(img.data.buffer); }
  function target(s) { T = s || { w: W, h: H, d: fb }; }
  function present(shx = 0, shy = 0) {
    const f = fx.flash, fd = fx.fade, ta = fx.tintA;
    const plain = f <= 0 && fd <= 0 && ta <= 0;
    for (let y = 0; y < H; y++) {
      let sy = y - shy; if (sy < 0) sy = 0; else if (sy >= H) sy = H - 1;
      const ro = sy * W, wo = y * W;
      for (let x = 0; x < W; x++) {
        let sx = x - shx; if (sx < 0) sx = 0; else if (sx >= W) sx = W - 1;
        let c = fb[ro + sx];
        if (!plain) {
          let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
          if (ta > 0) { r += (fx.tintR - r) * ta; g += (fx.tintG - g) * ta; b += (fx.tintB - b) * ta; }
          if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
          if (fd > 0) { r *= 1 - fd; g *= 1 - fd; b *= 1 - fd; }
          c = 0xFF000000 | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
        }
        out32[wo + x] = c;
      }
    }
    c2d.putImageData(img, 0, 0);
  }

  // ---------------------------------------------------------------- primitives
  function clear(c) { T.d.fill(c); }
  function pset(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < T.w && y < T.h) T.d[y * T.w + x] = c; }
  function pget(x, y) { x |= 0; y |= 0; return (x >= 0 && y >= 0 && x < T.w && y < T.h) ? T.d[y * T.w + x] : 0; }
  function blend(x, y, c, a) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= T.w || y >= T.h || a <= 0) return;
    const i = y * T.w + x, d = T.d[i];
    if (a >= 1) { T.d[i] = c; return; }
    T.d[i] = rgb(R(d) + (R(c) - R(d)) * a, Gc(d) + (Gc(c) - Gc(d)) * a, B(d) + (B(c) - B(d)) * a);
  }
  function add(x, y, c, k) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= T.w || y >= T.h) return;
    const i = y * T.w + x, d = T.d[i];
    T.d[i] = rgb(Math.min(255, R(d) + R(c) * k), Math.min(255, Gc(d) + Gc(c) * k), Math.min(255, B(d) + B(c) * k));
  }
  function rect(x, y, w, h, c) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(T.w, (x + w) | 0), y1 = Math.min(T.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) T.d.fill(c, yy * T.w + x0, yy * T.w + Math.max(x0, x1));
  }
  function rectA(x, y, w, h, c, a) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(T.w, (x + w) | 0), y1 = Math.min(T.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) blend(xx, yy, c, a);
  }
  function frame(x, y, w, h, c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }
  function hline(x0, x1, y, c) { if (x1 < x0) { const t = x0; x0 = x1; x1 = t; } rect(x0, y, x1 - x0 + 1, 1, c); }
  function line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (;;) { pset(x0, y0, c); if ((x0 === x1 && y0 === y1) || ++n > 3000) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function thick(x0, y0, x1, y1, r, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) { const t = i / n; disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c); }
  }
  function disc(cx, cy, r, c) {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dy * dy <= r * r + 0.25) pset(Math.round(cx + dx), Math.round(cy + dy), c);
  }
  function ellipse(cx, cy, rx, ry, c) {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const k = 1 - (dy * dy) / (ry * ry); if (k < 0) continue;
      const w = Math.sqrt(k) * rx; hline(Math.round(cx - w), Math.round(cx + w), Math.round(cy + dy), c);
    }
  }
  function ring(cx, cy, r, c) { const n = Math.max(12, Math.ceil(r * 6.3)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pset(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); } }
  function glow(cx, cy, r, c, k = 1) {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy) / r; if (d >= 1) continue;
      add(cx + dx, cy + dy, c, (1 - d) * (1 - d) * k);
    }
  }
  function poly(pts, c) {
    let y0 = 1e9, y1 = -1e9; for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = []; const n = pts.length / 2;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + (y + 0.5 - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) hline(Math.round(xs[k]), Math.round(xs[k + 1]) - 1, y, c);
    }
  }

  // ---------------------------------------------------------------- sprites
  // sprite: {w,h,ax,ay,d,f} (f = horizontally flipped copy)
  function makeSprite(w, h, paint, ax = w >> 1, ay = h - 1) {
    const s = { w, h, ax, ay, d: new Uint32Array(w * h) };
    const prev = T; T = s; paint(s); T = prev;
    s.f = flipData(s);
    return s;
  }
  function flipData(s) { const f = new Uint32Array(s.w * s.h); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) f[y * s.w + x] = s.d[y * s.w + s.w - 1 - x]; return f; }
  function refresh(s) { s.f = flipData(s); return s; }
  function outline(s, c) {
    const w = s.w, h = s.h, d = s.d, o = new Uint32Array(d);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[y * w + x] >>> 24) continue;
      if ((x > 0 && d[y * w + x - 1] >>> 24) || (x < w - 1 && d[y * w + x + 1] >>> 24) || (y > 0 && d[(y - 1) * w + x] >>> 24) || (y < h - 1 && d[(y + 1) * w + x] >>> 24)) o[y * w + x] = c;
    }
    s.d = o; s.f = flipData(s); return s;
  }
  function fromAscii(rows, pal, ax, ay) {
    const h = rows.length, w = rows[0].length;
    return makeSprite(w, h, s => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (pal[ch] != null) s.d[y * w + x] = pal[ch]; } }, ax, ay);
  }
  // modes: 0 normal, 1 flash white, 2 ghost (alpha), 3 silhouette tint, 4 additive
  function blit(s, x, y, flip, mode = 0, arg = 0, clipY = 1e9) {
    if (!s) return;
    x = Math.round(x - (flip ? s.w - 1 - s.ax : s.ax)); y = Math.round(y - s.ay);
    const w = s.w, h = s.h, d = flip ? s.f : s.d, tw = T.w, th = T.h, td = T.d;
    const x0 = Math.max(0, -x), y0 = Math.max(0, -y), x1 = Math.min(w, tw - x), y1 = Math.min(h, th - y, clipY - y);
    for (let j = y0; j < y1; j++) {
      let si = j * w + x0, di = (y + j) * tw + x + x0;
      for (let i = x0; i < x1; i++, si++, di++) {
        const v = d[si]; if (!(v >>> 24)) continue;
        if (mode === 0) td[di] = v;
        else if (mode === 1) td[di] = 0xFFFFFFFF;
        else if (mode === 2) { const c = td[di], a = arg; td[di] = rgb(R(c) + (R(v) - R(c)) * a, Gc(c) + (Gc(v) - Gc(c)) * a, B(c) + (B(v) - B(c)) * a); }
        else if (mode === 3) td[di] = arg;
        else if (mode === 4) { const c = td[di]; td[di] = rgb(Math.min(255, R(c) + R(v) * arg), Math.min(255, Gc(c) + Gc(v) * arg), Math.min(255, B(c) + B(v) * arg)); }
      }
    }
  }
  // rotated sprite blit (nearest), centred on (cx,cy)
  function blitRot(s, cx, cy, ang, flip, mode = 0, arg = 0) {
    const ca = Math.cos(-ang), sa = Math.sin(-ang), r = Math.ceil(Math.hypot(s.w, s.h) / 2) + 1, d = flip ? s.f : s.d;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const sx = Math.round(dx * ca - dy * sa + s.w / 2 - 0.5), sy = Math.round(dx * sa + dy * ca + s.h / 2 - 0.5);
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const v = d[sy * s.w + sx]; if (!(v >>> 24)) continue;
      if (mode === 1) pset(cx + dx, cy + dy, 0xFFFFFFFF); else if (mode === 2) blend(cx + dx, cy + dy, v, arg); else pset(cx + dx, cy + dy, v);
    }
  }
  // wide background layer blit with horizontal wrap
  function blitWrap(s, ox, y) {
    const w = s.w, td = T.d, tw = T.w;
    let off = Math.floor(ox) % w; if (off < 0) off += w;
    for (let j = 0; j < s.h; j++) {
      const yy = y + j; if (yy < 0 || yy >= T.h) continue;
      const ro = j * w, wo = yy * tw;
      for (let x = 0; x < tw; x++) { let sx = x + off; if (sx >= w) sx -= w; const v = s.d[ro + sx]; if (v >>> 24) td[wo + x] = v; }
    }
  }

  // ---------------------------------------------------------------- 5x7 font
  const FONT = {
    A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1e11111111111e', E: '1f10101e10101f', F: '1f10101e101010', G: '0e111017111 10f',
    H: '1111111f111111', I: '0e04040404040e', J: '0702020202120c', K: '11121418141211', L: '1010101010101f', M: '111b1515111111', N: '11111915131111',
    O: '0e11111111110e', P: '1e11111e101010', Q: '0e11111115120d', R: '1e11111e141211', S: '0f10100e01011e', T: '1f040404040404', U: '1111111111110e',
    V: '1111111111 0a04', W: '1111111515150a', X: '11110a040a1111', Y: '11110a04040404', Z: '1f01020408101f',
    0: '0e11131519110e', 1: '040c040404040e', 2: '0e11010204081f', 3: '1f02040201110e', 4: '02060a121f0202', 5: '1f101e0101110e', 6: '0608101e11110e',
    7: '1f010204080808', 8: '0e11110e11110e', 9: '0e11110f01020c',
    ' ': '00000000000000', '.': '00000000000c0c', ',': '000000000c0408', '!': '04040404040004', '?': '0e110102040004', ':': '000c0c000c0c00',
    '-': '0000001f000000', '+': '0004041f040400', '/': '01010204081010', "'": '04040800000000', '"': '0a0a0000000000', '(': '02040808080402',
    ')': '08040202020408', '<': '02040810080402', '>': '08040201020408', '=': '00001f001f0000', '*': '0004150e150400', '&': '0c121408151 20d',
    '#': '0a0a1f0a1f0a0a', '%': '18190204081303', '_': '0000000000001f', '$': '040f140e051e04', '[': '0e08080808080e', ']': '0e02020202020e',
    '@': '0e11171517100e', '·': '0000000c0c0000', '~': '00000915120000', '|': '04040404040404',
  };
  const GLYPH = {};
  for (const k in FONT) { const s = FONT[k].replace(/ /g, ''); const rows = []; for (let i = 0; i < 7; i++) rows.push(parseInt(s.substr(i * 2, 2), 16) || 0); GLYPH[k] = rows; }
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  function text(s, x, y, c, sh = 0, sc = 1) {
    s = norm(s); let cx = x | 0;
    for (const ch of s) {
      const g = GLYPH[ch] || GLYPH['?'];
      for (let r = 0; r < 7; r++) { const bits = g[r]; if (!bits) continue; for (let b = 0; b < 5; b++) if (bits & (16 >> b)) { if (sh) rect(cx + b * sc + sc, y + r * sc + sc, sc, sc, sh); rect(cx + b * sc, y + r * sc, sc, sc, c); } }
      cx += 6 * sc;
    }
    return cx - x;
  }
  const textW = (s, sc = 1) => norm(s).length * 6 * sc - sc;
  const textC = (s, cx, y, c, sh = 0, sc = 1) => text(s, Math.round(cx - textW(s, sc) / 2), y, c, sh, sc);

  // deterministic hash noise for procedural textures
  function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  return {
    W, H, fb, fx, rgb, hex, mix, shade, init, target, present,
    clear, pset, pget, blend, add, rect, rectA, frame, hline, line, thick, disc, ellipse, ring, glow, poly,
    makeSprite, outline, fromAscii, refresh, blit, blitRot, blitWrap, text, textW, textC, hash, rng,
    get T() { return T; },
  };
})();
