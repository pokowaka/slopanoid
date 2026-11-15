/* BEAT TRIBE - Web Audio tracker + synthesizer.  Zero samples: every sound is built
 * from oscillators, noise and filters at runtime.
 *
 *  - Tracker rows are scheduled ahead of time against AudioContext.currentTime
 *    (lookahead scheduler, no setTimeout-timed notes).  The game hands us a transport
 *    mapping "simulation frame -> audio time", so music stays locked to the sim and
 *    doubles its tempo with fast-forward.
 *  - Each song channel feeds one of 5 stem buses (DRUMS/BASS/CHORDS/LEAD/FULL MIX)
 *    that fade in as lemmings are saved; the [T] mixer can mute/solo them.
 *  - Lemming-triggered notes arrive already quantized to a song step (see sim.js)
 *    and are scheduled sample-accurately at that step's audio time.
 *  - Signal path: channels -> stems -> pre -> "Silence" low-pass -> compressor ->
 *    master -> soft clipper -> analyser -> speakers, plus a tempo-synced stereo ping-pong delay bus. */
(function (g) {
  'use strict';
  var BT = g.BT;
  var A = BT.Audio = {};
  var ctx = null, master, comp, anal, pre, silLP, delayIn, dl, dr, stemG = [], lemBus, lemSend, sfxBus, pulseBus;
  var noiseBuf = null, W = {}, freqData = null, waveData = null;
  var world = null, song = null, chOut = [], acidV = {};
  var tr = { t0: 0, f0: 0, speed: 1, sf: 8, next: 0 };
  var unlocked = 0, mute = [false, false, false, false, false], solo = [false, false, false, false, false], muted = false;
  var live = [];
  var LOOKAHEAD = 0.14, VOL = 0.8;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ------------------------------------------------------------ setup
  // `custom` lets tools/audio-test.js pass an OfflineAudioContext to measure the mix.
  A.init = function (custom) {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); return true; }
    var AC = g.AudioContext || g.webkitAudioContext, i, d, n;
    if (!AC && !custom) return false;
    try { ctx = custom || new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : VOL;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -17; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.16;
    anal = ctx.createAnalyser(); anal.fftSize = 256; anal.smoothingTimeConstant = 0.72;
    freqData = new Uint8Array(anal.frequencyBinCount); waveData = new Uint8Array(anal.fftSize);
    pre = ctx.createGain(); pre.gain.value = 0.85;
    silLP = ctx.createBiquadFilter(); silLP.type = 'lowpass'; silLP.frequency.value = 20000; silLP.Q.value = 0.5;
    // final safety: a soft clipper, so dense crowd moments saturate gently instead of clipping
    var half = ctx.createGain(), clip = ctx.createWaveShaper(), curve = new Float32Array(2049), x;
    for (i = 0; i < 2049; i++) { x = (i / 1024 - 1) * 2; curve[i] = Math.abs(x) < 0.6 ? x : (x < 0 ? -1 : 1) * (0.6 + 0.4 * Math.tanh((Math.abs(x) - 0.6) / 0.4)); }
    half.gain.value = 0.5; clip.curve = curve; clip.oversample = '2x';
    pre.connect(silLP); silLP.connect(comp); comp.connect(master); master.connect(half); half.connect(clip); clip.connect(anal); anal.connect(ctx.destination);
    // stereo ping-pong delay bus
    delayIn = ctx.createGain(); delayIn.gain.value = 1;
    dl = ctx.createDelay(2); dr = ctx.createDelay(2);
    var fb = ctx.createGain(), fbLP = ctx.createBiquadFilter(), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner(), wet = ctx.createGain();
    fb.gain.value = 0.36; fbLP.type = 'lowpass'; fbLP.frequency.value = 3400; pl.pan.value = -0.85; pr.pan.value = 0.85; wet.gain.value = 0.6;
    delayIn.connect(dl); dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(fbLP); fbLP.connect(fb); fb.connect(dl);
    pl.connect(wet); pr.connect(wet); wet.connect(pre);
    for (i = 0; i < 5; i++) { stemG[i] = ctx.createGain(); stemG[i].gain.value = 0; stemG[i].connect(pre); }
    pulseBus = ctx.createGain(); pulseBus.gain.value = 0.5; pulseBus.connect(pre);
    lemBus = ctx.createGain(); lemBus.gain.value = 0.75; lemBus.connect(pre);
    lemSend = ctx.createGain(); lemSend.gain.value = 0.28; lemBus.connect(lemSend); lemSend.connect(delayIn);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    // white noise
    n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); d = noiseBuf.getChannelData(0);
    var s = 22222;
    for (i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) | 0; d[i] = ((s >>> 8) & 0xffff) / 32768 - 1; }
    // pulse waves with different duty cycles (Amiga/SID style)
    [['p50', 0.5], ['p25', 0.25], ['p12', 0.125]].forEach(function (p) {
      var N = 32, re = new Float32Array(N), im = new Float32Array(N), k;
      for (k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * p[1]);
      W[p[0]] = ctx.createPeriodicWave(re, im);
    });
    if (song) A.setSong(world.index, unlocked);
    return true;
  };
  A.ok = function () { return !!ctx && ctx.state === 'running'; };
  // test hooks: drop the context / schedule a block of rows without the realtime clock
  A._reset = function () { try { if (ctx && ctx.close && ctx.state !== 'closed') ctx.close(); } catch (e) { /* offline */ } ctx = null; stemG = []; sendG = []; chOut = []; acidV = {}; live = []; };
  A._schedule = function (s0, s1) { for (var s = s0; s < s1; s++) row(s, tStep(s) + 0.01); };
  A._note = function (e) { VOICE[e.v](tStep(e.s) + 0.01, e, lemBus, stepDur()); };
  A.time = function () { return A.ok() ? ctx.currentTime : -1; };
  A.setMute = function (m) { muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.02); };
  A.isMuted = function () { return muted; };
  A.analyser = function () {
    if (!A.ok()) return null;
    anal.getByteFrequencyData(freqData); anal.getByteTimeDomainData(waveData);
    return { freq: freqData, wave: waveData };
  };
  // The Silence swallows the high end of the whole mix.
  A.setSilence = function (amt) {
    if (!A.ok()) return;
    silLP.frequency.setTargetAtTime(350 + 19650 * Math.pow(1 - BT.clamp(amt, 0, 1), 3), ctx.currentTime, 0.25);
  };

  // ------------------------------------------------------------ song / stems / transport
  A.setSong = function (wi, stems) {
    var i, ch, gn, pan, send;
    world = BT.WORLDS[wi]; song = world.song; tr.sf = world.sf; tr.next = 0;
    unlocked = stems || 0;
    if (!ctx) return;
    for (i = 0; i < chOut.length; i++) { try { chOut[i].disconnect(); } catch (e) { /* already gone */ } }
    for (i in acidV) { try { acidV[i].o.stop(); acidV[i].vca.disconnect(); } catch (e) { /* ignore */ } }
    chOut = []; acidV = {};
    for (i = 0; i < song.chans.length; i++) {
      ch = song.chans[i]; gn = ctx.createGain(); gn.gain.value = ch.vol;
      if (ch.pan) { pan = ctx.createStereoPanner(); pan.pan.value = ch.pan; gn.connect(pan); pan.connect(stemG[ch.stem]); }
      else gn.connect(stemG[ch.stem]);
      if (ch.send) { send = ctx.createGain(); send.gain.value = ch.send; gn.connect(send); send.connect(stemG[ch.stem] === undefined ? delayIn : delayGate(ch.stem)); }
      chOut.push(gn);
    }
    applyStems(ctx.currentTime, 0.02);
  };
  // delay sends follow their stem's gain so a locked stem cannot leak through the echo
  var sendG = [];
  function delayGate(k) {
    if (!sendG[k]) { sendG[k] = ctx.createGain(); sendG[k].gain.value = 0; sendG[k].connect(delayIn); }
    return sendG[k];
  }
  function applyStems(t, tc) {
    var k, any = solo.some(function (s, i) { return s && i < unlocked; }), v;
    for (k = 0; k < 5; k++) {
      v = (k < unlocked && !mute[k] && (!any || solo[k])) ? 1 : 0;
      stemG[k].gain.setTargetAtTime(v, t, tc);
      if (sendG[k]) sendG[k].gain.setTargetAtTime(v, t, tc);
    }
  }
  A.setStems = function (n, fast) {
    unlocked = n;
    if (ctx) applyStems(ctx.currentTime, fast ? 0.02 : 0.35);
  };
  A.stems = function () { return { unlocked: unlocked, mute: mute, solo: solo }; };
  A.toggleMute = function (k) { mute[k] = !mute[k]; if (ctx) applyStems(ctx.currentTime, 0.03); };
  A.toggleSolo = function (k) { solo[k] = !solo[k]; if (ctx) applyStems(ctx.currentTime, 0.03); };
  A.resetMixer = function () { for (var k = 0; k < 5; k++) { mute[k] = false; solo[k] = false; } if (ctx) applyStems(ctx.currentTime, 0.03); };

  // Map sim frames to audio time.  Called on start, pause/resume and speed changes.
  A.setTransport = function (t0, f0, speed) {
    tr.t0 = t0; tr.f0 = f0; tr.speed = speed;
    if (!ctx) return;
    var d = Math.min(1.9, 3 * tr.sf / (60 * speed));               // dotted-eighth echo, tempo synced
    dl.delayTime.setTargetAtTime(d, ctx.currentTime, 0.05); dr.delayTime.setTargetAtTime(d, ctx.currentTime, 0.05);
    var s = Math.ceil((f0 - 0.001) / tr.sf);
    if (tr.next < s) tr.next = s;
  };
  A.seek = function (step) { tr.next = step; };
  function tStep(s) { return tr.t0 + (s * tr.sf - tr.f0) / (60 * tr.speed); }
  function stepDur() { return tr.sf / (60 * tr.speed); }
  // Lookahead scheduler: queue every tracker row that starts within the next 140 ms.
  A.pump = function () {
    if (!A.ok() || !song) return;
    var hz = ctx.currentTime + LOOKAHEAD, t, guard = 0;
    while ((t = tStep(tr.next)) < hz && guard++ < 64) {
      if (t > ctx.currentTime - 0.06) row(tr.next, Math.max(t, ctx.currentTime + 0.002));
      tr.next++;
    }
  };
  function row(step, t) {
    var p = BT.songPos(song, step), rows = song.rows[p.pat], ci, ch, cell, sd = stepDur();
    if ((p.row & 3) === 0) tick(t, (p.row & 15) === 0);            // the ever-present pulse
    for (ci = 0; ci < song.chans.length; ci++) {
      ch = song.chans[ci];
      if (ch.stem >= unlocked) continue;
      cell = rows[ci][p.row];
      if (cell) INST[ch.inst](t, cell, chOut[ci], sd, ch, step);
    }
  }

  // ------------------------------------------------------------ building blocks
  function osc(type, f, t, end, dest, det) {
    var o = ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t);
    if (det) o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(end);
    return o;
  }
  var nzOff = 0;
  function nz(t, end, dest, rate) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    if (rate) s.playbackRate.value = rate;
    nzOff = (nzOff + 0.137) % 1.7;
    s.connect(dest); s.start(t, nzOff); s.stop(end);
    return s;
  }
  function vca(dest, pan) {
    var v = ctx.createGain(), p;
    v.gain.value = 0;
    if (pan) { p = ctx.createStereoPanner(); p.pan.value = pan; v.connect(p); p.connect(dest); } else v.connect(dest);
    return v;
  }
  function adsr(p, t, a, peak, d, s, dur, r) {
    var off = t + Math.max(dur, a + 0.005);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(Math.max(0.0001, peak * s), t + a, d / 3);
    p.setTargetAtTime(0.0001, off, r / 3);
    return off + r * 1.7;
  }
  function biq(type, f, q, dest) {
    var b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; b.connect(dest);
    return b;
  }
  /* Generic subtractive voice.  P: w[] waves, det[] cents, mul[] freq ratios, a d s r,
   * lp {f0,f1,dt,q,track} filter envelope (f1 at attack -> f0), vib {r,c,dly}, g gain */
  function synth(t, f, vel, dur, out, P) {
    var v = vca(out, P.pan), n = P.w.length, i, o, dest = v, fl, end, k, lfo, lg;
    end = adsr(v.gain, t, P.a, vel * (P.g || 1) / Math.sqrt(n), P.d, P.s, dur, P.r);
    if (P.lp) {
      k = P.lp.track ? f : 1;
      fl = biq(P.lp.type || 'lowpass', Math.min(18000, P.lp.f1 * k), P.lp.q || 1, v);
      fl.frequency.setValueAtTime(Math.min(18000, P.lp.f1 * k), t);
      fl.frequency.setTargetAtTime(Math.min(18000, P.lp.f0 * k), t + (P.lp.hold || 0), P.lp.dt);
      dest = fl;
    }
    if (P.vib) { lfo = ctx.createOscillator(); lfo.frequency.value = P.vib.r; lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setTargetAtTime(P.vib.c, t + (P.vib.dly || 0), 0.1); lfo.connect(lg); lfo.start(t); lfo.stop(end); }
    for (i = 0; i < n; i++) {
      o = osc(typeof P.w[i] === 'string' && W[P.w[i]] ? W[P.w[i]] : P.w[i], f * (P.mul ? P.mul[i] : 1), t, end, dest, P.det ? P.det[i] : 0);
      if (lg) lg.connect(o.detune);
    }
    return end;
  }
  // 2-operator FM voice.  P: ratio, idx, idxS (sustain fraction), idxD, a d s r, g
  function fm(t, f, vel, dur, out, P) {
    var v = vca(out, P.pan), end = adsr(v.gain, t, P.a, vel * (P.g || 1), P.d, P.s, dur, P.r);
    var car = osc('sine', f, t, end, v), mod = ctx.createOscillator(), mg = ctx.createGain();
    mod.frequency.setValueAtTime(f * P.ratio, t);
    mg.gain.setValueAtTime(f * P.idx, t); mg.gain.setTargetAtTime(f * P.idx * (P.idxS || 0.05), t, P.idxD || 0.1);
    mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(end);
    return end;
  }
  // pitched sine "ping" with a frequency sweep: kicks, toms, timpani, blips
  function ping(t, f0, f1, tf, dec, vel, out, type) {
    var v = vca(out), o = osc(type || 'sine', f0, t, t + dec * 6 + 0.05, v);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + tf);
    v.gain.setValueAtTime(vel, t); v.gain.setTargetAtTime(0.0001, t + 0.004, dec);
  }
  // filtered noise burst: snares, hats, cymbals, claps
  function burst(t, type, f, q, a, dec, vel, out, rate) {
    var v = vca(out), fl = biq(type, f, q, v);
    nz(t, t + a + dec * 6 + 0.05, fl, rate);
    v.gain.setValueAtTime(0.0001, t); v.gain.linearRampToValueAtTime(vel, t + a); v.gain.setTargetAtTime(0.0001, t + a, dec);
    return fl;
  }
  function tick(t, bar) { ping(t, bar ? 1900 : 1400, bar ? 900 : 700, 0.02, 0.012, bar ? 0.34 : 0.2, pulseBus, 'triangle'); }

  // TB-303 style mono voice kept alive per channel so slides and accents work.
  function acid(name, t, cell, out, sd, step, res, wave, cutBase) {
    var v = acidV[name], f = mtof(cell.m), slideIn, cut, amt, dec;
    if (!v) {
      v = acidV[name] = { o: ctx.createOscillator(), f: ctx.createBiquadFilter(), vca: ctx.createGain(), hold: -1 };
      v.o.type = wave; v.f.type = 'lowpass'; v.f.Q.value = res; v.vca.gain.value = 0;
      v.o.connect(v.f); v.f.connect(v.vca); v.vca.connect(out); v.o.start();
    }
    slideIn = v.hold > t - 0.004;
    cut = cutBase * Math.pow(2, 1.4 * (0.5 - 0.5 * Math.cos(step / 128 * Math.PI)));       // slow filter sweep across 16 bars
    amt = cell.acc ? 3600 : 1500; dec = cell.acc ? 0.07 : 0.15;
    if (slideIn) v.o.frequency.setTargetAtTime(f, t, 0.025);
    else {
      v.o.frequency.setValueAtTime(f, t);
      v.f.frequency.cancelScheduledValues(t); v.f.frequency.setValueAtTime(cut + amt, t); v.f.frequency.setTargetAtTime(cut, t, dec);
      v.vca.gain.cancelScheduledValues(t); v.vca.gain.setValueAtTime(0.0001, t); v.vca.gain.linearRampToValueAtTime(cell.acc ? 1 : 0.68, t + 0.004);
    }
    if (cell.sl) v.hold = t + sd * cell.len;
    else { v.hold = -1; v.vca.gain.setTargetAtTime(0.0001, t + sd * cell.len * 0.62, 0.012); }
  }
  // Formant "voice": sawtooth glottis + breath noise through three band-passes.
  function vocal(t, segs, pitch, vel, out) {
    var v = vca(out), src = ctx.createOscillator(), sg = ctx.createGain(), ng = ctx.createGain(), bus = ctx.createGain(), fs = [], i, k, tt = t, s, end;
    for (i = 0, end = t; i < segs.length; i++) end += segs[i].d;
    src.type = 'sawtooth'; src.frequency.setValueAtTime(pitch[0][1], t);
    for (i = 1; i < pitch.length; i++) src.frequency.linearRampToValueAtTime(pitch[i][1], t + pitch[i][0]);
    sg.gain.value = 0; ng.gain.value = 0; src.connect(sg); sg.connect(bus); nz(t, end + 0.1, ng); ng.connect(bus);
    for (k = 0; k < 3; k++) { fs[k] = biq('bandpass', segs[0].f[k], k === 0 ? 7 : 9, v); fs[k].frequency.setValueAtTime(segs[0].f[k], t); bus.connect(fs[k]); }
    sg.gain.setValueAtTime(0.0001, t); ng.gain.setValueAtTime(0.0001, t);
    for (i = 0; i < segs.length; i++) {
      s = segs[i]; tt += s.d;
      for (k = 0; k < 3; k++) fs[k].frequency.linearRampToValueAtTime(s.f[k], tt);
      sg.gain.linearRampToValueAtTime(Math.max(0.0001, s.g), tt - s.d * 0.5); sg.gain.linearRampToValueAtTime(Math.max(0.0001, s.ge === undefined ? s.g : s.ge), tt);
      ng.gain.linearRampToValueAtTime(Math.max(0.0001, s.n || 0), tt - s.d * 0.5); ng.gain.linearRampToValueAtTime(Math.max(0.0001, s.n || 0), tt);
    }
    v.gain.setValueAtTime(vel * 2.2, t); v.gain.setTargetAtTime(0.0001, end, 0.02);
    src.start(t); src.stop(end + 0.1);
  }
  function ohno(t, vel, out) {
    vocal(t, [{ d: 0.02, f: [640, 1000, 2900], g: 0.2 }, { d: 0.13, f: [600, 950, 2900], g: 1 }, { d: 0.05, f: [450, 850, 2800], g: 0.9 },
      { d: 0.06, f: [300, 1500, 2600], g: 0.3 }, { d: 0.13, f: [620, 980, 2900], g: 1 }, { d: 0.24, f: [400, 780, 2700], g: 0.8, ge: 0 }],
    [[0, 560], [0.15, 500], [0.26, 470], [0.4, 380], [0.63, 210]], vel, out);
  }
  function letsgo(t, vel, out) {
    vocal(t, [{ d: 0.05, f: [380, 1300, 2800], g: 0.6 }, { d: 0.1, f: [660, 1950, 2900], g: 1 }, { d: 0.07, f: [2600, 5200, 7200], g: 0, n: 0.5 },
      { d: 0.04, f: [500, 1000, 2700], g: 0 }, { d: 0.1, f: [520, 1000, 2700], g: 1 }, { d: 0.2, f: [400, 800, 2700], g: 0.8, ge: 0 }],
    [[0, 430], [0.15, 460], [0.26, 500], [0.36, 540], [0.56, 680]], vel, out);
  }

  // ------------------------------------------------------------ tracker instruments  (t, cell, out, stepDur, chan, step)
  function notes(c) { return typeof c.m === 'number' ? [c.m] : c.m; }
  function poly(P, gate) {
    return function (t, c, out, sd) { var m = notes(c), i; for (i = 0; i < m.length; i++) synth(t, mtof(m[i]), c.v / Math.sqrt(m.length), c.len * sd * (gate || 1), out, P); };
  }
  var INST = {
    kickchip: function (t, c, o) { ping(t, 150, 46, 0.07, 0.06, c.v, o, 'triangle'); ping(t, 300, 60, 0.03, 0.02, c.v * 0.4, o, 'square'); },
    kick909: function (t, c, o) { ping(t, 170, 47, 0.055, 0.11, c.v, o); burst(t, 'highpass', 3000, 0.7, 0.001, 0.006, c.v * 0.25, o); },
    kickbig: function (t, c, o) { ping(t, 130, 40, 0.08, 0.17, c.v, o); burst(t, 'lowpass', 500, 0.7, 0.002, 0.05, c.v * 0.5, o); },
    kickjungle: function (t, c, o) { ping(t, 200, 52, 0.04, 0.075, c.v, o); burst(t, 'bandpass', 2400, 1, 0.001, 0.008, c.v * 0.3, o); },
    snarechip: function (t, c, o) { burst(t, 'bandpass', 1900, 0.8, 0.001, 0.045, c.v, o); ping(t, 240, 170, 0.03, 0.025, c.v * 0.35, o, 'square'); },
    snarebreak: function (t, c, o) { burst(t, 'highpass', 1100, 0.7, 0.001, 0.05 * (0.5 + c.v), c.v, o); ping(t, 230, 165, 0.04, 0.035, c.v * 0.6, o, 'triangle'); },
    snareorch: function (t, c, o) { burst(t, 'bandpass', 3200, 0.9, 0.001, 0.035, c.v, o); ping(t, 190, 170, 0.02, 0.02, c.v * 0.25, o, 'triangle'); },
    gated: function (t, c, o) {                               // big 80s snare with a hard noise gate
      var v = vca(o), fl = biq('lowpass', 5200, 0.7, v);
      nz(t, t + 0.3, fl); v.gain.setValueAtTime(c.v, t); v.gain.linearRampToValueAtTime(c.v * 0.55, t + 0.15); v.gain.linearRampToValueAtTime(0.0001, t + 0.17);
      ping(t, 220, 150, 0.05, 0.05, c.v * 0.7, o, 'triangle');
    },
    clap: function (t, c, o) { for (var i = 0; i < 3; i++) burst(t + i * 0.011, 'bandpass', 1300, 1.4, 0.001, i === 2 ? 0.07 : 0.008, c.v * 0.8, o); },
    hatchip: function (t, c, o) { burst(t, 'highpass', 7200, 0.7, 0.001, 0.014 + c.v * 0.012, c.v, o); },
    hat909: function (t, c, o) { burst(t, 'highpass', 8600, 0.9, 0.001, 0.016, c.v, o); },
    ohat: function (t, c, o, sd) { burst(t, 'highpass', 7800, 0.9, 0.002, Math.min(0.09, sd * 0.7), c.v, o); },
    hatbreak: function (t, c, o) { burst(t, 'bandpass', 7000, 1.6, 0.001, 0.03, c.v, o); ping(t, 5200, 5100, 0.02, 0.012, c.v * 0.12, o, 'square'); },
    ride: function (t, c, o) { burst(t, 'bandpass', 9500, 2.5, 0.001, 0.09, c.v, o); ping(t, 6100, 6000, 0.05, 0.05, c.v * 0.08, o, 'square'); },
    shaker: function (t, c, o) { burst(t, 'bandpass', 6400, 1.8, 0.012, 0.016, c.v, o); },
    crash: function (t, c, o) { var f = burst(t, 'highpass', 3600, 0.6, 0.002, 0.42, c.v, o); f.frequency.setValueAtTime(3200, t); f.frequency.linearRampToValueAtTime(6500, t + 1.2); },
    tom: function (t, c, o) { var f = mtof(c.m); ping(t, f * 1.6, f, 0.07, 0.11, c.v, o); },
    timp: function (t, c, o) { var f = mtof(c.m); ping(t, f * 1.12, f, 0.09, 0.3, c.v, o); ping(t, f * 1.5, f * 1.5, 0.05, 0.16, c.v * 0.3, o, 'triangle'); burst(t, 'lowpass', 380, 0.7, 0.002, 0.04, c.v * 0.6, o); },
    tri: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.92, o, { w: ['triangle'], a: 0.003, d: 0.2, s: 0.75, r: 0.04 }); },
    pulse: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.9, o, { w: ['p25'], a: 0.004, d: 0.12, s: 0.6, r: 0.07, vib: { r: 6, c: 9, dly: 0.14 } }); },
    pulse2: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.85, o, { w: ['p12'], a: 0.004, d: 0.1, s: 0.45, r: 0.1 }); },
    chiparp: function (t, c, o, sd) {                          // classic tracker arpeggio: one channel, cycling chord tones
      var m = c.m, dur = c.len * sd * 0.92, v = vca(o), end = adsr(v.gain, t, 0.003, c.v, 0.15, 0.6, dur, 0.04), ot = osc(W.p25, mtof(m[0]), t, end, v), k = 0, tt, st = Math.max(0.018, Math.min(0.034, sd / 4));
      for (tt = t; tt < t + dur; tt += st, k++) ot.frequency.setValueAtTime(mtof(m[k % m.length] + (k % (m.length * 2) >= m.length ? 12 : 0)), tt);
    },
    subpulse: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.8, o, { w: ['p50', 'sine'], mul: [1, 1], a: 0.004, d: 0.1, s: 0.7, r: 0.04, lp: { f0: 260, f1: 900, dt: 0.04, q: 2 } }); },
    stab: poly({ w: ['sawtooth', 'sawtooth'], det: [-13, 13], a: 0.003, d: 0.09, s: 0.0, r: 0.08, lp: { f0: 500, f1: 4200, dt: 0.06, q: 3 } }),
    acid: function (t, c, o, sd, ch, step) { acid('a', t, c, o, sd, step, 15, 'sawtooth', 240); },
    acid2: function (t, c, o, sd, ch, step) { acid('b', t, c, o, sd, step + 64, 19, 'square', 420); },
    sawbass: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.85, o, { w: ['sawtooth', 'p50'], mul: [1, 0.5], a: 0.004, d: 0.12, s: 0.6, r: 0.05, lp: { f0: 420, f1: 2200, dt: 0.05, q: 5 } }); },
    pad: poly({ w: ['sawtooth', 'sawtooth', 'sawtooth'], det: [-11, 0, 11], a: 0.22, d: 0.5, s: 0.8, r: 0.45, lp: { f0: 1500, f1: 700, dt: 0.4, q: 0.8 } }),
    fmlead: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.95, o, { w: ['sawtooth', 'p50'], det: [-7, 7], a: 0.015, d: 0.2, s: 0.7, r: 0.16, lp: { f0: 2600, f1: 5200, dt: 0.12, q: 2 }, vib: { r: 5.5, c: 16, dly: 0.25 } }); },
    pluck: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, sd * 0.9, o, { w: ['sawtooth'], a: 0.002, d: 0.12, s: 0, r: 0.08, lp: { f0: 500, f1: 4500, dt: 0.04, q: 3 } }); },
    sub: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.97, o, { w: ['sine', 'triangle'], mul: [1, 2], det: [0, 4], a: 0.012, d: 0.3, s: 0.9, r: 0.07, lp: { f0: 300, f1: 300, dt: 0.1, q: 0.7 } }); },
    bell: function (t, c, o) { fm(t, mtof(c.m), c.v, 0.1, o, { ratio: 3.5, idx: 2.6, idxS: 0.04, idxD: 0.09, a: 0.002, d: 0.5, s: 0, r: 0.5 }); },
    glock: function (t, c, o) { fm(t, mtof(c.m), c.v, 0.05, o, { ratio: 3.01, idx: 1.3, idxS: 0.02, idxD: 0.05, a: 0.001, d: 0.45, s: 0, r: 0.45 }); },
    cello: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.95, o, { w: ['sawtooth', 'sawtooth'], det: [-6, 6], a: 0.06, d: 0.3, s: 0.8, r: 0.18, lp: { f0: 650, f1: 1100, dt: 0.2, q: 1.2 }, vib: { r: 5, c: 8, dly: 0.2 } }); },
    strings: poly({ w: ['sawtooth', 'sawtooth', 'sawtooth'], det: [-14, 0, 13], a: 0.28, d: 0.6, s: 0.85, r: 0.5, lp: { f0: 2300, f1: 900, dt: 0.4, q: 0.7 }, vib: { r: 5.2, c: 7, dly: 0.3 } }),
    brass: function (t, c, o, sd) { synth(t, mtof(c.m), c.v, c.len * sd * 0.92, o, { w: ['sawtooth', 'sawtooth'], det: [-4, 5], a: 0.035, d: 0.2, s: 0.8, r: 0.12, lp: { f0: 1700, f1: 380, dt: 0.035, q: 1.6 }, vib: { r: 5.4, c: 10, dly: 0.3 } }); },
    choir: function (t, c, o, sd) {                             // "aah": saws through two vowel formants
      var m = c.m, i, v, f1, f2, end, dur = c.len * sd;
      for (i = 0; i < m.length; i++) {
        v = vca(o); end = adsr(v.gain, t, 0.3, c.v * 1.8 / m.length, 0.5, 0.85, dur, 0.5);
        f1 = biq('bandpass', 820, 5, v); f2 = biq('bandpass', 1220, 6, v);
        osc('sawtooth', mtof(m[i]), t, end, f1, -6).connect(f2); osc('sawtooth', mtof(m[i]), t, end, f1, 7).connect(f2);
      }
    }
  };

  // ------------------------------------------------------------ lemming voices ("skills are instruments")
  var STEPV = {
    meadow: function (t, f, v, o) { synth(t, f, v, 0.05, o, { w: ['p50'], a: 0.002, d: 0.1, s: 0, r: 0.07 }); },
    garden: function (t, f, v, o) { synth(t, f, v, 0.05, o, { w: ['p25', 'triangle'], mul: [1, 2], a: 0.002, d: 0.11, s: 0, r: 0.08 }); },
    acid: function (t, f, v, o) { synth(t, f, v, 0.06, o, { w: ['sawtooth'], a: 0.002, d: 0.1, s: 0, r: 0.06, lp: { f0: 400, f1: 3800, dt: 0.035, q: 11 } }); },
    sunset: function (t, f, v, o) { fm(t, f, v, 0.05, o, { ratio: 2, idx: 1.6, idxS: 0.1, idxD: 0.08, a: 0.002, d: 0.3, s: 0, r: 0.3 }); },
    cave: function (t, f, v, o) { fm(t, f, v, 0.03, o, { ratio: 4, idx: 0.9, idxS: 0, idxD: 0.02, a: 0.001, d: 0.16, s: 0, r: 0.14 }); },
    hall: function (t, f, v, o) { synth(t, f, v, 0.04, o, { w: ['sawtooth', 'triangle'], a: 0.002, d: 0.13, s: 0, r: 0.12, lp: { f0: 350, f1: 3000, dt: 0.035, q: 1.5 } }); }
  };
  var VOICE = {
    step: function (t, e, o) { STEPV[world.key](t, mtof(e.m), e.vel * 0.5, o); },
    climb: function (t, e, o) { synth(t, mtof(e.m), e.vel * 0.5, 0.04, o, { w: ['sawtooth'], a: 0.001, d: 0.14, s: 0, r: 0.12, lp: { f0: 600, f1: 5200, dt: 0.03, q: 4 } }); },
    float: function (t, e, o, sd) { synth(t, mtof(e.m), e.vel * 0.34, e.d * sd, o, { w: ['triangle', 'sawtooth', 'sawtooth'], det: [0, -9, 9], a: 0.5, d: 0.6, s: 0.8, r: 0.9, lp: { f0: 1500, f1: 400, dt: 0.5, q: 0.8 } }); },
    build: function (t, e, o) { fm(t, mtof(e.m), e.vel * 0.42, 0.04, o, { ratio: 2, idx: 2.2, idxS: 0.05, idxD: 0.05, a: 0.001, d: 0.22, s: 0, r: 0.2 }); synth(t, mtof(e.m), e.vel * 0.18, 0.04, o, { w: ['p12'], a: 0.001, d: 0.08, s: 0, r: 0.05 }); },
    bash: function (t, e, o, sd) {                               // filtered bass sweep
      var dur = Math.max(0.16, sd * 3), v = vca(o), fl = biq('lowpass', 150, 9, v), f = mtof(e.m);
      adsr(v.gain, t, 0.006, e.vel * 0.62, 0.2, 0.8, dur, 0.08);
      fl.frequency.setValueAtTime(140, t); fl.frequency.exponentialRampToValueAtTime(1700, t + dur * 0.6); fl.frequency.exponentialRampToValueAtTime(180, t + dur + 0.1);
      osc('sawtooth', f, t, t + dur + 0.3, fl); osc(W.p50, f * 0.5, t, t + dur + 0.3, fl);
    },
    mine: function (t, e, o) { burst(t, 'bandpass', mtof(e.m) * 2, 14, 0.001, 0.016, e.vel * 1.3, o); ping(t, mtof(e.m) * 2, mtof(e.m) * 1.9, 0.02, 0.012, e.vel * 0.3, o, 'triangle'); },
    kick: function (t, e, o) { INST.kick909(t, { v: e.vel * 0.9 }, o); },
    snare: function (t, e, o) { INST.snarebreak(t, { v: e.vel * 0.75 }, o); },
    crash: function (t, e, o) { INST.crash(t, { v: e.vel * 0.7 }, o); ping(t, 110, 30, 0.25, 0.14, e.vel * 0.9, o); burst(t, 'lowpass', 900, 0.7, 0.002, 0.12, e.vel * 0.8, o); },
    ohno: function (t, e, o) { ohno(t, e.vel * 0.55, o); },
    exit: function (t, e, o) {                                   // the door answers with a rising chord
      var tri = world.mode, pcs = [tri[0], tri[2], tri[4]], all = [], i, k, base = e.m, n = 0;
      for (k = -1; k < 4; k++) for (i = 0; i < 3; i++) all.push(world.root + pcs[i] + 12 * k);
      for (i = 0; i < all.length && n < 4; i++) if (all[i] >= base) { fm(t + n * 0.045, mtof(all[i] + 12), e.vel * 0.3, 0.06, o, { ratio: 2, idx: 1.8, idxS: 0.1, idxD: 0.1, a: 0.002, d: 0.35, s: 0, r: 0.4 }); n++; }
    },
    crush: function (t, e, o) { fm(t, 180, e.vel * 0.5, 0.03, o, { ratio: 2.76, idx: 5, idxS: 0.1, idxD: 0.04, a: 0.001, d: 0.18, s: 0, r: 0.15 }); ping(t, 90, 40, 0.08, 0.07, e.vel * 0.7, o); },
    drone: function (t, e, o, sd) {                              // blockers hold the chord root
      var dur = e.d * sd + 0.12, f = mtof(e.m), v = vca(o), fl = biq('lowpass', 420, 2.5, v);
      adsr(v.gain, t, 0.09, e.vel * 0.3, 0.3, 0.9, dur, 0.3);
      fl.frequency.setValueAtTime(320, t); fl.frequency.linearRampToValueAtTime(620, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(320, t + dur + 0.2);
      osc('sawtooth', f, t, t + dur + 0.6, fl, -8); osc('sawtooth', f, t, t + dur + 0.6, fl, 8); osc('sine', f * 0.5, t, t + dur + 0.6, v); osc(W.p25, f * 1.5, t, t + dur + 0.6, fl);
    }
  };
  // Play one quantized lemming note (event from sim.ev or a song-log entry) at its step.
  A.note = function (e) {
    if (!A.ok() || !world) return;
    var t = Math.max(tStep(e.s), ctx.currentTime + 0.003), i, n = 0;
    for (i = 0; i < live.length; i++) if (live[i] > t) live[n++] = live[i];
    live.length = n;
    if (n > 40 && e.v === 'step') return;                         // hard polyphony ceiling for big crowds
    live.push(t + 0.5);
    VOICE[e.v](t, e, lemBus, stepDur());
  };

  // ------------------------------------------------------------ immediate UI / event sounds
  var SFX = {
    assign: function (t) { ping(t, 880, 1320, 0.04, 0.03, 0.25, sfxBus, 'triangle'); },
    deny: function (t) { ping(t, 160, 120, 0.08, 0.05, 0.3, sfxBus, 'square'); },
    click: function (t) { ping(t, 1200, 900, 0.02, 0.012, 0.2, sfxBus, 'square'); },
    sparkle: function (t) { [0, 4, 7, 12, 16, 19].forEach(function (s, i) { fm(t + i * 0.035, mtof(88 + s), 0.16, 0.03, sfxBus, { ratio: 3, idx: 1.2, idxS: 0, idxD: 0.03, a: 0.001, d: 0.14, s: 0, r: 0.14 }); }); burst(t, 'highpass', 9000, 1, 0.01, 0.12, 0.08, sfxBus); },
    splat: function (t) { burst(t, 'lowpass', 700, 1, 0.001, 0.05, 0.6, sfxBus); ping(t, 140, 50, 0.06, 0.04, 0.4, sfxBus); },
    drown: function (t) { for (var i = 0; i < 4; i++) ping(t + i * 0.07, 500 - i * 60, 900 - i * 90, 0.05, 0.03, 0.2, sfxBus); burst(t, 'bandpass', 1500, 1, 0.01, 0.1, 0.15, sfxBus); },
    burn: function (t) { var f = burst(t, 'bandpass', 3000, 0.8, 0.01, 0.16, 0.35, sfxBus); f.frequency.setValueAtTime(4500, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.4); },
    fallout: function (t) { ping(t, 900, 150, 0.4, 0.14, 0.18, sfxBus, 'triangle'); },
    clink: function (t) { fm(t, 2100, 0.3, 0.02, sfxBus, { ratio: 1.41, idx: 3, idxS: 0.1, idxD: 0.02, a: 0.001, d: 0.08, s: 0, r: 0.08 }); },
    letsgo: function (t) { letsgo(t, 0.6, sfxBus); },
    ohno: function (t) { ohno(t, 0.6, sfxBus); },
    nuke: function (t) { var v = vca(sfxBus), o = osc('sawtooth', 300, t, t + 0.9, v); o.frequency.linearRampToValueAtTime(900, t + 0.4); o.frequency.linearRampToValueAtTime(300, t + 0.8); v.gain.setValueAtTime(0.2, t); v.gain.setTargetAtTime(0.0001, t + 0.7, 0.05); },
    stem: function (t) { [0, 4, 7, 12].forEach(function (s, i) { synth(t + i * 0.07, mtof(72 + s), 0.22, 0.12, sfxBus, { w: ['p25'], a: 0.003, d: 0.15, s: 0.4, r: 0.15 }); }); },
    win: function (t) { [0, 4, 7, 12, 7, 12, 16].forEach(function (s, i) { synth(t + i * 0.11, mtof(67 + s), 0.25, 0.16, sfxBus, { w: ['p25', 'triangle'], a: 0.003, d: 0.2, s: 0.5, r: 0.2 }); }); },
    lose: function (t) { [7, 3, 0, -5].forEach(function (s, i) { synth(t + i * 0.2, mtof(55 + s), 0.25, 0.25, sfxBus, { w: ['p50'], a: 0.005, d: 0.3, s: 0.5, r: 0.25 }); }); }
  };
  A.sfx = function (n) {
    if (!A.ok() || !SFX[n]) return;
    SFX[n](ctx.currentTime + 0.004);
  };
  A.INST_NAMES = Object.keys(INST);
})(typeof window !== 'undefined' ? window : globalThis);
