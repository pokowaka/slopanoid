#!/usr/bin/env node
/* =====================================================================
   bake.js — turns intended-solution trigger plans into deterministic
   {frame, lemmingIndex, skill} recordings (solutions.js), by running the
   headless simulation. Run:  node bake.js
   ===================================================================== */
'use strict';
var BT = require('./sim.js');
var LEVELS = require('./levels.js');
var fs = require('fs');

function W(l) { return l.state === 'walker'; }
function L(sim, i) { return sim.lemmings[i]; }
/* Crowd control: the first lemming (other than pioneer lem 0) to reach [x0,x1) on row y becomes a Blocker ("gate"). */
function gate(x0, x1, y) {
  return { lem: 'any', skill: 'blocker', tag: 'gate', cond: function (l, s) { var a = L(s, 0); return l.id !== 0 && W(l) && l.y === y && l.x >= x0 && l.x < x1 && !!a && (a.x > l.x + 4 || a.y !== l.y); } };
}
/* Release the gate blocker with a Bomber once the pioneer satisfies `done` (or has died). */
function release(done) {
  return { lem: 'tag:gate', skill: 'bomber', cond: function (l, s) { var a = L(s, 0); return !!a && (!a.alive || done(a, s)); } };
}
/* Auto-nuke once the quota is met and nobody has exited for 15 s (the rest are stuck/blockers). */
var AUTO_NUKE = { nuke: true, cond: function (l, s) { return s.spawned === s.total && s.saved >= s.needed && s.frame - s.lastExitFrame > 900; } };

/* Each plan entry: { lem: index | 'any' | 'tag:name', skill | rr | nuke, cond(l, sim, vars), times, tag }
   'cond' is evaluated every frame before sim.update(). */
