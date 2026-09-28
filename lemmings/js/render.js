/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — render.js
 * Level view: world-specific terrain textures baked from the note map,
 * parallax backgrounds, animated hazards, lemmings, particles, beat pulse,
 * note-block flashes, the grey Silence, and the classic bottom panel.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const M = BT.MAT, ST = BT.ST, P = BT.PAL;
  const rgb = BT.rgb, C = BT.hexc;
  const PH = BT.PLAY_H;

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dither = (x, y) => bayer[(y & 3) * 4 + (x & 3)] / 16;
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const OW_ARROW = ['........', '...X....', '....X...', '.XXXXX..', '....X...', '...X....', '........', '........'];

  class LevelView {
    constructor(sim) {
      this.sim = sim;
      this.world = sim.world;
      this.W = sim.W;
      this.degC = this.world.deg.map((d) => rgb(d[0], d[1], d[2]));
      this.tcol = new Uint32Array(this.W * PH);
      this.edge = new Uint8Array(this.W * PH);
      this.cw = Math.ceil(this.W / 8);
      this.flash = new Float32Array(this.cw * 20);
      this.parts = [];
      this.notes = [];
      this.texts = [];
      this.recolor(0, 0, this.W - 1, PH - 1);
      this.buildBackground();
      this.miniDirty = true;
      this.miniVer = -1;
    }

    /* ---------------- terrain texture ---------------- */
    recolor(x0, y0, x1, y1) {
      const T = this.sim.terrain, W = this.W, key = this.world.key;
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 4); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(PH - 1, y1 + 4);
      const mat = T.mat, deg = T.deg;
      const steelBase = key === 'acid' ? [150, 156, 176] : key === 'synth' ? [170, 160, 200] : key === 'jungle' ? [110, 130, 128] : key === 'hall' ? [178, 170, 160] : [150, 150, 160];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, m = mat[i];
        if (!m) { this.tcol[i] = 0; this.edge[i] = 0; continue; }
        let depth = 0;
        while (depth < 4 && y - depth - 1 >= 0 && mat[i - (depth + 1) * W]) depth++;
        if (y - depth - 1 < 0) depth = 4;
        const side = (x > 0 && !mat[i - 1]) || (x < W - 1 && !mat[i + 1]);
        this.edge[i] = depth === 0 ? 2 : side ? 1 : 0;
        let c;
        if (m === M.STEEL) {
          const px = x & 7, py = y & 7;
          let f = 0.6 + BT.hash2(x, y, 3) * 0.06;
          if (px === 0 || py === 0) f = 0.85; else if (px === 7 || py === 7) f = 0.38;
          if ((px === 2 && py === 2) || (px === 5 && py === 5)) f = 1.0;
          c = rgb(steelBase[0] * f, steelBase[1] * f, steelBase[2] * f);
        } else if (m === M.OW_LEFT || m === M.OW_RIGHT) {
          const base = this.degC[deg[i] % this.degC.length];
          let ax = x & 7; if (m === M.OW_LEFT) ax = 7 - ax;
          const on = OW_ARROW[y & 7][ax] === 'X';
          c = BT.shade(base, on ? 1.25 : 0.42 + BT.hash2(x, y, 5) * 0.08);
          if (on) c = BT.mix(c, rgb(255, 255, 255), 0.35);
        } else {
          c = this.earth(x, y, this.degC[deg[i] % this.degC.length], depth, side, key);
        }
        this.tcol[i] = c;
      }
      this.miniDirty = true;
    }
    earth(x, y, base, depth, side, key) {
      const h = BT.hash2(x, y, 9);
      let f, c;
      switch (key) {
        case 'garden': {
          const row = Math.floor(y / 6), bx = (x + (row & 1) * 6) % 12, by = y % 6;
          f = 0.74 + h * 0.14;
          if (by === 0 || bx === 0) f = 0.46; else if (by === 1 || bx === 1) f += 0.14;
          c = BT.shade(base, f);
          if (depth <= 2) {
            const g = depth === 0 ? C(0x9cf05a) : depth === 1 ? C(0x4cc83a) : C(0x2c9a2c);
            c = BT.mix(c, g, depth === 2 ? (h > 0.5 ? 0.7 : 0.2) : 0.85);
          }
          break;
        }
        case 'acid': {
          const lat = (x + y) % 12 === 0 || (x - y + 1200) % 12 === 0;
          f = lat ? 0.8 : 0.24 + h * 0.08;
          if ((y % 12) === 0) f = 0.55;
          c = BT.shade(base, f);
          if (depth === 0) c = BT.mix(base, rgb(255, 255, 255), 0.35);
          else if (depth === 1 || side) c = BT.shade(base, 1.0);
          break;
        }
        case 'synth': {
          f = 0.3 + 0.62 * (1 - (y % 10) / 10);
          if (x % 16 === 0 || y % 10 === 0) f = 1.05;
          c = BT.shade(base, f);
          if (depth === 0) c = BT.mix(base, rgb(255, 255, 255), 0.6);
          else if (depth === 1) c = BT.mix(base, rgb(255, 255, 255), 0.2);
          break;
        }
        case 'jungle': {
          f = 0.2 + h * 0.08;
          const v = BT.vnoise2(x / 7, y / 7, 4);
          if (Math.abs(v - 0.5) < 0.035) f = 1.05;
          if (h > 0.985) f = 1.4;
          c = BT.shade(base, f);
          if (depth === 0) c = BT.shade(base, 1.2);
          else if (depth === 1) c = BT.shade(base, 0.6);
          break;
        }
        default: { // hall — marble
          const v = Math.sin(x * 0.07 + y * 0.05 + BT.vnoise2(x / 11, y / 11, 2) * 6);
          f = 0.72 + 0.18 * v + h * 0.05;
          c = BT.shade(base, f);
          if (v > 0.94) c = BT.mix(c, rgb(90, 80, 90), 0.5);
          if (depth === 0) c = C(0xf0d070);
          else if (depth === 1) c = BT.mix(c, C(0xc09040), 0.5);
        }
      }
      return c;
    }

    /* ---------------- backgrounds ---------------- */
    buildBackground() {
      const BW = (this.BW = 320 + Math.ceil((this.W - 320) * 0.5) + 2);
      const bg = (this.bg = new Uint32Array(BW * PH));
      const sky = this.world.sky, key = this.world.key;
      const rnd = BT.rng(this.sim.def.seed * 7 + 3);
      const put = (x, y, c) => { if (x >= 0 && x < BW && y >= 0 && y < PH) bg[y * BW + x] = c; };
      const grad = (y, y1) => {
        const t = Math.min(1, y / y1);
        return t < 0.5 ? lerp3(sky[0], sky[1], t * 2) : lerp3(sky[1], sky[2], (t - 0.5) * 2);
      };
      for (let y = 0; y < PH; y++) for (let x = 0; x < BW; x++) {
        // Copper-list style banded gradient with ordered dithering.
        const band = (y + dither(x, y) * 6) / 6 | 0;
        const g = grad(band * 6, key === 'synth' ? 100 : 140);
        bg[y * BW + x] = rgb(g[0], g[1], g[2]);
      }
      if (key === 'garden') {
        for (let k = 0; k < BW / 60; k++) {
          const cx = rnd() * BW, cy = 12 + rnd() * 50, rw = 14 + rnd() * 20;
          for (let j = -8; j <= 8; j++) for (let i = -rw - 10; i <= rw + 10; i++) {
            const d = (i * i) / (rw * rw) + (j * j) / 36 - BT.vnoise((cx + i) / 6, k) * 0.6;
            if (d < 1) put(Math.round(cx + i), Math.round(cy + j), d < 0.5 && j < 2 ? C(0xffffff) : C(0xd8e8ff));
          }
        }
        for (let x = 0; x < BW; x++) {
          const h1 = 88 + BT.vnoise(x / 48, 1) * 34, h2 = 112 + BT.vnoise(x / 26, 2) * 26;
          for (let y = Math.round(h1); y < PH; y++) put(x, y, y < h1 + 2 ? C(0x6a9ad0) : C(0x4a78b8));
          for (let y = Math.round(h2); y < PH; y++) put(x, y, y < h2 + 2 ? C(0x60b050) : (x + y) & 1 ? C(0x3a8a40) : C(0x347c3a));
        }
      } else if (key === 'acid') {
        for (let x = 0; x < BW; x++) for (let y = 0; y < PH; y++) {
          const i = y * BW + x;
          let c = bg[i];
          if (x % 28 === 0 || x % 28 === 1) c = BT.shade(c, 1.8);
          if (y % 40 === 20) c = C(0x2a2438);
          const hz = BT.vnoise2(x / 30, y / 18, 7);
          c = BT.mix(c, C(0x4a3e5a), hz * hz * 0.5);
          bg[i] = c;
        }
        for (let wx = 8; wx < BW; wx += 28) for (let row = 0; row < 2; row++) {
          const col = [C(0xff3cc8), C(0x30e8ff), C(0xa8ff30)][(wx / 28 + row) % 3 | 0];
          const y0 = 34 + row * 40;
          for (let y = y0; y < y0 + 14; y++) for (let x = wx + 4; x < wx + 18; x++) {
            const edge = y === y0 || y === y0 + 13 || x === wx + 4 || x === wx + 17;
            put(x, y, edge ? BT.shade(col, 0.55) : BT.mix(C(0x100c18), col, 0.12 + 0.1 * ((x + y) & 1)));
          }
        }
      } else if (key === 'synth') {
        const cx = BW / 2, cy = 76, R = 38;
        for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > R * R) continue;
          const t = (y - (cy - R)) / (2 * R);
          if (y > cy && ((y - cy) % 7) < (1 + (y - cy) / 10)) continue;
          const c = lerp3([255, 236, 90], [255, 60, 150], t);
          put(Math.round(x), Math.round(y), rgb(c[0], c[1], c[2]));
        }
        for (let x = 0; x < BW; x++) {
          const h = 82 + BT.vnoise(x / 22, 5) * 16 + Math.abs(Math.sin(x / 57)) * 8;
          for (let y = Math.round(h); y < 100; y++) put(x, y, y < h + 1 ? C(0xff5ad0) : C(0x2a0c48));
        }
        for (let y = 100; y < PH; y++) for (let x = 0; x < BW; x++) {
          const d = y - 99;
          const hl = Math.abs(((Math.sqrt(d) * 5) % 5) - 0) < 0.6;
          const vx = ((x - cx) * 12) / d;
          const vl = Math.abs(vx - Math.round(vx / 16) * 16) < 12 / d + 0.5;
          put(x, y, hl || vl ? C(0xff38c8) : C(0x1a0630));
        }
        for (let k = 0; k < BW / 6; k++) put((rnd() * BW) | 0, (rnd() * 60) | 0, C(0xffffff));
      } else if (key === 'jungle') {
        for (let y = 0; y < PH; y++) for (let x = 0; x < BW; x++) {
          const v = BT.vnoise2(x / 18, y / 14, 11);
          const i = y * BW + x;
          bg[i] = BT.mix(bg[i], C(0x0e3a36), v * 0.8);
        }
        for (let k = 0; k < BW / 5; k++) {
          const x = (rnd() * BW) | 0, y = (rnd() * PH) | 0, col = [C(0x40ffd0), C(0xff58b8), C(0x98f040)][k % 3];
          for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
            const d = i * i + j * j;
            if (d <= 4) put(x + i, y + j, BT.mix(bg[Math.max(0, Math.min(PH - 1, y + j)) * BW + Math.max(0, Math.min(BW - 1, x + i))], col, d === 0 ? 1 : 0.25));
          }
        }
        for (let x = 6; x < BW; x += 23) {
          const len = 20 + ((x * 13) % 50);
          for (let y = 0; y < len; y++) put(x + Math.round(Math.sin(y / 5) * 1.5), y, y % 6 === 0 ? C(0x3aa060) : C(0x1c5a3a));
        }
      } else { // hall
        for (let cx = 0; cx < BW + 64; cx += 64) {
          for (let y = 20; y < PH; y++) for (let x = cx - 7; x <= cx + 7; x++) {
            const t = (x - cx + 7) / 14;
            const flute = (x - cx + 7) % 3 === 0;
            put(x, y, rgb(60 + 50 * Math.sin(t * Math.PI) - (flute ? 14 : 0), 52 + 44 * Math.sin(t * Math.PI) - (flute ? 12 : 0), 72 + 50 * Math.sin(t * Math.PI)));
          }
          for (let x = cx - 10; x <= cx + 10; x++) for (let y = 16; y < 22; y++) put(x, y, C(0x8a7a8a));
          for (let x = cx + 8; x < cx + 56; x++) {
            const ay = 22 + Math.round(18 * (1 - Math.sin(((x - cx - 8) / 48) * Math.PI)));
            for (let y = 16; y < ay; y++) put(x, y, C(0x2a2038));
            put(x, ay, C(0x6a5a78));
          }
          for (let y = 50; y < 120; y++) for (let x = cx + 24; x < cx + 40; x++) {
            const i = y * BW + x;
            if (x >= 0 && x < BW) bg[i] = BT.mix(bg[i], C(0x7aa0e0), 0.22 + 0.08 * (((x + y) >> 2) & 1));
          }
          put(cx + 32, 30, C(0xffd870)); put(cx + 31, 31, C(0xffd870)); put(cx + 33, 31, C(0xffd870));
        }
      }
    }

    /* ---------------- events -> visuals ---------------- */
    onEvent(e, sim) {
      const deg = (x, y) => {
        const T = sim.terrain;
        if (x < 0 || x >= sim.W || y < 0 || y >= PH) return 0;
        return T.deg[y * sim.W + x] % this.degC.length;
      };
      switch (e.t) {
        case 'step': {
          if (e.steel) break;
          const sx0 = Math.floor(e.x / 16) * 2, cy = Math.floor(e.y / 8);
          for (let cx = sx0; cx < sx0 + 2; cx++) for (let yy = cy; yy <= cy + 1; yy++) this.bumpFlash(cx, yy, 0.8);
          if ((e.id + (sim.tick >> 2)) % 5 === 0) this.notes.push({ x: e.x, y: e.y - 12, life: 40, c: this.degC[e.deg % this.degC.length] });
          break;
        }
        case 'brick': case 'climb': case 'bash': case 'mine': case 'dig': {
          const c = this.degC[(e.t === 'brick' ? e.n : deg(e.x, e.y)) % this.degC.length];
          this.notes.push({ x: e.x + (Math.random() * 6 - 3), y: e.y - 13, life: 50, c });
          const cx = e.x >> 3, cy = Math.max(0, (e.y >> 3) - 1);
          for (let i = -1; i <= 1; i++) this.bumpFlash(cx + i, cy, 1);
          if (e.t === 'bash' || e.t === 'mine' || e.t === 'dig') {
            for (let k = 0; k < 6; k++) this.parts.push({ x: e.x, y: e.y - 4, vx: (Math.random() - 0.5) * 1.6, vy: -Math.random() * 1.6, life: 24, c: this.tcolAt(e.x, e.y) || c, g: 0.12 });
          }
          break;
        }
        case 'explode': {
          const cols = [P.H, P.B, P.S, P.Y, P.O, P.W, P.B2];
          for (let k = 0; k < 70; k++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 3.2;
            this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.4, life: 50 + Math.random() * 30, c: cols[k % cols.length], g: 0.1 });
          }
          this.shake = 6;
          break;
        }
        case 'splat': case 'crush':
          for (let k = 0; k < 14; k++) this.parts.push({ x: e.x, y: e.y - 2, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5, life: 30, c: k & 1 ? P.B : P.H, g: 0.14 });
          break;
        case 'drown':
          for (let k = 0; k < 10; k++) this.parts.push({ x: e.x + (Math.random() - 0.5) * 6, y: e.y, vx: 0, vy: -0.3 - Math.random() * 0.5, life: 40, c: P.W, g: 0 });
          break;
        case 'exit':
          for (let k = 0; k < 18; k++) {
            const a = (k / 18) * Math.PI * 2;
            this.parts.push({ x: e.x, y: e.y - 12, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, life: 30, c: this.degC[k % this.degC.length], g: 0 });
          }
          break;
        case 'assign':
          if (e.onBeat) {
            for (let k = 0; k < 24; k++) {
              const a = (k / 24) * Math.PI * 2, s = 1 + (k & 1);
              this.parts.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 26, c: k & 1 ? P.Y : P.W, g: 0, star: true });
            }
            this.texts.push({ x: e.x, y: e.y - 16, s: e.streak > 1 ? 'GROOVE X' + Math.min(8, e.streak) : 'ON BEAT!', life: 50 });
          }
          break;
        case 'clank':
          for (let k = 0; k < 6; k++) this.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 16, c: P.Y, g: 0.15 });
          break;
      }
    }
    bumpFlash(cx, cy, v) {
      if (cx < 0 || cx >= this.cw || cy < 0 || cy >= 20) return;
      const i = cy * this.cw + cx;
      if (this.flash[i] < v) this.flash[i] = v;
    }
    tcolAt(x, y) {
      if (x < 0 || x >= this.W || y < 0 || y >= PH) return 0;
      return this.tcol[y * this.W + x];
    }

    /* ---------------- per-frame update ---------------- */
    tickVisuals() {
      const T = this.sim.terrain;
      if (T.dirty) { const d = T.dirty; T.dirty = null; this.recolor(d.x0, d.y0, d.x1, d.y1); }
      for (let i = 0; i < this.flash.length; i++) if (this.flash[i] > 0.01) this.flash[i] *= 0.9; else this.flash[i] = 0;
      for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
      this.parts = this.parts.filter((p) => p.life > 0 && p.y < PH + 4);
      if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
      for (const n of this.notes) { n.y -= 0.35; n.x += Math.sin(n.life / 6) * 0.2; n.life--; }
      this.notes = this.notes.filter((n) => n.life > 0);
      if (this.notes.length > 80) this.notes.splice(0, this.notes.length - 80);
      for (const t of this.texts) { t.y -= 0.3; t.life--; }
      this.texts = this.texts.filter((t) => t.life > 0);
      if (this.shake > 0) this.shake *= 0.85;
    }

    /* ---------------- draw ---------------- */
    draw(g, camX, beatFrac, fc, opts) {
      opts = opts || {};
      const sim = this.sim, W = this.W, T = sim.terrain, mat = T.mat;
      camX = Math.max(0, Math.min(W - 320, Math.round(camX)));
      const shk = this.shake > 0.5 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
      const pulse = Math.exp(-beatFrac * 5) * 0.28;
      const bgX = Math.floor(camX * 0.5), BW = this.BW, bg = this.bg, buf = g.buf, sil = sim.sil;
      const eMul = 1 + pulse, bMul = 1 + pulse * 0.25;
      for (let y = 0; y < PH; y++) {
        const ty = Math.max(0, Math.min(PH - 1, y + shk));
        const row = ty * W, brow = y * BW + bgX, orow = y * 320, frow = (ty >> 3) * this.cw;
        for (let sx = 0; sx < 320; sx++) {
          const x = camX + sx, i = row + x;
          const s = sil[x];
          let c;
          if (mat[i]) {
            c = this.tcol[i];
            let r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255;
            const e = this.edge[i];
            const mul = e === 2 ? eMul : e === 1 ? 1 + pulse * 0.5 : bMul;
            const fl = this.flash[frow + (x >> 3)] * 90;
            r = r * mul + fl; gg = gg * mul + fl; b = b * mul + fl;
            if (s > 0.02) {
              const l = (r * 0.3 + gg * 0.59 + b * 0.11) * (1 - s * 0.35);
              const k = s * 0.92;
              r += (l - r) * k; gg += (l - gg) * k; b += (l - b) * k;
            }
            buf[orow + sx] = 0xff000000 | (clamp(b) << 16) | (clamp(gg) << 8) | clamp(r);
          } else {
            c = bg[brow + sx];
            if (s > 0.02) {
              let r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255;
              const l = (r * 0.3 + gg * 0.59 + b * 0.11) * (1 - s * 0.4);
              const k = s * 0.85;
              r += (l - r) * k; gg += (l - gg) * k; b += (l - b) * k;
              c = 0xff000000 | (clamp(b) << 16) | (clamp(gg) << 8) | clamp(r);
            }
            buf[orow + sx] = c;
          }
        }
      }
      g.clipY1 = PH;
      this.drawObjects(g, camX, beatFrac, fc);
      this.drawLemmings(g, camX, beatFrac, fc, opts);
      // particles
      for (const p of this.parts) {
        const x = Math.round(p.x) - camX, y = Math.round(p.y);
        if (p.star && p.life > 10) { g.pset(x - 1, y, p.c); g.pset(x + 1, y, p.c); g.pset(x, y - 1, p.c); g.pset(x, y + 1, p.c); }
        g.pset(x, y, p.c);
      }
      for (const n of this.notes) {
        const x = Math.round(n.x) - camX, y = Math.round(n.y), c = n.life > 12 ? n.c : BT.shade(n.c, n.life / 12);
        g.pset(x + 2, y, c); g.pset(x + 3, y, c); g.pset(x + 2, y + 1, c); g.pset(x + 3, y + 1, c);
        g.pset(x + 2, y + 2, c); g.pset(x + 2, y + 3, c); g.pset(x, y + 3, c); g.pset(x + 1, y + 3, c); g.pset(x, y + 4, c); g.pset(x + 1, y + 4, c);
      }
      for (const t of this.texts) g.textC(t.s, Math.round(t.x) - camX, Math.round(t.y), t.life & 4 ? P.Y : P.W, 3, 1, P.BLACK);
      // the Silence: drifting grey static
      if (sim.silX0 >= 0) {
        for (let sx = 0; sx < 320; sx += 1) {
          const s = sil[camX + sx];
          if (s < 0.35) continue;
          const n = s > 0.8 ? 3 : 1;
          for (let k = 0; k < n; k++) {
            const hh = BT.hash2(camX + sx, k, fc >> 2);
            if (hh < 0.06 * s) {
              const y = Math.floor(BT.hash2(sx, k + 9, fc >> 1) * PH);
              g.blend(sx, y, C(0xb8b8b8), 0.5 * s);
            }
          }
        }
      }
      g.clipY1 = BT.SCREEN_H;
      return camX;
    }

    drawObjects(g, camX, beatFrac, fc) {
      const sim = this.sim, acc = rgb(...this.world.accent);
      for (const o of sim.traps) {
        const x0 = o.x - camX;
        if (o.type === 'water' || o.type === 'lava') {
          const lava = o.type === 'lava';
          const top = lava ? C(0xffd040) : o.acid ? C(0xc0ff60) : C(0x90c8ff);
          const mid = lava ? C(0xff5010) : o.acid ? C(0x50c020) : C(0x2860e0);
          const deep = lava ? C(0xa01800) : o.acid ? C(0x206010) : C(0x102880);
          for (let x = 0; x < o.w; x++) {
            const wv = Math.round(Math.sin((o.x + x) / 4 + fc / 10) * 1.2 + (lava ? Math.sin((o.x + x) / 2.3 - fc / 17) : 0));
            for (let y = o.y + wv; y < o.y + o.h; y++) {
              const d = y - (o.y + wv);
              let c = d === 0 ? top : d < 4 ? mid : deep;
              if (!lava && d > 0 && BT.hash2(o.x + x, y, fc >> 3) > 0.97) c = top;
              if (lava && BT.hash2(o.x + x, y, fc >> 2) > 0.985) c = top;
              g.pset(x0 + x, y, c);
            }
          }
        } else if (o.type === 'fire') {
          for (let x = 0; x < o.w; x++) {
            const hgt = o.h * (0.45 + 0.55 * BT.vnoise((o.x + x) / 3 + fc / 5, 21));
            for (let d = 0; d < hgt; d++) {
              const t = d / hgt;
              const c = t < 0.3 ? C(0xff3010) : t < 0.7 ? C(0xff9020) : C(0xffe860);
              if (t > 0.8 && BT.hash2(o.x + x, d, fc >> 1) > 0.5) continue;
              g.pset(x0 + x, o.y + o.h - 1 - d, c);
            }
          }
          for (let x = 0; x < o.w; x += 3) g.pset(x0 + x, o.y + o.h - 1, C(0x602010));
        } else if (o.type === 'crusher') {
          const ph = 36 - o.busy;
          let off = 0;
          if (o.busy > 0) off = ph < 3 ? ph * 5 : Math.max(0, 15 - (ph - 3) * 0.5);
          const bx = x0 - 7, by = o.y - 28 + Math.round(off);
          for (let y = 0; y < by - 6 + 6; y++) { g.pset(x0 - 1, y, C(0x707080)); g.pset(x0 + 1, y, C(0x505060)); }
          g.bevel(bx, by, 15, 12, C(0x8a8a9a), C(0xd0d0e0), C(0x40404c));
          for (let k = 0; k < 15; k += 3) g.pset(bx + k, by + 11, C(0xff4040));
          g.rect(bx + 3, by + 4, 9, 2, C(0xffd040));
        }
      }
      // entrance hatches
      for (const e of sim.entrances) {
        const x = e.x - camX, y = e.y, open = sim.hatchOpen / 10;
        g.bevel(x - 12, y, 24, 4, BT.shade(acc, 0.7), acc, BT.shade(acc, 0.35));
        g.rect(x - 10, y + 4, 20, 8, C(0x101018));
        const dw = Math.round(10 * (1 - open));
        g.rect(x - 10, y + 4, dw, 8, BT.shade(acc, 0.5));
        g.rect(x + 10 - dw, y + 4, dw, 8, BT.shade(acc, 0.5));
        g.rect(x - 12, y + 4, 2, 10, BT.shade(acc, 0.6)); g.rect(x + 10, y + 4, 2, 10, BT.shade(acc, 0.6));
        for (let k = 0; k < 20; k += 4) g.pset(x - 10 + k, y + 1, (fc >> 3) & 1 ? P.Y : P.O);
      }
      // exits: a pulsing speaker-arch
      for (const e of sim.exits) {
        const x = e.x - camX, y = e.y, beat = Math.exp(-beatFrac * 6);
        const stone = this.world.key === 'hall' ? C(0xe0d0b0) : this.world.key === 'acid' ? C(0x9098b0) : C(0xb0a090);
        g.rect(x - 11, y - 22, 5, 22, stone); g.rect(x + 7, y - 22, 5, 22, stone);
        for (let k = -11; k <= 11; k++) {
          const ay = y - 22 - Math.round(6 * Math.sqrt(Math.max(0, 1 - (k * k) / 121)));
          for (let j = ay; j < y - 20; j++) g.pset(x + k, j, stone);
        }
        g.rect(x - 6, y - 20, 13, 20, C(0x100808));
        const glow = BT.mix(C(0x301008), acc, 0.25 + beat * 0.5);
        g.rect(x - 5, y - 17, 11, 17, glow);
        g.rect(x - 3, y - 14, 7, 14, BT.mix(glow, C(0xffffff), 0.2 + beat * 0.3));
        for (const sx of [x - 9, x + 9]) {
          const r = beat > 0.5 ? 2 : 1;
          g.circle(sx, y - 12, 2, C(0x202020), true);
          g.circle(sx, y - 12, r, C(0x606060), true);
          g.circle(sx, y - 5, 1, C(0x303030), true);
        }
        for (const fx of [x - 9, x + 9]) {
          const f = (fc >> 2) & 3;
          g.pset(fx, y - 29 - (f & 1), P.Y); g.pset(fx, y - 28, P.O); g.pset(fx - 1 + (f >> 1), y - 27, P.R); g.pset(fx, y - 27, P.O);
        }
      }
    }

    lemFrame(L, beatFrac, fc) {
      const S = BT.SPR, st = L.st;
      switch (st) {
        case ST.WALK:
          if (L.hushed) return S.walk[((L.walkN >> 1) + L.id) & 7];
          return S.walk[Math.floor(beatFrac * 8) & 7];
        case ST.FALL: return S.fall[(fc >> 3) & 1];
        case ST.FLOAT: return S.float[L.t < 3 ? 0 : 1 + ((fc >> 4) & 3)];
        case ST.CLIMB: return S.climb[L.climbN & 3];
        case ST.HOIST: return S.hoist[Math.min(3, L.t)];
        case ST.BUILD: return S.build[Math.floor(((L.t - 1) % 8) / 2) & 3];
        case ST.SHRUG: return S.shrug[(L.t >> 2) & 1];
        case ST.BASH: return S.bash[((L.t - 1) >> 1) & 3];
        case ST.MINE: return S.mine[Math.max(0, Math.min(3, Math.floor(((L.t + 5) % 6) / 1.5)))];
        case ST.DIG: return S.dig[(L.t >> 1) & 3];
        case ST.BLOCK: return S.block[beatFrac < 0.2 ? 1 : 0];
        case ST.OHNO: return S.ohno[(fc >> 2) & 1];
        case ST.SPLAT: return S.splat[Math.min(3, L.t >> 2)];
        case ST.DROWN: return S.drown[Math.min(3, L.t >> 2)];
        case ST.BURN: return S.burn[Math.min(3, L.t >> 2)];
        case ST.EXIT: return S.exit[Math.min(3, L.t >> 2)];
      }
      return S.stand[0];
    }
    drawLemmings(g, camX, beatFrac, fc, opts) {
      const sim = this.sim;
      for (const L of sim.lems) {
        if (L.st >= ST.DEAD) continue;
        const x = L.x - camX;
        if (x < -12 || x > 332) continue;
        const fr = this.lemFrame(L, beatFrac, fc);
        const hushTint = L.hushed && L.st === ST.WALK ? (L.panic > 60 && (fc >> 3) & 1 ? C(0xe0e0e0) : null) : null;
        if (L.hushed && !hushTint && L.st === ST.WALK) {
          for (const p of fr) g.pset(x + (L.dir < 0 ? -p[0] : p[0]), L.y + p[1], BT.mix(p[2], C(0x909090), 0.6));
        } else g.spr(fr, x, L.y, L.dir < 0, hushTint);
        if (L.bomb > 0 && L.st < ST.OHNO) g.text(String(Math.ceil(L.bomb / 16)), x - 1, L.y - 17, P.W, 3, 1, P.BLACK);
        if (L.panic > 60 && L.st === ST.WALK && (fc & 16)) g.text('?', x - 1, L.y - 16, C(0xc0c0c0), 3);
      }
      if (opts.hover) {
        const L = opts.hover, x = L.x - camX, y = L.y - 5, c = opts.hoverOk ? P.W : C(0x909090);
        for (const [dx, dy] of [[-6, -7], [6, -7], [-6, 6], [6, 6]]) {
          g.pset(x + dx, y + dy, c); g.pset(x + dx - Math.sign(dx), y + dy, c); g.pset(x + dx, y + dy - Math.sign(dy), c);
        }
      }
    }

    /* ---------------- minimap ---------------- */
    drawMinimap(g, mx, my, mw, mh, camX, fc) {
      const sim = this.sim, W = this.W, T = sim.terrain;
      if (this.miniDirty || !this.mini || fc % 20 === 0) {
        this.mini = this.mini || new Uint32Array(mw * mh);
        for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
          const x0 = Math.floor((i * W) / mw), y0 = Math.floor((j * PH) / mh);
          let c = C(0x06060c);
          for (let k = 0; k < 8; k++) {
            const y = y0 + k, idx = y * W + x0;
            if (y < PH && T.mat[idx]) { c = this.tcol[idx]; break; }
          }
          if (sim.sil[x0] > 0.5 && c !== C(0x06060c)) c = BT.mix(c, C(0x808080), 0.8);
          this.mini[j * mw + i] = c;
        }
        this.miniDirty = false;
      }
      for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) g.pset(mx + i, my + j, this.mini[j * mw + i]);
      for (const o of sim.traps) {
        const c = o.type === 'water' ? C(0x3060ff) : o.type === 'crusher' ? C(0xff40ff) : C(0xff6010);
        g.pset(mx + Math.floor((o.x * mw) / W), my + Math.min(mh - 1, Math.floor((o.y * mh) / PH)), c);
      }
      for (const e of sim.exits) g.rect(mx + Math.floor((e.x * mw) / W) - 1, my + Math.floor((e.y * mh) / PH) - 2, 2, 2, (fc >> 3) & 1 ? C(0xffffff) : C(0xffe040));
      for (const L of sim.lems) {
        if (L.st >= ST.DEAD) continue;
        g.pset(mx + Math.floor((L.x * mw) / W), my + Math.min(mh - 1, Math.floor(((L.y - 4) * mh) / PH)), L.st === ST.BLOCK ? C(0xff4040) : C(0x40ff40));
      }
      const vx = mx + Math.floor((camX * mw) / W), vw = Math.max(4, Math.round((320 * mw) / W));
      g.frame(vx, my, Math.min(vw, mx + mw - vx), mh, C(0xffffff));
    }
  }
  BT.LevelView = LevelView;
})(typeof window !== 'undefined' ? window : globalThis);
