/* Dev tool: render in-game frames headlessly to PNG. node tools/snapframe.js <levelIndex> <frame> [camX] */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', 'js');
for (const f of ['core', 'terrain', 'sim', 'levels', 'demos', 'gfx', 'sprites', 'render']) require(path.join(root, f + '.js'));
const BT = globalThis.BT;
const { writePNG } = require('./png');
const li = +process.argv[2] || 0, upto = +process.argv[3] || 600;
const def = BT.LEVELS[li];
const g = new BT.Gfx(null);
const sim = new BT.Sim(def);
const view = new BT.LevelView(sim);
const rec = (BT.DEMOS[def.id] || []).slice();
let ci = 0;
while (sim.frame < upto && !sim.ended) {
  while (ci < rec.length && rec[ci].frame <= sim.frame) BT.applyCommand(sim, rec[ci++]);
  sim.step();
  for (const e of sim.events) view.onEvent(e, sim);
  view.tickVisuals();
}
let camX = process.argv[4] !== undefined ? +process.argv[4] : (() => { const a = sim.lems.filter((l) => l.st < BT.ST.DEAD); return a.length ? a[0].x - 160 : 0; })();
g.clear(0xff000000);
const beat = sim.beatPhase(sim.frame);
camX = view.draw(g, camX, beat, sim.frame, { hover: sim.lems[0] });
view.drawMinimap(g, 196, 168, 124, 20, camX, sim.frame);
const out = new Uint8Array(320 * 200 * 3);
for (let i = 0; i < 320 * 200; i++) { const c = g.buf[i]; out[i * 3] = c & 255; out[i * 3 + 1] = (c >> 8) & 255; out[i * 3 + 2] = (c >> 16) & 255; }
// upscale x3
const S = 3, big = new Uint8Array(320 * S * 200 * S * 3);
for (let y = 0; y < 200 * S; y++) for (let x = 0; x < 320 * S; x++) { const s = ((y / S | 0) * 320 + (x / S | 0)) * 3, d = (y * 320 * S + x) * 3; big[d] = out[s]; big[d + 1] = out[s + 1]; big[d + 2] = out[s + 2]; }
require('fs').mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const file = path.join(__dirname, 'out', `frame_${li}_${upto}.png`);
writePNG(file, 320 * S, 200 * S, big);
console.log(file, 'camX', camX, 'saved', sim.saved, 'out', sim.outCount());
