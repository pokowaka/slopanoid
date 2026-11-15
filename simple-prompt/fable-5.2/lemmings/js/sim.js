/* BEAT TRIBE - deterministic lemming simulation.
 * Fixed 60 Hz timestep, seeded RNG, no rendering and no audio: the sim only
 * *emits* events (`sim.ev`) and a quantized song log (`sim.log`).  The same code
 * runs in the browser and under Node, which is how every solution demo is verified. */
(function (g) {
  'use strict';
  var BT = g.BT, M = BT.MAT, TICK = BT.TICK;
  var S = BT.ST = { FALL: 0, WALK: 1, CLIMB: 2, HOIST: 3, FLOAT: 4, BUILD: 5, SHRUG: 6, BASH: 7, MINE: 8, DIG: 9,
    BLOCK: 10, OHNO: 11, SPLAT: 12, DROWN: 13, BURN: 14, EXIT: 15, GONE: 16 };
  BT.ST_NAMES = ['FALLER', 'WALKER', 'CLIMBER', 'CLIMBER', 'FLOATER', 'BUILDER', 'BUILDER', 'BASHER', 'MINER', 'DIGGER',
    'BLOCKER', 'BOMBER', 'SPLAT', 'DROWNER', 'BURNER', 'HOME', ''];

  var LOOK = BT.LOOK = 6;          // frames of lookahead between a quantize decision and the audible step
  var MAX_FALL = 60;               // pixels a lemming survives falling
  var FUSE = 5 * 60;               // bomber countdown in frames
  var BRICKS = 12;
  var BEAT_TOL = 5;                // +-frames that still count as "on the beat"
  var PANIC_AFTER = 45, PANIC_TICKS = 40;   // ticks of deep Silence before a lemming panics / how long it wanders

  // Lemming-triggered voices.  [grid in 1/16 steps, max notes per step, silence radius, silence push]
  var VOICES = BT.VOICES = ['step', 'climb', 'float', 'build', 'bash', 'mine', 'kick', 'snare', 'crash', 'ohno', 'exit', 'crush', 'drone'];
  var VP = {
    step: [2, 4, 1, 0.22], climb: [1, 2, 1, 0.15], float: [2, 2, 2, 0.2], build: [2, 2, 3, 0.4],
    bash: [2, 2, 2, 0.3], mine: [1, 2, 2, 0.25], kick: [2, 1, 3, 0.3], snare: [2, 1, 3, 0.3],
    crash: [1, 1, 4, 0.6], ohno: [1, 1, 0, 0], exit: [1, 1, 3, 0.5], crush: [1, 1, 0, 0], drone: [4, 1, 4, 0.45]
  };
  var VIDX = {}; VOICES.forEach(function (v, i) { VIDX[v] = i; });
  var ARP = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7];        // builder: rising arpeggio, one note per brick
  var DIGPAT = ['kick', null, 'snare', null, 'kick', 'kick', 'snare', null];

  function Sim(level) {
    var b = BT.buildLevel(level), k;
    this.level = level; this.world = BT.WORLDS[level.world];
    this.T = b.T; this.objs = b.objs;
    this.rng = new BT.RNG(level.seed || (4242 + level.index * 977));
    this.sf = this.world.sf; this.bf = this.sf * 4;
    this.mel = level.melody;
    this.frame = 0;
    this.lems = []; this.blockers = [];
    this.num = level.num; this.spawned = 0; this.saved = 0; this.dead = 0;
    this.rrMin = level.rr; this.rr = level.rr;
    this.skills = {};
    for (k = 0; k < BT.SKILLS.length; k++) this.skills[BT.SKILLS[k]] = level.skills[BT.SKILLS[k]] || 0;
    this.timeFrames = level.time * 60;
    this.spawnWait = 100;
    this.nuked = false; this.nukeIdx = 0;
    this.over = false; this.endWait = 0; this.pct = 0; this.win = false;
    this.ev = [];                       // transient events for renderer/audio (drained by the caller)
    this.pending = []; this.nextFinal = 0;
    this.log = [];                      // the composed song: [step, voice, midi, velocity, duration]
    this.stemLog = [];                  // [step, stemCount]
    this.stems = 0; this.groove = 0; this.combo = 0; this.onBeats = 0; this.assigns = 0;
    this.nb = Math.ceil(this.T.w / BT.BLOCK);
    this.sil = new Float32Array(this.nb);
    this.flash = new Float32Array(this.nb);
    this.flashQ = [];
    this.silSrc = [];
    var sc = level.silence;
    if (sc) {
      var src = sc.src === 'left' ? [0] : sc.src === 'right' ? [this.nb - 1] : sc.src;
      for (k = 0; k < src.length; k++) this.silSrc.push(typeof sc.src === 'string' ? src[k] : BT.clamp(src[k] >> 4, 0, this.nb - 1));
    }
  }
  var P = Sim.prototype;

  // ------------------------------------------------------------ helpers
  P.sfx = function (n, x, y) { this.ev.push({ t: 'sfx', n: n, x: x, y: y }); };
  P.interval = function () { return (((99 - this.rr) >> 1) + 4) * TICK; };
  P.setRR = function (v) { this.rr = BT.clamp(v | 0, this.rrMin, 99); };
  P.band = function (y) { return y < 54 ? 1 : y < 107 ? 0 : -1; };
  P.beatDist = function () { var ph = this.frame % this.bf; return Math.min(ph, this.bf - ph); };
  P.active = function () { var n = 0, L = this.lems, i; for (i = 0; i < L.length; i++) if (L[i].st !== S.GONE) n++; return n; };

  P.setState = function (l, st) {
    if (l.st === S.BLOCK && st !== S.BLOCK) { var k = this.blockers.indexOf(l); if (k >= 0) this.blockers.splice(k, 1); }
    l.st = st; l.t = 0;
    if (st === S.BLOCK) this.blockers.push(l);
  };
  P.kill = function (l, st, sfx) {
    this.setState(l, st); l.fuse = -1; this.dead++;
    if (sfx) this.sfx(sfx, l.x, l.y);
  };

  // ------------------------------------------------------------ quantizer ("playing is composing")
  // Nothing a lemming does is heard immediately: every note waits for the next 1/8 or 1/16 step.
  P.note = function (v, midi, vel, blk, dur) {
    var grid = VP[v][0], st = Math.ceil((this.frame + LOOK + 0.001) / (this.sf * grid)) * grid;
    while (st < this.nextFinal) st += grid;
    this.pending.push({ s: st, v: v, m: midi, vel: vel, b: blk, d: dur || 1 });
  };
  P.push = function (b, rad, amt) {
    var s = this.sil, d, i;
    if (b < 0 || !this.level.silence) return;
    for (d = -rad; d <= rad; d++) {
      i = b + d;
      if (i >= 0 && i < this.nb) s[i] = Math.max(0, s[i] - amt * (1 - Math.abs(d) / (rad + 1)));
    }
  };
  // Consolidate everything queued for one step: per-note voice limiting + crowd velocity scaling.
  P.finalStep = function (s) {
    var pd = this.pending, cur = [], rest = [], i, p, key, grp = {}, order = [], e;
    if (s % 4 === 0 && this.blockers.length) {            // blockers hold a drone on the chord root
      for (i = 0; i < this.blockers.length; i++) this.push(this.blockers[i].x >> 4, VP.drone[2], VP.drone[3]);
      cur.push({ s: s, v: 'drone', m: BT.songRootMidi ? BT.songRootMidi(this.world, s) : this.world.root - 24,
        vel: Math.min(1, 0.6 + 0.1 * this.blockers.length), b: this.blockers[0].x >> 4, d: 4 });
    }
    for (i = 0; i < pd.length; i++) { p = pd[i]; (p.s === s ? cur : rest).push(p); }
    this.pending = rest;
    if (!cur.length) return;
    for (i = 0; i < cur.length; i++) {
      p = cur[i]; key = p.v + ':' + p.m; e = grp[key];
      if (!e) { e = grp[key] = { v: p.v, m: p.m, vel: p.vel, b: p.b, d: p.d, n: 0 }; order.push(e); }
      e.n++; if (p.vel > e.vel) e.vel = p.vel; if (p.d > e.d) e.d = p.d;
    }
    var byV = {}, vn, list, k, vel, sl;
    for (i = 0; i < order.length; i++) { e = order[i]; (byV[e.v] = byV[e.v] || []).push(e); }
    for (vn in byV) {
      list = byV[vn];
      list.sort(function (a, b) { return (b.n - a.n) || (a.m - b.m); });
      k = Math.min(list.length, VP[vn][1]);
      for (i = 0; i < k; i++) {
        e = list[i];
        vel = Math.min(1, e.vel * (1 + 0.25 * Math.log(e.n) / Math.LN2)) * (k > 1 ? 1 / Math.sqrt(k) : 1);
        sl = e.b >= 0 && e.b < this.nb ? this.sil[e.b] : 0;
        vel *= 1 - 0.85 * sl;                               // the Silence eats sound
        this.push(e.b, VP[vn][2], VP[vn][3]);               // ...and music pushes it back
        if (vel < 0.02) continue;
        this.log.push([s, VIDX[vn], e.m, Math.round(vel * 100), e.d]);
        this.ev.push({ t: 'note', s: s, v: vn, m: e.m, vel: vel, d: e.d, b: e.b });
        if (e.b >= 0) this.flashQ.push(Math.round(s * this.sf), e.b);
      }
    }
  };

  // ------------------------------------------------------------ commands
  // Can this lemming take this skill right now? (also used by the cursor to pick a target)
  P.can = function (l, skill) {
    var st = l.st, gr;
    if (st >= S.OHNO) return false;
    gr = st === S.WALK || st === S.SHRUG || st === S.BUILD || st === S.BASH || st === S.MINE || st === S.DIG;
    switch (skill) {
      case 'climber': return !l.climber;
      case 'floater': return !l.floater;
      case 'bomber': return l.fuse < 0;
      case 'blocker': return gr;
      case 'builder': return gr && st !== S.BUILD;
      case 'basher': return gr && st !== S.BASH;
      case 'miner': return gr && st !== S.MINE;
      case 'digger': return gr && st !== S.DIG;
    }
    return false;
  };
  P.assign = function (idx, skill) {
    var l = this.lems[idx];
    if (!l || this.over || !(this.skills[skill] > 0) || !this.can(l, skill)) return false;
    switch (skill) {
      case 'climber': l.climber = true; break;
      case 'floater': l.floater = true; break;
      case 'bomber': l.fuse = FUSE; break;
      case 'blocker': this.setState(l, S.BLOCK); break;
      case 'builder': this.setState(l, S.BUILD); l.bricks = BRICKS; break;
      case 'basher': this.setState(l, S.BASH); break;
      case 'miner': this.setState(l, S.MINE); break;
      case 'digger': this.setState(l, S.DIG); l.n = 0; break;
    }
    this.skills[skill]--; this.assigns++;
    this.sfx('assign', l.x, l.y);
    if (this.beatDist() <= BEAT_TOL) {                       // on-beat groove bonus: never required
      this.combo++; this.onBeats++;
      var pts = 100 * Math.min(this.combo, 5);
      this.groove += pts;
      this.ev.push({ t: 'groove', x: l.x, y: l.y, pts: pts, combo: this.combo });
    } else this.combo = 0;
    return true;
  };
  P.nuke = function () {
    if (this.nuked || this.over) return false;
    this.nuked = true; this.sfx('nuke');
    return true;
  };
  // Apply one recorded command: {frame, lemmingIndex, skill} | {frame, nuke:true} | {frame, rr:n}
  P.apply = function (c) {
    if (c.nuke) return this.nuke();
    if (c.rr !== undefined) { this.setRR(c.rr); return true; }
    return this.assign(c.lemmingIndex, c.skill);
  };

  // ------------------------------------------------------------ terrain carving
  // Returns -1 if steel / a wrong-way wall is in the region (nothing removed), else pixels removed.
  P.carve = function (x0, x1, y0, y1, dir) {
    var T = this.T, x, y, m, n = 0, a = Math.min(x0, x1), b = Math.max(x0, x1);
    for (y = y0; y <= y1; y++) for (x = a; x <= b; x++) {
      m = T.at(x, y);
      if (m === M.STEEL || (m === M.OWL && dir > 0) || (m === M.OWR && dir < 0)) return -1;
    }
    for (y = y0; y <= y1; y++) for (x = a; x <= b; x++) if (T.del(x, y)) n++;
    return n;
  };
  P.count = function (x0, x1, y0, y1) {
    var T = this.T, x, y, n = 0, a = Math.min(x0, x1), b = Math.max(x0, x1);
    for (y = y0; y <= y1; y++) for (x = a; x <= b; x++) if (x >= 0 && x < T.w && T.at(x, y)) n++;
    return n;
  };
  P.settle = function (l) {             // after horizontal movement: step down or start falling
    var T = this.T, d = 0;
    while (d < 4 && !T.solid(l.x, l.y + 1 + d)) d++;
    if (d >= 4) { l.y += 3; this.setState(l, S.FALL); l.fall = 3; return false; }
    l.y += d;
    return true;
  };

  // ------------------------------------------------------------ lemming logic
  P.spawn = function () {
    var h = this.objs.hatch;
    this.lems.push({ i: this.lems.length, x: h.x, y: h.y + 10, dir: h.dir, st: S.FALL, t: 0, fall: 0, climber: false,
      floater: false, fuse: -1, bricks: 0, acc: 0, blk: -1, quiet: 0, panic: false, pt: 0, pdir: 1, n: 0, cl: 0 });
    this.spawned++;
    this.ev.push({ t: 'spawn' });
  };
  P.entered = function (l) {            // walked onto a new note block -> queue its pitch
    var b = l.x >> 4;
    if (b !== l.blk) {
      l.blk = b;
      this.note('step', BT.noteMidi(this.world, this.mel[b % this.mel.length], this.band(l.y)), 0.7, b, 2);
    }
  };
  P.field = function (l) {              // blockers turn walkers around
    var B = this.blockers, i, b, dx;
    for (i = 0; i < B.length; i++) {
      b = B[i]; if (b === l) continue;
      dx = l.x - b.x;
      if (Math.abs(l.y - b.y) < 10 && dx !== 0 && dx > -7 && dx < 7) { l.dir = dx < 0 ? -1 : 1; return true; }
    }
    return false;
  };
  P.goExit = function (l) {
    var w = this.world, k = this.saved, st;
    this.setState(l, S.EXIT); l.fuse = -1; this.saved++;
    this.groove += 10;
    this.note('exit', w.root + w.mode[[0, 2, 4][k % 3]] + 12 * (((k % 6) / 3) | 0), 0.9, l.x >> 4, 4);
    this.ev.push({ t: 'saved', x: l.x, y: l.y });
    st = Math.min(5, Math.floor(this.saved * 5 / this.num));         // every 20% unlocks the next stem
    if (st > this.stems) {
      this.stems = st; this.groove += 200;
      this.stemLog.push([Math.ceil((this.frame + LOOK) / this.sf), st]);
      this.ev.push({ t: 'stem', n: st });
    }
  };

  P.walk = function (l) {
    var T = this.T, e = this.objs.exit, nx, y = l.y, k;
    if (Math.abs(l.x - e.x) <= 3 && y <= e.y + 1 && y >= e.y - 8) { this.goExit(l); return; }
    this.field(l);
    if (l.panic && this.rng.int(22) === 0) l.dir = -l.dir;       // lost in the Silence: wander
    nx = l.x + l.dir;
    if (T.solid(nx, y)) {
      k = 1; while (k <= 7 && T.solid(nx, y - k)) k++;
      if (k > 6) {                                               // a wall
        if (l.climber && nx >= 0 && nx < T.w) { this.setState(l, S.CLIMB); l.cl = 0; return; }   // (the level edge is not climbable)
        l.dir = -l.dir;
        this.settle(l);
        return;
      }
      l.x = nx; l.y = y - k;
    } else {
      l.x = nx;
      if (!this.settle(l)) return;
    }
    this.entered(l);
  };
  P.land = function (l) {
    if (l.fall > MAX_FALL && l.st !== S.FLOAT) { this.kill(l, S.SPLAT, 'splat'); return; }
    this.setState(l, S.WALK); l.fall = 0;
  };
  P.fallTick = function (l) {
    var T = this.T, i;
    for (i = 0; i < 3; i++) {
      if (T.solid(l.x, l.y + 1)) { this.land(l); return; }
      l.y++; l.fall++;
    }
    if (l.y > T.h + 14) { this.kill(l, S.GONE, 'fallout'); return; }
    if (l.floater && l.fall >= 16) {
      this.setState(l, S.FLOAT);
      this.note('float', BT.noteMidi(this.world, this.mel[(l.x >> 4) % this.mel.length], 1), 0.6, l.x >> 4, 8);
    }
  };
  P.floatTick = function (l) {
    var T = this.T, i, n = 1 + (l.t & 1);
    for (i = 0; i < n; i++) {
      if (T.solid(l.x, l.y + 1)) { this.land(l); return; }
      l.y++;
    }
    if (l.y > T.h + 14) this.kill(l, S.GONE, 'fallout');
  };
  P.climb = function (l) {
    var T = this.T, wx = l.x + l.dir;
    if (!T.solid(wx, l.y)) { l.x = wx; this.setState(l, S.HOIST); return; }       // over the top
    if (l.y < 12 || T.solid(l.x, l.y - 10)) {                                     // bumped a ceiling
      l.dir = -l.dir; this.setState(l, S.FALL); l.fall = 0; return;
    }
    l.y--; l.cl++;
    if (l.cl % 4 === 0) {                                                         // plucked ascending notes
      var b = l.x >> 4;
      this.note('climb', BT.noteMidi(this.world, this.mel[b % this.mel.length] + (l.cl >> 2), 0), 0.65, b, 1);
    }
  };
  P.build = function (l) {
    var T = this.T, ph = l.t % 12, i, x, nx, ny, b, deg;
    if (ph === 8) {                                                               // lay a brick at foot level
      b = l.x >> 4; deg = this.mel[b % this.mel.length] + ARP[BRICKS - l.bricks];
      var c = BT.degColor(this.world, deg);
      for (i = 0; i < 6; i++) {
        x = l.x + i * l.dir;
        if (x >= 0 && x < T.w && !T.at(x, l.y)) T.put(x, l.y, M.BRICK, i === 0 || i === 5 ? BT.mix(c, BT.BLACK, 0.3) : c, 200);
      }
      l.bricks--;
      this.note('build', BT.noteMidi(this.world, deg, 0), l.bricks < 3 ? 0.95 : 0.75, b, 2);
    } else if (ph === 0) {                                                        // step up onto it
      nx = l.x + 2 * l.dir; ny = l.y - 1;
      if (T.solid(nx, ny)) {                                                      // reached rising ground:
        i = 1; while (i <= 7 && T.solid(nx, ny - i)) i++;                         // walk on if it is steppable,
        if (i > 6) l.dir = -l.dir;                                                // turn around at a real wall
        this.setState(l, S.WALK); return;
      }
      if (T.solid(nx, ny - 3) || T.solid(nx, ny - 6) || T.solid(nx, ny - 9)) {    // head hits an overhang
        l.dir = -l.dir; this.setState(l, S.WALK); return;
      }
      l.x = nx; l.y = ny;
      if (l.bricks <= 0 || ny < 12) this.setState(l, S.SHRUG);
    }
  };
  P.bash = function (l) {
    var T = this.T, ph = (l.t - 1) % 8, d = l.dir, r;
    if (this.field(l)) { this.setState(l, S.WALK); return; }
    if (ph === 0) {
      if (!this.count(l.x + d, l.x + 9 * d, l.y - 9, l.y)) { this.setState(l, S.WALK); return; }   // broke through
      r = this.carve(l.x + d, l.x + 6 * d, l.y - 9, l.y, d);
      if (r < 0) { this.sfx('clink', l.x, l.y); this.setState(l, S.WALK); return; }
      var b = l.x >> 4;
      this.note('bash', BT.noteMidi(this.world, this.mel[b % this.mel.length], -2), 0.85, b, 2);
      this.ev.push({ t: 'dust', x: l.x + 5 * d, y: l.y - 4 });
    } else if (ph >= 2 && ph <= 5) {
      if (T.solid(l.x + d, l.y)) return;
      l.x += d;
      this.settle(l);
    }
  };
  P.mine = function (l) {
    var T = this.T, ph = (l.t - 1) % 6, d = l.dir, r;
    if (this.field(l)) { this.setState(l, S.WALK); return; }
    if (ph === 0) {
      r = this.carve(l.x, l.x + 6 * d, l.y - 8, l.y + 1, d);
      if (r < 0) { this.sfx('clink', l.x, l.y); this.setState(l, S.WALK); return; }
      var b = l.x >> 4;
      this.note('mine', BT.noteMidi(this.world, this.mel[b % this.mel.length], 1), 0.8, b, 1);
      this.ev.push({ t: 'dust', x: l.x + 4 * d, y: l.y });
    } else if (ph === 3) {
      l.x += 2 * d; l.y += 1;
      if (l.x < 1 || l.x > T.w - 2) { l.x = BT.clamp(l.x, 1, T.w - 2); this.setState(l, S.WALK); return; }
      this.settle(l);
    }
  };
  P.dig = function (l) {
    var T = this.T, ph = (l.t - 1) % 4, r, v;
    if (ph !== 0) return;
    r = this.carve(l.x - 4, l.x + 4, l.y + 1, l.y + 1, 0);
    if (r < 0) { this.sfx('clink', l.x, l.y); this.setState(l, S.WALK); return; }
    l.y++;
    v = DIGPAT[l.n++ & 7];
    if (v) this.note(v, 36, 0.9, l.x >> 4, 1);
    this.ev.push({ t: 'dust', x: l.x, y: l.y });
    if (!this.count(l.x - 4, l.x + 4, l.y + 1, l.y + 1)) { this.setState(l, S.FALL); l.fall = 0; }
  };
  P.explode = function (l) {
    var T = this.T, dx, dy, cx = l.x, cy = l.y - 3;
    for (dy = -10; dy <= 10; dy++) for (dx = -8; dx <= 8; dx++) {
      if ((dx * dx) / 72.25 + (dy * dy) / 110.25 <= 1) T.del(cx + dx, cy + dy);
    }
    this.note('crash', 49, 1, l.x >> 4, 4);
    this.ev.push({ t: 'boom', x: l.x, y: l.y - 4 });
    this.kill(l, S.GONE);
  };
  P.detonate = function (l) {
    l.fuse = -1;
    if (l.st === S.FALL || l.st === S.FLOAT || l.st === S.CLIMB || l.st === S.HOIST) { this.explode(l); return; }
    this.setState(l, S.OHNO);
    this.note('ohno', 72, 0.9, l.x >> 4, 4);
  };

  P.hazards = function (l) {
    var o = this.objs, i, z;
    for (i = 0; i < o.liquids.length; i++) {
      z = o.liquids[i];
      if (l.x >= z.x0 && l.x < z.x1 && l.y >= z.y + 3) {
        if (z.kind === 'water') this.kill(l, S.DROWN, 'drown'); else this.kill(l, S.BURN, 'burn');
        return;
      }
    }
    for (i = 0; i < o.fires.length; i++) {
      z = o.fires[i];
      if (Math.abs(l.x - z.x) <= 5 && l.y <= z.y + 1 && l.y >= z.y - 12) { this.kill(l, S.BURN, 'burn'); return; }
    }
    for (i = 0; i < o.crushers.length; i++) {
      z = o.crushers[i];
      if (z.slam && Math.abs(l.x - z.x) <= 7 && l.y > z.y0 && l.y <= z.y1 + 2) { this.kill(l, S.SPLAT, 'splat'); return; }
    }
  };

  P.tick = function (l) {
    l.t++;
    switch (l.st) {
      case S.WALK: this.walk(l); break;
      case S.FALL: this.fallTick(l); break;
      case S.FLOAT: this.floatTick(l); break;
      case S.CLIMB: this.climb(l); break;
      case S.HOIST: if (l.t >= 4) this.setState(l, S.WALK); break;
      case S.BUILD: this.build(l); break;
      case S.SHRUG: if (l.t >= 8) this.setState(l, S.WALK); break;
      case S.BASH: this.bash(l); break;
      case S.MINE: this.mine(l); break;
      case S.DIG: this.dig(l); break;
      case S.BLOCK: if (!this.T.solid(l.x, l.y + 1)) { this.setState(l, S.FALL); l.fall = 0; } break;
      case S.OHNO: if (l.t >= 16) this.explode(l); break;
      case S.SPLAT: case S.DROWN: case S.BURN: if (l.t >= 16) this.setState(l, S.GONE); break;
      case S.EXIT: if (l.t >= 14) this.setState(l, S.GONE); break;
    }
    if (l.st < S.SPLAT) this.hazards(l);
  };

  // ------------------------------------------------------------ the Silence
  P.silenceTick = function () {
    var c = this.level.silence, s = this.sil, n = this.nb, r, i, prev, cur, nx, m, src = this.silSrc;
    if (!c || this.frame < (c.delay || 0) * 60) return;
    r = c.rate || 0.01;
    for (i = 0; i < src.length; i++) s[src[i]] = Math.min(1, s[src[i]] + r * 4);
    prev = 0;
    for (i = 0; i < n; i++) {                       // it creeps outward from already-silent neighbours
      cur = s[i]; nx = i + 1 < n ? s[i + 1] : 0; m = prev > nx ? prev : nx;
      if (m > 0.6 && cur < 1) s[i] = Math.min(1, cur + r * m);
      prev = cur;
    }
  };

  // ------------------------------------------------------------ one fixed 1/60 s step
  P.step = function () {
    if (this.over) return;
    var f = this.frame, L = this.lems, i, l, n, sp, s, act = 0, o = this.objs, c, per, t;
    if (f === 30) this.sfx('letsgo');
    if (!this.nuked && this.spawned < this.num && --this.spawnWait <= 0) { this.spawn(); this.spawnWait = this.interval(); }
    n = L.length;
    if (this.nuked && (f & 1) === 0) {
      while (this.nukeIdx < n) { l = L[this.nukeIdx++]; if (l.st < S.OHNO && l.fuse < 0) { l.fuse = FUSE; break; } }
    }
    for (i = 0; i < o.crushers.length; i++) {       // crushers slam on the beat
      c = o.crushers[i]; per = c.period * this.bf;
      t = (f - c.phase * this.bf) % per; if (t < 0) t += per;
      c.t = t; c.per = per; c.slam = t < 10;
      t = (f + LOOK + 1 - c.phase * this.bf) % per; if (t < 0) t += per;
      if (t < 1) this.note('crush', 40, 0.9, c.x >> 4, 1);
    }
    for (i = 0; i < n; i++) {
      l = L[i]; if (l.st === S.GONE) continue;
      act++;
      if (l.fuse > 0 && --l.fuse === 0) { this.detonate(l); if (l.st === S.GONE) continue; }
      sp = 1;
      if (this.silSrc.length && l.st < S.SPLAT) {   // lemmings in silent zones slow down, then panic
        s = this.sil[BT.clamp(l.x >> 4, 0, this.nb - 1)];
        if (s > 0.5) sp = 0.5;
        if ((f & 3) === 0) {
          if (l.panic) {                              // a panic passes: it pulls itself together and tries again
            if (--l.pt <= 0 || s < 0.5) { l.panic = false; l.quiet = 0; if (l.st === S.WALK) l.dir = l.pdir; }
          } else if (s > 0.75) {
            if (++l.quiet > PANIC_AFTER) { l.panic = true; l.pt = PANIC_TICKS; l.pdir = l.dir; }
          } else if (l.quiet > 0) l.quiet -= 2;
        }
      }
      l.acc += sp;
      if (l.acc >= TICK) { l.acc -= TICK; this.tick(l); }
    }
    if ((f & 3) === 0) this.silenceTick();
    for (i = 0; i < this.nb; i++) this.flash[i] *= 0.9;
    var fq = this.flashQ;
    for (i = 0; i < fq.length; i += 2) if (fq[i] <= f) { this.flash[fq[i + 1]] = 1; fq.splice(i, 2); i -= 2; }
    while (this.nextFinal * this.sf - LOOK <= f) { this.finalStep(this.nextFinal); this.nextFinal++; }
    this.frame = f + 1;
    if (this.frame >= this.timeFrames) this.finish();
    else if ((this.spawned >= this.num || this.nuked) && act === 0) { if (++this.endWait > 90) this.finish(); }
    else this.endWait = 0;
  };
  P.finish = function () {
    this.over = true;
    this.pct = Math.floor(this.saved * 100 / this.num);
    this.win = this.pct >= this.level.need;
    if (this.saved === this.num) this.groove += 1000;
    this.endStep = Math.ceil(this.frame / this.sf);
    this.ev.push({ t: 'over' });
  };

  BT.Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
