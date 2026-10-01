/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — terrain.js
 * Per-pixel destructible terrain. Every solid pixel carries a material and
 * a SCALE DEGREE: the colour you see is the note a lemming will play.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;

  const M = (BT.MAT = { EMPTY: 0, EARTH: 1, STEEL: 2, OW_LEFT: 3, OW_RIGHT: 4 });

  class Terrain {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.mat = new Uint8Array(w * h);
      this.deg = new Uint8Array(w * h);
      this.version = 0;
      this.dirty = null; // {x0,y0,x1,y1}
    }
    markDirty(x0, y0, x1, y1) {
      x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
      x1 = Math.min(this.w - 1, x1 | 0); y1 = Math.min(this.h - 1, y1 | 0);
      if (x1 < x0 || y1 < y0) return;
      const d = this.dirty;
      if (!d) this.dirty = { x0, y0, x1, y1 };
      else {
        if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0;
        if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1;
      }
      this.version++;
    }
    /* Level sides behave as solid walls; above the top is air; below is void. */
    solid(x, y) {
      if (x < 0 || x >= this.w) return y >= 0 ? true : false;
      if (y < 0 || y >= this.h) return false;
      return this.mat[y * this.w + x] !== 0;
    }
    get(x, y) {
      if (x < 0 || x >= this.w || y < 0 || y >= this.h) return x < 0 || x >= this.w ? M.STEEL : 0;
      return this.mat[y * this.w + x];
    }
    set(x, y, m, d) {
      if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
      const i = y * this.w + x;
      this.mat[i] = m;
      if (d !== undefined) this.deg[i] = d;
    }
    /* Remove one pixel. mode: 'bomb' | 'dig' | dir (+1/-1 for bash/mine).
     * Returns false if the pixel is indestructible for that mode. */
    canRemove(x, y, mode) {
      const m = this.get(x, y);
      if (m === M.EMPTY || m === M.EARTH) return true;
      if (m === M.STEEL) return false;
      if (mode === 'bomb' || mode === 'dig') return true;
      if (m === M.OW_LEFT) return mode < 0;
      if (m === M.OW_RIGHT) return mode > 0;
      return true;
    }
    removeRect(x0, y0, x1, y1, mode) {
      let any = false;
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= this.h) continue;
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= this.w) continue;
          const i = y * this.w + x, m = this.mat[i];
          if (m === 0) continue;
          if (this.canRemove(x, y, mode)) { this.mat[i] = 0; any = true; }
        }
      }
      if (any) this.markDirty(x0, y0, x1, y1);
      return any;
    }
    /* Does the rect contain any pixel that blocks the given mode? */
    blocked(x0, y0, x1, y1, mode) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= this.w) return true;
        if (y < 0 || y >= this.h) continue;
        if (!this.canRemove(x, y, mode)) return true;
      }
      return false;
    }
    anySolid(x0, y0, x1, y1) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.solid(x, y)) return true;
      return false;
    }
    removeEllipse(cx, cy, rx, ry, mode) {
      let any = false;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy > 1) continue;
          if (x < 0 || x >= this.w || y < 0 || y >= this.h) continue;
          const i = y * this.w + x;
          if (this.mat[i] && this.canRemove(x, y, mode)) { this.mat[i] = 0; any = true; }
        }
      }
      if (any) this.markDirty(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1);
      return any;
    }
    clone() {
      const t = new Terrain(this.w, this.h);
      t.mat.set(this.mat); t.deg.set(this.deg);
      return t;
    }
  }
  BT.Terrain = Terrain;

  /* ------------------------------------------------------------------------
   * Level painter: a tiny vector toolkit used by levels.js to draw each map.
   * ---------------------------------------------------------------------- */
  class Painter {
    constructor(terrain, level, world) {
      this.t = terrain;
      this.level = level;
      this.world = world;
      this.n = world.scale.length;
      const rnd = BT.rng(level.seed || 1234);
      // Melodic stripe map: each 16px column band is one scale degree.
      const stripe = (this.stripe = level.stripe || 16);
      const count = Math.ceil(terrain.w / stripe) + 1;
      this.stripes = [];
      if (level.notes) {
        for (let i = 0; i < count; i++) this.stripes.push(level.notes[i % level.notes.length] % this.n);
      } else {
        let d = Math.floor(rnd() * this.n);
        for (let i = 0; i < count; i++) {
          this.stripes.push(d);
          const r = rnd();
          d = (d + (r < 0.4 ? 1 : r < 0.7 ? -1 : r < 0.85 ? 2 : -2) + this.n * 4) % this.n;
        }
      }
    }
    degAt(x, y) {
      // Stripes, with a little diagonal shear by height for visual interest.
      const s = this.stripes[Math.max(0, Math.floor((x + (this.level.shear ? (y >> 2) : 0)) / this.stripe)) % this.stripes.length];
      return s;
    }
    px(x, y, o) {
      x |= 0; y |= 0;
      if (x < 0 || x >= this.t.w || y < 0 || y >= this.t.h) return;
      const m = o && o.mat !== undefined ? o.mat : M.EARTH;
      const d = o && o.deg !== undefined ? o.deg : this.degAt(x, y);
      this.t.set(x, y, m, d);
    }
    clr(x, y) { this.t.set(x | 0, y | 0, 0); }
    rect(x, y, w, h, o) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, o);
      return this;
    }
    erase(x, y, w, h) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.clr(i, j);
      return this;
    }
    steel(x, y, w, h) { return this.rect(x, y, w, h, { mat: M.STEEL, deg: 0 }); }
    oneway(x, y, w, h, dir) { return this.rect(x, y, w, h, { mat: dir < 0 ? M.OW_LEFT : M.OW_RIGHT }); }
    ellipse(cx, cy, rx, ry, o, erase) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) erase ? this.clr(x, y) : this.px(x, y, o);
        }
      return this;
    }
    eraseEllipse(cx, cy, rx, ry) { return this.ellipse(cx, cy, rx, ry, null, true); }
    poly(pts, o, erase) {
      let minY = 1e9, maxY = -1e9;
      for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const xs = [];
        const yc = y + 0.5;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
            xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2)
          for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++)
            erase ? this.clr(x, y) : this.px(x, y, o);
      }
      return this;
    }
    erasePoly(pts) { return this.poly(pts, null, true); }
    /* Fill from a height function down to `bottom` (default level floor). */
    ground(x0, x1, fn, o, bottom) {
      const b = bottom === undefined ? this.t.h : bottom;
      for (let x = x0; x < x1; x++) {
        const top = Math.round(fn(x));
        for (let y = top; y < b; y++) this.px(x, y, o);
      }
      return this;
    }
    /* Organic slab: rectangle whose top/bottom edges wobble with noise. */
    slab(x, y, w, h, rough, o, seed) {
      const s = seed || 11;
      for (let i = x; i < x + w; i++) {
        const t = Math.round((BT.vnoise(i / 9, s) - 0.5) * (rough || 0));
        const b = Math.round((BT.vnoise(i / 7, s + 3) - 0.5) * (rough || 0));
        for (let j = y + t; j < y + h + b; j++) this.px(i, j, o);
      }
      return this;
    }
    /* Column paint: re-assign degrees in an area (keeps material). */
    paintDeg(x, y, w, h, deg) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (i < 0 || i >= this.t.w || j < 0 || j >= this.t.h) continue;
        const k = j * this.t.w + i;
        if (this.t.mat[k] === M.EARTH) this.t.deg[k] = deg;
      }
      return this;
    }
  }
  BT.Painter = Painter;
})(typeof window !== 'undefined' ? window : globalThis);
