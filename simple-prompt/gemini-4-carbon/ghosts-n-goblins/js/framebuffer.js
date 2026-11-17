/* ============================================================================
 * js/framebuffer.js
 * CPS-1 / EGA-VGA 320x200 32-bit Software Framebuffer, Bayer Dithering,
 * Sprite Blitter, Lightning Generator & Arcade Bitmap Font
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});

  const WIDTH = 320;
  const HEIGHT = 200;

  // Detect endianness once for Uint32Array <-> ImageData RGBA bytes
  const endianTestBuf = new ArrayBuffer(4);
  const endianU8 = new Uint8Array(endianTestBuf);
  const endianU32 = new Uint32Array(endianTestBuf);
  endianU8[0] = 0x11;
  endianU8[1] = 0x22;
  endianU8[2] = 0x33;
  endianU8[3] = 0xff;
  const IS_LITTLE_ENDIAN = endianU32[0] === 0xff332211;

  function packRGB(r, g, b) {
    const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    if (IS_LITTLE_ENDIAN) {
      return (0xff000000 | (cb << 16) | (cg << 8) | cr) >>> 0;
    }
    return ((cr << 24) | (cg << 16) | (cb << 8) | 0xff) >>> 0;
  }

  function hexToCol(hex) {
    const clean = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
    const n = parseInt(clean, 16);
    return packRGB((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }

  function hexToRGB(hex) {
    const clean = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // 4x4 Bayer ordered dithering matrix (0..15)
  const BAYER4 = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
  ];

  // Crisp 5x7 Arcade Pixel Font (each char = 7 rows of 5-bit integers, MSB left)
  const FONT_5X7 = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    '!': [4, 4, 4, 4, 4, 0, 4],
    '"': [10, 10, 4, 0, 0, 0, 0],
    '#': [10, 31, 10, 10, 31, 10, 0],
    '%': [25, 25, 2, 4, 8, 19, 19],
    '&': [12, 18, 20, 8, 21, 18, 13],
    "'": [4, 4, 2, 0, 0, 0, 0],
    '(': [2, 4, 8, 8, 8, 4, 2],
    ')': [8, 4, 2, 2, 2, 4, 8],
    '*': [0, 4, 21, 14, 21, 4, 0],
    '+': [0, 4, 4, 31, 4, 4, 0],
    ',': [0, 0, 0, 0, 4, 4, 8],
    '-': [0, 0, 0, 31, 0, 0, 0],
    '.': [0, 0, 0, 0, 0, 0, 4],
    '/': [1, 2, 2, 4, 8, 8, 16],
    '0': [14, 17, 19, 21, 25, 17, 14],
    '1': [4, 12, 4, 4, 4, 4, 14],
    '2': [14, 17, 1, 6, 8, 16, 31],
    '3': [31, 2, 4, 6, 1, 17, 14],
    '4': [2, 6, 10, 18, 31, 2, 2],
    '5': [31, 16, 30, 1, 1, 17, 14],
    '6': [6, 8, 16, 30, 17, 17, 14],
    '7': [31, 1, 2, 4, 8, 8, 8],
    '8': [14, 17, 17, 14, 17, 17, 14],
    '9': [14, 17, 17, 15, 1, 2, 12],
    ':': [0, 4, 4, 0, 4, 4, 0],
    ';': [0, 4, 0, 0, 4, 4, 8],
    '<': [2, 4, 8, 16, 8, 4, 2],
    '=': [0, 0, 31, 0, 31, 0, 0],
    '>': [8, 4, 2, 1, 2, 4, 8],
    '?': [14, 17, 1, 2, 4, 0, 4],
    '[': [14, 8, 8, 8, 8, 8, 14],
    ']': [14, 2, 2, 2, 2, 2, 14],
    '_': [0, 0, 0, 0, 0, 0, 31],
    'A': [14, 17, 17, 31, 17, 17, 17],
    'B': [30, 17, 17, 30, 17, 17, 30],
    'C': [14, 17, 16, 16, 16, 17, 14],
    'D': [30, 17, 17, 17, 17, 17, 30],
    'E': [31, 16, 16, 30, 16, 16, 31],
    'F': [31, 16, 16, 30, 16, 16, 16],
    'G': [14, 17, 16, 23, 17, 17, 15],
    'H': [17, 17, 17, 31, 17, 17, 17],
    'I': [14, 4, 4, 4, 4, 4, 14],
    'J': [7, 2, 2, 2, 18, 18, 12],
    'K': [17, 18, 20, 24, 20, 18, 17],
    'L': [16, 16, 16, 16, 16, 16, 31],
    'M': [17, 27, 21, 21, 17, 17, 17],
    'N': [17, 25, 21, 19, 17, 17, 17],
    'O': [14, 17, 17, 17, 17, 17, 14],
    'P': [30, 17, 17, 30, 16, 16, 16],
    'Q': [14, 17, 17, 17, 21, 18, 13],
    'R': [30, 17, 17, 30, 20, 18, 17],
    'S': [15, 16, 16, 14, 1, 1, 30],
    'T': [31, 4, 4, 4, 4, 4, 4],
    'U': [17, 17, 17, 17, 17, 17, 14],
    'V': [17, 17, 17, 17, 17, 10, 4],
    'W': [17, 17, 17, 21, 21, 27, 17],
    'X': [17, 17, 10, 4, 10, 17, 17],
    'Y': [17, 17, 10, 4, 4, 4, 4],
    'Z': [31, 1, 2, 4, 8, 16, 31]
  };

  class Framebuffer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.width = WIDTH;
      this.height = HEIGHT;
      this.imageData = this.ctx.createImageData(WIDTH, HEIGHT);
      this.buf8 = this.imageData.data;
      this.pixels = new Uint32Array(this.buf8.buffer);
      this.shakeX = 0;
      this.shakeY = 0;
      this.clear(packRGB(8, 9, 12));
    }

    clear(col) {
      this.pixels.fill(col);
    }

    pset(x, y, col) {
      const ix = (x + this.shakeX) | 0;
      const iy = (y + this.shakeY) | 0;
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      this.pixels[iy * WIDTH + ix] = col;
    }

    psetRaw(ix, iy, col) {
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      this.pixels[iy * WIDTH + ix] = col;
    }

    psetAdd(x, y, r, g, b) {
      const ix = (x + this.shakeX) | 0;
      const iy = (y + this.shakeY) | 0;
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      const idx = (iy * WIDTH + ix) << 2;
      const nr = this.buf8[idx] + r;
      const ng = this.buf8[idx + 1] + g;
      const nb = this.buf8[idx + 2] + b;
      this.buf8[idx] = nr > 255 ? 255 : nr;
      this.buf8[idx + 1] = ng > 255 ? 255 : ng;
      this.buf8[idx + 2] = nb > 255 ? 255 : nb;
    }

    psetBlend(x, y, r, g, b, alpha) {
      const ix = (x + this.shakeX) | 0;
      const iy = (y + this.shakeY) | 0;
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      const idx = (iy * WIDTH + ix) << 2;
      const inv = 256 - alpha;
      this.buf8[idx] = (this.buf8[idx] * inv + r * alpha) >> 8;
      this.buf8[idx + 1] = (this.buf8[idx + 1] * inv + g * alpha) >> 8;
      this.buf8[idx + 2] = (this.buf8[idx + 2] * inv + b * alpha) >> 8;
    }

    rect(x, y, w, h, col, ignoreShake) {
      let x0 = (ignoreShake ? x : x + this.shakeX) | 0;
      let y0 = (ignoreShake ? y : y + this.shakeY) | 0;
      let x1 = x0 + (w | 0);
      let y1 = y0 + (h | 0);
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > WIDTH) x1 = WIDTH;
      if (y1 > HEIGHT) y1 = HEIGHT;
      if (x0 >= x1 || y0 >= y1) return;
      const pix = this.pixels;
      for (let py = y0; py < y1; py++) {
        let row = py * WIDTH + x0;
        const end = py * WIDTH + x1;
        while (row < end) {
          pix[row++] = col;
        }
      }
    }

    rectOutline(x, y, w, h, col, ignoreShake) {
      this.rect(x, y, w, 1, col, ignoreShake);
      this.rect(x, y + h - 1, w, 1, col, ignoreShake);
      this.rect(x, y, 1, h, col, ignoreShake);
      this.rect(x + w - 1, y, 1, h, col, ignoreShake);
    }

    rectBlend(x, y, w, h, r, g, b, alpha, ignoreShake) {
      let x0 = (ignoreShake ? x : x + this.shakeX) | 0;
      let y0 = (ignoreShake ? y : y + this.shakeY) | 0;
      let x1 = x0 + (w | 0);
      let y1 = y0 + (h | 0);
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > WIDTH) x1 = WIDTH;
      if (y1 > HEIGHT) y1 = HEIGHT;
      if (x0 >= x1 || y0 >= y1) return;
      const inv = 256 - alpha;
      const b8 = this.buf8;
      for (let py = y0; py < y1; py++) {
        let idx = (py * WIDTH + x0) << 2;
        const end = (py * WIDTH + x1) << 2;
        while (idx < end) {
          b8[idx] = (b8[idx] * inv + r * alpha) >> 8;
          b8[idx + 1] = (b8[idx + 1] * inv + g * alpha) >> 8;
          b8[idx + 2] = (b8[idx + 2] * inv + b * alpha) >> 8;
          idx += 4;
        }
      }
    }

    ditherGradientV(x, y, w, h, rgbTop, rgbBot) {
      let x0 = x | 0;
      let y0 = y | 0;
      let x1 = (x + w) | 0;
      let y1 = (y + h) | 0;
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > WIDTH) x1 = WIDTH;
      if (y1 > HEIGHT) y1 = HEIGHT;
      const span = Math.max(1, h - 1);
      // Quantize to 6 discrete EGA/CPS-1 bands with Bayer dithering between bands
      const bands = 6;
      const palette = new Uint32Array(bands + 1);
      for (let i = 0; i <= bands; i++) {
        const t = i / bands;
        palette[i] = packRGB(
          rgbTop[0] + (rgbBot[0] - rgbTop[0]) * t,
          rgbTop[1] + (rgbBot[1] - rgbTop[1]) * t,
          rgbTop[2] + (rgbBot[2] - rgbTop[2]) * t
        );
      }
      const pix = this.pixels;
      for (let py = y0; py < y1; py++) {
        const pos = ((py - y) / span) * bands;
        const baseBand = Math.min(bands - 1, pos | 0);
        const frac = ((pos - baseBand) * 16) | 0;
        const cA = palette[baseBand];
        const cB = palette[baseBand + 1];
        const by = (py & 3) << 2;
        let row = py * WIDTH + x0;
        for (let px = x0; px < x1; px++) {
          pix[row++] = frac > BAYER4[by + (px & 3)] ? cB : cA;
        }
      }
    }

    line(x0, y0, x1, y1, col) {
      let ix0 = (x0 + this.shakeX) | 0;
      let iy0 = (y0 + this.shakeY) | 0;
      const ix1 = (x1 + this.shakeX) | 0;
      const iy1 = (y1 + this.shakeY) | 0;
      const dx = Math.abs(ix1 - ix0);
      const sx = ix0 < ix1 ? 1 : -1;
      const dy = -Math.abs(iy1 - iy0);
      const sy = iy0 < iy1 ? 1 : -1;
      let err = dx + dy;
      let guard = 600;
      while (guard-- > 0) {
        if (ix0 >= 0 && ix0 < WIDTH && iy0 >= 0 && iy0 < HEIGHT) {
          this.pixels[iy0 * WIDTH + ix0] = col;
        }
        if (ix0 === ix1 && iy0 === iy1) break;
        const e2 = err << 1;
        if (e2 >= dy) {
          err += dy;
          ix0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          iy0 += sy;
        }
      }
    }

    lightningBolt(x0, y0, x1, y1, seed, coreCol, glowR, glowG, glowB) {
      let s = (seed * 1664525 + 1013904223) >>> 0;
      const nextRand = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return (s >>> 8) / 16777216;
      };
      const steps = 8;
      let px = x0;
      let py = y0;
      const glowCol = packRGB(glowR, glowG, glowB);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const nx = i === steps ? x1 : x0 + (x1 - x0) * t + (nextRand() - 0.5) * 26;
        const ny = y0 + (y1 - y0) * t;
        this.line(px - 1, py, nx - 1, ny, glowCol);
        this.line(px + 1, py, nx + 1, ny, glowCol);
        this.line(px, py, nx, ny, coreCol);
        if (i > 1 && i < steps - 1 && nextRand() < 0.48) {
          const bx = nx + (nextRand() < 0.5 ? -1 : 1) * (10 + nextRand() * 18);
          const by = ny + 12 + nextRand() * 18;
          this.line(nx, ny, bx, by, glowCol);
        }
        px = nx;
        py = ny;
      }
    }

    circle(cx, cy, r, col, ignoreShake) {
      const ox = (ignoreShake ? cx : cx + this.shakeX) | 0;
      const oy = (ignoreShake ? cy : cy + this.shakeY) | 0;
      const ir = r | 0;
      const r2 = ir * ir;
      const pix = this.pixels;
      for (let dy = -ir; dy <= ir; dy++) {
        const py = oy + dy;
        if (py < 0 || py >= HEIGHT) continue;
        const span = Math.sqrt(r2 - dy * dy) | 0;
        let x0 = ox - span;
        let x1 = ox + span;
        if (x0 < 0) x0 = 0;
        if (x1 >= WIDTH) x1 = WIDTH - 1;
        let row = py * WIDTH + x0;
        for (let px = x0; px <= x1; px++) {
          pix[row++] = col;
        }
      }
    }

    glowCircle(cx, cy, r, cr, cg, cb) {
      const ox = (cx + this.shakeX) | 0;
      const oy = (cy + this.shakeY) | 0;
      const ir = r | 0;
      if (ir <= 0) return;
      const r2 = ir * ir;
      const b8 = this.buf8;
      for (let dy = -ir; dy <= ir; dy++) {
        const py = oy + dy;
        if (py < 0 || py >= HEIGHT) continue;
        const dy2 = dy * dy;
        for (let dx = -ir; dx <= ir; dx++) {
          const d2 = dx * dx + dy2;
          if (d2 > r2) continue;
          const px = ox + dx;
          if (px < 0 || px >= WIDTH) continue;
          const falloff = 1 - d2 / r2;
          const idx = (py * WIDTH + px) << 2;
          const ar = b8[idx] + ((cr * falloff) | 0);
          const ag = b8[idx + 1] + ((cg * falloff) | 0);
          const ab = b8[idx + 2] + ((cb * falloff) | 0);
          b8[idx] = ar > 255 ? 255 : ar;
          b8[idx + 1] = ag > 255 ? 255 : ag;
          b8[idx + 2] = ab > 255 ? 255 : ab;
        }
      }
    }

    blit(sprite, dx, dy, flipX, flipY, tintCol, ditherGhost, ignoreShake) {
      if (!sprite) return;
      const sw = sprite.w;
      const sh = sprite.h;
      const ox = (ignoreShake ? dx : dx + this.shakeX) | 0;
      const oy = (ignoreShake ? dy : dy + this.shakeY) | 0;
      if (ox + sw <= 0 || ox >= WIDTH || oy + sh <= 0 || oy >= HEIGHT) return;

      const sdata = sprite.data;
      const pix = this.pixels;

      const syStart = oy < 0 ? -oy : 0;
      const syEnd = oy + sh > HEIGHT ? HEIGHT - oy : sh;
      const sxStart = ox < 0 ? -ox : 0;
      const sxEnd = ox + sw > WIDTH ? WIDTH - ox : sw;

      for (let sy = syStart; sy < syEnd; sy++) {
        const srcY = flipY ? sh - 1 - sy : sy;
        const srcRow = srcY * sw;
        const dstY = oy + sy;
        const dstRow = dstY * WIDTH + ox;
        for (let sx = sxStart; sx < sxEnd; sx++) {
          if (ditherGhost && ((dstY + ox + sx) & 1) === 1) continue;
          const srcX = flipX ? sw - 1 - sx : sx;
          const c = sdata[srcRow + srcX];
          if (c !== 0) {
            pix[dstRow + sx] = tintCol ? tintCol : c;
          }
        }
      }
    }

    blitScaled(sprite, dx, dy, scaleX, scaleY, flipX, tintCol, ignoreShake) {
      if (!sprite) return;
      const dw = Math.max(1, (sprite.w * scaleX) | 0);
      const dh = Math.max(1, (sprite.h * scaleY) | 0);
      const ox = (ignoreShake ? dx : dx + this.shakeX) | 0;
      const oy = (ignoreShake ? dy : dy + this.shakeY) | 0;
      if (ox + dw <= 0 || ox >= WIDTH || oy + dh <= 0 || oy >= HEIGHT) return;

      const sdata = sprite.data;
      const sw = sprite.w;
      const sh = sprite.h;
      const pix = this.pixels;

      for (let py = 0; py < dh; py++) {
        const dstY = oy + py;
        if (dstY < 0 || dstY >= HEIGHT) continue;
        const sy = Math.min(sh - 1, ((py * sh) / dh) | 0);
        const srcRow = sy * sw;
        const dstRow = dstY * WIDTH;
        for (let px = 0; px < dw; px++) {
          const dstX = ox + px;
          if (dstX < 0 || dstX >= WIDTH) continue;
          let sx = Math.min(sw - 1, ((px * sw) / dw) | 0);
          if (flipX) sx = sw - 1 - sx;
          const c = sdata[srcRow + sx];
          if (c !== 0) {
            pix[dstRow + dstX] = tintCol ? tintCol : c;
          }
        }
      }
    }

    text(str, x, y, col, shadowCol, scale) {
      const s = scale || 1;
      const upper = String(str).toUpperCase();
      let cx = x | 0;
      const cy = y | 0;
      const pix = this.pixels;

      for (let i = 0; i < upper.length; i++) {
        const glyph = FONT_5X7[upper[i]] || FONT_5X7[' '];
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row];
          if (bits === 0) continue;
          for (let colBit = 0; colBit < 5; colBit++) {
            if ((bits & (16 >> colBit)) === 0) continue;
            for (let sy = 0; sy < s; sy++) {
              const py = cy + row * s + sy;
              for (let sx = 0; sx < s; sx++) {
                const px = cx + colBit * s + sx;
                if (shadowCol) {
                  const spx = px + s;
                  const spy = py + s;
                  if (spx >= 0 && spx < WIDTH && spy >= 0 && spy < HEIGHT) {
                    pix[spy * WIDTH + spx] = shadowCol;
                  }
                }
              }
            }
          }
        }
        // Foreground pass so shadow never overwrites glyph pixels
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row];
          if (bits === 0) continue;
          for (let colBit = 0; colBit < 5; colBit++) {
            if ((bits & (16 >> colBit)) === 0) continue;
            for (let sy = 0; sy < s; sy++) {
              const py = cy + row * s + sy;
              if (py < 0 || py >= HEIGHT) continue;
              for (let sx = 0; sx < s; sx++) {
                const px = cx + colBit * s + sx;
                if (px >= 0 && px < WIDTH) {
                  pix[py * WIDTH + px] = col;
                }
              }
            }
          }
        }
        cx += 6 * s;
      }
    }

    textGradient(str, x, y, topCol, midCol, botCol, shadowCol, scale) {
      const s = scale || 1;
      const upper = String(str).toUpperCase();
      let cx = x | 0;
      const cy = y | 0;
      const pix = this.pixels;

      for (let i = 0; i < upper.length; i++) {
        const glyph = FONT_5X7[upper[i]] || FONT_5X7[' '];
        if (shadowCol) {
          for (let row = 0; row < 7; row++) {
            const bits = glyph[row];
            if (bits === 0) continue;
            for (let colBit = 0; colBit < 5; colBit++) {
              if ((bits & (16 >> colBit)) === 0) continue;
              for (let sy = 0; sy < s; sy++) {
                const spy = cy + row * s + sy + s;
                if (spy < 0 || spy >= HEIGHT) continue;
                for (let sx = 0; sx < s; sx++) {
                  const spx = cx + colBit * s + sx + s;
                  if (spx >= 0 && spx < WIDTH) pix[spy * WIDTH + spx] = shadowCol;
                }
              }
            }
          }
        }
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row];
          if (bits === 0) continue;
          const rowCol = row < 2 ? topCol : row < 5 ? midCol : botCol;
          for (let colBit = 0; colBit < 5; colBit++) {
            if ((bits & (16 >> colBit)) === 0) continue;
            for (let sy = 0; sy < s; sy++) {
              const py = cy + row * s + sy;
              if (py < 0 || py >= HEIGHT) continue;
              for (let sx = 0; sx < s; sx++) {
                const px = cx + colBit * s + sx;
                if (px >= 0 && px < WIDTH) pix[py * WIDTH + px] = rowCol;
              }
            }
          }
        }
        cx += 6 * s;
      }
    }

    textWidth(str, scale) {
      const s = scale || 1;
      return Math.max(0, String(str).length * 6 * s - s);
    }

    textCentered(str, y, col, shadowCol, scale) {
      const w = this.textWidth(str, scale);
      this.text(str, ((WIDTH - w) >> 1), y, col, shadowCol, scale);
    }

    textGradientCentered(str, y, topCol, midCol, botCol, shadowCol, scale) {
      const w = this.textWidth(str, scale);
      this.textGradient(str, ((WIDTH - w) >> 1), y, topCol, midCol, botCol, shadowCol, scale);
    }

    applyLightningFlash(intensity, r, g, b) {
      if (intensity <= 0.01) return;
      const addR = (r * intensity) | 0;
      const addG = (g * intensity) | 0;
      const addB = (b * intensity) | 0;
      const b8 = this.buf8;
      const len = b8.length;
      for (let i = 0; i < len; i += 4) {
        const nr = b8[i] + addR;
        const ng = b8[i + 1] + addG;
        const nb = b8[i + 2] + addB;
        b8[i] = nr > 255 ? 255 : nr;
        b8[i + 1] = ng > 255 ? 255 : ng;
        b8[i + 2] = nb > 255 ? 255 : nb;
      }
    }

    applySpectralRim(pulse) {
      // Subtle cyan spectral-vision border pulse in Boxer Shorts / Possession mode
      const borderCol = packRGB(30, (140 + pulse * 60) | 0, (150 + pulse * 65) | 0);
      const pix = this.pixels;
      for (let x = 0; x < WIDTH; x++) {
        if ((x & 1) === 0) {
          pix[22 * WIDTH + x] = borderCol;
          pix[(HEIGHT - 1) * WIDTH + x] = borderCol;
        }
      }
      for (let y = 22; y < HEIGHT; y += 2) {
        pix[y * WIDTH] = borderCol;
        pix[y * WIDTH + WIDTH - 1] = borderCol;
      }
    }

    present() {
      this.ctx.putImageData(this.imageData, 0, 0);
    }
  }

  GNG.WIDTH = WIDTH;
  GNG.HEIGHT = HEIGHT;
  GNG.packRGB = packRGB;
  GNG.hexToCol = hexToCol;
  GNG.hexToRGB = hexToRGB;
  GNG.Framebuffer = Framebuffer;
})();
