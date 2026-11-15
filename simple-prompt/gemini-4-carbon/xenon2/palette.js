(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});

  const WIDTH = 320;
  const HEIGHT = 200;

  // Detect endianness once for direct Uint32Array ImageData writes
  const endianCheck = new Uint32Array([0x11223344]);
  const IS_LITTLE_ENDIAN = new Uint8Array(endianCheck.buffer)[0] === 0x44;

  function packRGB(r, g, b, a = 255) {
    const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const ca = a < 0 ? 0 : a > 255 ? 255 : a | 0;
    return IS_LITTLE_ENDIAN
      ? ((ca << 24) | (cb << 16) | (cg << 8) | cr) >>> 0
      : ((cr << 24) | (cg << 16) | (cb << 8) | ca) >>> 0;
  }

  function unpackRGB(col) {
    if (IS_LITTLE_ENDIAN) {
      return {
        r: col & 0xff,
        g: (col >>> 8) & 0xff,
        b: (col >>> 16) & 0xff,
        a: (col >>> 24) & 0xff
      };
    }
    return {
      r: (col >>> 24) & 0xff,
      g: (col >>> 16) & 0xff,
      b: (col >>> 8) & 0xff,
      a: col & 0xff
    };
  }

  function lerpColorRGB(stops, t) {
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    const scaled = clamped * (stops.length - 1);
    const idx = Math.min(stops.length - 2, scaled | 0);
    const frac = scaled - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    return [
      Math.round(a[0] + (b[0] - a[0]) * frac),
      Math.round(a[1] + (b[1] - a[1]) * frac),
      Math.round(a[2] + (b[2] - a[2]) * frac)
    ];
  }

  // Build authentic VGA Mode 13h 256-color palette in 16-color specular ramps
  const PALETTE = new Uint32Array(256);
  const PALETTE_RGB = new Array(256);

  function setRamp(baseIdx, count, stops) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const rgb = lerpColorRGB(stops, t);
      PALETTE_RGB[baseIdx + i] = rgb;
      PALETTE[baseIdx + i] = packRGB(rgb[0], rgb[1], rgb[2], 255);
    }
  }

  // 0..15: Bitmap Brothers Signature Chrome & Specular Steel
  setRamp(0, 16, [
    [4, 6, 12],
    [12, 17, 29],
    [24, 34, 52],
    [43, 58, 84],
    [72, 92, 122],
    [114, 138, 170],
    [168, 192, 218],
    [224, 240, 252],
    [255, 255, 255]
  ]);

  // 16..31: Dark Industrial Gunmetal & Slate Blue
  setRamp(16, 16, [
    [5, 8, 15],
    [14, 22, 38],
    [26, 41, 66],
    [42, 65, 98],
    [66, 96, 136],
    [102, 138, 180],
    [152, 188, 224],
    [212, 234, 250]
  ]);

  // 32..47: Babbage Brass, Bronze & Polished Gold
  setRamp(32, 16, [
    [14, 8, 3],
    [38, 20, 7],
    [74, 41, 12],
    [118, 68, 18],
    [168, 106, 28],
    [214, 154, 46],
    [246, 208, 96],
    [255, 248, 196]
  ]);

  // 48..63: Cambrian Coral, Chitin Rust & Crimson
  setRamp(48, 16, [
    [16, 5, 10],
    [44, 12, 22],
    [84, 22, 36],
    [132, 38, 52],
    [182, 64, 72],
    [224, 104, 96],
    [248, 162, 142],
    [255, 226, 214]
  ]);

  // 64..79: Abyssal Cyan & Electro-Arc Plasma
  setRamp(64, 16, [
    [3, 12, 22],
    [6, 28, 48],
    [10, 56, 88],
    [16, 98, 142],
    [28, 152, 202],
    [64, 208, 244],
    [148, 240, 255],
    [236, 254, 255]
  ]);

  // 80..95: Xenite Bio-Emerald, Acid 303 & Crispin Scales
  setRamp(80, 16, [
    [4, 14, 8],
    [10, 34, 18],
    [18, 66, 34],
    [32, 108, 54],
    [56, 158, 76],
    [98, 208, 104],
    [166, 244, 152],
    [234, 255, 220]
  ]);

  // 96..111: Super Nashwan Magenta, Violet & Plasma Pink
  setRamp(96, 16, [
    [16, 4, 22],
    [42, 10, 56],
    [78, 18, 102],
    [126, 30, 154],
    [182, 52, 204],
    [232, 96, 238],
    [252, 166, 250],
    [255, 234, 255]
  ]);

  // 112..127: Megablast Fire, Incandescent Plasma & Explosions
  setRamp(112, 16, [
    [20, 4, 4],
    [58, 10, 8],
    [112, 20, 10],
    [174, 44, 12],
    [226, 88, 18],
    [250, 150, 34],
    [255, 214, 92],
    [255, 252, 220]
  ]);

  // 128..143: 1989 Demoscene Silicon Wafer & PCB Trace Teal-Gold
  setRamp(128, 16, [
    [4, 14, 16],
    [8, 34, 36],
    [14, 62, 60],
    [24, 98, 88],
    [46, 142, 118],
    [96, 186, 142],
    [172, 224, 168],
    [236, 250, 216]
  ]);

  // 144..159: Giger Biomechanical Bone & Wet Chrome
  setRamp(144, 16, [
    [8, 7, 12],
    [22, 20, 30],
    [42, 39, 54],
    [68, 64, 84],
    [102, 98, 118],
    [144, 140, 160],
    [192, 188, 204],
    [238, 236, 245]
  ]);

  // 160..223: 64-step Amiga Copper-Bar Rainbow / Prism LUT
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = Math.round(135 + 120 * Math.sin(a));
    const g = Math.round(135 + 120 * Math.sin(a + 2.094));
    const b = Math.round(135 + 120 * Math.sin(a + 4.188));
    PALETTE_RGB[160 + i] = [r, g, b];
    PALETTE[160 + i] = packRGB(r, g, b, 255);
  }

  // 224..255: Deep Cavern Atmosphere & Utility Shades
  setRamp(224, 32, [
    [2, 3, 7],
    [8, 12, 24],
    [18, 26, 48],
    [34, 48, 82],
    [58, 82, 128],
    [96, 128, 182],
    [156, 192, 236],
    [240, 250, 255]
  ]);

  const RAMP = {
    CHROME: 0,
    STEEL: 16,
    BRASS: 32,
    CORAL: 48,
    CYAN: 64,
    EMERALD: 80,
    NASHWAN: 96,
    FIRE: 112,
    SILICON: 128,
    BONE: 144,
    COPPER: 160,
    ABYSS: 224
  };

  // Bayer 4x4 ordered dithering matrix normalized to [-0.468, +0.468]
  const BAYER4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
  ].map((v) => (v / 16) - 0.46875);

  function sampleRamp(rampBase, rampLen, t, x, y, ditherStrength = 0.85) {
    const bayer = BAYER4[((y & 3) << 2) | (x & 3)] * ditherStrength;
    const idx = Math.round(t * (rampLen - 1) + bayer);
    const clamped = idx < 0 ? 0 : idx >= rampLen ? rampLen - 1 : idx;
    return PALETTE[rampBase + clamped];
  }

  function sampleRampIndex(rampBase, rampLen, t, x, y, ditherStrength = 0.85) {
    const bayer = BAYER4[((y & 3) << 2) | (x & 3)] * ditherStrength;
    const idx = Math.round(t * (rampLen - 1) + bayer);
    const clamped = idx < 0 ? 0 : idx >= rampLen ? rampLen - 1 : idx;
    return rampBase + clamped;
  }

  // Compact crisp 4x6 / 5x6 arcade pixel font for 320x200 in-canvas HUD & banners
  const FONT_GLYPHS = {
    ' ': [0, 0, 0, 0, 0],
    '!': [4, 4, 4, 0, 4],
    '"': [10, 10, 0, 0, 0],
    '#': [10, 31, 10, 31, 10],
    '$': [14, 20, 14, 5, 14],
    '%': [19, 2, 4, 8, 25],
    '&': [12, 18, 12, 18, 13],
    "'": [4, 4, 0, 0, 0],
    '(': [2, 4, 4, 4, 2],
    ')': [8, 4, 4, 4, 8],
    '*': [10, 4, 14, 4, 10],
    '+': [0, 4, 14, 4, 0],
    ',': [0, 0, 0, 4, 8],
    '-': [0, 0, 14, 0, 0],
    '.': [0, 0, 0, 0, 4],
    '/': [1, 2, 4, 8, 16],
    ':': [0, 4, 0, 4, 0],
    '<': [2, 4, 8, 4, 2],
    '=': [0, 14, 0, 14, 0],
    '>': [8, 4, 2, 4, 8],
    '?': [14, 1, 6, 0, 4],
    '[': [6, 4, 4, 4, 6],
    ']': [12, 4, 4, 4, 12],
    '0': [14, 19, 21, 25, 14],
    '1': [4, 12, 4, 4, 14],
    '2': [14, 1, 6, 8, 15],
    '3': [14, 1, 6, 1, 14],
    '4': [10, 10, 15, 2, 2],
    '5': [15, 8, 14, 1, 14],
    '6': [6, 8, 14, 9, 6],
    '7': [15, 1, 2, 4, 4],
    '8': [6, 9, 6, 9, 6],
    '9': [6, 9, 7, 1, 6],
    'A': [6, 9, 15, 9, 9],
    'B': [14, 9, 14, 9, 14],
    'C': [7, 8, 8, 8, 7],
    'D': [14, 9, 9, 9, 14],
    'E': [15, 8, 14, 8, 15],
    'F': [15, 8, 14, 8, 8],
    'G': [7, 8, 11, 9, 7],
    'H': [9, 9, 15, 9, 9],
    'I': [14, 4, 4, 4, 14],
    'J': [3, 1, 1, 9, 6],
    'K': [9, 10, 12, 10, 9],
    'L': [8, 8, 8, 8, 15],
    'M': [17, 27, 21, 17, 17],
    'N': [9, 13, 11, 9, 9],
    'O': [6, 9, 9, 9, 6],
    'P': [14, 9, 14, 8, 8],
    'Q': [6, 9, 9, 11, 7],
    'R': [14, 9, 14, 10, 9],
    'S': [7, 8, 6, 1, 14],
    'T': [31, 4, 4, 4, 4],
    'U': [9, 9, 9, 9, 6],
    'V': [17, 17, 17, 10, 4],
    'W': [17, 17, 21, 27, 17],
    'X': [9, 9, 6, 9, 9],
    'Y': [17, 10, 4, 4, 4],
    'Z': [15, 2, 4, 8, 15]
  };

  function glyphWidth(ch) {
    return ch === 'M' || ch === 'W' || ch === 'T' || ch === '#' || ch === '%' || ch === '0' || ch === '&' || ch === 'V' || ch === 'Y' ? 6 : 5;
  }

  function measureText(str, scale = 1) {
    const s = String(str).toUpperCase();
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      w += glyphWidth(s[i]) * scale;
    }
    return w;
  }

  class Framebuffer {
    constructor(canvas) {
      this.canvas = canvas;
      this.width = WIDTH;
      this.height = HEIGHT;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      this.ctx.imageSmoothingEnabled = false;
      this.imageData = this.ctx.createImageData(WIDTH, HEIGHT);
      this.pixels = new Uint32Array(this.imageData.data.buffer);
      this.bytes = this.imageData.data;
      this.postBuffer = new Uint32Array(WIDTH * HEIGHT);
    }

    clear(col = PALETTE[0]) {
      this.pixels.fill(col);
    }

    pset(x, y, col) {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      this.pixels[iy * WIDTH + ix] = col;
    }

    psetAdd(x, y, r, g, b) {
      const ix = x | 0;
      const iy = y | 0;
      if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) return;
      const off = (iy * WIDTH + ix) << 2;
      const nr = this.bytes[off] + (r | 0);
      const ng = this.bytes[off + 1] + (g | 0);
      const nb = this.bytes[off + 2] + (b | 0);
      this.bytes[off] = nr > 255 ? 255 : nr;
      this.bytes[off + 1] = ng > 255 ? 255 : ng;
      this.bytes[off + 2] = nb > 255 ? 255 : nb;
    }

    fillRect(x, y, w, h, col) {
      let x0 = x | 0;
      let y0 = y | 0;
      let x1 = (x + w) | 0;
      let y1 = (y + h) | 0;
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > WIDTH) x1 = WIDTH;
      if (y1 > HEIGHT) y1 = HEIGHT;
      if (x0 >= x1 || y0 >= y1) return;
      for (let py = y0; py < y1; py++) {
        const row = py * WIDTH;
        this.pixels.fill(col, row + x0, row + x1);
      }
    }

    hline(x, y, len, col) {
      const iy = y | 0;
      if (iy < 0 || iy >= HEIGHT) return;
      let x0 = x | 0;
      let x1 = (x + len) | 0;
      if (x0 < 0) x0 = 0;
      if (x1 > WIDTH) x1 = WIDTH;
      if (x0 >= x1) return;
      this.pixels.fill(col, iy * WIDTH + x0, iy * WIDTH + x1);
    }

    vline(x, y, len, col) {
      const ix = x | 0;
      if (ix < 0 || ix >= WIDTH) return;
      let y0 = y | 0;
      let y1 = (y + len) | 0;
      if (y0 < 0) y0 = 0;
      if (y1 > HEIGHT) y1 = HEIGHT;
      for (let py = y0; py < y1; py++) {
        this.pixels[py * WIDTH + ix] = col;
      }
    }

    drawBevelBox(x, y, w, h, rampBase = RAMP.CHROME) {
      this.fillRect(x, y, w, h, PALETTE[rampBase + 1]);
      this.hline(x, y, w, PALETTE[rampBase + 11]);
      this.vline(x, y, h, PALETTE[rampBase + 9]);
      this.hline(x, y + h - 1, w, PALETTE[0]);
      this.vline(x + w - 1, y, h, PALETTE[0]);
      this.hline(x + 1, y + h - 2, w - 2, PALETTE[rampBase + 3]);
      // Corner rivets
      if (w >= 12 && h >= 8) {
        const rv = PALETTE[rampBase + 13];
        this.pset(x + 2, y + 2, rv);
        this.pset(x + w - 3, y + 2, rv);
        this.pset(x + 2, y + h - 3, rv);
        this.pset(x + w - 3, y + h - 3, rv);
      }
    }

    drawLine(x0, y0, x1, y1, col) {
      let ix0 = x0 | 0;
      let iy0 = y0 | 0;
      const ix1 = x1 | 0;
      const iy1 = y1 | 0;
      const dx = Math.abs(ix1 - ix0);
      const sx = ix0 < ix1 ? 1 : -1;
      const dy = -Math.abs(iy1 - iy0);
      const sy = iy0 < iy1 ? 1 : -1;
      let err = dx + dy;
      let guard = 600;
      while (guard-- > 0) {
        this.pset(ix0, iy0, col);
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

    drawGlowLine(x0, y0, x1, y1, r, g, b, coreWhite = true) {
      let ix0 = x0 | 0;
      let iy0 = y0 | 0;
      const ix1 = x1 | 0;
      const iy1 = y1 | 0;
      const dx = Math.abs(ix1 - ix0);
      const sx = ix0 < ix1 ? 1 : -1;
      const dy = -Math.abs(iy1 - iy0);
      const sy = iy0 < iy1 ? 1 : -1;
      let err = dx + dy;
      let guard = 600;
      const hr = (r * 0.45) | 0;
      const hg = (g * 0.45) | 0;
      const hb = (b * 0.45) | 0;
      while (guard-- > 0) {
        this.psetAdd(ix0 - 1, iy0, hr, hg, hb);
        this.psetAdd(ix0 + 1, iy0, hr, hg, hb);
        this.psetAdd(ix0, iy0 - 1, hr, hg, hb);
        this.psetAdd(ix0, iy0 + 1, hr, hg, hb);
        if (coreWhite) {
          this.psetAdd(ix0, iy0, Math.min(255, r + 90), Math.min(255, g + 90), Math.min(255, b + 90));
        } else {
          this.psetAdd(ix0, iy0, r, g, b);
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

    drawPlasmaOrb(cx, cy, radius, r, g, b) {
      const ir = Math.ceil(radius);
      const r2 = radius * radius;
      const ix0 = Math.max(0, (cx - ir) | 0);
      const ix1 = Math.min(WIDTH - 1, (cx + ir) | 0);
      const iy0 = Math.max(0, (cy - ir) | 0);
      const iy1 = Math.min(HEIGHT - 1, (cy + ir) | 0);
      for (let py = iy0; py <= iy1; py++) {
        const dy = py - cy;
        for (let px = ix0; px <= ix1; px++) {
          const dx = px - cx;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) {
            const falloff = 1 - d2 / r2;
            const f2 = falloff * falloff;
            this.psetAdd(px, py, (r * f2) | 0, (g * f2) | 0, (b * f2) | 0);
            if (falloff > 0.72) {
              this.psetAdd(px, py, 140, 140, 140);
            }
          }
        }
      }
    }

    blitSprite(sprite, cx, cy, opts = null) {
      if (!sprite) return;
      const w = sprite.w;
      const h = sprite.h;
      const data = sprite.pixels;
      const drawX = Math.round(cx - (w >> 1));
      const drawY = Math.round(cy - (h >> 1));
      const flipX = opts && opts.flipX;
      const flipY = opts && opts.flipY;
      const flash = opts && opts.flash;
      const rainbow = opts && opts.rainbow;
      const flashCol = PALETTE[15];

      let sx0 = 0;
      let sy0 = 0;
      let sx1 = w;
      let sy1 = h;
      if (drawX < 0) sx0 = -drawX;
      if (drawY < 0) sy0 = -drawY;
      if (drawX + sx1 > WIDTH) sx1 = WIDTH - drawX;
      if (drawY + sy1 > HEIGHT) sy1 = HEIGHT - drawY;
      if (sx0 >= sx1 || sy0 >= sy1) return;

      for (let sy = sy0; sy < sy1; sy++) {
        const srcY = flipY ? h - 1 - sy : sy;
        const srcRow = srcY * w;
        const dstRow = (drawY + sy) * WIDTH + drawX;
        for (let sx = sx0; sx < sx1; sx++) {
          const srcX = flipX ? w - 1 - sx : sx;
          const col = data[srcRow + srcX];
          if (col !== 0) {
            if (flash) {
              this.pixels[dstRow + sx] = flashCol;
            } else if (rainbow && ((sx + sy + rainbow) & 3) === 0) {
              this.pixels[dstRow + sx] = PALETTE[160 + ((sx * 3 + sy * 2 + rainbow * 4) & 63)];
            } else {
              this.pixels[dstRow + sx] = col;
            }
          }
        }
      }
    }

    blitTile8(tilePixels, dx, dy, flash = false) {
      if (dx >= WIDTH || dy >= HEIGHT || dx + 8 <= 0 || dy + 8 <= 0) return;
      const flashCol = PALETTE[14];
      const sx0 = dx < 0 ? -dx : 0;
      const sy0 = dy < 0 ? -dy : 0;
      const sx1 = dx + 8 > WIDTH ? WIDTH - dx : 8;
      const sy1 = dy + 8 > HEIGHT ? HEIGHT - dy : 8;
      for (let sy = sy0; sy < sy1; sy++) {
        const srcRow = sy << 3;
        const dstRow = (dy + sy) * WIDTH + dx;
        for (let sx = sx0; sx < sx1; sx++) {
          const col = tilePixels[srcRow + sx];
          if (col !== 0) {
            this.pixels[dstRow + sx] = flash ? flashCol : col;
          }
        }
      }
    }

    drawText(str, x, y, colTop = PALETTE[15], colBot = null, scale = 1, shadow = true) {
      const s = String(str).toUpperCase();
      let cx = x | 0;
      const cy = y | 0;
      const shadowCol = PALETTE[0];
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const rows = FONT_GLYPHS[ch] || FONT_GLYPHS['?'];
        const gw = glyphWidth(ch);
        const bitWidth = gw - 1;
        for (let ry = 0; ry < 5; ry++) {
          const mask = rows[ry];
          if (!mask) continue;
          const rowCol = colBot && ry >= 3 ? colBot : colTop;
          for (let rx = 0; rx < bitWidth; rx++) {
            if ((mask >> (bitWidth - 1 - rx)) & 1) {
              if (scale === 1) {
                if (shadow) this.pset(cx + rx + 1, cy + ry + 1, shadowCol);
                this.pset(cx + rx, cy + ry, rowCol);
              } else {
                if (shadow) {
                  this.fillRect(cx + rx * scale + 1, cy + ry * scale + 1, scale, scale, shadowCol);
                }
                this.fillRect(cx + rx * scale, cy + ry * scale, scale, scale, rowCol);
              }
            }
          }
        }
        cx += gw * scale;
      }
    }

    drawTextCentered(str, cy, colTop = PALETTE[15], colBot = null, scale = 1) {
      const w = measureText(str, scale);
      this.drawText(str, ((WIDTH - w) >> 1), cy, colTop, colBot, scale, true);
    }

    applyChronoWarp(frameTick) {
      // VHS / Temporal scanline shear + cyan-magenta chromatic fringe during Chrono-Rewind
      // Keep top 12px telemetry strip crisp and shear rows 12..199
      this.postBuffer.set(this.pixels);
      for (let y = 12; y < HEIGHT; y++) {
        const tearBand = Math.abs(((y + frameTick * 5) % 48) - 24) < 3 ? ((Math.sin(y * 0.7 + frameTick) * 4) | 0) : 0;
        const shift = (((Math.sin(y * 0.14 - frameTick * 0.45) * 1.8) | 0) + tearBand);
        const rowOff = y * WIDTH;
        for (let x = 0; x < WIDTH; x++) {
          const sx = Math.max(0, Math.min(WIDTH - 1, x + shift));
          this.pixels[rowOff + x] = this.postBuffer[rowOff + sx];
        }
        // Subtle copper-cyan rewind tracking bars
        if (((y + frameTick * 3) % 26) === 0) {
          for (let x = 0; x < WIDTH; x += 2) {
            this.psetAdd(x, y, 22, 68, 92);
          }
        }
      }
    }

    present(shakeX = 0, shakeY = 0) {
      this.ctx.putImageData(this.imageData, shakeX | 0, shakeY | 0);
    }
  }

  XENON.WIDTH = WIDTH;
  XENON.HEIGHT = HEIGHT;
  XENON.PALETTE = PALETTE;
  XENON.PALETTE_RGB = PALETTE_RGB;
  XENON.RAMP = RAMP;
  XENON.packRGB = packRGB;
  XENON.unpackRGB = unpackRGB;
  XENON.sampleRamp = sampleRamp;
  XENON.sampleRampIndex = sampleRampIndex;
  XENON.measureText = measureText;
  XENON.Framebuffer = Framebuffer;
})();
