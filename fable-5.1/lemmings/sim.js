/* =====================================================================
   Lemmings: Beat Tribe — deterministic simulation core (sim.js)
   Pure logic: no DOM, no audio, no Math.random. Runs in browser + node.
   Fixed 60 Hz timestep, seeded RNG, per-pixel destructible terrain.
   ===================================================================== */
(function (root) {
  'use strict';

  var SKILLS = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
  var T = { EMPTY: 0, STEEL: 8, OWR: 9, OWL: 10 }; // 1..7 = note terrain (scale degree)
  var H = 160;           // level height (viewport is 320x160, panel below)
  var VIEW_W = 320;
  var MAXFALL = 62;      // safe fall distance in px
  var BOMB_TICKS = 75;   // 5 seconds at 15 ticks/sec

  /* ---------- World / genre definitions (shared by sim, audio, render) ---------- */
  var WORLDS = [
    { name: 'AMIGA CHIP GARDEN', tag: 'CHIP', bpm: 125, root: 60, scale: [0, 2, 4, 7, 9],
      melody: [1, 2, 3, 5, 6, 5, 3, 2],
      colors: [0x3fb43f, 0x8cd93a, 0xa0622e, 0x8e8ea6, 0xe8a940, 0x2f7f3a, 0xd9c48a],
      steel: 0x6c6c78, bg: [0x4a7cd8, 0x9fd0ff], accent: 0xfff060 },
    { name: 'ACID WAREHOUSE', tag: 'ACID', bpm: 132, root: 52, scale: [0, 1, 3, 5, 7, 8, 10],
      melody: [1, 2, 1, 4, 5, 4, 7, 5],
      colors: [0xff2fa0, 0x29e6ff, 0xf5f52a, 0x8dff2a, 0xff8c1a, 0xa040ff, 0x5a7ea8],
      steel: 0x55606a, bg: [0x101018, 0x2a2436], accent: 0x8dff2a },
    { name: 'SYNTHWAVE SUNSET', tag: 'WAVE', bpm: 108, root: 50, scale: [0, 2, 3, 5, 7, 9, 10],
      melody: [1, 3, 5, 6, 5, 3, 2, 7],
      colors: [0xff3c8c, 0x9a4cff, 0x2ee6e6, 0xc0c8d8, 0xff9a3c, 0x3c6cff, 0x2ab0a0],
      steel: 0x60687a, bg: [0x1a0a3a, 0xff6a3c], accent: 0xffd23c },
    { name: 'JUNGLE BREAKBEAT CAVES', tag: 'JNGL', bpm: 160, root: 52, scale: [0, 3, 5, 7, 10],
      melody: [1, 3, 4, 5, 4, 3, 2, 1],
      colors: [0x1fd0a8, 0x9cff3c, 0x9c5cff, 0x2850b0, 0x40e0ff, 0x30a050, 0x6a8a3a],
      steel: 0x4a5058, bg: [0x060a14, 0x0c1a2a], accent: 0x9cff3c },
    { name: 'GRAND ORCHESTRAL FINALE', tag: 'ORCH', bpm: 96, root: 53, scale: [0, 2, 4, 6, 7, 9, 11],
      melody: [1, 3, 5, 7, 5, 4, 2, 1],
      colors: [0xf0ece0, 0xe0b040, 0xd8c8a8, 0xd08890, 0x8898b8, 0xfff8e8, 0xb07840],
      steel: 0x707880, bg: [0x202838, 0x6a7898], accent: 0xffe080 }
  ];

  /* ---------- Seeded RNG (mulberry32) ---------- */
  function makeRng(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Music helpers ---------- */
  // Scale degree (1-based, wraps into higher octaves) -> midi note
  function degreeToMidi(world, degree, octave) {
    var sc = world.scale, n = sc.length;
    var d = degree - 1;
    var oct = Math.floor(d / n);
    var idx = ((d % n) + n) % n;
    return world.root + sc[idx] + 12 * (oct + (octave || 0));
  }
  function octaveBand(y) { return y < 60 ? 1 : (y > 115 ? -1 : 0); }

  /* ---------- Terrain construction from primitives ---------- */
  function buildTerrain(level) {
    var W = level.width, t = new Uint8Array(W * H);
    var world = WORLDS[level.world];
    var mel = level.melody || world.melody;
    var blockW = level.melodyBlock || 8;
    function autoType(x) { return mel[((x / blockW) | 0) % mel.length]; }
    function put(x, y, type, replace) {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      var i = y * W + x;
      if (!replace && t[i] === T.STEEL) return;
      t[i] = type < 0 ? autoType(x) : type;
    }
    function rect(x, y, w, h, type, replace) {
      for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) put(xx, yy, type, replace);
    }
    function ellipse(cx, cy, rx, ry, type, replace) {
      for (var yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
        for (var xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
          var dx = (xx - cx) / rx, dy = (yy - cy) / ry;
          if (dx * dx + dy * dy <= 1) put(xx, yy, type, replace);
        }
    }
    function ramp(x0, y0, x1, y1, bottom, type) {
      var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
      for (var xx = xa; xx <= xb; xx++) {
        var f = (xb === xa) ? 0 : (xx - x0) / (x1 - x0);
        var top = Math.round(y0 + (y1 - y0) * f);
        for (var yy = top; yy < bottom; yy++) put(xx, yy, type);
      }
    }
    var ops = level.terrain;
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i], k = o[0];
      var ty = (o.length > 5 && typeof o[5] === 'number') ? o[5] : -1;
      if (k === 'rect') rect(o[1], o[2], o[3], o[4], ty);
      else if (k === 'ellipse') ellipse(o[1], o[2], o[3], o[4], ty);
      else if (k === 'ramp') ramp(o[1], o[2], o[3], o[4], o[5], (o.length > 6 ? o[6] : -1));
      else if (k === 'erase') rect(o[1], o[2], o[3], o[4], 0, true);
      else if (k === 'eraseEllipse') ellipse(o[1], o[2], o[3], o[4], 0, true);
      else if (k === 'steel') rect(o[1], o[2], o[3], o[4], T.STEEL, true);
      else if (k === 'owr') rect(o[1], o[2], o[3], o[4], T.OWR, true);
      else if (k === 'owl') rect(o[1], o[2], o[3], o[4], T.OWL, true);
      else if (k === 'pillar') { // decorative pillar with capital: x, top, w, bottom, type
        rect(o[1], o[2], o[3], o[4] - o[2], ty); rect(o[1] - 2, o[2], o[3] + 4, 3, ty);
      }
    }
    return t;
  }

  /* ---------- Simulation ---------- */
  function Sim(level, opts) {
    opts = opts || {};
    this.level = level;
    this.world = WORLDS[level.world];
    this.bpm = level.bpm || this.world.bpm;
    this.W = level.width; this.H = H;
    this.terrain = buildTerrain(level);
    this.rng = makeRng((level.seed || 1) * 7919 + 17);
    this.onEvent = opts.onEvent || function () {};
    this.frame = 0;
    this.lemmings = [];
    this.total = level.lemmings;
    this.needed = Math.ceil(level.lemmings * level.need / 100);
    this.spawned = 0; this.saved = 0; this.dead = 0;
    this.rate = level.rate; this.rateMin = level.rate;
    this.nextSpawn = 60;
    this.timeLimit = level.time * 60 * 60; // minutes -> frames at 60 Hz
    this.skills = {};
    for (var i = 0; i < SKILLS.length; i++) this.skills[SKILLS[i]] = (level.skills[SKILLS[i]] || 0);
    this.status = 'playing';
    this.result = null;
    this.groove = 0; this.combo = 0; this.assignments = 0;
    this.nuked = false;
    this.hatchOpen = false;
    this.stems = 0;
    this.exitFlash = 0;
    this.lastExitFrame = 0;
    this.hazards = level.hazards || [];
    this.silence = null;
    if (level.silence) {
      var s = level.silence;
      this.silence = { front: s.start, origin: s.start, dir: s.dir, speed: s.speed, limit: s.limit, y0: s.y0 || 0, y1: s.y1 || H };
    }
  }

  Sim.prototype.inBounds = function (x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; };
  Sim.prototype.get = function (x, y) { return this.inBounds(x, y) ? this.terrain[y * this.W + x] : 0; };
  Sim.prototype.solid = function (x, y) {
    if (x < 0 || x >= this.W) return true;   // level edges act as walls
    if (y < 0 || y >= this.H) return false;
    return this.terrain[y * this.W + x] !== 0;
  };
  Sim.prototype.isHard = function (x, y, dir) { // steel, or one-way wall against dir
    var v = this.get(x, y);
    if (v === T.STEEL) return true;
    if (dir === 1 && v === T.OWL) return true;
    if (dir === -1 && v === T.OWR) return true;
    return false;
  };
  Sim.prototype.erase = function (x, y) {
    if (!this.inBounds(x, y)) return false;
    var i = y * this.W + x;
    if (this.terrain[i] === 0 || this.terrain[i] === T.STEEL) return false;
    this.terrain[i] = 0; return true;
  };
  Sim.prototype.eraseCircle = function (cx, cy, r) {
    var n = 0;
    for (var y = cy - r; y <= cy + r; y++) for (var x = cx - r; x <= cx + r; x++) {
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r + r * 0.5) { if (this.erase(x, y)) n++; }
    }
    return n;
  };
  Sim.prototype.hardInCircle = function (cx, cy, r, dir) {
    for (var y = cy - r; y <= cy + r; y++) for (var x = cx - r; x <= cx + r; x++) {
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r && this.isHard(x, y, dir)) return true;
    }
    return false;
  };
  Sim.prototype.anySolidRect = function (x0, x1, y0, y1) {
    var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    for (var y = y0; y <= y1; y++) for (var x = xa; x <= xb; x++) if (this.inBounds(x, y) && this.terrain[y * this.W + x] !== 0) return true;
    return false;
  };
  Sim.prototype.hardInRect = function (x0, x1, y0, y1, dir) {
    var xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    for (var y = y0; y <= y1; y++) for (var x = xa; x <= xb; x++) if (this.isHard(x, y, dir)) return true;
    return false;
  };
  Sim.prototype.degreeAt = function (x, y) {
    var v = this.get(x, y);
    return (v >= 1 && v <= 7) ? v : 0;
  };

  Sim.prototype.emit = function (type, l, extra) {
    var ev = { type: type, frame: this.frame, x: l ? l.x : 0, y: l ? l.y : 0, lem: l ? l.id : -1 };
    if (extra) for (var k in extra) ev[k] = extra[k];
    if (this.silence && l && ev.x !== undefined) this.pushSilence(ev.x, type);
    this.onEvent(ev);
  };

  Sim.prototype.pushSilence = function (x, type) {
    var s = this.silence;
    var power = (type === 'drone' ? 0.6 : type === 'brick' ? 6 : type === 'step' ? 1.5 : type === 'explode' ? 24 : 3);
    if (Math.abs(x - s.front) < 56) {
      s.front -= s.dir * power;
      if (s.dir < 0 && s.front > s.origin) s.front = s.origin;
      if (s.dir > 0 && s.front < s.origin) s.front = s.origin;
    }
  };
  Sim.prototype.inSilence = function (x, y) {
    var s = this.silence;
    if (!s) return false;
    if (y < s.y0 || y > s.y1) return false;
    return (x - s.front) * s.dir < 0;
  };

  Sim.prototype.rateDelay = function () {
    return Math.round((99 - this.rate) / 2 + 4) * 4;
  };

  Sim.prototype.spawn = function () {
    var e = this.level.entrance;
    var l = { id: this.lemmings.length, x: e.x, y: e.y, dir: (this.level.dir || 1), state: 'faller', t: 0,
      acc: 0, fall: 0, climber: false, floater: false, bomb: -1, bricks: 0, walked: 0, sil: 0,
      anim: 0, alive: true, exited: false, climbNotes: 0 };
    this.lemmings.push(l);
    this.spawned++;
    this.emit('hatch', l);
  };

  /* ---- Public control API ---- */
  Sim.prototype.setRate = function (r) {
    r = Math.max(this.rateMin, Math.min(99, r | 0));
    this.rate = r; return r;
  };
  Sim.prototype.nuke = function () {
    if (this.nuked) return false;
    this.nuked = true;
    var n = 0;
    for (var i = 0; i < this.lemmings.length; i++) {
      var l = this.lemmings[i];
      if (l.alive && !isDying(l) && l.state !== 'exiting' && l.bomb < 0) { l.bomb = BOMB_TICKS + n; n++; }
    }
    this.emit('nuke', null);
    return true;
  };
  function isDying(l) { return l.state === 'splat' || l.state === 'drown' || l.state === 'burn' || l.state === 'ohno' || l.state === 'exploding'; }
  var GROUND_STATES = { walker: 1, shrugger: 1, builder: 1, basher: 1, miner: 1, digger: 1 };

  Sim.prototype.canAssign = function (l, skill) {
    if (!l || !l.alive || isDying(l) || l.state === 'exiting') return false;
    if (this.skills[skill] <= 0) return false;
    switch (skill) {
      case 'climber': return !l.climber && l.state !== 'blocker';
      case 'floater': return !l.floater && l.state !== 'blocker';
      case 'bomber': return l.bomb < 0;
      case 'blocker': return !!GROUND_STATES[l.state] && this.solid(l.x, l.y);
      default: return !!GROUND_STATES[l.state] && l.state !== skill && this.solid(l.x, l.y);
    }
  };
  Sim.prototype.assign = function (idx, skill) {
    var l = this.lemmings[idx];
    if (!this.canAssign(l, skill)) return false;
    this.skills[skill]--;
    this.assignments++;
    if (skill === 'climber') l.climber = true;
    else if (skill === 'floater') l.floater = true;
    else if (skill === 'bomber') l.bomb = BOMB_TICKS;
    else { l.state = skill; l.t = 0; l.bricks = 0; if (skill === 'blocker') this.emit('drone_on', l); }
    // On-beat groove bonus (never required)
    var beat = this.frame * this.bpm / 3600, ph = beat - Math.floor(beat);
    if (ph < 0.12 || ph > 0.88) {
      this.combo++;
      this.groove += 100 + 25 * Math.min(this.combo, 8);
      this.emit('sparkle', l, { combo: this.combo });
    } else { this.combo = 0; this.groove += 10; }
    this.emit('assign', l, { skill: skill });
    return true;
  };
  Sim.prototype.applyCommand = function (c) {
    if (c.skill !== undefined) return this.assign(c.lemmingIndex, c.skill);
    if (c.rr !== undefined) { this.setRate(c.rr); return true; }
    if (c.nuke) return this.nuke();
    return false;
  };

  /* ---- Lemming death / exit ---- */
  Sim.prototype.kill = function (l, how) {
    if (!l.alive) return;
    if (l.state === 'blocker') this.emit('drone_off', l);
    l.state = how; l.t = 0;
    if (how === 'gone') { l.alive = false; this.dead++; }
  };
  Sim.prototype.finishDeath = function (l) { l.alive = false; this.dead++; };
  Sim.prototype.finishExit = function (l) {
    l.alive = false; l.exited = true; this.saved++;
    this.lastExitFrame = this.frame;
    var pct = this.saved * 100 / this.total;
    var st = Math.min(5, Math.floor(pct / 20 + 1e-9));
    if (st > this.stems) { this.stems = st; this.emit('stem', l, { stem: st }); }
  };

  /* ---- Main update: one 60 Hz frame ---- */
  Sim.prototype.update = function () {
    if (this.status !== 'playing') return;
    this.frame++;
    var f = this.frame;
    if (f === 20 && !this.hatchOpen) { this.hatchOpen = true; this.emit('letsgo', null, { x: this.level.entrance.x, y: this.level.entrance.y }); }
    if (f >= this.nextSpawn && this.spawned < this.total && !this.nuked) {
      this.spawn(); this.nextSpawn = f + this.rateDelay();
    }
    if (this.silence) {
      var s = this.silence;
      s.front += s.dir * s.speed;
      if (s.dir < 0 && s.front < s.limit) s.front = s.limit;
      if (s.dir > 0 && s.front > s.limit) s.front = s.limit;
    }
    if (this.exitFlash > 0) this.exitFlash--;
    var alive = 0;
    for (var i = 0; i < this.lemmings.length; i++) {
      var l = this.lemmings[i];
      if (!l.alive) continue;
      alive++;
      var sil = this.inSilence(l.x, l.y);
      if (sil) { l.sil++; } else if (l.sil > 0) l.sil = Math.max(0, l.sil - 2);
      l.acc += sil ? 2 : 3;
      while (l.acc >= 12 && l.alive) { l.acc -= 12; this.tick(l); }
      if (l.alive && sil && l.sil > 300 && l.state === 'walker' && (f % 45 === 0) && this.rng() < 0.5) { l.dir = -l.dir; this.emit('panic', l); }
      // Crushers are frame-timed
      if (l.alive && !isDying(l) && l.state !== 'exiting') {
        for (var h = 0; h < this.hazards.length; h++) {
          var hz = this.hazards[h];
          if (hz.type === 'crusher' && this.crusherClosed(hz) && l.x >= hz.x && l.x < hz.x + hz.w && l.y >= hz.y && l.y < hz.y + hz.h) {
            this.kill(l, 'splat'); this.emit('crush', l);
          }
        }
      }
      if (l.state === 'blocker' && (f % 20 === 0)) this.emit('drone', l);
    }
    if (f >= this.timeLimit) this.finish('time');
    else if (this.spawned >= this.total && alive === 0) this.finish('clear');
    else if (this.nuked && alive === 0) this.finish('nuke');
  };
  Sim.prototype.crusherClosed = function (hz) {
    var p = (this.frame + (hz.phase || 0)) % hz.period;
    return p < (hz.closed || 30);
  };
  Sim.prototype.finish = function (why) {
    this.status = 'done';
    // unspawned lemmings count as lost
    this.result = { saved: this.saved, needed: this.needed, total: this.total, won: this.saved >= this.needed,
      groove: this.groove, why: why, frames: this.frame, timeLeft: Math.max(0, this.timeLimit - this.frame) };
    this.emit('finish', null, this.result);
  };

  /* ---- Per-lemming tick (15 Hz nominal) ---- */
  Sim.prototype.tick = function (l) {
    var W = this.W, d = l.dir, i;
    l.anim++;
    // Bomber countdown runs regardless of state
    if (l.bomb > 0 && !isDying(l) && l.state !== 'exiting') {
      l.bomb--;
      if (l.bomb === 0) {
        if (l.state === 'blocker') this.emit('drone_off', l);
        l.state = 'ohno'; l.t = 0; this.emit('ohno', l); return;
      }
    }
    switch (l.state) {
      case 'walker': {
        var nx = l.x + d;
        if (nx < 0 || nx >= W) { l.dir = -d; break; }
        if (this.blockedBy(l, nx)) { l.dir = -d; break; }
        if (this.solid(nx, l.y)) {
          var ry = l.y, up = 0;
          while (up < 7 && this.solid(nx, ry - 1)) { ry--; up++; }
          if (up >= 7) {
            if (l.climber) { l.state = 'climber'; l.t = 0; l.climbNotes = 0; } else l.dir = -d;
            break;
          }
          l.x = nx; l.y = ry;
        } else {
          var ry2 = l.y + 1, down = 1;
          while (down <= 3 && !this.solid(nx, ry2)) { ry2++; down++; }
          if (down > 3) { l.x = nx; l.state = 'faller'; l.fall = 0; l.t = 0; break; }
          l.x = nx; l.y = ry2;
        }
        l.walked++;
        if (l.walked % 8 === 0) this.footstep(l);
        break;
      }
      case 'faller': {
        for (i = 0; i < 3; i++) {
          l.y++; l.fall++;
          if (l.y >= this.H) { this.emit('fellout', l); this.kill(l, 'gone'); return; }
          if (this.solid(l.x, l.y)) {
            if (l.fall > MAXFALL && !l.floater) { this.kill(l, 'splat'); this.emit('splat', l); }
            else { l.state = 'walker'; l.t = 0; }
            break;
          }
        }
        if (l.state === 'faller' && l.floater && l.fall >= 8) { l.state = 'floater'; l.t = 0; this.emit('float', l); }
        break;
      }
      case 'floater': {
        l.t++;
        var step = (l.t & 1) ? 2 : 1;
        for (i = 0; i < step; i++) {
          l.y++;
          if (l.y >= this.H) { this.emit('fellout', l); this.kill(l, 'gone'); return; }
          if (this.solid(l.x, l.y)) { l.state = 'walker'; l.t = 0; break; }
        }
        break;
      }
      case 'climber': {
        l.t++;
        if (this.solid(l.x, l.y - 10)) { l.dir = -d; l.state = 'faller'; l.fall = 0; l.t = 0; break; }
        l.y--;
        if (l.y < 0) { l.y = 0; }
        if (!this.solid(l.x + d, l.y - 1)) { l.x += d; l.state = 'walker'; l.t = 0; break; }
        if (l.t % 4 === 0) { l.climbNotes++; this.emit('climb', l, { degree: 1 + (l.climbNotes % 5), oct: 1 }); }
        break;
      }
      case 'builder': {
        l.t++;
        if (l.t % 10 !== 0) break;
        var bx = l.x, by = l.y;
        if (bx + 2 * d < 0 || bx + 2 * d >= W ||
            this.anySolidRect(bx + d, bx + 2 * d, by - 10, by - 4)) {
          l.state = 'walker'; l.dir = -d; l.t = 0; break;
        }
        for (i = 1; i <= 6; i++) {
          var px = bx + d * i;
          if (this.inBounds(px, by - 1) && this.terrain[(by - 1) * W + px] === 0) this.terrain[(by - 1) * W + px] = [1, 3, 5][l.bricks % 3];
        }
        l.x += 2 * d; l.y -= 1; l.bricks++;
        var pop = 0; while (pop < 3 && this.solid(l.x, l.y - 1)) { l.y--; pop++; }
        this.emit('brick', l, { degree: [1, 3, 5, 8, 10, 12][l.bricks % 6], oct: 0, n: l.bricks });
        if (l.bricks >= 12) { l.state = 'shrugger'; l.t = 0; }
        break;
      }
      case 'shrugger': { l.t++; if (l.t >= 6) { l.state = 'walker'; l.t = 0; } break; }
      case 'basher': {
        l.t++;
        if (l.t % 2) break;
        if (this.hardInRect(l.x + d, l.x + 2 * d, l.y - 8, l.y - 1, d)) { l.state = 'walker'; l.t = 0; this.emit('clank', l); break; }
        if (!this.anySolidRect(l.x + d, l.x + 6 * d, l.y - 9, l.y - 1)) { l.state = 'walker'; l.t = 0; break; }
        for (i = 1; i <= 3; i++) for (var yy = l.y - 9; yy <= l.y - 1; yy++) this.erase(l.x + d * i, yy);
        l.x += d;
        if (!this.solid(l.x, l.y)) {
          var ry3 = l.y + 1, dn = 1;
          while (dn <= 3 && !this.solid(l.x, ry3)) { ry3++; dn++; }
          if (dn > 3) { l.state = 'faller'; l.fall = 0; l.t = 0; break; }
          l.y = ry3;
        }
        if (l.t % 8 === 0) this.emit('bash', l, { degree: this.degreeAt(l.x, l.y) || 1, oct: -1 });
        break;
      }
      case 'miner': {
        l.t++;
        if (l.t % 3) break;
        var cx = l.x + 4 * d, cy = l.y - 4;
        if (this.hardInCircle(cx, cy, 6, 0)) { l.state = 'walker'; l.t = 0; this.emit('clank', l); break; }
        this.eraseCircle(cx, cy, 6);
        l.x += 2 * d; l.y += 2;
        if (l.x < 0 || l.x >= W) { l.x = Math.max(0, Math.min(W - 1, l.x)); l.state = 'walker'; l.dir = -d; break; }
        if (l.y >= this.H) { this.emit('fellout', l); this.kill(l, 'gone'); return; }
        if (!this.solid(l.x, l.y)) { l.state = 'faller'; l.fall = 0; l.t = 0; break; }
        this.emit('mine', l, { accent: ((l.t / 3) % 3) === 0 });
        break;
      }
      case 'digger': {
        l.t++;
        if (l.t % 3) break;
        if (this.hardInRect(l.x - 4, l.x + 4, l.y, l.y, 0)) { l.state = 'walker'; l.t = 0; this.emit('clank', l); break; }
        for (i = -4; i <= 4; i++) this.erase(l.x + i, l.y);
        l.y++;
        if (l.y >= this.H) { this.emit('fellout', l); this.kill(l, 'gone'); return; }
        this.emit('dig', l, { snare: ((l.t / 3) & 1) === 1 });
        if (!this.anySolidRect(l.x - 4, l.x + 4, l.y, l.y)) { l.state = 'faller'; l.fall = 0; l.t = 0; break; }
        if (!this.solid(l.x, l.y)) { // slide to nearest solid in the pit row
          for (i = 1; i <= 4; i++) { if (this.solid(l.x + i, l.y)) { l.x += i; break; } if (this.solid(l.x - i, l.y)) { l.x -= i; break; } }
        }
        break;
      }
      case 'blocker': {
        if (!this.solid(l.x, l.y)) { this.emit('drone_off', l); l.state = 'faller'; l.fall = 0; l.t = 0; }
        break;
      }
      case 'ohno': {
        l.t++;
        if (l.t >= 8) {
          this.eraseCircle(l.x, l.y - 4, 9);
          this.emit('explode', l);
          l.state = 'exploding'; this.finishDeath(l);
        }
        break;
      }
      case 'splat': case 'drown': case 'burn': {
        l.t++; if (l.t >= 10) { this.finishDeath(l); }
        break;
      }
      case 'exiting': {
        l.t++; if (l.t >= 8) this.finishExit(l);
        break;
      }
    }
    if (!l.alive || isDying(l) || l.state === 'exiting') return;
    // Hazards
    for (var h = 0; h < this.hazards.length; h++) {
      var hz = this.hazards[h];
      if (hz.type === 'crusher') continue;
      if (l.x >= hz.x && l.x < hz.x + hz.w && l.y >= hz.y && l.y < hz.y + hz.h) {
        if (hz.type === 'water') { this.kill(l, 'drown'); this.emit('drown', l); }
        else { this.kill(l, 'burn'); this.emit('burn', l); }
        return;
      }
    }
    // Exit
    var ex = this.level.exit;
    if (l.state !== 'blocker' && Math.abs(l.x - ex.x) <= 4 && l.y >= ex.y - 4 && l.y <= ex.y + 2) {
      l.state = 'exiting'; l.t = 0; this.exitFlash = 30;
      this.emit('exit', l, { n: this.saved + 1 });
    }
  };

  Sim.prototype.blockedBy = function (l, nx) {
    var ls = this.lemmings;
    for (var i = 0; i < ls.length; i++) {
      var b = ls[i];
      if (b === l || !b.alive || b.state !== 'blocker') continue;
      if (Math.abs(nx - b.x) <= 3 && (b.x - nx) * l.dir > 0 && l.y >= b.y - 8 && l.y <= b.y + 8) return true;
    }
    return false;
  };

  Sim.prototype.footstep = function (l) {
    var deg = this.degreeAt(l.x, l.y);
    var sil = this.inSilence(l.x, l.y);
    this.emit('step', l, { degree: deg, oct: octaveBand(l.y), muted: sil });
  };

  /* ---- Query helpers for UI ---- */
  Sim.prototype.lemmingAt = function (x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < this.lemmings.length; i++) {
      var l = this.lemmings[i];
      if (!l.alive || isDying(l) || l.state === 'exiting') continue;
      var dx = Math.abs(l.x - x), dy = Math.abs((l.y - 5) - y);
      if (dx <= 5 && dy <= 7) { var dd = dx + dy; if (dd < bd) { bd = dd; best = l; } }
    }
    return best;
  };
  Sim.prototype.aliveCount = function () {
    var n = 0; for (var i = 0; i < this.lemmings.length; i++) if (this.lemmings[i].alive) n++; return n;
  };
  Sim.prototype.beat = function () { return this.frame * this.bpm / 3600; };

  var api = { Sim: Sim, SKILLS: SKILLS, T: T, H: H, VIEW_W: VIEW_W, WORLDS: WORLDS, makeRng: makeRng,
    degreeToMidi: degreeToMidi, octaveBand: octaveBand, buildTerrain: buildTerrain, isDying: isDying, MAXFALL: MAXFALL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BT = api;
})(typeof window !== 'undefined' ? window : this);
