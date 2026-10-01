/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — audio.js
 * A tiny Web Audio tracker + synth rack. Everything is synthesized live:
 *   - lookahead scheduler on AudioContext time, slaved to the sim song clock
 *   - 64-step patterns chained per world, five stem gain groups
 *   - FM / subtractive leads, resonant acid bass, detuned pads, noise drums,
 *     a synthesized "amen" break for slicing, formant vocals ("Oh no!")
 *   - ping-pong delay, generated reverb + gated reverb, master compressor
 *   - every lemming-made note is logged so the results screen can replay
 *     the song the tribe composed.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const LOOKAHEAD = 0.12;   // seconds scheduled ahead of the audio clock
  const LAT = 0.04;         // audio trails visuals by this much (safety margin)
  const MAX_VOICES = 64;

  // stem send levels [reverb, delay]
  const SENDS = [[0.08, 0], [0.02, 0], [0.3, 0.12], [0.22, 0.3], [0.18, 0.22]];

  class Audio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.stemLevel = 0;
      this.userMute = [false, false, false, false, false];
      this.solo = -1;
      this.pend = [];
      this.drones = new Map();
      this.log = [];
      this.stemLog = [];
      this.active = [];
      this.nextStep = 0;
      this.aT = null;
      this.aS = 0;
      this.speed = 1;
      this.paused = false;
      this.curStep = 0;
      this.song = null;
      this.world = BT.WORLDS[0];
      this.replay = null;
      this.onNote = null;
      this.acidPrev = 0;
      this.muffle = 0;
      this.stepCount = new Map();
    }
    get ready() { return !!this.ctx && this.ctx.state === 'running'; }

    /* ------------------------------------------------------------------ */
    init() {
      if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
      const AC = G.AudioContext || G.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      // master chain: mix -> muffle -> compressor -> master -> analyser -> out
      this.mix = ctx.createGain();
      this.muf = ctx.createBiquadFilter(); this.muf.type = 'lowpass'; this.muf.frequency.value = 20000; this.muf.Q.value = 0.5;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18; this.comp.knee.value = 12; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.85;
      this.an = ctx.createAnalyser(); this.an.fftSize = 256; this.an.smoothingTimeConstant = 0.6;
      this.mix.connect(this.muf); this.muf.connect(this.comp); this.comp.connect(this.master);
      this.master.connect(this.an); this.an.connect(ctx.destination);
      this.fft = new Uint8Array(this.an.frequencyBinCount);
      this.wave = new Uint8Array(this.an.fftSize);

      // buffers
      const sr = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, sr * 2, sr);
      const nd = this.noise.getChannelData(0);
      let seed = 1234567;
      for (let i = 0; i < nd.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; nd[i] = (seed / 0x3fffffff) - 1; }
      this.buildBreak();
      this.pulse12 = this.pulseWave(0.125);
      this.pulse25 = this.pulseWave(0.25);
      this.shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2); }
      this.curve = curve;

      // effects: reverb, gated reverb, ping-pong delay
      this.rev = ctx.createConvolver(); this.rev.buffer = this.makeIR(2.4, 2.6, false);
      this.revOut = ctx.createGain(); this.revOut.gain.value = 0.6;
      this.rev.connect(this.revOut); this.revOut.connect(this.mix);
      this.delIn = ctx.createGain();
      this.dL = ctx.createDelay(2); this.dR = ctx.createDelay(2);
      this.dFb = ctx.createGain(); this.dFb.gain.value = 0.38;
      this.dLp = ctx.createBiquadFilter(); this.dLp.type = 'lowpass'; this.dLp.frequency.value = 3200;
      const merge = ctx.createChannelMerger(2);
      this.delIn.connect(this.dL); this.dL.connect(merge, 0, 0); this.dL.connect(this.dR);
      this.dR.connect(merge, 0, 1); this.dR.connect(this.dLp); this.dLp.connect(this.dFb); this.dFb.connect(this.dL);
      this.delOut = ctx.createGain(); this.delOut.gain.value = 0.5;
      merge.connect(this.delOut); this.delOut.connect(this.mix);

      // stems: voices -> stemIn -> unlock gain -> user gain -> mix (+ sends)
      this.stemIn = []; this.stemUnlock = []; this.stemUser = []; this.stemSend = [];
      for (let c = 0; c < 5; c++) {
        const i = ctx.createGain(), u = ctx.createGain(), us = ctx.createGain();
        u.gain.value = 0;
        i.connect(u); u.connect(us); us.connect(this.mix);
        const rs = ctx.createGain(), ds = ctx.createGain();
        rs.gain.value = SENDS[c][0]; ds.gain.value = SENDS[c][1];
        us.connect(rs); rs.connect(this.rev); us.connect(ds); ds.connect(this.delIn);
        this.stemIn.push(i); this.stemUnlock.push(u); this.stemUser.push(us); this.stemSend.push([rs, ds]);
      }
      this.stemIn[0].gain.value = 0.9; this.stemIn[1].gain.value = 0.9; this.stemIn[2].gain.value = 0.8;
      this.stemIn[3].gain.value = 0.75; this.stemIn[4].gain.value = 0.7;
      // gated snare reverb lives inside the drum stem
      this.gate = ctx.createConvolver(); this.gate.buffer = this.makeIR(0.32, 0, true);
      const gOut = ctx.createGain(); gOut.gain.value = 0.9;
      this.gate.connect(gOut); gOut.connect(this.stemIn[0]);
      // the "heartbeat" pulse heard before any stem is unlocked
      this.pulseBus = ctx.createGain(); this.pulseBus.gain.value = 1; this.pulseBus.connect(this.mix);
      // sfx / lemming voices
      this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.mix);
      const sr1 = ctx.createGain(), sd1 = ctx.createGain(); sr1.gain.value = 0.18; sd1.gain.value = 0.14;
      this.sfx.connect(sr1); sr1.connect(this.rev); this.sfx.connect(sd1); sd1.connect(this.delIn);
      this.sfxSends = [sr1, sd1];
      this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = 1; this.voiceBus.connect(this.mix);
      this.voiceBus.connect(sr1);
      this.applyWorld();
      this.applyUser();
    }

    pulseWave(duty) {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) { re[k] = (2 / (k * Math.PI)) * Math.sin(2 * k * Math.PI * duty); im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * k * Math.PI * duty)); }
      return this.ctx.createPeriodicWave(re, im);
    }
    makeIR(len, decay, gated) {
      const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * len);
      const b = ctx.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let s = 99 + ch * 31;
        for (let i = 0; i < n; i++) {
          s = (s * 16807) % 2147483647;
          const r = s / 1073741823.5 - 1, t = i / n;
          d[i] = r * (gated ? (t < 0.85 ? 0.75 : (1 - t) / 0.15 * 0.75) : Math.pow(1 - t, decay));
        }
      }
      return b;
    }
    /* A synthesized "amen"-style break (170 BPM, 16 slices) for jungle chops. */
    buildBreak() {
      const ctx = this.ctx, sr = ctx.sampleRate, sl = 60 / 170 / 4;
      this.sliceDur = sl;
      const n = Math.floor(sr * sl * 16);
      const b = (this.brk = ctx.createBuffer(1, n, sr));
      const d = b.getChannelData(0);
      const pat = ['KH', 'H', 'KH', 'H', 'SH', 'H', 'Hg', 'gH', 'H', 'gH', 'KH', 'K', 'SH', 'H', 'Hg', 'g'];
      let seed = 42;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
      for (let s = 0; s < 16; s++) {
        const o = Math.floor(s * sl * sr), p = pat[s];
        for (let i = 0; o + i < n && i < sr * 0.5; i++) {
          const t = i / sr;
          let v = 0;
          if (p.includes('K')) v += Math.sin(2 * Math.PI * (50 * t + 60 * (1 - Math.exp(-t * 30)) / 30)) * Math.exp(-t * 14) * 0.9;
          if (p.includes('S')) v += (rnd() * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.5) * Math.exp(-t * 18) * 0.8;
          if (p.includes('g')) v += rnd() * Math.exp(-t * 40) * 0.3;
          if (p.includes('H')) { const h = rnd(); v += (h - (d[o + i - 1] || 0) * 0.5) * Math.exp(-t * 70) * 0.22; }
          if (i < sr * sl * 2) d[o + i] += v;
        }
      }
      for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * 1.3) * 0.8;
    }

    /* ------------------------------------------------------------------ */
    setWorld(worldIdx, levelIdx) {
      this.song = BT.compileSong(worldIdx, levelIdx || 0);
      this.world = BT.WORLDS[worldIdx];
      this.worldIdx = worldIdx; this.levelIdx = levelIdx || 0;
      this.applyWorld();
      this.reset();
    }
    applyWorld() {
      if (!this.ctx || !this.song) return;
      const sd = 60 / this.song.bpm / 4, t = this.ctx.currentTime;
      this.dL.delayTime.setValueAtTime(sd * 3, t);
      this.dR.delayTime.setValueAtTime(sd * 3, t);
      const hall = this.world.key === 'hall';
      this.revOut.gain.setValueAtTime(hall ? 1.0 : this.world.key === 'jungle' ? 0.45 : 0.6, t);
    }
    reset() {
      this.pend.length = 0;
      this.killDrones(0.05);
      this.nextStep = 0; this.aT = null; this.aS = 0; this.curStep = 0;
      this.log = []; this.stemLog = [[0, 0]];
      this.acidPrev = 0;
      this.stopReplay();
      this.setStemLevel(0, true);
    }
    stepDur(speed) { return 60 / this.song.bpm / 4 / (speed || this.speed); }
    timeOf(s) { return this.aT + (s - this.aS) * this.stepDur(); }

    /* Called once per rendered frame with the sim's song position. */
    update(stepPos, speed, paused) {
      if (!this.ctx || !this.song || this.replay) return;
      const now = this.ctx.currentTime;
      this.curStep = stepPos;
      if (paused) {
        if (!this.paused) { this.paused = true; this.hushDrones(true); }
        return;
      }
      if (this.paused || this.aT === null || speed !== this.speed) {
        if (this.paused) this.hushDrones(false);
        this.paused = false; this.speed = speed;
        this.aT = now + LAT; this.aS = stepPos;
        this.nextStep = Math.max(this.nextStep, Math.ceil(stepPos));
      }
      const err = this.timeOf(stepPos) - (now + LAT);
      if (Math.abs(err) > 0.05) { this.aT = now + LAT; this.aS = stepPos; this.nextStep = Math.max(Math.ceil(stepPos), Math.min(this.nextStep, Math.ceil(stepPos) + 2)); }
      else this.aT -= err * 0.03;
      this.pump(now);
    }
    pump(now) {
      let guard = 0;
      for (;;) {
        const t = this.timeOf(this.nextStep);
        if (t > now + LOOKAHEAD + LAT || guard++ > 32) break;
        if (t >= now - 0.01) this.scheduleStep(this.nextStep, Math.max(t, now));
        this.nextStep++;
      }
    }

    /* ------------------------------------------------------------------ */
    patAt(s) {
      const song = this.song, o = song.order[Math.floor(s / 64) % song.order.length];
      return song.pats[o];
    }
    chordAt(s) { const p = this.patAt(s); return p.chords[Math.floor((s % 64) / 16) % p.chords.length]; }
    chordRoot(s, oct) { return this.song.root + (((this.chordAt(s)[0] % 12) + 12) % 12) + 12 * (oct || 0); }
    stemAt(s) { let l = 0; for (const e of this.stemLog) if (e[0] <= s) l = e[1]; return l; }

    scheduleStep(s, t) {
      const song = this.song, pat = this.patAt(s), row = s % 64, sd = this.stepDur();
      const inst = song.src.inst, lvl = this.replay ? this.stemAt(s) : this.stemLevel;
      if (this.replay) this.applyStemGains(lvl, t);
      // backing stems (always scheduled; unlock gains decide what is heard)
      const dc = pat.cells[0][row];
      if (dc) for (const h of dc.hits) {
        let name = h.v === 'k' ? inst.kick : h.v === 's' ? inst.snare : h.v === 'h' ? inst.hat : h.v === 'o' ? inst.open : h.v === 't' ? 'timpani' : h.v === 'brk' ? 'brk' : 'crash';
        if (h.v === 'c' && this.world.key === 'hall') name = 'cymbal';
        this.note(0, name, t, h.v === 't' ? this.chordRoot(s, -2) : 60, sd, 0.55 + h.acc * 0.45, h.slice, s);
      }
      // heartbeat pulse before drums unlock
      if (lvl === 0 && !this.replayNoPulse) {
        if (row % 4 === 0) this.play(inst.kick === 'granCassa' ? 'timpani' : inst.kick, t, this.chordRoot(s, -2), sd, 0.5, this.pulseBus);
        if (row % 4 === 2) this.play(inst.hat, t, 60, sd, 0.35, this.pulseBus);
      }
      const bc = pat.cells[1][row];
      if (bc) this.note(1, inst.bass, t, bc.n, bc.len * sd, bc.acc ? 1 : 0.75, bc, s);
      const cc = pat.cells[2][row];
      if (cc) this.note(2, inst.chord, t, cc.notes, cc.len * sd, 0.8, null, s);
      const lc = pat.cells[3][row];
      if (lc) this.note(3, inst.lead, t, lc.n, lc.len * sd, 0.8, null, s);
      const fc = pat.cells[4][row];
      if (fc) {
        const f = inst.full;
        if (f === 'reese') { if (row % 8 === 0) this.note(4, f, t, fc.n - 24, 8 * sd, 0.8, null, s); }
        else if (f === 'celesta') { if (row % 2 === 0) this.note(4, f, t, fc.n + 12, 2 * sd, 0.7, null, s); }
        else this.note(4, f, t, fc.n, sd, row % 4 === 0 ? 0.9 : 0.6, null, s);
      }
      // drones retune to the chord root on every bar
      if (row % 16 === 0) this.retuneDrones(s, t);
      // quantized lemming events
      if (this.replay) this.replayStep(s, t);
      else this.flushPending(s, t);
    }
    note(stem, name, t, m, d, v, extra, s) {
      if (this.onNote && (this.replay ? this.stemAt(s) : this.stemLevel) > stem) {
        const ms = Array.isArray(m) ? m : [m];
        for (const mm of ms) this.onNote(s, stem, name, mm, v, Math.max(1, Math.round(d / this.stepDur())));
      }
      this.play(name, t, m, d, v, this.stemIn[stem], extra);
    }

    /* ------------------------------------------------------------------ */
    /* Sim events -> quantized musical events                              */
    onSimEvents(events, sim) {
      if (!this.ctx || !this.song || this.replay) return;
      for (const e of events) this.queue(e, sim);
    }
    target(q, off) {
      let s = this.nextStep;
      if (off) { if ((s & 1) === 0) s++; return s; }
      while (s % q) s++;
      return s;
    }
    queue(e, sim) {
      const w = this.world, P = (o) => this.pend.push(o);
      const nScale = w.scale.length;
      switch (e.t) {
        case 'step': {
          const m = e.steel ? -1 : BT.degToMidi(w, e.deg, e.oct);
          P({ s: this.target(2), k: 'foot', m });
          break;
        }
        case 'brick': P({ s: this.target(1), k: 'brick', m: BT.degToMidi(w, e.n, 0), last: e.last }); break;
        case 'climb': P({ s: this.target(1), k: 'pluck', m: BT.degToMidi(w, (e.n % (nScale * 2)), 0) }); break;
        case 'float': P({ s: this.target(1), k: 'floatPad' }); break;
        case 'bash': P({ s: this.target(2), k: 'bassSweep' }); break;
        case 'mine': P({ s: this.target(1, true), k: 'mineClick', m: BT.degToMidi(w, (e.n >> 1) % nScale, 1) }); break;
        case 'dig': P({ s: this.target(2), k: e.n & 1 ? 'digSnare' : 'digKick' }); break;
        case 'clank': P({ s: this.target(1), k: 'clank' }); break;
        case 'explode': P({ s: this.target(1), k: 'boom' }); break;
        case 'exit': P({ s: this.target(1), k: 'exitChord' }); break;
        case 'shrug': P({ s: this.target(1), k: 'shrug' }); break;
        case 'droneOn': this.droneOn(e.id); break;
        case 'droneOff': this.droneOff(e.id); break;
        case 'stem': this.setStemLevel(e.level); this.now('stemRiser', 72, 1.5, 0.7); break;
        case 'ohno': this.now('ohno', 0, 0.6, 0.9); break;
        case 'letsgo': this.now('letsgo', 0, 0.7, 0.9); break;
        case 'hatch': this.now('hatch', 48, 0.5, 0.6); break;
        case 'splat': this.now('splat', 40, 0.3, 0.8); break;
        case 'drown': this.now('drown', 72, 0.6, 0.6); break;
        case 'burn': this.now('burn', 60, 0.6, 0.6); break;
        case 'crush': this.now('crush', 36, 0.4, 0.9); break;
        case 'fallout': this.now('fallout', 84, 0.7, 0.4); break;
        case 'nuke': this.now('nukeAlarm', 72, 1.2, 0.6); break;
        case 'assign':
          this.now('uiTick', 96, 0.05, 0.5);
          if (e.onBeat) this.now('sparkle', BT.degToMidi(w, Math.min(8, e.streak) + 2, 1), 0.4, 0.7);
          break;
      }
    }
    /* Unquantized voice (UI feedback, deaths, vocals). */
    now(name, m, dur, v) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      this.logNote(Math.round(this.curStep), name, m, v, dur / this.stepDur(1));
      this.play(name, t, m, dur, v, name === 'ohno' || name === 'letsgo' ? this.voiceBus : this.sfx);
    }
    ui(name) { // menu sounds (no logging)
      if (!this.ready) return;
      const t = this.ctx.currentTime + 0.005;
      if (name === 'move') this.play('uiTick', t, 90, 0.04, 0.4, this.sfx);
      else if (name === 'ok') { this.play('brick', t, 84, 0.2, 0.5, this.sfx); this.play('brick', t + 0.07, 91, 0.3, 0.5, this.sfx); }
      else if (name === 'bad') this.play('clank', t, 50, 0.2, 0.5, this.sfx);
      else if (name === 'skill') this.play('uiTick', t, 84, 0.04, 0.5, this.sfx);
    }
    flushPending(s, t) {
      if (!this.pend.length) return;
      const due = [], keep = [];
      for (const p of this.pend) (p.s <= s ? due : keep).push(p);
      this.pend = keep;
      if (!due.length) return;
      const sd = this.stepDur();
      // footsteps: <=4 unique pitches, velocity ~ 1/sqrt(n)
      const feet = due.filter((p) => p.k === 'foot');
      if (feet.length) {
        const uniq = [...new Set(feet.map((p) => p.m))].slice(0, 4);
        const v = Math.min(0.7, 0.75 / Math.sqrt(feet.length));
        for (const m of uniq) {
          const name = m < 0 ? 'steelTick' : this.song.src.inst.foot;
          this.logNote(s, name, m < 0 ? 96 : m, v, 1);
          this.play(name, t, m < 0 ? 96 : m, sd, v, this.sfx);
        }
      }
      const per = {};
      for (const p of due) {
        if (p.k === 'foot') continue;
        per[p.k] = (per[p.k] || 0) + 1;
        if (per[p.k] > 3) continue;
        this.skillVoice(p, s, t, sd);
      }
    }
    skillVoice(p, s, t, sd) {
      const inst = this.song.src.inst;
      let name = p.k, m = p.m || 60, d = sd, v = 0.7;
      switch (p.k) {
        case 'brick': d = sd * 3; v = 0.65; break;
        case 'pluck': d = sd * 4; v = 0.6; break;
        case 'floatPad': m = this.chordRoot(s, 1); d = sd * 16; v = 0.5; break;
        case 'bassSweep': m = this.chordRoot(s, -2); d = sd * 4; v = 0.7; break;
        case 'mineClick': d = sd; v = 0.55; break;
        case 'digKick': name = inst.kick === 'granCassa' ? 'timpani' : inst.kick; m = this.chordRoot(s, -2); v = 0.75; break;
        case 'digSnare': name = inst.snare; v = 0.6; break;
        case 'clank': m = 50; d = sd * 2; v = 0.5; break;
        case 'boom': m = 30; d = sd * 8; v = 1; break;
        case 'exitChord': m = this.chordRoot(s, 1); d = sd * 8; v = 0.6; break;
        case 'shrug': m = BT.degToMidi(this.world, 2, 1); d = sd * 2; v = 0.4; break;
      }
      this.logNote(s, name, m, v, d / sd);
      this.play(name, t, m, d, v, this.sfx, name === 'exitChord' ? this.chordAt(s) : null);
    }
    logNote(s, name, m, v, dur) {
      if (this.replay || !this.song) return;
      if (this.log.length < 20000) this.log.push([s, name, m, v, Math.max(1, Math.round(dur))]);
    }

    /* ------------------------------------------------------------------ */
    /* Stems                                                               */
    setStemLevel(l, immediate) {
      this.stemLevel = l;
      if (!this.replay && this.stemLog && (this.stemLog.length === 0 || this.stemLog[this.stemLog.length - 1][1] !== l)) {
        this.stemLog.push([Math.round(this.curStep), l]);
      }
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let c = 0; c < 5; c++) {
        const g = this.stemUnlock[c].gain, on = c < l ? 1 : 0;
        g.cancelScheduledValues(t);
        if (immediate) g.setValueAtTime(on, t);
        else { g.setValueAtTime(g.value, t); g.setTargetAtTime(on, t, 0.5); }
      }
      const pg = this.pulseBus.gain; pg.cancelScheduledValues(t);
      pg.setTargetAtTime(l === 0 ? 1 : 0, t, immediate ? 0.01 : 0.4);
    }
    applyStemGains(l, t) {
      if (this.lastReplayLvl === l) return;
      this.lastReplayLvl = l;
      for (let c = 0; c < 5; c++) this.stemUnlock[c].gain.setTargetAtTime(c < l ? 1 : 0, t, 0.3);
      this.pulseBus.gain.setTargetAtTime(l === 0 ? 1 : 0, t, 0.1);
    }
    toggleStemMute(c) { this.userMute[c] = !this.userMute[c]; this.applyUser(); }
    toggleSolo(c) { this.solo = this.solo === c ? -1 : c; this.applyUser(); }
    applyUser() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let c = 0; c < 5; c++) {
        const on = this.solo >= 0 ? c === this.solo : !this.userMute[c];
        this.stemUser[c].gain.setTargetAtTime(on ? 1 : 0, t, 0.02);
      }
    }
    toggleMute() {
      this.muted = !this.muted;
      if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
      return this.muted;
    }
    setMuffle(a) {
      if (!this.ctx || Math.abs(a - this.muffle) < 0.02) return;
      this.muffle = a;
      const f = 20000 * Math.pow(600 / 20000, Math.min(1, a));
      this.muf.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.15);
    }
    spectrum() { if (!this.ctx) return null; this.an.getByteFrequencyData(this.fft); return this.fft; }
    scope() { if (!this.ctx) return null; this.an.getByteTimeDomainData(this.wave); return this.wave; }

    /* ------------------------------------------------------------------ */
    /* Blocker drones: persistent voices tuned to the chord root.          */
    droneOn(id) {
      if (!this.ctx || this.drones.has(id)) return;
      const ctx = this.ctx, t = ctx.currentTime + 0.01;
      const f = mtof(this.chordRoot(Math.max(0, Math.floor(this.curStep)), -1));
      const out = ctx.createGain(); out.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 4;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35 + (id % 5) * 0.07;
      const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency);
      const oscs = [];
      for (const [type, mul, det] of [['sawtooth', 1, -6], ['sawtooth', 1, 7], ['sine', 0.5, 0]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = det;
        o.connect(lp); o.start(t); oscs.push([o, mul]);
      }
      lfo.start(t);
      lp.connect(out); out.connect(this.sfx);
      const n = this.drones.size;
      const lvl = n < 6 ? 0.075 / Math.sqrt(n + 1) : 0;
      out.gain.setTargetAtTime(lvl, t, 0.12);
      this.drones.set(id, { out, oscs, lfo, lvl, onStep: Math.floor(this.curStep), m: this.chordRoot(Math.max(0, Math.floor(this.curStep)), -1) });
      this.droneLog(id, Math.max(0, Math.round(this.curStep)));
    }
    droneLog(id, s) {
      const d = this.drones.get(id); if (!d) return;
      const end = (Math.floor(s / 16) + 1) * 16;
      const e = [s, 'drone', d.m, 0.5, end - s];
      d.logRef = e; this.log.push(e);
    }
    droneOff(id) {
      const d = this.drones.get(id);
      if (!d) return;
      this.drones.delete(id);
      if (d.logRef) d.logRef[4] = Math.max(1, Math.round(this.curStep) - d.logRef[0]);
      this.releaseDrone(d, 0.3);
    }
    releaseDrone(d, r) {
      const t = this.ctx.currentTime;
      d.out.gain.cancelScheduledValues(t);
      d.out.gain.setValueAtTime(d.out.gain.value, t);
      d.out.gain.setTargetAtTime(0, t, r / 3);
      for (const [o] of d.oscs) o.stop(t + r * 2 + 0.1);
      d.lfo.stop(t + r * 2 + 0.1);
    }
    killDrones(r) { if (this.ctx) for (const d of this.drones.values()) this.releaseDrone(d, r); this.drones.clear(); }
    hushDrones(h) {
      const t = this.ctx.currentTime;
      for (const d of this.drones.values()) d.out.gain.setTargetAtTime(h ? 0 : d.lvl, t, 0.05);
    }
    retuneDrones(s, t) {
      if (this.replay) return;
      const m = this.chordRoot(s, -1), f = mtof(m);
      for (const [id, d] of this.drones) {
        for (const [o, mul] of d.oscs) o.frequency.setTargetAtTime(f * mul, t, 0.04);
        if (d.m !== m || !d.logRef || d.logRef[0] + d.logRef[4] <= s) { d.m = m; this.droneLog(id, s); }
      }
    }

    /* ------------------------------------------------------------------ */
    /* Replay of the composed song                                          */
    getRecording() {
      return { log: this.log.slice(), stems: this.stemLog.slice(), endStep: Math.ceil(this.curStep) + 16, world: this.worldIdx, level: this.levelIdx };
    }
    startReplay(rec, onNote) {
      if (!this.ctx) return;
      this.killDrones(0.1);
      this.pend.length = 0;
      this.song = BT.compileSong(rec.world, rec.level);
      this.world = BT.WORLDS[rec.world];
      this.applyWorld();
      const byStep = new Map();
      for (const e of rec.log) { if (!byStep.has(e[0])) byStep.set(e[0], []); byStep.get(e[0]).push(e); }
      this.replay = { rec, byStep, pos: 0, speed: 1 };
      this.stemLog = rec.stems;
      this.lastReplayLvl = -1;
      this.onNote = onNote;
      this.aT = this.ctx.currentTime + 0.1; this.aS = 0; this.speed = 1; this.nextStep = 0;
    }
    updateReplay(speed) {
      const R = this.replay;
      if (!R) return 0;
      const now = this.ctx.currentTime;
      if (speed !== this.speed) { const pos = this.replayPos(); this.speed = speed; this.aT = now; this.aS = pos; }
      R.pos = this.replayPos();
      if (this.nextStep < R.rec.endStep) this.pump(now);
      return R.pos;
    }
    replayPos() { return this.aS + Math.max(0, this.ctx.currentTime - this.aT) / this.stepDur(); }
    replayStep(s, t) {
      const R = this.replay, list = R.byStep.get(s);
      if (!list) return;
      const sd = this.stepDur();
      const per = {};
      for (const e of list) {
        per[e[1]] = (per[e[1]] || 0) + 1;
        if (per[e[1]] > 4) continue;
        if (this.onNote) this.onNote(s, 5, e[1], e[2], e[3], e[4]);
        if (e[1] === 'drone') { this.play('droneNote', t, e[2], e[4] * sd, 0.5, this.sfx); continue; }
        const d = e[1] === 'ohno' || e[1] === 'letsgo' ? 0.6 : e[4] * sd;
        this.play(e[1], t, e[2], d, e[3], e[1] === 'ohno' || e[1] === 'letsgo' ? this.voiceBus : this.sfx, e[1] === 'exitChord' ? this.chordAt(s) : null);
      }
    }
    stopReplay() {
      if (!this.replay) return;
      this.replay = null; this.onNote = null;
      this.lastReplayLvl = -1;
    }
    silenceAll() {
      if (!this.ctx) return;
      this.killDrones(0.05);
      this.pend.length = 0;
      this.setStemLevel(0, true);
      this.pulseBus.gain.setValueAtTime(0, this.ctx.currentTime);
      this.aT = null;
    }

    /* ------------------------------------------------------------------ */
    /* Synth primitives                                                    */
    osc(type, f, t, dest) {
      const o = this.ctx.createOscillator();
      if (type === 'p12') o.setPeriodicWave(this.pulse12);
      else if (type === 'p25') o.setPeriodicWave(this.pulse25);
      else o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (dest) o.connect(dest);
      o.start(t);
      return o;
    }
    gain(v, dest) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
    filt(type, f, q, dest) {
      const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q;
      if (dest) b.connect(dest);
      return b;
    }
    nz(t, dur, dest) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
      s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
      return s;
    }
    perc(g, t, peak, dec) { // percussive envelope
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
    }
    adsr(g, t, a, peak, d, sus, dur, rel) {
      const p = g.gain, ta = t + a, td = Math.max(ta + 0.001, t + dur);
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(peak, ta);
      p.setTargetAtTime(peak * sus, ta, d / 3);
      p.setTargetAtTime(0, td, rel / 3);
      return td + rel * 2 + 0.05;
    }
    sweep(param, t, a, b, dur, exp) {
      param.setValueAtTime(a, t);
      if (exp) param.exponentialRampToValueAtTime(Math.max(1, b), t + dur);
      else param.linearRampToValueAtTime(b, t + dur);
    }
    vib(o, t, rate, cents, delay) {
      const l = this.ctx.createOscillator(), g = this.ctx.createGain();
      l.frequency.value = rate; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cents, t + (delay || 0.2));
      l.connect(g); g.connect(o.detune); l.start(t);
      return l;
    }
    stopAll(list, t) { for (const n of list) if (n && n.stop) n.stop(t); }

    /* Voice allocator + instrument dispatch. */
    play(name, t, m, d, v, out, extra) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (this.active.length > 32) this.active = this.active.filter((e) => e > now);
      if (this.active.length >= MAX_VOICES && out !== this.stemIn[0]) return;
      const fn = INST[name];
      if (!fn) return;
      const end = fn.call(this, t, m, d, v, out, extra);
      this.active.push(end || t + d + 0.3);
    }

    /* Formant vocals: a glottal saw through three moving band-pass filters. */
    speak(t, ph, pitch, v, out) {
      const ctx = this.ctx, k = 1.18; // lemming formants: small & high
      const src = this.osc('sawtooth', pitch[0][1], t);
      for (const [dt, f] of pitch) src.frequency.linearRampToValueAtTime(f, t + dt);
      const vib = this.vib(src, t, 6.5, 18, 0.05);
      const pre = this.gain(0, null); src.connect(pre);
      const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true; n.start(t);
      const ng = this.gain(0, null), nf = this.filt('highpass', 4000, 0.7, ng); n.connect(nf);
      const sum = this.gain(v, out);
      const bands = [0, 1, 2].map((i) => {
        const b = this.filt('bandpass', 500, [6, 9, 11][i]); const g = this.gain([1, 0.55, 0.25][i], sum);
        pre.connect(b); b.connect(g); return b;
      });
      ng.connect(sum);
      let tt = t;
      for (const p of ph) {
        for (let i = 0; i < 3; i++) bands[i].frequency.setTargetAtTime(p.f[i] * k, tt, 0.018);
        pre.gain.setTargetAtTime(p.g * 1.4, tt, 0.012);
        ng.gain.setTargetAtTime(p.n || 0, tt, 0.006);
        tt += p.d;
      }
      pre.gain.setTargetAtTime(0, tt, 0.03);
      ng.gain.setTargetAtTime(0, tt, 0.01);
      const end = tt + 0.25;
      src.stop(end); n.stop(end); vib.stop(end);
      return end;
    }
  }

  /* ======================================================================
   * INSTRUMENT RACK — each: (t, midi, durSec, vel, outNode, extra) -> endTime
   * ====================================================================== */
  const INST = {
    /* ---- drums ---- */
    chipKick(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('square', 220, t, this.filt('lowpass', 2500, 0.7, g));
      o.frequency.exponentialRampToValueAtTime(38, t + 0.09);
      this.perc(g, t, 0.45 * v, 0.14); o.stop(t + 0.16); return t + 0.16;
    },
    chipSnare(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.14, this.filt('highpass', 1400, 0.7, g)); this.perc(g, t, 0.3 * v, 0.13);
      const g2 = this.gain(0, out), o = this.osc('triangle', 190, t, g2); o.frequency.exponentialRampToValueAtTime(110, t + 0.06);
      this.perc(g2, t, 0.25 * v, 0.07); o.stop(t + 0.1); return t + 0.15;
    },
    chipHat(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.05, this.filt('highpass', 8000, 0.7, g)); this.perc(g, t, 0.14 * v, 0.035); return t + 0.06;
    },
    kick909(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('sine', 190, t, g);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.12); this.perc(g, t, 0.95 * v, 0.42);
      const c = this.gain(0, out); this.nz(t, 0.02, this.filt('highpass', 2500, 0.7, c)); this.perc(c, t, 0.18 * v, 0.012);
      o.stop(t + 0.45); return t + 0.45;
    },
    kick808(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('sine', 120, t, g);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.3); this.perc(g, t, 0.95 * v, 0.75);
      o.stop(t + 0.8); return t + 0.8;
    },
    clap(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.25, this.filt('bandpass', 1150, 1.3, g));
      const p = g.gain; p.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) { p.setValueAtTime(0.55 * v, t + i * 0.011); p.exponentialRampToValueAtTime(0.05, t + i * 0.011 + 0.009); }
      p.setValueAtTime(0.45 * v, t + 0.034); p.exponentialRampToValueAtTime(0.001, t + 0.22);
      return t + 0.25;
    },
    hat(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.06, this.filt('highpass', 7600, 1, g)); this.perc(g, t, 0.17 * v, 0.045); return t + 0.07;
    },
    hatOpen(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.32, this.filt('highpass', 7000, 1, g)); this.perc(g, t, 0.12 * v, 0.3); return t + 0.33;
    },
    gatedSnare(t, m, d, v, out) {
      const g = this.gain(0, out); const bp = this.filt('bandpass', 1800, 0.8, g); this.nz(t, 0.2, bp); this.perc(g, t, 0.45 * v, 0.18);
      const g2 = this.gain(0, out), o = this.osc('triangle', 200, t, g2); this.perc(g2, t, 0.3 * v, 0.08); o.stop(t + 0.1);
      const s = this.gain(0.6 * v, this.gate); g.connect(s);
      return t + 0.5;
    },
    snare(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.16, this.filt('bandpass', 2600, 0.7, g)); this.perc(g, t, 0.42 * v, 0.14);
      const g2 = this.gain(0, out), o = this.osc('triangle', 205, t, g2); this.perc(g2, t, 0.28 * v, 0.07); o.stop(t + 0.1);
      return t + 0.17;
    },
    brk(t, m, d, v, out, slice) {
      const s = this.ctx.createBufferSource(); s.buffer = this.brk;
      const g = this.gain(0, out); s.connect(g);
      const len = Math.min(this.sliceDur, d) + 0.004;
      g.gain.setValueAtTime(0.95 * v, t); g.gain.setValueAtTime(0.95 * v, t + len - 0.004); g.gain.linearRampToValueAtTime(0, t + len);
      s.start(t, (slice || 0) * this.sliceDur, len + 0.01); return t + len;
    },
    granCassa(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('sine', 68, t, g); o.frequency.exponentialRampToValueAtTime(46, t + 0.5);
      this.perc(g, t, 0.8 * v, 1.2); o.stop(t + 1.2);
      const g2 = this.gain(0, out); this.nz(t, 0.3, this.filt('lowpass', 160, 0.7, g2)); this.perc(g2, t, 0.5 * v, 0.3);
      return t + 1.2;
    },
    snareRoll(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, d + 0.1, this.filt('bandpass', 3300, 0.9, g));
      const p = g.gain; p.setValueAtTime(0, t);
      for (let x = 0; x < d; x += 0.034) { p.setValueAtTime(0.2 * v, t + x); p.exponentialRampToValueAtTime(0.02, t + x + 0.03); }
      p.setTargetAtTime(0, t + d, 0.02); return t + d + 0.1;
    },
    triangle(t, m, d, v, out) {
      for (const [f, a] of [[4186, 1], [5980, 0.6], [8110, 0.3]]) { const g = this.gain(0, out), o = this.osc('sine', f, t, g); this.perc(g, t, 0.05 * v * a, 1.1); o.stop(t + 1.1); }
      return t + 1.1;
    },
    cymbal(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 1.8, this.filt('highpass', 5200, 0.6, g)); this.perc(g, t, 0.2 * v, 1.7); return t + 1.8;
    },
    crash(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 1.4, this.filt('highpass', 4200, 0.6, g)); this.perc(g, t, 0.12 * v, 1.3); return t + 1.4;
    },
    timpani(t, m, d, v, out) {
      const f = mtof(m);
      const g = this.gain(0, out), o = this.osc('sine', f * 1.03, t, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      this.perc(g, t, 0.7 * v, 1.1);
      const g2 = this.gain(0, out), o2 = this.osc('sine', f * 1.5, t, g2); this.perc(g2, t, 0.18 * v, 0.45);
      const g3 = this.gain(0, out); this.nz(t, 0.1, this.filt('lowpass', 500, 0.7, g3)); this.perc(g3, t, 0.25 * v, 0.08);
      o.stop(t + 1.2); o2.stop(t + 0.5); return t + 1.2;
    },
    /* ---- bass ---- */
    chipBass(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('p25', mtof(m), t, this.filt('lowpass', 2400, 0.7, g));
      const e = this.adsr(g, t, 0.004, 0.3 * v, 0.1, 0.6, d * 0.9, 0.03); o.stop(e); return e;
    },
    acid(t, m, d, v, out, c) {
      const f = mtof(m), acc = c && c.acc;
      const g = this.gain(0, out), lp = this.filt('lowpass', 300, 15, null);
      const sh = this.ctx.createWaveShaper(); sh.curve = this.curve; lp.connect(sh); sh.connect(g);
      const o = this.osc('sawtooth', this.acidPrev && c && c.sld ? this.acidPrev : f, t, lp);
      if (this.acidPrev && c && c.sld) o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      const peak = acc ? 3200 : 1500;
      lp.frequency.setValueAtTime(peak, t); lp.frequency.exponentialRampToValueAtTime(260, t + (acc ? 0.28 : 0.18));
      const dd = c && c.sld ? d * 1.1 : d * 0.8;
      const e = this.adsr(g, t, 0.003, (acc ? 0.34 : 0.25) * v, 0.2, 0.8, dd, 0.02);
      o.stop(e); this.acidPrev = f; return e;
    },
    acidHi(t, m, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 3000, 10, g), o = this.osc('square', mtof(m), t, lp);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.1); this.perc(g, t, 0.05 * v, 0.12); o.stop(t + 0.13); return t + 0.13;
    },
    synthBass(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 2000, 4, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f, t, lp); a.detune.value = -7; b.detune.value = 7;
      lp.frequency.exponentialRampToValueAtTime(380, t + 0.2);
      const e = this.adsr(g, t, 0.004, 0.22 * v, 0.15, 0.7, d * 0.85, 0.04); a.stop(e); b.stop(e); return e;
    },
    sub(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('sine', f * 1.06, t, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const g2 = this.gain(0.06, g), o2 = this.osc('triangle', f * 2, t, g2);
      const e = this.adsr(g, t, 0.005, 0.5 * v, 0.2, 0.9, d, 0.06); o.stop(e); o2.stop(e); return e;
    },
    celli(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 1300, 1, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f * 1.003, t, lp), l = this.vib(a, t, 5.5, 8, 0.3);
      const e = this.adsr(g, t, 0.06, 0.2 * v, 0.2, 0.85, d, 0.2); a.stop(e); b.stop(e); l.stop(e); return e;
    },
    reese(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 700, 3, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f, t, lp); a.detune.value = -16; b.detune.value = 16;
      lp.frequency.linearRampToValueAtTime(1100, t + d * 0.5); lp.frequency.linearRampToValueAtTime(500, t + d);
      const e = this.adsr(g, t, 0.02, 0.16 * v, 0.2, 1, d, 0.08); a.stop(e); b.stop(e); return e;
    },
    /* ---- chords ---- */
    chipArp(t, ns, d, v, out) {
      const g = this.gain(0, out), o = this.osc('p12', mtof(ns[0] + 12), t, g);
      for (let x = 0, i = 0; x < d; x += 0.03, i++) o.frequency.setValueAtTime(mtof(ns[i % ns.length] + 12), t + x);
      const e = this.adsr(g, t, 0.004, 0.09 * v, 0.2, 0.7, d, 0.03); o.stop(e); return e;
    },
    stab(t, ns, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 2600, 3, g);
      const os = ns.map((n) => this.osc('sawtooth', mtof(n + 12), t, lp));
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.16); this.perc(g, t, 0.1 * v, 0.24);
      this.stopAll(os, t + 0.26); return t + 0.26;
    },
    pad(t, ns, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 1500, 0.7, g), os = [];
      for (const n of ns) for (const det of [-9, 9]) { const o = this.osc('sawtooth', mtof(n), t, lp); o.detune.value = det; os.push(o); }
      const e = this.adsr(g, t, 0.35, 0.05 * v, 0.3, 1, d, 0.7); this.stopAll(os, e); return e;
    },
    rhodes(t, ns, d, v, out) {
      let e = t;
      for (const n of ns) {
        const f = mtof(n), g = this.gain(0, out), c = this.osc('sine', f, t, g);
        const mg = this.gain(0, c.frequency), mo = this.osc('sine', f, t, mg);
        mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.15 + 1, t + 0.7);
        e = this.adsr(g, t, 0.003, 0.08 * v, 0.9, 0.35, d, 0.3); c.stop(e); mo.stop(e);
      }
      return e;
    },
    strings(t, ns, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 2600, 0.6, g), os = [];
      for (const n of ns) for (const det of [-10, 0, 10]) { const o = this.osc('sawtooth', mtof(n), t, lp); o.detune.value = det; os.push(o); }
      const l = this.vib(os[1], t, 5, 6, 0.4);
      const e = this.adsr(g, t, 0.3, 0.035 * v, 0.3, 1, d, 0.6); this.stopAll(os, e); l.stop(e); return e;
    },
    /* ---- leads ---- */
    chipLead(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('p25', mtof(m), t, g), l = this.vib(o, t, 6, 16, 0.18);
      const e = this.adsr(g, t, 0.004, 0.13 * v, 0.12, 0.7, d, 0.05); o.stop(e); l.stop(e); return e;
    },
    fmLead(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), c = this.osc('sine', f, t, g);
      const mg = this.gain(0, c.frequency), mo = this.osc('sine', f * 2, t, mg);
      mg.gain.setValueAtTime(f * 4, t); mg.gain.exponentialRampToValueAtTime(f * 0.8, t + 0.25);
      const e = this.adsr(g, t, 0.005, 0.15 * v, 0.2, 0.7, d, 0.1); c.stop(e); mo.stop(e); return e;
    },
    sawLead(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 3400, 2, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f, t, lp); a.detune.value = -7; b.detune.value = 7;
      const l = this.vib(a, t, 5.5, 14, 0.25);
      const e = this.adsr(g, t, 0.01, 0.1 * v, 0.2, 0.8, d, 0.15); a.stop(e); b.stop(e); l.stop(e); return e;
    },
    flute(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('sine', f, t, g), o2 = this.osc('triangle', f * 2, t, this.gain(0.08, g));
      const l = this.vib(o, t, 5, 14, 0.2);
      const ng = this.gain(0.05, g); this.nz(t, d + 0.3, this.filt('bandpass', f * 2, 4, ng));
      const e = this.adsr(g, t, 0.06, 0.16 * v, 0.2, 0.85, d, 0.12); o.stop(e); o2.stop(e); l.stop(e); return e;
    },
    brass(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 500, 1.5, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f * 1.004, t, lp), l = this.vib(a, t, 5, 10, 0.3);
      lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.09); lp.frequency.setTargetAtTime(1700, t + 0.09, 0.1);
      const e = this.adsr(g, t, 0.05, 0.12 * v, 0.2, 0.8, d, 0.15); a.stop(e); b.stop(e); l.stop(e); return e;
    },
    /* ---- full-mix arps ---- */
    chipArpHi(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('p12', mtof(m), t, g); this.perc(g, t, 0.06 * v, 0.07); o.stop(t + 0.08); return t + 0.08;
    },
    synthArp(t, m, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 4000, 3, g), o = this.osc('sawtooth', mtof(m), t, lp);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.15); this.perc(g, t, 0.055 * v, 0.18); o.stop(t + 0.2); return t + 0.2;
    },
    celesta(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('sine', f, t, g), o2 = this.osc('sine', f * 4, t, this.gain(0.3, g));
      this.perc(g, t, 0.07 * v, 0.7); o.stop(t + 0.7); o2.stop(t + 0.7); return t + 0.7;
    },
    /* ---- footsteps (one timbre per world) ---- */
    chipBlip(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('p25', f, t, g); o.frequency.setValueAtTime(f * 1.5, t + 0.012); o.frequency.setValueAtTime(f, t + 0.024);
      this.perc(g, t, 0.14 * v, 0.07); o.stop(t + 0.08); return t + 0.08;
    },
    fmPluck(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), c = this.osc('sine', f, t, g), mg = this.gain(0, c.frequency), mo = this.osc('sine', f * 3.5, t, mg);
      mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.08);
      this.perc(g, t, 0.17 * v, 0.15); c.stop(t + 0.16); mo.stop(t + 0.16); return t + 0.16;
    },
    synthPluck(t, m, d, v, out) {
      const g = this.gain(0, out), lp = this.filt('lowpass', 3200, 4, g), o = this.osc('sawtooth', mtof(m), t, lp);
      lp.frequency.exponentialRampToValueAtTime(300, t + 0.1); this.perc(g, t, 0.13 * v, 0.16); o.stop(t + 0.17); return t + 0.17;
    },
    marimba(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('sine', f, t, g);
      const g2 = this.gain(0, out), o2 = this.osc('sine', f * 4, t, g2);
      this.perc(g, t, 0.26 * v, 0.25); this.perc(g2, t, 0.07 * v, 0.05); o.stop(t + 0.26); o2.stop(t + 0.06); return t + 0.26;
    },
    pizz(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 1600, 1, g);
      const o = this.osc('sawtooth', f, t, lp), o2 = this.osc('triangle', f, t, g);
      lp.frequency.exponentialRampToValueAtTime(400, t + 0.15); this.perc(g, t, 0.16 * v, 0.2); o.stop(t + 0.21); o2.stop(t + 0.21); return t + 0.21;
    },
    steelTick(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.03, this.filt('highpass', 5000, 1, g)); this.perc(g, t, 0.1 * v, 0.025);
      const g2 = this.gain(0, out), o = this.osc('square', 2400, t, g2); this.perc(g2, t, 0.03 * v, 0.02); o.stop(t + 0.03);
      return t + 0.04;
    },
    /* ---- skills as instruments ---- */
    pluck(t, m, d, v, out) { // climber
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 5200, 1, g);
      const o = this.osc('sawtooth', f, t, lp), o2 = this.osc('sine', f * 2, t, this.gain(0.4, g));
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.3); this.perc(g, t, 0.2 * v, 0.45); o.stop(t + 0.46); o2.stop(t + 0.46); return t + 0.46;
    },
    floatPad(t, m, d, v, out) { // floater: slow swell
      const g = this.gain(0, out), lp = this.filt('lowpass', 400, 2, g), os = [];
      for (const k of [0, 7, 12, 16]) { const o = this.osc(k === 16 ? 'sine' : 'triangle', mtof(m + k), t, lp); o.detune.value = (k % 5) * 3; os.push(o); }
      lp.frequency.exponentialRampToValueAtTime(2600, t + d * 0.5); lp.frequency.exponentialRampToValueAtTime(600, t + d);
      const e = this.adsr(g, t, d * 0.3, 0.07 * v, 0.3, 1, d * 0.8, 0.8); this.stopAll(os, e); return e;
    },
    brick(t, m, d, v, out) { // builder: FM bell arpeggio
      const f = mtof(m), g = this.gain(0, out), c = this.osc('sine', f, t, g), mg = this.gain(0, c.frequency), mo = this.osc('sine', f * 3.01, t, mg);
      mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.5);
      const g2 = this.gain(0, out), sq = this.osc('square', f, t, this.filt('lowpass', 3000, 0.7, g2));
      this.perc(g, t, 0.2 * v, 0.6); this.perc(g2, t, 0.035 * v, 0.05);
      c.stop(t + 0.62); mo.stop(t + 0.62); sq.stop(t + 0.06); return t + 0.62;
    },
    bassSweep(t, m, d, v, out) { // basher: filtered bass sweep
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 200, 11, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f * 1.01, t, lp);
      lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1800, t + d * 0.45); lp.frequency.exponentialRampToValueAtTime(200, t + d);
      const e = this.adsr(g, t, 0.01, 0.2 * v, 0.2, 0.9, d, 0.05); a.stop(e); b.stop(e); return e;
    },
    mineClick(t, m, d, v, out) { // miner: syncopated clicks
      const f = mtof(m), g = this.gain(0, out); this.nz(t, 0.04, this.filt('bandpass', Math.min(9000, f * 3), 8, g)); this.perc(g, t, 0.5 * v, 0.035);
      const g2 = this.gain(0, out), o = this.osc('sine', f, t, g2); this.perc(g2, t, 0.12 * v, 0.05); o.stop(t + 0.06);
      return t + 0.07;
    },
    clank(t, m, d, v, out) {
      const g = this.gain(0, out), c = this.osc('sine', 880, t, g), mg = this.gain(1400, c.frequency), mo = this.osc('sine', 880 * 1.41, t, mg);
      this.perc(g, t, 0.13 * v, 0.3); c.stop(t + 0.31); mo.stop(t + 0.31); return t + 0.31;
    },
    boom(t, m, d, v, out) { // bomber: explosion + crash cymbal
      const g = this.gain(0, out), o = this.osc('sine', 110, t, g); o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      this.perc(g, t, 0.8 * v, 0.7); o.stop(t + 0.7);
      const g2 = this.gain(0, out); this.nz(t, 0.6, this.filt('lowpass', 900, 0.7, g2)); this.perc(g2, t, 0.6 * v, 0.55);
      INST.crash.call(this, t, 0, d, 1.4 * v, out);
      return t + 1.4;
    },
    exitChord(t, m, d, v, out, chord) { // exit: rising chord
      const ch = chord || [0, 4, 7], root = m - (((ch[0] % 12) + 12) % 12) + ch[0];
      const notes = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12].map((k) => root - ch[0] + k);
      notes.forEach((n, i) => INST.brick.call(this, t + i * 0.045, n, 0.3, v * 0.7, out));
      const g = this.gain(0, out), os = notes.slice(0, 3).map((n) => this.osc('triangle', mtof(n + 12), t + 0.2, g));
      const e = this.adsr(g, t + 0.2, 0.02, 0.05 * v, 0.2, 0.5, 0.3, 0.3); this.stopAll(os, e); return e;
    },
    sparkle(t, m, d, v, out) { // groove bonus
      const w = this.world, base = w.scale.indexOf(((m - w.root) % 12 + 12) % 12);
      for (let i = 0; i < 5; i++) {
        const n = BT.degToMidi(w, Math.max(0, base) + i, Math.floor((m - w.root) / 12)), f = mtof(n + 12), tt = t + i * 0.035;
        const g = this.gain(0, out), o = this.osc('sine', f, tt, g), o2 = this.osc('sine', f * 2, tt, this.gain(0.3, g));
        this.perc(g, tt, 0.08 * v, 0.25); o.stop(tt + 0.26); o2.stop(tt + 0.26);
      }
      return t + 0.45;
    },
    shrug(t, m, d, v, out) {
      const f = mtof(m), g = this.gain(0, out), o = this.osc('triangle', f, t, g); o.frequency.setValueAtTime(f * 0.8, t + 0.07);
      this.perc(g, t, 0.12 * v, 0.16); o.stop(t + 0.17); return t + 0.17;
    },
    splat(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.14, this.filt('lowpass', 700, 1, g)); this.perc(g, t, 0.45 * v, 0.12);
      const g2 = this.gain(0, out), o = this.osc('sine', 150, t, g2); o.frequency.exponentialRampToValueAtTime(45, t + 0.14); this.perc(g2, t, 0.4 * v, 0.15); o.stop(t + 0.16);
      return t + 0.16;
    },
    drown(t, m, d, v, out) {
      for (let i = 0; i < 6; i++) {
        const tt = t + i * 0.07 + Math.random() * 0.03, g = this.gain(0, out), o = this.osc('sine', 280 + Math.random() * 200, tt, g);
        o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 400, tt + 0.05); this.perc(g, tt, 0.1 * v, 0.06); o.stop(tt + 0.07);
      }
      return t + 0.55;
    },
    burn(t, m, d, v, out) {
      const g = this.gain(0, out), bp = this.filt('bandpass', 800, 2, g); this.nz(t, 0.6, bp);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 0.5); this.perc(g, t, 0.22 * v, 0.55); return t + 0.6;
    },
    crush(t, m, d, v, out) {
      const g = this.gain(0, out); this.nz(t, 0.35, this.filt('lowpass', 1200, 0.7, g)); this.perc(g, t, 0.5 * v, 0.3);
      const g2 = this.gain(0, out), o = this.osc('square', 82, t, this.filt('lowpass', 600, 1, g2)); this.perc(g2, t, 0.3 * v, 0.2); o.stop(t + 0.22);
      INST.clank.call(this, t, 0, d, v, out); return t + 0.35;
    },
    fallout(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('sine', 1300, t, g); o.frequency.exponentialRampToValueAtTime(180, t + 0.6);
      this.perc(g, t, 0.06 * v, 0.65); o.stop(t + 0.66); return t + 0.66;
    },
    hatch(t, m, d, v, out) {
      const g = this.gain(0, out), bp = this.filt('bandpass', 400, 3, g); this.nz(t, 0.5, bp);
      bp.frequency.exponentialRampToValueAtTime(1600, t + 0.4); this.perc(g, t, 0.18 * v, 0.45);
      const g2 = this.gain(0, out), o = this.osc('square', 70, t, this.filt('lowpass', 400, 4, g2)); o.frequency.linearRampToValueAtTime(95, t + 0.4);
      this.perc(g2, t, 0.06 * v, 0.45); o.stop(t + 0.46); return t + 0.5;
    },
    uiTick(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('square', mtof(m), t, this.filt('lowpass', 5000, 0.7, g)); this.perc(g, t, 0.05 * v, 0.03); o.stop(t + 0.04); return t + 0.04;
    },
    nukeAlarm(t, m, d, v, out) {
      const g = this.gain(0, out), o = this.osc('sawtooth', 600, t, this.filt('lowpass', 2500, 1, g));
      for (let x = 0; x < d; x += 0.12) o.frequency.setValueAtTime((x / 0.12) & 1 ? 900 : 600, t + x);
      const e = this.adsr(g, t, 0.01, 0.07 * v, 0.1, 1, d, 0.05); o.stop(e); return e;
    },
    stemRiser(t, m, d, v, out) {
      const g = this.gain(0, out), bp = this.filt('bandpass', 400, 2, g); this.nz(t, d + 0.1, bp);
      bp.frequency.exponentialRampToValueAtTime(7000, t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * v, t + d * 0.9); g.gain.linearRampToValueAtTime(0, t + d);
      return t + d + 0.1;
    },
    droneNote(t, m, d, v, out) { // replay rendition of a blocker drone
      const f = mtof(m), g = this.gain(0, out), lp = this.filt('lowpass', 520, 4, g);
      const a = this.osc('sawtooth', f, t, lp), b = this.osc('sawtooth', f * 1.005, t, lp);
      const e = this.adsr(g, t, 0.1, 0.05 * v, 0.2, 1, d, 0.2); a.stop(e); b.stop(e); return e;
    },
    ohno(t, m, d, v, out) { // "Oh no!"
      return this.speak(t, [
        { d: 0.16, f: [450, 800, 2830], g: 1 },   // o
        { d: 0.05, f: [350, 600, 2700], g: 0.8 }, // o -> u glide
        { d: 0.06, f: [250, 1700, 2600], g: 0.25 }, // n (nasal dip)
        { d: 0.2, f: [480, 820, 2830], g: 1 },    // o
        { d: 0.08, f: [360, 640, 2700], g: 0.7 },
      ], [[0, 330], [0.12, 390], [0.2, 300], [0.3, 420], [0.55, 280]], 0.9 * v, out);
    },
    letsgo(t, m, d, v, out) { // "Let's go!"
      return this.speak(t, [
        { d: 0.05, f: [360, 1300, 2700], g: 0.35 }, // l
        { d: 0.11, f: [530, 1840, 2480], g: 1 },    // e
        { d: 0.03, f: [400, 1700, 2600], g: 0 },    // t (closure)
        { d: 0.08, f: [400, 1700, 2600], g: 0, n: 0.35 }, // s
        { d: 0.04, f: [300, 1000, 2400], g: 0.15 }, // g
        { d: 0.24, f: [470, 820, 2830], g: 1 },     // o
        { d: 0.08, f: [360, 640, 2700], g: 0.6 },
      ], [[0, 300], [0.12, 330], [0.3, 360], [0.45, 420], [0.62, 300]], 0.9 * v, out);
    },
  };
  BT.INST = INST;
  BT.Audio = Audio;
  BT.audio = new Audio();
})(typeof window !== 'undefined' ? window : globalThis);
