/* =====================================================================
   Lemmings: Beat Tribe — audio engine (audio.js)
   Web Audio tracker + synthesizer. 100% code-generated sound:
   - lookahead scheduler (AudioContext.currentTime based, never setTimeout-timed notes)
   - 5 stem groups (DRUMS, BASS, CHORDS, LEAD, FULL) with gain fades
   - 64-step patterns with pattern chaining, generated per genre world
   - FM/subtractive leads, resonant acid bass, detuned pads, noise drums,
     formant "Oh no!" / "Let's go!" vocals, stereo ping-pong delay, compressor, analyser
   - quantized lemming note events with voice limiting + velocity scaling
   - records the composed song for the results-screen replay
   ===================================================================== */
(function (root) {
  'use strict';
  var BT = root.BT;
  var STEMS = ['drums', 'bass', 'chords', 'lead', 'full'];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ------------------------------------------------------------------ */
  /* Song generation: per-world 64-step patterns (deterministic)         */
  /* ------------------------------------------------------------------ */
  var PROGS = [
    [1, 4, 2, 5],   // chip (pentatonic stacks)
    [1, 2, 1, 7],   // phrygian: i, bII, i, bVII
    [1, 4, 2, 7],   // dorian: i, IV, ii, bVII
    [1, 4, 3, 5],   // minor pentatonic
    [1, 2, 5, 1]    // lydian: I, II, V, I
  ];
  function triad(world, deg, oct) {
    return [BT.degreeToMidi(world, deg, oct), BT.degreeToMidi(world, deg + 2, oct), BT.degreeToMidi(world, deg + 4, oct)];
  }
  function buildSong(wi) {
    var world = BT.WORLDS[wi], rng = BT.makeRng(1234 + wi * 97), prog = PROGS[wi];
    var pats = { drums: [], bass: [], chords: [], lead: [], full: [] };
    for (var v = 0; v < 2; v++) {
      var D = [], B = [], C = [], Ld = [], F = [], r, s, chordDeg, bar;
      for (r = 0; r < 64; r++) { D.push(null); B.push(null); C.push(null); Ld.push(null); F.push(null); }
      for (r = 0; r < 64; r++) {
        s = r % 16; bar = (r / 16) | 0; chordDeg = prog[bar];
        var fill = (r >= 60 && v === 1);
        // ---- drums ----
        var d = [];
        if (wi === 0) { if (s === 0 || s === 8 || (s === 11 && v)) d.push(['kick', 1]); if (s === 4 || s === 12) d.push(['snare', 1]); if (s % 2 === 0) d.push(['hat', s % 4 ? 0.4 : 0.7]); }
        else if (wi === 1) { if (s % 4 === 0) d.push(['kick', 1]); if (s % 4 === 2) d.push(['ohat', 0.6]); if (s === 4 || s === 12) d.push(['clap', 0.9]); if (s % 2 === 1) d.push(['hat', 0.3]); }
        else if (wi === 2) { if (s === 0 || s === 8 || s === 10) d.push(['kick', 1]); if (s === 4 || s === 12) d.push(['gsnare', 1]); if (s % 2 === 0) d.push(['hat', 0.5]); if (s === 14 && v) d.push(['tom', 0.8]); }
        else if (wi === 3) { if (s === 0 || s === 10 || (s === 6 && v)) d.push(['kick', 1]); if (s === 4 || s === 12) d.push(['snare', 1]); if (s === 7 || s === 15 || s === 9) d.push(['snare', 0.35]); d.push(['hat', s % 4 === 2 ? 0.7 : 0.3]); if (s === 13 && rng() < 0.5) d.push(['ride', 0.5]); }
        else { if (s === 0 || s === 8) d.push(['timp', 1]); if (s === 12 && bar % 2 === 1) d.push(['timp', 0.7]); if (r === 0) d.push(['crash', 0.8]); if (s === 4 || s === 12) d.push(['snare', 0.5]); if (s % 2 === 1 && bar === 3) d.push(['snare', 0.25]); }
        if (fill) d.push(['snare', 0.8]);
        if (d.length) D[r] = d;
        // ---- bass ----
        var root = BT.degreeToMidi(world, chordDeg, -2);
        if (wi === 0) { if (s % 2 === 0) B[r] = { n: root + (s % 8 === 6 ? 12 : 0), v: 0.8, len: 1 }; }
        else if (wi === 1) { if (s % 2 === 0 || rng() < 0.3) B[r] = { n: root + (s % 4 === 2 ? 12 : 0) + (s === 14 ? 3 : 0), v: s % 4 === 0 ? 1 : 0.6, len: 1, acc: s % 4 === 0, slide: s === 15 }; }
        else if (wi === 2) { if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) B[r] = { n: root, v: 0.9, len: 2 }; }
        else if (wi === 3) { if (s === 0) B[r] = { n: root, v: 1, len: 6 }; if (s === 10) B[r] = { n: root + (bar === 1 ? -2 : 0), v: 0.8, len: 4 }; }
        else { if (s % 4 === 0) B[r] = { n: root, v: 0.9, len: 2 }; if (s === 14) B[r] = { n: root + 7, v: 0.6, len: 1 }; }
        // ---- chords ----
        var tri = triad(world, chordDeg, 0);
        if (wi === 0) { if (s % 4 === 2) C[r] = { ns: tri, v: 0.5, len: 1 }; }
        else if (wi === 1) { if (s === 3 || s === 11 || (s === 14 && v)) C[r] = { ns: tri, v: 0.45, len: 1 }; }
        else if (wi === 2) { if (s === 0) C[r] = { ns: tri.concat([tri[0] + 12]), v: 0.4, len: 16 }; }
        else if (wi === 3) { if (s === 7 || s === 15) C[r] = { ns: tri, v: 0.4, len: 1 }; }
        else { if (s === 0) C[r] = { ns: tri.concat([tri[0] - 12]), v: 0.5, len: 16 }; }
        // ---- lead ---- (motif based, with variations)
        var mel = world.melody, mi = ((r >> 1) + v * 3) % mel.length;
        var leadOn = (wi === 2 || wi === 4) ? (s % 4 === 0 || s === 6 || s === 10) : (s % 2 === 0 && rng() < 0.75);
        if (leadOn && !(bar === 3 && s >= 12 && v === 0)) {
          var deg = mel[mi] + (rng() < 0.15 ? 2 : 0);
          Ld[r] = { n: BT.degreeToMidi(world, deg, wi === 3 ? 0 : 1), v: 0.55 + 0.2 * (s % 4 === 0), len: (wi === 2 || wi === 4) ? 3 : 1 };
        }
        // ---- full mix layer ----
        if (wi === 0 || wi === 2) { F[r] = { n: tri[s % 3] + 12 + (s % 6 >= 3 ? 12 : 0), v: 0.35, len: 1 }; }
        else if (wi === 1) { if (s % 2 === 1) F[r] = { n: root + 24 + [0, 3, 7, 10][(s >> 1) % 4], v: 0.35, len: 1 }; }
        else if (wi === 3) { if (s === 2 || s === 5 || s === 11 || s === 13) F[r] = { n: tri[(s * 7) % 3] + 12, v: 0.4, len: 1 }; }
        else { if (s === 0 || s === 8) F[r] = { n: tri[(bar + s / 8) % 3] + 12, v: 0.5, len: 6 }; if (s === 12) F[r] = { n: tri[2] + 12, v: 0.4, len: 2 }; }
      }
      pats.drums.push(D); pats.bass.push(B); pats.chords.push(C); pats.lead.push(Ld); pats.full.push(F);
    }
    return { world: wi, bpm: world.bpm, patterns: pats, order: [0, 0, 1, 0, 1, 1] };
  }

  /* ------------------------------------------------------------------ */
  /* Engine                                                              */
  /* ------------------------------------------------------------------ */
  function AudioEngine() {
    this.ctx = null; this.ready = false; this.muted = false;
    this.song = null; this.worldIndex = 0; this.bpm = 120; this.secPerBeat = 0.5;
    this.anchorTime = 0; this.anchorBeat = 0; this.speed = 1; this.lastSyncTime = 0; this.lastSyncBeat = 0;
    this.nextRow = 0; this.queue = []; this.recording = []; this.recordOn = false;
    this.unlocked = 0; this.stemMute = [0, 0, 0, 0, 0]; this.stemSolo = [0, 0, 0, 0, 0];
    this.drones = {}; this.rowLoad = {}; this.lastRowPlayed = -1; this.currentRow = 0;
    this.scopeBuf = null; this.specBuf = null; this.timer = null;
    this.musicVol = 0.8; this.sfxVol = 0.9;
  }
  AudioEngine.prototype.init = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    var ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 18; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.22;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.6;
    this.master.connect(this.comp); this.comp.connect(this.analyser); this.analyser.connect(ctx.destination);
    // stereo ping-pong delay bus
    this.delayIn = ctx.createGain(); this.delayIn.gain.value = 1;
    this.dL = ctx.createDelay(2); this.dR = ctx.createDelay(2);
    var fbL = ctx.createGain(), fbR = ctx.createGain(); fbL.gain.value = 0.32; fbR.gain.value = 0.32;
    var dampL = ctx.createBiquadFilter(), dampR = ctx.createBiquadFilter(); dampL.type = dampR.type = 'lowpass'; dampL.frequency.value = dampR.frequency.value = 3200;
    this.delayIn.connect(this.dL); this.dL.connect(dampL); dampL.connect(fbL); fbL.connect(this.dR); this.dR.connect(dampR); dampR.connect(fbR); fbR.connect(this.dL);
    var panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null, panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panL) { panL.pan.value = -0.75; panR.pan.value = 0.75; this.dL.connect(panL); panL.connect(this.master); this.dR.connect(panR); panR.connect(this.master); }
    else { this.dL.connect(this.master); this.dR.connect(this.master); }
    // stem busses
    this.stemGain = []; this.stemSend = [];
    for (var i = 0; i < 5; i++) {
      var g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); this.stemGain.push(g);
      var sd = ctx.createGain(); sd.gain.value = [0.05, 0.02, 0.25, 0.3, 0.3][i]; sd.connect(this.delayIn); this.stemSend.push(sd);
    }
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.sfxSend = ctx.createGain(); this.sfxSend.gain.value = 0.22; this.sfxSend.connect(this.delayIn);
    this.droneBus = ctx.createGain(); this.droneBus.gain.value = 0.5; this.droneBus.connect(this.master);
    // noise buffer
    var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    var seed = 12345; for (var n = 0; n < len; n++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[n] = (seed / 4294967296) * 2 - 1; }
    this.noiseBuf = buf;
    this.scopeBuf = new Uint8Array(this.analyser.fftSize); this.specBuf = new Uint8Array(this.analyser.frequencyBinCount);
    this.ready = true;
    var self = this; this.timer = setInterval(function () { self.tick(); }, 20);
  };
  AudioEngine.prototype.setMuted = function (m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02); };

  /* ---- clock ---- */
  AudioEngine.prototype.beatToTime = function (beat) { return this.anchorTime + (beat - this.anchorBeat) * this.secPerBeat / Math.max(this.speed, 1e-6); };
  AudioEngine.prototype.sync = function (beat, speed) { // called every frame by the game
    if (!this.ready) return;
    var now = this.ctx.currentTime;
    if (speed !== this.speed || this.speed === 0) { this.anchorTime = now; this.anchorBeat = beat; this.speed = speed; }
    else if (speed > 0) { var exp = this.beatToTime(beat); if (Math.abs(exp - now) > 0.045) { this.anchorTime = now; this.anchorBeat = beat; } }
    this.lastSyncTime = now; this.lastSyncBeat = beat;
  };
  AudioEngine.prototype.nowBeat = function () {
    if (!this.ready) return 0;
    return this.lastSyncBeat + (this.speed > 0 ? (this.ctx.currentTime - this.lastSyncTime) / this.secPerBeat * this.speed : 0);
  };

  /* ---- song control ---- */
  AudioEngine.prototype.startSong = function (worldIndex, startBeat, unlocked, record) {
    this.worldIndex = worldIndex; this.song = buildSong(worldIndex);
    this.bpm = this.song.bpm; this.secPerBeat = 60 / this.bpm;
    this.nextRow = Math.floor((startBeat || 0) * 4); this.queue = []; this.rowLoad = {};
    this.recording = []; this.recordOn = !!record; this.unlocked = unlocked || 0;
    this.stemMute = [0, 0, 0, 0, 0]; this.stemSolo = [0, 0, 0, 0, 0];
    this.stopDrones();
    if (this.ready) {
      this.anchorTime = this.ctx.currentTime; this.anchorBeat = startBeat || 0; this.speed = 1; this.lastSyncTime = this.anchorTime; this.lastSyncBeat = startBeat || 0;
      var dt = this.secPerBeat * 0.75; this.dL.delayTime.setValueAtTime(dt, this.ctx.currentTime); this.dR.delayTime.setValueAtTime(dt * 1.0, this.ctx.currentTime);
      this.applyStemGains(true);
    }
  };
  AudioEngine.prototype.stopSong = function () { this.song = null; this.queue = []; this.stopDrones(); };
  AudioEngine.prototype.setUnlocked = function (n) { this.unlocked = n; this.applyStemGains(false); };
  AudioEngine.prototype.toggleMute = function (i) { this.stemMute[i] = this.stemMute[i] ? 0 : 1; this.applyStemGains(false); };
  AudioEngine.prototype.toggleSolo = function (i) { this.stemSolo[i] = this.stemSolo[i] ? 0 : 1; this.applyStemGains(false); };
  AudioEngine.prototype.stemActive = function (i) {
    var anySolo = this.stemSolo.some(function (s) { return s; });
    return i < this.unlocked && !this.stemMute[i] && (!anySolo || this.stemSolo[i]);
  };
  AudioEngine.prototype.applyStemGains = function (instant) {
    if (!this.ready) return;
    var t = this.ctx.currentTime;
    for (var i = 0; i < 5; i++) {
      var target = this.stemActive(i) ? [0.9, 0.8, 0.6, 0.7, 0.55][i] * this.musicVol : 0;
      if (instant) this.stemGain[i].gain.setValueAtTime(target, t); else this.stemGain[i].gain.setTargetAtTime(target, t, 0.35);
    }
  };

  /* ---- scheduler ---- */
  AudioEngine.prototype.tick = function () {
    if (!this.ready || this.speed <= 0) return;
    var horizon = this.nowBeat() + 0.22 / this.secPerBeat * this.speed;
    if (this.song) {
      var guard = 0;
      while (this.nextRow / 4 < horizon && guard++ < 64) { this.scheduleRow(this.nextRow, this.beatToTime(this.nextRow / 4)); this.nextRow++; }
      if (this.nextRow / 4 < horizon - 2) this.nextRow = Math.floor(horizon * 4); // we fell far behind (tab hidden): skip
    }
    while (this.queue.length && this.queue[0].b < horizon) {
      var ev = this.queue.shift();
      if (ev.b < this.nowBeat() - 0.5) continue;
      this.playEvent(ev, this.beatToTime(ev.b));
    }
    this.currentRow = Math.floor(this.nowBeat() * 4);
  };
  AudioEngine.prototype.scheduleRow = function (row, t) {
    var song = this.song, pats = song.patterns, wi = song.world;
    var pi = song.order[Math.floor(row / 64) % song.order.length], r = ((row % 64) + 64) % 64;
    var rowDur = this.secPerBeat / 4 / this.speed;
    if (this.stemActive(0) && pats.drums[pi][r]) { var ds = pats.drums[pi][r]; for (var i = 0; i < ds.length; i++) this.drum(ds[i][0], t, ds[i][1], 0); }
    var b = pats.bass[pi][r]; if (b && this.stemActive(1)) this.inst('bass', wi, t, b.n, b.v, b.len * rowDur, 1, b);
    var c = pats.chords[pi][r]; if (c && this.stemActive(2)) for (var k = 0; k < c.ns.length; k++) this.inst('chord', wi, t + k * 0.004, c.ns[k], c.v, c.len * rowDur, 2);
    var l = pats.lead[pi][r]; if (l && this.stemActive(3)) this.inst('lead', wi, t, l.n, l.v, l.len * rowDur, 3);
    var f = pats.full[pi][r]; if (f && this.stemActive(4)) this.inst('full', wi, t, f.n, f.v, f.len * rowDur, 4);
  };
  /* Rows of the live pattern for the mixer overlay: returns {row, cells:[5][n]} around current row */
  AudioEngine.prototype.patternView = function (span) {
    var out = [], song = this.song; if (!song) return out;
    var cur = this.currentRow;
    for (var dr = -span; dr <= span; dr++) {
      var row = cur + dr; if (row < 0) { out.push(null); continue; }
      var pi = song.order[Math.floor(row / 64) % song.order.length], r = row % 64, cells = [];
      var d = song.patterns.drums[pi][r]; cells.push(d ? d.map(function (x) { return x[0].slice(0, 2).toUpperCase(); }).join('') : '--');
      var b = song.patterns.bass[pi][r]; cells.push(b ? noteName(b.n) : '---');
      var c = song.patterns.chords[pi][r]; cells.push(c ? noteName(c.ns[0]) + '+' : '---');
      var l = song.patterns.lead[pi][r]; cells.push(l ? noteName(l.n) : '---');
      var f = song.patterns.full[pi][r]; cells.push(f ? noteName(f.n) : '---');
      out.push({ row: row, r: r, pat: pi, cells: cells });
    }
    return out;
  };
  var NN = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  function noteName(m) { return NN[((m % 12) + 12) % 12] + Math.floor(m / 12 - 1); }

  /* ---- lemming events: quantized to the song clock ---- */
  // Quantize a sim beat to the next 1/16 (or 1/8 for grid=2) step.
  AudioEngine.prototype.quantize = function (beat, grid) {
    var div = grid === 2 ? 2 : 4;
    return Math.ceil(beat * div - 1e-6) / div;
  };
  AudioEngine.prototype.event = function (type, params, beat) {
    if (!this.ready) return;
    var q, ev;
    switch (type) {
      case 'step': if (!params.degree || params.muted) return; q = this.quantize(beat, 4);
        ev = { b: q, k: 'step', n: BT.degreeToMidi(BT.WORLDS[this.worldIndex], params.degree, params.oct), v: 0.6 }; break;
      case 'brick': q = this.quantize(beat, 4); ev = { b: q, k: 'brick', n: BT.degreeToMidi(BT.WORLDS[this.worldIndex], params.degree, 1), v: 0.7 }; break;
      case 'climb': q = this.quantize(beat, 4); ev = { b: q, k: 'climb', n: BT.degreeToMidi(BT.WORLDS[this.worldIndex], params.degree, 2), v: 0.5 }; break;
      case 'bash': q = this.quantize(beat, 2); ev = { b: q, k: 'bash', n: BT.degreeToMidi(BT.WORLDS[this.worldIndex], params.degree || 1, -2), v: 0.8 }; break;
      case 'mine': q = this.quantize(beat, 4); ev = { b: q, k: 'mine', v: params.accent ? 0.9 : 0.5 }; break;
      case 'dig': q = this.quantize(beat, 2); ev = { b: q, k: params.snare ? 'snare' : 'kick', v: 0.9 }; break;
      case 'float': q = this.quantize(beat, 2); ev = { b: q, k: 'float', n: BT.degreeToMidi(BT.WORLDS[this.worldIndex], 1, 0), v: 0.5 }; break;
      case 'exit': q = this.quantize(beat, 4); ev = { b: q, k: 'exit', v: 0.8 }; break;
      case 'sparkle': ev = { b: beat, k: 'sparkle', v: 0.6 }; break;
      case 'ohno': ev = { b: beat, k: 'ohno', v: 1 }; break;
      case 'explode': ev = { b: beat, k: 'explode', v: 1 }; break;
      case 'letsgo': ev = { b: beat, k: 'letsgo', v: 1 }; break;
      case 'splat': ev = { b: beat, k: 'splat', v: 0.8 }; break;
      case 'drown': ev = { b: beat, k: 'drown', v: 0.7 }; break;
      case 'burn': ev = { b: beat, k: 'burn', v: 0.7 }; break;
      case 'clank': ev = { b: beat, k: 'clank', v: 0.7 }; break;
      case 'crush': ev = { b: beat, k: 'crush', v: 0.9 }; break;
      case 'stem': ev = { b: this.quantize(beat, 2), k: 'stemup', v: 1 }; break;
      case 'nuke': ev = { b: beat, k: 'nuke', v: 1 }; break;
      case 'hatch': ev = { b: beat, k: 'hatch', v: 0.4 }; break;
      case 'drone_on': this.droneOn(params.lem, beat); return;
      case 'drone_off': this.droneOff(params.lem); return;
      case 'panic': ev = { b: beat, k: 'panic', v: 0.5 }; break;
      default: return;
    }
    // voice limiting per quantized slot & kind
    var key = ev.k + '@' + ev.b.toFixed(3) + (ev.n !== undefined ? ':' + ev.n : '');
    var slot = ev.k + '@' + ev.b.toFixed(3);
    var load = this.rowLoad[slot] || 0;
    if (this.rowLoad[key] && ev.n !== undefined) return;      // identical note already in this slot
    if (load >= 6 && (ev.k === 'step' || ev.k === 'brick' || ev.k === 'mine')) return;
    this.rowLoad[slot] = load + 1; this.rowLoad[key] = 1;
    ev.v = ev.v / Math.sqrt(1 + load * 0.8);
    if (Object.keys(this.rowLoad).length > 400) this.rowLoad = {};
    // insert sorted
    var i = this.queue.length; while (i > 0 && this.queue[i - 1].b > ev.b) i--;
    this.queue.splice(i, 0, ev);
    if (this.recordOn) this.recording.push(ev);
  };
  AudioEngine.prototype.playEvent = function (ev, t) {
    var wi = this.worldIndex, ctx = this.ctx, g = this.sfx;
    switch (ev.k) {
      case 'step': this.inst('step', wi, t, ev.n, ev.v, 0.18, -1); break;
      case 'brick': this.inst('arp', wi, t, ev.n, ev.v, 0.25, -1); break;
      case 'climb': this.inst('pluck', wi, t, ev.n, ev.v, 0.3, -1); break;
      case 'bash': this.bassSweep(t, ev.n, ev.v); break;
      case 'mine': this.click(t, ev.v); break;
      case 'kick': this.drum('kick', t, ev.v, -1); break;
      case 'snare': this.drum('snare', t, ev.v, -1); break;
      case 'float': this.padSwell(t, ev.n, ev.v); break;
      case 'exit': this.exitChord(t, ev.v); break;
      case 'sparkle': this.sparkle(t, ev.v); break;
      case 'ohno': this.vocal(t, 'ohno'); break;
      case 'explode': this.drum('crash', t, 0.9, -1); this.boom(t); break;
      case 'letsgo': this.vocal(t, 'letsgo'); break;
      case 'splat': this.splat(t); break;
      case 'drown': this.drown(t); break;
      case 'burn': this.burn(t); break;
      case 'clank': this.clank(t); break;
      case 'crush': this.drum('tom', t, 1, -1); this.clank(t + 0.02); break;
      case 'stemup': this.stemFanfare(t); break;
      case 'nuke': this.vocal(t, 'ohno'); break;
      case 'hatch': this.inst('pluck', wi, t, 72, 0.25, 0.15, -1); break;
      case 'panic': this.inst('pluck', wi, t, 84, 0.2, 0.08, -1); this.inst('pluck', wi, t + 0.07, 82, 0.2, 0.08, -1); break;
    }
  };
  AudioEngine.prototype.getRecording = function () { return this.recording.slice(); };
  /* Replay a recorded composition from the results screen: queue all events relative to beat 0 */
  AudioEngine.prototype.playRecording = function (rec, worldIndex, unlocked) {
    this.startSong(worldIndex, 0, unlocked, false);
    var q = [];
    for (var i = 0; i < rec.length; i++) { var e = rec[i]; q.push({ b: e.b, k: e.k, n: e.n, v: e.v }); }
    q.sort(function (a, b) { return a.b - b.b; });
    this.queue = q;
  };

  /* ------------------------------------------------------------------ */
  /* Synth primitives                                                    */
  /* ------------------------------------------------------------------ */
  AudioEngine.prototype.dest = function (stem) { return stem >= 0 ? this.stemGain[stem] : this.sfx; };
  AudioEngine.prototype.send = function (stem) { return stem >= 0 ? this.stemSend[stem] : this.sfxSend; };
  AudioEngine.prototype.osc = function (type, freq, t0, t1, detune) {
    var o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (detune) o.detune.value = detune;
    o.start(t0); o.stop(t1 + 0.05); return o;
  };
  AudioEngine.prototype.env = function (t0, a, d, s, r, peak, hold) { // returns gain node with ADSR
    var g = this.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t0); p.linearRampToValueAtTime(peak, t0 + a);
    p.setTargetAtTime(peak * s, t0 + a, d / 3);
    var tr = t0 + a + hold; p.setTargetAtTime(0.0001, tr, r / 3);
    g.endTime = tr + r; return g;
  };
  AudioEngine.prototype.noise = function (t0, t1) {
    var n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; n.start(t0, (t0 * 7.31) % 1.5); n.stop(t1 + 0.05); return n;
  };
  AudioEngine.prototype.filter = function (type, freq, q) { var f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1; return f; };

  /* Melodic instruments: kind in step|arp|pluck|bass|chord|lead|full, per world flavour */
  AudioEngine.prototype.inst = function (kind, wi, t, midi, vel, dur, stem, extra) {
    var ctx = this.ctx, f = mtof(midi), out = this.dest(stem), snd = this.send(stem), g, o, o2, flt, sendAmt = 0.5;
    vel = clamp(vel, 0, 1);
    if (kind === 'step' || kind === 'arp' || kind === 'pluck') {
      // short melodic blip per genre
      if (wi === 0) { g = this.env(t, 0.003, 0.08, 0.3, 0.08, 0.35 * vel, dur * 0.5); o = this.osc('square', f, t, g.endTime); o.connect(g); }
      else if (wi === 1) { g = this.env(t, 0.002, 0.1, 0.2, 0.1, 0.4 * vel, dur * 0.4); o = this.osc('sawtooth', f, t, g.endTime); flt = this.filter('lowpass', f * 2, 8); flt.frequency.setValueAtTime(f * 6, t); flt.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.15); o.connect(flt); flt.connect(g); }
      else if (wi === 2) { // FM bell
        g = this.env(t, 0.002, 0.25, 0.1, 0.25, 0.35 * vel, dur * 0.3); o = this.osc('sine', f, t, g.endTime); o2 = this.osc('sine', f * 3.01, t, g.endTime);
        var mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.5 * vel, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.3); o2.connect(mg); mg.connect(o.frequency); o.connect(g);
      }
      else if (wi === 3) { g = this.env(t, 0.002, 0.12, 0.05, 0.1, 0.4 * vel, 0.02); o = this.osc('triangle', f, t, g.endTime); o2 = this.osc('sine', f * 4, t, g.endTime); var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o2.connect(g2); g2.connect(g); o.connect(g); }
      else { g = this.env(t, 0.002, 0.2, 0.08, 0.2, 0.4 * vel, 0.02); o = this.osc('triangle', f, t, g.endTime); o2 = this.osc('sawtooth', f, t, g.endTime, 6); flt = this.filter('lowpass', f * 4, 2); flt.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2); o.connect(flt); o2.connect(flt); flt.connect(g); }
      if (kind === 'pluck') { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.4 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); }
      sendAmt = kind === 'arp' ? 0.6 : 0.35;
    }
    else if (kind === 'bass') {
      if (wi === 1) { // TB-303 acid
        var acc = extra && extra.acc ? 1 : 0;
        g = this.env(t, 0.003, 0.12, 0.2, 0.05, (0.5 + 0.2 * acc) * vel, dur * 0.6);
        o = this.osc('sawtooth', f, t, g.endTime);
        if (extra && extra.slide) o.frequency.linearRampToValueAtTime(f * 1.5, t + dur);
        flt = this.filter('lowpass', f, 14 + 8 * acc);
        var cut = this.acidCut === undefined ? 1 : this.acidCut; // slow cutoff LFO over bars
        var topF = f * (3 + 6 * (0.5 + 0.5 * Math.sin(t * 0.7)) + 4 * acc) * cut;
        flt.frequency.setValueAtTime(Math.min(topF, 8000), t); flt.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.18 + 0.1 * acc);
        var dist = ctx.createWaveShaper(); dist.curve = this.satCurve || (this.satCurve = makeSat(0.6)); o.connect(flt); flt.connect(dist); dist.connect(g);
      } else if (wi === 0) { g = this.env(t, 0.002, 0.05, 0.6, 0.03, 0.45 * vel, dur * 0.7); o = this.osc('square', f, t, g.endTime); o2 = this.osc('triangle', f, t, g.endTime); o.connect(g); o2.connect(g); }
      else if (wi === 2) { g = this.env(t, 0.005, 0.1, 0.5, 0.08, 0.5 * vel, dur * 0.8); o = this.osc('sawtooth', f, t, g.endTime); o2 = this.osc('square', f / 2, t, g.endTime); flt = this.filter('lowpass', f * 4, 3); flt.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2); o.connect(flt); o2.connect(flt); flt.connect(g); }
      else if (wi === 3) { g = this.env(t, 0.01, 0.2, 0.8, 0.15, 0.7 * vel, dur); o = this.osc('sine', f, t, g.endTime); o2 = this.osc('sawtooth', f, t, g.endTime); var sg = ctx.createGain(); sg.gain.value = 0.12; flt = this.filter('lowpass', 400, 1); o2.connect(sg); sg.connect(flt); flt.connect(g); o.connect(g); }
      else { g = this.env(t, 0.004, 0.15, 0.2, 0.1, 0.5 * vel, 0.05); o = this.osc('sawtooth', f, t, g.endTime); flt = this.filter('lowpass', 1200, 2); flt.frequency.exponentialRampToValueAtTime(200, t + 0.25); o.connect(flt); flt.connect(g); }
      sendAmt = 0.05;
    }
    else if (kind === 'chord') {
      if (wi === 2 || wi === 4) { // detuned pads / strings
        g = this.env(t, wi === 4 ? 0.35 : 0.2, 0.3, 0.8, 0.5, 0.22 * vel, dur);
        flt = this.filter('lowpass', wi === 4 ? 2400 : 1600, 0.8);
        for (var k = 0; k < 3; k++) { o = this.osc('sawtooth', f, t, g.endTime, (k - 1) * 9); o.connect(flt); }
        flt.connect(g); sendAmt = 0.5;
      } else if (wi === 0) { g = this.env(t, 0.002, 0.08, 0.3, 0.05, 0.25 * vel, dur * 0.5); o = this.osc('square', f, t, g.endTime); o.connect(g); sendAmt = 0.5; }
      else if (wi === 1) { g = this.env(t, 0.002, 0.1, 0.1, 0.05, 0.3 * vel, 0.02); o = this.osc('sawtooth', f, t, g.endTime); flt = this.filter('bandpass', f * 2, 3); o.connect(flt); flt.connect(g); sendAmt = 0.7; }
      else { g = this.env(t, 0.004, 0.15, 0.2, 0.1, 0.3 * vel, 0.03); o = this.osc('square', f, t, g.endTime, 5); flt = this.filter('lowpass', f * 3, 2); o.connect(flt); flt.connect(g); sendAmt = 0.6; }
    }
    else if (kind === 'lead' || kind === 'full') {
      if (wi === 0) { g = this.env(t, 0.003, 0.05, 0.6, 0.05, 0.3 * vel, dur * 0.8); o = this.osc('square', f, t, g.endTime); var lfo = this.osc('sine', 6, t, g.endTime), lg = ctx.createGain(); lg.gain.value = 5; lfo.connect(lg); lg.connect(o.detune); o.connect(g); }
      else if (wi === 1) { g = this.env(t, 0.002, 0.08, 0.3, 0.08, 0.3 * vel, dur * 0.6); o = this.osc('sawtooth', f, t, g.endTime); flt = this.filter('lowpass', f * 3, 10); flt.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.2); o.connect(flt); flt.connect(g); }
      else if (wi === 2) { // FM lead
        g = this.env(t, 0.01, 0.1, 0.6, 0.2, 0.3 * vel, dur * 0.8); o = this.osc('sine', f, t, g.endTime); o2 = this.osc('sine', f * 2, t, g.endTime);
        var mg2 = ctx.createGain(); mg2.gain.setValueAtTime(f * 1.8, t); mg2.gain.exponentialRampToValueAtTime(f * 0.3, t + 0.4); o2.connect(mg2); mg2.connect(o.frequency);
        var o3 = this.osc('sawtooth', f, t, g.endTime, -7); flt = this.filter('lowpass', 2500, 1); o3.connect(flt); flt.connect(g); o.connect(g);
      }
      else if (wi === 3) { g = this.env(t, 0.005, 0.1, 0.4, 0.1, 0.35 * vel, dur * 0.7); o = this.osc('triangle', f, t, g.endTime); o2 = this.osc('square', f * 2, t, g.endTime); var hg = ctx.createGain(); hg.gain.value = 0.15; o2.connect(hg); hg.connect(g); o.connect(g); }
      else { // brass / horn
        g = this.env(t, 0.06, 0.2, 0.7, 0.25, 0.28 * vel, dur * 0.9); flt = this.filter('lowpass', 800, 2); flt.frequency.setValueAtTime(600, t); flt.frequency.linearRampToValueAtTime(3000, t + 0.12); flt.frequency.setTargetAtTime(1500, t + 0.12, 0.3);
        o = this.osc('sawtooth', f, t, g.endTime); o2 = this.osc('sawtooth', f, t, g.endTime, 7); o.connect(flt); o2.connect(flt); flt.connect(g);
      }
      sendAmt = kind === 'full' ? 0.6 : 0.4;
    }
    if (!g) return;
    g.connect(out);
    var sg2 = ctx.createGain(); sg2.gain.value = sendAmt; g.connect(sg2); sg2.connect(snd);
  };
  function makeSat(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = Math.tanh(x * (1 + k * 4)) / Math.tanh(1 + k * 4); } return c; }

  /* Drums: kick|snare|gsnare|hat|ohat|clap|tom|crash|ride|timp */
  AudioEngine.prototype.drum = function (kind, t, vel, stem) {
    var ctx = this.ctx, out = this.dest(stem), g, o, n, flt, wi = this.worldIndex;
    vel = clamp(vel, 0, 1);
    switch (kind) {
      case 'kick': {
        g = ctx.createGain(); g.gain.setValueAtTime(0.9 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + (wi === 2 ? 0.45 : 0.3));
        o = this.osc(wi === 0 ? 'square' : 'sine', 150, t, t + 0.5); o.frequency.setValueAtTime(wi === 0 ? 220 : 160, t); o.frequency.exponentialRampToValueAtTime(wi === 3 ? 38 : 48, t + 0.12);
        o.connect(g); g.connect(out);
        if (wi !== 0) { var cg = ctx.createGain(); cg.gain.setValueAtTime(0.4 * vel, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02); n = this.noise(t, t + 0.03); n.connect(cg); cg.connect(out); }
        break;
      }
      case 'snare': case 'gsnare': {
        var gated = kind === 'gsnare';
        g = ctx.createGain(); g.gain.setValueAtTime(0.6 * vel, t);
        if (gated) { g.gain.setValueAtTime(0.7 * vel, t + 0.12); g.gain.linearRampToValueAtTime(0.0001, t + 0.14); } else g.gain.exponentialRampToValueAtTime(0.001, t + (wi === 3 ? 0.12 : 0.18));
        n = this.noise(t, t + 0.3); flt = this.filter(gated ? 'bandpass' : 'highpass', gated ? 1800 : 1200, gated ? 0.7 : 0.5); n.connect(flt); flt.connect(g); g.connect(out);
        var tg = ctx.createGain(); tg.gain.setValueAtTime(0.4 * vel, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o = this.osc('triangle', 190, t, t + 0.1); o.frequency.exponentialRampToValueAtTime(120, t + 0.08); o.connect(tg); tg.connect(out);
        break;
      }
      case 'hat': case 'ohat': case 'ride': {
        var len = kind === 'hat' ? 0.04 : (kind === 'ohat' ? 0.18 : 0.3);
        g = ctx.createGain(); g.gain.setValueAtTime(0.25 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        n = this.noise(t, t + len + 0.02); flt = this.filter(kind === 'ride' ? 'bandpass' : 'highpass', kind === 'ride' ? 5000 : 7000, 1); n.connect(flt); flt.connect(g); g.connect(out);
        if (wi === 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.18 * vel, t); g.gain.setValueAtTime(0.0001, t + len); }
        break;
      }
      case 'clap': {
        for (var i = 0; i < 3; i++) { var tt = t + i * 0.012; g = ctx.createGain(); g.gain.setValueAtTime(0.35 * vel, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.15 : 0.02)); n = this.noise(tt, tt + 0.2); flt = this.filter('bandpass', 1500, 1.2); n.connect(flt); flt.connect(g); g.connect(out); }
        break;
      }
      case 'tom': {
        g = ctx.createGain(); g.gain.setValueAtTime(0.6 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o = this.osc('sine', 200, t, t + 0.35); o.frequency.exponentialRampToValueAtTime(80, t + 0.25); o.connect(g); g.connect(out); break;
      }
      case 'crash': {
        g = ctx.createGain(); g.gain.setValueAtTime(0.4 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        n = this.noise(t, t + 1.5); flt = this.filter('bandpass', 4500, 0.4); n.connect(flt); flt.connect(g); g.connect(out); break;
      }
      case 'timp': {
        g = ctx.createGain(); g.gain.setValueAtTime(0.8 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o = this.osc('sine', 90, t, t + 1); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.25); o.connect(g); g.connect(out);
        var ng = ctx.createGain(); ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08); n = this.noise(t, t + 0.1); flt = this.filter('lowpass', 500, 1); n.connect(flt); flt.connect(ng); ng.connect(out); break;
      }
    }
  };

  /* ---- skill voices & SFX ---- */
  AudioEngine.prototype.bassSweep = function (t, midi, vel) { // basher: filtered bass sweep
    var f = mtof(midi), g = this.env(t, 0.01, 0.2, 0.5, 0.15, 0.5 * vel, 0.25);
    var o = this.osc('sawtooth', f, t, g.endTime), o2 = this.osc('square', f / 2, t, g.endTime);
    var flt = this.filter('lowpass', 200, 10); flt.frequency.setValueAtTime(150, t); flt.frequency.exponentialRampToValueAtTime(2500, t + 0.3); flt.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.sfx);
  };
  AudioEngine.prototype.click = function (t, vel) { // miner: syncopated percussive click
    var g = this.ctx.createGain(); g.gain.setValueAtTime(0.5 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    var o = this.osc('square', 1800 + 600 * vel, t, t + 0.05); o.frequency.exponentialRampToValueAtTime(600, t + 0.03); o.connect(g); g.connect(this.sfx);
    var n = this.noise(t, t + 0.03), ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02); var f = this.filter('highpass', 3000, 1); n.connect(f); f.connect(ng); ng.connect(this.sfx);
  };
  AudioEngine.prototype.padSwell = function (t, midi, vel) { // floater: soft pad swell
    var f = mtof(midi), g = this.env(t, 0.5, 0.4, 0.7, 0.9, 0.18 * vel, 0.6), flt = this.filter('lowpass', 900, 1);
    for (var k = 0; k < 3; k++) { var o = this.osc('sawtooth', f * (k === 2 ? 2 : 1), t, g.endTime, (k - 1) * 11); o.connect(flt); }
    flt.connect(g); g.connect(this.sfx); var s = this.ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.sfxSend);
  };
  AudioEngine.prototype.droneOn = function (lemId, beat) { // blocker: sustained drone on chord root
    if (!this.ready || this.drones[lemId]) return;
    var world = BT.WORLDS[this.worldIndex], t = this.ctx.currentTime + 0.02;
    var bar = Math.floor(beat / 4) % 4, deg = PROGS[this.worldIndex][bar];
    var f = mtof(BT.degreeToMidi(world, deg, -2)) ;
    var g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 / Math.sqrt(1 + Object.keys(this.drones).length), t + 0.4);
    var flt = this.filter('lowpass', 500, 2);
    var o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), o3 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 8; o3.frequency.value = f / 2;
    var lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.25; lg.gain.value = 250; lfo.connect(lg); lg.connect(flt.frequency);
    o1.connect(flt); o2.connect(flt); o3.connect(g); flt.connect(g); g.connect(this.droneBus);
    o1.start(t); o2.start(t); o3.start(t); lfo.start(t);
    this.drones[lemId] = { g: g, oscs: [o1, o2, o3, lfo] };
  };
  AudioEngine.prototype.droneOff = function (lemId) {
    var d = this.drones[lemId]; if (!d) return; delete this.drones[lemId];
    var t = this.ctx.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    for (var i = 0; i < d.oscs.length; i++) d.oscs[i].stop(t + 0.6);
  };
  AudioEngine.prototype.stopDrones = function () { for (var k in this.drones) this.droneOff(k); };
  AudioEngine.prototype.exitChord = function (t, vel) { // rising chord at the exit door
    var world = BT.WORLDS[this.worldIndex], ns = [1, 3, 5, 8];
    for (var i = 0; i < ns.length; i++) {
      var tt = t + i * 0.06, f = mtof(BT.degreeToMidi(world, ns[i], 1));
      var g = this.env(tt, 0.01, 0.2, 0.4, 0.5, 0.22 * vel, 0.25), o = this.osc('triangle', f, tt, g.endTime), o2 = this.osc('square', f, tt, g.endTime, 4);
      var sg = this.ctx.createGain(); sg.gain.value = 0.25; o2.connect(sg); sg.connect(g); o.connect(g); g.connect(this.sfx);
      var s = this.ctx.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(this.sfxSend);
    }
  };
  AudioEngine.prototype.sparkle = function (t, vel) { // on-beat groove bonus
    for (var i = 0; i < 3; i++) {
      var tt = t + i * 0.04, f = 1760 * Math.pow(2, i * 7 / 12);
      var g = this.ctx.createGain(); g.gain.setValueAtTime(0.18 * vel, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.25);
      var o = this.osc('sine', f, tt, tt + 0.3), m = this.osc('sine', f * 2.5, tt, tt + 0.3), mg = this.ctx.createGain(); mg.gain.value = 400; m.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(this.sfx);
      var s = this.ctx.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(this.sfxSend);
    }
  };
  AudioEngine.prototype.stemFanfare = function (t) {
    var world = BT.WORLDS[this.worldIndex];
    for (var i = 0; i < 5; i++) { var m = BT.degreeToMidi(world, [1, 3, 5, 8, 10][i], 1); this.inst('lead', this.worldIndex, t + i * 0.07, m, 0.5, 0.3, -1); }
  };
  /* Formant-filtered vocal stabs */
  AudioEngine.prototype.vocal = function (t, kind) {
    var ctx = this.ctx, dur = kind === 'ohno' ? 0.75 : 0.6;
    var src = this.osc('sawtooth', 220, t, t + dur), src2 = this.osc('sawtooth', 220, t, t + dur, -12);
    var out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.5, t + 0.03);
    var F = [this.filter('bandpass', 500, 9), this.filter('bandpass', 1000, 10), this.filter('bandpass', 2600, 12)];
    var FG = [1, 0.6, 0.25];
    for (var i = 0; i < 3; i++) { var fg = ctx.createGain(); fg.gain.value = FG[i]; src.connect(F[i]); src2.connect(F[i]); F[i].connect(fg); fg.connect(out); }
    function vowel(tt, f1, f2, f3, ramp) { for (var k = 0; k < 3; k++) { var fr = [f1, f2, f3][k]; if (ramp) F[k].frequency.linearRampToValueAtTime(fr, tt); else F[k].frequency.setValueAtTime(fr, tt); } }
    if (kind === 'ohno') { // "Oh" -> "no!" with pitch dropping
      src.frequency.setValueAtTime(300, t); src.frequency.linearRampToValueAtTime(260, t + 0.25); src.frequency.setValueAtTime(280, t + 0.3); src.frequency.exponentialRampToValueAtTime(130, t + dur);
      src2.frequency.setValueAtTime(300, t); src2.frequency.linearRampToValueAtTime(260, t + 0.25); src2.frequency.setValueAtTime(280, t + 0.3); src2.frequency.exponentialRampToValueAtTime(130, t + dur);
      vowel(t, 450, 800, 2800); vowel(t + 0.22, 450, 800, 2800, true); vowel(t + 0.3, 280, 1400, 2500, true); vowel(t + 0.42, 450, 820, 2700, true);
      out.gain.setValueAtTime(0.5, t + 0.2); out.gain.linearRampToValueAtTime(0.15, t + 0.28); out.gain.linearRampToValueAtTime(0.55, t + 0.36); out.gain.setTargetAtTime(0.0001, t + 0.55, 0.08);
    } else { // "Let's go!"
      src.frequency.setValueAtTime(240, t); src.frequency.linearRampToValueAtTime(220, t + 0.15); src.frequency.setValueAtTime(200, t + 0.3); src.frequency.linearRampToValueAtTime(300, t + dur);
      src2.frequency.setValueAtTime(240, t); src2.frequency.linearRampToValueAtTime(220, t + 0.15); src2.frequency.setValueAtTime(200, t + 0.3); src2.frequency.linearRampToValueAtTime(300, t + dur);
      vowel(t, 530, 1840, 2480); vowel(t + 0.14, 530, 1840, 2480, true); vowel(t + 0.33, 450, 800, 2800, true); vowel(t + 0.5, 400, 750, 2600, true);
      out.gain.setValueAtTime(0.5, t + 0.14); out.gain.linearRampToValueAtTime(0.0001, t + 0.2); out.gain.setValueAtTime(0.0001, t + 0.3); out.gain.linearRampToValueAtTime(0.6, t + 0.34); out.gain.setTargetAtTime(0.0001, t + 0.5, 0.06);
      // 's' hiss and 'g' burst
      var n = this.noise(t + 0.2, t + 0.32), ng = ctx.createGain(), hf = this.filter('highpass', 5000, 1); ng.gain.setValueAtTime(0.0001, t + 0.2); ng.gain.linearRampToValueAtTime(0.25, t + 0.24); ng.gain.linearRampToValueAtTime(0.0001, t + 0.31); n.connect(hf); hf.connect(ng); ng.connect(this.sfx);
    }
    out.connect(this.sfx); var s = ctx.createGain(); s.gain.value = 0.5; out.connect(s); s.connect(this.sfxSend);
  };
  AudioEngine.prototype.boom = function (t) {
    var g = this.ctx.createGain(); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    var o = this.osc('sine', 120, t, t + 0.8); o.frequency.exponentialRampToValueAtTime(30, t + 0.5); o.connect(g); g.connect(this.sfx);
    var n = this.noise(t, t + 0.6), ng = this.ctx.createGain(), f = this.filter('lowpass', 1500, 0.7); ng.gain.setValueAtTime(0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5); n.connect(f); f.connect(ng); ng.connect(this.sfx);
  };
  AudioEngine.prototype.splat = function (t) {
    var n = this.noise(t, t + 0.2), g = this.ctx.createGain(), f = this.filter('lowpass', 900, 1); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); n.connect(f); f.connect(g); g.connect(this.sfx);
    var o = this.osc('square', 180, t, t + 0.12), og = this.ctx.createGain(); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.frequency.exponentialRampToValueAtTime(50, t + 0.1); o.connect(og); og.connect(this.sfx);
  };
  AudioEngine.prototype.drown = function (t) {
    for (var i = 0; i < 4; i++) { var tt = t + i * 0.09, g = this.ctx.createGain(); g.gain.setValueAtTime(0.2, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.08); var o = this.osc('sine', 300 + i * 120, tt, tt + 0.1); o.frequency.exponentialRampToValueAtTime(900 + i * 150, tt + 0.08); o.connect(g); g.connect(this.sfx); }
  };
  AudioEngine.prototype.burn = function (t) {
    var n = this.noise(t, t + 0.5), g = this.ctx.createGain(), f = this.filter('bandpass', 2500, 0.8); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); n.connect(f); f.connect(g); g.connect(this.sfx);
    var o = this.osc('sawtooth', 600, t, t + 0.3), og = this.ctx.createGain(); og.gain.setValueAtTime(0.12, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.frequency.exponentialRampToValueAtTime(1800, t + 0.25); o.connect(og); og.connect(this.sfx);
  };
  AudioEngine.prototype.clank = function (t) {
    var fs = [1370, 2210, 3400];
    for (var i = 0; i < fs.length; i++) { var g = this.ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 - i * 0.05); var o = this.osc('square', fs[i], t, t + 0.3); o.connect(g); g.connect(this.sfx); }
  };
  /* UI blips */
  AudioEngine.prototype.ui = function (kind) {
    if (!this.ready) return; var t = this.ctx.currentTime + 0.01;
    if (kind === 'select') this.inst('pluck', this.worldIndex, t, 79, 0.4, 0.1, -1);
    else if (kind === 'ok') { this.inst('pluck', this.worldIndex, t, 72, 0.4, 0.1, -1); this.inst('pluck', this.worldIndex, t + 0.08, 79, 0.4, 0.15, -1); }
    else if (kind === 'back') this.inst('pluck', this.worldIndex, t, 64, 0.4, 0.1, -1);
    else if (kind === 'deny') this.clank(t);
  };

  /* ---- analyser accessors ---- */
  AudioEngine.prototype.scope = function () { if (!this.ready) return null; this.analyser.getByteTimeDomainData(this.scopeBuf); return this.scopeBuf; };
  AudioEngine.prototype.spectrum = function () { if (!this.ready) return null; this.analyser.getByteFrequencyData(this.specBuf); return this.specBuf; };

  root.BT_AUDIO = { AudioEngine: AudioEngine, STEMS: STEMS, buildSong: buildSong, noteName: noteName };
})(typeof window !== 'undefined' ? window : this);
