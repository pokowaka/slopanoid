/* Headless smoke test: loads the browser scripts under a fake DOM / Web Audio
   and drives the state machine through title -> select -> intro -> play -> results.
   Run: node smoke.js */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path');

/* ---- universal stub: callable, chainable, numeric-ish ---- */
var U = new Proxy(function () { }, {
  get: function (t, p) { if (p === 'value') return 0; if (p === Symbol.toPrimitive) return function () { return 0; }; if (p === 'length') return 0; return U; },
  set: function () { return true; }, apply: function () { return U; }, construct: function () { return U; }
});
var listeners = {};
function on(key) { return function (type, fn) { (listeners[key + ':' + type] = listeners[key + ':' + type] || []).push(fn); }; }
function fire(key, type, ev) { var L = listeners[key + ':' + type] || []; ev = ev || {}; ev.preventDefault = ev.preventDefault || function () { }; for (var i = 0; i < L.length; i++) L[i](ev); }

var now = 0;
var ctx = {
  currentTime: 0, state: 'running', sampleRate: 44100, destination: U, resume: function () { },
  createAnalyser: function () { return { fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0, connect: function () { }, getByteTimeDomainData: function (a) { a.fill(128); }, getByteFrequencyData: function (a) { a.fill(40); } }; },
  createBuffer: function (ch, len) { return { getChannelData: function () { return new Float32Array(len); } }; }
};
['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource', 'createDynamicsCompressor', 'createDelay', 'createStereoPanner', 'createWaveShaper', 'createPeriodicWave', 'createConvolver', 'createChannelMerger'].forEach(function (k) { ctx[k] = function () { return U; }; });

var rafCb = null, canvas = {
  width: 0, height: 0, style: {}, addEventListener: on('canvas'),
  getContext: function () { return { createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }, putImageData: function () { } }; },
  getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 400 }; }
};
var store = {};
var win = global;
win.window = win;
win.AudioContext = function () { return ctx; };
win.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } };
win.requestAnimationFrame = function (cb) { rafCb = cb; };
win.addEventListener = on('window');
win.innerWidth = 1280; win.innerHeight = 800;
win.setInterval = function (fn) { win.__tick = fn; return 1; };
win.performance = { now: function () { return now; } };
win.document = { getElementById: function () { return canvas; }, body: { classList: { toggle: function () { } } } };

