/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — sim.js
 * Deterministic 60 Hz simulation. The lemming logic clock is DERIVED FROM
 * THE SONG CLOCK (ticks-per-beat), so the tribe marches to the tempo.
 * No DOM, no audio: the sim only emits events that audio/render consume.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const M = BT.MAT;

  const ST = (BT.ST = {
    WALK: 0, FALL: 1, FLOAT: 2, CLIMB: 3, HOIST: 4, BUILD: 5, SHRUG: 6, BASH: 7,
    MINE: 8, DIG: 9, BLOCK: 10, OHNO: 11, SPLAT: 12, DROWN: 13, BURN: 14, EXIT: 15,
    DEAD: 16, SAVED: 17,
  });
  BT.ST_NAMES = ['WALKER', 'FALLER', 'FLOATER', 'CLIMBER', 'CLIMBER', 'BUILDER', 'SHRUGGER',
    'BASHER', 'MINER', 'DIGGER', 'BLOCKER', 'OH NO!', 'SPLAT', 'DROWNING', 'BURNING', 'HOME',
    'DEAD', 'SAVED'];

  const SPLAT_H = 64;       // fall height that kills
  const STEP_UP = 6;        // max climbable step
  const BRICKS = 12;
  const BOMB_TICKS = 80;    // "5 seconds" of lemming ticks
  const HATCH_OPEN = 36;    // first spawn tick

  class Sim {
    constructor(def, opts) {
      opts = opts || {};
      this.def = def;
      this.world = BT.WORLDS[def.world];
      this.W = def.width;
      this.H = BT.PLAY_H;
      this.terrain = new BT.Terrain(this.W, this.H);
      const painter = new BT.Painter(this.terrain, def, this.world);
      def.build(painter);
      this.terrain.dirty = null;
      this.painter = painter;

      this.rand = BT.rng(def.seed || 777);
      this.bpm = this.world.bpm;
      this.tpb = this.world.tpb;
      this.stepTicks = this.tpb >> 1;
      this.frame = 0;
      this.tick = 0;
      this.lems = [];
      this.spawned = 0;
      this.saved = 0;
      this.lost = 0;
      this.count = def.count;
      this.need = def.save;
      this.rrMin = def.rr;
      this.rr = def.rr;
      this.skills = {};
      for (const s of BT.SKILLS) this.skills[s] = (def.skills && def.skills[s]) || 0;
      this.timeLimit = def.time * 60;
      this.entrances = def.entrances || [def.entrance];
      this.exits = def.exits || [def.exit];
      this.traps = (def.objects || []).map((o) => Object.assign({ busy: 0, anim: 0 }, o));
      this.nextSpawn = HATCH_OPEN;
      this.nuking = false;
      this.nukeIdx = 0;
      this.ended = false;
      this.endReason = '';
      this.endTimer = -1;
      this.events = [];
      this.stemLevel = 0;
      this.groove = 0;
      this.grooveStreak = 0;
      this.onBeatCount = 0;
      this.assignLog = [];
      this.hatchOpen = 0;

      // The Silence: a 1-D field along x.
      const sd = def.silence;
      this.sil = new Float32Array(this.W);
      this.eng = new Float32Array(this.W);
      this.silTmp = new Float32Array(this.W);
      if (sd) {
        this.silX0 = Math.max(1, sd.x0);
        this.silX1 = Math.min(this.W - 2, sd.x1);
        this.silCreep = sd.creep || 0.08;
        this.silSeeds = sd.seeds || [];
        for (const s of this.silSeeds) for (let x = s[0]; x <= s[1]; x++) this.sil[x] = 1;
        if (sd.start) for (const s of sd.start) for (let x = s[0]; x <= s[1]; x++) this.sil[x] = 1;
      } else this.silX0 = this.silX1 = -1;
    }

    /* ---------------- clocks ---------------- */
    ticksAt(frame) { return Math.floor((frame * this.bpm * this.tpb) / 3600); }
    songStepAt(frame) { return (frame * this.bpm * 4) / 3600; } // 16th steps (float)
    beatPhase(frame) { const b = (frame * this.bpm) / 3600; return b - Math.floor(b); }
    spawnInterval() { return Math.floor(53 - this.rr / 2); }
    timeLeft() { return Math.max(0, this.timeLimit - this.frame); }

    emit(e) { this.events.push(e); }

    /* ---------------- public actions ---------------- */
    setRR(v) { this.rr = Math.max(this.rrMin, Math.min(99, v | 0)); }
    nuke() {
      if (this.nuking) return;
      this.nuking = true;
      this.emit({ t: 'nuke' });
    }
    canAssign(L, skill) {
      if (!L || L.st >= ST.OHNO) return false;
      const s = L.st;
      switch (skill) {
        case 'climber': return !L.climber && s !== ST.BLOCK;
        case 'floater': return !L.floater && s !== ST.BLOCK;
        case 'bomber': return L.bomb < 0;
        case 'blocker': return s === ST.WALK || s === ST.SHRUG || s === ST.BUILD || s === ST.BASH || s === ST.MINE || s === ST.DIG;
        case 'builder': return (s === ST.WALK || s === ST.SHRUG || s === ST.BASH || s === ST.MINE || s === ST.DIG) && L.st !== ST.BUILD;
        case 'basher': return s === ST.WALK || s === ST.SHRUG || s === ST.BUILD || s === ST.MINE || s === ST.DIG;
        case 'miner': return s === ST.WALK || s === ST.SHRUG || s === ST.BUILD || s === ST.BASH || s === ST.DIG;
        case 'digger': return s === ST.WALK || s === ST.SHRUG || s === ST.BUILD || s === ST.BASH || s === ST.MINE;
      }
      return false;
    }
    assign(idx, skill) {
      const L = this.lems[idx];
      if (this.ended || !L || this.skills[skill] <= 0 || !this.canAssign(L, skill)) return false;
      this.skills[skill]--;
      switch (skill) {
        case 'climber': L.climber = true; break;
        case 'floater': L.floater = true; break;
        case 'bomber': L.bomb = BOMB_TICKS; break;
        case 'blocker': this.setSt(L, ST.BLOCK); this.emit({ t: 'droneOn', id: L.id, x: L.x, y: L.y }); break;
        case 'builder': this.setSt(L, ST.BUILD); L.bricks = BRICKS; L.brickIdx = 0; break;
        case 'basher': this.setSt(L, ST.BASH); break;
        case 'miner': this.setSt(L, ST.MINE); break;
        case 'digger': this.setSt(L, ST.DIG); break;
      }
      // Groove bonus: assignment landing on a beat (never required).
      const ph = this.beatPhase(this.frame);
      const onBeat = ph < 0.085 || ph > 0.915;
      if (onBeat) {
        this.grooveStreak++;
        this.onBeatCount++;
        this.groove += 100 * Math.min(8, this.grooveStreak);
      } else this.grooveStreak = 0;
      this.assignLog.push({ frame: this.frame, lem: idx, skill });
      this.emit({ t: 'assign', skill, id: L.id, x: L.x, y: L.y, onBeat, streak: this.grooveStreak });
      return true;
    }
    lemAt(x, y, skill) {
      // Pick the lemming under the cursor (prefers ones the skill applies to).
      let best = null, bd = 1e9;
      for (const L of this.lems) {
        if (L.st >= ST.DEAD || L.st === ST.EXIT) continue;
        const dx = Math.abs(L.x - x), dy = y - (L.y - 5);
        if (dx > 5 || Math.abs(dy) > 7) continue;
        let d = dx * dx + dy * dy;
        if (skill && !this.canAssign(L, skill)) d += 500;
        if (d < bd) { bd = d; best = L; }
      }
      return best;
    }

    /* ---------------- main step ---------------- */
    step() {
      this.events.length = 0;
      if (this.ended) return;
      this.frame++;
      const t = this.ticksAt(this.frame);
      while (this.tick < t) { this.tick++; this.doTick(); }
      if (!this.ended && this.frame >= this.timeLimit) this.finish('time');
    }
    finish(reason) {
      this.ended = true;
      this.endReason = reason;
      for (const L of this.lems) if (L.st === ST.BLOCK) this.emit({ t: 'droneOff', id: L.id });
      this.emit({ t: 'end', reason });
    }

    doTick() {
      const tk = this.tick;
      if (tk === 8) this.emit({ t: 'letsgo' });
      if (tk >= 14 && this.hatchOpen < 10) { this.hatchOpen++; if (this.hatchOpen === 1) this.emit({ t: 'hatch' }); }
      // spawn
      if (!this.nuking && this.spawned < this.count && tk >= this.nextSpawn) {
        const e = this.entrances[this.spawned % this.entrances.length];
        this.lems.push(this.newLem(this.spawned, e));
        this.spawned++;
        this.nextSpawn = tk + this.spawnInterval();
      }
      // nuke: one bomb per tick
      if (this.nuking) {
        while (this.nukeIdx < this.lems.length) {
          const L = this.lems[this.nukeIdx++];
          if (L.st < ST.OHNO && L.bomb < 0) { L.bomb = BOMB_TICKS; break; }
        }
      }
      for (let i = 0; i < this.lems.length; i++) {
        const L = this.lems[i];
        if (L.st >= ST.DEAD) continue;
        this.tickLem(L);
      }
      for (const tr of this.traps) if (tr.busy > 0) tr.busy--;
      if (this.silX0 >= 0) this.tickSilence();
      // stems
      const lvl = Math.min(5, Math.floor((this.saved * 5) / this.count + 1e-9));
      if (lvl > this.stemLevel) { this.stemLevel = lvl; this.emit({ t: 'stem', level: lvl }); }
      // end condition
      const active = this.lems.some((L) => L.st < ST.DEAD && !(L.st === ST.BLOCK && L.bomb < 0));
      if (!active && (this.spawned >= this.count || this.nuking) && tk > HATCH_OPEN) {
        if (this.endTimer < 0) this.endTimer = 24;
        else if (--this.endTimer === 0) this.finish('done');
      } else this.endTimer = -1;
    }

    newLem(id, e) {
      return {
        id, x: e.x, y: e.y + 14, dir: e.dir || 1, st: ST.FALL, t: 0, fall: 0,
        climber: false, floater: false, bomb: -1, bricks: 0, brickIdx: 0,
        panic: 0, hushed: false, walkN: 0, climbN: 0, blockerFlag: false,
      };
    }
    setSt(L, s) {
      if (L.st === ST.BLOCK && s !== ST.BLOCK && s !== ST.OHNO) this.emit({ t: 'droneOff', id: L.id });
      L.st = s; L.t = 0;
      if (s === ST.FALL) L.fall = 0;
      L.blockerFlag = s === ST.BLOCK || (s === ST.OHNO && L.blockerFlag);
    }

    /* ---------------- energy / silence ---------------- */
    addEnergy(x, amt, r) {
      if (this.silX0 < 0) return;
      const x0 = Math.max(this.silX0, x - r), x1 = Math.min(this.silX1, x + r);
      for (let i = x0; i <= x1; i++) {
        const f = 1 - Math.abs(i - x) / (r + 1);
        this.eng[i] = Math.min(3, this.eng[i] + amt * f);
      }
    }
    silAt(x) { return x >= 0 && x < this.W ? this.sil[x] : 0; }
    tickSilence() {
      const s = this.sil, e = this.eng, tmp = this.silTmp;
      const x0 = this.silX0, x1 = this.silX1, c = this.silCreep;
      tmp.set(s);
      for (let x = x0; x <= x1; x++) {
        const en = e[x];
        if (en > 0.12) {
          s[x] = Math.max(0, tmp[x] - en * 0.12);
        } else {
          const m = Math.max(tmp[x - 1], tmp[x + 1]);
          if (m > tmp[x] + 0.02) s[x] = Math.min(1, tmp[x] + (m - tmp[x]) * c);
        }
        e[x] = en * 0.88;
      }
      for (const sd of this.silSeeds) for (let x = sd[0]; x <= sd[1]; x++) {
        if (e[x] <= 0.12) s[x] = Math.min(1, s[x] + c * 0.25);
      }
    }

    /* ---------------- hazard / exit checks ---------------- */
    inRect(o, x, y) { return x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h; }
    checkHazards(L) {
      const s = L.st;
      if (s !== ST.BLOCK && s !== ST.OHNO && s !== ST.CLIMB && s !== ST.HOIST) {
        for (const ex of this.exits) {
          if (Math.abs(L.x - ex.x) <= 3 && L.y >= ex.y - 6 && L.y <= ex.y + 3) {
            if (L.bomb >= 0) L.bomb = -1;
            this.setSt(L, ST.EXIT);
            L.x = ex.x; L.y = ex.y;
            this.emit({ t: 'exit', id: L.id, x: L.x, y: L.y });
            this.addEnergy(L.x, 1.4, 48);
            return true;
          }
        }
      }
      for (const o of this.traps) {
        const ty = o.type;
        if (ty === 'water' || ty === 'lava') {
          if (this.inRect(o, L.x, L.y - 1)) {
            this.setSt(L, ty === 'water' ? ST.DROWN : ST.BURN);
            L.bomb = -1;
            this.emit({ t: ty === 'water' ? 'drown' : 'burn', id: L.id, x: L.x, y: L.y });
            return true;
          }
        } else if (ty === 'fire') {
          if (this.inRect(o, L.x, L.y - 2)) {
            this.setSt(L, ST.BURN); L.bomb = -1;
            this.emit({ t: 'burn', id: L.id, x: L.x, y: L.y });
            return true;
          }
        } else if (ty === 'crusher') {
          if (o.busy === 0 && Math.abs(L.x - o.x) <= 4 && L.y - 2 >= o.y - 12 && L.y - 2 <= o.y) {
            o.busy = 36; o.anim = 0;
            this.setSt(L, ST.DEAD); this.lost++;
            this.emit({ t: 'crush', id: L.id, x: L.x, y: L.y });
            return true;
          }
        }
      }
      return false;
    }

    /* ---------------- per-lemming tick ---------------- */
    tickLem(L) {
      const T = this.terrain;
      L.t++;
      // bomb countdown
      if (L.bomb > 0 && L.st < ST.OHNO) {
        L.bomb--;
        if (L.bomb === 0) {
          if (L.st === ST.WALK || L.st === ST.BLOCK || L.st === ST.SHRUG || L.st === ST.BUILD || L.st === ST.BASH || L.st === ST.MINE || L.st === ST.DIG) {
            this.setSt(L, ST.OHNO);
            this.emit({ t: 'ohno', id: L.id, x: L.x, y: L.y });
          } else { this.explode(L); return; }
        }
      }
      // silence
      const sv = this.silAt(L.x);
      L.hushed = sv > 0.5;
      if (sv > 0.8 && L.st === ST.WALK) L.panic = Math.min(200, L.panic + 1);
      else if (sv < 0.3) L.panic = Math.max(0, L.panic - 2);

      switch (L.st) {
        case ST.WALK: this.tWalk(L); break;
        case ST.FALL: this.tFall(L); break;
        case ST.FLOAT: this.tFloat(L); break;
        case ST.CLIMB: this.tClimb(L); break;
        case ST.HOIST:
          if (L.t >= 4) { L.x += L.dir; L.y = L.hoistY; this.setSt(L, ST.WALK); }
          break;
        case ST.BUILD: this.tBuild(L); break;
        case ST.SHRUG: if (L.t >= 8) this.setSt(L, ST.WALK); break;
        case ST.BASH: this.tBash(L); break;
        case ST.MINE: this.tMine(L); break;
        case ST.DIG: this.tDig(L); break;
        case ST.BLOCK:
          if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); break; }
          this.addEnergy(L.x, 0.6, 64);
          break;
        case ST.OHNO:
          if (L.blockerFlag) this.addEnergy(L.x, 0.6, 64);
          if (L.t >= 16) { this.explode(L); return; }
          if (!T.solid(L.x, L.y)) { L.y = Math.min(this.H + 20, L.y + 2); }
          break;
        case ST.SPLAT: if (L.t >= 16) this.kill(L); return;
        case ST.DROWN: if (L.t >= 18) this.kill(L); return;
        case ST.BURN: if (L.t >= 14) this.kill(L); return;
        case ST.EXIT:
          if (L.t >= 16) { L.st = ST.SAVED; this.saved++; this.emit({ t: 'saved', id: L.id }); }
          return;
      }
      if (L.st >= ST.DEAD) return;
      if (L.y >= this.H + 1) { this.kill(L, true); return; }
      this.checkHazards(L);
    }
    kill(L, fellOut) {
      if (L.st === ST.BLOCK || L.blockerFlag) this.emit({ t: 'droneOff', id: L.id });
      L.st = ST.DEAD; L.blockerFlag = false;
      this.lost++;
      if (fellOut) this.emit({ t: 'fallout', id: L.id, x: L.x });
    }
    explode(L) {
      this.terrain.removeEllipse(L.x, L.y - 5, 9, 10, 'bomb');
      this.emit({ t: 'explode', id: L.id, x: L.x, y: L.y - 5 });
      this.addEnergy(L.x, 2, 64);
      this.kill(L);
    }

    footstep(L) {
      L.walkN++;
      if (this.tick % this.stepTicks !== 0) return;
      const sv = this.silAt(L.x);
      if (sv > 0.6) return; // the Silence eats the sound
      const T = this.terrain;
      const i = L.y * this.W + L.x;
      if (L.y < 0 || L.y >= this.H || !T.mat[i]) return;
      const m = T.mat[i];
      const deg = m === M.STEEL ? -1 : T.deg[i];
      this.emit({ t: 'step', id: L.id, x: L.x, y: L.y, deg, oct: BT.octaveBand(L.y), steel: m === M.STEEL });
      this.addEnergy(L.x, 0.22, 14);
    }

    blockedBy(L, nx) {
      for (const B of this.lems) {
        if (B === L || !B.blockerFlag) continue;
        if (Math.abs(B.y - L.y) > 8) continue;
        if (L.dir > 0 && L.x < B.x - 4 && nx >= B.x - 4) return true;
        if (L.dir < 0 && L.x > B.x + 4 && nx <= B.x + 4) return true;
      }
      return false;
    }

    tWalk(L) {
      const T = this.terrain;
      if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); return; }
      // Silence: slow, off-beat, eventually lost.
      if (L.hushed && (this.tick & 1)) return;
      if (L.panic > 60 && this.tick % 16 === 0 && this.rand() < 0.25) L.dir = -L.dir;
      const nx = L.x + L.dir;
      if (this.blockedBy(L, nx)) { L.dir = -L.dir; return; }
      if (T.solid(nx, L.y - 1)) {
        let h = 0;
        while (h <= STEP_UP && T.solid(nx, L.y - 1 - h)) h++;
        if (h > STEP_UP) {
          if (L.climber) { this.setSt(L, ST.CLIMB); L.climbN = 0; }
          else L.dir = -L.dir;
          return;
        }
        L.x = nx; L.y -= h;
      } else if (T.solid(nx, L.y)) {
        L.x = nx;
      } else {
        let d = 1;
        while (d <= 3 && !T.solid(nx, L.y + d)) d++;
        L.x = nx;
        if (d <= 3) L.y += d;
        else { this.setSt(L, ST.FALL); return; }
      }
      this.footstep(L);
    }

    tFall(L) {
      const T = this.terrain;
      if (L.floater && L.fall > 14) { this.setSt(L, ST.FLOAT); this.emit({ t: 'float', id: L.id, x: L.x, y: L.y }); return; }
      for (let i = 0; i < 3; i++) {
        if (T.solid(L.x, L.y)) { this.land(L); return; }
        L.y++; L.fall++;
        if (L.y > this.H) return;
      }
      if (T.solid(L.x, L.y)) this.land(L);
    }
    land(L) {
      if (L.fall >= SPLAT_H) {
        this.setSt(L, ST.SPLAT);
        L.bomb = -1;
        this.emit({ t: 'splat', id: L.id, x: L.x, y: L.y });
      } else this.setSt(L, ST.WALK);
    }
    tFloat(L) {
      const T = this.terrain;
      this.addEnergy(L.x, 0.18, 24);
      const sp = L.t < 4 ? 1 : 2;
      for (let i = 0; i < sp; i++) {
        if (T.solid(L.x, L.y)) { this.setSt(L, ST.WALK); return; }
        L.y++;
        if (L.y > this.H) return;
      }
      if (T.solid(L.x, L.y)) this.setSt(L, ST.WALK);
    }
    tClimb(L) {
      const T = this.terrain;
      if (T.solid(L.x, L.y - 10)) { // bumped head: fall back
        L.dir = -L.dir; L.x += L.dir;
        this.setSt(L, ST.FALL);
        return;
      }
      if (!T.solid(L.x + L.dir, L.y - 1) && !T.solid(L.x + L.dir, L.y - 2)) { this.setSt(L, ST.FALL); return; }
      L.y--;
      L.climbN++;
      if (L.climbN % 4 === 0) {
        this.emit({ t: 'climb', id: L.id, x: L.x, y: L.y, n: L.climbN >> 2 });
        this.addEnergy(L.x, 0.5, 24);
      }
      if (!T.solid(L.x + L.dir, L.y - 1)) {
        L.hoistY = L.y;
        // find the actual top at x+dir
        let yy = L.y;
        while (yy < this.H && !T.solid(L.x + L.dir, yy)) yy++;
        L.hoistY = yy;
        this.setSt(L, ST.HOIST);
      }
    }
    tBuild(L) {
      const T = this.terrain;
      const c = (L.t - 1) % 8;
      if (c === 0) {
        if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); return; }
        const n = this.world.scale.length;
        const d = L.brickIdx % n;
        const y = L.y - 1;
        for (let k = 0; k < 6; k++) {
          const x = L.x + L.dir * k;
          if (x >= 0 && x < this.W && y >= 0 && !T.mat[y * this.W + x]) T.set(x, y, M.EARTH, d);
        }
        T.markDirty(Math.min(L.x, L.x + L.dir * 5), y, Math.max(L.x, L.x + L.dir * 5), y);
        this.emit({ t: 'brick', id: L.id, x: L.x, y: L.y, n: L.brickIdx, last: L.bricks <= 3 });
        this.addEnergy(L.x, 1.0, 40);
        L.brickIdx++;
        L.bricks--;
      } else if (c === 4 || c === 6) {
        const nx = L.x + L.dir;
        const ny = c === 4 ? L.y - 1 : L.y;
        if (T.anySolid(nx, ny - 8, nx, ny - 1)) { L.dir = -L.dir; this.setSt(L, ST.WALK); return; }
        L.x = nx; L.y = ny;
      } else if (c === 7) {
        if (L.bricks <= 0) { this.setSt(L, ST.SHRUG); this.emit({ t: 'shrug', id: L.id }); }
      }
    }
    tBash(L) {
      const T = this.terrain;
      if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); return; }
      if (L.t % 8 === 1) { this.emit({ t: 'bash', id: L.id, x: L.x, y: L.y }); this.addEnergy(L.x, 0.9, 34); }
      if (L.t % 2 !== 0) return;
      const d = L.dir, col = L.x + d * 4;
      if (T.blocked(col, L.y - 10, col, L.y - 1, d)) { this.setSt(L, ST.WALK); this.emit({ t: 'clank', x: col, y: L.y - 5 }); return; }
      T.removeRect(Math.min(L.x + d, col), L.y - 10, Math.max(L.x + d, col), L.y - 1, d);
      const nx = L.x + d;
      if (T.solid(nx, L.y)) L.x = nx;
      else {
        let dd = 1;
        while (dd <= 3 && !T.solid(nx, L.y + dd)) dd++;
        L.x = nx;
        if (dd <= 3) L.y += dd; else { this.setSt(L, ST.FALL); return; }
      }
      if (L.t > 6) {
        const a = Math.min(L.x + d * 4, L.x + d * 12), b = Math.max(L.x + d * 4, L.x + d * 12);
        let any = false;
        for (let x = a; x <= b && !any; x++) {
          if (x < 0 || x >= this.W) { any = false; break; }
          for (let y = L.y - 10; y <= L.y - 1; y++) if (T.solid(x, y)) { any = true; break; }
        }
        if (!any) this.setSt(L, ST.WALK);
      }
    }
    tMine(L) {
      const T = this.terrain;
      if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); return; }
      const c = (L.t - 1) % 6, d = L.dir;
      if (c === 0) {
        const a = Math.min(L.x + d, L.x + d * 3), b = Math.max(L.x + d, L.x + d * 3);
        if (T.blocked(a, L.y - 10, b, L.y, d)) { this.setSt(L, ST.WALK); this.emit({ t: 'clank', x: L.x + d * 2, y: L.y - 4 }); return; }
        T.removeRect(a, L.y - 10, b, L.y, d);
        this.emit({ t: 'mine', id: L.id, x: L.x, y: L.y, n: L.t });
        this.addEnergy(L.x, 0.8, 30);
      } else if (c === 4) {
        L.x += d * 2; L.y += 1;
        if (!T.solid(L.x, L.y)) { this.setSt(L, ST.FALL); }
      }
    }
    tDig(L) {
      const T = this.terrain;
      if (L.t % 2 !== 0) return;
      if (L.t % 8 === 0) { this.emit({ t: 'dig', id: L.id, x: L.x, y: L.y, n: L.t >> 3 }); this.addEnergy(L.x, 0.8, 30); }
      if (T.blocked(L.x - 4, L.y, L.x + 4, L.y, 'dig')) { this.setSt(L, ST.WALK); this.emit({ t: 'clank', x: L.x, y: L.y }); return; }
      T.removeRect(L.x - 4, L.y, L.x + 4, L.y, 'dig');
      L.y++;
      if (!T.solid(L.x, L.y) && !T.solid(L.x - 1, L.y) && !T.solid(L.x + 1, L.y)) this.setSt(L, ST.FALL);
      else if (!T.solid(L.x, L.y)) { /* keep digging on partial ground */ }
    }

    /* ---------------- summaries ---------------- */
    outCount() { let n = 0; for (const L of this.lems) if (L.st < ST.DEAD) n++; return n; }
    savedPct() { return Math.floor((this.saved * 100) / this.count); }
    needPct() { return Math.ceil((this.need * 100) / this.count); }
  }
  BT.Sim = Sim;

  /* Run a recorded command list headlessly. Returns the finished sim. */
  BT.runRecording = function (def, cmds, maxFrames, onFrame) {
    const sim = new Sim(def);
    let ci = 0;
    const list = (cmds || []).slice().sort((a, b) => a.frame - b.frame);
    const lim = maxFrames || sim.timeLimit + 10;
    while (!sim.ended && sim.frame < lim) {
      while (ci < list.length && list[ci].frame <= sim.frame) {
        BT.applyCommand(sim, list[ci]);
        ci++;
      }
      sim.step();
      if (onFrame) onFrame(sim);
    }
    return sim;
  };
  BT.applyCommand = function (sim, c) {
    if (c.skill === 'rr') sim.setRR(c.value);
    else if (c.skill === 'nuke') sim.nuke();
    else return sim.assign(c.lemmingIndex, c.skill);
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