var PLANS = [
  /* 0 WALK THE SCORE */ [],
  /* 1 DIG DEEP */ [
    { lem: 0, skill: 'digger', cond: function (l) { return W(l) && l.x >= 120; } }
  ],
  /* 2 BRIDGE THE BEAT */ [
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 192; } },
    { lem: 0, skill: 'builder', cond: function (l) { return l.state === 'shrugger'; } },
    gate(150, 190, 120),
    release(function (a) { return W(a) && a.x >= 246; })
  ],
  /* 3 BASH AND MINE */ [
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.dir === 1 && l.x >= 236; } },
    { lem: 0, skill: 'miner', cond: function (l) { return W(l) && l.x >= 272 && l.y === 80; } }
  ],
  /* 4 ACID DROP */ [
    { lem: 'any', skill: 'floater', times: 8, cond: function (l) { return !l.floater; } },
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.x >= 246 && l.y === 140; } }
  ],
  /* 5 HEAR THE SILENCE */ [
    { rr: 99, cond: function () { return true; } },
    { lem: 0, skill: 'blocker', cond: function (l) { return W(l) && l.x <= 44; } },
    { lem: 1, skill: 'basher', cond: function (l) { return W(l) && l.x >= 296 && l.dir === 1; } }
  ],
  /* 6 CRUSHER LINE */ [
    { lem: 0, skill: 'digger', cond: function (l) { return W(l) && l.x >= 170 && l.y === 120; } },
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.y === 150 && l.x >= 224 && l.x < 230 && l.dir === 1; } }
  ],
  /* 7 CHROME GRID */ [
    { lem: 0, skill: 'climber', cond: function () { return true; } },
    { lem: 0, skill: 'floater', cond: function () { return true; } },
    { lem: 0, skill: 'basher', tag: 'bash', cond: function (l) { return W(l) && l.dir === 1 && l.x >= 196 && l.x < 200 && l.y === 150; } },
    { lem: 1, skill: 'bomber', cond: function (l, s, v) { var a = L(s, 0); return v.bash !== undefined && a.state !== 'basher' && (a.x >= 200 || !a.alive) && W(l) && l.dir === -1 && l.x <= 257 && l.x > 230; } }
  ],
  /* 8 GATED REVERB */ [
    { lem: 0, skill: 'digger', cond: function (l) { return W(l) && l.x >= 110 && l.y === 60; } },
    gate(60, 95, 60),
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 296 && l.y === 130; } },
    release(function (a) { return W(a) && a.x >= 326; })
  ],
  /* 9 NEON DESCENT */ [
    { lem: 0, skill: 'miner', cond: function (l) { return W(l) && l.x >= 160 && l.y === 40; } },
    gate(220, 280, 110),
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.x >= 296 && l.y === 110 && l.dir === 1; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 436 && l.y === 150; } },
    release(function (a) { return W(a) && a.x >= 466; })
  ],
  /* 10 BREAK CAVE */ [
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 156 && l.y === 100; } },
    gate(100, 150, 100),
    { lem: 0, skill: 'blocker', cond: function (l) { return W(l) && l.x >= 237 && l.dir === 1 && l.y === 100; } },
    { lem: 0, skill: 'bomber', cond: function (l) { return l.state === 'blocker'; } },
    release(function (a) { return false; })
  ],
  /* 11 SUB DROP */ [
    { lem: 0, skill: 'digger', cond: function (l) { return W(l) && l.x >= 100 && l.y === 44; } },
    gate(60, 90, 44),
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 196 && l.y === 128; } },
    { lem: 0, skill: 'builder', cond: function (l) { return l.state === 'shrugger' && l.x < 240; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 272 && l.y === 128; } },
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.x >= 298 && l.y <= 120 && l.dir === 1; } },
    release(function (a) { return a.x >= 318 && a.y === 128; })
  ],
  /* 12 AMEN BREAK */ [
    { lem: 0, skill: 'digger', cond: function (l) { return W(l) && l.x >= 170 && l.y === 120; } },
    gate(100, 140, 120),
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.y === 150 && l.x >= 196 && l.x < 200 && l.dir === 1; } },
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.y === 150 && l.x >= 396 && l.dir === 1; } },
    release(function (a) { return a.x >= 226 && a.y === 150 && W(a); })
  ],
  /* 13 OVERTURE */ [
    { lem: 0, skill: 'miner', cond: function (l) { return W(l) && l.x >= 80 && l.y === 60; } },
    gate(130, 200, 138),
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 256 && l.y === 138; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 452 && l.y === 138; } },
    release(function (a) { return a.x >= 484; })
  ],
  /* 14 CRESCENDO */ [
    { lem: 0, skill: 'miner', cond: function (l) { return W(l) && l.x >= 80 && l.y === 60; } },
    gate(130, 200, 138),
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.x >= 316 && l.y === 138 && l.dir === 1; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 380 && l.x < 400 && l.y === 138; } },
    { lem: 0, skill: 'builder', cond: function (l) { return l.state === 'shrugger' && l.x >= 400 && l.x < 420; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 532 && l.y === 138; } },
    release(function (a) { return a.x >= 564; })
  ],
  /* 15 FINALE */ [
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 97 && l.y === 50 && l.dir === 1; } },
    gate(50, 80, 50),
    { lem: 0, skill: 'basher', cond: function (l) { return W(l) && l.x >= 176 && l.y === 44 && l.dir === 1; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 356 && l.x < 360 && l.y === 140; } },
    { lem: 0, skill: 'builder', cond: function (l) { return l.state === 'shrugger' && l.x >= 370 && l.x < 400; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 416 && l.x < 430 && l.y === 140; } },
    { lem: 0, skill: 'builder', cond: function (l) { return l.state === 'shrugger' && l.x >= 436 && l.x < 460; } },
    { lem: 0, skill: 'builder', cond: function (l) { return W(l) && l.x >= 532 && l.y === 140; } },
    release(function (a) { return a.x >= 566 && a.y === 130; })
  ]
];
for (var pi = 0; pi < PLANS.length; pi++) PLANS[pi].push(AUTO_NUKE);

