'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — stages.js
 *  Five evolutionary epochs: palettes (+ palette cycling), procedural parallax
 *  textures, pixel-perfect destructible cavern terrain with forks, dead-ends and
 *  bottleneck plugs, baked with bevel lighting, plus enemy spawn scripts.
 * ===========================================================================*/
const Stages = (() => {
  const W = 320, PH = 188;
  const { R, C } = GFX;

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function makeNoise(seed) {
    const r = rng(seed), N = 128, lat = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) lat[i] = r();
    return (x, y, P = N) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      const a = lat[y0 * N + x0], b = lat[y0 * N + x1], c = lat[y1 * N + x0], d = lat[y1 * N + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  // tileable fbm over [0,1)^2
  function fbmT(n, u, v, cells, oct) { let s = 0, a = 0.5, t = 0; for (let k = 0; k < oct; k++) { const P = cells << k; s += n(u * P, v * P, P) * a; t += a; a *= 0.5; } return s / t; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function hsv(h, s, v) { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return [m[0] * 255, m[1] * 255, m[2] * 255]; }

  // tile helpers (256x256 wrap)
  const T256 = () => new Uint8Array(65536);
  const tset = (t, x, y, v) => { t[((y & 255) << 8) | (x & 255)] = v; };
  function tdisc(t, cx, cy, r, fn) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.hypot(dx, dy) / r; if (d <= 1) { const v = fn(d, dx, dy); if (v) tset(t, cx + dx, cy + dy, v); } } }
  function tline(t, x0, y0, x1, y1, v, w = 1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let k = 0; k < w; k++) tset(t, Math.round(x) + k, Math.round(y), v); } }
  function gearShape(t, cx, cy, r, teeth, base, lvl, shade) {
    for (let dy = -r - 4; dy <= r + 4; dy++) for (let dx = -r - 4; dx <= r + 4; dx++) {
      const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy), ro = r + (Math.cos(a * teeth) > 0.2 ? 3 : 0);
      if (d > ro || d < r * 0.25) continue;
      if (d > r * 0.45 && d < r * 0.75 && Math.cos(a * 5) < 0.3) continue;
      const l = clamp(Math.round(lvl + (shade ? (-dx - dy) / (r * 2) * 4 : 0)), 1, 15);
      tset(t, cx + dx, cy + dy, base + l);
    }
  }

  // =============================================================== EPOCHS
  const DEFS = [
    {
      name: 'CAMBRIAN TRILOBITE REEF', epoch: '541 MILLION YEARS BC', boss: 0, bossName: 'THE LEVIATHAN ANOMALOCARIS',
      pal: {
        S0: [[0, 8, 16], [0, 30, 50], [10, 70, 92], [40, 130, 140], [150, 222, 210]],
        S1: [[0, 14, 24], [8, 44, 58], [30, 86, 96], [84, 142, 140], [184, 222, 200]],
        S2: [[20, 8, 6], [82, 42, 30], [162, 98, 70], [226, 172, 132], [255, 242, 222]],
        S3: [[30, 0, 16], [112, 20, 62], [212, 72, 112], [255, 152, 172], [255, 236, 240]],
        E0: [[16, 8, 0], [72, 42, 16], [152, 98, 42], [222, 172, 92], [255, 246, 202]],
        E1: [[26, 10, 6], [112, 52, 22], [202, 122, 62], [246, 202, 142], [255, 250, 236]],
      },
      cycle: (t, k) => lerp3([10, 70, 90], [190, 255, 240], Math.pow(0.5 + 0.5 * Math.sin(k / 32 * Math.PI * 2 + t * 0.06), 2)),
      style: 'organic', wob: 22, rough: 2.5, bevel: 7, light: 'organic', scroll: 0.55,
      segW: { open: 3, narrow: 2, bottleneck: 2, fork: 1.6, zigzag: 1 },
      waves: [[3, 'snake', 'trilobite', 6], [2, 'spinner', 'ammonite', 3], [2, 'crawler', 'trilobite', 4], [1, 'tank', 'eurypterid', 1], [1.5, 'diver', 'trilobite', 5]],
      turret: 'coralturret', hazards: [],
    },
    {
      name: 'ABYSSAL NAUTILOID TRENCH', epoch: '450 MILLION YEARS BC', boss: 1, bossName: 'THE KRAKEN-NAUTILUS',
      pal: {
        S0: [[0, 0, 4], [0, 4, 18], [0, 14, 42], [10, 40, 82], [60, 112, 162]],
        S1: [[0, 2, 8], [4, 12, 30], [14, 30, 60], [40, 72, 112], [122, 162, 202]],
        S2: [[4, 4, 10], [20, 20, 36], [50, 52, 78], [102, 108, 138], [202, 212, 232]],
        S3: [[20, 0, 0], [122, 22, 0], [232, 92, 12], [255, 192, 62], [255, 255, 202]],
        E0: [[10, 0, 20], [60, 10, 92], [142, 52, 192], [212, 132, 255], [250, 232, 255]],
        E1: [[20, 8, 4], [102, 42, 20], [202, 112, 72], [242, 202, 172], [255, 250, 240]],
      },
      cycle: (t, k) => lerp3([0, 16, 36], [70, 255, 210], Math.pow(0.5 + 0.5 * Math.sin(k / 32 * Math.PI * 4 - t * 0.05), 3)),
      style: 'organic', wob: 26, rough: 3.5, bevel: 8, light: 'metal', scroll: 0.58,
      segW: { open: 2, narrow: 2, bottleneck: 1.5, fork: 1.5, zigzag: 2 },
      waves: [[3, 'darter', 'squid', 5], [2, 'spinner', 'nautilus', 2], [2, 'minefield', 'mine', 8], [1, 'tank', 'angler', 1], [1.5, 'snake', 'squid', 6]],
      turret: 'vent', hazards: [],
    },
    {
      name: 'BABBAGE CLOCKWORK FOUNDRY', epoch: '1822 AD', boss: 2, bossName: 'THE DIFFERENCE ENGINE AUTOMATON',
      pal: {
        S0: [[10, 5, 2], [40, 22, 10], [86, 56, 30], [142, 106, 72], [212, 192, 152]],
        S1: [[8, 4, 0], [30, 18, 8], [62, 40, 20], [102, 76, 46], [162, 132, 92]],
        S2: [[16, 8, 0], [82, 46, 10], [166, 112, 36], [232, 192, 92], [255, 250, 212]],
        S3: [[10, 10, 14], [52, 52, 62], [112, 112, 128], [182, 186, 202], [250, 250, 255]],
        E0: [[20, 10, 0], [96, 56, 10], [186, 126, 40], [242, 202, 102], [255, 255, 222]],
        E1: [[16, 6, 0], [92, 36, 16], [182, 86, 46], [236, 152, 102], [255, 232, 202]],
      },
      cycle: (t, k) => lerp3([60, 10, 0], [255, 190, 70], clamp(0.5 + 0.5 * Math.sin(k * 0.7 + t * 0.21) * Math.sin(t * 0.13 + k * 0.1), 0, 1)),
      style: 'steps', wob: 18, rough: 0, bevel: 5, light: 'metal', scroll: 0.6,
      segW: { open: 2, narrow: 3, bottleneck: 2, fork: 1.5, zigzag: 1.5 },
      waves: [[3, 'snake', 'gear', 6], [2, 'diver', 'beetle', 5], [1, 'tank', 'automaton', 1], [1.5, 'spinner', 'gear', 3]],
      turret: 'brassturret', hazards: ['piston', 'arc'],
    },
    {
      name: '1989 DEMOSCENE SILICON WAFER', epoch: '1989 AD', boss: 3, bossName: 'THE 68000 CYBER-BLITTER',
      pal: {
        S0: [[0, 0, 10], [0, 0, 30], [10, 10, 62], [42, 42, 112], [122, 122, 202]],
        S1: [[0, 6, 12], [0, 30, 42], [0, 82, 92], [42, 172, 172], [182, 255, 255]],
        S2: [[0, 10, 6], [6, 46, 22], [22, 96, 46], [72, 162, 92], [202, 242, 202]],
        S3: [[20, 10, 0], [102, 66, 10], [202, 152, 42], [252, 222, 112], [255, 255, 232]],
        E0: [[20, 0, 30], [92, 0, 142], [172, 42, 232], [232, 142, 255], [255, 242, 255]],
        E1: [[0, 10, 20], [10, 62, 92], [42, 142, 182], [142, 222, 242], [250, 255, 255]],
      },
      cycle: (t, k) => { const c = hsv(Math.floor(k / 8) / 4 + t * 0.003, 0.85, 1); const b = 1 - Math.abs(((k % 8) - 3.5) / 4); return [c[0] * b, c[1] * b, c[2] * b]; },
      style: 'pcb', wob: 16, rough: 0, bevel: 4, light: 'metal', scroll: 0.62, copper: true,
      segW: { open: 2, narrow: 2, bottleneck: 2, fork: 2, zigzag: 2 },
      waves: [[3, 'lissajous', 'bob', 8], [2, 'vcube', 'vcube', 2], [2, 'diver', 'copperdiver', 6], [1, 'bouncer', 'boing', 1]],
      turret: 'chip', hazards: [],
    },
    {
      name: 'BIOMECHANICAL XENITE HIVE', epoch: 'THE XENITE ERA', boss: 4, bossName: 'THE SOVEREIGN XENITE MOTHER-BRAIN',
      pal: {
        S0: [[8, 0, 4], [36, 5, 20], [76, 16, 40], [132, 40, 72], [202, 112, 142]],
        S1: [[5, 5, 8], [26, 26, 36], [56, 56, 72], [102, 102, 122], [182, 182, 202]],
        S2: [[6, 4, 10], [36, 26, 52], [86, 72, 106], [152, 142, 176], [242, 236, 255]],
        S3: [[26, 0, 10], [102, 16, 42], [186, 56, 86], [242, 132, 152], [255, 226, 232]],
        E0: [[0, 8, 4], [10, 42, 26], [42, 96, 62], [112, 172, 122], [222, 255, 222]],
        E1: [[30, 0, 10], [122, 26, 52], [202, 82, 112], [250, 162, 182], [255, 236, 242]],
      },
      cycle: (t, k) => lerp3([40, 0, 10], [255, 70, 90], Math.pow(0.5 + 0.5 * Math.sin(t * 0.08 - k * 0.35), 2)),
      style: 'organic', wob: 24, rough: 4, bevel: 7, light: 'chrome', scroll: 0.64,
      segW: { open: 1.5, narrow: 2, bottleneck: 2, fork: 2, zigzag: 2 },
      waves: [[3, 'snake', 'wasp', 6], [2, 'crawler', 'hugger', 4], [1, 'tank', 'warrior', 1], [2, 'homers', 'spore', 6]],
      turret: 'pod', hazards: ['gate'],
    },
  ];

  function applyPalette(def) { for (const k of ['S0', 'S1', 'S2', 'S3', 'E0', 'E1']) GFX.ramp(R[k], def.pal[k]); }
  function cyclePalette(def, t) {
    for (let k = 0; k < 32; k++) { const c = def.cycle(t, k); GFX.setRGB(R.CYC + k, c[0], c[1], c[2]); }
    const b = (Math.floor(t / 8) & 1) === 0;
    GFX.setRGB(C.BLINK, b ? 255 : 255, b ? 236 : 90, b ? 60 : 20);
    GFX.setRGB(C.BLINK2, 255, 60 + 120 * (0.5 + 0.5 * Math.sin(t * 0.3)), 30);
  }

  // =============================================================== TEXTURES
  function genFar(i, rnd, n) {
    const t = T256();
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const u = x / 256, v = y / 256, f = fbmT(n, u, v, 4, 4);
      let idx;
      if (i === 0) {
        const sh = Math.sin(u * Math.PI * 2 * 3 + v * Math.PI * 2 + f * 3);
        idx = sh > 0.86 ? R.CYC + (((x + y * 2) >> 2) & 31) : R.S0 + clamp(Math.round(2 + f * 8 + (1 - v) * 0), 1, 11);
      } else if (i === 1) {
        idx = R.S0 + clamp(Math.round(f * 7), 1, 8);
      } else if (i === 2) {
        idx = R.S0 + clamp(Math.round(3 + f * 7 + Math.sin(v * Math.PI * 8 + f * 4) * 1.2), 1, 12);
      } else if (i === 3) {
        idx = 0;
      } else {
        const vein = Math.abs(fbmT(n, u + 0.37, v + 0.11, 3, 3) - 0.5) < 0.018;
        idx = vein ? R.CYC + (((x >> 2) + (y >> 3)) & 31) : R.S0 + clamp(Math.round(1 + f * 9), 1, 11);
      }
      t[(y << 8) | x] = idx;
    }
    if (i === 1) for (let k = 0; k < 420; k++) tset(t, rnd() * 256, rnd() * 256, R.CYC + ((rnd() * 32) | 0));
    if (i === 0) for (let k = 0; k < 260; k++) tset(t, rnd() * 256, rnd() * 256, R.S0 + 12 + ((rnd() * 3) | 0));
    if (i === 2) for (let k = 0; k < 5; k++) gearShape(t, (rnd() * 256) | 0, (rnd() * 256) | 0, (18 + rnd() * 22) | 0, 10 + ((rnd() * 8) | 0), R.S0, 2, false);
    if (i === 3) for (let k = 0; k < 380; k++) { const b = rnd(); tset(t, rnd() * 256, rnd() * 256, b > 0.9 ? C.WHITE : R.S0 + 6 + ((b * 9) | 0)); }
    return t;
  }
  function genMid(i, rnd, n) {
    const t = T256();
    if (i === 0) { // crinoid stalks, boulders & fossil spirals
      for (let k = 0; k < 7; k++) {
        const bx = rnd() * 256, by = rnd() * 256, ph = rnd() * 6, h = 50 + rnd() * 60;
        for (let s = 0; s < h; s++) { const x = bx + Math.sin(s * 0.06 + ph) * 7; tset(t, x, by - s, R.S1 + 5); tset(t, x + 1, by - s, R.S1 + 8); }
        const cx = bx + Math.sin(h * 0.06 + ph) * 7, cy = by - h;
        for (let a = 0; a < 9; a++) { const an = -Math.PI / 2 + (a - 4) * 0.32; tline(t, cx, cy, cx + Math.cos(an) * 16, cy + Math.sin(an) * 16 + 4, R.S1 + 7 + (a % 3)); }
        tdisc(t, Math.round(cx), Math.round(cy), 3, () => R.S1 + 10);
      }
      for (let k = 0; k < 6; k++) { const cx = (rnd() * 256) | 0, cy = (rnd() * 256) | 0; for (let a = 0; a < Math.PI * 7; a += 0.05) { const r = 1.5 + a * 1.4; tset(t, cx + Math.cos(a) * r, cy + Math.sin(a) * r, R.S1 + 9); } }
    } else if (i === 1) { // pillars & drifting jellies
      for (let x = 0; x < 256; x++) {
        const w = fbmT(n, x / 256, 0.5, 4, 3);
        if (w > 0.6) for (let y = 0; y < 256; y++) { const e = fbmT(n, x / 256, y / 256, 8, 2); tset(t, x, y, R.S1 + clamp(Math.round(2 + (w - 0.6) * 18 + e * 3), 1, 9)); }
      }
      for (let k = 0; k < 8; k++) {
        const cx = (rnd() * 256) | 0, cy = (rnd() * 256) | 0;
        tdisc(t, cx, cy, 6, (d, dx, dy) => dy <= 1 ? R.S1 + clamp(Math.round(12 - d * 6), 4, 13) : 0);
        for (let j = -2; j <= 2; j++) for (let s = 0; s < 12; s++) tset(t, cx + j * 2 + Math.sin(s * 0.5 + j) * 1.2, cy + 2 + s, R.S1 + 8);
      }
    } else if (i === 2) { // gears & pipes
      for (let k = 0; k < 7; k++) gearShape(t, (rnd() * 256) | 0, (rnd() * 256) | 0, (10 + rnd() * 16) | 0, 8 + ((rnd() * 6) | 0), R.S1, 7, true);
      for (let k = 0; k < 4; k++) { const x0 = (rnd() * 256) | 0; for (let y = 0; y < 256; y++) for (let w = 0; w < 6; w++) if (!t[((y & 255) << 8) | ((x0 + w) & 255)]) tset(t, x0 + w, y, R.S1 + [3, 6, 9, 10, 7, 4][w]); }
    } else if (i === 3) { // vector grid + blitter nodes
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        if ((x & 31) === 0 || (y & 31) === 0) t[(y << 8) | x] = ((x & 31) === 0 && (y & 31) === 0) ? R.CYC + (((x + y) >> 5) & 31) : R.S1 + (((x ^ y) & 4) ? 5 : 7);
      }
      for (let k = 0; k < 10; k++) { const cx = ((rnd() * 8) | 0) * 32 + 16, cy = ((rnd() * 8) | 0) * 32 + 16; tdisc(t, cx, cy, 4, d => R.S1 + clamp(Math.round(13 - d * 9), 3, 14)); }
    } else { // Giger ribcage
      for (let rep = 0; rep < 2; rep++) {
        const sx = rep * 128 + 64;
        for (let y = 0; y < 256; y++) for (let w = -5; w <= 5; w++) { const l = clamp(Math.round(10 - Math.abs(w) * 1.5 + ((y % 16) < 3 ? -4 : 0)), 1, 13); tset(t, sx + w, y, R.S1 + l); }
        for (let y0 = 0; y0 < 256; y0 += 16) for (const sd of [-1, 1]) for (let s = 0; s < 52; s++) {
          const x = sx + sd * (6 + s), y = y0 + 3 + Math.pow(s / 52, 2) * 18 - Math.sin(s / 52 * Math.PI) * 6;
          for (let th = 0; th < 3; th++) tset(t, x, y + th, R.S1 + clamp(12 - th * 3 - (s >> 4), 2, 13));
        }
      }
    }
    return t;
  }
  function genWallTex(i, rnd, n) {
    const S = 128, off = new Float32Array(S * S), mat = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, f = fbmT(n, u, v, 4, 4), k = y * S + x;
      if (i === 0) off[k] = (f - 0.5) * 0.55 + (fbmT(n, u, v, 16, 2) - 0.5) * 0.25;
      else if (i === 1) {
        const cx = (x & 15) - 8, cy = (y & 15) - 8, j = fbmT(n, u, v, 8, 2);
        const e = Math.max(Math.abs(cx + (j - 0.5) * 6), Math.abs(cy + (j - 0.5) * 6));
        off[k] = (f - 0.5) * 0.35 + (e > 6.5 ? -0.35 : 0);
        if (e > 6.8 && f > 0.55) mat[k] = 2;
      } else if (i === 2) {
        const px = x & 31, py = y & 31; let o = (f - 0.5) * 0.15;
        if (px === 0 || py === 0) o -= 0.4; else if (px === 1 || py === 1) o += 0.25;
        const rv = Math.min(Math.hypot(px - 4, py - 4), Math.hypot(px - 28, py - 4), Math.hypot(px - 4, py - 28), Math.hypot(px - 28, py - 28));
        if (rv < 1.6) o += 0.45; else if (rv < 2.4) o -= 0.25;
        if (((x + y) & 63) < 3 && py > 12 && py < 20) mat[k] = 2;
        off[k] = o;
      } else if (i === 3) {
        off[k] = (f - 0.5) * 0.12;
      } else {
        const r = Math.sin(y * 0.45 + Math.sin(x * 0.07) * 2.2);
        off[k] = r * 0.3 + (f - 0.5) * 0.2;
        if (r < -0.72) mat[k] = 1;
      }
    }
    if (i === 3) { // PCB traces, pads and chips
      for (let k = 0; k < 26; k++) {
        let x = (rnd() * S) | 0, y = (rnd() * S) | 0; const len = 10 + ((rnd() * 40) | 0), dir = (rnd() * 4) | 0;
        const dx = [1, 0, 1, -1][dir], dy = [0, 1, 1, 1][dir];
        for (let s = 0; s < len; s++) { const kk = ((y & 127) << 7) | (x & 127); mat[kk] = 1; off[kk] = 0.2; x += dx; y += dy; }
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 4) { const kk = (((y + b) & 127) << 7) | ((x + a) & 127); mat[kk] = 1; off[kk] = 0.35; }
      }
      for (let k = 0; k < 4; k++) { const x0 = (rnd() * S) | 0, y0 = (rnd() * S) | 0; for (let b = 0; b < 12; b++) for (let a = 0; a < 18; a++) { const kk = (((y0 + b) & 127) << 7) | ((x0 + a) & 127); mat[kk] = 0; off[kk] = (a === 0 || b === 0) ? 0.1 : -0.55; } }
    }
    if (i === 0) for (let k = 0; k < 14; k++) { // fossil rings
      const cx = rnd() * S, cy = rnd() * S, r = 3 + rnd() * 7;
      for (let a = 0; a < 6.3; a += 0.05) for (const rr of [r, r * 0.6]) { const kk = ((((cy + Math.sin(a) * rr) | 0) & 127) << 7) | (((cx + Math.cos(a) * rr) | 0) & 127); off[kk] -= 0.3; }
    }
    return { off, mat };
  }
  // chunky rubble for destructible plugs
  const RUB = (() => {
    const S = 64, o = new Float32Array(S * S), r = rng(77), pts = [];
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) pts.push([gx * 8 + 2 + r() * 4, gy * 8 + 2 + r() * 4]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 99, d2 = 99;
      for (const p of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const d = Math.hypot(x - p[0] - ox, y - p[1] - oy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      o[y * S + x] = (d2 - d1 < 1.2) ? -0.45 : 0.25 - d1 * 0.05;
    }
    return o;
  })();

  // =============================================================== TERRAIN
  function build(idx, loopN = 0) {
    const def = DEFS[idx], rnd = rng(1000 + idx * 7919 + loopN * 31), n = makeNoise(idx * 101 + 5);
    applyPalette(def);
    const ARENA = 360, len = 4800 + ARENA;
    const keys = [{ d: 0, l: 14, r: 306 }];
    const add = (d, l, r) => keys.push({ d, l, r });
    const forks = [], plugs = [], narrows = [], bottles = [];
    let d = 260; add(260, 16, 304);
    const midD = Math.floor((len - ARENA) * 0.5);
    let midShop = 0;
    while (d < len - ARENA - 300) {
      if (!midShop && d > midD - 180) { add(d + 60, 22, 298); add(d + 280, 22, 298); midShop = d + 150; d += 280; continue; }
      const ws = def.segW, tot = Object.values(ws).reduce((a, b) => a + b, 0);
      let pick = rnd() * tot, type = 'open';
      for (const k in ws) { pick -= ws[k]; if (pick <= 0) { type = k; break; } }
      if (type === 'open') { const L2 = 180 + rnd() * 120; add(d + L2 * 0.45, 16 + rnd() * 34, 304 - rnd() * 34); add(d + L2, 22 + rnd() * 40, 298 - rnd() * 40); d += L2; }
      else if (type === 'narrow') {
        const c = 110 + rnd() * 100, w = 112 + rnd() * 40;
        add(d + 80, c - w / 2, c + w / 2); add(d + 250, c - w / 2 + (rnd() - 0.5) * 40, c + w / 2 + (rnd() - 0.5) * 40);
        narrows.push([d + 90, d + 240]); d += 250;
      } else if (type === 'zigzag') {
        for (let k = 0; k < 4; k++) { const c = (k % 2) ? 115 : 205; add(d + 90 * (k + 1), c - 62, c + 62); }
        narrows.push([d + 60, d + 340]); d += 360;
      } else if (type === 'bottleneck') {
        const c = 100 + rnd() * 120, w = 66;
        add(d + 100, c - w / 2, c + w / 2); add(d + 180, c - w / 2, c + w / 2); add(d + 280, 40, 280);
        plugs.push({ d0: d + 122, d1: d + 152, x0: 0, x1: W, tough: 1 }); bottles.push(d + 137); d += 280;
      } else if (type === 'fork') {
        add(d + 80, 18, 302);
        const f0 = d + 100, f1 = d + 330, cx = 140 + rnd() * 40, iw = 74 + rnd() * 18;
        forks.push({ d0: f0, d1: f1, cx, iw, dead: rnd() < 0.5 ? 'L' : 'R' });
        add(f1 + 30, 18, 302); add(f1 + 90, 40, 280); d = f1 + 90;
      }
    }
    add(len - ARENA - 40, 30, 290); add(len - ARENA + 40, 12, 308); add(len + 10, 12, 308);
    const L = new Float32Array(len), Rr = new Float32Array(len), IL = new Float32Array(len).fill(-1), IR = new Float32Array(len).fill(-1);
    let ki = 0;
    for (let y = 0; y < len; y++) {
      while (ki < keys.length - 2 && keys[ki + 1].d <= y) ki++;
      const a = keys[ki], b = keys[ki + 1];
      let u = clamp((y - a.d) / Math.max(1, b.d - a.d), 0, 1); u = u * u * (3 - 2 * u);
      const wob = (n(y * 0.012, 3.3) - 0.5) * def.wob, wob2 = (n(y * 0.012, 9.7) - 0.5) * def.wob;
      const ro1 = (n(y * 0.11, 17.1) - 0.5) * def.rough * 2, ro2 = (n(y * 0.11, 23.9) - 0.5) * def.rough * 2;
      const inArena = y > len - ARENA ? 0 : 1;
      L[y] = a.l + (b.l - a.l) * u + (wob + ro1) * inArena; Rr[y] = a.r + (b.r - a.r) * u + (wob2 + ro2) * inArena;
      if (Rr[y] - L[y] < 60) { const m = (L[y] + Rr[y]) / 2; L[y] = m - 30; Rr[y] = m + 30; }
    }
    if (def.style === 'steps' || def.style === 'pcb') {
      const q = def.style === 'steps' ? 8 : 6;
      for (let y = 0; y < len; y++) { const ys = y - (y % q); L[y] = Math.round(L[ys] / q) * q; Rr[y] = Math.round(Rr[ys] / q) * q; }
    }
    for (const f of forks) {
      for (let y = f.d0; y < f.d1 + 6 && y < len; y++) {
        const u = (y - f.d0) / (f.d1 - f.d0), sh = Math.pow(clamp(Math.min(u / 0.16, (1.05 - u) / 0.1), 0, 1), 0.6);
        const hw = f.iw / 2 * sh + (n(y * 0.05, 41) - 0.5) * 6 * sh;
        if (hw > 1) { IL[y] = f.cx - hw; IR[y] = f.cx + hw; }
        L[y] = Math.min(L[y], 22); Rr[y] = Math.max(Rr[y], 298);
      }
      plugs.push({ d0: f.d1 - 44, d1: f.d1 + 16, x0: f.dead === 'L' ? 0 : f.cx, x1: f.dead === 'L' ? f.cx : W, tough: 2 });
    }
    // ---- solid mask
    const wall = new Uint8Array(W * len), destr = new Uint8Array(W * len);
    for (let y = 0; y < len; y++) {
      const o = y * W, l = L[y], r = Rr[y], il = IL[y], ir = IR[y];
      for (let x = 0; x < W; x++) if (x < l || x >= r || (il >= 0 && x >= il && x < ir)) wall[o + x] = 1;
    }
    for (const p of plugs) for (let y = Math.max(0, p.d0 - 6); y < Math.min(len, p.d1 + 6); y++) for (let x = Math.max(0, p.x0 | 0); x < Math.min(W, p.x1 | 0); x++) {
      const j0 = p.d0 + (n(x * 0.2, y * 0.01 + 50) - 0.5) * 10, j1 = p.d1 + (n(x * 0.2, 60) - 0.5) * 10;
      const i = y * W + x; if (y >= j0 && y <= j1 && !wall[i]) { wall[i] = 1; destr[i] = p.tough; }
    }
    // ---- distance transform (chamfer) inside solids
    const dist = new Float32Array(W * len);
    for (let i = 0; i < W * len; i++) dist[i] = wall[i] ? 99 : 0;
    for (let y = 0; y < len; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!dist[i]) continue;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) { v = Math.min(v, dist[i - W] + 1); if (x > 0) v = Math.min(v, dist[i - W - 1] + 1.414); if (x < W - 1) v = Math.min(v, dist[i - W + 1] + 1.414); }
      dist[i] = v;
    }
    for (let y = len - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; if (!dist[i]) continue;
      let v = dist[i];
      if (x < W - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < len - 1) { v = Math.min(v, dist[i + W] + 1); if (x < W - 1) v = Math.min(v, dist[i + W + 1] + 1.414); if (x > 0) v = Math.min(v, dist[i + W - 1] + 1.414); }
      dist[i] = v;
    }
    // ---- bake lit wall pixels
    const tex = genWallTex(idx, rnd, n), rad = def.bevel, BY = GFX.BAYER;
    const hOf = (dd) => { const t = Math.min(1, dd / rad); return Math.sqrt(1 - (1 - t) * (1 - t)); };
    const lx = -0.5, ly = -0.62, lz = 0.6;
    for (let y = 0; y < len; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!wall[i]) continue;
      const dd = dist[i];
      const hl = x > 0 ? hOf(dist[i - 1]) : 1, hr = x < W - 1 ? hOf(dist[i + 1]) : 1;
      const hu = y < len - 1 ? hOf(dist[i + W]) : 1, hd = y > 0 ? hOf(dist[i - W]) : 1;
      let nx = (hl - hr) * rad * 0.5, ny = (hu - hd) * rad * 0.5, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const diff = Math.max(0, nx * lx + ny * ly + nz * lz), sp = Math.pow(Math.max(0, nx * -0.28 + ny * -0.36 + nz * 0.89), 18);
      let s;
      if (def.light === 'organic') s = 0.12 + 0.6 * diff + 0.25 * sp;
      else if (def.light === 'chrome') { const ry = 2 * nz * ny + Math.sin(y * 0.05) * 0.3; s = (ry < 0 ? 0.55 - ry * 0.4 : 0.15 + ry * 0.4) * 0.6 + diff * 0.25 + sp * 0.7; }
      else s = 0.08 + 0.62 * diff + 0.6 * sp;
      if (dd > rad + 2) s -= Math.min(0.3, (dd - rad - 2) * 0.015);
      const ti = ((y & 127) << 7) | (x & 127);
      let base = R.S2;
      if (destr[i]) { base = R.S3; s += RUB[((y & 63) << 6) | (x & 63)] + (destr[i] === 2 ? -0.12 : 0.05); }
      else { s += tex.off[ti]; const m = tex.mat[ti]; if (m === 1) base = R.S3; else if (m === 2 && dd > 2) { wall[i] = R.CYC + ((x + y) & 31); continue; } }
      let lv = Math.round(s * 15 + (BY[(y & 3) * 4 + (x & 3)] - 0.5) * 1.2); lv = lv < 1 ? 1 : lv > 15 ? 15 : lv;
      wall[i] = base + lv;
    }
    // ---- fork hint chevrons (blinking) on island tips
    for (const f of forks) {
      const dir = f.dead === 'L' ? 1 : -1, ty = f.d0 + 26;
      for (let c = 0; c < 2; c++) for (let s = -5; s <= 5; s++) {
        const x = Math.round(f.cx + dir * (Math.abs(s) * -0.9 + 3 + c * 7)), y = ty + s + 6;
        for (let w = 0; w < 2; w++) { const i = y * W + x + w * dir; if (y > 0 && y < len && wall[i]) wall[i] = C.BLINK; }
      }
    }
    const events = spawnScript(def, idx, rnd, len, ARENA, wall, narrows, forks, midShop, loopN);
    return { def, idx, len, arena: ARENA, wall, destr, far: genFar(idx, rnd, n), mid: genMid(idx, rnd, n), events, camStop: len - PH, midShop, forks, bottles };
  }

  function edgeL(wall, d) { const o = d * W; for (let x = 0; x < W; x++) if (!wall[o + x]) return x; return W; }
  function edgeR(wall, d) { const o = d * W; for (let x = W - 1; x >= 0; x--) if (!wall[o + x]) return x; return -1; }

  function spawnScript(def, idx, rnd, len, ARENA, wall, narrows, forks, midShop, loopN) {
    const ev = [], end = len - ARENA - 120;
    const inFork = d => forks.some(f => d > f.d0 - 20 && d < f.d1 + 20);
    const tot = def.waves.reduce((a, w) => a + w[0], 0);
    for (let d = 330; d < end; d += 125 + rnd() * 75 - loopN * 10) {
      if (Math.abs(d - midShop) < 120) continue;
      let pick = rnd() * tot, w = def.waves[0];
      for (const x of def.waves) { pick -= x[0]; if (pick <= 0) { w = x; break; } }
      if (inFork(d) && (w[1] === 'tank' || w[1] === 'bouncer')) continue;
      ev.push({ d, t: 'wave', beh: w[1], kind: w[2], n: w[3] + Math.min(3, loopN), x: 60 + rnd() * 200, seed: (rnd() * 1e6) | 0 });
    }
    let side = 0;
    for (let d = 420; d < end; d += 170 + rnd() * 140) {
      const di = d | 0, l = edgeL(wall, di), r = edgeR(wall, di);
      side ^= 1;
      if (side && l >= 20) ev.push({ d: di, t: 'turret', kind: def.turret, side: -1, x: l });
      else if (!side && W - r >= 20) ev.push({ d: di, t: 'turret', kind: def.turret, side: 1, x: r });
    }
    for (const hz of def.hazards) {
      if (hz === 'piston') for (const [a, b] of narrows) for (let d = a + 20; d < b - 10; d += 60) {
        const di = d | 0, l = edgeL(wall, di), r = edgeR(wall, di); if (r - l < 90) continue;
        const sd = ((d / 60) | 0) % 2 ? -1 : 1; ev.push({ d: di, t: 'hazard', kind: 'piston', side: sd, x: sd < 0 ? l : r, reach: (r - l) * 0.62 });
      }
      if (hz === 'arc' || hz === 'gate') for (let d = 600; d < end; d += 380 + rnd() * 260) {
        const di = d | 0; if (inFork(di) || Math.abs(di - midShop) < 140) continue;
        const l = edgeL(wall, di), r = edgeR(wall, di); if (r - l > 230 || r - l < 50) continue;
        ev.push({ d: di, t: 'hazard', kind: hz, xl: l, xr: r });
      }
    }
    ev.push({ d: midShop, t: 'shop' });
    ev.sort((a, b) => a.d - b.d);
    return ev;
  }

  return { DEFS, build, applyPalette, cyclePalette, edgeL, edgeR };
})();
