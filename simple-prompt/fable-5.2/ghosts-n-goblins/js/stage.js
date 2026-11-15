/*
 * stage.js — the live stage ("World"): owns the level, Arthur, monsters, shots, mechanisms,
 * camera, collisions, boss arena logic and the layered software renderer
 * (3 parallax layers -> playfield with rocking-deck shear -> liquids -> weather).
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const TS = GNG.TILE, T = GNG.T, C = GNG.C;
  const SW = 320, SH = 200;
  const clamp = GNG.clamp;

  /* Spectral vision palette: everything a naked soul sees glows ectoplasm-teal. */
  const SPECTRAL = new Uint8Array(256);
  (function () {
    const p = GNG.basePal, r = GNG.RAMPS.teal;
    for (let i = 1; i < 256; i++) {
      const l = (p[i * 3] * 0.3 + p[i * 3 + 1] * 0.59 + p[i * 3 + 2] * 0.11) / 255;
      SPECTRAL[i] = r[clamp(2 + Math.round(l * 5), 2, 7)];
    }
  })();
  GNG.SPECTRAL_MAP = SPECTRAL;

  const MAGIC_NAMES = { lance: 'THUNDER STORM', dagger: 'BLADE TEMPEST', torch: 'FIRE DRAGON', axe: 'EARTH SHAKER', cross: 'HOLY NOVA' };

  class World {
    constructor(game, index, opts) {
      opts = opts || {};
      GNG.world = this;
      this.game = game; this.index = index;
      const def = this.def = GNG.STAGES[index];
      const L = this.level = new GNG.Level(def, index);
      L.backdrop = game.backdropFor(index, L);
      GNG.useStagePalette(index, L.backdrop.sky);
      this.time = 0;
      this.cam = { x: 0, y: 0 };
      this.fx = new GNG.Particles(this);
      this.shots = []; this.eshots = []; this.flames = []; this.enemies = []; this.objects = []; this.pickups = [];
      this.spawnPts = []; this.bolts = [];
      this.decoy = null; this.lock = null; this.frozen = false;
      this.spectral = 0; this.specFlash = 0;
      this.shakeT = 0; this.shakeAmp = 0; this.hintText = ''; this.hintT = 0;
      this.boss = null; this.bossSpawn = null; this.bossIntro = 0; this.bossDone = false; this.keyT = 0; this.keyAt = null;
      this.clearT = 0; this.clearFinal = false; this.introT = 170;
      this.timeLeft = def.time * 60;
      this.pf = new GNG.Bitmap(SW, SH); this.pf.ax = 0; this.pf.ay = 0;
      this.offs = new Int8Array(SW);

      this.player = new GNG.Player(this, opts.mode || 'steel', game.weapon);
      const start = opts.checkpoint || L.start;
      this.player.spawn(start.x, start.y);
      this.respawned = !!opts.checkpoint;
      GNG.audioBoxer(this.player.mode === 'boxers');
      this.weather = new GNG.Weather(this);
      this.populate(opts.checkpoint);
      this.updateCamera(true);
    }

    /* ================================================================ level population */
    zombieVariant(x) {
      const L = this.level;
      return this.def.zombie || (L.rock && x >= L.rock[0] - 48 ? 'zbucc' : 'zombie');
    }

    populate(checkpoint) {
      const L = this.level, def = this.def, O = this.objects;
      const sp = L.spawns.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
      let hintI = 0, lootI = 0, secI = 0, potI = 0;
      const plates = [], gates = [], nplates = [], niches = [];
      const loot = def.loot && def.loot.length ? def.loot : ['weapon'];
      const pots = def.potions && def.potions.length ? def.potions : ['potion_red'];
      for (const s of sp) {
        const x = s.x, y = s.y;
        switch (s.ch) {
          case 'P': break;
          case 'K': {
            const k = new GNG.Checkpoint(this, x, y);
            if (checkpoint && x <= checkpoint.x + 4) k.on = true;
            O.push(k); break;
          }
          case '?': { const t = (def.hints || [])[hintI++]; if (t && !this.respawned) O.push(new GNG.Hint(this, x, y, t)); break; }
          case 'Z': O.push(new GNG.ZombieZone(this, x, y, this.zombieVariant(x), def.zombieMax || 3)); break;
          case 'C': O.push(new GNG.Chest(this, x, y, 'normal', loot[lootI++ % loot.length])); break;
          case 'Q': O.push(new GNG.Chest(this, x, y, 'secret', (def.secretLoot || [])[secI++] || 'oneup')); break;
          case 'M': O.push(new GNG.Chest(this, x, y, 'magic')); break;
          case '$': this.pickups.push(new GNG.Pickup(this, ((x >> 4) & 3) === 0 ? 'gem0' : 'money', x, y, { vy: 0, life: 1e9, t: 20 })); break;
          case '+': this.pickups.push(new GNG.Pickup(this, pots[potI++ % pots.length], x, y, { vy: 0, life: 1e9, t: 20 })); break;
          case '*': this.pickups.push(new GNG.Pickup(this, 'oneup', x, y, { vy: 0, life: 1e9, t: 20 })); break;
          case 'p': plates.push(new GNG.Plate(this, x, y)); break;
          case 'D': gates.push(new GNG.Gate(this, x, y)); break;
          case 'n': nplates.push(new GNG.Plate(this, x, y)); break;
          case 'u': niches.push(new GNG.PotionSpot(this, x, y, pots[niches.length % pots.length])); break;
          case 'X': O.push(new GNG.Slicer(this, x, y)); break;
          case 'Y': O.push(new GNG.Piston(this, x, y)); break;
          case 'L': O.push(new GNG.LemmingHatch(this, x, y)); break;
          case 'F': O.push(new GNG.FloaterSpawner(this, x, y)); break;
          case 'b': O.push(new GNG.BarrelSpawner(this, x, y)); break;
          case 'o': O.push(new GNG.ToxicBarrel(this, x, y)); break;
          case 'E': this.bossSpawn = s; break;
          default: this.spawnPts.push({ ch: s.ch, x: x, y: y, killed: false, live: null, armed: true });
        }
      }
      for (let i = 0; i < plates.length; i++) { plates[i].target = gates[Math.min(i, gates.length - 1)] || null; O.push(plates[i]); }
      for (const g of gates) O.push(g);
      for (let i = 0; i < nplates.length; i++) { nplates[i].target = niches[Math.min(i, niches.length - 1)] || null; O.push(nplates[i]); }
      for (const n of niches) O.push(n);
    }

    makeEnemy(sp) {
      const x = sp.x, y = sp.y;
      switch (sp.ch) {
        case 'z': return new GNG.Zombie(this, x, y, this.zombieVariant(x));
        case 'S': return new GNG.Skeleton(this, x, y);
        case 'W': return new GNG.Swordsman(this, x, y);
        case 'A': return new GNG.Arremer(this, x, y, this.def.arremer || 'arremer');
        case 'R': return new GNG.HauntedArmor(this, x, y);
        case 'V': return new GNG.VoodooSkull(this, x, y - 8);
        case 'c': return new GNG.Crow(this, x, y);
        case 'g': return new GNG.Ghost(this, x, y);
        case 'G': return new GNG.Gator(this, x, y);
        case 'I': return new GNG.Imp(this, x, y);
        case 'l': return new GNG.Lemming(this, x, y, 'walk', -1);
        case 'B': return new GNG.Lemming(this, x, y, 'block', -1);
      }
      return null;
    }

    activateSpawns() {
      const x0 = this.cam.x - 44, x1 = this.cam.x + SW + 44;
      for (const sp of this.spawnPts) {
        if (sp.killed) continue;
        if (sp.live) { if (sp.live.dead) { sp.live = null; if (!sp.killed) sp.armed = false; } else continue; }
        const inside = sp.x > x0 && sp.x < x1;
        if (!inside) { sp.armed = true; continue; }
        if (!sp.armed || this.lock) continue;
        const e = this.makeEnemy(sp);
        sp.armed = false;
        if (!e) { sp.killed = true; continue; }
        e.spawn = sp; sp.live = e;
        this.enemies.push(e);
      }
      // retire monsters that were left far behind
      const far0 = this.cam.x - 210, far1 = this.cam.x + SW + 210;
      for (const e of this.enemies) {
        if (e.dead || e.persistent || e.possessed || e.isBoss) continue;
        if (e.x < far0 || e.x > far1) e.remove();
      }
    }

    /* ================================================================ services used by actors */
    playerBox() { const pl = this.player; return pl.possess ? pl.possess.host : pl; }

    targetFor(e) {
      const pl = this.player, d = this.decoy;
      let tg = null;
      if (!pl.dead && !pl.leap && !pl.hidden && pl.winT <= 0) tg = pl.possess ? pl.possess.host : pl;
      if (tg === e) tg = null;
      if (d && !d.dead) {
        const dd = Math.abs(d.x - e.x);
        if (dd < 150 && Math.abs(d.y - e.y) < 64 && (!tg || dd <= Math.abs(tg.x - e.x) + 26)) return d;
      }
      return tg;
    }

    onScreen(x, y, margin) {
      const m = margin || 0;
      return x > this.cam.x - m && x < this.cam.x + SW + m && y > this.cam.y - m && y < this.cam.y + SH + m;
    }
    inWindZone(x) {
      const z = this.level.windZones;
      for (let i = 0; i < z.length; i++) if (x >= z[i][0] && x <= z[i][1]) return true;
      return false;
    }
    shake(amp, frames) { if (amp > this.shakeAmp || this.shakeT <= 0) this.shakeAmp = amp; this.shakeT = Math.max(this.shakeT, frames); }
    hint(text, frames) { this.hintText = text; this.hintT = frames || 260; GNG.snd('hint'); }
    hintOnce(key, text) {
      const seen = this.game.hintsSeen;
      if (seen[key]) return;
      seen[key] = true;
      this.hint(text, 300);
    }
    addScore(pts, x, y) {
      this.game.addScore(pts);
      if (x !== undefined && pts >= 50) this.fx.score(x, y, pts);
    }
    countShots(kind) {
      let n = 0;
      for (const s of this.shots) if (!s.dead && s.kind === kind) n++;
      return n;
    }
    boxHitsEnemy(box, e) { return GNG.boxVsBox(box, e); }
    spawnPickup(kind, x, y, opts) {
      const p = new GNG.Pickup(this, kind, x, y, opts);
      this.pickups.push(p);
      return p;
    }
    spawnDecoy(x, y, skin, vy, dir) {
      if (this.decoy && !this.decoy.dead) {
        this.fx.shatterArmor(this.decoy.x, this.decoy.y, this.decoy.skin);
        this.decoy.dead = true;
      }
      this.decoy = new GNG.ArmorDecoy(this, x, y, skin, vy, dir);
      return this.decoy;
    }
    nearestHost(x, y) {
      let best = null, bd = 1e9;
      for (const e of this.enemies) {
        if (e.dead || !e.possessable || e.isBoss || e.possessed || e.burrowed) continue;
        const ey = e.y - e.h * 0.5;
        if (!this.onScreen(e.x, ey, -2)) continue;
        const d = Math.hypot(e.x - x, (ey - y) * 1.3);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    setCheckpoint(x, y) { this.game.checkpoint = { stage: this.index, x: x, y: y }; }
    onLightning() { this.specFlash = 34; }
    playerDied() { this.game.playerDied(); }

    onEnemyKilled(e, src) {
      const pl = this.player;
      if (e.isBoss || e.noDrop) return;
      const r = GNG.rand();
      if (pl.mode === 'boxers' && !pl.possess && r < 0.05) this.spawnPickup('armor', e.x, e.y - 6);
      else if (r < 0.1) this.spawnPickup(r < 0.03 ? 'gem1' : (r < 0.06 ? 'gem0' : 'money'), e.x, e.y - 6);
      if (pl.possess && src && src.friendly) this.game.stats.hostKills++;
    }

    /** Blast: hurts monsters (and Arthur unless friendly), breaks cracked blocks, chains barrels. */
    explosion(x, y, r, opts) {
      opts = opts || {};
      const L = this.level, pl = this.player;
      this.fx.explode(x, y, r >= 36);
      if (opts.ramp === 'toxic') this.fx.blood(x, y, 'toxic', 14);
      GNG.snd('explode');
      this.shake(r >= 36 ? 5 : 3, 12);
      GNG.fx.flash = Math.max(GNG.fx.flash, 0.18);
      for (const e of this.enemies) {
        if (e.dead || e === opts.source) continue;
        if (Math.hypot(e.x - x, (e.y - e.h * 0.5) - y) < r + e.hw) {
          if (e.possessed) { if (!opts.friendly) this.hurtHost(e, 2, { x: x }); }
          else e.damage(opts.dmg || 6, { kind: 'explosion', x: x, y: y, friendly: !!opts.friendly });
        }
      }
      if (!opts.friendly && !pl.possess && !pl.dead && Math.hypot(pl.x - x, (pl.y - 12) - y) < r * 0.8) pl.hurt(x, 'explosion');
      const d = this.decoy;
      if (d && !d.dead && Math.hypot(d.x - x, (d.y - 10) - y) < r) d.hit(3);
      const tx0 = Math.floor((x - r) / TS), tx1 = Math.floor((x + r) / TS), ty0 = Math.floor((y - r) / TS), ty1 = Math.floor((y + r) / TS);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (Math.hypot(tx * TS + 8 - x, ty * TS + 8 - y) < r + 6) L.smash(tx, ty, true);
      }
      for (const o of this.objects) {
        if (!o.dead && o.chain && Math.hypot(o.x - x, (o.y - 8) - y) < r * 1.35) o.chain();
      }
    }

    hurtHost(h, n, src) {
      if (h.dead || h.burrowed || (h.hostInv || 0) > this.time) return;
      h.hostInv = this.time + 50;
      h.damage(n, { kind: 'enemy', x: src ? src.x : h.x });
      this.shake(2, 5);
    }

    /* ================================================================ boss arena */
    updateBoss() {
      const L = this.level, pl = this.player;
      if (!this.boss && !this.bossDone && this.bossSpawn && L.arena && this.playerBox().x > L.arena[0] + 40 && !pl.dead) {
        this.lock = [L.arena[0], L.arena[1]];
        this.frozen = true; this.bossIntro = 130;
        for (const e of this.enemies) if (!e.possessed && (e.x < L.arena[0] || !e.persistent)) e.remove();
        for (const s of this.eshots) s.dead = true;
        this.boss = GNG.makeBoss(this, this.def.boss, this.bossSpawn.x, this.bossSpawn.y);
        this.enemies.push(this.boss);
        GNG.music(this.def.bossMusic || 'boss');
        GNG.snd('boss_warning');
      }
      if (this.bossIntro > 0 && --this.bossIntro === 0) { this.frozen = false; if (this.boss && this.boss.onIntroEnd) this.boss.onIntroEnd(); }
      if (this.keyT > 0 && --this.keyT === 0) {
        const k = this.keyAt;
        this.spawnPickup(this.index === GNG.STAGES.length - 1 ? 'floppy' : 'key', k.x, k.y, { vy: -4.6 });
        GNG.snd('key_appear');
        this.fx.sparkleBurst(k.x, k.y, 10);
      }
    }

    bossDefeated(b) {
      if (this.bossDone) return;
      const L = this.level;
      this.bossDone = true;
      for (const e of this.enemies) if (e !== b && !e.dead && !e.possessed) { e.noScore = true; e.die({ kind: 'magic' }); }
      for (const s of this.eshots) s.dead = true;
      GNG.musicStop(0.4);
      // drop the key on safe ground near where the boss fell (never into a pit, liquid, spikes or the ceiling)
      const floorAt = (x) => {
        const tx = Math.floor(x / TS);
        for (let ty = L.h - 1; ty > 0; ty--) {
          if (!L.solid(tx, ty) || L.solid(tx, ty - 1)) continue;
          if (L.liq[(ty - 1) * L.w + tx] || L.tile(tx, ty - 1) === T.SPIKE) return null;
          return ty * TS;
        }
        return null;
      };
      let kx = clamp(b.x, this.lock[0] + 48, this.lock[1] - 48), ky = null;
      for (let d = 0; d < 200 && ky === null; d += 8) {
        for (const sd of [-1, 1]) {
          const x = clamp(kx + sd * d, this.lock[0] + 40, this.lock[1] - 40);
          const fy = floorAt(x);
          if (fy !== null) { kx = x; ky = fy; break; }
        }
      }
      this.keyAt = { x: kx, y: (ky === null ? this.cam.y + 120 : ky) - 44 };
      this.keyT = 80;
    }

    stageClear(final) {
      if (this.clearT) return;
      const pl = this.player;
      this.clearT = 1; this.clearFinal = !!final; this.frozen = true;
      if (pl.possess) pl.endPossess('exit');
      pl.winT = 1; pl.invuln = 0;
      for (const s of this.eshots) s.dead = true;
      GNG.music(final ? 'victory' : 'clear');
      this.bonus = Math.max(0, Math.floor(this.timeLeft / 60)) * 10;
    }

    /* ================================================================ update */
    update() {
      const pl = this.player, L = this.level;
      this.time++;
      if (this.introT > 0) this.introT--;
      L.updateDynamic();
      this.weather.update();
      if (this.specFlash > 0) this.specFlash--;
      this.spectral = GNG.approach(this.spectral, ((pl.mode === 'boxers' && !pl.dead) || this.specFlash > 0) ? 1 : 0, 0.06);

      if (!this.frozen && !pl.dead && !this.clearT) {
        this.timeLeft--;
        if (this.timeLeft === 30 * 60) { GNG.snd('time_warning'); this.hint('HURRY UP, SIR ARTHUR!', 150); }
        if (this.timeLeft <= 0) { if (pl.possess) pl.endPossess('time'); pl.invuln = 0; pl.die('time'); }
      }

      pl.update();
      if (this.decoy) { if (this.decoy.dead) this.decoy = null; else this.decoy.update(); }
      this.activateSpawns();
      const O = this.objects, E = this.enemies;
      for (let i = 0; i < O.length; i++) if (!O[i].dead) O[i].update();
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.dead) continue;
        if (this.frozen && !e.possessed && !(e.isBoss && e.dying)) { if (e.flash > 0) e.flash--; continue; }
        e.update();
      }
      for (let i = 0; i < this.pickups.length; i++) if (!this.pickups[i].dead) this.pickups[i].update();
      for (let i = 0; i < this.shots.length; i++) if (!this.shots[i].dead) this.shots[i].update();
      for (let i = 0; i < this.eshots.length; i++) if (!this.eshots[i].dead) { if (this.frozen) continue; this.eshots[i].update(); }
      for (let i = 0; i < this.flames.length; i++) if (!this.flames[i].dead) this.flames[i].update();
      this.collide();
      this.compact();
      this.fx.update();
      this.updateBoss();
      this.updateCamera(false);

      const bd = L.backdrop;
      if ((this.time % (bd.cycleLiq || 8)) === 0) GNG.cyclePalette(GNG.LIQ_BASE, 8, 1);
      if ((this.time % (bd.cycleGlow || 6)) === 0) GNG.cyclePalette(GNG.GLOW_BASE, 8, 1);
      if (this.shakeT > 0 && --this.shakeT === 0) this.shakeAmp = 0;
      if (this.hintT > 0) this.hintT--;
      for (let i = this.bolts.length - 1; i >= 0; i--) if (--this.bolts[i].t <= 0) this.bolts.splice(i, 1);

      if (this.clearT) {
        this.clearT++;
        if (this.clearT > 60 && this.bonus > 0 && (this.clearT & 1)) {
          const step = Math.min(this.bonus, 50);
          this.bonus -= step; this.game.addScore(step);
          if ((this.clearT & 7) === 1) GNG.snd('tally');
        }
        if (this.clearT === 60) this.fx.sparkleBurst(pl.x, pl.y - 14, 12);
        if (this.clearT >= (this.clearFinal ? 330 : 280) && this.bonus <= 0) this.game.stageCleared(this.index, this.clearFinal);
      }
    }

    compact() {
      const lists = [this.shots, this.eshots, this.flames, this.enemies, this.objects, this.pickups];
      for (const a of lists) {
        let n = 0;
        for (let i = 0; i < a.length; i++) if (!a[i].dead) a[n++] = a[i];
        a.length = n;
      }
    }

    collide() {
      const pl = this.player, E = this.enemies, O = this.objects;
      // --- Arthur's (and the possessed host's) shots vs monsters and breakables
      for (const s of this.shots) {
        if (s.dead) continue;
        for (let i = 0; i < E.length && !s.dead; i++) {
          const e = E[i];
          if (e.dead || e.possessed) continue;
          e.collideShot(s);
        }
        for (let i = 0; i < O.length && !s.dead; i++) {
          const o = O[i];
          if (!o.dead && o.hittable) o.collideShot(s);
        }
      }
      // --- creeping holy flames
      for (const f of this.flames) {
        if (f.dead) continue;
        for (const e of E) {
          if (e.dead || e.possessed || e.noHit || e.burnT > 0) continue;
          const hit = e.flameHit ? e.flameHit(f) : GNG.boxVsBox(f, e);
          if (hit) { e.burnT = 18; e.damage(1, { kind: 'flame', x: f.x, vx: 0 }); }
        }
      }
      if (pl.dead || pl.leap || pl.winT > 0) return;
      const host = pl.possess ? pl.possess.host : null;
      const box = host || { x: pl.x, y: pl.y, hw: 4, h: pl.crouching ? 14 : 22 };
      const d = this.decoy;
      // --- monster shots
      for (const s of this.eshots) {
        if (s.dead) continue;
        if (d && !d.dead && GNG.shotVsBox(s, d)) { s.dead = true; this.fx.spark(s.x, s.y); d.hit(1); continue; }
        if (!GNG.shotVsBox(s, box)) continue;
        if (host) { s.dead = true; this.fx.spark(s.x, s.y); this.hurtHost(host, 1, s); }
        else if (pl.hurt(s.x - s.vx * 6, 'shot')) { s.dead = true; }
      }
      // --- body contact
      for (const e of E) {
        if (e.dead || !e.contact || e.possessed || e.stun > 0) continue;
        const hit = e.touches ? e.touches(box) : (Math.abs(box.x - e.x) < box.hw + e.hw - 1 && box.y > e.y - e.h + 2 && box.y - box.h < e.y - 1);
        if (!hit) continue;
        if (host) this.hurtHost(host, 1, e); else pl.hurt(e.x, 'touch');
      }
    }

    updateCamera(snap) {
      const L = this.level, pb = this.playerBox(), pl = this.player;
      let tx = pb.x - SW / 2 + (pl.dir || 1) * 22;
      let lo = 0, hi = L.pxW - SW;
      if (this.lock) { lo = Math.max(lo, this.lock[0]); hi = Math.min(hi, this.lock[1] - SW); if (hi < lo) hi = lo; }
      if (pl.leap) tx = pl.leap.x - SW / 2;
      let ty = pb.y - 124;
      const cam = this.cam;
      if (snap) { cam.x = clamp(tx, lo, hi); cam.y = clamp(ty, 0, Math.max(0, L.pxH - SH)); return; }
      if (pl.dead) return;
      cam.x += clamp((clamp(tx, lo, hi) - cam.x) * 0.12, -4.5, 4.5);
      if (!this.lock) cam.x = clamp(cam.x, 0, L.pxW - SW);
      else if (Math.abs(cam.x - clamp(cam.x, lo, hi)) < 0.6) cam.x = clamp(cam.x, lo, hi);
      cam.y += clamp((clamp(ty, 0, Math.max(0, L.pxH - SH)) - cam.y) * 0.1, -3, 3);
    }

    /* ================================================================ render */
    draw(fb) {
      const L = this.level, bd = L.backdrop, t = this.time;
      let cx = Math.floor(this.cam.x), cy = Math.floor(this.cam.y);
      if (this.shakeT > 0) {
        const a = Math.max(1, Math.round(this.shakeAmp * Math.min(1, this.shakeT / 6)));
        cx += ((t * 7) % (a * 2 + 1)) - a; cy += ((t * 13) % (a * 2 + 1)) - a;
      }
      // ---- parallax layers (far -> near)
      for (let i = 0; i < bd.layers.length; i++) {
        const l = bd.layers[i];
        const ox = Math.floor(this.cam.x * (l.fx || 0)), y = Math.round((l.y || 0) - this.cam.y * (l.fy || 0));
        if (i === 0 && (y !== 0 || l.bmp.h < SH)) fb.clear(C.black);
        if (l.fill !== undefined && l.fill !== null && y + l.bmp.h < SH) fb.rect(0, y + l.bmp.h, SW, SH - (y + l.bmp.h), l.fill);
        if (l.wrap) fb.blitWrapX(l.bmp, ox, y, i === 0); else fb.blit(l.bmp, -ox, y);
        if (i === 0 && !bd.indoor && this.index !== 5 && this.index !== 2) this.weather.drawBolt(fb);
      }

      // ---- playfield
      const pf = this.pf;
      pf.data.fill(0);
      pf.blitPart(L.bmp, cx, cy, SW, SH, 0, 0, false);
      this.drawDynamicTiles(pf, cx, cy);
      this.drawProps(pf, cx, cy, false);
      this.fx.draw(pf, cx, cy, false);
      const O = this.objects;
      for (let i = 0; i < O.length; i++) if (O[i].behind) O[i].draw(pf, cx, cy);
      for (let i = 0; i < this.flames.length; i++) this.flames[i].draw(pf, cx, cy);
      for (let i = 0; i < O.length; i++) if (!O[i].behind && !O[i].front) O[i].draw(pf, cx, cy);
      if (this.decoy && !this.decoy.dead) this.decoy.draw(pf, cx, cy);
      for (let i = 0; i < this.pickups.length; i++) this.pickups[i].draw(pf, cx, cy);
      const E = this.enemies;
      for (let i = 0; i < E.length; i++) if (!E[i].dead && E[i].isBoss) E[i].draw(pf, cx, cy);
      for (let i = 0; i < E.length; i++) if (!E[i].dead && !E[i].isBoss) E[i].draw(pf, cx, cy);
      this.player.draw(pf, cx, cy);
      for (let i = 0; i < this.shots.length; i++) this.shots[i].draw(pf, cx, cy);
      for (let i = 0; i < this.eshots.length; i++) this.eshots[i].draw(pf, cx, cy);
      for (let i = 0; i < O.length; i++) if (O[i].front) O[i].draw(pf, cx, cy);
      this.drawProps(pf, cx, cy, true);
      this.fx.draw(pf, cx, cy, true);
      for (const b of this.bolts) this.drawMagicBolt(pf, b, cx, cy);

      // ---- composite the playfield, shearing the rocking ship deck column by column
      const fd = fb.data, pd = pf.data;
      let sheared = false;
      if (L.rock && cx + SW > L.rock[0] - 40 && cx < L.rock[1] + 40) {
        const offs = this.offs;
        for (let x = 0; x < SW; x++) { offs[x] = L.rockOffset(cx + x, t); if (offs[x]) sheared = true; }
        if (sheared) {
          for (let x = 0; x < SW; x++) {
            const o = offs[x];
            const y0 = Math.max(0, o), y1 = Math.min(SH, SH + o);
            for (let y = y0; y < y1; y++) { const c = pd[(y - o) * SW + x]; if (c) fd[y * SW + x] = c; }
          }
        }
      }
      if (!sheared) { for (let i = 0, n = SW * SH; i < n; i++) { const c = pd[i]; if (c) fd[i] = c; } }

      GNG.drawLiquid(fb, L, cx, cy, t);
      this.weather.drawOver(fb);
    }

    drawDynamicTiles(g, cx, cy) {
      const L = this.level, ts = L.tiles, t = this.time, w = L.w;
      const tx0 = Math.floor(cx / TS) - 1, tx1 = Math.floor((cx + SW) / TS) + 1;
      // collapsing bridges
      for (const i of L.bridgeCells) {
        const tx = i % w;
        if (tx < tx0 || tx > tx1 || L.t[i] !== T.BRIDGE) continue;
        const ty = (i / w) | 0, st = L.bridges.get(i);
        let dx = 0, dy = 0;
        if (st && st.phase === 0) { dx = ((t >> 1) & 1) ? 1 : -1; dy = st.t < st.max * 0.4 ? 1 : 0; }
        g.blit(ts.bridge[L.variant(tx, ty, ts.bridge.length)], tx * TS - cx + dx, ty * TS - cy + dy);
      }
      // conveyor belts
      const cf = ts.conveyor;
      if (cf.length > 1) {
        for (const i of L.conveyors) {
          const tx = i % w;
          if (tx < tx0 || tx > tx1) continue;
          const ty = (i / w) | 0, k = (t >> 2) % cf.length;
          const fr = cf[L.t[i] === T.CONV_R ? k : (cf.length - 1 - k)];
          g.blitPart(fr, 0, 0, TS, TS, tx * TS - cx, ty * TS - cy, true);
        }
      }
      // ghost platforms: only an exposed soul (or a lightning flash) can see them
      const gp = GNG.frames('ghost_plat');
      for (const i of L.ghosts) {
        const tx = i % w;
        if (tx < tx0 || tx > tx1) continue;
        const ty = (i / w) | 0, px = tx * TS - cx, py = ty * TS - cy;
        if (this.spectral > 0.08) {
          if (this.spectral < 0.6 && ((t + tx) & 1)) continue;
          g.blitStipple(gp[((t >> 4) + tx) % gp.length], px, py, false, ((t >> 3) + tx) & 1);
          if (((t + tx * 7) % 24) === 0) this.fx.soul(tx * TS + GNG.rnd(2, 14), ty * TS + 2);
        } else if (((t + tx * 37) % 150) === 0) this.fx.sparkle(tx * TS + 8, ty * TS + 3);
      }
    }

    drawProps(g, cx, cy, front) {
      const L = this.level, P = L.props, t = this.time;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (!!p.front !== front) continue;
        const sx = p.x - cx;
        if (sx < -90 || sx > SW + 90) continue;
        const fr = GNG.Tiles.prop(L.tiles, p.name);
        g.draw(fr[((t >> 3) + p.tx) % fr.length], sx, p.y - cy, false);
      }
    }

    drawMagicBolt(g, b, cx, cy) {
      const col = (b.t & 1) ? C.white : C.gold[6];
      let x = b.x - cx, y = b.y0 - cy;
      const y1 = b.y1 - cy, n = 6;
      for (let i = 1; i <= n; i++) {
        const nx = b.x - cx + (i === n ? 0 : Math.round((GNG.hash2(i, b.seed + (b.t >> 1), 5) - 0.5) * 22));
        const ny = y + (y1 - (b.y0 - cy)) / n;
        g.line(x, y, nx, ny, col); g.line(x + 1, y, nx + 1, ny, C.gold[5]);
        x = nx; y = ny;
      }
    }
  }
  GNG.World = World;

  /* ====================================================================== GOLDEN MAGIC */
  /** The screen-clearing spell of the Golden Armour (flavoured by the weapon in hand). */
  GNG.castMagic = function (W, pl) {
    const cy = pl.y - 12;
    GNG.snd('magic_cast');
    GNG.fx.flash = Math.max(GNG.fx.flash, 0.85);
    W.shake(5, 22);
    W.specFlash = 40;
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      GNG.hostShot(W, 'm_star', pl.x, cy, Math.cos(a) * 3.3, Math.sin(a) * 3.3);
    }
    for (const s of W.eshots) { if (!s.dead) { s.dead = true; W.fx.spark(s.x, s.y); } }
    let k = 0;
    for (const e of W.enemies) {
      if (e.dead || e.possessed || !W.onScreen(e.x, e.y - e.h * 0.5, 4)) continue;
      W.bolts.push({ x: e.x, y0: W.cam.y - 4, y1: e.y - e.h * 0.5, t: 16 + (k & 3) * 3, seed: k++ });
      if (!e.isBoss) e.damage(8, { kind: 'magic', x: pl.x, vx: e.x - pl.x });
      else e.damage(6, { kind: 'magic', x: pl.x });
    }
    for (const o of W.objects) if (!o.dead && o.chain && W.onScreen(o.x, o.y, 0)) o.chain();
    W.fx.sparkleBurst(pl.x, cy, 14);
    W.fx.label(pl.x, pl.y - 40, (MAGIC_NAMES[pl.weapon] || 'MAGIC') + '!', C.gold[6]);
    W.game.stats.magic++;
  };

})();
