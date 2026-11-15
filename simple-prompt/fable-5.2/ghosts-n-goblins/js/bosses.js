/*
 * bosses.js — the giant multi-part guardians of the Cursed PC Gaming Museum.
 *   monkey    THREE-HEADED MONKEY       (stage 1)  necks that lunge, coconut volleys, "LOOK BEHIND YOU!"
 *   dragon    DRAGON OF DAVENTRY        (stage 2)  segmented serpent, fire breath, low swoops
 *   vizier    THE SHADOW VIZIER         (stage 3)  teleporting sorcerer with two disembodied hands
 *   mega      MEGA-BLOCKER              (stage 4)  giant zombie lemming: stomps, floaters, OH NO! detonation
 *   aking     RED ARREMER KING          (stage 5)  the intelligent gargoyle AI (enemies.js) with a crown
 *   astaroth  ASTAROTH-LECHUCK-9000     (stage 6)  three phases: belly fire, pirate fists, HAL's laser eye
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE, C = GNG.C;
  const sign = GNG.sign, clamp = GNG.clamp, approach = GNG.approach, rnd = GNG.rnd, irnd = GNG.irnd;

  function zoneHit(s, zx, zy, hw, hh) { return Math.abs(s.x - zx) < s.hw + hw && Math.abs(s.y - zy) < s.hh + hh; }
  function boxZone(b, zx, zy, hw, hh) { return Math.abs(b.x - zx) < b.hw + hw && b.y > zy - hh && b.y - b.h < zy + hh; }

  /* ====================================================================== base */
  class Boss extends GNG.Enemy {
    constructor(W, x, y, label, hp) {
      super(W, x, y);
      this.isBoss = true; this.possessable = false; this.persistent = true; this.noDrop = true;
      this.hp = this.maxHp = hp; this.label = label; this.score = 5000; this.dying = 0; this.dir = -1;
      this.dieFrames = 120; this.shielded = false;
    }
    get arena() { return this.w.lock || [this.w.cam.x, this.w.cam.x + 320]; }
    afterMove() { }
    update() {
      if (this.dying) { this.t++; if (this.flash > 0) this.flash--; this.updateDying(); return; }
      super.update();
    }
    scale(n, src) {
      const k = src && src.kind;
      if (k === 'm_star' || k === 'flame') return 1;
      return n;
    }
    damage(n, src) {
      if (this.dead || this.dying || this.shielded) return;
      this.hp -= this.scale(n, src); this.flash = 6;
      if (this.hp <= 0) { this.hp = 0; this.startDying(); }
      else { GNG.snd('boss_hit'); this.onHurt(src); }
    }
    die() { this.startDying(); }
    startDying() {
      if (this.dying) return;
      const W = this.w;
      this.dying = 1; this.contact = false; this.noHit = true; this.hp = 0;
      for (const s of W.eshots) s.dead = true;
      GNG.musicStop(0.2); GNG.snd('boss_die');
      this.onDying();
    }
    onDying() { }
    updateDying() {
      const W = this.w;
      this.dying++;
      if ((this.dying % 7) === 0) {
        W.fx.explode(this.x + rnd(-this.hw * 1.4, this.hw * 1.4), this.y - rnd(0, this.h), false);
        GNG.snd('explode', { vol: 0.55, pitch: rnd(0.8, 1.3) }); W.shake(3, 6);
      }
      if (this.dying >= this.dieFrames) {
        this.dead = true;
        W.fx.explode(this.x, this.y - this.h * 0.5, true);
        GNG.fx.flash = Math.max(GNG.fx.flash, 0.7); GNG.snd('explode'); W.shake(6, 24);
        W.addScore(this.score, this.x, this.y - this.h);
        W.bossDefeated(this);
      }
    }
    /** shot bookkeeping shared by multi-zone bosses. Returns true when the shot may register on `key`. */
    fresh(s, key) {
      const last = s.hits.get(key);
      if (last !== undefined && (s.kind !== 'cross' || this.w.time - last < 20)) return false;
      s.hits.set(key, this.w.time);
      return true;
    }
    deflect(s) { this.w.fx.spark(s.x, s.y); GNG.snd('clang', { vol: 0.7 }); s.onBlocked(this); }
    part(g, spr, x, y, flip, white) {
      if (white || (this.flash > 0 && (this.flash & 1))) g.drawSolid(spr, x, y, flip, C.white);
      else g.draw(spr, x, y, flip);
    }
    visible() { return !this.dying || (this.dying & 2) === 0; }
    /** y of the underside of the arena ceiling (or the top of the screen when it is open sky). */
    ceilY(groundY) {
      const L = this.w.level, a = this.arena, tx = Math.floor((a[0] + a[1]) / 2 / TS);
      for (let ty = Math.floor(groundY / TS) - 1; ty >= 0; ty--) if (L.solid(tx, ty)) return Math.max(this.w.cam.y, (ty + 1) * TS);
      return this.w.cam.y;
    }
    floorY() { const gy = this.w.level.groundBelow(this.x, this.w.cam.y + 40, 240); return gy === null ? this.w.cam.y + 160 : gy; }
  }

  /* ====================================================================== 1: THREE-HEADED MONKEY */
  class Monkey extends Boss {
    constructor(W, x, y) {
      super(W, x, y, 'THREE-HEADED MONKEY', 60);
      this.hw = 24; this.h = 44; this.blood = 'red';
      const bx = [-20, 0, 20], by = [-48, -52, -48];
      this.heads = [0, 1, 2].map(i => ({ i: i, hp: 20, bx: bx[i], by: by[i], x: x, y: y - 70, mode: 'idle', t: 0, ph: i * 2.1, dead: false, flash: 0, tx: 0, ty: 0, ext: 0 }));
      this.actT = 70; this.pound = 0; this.kids = []; this.volley = -1; this.lookT = 0;
      for (const h of this.heads) this.restPos(h, h);
    }
    stump(h) { return { x: this.x + this.dir * h.bx, y: this.y + h.by }; }
    restPos(h, out) {
      const s = this.stump(h);
      out.x = s.x + this.dir * 9 + Math.sin(this.t * 0.05 + h.ph) * 5;
      out.y = s.y - 13 + Math.cos(this.t * 0.07 + h.ph) * 4;
      return out;
    }
    alive() { return this.heads.filter(h => !h.dead); }
    ai() {
      const W = this.w, tg = this.target(), live = this.alive();
      this.vx = 0; this.physics();
      if (this.pound > 0) this.pound--;
      const rest = { x: 0, y: 0 };
      for (const h of this.heads) {
        if (h.dead) continue;
        if (h.flash > 0) h.flash--;
        h.t++;
        this.restPos(h, rest);
        if (h.mode === 'idle') { h.x += (rest.x - h.x) * 0.2; h.y += (rest.y - h.y) * 0.2; }
        else if (h.mode === 'aim') {
          h.x += (rest.x + this.dir * -8 - h.x) * 0.2 + ((h.t & 2) ? 0.6 : -0.6); h.y += (rest.y - 6 - h.y) * 0.2;
          if (h.t >= 30) { h.mode = 'lunge'; h.t = 0; GNG.snd('arremer_screech', { pitch: 0.6, vol: 0.7 }); }
        } else if (h.mode === 'lunge') {
          const s = this.stump(h), dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy) || 1;
          h.x += dx / d * 5.2; h.y += dy / d * 5.2;
          if (d < 7 || Math.hypot(h.x - s.x, h.y - s.y) > 96 || h.t > 26) { h.mode = 'hold'; h.t = 0; }
        } else if (h.mode === 'hold') { if (h.t >= 12) { h.mode = 'back'; h.t = 0; } }
        else if (h.mode === 'back') {
          h.x += (rest.x - h.x) * 0.16; h.y += (rest.y - h.y) * 0.16;
          if (h.t >= 22) h.mode = 'idle';
        }
      }
      // staggered fruit volley
      if (this.volley >= 0) {
        this.volley++;
        live.forEach((h, k) => {
          if (this.volley === 10 + k * 14 && tg) {
            const g = k % 2 ? 0.11 : 0.17, Tf = 52;
            const vx = clamp((tg.x - h.x) / Tf, -3.2, 3.2), vy = clamp(((tg.y - 12) - h.y - 0.5 * g * Tf * Tf) / Tf, -6, -0.5);
            GNG.enemyShot(W, k % 2 ? 'banana' : 'coconut', h.x + this.dir * 8, h.y, vx, vy);
            h.flash = 0; h.spit = 10;
            GNG.snd('throw_axe', { vol: 0.5, pitch: 1.2 });
          }
        });
        if (this.volley > 10 + live.length * 14 + 10) this.volley = -1;
      }
      if (--this.actT <= 0 && tg && this.volley < 0) {
        const idle = live.filter(h => h.mode === 'idle');
        const r = GNG.rand();
        this.actT = irnd(60, 100) - (3 - live.length) * 16;
        if (r < 0.42 && idle.length) {
          const h = GNG.pick(idle);
          h.mode = 'aim'; h.t = 0; h.tx = tg.x; h.ty = tg.y - 12;
        } else if (r < 0.78) this.volley = 0;
        else this.doPound(tg);
      }
    }
    doPound(tg) {
      const W = this.w, L = W.level, a = this.arena;
      this.pound = 26; W.shake(4, 14); GNG.snd('heavy_land');
      W.fx.dust(this.x - 30, this.y); W.fx.dust(this.x + 30, this.y);
      for (let i = 0; i < 3; i++) GNG.enemyShot(W, 'coconut', clamp(tg.x + rnd(-70, 70), a[0] + 12, a[1] - 12), W.cam.y - 6 - i * 26, 0, 1.2, { grace: 30 });
      this.kids = this.kids.filter(k => !k.dead);
      if (this.kids.length < 2) {
        const zx = clamp(tg.x - this.dir * -54, a[0] + 16, a[1] - 16), gy = L.groundBelow(zx, tg.y - 30, 90);
        if (gy !== null && L.boxFree(zx, gy, 5, 22)) {
          const z = new GNG.Zombie(W, zx, gy, 'zbucc'); z.noDrop = true;
          this.kids.push(z); W.enemies.push(z);
          W.fx.label(this.x - 20, this.y - 96, 'LOOK BEHIND YOU!', C.gold[6]);
        }
      }
    }
    damage(n, src) {
      if (this.dead || this.dying) return;
      const h = (src && src.head) || this.alive()[0];
      if (!h) return;
      n = this.scale(n, src);
      h.hp -= n; h.flash = 6; this.flash = 3;
      this.hp = this.heads.reduce((a, b) => a + Math.max(0, b.hp), 0);
      if (h.hp <= 0) {
        h.dead = true;
        this.w.fx.explode(h.x, h.y, false); this.w.fx.bones(h.x, h.y, 4); this.w.fx.blood(h.x, h.y, 'red', 14);
        GNG.snd('explode'); this.w.shake(4, 10);
        this.w.addScore(1000, h.x, h.y - 10);
      } else GNG.snd('boss_hit');
      if (this.hp <= 0) this.startDying();
    }
    collideShot(s) {
      if (this.dying) return false;
      for (const h of this.heads) {
        if (h.dead || !zoneHit(s, h.x, h.y, 10, 10)) continue;
        if (!this.fresh(s, h)) return false;
        this.damage(s.dmg, { kind: s.kind, x: s.x, vx: s.vx, head: h });
        s.onHit(this);
        return true;
      }
      if (zoneHit(s, this.x, this.y - 22, 26, 22)) {
        if (!this.fresh(s, this)) return false;
        this.deflect(s);
        return true;
      }
      return false;
    }
    flameHit() { return false; }
    touches(b) {
      for (const h of this.heads) if (!h.dead && boxZone(b, h.x, h.y, 8, 8)) return true;
      return boxZone(b, this.x, this.y - 22, 22, 22);
    }
    draw(g, vx, vy) {
      if (!this.visible()) return;
      const flip = this.dir < 0, neck = GNG.spr('b1_neck0'), hf = GNG.frames('b1_head');
      const bx = Math.floor(this.x) - vx, by = Math.floor(this.y) - vy;
      const body = GNG.frames('b1_body');
      this.part(g, body[this.pound > 0 ? Math.min(1, body.length - 1) : 0], bx, by + (this.pound > 18 ? 2 : 0), flip);
      for (const h of this.heads) {
        const s = this.stump(h);
        if (h.dead) { g.draw(neck, s.x - vx, s.y - vy + 4, false); continue; }
        const d = Math.hypot(h.x - s.x, h.y - s.y), n = Math.max(2, Math.round(d / 6.5));
        for (let k = 0; k < n; k++) {
          const u = k / n, sag = Math.sin(u * Math.PI) * Math.min(8, d * 0.12);
          g.draw(neck, s.x + (h.x - s.x) * u - vx, s.y + (h.y - s.y) * u - vy + 5 + sag, false);
        }
        if (h.spit > 0) h.spit--;
        const fr = h.flash > 0 ? 2 : ((h.mode === 'aim' || h.mode === 'lunge' || h.mode === 'hold' || h.spit > 0) ? 1 : 0);
        const hs = hf[Math.min(fr, hf.length - 1)];
        const hx = Math.floor(h.x) - vx, hy = Math.floor(h.y) - vy + (hs.ay - (hs.h >> 1));
        if (h.flash > 0 && (h.flash & 1)) g.drawSolid(hs, hx, hy, flip, C.white); else g.draw(hs, hx, hy, flip);
      }
    }
  }

  /* ====================================================================== 2: DRAGON OF DAVENTRY */
  class Dragon extends Boss {
    constructor(W, x, y) {
      super(W, x, y, 'DRAGON OF DAVENTRY', 50);
      this.flying = true; this.hw = 13; this.h = 18; this.blood = 'green';
      this.ground = y; this.hx = x + 40; this.hy = W.cam.y + 62; this.a = 0;
      this.trail = [];
      for (let i = 0; i < 160; i++) this.trail.push([this.hx + i * 1.6, this.hy + Math.sin(i * 0.08) * 8]);
      this.setState('weave'); this.actT = 110; this.fire = 0; this.dieFrames = 130;
      this.x = this.hx; this.y = this.hy + 9;
    }
    get rage() { return this.hp <= this.maxHp * 0.5; }
    ai() {
      const W = this.w, tg = this.target(), a = this.arena, cx = (a[0] + a[1]) / 2, top = W.cam.y;
      let px, py, sp = this.rage ? 2.9 : 2.3;
      if (this.state === 'weave') {
        this.a += this.rage ? 0.026 : 0.02;
        px = cx + Math.cos(this.a) * 122; py = top + 70 + Math.sin(this.a * 2) * 34;
        if (--this.actT <= 0 && tg) {
          if (GNG.chance(0.45)) { this.setState('swoop'); this.sdir = this.hx < cx ? 1 : -1; this.phase = 0; GNG.snd('arremer_screech', { pitch: 0.5 }); }
          else if (Math.abs(tg.x - this.hx) > 50) { this.setState('breath'); this.fire = 0; }
          else this.actT = 30;
        }
      } else if (this.state === 'breath') {
        px = this.hx; py = this.hy; sp = 0.6;
        if (tg) this.dir = sign(tg.x - this.hx) || this.dir;
        const n = this.rage ? 5 : 3;
        if (this.st >= 24 && ((this.st - 24) % 12) === 0 && this.fire < n && tg) {
          const mx = this.hx + this.dir * 12, my = this.hy + 6;
          const dx = tg.x - mx, dy = (tg.y - 10) - my, d = Math.hypot(dx, dy) || 1, v = 2.6;
          const spread = (this.fire - (n - 1) / 2) * 0.13, an = Math.atan2(dy, dx) + spread;
          GNG.enemyShot(W, this.rage && this.fire === 0 ? 'bigfire' : 'fireball', mx, my, Math.cos(an) * v, Math.sin(an) * v);
          GNG.snd('fireball', { pitch: 0.8 });
          this.fire++;
        }
        if (this.st > 24 + n * 12 + 14) { this.setState('weave'); this.actT = irnd(80, 140); }
      } else {             // swoop: dive to just above the ground, rake across the arena, climb out
        const low = this.ground - 22;
        if (this.phase === 0) { px = this.sdir > 0 ? a[0] + 30 : a[1] - 30; py = low; sp = 3.2; if (Math.abs(this.hx - px) < 14 && Math.abs(this.hy - py) < 14) this.phase = 1; }
        else if (this.phase === 1) { px = this.sdir > 0 ? a[1] - 30 : a[0] + 30; py = low + Math.sin(this.st * 0.2) * 3; sp = this.rage ? 3.6 : 3.1; if (Math.abs(this.hx - px) < 16) this.phase = 2; }
        else { px = this.hx + this.sdir * 10; py = top + 60; sp = 2.6; if (this.hy < top + 76) { this.setState('weave'); this.actT = irnd(70, 120); this.a = this.hx > cx ? 0 : Math.PI; } }
        if (this.st > 260) { this.setState('weave'); this.actT = 60; }
      }
      const dx = px - this.hx, dy = py - this.hy, d = Math.hypot(dx, dy) || 1;
      this.vx = approach(this.vx, dx / d * Math.min(sp, d * 0.2), 0.16);
      this.vy = approach(this.vy, dy / d * Math.min(sp, d * 0.2), 0.16);
      this.hx = clamp(this.hx + this.vx, a[0] + 12, a[1] - 12); this.hy += this.vy;
      if (this.state !== 'breath' && Math.abs(this.vx) > 0.3) this.dir = sign(this.vx);
      this.trail.unshift([this.hx - this.dir * 12, this.hy - 1]);
      if (this.trail.length > 240) this.trail.length = 240;
      this.x = this.hx; this.y = this.hy + 9;
    }
    /** body segment positions walking back along the head's trail */
    segs() {
      const out = [], tr = this.trail, gaps = [11, 11, 11, 11, 11, 11, 9, 8, 8, 8, 9];
      let acc = 0, k = 0, need = 6;
      for (let i = 1; i < tr.length && k < gaps.length; i++) {
        acc += Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1]);
        if (acc >= need) { out.push({ x: tr[i][0], y: tr[i][1], k: k, px: tr[i - 1][0] }); need += gaps[k]; k++; }
      }
      return out;
    }
    collideShot(s) {
      if (this.dying) return false;
      if (zoneHit(s, this.hx, this.hy, 14, 9)) {
        if (!this.fresh(s, this)) return false;
        this.damage(s.dmg, s); s.onHit(this);
        return true;
      }
      for (const sg of this.segs()) {
        if (zoneHit(s, sg.x, sg.y, 6, 6)) {
          if (!this.fresh(s, this.trail)) return false;
          this.deflect(s);
          return true;
        }
      }
      return false;
    }
    flameHit(f) { return boxZone(f, this.hx, this.hy, 12, 8); }
    touches(b) {
      if (boxZone(b, this.hx, this.hy, 11, 7)) return true;
      for (const sg of this.segs()) if (sg.k < 10 && boxZone(b, sg.x, sg.y, 5, 5)) return true;
      return false;
    }
    onDying() { this.vx = 0; this.vy = 0; }
    updateDying() {
      this.hy += 0.5; this.trail.unshift([this.hx - this.dir * 12, this.hy]); this.trail.length = Math.min(this.trail.length, 240);
      this.x = this.hx; this.y = this.hy + 9;
      super.updateDying();
    }
    draw(g, vx, vy) {
      if (!this.visible()) return;
      const sg = this.segs(), s0 = GNG.spr('b2_seg0'), s1 = GNG.spr('b2_seg1'), tail = GNG.spr('b2_tail0');
      const white = this.flash > 0 && (this.flash & 1);
      for (let i = sg.length - 1; i >= 0; i--) {
        const p = sg[i], spr = i === sg.length - 1 ? tail : (p.k < 6 ? s0 : s1);
        const x = Math.floor(p.x) - vx, y = Math.floor(p.y) - vy + (spr.ay - (spr.h >> 1));
        const flip = i === sg.length - 1 ? (p.px > p.x) : this.dir < 0;
        if (white) g.drawSolid(spr, x, y, flip, C.white); else g.draw(spr, x, y, flip);
      }
      const hf = GNG.frames('b2_head');
      const fr = this.flash > 0 ? 2 : ((this.state === 'breath' && this.st > 14) || (this.state === 'swoop' && this.phase === 1) ? 1 : 0);
      const hs = hf[Math.min(fr, hf.length - 1)];
      this.part(g, hs, Math.floor(this.hx) - vx, Math.floor(this.hy) - vy + (hs.ay - (hs.h >> 1)), this.dir < 0);
    }
  }

  /* ====================================================================== 3: THE SHADOW VIZIER */
  class Vizier extends Boss {
    constructor(W, x, y) {
      super(W, x, y, 'THE SHADOW VIZIER', 46);
      this.flying = true; this.noclip = true; this.hw = 11; this.h = 40; this.blood = 'purple';
      this.ground = y; this.cx = x; this.cy = y - 62; this.fade = 0; this.hits = 0;
      this.hands = [-1, 1].map(sd => ({ side: sd, x: x + sd * 34, y: this.cy + 2, mode: 'rest', t: 0, vy: 0 }));
      this.setState('float'); this.actT = 90; this.kid = null; this.casts = 0;
      this.x = this.cx; this.y = this.cy + 22;
    }
    get rage() { return this.hp <= this.maxHp * 0.5; }
    ai() {
      const W = this.w, L = W.level, tg = this.target(), a = this.arena, pl = W.playerBox();
      const bob = Math.sin(this.t * 0.06) * 3;
      if (tg) this.dir = sign(tg.x - this.cx) || this.dir;
      if (this.state === 'float') {
        if (tg) {
          const want = clamp(tg.x - this.dir * 88, a[0] + 34, a[1] - 34);
          this.cx += clamp((want - this.cx) * 0.03, -1.3, 1.3);
          this.cy += clamp((this.ground - 66 - this.cy) * 0.05, -1, 1);
        }
        if (--this.actT <= 0 && tg) {
          const r = GNG.rand();
          if (this.rage && (!this.kid || this.kid.dead) && r < 0.22) this.setState('summon');
          else if (r < 0.55) { this.setState('cast'); this.casts = 0; }
          else if (r < 0.85) this.startSlam(tg);
          else this.setState('fadeout');
        }
      } else if (this.state === 'cast') {
        const n = this.rage ? 4 : 3;
        if (this.st >= 26 && ((this.st - 26) % 22) === 0 && this.casts < n) {
          const h = this.hands[this.casts & 1];
          GNG.enemyShot(W, 'magic', h.x, h.y, h.side * 1.4, -1.6, { homing: 0.06, maxSp: this.rage ? 2.2 : 1.9 });
          GNG.snd('magic_charge', { vol: 0.6, pitch: 1.4 });
          W.fx.sparkleBurst(h.x, h.y, 3);
          this.casts++;
        }
        if (this.st > 26 + n * 22 + 20) { this.setState('float'); this.actT = irnd(60, 110); }
      } else if (this.state === 'slam') {
        const h = this.slamHand;
        if (h.mode === 'rest') { this.setState('float'); this.actT = irnd(50, 90); }
      } else if (this.state === 'summon') {
        if (this.st === 30) {
          const zx = clamp(pl.x + (pl.x < (a[0] + a[1]) / 2 ? 90 : -90), a[0] + 20, a[1] - 20);
          const k = new GNG.Swordsman(W, zx, this.ground); k.noDrop = true;
          this.kid = k; W.enemies.push(k);
          W.fx.poof(zx, this.ground - 12); W.fx.ecto(zx, this.ground - 12, 10); GNG.snd('zombie_rise');
        }
        if (this.st > 60) { this.setState('float'); this.actT = irnd(70, 110); }
      } else if (this.state === 'fadeout') {
        this.fade = Math.min(1, this.st / 18); this.shielded = this.fade > 0.5; this.contact = !this.shielded;
        if (this.st >= 22) {
          const side = pl.x < (a[0] + a[1]) / 2 ? 1 : -1;
          this.cx = clamp(pl.x + side * rnd(80, 130), a[0] + 34, a[1] - 34); this.cy = this.ground - rnd(56, 86);
          this.setState('fadein'); GNG.snd('possess', { vol: 0.4, pitch: 1.5 });
        }
      } else if (this.state === 'fadein') {
        this.fade = Math.max(0, 1 - this.st / 18); this.shielded = this.fade > 0.5; this.contact = !this.shielded;
        if (this.st >= 20) { this.fade = 0; this.shielded = false; this.contact = true; this.setState('float'); this.actT = irnd(30, 70); this.hits = 0; }
      }
      // hands
      for (const h of this.hands) {
        h.t++;
        const rx = this.cx + h.side * 34 + Math.cos(this.t * 0.05 + h.side) * 3, ry = this.cy + 2 + Math.sin(this.t * 0.08 + h.side * 2) * 4;
        if (h.mode === 'rest') { h.x += (rx - h.x) * 0.2; h.y += (ry - h.y) * 0.2; }
        else if (h.mode === 'rise') {
          const txx = clamp(tg ? tg.x : h.x, a[0] + 10, a[1] - 10);
          h.x += clamp((txx - h.x) * 0.14, -3.6, 3.6); h.y += (this.ceilY(this.ground) + 30 - h.y) * 0.14;
          if (h.t >= 46) { h.mode = 'drop'; h.t = 0; h.vy = 1; GNG.snd('throw_axe', { pitch: 0.6 }); }
        } else if (h.mode === 'drop') {
          h.vy = Math.min(h.vy + 0.7, 8); h.y += h.vy;
          if (L.solidPx(h.x, h.y + 8) || h.y > this.ground - 8) {
            h.y = Math.min(h.y, this.ground - 8); h.mode = 'stuck'; h.t = 0;
            W.shake(4, 10); GNG.snd('heavy_land'); W.fx.dust(h.x - 8, this.ground); W.fx.dust(h.x + 8, this.ground);
            if (this.rage) for (const sd of [-1, 1]) GNG.enemyShot(W, 'fireball', h.x + sd * 8, this.ground - 6, sd * 2.3, 0);
          }
        } else if (h.mode === 'stuck') { if (h.t >= 34) { h.mode = 'back'; h.t = 0; } }
        else if (h.mode === 'back') { h.x += (rx - h.x) * 0.14; h.y += (ry - h.y) * 0.14; if (h.t >= 26) h.mode = 'rest'; }
      }
      this.x = this.cx; this.y = this.cy + 22 + bob;
    }
    startSlam(tg) {
      this.setState('slam');
      const free = this.hands.filter(h => h.mode === 'rest');
      if (!free.length) { this.setState('float'); this.actT = 30; return; }
      free.sort((p, q) => Math.abs(p.x - tg.x) - Math.abs(q.x - tg.x));
      this.slamHand = free[0]; free[0].mode = 'rise'; free[0].t = 0;
      if (this.rage && free[1]) { this.slamHand2 = free[1]; free[1].mode = 'rise'; free[1].t = -22; }
    }
    onHurt() {
      if (++this.hits >= 4 && (this.state === 'float' || this.state === 'cast')) { this.hits = 0; this.setState('fadeout'); }
    }
    collideShot(s) {
      if (this.dying || this.shielded) return false;
      for (const h of this.hands) {
        if (zoneHit(s, h.x, h.y, 7, 7)) {
          if (!this.fresh(s, h)) return false;
          if (h.mode === 'stuck') { this.damage(s.dmg, s); s.onHit(this); h.t += 6; } else this.deflect(s);
          return true;
        }
      }
      if (zoneHit(s, this.cx, this.y - 26, 11, 20)) {
        if (!this.fresh(s, this)) return false;
        this.damage(s.dmg, s); s.onHit(this);
        return true;
      }
      return false;
    }
    flameHit(f) { for (const h of this.hands) if (h.mode === 'stuck' && boxZone(f, h.x, h.y, 7, 8)) return true; return false; }
    touches(b) {
      for (const h of this.hands) if ((h.mode === 'drop' || h.mode === 'stuck') && boxZone(b, h.x, h.y, 7, 7)) return true;
      return boxZone(b, this.cx, this.y - 26, 9, 18);
    }
    draw(g, vx, vy) {
      if (!this.visible()) return;
      const bf = GNG.frames('b3_body'), hf = GNG.frames('b3_hand');
      const body = bf[(this.t >> 4) % bf.length];
      const bx = Math.floor(this.cx) - vx, by = Math.floor(this.y - 22) - vy + (body.ay - (body.h >> 1));
      const flip = this.dir < 0;
      const drawP = (spr, x, y, fl, glow) => {
        if (this.fade > 0.15) { if (this.fade < 0.95) g.drawStipple(spr, x, y, fl, this.t & 1, GNG.SPECTRAL_MAP); }
        else if (this.flash > 0 && (this.flash & 1)) g.drawSolid(spr, x, y, fl, C.white);
        else g.draw(spr, x, y, fl);
      };
      const rear = this.hands[flip ? 1 : 0], front = this.hands[flip ? 0 : 1];
      const hand = (h) => {
        const active = h.mode !== 'rest' || this.state === 'cast' || this.state === 'summon';
        const spr = hf[active ? Math.min(1, hf.length - 1) : 0];
        drawP(spr, Math.floor(h.x) - vx, Math.floor(h.y) - vy + (spr.ay - (spr.h >> 1)), h.side < 0);
        if (h.mode === 'rise' && h.t > 20 && (h.t & 2)) g.line(Math.floor(h.x) - vx, Math.floor(h.y) - vy + 10, Math.floor(h.x) - vx, Math.floor(this.ground) - vy, C.purple[4]);
      };
      hand(rear);
      drawP(body, bx, by, flip);
      hand(front);
    }
  }

  /* ====================================================================== 4: MEGA-BLOCKER */
  class MegaBlocker extends Boss {
    constructor(W, x, y) {
      super(W, x, y, 'MEGA-BLOCKER', 80);
      this.hw = 19; this.h = 56; this.blood = 'toxic'; this.heavy = true; this.grav = 0.32;
      this.setState('idle'); this.actT = 80; this.fuse = 0; this.daze = 0; this.kids = [];
      this.nextOhno = this.maxHp * 0.7;
    }
    physics() {
      this.vy = Math.min(this.vy + this.grav, 7);
      const was = this.onGround;
      this.w.level.move(this);
      this.landed = this.onGround && !was;
    }
    ai() {
      const W = this.w, tg = this.target(), a = this.arena;
      if (tg && this.state !== 'stomp') this.dir = sign(tg.x - this.x) || this.dir;
      if (this.state === 'idle') {
        this.vx = tg && Math.abs(tg.x - this.x) > 46 ? this.dir * 0.34 : 0;
        if (this.hp <= this.nextOhno) { this.nextOhno -= this.maxHp * 0.3; this.startOhno(); }
        else if (--this.actT <= 0 && tg) {
          const r = GNG.rand();
          if (r < 0.5) { this.setState('stomp'); this.vy = -6.2; this.vx = clamp((tg.x - this.x) / 46, -1.7, 1.7); this.onGround = false; GNG.snd('jump', { pitch: 0.5 }); }
          else if (r < 0.8) this.setState('spawn');
          else this.startOhno();
        }
      } else if (this.state === 'stomp') {
        if (this.landed) {
          this.vx = 0; W.shake(6, 16); GNG.snd('crusher_slam');
          W.fx.dust(this.x - 24, this.y); W.fx.dust(this.x + 24, this.y);
          for (const sd of [-1, 1]) GNG.enemyShot(W, 'fireball', this.x + sd * 22, this.y - 6, sd * 2.4, 0);
          this.kids = this.kids.filter(k => !k.dead);
          for (let i = 0; i < 2 && this.kids.length < 4; i++) {
            const l = new GNG.Lemming(W, clamp((tg ? tg.x : this.x) + rnd(-80, 80), a[0] + 12, a[1] - 12), W.cam.y + 18 + i * 10, 'float', -1);
            l.noDrop = true; this.kids.push(l); W.enemies.push(l);
          }
          this.setState('idle'); this.actT = irnd(70, 110);
        }
      } else if (this.state === 'spawn') {
        this.vx = 0;
        if (this.st === 20 || this.st === 44) {
          this.kids = this.kids.filter(k => !k.dead);
          if (this.kids.length < 4) {
            const l = new GNG.Lemming(W, this.x + this.dir * 24, this.y, 'walk', this.dir);
            l.bomber = true; l.noDrop = true; this.kids.push(l); W.enemies.push(l);
            W.fx.poof(l.x, l.y - 6); GNG.snd('zombie_rise', { pitch: 1.6 });
          }
        }
        if (this.st > 64) { this.setState('idle'); this.actT = irnd(60, 100); }
      } else if (this.state === 'ohno') {
        this.vx = 0;
        if (this.st === 1) GNG.snd('ohno', { pitch: 0.6 });
        if (this.st % 30 === 0 && this.st < 150) GNG.snd('time_warning');
        if (this.st >= 150) {
          W.explosion(this.x, this.y - 28, 84, { dmg: 8, source: this, ramp: 'toxic' });
          for (let i = 0; i < 4; i++) W.fx.explode(this.x + rnd(-50, 50), this.y - rnd(0, 60), false);
          this.setState('dazed'); this.daze = 120;
        }
      } else if (this.state === 'dazed') {
        this.vx = 0;
        if (--this.daze <= 0) { this.setState('idle'); this.actT = 50; }
      }
      this.physics();
      this.x = clamp(this.x, a[0] + 24, a[1] - 24);
    }
    startOhno() { this.setState('ohno'); this.w.fx.label(this.x, this.y - 86, 'OH NO!', C.hotyellow); }
    scale(n, src) {
      n = super.scale(n, src);
      if (src && src.kind === 'anvil') n = 10;
      return this.state === 'dazed' ? Math.ceil(n * 1.5) : n;
    }
    touches(b) { return boxZone(b, this.x, this.y - 28, 17, 27); }
    draw(g, vx, vy) {
      if (!this.visible()) return;
      let spr;
      if (this.state === 'ohno') { const f = GNG.frames('b4_ohno'); spr = f[(this.t >> 2) % f.length]; }
      else if (this.state === 'dazed' || this.flash > 3) spr = GNG.spr('b4_hurt0');
      else if (this.state === 'stomp') spr = GNG.spr('b4_stomp0');
      else { const f = GNG.frames('b4_body'); spr = f[(this.t >> 4) % f.length]; }
      const sx = Math.floor(this.x) - vx + (this.state === 'ohno' ? ((this.t & 2) ? 1 : -1) : 0), sy = Math.floor(this.y) - vy;
      this.part(g, spr, sx, sy, false);
      if (this.state === 'ohno') GNG.text(g, String(Math.max(1, 5 - Math.floor(this.st / 30))), sx, sy - 82, C.white, { align: 'center', outline: C.black, scale: 2 });
      if (this.state === 'dazed' && (this.t & 8)) GNG.text(g, '* * *', sx, sy - 74, C.hotyellow, { align: 'center', outline: C.black });
    }
  }

  /* ====================================================================== 6: ASTAROTH-LECHUCK-9000 */
  const QUOTES = ["I'M SORRY, ARTHUR.", "I'M AFRAID I CAN'T DO THAT.", 'THIS MISSION IS TOO IMPORTANT.', 'LOOK ARTHUR, I CAN SEE YOU ARE UPSET.'];
  class Astaroth extends Boss {
    constructor(W, x, y) {
      super(W, x, y, 'ASTAROTH-LECHUCK-9000', 150);
      this.hw = 34; this.h = 100; this.blood = 'purple'; this.score = 20000; this.dieFrames = 230;
      this.phase = 1; this.setState('idle'); this.actT = 80;
      this.belly = 0; this.roar = 0; this.arm = [0, 0]; this.eye = 0; this.laser = null; this.kids = []; this.quote = 0;
      this.x = Math.min(x, this.arena[1] - 62);
    }
    zone(n) {
      const x = this.x, y = this.y;
      if (n === 'head') return [x, y - 92, 15, 17];
      if (n === 'eye') return [x, y - 62, 7, 7];
      if (n === 'belly') return [x, y - 36, 15, 13];
      return [x, y - 46, 34, 46];
    }
    ai() {
      const W = this.w, tg = this.target(), a = this.arena, gy = this.y;
      const ph = this.hp > this.maxHp * 0.66 ? 1 : (this.hp > this.maxHp * 0.33 ? 2 : 3);
      if (ph !== this.phase) {
        this.phase = ph; this.setState('shift'); this.laser = null;
        GNG.fx.flash = Math.max(GNG.fx.flash, 0.5); W.shake(6, 30); GNG.snd('boss_warning');
        W.hint(ph === 2 ? 'PHASE 2: THE GHOST PIRATE AWAKENS - JUMP THE SHOCKWAVES, POSSESS HIS SKULLS!' : "PHASE 3: HAL-9000 ONLINE - THE RED EYE IS OPEN. AIM FOR IT!", 240);
      }
      if (this.belly > 0) this.belly--;
      if (this.roar > 0) this.roar--;
      for (let i = 0; i < 2; i++) if (this.arm[i] > 0) this.arm[i]--;
      this.eye = this.phase === 3 ? (this.laser ? 2 : 1) : 0;

      if (this.state === 'shift') { if (this.st > 70) { this.setState('idle'); this.actT = 30; } }
      else if (this.state === 'idle') {
        if (--this.actT <= 0 && tg) {
          const r = GNG.rand();
          if (this.phase === 1) this.setState(r < 0.6 ? 'spit' : 'rain');
          else if (this.phase === 2) this.setState(r < 0.4 ? 'slam' : (r < 0.65 ? 'spit' : (r < 0.85 ? 'skulls' : 'rain')));
          else this.setState(r < 0.5 ? 'laser' : (r < 0.7 ? 'slam' : (r < 0.88 ? 'spit' : 'rain')));
        }
      } else if (this.state === 'spit') {
        this.belly = 6;
        const n = this.phase === 1 ? 3 : 4;
        if (this.st >= 34 && ((this.st - 34) % 16) === 0 && (this.st - 34) / 16 < n && tg) {
          const k = (this.st - 34) / 16, bx = this.x - 14, by = gy - 36;
          if (k % 2 === 0) {
            const dx = tg.x - bx, dy = (tg.y - 12) - by, d = Math.hypot(dx, dy) || 1;
            GNG.enemyShot(W, 'bigfire', bx, by, dx / d * 2.6, dy / d * 2.6);
          } else GNG.enemyShot(W, 'fireball', bx, gy - 6, -2.5, 0);
          GNG.snd('fireball', { pitch: 0.7 });
        }
        if (this.st > 34 + n * 16 + 24) this.rest();
      } else if (this.state === 'rain') {
        this.roar = 6;
        if (this.st === 10) GNG.snd('arremer_screech', { pitch: 0.4 });
        const n = 4 + this.phase;
        if (this.st >= 30 && ((this.st - 30) % 12) === 0 && (this.st - 30) / 12 < n) {
          const fx = clamp((tg ? tg.x : this.x - 120) + rnd(-90, 90), a[0] + 10, this.x - 44);
          GNG.enemyShot(W, 'fireball', fx, W.cam.y - 4, rnd(-0.3, 0.3), 2.1, { grace: 20 });
          W.fx.px(fx, W.cam.y + 6, 0, 1, C.ember[6], 20, 0);
        }
        if (this.st > 30 + n * 12 + 30) this.rest();
      } else if (this.state === 'slam') {
        const i = 0;
        if (this.st < 46) this.arm[i] = 8;
        if (this.st === 46) {
          const sx = this.x - 62;
          W.shake(6, 16); GNG.snd('crusher_slam'); W.fx.dust(sx - 10, gy); W.fx.dust(sx + 10, gy); W.fx.explode(sx, gy - 8, false);
          GNG.enemyShot(W, 'bigfire', sx - 10, gy - 8, -2.5, 0);
          if (this.phase === 3) GNG.enemyShot(W, 'fireball', sx - 10, gy - 30, -2.0, 0);
          if (tg && Math.abs(tg.x - sx) < 26 && Math.abs(tg.y - gy) < 30) W.explosion(sx, gy - 10, 24, { dmg: 0, source: this });
        }
        if (this.st > 80) this.rest();
      } else if (this.state === 'skulls') {
        this.roar = 6; this.arm[1] = 8;
        if (this.st === 30 || this.st === 50) {
          this.kids = this.kids.filter(k => !k.dead);
          if (this.kids.length < 2) {
            const k = new GNG.VoodooSkull(W, this.x - 30, gy - 96 + this.kids.length * 20); k.noDrop = true;
            this.kids.push(k); W.enemies.push(k);
            W.fx.poof(k.x, k.y); GNG.snd('possess', { vol: 0.4, pitch: 0.7 });
          }
        }
        if (this.st > 76) this.rest();
      } else if (this.state === 'laser') {
        // 0-50 charge (dotted aiming line) | 50-140 the beam sweeps along the floor toward the throne
        const ex = this.x - 4, ey = gy - 62, x0 = a[0] + 6, x1 = this.x - 52;
        if (this.st === 1) { W.fx.label(this.x - 30, gy - 122, QUOTES[this.quote++ % QUOTES.length], C.hotred); GNG.snd('magic_charge', { pitch: 0.6 }); }
        const k = clamp((this.st - 50) / 90, 0, 1);
        const sweepIn = (this.quote & 1) === 1;
        const lx = sweepIn ? x0 + (x1 - x0) * k : x1 - (x1 - x0) * k;
        this.laser = { ex: ex, ey: ey, x: lx, y: gy - 1, hot: this.st >= 50 };
        if (this.st === 50) GNG.snd('laser', { pitch: 0.5 });
        if (this.st >= 50) {
          if ((this.st & 3) === 0) { GNG.snd('laser', { vol: 0.25, pitch: 0.4 + k * 0.4 }); W.fx.embers(lx, gy - 2, 2); }
          const pb = W.playerBox(), px = pb.x, py = pb.y - pb.h * 0.5;
          const vx = lx - ex, vy = gy - ey, tt = clamp(((px - ex) * vx + (py - ey) * vy) / (vx * vx + vy * vy), 0, 1);
          if (Math.hypot(ex + vx * tt - px, ey + vy * tt - py) < 5 + pb.hw * 0.6) {
            if (W.player.possess) W.hurtHost(W.player.possess.host, 2, this); else W.player.hurt(lx + 8, 'laser');
          }
          const d = W.decoy;
          if (d && !d.dead && Math.abs(d.x - lx) < 8 && (this.st % 10) === 0) d.hit(1);
        }
        if (this.st > 150) { this.laser = null; this.rest(); }
      }
      this.physics();
    }
    rest() { this.setState('idle'); this.actT = irnd(46, 84) - this.phase * 8; }
    physics() { this.vx = 0; this.vy = Math.min(this.vy + 0.3, 7); this.w.level.move(this); }
    scale(n, src) {
      n = super.scale(n, src);
      if (src && src.kind === 'anvil') n = 12;
      return n;
    }
    collideShot(s) {
      if (this.dying) return false;
      const zh = this.zone('head'), ze = this.zone('eye'), zb = this.zone('belly'), zc = this.zone('body');
      const eyeOpen = this.phase === 3, bellyOpen = this.belly > 0;
      if (zoneHit(s, zh[0], zh[1], zh[2], zh[3])) {
        if (!this.fresh(s, this)) return false;
        this.damage(s.dmg, s); s.onHit(this);
        return true;
      }
      if (eyeOpen && zoneHit(s, ze[0], ze[1], ze[2] + 3, ze[3] + 3)) {
        if (!this.fresh(s, this)) return false;
        this.damage(s.dmg * 2, s); s.onHit(this);
        this.w.fx.sparkleBurst(ze[0], ze[1], 3);
        return true;
      }
      if (bellyOpen && zoneHit(s, zb[0], zb[1], zb[2], zb[3])) {
        if (!this.fresh(s, this)) return false;
        this.damage(s.dmg + 1, s); s.onHit(this);
        this.w.fx.blood(zb[0] - 10, zb[1], 'purple', 6);
        return true;
      }
      // a shot flying at the height of an OPEN weak point slips past the armoured hide to reach it
      if (bellyOpen && Math.abs(s.y - zb[1]) < zb[3] + s.hh) return false;
      if (eyeOpen && Math.abs(s.y - ze[1]) < ze[3] + 3 + s.hh) return false;
      if (zoneHit(s, zc[0], zc[1], zc[2] - 4, zc[3])) {
        if (!this.fresh(s, this.kids)) return false;
        this.deflect(s);
        return true;
      }
      return false;
    }
    flameHit() { return false; }
    touches(b) { const z = this.zone('body'); return boxZone(b, z[0], z[1], z[2] - 6, z[3]); }
    onDying() { this.laser = null; this.w.fx.label(this.x - 30, this.y - 122, 'DAISY... DAISY...', C.hotred); for (const k of this.kids) if (!k.dead && !k.possessed) k.die(null); }
    draw(g, vx, vy) {
      if (!this.visible()) return;
      const X = Math.floor(this.x) - vx, Y = Math.floor(this.y) - vy, t = this.t;
      const breathe = Math.round(Math.sin(t * 0.05) * 1.2), shiver = this.state === 'shift' ? ((t & 2) ? 1 : -1) : 0;
      const wing = GNG.spr('b6_wing0'), af = GNG.frames('b6_arm'), bf = GNG.frames('b6_body');
      const flap = Math.round(Math.sin(t * 0.07) * 3);
      this.part(g, wing, X + 34 + shiver, Y - 74 + flap, false);
      this.part(g, wing, X - 34 + shiver, Y - 74 + flap, true);
      this.part(g, bf[(t >> 5) % bf.length], X + shiver, Y, false);
      // arm[0] = the one nearer the player (screen left), arm[1] = far side
      const a0 = af[this.arm[0] > 0 ? Math.min(1, af.length - 1) : 0], a1 = af[this.arm[1] > 0 ? Math.min(1, af.length - 1) : 0];
      const slam = this.state === 'slam' && this.st >= 46 && this.st < 62 ? 10 : 0;
      this.part(g, a1, X + 40 + shiver, Y - 78 + breathe, false);
      this.part(g, a0, X - 40 + shiver, Y - 78 + breathe + slam, true);
      const belly = GNG.frames('b6_belly'), bs = belly[this.belly > 0 ? Math.min(1, belly.length - 1) : 0];
      this.part(g, bs, X + shiver, Y - 36 + (bs.ay - (bs.h >> 1)), false);
      const eyes = GNG.frames('b6_eye'), es = eyes[Math.min(this.eye, eyes.length - 1)];
      this.part(g, es, X + shiver, Y - 62 + (es.ay - (es.h >> 1)), false);
      const heads = GNG.frames('b6_head');
      const hs = heads[this.flash > 0 ? Math.min(2, heads.length - 1) : (this.roar > 0 || this.state === 'shift' ? Math.min(1, heads.length - 1) : 0)];
      this.part(g, hs, X + shiver, Y - 92 + breathe + (hs.ay - (hs.h >> 1)), false);
      // HAL's laser
      const lz = this.laser;
      if (lz) {
        const x0 = Math.floor(lz.ex) - vx, y0 = Math.floor(lz.ey) - vy, x1 = Math.floor(lz.x) - vx, y1 = Math.floor(lz.y) - vy;
        if (!lz.hot) {
          const n = 14;
          for (let i = (t >> 1) & 1; i < n; i += 2) g.pset(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, C.hotred);
        } else {
          g.line(x0, y0 - 1, x1, y1 - 1, C.hotred); g.line(x0, y0 + 1, x1, y1 + 1, C.hotred);
          g.line(x0 - 1, y0, x1 - 1, y1, C.red[5]); g.line(x0 + 1, y0, x1 + 1, y1, C.red[5]);
          g.line(x0, y0, x1, y1, (t & 1) ? C.white : C.hotyellow);
          g.disc(x1, y1, 3 + (t & 1), C.hotyellow); g.disc(x1, y1, 1, C.white);
        }
      }
    }
  }

  /* ====================================================================== factory */
  GNG.makeBoss = function (W, kind, x, y) {
    switch (kind) {
      case 'monkey': return new Monkey(W, x, y);
      case 'dragon': return new Dragon(W, x, y);
      case 'vizier': return new Vizier(W, x, y);
      case 'mega': return new MegaBlocker(W, x, y);
      case 'astaroth': return new Astaroth(W, x, y);
      default: {
        const k = new GNG.Arremer(W, x, y, 'aking');
        k.hw = 11; k.h = 30; k.noDrop = true; k.hp = k.maxHp = 40;
        return k;
      }
    }
  };
  GNG.Boss = Boss;
})();
