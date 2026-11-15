/* Headless helpers shared by the dev tools: load the game modules into Node,
 * run levels deterministically, turn solution scripts into recordings, write PNGs. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const MODULES = ['core', 'worlds', 'songs', 'terrain', 'levels', 'solutions', 'sim', 'font', 'sprites', 'render'];

function load(skip) {
  for (const m of MODULES) {
    if (skip && skip.includes(m)) continue;
    const file = path.join(ROOT, 'js', m + '.js');
    if (!fs.existsSync(file)) continue;
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  }
  return globalThis.BT;
}

// Play a level with a list of recorded commands; returns the finished sim.
function run(BT, level, cmds, opts) {
  opts = opts || {};
  const sim = new BT.Sim(level);
  const list = (cmds || []).slice().sort((a, b) => a.frame - b.frame);
  let p = 0, failed = [];
  const maxF = opts.until !== undefined ? opts.until : Infinity;
  while (!sim.over && sim.frame < maxF) {
    while (p < list.length && list[p].frame <= sim.frame) {
      if (!sim.apply(list[p])) failed.push(list[p]);
      p++;
    }
    sim.step();
    if (opts.onFrame) opts.onFrame(sim);
    sim.ev.length = 0;
  }
  sim.failedCmds = failed;
  return sim;
}

/* Solution scripts are written as rules, e.g.
 *   { l: 0, x: 180, skill: 'digger' }            lemming 0, walking, reaches x >= 180 (x <= if dir:-1)
 *   { l: 3, when: (l, sim) => ..., skill: ... }   custom predicate
 *   { pick: (sim) => lemming|null, skill: ... }   choose the lemming dynamically
 *   { nuke: true, when: sim => ... } / { rr: 99, after: 600 }
 * `beat: true` waits for the next beat once the condition holds (shows off the groove bonus).
 * solve() plays the level, fires each rule once and returns frame-exact commands. */
function solve(BT, level, rules, opts) {
  opts = opts || {};
  const S = BT.ST;
  const sim = new BT.Sim(level);
  const st = rules.map(r => ({ r, done: false, armed: false }));
  const cmds = [], warn = [];
  const maxF = opts.until !== undefined ? opts.until : Infinity;
  function cond(r) {
    if (r.after !== undefined && sim.frame < r.after) return null;
    if (r.nuke || r.rr !== undefined) return (!r.when || r.when(sim)) ? true : null;
    let l = r.pick ? r.pick(sim) : sim.lems[r.l];
    if (!l) return null;
    if (r.when) return r.when(l, sim) ? l : null;
    const want = r.st ? S[r.st] : S.WALK;
    if (r.st !== 'ANY' && l.st !== want) return null;
    const dir = r.dir || (r.x !== undefined ? 1 : 0);      // an x threshold means "walking right" unless dir:-1
    if (dir && l.dir !== dir) return null;
    if (r.x !== undefined) { if (dir > 0 ? l.x < r.x : l.x > r.x) return null; }
    if (r.y !== undefined && l.y < r.y) return null;
    return l;
  }
  while (!sim.over && sim.frame < maxF) {
    for (const s of st) {
      if (s.done) continue;
      const r = s.r;
      let hit = s.armed || cond(r);
      if (!hit) continue;
      if (r.beat && sim.beatDist() > 2) { s.armed = hit; continue; }
      s.done = true;
      let c;
      if (r.nuke) c = { frame: sim.frame, nuke: true };
      else if (r.rr !== undefined) c = { frame: sim.frame, rr: r.rr };
      else c = { frame: sim.frame, lemmingIndex: hit.i, skill: r.skill };
      if (sim.apply(c)) cmds.push(c); else warn.push('rule failed @' + sim.frame + ': ' + JSON.stringify(c));
    }
    sim.step();
    if (opts.onFrame) opts.onFrame(sim);
    sim.ev.length = 0;
  }
  st.forEach(s => { if (!s.done && !s.r.optional) warn.push('rule never fired: ' + JSON.stringify(s.r, (k, v) => typeof v === 'function' ? 'fn' : v)); });
  return { sim, cmds, warn };
}

// Minimal PNG encoder (RGBA8) for screenshots of the software framebuffer.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, u32, w, h, scale) {
  scale = scale || 1;
  const W = w * scale, H = h * scale, raw = Buffer.alloc((W * 4 + 1) * H);
  const src = new Uint8Array(u32.buffer, u32.byteOffset, w * h * 4);
  for (let y = 0; y < H; y++) {
    const sy = (y / scale) | 0, row = y * (W * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      const si = (sy * w + ((x / scale) | 0)) * 4, di = row + 1 + x * 4;
      raw[di] = src[si]; raw[di + 1] = src[si + 1]; raw[di + 2] = src[si + 2]; raw[di + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

module.exports = { ROOT, load, run, solve, writePNG };
