/* Strict mock of the Web Audio API subset used by js/audio.js (for headless tests). */
'use strict';
let errors = 0, nodes = 0, calls = 0;
const fail = (m) => { if (errors++ < 20) console.log('ERR', m, new Error().stack.split('\n')[3]); };
const fin = (v, what) => { if (typeof v !== 'number' || !isFinite(v)) fail(what + ' not finite: ' + v); };

class Param {
  constructor(v) { this.value = v; }
  setValueAtTime(v, t) { calls++; fin(v, 'setValue v'); fin(t, 'setValue t'); this.value = v; return this; }
  linearRampToValueAtTime(v, t) { calls++; fin(v, 'lin v'); fin(t, 'lin t'); return this; }
  exponentialRampToValueAtTime(v, t) { calls++; fin(v, 'exp v'); fin(t, 'exp t'); if (!(v > 0)) fail('exp ramp to ' + v); return this; }
  setTargetAtTime(v, t, c) { calls++; fin(v, 'tgt v'); fin(t, 'tgt t'); fin(c, 'tgt c'); if (!(c > 0)) fail('timeConstant ' + c); return this; }
  cancelScheduledValues(t) { fin(t, 'cancel t'); return this; }
}
class Node {
  constructor() { nodes++; this.outs = []; }
  connect(n) { if (!n || !(n instanceof Node || n instanceof Param)) fail('connect to non-node'); this.outs.push(n); return n; }
  disconnect() {}
}
class Src extends Node {
  constructor() { super(); this.started = false; this.stopped = false; }
  start(t) { fin(t || 0, 'start'); if (this.started) fail('double start'); this.started = true; }
  stop(t) { fin(t || 0, 'stop'); if (!this.started) fail('stop before start'); if (this.stopped) fail('double stop'); this.stopped = true; }
}
class Osc extends Src { constructor() { super(); this.frequency = new Param(440); this.detune = new Param(0); this.type = 'sine'; } setPeriodicWave() {} }
class Buf extends Src { constructor() { super(); this.playbackRate = new Param(1); } }
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(); }
  resume() {}
  createGain() { const n = new Node(); n.gain = new Param(1); return n; }
  createOscillator() { return new Osc(); }
  createBufferSource() { return new Buf(); }
  createBiquadFilter() { const n = new Node(); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n; }
  createDelay() { const n = new Node(); n.delayTime = new Param(0); return n; }
  createConvolver() { return new Node(); }
  createWaveShaper() { return new Node(); }
  createDynamicsCompressor() { const n = new Node(); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n; }
  createAnalyser() { const n = new Node(); n.frequencyBinCount = 128; n.getByteFrequencyData = () => {}; n.getByteTimeDomainData = () => {}; return n; }
  createChannelMerger() { return new Node(); }
  createPeriodicWave(re, im) { for (const v of re) fin(v, 'pw'); for (const v of im) fin(v, 'pw'); return {}; }
  createBuffer(ch, n, sr) { const d = []; for (let i = 0; i < ch; i++) d.push(new Float32Array(n)); return { getChannelData: (i) => d[i], length: n, duration: n / sr }; }
}
globalThis.AudioContext = Ctx;
module.exports = { stats: () => ({ errors, nodes, calls }), fail };
