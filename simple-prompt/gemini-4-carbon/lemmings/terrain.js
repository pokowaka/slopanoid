/**
 * Lemmings: Beat Tribe — Pixel-Destructible Note Terrain & World Themes (terrain.js)
 * Per-pixel material, musical scale degree, Amiga pixel-art shading, Note-Block flash, & The Silence.
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const Font = BeatTribe.Font || (typeof require !== 'undefined' ? require('./font.js') : null);
  const { packRGBA, lerpColor, brightenColor, desaturateColor } = Font;

  const MAT = {
    EMPTY: 0,
    DIRT: 1,
    BRICK: 2,
    STEEL: 3,
    ONE_WAY_LEFT: 4,
    ONE_WAY_RIGHT: 5,
    WATER: 6,
    LAVA: 7,
    FIRE: 8
  };

  // 5 Genre Worlds: Scale, BPM, Instrument Identity, and EGA/Amiga Colour Themes
  const WORLD_THEMES = {
    1: {
      id: 1,
      name: 'Amiga Chip Garden',
      genre: '4-Ch Amiga Chiptune',
      scaleName: 'C Major Pentatonic',
      rootNoteName: 'C',
      rootMidi: 48, // C3
      scaleOffsets: [0, 2, 4, 7, 9],
      bpm: 124,
      skyTop: [18, 34, 96],
      skyMid: [44, 88, 178],
      skyBot: [122, 186, 236],
      accent: packRGBA(82, 246, 112),
      exitDark: packRGBA(64, 54, 42),
      exitMid: packRGBA(142, 118, 84),
      exitHi: packRGBA(228, 202, 148),
      // 5 scale-degree palettes: [bodyRGB, crustRGB]
      degreeColors: [
        [[154, 96, 52], [52, 218, 74]],   // C: Warm earth + emerald grass
        [[176, 124, 54], [116, 236, 68]], // D: Golden sandstone + lime turf
        [[168, 78, 68], [64, 226, 142]],  // E: Terracotta + mint clover
        [[76, 118, 158], [92, 238, 214]], // G: Slate blue + aqua moss
        [[128, 86, 156], [172, 242, 96]]  // A: Heather stone + chartreuse grass
      ]
    },
    2: {
      id: 2,
      name: 'Acid Warehouse',
      genre: 'TB-303 Acid Techno',
      scaleName: 'E Phrygian',
      rootNoteName: 'E',
      rootMidi: 40, // E2
      scaleOffsets: [0, 1, 3, 5, 7, 8, 10],
      bpm: 132,
      skyTop: [12, 14, 20],
      skyMid: [24, 30, 38],
      skyBot: [42, 52, 46],
      accent: packRGBA(186, 255, 42),
      exitDark: packRGBA(36, 44, 38),
      exitMid: packRGBA(86, 114, 68),
      exitHi: packRGBA(192, 255, 68),
      degreeColors: [
        [[56, 74, 48], [184, 255, 42]],   // E: Acid lime girder
        [[78, 72, 42], [255, 232, 48]],   // F: Hazard yellow beam
        [[42, 74, 78], [52, 248, 232]],   // G: Cyber cyan duct
        [[74, 44, 76], [255, 68, 218]],   // A: Neon magenta bulkhead
        [[82, 54, 40], [255, 142, 36]],   // B: Sodium orange catwalk
        [[46, 56, 86], [96, 162, 255]],   // C: High-voltage blue truss
        [[64, 48, 88], [188, 112, 255]]   // D: UV violet masonry
      ]
    },
    3: {
      id: 3,
      name: 'Synthwave Sunset',
      genre: '80s Analog Synthwave',
      scaleName: 'D Dorian',
      rootNoteName: 'D',
      rootMidi: 50, // D3
      scaleOffsets: [0, 2, 3, 5, 7, 9, 10],
      bpm: 118,
      skyTop: [20, 10, 48],
      skyMid: [96, 24, 98],
      skyBot: [232, 92, 112],
      accent: packRGBA(56, 242, 255),
      exitDark: packRGBA(48, 22, 78),
      exitMid: packRGBA(146, 52, 178),
      exitHi: packRGBA(88, 246, 255),
      degreeColors: [
        [[48, 26, 78], [255, 64, 196]],   // D: Outrun hot pink chrome
        [[28, 48, 86], [56, 244, 255]],   // E: Laser cyan grid
        [[68, 34, 72], [255, 188, 56]],   // F: Sunset gold horizon
        [[42, 28, 92], [176, 98, 255]],   // G: Neon violet synth block
        [[74, 30, 58], [255, 96, 124]],   // A: Flamingo coral deck
        [[28, 58, 78], [96, 255, 196]],   // B: Miami mint chrome
        [[54, 42, 88], [224, 224, 255]]   // C: Silver starlight girder
      ]
    },
    4: {
      id: 4,
      name: 'Jungle Breakbeat Caves',
      genre: 'Atmospheric Breakbeat',
      scaleName: 'A Minor Pentatonic',
      rootNoteName: 'A',
      rootMidi: 45, // A2
      scaleOffsets: [0, 3, 5, 7, 10],
      bpm: 156,
      skyTop: [8, 18, 28],
      skyMid: [14, 38, 52],
      skyBot: [22, 66, 74],
      accent: packRGBA(52, 255, 204),
      exitDark: packRGBA(20, 52, 58),
      exitMid: packRGBA(42, 126, 122),
      exitHi: packRGBA(106, 255, 224),
      degreeColors: [
        [[34, 68, 72], [58, 252, 212]],   // A: Bioluminescent teal rock
        [[38, 74, 54], [96, 255, 128]],   // C: Emerald spore cavern
        [[44, 48, 86], [116, 168, 255]],  // D: Sapphire crystal seam
        [[72, 58, 42], [255, 196, 78]],   // E: Amber cavern fungus
        [[62, 42, 82], [216, 118, 255]]   // G: Amethyst stalagmite
      ]
    },
    5: {
      id: 5,
      name: 'Grand Orchestral Finale',
      genre: 'Symphonic Lydian Finale',
      scaleName: 'F Lydian',
      rootNoteName: 'F',
      rootMidi: 41, // F2
      scaleOffsets: [0, 2, 4, 6, 7, 9, 11],
      bpm: 120,
      skyTop: [16, 14, 36],
      skyMid: [46, 32, 68],
      skyBot: [98, 62, 92],
      accent: packRGBA(255, 218, 92),
      exitDark: packRGBA(78, 58, 44),
      exitMid: packRGBA(182, 148, 96),
      exitHi: packRGBA(255, 236, 164),
      degreeColors: [
        [[182, 172, 158], [255, 222, 102]], // F: Carrara marble + gold leaf
        [[148, 78, 88], [255, 196, 118]],   // G: Crimson velvet + brass trim
        [[112, 134, 174], [216, 236, 255]], // A: Celestial sapphire marble
        [[168, 142, 108], [255, 242, 156]], // B (Lydian #4!): Radiant gilded stone
        [[134, 158, 138], [192, 248, 198]], // C: Imperial jade column
        [[148, 122, 168], [238, 198, 255]], // D: Royal amethyst frieze
        [[164, 118, 94], [255, 208, 148]]   // E: Burnished bronze travertine
      ]
    }
  };

  const BAYER_2X2 = [
    [-6, 4],
    [6, -4]
  ];

  function pixelHash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  class Terrain {
    constructor(width, height, worldId = 1) {
      this.width = width | 0;
      this.height = height | 0; // Playfield height = 160
      this.worldId = worldId;
      this.theme = WORLD_THEMES[worldId] || WORLD_THEMES[1];

      const size = this.width * this.height;
      this.mat = new Uint8Array(size);
      this.deg = new Uint8Array(size);
      this.baseColor = new Uint32Array(size);

      // 8x8 cell grids for Note-Block Flash and Creeping Silence
      this.cellSize = 8;
      this.gridW = Math.ceil(this.width / 8);
      this.gridH = Math.ceil(this.height / 8);
      this.noteFlash = new Uint8Array(this.gridW * this.gridH);
      this.noteFlashDeg = new Uint8Array(this.gridW * this.gridH);
      this.silence = new Float32Array(this.gridW * this.gridH);

      this.silenceSources = []; // { x, y, rate, maxRadius }
      this.crushers = [];       // { x, yTop, width, stroke, periodFrames, phaseFrames, curExt }

      // Pre-render repeatable parallax background buffer (width x height)
      this.bgPixels = new Uint32Array(size);
      this.buildBackground();
    }

    buildBackground() {
      const { width, height, theme, worldId } = this;
      const bg = this.bgPixels;

      for (let y = 0; y < height; y++) {
        const t = y / (height - 1);
        let r, g, b;
        if (t < 0.55) {
          const u = t / 0.55;
          r = theme.skyTop[0] + (theme.skyMid[0] - theme.skyTop[0]) * u;
          g = theme.skyTop[1] + (theme.skyMid[1] - theme.skyTop[1]) * u;
          b = theme.skyTop[2] + (theme.skyMid[2] - theme.skyTop[2]) * u;
        } else {
          const u = (t - 0.55) / 0.45;
          r = theme.skyMid[0] + (theme.skyBot[0] - theme.skyMid[0]) * u;
          g = theme.skyMid[1] + (theme.skyBot[1] - theme.skyMid[1]) * u;
          b = theme.skyMid[2] + (theme.skyBot[2] - theme.skyMid[2]) * u;
        }
        // Subtle Amiga copper-bar quantization (12-bit OCS style!)
        const qr = (Math.round(r / 17) * 17) | 0;
        const qg = (Math.round(g / 17) * 17) | 0;
        const qb = (Math.round(b / 17) * 17) | 0;
        const rowCol = packRGBA(qr, qg, qb);
        const rowOff = y * width;
        for (let x = 0; x < width; x++) {
          bg[rowOff + x] = rowCol;
        }
      }

      // World-specific procedural background art
      if (worldId === 1) {
        // Amiga Chip Garden: distant emerald hills & fluffy pixel clouds
        const hillDark = packRGBA(28, 92, 68);
        const hillLight = packRGBA(42, 128, 86);
        const cloudCol = packRGBA(218, 238, 255);
        for (let x = 0; x < width; x++) {
          const h1 = Math.floor(118 + Math.sin(x * 0.022) * 14 + Math.cos(x * 0.051) * 6);
          const h2 = Math.floor(132 + Math.cos(x * 0.031 + 1.2) * 10);
          for (let y = h1; y < height; y++) bg[y * width + x] = hillDark;
          for (let y = h2; y < height; y++) bg[y * width + x] = hillLight;
        }
        for (let cx = 36; cx < width; cx += 112) {
          const cy = 22 + ((cx * 7) % 18);
          for (let dy = -4; dy <= 4; dy++) {
            const span = 14 - Math.abs(dy) * 2;
            for (let dx = -span; dx <= span; dx++) {
              const px = (cx + dx + width) % width;
              const py = cy + dy;
              if (py >= 0 && py < height) bg[py * width + px] = cloudCol;
            }
          }
        }
      } else if (worldId === 2) {
        // Acid Warehouse: diagonal steel trusses, industrial windows & rising smoke
        const trussCol = packRGBA(20, 26, 24);
        const glassCol = packRGBA(46, 74, 52);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            if (x % 64 < 4 || y % 48 < 3 || Math.abs((x % 64) - (y % 64)) < 2) {
              bg[y * width + x] = trussCol;
            } else if (y > 22 && y < 42 && (x % 64) > 12 && (x % 64) < 52) {
              bg[y * width + x] = glassCol;
            }
          }
        }
      } else if (worldId === 3) {
        // Synthwave Sunset: segmented neon sun(s) + perspective horizon grid
        const gridHorizon = 114;
        for (let sunX = 160; sunX < width; sunX += 360) {
          const sunY = 74;
          const R = 34;
          for (let dy = -R; dy <= R; dy++) {
            const py = sunY + dy;
            if (py < 0 || py >= gridHorizon) continue;
            // Classic outrun horizontal slice cutouts in bottom half of sun
            if (dy > 4 && (dy % 6 === 0 || dy % 6 === 1)) continue;
            const span = Math.floor(Math.sqrt(R * R - dy * dy));
            const sunCol = packRGBA(255, Math.max(68, 224 - (dy + R) * 2.4), Math.max(96, 68 + (dy + R) * 1.8));
            for (let dx = -span; dx <= span; dx++) {
              const px = sunX + dx;
              if (px >= 0 && px < width) bg[py * width + px] = sunCol;
            }
          }
        }
        const gridBg = packRGBA(22, 10, 44);
        const gridLine = packRGBA(172, 42, 168);
        for (let y = gridHorizon; y < height; y++) {
          const dy = y - gridHorizon;
          const isHLine = (dy === 0 || dy === 3 || dy === 8 || dy === 15 || dy === 25 || dy === 38);
          for (let x = 0; x < width; x++) {
            const persp = Math.floor((x - width * 0.5) / (1 + dy * 0.08));
            const isVLine = (Math.abs(persp) % 18 === 0);
            bg[y * width + x] = (isHLine || isVLine) ? gridLine : gridBg;
          }
        }
      } else if (worldId === 4) {
        // Jungle Breakbeat Caves: hanging stalactites + glowing spore stars
        const stalCol = packRGBA(14, 30, 42);
        const sporeCol = packRGBA(72, 246, 204);
        for (let x = 0; x < width; x++) {
          const sLen = Math.floor(10 + Math.abs(Math.sin(x * 0.09)) * 22 + ((x * 13) % 7));
          for (let y = 0; y < sLen; y++) bg[y * width + x] = stalCol;
          const h = pixelHash(x, 77);
          if ((h & 31) === 0) {
            const sy = 20 + (h % 110);
            bg[sy * width + x] = sporeCol;
          }
        }
      } else if (worldId === 5) {
        // Grand Orchestral Finale: starlit dome + distant classical colonnade
        const starCol = packRGBA(255, 244, 198);
        const colDark = packRGBA(38, 28, 56);
        const colHi = packRGBA(64, 48, 86);
        for (let i = 0; i < 90; i++) {
          const sx = (pixelHash(i, 11) % width);
          const sy = (pixelHash(i, 29) % 85);
          bg[sy * width + sx] = starCol;
        }
        for (let cx = 24; cx < width; cx += 56) {
          for (let y = 78; y < height; y++) {
            for (let dx = 0; dx < 10; dx++) {
              const px = cx + dx;
              if (px < width) bg[y * width + px] = dx < 3 ? colHi : colDark;
            }
          }
        }
      }
    }

    inBounds(x, y) {
      return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    getMat(x, y) {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
        // Treat left/right playfield boundaries as solid walls so lemmings stay in the world
        if (x < 0 || x >= this.width) return MAT.STEEL;
        return MAT.EMPTY;
      }
      return this.mat[y * this.width + x];
    }

    isSolid(x, y) {
      const m = this.getMat(x, y);
      return m === MAT.DIRT || m === MAT.BRICK || m === MAT.STEEL ||
             m === MAT.ONE_WAY_LEFT || m === MAT.ONE_WAY_RIGHT;
    }

    getHazard(x, y) {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
      const m = this.mat[y * this.width + x];
      if (m === MAT.WATER || m === MAT.LAVA || m === MAT.FIRE) return m;
      return 0;
    }

    getDegreeAt(x, y) {
      const cx = Math.max(0, Math.min(this.width - 1, x | 0));
      const cy = Math.max(0, Math.min(this.height - 1, y | 0));
      return this.deg[cy * this.width + cx] % this.theme.scaleOffsets.length;
    }

    // Compute MIDI note from terrain scale degree & height band (higher platform = higher octave!)
    getMidiAt(x, y) {
      const degIdx = this.getDegreeAt(x, y);
      const offsets = this.theme.scaleOffsets;
      const semitone = offsets[degIdx % offsets.length];
      // 4 height bands across y = 0..159 (top = +2 octaves, bottom = +0 octave)
      const band = Math.max(0, Math.min(2, Math.floor((159 - Math.max(0, Math.min(159, y))) / 52)));
      return this.theme.rootMidi + 12 * band + semitone;
    }

    // Geometry Builders for Level Construction
    fillRectMat(x, y, w, h, material, degree = 0) {
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(this.width, Math.round(x + w));
      const y1 = Math.min(this.height, Math.round(y + h));
      const d = ((degree % this.theme.degreeColors.length) + this.theme.degreeColors.length) % this.theme.degreeColors.length;
      for (let py = y0; py < y1; py++) {
        const off = py * this.width;
        for (let px = x0; px < x1; px++) {
          this.mat[off + px] = material;
          this.deg[off + px] = d;
        }
      }
    }

    // Segmented musical platform where every segment steps through scale degrees!
    fillMusicalPlatform(x, y, w, h, startDeg = 0, segWidth = 28) {
      const numSegs = Math.max(1, Math.ceil(w / segWidth));
      for (let s = 0; s < numSegs; s++) {
        const sx = x + s * segWidth;
        const sw = Math.min(segWidth, x + w - sx);
        this.fillRectMat(sx, y, sw, h, MAT.DIRT, startDeg + s);
      }
    }

    fillSlope(x0, y0, x1, y1, thickness, startDeg = 0) {
      const steps = Math.max(1, Math.abs(x1 - x0));
      const dx = (x1 - x0) / steps;
      const dy = (y1 - y0) / steps;
      for (let i = 0; i <= steps; i++) {
        const px = Math.round(x0 + dx * i);
        const py = Math.round(y0 + dy * i);
        const deg = startDeg + Math.floor(i / 20);
        this.fillRectMat(px, py, 2, thickness, MAT.DIRT, deg);
      }
    }

    carveInitialRect(x, y, w, h) {
      const x0 = Math.max(0, Math.round(x));
      const y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(this.width, Math.round(x + w));
      const y1 = Math.min(this.height, Math.round(y + h));
      for (let py = y0; py < y1; py++) {
        const off = py * this.width;
        for (let px = x0; px < x1; px++) {
          this.mat[off + px] = MAT.EMPTY;
          this.baseColor[off + px] = 0;
        }
      }
    }

    carveInitialCircle(cx, cy, r) {
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
      const r2 = r * r;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - cx;
          const dy = py - cy;
          if (dx * dx + dy * dy <= r2) {
            this.mat[py * this.width + px] = MAT.EMPTY;
            this.baseColor[py * this.width + px] = 0;
          }
        }
      }
    }

    addSilenceSource(x, y, rate = 0.004, maxRadius = 88) {
      this.silenceSources.push({ x, y, rate, maxRadius });
      // Seed initial slight grey aura around the silence emitter
      const gx = Math.floor(x / 8);
      const gy = Math.floor(y / 8);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = gx + dx;
          const cy = gy + dy;
          if (cx >= 0 && cx < this.gridW && cy >= 0 && cy < this.gridH) {
            const dist = Math.hypot(dx, dy);
            if (dist <= 2.2) {
              this.silence[cy * this.gridW + cx] = Math.max(
                this.silence[cy * this.gridW + cx],
                0.75 - dist * 0.22
              );
            }
          }
        }
      }
    }

    addCrusher(x, yTop, width = 16, stroke = 28, periodFrames = 144, phaseFrames = 0) {
      this.crushers.push({
        x,
        yTop,
        width,
        stroke,
        periodFrames,
        phaseFrames,
        curExt: 0,
        justSlammed: false
      });
    }

    // Bake rich pixel-art textures, crust highlights, stone bevels, & steel rivets
    finalizeShading() {
      const { width, height, mat, deg, baseColor, theme, worldId } = this;
      const degPalette = theme.degreeColors;

      for (let y = 0; y < height; y++) {
        const off = y * width;
        for (let x = 0; x < width; x++) {
          const idx = off + x;
          const m = mat[idx];
          if (m === MAT.EMPTY || m === MAT.WATER || m === MAT.LAVA || m === MAT.FIRE) {
            baseColor[idx] = 0;
            continue;
          }

          if (m === MAT.STEEL) {
            // Indestructible riveted Amiga steel plate (16x16 tiles)
            const tx = x & 15;
            const ty = y & 15;
            let v = 132 + BAYER_2X2[y & 1][x & 1];
            if (tx === 0 || ty === 0) v += 48;
            else if (tx === 15 || ty === 15) v -= 46;
            else if ((tx === 2 || tx === 13) && (ty === 2 || ty === 13)) v += 64; // corner rivets
            baseColor[idx] = packRGBA(v - 8, v, v + 18);
            continue;
          }

          const palEntry = degPalette[deg[idx] % degPalette.length];
          const body = palEntry[0];
          const crust = palEntry[1];

          const topAir = (y > 0 && mat[(y - 1) * width + x] === MAT.EMPTY);
          const top2Air = (y > 1 && mat[(y - 2) * width + x] === MAT.EMPTY);
          const top3Air = (y > 2 && mat[(y - 3) * width + x] === MAT.EMPTY);
          const botAir = (y + 1 < height && mat[(y + 1) * width + x] === MAT.EMPTY);
          const dither = BAYER_2X2[y & 1][x & 1];

          if (topAir || top2Air || (top3Air && ((x + y) & 1) === 0)) {
            // Vibrant scale-coded surface crust (grass, neon trim, gold cornice, crystal moss)
            const lift = topAir ? 22 : (top2Air ? 4 : -14);
            baseColor[idx] = packRGBA(
              crust[0] + lift + dither,
              crust[1] + lift + dither,
              crust[2] + lift + dither
            );
          } else {
            // World-specific interior pixel texture
            let shade = dither;
            if (worldId === 1) {
              // Brick/cobble strata
              const brickRow = (y >> 3);
              const bx = (x + (brickRow & 1) * 6) % 12;
              if ((y & 7) === 0 || bx === 0) shade -= 22;
              else if ((y & 7) === 1) shade += 12;
            } else if (worldId === 2) {
              // Industrial cross-ribbed concrete/girder
              if ((x & 7) === 0 || (y & 7) === 0) shade += 16;
              if (((x + y) & 7) === 0) shade -= 14;
            } else if (worldId === 3) {
              // Chrome synth grid lines
              if ((x % 10) === 0 || (y % 8) === 0) {
                baseColor[idx] = packRGBA(crust[0] * 0.72, crust[1] * 0.72, crust[2] * 0.72);
                continue;
              }
            } else if (worldId === 4) {
              // Bioluminescent crystal flecks
              const h = pixelHash(x, y);
              if ((h & 31) === 0) {
                baseColor[idx] = packRGBA(crust[0], crust[1], crust[2]);
                continue;
              }
              shade += ((h & 15) - 8);
            } else if (worldId === 5) {
              // Veined marble masonry
              const vein = Math.sin(x * 0.14 + Math.sin(y * 0.22) * 2.1);
              if (vein > 0.86) shade += 28;
              else if ((y % 10) === 0 || ((x + (y / 10 | 0) * 8) % 16) === 0) shade -= 20;
            }

            if (botAir) shade -= 26;
            baseColor[idx] = packRGBA(body[0] + shade, body[1] + shade, body[2] + shade);
          }
        }
      }
    }

    // Dynamic Runtime Destructible Terrain Operations
    canCarvePixel(idx, dir = 0, allowOneWayBypass = false) {
      const m = this.mat[idx];
      if (m === MAT.EMPTY || m === MAT.STEEL || m === MAT.WATER || m === MAT.LAVA || m === MAT.FIRE) {
        return false;
      }
      if (!allowOneWayBypass) {
        if (m === MAT.ONE_WAY_LEFT && dir !== -1) return false;
        if (m === MAT.ONE_WAY_RIGHT && dir !== 1) return false;
      }
      return true;
    }

    // Carve rectangle (used by Digger, Basher, Miner); returns { carvedCount, hitSteelOrOneWay }
    carveRect(x, y, w, h, dir = 0, allowOneWayBypass = false) {
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(this.width, (x + w) | 0);
      const y1 = Math.min(this.height, (y + h) | 0);
      let carvedCount = 0;
      let hitHard = false;

      for (let py = y0; py < y1; py++) {
        const off = py * this.width;
        for (let px = x0; px < x1; px++) {
          const idx = off + px;
          const m = this.mat[idx];
          if (m === MAT.EMPTY || m === MAT.WATER || m === MAT.LAVA || m === MAT.FIRE) continue;
          if (this.canCarvePixel(idx, dir, allowOneWayBypass)) {
            this.mat[idx] = MAT.EMPTY;
            this.baseColor[idx] = 0;
            carvedCount++;
          } else {
            hitHard = true;
          }
        }
      }

      // Darken 1px rim around newly carved cavity for crisp dug-tunnel edge look
      if (carvedCount > 0) {
        this.shadeRim(x0 - 1, y0 - 1, (x1 - x0) + 2, (y1 - y0) + 2);
      }
      return { carvedCount, hitHard };
    }

    // Carve Bomber oval crater (spares STEEL, destroys DIRT, BRICK, & ONE_WAY)
    carveOval(cx, cy, rx, ry) {
      const x0 = Math.max(0, Math.floor(cx - rx));
      const x1 = Math.min(this.width - 1, Math.ceil(cx + rx));
      const y0 = Math.max(0, Math.floor(cy - ry));
      const y1 = Math.min(this.height - 1, Math.ceil(cy + ry));
      let carved = 0;
      for (let py = y0; py <= y1; py++) {
        const ny = (py - cy) / ry;
        for (let px = x0; px <= x1; px++) {
          const nx = (px - cx) / rx;
          if (nx * nx + ny * ny <= 1.0) {
            const idx = py * this.width + px;
            if (this.canCarvePixel(idx, 0, true)) {
              this.mat[idx] = MAT.EMPTY;
              this.baseColor[idx] = 0;
              carved++;
            }
          }
        }
      }
      if (carved > 0) {
        this.shadeRim(x0 - 1, y0 - 1, (x1 - x0) + 3, (y1 - y0) + 3);
      }
      return carved;
    }

    shadeRim(x, y, w, h) {
      const x0 = Math.max(1, x | 0);
      const y0 = Math.max(1, y | 0);
      const x1 = Math.min(this.width - 1, (x + w) | 0);
      const y1 = Math.min(this.height - 1, (y + h) | 0);
      for (let py = y0; py < y1; py++) {
        const off = py * this.width;
        for (let px = x0; px < x1; px++) {
          const idx = off + px;
          const m = this.mat[idx];
          if (m === MAT.DIRT || m === MAT.ONE_WAY_LEFT || m === MAT.ONE_WAY_RIGHT) {
            if (this.mat[idx - 1] === MAT.EMPTY || this.mat[idx + 1] === MAT.EMPTY ||
                this.mat[idx - this.width] === MAT.EMPTY || this.mat[idx + this.width] === MAT.EMPTY) {
              this.baseColor[idx] = brightenColor(this.baseColor[idx], -14);
            }
          }
        }
      }
    }

    // Builder lays a glowing, scale-coded musical brick step!
    layBrick(xStart, y, width, dir, degree) {
      const numDeg = this.theme.degreeColors.length;
      const d = ((degree % numDeg) + numDeg) % numDeg;
      const crust = this.theme.degreeColors[d][1];
      const hiCol = packRGBA(crust[0] + 30, crust[1] + 30, crust[2] + 30);
      const loCol = packRGBA(crust[0] * 0.68, crust[1] * 0.68, crust[2] * 0.68);

      for (let i = 0; i < width; i++) {
        const px = (xStart + i * dir) | 0;
        if (px < 0 || px >= this.width) continue;
        // 2px thick brick step so walkers never slip through diagonal seams
        for (let dy = 0; dy <= 1; dy++) {
          const py = (y + dy) | 0;
          if (py < 0 || py >= this.height) continue;
          const idx = py * this.width + px;
          if (this.mat[idx] === MAT.EMPTY) {
            this.mat[idx] = MAT.BRICK;
            this.deg[idx] = d;
            this.baseColor[idx] = (dy === 0) ? hiCol : loCol;
          }
        }
      }
      this.triggerNoteFlash(xStart + dir * 2, y, d, 220);
    }

    triggerNoteFlash(wx, wy, deg = 0, intensity = 200) {
      const gx = Math.floor(wx / 8);
      const gy = Math.floor(wy / 8);
      if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
        const cIdx = gy * this.gridW + gx;
        if (intensity > this.noteFlash[cIdx]) {
          this.noteFlash[cIdx] = Math.min(255, intensity);
          this.noteFlashDeg[cIdx] = deg;
        }
      }
    }

    // Music pushes back The Silence!
    pushSilence(wx, wy, radiusPx = 40, strength = 0.35) {
      if (this.silenceSources.length === 0) return;
      const rCells = Math.ceil(radiusPx / 8);
      const gx0 = Math.floor(wx / 8);
      const gy0 = Math.floor(wy / 8);
      for (let dy = -rCells; dy <= rCells; dy++) {
        const gy = gy0 + dy;
        if (gy < 0 || gy >= this.gridH) continue;
        for (let dx = -rCells; dx <= rCells; dx++) {
          const gx = gx0 + dx;
          if (gx < 0 || gx >= this.gridW) continue;
          const distPx = Math.hypot(dx * 8, dy * 8);
          if (distPx <= radiusPx) {
            const falloff = 1 - distPx / radiusPx;
            const cIdx = gy * this.gridW + gx;
            this.silence[cIdx] = Math.max(0, this.silence[cIdx] - strength * falloff);
          }
        }
      }
    }

    getSilenceAt(wx, wy) {
      if (this.silenceSources.length === 0) return 0;
      const gx = Math.max(0, Math.min(this.gridW - 1, Math.floor(wx / 8)));
      const gy = Math.max(0, Math.min(this.gridH - 1, Math.floor(wy / 8)));
      return this.silence[gy * this.gridW + gx];
    }

    // Update Note-Block flashes, Silence creep, and Piston Crushers (60 Hz deterministic)
    stepEffects(frameCount) {
      // 1. Decay note-block flashes
      for (let i = 0; i < this.noteFlash.length; i++) {
        if (this.noteFlash[i] > 0) {
          this.noteFlash[i] = Math.max(0, this.noteFlash[i] - 12);
        }
      }

      // 2. Creeping Silence diffusion (updates every 4 frames for fast deterministic spread)
      if (this.silenceSources.length > 0 && (frameCount & 3) === 0) {
        for (const src of this.silenceSources) {
          const gx0 = Math.floor(src.x / 8);
          const gy0 = Math.floor(src.y / 8);
          const maxR = Math.ceil(src.maxRadius / 8);
          for (let dy = -maxR; dy <= maxR; dy++) {
            const gy = gy0 + dy;
            if (gy < 0 || gy >= this.gridH) continue;
            for (let dx = -maxR; dx <= maxR; dx++) {
              const gx = gx0 + dx;
              if (gx < 0 || gx >= this.gridW) continue;
              const distPx = Math.hypot(dx * 8, dy * 8);
              if (distPx <= src.maxRadius) {
                const env = 1 - (distPx / src.maxRadius) * 0.72;
                const cIdx = gy * this.gridW + gx;
                this.silence[cIdx] = Math.min(1.0, this.silence[cIdx] + src.rate * env);
              }
            }
          }
        }
      }

      // 3. Beat-synced Piston Crushers
      for (const c of this.crushers) {
        const t = ((frameCount + c.phaseFrames) % c.periodFrames) / c.periodFrames;
        const prevExt = c.curExt;
        // Fast slam on 0.0..0.12, hold 0.12..0.24, smooth retract 0.24..0.65, open 0.65..1.0
        if (t < 0.12) {
          c.curExt = Math.round((t / 0.12) * c.stroke);
        } else if (t < 0.24) {
          c.curExt = c.stroke;
        } else if (t < 0.65) {
          c.curExt = Math.round((1 - (t - 0.24) / 0.41) * c.stroke);
        } else {
          c.curExt = 0;
        }
        c.justSlammed = (prevExt < c.stroke && c.curExt === c.stroke);
      }
    }
  }

  BeatTribe.Terrain = {
    MAT,
    WORLD_THEMES,
    Terrain
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Terrain;
  }
})(typeof window !== 'undefined' ? window : globalThis);
