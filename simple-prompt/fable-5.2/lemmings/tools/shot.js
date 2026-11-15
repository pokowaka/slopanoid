#!/usr/bin/env node
/* Level design debugger: plays a level (optionally with its solution script or
 * recording) up to a frame and dumps the WHOLE level strip as a PNG.
 *   node tools/shot.js <levelIndex|id> [frame] [--script|--rec|--none] [--out file] [--trace i,j] */
'use strict';
const path = require('path');
const lib = require('./lib');
const BT = lib.load(['font', 'sprites', 'render']);
const S = BT.ST;

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; }
const flag = n => args.includes(n);
const key = args[0] || '0';
const level = BT.LEVELS.find((l, i) => String(i) === key || l.id === key);
if (!level) { console.error('no such level', key); process.exit(1); }
const frame = args[1] && !args[1].startsWith('--') ? parseInt(args[1], 10) : 0;
const out = opt('--out', path.join(process.env.BT_SCRATCH || require('os').tmpdir(), 'bt-shot.png'));
const trace = (opt('--trace', '') || '').split(',').filter(Boolean).map(Number);

let sim;
const deaths = [];
function onFrame(s) {
  for (const e of s.ev) if (e.t === 'sfx' && /splat|drown|burn|fallout/.test(e.n)) deaths.push(e.n + '@' + s.frame + ' x' + e.x + ' y' + e.y);
  if (trace.length && s.frame % 60 === 0) {
    console.log('f' + s.frame + ' ' + trace.map(i => { const l = s.lems[i]; return l ? `#${i}:${BT.ST_NAMES[l.st] || 'GONE'}(${l.x},${l.y},${l.dir > 0 ? '>' : '<'})` : `#${i}:-`; }).join(' '));
  }
}
if (flag('--none')) sim = lib.run(BT, level, [], { until: frame, onFrame });
else if (flag('--rec')) sim = lib.run(BT, level, (BT.SOLUTIONS || {})[level.id] || [], { until: frame, onFrame });
else {
  let scripts = {};
  try { scripts = require('./scripts'); } catch (e) { /* no scripts yet */ }
  const r = lib.solve(BT, level, scripts[level.id] || [], { until: frame || undefined, onFrame });
  sim = r.sim;
  r.cmds.forEach(c => console.log('cmd', JSON.stringify(c)));
  r.warn.forEach(w => console.log('WARN', w));
}

// ---- simple debug rendering of the full strip
const T = sim.T, W = T.w, H = T.h, fb = new Uint32Array(W * H);
const bg = BT.hex(0x101018);
for (let i = 0; i < W * H; i++) fb[i] = T.mat[i] ? T.col[i] : bg;
function px(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H) fb[y * W + x] = c; }
function rect(x0, y0, x1, y1, c, onlyAir) { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!onlyAir || !T.at(x, y)) px(x, y, c); }
for (const z of sim.objs.liquids) rect(z.x0, z.y, z.x1, H, BT.hex(z.kind === 'water' ? 0x2060d0 : 0xe05010), true);
for (const f of sim.objs.fires) rect(f.x - 5, f.y - 12, f.x + 6, f.y + 1, BT.hex(0xff9020), true);
for (const c of sim.objs.crushers) { rect(c.x - 7, c.y0, c.x + 8, c.y0 + 6, BT.hex(0xc0c0c0)); for (let y = c.y0; y <= c.y1; y += 2) px(c.x, y, BT.hex(0xff4040)); }
const h = sim.objs.hatch, e = sim.objs.exit;
rect(h.x - 12, h.y, h.x + 13, h.y + 3, BT.hex(0xffffff));
rect(e.x - 4, e.y - 12, e.x + 5, e.y + 1, BT.hex(0xffff40), true);
for (let x = 0; x < W; x += 100) { for (let y = 0; y < 5; y++) px(x, y, BT.hex(0xffffff)); if (x % 200 === 0) for (let y = 0; y < 10; y++) px(x, y, BT.hex(0xffffff)); }
for (let b = 0; b < sim.nb; b++) if (sim.sil[b] > 0.05) for (let x = b * 16; x < b * 16 + 16; x++) for (let y = 0; y < H; y++) if ((x + y) % 3 === 0) px(x, y, BT.mix(fb[y * W + x], BT.hex(0x909090), sim.sil[b]));
const stc = [0xffffff, 0x40ff40, 0xffff00, 0xffff00, 0x80ffff, 0xffa040, 0xffa040, 0xff40ff, 0xff40ff, 0xff40ff, 0xff4040, 0xff0000, 0x808080, 0x4040ff, 0xff8000, 0xffff80, 0];
for (const l of sim.lems) {
  if (l.st === S.GONE) continue;
  const c = BT.hex(stc[l.st]);
  for (let y = l.y - 8; y <= l.y; y++) { px(l.x, y, c); px(l.x + l.dir, y, y < l.y - 5 ? BT.hex(0x40c040) : c); }
}
lib.writePNG(out, fb, W, H, W <= 800 ? 2 : 1);
const cnt = {};
sim.lems.forEach(l => { const n = BT.ST_NAMES[l.st] || 'GONE'; cnt[n] = (cnt[n] || 0) + 1; });
console.log(`${level.id} "${level.name}" frame ${sim.frame} over=${sim.over} saved=${sim.saved}/${sim.num} (${Math.floor(sim.saved * 100 / sim.num)}% need ${level.need}%) dead=${sim.dead} spawned=${sim.spawned} notes=${sim.log.length} groove=${sim.groove}`);
console.log('states', JSON.stringify(cnt), 'skills', JSON.stringify(sim.skills));
const left = sim.lems.filter(l => l.st !== S.GONE).slice(0, 14).map(l => `#${l.i}:${BT.ST_NAMES[l.st]}(${l.x},${l.y},${l.dir > 0 ? '>' : '<'}${l.panic ? ',PANIC' : ''})`);
if (left.length) console.log('alive', left.join(' '));
if (sim.silSrc.length) console.log('silence', Array.from(sim.sil).map(v => Math.round(v * 9)).join(''));
if (deaths.length) console.log('deaths', deaths.slice(0, 30).join(', '), deaths.length > 30 ? '... +' + (deaths.length - 30) : '');
console.log('png', out, W + 'x' + H);
