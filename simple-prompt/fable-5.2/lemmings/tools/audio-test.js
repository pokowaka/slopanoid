#!/usr/bin/env node
/* Optional mix check (dev only).  Nobody can "hear" a unit test, so this renders one
 * full 64-step pattern of every world's song through an OfflineAudioContext inside a
 * headless Chrome and reports peak / RMS for the full mix and for each stem, plus a
 * render of every lemming voice.  It fails on silence, clipping or exceptions.
 *   node tools/audio-test.js */
'use strict';
const path = require('path');
const cdp = require('./cdp');

const PAGE = `
(async function () {
  var A = BT.Audio, out = [], SR = 44100;
  function stats(buf) {
    var pk = 0, sum = 0, n = 0, c, d, i, v;
    for (c = 0; c < buf.numberOfChannels; c++) { d = buf.getChannelData(c); for (i = 0; i < d.length; i++) { v = d[i]; if (v !== v) return { peak: NaN, rms: NaN }; if (Math.abs(v) > pk) pk = Math.abs(v); sum += v * v; n++; } }
    return { peak: pk, rms: Math.sqrt(sum / n) };
  }
  async function render(w, pat, solo) {
    var world = BT.WORLDS[w], song = world.song, ord = song.order.indexOf(pat), s0 = ord * 64, secs = 64 * world.sf / 60 + 1.2;
    var off = new OfflineAudioContext(2, Math.ceil(SR * secs), SR), k;
    A._reset(); A.init(off); A.resetMixer(); A.setSong(w, 5);
    if (solo >= 0) for (k = 0; k < 5; k++) if (k !== solo) A.toggleMute(k);
    A.setTransport(0, s0 * world.sf, 1);
    A._schedule(s0, s0 + 64);
    return stats(await off.startRendering());
  }
  async function voices(w) {
    var world = BT.WORLDS[w], off = new OfflineAudioContext(2, SR * 9, SR), i, res = {};
    A._reset(); A.init(off); A.resetMixer(); A.setSong(w, 0); A.setTransport(0, 0, 1);
    BT.VOICES.forEach(function (v, i) { A._note({ s: 4 + i * 8, v: v, m: v === 'bash' ? world.root - 24 : v === 'drone' ? 38 : world.root + 7, vel: 0.8, d: 4 }); });
    return stats(await off.startRendering());
  }
  for (var w = 0; w < BT.WORLDS.length; w++) {
    var song = BT.WORLDS[w].song, pats = Object.keys(song.pats), row = { world: BT.WORLDS[w].key, bpm: BT.WORLDS[w].bpm, pats: {} };
    for (var p = 0; p < pats.length; p++) row.pats[pats[p]] = await render(w, pats[p], -1);
    row.stems = [];
    for (var k = 0; k < 5; k++) row.stems.push(await render(w, pats[0], k));
    row.voices = await voices(w);
    out.push(row);
  }
  A._reset();
  return JSON.stringify(out);
})()`;

const db = v => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf').padStart(6);

(async () => {
  const b = await cdp.launch('file://' + path.join(__dirname, '..', 'index.html'));
  if (!b) { console.log('Chrome not found - skipping audio test'); return; }
  let failed = false;
  try {
    const res = JSON.parse(await b.evalJS(PAGE));
    console.log('world    bpm  pattern  peak dB  rms dB   | stem rms dB: DRUMS   BASS CHORDS   LEAD   FULL | voices peak/rms');
    for (const r of res) {
      const pats = Object.keys(r.pats);
      pats.forEach((p, i) => {
        const s = r.pats[p];
        let line = `${(i ? '' : r.world).padEnd(8)} ${(i ? '' : String(r.bpm)).padStart(3)}  ${p.padEnd(7)}  ${db(s.peak)}  ${db(s.rms)}`;
        if (i === 0) line += '   |             ' + r.stems.map(x => db(x.rms)).join(' ') + ' | ' + db(r.voices.peak) + ' /' + db(r.voices.rms);
        console.log(line);
        if (!(s.peak > 0.05)) { console.log('  FAIL: pattern ' + p + ' is (nearly) silent'); failed = true; }
        if (!(s.peak < 1.0)) { console.log('  FAIL: pattern ' + p + ' clips'); failed = true; }
      });
      r.stems.forEach((x, k) => { if (!(x.rms > 0.002)) { console.log('  FAIL: stem ' + k + ' of ' + r.world + ' is silent'); failed = true; } });
      if (!(r.voices.peak > 0.05 && r.voices.peak < 1.0)) { console.log('  FAIL: lemming voices of ' + r.world + ' peak ' + r.voices.peak); failed = true; }
    }
    if (b.errors.length) { console.log('page errors: ' + b.errors.slice(0, 5).join(' | ')); failed = true; }
  } catch (e) { console.log('FAIL ' + e.message); failed = true; }
  await b.close();
  console.log(failed ? 'AUDIO TEST FAILED' : 'audio test ok: every pattern, stem and voice renders, nothing clips');
  process.exit(failed ? 1 : 0);
})();
