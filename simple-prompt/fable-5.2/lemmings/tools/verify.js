#!/usr/bin/env node
/* Proves that every level is solvable: replays the shipped recordings from
 * js/solutions.js (exactly what the attract mode and the [D] demo play) through the
 * deterministic simulation and checks the save percentage.  Each level is run twice
 * to confirm the result and the composed song are bit-for-bit reproducible. */
'use strict';
const lib = require('./lib');
const BT = lib.load(['font', 'sprites', 'render']);

let bad = 0;
const sig = s => s.saved + ':' + s.frame + ':' + s.log.length + ':' + s.log.reduce((a, e) => (a * 31 + e[0] * 7 + e[2] + e[3]) % 1000000007, 7);
console.log('level  result  saved        need  time used   stems  notes  deterministic  name');
for (const level of BT.LEVELS) {
  const rec = (BT.SOLUTIONS || {})[level.id];
  if (!rec) { console.log(`${level.id.padEnd(6)} MISSING RECORDING`); bad++; continue; }
  const a = lib.run(BT, level, rec), b = lib.run(BT, level, rec);
  const det = sig(a) === sig(b), fmt = rec.every(c => typeof c.frame === 'number' && (c.nuke || c.rr !== undefined || (typeof c.lemmingIndex === 'number' && BT.SKILLS.includes(c.skill))));
  const budget = BT.SKILLS.every(k => a.skills[k] >= 0);
  const ok = a.win && det && fmt && budget && !a.failedCmds.length;
  if (!ok) bad++;
  console.log(`${level.id.padEnd(6)} ${ok ? 'PASS  ' : 'FAIL  '}  ${String(a.saved).padStart(2)}/${String(a.num).padEnd(2)} ${String(a.pct).padStart(3)}%   ${String(level.need).padStart(3)}%  ` +
    `${String(Math.round(a.frame / 60)).padStart(3)}s/${String(level.time).padEnd(3)}s   ${a.stems}/5    ${String(a.log.length).padStart(5)}  ${det ? 'yes' : 'NO '}            ${level.name}` +
    (a.failedCmds.length ? `  (${a.failedCmds.length} rejected commands)` : ''));
}
console.log(bad ? `\n${bad} level(s) FAILED` : `\nAll ${BT.LEVELS.length} levels solved by their recordings.`);
process.exit(bad ? 1 : 0);