['sim.js', 'levels.js', 'solutions.js', 'audio.js', 'render.js', 'game.js'].forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  // make the IIFEs attach to window instead of module.exports
  src = src.replace(/typeof module !== 'undefined' && module\.exports/g, 'false');
  vm.runInThisContext(src, { filename: f });
});
var GAME = win.BT_GAME, G = GAME.G, audio = GAME.audio;
function frames(n) { for (var i = 0; i < n; i++) { now += 1000 / 60; ctx.currentTime = now / 1000; rafCb(now); if (win.__tick) win.__tick(); } }
function key(code, k, extra) { var ev = { code: code, key: k || code, shiftKey: false }; if (extra) for (var p in extra) ev[p] = extra[p]; fire('window', 'keydown', ev); fire('window', 'keyup', ev); }
function click(x, y, button) { fire('canvas', 'mousemove', { clientX: x * 2, clientY: y * 2 }); fire('canvas', 'mousedown', { clientX: x * 2, clientY: y * 2, button: button || 0 }); fire('canvas', 'mouseup', { clientX: x * 2, clientY: y * 2, button: button || 0 }); }
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok   ' + m); }
/* optional screenshots: SHOT_DIR=/some/dir node smoke.js */
function png(name) {
  if (!process.env.SHOT_DIR) return;
  var zlib = require('zlib'), R = GAME.renderer, W = 320, H = 200, raw = Buffer.alloc((W * 4 + 1) * H), d = R.img.data;
  for (var y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (var x = 0; x < W * 4; x++) raw[y * (W * 4 + 1) + 1 + x] = d[y * W * 4 + x]; }
  function crc(buf) { var c, crcTable = png.T || (png.T = (function () { var t = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })()); c = 0xffffffff; for (var i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) { var len = Buffer.alloc(4); len.writeUInt32BE(data.length); var td = Buffer.concat([Buffer.from(type), data]); var c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
  var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  var out = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path.join(process.env.SHOT_DIR, name + '.png'), out);
}

assert(G.state === 'title', 'boots into title/attract mode');
frames(600); png('01_title');
assert(G.sim && G.sim.frame > 500, 'attract demo sim advances (' + G.sim.frame + ' frames)');
key('Enter'); assert(G.state === 'select', 'any key -> level select'); assert(audio.ready, 'audio initialised on first gesture');
frames(30); png('02_select');
'CHIPDIG2'.split('').forEach(function (c) { key('Key' + c, c); }); key('Enter');
assert(G.state === 'intro' && G.sel === 1 && G.unlocked >= 1, 'password warp unlocks + selects DIG DEEP'); frames(5); png('03_intro');
key('Escape'); assert(G.state === 'select', 'intro esc -> select');
key('ArrowDown'); key('ArrowUp'); key('Enter'); assert(G.state === 'intro', 'enter on unlocked level -> intro');
key('Enter'); assert(G.state === 'play' && !G.demo, 'intro enter -> play');
frames(120); png('04_play');
// panel interaction: select digger via key + click a lemming
key('Digit8', '8'); assert(G.skill === 'digger', 'digit selects digger');
click(1 * 14 + 7, 185); assert(G.sim.rate === G.sim.rateMin + 1, 'rate+ button');
click(0 * 14 + 7, 185); assert(G.sim.rate === G.sim.rateMin, 'rate- button');
key('KeyT'); assert(G.mixer, 'mixer overlay toggles'); frames(5); png('05_mixer'); key('Digit1', '1'); assert(audio.stemMute[0] === 1, 'mixer mute via key'); key('Digit1', '1'); key('KeyT');
key('KeyF'); assert(G.ff, 'fast forward on'); frames(60); key('KeyF');
key('KeyP'); assert(G.paused, 'pause on'); frames(10); key('KeyP');
key('ArrowRight'); fire('window', 'keyup', { code: 'ArrowRight', key: 'ArrowRight' });
// find a walking lemming and assign digger by clicking on it
var l0 = G.sim.lemmings[0]; frames(240); l0 = G.sim.lemmings[0];
G.cam = Math.max(0, Math.min(G.sim.W - 320, l0.x - 160));
click(l0.x - G.cam, l0.y - 5);
assert(l0.state === 'digger' || G.sim.skills.digger < 2, 'click assigns digger to lemming (state=' + l0.state + ')');
click(MINI(), 185); // minimap click
function MINI() { return 249 + 35; }
key('KeyM'); key('KeyM'); key('KeyC'); key('KeyC');
key('KeyN', 'n'); key('KeyN', 'n'); assert(G.sim.nuked, 'double N nukes');
frames(60 * 12);
assert(G.state === 'results', 'nuked level ends in results (state=' + G.state + ')');
frames(300); png('06_results');
key('KeyR'); assert(G.state === 'intro', 'results R -> retry intro');
key('KeyD'); assert(G.state === 'play' && G.demo, 'intro D -> demo playback');
var guard = 0; while (G.state === 'play' && guard++ < 200) { frames(60); if (guard === 8) png('07_demo'); }
assert(G.state === 'results' && G.result.won, 'demo solves DIG DEEP (saved ' + G.result.saved + '/' + G.result.total + ')');
assert(G.rec.length > 50, 'song recording captured (' + G.rec.length + ' events)');
frames(120);
key('Escape'); assert(G.state === 'select', 'results esc -> select');
key('Escape'); assert(G.state === 'title', 'select esc -> title');
// Run every level's demo from the title cycle for a few seconds to exercise all renderers
for (var i = 0; i < 16; i++) { GAME.startLevel(i, true, true); G.state = 'play'; frames(900); png('lvl' + (i < 9 ? '0' : '') + (i + 1)); }
console.log('ALL SMOKE CHECKS PASS');
