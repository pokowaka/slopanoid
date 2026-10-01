#!/usr/bin/env node
/* =====================================================================
   test.js — headless deterministic verification (plain node, no browser).
   Replays each level's recorded solution {frame, lemmingIndex, skill} from
   solutions.js through the simulation and asserts the level is won.
   Also checks determinism (two runs produce identical terrain hashes).
   Run:  node test.js
   ===================================================================== */
'use strict';
var BT = require('./sim.js');
var LEVELS = require('./levels.js');
var SOL = require('./solutions.js');

function run(level, cmds, collect) {
  var sim = new BT.Sim(level);
  var events = 0, notes = 0;
  sim.onEvent = function (ev) { events++; if (ev.type === 'step' && ev.degree) notes++; };
  var ci = 0;
  while (sim.status === 'playing') {
    while (ci < cmds.length && cmds[ci].frame === sim.frame) { sim.applyCommand(cmds[ci]); ci++; }
    sim.update();
    if (sim.frame > 60 * 60 * 15) break; // 15 min safety
  }
  var h = 2166136261;
  for (var i = 0; i < sim.terrain.length; i += 7) { h ^= sim.terrain[i]; h = Math.imul(h, 16777619) >>> 0; }
  return { result: sim.result, hash: h, events: events, notes: notes, applied: ci, stems: sim.stems };
}

var fails = 0, lines = [];
for (var i = 0; i < LEVELS.length; i++) {
  var lv = LEVELS[i], cmds = SOL[i] || [];
  var a = run(lv, cmds), b = run(lv, cmds);
  var r = a.result;
  var ok = r && r.won && a.hash === b.hash && a.applied === cmds.length;
  if (!ok) fails++;
  var pct = Math.round(r.saved * 100 / r.total);
  lines.push((ok ? 'PASS' : 'FAIL') + '  L' + String(i).padStart(2, '0') + ' ' + lv.name.padEnd(18) + ' W' + (lv.world + 1) +
    '  saved ' + String(r.saved).padStart(2) + '/' + String(r.total).padEnd(2) + ' (' + pct + '% need ' + lv.need + '%)' +
    '  stems ' + a.stems + '/5  time ' + Math.round(r.frames / 60) + 's  cmds ' + cmds.length + '  notes ' + a.notes +
    '  det ' + (a.hash === b.hash ? 'ok' : 'MISMATCH'));
}
console.log(lines.join('\n'));
console.log(fails === 0 ? '\nALL ' + LEVELS.length + ' LEVELS PASS (solvable + deterministic)' : '\n' + fails + ' LEVEL(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
