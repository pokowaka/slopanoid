#!/usr/bin/env node
/* Optional end-to-end smoke test (dev only, not needed to play).
 * Drives the real page in a private headless Chrome through the DevTools protocol:
 * title -> level select -> code entry -> intro -> play (mouse assign, fast-forward,
 * pause, mixer, minimap) -> every world -> a full solution demo -> results/replay,
 * and fails on any console error or uncaught exception.
 *   node tools/browser-test.js [--shots dir] */
'use strict';
const os = require('os');
const path = require('path');
const cdp = require('./cdp');

const args = process.argv.slice(2);
const si = args.indexOf('--shots');
const shots = si >= 0 ? args[si + 1] : path.join(os.tmpdir(), 'bt-shots');
const IDS = ['T', '1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3', '4-1', '4-2', '4-3', '5-1', '5-2', '5-3'];

(async () => {
  const b = await cdp.launch('file://' + path.join(__dirname, '..', 'index.html'));
  if (!b) { console.log('Chrome not found - skipping browser test'); return; }
  const { evalJS, key, sleep } = b;
  let failed = false;
  const check = (name, ok, info) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) failed = true; };
  const state = () => evalJS('JSON.stringify(BT.Game.state())').then(JSON.parse);
  const shot = n => b.shot(path.join(shots, n + '.png'));
  // canvas pixel (320x200 space) -> page coordinates
  const at = async (x, y) => JSON.parse(await evalJS(`(function(){var r=document.getElementById('screen').getBoundingClientRect();return JSON.stringify({x:r.left+(${x}+0.5)*r.width/320,y:r.top+(${y}+0.5)*r.height/200});})()`));
  const click = async (x, y) => { const p = await at(x, y); await b.mouse('mouseMoved', p.x, p.y); await sleep(60); await b.mouse('mousePressed', p.x, p.y); await sleep(40); await b.mouse('mouseReleased', p.x, p.y); await sleep(80); };
  try {
    await sleep(1500);
    let s = await state();
    check('boots into the attract-mode demo', s.screen === 'title' && s.demo && s.frame > 30, JSON.stringify(s));
    await shot('1-title');
    await key('Space', ' '); await sleep(600);
    s = await state();
    check('any key -> level select, audio unlocked', s.screen === 'select' && s.audio, JSON.stringify(s));
    check('16 levels, 16 solution recordings', await evalJS('BT.LEVELS.length === 16 && BT.LEVELS.every(function(l){return (BT.SOLUTIONS[l.id]||[]).length > 0;})'));
    await key('ArrowDown'); await key('ArrowDown'); await key('ArrowRight'); await sleep(200);
    await shot('2-select');
    await key('Tab');
    for (const ch of await evalJS('BT.levelCode(9)')) await key('Key' + ch, ch.toLowerCase());
    await sleep(300); s = await state();
    check('typing a level code warps to that level', s.screen === 'intro' && s.level === IDS[9], JSON.stringify(s));
    await shot('3-intro');
    await key('Escape'); await sleep(200);
    await evalJS('BT.Game.warp(0, false)'); await sleep(4200);
    s = await state();
    check('playing: sim runs at ~60 Hz on the audio clock', s.screen === 'play' && s.frame > 200 && s.frame < 300, 'frame ' + s.frame + ' after ~4.3s');
    // mouse: select the digger button, then click the first lemming
    await click(9 * 16 + 8, 185);
    const lem = JSON.parse(await evalJS('(function(){var s=BT.Game.sim(),l=s.lems[0];return JSON.stringify({x:l.x-Math.floor(BT.Game.state().cam),y:l.y-5,st:l.st});})()'));
    await click(lem.x + 1, lem.y);
    await sleep(300);
    const after = JSON.parse(await evalJS('(function(){var s=BT.Game.sim();return JSON.stringify({st:s.lems[0].st,left:s.skills.digger});})()'));
    check('mouse: click skill, click lemming -> it starts digging', after.st === 9 && after.left === 2, JSON.stringify(after));
    await shot('4-play');
    const f0 = (await state()).frame; await key('KeyF', 'f'); await sleep(2000); s = await state();
    check('fast-forward doubles the sim (and song) speed', s.frame - f0 > 200 && s.frame - f0 < 300, 'advanced ' + (s.frame - f0) + ' frames in ~2.1s');
    await key('KeyF', 'f');
    await key('KeyT', 't'); await sleep(300); await shot('5-mixer'); await key('KeyT', 't');
    await key('KeyP', 'p'); await sleep(300); const pf = (await state()).frame; await sleep(500);
    check('pause freezes the sim', (await state()).frame === pf);
    await key('KeyP', 'p');
    await click(212 + 90, 180); await sleep(200);
    check('clicking the minimap scrolls the camera', (await state()).cam > 100, 'cam ' + (await state()).cam);
    for (const i of [4, 7, 10, 13, 15]) {                       // one level of every other world, as demos
      await evalJS('BT.Game.warp(' + i + ', true)'); await key('KeyF', 'f'); await sleep(2600);
      s = await state();
      check('world demo ' + s.level + ' runs', s.demo && s.frame > 250 && s.screen === 'play', 'frame ' + s.frame);
      await shot('6-world-' + s.level);
    }
    await evalJS('BT.Game.warp(0, true)'); await key('KeyF', 'f');
    for (let i = 0; i < 60 && (await state()).screen !== 'results'; i++) await sleep(1000);
    s = await state();
    check('solution demo ends on the results screen with lemmings saved', s.screen === 'results' && s.saved > 0, JSON.stringify(s));
    await sleep(3000);
    await shot('7-results');
    const peak = await evalJS('(function(){var a=BT.Audio.analyser(); if(!a) return -1; var m=0; for(var i=0;i<a.freq.length;i++) m=Math.max(m,a.freq[i]); return m;})()');
    check('song replay is audible (analyser peak > 0)', peak > 0, 'peak ' + peak);
    await key('KeyC', 'c'); await sleep(200); await shot('8-no-crt'); await key('KeyC', 'c');
    await key('Escape'); await sleep(300);
    check('esc -> level select', (await state()).screen === 'select');
    check('no console errors / exceptions', b.errors.length === 0, b.errors.slice(0, 6).join(' | '));
  } catch (e) {
    console.log('FAIL browser test aborted: ' + e.message); failed = true;
    if (b.errors.length) console.log('page errors: ' + b.errors.slice(0, 6).join(' | '));
  }
  await b.close();
  console.log('screenshots in ' + shots);
  process.exit(failed ? 1 : 0);
})();
