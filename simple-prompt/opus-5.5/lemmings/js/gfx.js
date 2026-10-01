/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — gfx.js
 * 320x200 software framebuffer (Uint32Array over ImageData), colour helpers
 * and two hand-encoded bitmap fonts (5x7 and 3x5). Zero external assets.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;

  const rgb = (BT.rgb = (r, g, b) => (0xff000000 | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0);
  BT.hexc = (h) => rgb((h >> 16) & 255, (h >> 8) & 255, h & 255);
  BT.unpack = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
  BT.mix = (a, b, t) => {
    const r1 = a & 255, g1 = (a >> 8) & 255, b1 = (a >> 16) & 255;
    const r2 = b & 255, g2 = (b >> 8) & 255, b2 = (b >> 16) & 255;
    return rgb(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
  };
  BT.shade = (c, f) => {
    const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    return rgb(cl((c & 255) * f), cl(((c >> 8) & 255) * f), cl(((c >> 16) & 255) * f));
  };

  /* ---------------- 5x7 font (rows as 5-bit ints, MSB = left) ---------------- */
  const F5 = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
    D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
    J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
    V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
    3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
    6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
    9: [14, 17, 17, 15, 1, 2, 12],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
    ':': [0, 12, 12, 0, 12, 12, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
    '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '%': [24, 25, 2, 4, 8, 19, 3],
    '/': [0, 1, 2, 4, 8, 16, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
    "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 0, 0, 0, 0, 0], '=': [0, 0, 31, 0, 31, 0, 0],
    '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '[': [14, 8, 8, 8, 8, 8, 14],
    ']': [14, 2, 2, 2, 2, 2, 14], '#': [10, 10, 31, 10, 31, 10, 10], '*': [0, 4, 21, 14, 21, 4, 0],
    '_': [0, 0, 0, 0, 0, 0, 31], '&': [12, 18, 20, 8, 21, 18, 13], '^': [4, 10, 17, 0, 0, 0, 0],
    '~': [0, 0, 8, 21, 2, 0, 0], '@': [14, 17, 23, 21, 23, 16, 14], '|': [4, 4, 4, 4, 4, 4, 4],
  };
  /* ---------------- 3x5 mini font ---------------- */
  const F3 = {
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 3, 1, 7], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
    K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
    P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
    Z: [7, 1, 2, 4, 7], ' ': [0, 0, 0, 0, 0], '-': [0, 0, 7, 0, 0], '%': [5, 1, 2, 4, 5],
    ':': [0, 2, 0, 2, 0], '.': [0, 0, 0, 0, 2], '/': [1, 1, 2, 4, 4], '+': [0, 2, 7, 2, 0],
    '!': [2, 2, 2, 0, 2], '>': [4, 2, 1, 2, 4], '<': [1, 2, 4, 2, 1], '?': [6, 1, 2, 0, 2],
    '#': [5, 7, 5, 7, 5], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], '=': [0, 7, 0, 7, 0],
    '*': [5, 2, 5, 0, 0], "'": [2, 2, 0, 0, 0], '[': [3, 2, 2, 2, 3], ']': [6, 2, 2, 2, 6],
  };

  class Gfx {
    constructor(canvas) {
      this.canvas = canvas;
      this.w = BT.SCREEN_W;
      this.h = BT.SCREEN_H;
      this.ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
      if (this.ctx) {
        this.img = this.ctx.createImageData(this.w, this.h);
        this.buf = new Uint32Array(this.img.data.buffer);
      } else this.buf = new Uint32Array(this.w * this.h);
      this.clipY1 = this.h;
    }
    present() { this.ctx.putImageData(this.img, 0, 0); }
    clear(c) { this.buf.fill(c); }
    pset(x, y, c) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.clipY1) return;
      this.buf[y * this.w + x] = c;
    }
    blend(x, y, c, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.clipY1) return;
      const i = y * this.w + x;
      this.buf[i] = BT.mix(this.buf[i], c, a);
    }
    rect(x, y, w, h, c) {
      const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
      const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.clipY1, (y + h) | 0);
      for (let j = y0; j < y1; j++) this.buf.fill(c, j * this.w + x0, j * this.w + x1);
    }
    rectBlend(x, y, w, h, c, a) {
      for (let j = Math.max(0, y); j < Math.min(this.clipY1, y + h); j++)
        for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.blend(i, j, c, a);
    }
    frame(x, y, w, h, c) {
      this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
      this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
    }
    bevel(x, y, w, h, face, hi, lo) {
      this.rect(x, y, w, h, face);
      this.rect(x, y, w, 1, hi); this.rect(x, y, 1, h, hi);
      this.rect(x, y + h - 1, w, 1, lo); this.rect(x + w - 1, y, 1, h, lo);
    }
    line(x0, y0, x1, y1, c) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        this.pset(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    circle(cx, cy, r, c, fill) {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (fill ? d <= r * r + r : d <= r * r + r && d >= r * r - r) this.pset(cx + x, cy + y, c);
      }
    }
    /* text: font 5 (5x7, advance 6) or 3 (3x5, advance 4); scale s */
    text(str, x, y, c, font, s, shadow) {
      str = String(str).toUpperCase();
      const f = font === 3 ? F3 : F5, gw = font === 3 ? 3 : 5, gh = font === 3 ? 5 : 7;
      s = s || 1;
      if (shadow !== undefined && shadow !== null) this.text(str, x + s, y + s, shadow, font, s);
      let cx = x;
      for (const ch of str) {
        const g = f[ch] || f['?'];
        for (let r = 0; r < gh; r++) {
          const row = g[r];
          if (!row) continue;
          for (let b = 0; b < gw; b++) if (row & (1 << (gw - 1 - b))) {
            if (s === 1) this.pset(cx + b, y + r, c);
            else this.rect(cx + b * s, y + r * s, s, s, c);
          }
        }
        cx += (gw + 1) * s;
      }
      return cx;
    }
    textW(str, font, s) { return String(str).length * ((font === 3 ? 4 : 6) * (s || 1)); }
    textC(str, cx, y, c, font, s, shadow) { return this.text(str, Math.round(cx - this.textW(str, font, s) / 2), y, c, font, s, shadow); }
    /* Sprite: list of [dx,dy,color]; flip mirrors dx. */
    spr(list, x, y, flip, tint) {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        this.pset(x + (flip ? -p[0] : p[0]), y + p[1], tint || p[2]);
      }
    }
  }
  BT.Gfx = Gfx;
})(typeof window !== 'undefined' ? window : globalThis);
