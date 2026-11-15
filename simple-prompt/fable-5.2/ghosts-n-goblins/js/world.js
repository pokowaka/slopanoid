/*
 * world.js — tile world for the Cursed PC Gaming Museum:
 *   level parsing (ASCII chunks), pre-rendered tile layer with auto-tiling + ambient occlusion,
 *   AABB-vs-tile physics, particles, camera, liquids, weather, lightning and the rocking-deck shear.
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE;
  const C = GNG.C;

  /* ------------------------------------------------------------------ tile types */
  const T = GNG.T = {
    EMPTY: 0, SOLID: 1, ALT: 2, PLAT: 3, LADDER: 4, SPIKE: 5, CRACK: 6, BRIDGE: 7,
    CONV_L: 8, CONV_R: 9, GHOST: 10, GATE: 11
  };
  const TILE_CHARS = {
    '#': T.SOLID, '%': T.ALT, '=': T.PLAT, 'H': T.LADDER, '^': T.SPIKE, 'x': T.CRACK,
    '_': T.BRIDGE, '<': T.CONV_L, '>': T.CONV_R, ':': T.GHOST
  };
  const SOLID_LUT = new Uint8Array(16);
  SOLID_LUT[T.SOLID] = SOLID_LUT[T.ALT] = SOLID_LUT[T.CRACK] = SOLID_LUT[T.CONV_L] = SOLID_LUT[T.CONV_R] = SOLID_LUT[T.GATE] = 1;
  GNG.isSolidType = function (t) { return SOLID_LUT[t] === 1; };

  // one-shade-darker lookup for cheap ambient occlusion on the pre-rendered tile layer
  const DARKER = new Uint8Array(256);
  (function () {
    for (let i = 0; i < 256; i++) DARKER[i] = i;
    for (const n of GNG.RAMP_NAMES) { const r = GNG.RAMPS[n]; for (let s = 1; s < 8; s++) DARKER[r[s]] = r[s - 1]; }
  })();
  GNG.DARKER = DARKER;

  /* ------------------------------------------------------------------ Level */
  class Level {
    constructor(def, index) {
      this.def = def; this.index = index;
      const rows = Level.joinChunks(def.chunks, index);
      this.h = rows.length; this.w = rows[0].length;
      this.pxW = this.w * TS; this.pxH = this.h * TS;
      const n = this.w * this.h;
      this.t = new Uint8Array(n);        // collision / tile type
      this.back = new Uint8Array(n);     // 0 none, 1 back wall, 2 alt back wall
      this.liq = new Uint8Array(n);      // 1 = liquid
      this.spawns = [];                  // {ch, tx, ty, x, y}
      this.props = [];                   // {name, x, y, front}
      this.windZones = [];               // [x0, x1]
      this.rock = null;                  // [x0, x1] rocking ship range
      this.arena = null;                 // [x0, x1] boss arena
      this.bridges = new Map();          // cell index -> {t, phase}
      this.conveyors = [];               // cell indices (animated each frame)
      this.ghosts = [];                  // ghost platform cell indices
      this.bridgeCells = [];
      this.start = { x: 40, y: 100 };
      this.time = 0;
      this.parse(rows);
      this.tiles = GNG.Tiles.build(index);
      this.bmp = new GNG.Bitmap(this.pxW, this.pxH);
      for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) this.drawCell(tx, ty);
    }

    static joinChunks(chunks, index) {
      let H = 0; const rows = [];
      for (let c = 0; c < chunks.length; c++) {
        const ch = chunks[c];
        if (c === 0) { H = ch.length; for (let r = 0; r < H; r++) rows.push(''); }
        if (ch.length !== H) throw new Error('Stage ' + (index + 1) + ' chunk ' + c + ': ' + ch.length + ' rows, expected ' + H);
        const w = ch[0].length;
        for (let r = 0; r < H; r++) {
          if (ch[r].length !== w) throw new Error('Stage ' + (index + 1) + ' chunk ' + c + ' row ' + r + ': length ' + ch[r].length + ', expected ' + w);
          rows[r] += ch[r];
        }
      }
      return rows;
    }

    parse(rows) {
      const def = this.def, propMap = def.props || {};
      const marks = { '{': [], '}': [], '(': [], ')': [], '[': [], ']': [] };
      const symbol = new Uint8Array(this.w * this.h);
      for (let ty = 0; ty < this.h; ty++) {
        const row = rows[ty];
        for (let tx = 0; tx < this.w; tx++) {
          const ch = row.charAt(tx), i = ty * this.w + tx;
          if (ch === ' ') continue;
          if (TILE_CHARS[ch] !== undefined) {
            this.t[i] = TILE_CHARS[ch];
            if (ch === '<' || ch === '>') this.conveyors.push(i);
            else if (ch === ':') this.ghosts.push(i);
            else if (ch === '_') this.bridgeCells.push(i);
            if (!SOLID_LUT[this.t[i]]) symbol[i] = 1;
          } else if (ch === '~') { this.liq[i] = 1; }
          else if (ch === ',') { this.back[i] = 1; }
          else if (ch === ';') { this.back[i] = 2; }
          else if (marks[ch]) { marks[ch].push(tx * TS); symbol[i] = 1; }
          else if (propMap[ch]) {
            const pd = propMap[ch];
            const name = typeof pd === 'string' ? pd : pd.name;
            this.props.push({ name: name, x: tx * TS + 8 + ((pd && pd.dx) || 0), y: (ty + 1) * TS + ((pd && pd.dy) || 0), front: !!(pd && pd.front), tx: tx });
            symbol[i] = 1;
          } else {
            if (ch === 'P') this.start = { x: tx * TS + 8, y: (ty + 1) * TS };
            this.spawns.push({ ch: ch, tx: tx, ty: ty, x: tx * TS + 8, y: (ty + 1) * TS });
            symbol[i] = 1;
          }
        }
      }
      // back walls creep under symbols that sit between back-wall cells
      for (let pass = 0; pass < 3; pass++) {
        for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
          const i = ty * this.w + tx;
          if (!symbol[i] || this.back[i]) continue;
          const l = tx > 0 ? this.back[i - 1] : 0, r = tx < this.w - 1 ? this.back[i + 1] : 0;
          const u = ty > 0 ? this.back[i - this.w] : 0, d = ty < this.h - 1 ? this.back[i + this.w] : 0;
          if (l && r) this.back[i] = l; else if (u && d) this.back[i] = u;
          else if ((l || r) && (u || d)) this.back[i] = l || r;
        }
      }
      const pair = (a, b) => {
        const out = []; a.sort((p, q) => p - q); b.sort((p, q) => p - q);
        for (let k = 0; k < Math.min(a.length, b.length); k++) out.push([a[k], b[k] + TS]);
        return out;
      };
      this.windZones = pair(marks['{'], marks['}']);
      const rock = pair(marks['('], marks[')']); this.rock = rock.length ? rock[0] : null;
      const arena = pair(marks['['], marks[']']); this.arena = arena.length ? arena[0] : null;
    }

    /* --- queries --- */
    tile(tx, ty) {
      if (tx < 0 || tx >= this.w) return T.SOLID;
      if (ty < 0 || ty >= this.h) return T.EMPTY;
      return this.t[ty * this.w + tx];
    }
    solid(tx, ty) { return SOLID_LUT[this.tile(tx, ty)] === 1; }
    solidPx(x, y) { return this.solid(Math.floor(x / TS), Math.floor(y / TS)); }
    oneWay(tx, ty) {
      const t = this.tile(tx, ty);
      return t === T.PLAT || t === T.BRIDGE || t === T.GHOST || (t === T.LADDER && this.tile(tx, ty - 1) !== T.LADDER);
    }
    standable(tx, ty) { return this.solid(tx, ty) || this.oneWay(tx, ty); }
    liquidPx(x, y) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return false;
      if (!this.liq[ty * this.w + tx]) return false;
      // surface cells are only liquid below their wave line
      if (ty > 0 && !this.liq[(ty - 1) * this.w + tx]) return y >= ty * TS + 5;
      return true;
    }
    ladderPx(x, y) { return this.tile(Math.floor(x / TS), Math.floor(y / TS)) === T.LADDER; }
    spikePx(x, y) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      return this.tile(tx, ty) === T.SPIKE && (y - ty * TS) >= 6;
    }
    /** y of the first standable surface at or below (x, y), within maxDist px; or null. */
    groundBelow(x, y, maxDist) {
      const tx = Math.floor(x / TS);
      let ty = Math.max(0, Math.floor(y / TS));
      const end = Math.min(this.h - 1, Math.floor((y + (maxDist || 400)) / TS));
      for (; ty <= end; ty++) {
        if (this.standable(tx, ty) && ty * TS >= y - 0.01) return ty * TS;
        if (this.solid(tx, ty)) return null;
      }
      return null;
    }
    /** Is there walkable floor just ahead of an entity (for ledge-turning walkers)? */
    floorAhead(e, dist) {
      const x = e.x + e.dir * (e.hw + (dist || 3));
      return this.standable(Math.floor(x / TS), Math.floor((e.y + 2) / TS));
    }
    wallAhead(e, dist) {
      const x = e.x + e.dir * (e.hw + (dist || 2));
      return this.solidPx(x, e.y - 4) || this.solidPx(x, e.y - e.h + 2);
    }
    boxFree(x, y, hw, h) {
      const x0 = Math.floor((x - hw) / TS), x1 = Math.floor((x + hw - 0.01) / TS);
      const y0 = Math.floor((y - h) / TS), y1 = Math.floor((y - 0.01) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return false;
      return true;
    }
    /** Nearest spot around (x,y) where a box of half-width hw and height h fits. */
    findFreeSpot(x, y, hw, h) {
      if (this.boxFree(x, y, hw, h)) return { x: x, y: y };
      for (let r = 4; r <= 160; r += 4) {
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4, nx = x + Math.cos(a) * r, ny = y - Math.abs(Math.sin(a)) * r;
          if (ny > h && this.boxFree(nx, ny, hw, h)) return { x: nx, y: ny };
        }
      }
      return { x: x, y: y };
    }

    /* --- mutation --- */
    setTile(tx, ty, type) {
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
      this.t[ty * this.w + tx] = type;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.drawCell(tx + dx, ty + dy);
    }
    /** Break a cracked block. Returns true if something broke. */
    smash(tx, ty, quiet) {
      if (this.tile(tx, ty) !== T.CRACK) return false;
      this.setTile(tx, ty, T.EMPTY);
      const W = GNG.world;
      if (W) {
        const ramp = (this.def.debris || 'gray');
        W.fx.debris(tx * TS + 8, ty * TS + 8, ramp, 10);
        W.fx.dustCloud(tx * TS + 8, ty * TS + 8);
        if (!quiet) { GNG.snd('floor_smash'); W.shake(5, 12); }
      }
      return true;
    }
    /** Something stepped on (tx,ty): collapsing bridges start to shake. weight: frames until it drops. */
    stepOn(tx, ty, delay) {
      if (this.tile(tx, ty) !== T.BRIDGE) return;
      const i = ty * this.w + tx;
      const st = this.bridges.get(i);
      if (!st) { this.bridges.set(i, { t: delay, phase: 0, max: delay }); GNG.snd('crumble', { vol: 0.4 }); }
      else if (st.phase === 0 && st.t > delay) st.t = delay;
    }
    updateDynamic() {
      this.time++;
      const W = GNG.world;
      for (const [i, st] of this.bridges) {
        st.t--;
        if (st.phase === 0 && st.t <= 0) {            // drop
          const tx = i % this.w, ty = (i / this.w) | 0;
          this.t[i] = T.EMPTY; st.phase = 1; st.t = 300;
          if (W) { W.fx.debris(tx * TS + 8, ty * TS + 4, this.def.bridgeDebris || 'brown', 6); GNG.snd('crumble'); }
        } else if (st.phase === 1 && st.t <= 0) {     // respawn (ghostly)
          this.t[i] = T.BRIDGE; this.bridges.delete(i);
          if (W) { const tx = i % this.w, ty = (i / this.w) | 0; W.fx.sparkleBurst(tx * TS + 8, ty * TS + 4, 4); }
        }
      }
    }

    /* --- pre-rendered tile layer --- */
    variant(tx, ty, n) { return Math.floor(GNG.hash2(tx, ty, 31 + this.index * 7) * n) % n; }
    solidLike(tx, ty) {
      if (ty < 0) return false;
      const t = this.tile(tx, ty);
      return t === T.SOLID || t === T.ALT || t === T.CRACK || t === T.CONV_L || t === T.CONV_R;
    }
    drawCell(tx, ty) {
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
      const bmp = this.bmp, ts = this.tiles, px = tx * TS, py = ty * TS, i = ty * this.w + tx;
      const t = this.t[i], bk = this.back[i];
      bmp.rect(px, py, TS, TS, 0);
      if (bk) {
        const set = bk === 2 ? ts.backAlt : ts.back;
        bmp.blitPart(set[this.variant(tx, ty, set.length)], 0, 0, TS, TS, px, py, true);
        // ambient occlusion: darken the wall under ceilings and beside walls
        const d = bmp.data, w = bmp.w;
        if (this.solidLike(tx, ty - 1)) {
          for (let y = 0; y < 4; y++) for (let x = 0; x < TS; x++) {
            if (y < 2 || ((x + y) & 1)) { const o = (py + y) * w + px + x; d[o] = DARKER[d[o]]; }
          }
        }
        if (this.solidLike(tx - 1, ty)) {
          for (let y = 0; y < TS; y++) for (let x = 0; x < 3; x++) {
            if (x < 1 || ((x + y) & 1)) { const o = (py + y) * w + px + x; d[o] = DARKER[d[o]]; }
          }
        }
      }
      let tile = null;
      if (t === T.SOLID) tile = (this.solidLike(tx, ty - 1) ? ts.solid : ts.solidTop);
      else if (t === T.ALT) tile = (this.solidLike(tx, ty - 1) ? ts.alt : ts.altTop);
      else if (t === T.CONV_L || t === T.CONV_R) tile = ts.conveyor;
      if (tile) {
        bmp.blitPart(tile[this.variant(tx, ty, tile.length)], 0, 0, TS, TS, px, py, true);
      } else if (t === T.CRACK) {
        bmp.blitPart(ts.cracked[this.solidLike(tx, ty - 1) ? Math.min(1, ts.cracked.length - 1) : 0], 0, 0, TS, TS, px, py, true);
      } else if (t === T.PLAT) {
        const l = this.tile(tx - 1, ty), r = this.tile(tx + 1, ty);
        const lo = (l === T.PLAT || SOLID_LUT[l]), ro = (r === T.PLAT || SOLID_LUT[r]);
        const p = ts.platform;
        bmp.blit(p[(!lo && p.length > 2) ? 0 : ((!ro && p.length > 2) ? 2 : Math.min(1, p.length - 1))], px, py);
      } else if (t === T.LADDER) {
        bmp.blit(ts.ladder[0], px, py);
      } else if (t === T.SPIKE) {
        bmp.blit(ts.spikes[this.variant(tx, ty, ts.spikes.length)], px, py);
      }
      // crisp edges where solid meets air
      if (SOLID_LUT[t] && t !== T.GATE) {
        const oc = C.outline;
        if (!this.solidLike(tx - 1, ty) && tx > 0) bmp.rect(px, py + (this.solidLike(tx, ty - 1) ? 0 : 1), 1, TS, oc);
        if (!this.solidLike(tx + 1, ty) && tx < this.w - 1) bmp.rect(px + TS - 1, py + (this.solidLike(tx, ty - 1) ? 0 : 1), 1, TS, oc);
        if (!this.solidLike(tx, ty + 1) && ty < this.h - 1) bmp.rect(px, py + TS - 1, TS, 1, oc);
      }
    }

    /* --- physics: move an entity {x,y(feet),vx,vy,hw,h} through the tile grid --- */
    move(e) {
      e.hitWall = 0; e.hitCeil = false;
      if (e.noclip) { e.x += e.vx; e.y += e.vy; e.onGround = false; return; }
      // X axis
      if (e.vx !== 0) {
        e.x += e.vx;
        const ty0 = Math.floor((e.y - e.h) / TS), ty1 = Math.floor((e.y - 0.001) / TS);
        if (e.vx > 0) {
          const tx = Math.floor((e.x + e.hw - 0.001) / TS);
          for (let ty = ty0; ty <= ty1; ty++) if (this.solid(tx, ty)) { e.x = tx * TS - e.hw; e.hitWall = 1; break; }
        } else {
          const tx = Math.floor((e.x - e.hw) / TS);
          for (let ty = ty0; ty <= ty1; ty++) if (this.solid(tx, ty)) { e.x = (tx + 1) * TS + e.hw; e.hitWall = -1; break; }
        }
      }
      // Y axis
      const wasBottom = e.y;
      e.y += e.vy;
      e.onGround = false; e.groundType = 0;
      const lx = Math.floor((e.x - e.hw) / TS), rx = Math.floor((e.x + e.hw - 0.001) / TS);
      if (e.vy >= 0) {
        const c0 = Math.ceil(wasBottom / TS - 1e-6), c1 = Math.floor(e.y / TS);
        for (let cy = c0; cy <= c1 && !e.onGround; cy++) {
          for (let cx = lx; cx <= rx; cx++) {
            const t = this.tile(cx, cy);
            if (SOLID_LUT[t] || (!e.dropThrough && this.oneWay(cx, cy))) {
              e.y = cy * TS; e.landVy = e.vy; e.vy = 0; e.onGround = true;
              const mid = this.tile(Math.floor(e.x / TS), cy);
              e.groundType = (SOLID_LUT[mid] || mid === T.PLAT || mid === T.BRIDGE || mid === T.GHOST || mid === T.LADDER) ? mid : t;
              e.groundTy = cy;
              break;
            }
          }
        }
      } else {
        const ty = Math.floor((e.y - e.h) / TS);
        for (let cx = lx; cx <= rx; cx++) {
          if (this.solid(cx, ty)) { e.y = (ty + 1) * TS + e.h; e.vy = 0; e.hitCeil = true; break; }
        }
      }
    }

    /** Rocking-deck vertical offset (render-space) for world x at time t. */
    rockOffset(wx, t) {
      const r = this.rock;
      if (!r) return 0;
      const x0 = r[0], x1 = r[1], ramp = 40;
      if (wx < x0 - ramp || wx > x1 + ramp) return 0;
      const cx = (x0 + x1) / 2, half = (x1 - x0) / 2;
      let off = (wx - cx) / half * 6 * Math.sin(t * 0.021) + Math.sin(t * 0.047 + wx * 0.008) * 1.5;
      if (wx < x0) off *= (wx - (x0 - ramp)) / ramp;
      else if (wx > x1) off *= ((x1 + ramp) - wx) / ramp;
      return Math.round(off);
    }
    /** Downhill slide force on the rocking deck (px/frame). */
    rockSlide(wx, t) {
      const r = this.rock;
      if (!r || wx < r[0] || wx > r[1]) return 0;
      return Math.sin(t * 0.021) * 0.22;
    }
  }
  GNG.Level = Level;

  /* ------------------------------------------------------------------ Particles */
  const P_PX = 0, P_SPR = 1, P_ANIM = 2, P_TEXT = 3, P_BLOCK = 4;
  const MAX_PARTICLES = 900;

  class Particles {
    constructor(world) { this.w = world; this.list = []; }
    add(p) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift();
      if (p.vx === undefined) p.vx = 0; if (p.vy === undefined) p.vy = 0;
      if (p.g === undefined) p.g = 0; p.max = p.life; p.age = 0;
      this.list.push(p);
      return p;
    }
    update() {
      const lvl = this.w.level, list = this.list;
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.age++;
        if (--p.life <= 0) continue;
        p.vy += p.g;
        if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
        p.x += p.vx; p.y += p.vy;
        if (p.bounce) {
          if (lvl.solidPx(p.x, p.y)) {
            if (!lvl.solidPx(p.x, p.y - p.vy)) {       // floor / ceiling
              p.y -= p.vy; p.vy = -p.vy * p.bounce; p.vx *= 0.7;
              if (Math.abs(p.vy) < 0.6) { p.vy = 0; p.g = 0; p.vx = 0; p.rest = true; if (p.life > 40) p.life = 40; }
            } else { p.x -= p.vx; p.vx = -p.vx * 0.5; }
          } else if (p.rest && !lvl.solidPx(p.x, p.y + 2)) { p.rest = false; p.g = 0.25; }
        }
        list[n++] = p;
      }
      list.length = n;
    }
    draw(g, vx, vy, front) {
      const list = this.list;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!!p.front !== !!front) continue;
        const x = Math.floor(p.x) - vx, y = Math.floor(p.y) - vy;
        if (x < -40 || x > 360 || y < -40 || y > 280) continue;
        if (p.kind === P_PX) {
          const col = p.ramp ? p.ramp[Math.min(p.ramp.length - 1, Math.floor(p.life / p.max * p.ramp.length))] : p.col;
          if (p.size === 2) g.rect(x, y, 2, 2, col); else g.pset(x, y, col);
        } else if (p.kind === P_BLOCK) {
          g.rect(x - 1, y - 1, p.size || 3, p.size || 3, p.col);
          g.pset(x - 1, y - 1, p.col2 || p.col);
        } else if (p.kind === P_SPR) {
          const f = p.frames[Math.floor(p.age / (p.fps || 4)) % p.frames.length];
          if (p.life < 20 && (p.life & 2)) continue;
          g.draw(f, x, y, p.flip);
        } else if (p.kind === P_ANIM) {
          if (p.age < 0) continue;                         // delayed start
          const fi = Math.min(p.frames.length - 1, Math.floor(p.age / p.fps));
          if (p.table) g.drawMap(p.frames[fi], x, y, p.flip, p.table); else g.draw(p.frames[fi], x, y, p.flip);
        } else if (p.kind === P_TEXT) {
          GNG.text(g, p.text, x, y, p.col, { align: 'center', outline: C.black });
        }
      }
    }

    /* ---- emitters ---- */
    anim(prefix, x, y, fps, opts) {
      const frames = GNG.frames(prefix);
      const p = this.add({ kind: P_ANIM, x: x, y: y, frames: frames, fps: fps || 4, life: frames.length * (fps || 4) });
      if (opts) Object.assign(p, opts);
      return p;
    }
    px(x, y, vx, vy, col, life, g, opts) {
      const p = this.add({ kind: P_PX, x: x, y: y, vx: vx, vy: vy, col: col, life: life, g: g || 0 });
      if (opts) Object.assign(p, opts);
      return p;
    }
    spark(x, y) { this.anim('fx_spark', x, y, 3); for (let i = 0; i < 4; i++) this.px(x, y, GNG.rnd(-2, 2), GNG.rnd(-2.5, 0.5), C.white, GNG.irnd(8, 16), 0.15, { ramp: [C.gold[4], C.gold[6], C.white] }); }
    poof(x, y) { this.anim('fx_poof', x, y, 4); this.embers(x, y, 6); }
    explode(x, y, big) {
      this.anim('fx_explode', x, y, 4);
      if (big) for (let i = 0; i < 3; i++) this.anim('fx_explode', x + GNG.rnd(-18, 18), y + GNG.rnd(-18, 18), 4, { age: -i * 5, life: 6 * 4 + i * 5 });
      this.embers(x, y, big ? 26 : 14);
      for (let i = 0; i < (big ? 10 : 5); i++) this.px(x + GNG.rnd(-8, 8), y + GNG.rnd(-8, 8), GNG.rnd(-0.6, 0.6), GNG.rnd(-1.2, -0.2), C.gray[2], GNG.irnd(30, 60), -0.01, { ramp: [C.gray[1], C.gray[2], C.gray[3]], size: 2 });
    }
    embers(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.px(x + GNG.rnd(-5, 5), y + GNG.rnd(-5, 5), GNG.rnd(-1.6, 1.6), GNG.rnd(-2.8, 0.4), C.ember[5], GNG.irnd(18, 46), 0.03,
          { ramp: [C.ember[1], C.ember[3], C.ember[4], C.ember[5], C.ember[7]], drag: 0.97 });
      }
    }
    risingEmber(x, y) {
      this.px(x, y, GNG.rnd(-0.3, 0.3), GNG.rnd(-1.1, -0.4), C.ember[5], GNG.irnd(40, 90), -0.004, { ramp: [C.ember[1], C.ember[3], C.ember[5], C.ember[6]] });
    }
    blood(x, y, rampName, n, dirx) {
      const r = GNG.RAMPS[rampName || 'red'];
      for (let i = 0; i < n; i++) {
        this.px(x + GNG.rnd(-3, 3), y + GNG.rnd(-6, 2), GNG.rnd(-1.8, 1.8) + (dirx || 0), GNG.rnd(-3.2, -0.4), r[4], GNG.irnd(30, 70), 0.22,
          { ramp: [r[2], r[3], r[4], r[5]], bounce: 0.01, size: (i & 3) === 0 ? 2 : 1 });
      }
    }
    bones(x, y, n) {
      const fr = GNG.frames('p_bone');
      for (let i = 0; i < n; i++) {
        this.add({ kind: P_SPR, x: x + GNG.rnd(-4, 4), y: y - GNG.rnd(2, 18), vx: GNG.rnd(-2.2, 2.2), vy: GNG.rnd(-4.2, -1.2), g: 0.24, life: GNG.irnd(50, 90), frames: fr, fps: 3 + (i & 1), bounce: 0.45, flip: !!(i & 1) });
      }
      for (let i = 0; i < n * 2; i++) this.px(x + GNG.rnd(-4, 4), y - GNG.rnd(0, 16), GNG.rnd(-2, 2), GNG.rnd(-3, -0.5), C.bone[6], GNG.irnd(25, 55), 0.22, { bounce: 0.4, ramp: [C.bone[3], C.bone[5], C.bone[6]] });
    }
    plates(x, y, skin, n) {
      const fr = GNG.frames('plate_' + skin);
      const r = skin === 'gold' ? C.gold : C.steel;
      for (let i = 0; i < n; i++) {
        this.add({ kind: P_SPR, x: x + GNG.rnd(-5, 5), y: y - GNG.rnd(4, 22), vx: GNG.rnd(-2.8, 2.8), vy: GNG.rnd(-5, -1.5), g: 0.26, life: GNG.irnd(60, 110), frames: [fr[i % fr.length]], bounce: 0.5, flip: !!(i & 1) });
      }
      for (let i = 0; i < 14; i++) this.px(x + GNG.rnd(-5, 5), y - GNG.rnd(2, 22), GNG.rnd(-3, 3), GNG.rnd(-4, -0.5), r[6], GNG.irnd(20, 45), 0.2, { ramp: [r[3], r[5], r[7], C.white], bounce: 0.4 });
    }
    shatterArmor(x, y, skin) {
      this.anim('fx_shatter', x, y - 12, 3, skin === 'gold' ? { table: GNG.rampSwap({ steel: 'gold', blue: 'orange' }) } : null);
      this.plates(x, y, skin, 9);
    }
    debris(x, y, rampName, n) {
      const r = GNG.RAMPS[rampName] || C.gray;
      for (let i = 0; i < n; i++) {
        this.add({ kind: P_BLOCK, x: x + GNG.rnd(-7, 7), y: y + GNG.rnd(-7, 7), vx: GNG.rnd(-1.8, 1.8), vy: GNG.rnd(-3.4, -0.4), g: 0.25, life: GNG.irnd(40, 80), col: r[GNG.irnd(2, 4)], col2: r[5], size: GNG.irnd(2, 4), bounce: 0.35 });
      }
    }
    dustCloud(x, y) {
      for (let i = 0; i < 8; i++) this.px(x + GNG.rnd(-8, 8), y + GNG.rnd(-4, 4), GNG.rnd(-0.8, 0.8), GNG.rnd(-0.8, 0), C.mist[4], GNG.irnd(18, 36), -0.01, { ramp: [C.mist[2], C.mist[3], C.mist[5]], size: 2 });
    }
    dust(x, y) { this.anim('fx_dust', x, y, 4); }
    splash(x, y, n) {
      this.anim('fx_splash', x, y, 4, { front: true });
      for (let i = 0; i < (n || 8); i++) this.px(x + GNG.rnd(-5, 5), y - 2, GNG.rnd(-1.6, 1.6), GNG.rnd(-3.6, -1), GNG.LIQ_BASE + 4, GNG.irnd(20, 40), 0.22, { ramp: [GNG.LIQ_BASE + 2, GNG.LIQ_BASE + 3, GNG.LIQ_BASE + 4], front: true });
    }
    sparkle(x, y) { this.anim('fx_sparkle', x, y, 4); }
    sparkleBurst(x, y, n) { for (let i = 0; i < n; i++) this.anim('fx_sparkle', x + GNG.rnd(-10, 10), y + GNG.rnd(-10, 10), 4, { age: -GNG.irnd(0, 12), life: 16 + 12 }); }
    ecto(x, y, n) {
      this.anim('fx_ecto', x, y, 5);
      const r = C.teal;
      for (let i = 0; i < n; i++) this.px(x + GNG.rnd(-4, 4), y + GNG.rnd(-6, 4), GNG.rnd(-1.5, 1.5), GNG.rnd(-2.6, 0), r[5], GNG.irnd(26, 56), 0.16, { ramp: [r[2], r[4], r[5], r[7]], bounce: 0.01, size: (i & 1) + 1 });
    }
    soul(x, y) {
      this.px(x + GNG.rnd(-3, 3), y + GNG.rnd(-3, 3), GNG.rnd(-0.4, 0.4), GNG.rnd(-0.9, -0.1), C.teal[6], GNG.irnd(14, 30), 0, { ramp: [C.blue[4], C.teal[5], C.teal[7], C.white] });
    }
    magic(x, y, rampName) {
      const r = GNG.RAMPS[rampName || 'gold'];
      const a = GNG.rnd(0, Math.PI * 2), d = GNG.rnd(18, 34);
      this.px(x + Math.cos(a) * d, y + Math.sin(a) * d, -Math.cos(a) * d / 16, -Math.sin(a) * d / 16, r[6], 16, 0, { ramp: [r[4], r[6], C.white] });
    }
    score(x, y, pts) { this.add({ kind: P_TEXT, x: x, y: y - 14, vy: -0.5, life: 44, text: String(pts), col: C.white, front: true, drag: 0.97 }); }
    label(x, y, str, col) { this.add({ kind: P_TEXT, x: x, y: y, vy: -0.35, life: 80, text: str, col: col || C.gold[6], front: true, drag: 0.98 }); }
  }
  GNG.Particles = Particles;

  /* ------------------------------------------------------------------ liquids */
  /** Draw liquid cells over the finished playfield (un-sheared), with wave line + stippled shallows. */
  GNG.drawLiquid = function (fb, level, camX, camY, t) {
    const tx0 = Math.max(0, Math.floor(camX / TS)), tx1 = Math.min(level.w - 1, Math.floor((camX + GNG.W - 1) / TS));
    const ty0 = Math.max(0, Math.floor(camY / TS)), ty1 = Math.min(level.h - 1, Math.floor((camY + GNG.H - 1) / TS));
    const d = fb.data, LB = GNG.LIQ_BASE, W = GNG.W, H = GNG.H;
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        if (!level.liq[ty * level.w + tx]) continue;
        const surface = ty === 0 || !level.liq[(ty - 1) * level.w + tx];
        // depth below the surface (in cells) for shading
        let depthCells = 0;
        if (!surface) { let k = ty; while (k > 0 && level.liq[(k - 1) * level.w + tx]) { k--; depthCells++; } }
        for (let px = 0; px < TS; px++) {
          const wx = tx * TS + px, sx = wx - camX;
          if (sx < 0 || sx >= W) continue;
          const wave = surface ? 4 + Math.round(Math.sin((wx + t * 0.9) * 0.13) * 1.2 + Math.sin((wx - t * 0.6) * 0.05) * 1.3) : 0;
          for (let py = wave; py < TS; py++) {
            const wy = ty * TS + py, sy = wy - camY;
            if (sy < 0 || sy >= H) continue;
            const depth = depthCells * TS + py - (surface ? wave : 0);
            let idx;
            if (depth === 0) idx = 4;                                   // bright crest
            else if (depth === 1) idx = ((wx + t) >> 2) & 1 ? 3 : 5;
            else {
              idx = (((wx >> 2) + (wy >> 1)) & 7);
              if (depth > 10 && ((wx ^ wy) & 1)) idx = (idx & 1) ? 0 : 7;  // deeper = darker dither
              if (depth > 22) idx = ((wx >> 3) + (wy >> 2)) & 1 ? 0 : 1;
            }
            if (depth > 0 && depth < 5 && ((wx + wy) & 1)) continue;    // stippled shallows show the hull / feet
            d[sy * W + sx] = LB + idx;
          }
        }
      }
    }
  };

  /* ------------------------------------------------------------------ weather + lightning */
  class Weather {
    constructor(world) {
      this.w = world; this.t = 0;
      const def = world.level.def;
      this.rain = def.rain ? [] : null;
      this.embers = def.ambient === 'embers';
      this.ash = def.ambient === 'ash';
      this.fog = def.ambient === 'fog';
      this.lightning = !!(world.level.backdrop && world.level.backdrop.lightning);
      this.lightT = GNG.irnd(120, 300); this.flash = 0; this.bolt = null; this.thunder = -1;
      this.lightEvery = def.lightningEvery || [300, 620];
      this.gust = 0; this.gustT = 120; this.gustDir = (def.wind && def.wind.dir) || -1;
      this.streaks = [];
      if (this.rain) for (let i = 0; i < 70; i++) this.rain.push({ x: GNG.rnd(0, 360), y: GNG.rnd(0, 200), s: GNG.rnd(5, 8) });
    }
    update() {
      this.t++;
      const W = this.w, def = W.level.def;
      // gusts (global timer; only felt inside wind zones)
      if (W.level.windZones.length) {
        const wd = def.wind || {};
        if (--this.gustT <= 0) {
          if (this.gust > 0) { this.gust = 0; this.gustT = wd.calm || 170; }
          else { this.gust = 1; this.gustT = wd.blow || 190; if (W.inWindZone(W.cam.x + 160)) GNG.snd('wind_gust'); }
        }
      }
      if (this.gust > 0 && W.inWindZone(W.cam.x + 160) && (this.t & 1)) {
        this.streaks.push({ x: this.gustDir < 0 ? 330 : -10, y: GNG.rnd(10, 190), v: GNG.rnd(6, 10) * this.gustDir, l: GNG.irnd(6, 16), leaf: GNG.chance(0.2) });
      }
      for (let i = this.streaks.length - 1; i >= 0; i--) {
        const s = this.streaks[i]; s.x += s.v; if (s.leaf) s.y += Math.sin(this.t * 0.3 + i) * 1.2;
        if (s.x < -30 || s.x > 350) this.streaks.splice(i, 1);
      }
      if (this.rain) for (const r of this.rain) { r.y += r.s; r.x -= r.s * 0.45; if (r.y > 200) { r.y = -8; r.x = GNG.rnd(0, 420); } }
      // lightning
      if (this.lightning) {
        if (--this.lightT <= 0) this.strike();
        if (this.thunder >= 0 && --this.thunder < 0) GNG.snd('thunder');
      }
      if (this.flash > 0) this.flash--;
      const seq = [0, 0.1, 0.2, 0.35, 0.5, 0.3, 0.7, 0.95, 0.5, 0.25, 1, 1];
      GNG.fx.skyFlash = this.flash > 0 ? seq[Math.min(seq.length - 1, this.flash)] : 0;
      // ambient particles
      const cam = W.cam;
      if (this.embers && (this.t % 5) === 0) W.fx.risingEmber(cam.x + GNG.rnd(0, 320), cam.y + 205);
      if (this.ash && (this.t % 7) === 0) W.fx.px(cam.x + GNG.rnd(0, 340), cam.y - 4, GNG.rnd(-0.5, -0.1), GNG.rnd(0.3, 0.7), C.gray[3], 300, 0, { ramp: [C.gray[2], C.gray[3], C.maroon[3]] });
    }
    strike() {
      this.lightT = GNG.irnd(this.lightEvery[0], this.lightEvery[1]);
      this.flash = 11; this.thunder = GNG.irnd(14, 40);
      const pts = []; let x = GNG.rnd(30, 290), y = 0;
      while (y < GNG.rnd(60, 110)) { pts.push([x, y]); x += GNG.rnd(-14, 14); y += GNG.rnd(6, 16); }
      pts.push([x, y]);
      const branch = []; const bi = Math.max(1, (pts.length / 2) | 0); let bx = pts[bi][0], by = pts[bi][1];
      for (let k = 0; k < 4; k++) { branch.push([bx, by]); bx += GNG.rnd(4, 16) * (GNG.chance(0.5) ? 1 : -1); by += GNG.rnd(5, 12); }
      this.bolt = { pts: pts, branch: branch };
      this.w.onLightning();
    }
    /** bolt, drawn between the far and mid backdrop layers */
    drawBolt(fb) {
      if (this.flash < 6 || !this.bolt) return;
      const b = this.bolt, col = (this.flash & 1) ? C.white : GNG.SKY_BASE + 7;
      for (let i = 0; i + 1 < b.pts.length; i++) {
        fb.line(b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1], col);
        fb.line(b.pts[i][0] + 1, b.pts[i][1], b.pts[i + 1][0] + 1, b.pts[i + 1][1], C.white);
      }
      for (let i = 0; i + 1 < b.branch.length; i++) fb.line(b.branch[i][0], b.branch[i][1], b.branch[i + 1][0], b.branch[i + 1][1], col);
    }
    /** rain, wind streaks, ground fog — over the playfield */
    drawOver(fb) {
      if (this.rain) {
        const c = C.mist[3], c2 = C.mist[5];
        for (const r of this.rain) { fb.pset(r.x, r.y, c2); fb.pset(r.x + 1, r.y - 2, c); fb.pset(r.x + 2, r.y - 4, c); }
      }
      for (const s of this.streaks) {
        if (s.leaf) { fb.rect(s.x, s.y, 2, 2, C.olive[4]); fb.pset(s.x + 1, s.y, C.olive[6]); }
        else fb.rect(Math.min(s.x, s.x - Math.sign(s.v) * s.l), s.y, s.l, 1, ((s.l + (s.y | 0)) & 1) ? C.mist[5] : C.mist[3]);
      }
      if (this.fog) {
        const cam = this.w.cam, t = this.t, d = fb.data, c = C.mist[2];
        for (let y = 150; y < 200; y += 1) {
          const dens = (y - 150) / 110;
          const off = Math.floor(cam.x * 0.8 + t * 0.25 + Math.sin(y * 0.2) * 10);
          for (let x = (y & 1); x < 320; x += 2) {
            const nz = GNG.hash2((x + off) >> 4, y >> 3, 4) * 0.6 + GNG.hash2((x + off) >> 2, y >> 1, 9) * 0.4;
            if (nz < dens && ((x + y * 3 + ((x + off) >> 3)) & 3) === 0) d[y * 320 + x] = c;
          }
        }
      }
    }
  }
  GNG.Weather = Weather;

})();
