/* ==========================================================================
 * tools/verify.js — replays every shipped attract-mode recording
 * (js/demos.js, pure {frame, lemmingIndex, skill} lists) through the
 * deterministic simulation and asserts the level is solved. Also checks
 * determinism by running each recording twice.
 * Usage: node tools/verify.js
 * ========================================================================== */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', 'js');
for (const f of ['core', 'terrain', 'sim', 'levels', 'demos']) require(path.join(root, f + '.js'));
const BT = globalThis.BT;

let fail = 0;
for (const def of BT.LEVELS) {
  const rec = BT.DEMOS[def.id];
  if (!rec || !rec.length) { console.log(`${def.id}: NO RECORDING`); fail++; continue; }
  const a = BT.runRecording(def, rec);
  const b = BT.runRecording(def, rec);
  const deterministic = a.saved === b.saved && a.frame === b.frame && a.groove === b.groove;
  const ok = a.saved >= def.save && deterministic;
  if (!ok) fail++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${def.id.padEnd(4)} ${def.name.padEnd(24)} saved ${a.saved}/${def.count} ` +
    `(need ${def.save}, ${Math.round((a.saved * 100) / def.count)}%)  ${rec.length} cmds  ` +
    `${(a.frame / 60).toFixed(1)}s  deterministic=${deterministic}`
  );
}
console.log(fail ? `${fail} LEVEL(S) FAILED` : 'ALL 16 LEVELS VERIFIED SOLVABLE');
process.exitCode = fail ? 1 : 0;
