'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — audio.js
 *  A tiny YM2151 / OPL3-flavoured synthesizer built on the Web Audio API:
 *   - 2-operator FM harpsichord (fast modulation-index decay = plucked quill)
 *   - additive pipe organ with a shared tremolo rotor
 *   - FM slap bass, PSG square lead, noise + pitch-swept drum kit
 *   - generative baroque sequencer: each stage theme is composed at boot from
 *     a seed (scale, chord progression, motif + sequence transposition),
 *     played by a look-ahead scheduler. In boxer-shorts mode the tempo jumps
 *     x1.18 and the melody shifts up an octave, live, without restarting.
 *   - arcade sound effects (armor shatter, possession, throws, chests, ...)
 * ===========================================================================*/
const Music = (() => {
  let ctx = null, master, musBus, sfxBus, organBus, wet, noiseBuf = null;
  let soundOn = true, boxers = false;
  let song = null, songName = '', step = 0, nextT = 0, timer = null, onEnd = null;
  const lastSfx = {};

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ------------------------------------------------------------ graph
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = soundOn ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    musBus = ctx.createGain(); musBus.gain.value = 0.55; musBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    // cathedral reverb (procedural impulse response)
    const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.28;
    musBus.connect(conv); conv.connect(wet); wet.connect(master);
    const sfxWet = ctx.createGain(); sfxWet.gain.value = 0.12; sfxBus.connect(sfxWet); sfxWet.connect(conv);
    // organ bus with rotating-speaker tremolo
    organBus = ctx.createGain(); organBus.gain.value = 0.85; organBus.connect(musBus);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.6; lg.gain.value = 0.18;
    lfo.connect(lg); lg.connect(organBus.gain); lfo.start();
    // white noise
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    timer = setInterval(tick, 25);
    if (songName && !song) play(songName);
  }

  // ------------------------------------------------------------ instruments
  function env(g, t, a, peak, dec, sus, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + dec);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  function osc(type, f, t, end, dest) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(end + 0.05); return o; }

  // 2-op FM harpsichord: modulator at 3x with index that collapses in ~200ms
  function harp(t, f, d, v, dest) {
    const end = t + Math.max(0.25, d) + 0.35;
    const g = ctx.createGain(); g.connect(dest);
    env(g, t, 0.002, v, 0.12, 0.35, end);
    const c = osc('sine', f, t, end, g);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 3.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.22);
    const m = osc('sine', f * 3, t, end, mg); mg.connect(c.frequency);
    // quill "pluck" transient
    const g2 = ctx.createGain(); g2.connect(dest); env(g2, t, 0.001, v * 0.35, 0.05, 0.01, t + 0.08);
    osc('square', f * 2, t, t + 0.08, g2);
    return m;
  }
  // additive pipe organ (8' + 4' + 2' + 16' stops)
  function organ(t, f, d, v) {
    const end = t + d + 0.12;
    const g = ctx.createGain(); g.connect(organBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03);
    g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.0001, end);
    const stops = [[1, 'sine', 1], [2, 'sine', 0.5], [4, 'triangle', 0.22], [0.5, 'sine', 0.35], [3, 'sine', 0.12]];
    for (const [r, ty, k] of stops) { const gg = ctx.createGain(); gg.gain.value = k; gg.connect(g); osc(ty, f * r, t, end, gg); }
  }
  // FM slap bass
  function bass(t, f, d, v) {
    const end = t + Math.min(0.5, d + 0.05) + 0.06;
    const g = ctx.createGain(); g.connect(musBus); env(g, t, 0.003, v, 0.18, 0.4, end);
    const c = osc('sine', f, t, end, g);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.6, t + 0.2);
    osc('sine', f, t, end, mg); mg.connect(c.frequency);
    const sg = ctx.createGain(); sg.gain.value = 0.25; sg.connect(g); osc('sawtooth', f * 0.5, t, end, sg);
  }
  // PSG square lead with delayed vibrato
  function psg(t, f, d, v) {
    const end = t + d + 0.08;
    const g = ctx.createGain(); g.connect(musBus); env(g, t, 0.004, v * 0.42, 0.1, 0.65, end);
    const o = osc('square', f, t, end, g);
    if (d > 0.25) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.3); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end); }
  }
  function noise(t, dur, v, type, f0, f1, dest, q = 1) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function drum(t, k, v) {
    if (k === 'k') {
      const g = ctx.createGain(); g.connect(musBus); env(g, t, 0.002, v, 0.22, 0.01, t + 0.3);
      const o = osc('sine', 160, t, t + 0.3, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    } else if (k === 's') {
      noise(t, 0.16, v * 0.55, 'bandpass', 1900, 1200, musBus, 0.8);
      const g = ctx.createGain(); g.connect(musBus); env(g, t, 0.002, v * 0.4, 0.08, 0.01, t + 0.12);
      const o = osc('triangle', 200, t, t + 0.12, g); o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    } else if (k === 'h') noise(t, 0.035, v * 0.22, 'highpass', 7500, 7500, musBus);
    else if (k === 'o') noise(t, 0.2, v * 0.2, 'highpass', 6500, 6500, musBus);
    else if (k === 'c') { noise(t, 0.9, v * 0.25, 'highpass', 5000, 3000, musBus); }
    else if (k === 't') { const g = ctx.createGain(); g.connect(musBus); env(g, t, 0.002, v * 0.7, 0.2, 0.01, t + 0.25); const o = osc('sine', 220, t, t + 0.25, g); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); }
  }

  // ------------------------------------------------------------ composer
  const SCALES = {
    hmin: [0, 2, 3, 5, 7, 8, 11], nmin: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10],
    phrd: [0, 1, 4, 5, 7, 8, 10], maj: [0, 2, 4, 5, 7, 9, 11], phr: [0, 1, 3, 5, 7, 8, 10],
  };
  const RHY = [
    '1.1.1.1.1.1.1.1.', '1..1..1.1..1..1.', '1...1.1.1...1.1.', '1.11.1.11.1.1...', '1..11..11..1.1..',
    '1.1.11..1.1.1...', '1...1...1.1.1.1.', '11.1.1.11.1.1.1.', '1.......1.1.1...', '1..1..1...1.11..',
  ];
  const BASSP = {
    gallop: [[0, 0], [2, 0], [3, 0], [4, 12], [6, 0], [7, 0], [8, 0], [10, 0], [11, 0], [12, 12], [14, 7], [15, 0]],
    pulse: [[0, 0], [2, 0], [4, 0], [6, 7], [8, 0], [10, 0], [12, 0], [14, 7]],
    walk: [[0, 0], [4, 7], [8, 12], [12, 7]],
    octave: [[0, 0], [2, 12], [4, 0], [6, 12], [8, 0], [10, 12], [12, 0], [14, 12]],
    doom: [[0, 0], [1, 0], [2, 12], [3, 0], [4, 0], [5, 10], [6, 0], [7, 0], [8, 8], [9, 0], [10, 0], [11, 6], [12, 0], [13, 0], [14, 7], [15, 8]],
    slow: [[0, 0], [8, 7]],
  };
  const DRUMP = {
    march: 'k.h.s.h.k.h.s.hh', rock: 'k.h.s.hkk.h.s.h.', drive: 'k.hsk.hsk.hsk.hs', boss: 'k.kss.k.k.kss.ko',
    sparse: 'k.......s.......', jig: 'k..h.hk..hs.h.h.', doom: 'k.h.s.h.k.hks.hh', none: '................', ending: 'k...h...s...h.h.',
  };
  function compile(sp) {
    const rnd = (s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(sp.seed || 7);
    const sc = SCALES[sp.scale], bars = sp.bars || 16, len = bars * 16;
    const ev = Array.from({ length: len }, () => []);
    const deg2m = (root, d) => { const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return root + o * 12 + sc[i]; };
    const add = (s, e) => { if (s >= 0 && s < len) ev[s].push(e); };
    // melody motif: two bars, as scale-degree offsets from the chord root
    const motif = [];
    for (let b = 0; b < 2; b++) {
      const r = RHY[Math.floor(rnd() * RHY.length)];
      let d = b === 0 ? 4 : 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < 16; i++) if (r[i] === '1') {
        const strong = (i & 3) === 0;
        d += Math.floor(rnd() * 5) - 2;
        if (strong && rnd() < 0.7) d = [0, 2, 4, 7][Math.floor(rnd() * 4)];
        d = Math.max(-2, Math.min(9, d));
        motif.push({ s: b * 16 + i, d });
      }
    }
    for (let i = 0; i < motif.length; i++) motif[i].l = ((i + 1 < motif.length ? motif[i + 1].s : 32) - motif[i].s);
    const prog = sp.prog;
    for (let b = 0; b < bars; b++) {
      const deg = prog[b % prog.length], base = b * 16;
      const croot = deg2m(sp.root, deg);
      // melody: motif pairs, sequence-transposed onto each chord, bar 4n+3 varied, last bar cadence
      if (sp.lead) {
        const half = (b & 1) * 16, vary = (b % 4) === 3;
        for (const n of motif) {
          if (n.s < half || n.s >= half + 16) continue;
          let d = n.d + (vary && rnd() < 0.5 ? (rnd() < 0.5 ? 1 : -1) : 0);
          if (b === bars - 1 && n.s - half >= 8) continue;
          add(base + n.s - half, [sp.lead, deg2m(sp.root + 12, deg + d), Math.min(n.l, sp.lead === 'harp' ? 4 : 6), 0.3, 1]);
        }
        if (b === bars - 1) add(base + 8, [sp.lead, deg2m(sp.root + 12, deg), 8, 0.3, 1]);
      }
      // harpsichord arpeggio counter-line (Alberti / baroque broken chords)
      if (sp.arp) {
        const pat = sp.arp === 'up' ? [0, 2, 4, 7] : [0, 4, 2, 4];
        for (let i = 0; i < 16; i += 2) add(base + i, ['harp', deg2m(sp.root, deg + pat[(i >> 1) % 4]), 2, 0.16, 0]);
      }
      // organ chord pad
      if (sp.pad) for (const k of [0, 2, 4]) add(base, ['organ', deg2m(sp.root - 12, deg + k), 16, 0.07, 0]);
      // bass
      if (sp.bass) for (const [s, iv] of BASSP[sp.bass]) add(base + s, ['bass', (sp.bass === 'doom' ? mtof0(sp.root) : croot) - 24 + iv, 2, 0.5, 0]);
      // drums
      const dp = DRUMP[sp.drums || 'none'];
      for (let i = 0; i < 16; i++) { const c = dp[i]; if (c !== '.') add(base + i, ['drum', c, 1, (i & 3) === 0 ? 0.9 : 0.6, 0]); }
      if (b % 8 === 0 && sp.drums && sp.drums !== 'none') add(base, ['drum', 'c', 1, 0.7, 0]);
    }
    return { ev, len, bpm: sp.bpm, loop: sp.loop !== false, swing: sp.swing || 0 };
  }
  const mtof0 = r => r; // doom riff is anchored on the key root, not the chord
  // hand-written short cues
  function cue(bpm, notes, lenSteps, extra) {
    const ev = Array.from({ length: lenSteps }, () => []);
    for (const [s, m, l, ins, v] of notes) ev[s].push([ins || 'harp', m, l, v || 0.3, 1]);
    if (extra) extra(ev);
    return { ev, len: lenSteps, bpm, loop: false, swing: 0 };
  }

  const SONGS = {};
  function buildSongs() {
    SONGS.title = compile({ seed: 11, scale: 'hmin', root: 62, bpm: 96, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'organ', arp: 'alb', bass: 'slow', drums: 'sparse', pad: true, bars: 16 });
    SONGS.s0 = compile({ seed: 23, scale: 'dor', root: 57, bpm: 140, prog: [0, 5, 3, 4, 0, 5, 6, 4], lead: 'harp', bass: 'gallop', drums: 'jig', swing: 0.3 });
    SONGS.s1 = compile({ seed: 5, scale: 'dor', root: 64, bpm: 118, prog: [0, 6, 5, 6, 0, 3, 4, 4], lead: 'psg', pad: true, bass: 'walk', drums: 'march' });
    SONGS.s2 = compile({ seed: 91, scale: 'phrd', root: 62, bpm: 128, prog: [0, 1, 0, 6, 0, 1, 6, 0], lead: 'harp', arp: 'up', bass: 'octave', drums: 'drive' });
    SONGS.s3 = compile({ seed: 37, scale: 'nmin', root: 60, bpm: 150, prog: [0, 4, 5, 2, 3, 0, 3, 4], lead: 'psg', bass: 'octave', drums: 'rock' });
    SONGS.s4 = compile({ seed: 66, scale: 'phr', root: 52, bpm: 152, prog: [0, 0, 5, 6, 0, 0, 3, 1], lead: 'organ', bass: 'doom', drums: 'doom' });
    SONGS.s5 = compile({ seed: 13, scale: 'hmin', root: 61, bpm: 132, prog: [0, 5, 3, 4, 0, 1, 4, 4], lead: 'organ', arp: 'up', bass: 'gallop', drums: 'boss', pad: true });
    SONGS.boss = compile({ seed: 77, scale: 'hmin', root: 55, bpm: 162, prog: [0, 0, 5, 4, 0, 0, 1, 4], lead: 'psg', bass: 'gallop', drums: 'boss', bars: 8 });
    SONGS.ending = compile({ seed: 3, scale: 'maj', root: 65, bpm: 96, prog: [0, 5, 3, 4, 0, 3, 4, 0], lead: 'harp', pad: true, arp: 'alb', bass: 'walk', drums: 'ending' });
    // the classic stage-intro map jingle
    SONGS.map = cue(132, [[0, 62, 2], [2, 65, 2], [4, 69, 2], [6, 74, 4, 'organ'], [10, 72, 2], [12, 70, 2], [14, 69, 2], [16, 67, 2], [18, 69, 2], [20, 74, 10, 'organ', 0.34]], 34,
      ev => { for (const [s, m] of [[0, 38], [4, 45], [8, 43], [12, 41], [16, 43], [20, 38]]) ev[s].push(['bass', m, 3, 0.5, 0]); for (const s of [0, 4, 8, 12, 16, 18, 20]) ev[s].push(['drum', s === 20 ? 'c' : s % 8 ? 's' : 'k', 1, 0.8, 0]); });
    SONGS.clear = cue(150, [[0, 67, 2], [2, 71, 2], [4, 74, 2], [6, 79, 4], [10, 78, 2], [12, 79, 2], [14, 83, 10, 'organ', 0.34]], 28,
      ev => { for (const s of [0, 6, 14]) ev[s].push(['bass', 43, 4, 0.5, 0], ['drum', 'k', 1, 0.8, 0]); ev[14].push(['drum', 'c', 1, 0.8, 0]); });
    SONGS.over = cue(80, [[0, 69, 4, 'organ'], [4, 68, 4, 'organ'], [8, 65, 4, 'organ'], [12, 64, 4, 'organ'], [16, 62, 12, 'organ', 0.3]], 32,
      ev => { ev[0].push(['bass', 38, 12, 0.5, 0]); ev[16].push(['bass', 26, 12, 0.5, 0]); });
    SONGS.floppy = cue(160, [[0, 72, 1, 'psg'], [1, 76, 1, 'psg'], [2, 79, 1, 'psg'], [3, 84, 5, 'psg']], 10);
  }

  // ------------------------------------------------------------ sequencer
  function stepDur() { const b = song ? song.bpm : 120; return 60 / (b * (boxers ? 1.18 : 1)) / 4; }
  function tick() {
    if (!ctx || !song) return;
    const now = ctx.currentTime;
    if (nextT < now - 0.3) nextT = now + 0.02; // tab was asleep; resync
    while (nextT < now + 0.13) {
      if (step >= song.len) {
        if (song.loop) step = 0;
        else { song = null; const f = onEnd; onEnd = null; if (f) f(); return; }
      }
      const sd = stepDur();
      const t = nextT + ((step & 1) ? song.swing * sd : 0);
      if (soundOn) for (const e of song.ev[step]) {
        const [ins, m, l, v, mel] = e;
        const mm = mel && boxers ? m + 12 : m, d = l * sd;
        if (ins === 'drum') drum(t, m, v);
        else if (ins === 'harp') harp(t, mtof(mm), d, v, musBus);
        else if (ins === 'organ') organ(t, mtof(mm), d, mel ? v * 0.5 : v);
        else if (ins === 'bass') bass(t, mtof(mm), d, v);
        else if (ins === 'psg') psg(t, mtof(mm), d, v);
      }
      nextT += sd; step++;
    }
  }
  function play(name, cb) {
    songName = name; onEnd = cb || null;
    if (!ctx) return;
    song = SONGS[name] || null; step = 0; nextT = ctx.currentTime + 0.05;
  }
  function stop() { song = null; songName = ''; onEnd = null; }
  function setBoxers(b) { boxers = !!b; }
  function toggleSound() {
    soundOn = !soundOn;
    if (master) master.gain.setTargetAtTime(soundOn ? 0.8 : 0, ctx.currentTime, 0.02);
    return soundOn;
  }

  // ------------------------------------------------------------ sfx
  function tone(type, f0, f1, dur, v, t0 = 0, dest) {
    const t = ctx.currentTime + t0, g = ctx.createGain(); g.connect(dest || sfxBus);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = osc(type, f0, t, t + dur, g); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    return o;
  }
  function fm(f, ratio, index, dur, v, t0 = 0, f1) {
    const t = ctx.currentTime + t0, g = ctx.createGain(); g.connect(sfxBus);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const c = osc('sine', f, t, t + dur, g); if (f1) c.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + dur);
    const m = osc('sine', f * ratio, t, t + dur, mg); mg.connect(c.frequency); if (f1) m.frequency.exponentialRampToValueAtTime(f1 * ratio, t + dur);
  }
  const nz = (dur, v, type, f0, f1, t0 = 0, q = 1) => noise(ctx.currentTime + t0, dur, v, type, f0, f1, sfxBus, q);
  const SFX = {
    jump: () => tone('square', 280, 560, 0.09, 0.08),
    djump: () => { tone('square', 420, 840, 0.08, 0.08); tone('triangle', 840, 1260, 0.08, 0.06, 0.03); },
    throw: () => { nz(0.07, 0.25, 'bandpass', 2500, 5000); tone('triangle', 900, 420, 0.07, 0.1); },
    axe: () => { nz(0.14, 0.25, 'bandpass', 900, 3000, 0, 2); },
    torch: () => { nz(0.2, 0.2, 'bandpass', 400, 1600, 0, 2); tone('sine', 300, 600, 0.1, 0.08); },
    hit: () => { tone('square', 240, 90, 0.07, 0.14); nz(0.06, 0.2, 'lowpass', 3000, 800); },
    tink: () => { tone('square', 1800, 1500, 0.05, 0.1); tone('square', 2700, 2400, 0.05, 0.06, 0.01); },
    kill: () => { nz(0.25, 0.35, 'lowpass', 3000, 300); tone('sawtooth', 300, 60, 0.2, 0.1); },
    bones: () => { for (let i = 0; i < 5; i++) tone('square', 900 + Math.random() * 900, 500, 0.03, 0.06, i * 0.035); },
    shatter: () => {
      fm(520, 3.73, 9, 0.7, 0.35); fm(780, 2.41, 6, 0.5, 0.2, 0.02);
      nz(0.55, 0.45, 'highpass', 2000, 6000); nz(0.3, 0.4, 'lowpass', 1500, 200);
      for (let i = 0; i < 9; i++) tone('triangle', 1500 + Math.random() * 2500, 1200, 0.07, 0.08, 0.08 + i * 0.05 + Math.random() * 0.03);
    },
    eject: () => { fm(300, 3.5, 6, 0.4, 0.3); nz(0.25, 0.25, 'bandpass', 600, 2400, 0, 1.5); },
    clang: () => { fm(420, 3.73, 7, 0.45, 0.3); nz(0.08, 0.3, 'highpass', 3000, 3000); },
    don: () => { fm(300, 3.5, 5, 0.3, 0.25); [0, 4, 7, 12].forEach((s, i) => tone('square', mtof(60 + s), mtof(60 + s), 0.1, 0.08, 0.06 + i * 0.06)); },
    possess: () => {
      const t = ctx.currentTime, g = ctx.createGain(); g.connect(sfxBus); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const o = osc('sine', 200, t, t + 0.9, g); o.frequency.exponentialRampToValueAtTime(1200, t + 0.7);
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 11; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.9);
      nz(0.8, 0.2, 'bandpass', 300, 3000, 0, 4); fm(160, 1.41, 4, 0.8, 0.12, 0.1, 640);
    },
    unpossess: () => { fm(900, 1.41, 3, 0.6, 0.18, 0, 150); nz(0.5, 0.15, 'bandpass', 3000, 200, 0, 4); },
    chest: () => { nz(0.5, 0.2, 'lowpass', 300, 900); [0, 3, 7, 10, 12].forEach((s, i) => tone('square', mtof(64 + s), mtof(64 + s), 0.08, 0.07, i * 0.07)); },
    open: () => { fm(110, 1.5, 3, 0.25, 0.2, 0, 90); [0, 7, 12, 16, 19, 24].forEach((s, i) => tone('triangle', mtof(72 + s), mtof(72 + s), 0.12, 0.08, 0.1 + i * 0.045)); },
    pickup: () => { [0, 4, 7, 12].forEach((s, i) => tone('square', mtof(72 + s), mtof(72 + s), 0.07, 0.07, i * 0.045)); },
    coin: () => { tone('square', 988, 988, 0.06, 0.08); tone('square', 1319, 1319, 0.25, 0.08, 0.06); },
    armor: () => { fm(260, 3.5, 5, 0.4, 0.22); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone('square', mtof(60 + s), mtof(60 + s), 0.1, 0.07, 0.05 + i * 0.05)); },
    gold: () => { [0, 4, 7, 11, 12, 16, 19, 23, 24].forEach((s, i) => { tone('triangle', mtof(67 + s), mtof(67 + s), 0.3, 0.08, i * 0.06); tone('square', mtof(55 + s), mtof(55 + s), 0.1, 0.04, i * 0.06); }); },
    charge: () => tone('sine', 400, 1600, 0.25, 0.06),
    charged: () => { tone('triangle', 1600, 1600, 0.08, 0.1); tone('triangle', 2400, 2400, 0.12, 0.08, 0.06); },
    cast: () => { nz(1.4, 0.7, 'lowpass', 4000, 80); nz(0.12, 0.6, 'highpass', 1500, 1500); fm(80, 1.1, 8, 1.2, 0.35, 0, 40); },
    thunder: () => { nz(1.8, 0.35, 'lowpass', 900, 60, 0.05); nz(0.25, 0.25, 'lowpass', 2500, 300); },
    death: () => { [0, -1, -3, -5, -7, -12].forEach((s, i) => tone('square', mtof(64 + s), mtof(63 + s), 0.16, 0.1, i * 0.13)); nz(0.4, 0.2, 'lowpass', 2000, 200); },
    splash: () => { nz(0.5, 0.4, 'bandpass', 2400, 300, 0, 1.2); tone('sine', 700, 150, 0.2, 0.1); },
    crumble: () => { nz(0.35, 0.35, 'lowpass', 900, 120); },
    crack: () => { nz(0.4, 0.5, 'lowpass', 2500, 150); tone('square', 120, 50, 0.25, 0.12); },
    explode: () => { nz(0.7, 0.6, 'lowpass', 2200, 60); tone('sine', 110, 30, 0.5, 0.35); },
    plate: () => { tone('square', 600, 300, 0.04, 0.12); nz(0.06, 0.2, 'bandpass', 1200, 1200, 0, 3); },
    gate: () => { for (let i = 0; i < 6; i++) nz(0.05, 0.2, 'bandpass', 1800, 1400, i * 0.06, 4); },
    piston: () => { nz(0.25, 0.55, 'lowpass', 600, 60); tone('sine', 80, 35, 0.3, 0.35); },
    fire: () => { tone('sawtooth', 320, 110, 0.14, 0.07); nz(0.14, 0.12, 'bandpass', 1000, 400); },
    bosshit: () => { fm(180, 2.7, 5, 0.12, 0.2); },
    bossdie: () => { for (let i = 0; i < 6; i++) { nz(0.6, 0.5, 'lowpass', 1800, 70, i * 0.22); tone('sine', 120, 30, 0.4, 0.3, i * 0.22); } },
    bounce: () => { fm(180, 1, 2, 0.3, 0.2, 0, 620); },
    land: () => { nz(0.12, 0.3, 'lowpass', 500, 80); tone('sine', 90, 40, 0.12, 0.2); },
    laugh: () => { for (let i = 0; i < 4; i++) fm(700 - i * 60, 1.5, 3, 0.09, 0.12, i * 0.1, 400 - i * 40); },
    ohno: () => { tone('square', 880, 800, 0.16, 0.07); tone('square', 660, 560, 0.25, 0.07, 0.18); },
    select: () => tone('square', 660, 990, 0.06, 0.08),
    pause: () => { tone('square', 880, 880, 0.05, 0.08); tone('square', 660, 660, 0.05, 0.08, 0.07); },
    wind: () => nz(1.4, 0.18, 'bandpass', 300, 900, 0, 3),
    life: () => { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone('square', mtof(72 + s), mtof(72 + s), 0.09, 0.08, i * 0.08)); },
    cannon: () => { nz(0.3, 0.5, 'lowpass', 1200, 90); tone('sine', 140, 40, 0.25, 0.3); },
    slice: () => { fm(1200, 1.3, 4, 0.12, 0.16); nz(0.1, 0.3, 'highpass', 4000, 2000); },
    teleport: () => { fm(300, 2, 5, 0.5, 0.15, 0, 1500); },
    beam: () => { fm(90, 0.5, 6, 0.9, 0.25); nz(0.9, 0.25, 'bandpass', 800, 3000, 0, 2); },
  };
  function sfx(name) {
    if (!ctx || !soundOn || !SFX[name]) return;
    const now = ctx.currentTime;
    if (lastSfx[name] && now - lastSfx[name] < 0.045) return;
    lastSfx[name] = now;
    try { SFX[name](); } catch (e) { /* ignore scheduling glitches */ }
  }

  buildSongs();
  return {
    init, play, stop, sfx, setBoxers, toggleSound,
    get on() { return soundOn; }, get current() { return songName; }, get ready() { return !!ctx; },
  };
})();
window.Music = Music;
