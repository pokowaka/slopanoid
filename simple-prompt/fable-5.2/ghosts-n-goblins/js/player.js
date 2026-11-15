/*
 * player.js — Sir Arthur: steel armour / strawberry boxer shorts / golden armour,
 * tactical armour eject, soul-leap possession, golden magic charge.
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE, T = GNG.T, C = GNG.C;

  /** Movement tuning per armour state. Boxer shorts: 35% faster, floaty, double-jump. */
  const MODES = GNG.MODES = {
    steel: { speed: 1.5, accel: 0.3, airAccel: 0.075, jump: 5.2, grav: 0.34, djump: 0, cut: 2.8, label: 'STEEL ARMOR' },
    gold: { speed: 1.5, accel: 0.3, airAccel: 0.085, jump: 5.3, grav: 0.34, djump: 0, cut: 2.8, label: 'GOLDEN ARMOR' },
    boxers: { speed: 1.5 * 1.35, accel: 0.5, airAccel: 0.32, jump: 5.0, grav: 0.28, djump: 4.5, cut: 2.0, label: 'BOXER SHORTS' }
  };

  const WEAPONS = GNG.WEAPONS = {
    lance: { name: 'LANCE', icon: 'icon_lance0', cool: 13, max: 2 },
    dagger: { name: 'DAGGER', icon: 'icon_dagger0', cool: 6, max: 3 },
    torch: { name: 'HOLY TORCH', icon: 'icon_torch0', cool: 22, max: 2 },
    axe: { name: 'BATTLE AXE', icon: 'icon_axe0', cool: 20, max: 2 },
    cross: { name: 'CROSS', icon: 'icon_cross0', cool: 16, max: 1 }
  };
  GNG.WEAPON_ORDER = ['lance', 'dagger', 'torch', 'axe', 'cross'];

  const CHARGE_MAX = 70;            // frames of holding [E] to charge golden magic
  const POSSESS_FRAMES = 8 * 60;    // 8 seconds
  const SOUL_COOLDOWN = 5 * 60;

  class Player {
    constructor(world, mode, weapon) {
      this.w = world;
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
      this.hw = 5; this.h = 24;
      this.dir = 1;
      this.mode = mode || 'steel';
      this.weapon = weapon || 'lance';
      this.onGround = false; this.onLadder = false; this.crouching = false;
      this.groundType = 0; this.groundTy = 0; this.landVy = 0;
      this.invuln = 0; this.hurtT = 0; this.cool = 0; this.throwT = 0; this.throwAim = 'fwd';
      this.jumpBuf = 0; this.coyote = 0; this.jumps = 0; this.dropT = 0; this.noCut = false;
      this.dead = false; this.deadT = 0; this.deathCause = '';
      this.winT = 0;
      this.leap = null; this.possess = null; this.soulCD = 0;
      this.charge = 0; this.eHold = 0; this.ready = false; this.magicCD = 0;
      this.animT = 0; this.runT = 0; this.climbT = 0; this.atkHold = 0;
      this.floatT = 0;
      this.hidden = false;
    }

    get boxers() { return this.mode === 'boxers'; }
    get armored() { return this.mode !== 'boxers'; }
    get busy() { return this.dead || this.leap || this.possess; }

    spawn(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.invuln = 90; }

    setMode(mode) {
      this.mode = mode;
      GNG.audioBoxer(mode === 'boxers');
    }

    /* ================================================================ update */
    update() {
      const W = this.w, inp = GNG.Input;
      this.animT++;
      if (this.invuln > 0) this.invuln--;
      if (this.cool > 0) this.cool--;
      if (this.soulCD > 0) this.soulCD--;
      if (this.magicCD > 0) this.magicCD--;
      if (this.throwT > 0) this.throwT--;
      if (this.hurtT > 0) this.hurtT--;
      if (this.floatT > 0) this.floatT--;
      if (this.dead) { this.updateDead(); return; }
      if (this.leap) { this.updateLeap(); return; }
      if (this.possess) { this.updatePossess(); return; }
      if (this.winT > 0) { this.winT++; this.vx = 0; this.vy = Math.min(this.vy + 0.3, 7); W.level.move(this); return; }

      const L = W.level, m = MODES[this.mode];
      let ix = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
      const up = inp.down('up'), down = inp.down('down');
      const stunned = this.hurtT > 0;
      if (stunned) ix = 0;

      /* ---- ladders ---- */
      if (this.onLadder) {
        this.updateLadder(ix, up, down);
      } else if (!stunned) {
        const tx = Math.floor(this.x / TS);
        if (up && L.ladderPx(this.x, this.y - 6)) {
          this.onLadder = true; this.x = tx * TS + 8; this.vx = 0; this.vy = 0; this.crouching = false;
        } else if (down && this.onGround && L.tile(tx, Math.floor((this.y + 1) / TS)) === T.LADDER &&
          L.tile(tx, Math.floor((this.y - 1) / TS)) !== T.LADDER) {
          this.onLadder = true; this.x = tx * TS + 8; this.y += 3; this.vx = 0; this.vy = 0; this.crouching = false;
        }
      }

      if (!this.onLadder) {
        /* ---- run / crouch ---- */
        this.crouching = down && this.onGround;
        const target = this.crouching ? 0 : ix * m.speed;
        if (!stunned) this.vx = GNG.approach(this.vx, target, this.onGround ? m.accel : m.airAccel);
        if (ix !== 0) this.dir = ix;

        /* ---- jump / double-jump / drop through ---- */
        if (inp.pressed('jump')) this.jumpBuf = 7;
        if (this.jumpBuf > 0) this.jumpBuf--;
        if (this.onGround) { this.coyote = 6; this.jumps = 0; } else if (this.coyote > 0) this.coyote--;
        if (this.jumpBuf > 0 && !stunned) {
          if (this.coyote > 0) {
            const gt = this.groundType;
            if (down && this.onGround && (gt === T.PLAT || gt === T.GHOST || gt === T.BRIDGE || gt === T.LADDER)) {
              this.dropT = 10; this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
            } else {
              this.vy = -m.jump; this.jumps = 1; this.coyote = 0; this.jumpBuf = 0; this.onGround = false; this.noCut = false;
              GNG.snd('jump');
            }
          } else if (m.djump && this.jumps < 2) {
            this.vy = -m.djump; this.jumps = 2; this.jumpBuf = 0; this.noCut = false;
            GNG.snd('double_jump');
            W.fx.dust(this.x, this.y + 2);
            W.fx.sparkleBurst(this.x, this.y, 3);
          }
        }
        if (!inp.down('jump') && !this.noCut && this.vy < -m.cut) this.vy = -m.cut;

        /* ---- gravity ---- */
        let g = m.grav;
        if (this.floatT > 0 && this.vy > 0) g *= 0.3;
        this.vy = Math.min(this.vy + g, this.floatT > 0 ? 2.2 : 7);

        /* ---- outside forces: wind (boxers only!), conveyors, rocking deck ---- */
        let ext = 0;
        if (this.mode === 'boxers' && W.weather.gust > 0 && W.inWindZone(this.x)) {
          ext += W.weather.gustDir * (this.onGround ? 0.95 : 1.3);
          if ((W.time & 7) === 0) W.fx.px(this.x - W.weather.gustDir * 6, this.y - GNG.rnd(4, 22), W.weather.gustDir * 3, 0, C.mist[5], 10, 0);
        }
        if (this.onGround) {
          if (this.groundType === T.CONV_L) ext -= 0.8; else if (this.groundType === T.CONV_R) ext += 0.8;
          ext += L.rockSlide(this.x, W.time) * (this.mode === 'boxers' ? 1 : 0.3);
        }

        /* ---- move ---- */
        this.dropThrough = this.dropT > 0;
        if (this.dropT > 0) this.dropT--;
        const wasGround = this.onGround, own = this.vx;
        this.vx = own + ext;
        L.move(this);
        this.vx = this.hitWall ? 0 : own;

        if (this.onGround && !wasGround) this.onLand();
        if (this.onGround) {
          const lx = Math.floor((this.x - this.hw) / TS), rx = Math.floor((this.x + this.hw - 0.01) / TS);
          for (let cx = lx; cx <= rx; cx++) L.stepOn(cx, this.groundTy, this.mode === 'boxers' ? 48 : 16);
          if (Math.abs(this.vx) > 0.2) this.runT += Math.abs(this.vx);
        }
      }

      /* ---- confinement (boss arena) ---- */
      if (W.lock) {
        if (this.x < W.lock[0] + 7) { this.x = W.lock[0] + 7; if (this.vx < 0) this.vx = 0; }
        if (this.x > W.lock[1] - 7) { this.x = W.lock[1] - 7; if (this.vx > 0) this.vx = 0; }
      }

      /* ---- hazards ---- */
      if (L.spikePx(this.x - this.hw + 1, this.y - 1) || L.spikePx(this.x + this.hw - 1, this.y - 1) || L.spikePx(this.x, this.y - 1)) {
        if (this.hurt(this.x - this.dir, 'spikes')) { this.vy = -3.8; }
      }
      if (L.liquidPx(this.x, this.y - 3)) {
        if (L.def.liquid === 'toxic') {
          this.hurt(this.x, 'toxic');
          if (!this.dead) { this.vy = -4.4; this.onGround = false; this.noCut = true; if ((W.time & 3) === 0) W.fx.splash(this.x, this.y, 4); }
        } else { W.fx.splash(this.x, this.y - 2, 12); GNG.snd('splash'); this.die('drown'); }
      }
      if (this.y > L.pxH + 48) this.die('pit');
      if (this.dead) return;

      /* ---- attack ---- */
      if (inp.down('attack')) this.atkHold++; else this.atkHold = 0;
      if ((inp.pressed('attack') || this.atkHold > 14) && this.cool <= 0 && !this.onLadder && !stunned) this.throwWeapon(up, down);

      /* ---- [E] : eject armour / possess / golden magic ---- */
      this.updateSpecial(inp, down);

      /* ---- step back into the ejected armour ---- */
      const dc = W.decoy;
      if (this.mode === 'boxers' && dc && !dc.dead && dc.age > 40 && down && this.onGround && dc.onGround &&
        Math.abs(dc.x - this.x) < 12 && Math.abs(dc.y - this.y) < 12) {
        dc.dead = true; W.decoy = null;
        this.equipArmor(dc.skin);
      }

      if (this.mode === 'gold' && (W.time % 9) === 0) W.fx.sparkle(this.x + GNG.rnd(-8, 8), this.y - GNG.rnd(2, 24));
    }

    updateLadder(ix, up, down) {
      const L = this.w.level, inp = GNG.Input;
      this.vx = 0; this.vy = 0; this.onGround = false; this.crouching = false; this.jumps = 0;
      if (inp.pressed('jump')) {
        this.onLadder = false; this.vy = -3.3; this.vx = ix * MODES[this.mode].speed; this.jumps = 1;
        if (ix) this.dir = ix;
        GNG.snd('jump');
        return;
      }
      const climb = (down ? 1 : 0) - (up ? 1 : 0);
      if (!climb) return;
      this.climbT++;
      if (climb < 0) {
        if (L.solidPx(this.x, this.y - this.h - 1.2)) return;
        this.y -= 1.1;
        const ty = Math.floor((this.y - 1) / TS);
        if (L.tile(Math.floor(this.x / TS), ty) !== T.LADDER) {      // climbed out over the top
          this.y = (ty + 1) * TS; this.onLadder = false; this.onGround = true; this.groundType = T.LADDER; this.groundTy = ty + 1;
        }
      } else {
        this.y += 1.1;
        const tx = Math.floor(this.x / TS);
        if (L.solid(tx, Math.floor(this.y / TS))) {
          this.y = Math.floor(this.y / TS) * TS; this.onLadder = false; this.onGround = true;
        } else if (L.tile(tx, Math.floor((this.y - 1) / TS)) !== T.LADDER && L.tile(tx, Math.floor(this.y / TS)) !== T.LADDER) {
          this.onLadder = false;
        }
      }
    }

    onLand() {
      const W = this.w, L = W.level, v = this.landVy || 0;
      this.noCut = false;
      if (this.mode !== 'boxers' && v >= 4) {
        // STEEL IS HEAVY: smash cracked floors under the feet
        let broke = false;
        const lx = Math.floor((this.x - this.hw) / TS), rx = Math.floor((this.x + this.hw - 0.01) / TS);
        for (let cx = lx; cx <= rx; cx++) if (L.smash(cx, this.groundTy)) broke = true;
        if (broke) { this.onGround = false; this.vy = 1.5; W.hintOnce('smash', 'HEAVY ARMOR SMASHES CRACKED FLOORS!'); }
        if (v >= 6 || broke) { W.shake(3, 8); GNG.snd('heavy_land'); W.fx.dust(this.x - 7, this.y); W.fx.dust(this.x + 7, this.y); }
        else GNG.snd('heavy_land', { vol: 0.45 });
      } else if (v > 2.5) {
        GNG.snd('land', { vol: 0.5 });
        if (v > 5) W.fx.dust(this.x, this.y);
      }
    }

    /* ================================================================ weapons */
    throwWeapon(up, down) {
      const W = this.w, def = WEAPONS[this.weapon], emp = this.mode !== 'boxers';
      const max = def.max + ((emp && (this.weapon === 'dagger' || this.weapon === 'cross')) ? 1 : 0);
      if (W.countShots(this.weapon) >= max) return;
      let aim = 'fwd';
      if (up && !this.crouching) aim = 'up';
      else if (down && !this.onGround) aim = 'down';
      const oy = this.crouching ? 9 : 16;
      GNG.fireWeapon(W, this.weapon, this.x + this.dir * 7, this.y - oy, this.dir, aim, emp);
      this.cool = def.cool; this.throwT = 12; this.throwAim = aim;
      GNG.snd('throw_' + this.weapon);
    }

    /* ================================================================ [E] special */
    updateSpecial(inp, down) {
      const W = this.w;
      if (this.hurtT > 0) { this.charge = 0; this.eHold = 0; return; }
      if (this.mode === 'steel') {
        if (inp.pressed('special')) this.ejectArmor();
      } else if (this.mode === 'boxers') {
        if (inp.pressed('special')) this.tryPossess();
      } else {                                   // gold: tap = eject, hold = charge magic
        if (inp.down('special')) {
          this.eHold++;
          if (this.magicCD <= 0 && this.eHold > 10) {
            if (this.eHold === 11) GNG.snd('magic_charge');
            if (this.charge < CHARGE_MAX) {
              this.charge++;
              W.fx.magic(this.x, this.y - 12, (this.charge & 1) ? 'gold' : 'purple');
            } else if (!this.ready) { this.ready = true; GNG.snd('magic_ready'); W.fx.sparkleBurst(this.x, this.y - 12, 8); }
            if (this.ready && (W.time & 3) === 0) W.fx.magic(this.x, this.y - 12, 'gold');
          }
        } else if (this.eHold > 0) {
          if (this.ready) this.castMagic();
          else if (this.eHold <= 10) this.ejectArmor();
          this.charge = 0; this.eHold = 0; this.ready = false;
        }
      }
    }

    /** TACTICAL ARMOR EJECT: the suit stays behind as a heavy decoy anvil / springboard. */
    ejectArmor() {
      const W = this.w, skin = this.mode;
      if (skin === 'boxers') return;
      W.spawnDecoy(this.x, this.y, skin, this.onGround ? 0 : Math.max(this.vy, 1.5), this.dir);
      this.setMode('boxers');
      GNG.snd('armor_eject');
      this.invuln = Math.max(this.invuln, 26);
      this.onLadder = false;
      if (this.onGround) { this.vy = -2.8; this.onGround = false; this.jumps = 1; }
      else { this.vy = Math.min(this.vy, -3.4); this.jumps = Math.min(this.jumps, 1); }   // recoil hop + keeps the double-jump
      this.noCut = true;
      this.charge = 0; this.eHold = 0; this.ready = false;
      W.fx.sparkleBurst(this.x, this.y - 12, 5);
      W.hintOnce('eject', 'ARMOR EJECTED! CROUCH ON IT TO SUIT UP, OR BOUNCE OFF IT');
    }

    equipArmor(skin) {
      const W = this.w;
      if (this.possess) this.endPossess('armor');
      this.setMode(skin);
      GNG.snd(skin === 'gold' ? 'gold_armor' : 'armor_equip');
      this.invuln = Math.max(this.invuln, 40);
      W.fx.sparkleBurst(this.x, this.y - 12, 8);
      GNG.fx.flash = Math.max(GNG.fx.flash, 0.25);
    }

    /** POSSESSION CURSE: the exposed soul leaps into the nearest non-boss monster on screen. */
    tryPossess() {
      const W = this.w;
      if (this.soulCD > 0) {
        GNG.snd('soul_fail');
        W.fx.label(this.x, this.y - 34, 'SOUL RECHARGING', C.teal[5]);
        return;
      }
      const host = W.nearestHost(this.x, this.y - 12);
      if (!host) {
        GNG.snd('soul_fail'); this.soulCD = 24;
        W.fx.label(this.x, this.y - 34, 'NO HOST IN SIGHT', C.teal[5]);
        return;
      }
      this.leap = { t: 0, dur: 22, sx: this.x, sy: this.y - 14, x: this.x, y: this.y - 14, host: host };
      host.stun = 40;
      this.vx = 0; this.vy = 0; this.onLadder = false;
      GNG.snd('possess');
      W.fx.ecto(this.x, this.y - 12, 10);
    }

    updateLeap() {
      const W = this.w, lp = this.leap, host = lp.host;
      lp.t++;
      if (host.dead) {                 // host vanished mid-leap: snap back
        this.leap = null; this.soulCD = 45; this.invuln = 30;
        return;
      }
      const k = lp.t / lp.dur, e = k * k * (3 - 2 * k);
      lp.x = lp.sx + (host.x - lp.sx) * e;
      lp.y = lp.sy + ((host.y - host.h * 0.5) - lp.sy) * e - Math.sin(k * Math.PI) * 22;
      W.fx.soul(lp.x, lp.y); W.fx.soul(lp.x, lp.y);
      if (lp.t >= lp.dur) {
        this.leap = null;
        this.possess = { host: host, t: POSSESS_FRAMES, max: POSSESS_FRAMES };
        host.onPossess();
        GNG.fx.flash = Math.max(GNG.fx.flash, 0.3);
        W.fx.ecto(host.x, host.y - host.h * 0.5, 12);
        W.fx.label(host.x, host.y - host.h - 12, 'POSSESSED: ' + host.label, C.teal[6]);
        W.hintOnce('possess', host.possessHint || 'YOU ARE THE MONSTER NOW! 8 SECONDS...');
      }
    }

    updatePossess() {
      const W = this.w, p = this.possess, host = p.host, inp = GNG.Input;
      p.t--;
      this.x = host.x; this.y = host.y; this.dir = host.dir; this.vx = 0; this.vy = 0;
      if ((p.t & 3) === 0) W.fx.soul(host.x + GNG.rnd(-6, 6), host.y - GNG.rnd(0, host.h));
      if (p.t === 120 || p.t === 60) GNG.snd('time_warning');
      if (host.dead) this.endPossess('died');
      else if (p.t <= 0) this.endPossess('time');
      else if (inp.pressed('special') && p.t < p.max - 20) this.endPossess('exit');
    }

    endPossess(reason) {
      const W = this.w, L = W.level, p = this.possess;
      if (!p) return;
      const host = p.host;
      this.possess = null;
      let px = host.x, py = host.y;
      if (py > L.pxH - 4) py = L.pxH - 4;
      const spot = L.findFreeSpot(px, py, this.hw, this.h);
      this.x = spot.x; this.y = spot.y; this.vx = 0;
      this.vy = host.pitDeath ? -7.2 : -3.8;
      this.noCut = true; this.onGround = false; this.jumps = 1; this.dir = host.dir || 1;
      this.invuln = 80; this.soulCD = SOUL_COOLDOWN;
      host.possessed = false;
      if (!host.dead) host.burst();
      GNG.snd('possess_end');
      W.fx.ecto(this.x, this.y - 12, 16);
      W.shake(3, 8);
    }

    castMagic() {
      const W = this.w;
      this.magicCD = 150;
      GNG.castMagic(W, this);
    }

    /* ================================================================ damage / death */
    /** Returns true if the hit landed. */
    hurt(srcX, cause) {
      const W = this.w;
      if (this.dead || this.invuln > 0 || this.winT > 0 || this.leap || this.possess) return false;
      if (W.frozen) return false;
      if (this.mode === 'boxers') { this.die(cause); return true; }
      const skin = this.mode;
      W.fx.shatterArmor(this.x, this.y, skin);
      GNG.snd('armor_shatter');
      W.shake(4, 10);
      GNG.fx.flash = Math.max(GNG.fx.flash, 0.4);
      this.setMode('boxers');
      this.invuln = 120; this.hurtT = 20;
      this.vx = (this.x < srcX ? -1 : 1) * 2.2; this.vy = -3.4; this.onGround = false; this.onLadder = false; this.noCut = true;
      this.charge = 0; this.eHold = 0; this.ready = false;
      W.hintOnce('boxers', 'BOXER SHORTS! FASTER, DOUBLE-JUMP, SPECTRAL VISION - [E] POSSESSES A MONSTER');
      return true;
    }

    die(cause) {
      if (this.dead) return;
      const W = this.w;
      if (this.possess) { this.possess.host.possessed = false; this.possess = null; }
      this.leap = null;
      this.dead = true; this.deadT = 0; this.deathCause = cause || '';
      this.vx = 0; this.onLadder = false; this.charge = 0;
      this.hidden = (cause === 'pit' || cause === 'drown');
      this.vy = this.hidden ? 0 : -3.6;
      GNG.musicStop(0.1);
      GNG.snd('player_die');
      W.shake(3, 8);
    }

    updateDead() {
      const W = this.w;
      this.deadT++;
      if (!this.hidden) {
        this.vy = Math.min(this.vy + 0.3, 7);
        const L = W.level;
        L.move(this);
        if (this.y > L.pxH + 48) this.hidden = true;
        if (this.deadT === 26) { W.fx.bones(this.x, this.y - 6, 5); GNG.snd('bone_rattle'); }
      }
      if (this.deadT === 30) GNG.music('death');
      if (this.deadT === 170) W.playerDied();
    }

    /* ================================================================ drawing */
    sprite() {
      const pre = 'arthur_' + this.mode + '_';
      if (this.winT > 0) return GNG.spr(pre + 'win0');
      if (this.hurtT > 0) return GNG.spr(pre + 'hurt0');
      if (this.onLadder) { const f = GNG.frames(pre + 'climb'); return f[(this.climbT >> 3) % f.length]; }
      if (this.throwT > 0) {
        if (this.crouching) return GNG.spr(pre + 'cthrow0');
        if (this.throwAim === 'up') return GNG.spr(pre + 'throwup0');
        if (!this.onGround) return GNG.spr(pre + 'jthrow0');
        const f = GNG.frames(pre + 'throw');
        return f[this.throwT > 8 ? 0 : Math.min(1, f.length - 1)];
      }
      if (!this.onGround) return GNG.spr(pre + (this.vy < 0.5 ? 'jump0' : 'fall0'));
      if (this.crouching) return GNG.spr(pre + 'crouch0');
      if (Math.abs(this.vx) > 0.25) { const f = GNG.frames(pre + 'run'); return f[Math.floor(this.runT / 5.5) % f.length]; }
      const f = GNG.frames(pre + 'idle');
      return f[(this.animT >> 5) % f.length];
    }

    draw(g, vx, vy) {
      if (this.possess || this.hidden) return;
      if (this.leap) {
        const f = GNG.frames('arthur_soul');
        g.draw(f[(this.animT >> 2) % f.length], Math.floor(this.leap.x) - vx, Math.floor(this.leap.y) - vy, this.leap.host.x < this.leap.sx);
        return;
      }
      const sx = Math.floor(this.x) - vx, sy = Math.floor(this.y) - vy;
      if (this.dead) {
        const f = GNG.frames('arthur_die');
        g.draw(f[Math.min(f.length - 1, Math.floor(this.deadT / 9))], sx, sy, this.dir < 0);
        return;
      }
      if (this.invuln > 0 && (this.invuln & 2) && this.hurtT <= 0) return;
      const spr = this.sprite();
      // golden magic charge aura
      if (this.charge > 0) {
        const r = 6 + (this.charge / CHARGE_MAX) * 12 + Math.sin(this.animT * 0.5) * 2;
        g.circ(sx, sy - 12, r, this.ready ? C.white : C.gold[5 + (this.animT & 1)]);
        if (this.ready) g.circ(sx, sy - 12, r + 3, C.gold[6]);
      }
      g.draw(spr, sx, sy, this.dir < 0);
    }
  }

  GNG.Player = Player;
  GNG.CHARGE_MAX = CHARGE_MAX;
  GNG.POSSESS_FRAMES = POSSESS_FRAMES;
  GNG.SOUL_COOLDOWN = SOUL_COOLDOWN;
})();
