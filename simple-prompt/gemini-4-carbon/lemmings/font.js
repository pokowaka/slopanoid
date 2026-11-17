/**
 * Lemmings: Beat Tribe — Pixel Font & Framebuffer Color Utilities (font.js)
 * Zero external assets. Pure procedural bitmap glyphs rendered directly into Uint32Array.
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};

  // Detect endianness once for Uint32Array <-> ImageData RGBA byte order
  const IS_LITTLE_ENDIAN = (function () {
    const buf = new ArrayBuffer(4);
    new Uint32Array(buf)[0] = 0x11223344;
    return new Uint8Array(buf)[0] === 0x44;
  })();

  function packRGBA(r, g, b, a = 255) {
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    a = a < 0 ? 0 : a > 255 ? 255 : a | 0;
    if (IS_LITTLE_ENDIAN) {
      return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
    return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  }

  function unpackRGBA(col) {
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

  function lerpColor(c1, c2, t) {
    if (t <= 0) return c1;
    if (t >= 1) return c2;
    const a = unpackRGBA(c1);
    const b = unpackRGBA(c2);
    return packRGBA(
      a.r + (b.r - a.r) * t,
      a.g + (b.g - a.g) * t,
      a.b + (b.b - a.b) * t,
      255
    );
  }

  function brightenColor(col, delta) {
    const c = unpackRGBA(col);
    return packRGBA(c.r + delta, c.g + delta, c.b + delta, c.a);
  }

  function desaturateColor(col, amount) {
    const c = unpackRGBA(col);
    const luma = (c.r * 77 + c.g * 150 + c.b * 29) >> 8;
    const gray = Math.max(28, Math.min(150, luma * 0.78));
    return packRGBA(
      c.r + (gray - c.r) * amount,
      c.g + (gray - c.g) * amount,
      c.b + (gray - c.b) * amount,
      c.a
    );
  }

  // 5x7 Amiga-inspired crisp pixel font (5 bits per row, MSB on left, 7 rows)
  const GLYPHS_5X7 = {
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
    '"': [0x0a, 0x0a, 0x04, 0x00, 0x00, 0x00, 0x00],
    '#': [0x0a, 0x1f, 0x0a, 0x0a, 0x1f, 0x0a, 0x00],
    '%': [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
    '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
    "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    '*': [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
    '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
    ',': [0x00, 0x00, 0x00, 0x00, 0x04, 0x04, 0x08],
    '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x04],
    '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
    '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
    '3': [0x1f, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0e],
    '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    ':': [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
    ';': [0x00, 0x04, 0x00, 0x00, 0x04, 0x04, 0x08],
    '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
    '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
    '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
    '[': [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
    ']': [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
    '^': [0x04, 0x0a, 0x11, 0x00, 0x00, 0x00, 0x00],
    '_': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
    '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    '~': [0x00, 0x08, 0x15, 0x02, 0x00, 0x00, 0x00],
    'A': [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'B': [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    'C': [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    'D': [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
    'E': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    'F': [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    'G': [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    'H': [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    'I': [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    'J': [0x07, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0c],
    'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    'M': [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    'O': [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'P': [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    'Q': [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    'R': [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    'S': [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    'T': [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    'X': [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    'Y': [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    'Z': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    // Musical note symbol '@'
    '@': [0x03, 0x05, 0x09, 0x09, 0x1b, 0x1b, 0x00]
  };

  // 3x5 Ultra-compact HUD font for button numbers & tiny labels (3 bits per row, 5 rows)
  const GLYPHS_3X5 = {
    ' ': [0, 0, 0, 0, 0],
    '-': [0, 0, 7, 0, 0],
    '+': [0, 2, 7, 2, 0],
    ':': [0, 2, 0, 2, 0],
    '%': [5, 1, 2, 4, 5],
    '/': [1, 1, 2, 4, 4],
    '.': [0, 0, 0, 0, 2],
    '!': [2, 2, 2, 0, 2],
    '#': [5, 7, 5, 7, 5],
    '*': [5, 2, 7, 2, 5],
    '|': [2, 2, 2, 2, 2],
    '[': [6, 4, 4, 4, 6],
    ']': [3, 1, 1, 1, 3],
    ',': [0, 0, 0, 2, 4],
    "'": [2, 2, 0, 0, 0],
    '>': [4, 2, 1, 2, 4],
    '<': [1, 2, 4, 2, 1],
    '0': [7, 5, 5, 5, 7],
    '1': [2, 6, 2, 2, 7],
    '2': [7, 1, 7, 4, 7],
    '3': [7, 1, 3, 1, 7],
    '4': [5, 5, 7, 1, 1],
    '5': [7, 4, 7, 1, 7],
    '6': [7, 4, 7, 5, 7],
    '7': [7, 1, 2, 2, 2],
    '8': [7, 5, 7, 5, 7],
    '9': [7, 5, 7, 1, 7],
    'A': [2, 5, 7, 5, 5],
    'B': [6, 5, 6, 5, 6],
    'C': [3, 4, 4, 4, 3],
    'D': [6, 5, 5, 5, 6],
    'E': [7, 4, 6, 4, 7],
    'F': [7, 4, 6, 4, 4],
    'G': [3, 4, 5, 5, 3],
    'H': [5, 5, 7, 5, 5],
    'I': [7, 2, 2, 2, 7],
    'J': [1, 1, 1, 5, 2],
    'K': [5, 5, 6, 5, 5],
    'L': [4, 4, 4, 4, 7],
    'M': [5, 7, 5, 5, 5],
    'N': [6, 5, 5, 5, 5],
    'O': [2, 5, 5, 5, 2],
    'P': [6, 5, 6, 4, 4],
    'Q': [2, 5, 5, 6, 3],
    'R': [6, 5, 6, 5, 5],
    'S': [3, 4, 2, 1, 6],
    'T': [7, 2, 2, 2, 2],
    'U': [5, 5, 5, 5, 7],
    'V': [5, 5, 5, 5, 2],
    'W': [5, 5, 5, 7, 5],
    'X': [5, 5, 2, 5, 5],
    'Y': [5, 5, 2, 2, 2],
    'Z': [7, 1, 2, 4, 7]
  };

  function drawText5x7(fb, fbW, fbH, text, x, y, color, shadowColor = 0, scale = 1) {
    if (!text) return 0;
    const str = String(text).toUpperCase();
    let cx = x | 0;
    const cy = y | 0;
    const adv = 6 * scale;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const glyph = GLYPHS_5X7[ch] || GLYPHS_5X7[' '];
      if (ch !== ' ') {
        for (let row = 0; row < 7; row++) {
          const bits = glyph[row];
          if (!bits) continue;
          for (let col = 0; col < 5; col++) {
            if (bits & (1 << (4 - col))) {
              for (let sy = 0; sy < scale; sy++) {
                const py = cy + row * scale + sy;
                if (py < 0 || py >= fbH) continue;
                for (let sx = 0; sx < scale; sx++) {
                  const px = cx + col * scale + sx;
                  if (px >= 0 && px < fbW) {
                    if (shadowColor && px + 1 < fbW && py + 1 < fbH) {
                      fb[(py + 1) * fbW + (px + 1)] = shadowColor;
                    }
                    fb[py * fbW + px] = color;
                  }
                }
              }
            }
          }
        }
      }
      cx += adv;
    }
    return str.length * adv - scale;
  }

  // Amiga Copper-Gradient Banner Text (per-scanline gradient colors)
  function drawCopperText(fb, fbW, fbH, text, x, y, rowColors, outlineColor = 0, scale = 2) {
    if (!text) return 0;
    const str = String(text).toUpperCase();
    const adv = 6 * scale;
    let cx = x | 0;
    const cy = y | 0;

    // Outline pass
    if (outlineColor) {
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]];
      for (const [ox, oy] of offsets) {
        drawText5x7(fb, fbW, fbH, str, cx + ox, cy + oy, outlineColor, 0, scale);
      }
    }

    // Copper scanline fill pass
    for (let i = 0; i < str.length; i++) {
      const glyph = GLYPHS_5X7[str[i]] || GLYPHS_5X7[' '];
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        if (!bits) continue;
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            for (let sy = 0; sy < scale; sy++) {
              const rIdx = row * scale + sy;
              const py = cy + rIdx;
              if (py < 0 || py >= fbH) continue;
              const colr = rowColors[rIdx % rowColors.length];
              for (let sx = 0; sx < scale; sx++) {
                const px = cx + col * scale + sx;
                if (px >= 0 && px < fbW) {
                  fb[py * fbW + px] = colr;
                }
              }
            }
          }
        }
      }
      cx += adv;
    }
    return str.length * adv - scale;
  }

  function drawText3x5(fb, fbW, fbH, text, x, y, color, shadowColor = 0) {
    if (!text) return 0;
    const str = String(text).toUpperCase();
    let cx = x | 0;
    const cy = y | 0;
    for (let i = 0; i < str.length; i++) {
      const glyph = GLYPHS_3X5[str[i]] || GLYPHS_3X5[' '];
      for (let row = 0; row < 5; row++) {
        const bits = glyph[row];
        if (!bits) continue;
        const py = cy + row;
        if (py < 0 || py >= fbH) continue;
        for (let col = 0; col < 3; col++) {
          if (bits & (1 << (2 - col))) {
            const px = cx + col;
            if (px >= 0 && px < fbW) {
              if (shadowColor && px + 1 < fbW && py + 1 < fbH) {
                fb[(py + 1) * fbW + (px + 1)] = shadowColor;
              }
              fb[py * fbW + px] = color;
            }
          }
        }
      }
      cx += 4;
    }
    return str.length * 4 - 1;
  }

  function measureText5x7(text, scale = 1) {
    if (!text) return 0;
    return String(text).length * 6 * scale - scale;
  }

  function measureText3x5(text) {
    if (!text) return 0;
    return String(text).length * 4 - 1;
  }

  // Primitive framebuffer drawing helpers
  function fillRect(fb, fbW, fbH, x, y, w, h, color) {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(fbW, (x + w) | 0);
    const y1 = Math.min(fbH, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const rowOff = py * fbW;
      for (let px = x0; px < x1; px++) {
        fb[rowOff + px] = color;
      }
    }
  }

  function strokeRect(fb, fbW, fbH, x, y, w, h, color) {
    fillRect(fb, fbW, fbH, x, y, w, 1, color);
    fillRect(fb, fbW, fbH, x, y + h - 1, w, 1, color);
    fillRect(fb, fbW, fbH, x, y, 1, h, color);
    fillRect(fb, fbW, fbH, x + w - 1, y, 1, h, color);
  }

  function drawBevelBox(fb, fbW, fbH, x, y, w, h, fillCol, hiCol, loCol) {
    fillRect(fb, fbW, fbH, x, y, w, h, fillCol);
    fillRect(fb, fbW, fbH, x, y, w, 1, hiCol);
    fillRect(fb, fbW, fbH, x, y, 1, h, hiCol);
    fillRect(fb, fbW, fbH, x, y + h - 1, w, 1, loCol);
    fillRect(fb, fbW, fbH, x + w - 1, y, 1, h, loCol);
  }

  BeatTribe.Font = {
    IS_LITTLE_ENDIAN,
    packRGBA,
    unpackRGBA,
    lerpColor,
    brightenColor,
    desaturateColor,
    drawText5x7,
    drawCopperText,
    drawText3x5,
    measureText5x7,
    measureText3x5,
    fillRect,
    strokeRect,
    drawBevelBox
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Font;
  }
})(typeof window !== 'undefined' ? window : globalThis);
