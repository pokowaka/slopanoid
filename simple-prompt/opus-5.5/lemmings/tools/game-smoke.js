/* Headless end-to-end smoke test of the full game (js/game.js) with a stubbed
 * DOM + strict Web Audio mock. Drives every screen with synthetic input:
 * title -> select -> code entry -> briefing -> play (skills, pause, FF, mixer,
 * nuke, scrolling) -> results replay -> demo mode, for every level.
 *   node tools/game-smoke.js [--png]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const MOCK = require('./webaudio-mock.js');

// ---- DOM stubs ----
const listeners = {};
const canvasListeners = {};
let lastImage = null;
const ctx2d = {
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: (img) => { lastImage = img; },
};
const canvas = {
  style: {}, width: 320, height: 200,
  getContext: () => ctx2d,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }),
  addEventListener: (t, f) => { (canvasListeners[t] = canvasListeners[t] || []).push(f); },
};
const store = {};
globalThis.window = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
globalThis.document = { getElementById: () => canvas, body: { classList: { _s: new Set(['crt']), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } } } };
globalThis.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f); };
globalThis.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); } };
let rafCb = null, now = 0;
globalThis.requestAnimationFrame = (f) => { rafCb = f; };
globalThis.performance = { now: () => now };

for (const f of ['core', 'terrain', 'sim', 'levels', 'demos', 'gfx', 'sprites', 'render', 'songs', 'audio', 'game']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BT = globalThis.BT, GM = BT.game;
const fire = (t, e) => (listeners[t] || []).forEach((f) => f(e));
const cfire = (t, e) => (canvasListeners[t] || []).forEach((f) => f(e));
const ev = (o) => Object.assign({ preventDefault() {}, shiftKey: false, metaKey: false, ctrlKey: false, repeat: false }, o);
function frames(n) { for (let i = 0; i < n; i++) { now += 1000 / 60; BT.audio.ctx && (BT.audio.ctx.currentTime = now / 1000); rafCb(now); } }
function key(code, k, shift) { fire('keydown', ev({ code, key: k || code, shiftKey: !!shift })); frames(1); fire('keyup', ev({ code })); frames(1); }
function click(x, y, button) {
  const e = ev({ clientX: x * 2 + 1, clientY: y * 2 + 1, button: button || 0 });
  fire('mousemove', e); cfire('mousedown', e); frames(1); fire('mouseup', e); frames(1);
}
function move(x, y) { fire('mousemove', ev({ clientX: x * 2 + 1, clientY: y * 2 + 1 })); }
let fails = 0;
const expect = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };
const snap = (name) => {
  if (!process.argv.includes('--png') || !lastImage) return;
  const { writePNG } = require('./png.js');
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const rgb = new Uint8Array(320 * 200 * 3);
  for (let i = 0; i < 320 * 200; i++) { rgb[i * 3] = lastImage.data[i * 4]; rgb[i * 3 + 1] = lastImage.data[i * 4 + 1]; rgb[i * 3 + 2] = lastImage.data[i * 4 + 2]; }
  writePNG(path.join(__dirname, 'out', 'ui_' + name + '.png'), 320, 200, rgb);
};

frames(5);
expect(GM.state === 'title', 'starts on title');
frames(600);  // attract demo runs silently
snap('title');
click(160, 100);                 // unlock audio, go to select
expect(BT.audio.ctx, 'audio context created on click');
expect(GM.state === 'select', 'select after click, got ' + GM.state);
snap('select');
// password entry
key('Tab'); for (const ch of 'RINSE') key('Key' + ch, ch.toLowerCase());
frames(2);
expect(GM.prog.reached >= 11, 'code RINSE unlocks up to level 11');
snap('select_code');
key('Escape'); expect(GM.state === 'title', 'esc to title'); frames(30);
key('Enter'); expect(GM.state === 'select', 'back to select');

let totalSaved = 0;
BT.LEVELS.forEach((def, li) => {
  // pick level via arrows from top
  while (true) { const s = GM.state; if (s !== 'select') break; break; }
  // warp: go to select, move to level
  for (let k = 0; k < 20; k++) key('ArrowUp');
  // compute current selection by moving to top: use click on row instead
  move(100, 26 + li * 8 + 3); frames(1);
  click(100, 26 + li * 8 + 3);
  expect(GM.state === 'preview', `L${def.id} preview (got ${GM.state})`);
  if (li === 3) snap('preview');
  key('Enter');
  expect(GM.state === 'play', `L${def.id} play`);
  const run = GM.run;
  expect(run.levelIdx === li, `L${def.id} correct level index ${run.levelIdx}`);
  // exercise UI: skill keys, pause, mixer, scroll, FF
  key('Digit3'); expect(run.skill === 2, 'skill key 3 selects bomber');
  key('KeyP'); expect(run.paused, 'pause'); frames(10); key('KeyP'); expect(!run.paused, 'unpause');
  key('KeyT'); expect(run.mixer, 'mixer open'); frames(30);
  if (li === 4) snap('mixer');
  key('Digit2'); key('Digit2', '@', true); key('Digit2', '@', true); key('KeyT');
  fire('keydown', ev({ code: 'ArrowRight' })); frames(20); fire('keyup', ev({ code: 'ArrowRight' }));
  click(200, 175); // minimap click
  // (RR is exercised in the click-path test; changing it here would alter the recorded solution)
  // play the recorded solution through the real click path where possible
  const cmds = (BT.DEMOS[def.id] || []).slice().sort((a, b) => a.frame - b.frame);
  let ci = 0, guard = 0;
  while (GM.state === 'play' && guard++ < 60 * 60 * 12) {
    const sim = run.sim;
    while (ci < cmds.length && cmds[ci].frame <= sim.frame) {
      const c = cmds[ci++];
      if (c.skill === 'rr') sim.setRR(c.value);
      else if (c.skill === 'nuke') sim.nuke();
      else {
        // select skill button and click on the lemming (camera moved onto it)
        const L = sim.lems[c.lemmingIndex];
        const k = BT.SKILLS.indexOf(c.skill);
        run.skill = k;
        run.camX = Math.max(0, Math.min(sim.W - 320, L.x - 160));
        const before = sim.skills[c.skill];
        // direct assign keeps frame-exactness; click path is tested separately below
        sim.assign(c.lemmingIndex, c.skill);
        expect(sim.skills[c.skill] === before - 1, `L${def.id} assign ${c.skill} to #${c.lemmingIndex} @${c.frame}`);
      }
    }
    if (li === 7 && sim.frame === 900) snap('play');
    frames(1);
  }
  expect(GM.state === 'results', `L${def.id} reaches results (state ${GM.state})`);
  if (GM.state !== 'results') return;
  totalSaved += run.sim.saved;
  frames(240);
  if (li === 2) snap('results');
  key('KeyF'); frames(120); key('Space'); frames(30);
  console.log(`${def.id.padEnd(4)} saved ${run.sim.saved}/${run.sim.count} groove ${run.sim.groove} log ${BT.audio.log.length}`);
  key('Escape');
  expect(GM.state === 'select', 'results -> select');
});

// click-path skill assignment test on the tutorial
move(100, 26 + 3); frames(1); click(100, 29); console.log('state after click', GM.state); key('Enter'); console.log('state after enter', GM.state);
{
  const run = GM.run;
  while (!run.sim.lems.some((L) => L.st === BT.ST.WALK)) frames(1);
  const L = run.sim.lems.find((l) => l.st === BT.ST.WALK);
  run.camX = Math.max(0, Math.min(run.sim.W - 320, L.x - 160)); frames(1);
  const sx = L.x - Math.round(run.camX), sy = L.y - 5;
  click(2 * 15 + 7, 180); // climber button
  expect(run.skill === 0, 'climber selected via button');
  move(sx, sy); frames(1);
  expect(run.hover, 'hover detects lemming');
  snap('hover');
  const before = run.sim.skills.climber;
  click(L.x - Math.round(run.camX), L.y - 5);
  expect(run.sim.skills.climber === before - 1 || before === 0, 'click assigns skill');
  // nuke double click
  click(11 * 15 + 7, 180); expect(run.nukeArm > 0, 'nuke armed');
  click(11 * 15 + 7, 180); expect(run.sim.nuking, 'nuke confirmed');
  key('KeyF'); frames(60 * 20);
  expect(GM.state === 'results', 'nuke ends level');
  key('Escape');
}
// demo mode from select + title attract cycling + CRT toggle
key('KeyD'); expect(GM.state === 'demo', 'D starts demo from select'); frames(300); snap('demo'); key('KeyX');
expect(GM.state === 'select', 'any key leaves demo');
key('KeyC'); expect(!document.body.classList.contains('crt'), 'C toggles CRT');
key('Escape'); frames(60 * 80); expect(GM.state === 'title', 'attract keeps running');

const st = MOCK.stats();
console.log('audio nodes', st.nodes, 'automation', st.calls, 'audio errors', st.errors, 'total saved', totalSaved);
console.log(fails || st.errors ? `GAME SMOKE FAILED (${fails} fails, ${st.errors} audio errors)` : 'GAME SMOKE OK');
process.exit(fails || st.errors ? 1 : 0);
