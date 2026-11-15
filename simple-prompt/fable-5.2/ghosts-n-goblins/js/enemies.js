/*
 * enemies.js — the undead bestiary and its reactive AI, plus what each monster can do
 * while Arthur's soul is POSSESSING it.
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE, T = GNG.T, C = GNG.C;
  const sign = GNG.sign, clamp = GNG.clamp, approach = GNG.approach;

  /* ====================================================================== base class */
  class Enemy {
    constructor(W, x, y) {
      this.w = W; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.hw = 6; this.h = 22; this.dir = -1;
      this.hp = 1; this.t = 0; this.st = 0; this.state = 'idle';
      this.flash = 0; this.dead = false; this.contact = true;
      this.possessable = true; this.possessed = false;
      this.flying = false; this.grav = 0.3; this.onGround = false; this.groundType = 0;
      this.score = 100; this.blood = 'teal'; this.label = 'MONSTER';
      this.stun = 0; this.spawn = null; this.heavy = false; this.isBoss = false;
      this.burnT = 0; this.cool = 0; this.noHit = false; this.persistent = false;
      this.ctrlSpeed = 1.2; this.ctrlJump = 4.4; this.gnawT = 0;
    }
    setState(s) { this.state = s; this.st = 0; }
    target() { return this.w.targetFor(this); }

    update() {
      this.t++; this.st++;
      if (this.flash > 0) this.flash--;
      if (this.burnT > 0) this.burnT--;
      if (this.cool > 0) this.cool--;
      if (this.stun > 0) { this.stun--; if (!this.flying) { this.vx = 0; this.physics(); } this.afterMove(); return; }
      if (this.possessed) this.control(GNG.Input); else this.ai();
      this.afterMove();
    }
    ai() { this.physics(); }

    physics() {
      this.vy = Math.min(this.vy + this.grav, 7);
      const own = this.vx, wasGround = this.onGround;
      if (this.onGround) {
        if (this.groundType === T.CONV_L) this.vx -= 0.8; else if (this.groundType === T.CONV_R) this.vx += 0.8;
      }
      this.w.level.move(this);
      this.vx = own;
      if (this.onGround && !wasGround && this.heavy && this.possessed && (this.landVy || 0) > 3) {
        const L = this.w.level;
        const lx = Math.floor((this.x - this.hw) / TS), rx = Math.floor((this.x + this.hw - 0.01) / TS);
        for (let cx = lx; cx <= rx; cx++) L.smash(cx, this.groundTy);
        this.w.shake(2, 6); GNG.snd('heavy_land');
      }
      if (this.onGround && (this.possessed || this.heavy)) {
        const L = this.w.level, cx = Math.floor(this.x / TS);
        L.stepOn(cx, this.groundTy, this.heavy ? 14 : 40);
      }
    }

    afterMove() {
      const W = this.w, L = W.level;
      if (this.dead) return;
      if (this.y > L.pxH + 44) { this.pitDeath = true; this.remove(); return; }
      if (!this.flying && !this.amphibious && L.liquidPx(this.x, this.y - 3)) {
        W.fx.splash(this.x, this.y - 2, 8);
        if (W.onScreen(this.x, this.y, 0)) GNG.snd('splash', { vol: 0.5 });
        this.pitDeath = true; this.noScore = true;
        this.die({ kind: 'liquid' });
        return;
      }
      if (this.possessed) {
        if (!this.flying && !this.burrowed && (L.spikePx(this.x, this.y - 1))) this.damage(99, { kind: 'spikes' });
        if (W.lock) this.x = clamp(this.x, W.lock[0] + 8, W.lock[1] - 8);
      }
    }

    /* ---- default possession controls: a walker that can hop ---- */
    control(inp) {
      const ix = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
      this.vx = ix * this.ctrlSpeed;
      if (ix) this.dir = ix;
      if (inp.pressed('jump') && this.onGround) { this.vy = -this.ctrlJump; GNG.snd('jump', { pitch: 0.8 }); }
      if (inp.down('attack') && this.cool <= 0) this.hostAttack(inp);
      this.moving = ix !== 0;
      this.physics();
    }
    controlFly(inp, speed) {
      const ix = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
      const iy = (inp.down('down') ? 1 : 0) - ((inp.down('up') || inp.down('jump')) ? 1 : 0);
      this.vx = approach(this.vx, ix * speed, 0.22); this.vy = approach(this.vy, iy * speed, 0.22);
      if (ix) this.dir = ix;
      if (inp.down('attack') && this.cool <= 0) this.hostAttack(inp);
      this.w.level.move(this);
      this.moving = true;
    }
    hostAttack() { }
    onPossess() {
      this.possessed = true; this.stun = 0; this.vx = 0; this.contact = false;
      this.hp = Math.max(this.hp, 3); this.setState('possessed'); this.cool = 10;
    }
    /** the soul bursts out: host is destroyed */
    burst() {
      const W = this.w;
      if (this.dead) return;
      this.dead = true;
      W.fx.ecto(this.x, this.y - this.h * 0.5, 14);
      W.fx.poof(this.x, this.y - this.h * 0.5);
      if (this.spawn) this.spawn.killed = true;
      W.addScore(this.score, this.x, this.y - this.h);
    }

    /* ---- combat ---- */
    onShot() { return 'hit'; }
    /** friendly shot vs this monster. Returns true if the shot connected (hit or blocked). */
    collideShot(s) {
      if (this.noHit) return false;
      if (!GNG.shotVsBox(s, this)) return false;
      const last = s.hits.get(this);
      if (last !== undefined && (s.kind !== 'cross' || this.w.time - last < 20)) return false;
      const r = this.onShot(s);
      if (r === 'pass') return false;
      if (r === 'block' && !s.shieldPierce) {
        this.w.fx.spark(s.x, s.y); GNG.snd('clang');
        s.hits.set(this, this.w.time);
        s.onBlocked(this);
        return true;
      }
      s.hits.set(this, this.w.time);
      this.damage(s.dmg, s);
      s.onHit(this);
      return true;
    }
    damage(n, src) {
      if (this.dead || this.burrowed) return;
      this.hp -= n; this.flash = 6;
      if (this.hp <= 0) this.die(src);
      else { GNG.snd('hit'); this.onHurt(src); }
    }
    onHurt() { }
    die(src) {
      if (this.dead) return;
      this.dead = true;
      const W = this.w;
      this.deathFx(src);
      if (this.spawn) this.spawn.killed = true;
      if (!this.noScore) { W.addScore(this.score, this.x, this.y - this.h); W.onEnemyKilled(this, src); }
    }
    deathFx() {
      const W = this.w;
      W.fx.poof(this.x, this.y - this.h * 0.5);
      if (this.blood === 'teal') W.fx.ecto(this.x, this.y - this.h * 0.5, 10);
      else if (this.blood) W.fx.blood(this.x, this.y - this.h * 0.5, this.blood, 12);
      GNG.snd('enemy_die');
    }
    /** vanish without fanfare (sank, walked off, despawned) */
    remove() { this.dead = true; this.removed = true; }

    /** gnaw / bash the armour decoy when adjacent */
    attackDecoy(tg, range, every, dmg) {
      if (!tg || !tg.isDecoy) return false;
      if (Math.abs(tg.x - this.x) < range && Math.abs(tg.y - this.y) < 26) {
        if (++this.gnawT >= every) { this.gnawT = 0; tg.hit(dmg || 1); }
        return true;
      }
      return false;
    }
    /** is a horizontal friendly shot about to hit me? */
    incomingShot(rangeX, rangeY) {
      const shots = this.w.shots, cy = this.y - this.h * 0.5;
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        if (s.dead || s.kind === 'melee' || Math.abs(s.vx) <= Math.abs(s.vy)) continue;
        if ((this.x - s.x) * s.vx <= 0) continue;
        if (Math.abs(s.x - this.x) < rangeX && Math.abs(s.y - cy) < rangeY + this.h * 0.5) return s;
      }
      return null;
    }

    /* ---- drawing ---- */
    drawSpr(g, vx, vy, spr, opts) {
      const sx = Math.floor(this.x) - vx + ((opts && opts.dx) || 0), sy = Math.floor(this.y) - vy + ((opts && opts.dy) || 0);
      const flip = (opts && opts.flip !== undefined) ? opts.flip : this.dir < 0;
      if (this.possessed) {                       // soul aura
        const c = C.teal[5 + ((this.w.time >> 2) & 1)];
        g.drawSolid(spr, sx - 1, sy, flip, c); g.drawSolid(spr, sx + 1, sy, flip, c);
        g.drawSolid(spr, sx, sy - 1, flip, c); g.drawSolid(spr, sx, sy + 1, flip, c);
      }
      if (this.flash > 0 && (this.flash & 1)) g.drawSolid(spr, sx, sy, flip, C.white);
      else if (opts && opts.stipple) g.drawStipple(spr, sx, sy, flip, opts.phase | 0, opts.table);
      else if (opts && opts.table) g.drawMap(spr, sx, sy, flip, opts.table);
      else g.draw(spr, sx, sy, flip);
    }
    draw(g, vx, vy) { this.drawSpr(g, vx, vy, GNG.spr('?')); }
  }
  GNG.Enemy = Enemy;

  /* ====================================================================== ZOMBIE (rises from the ground) */
  class Zombie extends Enemy {
    constructor(W, x, y, variant) {
      super(W, x, y);
      this.pre = variant || 'zombie';
      this.hw = 5; this.h = 8; this.fullH = 22;
      this.hp = this.pre === 'zombie' ? 1 : 2;
      this.score = this.pre === 'zombie' ? 100 : 200;
      this.label = this.pre === 'zbucc' ? 'ZOMBIE BUCCANEER' : (this.pre === 'zmarine' ? 'ZOMBIE MARINE' : 'ZOMBIE');
      this.possessHint = 'ZOMBIE: [DOWN] BURROWS UNDER GATES & TRAPS, [ATTACK] SPITS ACID';
      this.speed = 0.42; this.life = 60 * 12; this.ctrlSpeed = 0.95; this.ctrlJump = 3.6;
      this.setState('rise');
      const tg = this.target();
      this.dir = tg ? (sign(tg.x - x) || 1) : -1;
      if (W.onScreen(x, y, 0)) GNG.snd('zombie_rise', { vol: 0.6 });
      for (let i = 0; i < 4; i++) W.fx.px(x + GNG.rnd(-5, 5), y - 1, GNG.rnd(-0.8, 0.8), GNG.rnd(-1.8, -0.5), C.brown[3], 20, 0.15);
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.state === 'rise') {
        this.vx = 0;
        this.h = 6 + Math.floor(16 * Math.min(1, this.st / 44));
        if (this.st >= 46) { this.h = this.fullH; this.setState('walk'); if (tg) this.dir = sign(tg.x - this.x) || this.dir; }
      } else if (this.state === 'walk') {
        if (tg && (this.st % 64) === 1 && GNG.chance(0.85)) this.dir = sign(tg.x - this.x) || this.dir;
        const sp = this.speed * (W.player.mode === 'boxers' && !W.player.busy ? 1.4 : 1);   // they smell exposed flesh
        this.vx = this.dir * sp;
        if (this.attackDecoy(tg, 13, 36, 1)) this.vx = 0;
        else if (this.onGround && (L.wallAhead(this, 2) || !L.floorAhead(this, 3))) { this.dir = -this.dir; this.vx = 0; }
        if (this.pre === 'zmarine' && tg && !tg.isDecoy && this.cool <= 0 && Math.abs(tg.x - this.x) < 150 && Math.abs(tg.y - this.y) < 22 && sign(tg.x - this.x) === this.dir) {
          this.setState('shoot');
        }
        if (this.t > this.life) this.setState('sink');
      } else if (this.state === 'shoot') {
        this.vx = 0;
        if (this.st === 16) { GNG.enemyShot(W, 'bolt', this.x + this.dir * 8, this.y - 15, this.dir * 3, 0); GNG.snd('laser', { vol: 0.5 }); }
        if (this.st >= 34) { this.setState('walk'); this.cool = GNG.irnd(90, 150); }
      } else if (this.state === 'sink') {
        this.vx = 0; this.contact = false;
        this.h = Math.max(4, this.fullH - Math.floor(this.st / 2));
        if (this.st >= 38) { this.remove(); return; }
      }
      this.physics();
    }
    onPossess() { super.onPossess(); this.h = this.fullH; this.burrowed = false; }
    control(inp) {
      const W = this.w, L = W.level;
      const ix = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
      const wantBurrow = inp.down('down') && this.onGround;
      if (!this.burrowed && wantBurrow) { this.burrowed = true; GNG.snd('zombie_rise', { vol: 0.5 }); }
      if (this.burrowed) {
        // tunnel along the floor: walls, gates and traps above ground don't matter down here
        this.vx = 0; this.vy = 0;
        if (ix) {
          this.dir = ix;
          const nx = this.x + ix * 1.5;
          if (L.solidPx(nx + ix * 4, this.y + 3) && L.solidPx(nx - ix * 4, this.y + 3) && nx > 8 && nx < L.pxW - 8) this.x = nx;
          if ((this.t & 3) === 0) W.fx.px(this.x + GNG.rnd(-6, 6), this.y - 1, GNG.rnd(-0.6, 0.6), GNG.rnd(-1.6, -0.4), C.brown[3 + (this.t & 1)], 16, 0.15);
        }
        if (!inp.down('down') && L.boxFree(this.x, this.y, this.hw, this.fullH)) { this.burrowed = false; GNG.snd('zombie_rise', { vol: 0.4 }); }
        this.moving = !!ix;
        return;
      }
      super.control(inp);
    }
    hostAttack(inp) {
      this.cool = 22; this.spitT = 10;
      const up = inp.down('up');
      GNG.hostShot(this.w, 'h_acid', this.x + this.dir * 6, this.y - 17, this.dir * (up ? 1.6 : 3.3), up ? -4.6 : -2.4);
      GNG.snd('acid_spit');
    }
    deathFx(src) {
      const W = this.w;
      W.fx.ecto(this.x, this.y - 10, 12);
      W.fx.bones(this.x, this.y - 8, 2);
      W.fx.poof(this.x, this.y - 10);
      GNG.snd('zombie_die');
    }
    draw(g, vx, vy) {
      const pre = this.pre + '_';
      let spr;
      if (this.burrowed) { const f = GNG.frames('zombie_burrow'); spr = f[(this.t >> 3) % f.length]; this.drawSpr(g, vx, vy, spr); return; }
      if (this.state === 'rise' || this.state === 'sink') {
        const f = GNG.frames(pre + 'rise');
        const k = this.state === 'rise' ? this.st / 46 : 1 - this.st / 38;
        spr = f[clamp(Math.floor(k * f.length), 0, f.length - 1)];
      } else if (this.state === 'shoot' || this.spitT > 0) {
        if (this.spitT > 0) this.spitT--;
        spr = GNG.frames(pre + 'spit')[0];
      } else {
        const f = GNG.frames(pre + 'walk');
        spr = f[(this.possessed && !this.moving) ? 0 : (this.t >> 3) % f.length];
      }
      this.drawSpr(g, vx, vy, spr);
    }
  }
  GNG.Zombie = Zombie;

  /** Endless graveyard: zombies keep clawing out of the ground near the player. */
  class ZombieZone {
    constructor(W, x, y, variant, max) {
      this.w = W; this.x = x; this.y = y; this.variant = variant; this.max = max || 3;
      this.timer = 50; this.kids = []; this.dead = false; this.behind = true;
    }
    update() {
      const W = this.w, L = W.level, pl = W.player;
      if (pl.dead || pl.leap || W.frozen || W.lock) return;
      const pb = W.playerBox();
      if (Math.abs(pb.x - this.x) > 176) return;
      if (--this.timer > 0) return;
      this.timer = GNG.irnd(64, 150);
      this.kids = this.kids.filter(k => !k.dead);
      if (this.kids.length >= this.max) return;
      const ahead = GNG.chance(0.68) ? pl.dir : -pl.dir;
      const px = clamp(pb.x + ahead * GNG.rnd(44, 118), this.x - 200, this.x + 200);
      const gy = L.groundBelow(px, pb.y - 36, 90);
      if (gy === null || !L.solid(Math.floor(px / TS), Math.floor(gy / TS))) return;
      if (L.liquidPx(px, gy - 2) || !L.boxFree(px, gy, 5, 22) || L.spikePx(px, gy - 2)) return;
      if (!W.onScreen(px, gy, -6)) return;
      const z = new Zombie(W, px, gy, this.variant);
      this.kids.push(z); W.enemies.push(z);
    }
    draw() { }
  }
  GNG.ZombieZone = ZombieZone;

  /* ====================================================================== SKELETON (bone thrower) */
  class Skeleton extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 5; this.h = 23; this.hp = 2; this.score = 200; this.blood = null;
      this.label = 'SKELETON'; this.possessHint = 'SKELETON: HOLD [ATTACK] TO HURL RAPID BONES (UP TO LOB)';
      this.ctrlSpeed = 1.35; this.ctrlJump = 4.7;
      this.setState('rise'); this.cool = GNG.irnd(30, 70); this.dodged = null;
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.state === 'rise') {
        this.vx = 0;
        if (this.st >= 30) this.setState('move');
      } else if (this.state === 'move') {
        if (tg) {
          const dx = tg.x - this.x, dist = Math.abs(dx);
          this.dir = sign(dx) || this.dir;
          let want = 0;
          if (dist < 54) want = -this.dir * 0.75; else if (dist > 108) want = this.dir * 0.6;
          if (want && this.onGround) {
            const probe = { x: this.x, y: this.y, hw: this.hw, h: this.h, dir: sign(want) };
            if (L.wallAhead(probe, 2) || !L.floorAhead(probe, 3)) want = 0;
          }
          this.vx = want;
          if (this.cool <= 0 && dist < 180 && Math.abs(tg.y - this.y) < 90 && W.onScreen(this.x, this.y, 0)) this.setState('throw');
          // REACTIVE: hop over low shots
          const s = this.incomingShot(46, 4);
          if (s && s !== this.dodged && this.onGround) { this.dodged = s; if (GNG.chance(0.5)) this.vy = -4.4; }
        } else this.vx = 0;
      } else if (this.state === 'throw') {
        this.vx = 0;
        if (this.st === 13 && tg) {
          const sx = this.x + this.dir * 6, sy = this.y - 22, Tf = 44, g = 0.16;
          const vx = clamp((tg.x - sx) / Tf, -3.4, 3.4);
          const vy = clamp(((tg.y - 12) - sy - 0.5 * g * Tf * Tf) / Tf, -6, -1);
          GNG.enemyShot(W, 'bone', sx, sy, vx, vy);
          GNG.snd('throw_dagger', { vol: 0.4, pitch: 0.7 });
        }
        if (this.st >= 28) { this.setState('move'); this.cool = GNG.irnd(64, 120); }
      }
      this.physics();
    }
    hostAttack(inp) {
      this.cool = 7; this.throwT = 6;
      const up = inp.down('up');
      GNG.hostShot(this.w, 'h_bone', this.x + this.dir * 6, this.y - 19, this.dir * (up ? 1.8 : 4.3), up ? -4.8 : -1.7);
      GNG.snd('throw_dagger', { vol: 0.5, pitch: 0.8 });
    }
    deathFx() { this.w.fx.bones(this.x, this.y - 8, 6); GNG.snd('bone_rattle'); }
    draw(g, vx, vy) {
      let spr;
      if (this.state === 'rise') { const f = GNG.frames('skel_rise'); spr = f[clamp(Math.floor(this.st / 30 * f.length), 0, f.length - 1)]; }
      else if (this.state === 'throw') { const f = GNG.frames('skel_throw'); spr = f[this.st < 13 ? 0 : Math.min(1, f.length - 1)]; }
      else if (this.throwT > 0) { this.throwT--; const f = GNG.frames('skel_throw'); spr = f[Math.min(1, f.length - 1)]; }
      else { const f = GNG.frames('skel_walk'); spr = f[(Math.abs(this.vx) > 0.05 || this.moving) ? (this.t >> 3) % f.length : 0]; }
      this.drawSpr(g, vx, vy, spr);
    }
  }
  GNG.Skeleton = Skeleton;

  /* ====================================================================== SKELETON SWORDSMAN (Prince-of-Persia duelist) */
  class Swordsman extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 6; this.h = 24; this.hp = 3; this.score = 400; this.blood = null;
      this.label = 'SKELETON SWORDSMAN'; this.possessHint = 'SWORDSMAN: [ATTACK] LUNGES WITH THE SCIMITAR';
      this.ctrlSpeed = 1.35; this.ctrlJump = 4.6;
      this.setState('advance'); this.guardT = 0; this.cool = 30;
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.guardT > 0) this.guardT--;
      if (this.state === 'advance') {
        this.vx = 0;
        if (tg) {
          const dx = tg.x - this.x, dist = Math.abs(dx);
          this.dir = sign(dx) || this.dir;
          if (dist > 30 && this.guardT <= 0) {
            this.vx = this.dir * 0.8;
            if (this.onGround && (L.wallAhead(this, 2) || !L.floorAhead(this, 3))) this.vx = 0;
          }
          if (dist <= 36 && Math.abs(tg.y - this.y) < 22 && this.cool <= 0) this.setState('lunge');
        }
      } else if (this.state === 'lunge') {
        // 0-14 telegraph (blade drawn back) | 14-24 thrust | 24-52 over-extended: GUARD IS DOWN
        if (this.st < 14) this.vx = -this.dir * 0.3;
        else if (this.st < 19) this.vx = this.dir * 2.4;
        else this.vx = 0;
        if (this.st === 14) GNG.snd('throw_lance', { vol: 0.5, pitch: 1.3 });
        if (this.st >= 14 && this.st < 25) {
          const hx = this.x + this.dir * 15, pl = W.player;
          if (!pl.busy && Math.abs(pl.x - hx) < 11 + pl.hw && pl.y > this.y - 22 && pl.y - pl.h < this.y - 4) pl.hurt(this.x, 'sword');
          const d = W.decoy;
          if (d && !d.dead && this.st === 16 && Math.abs(d.x - hx) < 16 && Math.abs(d.y - this.y) < 24) d.hit(2);
        }
        if (this.st >= 52) { this.setState('advance'); this.cool = GNG.irnd(34, 70); }
      }
      this.physics();
    }
    onShot(s) {
      // parries anything from the front unless caught mid-lunge
      const front = (s.x - this.x) * this.dir > 0 && (s.vx === 0 || sign(s.vx) === -this.dir);
      if (front && !(this.state === 'lunge' && this.st >= 14) && !this.possessed && s.kind !== 'm_star') { this.guardT = 16; return 'block'; }
      return 'hit';
    }
    hostAttack() {
      this.cool = 18; this.slashT = 10;
      if (this.onGround) this.x += this.dir * 2;
      GNG.meleeHit(this.w, this, 15, 13, 12, 9, 4, 8);
      GNG.snd('throw_lance', { vol: 0.5, pitch: 1.3 });
    }
    deathFx() { this.w.fx.bones(this.x, this.y - 8, 7); GNG.snd('bone_rattle'); }
    draw(g, vx, vy) {
      let spr;
      if (this.state === 'lunge' || this.slashT > 0) {
        if (this.slashT > 0) this.slashT--;
        const f = GNG.frames('skelsw_lunge');
        spr = (this.state === 'lunge' && this.st < 14) ? GNG.frames('skelsw_guard')[0] : f[(this.state === 'lunge' && this.st >= 24) ? Math.min(1, f.length - 1) : 0];
      } else if (this.guardT > 0) spr = GNG.frames('skelsw_guard')[0];
      else { const f = GNG.frames('skelsw_walk'); spr = f[(Math.abs(this.vx) > 0.05 || this.moving) ? (this.t >> 3) % f.length : 0]; }
      this.drawSpr(g, vx, vy, spr);
    }
  }
  GNG.Swordsman = Swordsman;

  /* ====================================================================== RED ARREMER (the intelligent gargoyle) */
  const ARREMER_VARIANTS = {
    arremer: { hp: 4, score: 600, dodge: 0.62, label: 'RED ARREMER', diveSp: 3.3 },
    garg: { hp: 3, score: 400, dodge: 0.4, label: 'GARGOYLE', diveSp: 3.0 },
    aking: { hp: 20, score: 6000, dodge: 0.86, label: 'RED ARREMER KING', diveSp: 3.9 }
  };
  class Arremer extends Enemy {
    constructor(W, x, y, variant) {
      super(W, x, y);
      this.pre = variant || 'arremer';
      const v = ARREMER_VARIANTS[this.pre];
      this.cfg = v; this.hp = v.hp; this.maxHp = v.hp; this.score = v.score; this.label = v.label;
      this.possessHint = 'GARGOYLE: FLY ANYWHERE! [ATTACK] BREATHES FIRE';
      this.hw = 8; this.h = 22; this.blood = 'red';
      this.king = this.pre === 'aking';
      if (this.king) { this.isBoss = true; this.possessable = false; this.persistent = true; }
      this.flying = false; this.grav = 0.3;
      this.setState(this.pre === 'garg' ? 'statue' : 'perch');
      this.dodgeCD = 0; this.dodgeT = 0; this.actT = GNG.irnd(50, 110); this.dives = 0; this.side = 1;
      this.contactDmg = true;
    }
    wake() { if (this.state === 'statue') { this.setState('perch'); this.w.fx.debris(this.x, this.y - 10, 'gray', 8); GNG.snd('crumble', { vol: 0.6 }); this.actT = 20; } }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.dodgeCD > 0) this.dodgeCD--;
      const st = this.state;
      if (st === 'statue') {
        this.vx = 0; this.physics();
        if (tg && !tg.isDecoy && Math.abs(tg.x - this.x) < 84 && Math.abs(tg.y - this.y) < 70) this.wake();
        return;
      }
      if (st === 'perch' || st === 'ground') {
        this.flying = false; this.grav = 0.3;
        if (tg) this.dir = sign(tg.x - this.x) || this.dir;
        this.vx = (st === 'ground' && tg && Math.abs(tg.x - this.x) > 30) ? this.dir * 0.95 : 0;
        this.physics();
        const s = this.incomingShot(70, 6);
        if (s || (tg && Math.abs(tg.x - this.x) < (st === 'perch' ? 118 : 0)) || (st === 'ground' && this.st > 110) || (st === 'perch' && this.st > 30 && this.wasHit)) {
          if (!tg && !s) return;
          this.takeoff(s ? -4.4 : -2.8);
        }
        return;
      }
      // ---------- airborne states ----------
      this.flying = true;
      if (st === 'takeoff') {
        this.vy = approach(this.vy, -0.4, 0.14); this.vx *= 0.9;
        if (this.st >= 22) this.setState('hover');
      } else if (st === 'hover') {
        if (!tg) { this.vx *= 0.95; this.vy = Math.sin(this.t * 0.08) * 0.3; }
        else {
          this.dir = sign(tg.x - this.x) || this.dir;
          if (this.dodgeT > 0) this.dodgeT--;
          else {
            if (Math.abs(tg.x - this.x) > 20) this.side = this.x < tg.x ? -1 : 1;
            const hx = tg.x + this.side * (this.king ? 92 : 80);
            let hy = tg.y - (this.king ? 74 : 62) + Math.sin(this.t * 0.07) * 9;
            if (hy < W.cam.y + 30) hy = W.cam.y + 30;
            this.vx = clamp(this.vx * 0.93 + clamp((hx - this.x) * 0.012, -0.16, 0.16), -2, 2);
            this.vy = clamp(this.vy * 0.9 + clamp((hy - this.y) * 0.014, -0.18, 0.18), -2, 2);
          }
          // INTELLIGENT DODGE: sidestep horizontal shots vertically
          if (this.dodgeCD <= 0) {
            const s = this.incomingShot(78, 5);
            if (s) {
              if (GNG.chance(this.cfg.dodge)) {
                const up = (this.y - 40 > W.cam.y + 20) && (s.y <= this.y - 10 ? false : true);
                this.vy = up ? -3.7 : 3.3; this.vx += sign(s.vx) * 0.6;
                this.dodgeT = 11; this.dodgeCD = this.king ? 24 : 34;
                W.fx.px(this.x, this.y - 10, 0, 0, C.white, 6, 0);
              } else this.dodgeCD = 22;
            }
          }
          if (--this.actT <= 0 && this.dodgeT <= 0 && W.onScreen(this.x, this.y, 10)) {
            const r = GNG.rand();
            if (this.dives >= 3 && !this.king && r < 0.5) { this.dives = 0; this.setState('land'); }
            else if (r < (this.king ? 0.55 : 0.7)) this.startDive(tg);
            else this.setState('shoot');
          }
        }
      } else if (st === 'shoot') {
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.st === 12 && tg) {
          const sx = this.x + this.dir * 8, sy = this.y - 12;
          const dx = tg.x - sx, dy = (tg.y - 12) - sy, d = Math.hypot(dx, dy) || 1, sp = this.king ? 3 : 2.5;
          GNG.enemyShot(W, 'fireball', sx, sy, dx / d * sp, dy / d * sp);
          if (this.king && this.hp <= this.maxHp * 0.6) {
            const a = Math.atan2(dy, dx);
            GNG.enemyShot(W, 'fireball', sx, sy, Math.cos(a + 0.3) * sp, Math.sin(a + 0.3) * sp);
            GNG.enemyShot(W, 'fireball', sx, sy, Math.cos(a - 0.3) * sp, Math.sin(a - 0.3) * sp);
          }
          GNG.snd('fireball');
        }
        if (this.st >= 26) { this.setState('hover'); this.actT = GNG.irnd(this.king ? 34 : 60, this.king ? 80 : 130); }
      } else if (st === 'dive') {
        // swoop through the target point, then pull up. No dodging here: this is your opening!
        if (this.phase === 0) {
          const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy) || 1, sp = this.cfg.diveSp;
          this.vx = approach(this.vx, dx / d * sp, 0.4); this.vy = approach(this.vy, dy / d * sp, 0.4);
          if (d < 10 || this.st > 70 || (this.x - this.tx) * this.ddir > 0) { this.phase = 1; this.st = 0; }
        } else {
          this.vx = approach(this.vx, this.ddir * 2.5, 0.2); this.vy = approach(this.vy, -2.4, 0.22);
          if (this.st > 30) { this.setState('hover'); this.actT = GNG.irnd(this.king ? 30 : 50, this.king ? 70 : 110); this.dives++; }
        }
        const d = W.decoy;
        if (d && !d.dead && !this.hitDecoy && GNG.boxVsBox(this, d)) { d.hit(2); this.hitDecoy = true; }
      } else if (st === 'land') {
        const gy = L.groundBelow(this.x, this.y, 200);
        this.vx *= 0.9; this.vy = approach(this.vy, 2, 0.2);
        if (gy === null) this.setState('hover');
        else if (this.y >= gy - 2) { this.y = gy; this.vy = 0; this.flying = false; this.setState('ground'); }
        else if (this.st > 120) this.setState('hover');
      }
      // flying movement (with walls)
      L.move(this);
      if (st === 'dive' && (this.onGround || this.hitWall || this.hitCeil)) { if (this.phase === 0) { this.phase = 1; this.st = 0; } }
      if (this.y < 12) { this.y = 12; if (this.vy < 0) this.vy = 0; }
      if (W.lock) this.x = clamp(this.x, W.lock[0] + 10, W.lock[1] - 10);
    }
    takeoff(vy) {
      this.flying = true; this.vy = vy; this.onGround = false; this.setState('takeoff'); this.wasHit = false;
      if (this.w.onScreen(this.x, this.y, 0)) GNG.snd('arremer_screech', { vol: 0.7 });
    }
    startDive(tg) {
      this.setState('dive'); this.phase = 0; this.hitDecoy = false;
      this.tx = tg.x; this.ty = tg.y - 10; this.ddir = sign(tg.x - this.x) || this.dir; this.dir = this.ddir;
      GNG.snd('arremer_screech');
    }
    onShot(s) {
      if (this.state === 'statue') return 'block';
      return 'hit';
    }
    onHurt() {
      this.wasHit = true;
      this.actT = Math.min(this.actT, 30);
      if (this.state === 'perch' || this.state === 'ground') this.takeoff(-3.2);
    }
    control(inp) { this.flying = true; this.controlFly(inp, 2.3); if (this.y < 10) this.y = 10; }
    hostAttack(inp) {
      this.cool = 20;
      const up = inp.down('up'), dn = inp.down('down');
      GNG.hostShot(this.w, 'h_fire', this.x + this.dir * 9, this.y - 11, this.dir * 4, up ? -2 : (dn ? 2 : 0));
      GNG.snd('fireball');
    }
    die(src) {
      if (this.dead) return;
      super.die(src);
      if (this.king) this.w.bossDefeated(this);
    }
    draw(g, vx, vy) {
      const pre = this.pre + '_', st = this.state;
      let spr;
      if (st === 'statue') spr = GNG.hasSprite('garg_statue0') ? GNG.spr('garg_statue0') : GNG.frames(pre + 'perch')[0];
      else if (st === 'perch') { const f = GNG.frames(pre + 'perch'); spr = f[(this.t >> 4) % f.length]; }
      else if (st === 'ground') { const f = GNG.frames(pre + 'walk'); spr = f[(this.t >> 3) % f.length]; }
      else if (st === 'dive' && this.phase === 0) spr = GNG.frames(pre + 'dive')[0];
      else { const f = GNG.frames(pre + 'fly'); spr = f[(this.t >> 2) % f.length]; }
      this.drawSpr(g, vx, vy, spr, { dy: this.flying ? 4 : 0 });
    }
  }
  GNG.Arremer = Arremer;

  /* ====================================================================== HAUNTED ARMOUR (shield wall) */
  class HauntedArmor extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 7; this.h = 28; this.hp = 5; this.score = 500; this.blood = null; this.heavy = true;
      this.label = 'HAUNTED ARMOR'; this.possessHint = 'HAUNTED ARMOR: SHIELDED, HEAVY (PLATES! CRACKED FLOORS!), [ATTACK] SLASHES';
      this.ctrlSpeed = 0.85; this.ctrlJump = 4.3;
      this.setState('walk');
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.state === 'walk') {
        this.vx = this.dir * 0.36;
        if (tg) {
          const dx = tg.x - this.x;
          if (sign(dx) !== this.dir && Math.abs(dx) > 12) { this.setState('turn'); this.vx = 0; }
          else if (Math.abs(dx) < 27 && Math.abs(tg.y - this.y) < 26) { this.setState('slash'); this.vx = 0; }
        }
        if (this.state === 'walk' && this.onGround && (L.wallAhead(this, 2) || !L.floorAhead(this, 3))) {
          this.vx = 0;
          if (!tg || sign(tg.x - this.x) !== this.dir) this.setState('turn');
        }
      } else if (this.state === 'turn') {             // slow to turn: its back is its weak spot
        this.vx = 0;
        if (this.st >= 44) { this.dir = -this.dir; this.setState('walk'); }
      } else if (this.state === 'slash') {
        this.vx = 0;
        if (this.st === 16) GNG.snd('throw_axe', { vol: 0.6, pitch: 0.8 });
        if (this.st >= 16 && this.st < 25) {
          const hx = this.x + this.dir * 16, pl = W.player;
          if (!pl.busy && Math.abs(pl.x - hx) < 12 + pl.hw && pl.y > this.y - 28 && pl.y - pl.h < this.y) pl.hurt(this.x, 'sword');
          const d = W.decoy;
          if (d && !d.dead && this.st === 18 && Math.abs(d.x - hx) < 18 && Math.abs(d.y - this.y) < 26) d.hit(2);
        }
        if (this.st >= 46) this.setState('walk');
      }
      this.physics();
    }
    onShot(s) {
      const front = (s.x - this.x) * this.dir > 0;
      if (front && !(this.state === 'slash' && this.st > 16) && s.kind !== 'm_star') return 'block';
      return 'hit';
    }
    hostAttack() {
      this.cool = 28; this.slashT = 14;
      GNG.meleeHit(this.w, this, 16, 14, 13, 13, 5, 9);
      GNG.snd('throw_axe', { vol: 0.6, pitch: 0.8 });
    }
    deathFx() {
      const W = this.w;
      W.fx.plates(this.x, this.y, 'steel', 8);
      W.fx.poof(this.x, this.y - 14);
      GNG.snd('armor_shatter', { vol: 0.7, pitch: 0.8 });
    }
    draw(g, vx, vy) {
      let spr;
      if (this.state === 'slash' || this.slashT > 0) {
        if (this.slashT > 0) this.slashT--;
        const f = GNG.frames('harmor_slash');
        spr = f[(this.state === 'slash' && this.st < 16) ? 0 : Math.min(1, f.length - 1)];
      } else {
        const f = GNG.frames('harmor_walk');
        spr = f[(this.state === 'turn' || (this.possessed && !this.moving)) ? 0 : (this.t >> 4) % f.length];
      }
      // while turning, show the flip half-way through
      const flip = this.state === 'turn' && this.st > 22 ? this.dir > 0 : this.dir < 0;
      this.drawSpr(g, vx, vy, spr, { flip: flip });
    }
  }
  GNG.HauntedArmor = HauntedArmor;

  /* ====================================================================== VOODOO SKULL */
  class VoodooSkull extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 6; this.h = 12; this.hp = 2; this.score = 200; this.blood = null; this.flying = true;
      this.label = 'VOODOO SKULL'; this.possessHint = 'VOODOO SKULL: FLOAT FREELY, [ATTACK] SPITS CURSED FLAME';
      this.setState('float'); this.phase = GNG.rnd(0, 6.28); this.by = y;
    }
    ai() {
      const W = this.w, tg = this.target();
      if (tg && Math.abs(tg.x - this.x) < 230) {
        const dx = tg.x - this.x, dy = (tg.y - 14) - this.y, d = Math.hypot(dx, dy) || 1;
        this.dir = sign(dx) || this.dir;
        this.vx = approach(this.vx, dx / d * 0.9, 0.04); this.vy = approach(this.vy, dy / d * 0.7 + Math.sin(this.t * 0.09 + this.phase) * 0.8, 0.06);
        if (tg.isDecoy && d < 14 && (this.t % 40) === 0) tg.hit(1);
      } else { this.vx *= 0.96; this.vy = Math.sin(this.t * 0.09 + this.phase) * 0.5; }
      this.x += this.vx; this.y += this.vy;
      this.trail();
    }
    trail() {
      if ((this.t % 3) === 0) this.w.fx.px(this.x - this.dir * 4 + GNG.rnd(-2, 2), this.y - 6 + GNG.rnd(-3, 3), -this.dir * 0.3, -0.5, C.toxic[5], 14, 0, { ramp: [C.purple[3], C.toxic[4], C.toxic[6]] });
    }
    onHurt(src) { if (src && src.vx) { this.vx = sign(src.vx) * 2.6; this.vy = -1; this.stun = 14; } }
    control(inp) { this.controlFly(inp, 1.7); this.trail(); }
    hostAttack(inp) {
      this.cool = 18;
      GNG.hostShot(this.w, 'h_skull', this.x + this.dir * 7, this.y - 6, this.dir * 3.4, inp.down('up') ? -1.6 : (inp.down('down') ? 1.6 : 0));
      GNG.snd('fireball', { pitch: 1.3 });
    }
    deathFx() { const W = this.w; W.fx.poof(this.x, this.y - 6); W.fx.bones(this.x, this.y - 4, 2); W.fx.blood(this.x, this.y - 6, 'toxic', 8); GNG.snd('bone_rattle', { pitch: 1.3 }); }
    draw(g, vx, vy) {
      const f = GNG.frames('vskull');
      this.drawSpr(g, vx, vy, f[(this.t >> 3) % f.length], { dy: -6 });
    }
  }
  GNG.VoodooSkull = VoodooSkull;

  /* ====================================================================== CROW */
  class Crow extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 6; this.h = 10; this.hp = 1; this.score = 100; this.blood = 'red'; this.flying = true;
      this.label = 'CROW'; this.possessHint = 'CROW: FAST FLIGHT, [ATTACK] PECKS';
      this.setState('perch');
    }
    ai() {
      const W = this.w, tg = this.target();
      if (this.state === 'perch') {
        if (tg) this.dir = sign(tg.x - this.x) || this.dir;
        if (tg && !tg.isDecoy && Math.abs(tg.x - this.x) < 112 && Math.abs(tg.y - this.y) < 80) {
          this.setState('fly'); this.fdir = this.dir; this.by = this.y - 10; this.ty = tg.y - 14;
          GNG.snd('arremer_screech', { vol: 0.35, pitch: 1.8 });
        }
        return;
      }
      this.vx = approach(this.vx, this.fdir * 1.9, 0.08);
      this.by = approach(this.by, this.ty, 0.5);
      if (tg && !tg.isDecoy && (tg.x - this.x) * this.fdir > 20) this.ty = tg.y - 14;
      this.x += this.vx;
      this.y = this.by + Math.sin(this.st * 0.13) * 12;
      this.dir = this.fdir;
      if (!W.onScreen(this.x, this.y, 60)) this.remove();
    }
    control(inp) { this.controlFly(inp, 2.7); this.state = 'fly'; }
    hostAttack() { this.cool = 14; GNG.meleeHit(this.w, this, 8, 5, 9, 8, 2, 6); GNG.snd('throw_dagger', { vol: 0.5 }); }
    deathFx() { const W = this.w; W.fx.poof(this.x, this.y - 5); for (let i = 0; i < 6; i++) W.fx.px(this.x, this.y - 5, GNG.rnd(-1.5, 1.5), GNG.rnd(-2, 0), C.night[3], 40, 0.06, { size: 2, drag: 0.95 }); GNG.snd('enemy_die', { pitch: 1.5 }); }
    draw(g, vx, vy) {
      let spr;
      if (this.state === 'perch') spr = GNG.frames('crow_perch')[0];
      else { const f = GNG.frames('crow_fly'); spr = f[(this.t >> 2) % f.length]; }
      this.drawSpr(g, vx, vy, spr, { dy: this.state === 'perch' ? -7 : -5 });
    }
  }
  GNG.Crow = Crow;

  /* ====================================================================== GHOST BUCCANEER (shy "Boo" AI) */
  class Ghost extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 6; this.h = 22; this.hp = 2; this.score = 300; this.blood = 'teal'; this.flying = true; this.noclip = true;
      this.label = 'GHOST BUCCANEER'; this.possessHint = 'GHOST: DRIFT STRAIGHT THROUGH WALLS!';
      this.fade = 1; this.noCrush = true; this.persistent = false;
      this.setState('haunt');
    }
    ai() {
      const W = this.w, pl = W.player, tg = this.target();
      // REACTIVE: it only dares to move (and be touched) while you are looking away
      const watched = tg && !tg.isDecoy && (this.x - pl.x) * pl.dir > 0;
      if (!tg || tg.isDecoy) { this.fade = approach(this.fade, 1, 0.03); this.vx *= 0.9; this.vy = Math.sin(this.t * 0.05) * 0.2; }
      else if (watched) { this.fade = approach(this.fade, 1, 0.045); this.vx *= 0.8; this.vy *= 0.8; }
      else {
        this.fade = approach(this.fade, 0, 0.035);
        const dx = tg.x - this.x, dy = (tg.y - 4) - this.y, d = Math.hypot(dx, dy) || 1, sp = 0.6 + (1 - this.fade) * 0.7;
        this.vx = approach(this.vx, dx / d * sp, 0.05); this.vy = approach(this.vy, dy / d * sp, 0.05);
        this.dir = sign(dx) || this.dir;
      }
      this.contact = this.fade < 0.55;
      this.noHit = this.fade >= 0.75;
      this.x += this.vx; this.y += this.vy + Math.sin(this.t * 0.1) * 0.25;
    }
    onPossess() { super.onPossess(); this.fade = 0; this.noHit = false; }
    control(inp) { this.controlFly(inp, 1.6); if (this.y < 16) this.y = 16; }
    hostAttack() { this.cool = 30; }
    deathFx() { this.w.fx.ecto(this.x, this.y - 10, 20); GNG.snd('enemy_die', { pitch: 0.7 }); }
    draw(g, vx, vy) {
      const f = GNG.frames('ghost');
      const spr = f[(this.t >> 3) % f.length];
      if (this.fade >= 0.75 && !this.possessed) {
        if ((this.t & 3) < 2) this.drawSpr(g, vx, vy, spr, { stipple: true, phase: this.t & 1, table: GNG.SPECTRAL_MAP, dy: Math.round(Math.sin(this.t * 0.1) * 2) });
      } else this.drawSpr(g, vx, vy, spr, { stipple: true, phase: (this.t >> 1) & 1, dy: Math.round(Math.sin(this.t * 0.1) * 2) });
    }
  }
  GNG.Ghost = Ghost;

  /* ====================================================================== MOAT GATOR (leaps out of the cursed water) */
  class Gator extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 9; this.h = 10; this.hp = 3; this.score = 300; this.blood = 'toxic';
      this.amphibious = true; this.possessable = false; this.label = 'MOAT GATOR';
      this.home = y + 10; this.y = this.home; this.setState('lurk'); this.cool = GNG.irnd(20, 90);
      this.contact = false; this.noHit = true; this.noCrush = true; this.persistent = true;
    }
    ai() {
      const W = this.w, tg = this.target();
      if (this.state === 'lurk') {
        this.contact = false; this.noHit = true;
        this.y = this.home; this.vx = 0; this.vy = 0;
        if (this.cool <= 0 && tg && Math.abs(tg.x - this.x) < 46 && tg.y < this.home + 8 && W.onScreen(this.x, this.home - 20, 0)) {
          this.setState('leap'); this.vy = -6.3; this.vx = clamp((tg.x - this.x) * 0.02, -0.7, 0.7);
          this.dir = sign(tg.x - this.x) || 1; this.contact = true; this.noHit = false;
          W.fx.splash(this.x, this.home - 8, 10); GNG.snd('splash');
        } else if ((this.t % 50) === 0 && W.onScreen(this.x, this.home, 0)) W.fx.px(this.x + GNG.rnd(-6, 6), this.home - 9, 0, -0.3, GNG.LIQ_BASE + 4, 20, 0);
      } else {
        this.vy += 0.21; this.x += this.vx; this.y += this.vy;
        if (this.vy > 0 && this.y >= this.home) {
          this.y = this.home; this.setState('lurk'); this.cool = GNG.irnd(70, 130);
          W.fx.splash(this.x, this.home - 8, 8); if (W.onScreen(this.x, this.home, 0)) GNG.snd('splash', { vol: 0.6 });
        }
      }
    }
    afterMove() { }
    draw(g, vx, vy) {
      if (this.state === 'lurk') return;
      const f = GNG.frames('gator');
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy - 8;
      const spr = f[this.vy < 0 ? Math.min(1, f.length - 1) : 0];
      if (this.flash > 0 && (this.flash & 1)) g.drawSolid(spr, sx, sy, this.dir < 0, C.white);
      else g.blit(spr, sx - (spr.w >> 1), sy - (spr.h >> 1), this.dir < 0, false);
    }
  }
  GNG.Gator = Gator;

  /* ====================================================================== CYBER-IMP */
  class Imp extends Enemy {
    constructor(W, x, y) {
      super(W, x, y);
      this.hw = 6; this.h = 23; this.hp = 3; this.score = 300; this.blood = 'red';
      this.label = 'CYBER-IMP'; this.possessHint = 'CYBER-IMP: AGILE, [ATTACK] HURLS PLASMA FIREBALLS';
      this.ctrlSpeed = 1.5; this.ctrlJump = 5.1;
      this.setState('move'); this.cool = GNG.irnd(40, 90); this.strafe = 0; this.dodged = null;
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target();
      if (this.state === 'move') {
        let want = 0;
        if (tg) {
          const dx = tg.x - this.x, dist = Math.abs(dx);
          this.dir = sign(dx) || this.dir;
          if (dist > 124) want = this.dir * 0.95;
          else if (dist < 64) want = -this.dir * 0.85;
          else { if ((this.st % 50) === 0) this.strafe = GNG.pick([-1, 0, 1]); want = this.strafe * 0.6; }
          if (this.cool <= 0 && dist < 210 && Math.abs(tg.y - this.y) < 100 && W.onScreen(this.x, this.y, 0)) this.setState('throw');
          const s = this.incomingShot(50, 4);
          if (s && s !== this.dodged && this.onGround) { this.dodged = s; if (GNG.chance(0.35)) this.vy = -4.7; }
        }
        if (want && this.onGround) {
          const probe = { x: this.x, y: this.y, hw: this.hw, h: this.h, dir: sign(want) };
          if (!L.floorAhead(probe, 3)) want = 0;
          else if (L.wallAhead(probe, 2)) {
            // hop one-tile steps
            if (!L.solidPx(this.x + sign(want) * (this.hw + 3), this.y - 20)) this.vy = -4.4; else want = 0;
          }
        }
        this.vx = want;
      } else if (this.state === 'throw') {
        this.vx = 0;
        if (this.st === 16 && tg) {
          const sx = this.x + this.dir * 8, sy = this.y - 18;
          const lead = (tg === W.player) ? W.player.vx * 12 : 0;
          const dx = tg.x + lead - sx, dy = (tg.y - 12) - sy, d = Math.hypot(dx, dy) || 1;
          GNG.enemyShot(W, 'fireball', sx, sy, dx / d * 2.7, dy / d * 2.7);
          GNG.snd('fireball');
        }
        if (this.st >= 32) { this.setState('move'); this.cool = GNG.irnd(80, 140); }
      }
      this.physics();
    }
    hostAttack(inp) {
      this.cool = 14; this.throwT = 8;
      const up = inp.down('up');
      GNG.hostShot(this.w, 'h_fire', this.x + this.dir * 8, this.y - 17, this.dir * 4.2, up ? -2.6 : 0);
      GNG.snd('fireball');
    }
    draw(g, vx, vy) {
      let spr;
      if (this.state === 'throw') { const f = GNG.frames('imp_throw'); spr = f[this.st < 16 ? 0 : Math.min(1, f.length - 1)]; }
      else if (this.throwT > 0) { this.throwT--; const f = GNG.frames('imp_throw'); spr = f[Math.min(1, f.length - 1)]; }
      else { const f = GNG.frames('imp_walk'); spr = f[(Math.abs(this.vx) > 0.05 || this.moving) ? (this.t >> 3) % f.length : 0]; }
      this.drawSpr(g, vx, vy, spr);
    }
  }
  GNG.Imp = Imp;

  /* ====================================================================== ZOMBIE LEMMINGS (walkers, floaters, exploding blockers) */
  class Lemming extends Enemy {
    /** mode: 'walk' | 'block' | 'float' | 'fall' */
    constructor(W, x, y, mode, dir) {
      super(W, x, y);
      this.hw = 3; this.h = 11; this.hp = 1; this.score = 50; this.blood = 'toxic';
      this.label = mode === 'block' ? 'BLOCKER' : 'ZOMBIE LEMMING';
      this.possessHint = 'LEMMING: [ATTACK] = "OH NO!" ... KABOOM (YOU SURVIVE)';
      this.ctrlSpeed = 1.0; this.ctrlJump = 3.4;
      this.dir = dir || -1; this.bomber = mode === 'walk' && GNG.chance(0.3);
      this.fuse = -1; this.setState(mode || 'walk');
      if (mode === 'block') { this.contact = false; this.score = 300; this.persistent = true; this.hp = 99; }
    }
    ai() {
      const W = this.w, L = W.level, tg = this.target(), st = this.state;
      if (this.fuse >= 0) {
        if (this.fuse === 100) GNG.snd('ohno');
        if (--this.fuse < 0) { this.explode(false); return; }
      }
      if (st === 'block') {
        this.vx = 0; this.physics();
        // a blocker BLOCKS: nothing walks through
        const pl = W.player;
        if (!pl.busy && Math.abs(pl.x - this.x) < pl.hw + 5 && pl.y > this.y - this.h && pl.y - pl.h < this.y) {
          pl.x = this.x + (pl.x < this.x ? -1 : 1) * (pl.hw + 5); pl.vx = 0;
        }
        for (const e of W.enemies) {
          if (e !== this && !e.dead && e instanceof Lemming && e.state === 'walk' && Math.abs(e.x - this.x) < 7 && Math.abs(e.y - this.y) < 8) e.dir = e.x < this.x ? -1 : 1;
        }
        return;
      }
      if (st === 'float') {
        this.vy = 0.55; this.vx = Math.sin(this.t * 0.05) * 0.3; this.grav = 0;
        L.move(this);
        if (this.onGround) { this.grav = 0.3; this.setState('walk'); if (tg) this.dir = sign(tg.x - this.x) || this.dir; }
        return;
      }
      if (st === 'fall') {
        this.vx = 0; this.physics();
        if (this.onGround) { this.setState('walk'); if (tg) this.dir = sign(tg.x - this.x) || this.dir; }
        return;
      }
      // walk: mindless march, turn at walls, happily step off ledges
      this.vx = this.dir * 0.5;
      if (this.onGround && L.wallAhead(this, 1)) this.dir = -this.dir;
      if (this.bomber && this.fuse < 0 && tg && Math.abs(tg.x - this.x) < 64 && Math.abs(tg.y - this.y) < 40) this.fuse = 100;
      this.attackDecoy(tg, 9, 40, 1) && (this.vx = 0);
      this.physics();
    }
    /** lemmings are tiny: give Arthur's standing throws a little grace so they do not sail over them */
    collideShot(s) {
      const h = this.h;
      this.h = h + 6;
      const r = super.collideShot(s);
      this.h = h;
      return r;
    }
    onShot(s) {
      if (this.state === 'block') {            // can't be killed... but it CAN be persuaded to explode
        if (this.fuse < 0) this.fuse = 100;
        this.flash = 6;
        return 'block';
      }
      return 'hit';
    }
    damage(n, src) {
      if (this.state === 'block' && src && (src.kind === 'anvil' || src.kind === 'crusher' || src.kind === 'explosion' || src.kind === 'm_star' || src.kind === 'magic')) { this.hp = 0; super.damage(99, src); return; }
      if (this.state === 'block') { if (this.fuse < 0) this.fuse = 100; this.flash = 6; return; }
      super.damage(n, src);
    }
    explode(friendly) {
      if (this.dead) return;
      this.dead = true;
      if (this.spawn) this.spawn.killed = true;
      this.w.explosion(this.x, this.y - 6, this.state === 'block' ? 40 : 30, { dmg: 6, friendly: friendly, ramp: 'toxic' });
      this.w.addScore(this.score, this.x, this.y - 14);
    }
    onPossess() { super.onPossess(); this.fuse = -1; if (this.state === 'block') this.label = 'BLOCKER'; this.state = 'possessed'; this.grav = 0.3; }
    hostAttack() {
      this.cool = 999;
      if (this.hostFuse === undefined) { this.hostFuse = 46; GNG.snd('ohno'); }
    }
    control(inp) {
      if (this.hostFuse !== undefined) {
        this.vx = 0; this.physics();
        if (--this.hostFuse <= 0) { this.possessed = false; this.explode(true); }
        return;
      }
      super.control(inp);
    }
    draw(g, vx, vy) {
      const st = this.state;
      let spr, dy = 0;
      if (this.fuse >= 0 || this.hostFuse !== undefined) { const f = GNG.frames('lem_ohno'); spr = f[(this.t >> 2) % f.length]; }
      else if (st === 'block') { const f = GNG.frames('lem_block'); spr = f[(this.t >> 4) % f.length]; }
      else if (st === 'float') { const f = GNG.frames('lem_float'); spr = f[(this.t >> 4) % f.length]; }
      else if (st === 'fall' || !this.onGround) spr = GNG.frames('lem_fall')[0];
      else { const f = GNG.frames('lem_walk'); spr = f[(this.possessed && !this.moving) ? 0 : (this.t >> 3) % f.length]; }
      this.drawSpr(g, vx, vy, spr, { dy: dy });
      const fz = this.fuse >= 0 ? this.fuse : (this.hostFuse !== undefined ? this.hostFuse * 2 : -1);
      if (fz >= 0) {                              // the famous countdown
        GNG.text(g, String(Math.max(1, Math.ceil(fz / 20))), Math.floor(this.x) - vx, Math.floor(this.y) - vy - (st === 'float' ? 30 : 21), C.white, { align: 'center', outline: C.black });
      }
    }
  }
  GNG.Lemming = Lemming;

  /** Lemmings entrance trapdoor: keeps dropping walkers. */
  class LemmingHatch {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y - TS; this.timer = 40; this.kids = []; this.dead = false; this.behind = true; this.open = 0; }
    update() {
      const W = this.w;
      if (this.open > 0) this.open--;
      if (!W.onScreen(this.x, this.y, 30) || W.frozen) return;
      if (--this.timer > 0) return;
      this.timer = 120;
      this.kids = this.kids.filter(k => !k.dead);
      if (this.kids.length >= 4) return;
      const tg = W.player;
      const l = new Lemming(W, this.x, this.y + 18, 'fall', sign(tg.x - this.x) || -1);
      this.kids.push(l); W.enemies.push(l); this.open = 30;
    }
    draw(g, vx, vy) {
      const f = GNG.Tiles.prop(this.w.level.tiles, 'hatch');
      const spr = f[0];
      g.blit(spr, Math.floor(this.x) - (spr.w >> 1) - vx, Math.floor(this.y) - vy);
    }
  }
  GNG.LemmingHatch = LemmingHatch;

  /** Floaters drift down from the rafters on umbrellas. */
  class FloaterSpawner {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y; this.timer = 80; this.kids = []; this.dead = false; this.behind = true; }
    update() {
      const W = this.w;
      if (Math.abs(W.playerBox().x - this.x) > 150 || W.frozen) return;
      if (--this.timer > 0) return;
      this.timer = 170;
      this.kids = this.kids.filter(k => !k.dead);
      if (this.kids.length >= 3) return;
      const l = new Lemming(W, this.x + GNG.rnd(-50, 50), W.cam.y + 4, 'float', -1);
      l.h = 11;
      if (W.level.boxFree(l.x, l.y, 4, 12)) { this.kids.push(l); W.enemies.push(l); }
    }
    draw() { }
  }
  GNG.FloaterSpawner = FloaterSpawner;

  /* ====================================================================== ROLLING BARRELS (rocking deck) */
  class Barrel extends Enemy {
    constructor(W, x, y, dir) {
      super(W, x, y);
      this.hw = 6; this.h = 12; this.hp = 1; this.score = 50; this.blood = null;
      this.possessable = false; this.label = 'BARREL'; this.dir = dir || -1; this.bounces = 0; this.rot = 0;
      this.vx = this.dir * 1.2;
    }
    ai() {
      const W = this.w, L = W.level;
      const slide = L.rockSlide(this.x, W.time);
      this.vx = clamp(this.vx + slide * 0.12, -2.2, 2.2);
      if (Math.abs(this.vx) < 0.5) this.vx = (this.vx < 0 ? -1 : 1) * 0.5;
      this.rot += this.vx;
      this.physics();
      if (this.hitWall) { this.vx = -this.hitWall * 1.2; if (++this.bounces >= 2) this.die(null); }
      if (!W.onScreen(this.x, this.y, 120)) this.remove();
    }
    deathFx() { const W = this.w; W.fx.debris(this.x, this.y - 6, 'brown', 8); W.fx.dustCloud(this.x, this.y - 6); GNG.snd('crumble', { vol: 0.7, pitch: 1.3 }); }
    draw(g, vx, vy) {
      const f = GNG.frames('barrel');
      const i = ((Math.floor(this.rot / 5) % f.length) + f.length) % f.length;
      this.drawSpr(g, vx, vy, f[i], { dy: -6, flip: false });
    }
  }
  GNG.Barrel = Barrel;

  class BarrelSpawner {
    constructor(W, x, y) { this.w = W; this.x = x; this.y = y; this.timer = 60; this.kids = []; this.dead = false; this.behind = true; }
    update() {
      const W = this.w, pb = W.playerBox();
      if (Math.abs(pb.x - this.x) > 230 || Math.abs(pb.x - this.x) < 50 || W.frozen || W.lock) return;
      if (--this.timer > 0) return;
      this.timer = GNG.irnd(150, 210);
      this.kids = this.kids.filter(k => !k.dead);
      if (this.kids.length >= 2) return;
      const b = new Barrel(W, this.x, this.y, sign(pb.x - this.x) || -1);
      this.kids.push(b); W.enemies.push(b);
    }
    draw() { }
  }
  GNG.BarrelSpawner = BarrelSpawner;

})();
