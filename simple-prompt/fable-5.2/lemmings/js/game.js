/* BEAT TRIBE - game shell: screens, input, camera, clock and the main loop.
 * The simulation always advances in fixed 1/60 s steps.  How many steps are due is
 * derived from the AudioContext clock (performance.now() until audio is unlocked),
 * so the tracker and the simulation can never drift apart - fast-forward simply
 * maps two sim frames onto each 1/60 s of audio time. */
(function () {
  'use strict';
  var BT = window.BT, R = BT.Render, A = BT.Audio, S = BT.ST, Scr = BT.Screens, hex = BT.hex;
  var canvas, c2d, img, fb, wrap;
  var screen = 'title';
  var sim = null, level = null, lvIdx = 0, cam = 0, paused = false, ff = false, skill = null;
  var demo = null, demoPtr = 0, attract = false, attractIdx = 1, lastCmdLem = null;
  var parts = [], pops = [], banner = null;
  var mixer = false, crt = true, nukeArm = 0, overT = 0;
  var mouse = { x: 160, y: 100, on: false, map: false, pan: false, px: 0, moved: false };
  var keys = {};
  var hover = null, hoverN = 0, pressed = -1, holdT = 0;
  var sel = { idx: 0, codeMode: false, code: '', msg: '' };
  var save = loadSave();
  var uiT = 0, mf = 0, music = '';
  var res = null, rep = null;
  var clk = { t0: 0, f0: 0, speed: 1, src: '' };
  var vr = new BT.RNG(1991);                           // cosmetic randomness only (never the sim RNG)
  var GOLD = hex(0xffe060), WHITE = BT.WHITE;

  // ------------------------------------------------------------ persistence
  function loadSave() { try { return JSON.parse(localStorage.getItem('beattribe.v1')) || {}; } catch (e) { return {}; } }
  function storeSave() { try { localStorage.setItem('beattribe.v1', JSON.stringify(save)); } catch (e) { /* private mode */ } }

  // ------------------------------------------------------------ clock
  function nowT() { var t = A.time(); return t >= 0 ? t : performance.now() / 1000; }
  function srcNow() { return A.time() >= 0 ? 'a' : 'p'; }
  function anchor(frame, speed) {
    clk.src = srcNow(); clk.t0 = nowT(); clk.f0 = frame; clk.speed = speed;
    if (clk.src === 'a') A.setTransport(clk.t0, frame, speed);
  }
  function due(cur) {                                   // fixed steps owed since the last call
    if (srcNow() !== clk.src) anchor(cur, clk.speed);
    var n = Math.floor(clk.f0 + (nowT() - clk.t0) * 60 * clk.speed) - cur;
    if (n > 12) { anchor(cur, clk.speed); return 1; }   // tab was hidden / hiccup: drop the backlog
    return n < 0 ? 0 : n;
  }

  // ------------------------------------------------------------ flow
  function clampCam(c) { return BT.clamp(c, 0, sim.T.w - 320); }
  function firstSkill() { for (var i = 0; i < 8; i++) if (sim.skills[BT.SKILLS[i]] > 0) return BT.SKILLS[i]; return null; }
  function startLevel(i, opts) {
    opts = opts || {};
    lvIdx = i; level = BT.LEVELS[i]; sim = new BT.Sim(level);
    cam = clampCam(level.startX || 0); paused = false; ff = false; skill = firstSkill(); hover = null; hoverN = 0;
    demo = opts.demo ? (BT.SOLUTIONS[level.id] || []).slice().sort(function (a, b) { return a.frame - b.frame; }) : null;
    demoPtr = 0; attract = !!opts.attract; lastCmdLem = null;
    parts.length = 0; pops.length = 0; mixer = false; nukeArm = 0; overT = 0;
    banner = attract ? null : { txt: (demo ? 'DEMO: ' : '') + level.name, life: 170, c: hex(sim.world.accent) };
    A.setSong(level.world, 0); A.resetMixer(); A.setSilence(0);
    music = 'level';
    anchor(0, 1);
    screen = attract ? 'title' : 'play';
  }
  function startAttract() { startLevel(attractIdx, { demo: true, attract: true }); }
  function menuMusic() {
    if (music !== 'menu') { A.setSong(1, 5); A.resetMixer(); A.setSilence(0); mf = 0; music = 'menu'; anchor(0, 1); }
  }
  function goSelect() { sel.idx = lvIdx; sel.codeMode = false; sel.code = ''; sel.msg = ''; screen = 'select'; menuMusic(); }
  function goIntro(i) { lvIdx = i; level = BT.LEVELS[i]; sim = new BT.Sim(level); screen = 'intro'; menuMusic(); }
  function goResults() {
    var nx = BT.LEVELS[lvIdx + 1], b;
    res = { win: sim.win, pct: sim.pct, need: level.need, groove: sim.groove, onBeats: sim.onBeats, assigns: sim.assigns, stems: sim.stems,
      log: sim.log, stemLog: sim.stemLog, endStep: sim.endStep, world: sim.world, levelId: level.id, demo: !!demo,
      nextId: nx ? nx.id : null, nextCode: nx ? BT.levelCode(lvIdx + 1) : '' };
    if (!demo) {
      b = save[level.id];
      if (!b || sim.pct > b.pct || (sim.pct === b.pct && sim.groove > b.groove)) save[level.id] = { pct: sim.pct, groove: sim.groove, win: sim.win || !!(b && b.win) };
      else if (sim.win) b.win = true;
      storeSave();
    }
    A.sfx(sim.win ? 'win' : 'lose');
    startReplay();
    screen = 'results';
  }
  function startReplay() {
    rep = { frame: 0, step: 0, ni: 0, si: 0, lo: 0 };
    A.setSong(res.world.index, 0); A.resetMixer(); A.setSilence(0);
    music = 'replay';
    anchor(0, 1);
  }

  // ------------------------------------------------------------ cosmetics
  function spark(x, y, n, cols, spd, life) {
    for (var i = 0; i < n; i++) {
      var a = vr.next() * Math.PI * 2, s = spd * (0.3 + vr.next());
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.5, life: life * (0.5 + vr.next()), c: cols[vr.int(cols.length)], big: vr.next() > 0.7 });
    }
  }
  var BOOMC = [0x30c828, 0x4860f8, 0xf8c8a0, 0xffffff, 0xffe040, 0xff9020].map(hex);
  function handle(e) {
    switch (e.t) {
      case 'note': A.note(e); break;
      case 'sfx': A.sfx(e.n); break;
      case 'stem':
        A.setStems(e.n); A.sfx('stem');
        banner = { txt: (e.n === 5 ? '~ FULL MIX' : BT.STEMS[e.n - 1]) + ' UNLOCKED! ~', life: 170, c: GOLD };
        break;
      case 'groove':
        A.sfx('sparkle'); spark(e.x, e.y - 6, 14, [GOLD, WHITE, hex(0xff80ff)], 1.1, 34);
        pops.push({ x: e.x, y: e.y - 16, txt: '+' + e.pts + (e.combo > 1 ? ' X' + Math.min(e.combo, 5) : ''), life: 60, c: GOLD });
        break;
      case 'boom': spark(e.x, e.y, 46, BOOMC, 1.9, 60); break;
      case 'dust': spark(e.x, e.y, 2, [BT.mix(BT.degColor(sim.world, sim.mel[(e.x >> 4) % sim.mel.length]), BT.BLACK, 0.3)], 0.6, 16); break;
      case 'saved': spark(e.x, e.y - 8, 6, [hex(sim.world.accent), WHITE], 0.8, 24); break;
    }
  }
  function applyCmd(c) {
    if (sim.apply(c) && c.lemmingIndex !== undefined) lastCmdLem = sim.lems[c.lemmingIndex];
  }
  function stepSim() {
    var i, p, ev;
    if (demo) while (demoPtr < demo.length && demo[demoPtr].frame <= sim.frame) applyCmd(demo[demoPtr++]);
    sim.step();
    ev = sim.ev;
    for (i = 0; i < ev.length; i++) handle(ev[i]);
    ev.length = 0;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.07;
      if (--p.life <= 0 || p.y > 162) parts.splice(i, 1);
    }
    for (i = pops.length - 1; i >= 0; i--) { pops[i].y -= 0.25; if (--pops[i].life <= 0) pops.splice(i, 1); }
    if (banner && --banner.life <= 0) banner = null;
  }
  function pickHover() {
    hover = null; hoverN = 0;
    if (!mouse.on || mouse.y >= 160 || mixer || screen !== 'play' || demo) return;
    var wx = cam + mouse.x, wy = mouse.y, L = sim.lems, i, l, sc, best = 1e9;
    for (i = 0; i < L.length; i++) {
      l = L[i];
      if (l.st >= S.SPLAT || Math.abs(l.x - wx) > 6 || wy < l.y - 13 || wy > l.y + 4) continue;
      hoverN++;
      sc = Math.abs(l.x - wx) + Math.abs(l.y - 5 - wy) * 0.5 + (skill && sim.skills[skill] > 0 && sim.can(l, skill) ? 0 : 100);
      if (sc < best) { best = sc; hover = l; }
    }
  }
  function demoCam() {
    var t = lastCmdLem && lastCmdLem.st !== S.GONE ? lastCmdLem : null, i, L = sim.lems;
    if (!t) for (i = 0; i < L.length; i++) if (L[i].st !== S.GONE && L[i].st !== S.BLOCK) { t = L[i]; break; }
    if (t) cam += (clampCam(t.x - 160) - cam) * 0.05;
  }

  // ------------------------------------------------------------ per-frame update
  function setPaused(p) { paused = p; if (!p) anchor(sim.frame, ff ? 2 : 1); }
  function setFF(f) { ff = f; anchor(sim.frame, ff ? 2 : 1); }
  function scrollInput() {
    var d = 0;
    if (keys.ArrowLeft || (keys.KeyA && !sel.codeMode)) d -= 4;
    if (keys.ArrowRight || (keys.KeyD && !keys.ShiftLeft && !keys.ShiftRight)) d += 4;
    if (mouse.on && !mouse.pan && !mouse.map && mouse.y < 160 && !mixer) { if (mouse.x <= 2) d -= 3; else if (mouse.x >= 317) d += 3; }
    if (d) cam = clampCam(cam + d);
  }
  function updatePlay() {
    var n, i;
    if (!paused && !sim.over) {
      n = due(sim.frame);
      for (i = 0; i < n && !sim.over; i++) stepSim();
      A.pump();
      if ((sim.frame & 7) === 0 && sim.silSrc.length) {
        var a = 0, b0 = Math.floor(cam) >> 4, k;
        for (k = 0; k < 20; k++) a += sim.sil[BT.clamp(b0 + k, 0, sim.nb - 1)];
        A.setSilence(a / 20 * 0.85);
      }
    } else if (sim.over) {
      n = due(sim.frame + overT);
      for (i = 0; i < n; i++) { overT++; if (banner && --banner.life <= 0) banner = null; }
      A.pump();
      if (overT > 110) { if (attract) { attractIdx = (attractIdx + 1) % BT.LEVELS.length; startAttract(); } else goResults(); return; }
    }
    if (demo) demoCam(); else if (screen === 'play') scrollInput();
    pickHover();
    if (pressed === 0 || pressed === 1) { if (++holdT > 18 && (holdT & 1) === 0) changeRR(pressed === 0 ? -1 : 1); }
  }
  function updateMenu() { var n = due(mf); mf += n; A.pump(); }
  function updateReplay() {
    var n = due(rep.frame), sf = res.world.sf, lim, e;
    rep.frame += n;
    lim = (rep.frame + BT.LOOK) / sf;
    while (rep.ni < res.log.length && res.log[rep.ni][0] <= lim) { e = res.log[rep.ni++]; A.note({ s: e[0], v: BT.VOICES[e[1]], m: e[2], vel: e[3] / 100, d: e[4] }); }
    while (rep.si < res.stemLog.length && res.stemLog[rep.si][0] <= lim) A.setStems(res.stemLog[rep.si++][1]);
    A.pump();
    rep.step = rep.frame / sf;
    if (rep.step > res.endStep + 48) startReplay();
  }

  // ------------------------------------------------------------ drawing
  function draw() {
    var i, p, bp;
    if (screen === 'play' || screen === 'title') {
      R.playfield(sim, Math.floor(cam), { hover: hover, parts: parts });
      for (i = 0; i < pops.length; i++) { p = pops[i]; R.textC(p.txt, p.x - Math.floor(cam), p.y | 0, p.c, BT.BLACK); }
      R.panel(sim, { skill: skill, paused: paused, ff: ff, nukeArm: nukeArm > 0, hover: hover, hoverN: hoverN, cam: Math.floor(cam), an: A.analyser(), pressed: pressed, demo: !!demo });
      bp = (sim.frame % sim.bf) / sim.bf;
      if (screen === 'title') Scr.title(uiT, level, bp, A.ok());
      else {
        if (banner) Scr.banner(banner.txt, banner.c, 8);
        if (demo && !sim.over) Scr.banner('SOLUTION DEMO - D OR ESC TO STOP', (uiT >> 5) & 1 ? WHITE : GOLD, 148);
        if (sim.over) Scr.banner(sim.win ? 'THE TRIBE MADE IT!' : 'NOT ENOUGH LEMMINGS SAVED', sim.win ? GOLD : hex(0xff6060), 70);
        if (mixer) Scr.mixer(sim.world, Math.floor(sim.frame / sim.sf), A.stems(), uiT);
        else if (paused) Scr.pause(uiT, true);
      }
    } else if (screen === 'select') Scr.select(sel, save, uiT);
    else if (screen === 'intro') Scr.intro(level, sim, uiT);
    else if (screen === 'results') Scr.results(res, rep, uiT, A.analyser());
    if (A.isMuted()) R.text('MUTE', 294, 2, hex(0xff6060), BT.BLACK);
    if (mouse.on) R.cursor(mouse.x | 0, mouse.y | 0, !!hover && screen === 'play', hover ? GOLD : WHITE);
  }
  function loop() {
    requestAnimationFrame(loop);
    uiT++;
    if (screen === 'play' || screen === 'title') updatePlay();
    else if (screen === 'results') updateReplay();
    else updateMenu();
    draw();
    c2d.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------ actions
  function changeRR(d) { if (!demo && !sim.over) sim.setRR(sim.rr + d); }
  function selectSkill(k) { if (sim.skills[k] > 0) { skill = k; A.sfx('click'); } else A.sfx('deny'); }
  function tryNuke() {
    if (demo || sim.over) return;
    var t = performance.now();
    if (nukeArm && t - nukeArm < 1200) { sim.nuke(); nukeArm = 0; } else { nukeArm = t; A.sfx('click'); setTimeout(function () { if (nukeArm && performance.now() - nukeArm >= 1150) nukeArm = 0; }, 1250); }
  }
  function button(i) {
    if (i === 0) changeRR(-1); else if (i === 1) changeRR(1);
    else if (i <= 9) { if (!demo) selectSkill(BT.SKILLS[i - 2]); }
    else if (i === 10) setPaused(!paused);
    else if (i === 11) tryNuke();
    else if (i === 12) setFF(!ff);
  }
  function mapScroll() { var m = R.LAY.MAP; cam = clampCam((mouse.x - m.x) * sim.T.w / m.w - 160); }
  function confirmResults() {
    if (res.demo) goIntro(lvIdx);                       // watched the demo: now play it yourself
    else if (res.win) { if (res.nextId) goIntro(lvIdx + 1); else goSelect(); }
    else startLevel(lvIdx);
  }
  function toggleCRT() { crt = !crt; wrap.classList.toggle('crt', crt); }

  // ------------------------------------------------------------ input
  function mpos(e) {
    var r = canvas.getBoundingClientRect();
    mouse.x = BT.clamp((e.clientX - r.left) * 320 / r.width, 0, 319); mouse.y = BT.clamp((e.clientY - r.top) * 200 / r.height, 0, 199);
    mouse.on = true;
  }
  function onDown(e) {
    var i, b, cells;
    A.init(); mpos(e); e.preventDefault();
    if (screen === 'title') { goSelect(); return; }
    if (screen === 'select') {
      if (sel.codeMode) return;
      cells = Scr.selectCells();
      for (i = 0; i < cells.length; i++) {
        b = cells[i];
        if (mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h) { if (sel.idx === b.i) goIntro(b.i); else { sel.idx = b.i; A.sfx('click'); } return; }
      }
      if (mouse.y >= 116 && mouse.y < 186) goIntro(sel.idx);
      return;
    }
    if (screen === 'intro') { if (e.button === 0) startLevel(lvIdx); return; }
    if (screen === 'results') { if (e.button === 0) confirmResults(); return; }
    // play
    if (mixer) {
      b = Scr.mixerBoxes();
      for (i = 0; i < 5; i++) if (mouse.x >= b[i].x && mouse.x < b[i].x + b[i].w && mouse.y >= b[i].y && mouse.y < b[i].y + b[i].h) { if (e.button === 2 || e.shiftKey) A.toggleSolo(i); else A.toggleMute(i); A.sfx('click'); }
      return;
    }
    if (e.button === 2) { mouse.pan = true; mouse.px = mouse.x; mouse.moved = false; return; }
    if (mouse.y >= 160) {
      i = R.buttonAt(mouse.x | 0, mouse.y | 0);
      if (i >= 0) { pressed = i; holdT = 0; button(i); }
      else if (R.inMap(mouse.x, mouse.y)) { mouse.map = true; mapScroll(); }
      return;
    }
    if (demo || sim.over) return;
    if (hover && skill) { if (!sim.assign(hover.i, skill)) A.sfx('deny'); else if (sim.skills[skill] === 0) skill = firstSkill() || skill; }
  }
  function onMove(e) {
    var ox = mouse.x;
    mpos(e);
    if (screen !== 'play') return;
    if (mouse.map) mapScroll();
    if (mouse.pan) { if (Math.abs(mouse.x - mouse.px) > 1) mouse.moved = true; cam = clampCam(cam - (mouse.x - ox)); }
  }
  function onUp(e) {
    if (mouse.pan && !mouse.moved && screen === 'play' && mouse.y < 160) cam = clampCam(cam + mouse.x - 160);   // plain right-click: centre here
    mouse.map = false; mouse.pan = false; pressed = -1;
  }
  function selMove(dx, dy) {
    var cells = Scr.selectCells(), c = cells[sel.idx], i, best = -1, bd = 1e9, d;
    if (dx) { sel.idx = (sel.idx + dx + cells.length) % cells.length; }
    else {
      for (i = 0; i < cells.length; i++) {
        if ((cells[i].y - c.y) * dy <= 0) continue;
        d = Math.abs(cells[i].y - c.y) * 10 + Math.abs(cells[i].x - c.x);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) sel.idx = best;
    }
    A.sfx('click');
  }
  function onKey(e) {
    var k = e.code, i, n;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    A.init();
    keys[k] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'Backspace'].indexOf(k) >= 0) e.preventDefault();
    if (screen === 'select' && sel.codeMode) {
      if (k === 'Escape' || k === 'Tab') sel.codeMode = false;
      else if (k === 'Backspace') { sel.code = sel.code.slice(0, -1); sel.msg = ''; }
      else if (/^Key[A-Z]$/.test(k) && sel.code.length < 10) {
        sel.code += k.charAt(3); sel.msg = '';
        if (sel.code.length === 10) { i = BT.levelByCode(sel.code); if (i >= 0) { sel.codeMode = false; sel.idx = i; A.sfx('stem'); goIntro(i); } else { sel.msg = 'NO SUCH CODE'; A.sfx('deny'); } }
      }
      return;
    }
    if (e.repeat && k !== 'Minus' && k !== 'Equal' && k !== 'NumpadAdd' && k !== 'NumpadSubtract') return;
    if (k === 'KeyM') { A.setMute(!A.isMuted()); return; }
    if (k === 'KeyC') { toggleCRT(); return; }
    if (screen === 'title') { goSelect(); return; }
    if (screen === 'select') {
      if (k === 'ArrowLeft') selMove(-1, 0); else if (k === 'ArrowRight') selMove(1, 0); else if (k === 'ArrowUp') selMove(0, -1); else if (k === 'ArrowDown') selMove(0, 1);
      else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') goIntro(sel.idx);
      else if (k === 'KeyD') startLevel(sel.idx, { demo: true });
      else if (k === 'Tab') { sel.codeMode = true; sel.code = ''; sel.msg = ''; }
      else if (k === 'Escape') startAttract();
      return;
    }
    if (screen === 'intro') {
      if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') startLevel(lvIdx);
      else if (k === 'KeyD') startLevel(lvIdx, { demo: true });
      else if (k === 'Escape') goSelect();
      return;
    }
    if (screen === 'results') {
      if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') confirmResults();
      else if (k === 'KeyR') startLevel(lvIdx);
      else if (k === 'KeyD') startLevel(lvIdx, { demo: true });
      else if (k === 'Escape') goSelect();
      return;
    }
    // ---- play
    if (k === 'Escape') { goSelect(); return; }
    if (k === 'KeyT') { mixer = !mixer; A.sfx('click'); return; }
    if (mixer && /^Digit[1-5]$/.test(k)) { n = +k.charAt(5) - 1; if (e.shiftKey) A.toggleSolo(n); else A.toggleMute(n); return; }
    if (k === 'KeyP' || k === 'Space') { setPaused(!paused); return; }
    if (k === 'KeyF') { setFF(!ff); return; }
    if (k === 'KeyD') {
      if (demo) startLevel(lvIdx);                                  // stop the demo, play it yourself
      else if (e.shiftKey || paused || sim.over) startLevel(lvIdx, { demo: true });   // plain D scrolls right while playing
      return;
    }
    if (k === 'KeyR' && e.shiftKey) { startLevel(lvIdx, { demo: !!demo }); return; }
    if (demo) return;
    if (/^Digit[1-8]$/.test(k)) selectSkill(BT.SKILLS[+k.charAt(5) - 1]);
    else if (k === 'KeyN') tryNuke();
    else if (k === 'Minus' || k === 'NumpadSubtract') changeRR(-1);
    else if (k === 'Equal' || k === 'NumpadAdd') changeRR(1);
  }

  // ------------------------------------------------------------ boot
  function resize() {
    var s = Math.max(1, Math.floor(Math.min((window.innerWidth - 40) / 320, (window.innerHeight - 70) / 200)));
    canvas.style.width = 320 * s + 'px'; canvas.style.height = 200 * s + 'px';
    wrap.style.setProperty('--s', s + 'px');
  }
  function favicon() {                                  // even the tab icon is a code-drawn lemming
    try {
      var c = document.createElement('canvas'), x = c.getContext('2d'), d, cell = BT.Sprites.R.walk[0], i, col, l = document.createElement('link');
      c.width = c.height = 16; d = x.createImageData(16, 16);
      for (i = 0; i < 256; i++) { col = cell[i] ? BT.Sprites.PAL[cell[i]] : 0; d.data[i * 4] = col & 255; d.data[i * 4 + 1] = (col >> 8) & 255; d.data[i * 4 + 2] = (col >> 16) & 255; d.data[i * 4 + 3] = cell[i] ? 255 : 0; }
      x.putImageData(d, 0, 0); l.rel = 'icon'; l.href = c.toDataURL(); document.head.appendChild(l);
    } catch (e) { /* cosmetic */ }
  }
  function boot() {
    canvas = document.getElementById('screen'); wrap = document.getElementById('monitor');
    c2d = canvas.getContext('2d', { alpha: false });
    c2d.imageSmoothingEnabled = false;
    img = c2d.createImageData(320, 200);
    fb = new Uint32Array(img.data.buffer);
    R.target(fb, 320, 200);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', function () { mouse.on = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { if (screen === 'play' && !demo) { cam = clampCam(cam + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.5); e.preventDefault(); } }, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('blur', function () { keys = {}; pressed = -1; mouse.pan = false; mouse.map = false; });
    window.addEventListener('resize', resize);
    resize();
    favicon();
    startAttract();
    requestAnimationFrame(loop);
  }
  // Small hooks for automated smoke tests.
  BT.Game = {
    state: function () { return { screen: screen, level: level && level.id, frame: sim ? sim.frame : 0, saved: sim ? sim.saved : 0, over: sim ? sim.over : false, demo: !!demo, audio: A.ok(), cam: cam, stems: sim ? sim.stems : 0 }; },
    warp: function (i, d) { startLevel(i, { demo: !!d }); },
    sim: function () { return sim; },
    select: goSelect, results: function () { sim.finish(); goResults(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
