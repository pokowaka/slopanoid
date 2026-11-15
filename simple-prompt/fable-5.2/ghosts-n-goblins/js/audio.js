/*
 * audio.js — "CURSED OPL" sound board: a procedural Web Audio synthesizer in the spirit of the
 * arcade YM2151 / AdLib OPL3 FM chips plus a PSG square channel.
 *
 *   - 2-operator FM voices (harpsichord, pipe organ, slap bass, brass, bell) + PSG square + noise drums
 *   - a tiny baroque composer: every theme is a scale, a chord progression and a few motifs that are
 *     sequenced diatonically (lead), broken into toccata figures (harpsichord), walked (bass),
 *     sustained (organ) and beaten (percussion)
 *   - BOXER-SHORTS PANIC: when Arthur loses his armour the tempo jumps and the lead + harpsichord
 *     leap an octave (and the lead flips to the shrill PSG channel)
 *   - ~70 synthesised sound effects
 *
 * Public API:  GNG.snd(name, {vol, pitch})   GNG.music(name)   GNG.musicStop(fadeSeconds)
 *              GNG.audioBoxer(bool)          GNG.Audio.unlock() / toggleMute()
 * Everything is a silent no-op until the first user gesture creates the AudioContext
 * (and under Node, where there is no Web Audio at all).
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const AC = window.AudioContext || window.webkitAudioContext;

  const A = GNG.Audio = {
    ctx: null, master: null, musicBus: null, sfxBus: null, noiseBuf: null,
    muted: false, boxer: false, songBus: null, song: null, songName: '', pending: '', step: 0, nextT: 0, timer: 0,
    lastSfx: {}, volume: 0.55
  };

  A.unlock = function () {
    if (!AC) return;
    if (!A.ctx) {
      try { A.ctx = new AC(); } catch (e) { A.ctx = null; return; }
      const c = A.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.16;
      A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : A.volume;
      A.musicBus = c.createGain(); A.musicBus.gain.value = 0.5;
      A.sfxBus = c.createGain(); A.sfxBus.gain.value = 0.8;
      A.musicBus.connect(A.master); A.sfxBus.connect(A.master);
      A.master.connect(comp); comp.connect(c.destination);
      // 15-bit LFSR-flavoured noise, like a PSG noise channel
      const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let l = 0x4001;
      for (let i = 0; i < len; i++) { const b = (l ^ (l >> 1)) & 1; l = (l >> 1) | (b << 14); d[i] = ((l & 0xff) / 127.5 - 1) * 0.6 + (Math.random() * 2 - 1) * 0.4; }
      A.noiseBuf = buf;
      A.timer = setInterval(A.pump, 25);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    if (A.pending) { const p = A.pending; A.pending = ''; GNG.music(p, true); }
  };
  A.setMute = function (m) {
    A.muted = !!m;
    if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : A.volume, A.ctx.currentTime, 0.02);
  };
  A.toggleMute = function () { A.setMute(!A.muted); return A.muted; };

  /* ====================================================================== voices */
  const PATCH = {
    //            mod ratio, index start -> end over idxT, attack, decay, sustain, release, carrier wave
    harpsi: { ratio: 3, idx: 5.5, idxEnd: 0.6, idxT: 0.06, a: 0.002, d: 0.28, s: 0.12, r: 0.09, wave: 'sine', vol: 0.21 },
    harpsi2: { ratio: 5, idx: 3.2, idxEnd: 0.4, idxT: 0.04, a: 0.002, d: 0.2, s: 0.08, r: 0.07, wave: 'sine', vol: 0.12 },
    organ: { ratio: 2, idx: 1.3, idxEnd: 1.1, idxT: 0.2, a: 0.035, d: 0.1, s: 0.9, r: 0.14, wave: 'sine', vol: 0.11 },
    organ2: { ratio: 0.5, idx: 0.9, idxEnd: 0.8, idxT: 0.2, a: 0.04, d: 0.1, s: 0.9, r: 0.16, wave: 'sine', vol: 0.09 },
    bass: { ratio: 1, idx: 3.2, idxEnd: 0.7, idxT: 0.09, a: 0.003, d: 0.16, s: 0.55, r: 0.05, wave: 'sine', vol: 0.3 },
    brass: { ratio: 1, idx: 0.6, idxEnd: 2.4, idxT: 0.07, a: 0.02, d: 0.12, s: 0.7, r: 0.1, wave: 'sine', vol: 0.2 },
    bell: { ratio: 3.5, idx: 3, idxEnd: 0.3, idxT: 0.5, a: 0.002, d: 0.6, s: 0.02, r: 0.3, wave: 'sine', vol: 0.18 },
    psg: { psg: true, a: 0.004, d: 0.08, s: 0.6, r: 0.05, wave: 'square', vol: 0.085 }
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function voice(t, midi, dur, patch, vol, bus) {
    const c = A.ctx, p = PATCH[patch], f = mtof(midi), v = (vol === undefined ? 1 : vol) * p.vol;
    const car = c.createOscillator(), amp = c.createGain();
    car.type = p.wave; car.frequency.value = f;
    let mod = null;
    if (!p.psg) {
      mod = c.createOscillator(); const mg = c.createGain();
      mod.frequency.value = f * p.ratio;
      mg.gain.setValueAtTime(f * p.idx, t);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * p.idxEnd), t + p.idxT);
      mod.connect(mg); mg.connect(car.frequency);
    } else {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 6; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(car.frequency);
      lfo.start(t); lfo.stop(t + dur + p.r + 0.05);
    }
    const end = t + Math.max(dur, p.a + 0.01);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(v, t + p.a);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, v * p.s), Math.min(end, t + p.a + p.d));
    amp.gain.setValueAtTime(Math.max(0.0001, v * p.s), end);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + p.r);
    car.connect(amp); amp.connect(bus || A.songBus || A.musicBus);
    car.start(t); car.stop(end + p.r + 0.03);
    if (mod) { mod.start(t); mod.stop(end + p.r + 0.03); }
  }

  function tone(t, o) {
    const c = A.ctx, osc = c.createOscillator(), g = c.createGain(), dur = o.dur || 0.1, v = o.vol === undefined ? 0.3 : o.vol;
    osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(Math.max(20, o.f0), t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    if (o.fm) {
      const m = c.createOscillator(), mg = c.createGain();
      m.frequency.value = o.f0 * (o.fm[0] || 2); mg.gain.setValueAtTime(o.f0 * (o.fm[1] || 2), t);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.01, o.f0 * (o.fm[2] === undefined ? 0.2 : o.fm[2])), t + dur);
      m.connect(mg); mg.connect(osc.frequency); m.start(t); m.stop(t + dur + 0.03);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.att || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || A.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  function noise(t, o) {
    const c = A.ctx, src = c.createBufferSource(), g = c.createGain(), flt = c.createBiquadFilter();
    const dur = o.dur || 0.1, v = o.vol === undefined ? 0.3 : o.vol;
    src.buffer = A.noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    flt.type = o.type || 'lowpass'; flt.Q.value = o.q || 0.8;
    flt.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.att || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(o.bus || A.sfxBus);
    src.start(t, (t * 7.13) % 0.9); src.stop(t + dur + 0.03);
  }

  /* ====================================================================== sound effects */
  // helpers bound per call: T(wave, f0, f1, dur, vol, delay, fm)   N(dur, vol, type, f0, f1, delay, q)   S(notes[], stepSec, patch, vol)
  const SFX = {
    jump: (T) => T('square', 260, 620, 0.11, 0.16),
    double_jump: (T) => { T('square', 420, 980, 0.09, 0.15); T('triangle', 840, 1700, 0.12, 0.12, 0.05); },
    land: (T, N) => N(0.06, 0.2, 'lowpass', 600, 120),
    heavy_land: (T, N) => { N(0.16, 0.4, 'lowpass', 500, 60); T('sine', 110, 40, 0.18, 0.4); T('square', 900, 300, 0.05, 0.08); },
    throw_lance: (T, N) => { N(0.09, 0.2, 'bandpass', 1400, 3800, 0, 2); T('square', 700, 300, 0.07, 0.1); },
    throw_dagger: (T, N) => { N(0.05, 0.17, 'highpass', 3000, 6000); T('square', 1200, 700, 0.04, 0.08); },
    throw_torch: (T, N) => { N(0.16, 0.2, 'bandpass', 500, 1500, 0, 1.5); T('sawtooth', 220, 440, 0.12, 0.06); },
    throw_axe: (T, N) => { N(0.18, 0.2, 'bandpass', 700, 300, 0, 3); T('triangle', 300, 150, 0.16, 0.14); },
    throw_cross: (T) => { T('triangle', 880, 1320, 0.1, 0.14); T('sine', 1760, 1320, 0.14, 0.08, 0.05); },
    cross_catch: (T) => T('triangle', 1320, 1760, 0.06, 0.12),
    hit: (T, N) => { N(0.05, 0.22, 'bandpass', 1800, 900, 0, 1.2); T('square', 300, 180, 0.05, 0.12); },
    clang: (T, N) => { T('square', 2100, 1900, 0.09, 0.1, 0, [2.76, 3, 0.5]); T('sine', 3150, 3000, 0.14, 0.07); N(0.03, 0.12, 'highpass', 5000); },
    enemy_die: (T, N) => { T('square', 500, 90, 0.2, 0.16); N(0.18, 0.2, 'lowpass', 2400, 200); },
    zombie_die: (T, N) => { T('sawtooth', 220, 55, 0.3, 0.16, 0, [0.5, 3, 1]); N(0.2, 0.16, 'lowpass', 900, 150); },
    zombie_rise: (T, N) => { N(0.3, 0.16, 'lowpass', 200, 800); T('sawtooth', 70, 130, 0.3, 0.1, 0, [0.5, 4, 2]); },
    bone_rattle: (T) => { for (let i = 0; i < 5; i++) T('square', 900 + ((i * 577) % 900), 700, 0.03, 0.1, i * 0.035); },
    acid_spit: (T, N) => { T('sawtooth', 500, 150, 0.12, 0.12); N(0.1, 0.14, 'bandpass', 2500, 800, 0, 4); },
    fireball: (T, N) => { N(0.24, 0.24, 'bandpass', 400, 1600, 0, 1.2); T('sawtooth', 180, 90, 0.2, 0.1); },
    laser: (T) => { T('sawtooth', 1800, 200, 0.16, 0.14); T('square', 2400, 300, 0.12, 0.06); },
    arremer_screech: (T, N) => { T('sawtooth', 900, 1500, 0.1, 0.13, 0, [1.5, 3, 2]); T('sawtooth', 1500, 600, 0.22, 0.13, 0.1, [1.5, 4, 1]); N(0.25, 0.08, 'highpass', 3000); },
    armor_shatter: (T, N) => { N(0.35, 0.4, 'highpass', 2500, 800); for (let i = 0; i < 6; i++) T('square', 1500 + ((i * 733) % 1900), 900, 0.07, 0.09, i * 0.04, [2.7, 2, 0.3]); T('sine', 160, 50, 0.25, 0.35); },
    armor_eject: (T, N) => { T('square', 200, 800, 0.1, 0.16); N(0.12, 0.25, 'bandpass', 1200, 3000, 0.04, 2); T('square', 1900, 1700, 0.1, 0.09, 0.1, [2.76, 2, 0.4]); },
    armor_equip: (T) => { [523, 659, 784, 1047].forEach((f, i) => T('square', f, f, 0.08, 0.13, i * 0.05)); T('square', 2100, 2000, 0.12, 0.07, 0.2, [2.76, 2, 0.3]); },
    armor_bounce: (T) => { T('sine', 180, 720, 0.16, 0.3); T('square', 360, 1440, 0.14, 0.08); },
    anvil_crush: (T, N) => { T('sine', 140, 38, 0.3, 0.5); N(0.2, 0.35, 'lowpass', 900, 100); T('square', 1700, 1500, 0.2, 0.1, 0, [2.76, 3, 0.4]); },
    gold_armor: (T) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { T('triangle', f, f, 0.14, 0.15, i * 0.06); T('sine', f * 2, f * 2, 0.2, 0.06, i * 0.06 + 0.02); }); },
    possess: (T, N) => { T('sine', 200, 1400, 0.4, 0.2, 0, [1.01, 6, 1]); T('triangle', 1400, 300, 0.3, 0.12, 0.25); N(0.5, 0.1, 'bandpass', 500, 3000, 0, 5); },
    possess_end: (T, N) => { T('sine', 1200, 150, 0.35, 0.2, 0, [1.01, 6, 1]); N(0.25, 0.16, 'lowpass', 2500, 300); },
    soul_fail: (T) => { T('square', 220, 180, 0.08, 0.13); T('square', 170, 140, 0.12, 0.13, 0.09); },
    time_warning: (T) => { T('square', 1320, 1320, 0.06, 0.12); T('square', 1320, 1320, 0.06, 0.12, 0.1); },
    chest_spawn: (T) => { [392, 494, 587, 784].forEach((f, i) => T('triangle', f, f * 1.01, 0.09, 0.16, i * 0.045)); },
    chest_hit: (T, N) => { T('square', 240, 160, 0.06, 0.16); N(0.05, 0.14, 'lowpass', 1200); },
    chest_open: (T, N) => { N(0.1, 0.2, 'lowpass', 500, 1500); [659, 784, 988, 1319].forEach((f, i) => T('square', f, f, 0.08, 0.12, 0.06 + i * 0.05)); },
    magician: (T) => { for (let i = 0; i < 10; i++) T('sine', 500 + i * 140, 600 + i * 150, 0.09, 0.1, i * 0.045, [3.5, 2, 0.2]); },
    magic_charge: (T) => T('sawtooth', 110, 660, 0.9, 0.09, 0, [2, 3, 6]),
    magic_ready: (T) => { T('triangle', 1320, 1320, 0.1, 0.14); T('triangle', 1760, 1760, 0.2, 0.14, 0.09); },
    magic_cast: (T, N) => { N(0.9, 0.4, 'lowpass', 4000, 150); T('sawtooth', 880, 55, 0.8, 0.25, 0, [1.5, 6, 1]); for (let i = 0; i < 8; i++) T('triangle', 400 + i * 220, 500 + i * 240, 0.12, 0.1, i * 0.05); },
    pickup_weapon: (T) => { [659, 880, 1319].forEach((f, i) => T('square', f, f, 0.07, 0.14, i * 0.05)); },
    pickup_treasure: (T) => { T('square', 988, 988, 0.05, 0.13); T('square', 1319, 1319, 0.14, 0.13, 0.05); },
    potion: (T) => { [330, 415, 494, 659, 831].forEach((f, i) => T('sine', f, f * 1.03, 0.1, 0.16, i * 0.06, [2, 1, 0.2])); },
    one_up: (T) => { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => T('square', f, f, 0.09, 0.14, i * 0.075)); },
    key: (T) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => T('triangle', f, f, 0.12, 0.16, i * 0.07)); },
    key_appear: (T) => { for (let i = 0; i < 8; i++) T('sine', 1568 - i * 90, 1568 - i * 90, 0.1, 0.1, i * 0.05, [3.5, 2, 0.3]); },
    floppy: (T, N) => { for (let i = 0; i < 6; i++) { T('square', 90 + (i % 2) * 40, 80, 0.04, 0.14, i * 0.07); N(0.03, 0.1, 'bandpass', 1800, 0, i * 0.07 + 0.02, 6); } [523, 659, 784, 1047].forEach((f, i) => T('triangle', f, f, 0.14, 0.14, 0.45 + i * 0.07)); },
    secret: (T) => { [988, 932, 784, 659, 784, 1319].forEach((f, i) => T('triangle', f, f, 0.08, 0.14, i * 0.07)); },
    checkpoint: (T, N) => { for (let i = 0; i < 4; i++) { T('square', 100, 90, 0.03, 0.12, i * 0.06); N(0.025, 0.08, 'bandpass', 2200, 0, i * 0.06 + 0.02, 6); } T('square', 880, 880, 0.07, 0.12, 0.28); T('square', 1175, 1175, 0.12, 0.12, 0.36); },
    plate_click: (T, N) => { T('square', 180, 120, 0.04, 0.18); N(0.03, 0.14, 'highpass', 2500); },
    gate_open: (T, N) => { N(0.5, 0.16, 'bandpass', 300, 900, 0, 6); T('sawtooth', 60, 90, 0.5, 0.1, 0, [0.5, 5, 3]); },
    gate_close: (T, N) => { T('sine', 120, 40, 0.2, 0.4); N(0.14, 0.3, 'lowpass', 800, 100); T('square', 1500, 1300, 0.12, 0.07, 0, [2.76, 2, 0.3]); },
    slicer_chomp: (T, N) => { T('square', 2400, 1800, 0.07, 0.11, 0, [2.76, 3, 0.4]); N(0.06, 0.22, 'highpass', 3500); T('sine', 150, 60, 0.1, 0.22); },
    crusher_slam: (T, N) => { T('sine', 100, 30, 0.35, 0.55); N(0.25, 0.4, 'lowpass', 700, 80); },
    crumble: (T, N) => { N(0.3, 0.26, 'lowpass', 900, 200); for (let i = 0; i < 3; i++) T('square', 140 - i * 20, 60, 0.05, 0.1, i * 0.06); },
    floor_smash: (T, N) => { N(0.3, 0.4, 'lowpass', 1500, 100); T('sine', 130, 35, 0.3, 0.45); },
    splash: (T, N) => { N(0.35, 0.3, 'bandpass', 900, 2600, 0, 1.4); N(0.2, 0.2, 'lowpass', 500, 150, 0.05); },
    thunder: (T, N) => { N(1.4, 0.5, 'lowpass', 500, 50); N(0.3, 0.35, 'lowpass', 2500, 300); },
    wind_gust: (T, N) => N(1.2, 0.16, 'bandpass', 300, 1100, 0, 2.5),
    flame_ignite: (T, N) => { N(0.3, 0.2, 'bandpass', 700, 2400, 0, 1.2); T('triangle', 440, 880, 0.2, 0.07); },
    explode: (T, N) => { N(0.5, 0.5, 'lowpass', 2800, 70); T('sine', 150, 30, 0.4, 0.5); T('square', 90, 40, 0.2, 0.15); },
    ohno: (T) => { T('square', 620, 560, 0.12, 0.16, 0, [1.01, 1, 0.5]); T('square', 470, 380, 0.22, 0.16, 0.16, [1.01, 1, 0.5]); },
    player_die: (T, N) => { T('square', 660, 110, 0.5, 0.2); T('triangle', 330, 55, 0.6, 0.2, 0.05); N(0.3, 0.16, 'lowpass', 2000, 200); },
    boss_hit: (T, N) => { N(0.08, 0.28, 'bandpass', 900, 400, 0, 1.4); T('sawtooth', 200, 90, 0.1, 0.18); },
    boss_die: (T, N) => { T('sawtooth', 300, 40, 1.4, 0.3, 0, [0.5, 6, 2]); N(1.2, 0.3, 'lowpass', 2500, 100); },
    boss_warning: (T) => { for (let i = 0; i < 4; i++) { T('sawtooth', 440, 440, 0.16, 0.16, i * 0.34, [1, 1, 1]); T('sawtooth', 330, 330, 0.16, 0.16, i * 0.34 + 0.17, [1, 1, 1]); } },
    hint: (T) => { T('triangle', 1175, 1175, 0.04, 0.08); T('triangle', 1568, 1568, 0.06, 0.08, 0.05); },
    tally: (T) => T('square', 1568, 1568, 0.03, 0.08),
    menu_move: (T) => T('square', 660, 660, 0.035, 0.1),
    menu_select: (T) => { T('square', 660, 660, 0.05, 0.12); T('square', 990, 990, 0.1, 0.12, 0.05); },
    coin: (T) => { T('square', 988, 988, 0.06, 0.14); T('square', 1319, 1319, 0.28, 0.14, 0.06); },
    pause: (T) => { [660, 520, 660, 520].forEach((f, i) => T('square', f, f, 0.05, 0.1, i * 0.06)); },
    crt: (T, N) => { N(0.12, 0.1, 'highpass', 6000); T('sine', 15700, 15700, 0.08, 0.02); T('square', 60, 60, 0.1, 0.08); }
  };

  GNG.snd = function (name, opts) {
    const c = A.ctx;
    if (!c || A.muted || c.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = c.currentTime;
    if (A.lastSfx[name] !== undefined && now - A.lastSfx[name] < 0.035) return;
    A.lastSfx[name] = now;
    const vm = opts && opts.vol !== undefined ? opts.vol : 1, pm = opts && opts.pitch ? opts.pitch : 1;
    const t0 = now + 0.005;
    const T = (wave, f0, f1, dur, vol, delay, fm) => tone(t0 + (delay || 0), { wave: wave, f0: f0 * pm, f1: f1 * pm, dur: dur, vol: vol * vm, fm: fm });
    const N = (dur, vol, type, f0, f1, delay, q) => noise(t0 + (delay || 0), { dur: dur, vol: vol * vm, type: type, f0: (f0 || 2000) * pm, f1: f1 ? f1 * pm : 0, q: q });
    try { fn(T, N); } catch (e) { /* never let a sound effect break the game */ }
  };

  /* ====================================================================== the baroque composer */
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygdom: [0, 1, 4, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10]
  };
  // Motif = "degree[:steps]" tokens relative to the bar's chord root (r = rest). Bar = spb steps.
  // Drum bar = one char per step: k kick, s snare, h hat, o open hat, t tom, '.' rest.
  const FIG = {     // harpsichord figurations: chord degrees per step (2 = third, 4 = fifth, 7 = octave)
    toccata: [0, 4, 7, 4, 9, 7, 4, 7, 0, 4, 7, 4, 9, 7, 4, 2],
    alberti: [0, 4, 2, 4, 0, 4, 2, 4, 0, 4, 2, 4, 0, 4, 2, 4],
    rolling: [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2],
    stab: [0, null, null, 4, null, null, 7, null, 0, null, null, 4, null, 7, null, 4],
    jig: [0, 4, 7, 4, 7, 9, 0, 4, 7, 9, 7, 4],
    waltz: [0, null, 4, null, 7, null, 9, null, 7, null, 4, null],
    chug: [0, 0, 7, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 7, 4, 2]
  };
  const BASS = {
    drive: [0, null, 0, 7, 0, null, 0, 7, 0, null, 0, 7, 0, 7, 4, 7],
    walk: [0, null, null, null, 4, null, null, null, 7, null, null, null, 4, null, 2, null],
    pedal: [0, null, null, 0, null, null, 0, null, 0, null, null, 0, null, 0, 0, null],
    chug: [0, 0, 7, 0, 0, 2, 0, 0, 3, 0, 0, 4, 2, 0, 1, 0],
    gallop: [0, null, 0, 0, 0, null, 0, 0, 7, null, 7, 7, 4, null, 4, 4],
    jig: [0, null, null, 4, null, 7, 0, null, null, 4, null, 2],
    waltz: [0, null, null, null, 4, null, null, null, 4, null, null, null],
    slow: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null]
  };
  const SONGS = {
    title: {
      bpm: 92, spb: 16, tonic: 50, scale: 'minor', loop: true,
      prog: '0 0 5 4# 0 3 4# 0 | 3 6 5 4# 0 5 4# 0',
      lead: { a: '7:1 6:1 7:6 r:2 4:1 3:1 2:1 1:1 0:2', b: '4:2 5:2 6:2 7:2 9:4 7:4', c: '9:1 8:1 7:1 6:1 5:1 4:1 3:1 2:1 4:4 0:4', d: '0:8 r:8' },
      form: 'a c b d a c b d | b b a c a c b d', fig: 'rolling', figVol: 0.5, bass: 'slow', organ: 1.2, drums: ['k...............', 'k.......k.....k.'], leadPatch: 'organ'
    },
    map: {
      bpm: 112, spb: 16, tonic: 50, scale: 'minor', loop: false,
      prog: '0 5 4# 0', lead: { a: '0:2 2:2 4:2 7:2 6:2 4:2 5:4', b: '5:2 4:2 2:2 0:2 2:4 4:4', c: '4:2 r:1 4:1 6:2 7:2 9:4 8:4', d: '7:12 r:4' },
      form: 'a b c d', fig: 'toccata', figVol: 0.8, bass: 'walk', organ: 1, drums: ['k...h...s...h...', 'k...h...s...h.s.', 'k.k.h...s...h.ss', 'k...............'], leadPatch: 'brass'
    },
    stage1: {      // Monkey Island: a cursed 12/8 pirate jig
      bpm: 126, spb: 12, sub: 3, tonic: 57, scale: 'minor', loop: true,
      prog: '0 0 6 0 0 3 4# 0 | 5 2 6 0 3 0 4# 0',
      lead: { a: '4:2 4:1 7:2 6:1 4:2 2:1 4:3', b: '7:2 6:1 4:2 2:1 0:2 2:1 4:3', c: '2:1 4:1 6:1 7:2 9:1 7:2 6:1 4:2 2:1', d: '4:2 2:1 0:3 r:3 4:1 2:1 1:1', e: '0:2 0:1 2:2 4:1 2:2 0:1 -1:3', f: '0:6 r:3 4:1 5:1 6:1' },
      form: 'a b a d a c e f | c c a b c a e f', fig: 'jig', figVol: 0.75, bass: 'jig', organ: 0.6, drums: ['k..h.hs..h.h', 'k..h.hs..hkh'], leadPatch: 'harpsi'
    },
    stage2: {      // King's Quest: a haunted courtly waltz
      bpm: 132, spb: 12, sub: 4, tonic: 52, scale: 'dorian', loop: true,
      prog: '0 6 0 4 0 6 3 4# | 2 6 0 4 3 0 4# 0',
      lead: { a: '4:4 5:2 6:2 7:4', b: '6:3 5:1 4:2 2:2 4:4', c: '2:4 4:2 2:2 0:2 -1:2', d: '0:8 r:2 4:2', e: '7:2 9:2 8:2 7:2 6:2 5:2', f: '4:2 6:2 4:2 2:2 1:2 2:2' },
      form: 'a b a c a b f d | e b e c a f c d', fig: 'waltz', figVol: 0.9, bass: 'waltz', organ: 0.9, drums: ['k...h...h...', 'k...h...h.s.'], leadPatch: 'harpsi'
    },
    stage3: {      // Prince of Persia: Phrygian-dominant catacombs
      bpm: 112, spb: 16, tonic: 50, scale: 'phrygdom', loop: true,
      prog: '0 0 1 0 0 3 1 0 | 3 3 1 0 6 1 1 0',
      lead: { a: '0:3 1:1 2:2 1:1 0:1 1:2 0:2 -1:2 0:2', b: '4:3 5:1 4:1 2:1 1:1 2:1 4:2 2:2 1:2 0:2', c: '7:2 6:1 5:1 4:2 5:1 4:1 2:2 1:1 2:1 0:4', d: '0:1 1:1 2:1 1:1 0:1 -1:1 0:2 r:8', e: '2:2 4:2 5:1 4:1 2:1 1:1 2:4 1:4' },
      form: 'a b a d a c e d | c c b d e b a d', fig: 'stab', figVol: 0.8, bass: 'pedal', organ: 0.7, drums: ['t..t..k.t..tk.t.', 't..t..k.t.ttk.s.'], leadPatch: 'harpsi'
    },
    stage4: {      // Lemmings foundry: a clockwork factory march
      bpm: 138, spb: 16, tonic: 55, scale: 'minor', loop: true,
      prog: '0 0 3 4# 0 5 4# 0 | 5 2 3 0 5 3 4# 0',
      lead: { a: '0:1 r:1 2:1 r:1 4:1 r:1 2:1 r:1 0:1 r:1 4:1 r:1 7:2 4:2', b: '7:1 r:1 6:1 r:1 4:1 r:1 6:1 r:1 7:2 9:2 7:2 4:2', c: '4:1 5:1 6:1 7:1 6:1 5:1 4:1 2:1 4:2 2:2 0:4', d: '2:1 r:1 2:1 r:1 4:2 2:2 1:2 2:2 0:2 r:2', e: '9:2 7:2 9:2 11:2 9:1 8:1 7:1 6:1 7:4' },
      form: 'a b a d a b c d | e b e c a b c d', fig: 'alberti', figVol: 0.7, bass: 'drive', organ: 0.5, drums: ['k.h.s.h.k.h.s.h.', 'k.h.s.h.k.k.s.ss', 'k.o.s.h.k.o.s.h.'], leadPatch: 'harpsi'
    },
    stage5: {      // DOOM necropolis: baroque speed-metal
      bpm: 152, spb: 16, tonic: 52, scale: 'phrygian', loop: true,
      prog: '0 0 0 1 0 0 5 1 | 3 3 2 1 0 0 1 0',
      lead: { a: '0:2 r:1 0:1 7:2 6:1 5:1 4:2 2:2 0:4', b: '7:1 9:1 7:1 6:1 7:1 6:1 5:1 4:1 5:1 4:1 2:1 1:1 0:4', c: '4:3 4:1 5:2 4:2 2:2 1:2 0:4', d: 'r:4 7:2 7:2 8:4 7:4', e: '9:1 7:1 4:1 7:1 9:1 7:1 4:1 7:1 8:1 7:1 4:1 7:1 8:1 7:1 5:1 4:1' },
      form: 'a d a b a d c b | e e c b a d e b', fig: 'chug', figVol: 0.55, bass: 'chug', organ: 0.5, drums: ['k.hhs.hkk.hhs.h.', 'k.hhs.hkk.hhs.ss', 'kkhhs.hkk.khs.sk'], leadPatch: 'harpsi'
    },
    stage6: {      // the Throne: full gothic organ fugue
      bpm: 124, spb: 16, tonic: 48, scale: 'minor', loop: true,
      prog: '0 4# 0 3 6 2 4# 0 | 5 3 6 2 3 0 4# 0',
      lead: { a: '0:2 4:2 2:1 1:1 0:1 -1:1 0:2 2:2 4:4', b: '7:1 6:1 5:1 4:1 5:1 4:1 3:1 2:1 3:1 2:1 1:1 0:1 2:4', c: '4:2 7:2 6:1 5:1 4:1 3:1 4:2 6:2 7:4', d: '9:4 8:2 7:2 6:2 4:2 5:4', e: '0:1 2:1 4:1 2:1 0:1 2:1 4:1 7:1 9:1 7:1 4:1 2:1 0:4' },
      form: 'a b a c d b e c | d d b c a b e c', fig: 'toccata', figVol: 0.7, bass: 'gallop', organ: 1.3, drums: ['k...s...k.k.s...', 'k...s...k.k.s.ss', 'k.h.s.h.k.k.s.h.'], leadPatch: 'organ'
    },
    boss: {
      bpm: 164, spb: 16, tonic: 54, scale: 'minor', loop: true,
      prog: '0 0 5 4# 0 0 1 4# | 3 3 5 4# 0 5 4# 0',
      lead: { a: '0:1 2:1 4:1 2:1 0:1 2:1 4:1 7:1 6:2 4:2 5:2 4:2', b: '7:2 r:1 7:1 9:2 7:2 6:1 5:1 4:1 2:1 4:4', c: '9:1 8:1 7:1 6:1 7:1 6:1 5:1 4:1 5:1 4:1 3:1 2:1 3:1 2:1 1:1 0:1' },
      form: 'a b a c a b c c | b b a c a c c c', fig: 'toccata', figVol: 0.75, bass: 'gallop', organ: 0.8, drums: ['k.hks.hkk.hks.hk', 'k.hks.hkk.hksssk'], leadPatch: 'brass'
    },
    finalboss: {
      bpm: 172, spb: 16, tonic: 48, scale: 'phrygian', loop: true,
      prog: '0 1 0 6 0 1 3 4# | 5 6 0 1 3 1 4# 0',
      lead: { a: '7:2 7:1 6:1 7:2 9:2 8:2 7:2 6:2 4:2', b: '0:1 1:1 2:1 1:1 0:1 1:1 2:1 4:1 5:1 4:1 2:1 4:1 5:1 7:1 8:1 7:1', c: '9:3 8:1 7:2 6:2 7:8', d: '11:2 9:2 8:2 7:2 6:1 5:1 4:1 2:1 4:4' },
      form: 'a b a c a b d c | d d b c a b d c', fig: 'rolling', figVol: 0.8, bass: 'gallop', organ: 1.3, drums: ['kkhks.hkkkhks.hk', 'kkhks.hkk.sksssk'], leadPatch: 'organ'
    },
    clear: {
      bpm: 132, spb: 16, tonic: 60, scale: 'major', loop: false,
      prog: '0 3 4 0', lead: { a: '0:2 2:2 4:2 7:2 4:2 7:2 9:4', b: '7:2 5:2 4:2 5:2 7:4 9:4', c: '6:2 4:2 6:2 8:2 6:2 8:2 11:4', d: '7:3 7:1 7:12' },
      form: 'a b c d', fig: 'toccata', figVol: 0.9, bass: 'drive', organ: 1, drums: ['k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.ss', 'k.h.s.h.k.k.ssss', 'k...............'], leadPatch: 'brass'
    },
    victory: {
      bpm: 120, spb: 16, tonic: 62, scale: 'major', loop: false,
      prog: '0 4 5 3 0 3 4 0', lead: { a: '0:4 2:2 4:2 7:4 4:4', b: '4:3 2:1 4:2 6:2 7:8', c: '7:2 6:2 7:2 9:2 7:4 4:4', d: '2:2 4:2 5:2 7:2 9:8', e: '7:2 9:2 11:2 9:2 7:2 4:2 2:4', f: '7:16' },
      form: 'a b c d a e d f', fig: 'rolling', figVol: 0.9, bass: 'walk', organ: 1.3, drums: ['k...s...k...s...', 'k...s...k.k.s.ss', 'k...............'], leadPatch: 'brass'
    },
    ending: {
      bpm: 104, spb: 16, tonic: 62, scale: 'major', loop: true,
      prog: '0 4 5 2 3 0 3 4 | 0 4 5 2 3 4 0 0',
      lead: { a: '4:4 2:2 4:2 7:4 6:2 4:2', b: '5:4 4:2 2:2 4:8', c: '2:2 4:2 5:2 7:2 9:4 7:4', d: '0:12 r:4' },
      form: 'a b a c a b c d | c b a c a b c d', fig: 'rolling', figVol: 0.8, bass: 'walk', organ: 1.1, drums: ['k...h...s...h...', 'k...h...s...h.s.'], leadPatch: 'harpsi'
    },
    death: {
      bpm: 100, spb: 16, tonic: 50, scale: 'minor', loop: false,
      prog: '0 4#', lead: { a: '7:2 6:2 4:2 2:2 3:2 2:2 0:2 -1:2', b: '0:12 r:4' },
      form: 'a b', fig: 'stab', figVol: 0.6, bass: 'slow', organ: 1.2, drums: ['k.......s.......', 'k...............'], leadPatch: 'organ'
    },
    gameover: {
      bpm: 76, spb: 16, tonic: 50, scale: 'minor', loop: false,
      prog: '0 5 4# 0', lead: { a: '4:4 2:4 0:4 -1:4', b: '3:4 2:4 0:8', c: '2:4 1:4 2:4 4:4', d: '0:16' },
      form: 'a b c d', fig: 'rolling', figVol: 0.5, bass: 'slow', organ: 1.4, drums: ['k...............'], leadPatch: 'organ'
    }
  };

  function compile(def) {
    const scale = SCALES[def.scale], spb = def.spb;
    const prog = def.prog.replace(/\|/g, ' ').trim().split(/\s+/).map(s => ({ root: parseInt(s, 10), sharp: /#/.test(s) }));
    const form = def.form.replace(/\|/g, ' ').trim().split(/\s+/);
    const motifs = {};
    for (const k in def.lead) {
      const ev = []; let pos = 0;
      for (const tok of def.lead[k].trim().split(/\s+/)) {
        const m = tok.split(':'), len = m[1] ? parseInt(m[1], 10) : 1;
        if (m[0] !== 'r') ev.push({ pos: pos, deg: parseInt(m[0], 10), len: len });
        pos += len;
      }
      motifs[k] = ev;
    }
    const bars = prog.length;
    // degree (relative to chord root) -> midi, with the leading-tone fix on dominant ("#") bars
    function note(ch, deg, oct) {
      const d = ch.root + deg, i = ((d % 7) + 7) % 7;
      let n = def.tonic + scale[i] + 12 * Math.floor(d / 7) + 12 * (oct || 0);
      if (ch.sharp && (((deg % 7) + 7) % 7) === 2) n += (scale[(ch.root + 2) % 7] - scale[ch.root % 7] + 12) % 12 === 3 ? 1 : 0;
      return n;
    }
    return { def: def, spb: spb, bars: bars, prog: prog, form: form, motifs: motifs, note: note, total: bars * spb };
  }
  const COMPILED = {};

  function drum(t, ch, v) {
    const bus = A.songBus || A.musicBus;
    if (ch === 'k') { tone(t, { wave: 'sine', f0: 150, f1: 42, dur: 0.14, vol: 0.5 * v, bus: bus }); noise(t, { dur: 0.02, vol: 0.12 * v, type: 'lowpass', f0: 1500, bus: bus }); }
    else if (ch === 's') { noise(t, { dur: 0.12, vol: 0.26 * v, type: 'highpass', f0: 1400, bus: bus }); tone(t, { wave: 'triangle', f0: 220, f1: 140, dur: 0.07, vol: 0.2 * v, bus: bus }); }
    else if (ch === 'h') noise(t, { dur: 0.03, vol: 0.1 * v, type: 'highpass', f0: 7500, bus: bus });
    else if (ch === 'o') noise(t, { dur: 0.13, vol: 0.1 * v, type: 'highpass', f0: 6500, bus: bus });
    else if (ch === 't') tone(t, { wave: 'sine', f0: 190, f1: 90, dur: 0.12, vol: 0.34 * v, bus: bus });
  }

  function scheduleStep(song, step, t, stepDur) {
    const def = song.def, spb = song.spb, bar = Math.floor(step / spb) % song.bars, pos = step % spb;
    const ch = song.prog[bar], boxer = A.boxer && def.loop;
    const up = boxer ? 1 : 0;
    // lead: the motif for this bar, sequenced onto the bar's chord
    const mot = song.motifs[song.form[bar % song.form.length]];
    if (mot) {
      for (const ev of mot) {
        if (ev.pos !== pos) continue;
        const n = song.note(ch, ev.deg, 1 + up), dur = ev.len * stepDur * 0.92;
        const patch = boxer ? 'psg' : def.leadPatch;
        voice(t, n, dur, patch, 1);
        if (patch === 'harpsi') voice(t, n + 12, dur, 'harpsi2', 0.8);
        else if (patch === 'organ') voice(t, n - 12, dur, 'organ2', 0.9);
      }
    }
    // harpsichord figuration
    const fig = FIG[def.fig];
    if (fig) {
      const d = fig[pos % fig.length];
      if (d !== null && d !== undefined) voice(t, song.note(ch, d, up), stepDur * 1.6, 'harpsi', def.figVol || 0.7);
    }
    // bass
    const bp = BASS[def.bass];
    if (bp) {
      const d = bp[pos % bp.length];
      if (d !== null && d !== undefined) voice(t, song.note(ch, d, -2), stepDur * 1.5, 'bass', 1);
    }
    // pipe organ pad: retrigger the triad twice per bar
    if (def.organ && (pos === 0 || pos === (spb >> 1))) {
      const len = stepDur * (spb >> 1) * 0.98;
      voice(t, song.note(ch, 0, -1), len, 'organ', def.organ);
      voice(t, song.note(ch, 2, -1), len, 'organ', def.organ * 0.8);
      voice(t, song.note(ch, 4, -1), len, 'organ', def.organ * 0.8);
      if (pos === 0) voice(t, song.note(ch, 0, -2), len * 2, 'organ2', def.organ);
    }
    // percussion
    const dr = def.drums;
    if (dr && dr.length) {
      const pat = dr[(bar % 4 === 3 && dr.length > 1) ? Math.min(1, dr.length - 1) : ((bar % 8 === 6 && dr.length > 2) ? 2 : 0)];
      const chd = (def.loop ? pat : dr[Math.min(bar, dr.length - 1)]).charAt(pos);
      if (chd && chd !== '.') drum(t, chd, 1);
      if (boxer && (pos & 1) && chd === '.') drum(t, 'h', 0.7);
    }
  }

  A.pump = function () {
    const c = A.ctx, song = A.song;
    if (!c || !song || c.state !== 'running') return;
    if (A.nextT < c.currentTime) A.nextT = c.currentTime + 0.03;
    while (A.nextT < c.currentTime + 0.14) {
      const def = song.def;
      const bpm = def.bpm * (A.boxer && def.loop ? 1.22 : 1);
      const stepDur = 60 / bpm / (def.sub || 4);
      if (A.step >= song.total) {
        if (!def.loop) { A.song = null; A.songName = ''; return; }
        A.step = 0;
      }
      try { scheduleStep(song, A.step, A.nextT, stepDur); } catch (e) { /* keep the beat going */ }
      A.step++;
      A.nextT += stepDur;
    }
  };

  function dropSongBus(fade) {
    const c = A.ctx, b = A.songBus;
    if (!b) return;
    A.songBus = null;
    b.gain.cancelScheduledValues(c.currentTime);
    b.gain.setValueAtTime(b.gain.value, c.currentTime);
    b.gain.linearRampToValueAtTime(0.0001, c.currentTime + fade);
    setTimeout(function () { try { b.disconnect(); } catch (e) { /* already gone */ } }, (fade + 3) * 1000);
  }

  /** Start a theme (restarts it unless it is already playing and `force` is false). */
  GNG.music = function (name, force) {
    if (!SONGS[name]) return;
    if (!A.ctx) { A.pending = name; return; }
    if (A.songName === name && A.song && !force) return;
    if (!COMPILED[name]) COMPILED[name] = compile(SONGS[name]);
    const c = A.ctx;
    dropSongBus(0.06);
    A.songBus = c.createGain(); A.songBus.gain.value = 1; A.songBus.connect(A.musicBus);
    A.song = COMPILED[name]; A.songName = name; A.step = 0; A.nextT = c.currentTime + 0.08;
  };
  GNG.musicStop = function (fade) {
    A.pending = '';
    A.song = null; A.songName = '';
    if (A.ctx) dropSongBus(Math.max(0.03, fade || 0.05));
  };
  GNG.musicName = function () { return A.songName || A.pending; };
  /** Boxer-shorts panic mode: faster tempo, octave-up lead on the PSG channel. */
  GNG.audioBoxer = function (on) { A.boxer = !!on; };
  GNG.SONGS = SONGS;
})();