function bake(levelIndex, verbose) {
  var level = LEVELS[levelIndex];
  var plan = PLANS[levelIndex] || [];
  var sim = new BT.Sim(level);
  var cmds = [], vars = {};
  var used = plan.map(function () { return 0; });
  var deaths = [];
  sim.onEvent = function (ev) {
    if (ev.type === 'splat' || ev.type === 'drown' || ev.type === 'burn' || ev.type === 'fellout' || ev.type === 'crush')
      deaths.push(ev.type + '@' + ev.x + ',' + ev.y + ' lem' + ev.lem + ' f' + ev.frame);
  };
  while (sim.status === 'playing') {
    for (var p = 0; p < plan.length; p++) {
      var e = plan[p];
      var times = e.times || 1;
      if (used[p] >= times) continue;
      if (e.rr !== undefined) {
        if (e.cond(null, sim, vars)) { sim.setRate(e.rr); cmds.push({ frame: sim.frame, rr: e.rr }); used[p]++; }
        continue;
      }
      if (e.nuke) {
        if (e.cond(null, sim, vars) && sim.nuke()) { cmds.push({ frame: sim.frame, nuke: true }); used[p]++; if (verbose) console.log('  f' + sim.frame + ' NUKE'); }
        continue;
      }
      var candidates = [];
      if (e.lem === 'any') candidates = sim.lemmings;
      else if (typeof e.lem === 'string' && e.lem.indexOf('tag:') === 0) { var t = vars[e.lem.slice(4)]; if (t !== undefined) candidates = [sim.lemmings[t]]; }
      else if (sim.lemmings[e.lem]) candidates = [sim.lemmings[e.lem]];
      for (var c = 0; c < candidates.length && used[p] < times; c++) {
        var l = candidates[c];
        if (!l || !l.alive) continue;
        if (e.cond(l, sim, vars) && sim.canAssign(l, e.skill)) {
          sim.assign(l.id, e.skill);
          cmds.push({ frame: sim.frame, lemmingIndex: l.id, skill: e.skill });
          used[p]++;
          if (e.tag) vars[e.tag] = l.id;
          if (verbose) console.log('  f' + sim.frame + ' lem' + l.id + ' ' + e.skill + ' @' + l.x + ',' + l.y);
        }
      }
    }
    sim.update();
  }
  var r = sim.result;
  if (verbose && deaths.length) console.log('  deaths: ' + deaths.join(' | '));
  return { cmds: cmds, result: r, deaths: deaths };
}

if (require.main === module) {
  var out = [], allOk = true;
  var only = process.argv[2] !== undefined ? parseInt(process.argv[2], 10) : -1;
  for (var i = 0; i < LEVELS.length; i++) {
    if (only >= 0 && i !== only) { out.push([]); continue; }
    var b = bake(i, true);
    var r = b.result;
    var ok = r.won;
    allOk = allOk && ok;
    console.log((ok ? 'PASS' : 'FAIL') + ' L' + i + ' ' + LEVELS[i].name + ': saved ' + r.saved + '/' + r.total + ' (need ' + r.needed + ') in ' + r.frames + ' frames (' + r.why + ') groove ' + r.groove + ' cmds ' + b.cmds.length);
    out.push(b.cmds);
  }
  if (only < 0) {
    var src = '/* Auto-generated by bake.js: scripted solution recordings {frame, lemmingIndex, skill} per level. */\n' +
      '(function (root) {\n  var S = ' + JSON.stringify(out) + ';\n' +
      '  if (typeof module !== \'undefined\' && module.exports) module.exports = S; else root.BT_SOLUTIONS = S;\n' +
      '})(typeof window !== \'undefined\' ? window : this);\n';
    fs.writeFileSync(__dirname + '/solutions.js', src);
    console.log((allOk ? 'ALL LEVELS SOLVABLE' : 'SOME LEVELS FAILED') + ' — wrote solutions.js');
  }
  process.exit(allOk ? 0 : 1);
}
module.exports = { bake: bake, PLANS: PLANS };
