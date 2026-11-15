/*
 * objects.js — projectiles (Arthur's five weapons, monster shots), holy flames, pickups, chests,
 * the ejected-armour decoy anvil, and level mechanisms (plates, gates, slicers, pistons...).
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE, T = GNG.T, C = GNG.C;

  function overlap(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
  }
  GNG.overlap = overlap;
  /** shot (centre x,y / hw,hh) vs feet-anchored box entity (x, y=feet, hw, h) */
  function shotVsBox(s, e) {
    return Math.abs(s.x - e.x) < s.hw + e.hw && s.y + s.hh > e.y - e.h && s.y - s.hh < e.y;
  }
  GNG.shotVsBox = shotVsBox;
  /** two feet-anchored boxes */
  function boxVsBox(a, b) {
    return Math.abs(a.x - b.x) < a.hw + b.hw && a.y > b.y - b.h && a.y - a.h < b.y;
  }
  GNG.boxVsBox = boxVsBox;

  /* ====================================================================== SHOTS */
  const SHOTS = {
    // ---- Arthur's arsenal ----
    lance: { spr: 'w_lance', hw: 9, hh: 2, dmg: 2, fps: 99 },
    dagger: { spr: 'w_dagger', hw: 5, hh: 2, dmg: 1, fps: 99 },
    torch: { spr: 'w_torch', hw: 4, hh: 4, dmg: 2, g: 0.2, fps: 4 },
    axe: { spr: 'w_axe', hw: 6, hh: 6, dmg: 2, g: 0.2, fps: 3, shieldPierce: true, pierce: 99 },
    cross: { spr: 'w_cross', hw: 6, hh: 6, dmg: 1, fps: 3, tile: 'pass', pierce: 99 },
    // ---- shots fired while possessing a monster (friendly) ----
    h_bone: { spr: 'p_bone', hw: 4, hh: 4, dmg: 2, g: 0.16, fps: 3 },
    h_acid: { spr: 'p_acid', hw: 4, hh: 4, dmg: 3, g: 0.15, fps: 5 },
    h_fire: { spr: 'p_fireball', hw: 5, hh: 5, dmg: 3, fps: 4 },
    h_skull: { spr: 'p_skullfire', hw: 5, hh: 5, dmg: 2, fps: 4, tile: 'pass' },
    h_bolt: { spr: 'p_bolt', hw: 4, hh: 2, dmg: 2, fps: 4 },
    melee: { spr: null, hw: 10, hh: 10, dmg: 3, tile: 'pass', pierce: 99, life: 7, shieldPierce: true },
    m_star: { spr: 'fx_sparkle', hw: 5, hh: 5, dmg: 6, fps: 3, tile: 'pass', pierce: 99, shieldPierce: true, life: 80 },
    // ---- monster shots ----
    bone: { spr: 'p_bone', hw: 3, hh: 3, g: 0.16, fps: 3, grace: 8 },
    fireball: { spr: 'p_fireball', hw: 4, hh: 4, fps: 4 },
    bigfire: { spr: 'p_bigfire', hw: 7, hh: 7, fps: 4 },
    acid: { spr: 'p_acid', hw: 3, hh: 3, g: 0.15, fps: 5 },
    skullfire: { spr: 'p_skullfire', hw: 4, hh: 4, fps: 4, tile: 'pass' },
    coconut: { spr: 'p_coconut', hw: 4, hh: 4, g: 0.17, fps: 99 },
    banana: { spr: 'p_banana', hw: 4, hh: 4, g: 0.11, fps: 3, grace: 8 },
    magic: { spr: 'p_magic', hw: 4, hh: 4, fps: 4, tile: 'pass', life: 300 },
    bolt: { spr: 'p_bolt', hw: 4, hh: 2, fps: 4 }
  };

  const rotCache = {};
  function rotated(spr, how) {            // how: 'up' | 'down'
    const key = (spr.name || '?') + ':' + how;
    let r = rotCache[key];
    if (!r) {
      r = spr.rot90();                    // pointing down
      if (how === 'up') r = r.flipV();
      r.ax = r.w >> 1; r.ay = r.h >> 1;
      rotCache[key] = r;
    }
    return r;
  }
  /** Scale2x (EPX): doubles a sprite while keeping its diagonals crisp instead of blocky. */
  function scale2x(src) {
    const w = src.w, h = src.h, out = new GNG.Bitmap(w * 2, h * 2), d = out.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = src.get(x, y), A = src.get(x, y - 1), B = src.get(x + 1, y), C2 = src.get(x - 1, y), D = src.get(x, y + 1);
      const o = (y * 2) * out.w + x * 2;
      d[o] = (C2 === A && C2 !== D && A !== B) ? A : P;
      d[o + 1] = (A === B && A !== C2 && B !== D) ? B : P;
      d[o + out.w] = (D === C2 && D !== B && C2 !== A) ? C2 : P;
      d[o + out.w + 1] = (B === D && B !== A && D !== C2) ? D : P;
    }
    return out;
  }
  let bigFireReady = false;
  function ensureBigFire() {
    if (bigFireReady) return;
    bigFireReady = true;
    const f = GNG.frames('p_fireball');
    for (let i = 0; i < f.length; i++) {
      const b = scale2x(f[i]); b.ax = b.w >> 1; b.ay = b.h >> 1;
      GNG.regSprite('p_bigfire' + i, b);
    }
  }

  class Shot {
    constructor(W, kind, x, y, vx, vy, friendly) {
      const d = SHOTS[kind];
      if (kind === 'bigfire') ensureBigFire();
      this.w = W; this.kind = kind; this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.friendly = !!friendly; this.t = 0; this.dead = false;
      this.hw = d.hw; this.hh = d.hh; this.g = d.g || 0; this.dmg = d.dmg || 1;
      this.frames = d.spr ? GNG.frames(d.spr) : null; this.fps = d.fps || 4;
      this.tile = d.tile || 'die'; this.pierce = d.pierce || 0; this.shieldPierce = !!d.shieldPierce;
      this.life = d.life || 300; this.grace = d.grace || 0;
      this.hits = new Map();
      this.emp = false; this.rot = null; this.flip = vx < 0;
      this.returning = false; this.dist = 0; this.range = 92; this.steps = 4;
      this.owner = null; this.homing = 0; this.trailCol = 0;
    }

    update() {
      const W = this.w, L = W.level;
      this.t++;
      if (this.kind === 'cross') { this.updateCross(); return; }
      if (this.kind === 'melee') {
        if (this.owner) { this.x = this.owner.x + this.owner.dir * this.ox; this.y = this.owner.y - this.oy; }
        if (--this.life <= 0) this.dead = true;
        return;
      }
      const py = this.y;
      this.vy += this.g;
      if (this.homing > 0 && this.t < 150) {
        const tg = this.friendly ? null : W.playerBox();
        if (tg && !W.player.busy) {
          const dx = tg.x - this.x, dy = (tg.y - 12) - this.y, d = Math.hypot(dx, dy) || 1;
          this.vx += dx / d * this.homing; this.vy += dy / d * this.homing;
          const sp = Math.hypot(this.vx, this.vy), mx = this.maxSp || 2;
          if (sp > mx) { this.vx *= mx / sp; this.vy *= mx / sp; }
        }
      }
      this.x += this.vx; this.y += this.vy;
      if (this.kind === 'm_star' && (this.t & 1)) W.fx.px(this.x, this.y, 0, 0, C.gold[6], 8, 0, { ramp: [C.gold[3], C.gold[5], C.white] });
      if (this.tile === 'die' && this.t > this.grace) {
        if (L.solidPx(this.x, this.y)) { this.hitTile(py); return; }
        if (this.g && this.vy > 0 && (this.kind === 'torch' || this.kind === 'h_acid')) {
          const ty = Math.floor(this.y / TS), tx = Math.floor(this.x / TS);
          if (L.oneWay(tx, ty) && py <= ty * TS) { this.y = ty * TS; this.hitTile(py); return; }
        }
      }
      if (L.liquidPx(this.x, this.y)) {
        if (this.g || this.kind === 'torch') { W.fx.splash(this.x, this.y, 3); this.dead = true; return; }
      }
      if (--this.life <= 0 || !W.onScreen(this.x, this.y, 70)) this.dead = true;
    }

    updateCross() {
      const W = this.w, pb = W.playerBox();
      if (!this.returning) {
        this.x += this.vx; this.y += this.vy;
        this.dist += Math.hypot(this.vx, this.vy);
        if (this.dist >= this.range) this.returning = true;
      } else {
        const dx = pb.x - this.x, dy = (pb.y - 14) - this.y, d = Math.hypot(dx, dy) || 1, sp = 5.2;
        this.vx = dx / d * sp; this.vy = dy / d * sp;
        this.x += this.vx; this.y += this.vy;
        if (d < 10) { this.dead = true; GNG.snd('cross_catch', { vol: 0.6 }); return; }
      }
      // the cross-shield eats enemy projectiles
      const es = W.eshots;
      for (let i = 0; i < es.length; i++) {
        const s = es[i];
        if (!s.dead && overlap(this.x, this.y, this.hw + 3, this.hh + 3, s.x, s.y, s.hw, s.hh)) {
          s.dead = true; W.fx.spark(s.x, s.y); GNG.snd('clang', { vol: 0.5 });
        }
      }
      if (this.t > 280) this.dead = true;
    }

    hitTile(prevY) {
      const W = this.w, L = W.level;
      this.dead = true;
      switch (this.kind) {
        case 'torch': {
          // landed on a floor? -> creeping holy flames. hit a wall -> single flare
          const ty = Math.floor(this.y / TS);
          const floorY = (this.vy > 0 && !L.solidPx(this.x, prevY)) ? ty * TS : null;
          if (floorY !== null) GNG.igniteFlames(W, this.x, floorY, this.flip ? -1 : 1, this.steps);
          else { W.fx.embers(this.x, this.y, 5); GNG.igniteFlames(W, this.x - Math.sign(this.vx) * 6, L.groundBelow(this.x - Math.sign(this.vx) * 6, this.y, 80), this.flip ? -1 : 1, 1); }
          break;
        }
        case 'lance': case 'dagger': case 'axe': case 'h_bolt': case 'bolt':
          W.fx.spark(this.x, this.y);
          if (this.friendly && W.onScreen(this.x, this.y, 0)) GNG.snd('clang', { vol: 0.3 });
          break;
        case 'h_acid': case 'acid':
          W.fx.blood(this.x, this.y - 2, 'toxic', 6);
          break;
        case 'bone': case 'h_bone': case 'banana': case 'coconut':
          W.fx.px(this.x, this.y, GNG.rnd(-1, 1), -1.5, C.bone[6], 14, 0.2);
          W.fx.px(this.x, this.y, GNG.rnd(-1, 1), -2, C.bone[5], 14, 0.2);
          break;
        default:
          W.fx.embers(this.x, this.y, 4);
      }
    }

    /** enemy / object was hit by this (friendly) shot */
    onHit(target) {
      const W = this.w;
      switch (this.kind) {
        case 'lance': if (this.pierce-- <= 0) this.dead = true; break;
        case 'torch': {
          this.dead = true;
          const gy = target.flying ? W.level.groundBelow(this.x, this.y, 90) : target.y;
          GNG.igniteFlames(W, target.x, gy, this.flip ? -1 : 1, Math.max(2, this.steps - 2));
          break;
        }
        case 'axe': case 'melee': case 'm_star': break;
        case 'cross': if (!this.returning && this.dist > 20) this.returning = true; break;
        default: this.dead = true;
      }
    }
    /** deflected by a shield / armour */
    onBlocked() {
      const W = this.w;
      if (this.kind === 'cross') { this.returning = true; return; }
      if (this.kind === 'torch') {          // flames lick under the shield
        this.dead = true;
        GNG.igniteFlames(W, this.x, W.level.groundBelow(this.x, this.y, 60), this.flip ? -1 : 1, 2);
        return;
      }
      this.dead = true;
      // ricochet as a harmless spinning particle
      if (this.frames) {
        W.fx.add({ kind: 1, x: this.x, y: this.y, vx: -Math.sign(this.vx || 1) * 1.6, vy: -3, g: 0.25, life: 40, frames: [this.frames[0]], flip: !this.flip });
      }
    }

    sprite() {
      if (!this.frames) return null;
      let s = this.frames[this.fps >= 99 ? 0 : (Math.floor(this.t / this.fps) % this.frames.length)];
      if (this.rot) s = rotated(s, this.rot);
      return s;
    }
    draw(g, vx, vy) {
      const s = this.sprite();
      if (!s) return;
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      if (this.emp && this.trailCol) {       // empowered shots leave an after-image
        g.drawStipple(s, sx - Math.round(this.vx * 1.4), sy - Math.round(this.vy * 1.4), this.flip, this.t & 1, null, this.trailCol);
        g.drawStipple(s, sx - Math.round(this.vx * 2.8), sy - Math.round(this.vy * 2.8), this.flip, (this.t + 1) & 1, null, this.trailCol2 || this.trailCol);
      }
      g.draw(s, sx, sy, this.flip && !this.rot);
    }
  }
  GNG.Shot = Shot;

  /**
   * Throw one of Arthur's five weapons. aim: 'fwd' | 'up' | 'down'.
   * emp = EMPOWERED (steel / golden armour): more damage plus a per-weapon perk.
   */
  GNG.fireWeapon = function (W, kind, x, y, dir, aim, emp) {
    let vx = 0, vy = 0;
    const s = new Shot(W, kind, x, y, 0, 0, true);
    s.emp = !!emp;
    if (emp) {
      const gold = W.player.mode === 'gold';
      s.trailCol = gold ? C.gold[6] : C.steel[6]; s.trailCol2 = gold ? C.orange[4] : C.blue[4];
      s.dmg += 1;
    }
    switch (kind) {
      case 'lance': {
        const v = 5.6;
        if (aim === 'up') { vy = -v; s.rot = 'up'; } else if (aim === 'down') { vy = v; s.rot = 'down'; } else vx = dir * v;
        if (emp) s.pierce = 1;                       // empowered lance skewers two foes
        break;
      }
      case 'dagger': {
        const v = 7.2;
        if (aim === 'up') { vy = -v; s.rot = 'up'; } else if (aim === 'down') { vy = v; s.rot = 'down'; } else vx = dir * v;
        break;
      }
      case 'torch':
        if (aim === 'up') { vx = dir * 0.9; vy = -5.2; } else if (aim === 'down') { vx = dir * 1.6; vy = 1.5; } else { vx = dir * 2.5; vy = -3.1; }
        s.steps = emp ? 8 : 4;                       // empowered flames creep twice as far
        break;
      case 'axe':
        if (aim === 'up') { vx = dir * 1.1; vy = -6.4; } else if (aim === 'down') { vx = dir * 2.2; vy = 0.5; } else { vx = dir * 2.6; vy = -4.8; }
        if (emp) { s.hw = 8; s.hh = 8; }
        break;
      case 'cross': {
        const v = 4.6;
        if (aim === 'up') vy = -v; else if (aim === 'down') vy = v; else vx = dir * v;
        s.range = emp ? 132 : 92;
        break;
      }
    }
    if (s.rot) { const t = s.hw; s.hw = s.hh; s.hh = t; }
    s.vx = vx; s.vy = vy; s.flip = dir < 0;
    W.shots.push(s);
    return s;
  };

  /** Monster projectile. opts: {homing, maxSp, g, dmg} */
  GNG.enemyShot = function (W, kind, x, y, vx, vy, opts) {
    const s = new Shot(W, kind, x, y, vx, vy, false);
    if (opts) Object.assign(s, opts);
    W.eshots.push(s);
    return s;
  };
  /** Shot fired by a possessed host (hurts monsters). */
  GNG.hostShot = function (W, kind, x, y, vx, vy, opts) {
    const s = new Shot(W, kind, x, y, vx, vy, true);
    if (opts) Object.assign(s, opts);
    W.shots.push(s);
    return s;
  };
  /** Short-lived melee hitbox glued to an owner (possessed swordsman / armour / crow). */
  GNG.meleeHit = function (W, owner, ox, oy, hw, hh, dmg, life) {
    const s = new Shot(W, 'melee', owner.x + owner.dir * ox, owner.y - oy, 0, 0, true);
    s.owner = owner; s.ox = ox; s.oy = oy; s.hw = hw; s.hh = hh; s.dmg = dmg; s.life = life || 7;
    W.shots.push(s);
    return s;
  };

  /* ====================================================================== HOLY FLAMES */
  class Flame {
    constructor(W, x, y, dir, steps, first) {
      this.w = W; this.x = x; this.y = y; this.dir = dir; this.steps = steps;
      this.t = 0; this.life = 56; this.dead = false; this.hw = 5; this.h = 14; this.spawned = false;
      if (first) GNG.snd('flame_ignite');
    }
    update() {
      const W = this.w, L = W.level;
      this.t++;
      if (!this.spawned && this.t >= 5 && this.steps > 1) {     // creep forward along the ground
        this.spawned = true;
        const nx = this.x + this.dir * 10;
        if (!L.solidPx(nx, this.y - 4)) {
          let gy = null;
          if (L.standable(Math.floor(nx / TS), Math.floor((this.y + 1) / TS))) gy = this.y;
          else { const g2 = L.groundBelow(nx, this.y, 20); if (g2 !== null) gy = g2; }
          if (gy !== null && !L.liquidPx(nx, gy - 2)) W.flames.push(new Flame(W, nx, gy, this.dir, this.steps - 1, false));
        }
      }
      if ((this.t & 7) === 0) W.fx.px(this.x + GNG.rnd(-3, 3), this.y - GNG.rnd(6, 14), GNG.rnd(-0.2, 0.2), -0.8, C.blue[6], 14, 0, { ramp: [C.blue[3], C.blue[5], C.white] });
      if (this.t >= this.life) this.dead = true;
    }
    draw(g, vx, vy) {
      const f = GNG.frames('flame_blue');
      const spr = f[(this.t >> 2) % f.length];
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      if (this.life - this.t < 12) g.drawStipple(spr, sx, sy, false, this.t & 1); else g.draw(spr, sx, sy, (this.t >> 3) & 1);
    }
  }
  GNG.igniteFlames = function (W, x, y, dir, steps) {
    if (y === null || y === undefined) return;
    if (W.flames.length > 40) return;
    W.flames.push(new Flame(W, x, y, dir, steps, true));
  };

  /* ====================================================================== PICKUPS */
  const PICKUPS = {
    lance: { spr: 'icon_lance', weapon: true }, dagger: { spr: 'icon_dagger', weapon: true },
    torch: { spr: 'icon_torch', weapon: true }, axe: { spr: 'icon_axe', weapon: true }, cross: { spr: 'icon_cross', weapon: true },
    armor: { spr: 'armor_pickup_steel' }, gold: { spr: 'armor_pickup_gold' },
    money: { spr: 'moneybag', pts: 500 }, gem0: { spr: 'gem0', pts: 1000 }, gem1: { spr: 'gem1', pts: 2000 },
    potion_red: { spr: 'potion_red' }, potion_green: { spr: 'potion_green' }, potion_blue: { spr: 'potion_blue' },
    oneup: { spr: 'oneup' }, key: { spr: 'key', keep: true }, floppy: { spr: 'floppy', keep: true }
  };

  class Pickup {
    constructor(W, kind, x, y, opts) {
      const d = PICKUPS[kind] || PICKUPS.money;
      this.w = W; this.kind = kind; this.def = d; this.x = x; this.y = y;
      this.vx = 0; this.vy = -3.2; this.hw = 5; this.h = 10; this.t = 0; this.dead = false;
      this.onGround = false; this.life = d.keep ? 1e9 : 60 * 14; this.float = false;
      this.frames = GNG.frames(d.spr);
      if (opts) Object.assign(this, opts);
    }
    update() {
      const W = this.w, L = W.level;
      this.t++;
      if (!this.float) {
        this.vy = Math.min(this.vy + 0.22, 6);
        this.vx *= 0.96;
        if (this.onGround && (this.groundType === T.CONV_L || this.groundType === T.CONV_R)) this.x += this.groundType === T.CONV_L ? -0.8 : 0.8;
        L.move(this);
        if (this.onGround) this.vx = 0;
        if (L.liquidPx(this.x, this.y - 2) && !this.def.keep) { W.fx.splash(this.x, this.y, 3); this.dead = true; return; }
        if (this.y > L.pxH + 30) {
          if (this.def.keep) { this.y = W.cam.y + 40; this.vy = 0; this.x = GNG.clamp(this.x, W.cam.x + 30, W.cam.x + 290); }
          else { this.dead = true; return; }
        }
      }
      if (this.def.keep && (this.t % 6) === 0) W.fx.sparkle(this.x + GNG.rnd(-8, 8), this.y - GNG.rnd(0, 14));
      if (--this.life <= 0) { this.dead = true; return; }
      if (this.t > 18) {
        const pb = W.playerBox();
        if (!W.player.dead && !W.player.leap && Math.abs(pb.x - this.x) < pb.hw + this.hw + 2 && pb.y > this.y - this.h - 4 && pb.y - pb.h < this.y) this.collect();
      }
    }
    collect() {
      const W = this.w, pl = W.player, k = this.kind, d = this.def, game = GNG.game;
      this.dead = true;
      if (d.weapon) {
        pl.weapon = k; game.weapon = k;
        GNG.snd('pickup_weapon');
        W.fx.label(this.x, this.y - 18, GNG.WEAPONS[k].name + '!', C.gold[6]);
        W.hintOnce('w_' + k, GNG.WEAPON_HINTS[k]);
      } else if (k === 'armor') {
        if (pl.mode === 'boxers') { pl.equipArmor('steel'); W.fx.label(this.x, this.y - 18, 'KNIGHT\'S ARMOR!', C.steel[6]); }
        else { W.addScore(1000, this.x, this.y); GNG.snd('pickup_treasure'); }
      } else if (k === 'gold') {
        pl.equipArmor('gold'); W.fx.label(this.x, this.y - 18, 'GOLDEN ARMOR!', C.gold[6]);
        W.hintOnce('gold', 'GOLDEN ARMOR! HOLD [E] TO CHARGE A SCREEN-CLEARING SPELL');
      } else if (d.pts) {
        W.addScore(d.pts, this.x, this.y); GNG.snd('pickup_treasure');
      } else if (k === 'potion_red') {
        GNG.snd('potion');
        if (pl.mode === 'boxers') { pl.equipArmor('steel'); W.fx.label(this.x, this.y - 18, 'ARMOR RESTORED', C.red[5]); }
        else { W.addScore(2000, this.x, this.y); }
      } else if (k === 'potion_green') {
        GNG.snd('potion'); pl.floatT = 60 * 12;
        W.fx.label(this.x, this.y - 18, 'FEATHER FALL', C.green[6]);
      } else if (k === 'potion_blue') {
        GNG.snd('potion'); game.flipT = 60 * 5;
        W.fx.label(this.x, this.y - 18, 'CURSED POTION?!', C.blue[6]);
      } else if (k === 'oneup') {
        game.lives++; GNG.snd('one_up');
        W.fx.label(this.x, this.y - 18, '1UP', C.gold[6]);
      } else if (k === 'key') {
        GNG.snd('key'); W.stageClear();
      } else if (k === 'floppy') {
        GNG.snd('floppy'); W.stageClear(true);
      }
      W.fx.sparkleBurst(this.x, this.y - 6, 4);
    }
    draw(g, vx, vy) {
      if (this.life < 120 && (this.life & 4)) return;
      const bob = this.onGround || this.float ? Math.round(Math.sin(this.t * 0.12) * 1.5) : 0;
      const f = this.frames[(this.t >> 3) % this.frames.length];
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy - 1 + bob;
      // weapon icons are centre-anchored: lift them so they hover above the floor
      g.draw(f, sx, f.ay === f.h ? sy : sy - 7, false);
    }
  }
  GNG.Pickup = Pickup;
  GNG.WEAPON_HINTS = {
    lance: 'LANCE: FAST, STRAIGHT, HEAVY HITTER',
    dagger: 'DAGGER: RAPID FIRE - HOLD ATTACK',
    torch: 'HOLY TORCH: BLUE FLAMES CREEP ALONG THE GROUND, UNDER SHIELDS',
    axe: 'BATTLE AXE: HIGH ARC, CUTS THROUGH FOES AND SHIELDS',
    cross: 'BOOMERANG CROSS: RETURNS, AND EATS ENEMY PROJECTILES'
  };

  /* ====================================================================== CHESTS */
  class Chest {
    /** kind: 'normal' (rises when you come near) | 'secret' (spectral vision) | 'magic' (secret Magician chest) */
    constructor(W, x, y, kind, loot) {
      this.w = W; this.x = x; this.y = y; this.kind = kind || 'normal'; this.loot = loot || null;
      this.state = this.kind === 'normal' ? 'buried' : 'secret';
      this.t = 0; this.hp = 2; this.dead = false; this.hw = 7; this.h = 18; this.flash = 0;
      this.hittable = true; this.magT = 0; this.seen = 0;
    }
    get secret() { return this.kind !== 'normal'; }
    update() {
      const W = this.w, pb = W.playerBox();
      this.t++;
      if (this.flash > 0) this.flash--;
      const dx = Math.abs(pb.x - this.x), dy = Math.abs(pb.y - this.y);
      if (this.state === 'buried') {
        if (dx < 60 && dy < 90) { this.state = 'rising'; this.t = 0; GNG.snd('chest_spawn'); W.fx.sparkleBurst(this.x, this.y - 6, 5); }
      } else if (this.state === 'secret') {
        // only the exposed soul (boxer shorts) or a lightning flash can see it
        this.seen = W.spectral;
        if (W.spectral > 0.5 && W.player.mode === 'boxers' && dx < 70 && dy < 80) {
          this.state = 'rising'; this.t = 0; GNG.snd('chest_spawn'); W.fx.sparkleBurst(this.x, this.y - 6, 8);
          W.hintOnce('secretchest', 'SPECTRAL VISION REVEALED A SECRET CHEST!');
        }
      } else if (this.state === 'rising') {
        if (this.t >= 26) this.state = 'closed';
      } else if (this.state === 'open') {
        if (this.kind === 'magic' && this.magT > 0) {
          this.magT--;
          if ((this.magT & 3) === 0) W.fx.magic(this.x, this.y - 26, (this.magT & 4) ? 'purple' : 'gold');
          if (this.magT === 28) {
            const pl = W.player;
            GNG.snd('gold_armor');
            if (!pl.dead) {
              for (let i = 0; i < 14; i++) W.fx.px(this.x + (pb.x - this.x) * i / 14, this.y - 26 + (pb.y - 14 - (this.y - 26)) * i / 14, GNG.rnd(-0.4, 0.4), GNG.rnd(-0.4, 0.4), C.gold[6], 20 + i, 0, { ramp: [C.purple[4], C.gold[5], C.white] });
              pl.equipArmor('gold');
              W.fx.label(pb.x, pb.y - 34, 'GOLDEN ARMOR!', C.gold[6]);
              W.hintOnce('gold', 'GOLDEN ARMOR! HOLD [E] TO CHARGE A SCREEN-CLEARING SPELL');
            }
          }
        } else if (this.t === 8 && this.pending) {
          W.spawnPickup(this.pending, this.x, this.y - 8);
          this.pending = null;
        }
      }
    }
    collideShot(s) {
      if (this.state !== 'closed' && this.state !== 'secret') return false;
      if (!shotVsBox(s, this)) return false;
      if (s.hits.has(this)) return false;
      s.hits.set(this, this.w.time);
      this.hitBy(s);
      s.onHit(this);
      return true;
    }
    hitBy() {
      const W = this.w;
      if (this.state === 'secret') {         // blind hit reveals it
        this.state = 'closed'; W.fx.sparkleBurst(this.x, this.y - 6, 8); GNG.snd('chest_spawn');
        return;
      }
      this.flash = 6; this.hp--;
      W.fx.spark(this.x, this.y - 8);
      if (this.hp <= 0) this.open(); else GNG.snd('chest_hit');
    }
    open() {
      const W = this.w, pl = W.player;
      this.state = 'open'; this.t = 0; this.hittable = false;
      GNG.snd('chest_open');
      W.fx.sparkleBurst(this.x, this.y - 8, 6);
      if (this.kind === 'magic') {
        this.magT = 78; GNG.snd('magician');
        W.addScore(2000, this.x, this.y - 10);
        return;
      }
      if (pl.mode === 'boxers') this.pending = 'armor';         // reclaim your Knight's Armour!
      else if (this.loot && this.loot !== 'weapon' && this.loot !== pl.weapon) this.pending = this.loot;
      else {
        const opts = GNG.WEAPON_ORDER.filter(k => k !== pl.weapon);
        this.pending = (this.loot && this.loot === pl.weapon) ? 'money' : GNG.pick(opts);
      }
    }
    draw(g, vx, vy) {
      const W = this.w, sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      const f = GNG.frames('chest');
      if (this.state === 'buried') return;
      if (this.state === 'secret') {
        if (this.seen <= 0) { if (((W.time + this.x) % 97) === 0) W.fx.sparkle(this.x + GNG.rnd(-6, 6), this.y - GNG.rnd(2, 12)); return; }
        g.drawStipple(f[0], sx, sy, false, (W.time >> 2) & 1, GNG.SPECTRAL_MAP);
        return;
      }
      if (this.state === 'rising') {
        const rise = Math.floor((1 - this.t / 26) * 16);
        g.setClip(0, 0, g.w, sy);
        g.draw(f[0], sx + ((this.t >> 1) & 1), sy + rise, false);
        g.resetClip();
        return;
      }
      if (this.state === 'open') {
        g.draw(f[Math.min(f.length - 1, 1 + (this.t > 5 ? 1 : 0))], sx, sy, false);
        if (this.kind === 'magic' && this.magT > 0) {
          const m = GNG.frames('magician');
          const rise = Math.max(0, 20 - (78 - this.magT) * 2);
          g.setClip(0, 0, g.w, sy - 6);
          g.draw(m[((78 - this.magT) >> 3) % m.length], sx, sy - 6 + rise, pl_left(W, this.x));
          g.resetClip();
        }
        return;
      }
      if (this.flash > 0) g.drawSolid(f[0], sx, sy, false, C.white); else g.draw(f[0], sx, sy, false);
    }
  }
  function pl_left(W, x) { return W.playerBox().x < x; }
  GNG.Chest = Chest;
  GNG.PICKUP_KINDS = PICKUPS;

  /* ====================================================================== ARMOUR DECOY (the anvil) */
  class ArmorDecoy {
    constructor(W, x, y, skin, vy, dir) {
      this.w = W; this.x = x; this.y = y; this.skin = skin; this.vx = 0; this.vy = vy || 0; this.dir = dir || 1;
      this.hw = 6; this.h = 20; this.hp = 6; this.age = 0; this.dead = false; this.onGround = vy ? false : true;
      this.squash = 0; this.flash = 0; this.crushed = new Set(); this.wasAir = !!vy; this.isDecoy = true;
      this.groundType = 0; this.landVy = 0; this.fallStart = y;
    }
    update() {
      const W = this.w, L = W.level, pl = W.player;
      this.age++;
      if (this.squash > 0) this.squash--;
      if (this.flash > 0) this.flash--;
      this.vy = Math.min(this.vy + 0.5, 9);
      this.vx = 0;
      if (this.onGround) {
        if (this.groundType === T.CONV_L) this.vx = -0.8; else if (this.groundType === T.CONV_R) this.vx = 0.8;
      }
      const wasGround = this.onGround;
      L.move(this);
      if (!this.onGround) {
        this.wasAir = true;
        // HEAVY ANVIL: crush whatever is underneath while falling
        if (this.vy > 1.5) {
          for (const e of W.enemies) {
            if (e.dead || this.crushed.has(e) || e.noCrush) continue;
            if (W.boxHitsEnemy(this, e)) {
              this.crushed.add(e);
              e.damage(e.isBoss ? 10 : 30, { kind: 'anvil', x: this.x, y: this.y });
              GNG.snd('anvil_crush'); W.shake(4, 8);
              W.fx.spark(this.x, this.y);
              W.hintOnce('anvil', 'ANVIL DROP! EJECTED ARMOR CRUSHES WHATEVER IS BELOW');
            }
          }
          for (const o of W.objects) {
            if (o !== this && !o.dead && o.crushable && boxVsBox(this, o)) o.crush(this);
          }
        }
      } else if (!wasGround || this.wasAir) {
        // landed
        if (this.wasAir) {
          this.wasAir = false;
          const v = this.landVy || 0;
          if (v > 2) {
            W.shake(Math.min(6, 2 + v * 0.5), 10); GNG.snd('heavy_land');
            W.fx.dust(this.x - 8, this.y); W.fx.dust(this.x + 8, this.y);
            this.squash = 6;
          }
          let broke = false;
          const lx = Math.floor((this.x - this.hw) / TS), rx = Math.floor((this.x + this.hw - 0.01) / TS);
          for (let cx = lx; cx <= rx; cx++) if (L.smash(cx, this.groundTy)) broke = true;
          if (broke) { this.onGround = false; this.wasAir = true; this.vy = 2; }
        }
        this.crushed.clear();
      }
      if (this.onGround) {
        const lx = Math.floor((this.x - this.hw) / TS), rx = Math.floor((this.x + this.hw - 0.01) / TS);
        for (let cx = lx; cx <= rx; cx++) L.stepOn(cx, this.groundTy, 10);     // far too heavy for rickety bridges
      }
      if (L.liquidPx(this.x, this.y - 4)) {
        W.fx.splash(this.x, this.y - 4, 14); GNG.snd('splash');
        W.fx.label(this.x, this.y - 26, 'GLUB...', C.steel[5]);
        this.remove(); return;
      }
      if (this.y > L.pxH + 40) { this.remove(); return; }

      // SPRINGBOARD: land on the helmet to bounce
      if (!pl.busy && this.onGround && pl.vy > 0.8 && !pl.onLadder && Math.abs(pl.x - this.x) < 11 &&
        pl.y >= this.y - this.h - 3 && pl.y <= this.y - this.h + 11) {
        pl.vy = -7.7; pl.noCut = true; pl.jumps = 1; pl.onGround = false; pl.y = this.y - this.h - 1;
        this.squash = 10;
        GNG.snd('armor_bounce');
        W.fx.sparkleBurst(this.x, this.y - this.h, 4);
        W.hintOnce('bounce', 'BOING! YOUR ARMOR IS A SPRINGBOARD');
      }
    }
    /** monsters gnawing on the decoy */
    hit(n) {
      const W = this.w;
      if (this.dead) return;
      this.hp -= n; this.flash = 5;
      GNG.snd('clang', { vol: 0.6 });
      W.fx.spark(this.x + GNG.rnd(-5, 5), this.y - GNG.rnd(4, 18));
      if (this.hp <= 0) {
        W.fx.shatterArmor(this.x, this.y, this.skin);
        GNG.snd('armor_shatter');
        this.remove();
      }
    }
    remove() { this.dead = true; if (this.w.decoy === this) this.w.decoy = null; }
    draw(g, vx, vy) {
      const f = GNG.frames('armor_decoy_' + this.skin);
      const spr = f[this.hp <= 3 ? Math.min(1, f.length - 1) : 0];
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      if (this.flash > 0) g.drawSolid(spr, sx, sy, this.dir < 0, C.white);
      else g.draw(spr, sx, sy + (this.squash > 0 ? Math.ceil(this.squash / 3) : 0), this.dir < 0);
    }
  }
  GNG.ArmorDecoy = ArmorDecoy;

  /* ====================================================================== MECHANISMS */

  /** Is something heavy enough standing at (x, y) ? (player, possessed host, the armour decoy, big monsters) */
  function weightAt(W, x, y) {
    const pb = W.playerBox(), pl = W.player;
    if (!pl.dead && !pl.leap && Math.abs(pb.x - x) < 8 + pb.hw && Math.abs(pb.y - y) < 5 && (pl.possess ? pl.possess.host.onGround : pl.onGround)) return true;
    const d = W.decoy;
    if (d && !d.dead && d.onGround && Math.abs(d.x - x) < 13 && Math.abs(d.y - y) < 5) return true;
    for (const e of W.enemies) if (!e.dead && e.heavy && e.onGround && Math.abs(e.x - x) < 8 + e.hw && Math.abs(e.y - y) < 5) return true;
    return false;
  }

  class Plate {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y; this.pressed = false; this.target = null; this.dead = false; this.behind = true; }
    update() {
      const W = this.w, was = this.pressed;
      this.pressed = weightAt(W, this.x, this.y);
      if (this.pressed !== was) {
        GNG.snd('plate_click');
        if (this.pressed && this.target && this.target.isGate && W.decoy && Math.abs(W.decoy.x - this.x) < 13) {
          W.hintOnce('plateheld', 'THE ARMOR HOLDS THE PLATE DOWN - RUN!');
        }
      }
      if (this.target) this.target.signal(this.pressed, this);
    }
    draw(g, vx, vy) {
      const f = GNG.frames('plate');
      g.blit(f[this.pressed ? Math.min(1, f.length - 1) : 0], Math.floor(this.x) - 8 - vx, Math.floor(this.y) - f[0].h + (this.pressed ? 1 : 0) - vy);
    }
  }
  GNG.Plate = Plate;

  class Gate {
    constructor(W, x, y) {
      const L = W.level;
      this.w = W; this.x = x; this.y = y; this.dead = false; this.isGate = true; this.behind = true;
      this.tx = Math.floor(x / TS);
      const by = Math.floor((y - 1) / TS);
      this.cells = [];
      for (let ty = by; ty >= 0 && this.cells.length < 4; ty--) { if (L.solid(this.tx, ty)) break; this.cells.push(ty); }
      this.height = this.cells.length * TS;
      this.open = 0; this.hold = 0; this.pressed = false; this.blocked = false; this.moving = 0;
      this.setBlocked(true);
    }
    signal(on) { this.pressed = this.pressed || on; }
    setBlocked(b) {
      const L = this.w.level;
      if (b === this.blocked) return;
      this.blocked = b;
      for (const ty of this.cells) L.t[ty * L.w + this.tx] = b ? T.GATE : T.EMPTY;
      if (b) {       // don't trap anybody inside the bars
        const W = this.w, pl = W.player;
        if (!pl.busy && Math.abs(pl.x - this.x) < 8 + pl.hw && pl.y > this.y - this.height && pl.y - pl.h < this.y) {
          pl.x = this.x + (pl.x < this.x ? -1 : 1) * (8 + pl.hw + 0.5);
        }
      }
    }
    update() {
      const W = this.w, prev = this.open;
      if (this.pressed) { this.open = Math.min(this.height - 4, this.open + 1.7); this.hold = 22; }
      else if (this.hold > 0) this.hold--;
      else this.open = Math.max(0, this.open - 0.33);
      this.pressed = false;
      const mv = this.open > prev ? 1 : (this.open < prev ? -1 : 0);
      if (mv === 1 && this.moving !== 1 && W.onScreen(this.x, this.y, 40)) GNG.snd('gate_open');
      if (mv === 0 && this.moving === -1 && this.open === 0 && W.onScreen(this.x, this.y, 40)) { GNG.snd('gate_close'); W.shake(2, 5); W.fx.dust(this.x, this.y); }
      this.moving = mv;
      this.setBlocked(this.open < 27);
    }
    draw(g, vx, vy) {
      const spr = GNG.spr('gate0');
      const sx = Math.floor(this.x) - 8 - vx, top = Math.floor(this.y) - this.height - vy;
      g.setClip(sx, top, sx + 16, top + this.height);
      // the portcullis sprite is 48 tall: stack to cover taller openings
      for (let yy = top + this.height - spr.h - Math.floor(this.open); yy > top - spr.h; yy -= spr.h) g.blit(spr, sx, yy);
      g.resetClip();
    }
  }
  GNG.Gate = Gate;

  /** Pressure plate that pops a potion out of its niche (Prince-of-Persia style). */
  class PotionSpot {
    constructor(W, x, y, kind) { this.w = W; this.x = x; this.y = y; this.kind = kind; this.used = false; this.dead = false; this.behind = true; }
    signal(on) {
      if (!on || this.used) return;
      this.used = true;
      const W = this.w;
      W.spawnPickup(this.kind, this.x, this.y - 4);
      W.fx.sparkleBurst(this.x, this.y - 8, 6);
      GNG.snd('secret');
      W.hintOnce('potion', 'A HIDDEN POTION! RED = ARMOR, GREEN = FEATHER FALL, BLUE = ...?');
    }
    update() { }
    draw() { }
  }
  GNG.PotionSpot = PotionSpot;

  /** Prince-of-Persia chomper: two steel jaws that snap shut on a timer. */
  class Slicer {
    constructor(W, x, y) {
      this.w = W; this.x = x; this.y = y; this.dead = false;
      this.period = 112; this.off = (Math.floor(x / TS) * 41) % this.period;
      this.c = 0; this.height = 48; this.front = true;
    }
    closedness() {
      const t = (this.w.time + this.off) % this.period;
      if (t < 62) return 0;
      if (t < 66) return (t - 61) / 4;
      if (t < 80) return 1;
      return 1 - (t - 80) / (this.period - 80);
    }
    update() {
      const W = this.w, t = (W.time + this.off) % this.period;
      const prev = this.c;
      this.c = this.closedness();
      const vis = W.onScreen(this.x, this.y, 30);
      if (t === 65 && vis) { GNG.snd('slicer_chomp'); W.fx.spark(this.x, this.y - 24); }
      if (this.c > 0.55 && this.c >= prev) {
        const pl = W.player, pb = W.playerBox();
        if (Math.abs(pb.x - this.x) < 5 + pb.hw * 0.5 && pb.y > this.y - this.height && pb.y - pb.h < this.y) {
          if (pl.possess) pl.possess.host.damage(99, { kind: 'slicer', x: this.x }); else pl.hurt(this.x + (pl.x < this.x ? 6 : -6), 'slicer');
        }
        for (const e of W.enemies) {
          if (!e.dead && !e.flying && !e.possessed && !e.isBoss && Math.abs(e.x - this.x) < 5 && e.y > this.y - this.height && e.y - e.h < this.y) e.damage(20, { kind: 'slicer', x: this.x });
        }
      }
    }
    draw(g, vx, vy) {
      const top = GNG.spr('slicer_top0'), bot = GNG.spr('slicer_bot0');
      const sx = Math.floor(this.x) - 8 - vx, y0 = Math.floor(this.y) - this.height - vy;
      const retract = Math.round((1 - this.c) * 17);
      g.setClip(sx, y0, sx + 16, y0 + this.height);
      g.blit(top, sx, y0 - retract);
      g.blit(bot, sx, y0 + this.height - bot.h + retract);
      g.resetClip();
    }
  }
  GNG.Slicer = Slicer;

  /** Industrial piston crusher (ceiling mounted). */
  class Piston {
    constructor(W, x, y) {
      const L = W.level;
      this.w = W; this.x = x; this.top = y - TS; this.dead = false;
      const g = L.groundBelow(x, y + 2, 200);
      this.floor = g === null ? y + 64 : g;
      this.travel = Math.max(8, this.floor - this.top - 16);
      this.period = 156; this.off = (Math.floor(x / TS) * 53) % this.period;
      this.ext = 0; this.front = false; this.hw = 14; this.down = false;
    }
    update() {
      const W = this.w, t = (W.time + this.off) % this.period, prev = this.ext;
      if (t < 70) this.ext = 0;
      else if (t < 77) this.ext = this.travel * ((t - 69) / 7);
      else if (t < 104) this.ext = this.travel;
      else this.ext = this.travel * (1 - (t - 104) / (this.period - 104));
      const vis = W.onScreen(this.x, this.top, 60);
      if (t >= 60 && t < 70 && vis && (t & 1)) this.shakeX = (t & 2) ? 1 : -1; else this.shakeX = 0;
      if (t === 77 && vis) { GNG.snd('crusher_slam'); W.shake(3, 7); W.fx.dust(this.x - 10, this.floor); W.fx.dust(this.x + 10, this.floor); }
      if (this.ext > 5 && this.ext >= prev) {
        const hy = this.top + this.ext + 16;                 // underside of the head
        const pl = W.player, pb = W.playerBox();
        if (Math.abs(pb.x - this.x) < this.hw + pb.hw - 2 && pb.y - pb.h < hy && pb.y > hy - 18) {
          if (pl.possess) pl.possess.host.damage(99, { kind: 'crusher', x: this.x }); else pl.hurt(this.x, 'crusher');
        }
        for (const e of W.enemies) {
          if (!e.dead && !e.isBoss && !e.possessed && Math.abs(e.x - this.x) < this.hw + e.hw - 2 && e.y - e.h < hy && e.y > hy - 18) e.damage(30, { kind: 'crusher', x: this.x });
        }
        const d = W.decoy;
        if (d && !d.dead && t === 77 && Math.abs(d.x - this.x) < this.hw + 4 && d.y > hy - 20) d.hit(2);
      }
    }
    draw(g, vx, vy) {
      const head = GNG.spr('piston_head0'), shaft = GNG.spr('piston_shaft0');
      const sx = Math.floor(this.x) - vx + (this.shakeX || 0), y0 = Math.floor(this.top) - vy, e = Math.floor(this.ext);
      g.setClip(0, y0, g.w, g.h);
      for (let yy = y0 + e - shaft.h; yy > y0 - shaft.h; yy -= shaft.h) g.blit(shaft, sx - (shaft.w >> 1), yy);
      g.resetClip();
      g.blit(head, sx - (head.w >> 1), y0 + e);
    }
  }
  GNG.Piston = Piston;

  /** DOOM-style explosive nukage drum. */
  class ToxicBarrel {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y; this.hw = 6; this.h = 15; this.hp = 2; this.dead = false; this.hittable = true; this.flash = 0; this.fuse = -1; this.crushable = true; }
    update() {
      if (this.flash > 0) this.flash--;
      if (this.fuse >= 0 && --this.fuse < 0) this.explode();
    }
    collideShot(s) {
      if (!shotVsBox(s, this) || s.hits.has(this)) return false;
      s.hits.set(this, this.w.time);
      this.flash = 5; this.hp -= s.dmg;
      this.w.fx.spark(s.x, s.y);
      if (this.hp <= 0 && this.fuse < 0) this.fuse = 4; else GNG.snd('clang', { vol: 0.5 });
      s.onHit(this);
      return true;
    }
    crush() { if (this.fuse < 0) this.fuse = 1; }
    chain() { if (this.fuse < 0) this.fuse = 9; }
    explode() {
      this.dead = true;
      this.w.explosion(this.x, this.y - 8, 40, { dmg: 8, ramp: 'toxic' });
      this.w.fx.blood(this.x, this.y - 8, 'toxic', 18);
    }
    draw(g, vx, vy) {
      const f = GNG.frames('barrel_toxic'), spr = f[(this.w.time >> 4) % f.length];
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      if (this.flash > 0 || (this.fuse >= 0 && (this.fuse & 2))) g.drawSolid(spr, sx, sy, false, C.white); else g.draw(spr, sx, sy, false);
    }
  }
  GNG.ToxicBarrel = ToxicBarrel;

  /** Floppy-disk "save icon" checkpoint. */
  class Checkpoint {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y; this.on = false; this.dead = false; this.behind = true; this.t = 0; }
    update() {
      const W = this.w, pl = W.player;
      if (!this.on && !pl.busy && Math.abs(pl.x - this.x) < 14 && Math.abs(pl.y - this.y) < 40) {
        this.on = true; this.t = 0;
        W.setCheckpoint(this.x, this.y);
        GNG.snd('checkpoint');
        W.fx.label(this.x, this.y - 34, 'SAVING TO A:\\ ... OK', C.hotgreen);
        W.fx.sparkleBurst(this.x, this.y - 20, 6);
      }
      if (this.on) this.t++;
    }
    draw(g, vx, vy) {
      const f = GNG.frames('savepost');
      g.draw(f[this.on ? Math.min(1, f.length - 1) : 0], Math.floor(this.x) - vx, Math.floor(this.y) - vy, false);
      if (this.on && this.t < 60 && (this.t & 4)) g.pset(Math.floor(this.x) - vx + 3, Math.floor(this.y) - vy - 22, C.hotgreen);
    }
  }
  GNG.Checkpoint = Checkpoint;

  /** Invisible tutorial trigger. */
  class Hint {
    constructor(W, x, y, text) { this.w = W; this.x = x; this.y = y; this.text = text; this.dead = false; this.behind = true; }
    update() {
      const pl = this.w.player;
      if (Math.abs(pl.x - this.x) < 36 && Math.abs(pl.y - this.y) < 70 && !pl.dead) { this.w.hint(this.text, 260); this.dead = true; }
    }
    draw() { }
  }
  GNG.Hint = Hint;

})();
