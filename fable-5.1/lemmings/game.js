/* =====================================================================
   Lemmings: Beat Tribe — game shell (game.js)
   State machine (title/attract -> select -> intro -> play -> results),
   fixed 60 Hz timestep, camera, mouse/keyboard controls, bottom panel,
   mixer overlay, demo playback and the sim -> audio/visual event bridge.
   ===================================================================== */
(function (root) {
  'use strict';
  var BT = root.BT, LEVELS = root.BT_LEVELS, SOLS = root.BT_SOLUTIONS, BA = root.BT_AUDIO, BR = root.BT_RENDER;
  var C = BR.C, lerpC = BR.lerpC, shade = BR.shade, FW = BR.FW, FH = BR.FH, VH = BR.VH, SKILLS = BT.SKILLS;
  var STEM_NAMES = ['DRUMS', 'BASS', 'CHORDS', 'LEAD', 'FULL'];
  var STEP = 1 / 60;

  /* ---------------- panel geometry ---------------- */
  var BTN_Y = 170, BTN_W = 14, BTN_H = 30;
  var BTN_NAMES = ['rateDown', 'rateUp'].concat(SKILLS).concat(['pause', 'nuke', 'ff']);
  var SCOPE_X = 185, SCOPE_W = 60, MINI_X = 249, MINI_W = 70, MINI_Y = 171, MINI_H = 27;

  var canvas = document.getElementById('screen');
  var R = new BR.Renderer(canvas);
  var audio = new BA.AudioEngine();

  /* ---------------- persistent prefs ---------------- */
  function load(k, d) { try { var v = localStorage.getItem('beattribe.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('beattribe.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  /* ---------------- game state ---------------- */
  var G = {
    state: 'title', level: 0, sim: null, demo: false, demoCmds: [], demoIdx: 0, demoCursor: { x: 0, y: 0 },
    cam: 0, camTarget: 0, paused: false, ff: false, skill: 'climber', hover: null,
    mx: 160, my: 100, mouseIn: false, lbtn: false, rbtn: false, dragMini: false, lastRX: 0,
    rateHold: 0, rateHoldT: 0, nukeArm: 0, mixer: false, muted: load('muted', false),
    unlocked: load('unlocked', 0), sel: 0, codeBuf: '', banners: [], finishTimer: -1,
    menuBeat: 0, resBeat: 0, rec: [], recEnd: 0, result: null, titleT: 0, acc: 0, last: 0, frame: 0,
    keys: {}, flash: 0, audioStartedFor: -1
  };
  R.crt = load('crt', true);
  audio.setMuted(G.muted);

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmtTime(frames) { var s = Math.max(0, Math.ceil(frames / 60)), m = Math.floor(s / 60); s -= m * 60; return m + '-' + (s < 10 ? '0' : '') + s; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function banner(text, color, t) { G.banners.push({ text: text, c: color || 0xffffff, t: t || 150, t0: t || 150 }); if (G.banners.length > 3) G.banners.shift(); }
  function firstSkill(sim) { for (var i = 0; i < SKILLS.length; i++) if (sim.skills[SKILLS[i]] > 0) return SKILLS[i]; return SKILLS[0]; }

  /* ---------------- audio helpers ---------------- */
  function ensureAudio() {
    var was = audio.ready;
    audio.init();
    if (!was && audio.ready) resyncSong();
  }
  function resyncSong() { // (re)start the song appropriate for the current state
    if (!audio.ready) return;
    if ((G.state === 'play' || G.state === 'title') && G.sim) {
      audio.startSong(G.sim.level.world, G.sim.beat(), G.sim.stems, true);
    } else if (G.state === 'select' || G.state === 'intro') {
      G.menuBeat = 0; audio.startSong(LEVELS[G.sel].world, 0, 3, false);
    } else if (G.state === 'results' && G.result) {
      G.resBeat = 0; audio.playRecording(G.rec, G.result.world, Math.max(1, G.result.stems));
    }
  }
  function menuSong(world) {
    if (!audio.ready) return;
    if (audio.song && audio.worldIndex === world && G.audioStartedFor === world) return;
    G.menuBeat = 0; audio.startSong(world, 0, 3, false); G.audioStartedFor = world;
  }

  /* ---------------- level start / sim event bridge ---------------- */
  function startLevel(idx, demo, keepTitle) {
    var level = LEVELS[idx];
    G.level = idx; G.demo = demo; G.demoCmds = demo ? (SOLS[idx] || []) : []; G.demoIdx = 0;
    G.sim = new BT.Sim(level, { onEvent: onSimEvent });
    R.buildBackground(level); R.flashes = []; R.particles = []; R.texts = [];
    G.cam = clamp(level.entrance.x - FW / 2, 0, level.width - FW); G.camTarget = G.cam;
    G.paused = false; G.ff = false; G.skill = firstSkill(G.sim); G.hover = null;
    G.banners = []; G.finishTimer = -1; G.nukeArm = 0; G.mixer = false; G.acc = 0;
    G.demoCursor = { x: level.entrance.x, y: level.entrance.y };
    G.state = keepTitle ? 'title' : 'play';
    G.audioStartedFor = -1;
    if (audio.ready) audio.startSong(level.world, 0, 0, true);
    if (demo && !keepTitle) banner('DEMO - PRESS ESC TO STOP', 0xffd040, 240);
  }
  function onSimEvent(ev) {
    var sim = G.sim, beat = sim.frame * sim.bpm / 3600, acc = sim.world.accent, cols = sim.world.colors;
    audio.event(ev.type, ev, beat);
    switch (ev.type) {
      case 'step': if (!ev.muted) R.addFlash(ev.x, ev.y); break;
      case 'brick': R.addFlash(ev.x, ev.y); R.burst(ev.x + 2, ev.y - 2, 3, [cols[(ev.degree - 1) % 7], 0xffffff], 0.8); break;
      case 'climb': R.addFlash(ev.x, ev.y - 6); break;
      case 'bash': case 'mine': case 'dig': R.burst(ev.x, ev.y - 4, 5, [cols[ev.degree ? (ev.degree - 1) % 7 : 2], 0x806040, 0xffffff], 1.2); break;
      case 'sparkle': { var pts = 100 + 25 * Math.min(ev.combo, 8); R.burst(ev.x, ev.y - 6, 14, [0xffffff, 0xffd040, acc], 1.8); R.floatText(ev.x, ev.y - 14, 'GROOVE +' + pts + (ev.combo > 1 ? ' X' + ev.combo : ''), 0xffd040); break; }
      case 'stem': { var n = ev.stem; audio.setUnlocked(n); banner(n >= 5 ? 'FULL MIX UNLOCKED!' : 'STEM UNLOCKED: ' + STEM_NAMES[n - 1], acc, 180); R.burst(ev.x, ev.y - 8, 24, [acc, 0xffffff, cols[3]], 2.2); G.flash = 8; break; }
      case 'exit': R.burst(sim.level.exit.x, sim.level.exit.y - 8, 10, [acc, 0xffffff], 1.4); break;
      case 'letsgo': banner("LET'S GO!", 0xffffff, 90); break;
      case 'explode': R.burst(ev.x, ev.y - 5, 40, [0xffffff, 0xffd040, 0xff6040, cols[0], cols[4]], 2.8); G.flash = 4; break;
      case 'splat': R.burst(ev.x, ev.y, 8, [0x40a040, 0x3050e0], 1.0); break;
      case 'drown': R.burst(ev.x, ev.y - 4, 6, [0xa0e0ff, 0x3a8ae0], 0.8); break;
      case 'burn': R.burst(ev.x, ev.y - 6, 10, [0xff9a20, 0xffff60, 0x303030], 1.2); break;
      case 'crush': R.burst(ev.x, ev.y - 4, 10, [0xffffff, 0x9a9ea8, 0x40a040], 1.5); break;
      case 'clank': R.burst(ev.x + 3, ev.y - 5, 6, [0xffffff, 0xc0c0d0], 1.3); R.floatText(ev.x, ev.y - 14, 'CLANK', 0xc0c0d0); break;
      case 'panic': R.floatText(ev.x, ev.y - 14, '!?', 0xa0a0a8); break;
      case 'nuke': banner('NUKE!', 0xff4040, 120); break;
      case 'finish': G.finishTimer = ev.why === 'time' ? 60 : 100; if (ev.why === 'time') banner('TIME UP', 0xff4040, 120); break;
    }
  }

  /* ---------------- results ---------------- */
  function gotoResults() {
    var sim = G.sim, r = sim.result;
    G.result = { won: r.won, saved: r.saved, needed: r.needed, total: r.total, groove: r.groove, frames: r.frames, timeLeft: r.timeLeft,
      stems: sim.stems, world: sim.level.world, level: G.level, why: r.why, demo: G.demo };
    G.rec = audio.getRecording();
    G.recEnd = 0; for (var i = 0; i < G.rec.length; i++) G.recEnd = Math.max(G.recEnd, G.rec[i].b);
    G.recEnd = Math.max(G.recEnd, 8);
    if (r.won && !G.demo && G.level >= G.unlocked && G.level < LEVELS.length - 1) { G.unlocked = G.level + 1; save('unlocked', G.unlocked); }
    G.state = 'results'; G.resBeat = 0; G.sel = G.level;
    if (audio.ready) { audio.playRecording(G.rec, G.result.world, Math.max(1, sim.stems)); audio.ui(r.won ? 'ok' : 'back'); }
  }

  /* ---------------- per-60Hz logic ---------------- */
  function frameTick() {
    G.frame++;
    for (var b = G.banners.length - 1; b >= 0; b--) { G.banners[b].t--; if (G.banners[b].t <= 0) G.banners.splice(b, 1); }
    if (G.flash > 0) G.flash--;
    if (G.state === 'play' || G.state === 'title') {
      var sim = G.sim; if (!sim) return;
      var steps = G.paused ? 0 : (G.ff ? 2 : 1);
      if (G.state === 'title') { steps = 1; G.titleT++; }
      for (var s = 0; s < steps; s++) {
        if (sim.status === 'playing') {
          if (G.demo) { while (G.demoIdx < G.demoCmds.length && G.demoCmds[G.demoIdx].frame <= sim.frame) { var c = G.demoCmds[G.demoIdx++]; if (c.skill) G.skill = c.skill; sim.applyCommand(c); } }
          sim.update();
        }
      }
      if (G.finishTimer > 0 && !G.paused) { G.finishTimer -= steps; if (G.finishTimer <= 0) { if (G.state === 'title') startLevel((G.level + 1) % LEVELS.length, true, true); else gotoResults(); return; } }
      if (G.state === 'title' && G.titleT > 60 * 50) { G.titleT = 0; startLevel((G.level + 1) % LEVELS.length, true, true); return; }
      // camera
      var W = sim.W;
      if (G.demo) {
        var focus = demoFocus(sim);
        if (focus) G.camTarget = clamp(focus.x - FW / 2, 0, W - FW);
        G.cam += (G.camTarget - G.cam) * 0.08;
        var cur = demoCursorTarget(sim); if (cur) { G.demoCursor.x += (cur.x - G.demoCursor.x) * 0.12; G.demoCursor.y += (cur.y - G.demoCursor.y) * 0.12; }
      } else {
        var sp = (G.keys.shift ? 8 : 4);
        if (G.keys.left) G.cam -= sp; if (G.keys.right) G.cam += sp;
        if (G.mouseIn && G.my < VH && !G.rbtn) { if (G.mx < 5) G.cam -= 3; else if (G.mx >= FW - 5) G.cam += 3; }
        G.cam = clamp(G.cam, 0, W - FW);
        if (G.rateHold) { G.rateHoldT++; if (G.rateHoldT > 18 && G.rateHoldT % 3 === 0) sim.setRate(sim.rate + G.rateHold); }
        if (G.nukeArm > 0) G.nukeArm--;
        G.hover = (G.my < VH && G.mouseIn) ? sim.lemmingAt(Math.round(G.mx + G.cam), G.my) : null;
      }
    } else if (G.state === 'results') {
      G.resBeat += STEP / audio.secPerBeat;
      if (G.resBeat > G.recEnd + 4 && audio.ready) { G.resBeat = 0; audio.playRecording(G.rec, G.result.world, Math.max(1, G.result.stems)); }
    } else {
      G.menuBeat += STEP / audio.secPerBeat;
    }
  }
  function demoFocus(sim) {
    var i = G.demoIdx, best = null;
    while (i < G.demoCmds.length && G.demoCmds[i].skill === undefined) i++;
    if (i < G.demoCmds.length && G.demoCmds[i].frame - sim.frame < 200) { var l = sim.lemmings[G.demoCmds[i].lemmingIndex]; if (l && l.alive) return l; }
    for (var k = 0; k < sim.lemmings.length; k++) { var m = sim.lemmings[k]; if (!m.alive || BT.isDying(m)) continue; if (!best || (m.x - best.x) * (sim.level.dir || 1) > 0) best = m; }
    return best || sim.level.entrance;
  }
  function demoCursorTarget(sim) {
    var i = G.demoIdx; while (i < G.demoCmds.length && G.demoCmds[i].skill === undefined) i++;
    if (i < G.demoCmds.length && G.demoCmds[i].frame - sim.frame < 120) { var l = sim.lemmings[G.demoCmds[i].lemmingIndex]; if (l && l.alive) return { x: l.x, y: l.y - 5 }; }
    return null;
  }

  /* ---------------- main loop ---------------- */
  function loop(now) {
    requestAnimationFrame(loop);
    if (!G.last) G.last = now;
    var dt = Math.min(0.1, (now - G.last) / 1000); G.last = now; G.acc += dt;
    while (G.acc >= STEP) { frameTick(); G.acc -= STEP; }
    // audio clock sync
    if (audio.ready) {
      if ((G.state === 'play' || G.state === 'title') && G.sim) audio.sync(G.sim.beat(), G.state === 'title' ? 1 : (G.paused ? 0 : (G.ff ? 2 : 1)));
      else if (G.state === 'results') audio.sync(G.resBeat, 1);
      else { menuSong(LEVELS[G.sel].world); audio.sync(G.menuBeat, 1); }
    }
    draw();
  }

  /* ---------------- drawing ---------------- */
  function dim(x, y, w, h, f) {
    var fb = R.fb, x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(FW, x + w), y1 = Math.min(FH, y + h);
    for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var c = fb[yy * FW + xx]; fb[yy * FW + xx] = f === 2 ? ((c & 0xff000000) | ((c >> 2) & 0x3f3f3f)) >>> 0 : ((c & 0xff000000) | ((c >> 1) & 0x7f7f7f)) >>> 0; }
  }
  function draw() {
    var st = G.state;
    if (st === 'play' || st === 'title') drawPlay();
    else if (st === 'select') drawSelect();
    else if (st === 'intro') drawIntro();
    else if (st === 'results') drawResults();
    if (st === 'title') drawTitleOverlay();
    drawCursor();
    R.present();
  }
  function drawPlay() {
    var sim = G.sim, beat = sim.beat(), ph = beat - Math.floor(beat), frame = G.frame, acc = sim.world.accent;
    R.drawWorld(sim, G.cam, ph, frame);
    R.drawObjects(sim, G.cam, frame);
    for (var i = 0; i < sim.lemmings.length; i++) { var l = sim.lemmings[i]; if (!l.alive) continue; R.drawLemming(l, G.cam, ph, frame, l === G.hover); }
    R.drawParticles(G.cam, G.paused ? 0 : (G.ff ? 2 : 1));
    if (G.flash > 0) { for (var k = 0; k < FW * VH; k += 2 + (8 - G.flash)) R.fb[k] = C(0xffffff); }
    drawPanel(sim);
    drawBanners();
    if (G.state === 'play' && G.paused && !G.mixer) { dim(100, 60, 120, 30); R.box(100, 60, 120, 30, C(acc)); R.bigTextC('PAUSED', 160, 70, C(0xffffff), C(0x000000)); }
    if (G.state === 'play' && G.demo) { R.textC('DEMO', 160, 4, C(0xffd040), C(0x000000)); }
    if (G.mixer) drawMixer(sim);
    if (G.demo && (G.state === 'play' || G.state === 'title')) { // simulated cursor of the demo player
      var cx = Math.round(G.demoCursor.x - G.cam), cy = Math.round(G.demoCursor.y);
      var cc = C((frame & 8) ? 0xffd040 : 0xffffff); R.box(cx - 5, cy - 7, 11, 14, cc);
    }
  }
  function drawBanners() {
    for (var i = 0; i < G.banners.length; i++) {
      var b = G.banners[i], a = b.t < 20 ? b.t / 20 : 1, y = 18 + i * 14 - (a < 1 ? (1 - a) * 6 : 0);
      var col = lerpC(0x000000, b.c, a);
      R.bigTextC(b.text, 160, Math.round(y), C(col), C(0x000000));
    }
  }
  function drawPanel(sim) {
    var acc = sim.world.accent, i, x;
    R.rect(0, VH, FW, FH - VH, C(0x1c1e26));
    R.rect(0, VH, FW, 1, C(0x40445a));
    // status line
    var hovTxt = '';
    if (G.hover) { hovTxt = G.hover.state.toUpperCase(); if (G.hover.state === 'walker' && (G.hover.climber || G.hover.floater)) hovTxt = 'ATHLETE'; }
    else if (G.my < VH && G.mouseIn && !G.demo) hovTxt = G.skill.toUpperCase();
    var canDo = G.hover && sim.canAssign(G.hover, G.skill);
    R.text(hovTxt, 2, 162, C(canDo ? 0x80ff80 : 0xd0d0d8));
    var pctIn = Math.floor(sim.saved * 100 / sim.total);
    R.text('OUT ' + sim.aliveCount(), 52, 162, C(0xd0d0d8));
    R.text('IN ' + pctIn + '%', 92, 162, C(sim.saved >= sim.needed ? 0x80ff80 : 0xd0d0d8));
    var tl = sim.timeLimit - sim.frame; R.text('TIME ' + fmtTime(tl), 132, 162, C(tl < 1800 && (G.frame & 16) ? 0xff6060 : 0xd0d0d8));
    R.text('GROOVE ' + sim.groove + (sim.combo > 1 ? ' X' + sim.combo : ''), 186, 162, C(0xffd040));
    for (i = 0; i < 5; i++) R.rect(284 + i * 7, 163, 5, 3, C(i < sim.stems ? acc : 0x3a3c48));
    // buttons
    for (i = 0; i < BTN_NAMES.length; i++) {
      x = i * BTN_W; var name = BTN_NAMES[i], isSkill = i >= 2 && i < 10, on = false, col = 0x30323c;
      if (isSkill && name === G.skill) { on = true; col = 0x4a4e66; }
      if (name === 'pause' && G.paused) on = true; if (name === 'ff' && G.ff) on = true; if (name === 'nuke' && G.nukeArm > 0 && (G.frame & 4)) on = true;
      R.rect(x, BTN_Y, BTN_W, BTN_H, C(on ? lerpC(col, acc, 0.35) : col));
      R.box(x, BTN_Y, BTN_W, BTN_H, C(on ? acc : 0x101018));
      R.rect(x + 1, BTN_Y + 1, BTN_W - 2, 1, C(on ? 0xffffff : 0x50546a));
      var icol = 0xf0f0f8; if (isSkill && sim.skills[name] <= 0) icol = 0x606070;
      R.icon(name, x + 3, BTN_Y + 4, C(icol));
      var cnt = null;
      if (i < 2) cnt = i === 0 ? sim.rateMin : sim.rate; else if (isSkill) cnt = sim.skills[name];
      if (cnt !== null) R.text(String(cnt), x + (cnt >= 10 ? 2 : 5), BTN_Y + 21, C(isSkill && cnt <= 0 ? 0x606070 : 0xffffff));
      if (isSkill) R.text(String(i - 1), x + 10, BTN_Y + 12, C(0x70748a));
    }
    R.drawScope(audio, SCOPE_X, 171, SCOPE_W, 27, acc);
    if (!audio.ready) R.textC('CLICK', SCOPE_X + SCOPE_W / 2, 176, C(0x8090a0)); 
    if (!audio.ready) R.textC('FOR SOUND', SCOPE_X + SCOPE_W / 2, 184, C(0x8090a0));
    if (G.muted && audio.ready) R.textC('MUTED', SCOPE_X + SCOPE_W / 2, 180, C(0xff6060), C(0x000000));
    R.drawMinimap(sim, G.cam, MINI_X, MINI_Y, MINI_W, MINI_H);
    R.box(MINI_X - 1, MINI_Y - 1, MINI_W + 2, MINI_H + 2, C(0x404858));
  }
  function drawMixer(sim) {
    var x0 = 24, y0 = 8, w = 272, h = 144, acc = sim.world.accent;
    dim(x0, y0, w, h, 2); R.box(x0, y0, w, h, C(acc));
    R.textC('STEM MIXER   [T] CLOSE   CLICK=MUTE  RIGHT CLICK=SOLO', 160, y0 + 3, C(0xffffff));
    var colW = 50, cx0 = x0 + 22;
    for (var i = 0; i < 5; i++) {
      var cx = cx0 + i * colW, locked = i >= audio.unlocked, active = audio.stemActive(i);
      var stat = locked ? 'LOCKED' : (audio.stemSolo[i] ? 'SOLO' : (audio.stemMute[i] ? 'MUTE' : 'ON'));
      var col = locked ? 0x60626e : (active ? acc : 0xa0a0a8);
      R.rect(cx, y0 + 11, colW - 2, 15, C(active ? lerpC(0x101018, acc, 0.3) : 0x101018)); R.box(cx, y0 + 11, colW - 2, 15, C(col));
      R.textC(STEM_NAMES[i], cx + colW / 2 - 1, y0 + 13, C(0xffffff)); R.textC(stat, cx + colW / 2 - 1, y0 + 20, C(col));
      R.textC(String(i + 1), cx + colW / 2 - 1, y0 + 136, C(0x70748a));
    }
    var rows = audio.patternView(6), ry = y0 + 30;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r], y = ry + r * 8, mid = r === 6;
      if (mid) R.rect(x0 + 2, y - 1, w - 4, 7, C(lerpC(0x000000, acc, 0.45)));
      if (!row) continue;
      R.text(pad2(row.r), x0 + 4, y, C(mid ? 0xffffff : (row.r % 4 === 0 ? 0xc0c0d0 : 0x70748a)));
      for (var c = 0; c < 5; c++) {
        var on = audio.stemActive(c), cell = row.cells[c];
        var cc = cell.indexOf('-') === 0 || cell === '---' ? 0x50546a : (on ? 0xffffff : 0x70748a);
        R.text(cell, cx0 + c * colW + 8, y, C(mid && on && cc === 0xffffff ? 0xffffa0 : cc));
      }
    }
    R.text('PAT ' + (rows[6] ? rows[6].pat : 0) + '  ROW ' + pad2(rows[6] ? rows[6].r : 0) + '  BPM ' + audio.bpm, x0 + 4, y0 + 136, C(0xa0a0a8));
  }
  function drawCursor() {
    if (!G.mouseIn) return;
    var x = Math.round(G.mx), y = Math.round(G.my), st = G.state;
    if ((st === 'play') && y < VH && !G.mixer) {
      if (G.hover) { var hc = C((G.frame & 4) ? 0xffffff : 0xffd040); R.box(x - 6, y - 6, 13, 13, hc); }
      else { var cc = C(0xffffff), sc = C(0x000000); for (var i = 2; i <= 5; i++) { R.px(x + i, y, cc); R.px(x - i, y, cc); R.px(x, y + i, cc); R.px(x, y - i, cc); R.px(x + i, y + 1, sc); R.px(x - i, y + 1, sc); R.px(x + 1, y + i, sc); R.px(x + 1, y - i, sc); } }
    } else { // pointer
      var pc = C(0xffffff), ps = C(0x000000);
      for (var r = 0; r < 7; r++) for (var c = 0; c <= Math.min(r, 4); c++) R.px(x + c, y + r, (c === 0 || c === r || r === 6 || c === 4) ? ps : pc);
      R.px(x, y + 7, ps);
    }
  }

  /* ---- title overlay (attract mode) ---- */
  function drawTitleOverlay() {
    var f = G.frame; dim(0, 0, FW, VH, 1);
    var t1 = 'LEMMINGS', t2 = 'BEAT TRIBE';
    for (var i = 0; i < t1.length; i++) { var y = 22 + Math.round(Math.sin(f * 0.08 + i * 0.6) * 3); R.bigText(t1[i], 120 + i * 10, y + 2, C(0x000000)); R.bigText(t1[i], 120 + i * 10, y, C(lerpC(0x40e040, 0xffffff, (Math.sin(f * 0.1 + i) + 1) / 4))); }
    for (var j = 0; j < t2.length; j++) { var y2 = 44 + Math.round(Math.sin(f * 0.08 + j * 0.6 + 1.5) * 3); R.bigText(t2[j], 110 + j * 10, y2 + 2, C(0x000000)); R.bigText(t2[j], 110 + j * 10, y2, C(lerpC(0xff3c8c, 0xffd040, (Math.sin(f * 0.07 + j) + 1) / 2))); }
    R.textC('A RETRO PUZZLE WHERE THE LEMMINGS WRITE THE SONG', 160, 66, C(0xd0d0d8), C(0x000000));
    if ((f >> 5) & 1) R.textC('PRESS ANY KEY OR CLICK', 160, 100, C(0xffffff), C(0x000000));
    var lv = LEVELS[G.level]; R.textC('DEMO: ' + pad2(G.level + 1) + ' ' + lv.name + ' - ' + BT.WORLDS[lv.world].name, 160, 148, C(0xffd040), C(0x000000));
    R.textC('[C] CRT  [M] MUTE  [T] MIXER', 160, 120, C(0x8090a0), C(0x000000));
  }

  /* ---- level select ---- */
  function drawSelect() {
    var f = G.frame; R.clear(C(0x0a0c14));
    for (var y = 0; y < FH; y += 2) R.rect(0, y, FW, 1, C(lerpC(0x0a0c14, 0x141a2c, (Math.sin(y * 0.05 + f * 0.03) + 1) / 2)));
    R.bigTextC('SELECT LEVEL', 160, 6, C(0xffffff), C(0x000000));
    for (var i = 0; i < LEVELS.length; i++) {
      var lv = LEVELS[i], w = BT.WORLDS[lv.world], open = i <= G.unlocked, selI = i === G.sel, ry = 22 + i * 9;
      if (selI) { R.rect(6, ry - 2, 150, 9, C(lerpC(0x000000, w.accent, 0.35))); R.text('>', 8, ry, C(0xffffff)); }
      R.text(pad2(i + 1), 16, ry, C(open ? 0xffffff : 0x50546a));
      R.text(open ? lv.name : '????????', 32, ry, C(open ? (selI ? 0xffffff : w.colors[2]) : 0x50546a));
      R.rect(146, ry, 6, 5, C(open ? w.accent : 0x30323c));
    }
    // info panel
    var L = LEVELS[G.sel], W = BT.WORLDS[L.world], ok = G.sel <= G.unlocked, px = 166, py = 22;
    R.box(px - 4, py - 4, 154, 108, C(W.accent));
    R.text('WORLD ' + (L.world + 1), px, py, C(0xa0a0a8)); R.text(W.name, px, py + 8, C(W.accent));
    R.text(W.bpm + ' BPM  ' + W.tag, px, py + 16, C(0xd0d0d8));
    if (ok) {
      R.text('LEMMINGS ' + L.lemmings + '  SAVE ' + L.need + '%', px, py + 30, C(0xd0d0d8));
      R.text('RATE ' + L.rate + '  TIME ' + L.time + ' MIN', px, py + 38, C(0xd0d0d8));
      var sk = ''; for (var s = 0; s < SKILLS.length; s++) if (L.skills[SKILLS[s]]) sk += SKILLS[s].slice(0, 3).toUpperCase() + L.skills[SKILLS[s]] + ' ';
      R.text(sk.trim(), px, py + 46, C(0xffd040));
      R.text('PASSWORD ' + L.code, px, py + 60, C(0x80ff80));
      wrapText(L.hint, px, py + 72, 29, 0xa0a0a8);
    } else { R.text('LOCKED', px, py + 30, C(0xff6060)); R.text('ENTER A PASSWORD TO WARP', px, py + 38, C(0xa0a0a8)); }
    R.text('CODE: ' + G.codeBuf + (((f >> 4) & 1) ? '_' : ' '), 166, 136, C(0xffffff));
    R.textC('UP/DOWN SELECT   ENTER PLAY   ESC TITLE', 160, 176, C(0x8090a0));
    R.textC('TYPE A PASSWORD + ENTER TO WARP', 160, 184, C(0x8090a0));
    R.textC('CRT ' + (R.crt ? 'ON' : 'OFF') + '   SOUND ' + (G.muted ? 'OFF' : 'ON') + '   UNLOCKED ' + (G.unlocked + 1) + '/' + LEVELS.length, 160, 192, C(0x60687a));
  }
  function wrapText(s, x, y, cols, col) {
    var words = String(s).split(' '), line = '', ly = y;
    for (var i = 0; i < words.length; i++) {
      if ((line + ' ' + words[i]).trim().length > cols) { R.text(line.trim(), x, ly, C(col)); ly += 7; line = ''; }
      line += ' ' + words[i];
    }
    if (line.trim()) R.text(line.trim(), x, ly, C(col));
    return ly + 7;
  }

  /* ---- level intro ---- */
  function drawIntro() {
    var L = LEVELS[G.sel], W = BT.WORLDS[L.world], f = G.frame;
    R.clear(C(W.bg[1]));
    for (var y = 0; y < FH; y++) R.rect(0, y, FW, 1, C(lerpC(W.bg[0], W.bg[1], y / FH)));
    for (var i = 0; i < 7; i++) R.rect(20 + i * 40, 150 + Math.round(Math.sin(f * 0.05 + i) * 3), 40, 50, C(shade(W.colors[i], 0.6)));
    R.bigTextC('LEVEL ' + (G.sel + 1), 160, 14, C(0xffffff), C(0x000000));
    R.bigTextC(L.name, 160, 30, C(W.accent), C(0x000000));
    R.textC(W.name + '  -  ' + W.bpm + ' BPM', 160, 48, C(0xd0d0d8), C(0x000000));
    R.textC('NUMBER OF LEMMINGS ' + L.lemmings, 160, 64, C(0xffffff), C(0x000000));
    R.textC(L.need + '% TO BE SAVED', 160, 72, C(0xffffff), C(0x000000));
    R.textC('RELEASE RATE ' + L.rate, 160, 80, C(0xffffff), C(0x000000));
    R.textC('TIME ' + L.time + ' MINUTES', 160, 88, C(0xffffff), C(0x000000));
    var sk = ''; for (var s = 0; s < SKILLS.length; s++) if (L.skills[SKILLS[s]]) sk += SKILLS[s].toUpperCase() + ' ' + L.skills[SKILLS[s]] + '  ';
    R.textC(sk.trim(), 160, 100, C(0xffd040), C(0x000000));
    R.textC('PASSWORD ' + L.code, 160, 112, C(0x80ff80), C(0x000000));
    var ly = 124, words = L.hint.split(' '), line = '';
    for (var k = 0; k < words.length; k++) { if ((line + ' ' + words[k]).trim().length > 58) { R.textC(line.trim(), 160, ly, C(0xd0d0d8), C(0x000000)); ly += 7; line = ''; } line += ' ' + words[k]; }
    if (line.trim()) R.textC(line.trim(), 160, ly, C(0xd0d0d8), C(0x000000));
    if ((f >> 5) & 1) R.textC('CLICK OR PRESS ENTER TO START', 160, 170, C(0xffffff), C(0x000000));
    R.textC('[D] WATCH DEMO   [ESC] BACK', 160, 184, C(0xa0a0a8), C(0x000000));
  }

  /* ---- results with song replay + scrolling visualizer ---- */
  var KIND_COL = { step: 0, brick: 0xffd040, climb: 0x80ff80, bash: 0xff6040, mine: 0xc0c0d0, kick: 0xffffff, snare: 0xe0e0ff, float: 0x80c0ff, exit: 0xffff80, sparkle: 0xffffff, ohno: 0xff4040, explode: 0xff8040, splat: 0x40a040, stemup: 0xffffff };
  function drawResults() {
    var res = G.result, L = LEVELS[res.level], W = BT.WORLDS[res.world], f = G.frame, acc = W.accent;
    R.clear(C(0x08080e));
    for (var y = 0; y < FH; y++) R.rect(0, y, FW, 1, C(lerpC(res.won ? 0x101a30 : 0x200a10, 0x08080e, y / FH)));
    R.bigTextC(res.won ? 'LEVEL CLEARED' : 'LEVEL FAILED', 160, 8, C(res.won ? 0x80ff80 : 0xff6060), C(0x000000));
    R.textC(pad2(res.level + 1) + ' ' + L.name + (res.demo ? '  (DEMO)' : ''), 160, 22, C(acc));
    var pct = Math.floor(res.saved * 100 / res.total), need = Math.floor(res.needed * 100 / res.total);
    R.textC('YOU RESCUED ' + pct + '%   YOU NEEDED ' + need + '%', 160, 32, C(0xffffff));
    R.textC('SAVED ' + res.saved + ' / ' + res.total + '   GROOVE ' + res.groove + '   TIME ' + fmtTime(res.frames), 160, 40, C(0xd0d0d8));
    var stTxt = 'STEMS: '; for (var i = 0; i < 5; i++) stTxt += (i < res.stems ? STEM_NAMES[i] : '----') + (i < 4 ? ' ' : '');
    R.textC(stTxt, 160, 48, C(0xffd040));
    var msg = res.won ? (pct === 100 ? 'PERFECT! THE WHOLE TRIBE IS DANCING.' : (res.stems >= 4 ? 'THE FULL MIX IS WITHIN REACH.' : 'NICE GROOVE. ON TO THE NEXT TRACK.'))
      : (res.why === 'time' ? 'THE CLOCK RAN OUT BEFORE THE DROP.' : (res.why === 'nuke' ? 'YOU NUKED THE BAND.' : 'NOT ENOUGH DANCERS MADE IT HOME.'));
    R.textC(msg, 160, 58, C(0xa0a0a8));
    // visualizer
    var vx = 8, vy = 70, vw = 304, vh = 76, pxPerBeat = 28, headX = vx + 90, beat = G.resBeat;
    R.rect(vx, vy, vw, vh, C(0x04060a)); R.box(vx - 1, vy - 1, vw + 2, vh + 2, C(0x404858));
    var b0 = beat - (headX - vx) / pxPerBeat, b1 = beat + (vx + vw - headX) / pxPerBeat;
    for (var gb = Math.ceil(b0); gb < b1; gb++) { var gx = Math.round(headX + (gb - beat) * pxPerBeat); if (gx > vx && gx < vx + vw) R.rect(gx, vy, 1, vh, C(gb % 4 === 0 ? 0x24283a : 0x141622)); }
    for (var k = 0; k < G.rec.length; k++) {
      var e = G.rec[k]; if (e.b < b0 - 1 || e.b > b1) continue;
      var ex = Math.round(headX + (e.b - beat) * pxPerBeat), col = KIND_COL[e.k] === undefined ? 0x8090a0 : KIND_COL[e.k];
      var played = e.b <= beat, bright = played && beat - e.b < 0.25;
      if (e.n !== undefined) {
        if (e.k === 'step') col = W.colors[((e.n % 12) + 12) % 12 % 7];
        var ny = vy + vh - 6 - Math.round(clamp((e.n - 36) / 60, 0, 1) * (vh - 10)), len = Math.max(3, Math.round(e.v * 8));
        var cc = bright ? 0xffffff : (played ? col : shade(col, 0.45));
        for (var xx = 0; xx < len; xx++) if (ex + xx > vx && ex + xx < vx + vw) R.rect(ex + xx, ny, 1, 3, C(cc));
      } else {
        var ly = vy + vh - 4, hh = e.k === 'kick' ? 4 : (e.k === 'snare' ? 6 : 3);
        if (ex > vx && ex < vx + vw) R.rect(ex, ly - hh, 2, hh, C(bright ? 0xffffff : (played ? col : shade(col, 0.45))));
      }
    }
    R.rect(headX, vy, 1, vh, C((f & 4) ? acc : 0xffffff));
    R.text('COMPOSED BY THE TRIBE  BEAT ' + Math.floor(beat), vx + 2, vy + 2, C(0x8090a0));
    R.textC(res.won && res.level < LEVELS.length - 1 ? 'ENTER NEXT LEVEL   R RETRY   ESC LEVEL SELECT' : 'R RETRY   ESC LEVEL SELECT   ENTER CONTINUE', 160, 156, C(0xffffff));
    if (res.won && res.level < LEVELS.length - 1) R.textC('NEXT PASSWORD ' + LEVELS[res.level + 1].code, 160, 168, C(0x80ff80));
    if (res.won && res.level === LEVELS.length - 1) R.textC('YOU FINISHED THE ALBUM. THANK YOU FOR PLAYING!', 160, 168, C(0xffd040));
    R.drawScope(audio, 232, 178, 80, 18, acc);
  }

  /* ---------------- input ---------------- */
  function toFB(e) {
    var r = canvas.getBoundingClientRect();
    G.mx = (e.clientX - r.left) * FW / r.width; G.my = (e.clientY - r.top) * FH / r.height;
    G.mouseIn = G.mx >= 0 && G.my >= 0 && G.mx < FW && G.my < FH;
  }
  function setState(s) { G.state = s; G.audioStartedFor = -1; G.codeBuf = ''; if (audio.ready && s !== 'play') { if (s === 'select' || s === 'intro') menuSong(LEVELS[G.sel].world); } }
  function leaveToSelect() { if (G.state === 'play' || G.state === 'title') audio.stopSong(); G.sim = null; G.sel = Math.min(G.sel, LEVELS.length - 1); setState('select'); audio.ui('back'); }
  function startFromIntro(demo) { startLevel(G.sel, demo, false); audio.ui('ok'); }
  function toTitle() { startLevel(Math.floor(Math.random() * LEVELS.length), true, true); G.titleT = 0; }

  canvas.addEventListener('mousemove', function (e) {
    toFB(e);
    if (G.state === 'play' && G.sim) {
      if (G.dragMini) { G.cam = clamp((G.mx - MINI_X) / MINI_W * G.sim.W - FW / 2, 0, G.sim.W - FW); }
      else if (G.rbtn) { var dx = G.mx - G.lastRX; G.cam = clamp(G.cam - dx * (G.sim.W / FW) * 0.5, 0, G.sim.W - FW); G.lastRX = G.mx; }
    } else if (G.state === 'select') { if (G.mx >= 6 && G.mx < 156 && G.my >= 20 && G.my < 20 + LEVELS.length * 9) { var s = Math.floor((G.my - 20) / 9); if (s !== G.sel && s >= 0 && s < LEVELS.length) { G.sel = s; audio.ui('select'); } } }
  });
  canvas.addEventListener('mouseleave', function () { G.mouseIn = false; G.lbtn = false; G.rbtn = false; G.dragMini = false; G.rateHold = 0; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) { if (G.state === 'play' && G.sim) { G.cam = clamp(G.cam + (e.deltaY + e.deltaX) * 0.5, 0, G.sim.W - FW); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('mousedown', function (e) {
    toFB(e); ensureAudio(); e.preventDefault();
    if (e.button === 2) { G.rbtn = true; G.lastRX = G.mx; return; }
    if (e.button !== 0) return; G.lbtn = true;
    var st = G.state;
    if (st === 'title') { setState('select'); audio.ui('ok'); return; }
    if (st === 'select') { if (G.mx >= 6 && G.mx < 156 && G.my >= 20 && G.my < 20 + LEVELS.length * 9) { var s = Math.floor((G.my - 20) / 9); if (s <= G.unlocked) { G.sel = s; setState('intro'); audio.ui('ok'); } else audio.ui('deny'); } return; }
    if (st === 'intro') { startFromIntro(false); return; }
    if (st === 'results') { resultsAction('enter'); return; }
    if (st !== 'play') return;
    var sim = G.sim, mx = G.mx, my = G.my;
    if (G.mixer && mx >= 24 && mx < 296 && my >= 8 && my < 152) { mixerClick(mx, my, false); return; }
    if (my < VH) { // play area: assign skill
      if (G.demo) return;
      var l = sim.lemmingAt(Math.round(mx + G.cam), my);
      if (l) { if (sim.assign(l.id, G.skill)) { G.hover = l; } else audio.ui('deny'); }
      return;
    }
    if (my >= BTN_Y && mx < BTN_NAMES.length * BTN_W) {
      var bi = Math.floor(mx / BTN_W), name = BTN_NAMES[bi];
      if (G.demo && name !== 'pause' && name !== 'ff') { audio.ui('deny'); return; }
      if (bi === 0) { sim.setRate(sim.rate - 1); G.rateHold = -1; G.rateHoldT = 0; audio.ui('select'); }
      else if (bi === 1) { sim.setRate(sim.rate + 1); G.rateHold = 1; G.rateHoldT = 0; audio.ui('select'); }
      else if (bi < 10) { G.skill = name; audio.ui('select'); }
      else if (name === 'pause') { G.paused = !G.paused; audio.ui('select'); }
      else if (name === 'ff') { G.ff = !G.ff; audio.ui('select'); }
      else if (name === 'nuke') { if (G.nukeArm > 0) { sim.nuke(); G.nukeArm = 0; } else { G.nukeArm = 30; banner('NUKE? CLICK AGAIN', 0xff4040, 30); } }
      return;
    }
    if (mx >= MINI_X && mx < MINI_X + MINI_W && my >= MINI_Y && my < MINI_Y + MINI_H) { G.dragMini = true; G.cam = clamp((mx - MINI_X) / MINI_W * sim.W - FW / 2, 0, sim.W - FW); }
  });
  canvas.addEventListener('mouseup', function (e) { if (e.button === 2) G.rbtn = false; if (e.button === 0) { G.lbtn = false; G.dragMini = false; G.rateHold = 0; } });
  canvas.addEventListener('auxclick', function (e) {
    if (e.button === 2 && G.state === 'play' && G.mixer && G.mx >= 24 && G.mx < 296 && G.my >= 8 && G.my < 152) mixerClick(G.mx, G.my, true);
  });
  function mixerClick(mx, my, solo) {
    var cx0 = 24 + 22, colW = 50;
    if (my >= 19 && my < 34) { var i = Math.floor((mx - cx0) / colW); if (i >= 0 && i < 5) { if (solo) audio.toggleSolo(i); else audio.toggleMute(i); audio.ui('select'); } }
  }
  function resultsAction(kind) {
    var res = G.result;
    if (kind === 'enter') { if (res.won && res.level < LEVELS.length - 1 && !res.demo) { G.sel = res.level + 1; setState('intro'); audio.ui('ok'); } else leaveToSelect(); }
    else if (kind === 'retry') { G.sel = res.level; setState('intro'); audio.ui('ok'); }
    else if (kind === 'esc') leaveToSelect();
  }

  window.addEventListener('keydown', function (e) {
    ensureAudio();
    var k = e.key, code = e.code, st = G.state;
    if (k === 'Shift') G.keys.shift = true;
    if (code === 'ArrowLeft' || (code === 'KeyA' && st === 'play')) G.keys.left = true;
    if (code === 'ArrowRight' || (code === 'KeyD' && st === 'play' && !e.shiftKey)) G.keys.right = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].indexOf(code) >= 0) e.preventDefault();
    if (e.repeat) return;
    // global toggles (not on the select screen, where letters type the password)
    if (code === 'KeyM' && st !== 'select') { G.muted = !G.muted; audio.setMuted(G.muted); save('muted', G.muted); return; }
    if (code === 'KeyC' && st !== 'select') { R.crt = !R.crt; save('crt', R.crt); document.body.classList.toggle('crt', R.crt); return; }
    if (st === 'title') { setState('select'); audio.ui('ok'); return; }
    if (st === 'select') {
      if (code === 'ArrowUp') { G.sel = (G.sel + LEVELS.length - 1) % LEVELS.length; audio.ui('select'); }
      else if (code === 'ArrowDown') { G.sel = (G.sel + 1) % LEVELS.length; audio.ui('select'); }
      else if (code === 'Escape') { toTitle(); audio.ui('back'); }
      else if (code === 'Backspace') { G.codeBuf = G.codeBuf.slice(0, -1); }
      else if (code === 'Enter' || code === 'NumpadEnter') {
        if (G.codeBuf.length) {
          var hit = -1; for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].code === G.codeBuf) hit = i;
          if (hit >= 0) { if (hit > G.unlocked) { G.unlocked = hit; save('unlocked', G.unlocked); } G.sel = hit; G.codeBuf = ''; banner('WARP!', 0xffd040, 60); setState('intro'); audio.ui('ok'); }
          else { G.codeBuf = ''; audio.ui('deny'); }
        } else if (G.sel <= G.unlocked) { setState('intro'); audio.ui('ok'); } else audio.ui('deny');
      }
      else if (/^[a-zA-Z0-9]$/.test(k) && G.codeBuf.length < 8) G.codeBuf += k.toUpperCase();
      return;
    }
    if (st === 'intro') {
      if (code === 'Escape') { setState('select'); audio.ui('back'); }
      else if (code === 'KeyD') startFromIntro(true);
      else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyS') startFromIntro(false);
      return;
    }
    if (st === 'results') {
      if (code === 'Escape') resultsAction('esc'); else if (code === 'KeyR') resultsAction('retry'); else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') resultsAction('enter');
      return;
    }
    if (st !== 'play' || !G.sim) return;
    var sim = G.sim;
    if (code === 'Escape') { leaveToSelect(); return; }
    if (code === 'KeyT') { G.mixer = !G.mixer; audio.ui('select'); return; }
    if (code === 'KeyP' || code === 'Space') { G.paused = !G.paused; audio.ui('select'); return; }
    if (code === 'KeyF') { G.ff = !G.ff; audio.ui('select'); return; }
    if (code === 'KeyD' && e.shiftKey) { startLevel(G.level, true, false); return; }
    if (code === 'KeyR') { startLevel(G.level, false, false); return; }
    if (G.demo) return;
    if (code === 'KeyN') { if (G.nukeArm > 0) { sim.nuke(); G.nukeArm = 0; } else { G.nukeArm = 40; banner('NUKE? PRESS N AGAIN', 0xff4040, 40); } return; }
    if (k === '-' || k === '_' || code === 'NumpadSubtract') { sim.setRate(sim.rate - 1); return; }
    if (k === '+' || k === '=' || code === 'NumpadAdd') { sim.setRate(sim.rate + 1); return; }
    var dm = /^Digit([1-8])$/.exec(code) || /^Numpad([1-8])$/.exec(code);
    if (dm) {
      var d = parseInt(dm[1], 10);
      if (G.mixer && d <= 5) { if (e.shiftKey) audio.toggleSolo(d - 1); else audio.toggleMute(d - 1); audio.ui('select'); }
      else { G.skill = SKILLS[d - 1]; audio.ui('select'); }
      return;
    }
  });
  window.addEventListener('keyup', function (e) {
    var code = e.code;
    if (e.key === 'Shift') G.keys.shift = false;
    if (code === 'ArrowLeft' || code === 'KeyA') G.keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') G.keys.right = false;
  });
  window.addEventListener('blur', function () { G.keys = {}; G.rbtn = false; G.lbtn = false; G.rateHold = 0; });

  /* ---------------- canvas scaling ---------------- */
  function fit() {
    var pad = 24, sw = window.innerWidth - pad, sh = window.innerHeight - pad;
    var scale = Math.max(1, Math.floor(Math.min(sw / FW, sh / FH)));
    if (scale * FW > sw || scale * FH > sh) scale = Math.max(1, scale - 1);
    canvas.style.width = (FW * scale) + 'px'; canvas.style.height = (FH * scale) + 'px';
  }
  window.addEventListener('resize', fit); fit();
  document.body.classList.toggle('crt', R.crt);

  /* ---------------- boot ---------------- */
  toTitle();
  requestAnimationFrame(loop);
  root.BT_GAME = { G: G, audio: audio, renderer: R, startLevel: startLevel };
})(window);
