#!/usr/bin/env node
/* Renders real game frames with the software renderer under Node (no browser):
 *   node tools/frame.js level <id> <frame> [camX] [--out f.png]   playfield + panel at a frame of the solution
 *   node tools/frame.js sprites | font | bg                        asset proof sheets */
'use strict';
const path = require('path');
const lib = require('./lib');
const BT = lib.load();
const R = BT.Render;
const args = process.argv.slice(2);
const mode = args[0] || 'level';
const oi = args.indexOf('--out');
const out = oi >= 0 ? args[oi + 1] : path.join(process.env.BT_SCRATCH || require('os').tmpdir(), 'bt-' + mode + '.png');

if (mode === 'sprites') {
  const names = Object.keys(BT.Sprites.R), W = 8 * 18 + 60, H = names.length * 18 + 4;
  const fb = new Uint32Array(W * H); R.target(fb, W, H); R.clear(BT.hex(0x202028));
  names.forEach((n, r) => {
    R.text(n.toUpperCase(), 2, r * 18 + 8, BT.hex(0xffffff));
    BT.Sprites.R[n].forEach((c, i) => { R.rect(58 + i * 18, r * 18 + 1, 17, 17, BT.hex(0x101018)); R.cell(c, 58 + i * 18, r * 18 + 2, BT.Sprites.PAL); R.px(58 + i * 18 + 7, r * 18 + 18, BT.hex(0xff00ff)); });
  });
  lib.writePNG(out, fb, W, H, 5);
} else if (mode === 'font') {
  const W = 320, H = 70, fb = new Uint32Array(W * H); R.target(fb, W, H); R.clear(BT.hex(0x101018));
  R.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2, 2, BT.hex(0xffffff));
  R.text('0123456789 .,:!?-+/%()[]\'"*#<>=_&', 2, 12, BT.hex(0xffff80));
  R.text('~ ^ | { } @ $  THE QUICK BROWN FOX JUMPS OVER', 2, 22, BT.hex(0x80ffff));
  R.text('Lemmings 100% saved! Time 3-45  ~12500', 2, 32, BT.hex(0xff80ff), BT.hex(0x400040));
  R.big('BEAT TRIBE', 8, 44, 3, (r) => BT.WORLDS[2].degCols[r], BT.hex(0x000000));
  lib.writePNG(out, fb, W, H, 4);
} else if (mode === 'bg') {
  const W = 512, H = 160 * 6, fb = new Uint32Array(W * H);
  BT.WORLDS.forEach((w, i) => fb.set(R.bgFor(w), i * 160 * W));
  lib.writePNG(out, fb, W, H, 1);
} else if (mode === 'strip') {
  const level = BT.LEVELS.find((l, i) => String(i) === args[1] || l.id === args[1]), frame = parseInt(args[2] || '0', 10);
  const scripts = require('./scripts');
  const sim = lib.solve(BT, level, scripts[level.id] || [], { until: frame }).sim;
  const W = sim.T.w, fb = new Uint32Array(W * 160); R.target(fb, W, 160);
  R.playfield(sim, 0, {});
  lib.writePNG(out, fb, W, 160, 1);
  console.log(level.id, 'frame', sim.frame, 'saved', sim.saved);
} else {
  const key = args[1] || '0', frame = parseInt(args[2] || '600', 10);
  const level = BT.LEVELS.find((l, i) => String(i) === key || l.id === key);
  let scripts = {}; try { scripts = require('./scripts'); } catch (e) { /* none */ }
  const rec = (BT.SOLUTIONS || {})[level.id];
  const sim = args.includes('--rec') && rec ? lib.run(BT, level, rec, { until: frame }) : lib.solve(BT, level, scripts[level.id] || [], { until: frame }).sim;
  const fb = new Uint32Array(320 * 200); R.target(fb, 320, 200);
  let cam = args[3] !== undefined && !args[3].startsWith('--') ? parseInt(args[3], 10) : level.startX || 0;
  cam = Math.max(0, Math.min(sim.T.w - 320, cam));
  const hover = sim.lems.find(l => l.st !== BT.ST.GONE && l.x > cam && l.x < cam + 320) || null;
  R.playfield(sim, cam, { hover: args.includes('--hover') ? hover : null });
  R.panel(sim, { skill: 'builder', cam, hover: args.includes('--hover') ? hover : null, hoverN: 1 });
  if (args.includes('--hover') && hover) R.cursor(hover.x - cam, hover.y - 5, true);
  lib.writePNG(out, fb, 320, 200, 3);
  console.log(`${level.id} frame ${sim.frame} cam ${cam} saved ${sim.saved}/${sim.num} stems ${sim.stems}`);
}
console.log('png', out);
