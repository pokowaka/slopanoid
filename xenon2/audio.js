'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — audio.js
 *  A real-time 8-channel ProTracker / XM-style sequencer built on the Web Audio
 *  API. Nothing is sampled: FM/analog Carpenter bass, resonant TB-303, ping-pong
 *  lead, PWM chords & brass stabs, formant-synthesized "MEGA-BLAST!" / "YEAH!"
 *  vocal samples + vinyl scratching, 808/909 drums and gated-reverb claps.
 *
 *  Song layout (per evolutionary era):
 *    00 INTRO -> 01 PRECINCT 13 MAIN GROOVE -> 02 TB-303 ACID BREAKDOWN ->
 *    03 BRASS & SCRATCH DROP -> 04 BRIDGE -> 05 BOSS RAVE  (+ 06 CRISPIN'S DUB)
 * ===========================================================================*/
const Music = (() => {
  const NCH = 8, ROWS = 64;
  const CH_NAMES = ['P13 BASS', 'TB-303', 'PINGPONG LEAD', 'PWM / BRASS', 'SCRATCH / VOX', 'KICK / SUB', 'SNARE / CLAP', 'HATS / BELL'];
  const INST = ['', 'CARPENTER BASS', 'TB-303 ACID', 'SAW LEAD', 'PWM CHORDS', 'BRASS STAB', 'ORCH HIT', 'VINYL SCRATCH',
    'VOX "MEGA"', 'VOX "BLAST"', 'VOX "YEAH"', 'BACKSPIN', 'KICK 909', 'SUB DROP', 'BREAK SNARE', 'GATED CLAP',
    'CLOSED HAT', 'OPEN HAT', '808 COWBELL', 'KICK 808', 'RIMSHOT', 'SQUARE ARP'];
  const PAT_NAMES = ['INTRO', 'PRECINCT 13 MAIN GROOVE', 'TB-303 ACID BREAKDOWN', 'BRASS & SCRATCH DROP', 'BRIDGE', 'BOSS RAVE', "CRISPIN'S ELECTRO-DUB"];
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harm: [0, 2, 3, 5, 7, 8, 11], phryg: [0, 1, 3, 5, 7, 8, 10],
  };
  // One song per epoch: key, tempo, mode, chord progression (scale degrees), swing.
  const ERAS = [
    { name: 'CAMBRIAN REEF BREAKS', root: 33, bpm: 104, scale: 'minor', prog: [0, 0, 5, 6], acid: 'sawtooth', swing: 0.14, seed: 1989 },
    { name: 'ABYSSAL DUB PRESSURE', root: 38, bpm: 100, scale: 'dorian', prog: [0, 6, 3, 0], acid: 'square', swing: 0.18, seed: 4242 },
    { name: 'CLOCKWORK FUNK ENGINE', root: 36, bpm: 112, scale: 'harm', prog: [0, 5, 3, 4], acid: 'sawtooth', swing: 0.08, seed: 1822 },
    { name: 'SILICON COPPER RAVE', root: 40, bpm: 120, scale: 'minor', prog: [0, 5, 2, 6], acid: 'square', swing: 0.03, seed: 68000 },
    { name: 'XENITE HIVE HARDCORE', root: 30, bpm: 128, scale: 'phryg', prog: [0, 1, 0, 6], acid: 'sawtooth', swing: 0.0, seed: 666 },
  ];

  let ctx = null;
  let master, comp, analyser, musicBus, dubFilter, sfxBus, noiseBuf, shaper;
  const chIn = [], chGain = [], chPan = [];
  let pingIn, pingDL, pingDR, dubSend, dubDelay, revIn, rewindNode = null;
  const vox = {};
  const mute = new Array(NCH).fill(false), solo = new Array(NCH).fill(false);
  const level = new Float32Array(NCH);
  let soundOn = true;

  // sequencer state
  let song = null, mode = 'normal', order = [0], orderPos = 0, pat = 0, row = 0;
  let bpm = 104, rowDur = 60 / 104 / 4, nextTime = 0, timer = null;
  let pendingMode = null, pendingJump = null, pendingEra = null;
  const vis = [];
  let cur = { t: 0, pat: 0, row: 0, pos: 0, trig: null };
  let acidCut = 400, acidLastF = 0, leadLastF = 0, openHat = null;
  const lastSfx = {};

  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ------------------------------------------------------------------ nodes
  function O(type, f, t) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; }
  function G(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function F(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; }
  function NZ(t, dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
  function adsr(g, t, a, peak, dcy, sus, rel, len) {
    const p = g.gain; len = Math.max(len, a + 0.01);
    p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(sus, t + a, Math.max(0.005, dcy / 3));
    p.setTargetAtTime(0.0001, t + len, Math.max(0.005, rel / 3));
  }
  function stopAll(nodes, end) { for (const n of nodes) { n.start(n._t || 0); n.stop(end); } }

  // ---------------------------------------------------------- vocal synth
  // Klatt-style cascade formant synthesizer rendered offline into AudioBuffers,
  // then crushed to 8-bit / 22kHz for that authentic Amiga sample grit.
  function synthVoice(phones) {
    const fs = ctx.sampleRate;
    let total = 0; for (const p of phones) total += p.d;
    const N = Math.ceil(total * fs) + 256;
    const vo = new Float32Array(N), no = new Float32Array(N);
    let phase = 0, prevG = 0, n = 0;
    const y1 = [0, 0, 0], y2 = [0, 0, 0], cf = new Float32Array(9);
    let f1 = 0, f2 = 0;
    for (let pi = 0; pi < phones.length; pi++) {
      const p = phones[pi], q = phones[pi + 1] || p;
      const len = Math.floor(p.d * fs);
      // fricative resonator for this phoneme
      const nf = p.nf || 3000, nb = p.nb || 2000;
      const nr = Math.exp(-Math.PI * nb / fs), nC = -nr * nr, nB = 2 * nr * Math.cos(2 * Math.PI * nf / fs), nA = 1 - nB - nC;
      for (let k = 0; k < len; k++, n++) {
        const u = k / len, m = u > 0.6 ? (u - 0.6) / 0.4 : 0;
        if ((k & 15) === 0) {
          for (let j = 0; j < 3; j++) {
            const Fq = p.f[j] + (q.f[j] - p.f[j]) * m, B = [90, 120, 170][j];
            const r = Math.exp(-Math.PI * B / fs), Cc = -r * r, Bc = 2 * r * Math.cos(2 * Math.PI * Fq / fs);
            cf[j * 3] = 1 - Bc - Cc; cf[j * 3 + 1] = Bc; cf[j * 3 + 2] = Cc;
          }
        }
        const f0 = (p.p0 + (p.p1 - p.p0) * u) * (1 + (Math.random() - 0.5) * 0.01);
        phase += f0 / fs; if (phase >= 1) phase -= 1;
        let g; if (phase < 0.4) g = 0.5 * (1 - Math.cos(Math.PI * phase / 0.4)); else if (phase < 0.56) g = Math.cos(Math.PI * (phase - 0.4) / 0.32); else g = 0;
        const amp = p.v + (q.v - p.v) * m;
        let x = (g - prevG) * amp + (Math.random() * 2 - 1) * 0.004 * amp; prevG = g;
        for (let j = 0; j < 3; j++) { const yy = cf[j * 3] * x + cf[j * 3 + 1] * y1[j] + cf[j * 3 + 2] * y2[j]; y2[j] = y1[j]; y1[j] = yy; x = yy; }
        vo[n] = x;
        const na = (p.n || 0) + ((q.n || 0) - (p.n || 0)) * m * 0.5;
        if (na > 0) { const w = Math.random() * 2 - 1; const yy = nA * w + nB * f1 + nC * f2; f2 = f1; f1 = yy; no[n] = yy * na; }
      }
    }
    let pv = 1e-6, pn = 1e-6;
    for (let i = 0; i < N; i++) { pv = Math.max(pv, Math.abs(vo[i])); pn = Math.max(pn, Math.abs(no[i])); }
    const buf = ctx.createBuffer(1, N, fs), d = buf.getChannelData(0);
    let hold = 0;
    for (let i = 0; i < N; i++) {
      if ((i & 1) === 0) { const s = Math.tanh((vo[i] / pv) * 1.6 + (no[i] / pn) * 0.45); hold = Math.round(s * 110) / 127; }
      d[i] = hold;
    }
    // short fade edges
    for (let i = 0; i < 64; i++) { d[i] *= i / 64; d[N - 1 - i] *= i / 64; }
    return buf;
  }
  function reversed(buf) {
    const r = ctx.createBuffer(1, buf.length, buf.sampleRate), s = buf.getChannelData(0), d = r.getChannelData(0);
    for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
    return r;
  }
  function buildVox() {
    const V = (f) => f;
    vox.mega = synthVoice([
      { d: 0.075, f: V([260, 1150, 2200]), v: 0.45, p0: 132, p1: 138 },
      { d: 0.13, f: V([500, 1850, 2480]), v: 1.0, p0: 140, p1: 150 },
      { d: 0.035, f: V([400, 1600, 2400]), v: 0.04, p0: 150, p1: 150 },
      { d: 0.02, f: V([600, 1500, 2400]), v: 0.3, n: 0.6, nf: 1800, nb: 1200, p0: 150, p1: 150 },
      { d: 0.22, f: V([760, 1150, 2450]), v: 1.0, p0: 158, p1: 118 },
    ]);
    vox.blast = synthVoice([
      { d: 0.018, f: V([300, 900, 2300]), v: 0.2, n: 0.5, nf: 900, nb: 900, p0: 150, p1: 150 },
      { d: 0.06, f: V([380, 1050, 2600]), v: 0.75, p0: 152, p1: 156 },
      { d: 0.2, f: V([680, 1650, 2450]), v: 1.0, p0: 160, p1: 128 },
      { d: 0.13, f: V([680, 1650, 2450]), v: 0.0, n: 1.0, nf: 5600, nb: 2600, p0: 128, p1: 128 },
      { d: 0.04, f: V([600, 1600, 2400]), v: 0.0, n: 0.0, p0: 120, p1: 120 },
      { d: 0.035, f: V([600, 1600, 2400]), v: 0.0, n: 0.8, nf: 3800, nb: 3000, p0: 120, p1: 120 },
    ]);
    vox.yeah = synthVoice([
      { d: 0.07, f: V([290, 2250, 2950]), v: 0.7, p0: 165, p1: 175 },
      { d: 0.1, f: V([520, 1850, 2500]), v: 1.0, p0: 178, p1: 170 },
      { d: 0.3, f: V([740, 1180, 2420]), v: 1.0, p0: 168, p1: 104 },
    ]);
    vox.megaR = reversed(vox.mega); vox.blastR = reversed(vox.blast); vox.yeahR = reversed(vox.yeah);
  }

  // --------------------------------------------------------------- voices
  function vBass(t, n, v, dur, out) {
    const f = mtof(n), end = t + dur + 0.25;
    const o1 = O('sawtooth', f, t), o2 = O('sawtooth', f * 1.0065, t), sub = O('square', f * 0.5, t), mod = O('sine', f * 2, t);
    const mg = G(0); mg.gain.setValueAtTime(f * 2.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t + 0.22);
    mod.connect(mg); mg.connect(o1.frequency);
    const lp = F('lowpass', 0, 5);
    lp.frequency.setValueAtTime(Math.min(9000, f * 14 + 500), t); lp.frequency.setTargetAtTime(f * 2.6 + 140, t + 0.004, 0.07);
    const sg = G(0.4); sub.connect(sg);
    const g = G(0); adsr(g, t, 0.004, 0.3 * v, 0.14, 0.17 * v, 0.05, dur);
    o1.connect(lp); o2.connect(lp); sg.connect(lp); lp.connect(g); g.connect(out);
    for (const o of [o1, o2, sub, mod]) { o.start(t); o.stop(end); }
  }
  function vAcid(t, n, v, dur, fx, out) {
    const f = mtof(n), acc = v > 0.85, end = t + dur + 0.2;
    const o = O(song.era.acid, f, t);
    if (fx === '3' && acidLastF) { o.frequency.setValueAtTime(acidLastF, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
    acidLastF = f;
    const lp = F('lowpass', 0, acc ? 21 : 14);
    const peak = Math.min(12000, acidCut * (acc ? 6 : 3.4) + 300);
    lp.frequency.setValueAtTime(peak, t); lp.frequency.setTargetAtTime(acidCut, t + 0.002, acc ? 0.09 : 0.055);
    const ws = ctx.createWaveShaper(); ws.curve = shaper;
    const g = G(0); adsr(g, t, 0.003, acc ? 0.27 : 0.17, 0.12, acc ? 0.2 : 0.12, 0.02, dur);
    o.connect(lp); lp.connect(ws); ws.connect(g); g.connect(out);
    o.start(t); o.stop(end);
  }
  function vLead(t, n, v, dur, fx, inst, out) {
    const f = mtof(n), end = t + dur + 0.3, arp = inst === 21;
    const o1 = O(arp ? 'square' : 'sawtooth', f, t), o2 = O('sawtooth', f, t);
    o1.detune.setValueAtTime(-7, t); o2.detune.setValueAtTime(8, t);
    if (fx === '3' && leadLastF && !arp) { for (const o of [o1, o2]) { o.frequency.setValueAtTime(leadLastF, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); } }
    leadLastF = f;
    const lfo = O('sine', 5.6, t), lg = G(0);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(arp ? 0 : f * 0.011, t + 0.35);
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const lp = F('lowpass', arp ? 5200 : 3600, 1.6);
    if (arp) { lp.frequency.setValueAtTime(6000, t); lp.frequency.setTargetAtTime(1200, t, 0.05); }
    const g = G(0);
    if (arp) adsr(g, t, 0.002, 0.11 * v, 0.06, 0.03 * v, 0.03, Math.min(dur, 0.12));
    else adsr(g, t, 0.012, 0.13 * v, 0.2, 0.1 * v, 0.1, dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    for (const o of [o1, o2, lfo]) { o.start(t); o.stop(end); }
  }
  function chordNotes(n, fx, fxv) { return fx === '0' ? [n, n + (fxv >> 4), n + (fxv & 15)] : [n, n + 3, n + 7]; }
  function vChord(t, n, v, dur, fx, fxv, inst, out) {
    const notes = chordNotes(n, fx, fxv);
    if (inst === 4) { // PWM pad: difference of detuned saws -> sweeping pulse width
      const end = t + dur + 0.5;
      const lp = F('lowpass', 2400, 1), g = G(0);
      adsr(g, t, 0.07, 0.07 * v, 0.4, 0.055 * v, 0.35, dur);
      lp.connect(g); g.connect(out);
      for (const nn of notes) {
        const f = mtof(nn);
        const a = O('sawtooth', f, t), b = O('sawtooth', f * 1.0035, t), inv = G(-1);
        a.connect(lp); b.connect(inv); inv.connect(lp);
        a.start(t); b.start(t); a.stop(end); b.stop(end);
      }
    } else if (inst === 5) { // brass stab
      const len = Math.min(dur, 0.24), end = t + len + 0.25;
      const lp = F('lowpass', 300, 2.5), g = G(0);
      lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(3400, t + 0.03); lp.frequency.setTargetAtTime(1300, t + 0.03, 0.08);
      adsr(g, t, 0.012, 0.11 * v, 0.1, 0.07 * v, 0.06, len);
      lp.connect(g); g.connect(out);
      for (const nn of notes) for (const dt of [-9, 9]) { const o = O('sawtooth', mtof(nn), t); o.detune.setValueAtTime(dt, t); o.connect(lp); o.start(t); o.stop(end); }
    } else { // orchestra hit
      const end = t + 0.7;
      const lp = F('lowpass', 6000, 1.2), g = G(0);
      lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.45);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.6);
      lp.connect(g); g.connect(out);
      for (const nn of [...notes, n + 12, n - 12]) for (const ty of ['sawtooth', 'square']) {
        const o = O(ty, mtof(nn) * 1.02, t); o.frequency.exponentialRampToValueAtTime(mtof(nn), t + 0.05); o.connect(lp); o.start(t); o.stop(end);
      }
      const nz = NZ(t, 0.12), bp = F('bandpass', 2200, 0.8), ng = G(0);
      ng.gain.setValueAtTime(0.35 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      nz.connect(bp); bp.connect(ng); ng.connect(out);
      const th = O('sine', mtof(n) / 2, t), tg = G(0); tg.gain.setValueAtTime(0.3 * v, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      th.connect(tg); tg.connect(out); th.start(t); th.stop(t + 0.35);
    }
  }
  function vVox(t, buf, n, v, fx, fxv, out) {
    const rate = Math.pow(2, (n - 60) / 12);
    const g = G(0.85 * v); g.connect(out);
    const play = (when, off, dur) => { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.setValueAtTime(rate, when); s.connect(g); s.start(when, off, dur); };
    if (fx === 'E' && (fxv >> 4) === 9) { // E9x retrigger: stutter "M-M-MEGA"
      const iv = Math.max(1, fxv & 15) * rowDur / 3;
      for (let k = 0; k < 3; k++) play(t + k * iv, 0, iv * 0.8 * rate);
      play(t + 3 * iv, 0);
    } else play(t, 0);
  }
  function vScratch(t, n, v, dur, out) {
    dur = Math.max(0.12, Math.min(0.42, dur));
    const base = Math.pow(2, (n - 60) / 12);
    const bp = F('highpass', 350, 0.7), g = G(0.9 * v); bp.connect(g); g.connect(out);
    const half = dur * 0.5;
    const s1 = ctx.createBufferSource(); s1.buffer = vox.yeah;
    s1.playbackRate.setValueAtTime(0.25 * base, t); s1.playbackRate.linearRampToValueAtTime(2.4 * base, t + half * 0.55); s1.playbackRate.linearRampToValueAtTime(0.15, t + half);
    s1.connect(bp); s1.start(t, 0.06); s1.stop(t + half);
    const played = 0.06 + 1.25 * base * half;
    const s2 = ctx.createBufferSource(); s2.buffer = vox.yeahR;
    s2.playbackRate.setValueAtTime(0.2, t + half); s2.playbackRate.linearRampToValueAtTime(2.8 * base, t + half + half * 0.45); s2.playbackRate.linearRampToValueAtTime(0.2, t + dur);
    s2.connect(bp); s2.start(t + half, Math.max(0, vox.yeahR.duration - played)); s2.stop(t + dur);
    const nz = NZ(t, dur), nb = F('bandpass', 2600, 1.5), ng = G(0);
    nb.frequency.setValueAtTime(1200, t); nb.frequency.linearRampToValueAtTime(4800, t + half * 0.5); nb.frequency.linearRampToValueAtTime(900, t + half); nb.frequency.linearRampToValueAtTime(5200, t + half * 1.5); nb.frequency.linearRampToValueAtTime(800, t + dur);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.09 * v, t + 0.02); ng.gain.linearRampToValueAtTime(0.0001, t + dur);
    nz.connect(nb); nb.connect(ng); ng.connect(out);
  }
  function vBackspin(t, v, out) {
    const s = ctx.createBufferSource(); s.buffer = vox.blastR;
    s.playbackRate.setValueAtTime(3.2, t); s.playbackRate.exponentialRampToValueAtTime(0.15, t + 0.8);
    const lp = F('lowpass', 8000, 3), g = G(0.9 * v);
    lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.85);
    s.connect(lp); lp.connect(g); g.connect(out); s.start(t); s.stop(t + 0.9);
    const nz = NZ(t, 0.85), bp = F('bandpass', 3000, 4), ng = G(0);
    bp.frequency.setValueAtTime(6000, t); bp.frequency.exponentialRampToValueAtTime(200, t + 0.85);
    ng.gain.setValueAtTime(0.12 * v, t); ng.gain.linearRampToValueAtTime(0.0001, t + 0.85);
    nz.connect(bp); bp.connect(ng); ng.connect(out);
  }
  function vKick(t, v, out, deep) {
    const o = O('sine', deep ? 130 : 185, t), g = G(0);
    o.frequency.exponentialRampToValueAtTime(deep ? 40 : 50, t + (deep ? 0.12 : 0.07));
    const dec = deep ? 0.9 : 0.34;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    if (deep) { const ws = ctx.createWaveShaper(); ws.curve = shaper; o.connect(ws); ws.connect(g); } else o.connect(g);
    g.connect(out); o.start(t); o.stop(t + dec + 0.05);
    const nz = NZ(t, 0.02), hp = F('highpass', 1800, 0.7), ng = G(0);
    ng.gain.setValueAtTime(0.3 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    nz.connect(hp); hp.connect(ng); ng.connect(out);
  }
  function vSub(t, v, out) {
    const o = O('sine', 95, t), g = G(0);
    o.frequency.exponentialRampToValueAtTime(26, t + 1.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.45);
  }
  function vSnare(t, v, out) {
    const nz = NZ(t, 0.25), hp = F('highpass', 1100, 0.7), bp = F('peaking', 3500, 1), ng = G(0);
    bp.gain.value = 6;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.5 * v, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    nz.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(out);
    const o = O('triangle', 200, t), g = G(0); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.13);
  }
  function vClap(t, v, out) {
    const nz = NZ(t, 0.4), bp = F('bandpass', 1250, 1.1), g = G(0);
    const p = g.gain; p.setValueAtTime(0.0001, t);
    for (let k = 0; k < 3; k++) { const tk = t + k * 0.011; p.setValueAtTime(0.55 * v, tk); p.exponentialRampToValueAtTime(0.05, tk + 0.009); }
    p.setValueAtTime(0.45 * v, t + 0.034); p.exponentialRampToValueAtTime(0.001, t + 0.2);
    nz.connect(bp); bp.connect(g); g.connect(out);
    const send = G(0.55 * v); g.connect(send); send.connect(revIn);
  }
  function vRim(t, v, out) {
    const o = O('triangle', 820, t), g = G(0);
    g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06);
    const nz = NZ(t, 0.03), hp = F('bandpass', 3200, 2), ng = G(0);
    ng.gain.setValueAtTime(0.3 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    nz.connect(hp); hp.connect(ng); ng.connect(out);
  }
  function vHat(t, v, open, out) {
    if (openHat) { try { openHat.gain.cancelScheduledValues(t); openHat.gain.setTargetAtTime(0.0001, t, 0.008); } catch (e) { /* choke */ } openHat = null; }
    const dec = open ? 0.32 : 0.045;
    const nz = NZ(t, dec + 0.02), hp = F('highpass', open ? 6500 : 7800, 0.8), g = G(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    nz.connect(hp); hp.connect(g); g.connect(out);
    if (open) openHat = g;
  }
  function vCowbell(t, v, out) {
    const bp = F('bandpass', 1400, 1.5), g = G(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    bp.connect(g); g.connect(out);
    for (const f of [540, 800]) { const o = O('square', f, t); o.connect(bp); o.start(t); o.stop(t + 0.3); }
  }

  function playCell(c, cl, t) {
    const v = cl.v / 64, out = chIn[c], dur = Math.max(0.05, (cl.len || 1) * rowDur * 0.92);
    switch (cl.i) {
      case 1: vBass(t, cl.n, v, dur, out); break;
      case 2: vAcid(t, cl.n, v, dur, cl.fx, out); break;
      case 3: case 21: vLead(t, cl.n, v, dur, cl.fx, cl.i, out); break;
      case 4: case 5: case 6: vChord(t, cl.n, v, dur, cl.fx, cl.fxv, cl.i, out); break;
      case 7: vScratch(t, cl.n, v, dur, out); break;
      case 8: vVox(t, vox.mega, cl.n, v, cl.fx, cl.fxv, out); break;
      case 9: vVox(t, vox.blast, cl.n, v, cl.fx, cl.fxv, out); break;
      case 10: vVox(t, vox.yeah, cl.n, v, cl.fx, cl.fxv, out); break;
      case 11: vBackspin(t, v, out); break;
      case 12: vKick(t, v, out, false); break;
      case 13: vSub(t, v, out); break;
      case 14: vSnare(t, v, out); break;
      case 15: vClap(t, v, out); break;
      case 16: vHat(t, v, false, out); break;
      case 17: vHat(t, v, true, out); break;
      case 18: vCowbell(t, v, out); break;
      case 19: vKick(t, v, out, true); break;
      case 20: vRim(t, v, out); break;
    }
  }

  // ------------------------------------------------------------- composer
  function buildSong(ei) {
    const E = ERAS[ei], S = SCALES[E.scale], rnd = rng(E.seed), Rt = E.root;
    const sc = d => S[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const tri = d => [sc(d), sc(d + 2), sc(d + 4)];
    const pats = [];
    for (let p = 0; p < 7; p++) pats.push({ name: PAT_NAMES[p], ch: Array.from({ length: NCH }, () => new Array(ROWS).fill(null)) });
    const put = (p, c, r, n, i, v = 64, fx = '', fxv = 0) => { if (r >= 0 && r < ROWS) pats[p].ch[c][r] = { n, i, v, fx, fxv, len: 1 }; };
    const chordFx = d => { const t = tri(d); return ((t[1] - t[0]) << 4) | (t[2] - t[0]); };
    const DR = { x: [5, 12, 64], X: [5, 19, 64], D: [5, 13, 60], k: [5, 12, 40], s: [6, 14, 64], g: [6, 14, 18], c: [6, 15, 60], r: [6, 20, 56], h: [7, 16, 28], H: [7, 16, 50], o: [7, 17, 42], b: [7, 18, 40] };
    const drums = (p, bars, str) => { for (const b of bars) for (let k = 0; k < 16; k++) { const d = DR[str[k]]; if (d) put(p, d[0], b * 16 + k, 60, d[1], d[2]); } };
    const BASS = {
      p13: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 10, 0, 12, 7],
      p13b: [0, null, 0, 12, null, 0, 10, null, 0, null, 0, 12, null, 7, 10, 12],
      boss: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 10, 12],
      dub: [0, null, null, 0, null, null, null, null, 7, null, null, 5, 3, null, null, null],
      intro: [0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null, 7, null],
      bridge: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, 5, null],
    };
    const bass = (p, bars, pt, acc) => { for (const b of bars) { const cr = sc(E.prog[b]); pt.forEach((o, k) => { if (o !== null) put(p, 0, b * 16 + k, Rt + cr + o, 1, (k % 4 === 0) ? 64 : acc); }); } };
    const acid = (p, bars, dens, c0, c1, accP, slideP, shape) => {
      for (const b of bars) {
        const cr = sc(E.prog[b]);
        for (let k = 0; k < 16; k++) {
          if (k === 0 || rnd() < dens) {
            const off = [0, 0, 12, 0, 7, 12, 3, 10, -2, 5, 0, 15][Math.floor(rnd() * 12)];
            const sl = k > 0 && rnd() < slideP;
            put(p, 1, b * 16 + k, Rt + 12 + cr + off, 2, rnd() < accP ? 64 : 40, sl ? '3' : '', sl ? 0x20 : 0);
          }
        }
      }
      for (let r = 0; r < ROWS; r += 4) {
        const u = r / 60, cut = Math.round(c0 + (c1 - c0) * (shape === 'up' ? u : Math.sin(u * Math.PI)));
        const cl = pats[p].ch[1][r];
        if (cl) { if (!cl.fx) { cl.fx = 'E'; cl.fxv = cut; } } else put(p, 1, r, null, 0, 0, 'E', cut);
      }
    };
    const RHY = [[0, 3, 6, 8, 10, 12, 14], [0, 2, 4, 7, 10, 12], [0, 6, 8, 11, 14], [0, 4, 8, 12], [0, 3, 6, 10, 13], [0, 2, 3, 6, 8, 10, 11, 14]];
    const melody = (p, bars, inst, vol, oct, rsel) => {
      let last = E.prog[bars[0]] + 7;
      for (const b of bars) {
        const cd = E.prog[b], rh = RHY[rsel != null ? rsel : Math.floor(rnd() * RHY.length)];
        for (let j = 0; j < rh.length; j++) {
          const cands = [cd, cd + 2, cd + 4, cd + 7, cd + 9, cd + 11, last + 1, last - 1];
          let best = cands[0], bs = 1e9;
          for (const c of cands) {
            if (c < cd + 2 || c > cd + 12) continue;
            const s = Math.abs(c - last) + rnd() * 4 + (((c - cd) % 2) ? 1.6 : 0);
            if (s < bs) { bs = s; best = c; }
          }
          last = best;
          put(p, 2, b * 16 + rh[j], Rt + oct + sc(best), inst, vol - (j % 2 ? 8 : 0), (j > 0 && rnd() < 0.18) ? '3' : '', 0x10);
        }
      }
    };
    const pad = (p, bars, inst, vol, rows = [0]) => { for (const b of bars) { const cd = E.prog[b]; for (const k of rows) put(p, 3, b * 16 + k, Rt + 24 + sc(cd), inst, vol, '0', chordFx(cd)); } };

    // 00 INTRO
    pad(0, [0, 1, 2, 3], 4, 44);
    drums(0, [1, 2], 'h.h.h.h.h.h.h.h.'); drums(0, [3], 'h.h.h.h.h.h.hoh.');
    drums(0, [2], 'x.......x.......'); drums(0, [3], 'x.......x.x.....');
    for (let k = 0; k < 4; k++) put(0, 6, 60 + k, 60, 14, 20 + k * 12);
    bass(0, [2, 3], BASS.intro, 40);
    acid(0, [3], 0.4, 0x08, 0x16, 0.2, 0.1, 'up');
    put(0, 5, 0, 60, 13, 50);
    put(0, 4, 0, 60, 10, 64); put(0, 4, 44, 60, 11, 50); put(0, 4, 56, 60, 8, 64, 'E', 0x92); put(0, 4, 60, 60, 9, 64);

    // 01 PRECINCT 13 MAIN GROOVE
    bass(1, [0, 1, 2, 3], BASS.p13, 46);
    drums(1, [0, 2], 'x.....x...x.....'); drums(1, [1, 3], 'x.....x...x..x..');
    drums(1, [0, 1, 2], '....s..g....s..g'); drums(1, [3], '....s..g....s.ss');
    drums(1, [0, 1, 2, 3], 'H.hhH.hhH.hhH.o.');
    pad(1, [1, 3], 5, 50, [2, 5, 12]);
    melody(1, [2, 3], 3, 56, 36);
    put(1, 4, 28, 60, 10, 56);
    [56, 58, 60].forEach((r, i) => put(1, 4, r, 62 + i * 2, 7, 52));

    // 02 TB-303 ACID BREAKDOWN
    acid(2, [0, 1, 2, 3], 0.8, 0x06, 0x40, 0.35, 0.22, 'arc');
    drums(2, [0, 1, 2, 3], 'x...x...x...x...');
    drums(2, [0, 1, 2, 3], '....c.......c...');
    drums(2, [0, 1, 2, 3], 'h.o.h.o.h.o.h.o.');
    for (let b = 0; b < 4; b++) put(2, 0, b * 16, Rt + sc(E.prog[b]), 1, 50);
    put(2, 4, 0, 60, 10, 60, 'E', 0x93); put(2, 4, 62, 60, 11, 50);
    pad(2, [2, 3], 4, 30);

    // 03 BRASS & SCRATCH DROP
    bass(3, [0, 1, 2, 3], BASS.p13b, 50);
    drums(3, [0, 2], 'x.....x...x.....'); drums(3, [1, 3], 'x.....x...x..x..');
    drums(3, [0, 1, 2, 3], '....s..g....c..g');
    drums(3, [0, 1, 2, 3], 'H.h.H.hbH.h.H.ob');
    pad(3, [0, 1, 2, 3], 5, 58, [0, 3, 6, 10, 12]);
    put(3, 3, 0, Rt + 24 + sc(E.prog[0]), 6, 64, '0', chordFx(E.prog[0]));
    put(3, 3, 32, Rt + 24 + sc(E.prog[2]), 6, 64, '0', chordFx(E.prog[2]));
    put(3, 4, 0, 60, 8, 64); put(3, 4, 4, 60, 9, 64); put(3, 4, 32, 60, 8, 64, 'E', 0x92); put(3, 4, 36, 60, 9, 64);
    [16, 18, 20, 21, 23].forEach((r, i) => put(3, 4, r, 60 + [0, 3, 5, 3, 7][i], 7, 56));
    [48, 50, 52, 54].forEach((r, i) => put(3, 4, r, 62 + i, 7, 56));
    put(3, 4, 60, 60, 11, 54);
    melody(3, [1, 3], 3, 48, 36, 1);

    // 04 BRIDGE
    pad(4, [0, 1, 2, 3], 4, 52);
    melody(4, [0, 1, 2, 3], 3, 52, 36, 3);
    drums(4, [0, 1, 2, 3], 'x.........x.....');
    drums(4, [0, 1, 2, 3], '........s.......');
    drums(4, [0, 1, 2], 'h...h...b...h.b.'); drums(4, [3], 'h...h...b...b.bb');
    bass(4, [0, 1, 2, 3], BASS.bridge, 54);
    acid(4, [1, 3], 0.5, 0x0a, 0x18, 0.2, 0.3, 'arc');
    put(4, 5, 60, 60, 13, 60); put(4, 4, 52, 60, 11, 56);

    // 05 BOSS RAVE
    bass(5, [0, 1, 2, 3], BASS.boss, 50);
    acid(5, [0, 1, 2, 3], 0.9, 0x18, 0x48, 0.5, 0.15, 'up');
    drums(5, [0, 1, 2, 3], 'x...x...x...x...'); put(5, 5, 0, 60, 19, 64);
    drums(5, [0, 1, 2, 3], '....c.......c...');
    for (let k = 0; k < 16; k++) if (k !== 4 && k !== 12) put(5, 6, 48 + k, 60, 14, 14 + k * 3);
    drums(5, [0, 1, 2, 3], 'hhohhhohhhohhhoh');
    for (let r = 0; r < ROWS; r++) { const t = tri(E.prog[r >> 4]), k = r % 6; put(5, 2, r, Rt + 36 + t[k % 3] + (k >= 3 ? 12 : 0), 21, (r % 4 === 0) ? 58 : 44); }
    pad(5, [0, 1, 2, 3], 5, 56, [0, 6, 12]);
    put(5, 3, 0, Rt + 24 + sc(E.prog[0]), 6, 64, '0', chordFx(E.prog[0]));
    put(5, 3, 32, Rt + 24 + sc(E.prog[2]), 6, 64, '0', chordFx(E.prog[2]));
    put(5, 4, 14, 60, 7, 50); put(5, 4, 30, 63, 7, 50); put(5, 4, 40, 60, 8, 64); put(5, 4, 44, 60, 9, 64); put(5, 4, 58, 64, 7, 50);

    // 06 CRISPIN'S ELECTRO-DUB (shop)
    bass(6, [0, 1, 2, 3], BASS.dub, 62);
    drums(6, [0, 1, 2, 3], 'X.........X.....');
    drums(6, [0, 1, 2, 3], '........r.......');
    drums(6, [0, 1, 2], '..h...h...h...h.'); drums(6, [3], '..h...h...h...o.');
    pad(6, [0, 1, 2, 3], 5, 34, [4, 12]);
    melody(6, [1, 3], 3, 40, 24, 4);
    put(6, 4, 8, 60, 10, 50); put(6, 4, 40, 57, 10, 44);

    // note lengths (rows until next note in channel)
    for (const P of pats) for (const ch of P.ch) for (let r = 0; r < ROWS; r++) {
      const cl = ch[r]; if (!cl || cl.n == null) continue;
      let k = r + 1; while (k < ROWS && !(ch[k] && ch[k].n != null)) k++;
      cl.len = Math.min(16, k - r);
    }
    return { era: E, eraIdx: ei, pats, orders: { normal: [0, 1, 1, 2, 3, 4, 1, 3], boss: [5, 5, 3, 5], shop: [6] }, loop: { normal: 1, boss: 0, shop: 0 } };
  }

  // ------------------------------------------------------------ scheduler
  function setTempo(b) {
    bpm = b; rowDur = 60 / bpm / 4;
    if (ctx) {
      const t = ctx.currentTime;
      pingDL.delayTime.setTargetAtTime(rowDur * 3, t, 0.05); pingDR.delayTime.setTargetAtTime(rowDur * 3, t, 0.05);
      dubDelay.delayTime.setTargetAtTime(rowDur * 6, t, 0.05);
    }
  }
  function tick() {
    if (!ctx || !song) return;
    if (nextTime < ctx.currentTime - 0.25) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.12) { playRow(nextTime); advance(); nextTime += rowDur; }
  }
  function playRow(t) {
    const P = song.pats[pat];
    const sw = (row & 1) ? rowDur * (mode === 'shop' ? 0.2 : song.era.swing) : 0;
    const trig = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < NCH; c++) {
      const cl = P.ch[c][row]; if (!cl) continue;
      if (c === 1 && cl.fx === 'E') acidCut = 60 + cl.fxv * 60;
      if (cl.n != null && cl.i) { playCell(c, cl, t + sw); trig[c] = cl.v / 64; }
    }
    vis.push({ t, pat, row, pos: orderPos, trig });
    if (vis.length > 300) vis.shift();
  }
  function applyPending() {
    if (pendingEra != null) {
      song = buildSong(pendingEra); pendingEra = null; setTempo(song.era.bpm);
      mode = pendingMode || 'normal'; pendingMode = null; pendingJump = null;
      order = song.orders[mode]; orderPos = 0; pat = order[0]; row = 0; return true;
    }
    if (pendingMode) {
      const leaving = mode; mode = pendingMode; pendingMode = null; order = song.orders[mode];
      orderPos = (mode === 'normal' && leaving !== 'normal') ? 1 : 0; pat = order[orderPos]; row = 0; return true;
    }
    if (pendingJump != null) { pat = pendingJump; const i = order.indexOf(pat); if (i >= 0) orderPos = i; pendingJump = null; row = 0; return true; }
    return false;
  }
  function advance() {
    row++;
    if ((row & 15) === 0 && applyPending()) return;
    if (row >= ROWS) { row = 0; orderPos++; if (orderPos >= order.length) orderPos = song.loop[mode]; pat = order[orderPos]; }
  }
  function nextBarTime() { return nextTime + (16 - (row & 15)) * rowDur; }

  // ---------------------------------------------------------------- init
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = G(0.85);
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.72;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
    musicBus = G(0.9);
    dubFilter = F('lowpass', 20000, 0.7);
    musicBus.connect(dubFilter); dubFilter.connect(comp);
    sfxBus = G(0.5); sfxBus.connect(comp);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    shaper = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; shaper[i] = Math.tanh(x * 2.6); }

    const pans = [0, -0.22, 0.18, 0.28, -0.3, 0, 0.08, -0.35];
    const vols = [0.9, 0.8, 0.75, 0.8, 0.95, 1.0, 0.85, 0.7];
    for (let c = 0; c < NCH; c++) {
      chIn[c] = G(vols[c]); chGain[c] = G(1); chPan[c] = ctx.createStereoPanner(); chPan[c].pan.value = pans[c];
      chIn[c].connect(chGain[c]); chGain[c].connect(chPan[c]); chPan[c].connect(musicBus);
    }
    // stereo ping-pong delay on the lead channel
    pingIn = G(0.38); pingDL = ctx.createDelay(2); pingDR = ctx.createDelay(2);
    const fbL = G(0.42), fbR = G(0.42), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(), plp = F('lowpass', 3000, 0.5);
    pl.pan.value = -0.9; pr.pan.value = 0.9;
    chGain[2].connect(pingIn); pingIn.connect(plp); plp.connect(pingDL);
    pingDL.connect(pl); pl.connect(musicBus); pingDL.connect(fbL); fbL.connect(pingDR);
    pingDR.connect(pr); pr.connect(musicBus); pingDR.connect(fbR); fbR.connect(pingDL);
    // dub echo send (chords, vox, snare) — opened wide in Crispin's shop
    dubSend = G(0); dubDelay = ctx.createDelay(3);
    const dfb = G(0.58), dbp = F('bandpass', 1400, 0.6);
    for (const c of [3, 4, 6]) chGain[c].connect(dubSend);
    dubSend.connect(dubDelay); dubDelay.connect(dbp); dbp.connect(dfb); dfb.connect(dubDelay); dbp.connect(musicBus);
    // gated reverb (flat noise IR with a hard gate)
    revIn = G(1); const conv = ctx.createConvolver();
    const irLen = Math.floor(ctx.sampleRate * 0.3), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * (i < irLen * 0.85 ? 0.55 * (1 - i / irLen * 0.3) : 0); }
    conv.buffer = ir; revIn.connect(conv); const rg = G(0.5); conv.connect(rg); rg.connect(chIn[6]);

    buildVox();
    song = buildSong(0); setTempo(song.era.bpm);
    mode = 'normal'; order = song.orders.normal; orderPos = 0; pat = 0; row = 0;
    nextTime = ctx.currentTime + 0.15;
    timer = setInterval(tick, 25);
    applySoundOn();
  }

  // ------------------------------------------------------------------ API
  function setEra(i) {
    if (!ctx) return;
    if (song && song.eraIdx === i && pendingEra == null) { setMode('normal'); return; }
    pendingEra = i;
    setMode('normal'); // new epoch always starts in the main arrangement with the dub filter open
  }
  function setMode(m) {
    if (!ctx) return;
    if (m === mode && !pendingMode) return;
    if (pendingMode === m) return;
    pendingMode = m;
    const now = ctx.currentTime, tb = Math.max(now + 0.05, nextBarTime());
    const fq = dubFilter.frequency;
    fq.cancelScheduledValues(now); fq.setValueAtTime(fq.value, now);
    fq.exponentialRampToValueAtTime(420, tb);
    if (m === 'shop') {
      fq.exponentialRampToValueAtTime(3200, tb + rowDur * 32);
      dubFilter.Q.setTargetAtTime(6, now, 0.3);
      dubSend.gain.setTargetAtTime(0.6, tb, 0.2);
    } else {
      fq.exponentialRampToValueAtTime(20000, tb + rowDur * 16);
      dubFilter.Q.setTargetAtTime(0.7, tb, 0.3);
      dubSend.gain.setTargetAtTime(0, tb, 0.4);
    }
  }
  function jump(p) { if (ctx) pendingJump = p; }
  function applyMix() {
    if (!ctx) return;
    const any = solo.some(Boolean);
    for (let c = 0; c < NCH; c++) chGain[c].gain.setTargetAtTime((any ? solo[c] : !mute[c]) ? 1 : 0, ctx.currentTime, 0.01);
  }
  function toggleMute(c) { mute[c] = !mute[c]; applyMix(); }
  function toggleSolo(c) { solo[c] = !solo[c]; applyMix(); }
  function applySoundOn() { if (master) master.gain.setTargetAtTime(soundOn ? 0.85 : 0, ctx.currentTime, 0.05); }
  function toggleSound() { soundOn = !soundOn; applySoundOn(); return soundOn; }
  function state() {
    if (!ctx) return cur;
    const now = ctx.currentTime;
    while (vis.length && vis[0].t <= now) {
      cur = vis.shift();
      for (let c = 0; c < NCH; c++) if (cur.trig[c]) level[c] = Math.max(level[c], cur.trig[c]);
    }
    return cur;
  }
  function beat() {
    if (!ctx) return (performance.now() / 600) % 1;
    const frac = Math.max(0, Math.min(1, (ctx.currentTime - cur.t) / rowDur));
    return ((cur.row + frac) / 4) % 1;
  }
  function setRewind(on) {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (on && !rewindNode) {
      const nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
      const bp = F('bandpass', 1500, 6), g = G(0), lfo = O('sawtooth', 7, now), lg = G(1400);
      lfo.connect(lg); lg.connect(bp.frequency);
      g.gain.setTargetAtTime(0.16, now, 0.05);
      nz.connect(bp); bp.connect(g); g.connect(sfxBus); nz.start(now); lfo.start(now);
      rewindNode = { nz, lfo, g };
      musicBus.gain.setTargetAtTime(0.35, now, 0.05);
    } else if (!on && rewindNode) {
      const r = rewindNode; rewindNode = null;
      r.g.gain.setTargetAtTime(0.0001, now, 0.04); r.nz.stop(now + 0.25); r.lfo.stop(now + 0.25);
      musicBus.gain.setTargetAtTime(0.9, now, 0.08);
    }
  }

  // ------------------------------------------------------------------ SFX
  function tone(type, f0, f1, dur, vol, t, dest) {
    t = t || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, type, f0, f1, q, t) {
    t = t || ctx.currentTime;
    const s = NZ(t, dur), f = F(type, f0, q);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = G(0); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
  }
  const LIMIT = { shoot: 0.06, vulcan: 0.05, laser: 0.07, plasma: 0.08, ping: 0.035, carve: 0.05, arc: 0.07, explode: 0.04, missile: 0.08, orb: 0.08, cash: 0.04, talk: 0.05, mine: 0.1 };
  function sfx(name, p) {
    if (!ctx || !soundOn) return;
    const t = ctx.currentTime;
    if (lastSfx[name] && t - lastSfx[name] < (LIMIT[name] || 0.02)) return;
    lastSfx[name] = t;
    switch (name) {
      case 'shoot': tone('square', 1100, 380, 0.07, 0.05); break;
      case 'vulcan': tone('square', 1500, 700, 0.04, 0.035); noise(0.03, 0.05, 'highpass', 4000, 4000, 1); break;
      case 'plasma': tone('sine', 300, 1100, 0.12, 0.09); tone('triangle', 600, 1600, 0.1, 0.04); break;
      case 'laser': tone('sawtooth', 2400, 300, 0.1, 0.04); break;
      case 'missile': noise(0.3, 0.07, 'bandpass', 600, 3000, 2); break;
      case 'orb': tone('triangle', 500, 1300, 0.12, 0.07); break;
      case 'arc': noise(0.06, 0.07, 'bandpass', 2500 + Math.random() * 3000, 1500, 6); tone('sawtooth', 90 + Math.random() * 60, 60, 0.06, 0.04); break;
      case 'ping': tone('triangle', 1700 + Math.random() * 300, 900, 0.03, 0.035); break;
      case 'carve': noise(0.06, 0.06, 'lowpass', 1800, 300, 1); break;
      case 'explode': noise(0.45, 0.28, 'lowpass', 2400, 90, 1); tone('sine', 140, 38, 0.35, 0.3); break;
      case 'bigexplode': noise(1.3, 0.45, 'lowpass', 3000, 50, 1); tone('sine', 110, 25, 1.1, 0.5); tone('sawtooth', 80, 30, 0.6, 0.12); break;
      case 'hit': tone('sawtooth', 420, 70, 0.25, 0.2); noise(0.2, 0.2, 'bandpass', 900, 300, 2); break;
      case 'die': noise(1.6, 0.5, 'lowpass', 4000, 40, 1); tone('square', 600, 30, 1.4, 0.15); break;
      case 'cash': tone('sine', 1320, 1320, 0.06, 0.1); tone('sine', 1760, 1760, 0.1, 0.1, t + 0.05); break;
      case 'buy': [880, 1109, 1320, 1760].forEach((f, i) => tone('square', f, f, 0.08, 0.06, t + i * 0.05)); break;
      case 'sell': [1320, 1109, 880, 660].forEach((f, i) => tone('square', f, f, 0.08, 0.06, t + i * 0.05)); break;
      case 'error': tone('square', 140, 110, 0.25, 0.1); break;
      case 'bomb': vSub(t, 1, sfxBus); noise(1.5, 0.5, 'lowpass', 6000, 60, 1); vVox(t + 0.05, vox.blast, 57, 0.9, '', 0, sfxBus); break;
      case 'nova': tone('sine', 1800, 120, 0.5, 0.14); noise(0.4, 0.15, 'bandpass', 5000, 400, 3); break;
      case 'reverse': noise(0.25, 0.08, 'lowpass', 400, 1600, 3); break;
      case 'nashwan': tone('sawtooth', 110, 1760, 1.2, 0.1); vVox(t + 0.1, vox.mega, 62, 1, '', 0, sfxBus); vVox(t + 0.5, vox.blast, 62, 1, '', 0, sfxBus); break;
      case 'yeah': vVox(t, vox.yeah, 60 + (p || 0), 0.9, '', 0, sfxBus); break;
      case 'powerup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.1, 0.07, t + i * 0.04)); break;
      case 'dock': tone('sine', 1200, 200, 0.6, 0.1); vBackspin(t, 0.6, sfxBus); break;
      case 'talk': tone('square', 180 + (p || 0) * 40, 160 + (p || 0) * 30, 0.04, 0.03); break;
      case 'bosswarn': for (let i = 0; i < 4; i++) { tone('square', 660, 660, 0.18, 0.08, t + i * 0.4); tone('square', 440, 440, 0.18, 0.08, t + i * 0.4 + 0.2); } break;
      case 'mine': tone('sine', 900, 1200, 0.05, 0.05); break;
      case 'shield': tone('triangle', 400, 1600, 0.3, 0.08); break;
      case 'bounce': tone('triangle', 300, 900, 0.05, 0.05); break;
      case 'block': noise(0.05, 0.04, 'bandpass', 1500, 1500, 3); break;
    }
  }

  return {
    NCH, ROWS, CH_NAMES, INST, PAT_NAMES, ERAS,
    init, setEra, setMode, jump, toggleMute, toggleSolo, toggleSound, setRewind, sfx, state, beat,
    get ready() { return !!ctx; },
    get song() { return song; },
    get mode() { return mode; },
    get bpm() { return bpm; },
    get analyser() { return analyser; },
    get soundOn() { return soundOn; },
    mute, solo, level,
  };
})();
