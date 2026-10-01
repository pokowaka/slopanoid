/* Headless smoke test for js/audio.js using a strict mock Web Audio API.
 * Checks every automation call for finite values / valid ramps, plays every
 * instrument, runs the scheduler through all five songs and a replay.
 *   node tools/audio-smoke.js
 */
'use strict';
const path = require('path');
const MOCK = require('./webaudio-mock.js');

for (const f of ['core', 'terrain', 'sim', 'levels', 'demos', 'songs', 'audio']) require(path.join(__dirname, '..', 'js', f + '.js'));
const BT = globalThis.BT;
const A = BT.audio;
A.init();
for (const b of A.brk.getChannelData(0)) if (!isFinite(b)) { MOCK.fail('break NaN'); break; }
// every instrument
for (const [name, fn] of Object.entries(BT.INST)) {
  const m = ['chipArp', 'stab', 'pad', 'rhodes', 'strings'].includes(name) ? [60, 64, 67] : 60;
  A.world = BT.WORLDS[0];
  A.play(name, 1, m, 0.3, 0.8, A.sfx, name === 'brk' ? 3 : name === 'acid' ? { acc: true, sld: true } : name === 'exitChord' ? [0, 4, 7] : null);
}
console.log('instruments:', Object.keys(BT.INST).length);
// run every level's demo through the scheduler with FF + pause segments
let totalNotes = 0;
BT.LEVELS.forEach((def, li) => {
  A.setWorld(def.world, li);
  const sim = new BT.Sim(def);
  const cmds = (BT.DEMOS[def.id] || []).slice();
  let ci = 0, t = 0;
  while (!sim.ended && sim.frame < 60 * 60 * 3) {
    while (ci < cmds.length && cmds[ci].frame <= sim.frame) BT.applyCommand(sim, cmds[ci++]);
    const ff = sim.frame % 3000 > 2000 ? 2 : 1;
    for (let k = 0; k < ff; k++) { sim.step(); A.onSimEvents(sim.events, sim); }
    t += 1 / 60; A.ctx.currentTime = t;
    const paused = sim.frame % 5000 > 4800 && sim.frame % 5000 < 4810;
    A.update(sim.songStepAt(sim.frame), ff, paused);
    if (paused) { A.ctx.currentTime += 0.2; }
  }
  A.setMuffle(0.5); A.toggleSolo(2); A.toggleSolo(2); A.toggleStemMute(1); A.toggleStemMute(1);
  const rec = A.getRecording();
  totalNotes += rec.log.length;
  if (li % 5 === 0 || li === BT.LEVELS.length - 1) {
    let seen = 0;
    A.startReplay(rec, () => seen++);
    let pos = 0, tt = A.ctx.currentTime, guard = 0;
    while (pos < rec.endStep && guard++ < 200000) { tt += 1 / 60; A.ctx.currentTime = tt; pos = A.updateReplay(guard > 3000 ? 4 : 1); }
    A.stopReplay();
    console.log(`${def.id.padEnd(4)} saved ${sim.saved}/${sim.count} log ${rec.log.length} stems ${JSON.stringify(rec.stems)} replayNotes ${seen}`);
  } else console.log(`${def.id.padEnd(4)} saved ${sim.saved}/${sim.count} log ${rec.log.length} stems ${JSON.stringify(rec.stems)}`);
});
const { errors, nodes, calls } = MOCK.stats();
console.log('nodes', nodes, 'automation calls', calls, 'logged notes', totalNotes);
console.log(errors ? `AUDIO SMOKE FAILED (${errors} errors)` : 'AUDIO SMOKE OK');
process.exit(errors ? 1 : 0);
