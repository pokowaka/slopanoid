/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — game.js
 * Main loop (fixed 60 Hz), screens (title/attract, level select, briefing,
 * play, demo, results + song replay), the classic bottom panel, input,
 * the T stem-mixer overlay and CRT toggle.
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT, P = BT.PAL, C = BT.hexc, ST = BT.ST;
  const PH = BT.PLAY_H;
  const canvas = document.getElementById('screen');
  const g = new BT.Gfx(canvas);
  const audio = BT.audio;
  const TICK = 1000 / 60;

  /* ---------------- palette for UI ---------------- */
  const UI = {
    bg: C(0x000000), face: C(0x2a3246), hi: C(0x6a7aa8), lo: C(0x0c1018), dim: C(0x5a6680),
    txt: C(0xe8ecff), yel: C(0xffe040), red: C(0xff4050), grn: C(0x50ff70), cyan: C(0x50e8ff),
    stem: [C(0xff5060), C(0xb070ff), C(0x50a8ff), C(0xffe040), C(0x50ffd8)],
  };
  const acc = (w) => BT.rgb(w.accent[0], w.accent[1], w.accent[2]);

  /* ---------------- persistence ---------------- */
  const SAVE_KEY = 'beattribe.v1';
  const prog = (() => {
    try { return Object.assign({ reached: 0, done: {}, crt: true }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
    catch (e) { return { reached: 0, done: {}, crt: true }; }
  })();
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(prog)); } catch (e) { /* private mode */ } };

  /* ---------------- display / CRT ---------------- */
  function fit() {
    const crt = document.body.classList.contains('crt');
    const availW = innerWidth * (crt ? 0.84 : 0.98), availH = innerHeight * (crt ? 0.8 : 0.98);
    let s = Math.min(availW / 320, availH / 200);
    s = s >= 1 ? Math.floor(s) : s;
    canvas.style.width = 320 * s + 'px';
    canvas.style.height = 200 * s + 'px';
  }
  function setCRT(on) { document.body.classList.toggle('crt', on); prog.crt = on; save(); fit(); }
  addEventListener('resize', fit);
  setCRT(prog.crt !== false);

  /* ---------------- input ---------------- */
  const input = { mx: 160, my: 100, down: false, rdown: false, keys: {}, clicks: [], keyq: [], wheel: 0, dragX: null };
  function toFB(e) {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * 320), Math.floor(((e.clientY - r.top) / r.height) * 200)];
  }
  addEventListener('mousemove', (e) => {
    const [x, y] = toFB(e);
    if (input.rdown && input.dragX !== null) { input.dragDX = (input.dragDX || 0) + (x - input.dragX); input.dragX = x; }
    input.inside = x >= 0 && x < 320 && y >= 0 && y < 200;
    input.mx = Math.max(0, Math.min(319, x)); input.my = Math.max(0, Math.min(199, y));
  });
  canvas.addEventListener('mousedown', (e) => {
    const [x, y] = toFB(e);
    input.mx = x; input.my = y;
    if (e.button === 2) { input.rdown = true; input.dragX = x; input.clicks.push({ x, y, b: 2, shift: e.shiftKey }); }
    else if (e.button === 0) { input.down = true; input.clicks.push({ x, y, b: 0, shift: e.shiftKey }); }
    unlockAudio();
    e.preventDefault();
  });
  addEventListener('mouseup', (e) => { if (e.button === 2) { input.rdown = false; input.dragX = null; } else if (e.button === 0) input.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { input.wheel += (e.deltaX || e.deltaY); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    input.keys[e.code] = true;
    input.keyq.push({ key: e.key, code: e.code, shift: e.shiftKey, repeat: e.repeat });
    unlockAudio();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'Backspace', 'Enter'].includes(e.code) || e.key === "'" || e.key === '/') e.preventDefault();
  });
  addEventListener('keyup', (e) => { input.keys[e.code] = false; });
  addEventListener('blur', () => { input.keys = {}; input.down = input.rdown = false; });
  function unlockAudio() {
    if (!audio.ctx) { audio.init(); if (run) audio.setWorld(run.def.world, run.levelIdx); }
    else if (audio.ctx.state !== 'running') audio.ctx.resume();
  }

  /* ---------------- level runs (play / demo / attract) ---------------- */
  let state = 'title', run = null, fc = 0, sel = 0, res = null, attractIdx = 0, stateT = 0;
  let codeBox = { on: false, txt: '', msg: '', msgT: 0 };
  let demoReturn = 'select';

  function newRun(levelIdx, mode) {
    const def = BT.LEVELS[levelIdx];
    const sim = new BT.Sim(def);
    const view = new BT.LevelView(sim);
    const e0 = sim.entrances[0];
    const r = {
      levelIdx, def, sim, view, mode, camX: Math.max(0, Math.min(sim.W - 320, e0.x - 160)),
      skill: Math.max(0, BT.SKILLS.findIndex((s) => sim.skills[s] > 0)), paused: false, ff: false,
      nukeArm: 0, endT: 0, cmds: [], ci: 0, hover: null, hoverN: 0, hoverOk: false, mixer: false,
      rrHold: 0, lastCmdLem: -1, lastCmdF: -999,
    };
    if (mode !== 'play') r.cmds = (BT.DEMOS[def.id] || []).slice().sort((a, b) => a.frame - b.frame);
    if (audio.ctx) audio.setWorld(def.world, levelIdx);
    return r;
  }

  function stepRun(r) {
    const sim = r.sim;
    if (!r.paused && !sim.ended) {
      const n = r.ff ? 2 : 1;
      for (let k = 0; k < n && !sim.ended; k++) {
        if (r.mode !== 'play') {
          while (r.ci < r.cmds.length && r.cmds[r.ci].frame <= sim.frame) {
            const c = r.cmds[r.ci++];
            BT.applyCommand(sim, c);
            if (c.lemmingIndex !== undefined) { r.lastCmdLem = c.lemmingIndex; r.lastCmdF = sim.frame; }
            if (c.skill && BT.SKILLS.includes(c.skill)) r.skill = BT.SKILLS.indexOf(c.skill);
          }
        }
        sim.step();
        for (const e of sim.events) r.view.onEvent(e, sim);
        audio.onSimEvents(sim.events, sim);
      }
    }
    if (!r.paused) r.view.tickVisuals();
    if (sim.ended) r.endT++;
    audio.update(sim.songStepAt(sim.frame), r.ff ? 2 : 1, r.paused);
    // the Silence muffles the whole mix when it fills the view
    if (sim.silX0 >= 0) {
      let s = 0;
      for (let x = 0; x < 320; x += 8) s += sim.sil[Math.min(sim.W - 1, Math.round(r.camX) + x)];
      audio.setMuffle((s / 40) * 0.85);
    } else audio.setMuffle(0);
    if (r.nukeArm > 0) r.nukeArm--;
  }

  function demoCamera(r) {
    const sim = r.sim;
    let tx = null;
    const recent = sim.frame - r.lastCmdF < 150 ? sim.lems[r.lastCmdLem] : null;
    const nxt = r.cmds[r.ci];
    const cand = recent && recent.st < ST.DEAD ? recent : nxt && nxt.lemmingIndex !== undefined ? sim.lems[nxt.lemmingIndex] : null;
    if (cand && cand.st < ST.DEAD && cand.st !== ST.EXIT) tx = cand.x;
    else {
      let sx = 0, n = 0;
      for (const L of sim.lems) if (L.st < ST.EXIT) { sx += L.x; n++; }
      tx = n ? sx / n : sim.entrances[0].x;
    }
    r.camX += (tx - 160 - r.camX) * 0.04;
  }

  /* ---------------- helpers ---------------- */
  const fmtTime = (frames) => { const s = Math.ceil(frames / 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function lemName(L) {
    if (L.st === ST.WALK || L.st === ST.FALL) {
      if (L.climber && L.floater) return 'ATHLETE';
      if (L.climber) return 'CLIMBER';
      if (L.floater) return 'FLOATER';
    }
    return BT.ST_NAMES[L.st];
  }
  function wrap(str, n) {
    const out = []; let line = '';
    for (const w of str.split(' ')) {
      if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function dimScreen(a, y0, y1) { g.rectBlend(0, y0 || 0, 320, (y1 || 200) - (y0 || 0), C(0x000000), a); }

  /* =====================================================================
   * PANEL
   * ===================================================================== */
  const BTN_Y = 168, BTN_W = 15, MINI = { x: 196, y: 168, w: 124, h: 20 }, SCOPE = { x: 196, y: 189, w: 124, h: 11 };
  function drawPanel(r) {
    const sim = r.sim, w = sim.world, a = acc(w);
    g.clipY1 = 200;
    g.rect(0, PH, 320, 40, UI.lo);
    // status line
    g.rect(0, PH, 320, 8, C(0x06080e));
    if (r.hover) {
      const t = lemName(r.hover) + (r.hoverN > 1 ? ' ' + r.hoverN : '') + (r.hover.bomb > 0 ? ' *' : '');
      g.text(t, 2, PH + 2, r.hoverOk ? UI.grn : UI.dim, 3);
    } else if (r.mode !== 'play') g.text((fc >> 4) & 1 ? 'DEMO' : 'SOLUTION', 2, PH + 2, UI.yel, 3);
    g.text('OUT ' + sim.outCount(), 66, PH + 2, UI.txt, 3);
    const pct = sim.savedPct();
    g.text('IN ' + pct + '%', 100, PH + 2, pct >= sim.needPct() ? UI.grn : UI.txt, 3);
    g.text('/' + sim.needPct() + '%', 132, PH + 2, UI.dim, 3);
    const tl = sim.timeLeft();
    g.text(fmtTime(tl), 158, PH + 2, tl < 1800 && (fc & 16) ? UI.red : UI.txt, 3);
    for (let c = 0; c < 5; c++) {
      const x = 186 + c * 27, on = sim.stemLevel > c;
      const flash = on && audio.ctx && r.view && Math.floor(sim.songStepAt(sim.frame)) % 4 === 0;
      g.rect(x, PH + 2, 4, 4, on ? (flash ? C(0xffffff) : UI.stem[c]) : C(0x282c38));
      g.text(BT.STEM_SHORT[c], x + 6, PH + 2, on ? UI.stem[c] : C(0x3c4254), 3);
    }
    // buttons
    for (let i = 0; i < 13; i++) {
      const x = i * BTN_W, y = BTN_Y, hot = input.my >= BTN_Y && Math.floor(input.mx / BTN_W) === i && input.mx < 13 * BTN_W;
      let face = hot ? C(0x3a4460) : UI.face;
      if (i === 11 && r.nukeArm > 0 && (fc & 8)) face = C(0x902030);
      if ((i === 10 && r.paused) || (i === 12 && r.ff)) face = C(0x3c5a3c);
      g.bevel(x, y, BTN_W, 32, face, UI.hi, UI.lo);
      if (i < 2) {
        g.textC(i === 0 ? '-' : '+', x + 8, y + 3, UI.txt, 5);
        g.textC(String(i === 0 ? sim.rrMin : sim.rr), x + 8, y + 14, i === 1 ? UI.yel : UI.dim, 3);
        g.text('RR', x + 4, y + 25, UI.dim, 3);
      } else if (i < 10) {
        const k = i - 2, sk = BT.SKILLS[k], n = sim.skills[sk];
        g.textC(n > 0 ? String(n) : '-', x + 8, y + 2, n > 0 ? UI.txt : UI.dim, 5);
        g.spr(BT.ICONS[sk], x + 1, y + 12, false, n > 0 ? null : C(0x4a5268));
        g.text(String(k + 1), x + 11, y + 26, C(0x4a5268), 3);
        if (r.skill === k) { g.frame(x, y, BTN_W, 32, (fc & 8) && r.mode === 'play' ? UI.yel : C(0xffffff)); g.frame(x + 1, y + 1, BTN_W - 2, 30, a); }
      } else if (i === 10) {
        g.rect(x + 4, y + 10, 2, 11, UI.txt); g.rect(x + 9, y + 10, 2, 11, UI.txt);
        g.text('P', x + 6, y + 25, C(0x4a5268), 3);
      } else if (i === 11) {
        g.spr(BT.ICONS.nuke, x + 3, y + 8);
        g.text(r.nukeArm > 0 ? '??' : 'N', x + (r.nukeArm > 0 ? 4 : 6), y + 25, r.nukeArm > 0 ? UI.yel : C(0x4a5268), 3);
      } else {
        for (let k = 0; k < 2; k++) for (let j = 0; j < 5; j++) g.rect(x + 2 + k * 6 + j, y + 11 + j, 1, 10 - j * 2, UI.txt);
        g.text('F', x + 6, y + 25, C(0x4a5268), 3);
      }
    }
    // minimap + scope
    g.rect(MINI.x - 1, MINI.y - 1, MINI.w + 2, 33, C(0x000000));
    r.view.drawMinimap(g, MINI.x, MINI.y, MINI.w, MINI.h, r.camX, fc);
    drawScope(SCOPE.x, SCOPE.y, SCOPE.w, SCOPE.h, a);
  }
  function drawScope(x0, y0, w, h, col) {
    g.rect(x0, y0, w, h, C(0x04060a));
    const f = audio.spectrum(), wv = audio.scope();
    if (!f) { g.rect(x0, y0 + (h >> 1), w, 1, C(0x203020)); return; }
    const bars = Math.floor(w / 3);
    for (let i = 0; i < bars; i++) {
      const bin = Math.floor(Math.pow(i / bars, 1.6) * 90) + 1;
      const v = f[bin] / 255, bh = Math.round(v * h);
      for (let j = 0; j < bh; j++) g.pset(x0 + i * 3, y0 + h - 1 - j, j > h * 0.7 ? UI.red : j > h * 0.4 ? UI.yel : col);
      for (let j = 0; j < bh; j++) g.pset(x0 + i * 3 + 1, y0 + h - 1 - j, BT.shade(col, 0.6));
    }
    let py = null;
    for (let i = 0; i < w; i++) {
      const v = wv[Math.floor((i / w) * wv.length)], y = y0 + Math.round(((255 - v) / 255) * (h - 1));
      if (py !== null) g.line(x0 + i - 1, py, x0 + i, y, C(0xffffff)); py = y;
    }
  }
  function drawCursor(onLem) {
    const x = input.mx, y = input.my, w = onLem ? C(0xffe040) : C(0xffffff), k = C(0x000000);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 2; i <= 5; i++) { g.pset(x + dx * i + dy, y + dy * i + dx, k); g.pset(x + dx * i, y + dy * i, w); }
    }
    g.pset(x, y, w);
  }

  /* ---------------- play input ---------------- */
  function selectSkill(r, k) { if (r.skill !== k) { r.skill = k; audio.ui('skill'); } }
  function tryNuke(r) {
    if (r.sim.nuking) return;
    if (r.nukeArm > 0) { r.sim.nuke(); r.nukeArm = 0; } else { r.nukeArm = 45; audio.ui('move'); }
  }
  function camTo(r, x) { r.camX = Math.max(0, Math.min(r.sim.W - 320, x)); }
  function miniToCam(r, mx) { camTo(r, ((mx - MINI.x) / MINI.w) * r.sim.W - 160); }

  function playInput(r) {
    const sim = r.sim;
    // held keys: scroll
    const sp = input.keys.ShiftLeft || input.keys.ShiftRight ? 8 : 4;
    if (input.keys.ArrowLeft || input.keys.KeyA) camTo(r, r.camX - sp);
    if (input.keys.ArrowRight || (input.keys.KeyD && !(input.keys.ShiftLeft || input.keys.ShiftRight))) camTo(r, r.camX + sp);
    if (input.dragDX) { camTo(r, r.camX - input.dragDX * 2); input.dragDX = 0; }
    if (input.wheel) { camTo(r, r.camX + input.wheel * 0.5); input.wheel = 0; }
    if (input.my < PH && !r.mixer && input.inside) { if (input.mx <= 1) camTo(r, r.camX - 5); if (input.mx >= 318) camTo(r, r.camX + 5); }
    // held mouse on minimap / RR buttons
    if (input.down && input.my >= MINI.y && input.mx >= MINI.x && input.my < MINI.y + MINI.h + 12) miniToCam(r, input.mx);
    if (input.down && input.my >= BTN_Y && input.mx < 2 * BTN_W) {
      r.rrHold++;
      if (r.rrHold > 12 && r.rrHold % 3 === 0) sim.setRR(sim.rr + (input.mx < BTN_W ? -1 : 1));
    } else r.rrHold = 0;

    for (const k of input.keyq) {
      if (r.mixer && /^Digit[1-5]$/.test(k.code)) {
        const c = +k.code[5] - 1;
        if (k.shift) audio.toggleSolo(c); else audio.toggleStemMute(c);
        continue;
      }
      if (/^Digit[1-8]$/.test(k.code)) { selectSkill(r, +k.code[5] - 1); continue; }
      switch (k.code) {
        case 'Minus': case 'NumpadSubtract': sim.setRR(sim.rr - 1); break;
        case 'Equal': case 'NumpadAdd': sim.setRR(sim.rr + 1); break;
        case 'KeyP': case 'Pause': case 'Space': if (!k.repeat) r.paused = !r.paused; break;
        case 'KeyF': r.ff = !r.ff; break;
        case 'KeyN': tryNuke(r); break;
        case 'KeyT': r.mixer = !r.mixer; break;
        case 'KeyD': if (k.shift) startDemo(r.levelIdx, 'preview'); break;
        case 'Escape': goSelect(); return;
      }
    }
    for (const c of input.clicks) {
      if (r.mixer && c.y < PH && c.y >= 16 && c.y < 26) { // mixer header
        const col = Math.floor((c.x - 22) / 59);
        if (col >= 0 && col < 5) { if (c.b === 2 || c.shift) audio.toggleSolo(col); else audio.toggleStemMute(col); }
        continue;
      }
      if (c.b === 2) { if (c.y >= MINI.y && c.x >= MINI.x) miniToCam(r, c.x); continue; }
      if (c.y >= BTN_Y && c.x < 13 * BTN_W) {
        const i = Math.floor(c.x / BTN_W);
        if (i === 0) sim.setRR(sim.rr - 1);
        else if (i === 1) sim.setRR(sim.rr + 1);
        else if (i < 10) selectSkill(r, i - 2);
        else if (i === 10) r.paused = !r.paused;
        else if (i === 11) tryNuke(r);
        else r.ff = !r.ff;
      } else if (c.y < PH) {
        const skill = BT.SKILLS[r.skill];
        const L = sim.lemAt(Math.round(r.camX) + c.x, c.y, skill);
        if (L) {
          if (!sim.assign(L.id, skill)) audio.ui('bad');
        }
      }
    }
    // hover
    r.hover = null; r.hoverN = 0;
    if (input.my < PH) {
      const wx = Math.round(r.camX) + input.mx, skill = BT.SKILLS[r.skill];
      r.hover = sim.lemAt(wx, input.my, skill);
      if (r.hover) {
        r.hoverOk = sim.skills[skill] > 0 && sim.canAssign(r.hover, skill);
        for (const L of sim.lems) if (L.st < ST.DEAD && L.st !== ST.EXIT && Math.abs(L.x - wx) <= 5 && Math.abs(input.my - (L.y - 5)) <= 7) r.hoverN++;
      }
    }
  }

  /* ---------------- stem mixer overlay ---------------- */
  function drawMixer(r) {
    g.rectBlend(2, 4, 316, 150, C(0x000008), 0.82);
    g.frame(2, 4, 316, 150, acc(r.sim.world));
    const song = audio.song || BT.compileSong(r.def.world, r.levelIdx);
    const step = Math.floor(r.sim.songStepAt(r.sim.frame));
    const oi = Math.floor(step / 64) % song.order.length, pi = song.order[oi];
    g.text('STEM MIXER', 6, 7, UI.yel, 3);
    g.text('PAT ' + String(pi).padStart(2, '0') + ' ORD ' + (oi + 1) + '/' + song.order.length + '  ' + BT.SONGS[r.def.world].title, 50, 7, UI.dim, 3);
    for (let c = 0; c < 5; c++) {
      const x = 22 + c * 59, locked = r.sim.stemLevel <= c;
      const solo = audio.solo === c, mute = audio.userMute[c] || (audio.solo >= 0 && !solo);
      g.bevel(x, 16, 56, 10, C(0x1a2030), UI.hi, UI.lo);
      g.text(BT.STEMS[c], x + 3, 18, locked ? C(0x505a70) : UI.stem[c], 3);
      g.text(solo ? 'SOLO' : mute ? 'MUTE' : locked ? 'LOCK' : 'ON', x + 37, 18, solo ? UI.yel : mute ? UI.red : locked ? C(0x505a70) : UI.grn, 3);
    }
    for (let k = -8; k <= 9; k++) {
      const s = step + k; if (s < 0) continue;
      const y = 30 + (k + 8) * 7, pat = song.pats[song.order[Math.floor(s / 64) % song.order.length]], row = s % 64;
      if (k === 0) g.rect(4, y - 1, 312, 7, C(0x283048));
      g.text(row.toString(16).toUpperCase().padStart(2, '0'), 6, y, row % 16 === 0 ? UI.yel : row % 4 === 0 ? UI.txt : UI.dim, 3);
      for (let c = 0; c < 5; c++) {
        const cell = pat.cells[c][row], x = 24 + c * 59;
        const on = r.sim.stemLevel > c && !(audio.userMute[c] || (audio.solo >= 0 && audio.solo !== c));
        const col = k === 0 ? C(0xffffff) : on ? UI.stem[c] : C(0x4a5268);
        let t = '...';
        if (cell) {
          if (c === 0) t = cell.hits.map((h) => (h.v === 'brk' ? 'B' + h.slice.toString(16).toUpperCase() : h.v.toUpperCase())).join('').slice(0, 6);
          else if (c === 2) t = BT.noteName(cell.notes[0]) + ' +' + (cell.notes.length - 1);
          else t = BT.noteName(cell.n);
          if (c === 4 && r.sim.world.key === 'jungle' && row % 8) t = '...';
        }
        g.text(t, x, y, col, 3);
      }
    }
    g.textC('1-5 MUTE   SHIFT+1-5 SOLO   CLICK HEADER   T CLOSE', 160, 150 - 4, UI.dim, 3);
  }

  /* =====================================================================
   * SCREENS
   * ===================================================================== */
  function goTitle() { state = 'title'; stateT = 0; startAttract(); }
  function startAttract() { run = newRun(attractIdx % BT.LEVELS.length, 'attract'); }
  function goSelect() {
    if (audio.ctx) audio.silenceAll();
    state = 'select'; stateT = 0; run = null; codeBox.on = false; codeBox.txt = '';
  }
  function goPreview(idx) { sel = idx; state = 'preview'; stateT = 0; run = null; if (audio.ctx) audio.silenceAll(); preview = buildPreview(idx); }
  function startPlay(idx) { run = newRun(idx, 'play'); state = 'play'; stateT = 0; audio.ui('ok'); }
  function startDemo(idx, ret) { demoReturn = ret; sel = idx; run = newRun(idx, 'demo'); state = 'demo'; stateT = 0; }

  /* ---------------- title / attract ---------------- */
  function updTitle() {
    stepRun(run); demoCamera(run);
    if (run.sim.ended && run.endT > 120 || run.sim.frame > 60 * 75) { attractIdx++; startAttract(); }
    let go = input.clicks.length > 0;
    for (const k of input.keyq) { if (k.code === 'KeyC') setCRT(!prog.crt); else if (k.code === 'KeyM') audio.toggleMute(); else if (k.code === 'KeyD') { startDemo(run.levelIdx, 'title'); return; } else go = true; }
    if (go) { audio.ui('ok'); goSelect(); }
  }
  function drawLogo(y, beat) {
    const word = 'LEMMINGS', s = 4, w = word.length * 6 * s, x0 = 160 - w / 2;
    const cols = [0x38e038, 0x70f070, 0xb0ffb0, 0x3a52f0, 0x7088ff];
    for (let i = 0; i < word.length; i++) {
      const bob = Math.round(Math.sin(fc / 9 + i * 0.7) * 2 - Math.exp(-beat * 6) * 3 * ((i & 1) ? 1 : 0.4));
      const x = x0 + i * 6 * s, yy = y + bob;
      g.text(word[i], x + 2, yy + 2, C(0x000000), 5, s);
      g.text(word[i], x, yy, C(0x16a024), 5, s);
      g.clipY1 = yy + 4 * s; g.text(word[i], x, yy, C(cols[0]), 5, s);
      g.clipY1 = yy + 2 * s; g.text(word[i], x, yy, C(cols[(i + (fc >> 3)) % 8 === 0 ? 2 : 1]), 5, s);
      g.clipY1 = 200;
    }
    g.textC('BEAT TRIBE', 160, y + 34, C(0x000000), 5, 2);
    g.textC('BEAT TRIBE', 159, y + 33, C(cols[3 + ((fc >> 4) & 1)]), 5, 2);
  }
  function drawTitle() {
    const r = run, beat = r.sim.beatPhase(r.sim.frame);
    r.camX = r.view.draw(g, r.camX, beat, fc, {});
    drawPanel(r);
    dimScreen(0.55, 4, 76);
    drawLogo(10, beat);
    g.textC('PLAYING IS COMPOSING', 160, 66, UI.yel, 3);
    const blink = (fc >> 5) & 1;
    if (blink) g.textC(audio.ctx ? 'CLICK OR PRESS ANY KEY' : 'CLICK TO START - SOUND ON!', 160, 118, UI.txt, 5, 1, C(0x000000));
    g.textC('DEMO ' + r.def.id + ' ' + r.def.name + '   [D] WATCH FULL SOLUTION', 160, 150, C(0xc0c8e0), 3, 1, C(0x000000));
  }

  /* ---------------- level select ---------------- */
  function worldColor(i) { return acc(BT.WORLDS[i]); }
  function updSelect() {
    const N = BT.LEVELS.length;
    for (const k of input.keyq) {
      if (codeBox.on) {
        if (k.code === 'Escape') { codeBox.on = false; codeBox.txt = ''; }
        else if (k.code === 'Backspace') codeBox.txt = codeBox.txt.slice(0, -1);
        else if (k.code === 'Enter') submitCode();
        else if (/^[a-zA-Z]$/.test(k.key) && codeBox.txt.length < 5) { codeBox.txt += k.key.toUpperCase(); audio.ui('move'); if (codeBox.txt.length === 5) submitCode(); }
        continue;
      }
      switch (k.code) {
        case 'ArrowUp': case 'KeyW': sel = (sel + N - 1) % N; audio.ui('move'); break;
        case 'ArrowDown': case 'KeyS': sel = (sel + 1) % N; audio.ui('move'); break;
        case 'ArrowLeft': sel = Math.max(0, sel - 3); audio.ui('move'); break;
        case 'ArrowRight': sel = Math.min(N - 1, sel + 3); audio.ui('move'); break;
        case 'Enter': case 'Space': audio.ui('ok'); goPreview(sel); return;
        case 'KeyD': startDemo(sel, 'select'); return;
        case 'KeyC': setCRT(!prog.crt); break;
        case 'KeyM': audio.toggleMute(); break;
        case 'Tab': codeBox.on = true; codeBox.txt = ''; break;
        case 'Escape': goTitle(); return;
        default:
          if (/^[a-zA-Z]$/.test(k.key)) { codeBox.on = true; codeBox.txt = k.key.toUpperCase(); }
      }
    }
    for (const c of input.clicks) {
      if (c.y >= 26 && c.y < 26 + N * 8) {
        const i = Math.floor((c.y - 26) / 8);
        if (i === sel) { audio.ui('ok'); goPreview(i); return; }
        sel = i; audio.ui('move');
      } else if (c.y >= 164 && c.y < 176) { codeBox.on = true; codeBox.txt = ''; }
    }
    if (input.my >= 26 && input.my < 26 + N * 8 && input.clicks.length === 0 && (input.mx !== lastMX || input.my !== lastMY)) {
      sel = Math.floor((input.my - 26) / 8);
    }
    lastMX = input.mx; lastMY = input.my;
    if (codeBox.msgT > 0) codeBox.msgT--;
  }
  let lastMX = -1, lastMY = -1;
  function submitCode() {
    const i = BT.LEVELS.findIndex((l) => l.code === codeBox.txt);
    if (i >= 0) {
      sel = i; prog.reached = Math.max(prog.reached, i); save();
      codeBox.msg = 'CODE ACCEPTED - WARP TO ' + BT.LEVELS[i].id; audio.ui('ok');
    } else { codeBox.msg = 'UNKNOWN CODE'; audio.ui('bad'); }
    codeBox.msgT = 120; codeBox.on = false; codeBox.txt = '';
  }
  function drawCopper() {
    for (let y = 0; y < 200; y++) {
      const t = fc / 40;
      const v = 0.5 + 0.5 * Math.sin(y / 11 + t) * Math.sin(y / 37 - t * 0.7);
      g.rect(0, y, 320, 1, BT.rgb(10 + v * 24, 6 + v * 10, 28 + v * 50));
    }
    for (let i = 0; i < 60; i++) {
      const x = (BT.hash2(i, 1, 3) * 320 + fc * (0.2 + BT.hash2(i, 2, 3))) % 320, y = BT.hash2(i, 3, 3) * 200;
      g.pset(x, y, BT.hash2(i, 4, 3) > 0.5 ? C(0x8090c0) : C(0x404870));
    }
  }
  function drawSelect() {
    drawCopper();
    g.textC('LEVEL SELECT', 160, 4, C(0x000000), 5, 2); g.textC('LEVEL SELECT', 159, 3, UI.yel, 5, 2);
    g.text('LEVEL', 16, 18, UI.dim, 3); g.text('NAME', 40, 18, UI.dim, 3); g.text('CODE', 198, 18, UI.dim, 3); g.text('BEST', 244, 18, UI.dim, 3); g.text('GROOVE', 276, 18, UI.dim, 3);
    BT.LEVELS.forEach((L, i) => {
      const y = 26 + i * 8, known = i <= prog.reached, d = prog.done[L.id], wc = worldColor(L.world);
      if (i === sel) {
        g.rectBlend(2, y - 1, 316, 8, wc, 0.35); g.frame(2, y - 1, 316, 8, wc);
        const fr = BT.SPR.walk[(fc >> 2) & 7]; g.spr(fr, 8, y + 7, false);
      }
      g.rect(4, y + 1, 2, 4, wc);
      g.text(L.id, 16, y, i === sel ? C(0xffffff) : wc, 5);
      g.text(L.name, 40, y, i === sel ? C(0xffffff) : UI.txt, 5);
      g.text(known ? L.code : '-----', 198, y, known ? UI.cyan : C(0x404860), 5);
      if (d) { g.text(d.pct + '%', 244, y, UI.grn, 5); g.text(String(d.groove), 278, y, UI.yel, 3); }
      else if (!known) g.text('WARP', 244, y + 1, C(0x505a78), 3);
    });
    const L = BT.LEVELS[sel], w = BT.WORLDS[L.world];
    g.rect(0, 156, 320, 44, C(0x05060c));
    g.text((L.world + 1) + ' ' + w.name + ' - ' + w.genre, 4, 158, worldColor(L.world), 3);
    g.text(w.scaleName + '  ' + w.bpm + ' BPM', 4, 164, UI.dim, 3);
    // code box
    const bx = 196, by = 164;
    g.bevel(bx, by - 6, 120, 13, codeBox.on ? C(0x1c2a40) : C(0x10141e), UI.hi, UI.lo);
    const shown = codeBox.on ? 'CODE ' + (codeBox.txt + ((fc >> 4) & 1 ? '_' : ' ')).padEnd(5, '.') : 'TAB: ENTER CODE';
    g.text(shown, bx + 4, by - 3, codeBox.on ? UI.yel : UI.dim, 5);
    if (codeBox.msgT > 0) g.textC(codeBox.msg, 160, 174, codeBox.msg[0] === 'U' ? UI.red : UI.grn, 3);
    g.textC('UP/DOWN + ENTER: PLAY ANY LEVEL (WARP)   D: WATCH DEMO', 160, 182, UI.txt, 3);
    g.textC('TYPE A 5-LETTER CODE TO RESTORE PROGRESS   ESC: TITLE', 160, 190, UI.dim, 3);
  }

  /* ---------------- briefing / preview ---------------- */
  let preview = null;
  function buildPreview(idx) {
    const def = BT.LEVELS[idx], sim = new BT.Sim(def), view = new BT.LevelView(sim);
    const W = 300, H = 56, img = new Uint32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = Math.floor((i * sim.W) / W), y = Math.floor((j * PH) / H), k = y * sim.W + x;
      const bgx = Math.min(view.BW - 1, Math.floor(x * 0.5));
      img[j * W + i] = sim.terrain.mat[k] ? view.tcol[k] : BT.shade(view.bg[y * view.BW + bgx], 0.6);
    }
    return { def, sim, view, img, W, H };
  }
  function updPreview() {
    for (const k of input.keyq) {
      if (k.code === 'Enter' || k.code === 'Space') { startPlay(sel); return; }
      if (k.code === 'Escape') { goSelect(); return; }
      if (k.code === 'KeyD') { startDemo(sel, 'preview'); return; }
      if (k.code === 'KeyC') setCRT(!prog.crt);
      if (k.code === 'KeyM') audio.toggleMute();
    }
    if (input.clicks.length && stateT > 10) startPlay(sel);
  }
  function drawPreview() {
    const p = preview, def = p.def, w = BT.WORLDS[def.world], a = acc(w), sim = p.sim;
    drawCopper();
    g.text('LEVEL ' + def.id, 10, 5, a, 5);
    g.text(w.name, 310 - g.textW(w.name, 3), 6, UI.dim, 3);
    g.text(def.name, 10, 15, C(0x000000), 5, 2); g.text(def.name, 9, 14, C(0xffffff), 5, 2);
    g.frame(9, 31, p.W + 2, p.H + 2, a);
    for (let j = 0; j < p.H; j++) for (let i = 0; i < p.W; i++) g.pset(10 + i, 32 + j, p.img[j * p.W + i]);
    for (const e of sim.entrances) g.rect(10 + Math.floor((e.x * p.W) / sim.W) - 1, 32 + Math.floor((e.y * p.H) / PH), 3, 2, UI.yel);
    for (const e of sim.exits) g.rect(10 + Math.floor((e.x * p.W) / sim.W) - 1, 32 + Math.floor((e.y * p.H) / PH) - 3, 3, 3, (fc >> 3) & 1 ? C(0xffffff) : UI.grn);
    const y0 = 94;
    g.text('LEMMINGS ' + def.count, 10, y0, UI.txt, 5);
    g.text('SAVE ' + def.save + ' (' + sim.needPct() + '%)', 96, y0, UI.grn, 5);
    g.text('RATE ' + def.rr, 196, y0, UI.txt, 5);
    g.text('TIME ' + fmtTime(def.time * 60), 250, y0, UI.txt, 5);
    BT.SKILLS.forEach((s, i) => {
      const x = 12 + i * 38, n = sim.skills[s];
      g.bevel(x, y0 + 11, 34, 20, n ? UI.face : C(0x141820), UI.hi, UI.lo);
      g.spr(BT.ICONS[s], x + 2, y0 + 14, false, n ? null : C(0x404860));
      g.text(String(n), x + 18, y0 + 18, n ? UI.yel : C(0x404860), 5);
    });
    const lines = wrap(def.hint, 50);
    lines.forEach((l, i) => g.text(l, 10, y0 + 38 + i * 9, C(0xd8dcf0), 5));
    if (def.silence) g.text('WARNING: THE SILENCE LURKS HERE', 10, y0 + 38 + lines.length * 9 + 1, C(0xa8a8a8), 3);
    g.text('CODE ' + def.code, 10, 184, UI.cyan, 5);
    g.text('CLICK/ENTER: PLAY   D: DEMO   ESC: BACK', 94, 186, (fc >> 5) & 1 ? UI.txt : UI.dim, 3);
  }

  /* ---------------- play ---------------- */
  function updPlay() {
    playInput(run);
    if (state !== 'play') return;
    stepRun(run);
    if (run.sim.ended && run.endT > 100) goResults(run);
  }
  function drawRun(r) {
    const beat = r.sim.beatPhase(Math.max(0, r.sim.frame - 2));
    r.camX = r.view.draw(g, r.camX, beat, fc, { hover: r.hover, hoverOk: r.hoverOk });
    // HUD: level + groove
    g.text(r.def.id + ' ' + r.def.name, 3, 3, C(0xffffff), 3, 1, C(0x000000));
    const gs = 'GROOVE ' + r.sim.groove;
    g.text(gs, 317 - g.textW(gs, 3), 3, r.sim.grooveStreak > 1 ? UI.yel : C(0xffffff), 3, 1, C(0x000000));
    if (r.sim.grooveStreak > 1) g.text('X' + Math.min(8, r.sim.grooveStreak), 317 - 12, 10, UI.yel, 3, 1, C(0x000000));
    // beat indicator
    const b = Math.floor(r.sim.songStepAt(r.sim.frame) / 4) % 4;
    for (let i = 0; i < 4; i++) g.rect(140 + i * 10, 3, 7, 3, i === b ? (i === 0 ? UI.yel : acc(r.sim.world)) : C(0x303040));
    if (r.mixer) drawMixer(r);
    if (r.paused && (fc >> 5) & 1) g.textC('PAUSED', 160, 70, UI.yel, 5, 2, C(0x000000));
    if (r.ff) g.text('>> X2', 3, 10, UI.grn, 3, 1, C(0x000000));
    if (r.sim.ended) g.textC(r.sim.endReason === 'time' ? 'TIME UP!' : 'ALL LEMMINGS ACCOUNTED FOR', 160, 70, UI.txt, 5, 1, C(0x000000));
    drawPanel(r);
  }

  /* ---------------- demo ---------------- */
  function updDemo() {
    stepRun(run); demoCamera(run);
    for (const k of input.keyq) {
      if (k.code === 'KeyF') run.ff = !run.ff;
      else if (k.code === 'KeyP') run.paused = !run.paused;
      else if (k.code === 'KeyT') run.mixer = !run.mixer;
      else if (k.code === 'KeyM') audio.toggleMute();
      else if (k.code === 'KeyC') setCRT(!prog.crt);
      else { endDemo(); return; }
    }
    if (input.clicks.length || (run.sim.ended && run.endT > 150)) endDemo();
  }
  function endDemo() {
    const idx = run.levelIdx;
    if (demoReturn === 'title') goTitle();
    else if (demoReturn === 'preview') goPreview(idx);
    else goSelect();
  }

  /* ---------------- results + song replay ---------------- */
  const RATINGS = [
    [100, 'A FLAWLESS SYMPHONY! THE WHOLE TRIBE SINGS.'],
    [80, 'WHAT A TUNE! NEARLY THE FULL ARRANGEMENT.'],
    [0, 'THE GROOVE LIVES ON. ON TO THE NEXT VERSE!'],
  ];
  function goResults(r) {
    const sim = r.sim, def = r.def;
    const passed = sim.saved >= sim.need;
    const endStep = Math.ceil(sim.songStepAt(sim.frame)) + 8;
    const rec = audio.ctx ? audio.getRecording() : { log: [], stems: [[0, sim.stemLevel]], endStep, world: def.world, level: r.levelIdx };
    rec.endStep = endStep;
    if (passed) {
      const best = prog.done[def.id];
      prog.done[def.id] = { pct: Math.max(best ? best.pct : 0, sim.savedPct()), groove: Math.max(best ? best.groove : 0, sim.groove) };
      prog.reached = Math.max(prog.reached, Math.min(BT.LEVELS.length - 1, r.levelIdx + 1));
      save();
    }
    const byStep = new Map();
    for (const e of rec.log) { if (!byStep.has(e[0])) byStep.set(e[0], []); byStep.get(e[0]).push(e); }
    res = {
      levelIdx: r.levelIdx, def, passed, pct: sim.savedPct(), need: sim.needPct(), groove: sim.groove, onBeat: sim.onBeatCount,
      stems: sim.stemLevel, reason: sim.endReason, rec, byStep, song: BT.compileSong(def.world, r.levelIdx), pos: 0, speed: 1, done: false,
      world: BT.WORLDS[def.world], notesPlayed: rec.log.length,
    };
    if (audio.ctx) { audio.silenceAll(); audio.startReplay(rec, null); }
    state = 'results'; stateT = 0; run = null;
  }
  function stemAt(stems, s) { let l = 0; for (const e of stems) if (e[0] <= s) l = e[1]; return l; }
  function updResults() {
    const R = res, N = BT.LEVELS.length;
    if (!R.done) {
      if (audio.replay) R.pos = audio.updateReplay(R.speed);
      else R.pos += (R.speed * R.song.bpm * 4) / 3600;
      if (R.pos >= R.rec.endStep) { R.done = true; audio.stopReplay(); audio.silenceAll(); }
    }
    const next = () => { audio.stopReplay(); if (R.passed && R.levelIdx < N - 1) goPreview(R.levelIdx + 1); else if (R.passed) goTitle(); else goPreview(R.levelIdx); };
    for (const k of input.keyq) {
      switch (k.code) {
        case 'Enter': next(); return;
        case 'KeyR': audio.stopReplay(); goPreview(R.levelIdx); return;
        case 'Escape': audio.stopReplay(); goSelect(); return;
        case 'KeyF': R.speed = R.speed >= 4 ? 1 : R.speed * 2; break;
        case 'Space': restartReplay(); break;
        case 'KeyM': audio.toggleMute(); break;
        case 'KeyC': setCRT(!prog.crt); break;
      }
    }
    if (input.clicks.length && stateT > 20) {
      const c = input.clicks[0];
      if (c.y >= 184) { if (c.x < 110) next(); else if (c.x < 200) { audio.stopReplay(); goPreview(R.levelIdx); } else { audio.stopReplay(); goSelect(); } }
    }
  }
  function restartReplay() {
    const R = res; R.pos = 0; R.done = false;
    if (audio.ctx) { audio.silenceAll(); audio.startReplay(R.rec, null); }
  }
  function drawResults() {
    const R = res, w = R.world, a = acc(w);
    drawCopper();
    const title = R.pct >= 100 ? 'SONG COMPLETE!' : R.passed ? 'LEVEL CLEARED!' : R.reason === 'time' ? 'OUT OF TIME...' : 'NOT ENOUGH...';
    g.textC(title, 161, 5, C(0x000000), 5, 2); g.textC(title, 160, 4, R.passed ? UI.yel : UI.red, 5, 2);
    g.text('YOU RESCUED', 40, 24, UI.txt, 5); g.text(R.pct + '%', 130, 24, R.passed ? UI.grn : UI.red, 5);
    g.text('YOU NEEDED', 174, 24, UI.txt, 5); g.text(R.need + '%', 250, 24, UI.txt, 5);
    g.text('GROOVE SCORE', 40, 34, UI.txt, 5); g.text(String(R.groove), 130, 34, UI.yel, 5);
    g.text('ON-BEAT', 174, 34, UI.txt, 5); g.text(String(R.onBeat), 250, 34, UI.yel, 5);
    for (let c = 0; c < 5; c++) {
      const x = 22 + c * 58, on = R.stems > c;
      g.bevel(x, 45, 54, 11, on ? BT.shade(UI.stem[c], 0.45) : C(0x141820), UI.hi, UI.lo);
      g.textC(BT.STEMS[c] === 'FULL' ? 'FULL MIX' : BT.STEMS[c], x + 27, 48, on ? C(0xffffff) : C(0x404860), 3);
    }
    const rating = R.passed ? RATINGS.find((q) => R.pct >= q[0])[1] : 'THE SONG FELL SILENT. TRY AGAIN!';
    g.textC(rating, 160, 60, C(0xd8dcf0), 3);
    if (R.passed && R.levelIdx < BT.LEVELS.length - 1) g.textC('NEXT LEVEL CODE: ' + BT.LEVELS[R.levelIdx + 1].code, 160, 68, UI.cyan, 5);
    else if (R.passed) g.textC('THE TRIBE HAS PLAYED ITS FINAL SYMPHONY!', 160, 68, UI.cyan, 3);
    // replay header + progress
    const sd = 60 / R.song.bpm / 4;
    g.text('YOUR MIX: ' + BT.SONGS[R.def.world].title, 8, 80, a, 3);
    const tt = fmtTime(R.pos * sd * 60) + '/' + fmtTime(R.rec.endStep * sd * 60) + (R.speed > 1 ? ' X' + R.speed : '');
    g.text(tt, 312 - g.textW(tt, 3), 80, UI.txt, 3);
    g.rect(8, 87, 304, 2, C(0x202838)); g.rect(8, 87, Math.round((304 * Math.min(R.pos, R.rec.endStep)) / R.rec.endStep), 2, a);
    drawRoll(R, 8, 91, 304, 70);
    drawScope(8, 163, 304, 16, a);
    g.rect(0, 182, 320, 18, C(0x05060c));
    g.text(R.passed ? 'ENTER: NEXT' : 'ENTER: RETRY', 8, 187, UI.txt, 5);
    g.text('R: RETRY', 118, 187, UI.txt, 5);
    g.text('ESC: MENU', 206, 187, UI.txt, 5);
    g.text('F:SPEED SPC:REPLAY', 206, 195 - 1, UI.dim, 3);
  }
  /* scrolling piano-roll of the backing stems + every lemming-made note */
  function drawRoll(R, x0, y0, w, h) {
    g.rect(x0, y0, w, h, C(0x04050a));
    const px = 3, head = x0 + Math.round(w * 0.72), pos = R.pos;
    const s0 = Math.floor(pos - (head - x0) / px) - 16, s1 = Math.ceil(pos + (x0 + w - head) / px);
    const noteY = (m) => y0 + h - 12 - Math.max(0, Math.min(h - 14, Math.round((m - 26) * ((h - 14) / 80))));
    for (let s = Math.max(0, s0); s <= s1; s++) {
      if (s % 16 === 0) { const x = head + Math.round((s - pos) * px); if (x >= x0 && x < x0 + w) g.rect(x, y0, 1, h, C(0x141a2a)); }
    }
    const bar = (s, len, m, col, hh) => {
      const x = head + Math.round((s - pos) * px), xe = x + Math.max(2, len * px - 1), y = noteY(m);
      const lit = s <= pos && s + len > pos;
      const c = lit ? BT.mix(col, C(0xffffff), 0.6) : s + len <= pos ? BT.shade(col, 0.55) : col;
      const xa = Math.max(x0, x), xb = Math.min(x0 + w, xe);
      if (xb > xa) g.rect(xa, y - (hh >> 1), xb - xa, hh, c);
    };
    const song = R.song;
    for (let s = Math.max(0, s0); s <= s1 && s < R.rec.endStep; s++) {
      const lvl = stemAt(R.rec.stems, s), pat = song.pats[song.order[Math.floor(s / 64) % song.order.length]], row = s % 64;
      const dc = pat.cells[0][row];
      if (dc && (lvl > 0 || (lvl === 0 && row % 2 === 0))) {
        const x = head + Math.round((s - pos) * px);
        if (x >= x0 && x < x0 + w) dc.hits.forEach((hit, i) => {
          const c = lvl > 0 ? UI.stem[0] : C(0x503038);
          g.rect(x, y0 + h - 3 - i * 3, 2, 2, s <= pos && s > pos - 1.5 ? C(0xffffff) : c);
        });
      }
      for (let c = 1; c < 5; c++) {
        if (lvl <= c) continue;
        const cell = pat.cells[c][row];
        if (!cell) continue;
        if (c === 2) for (const n of cell.notes) bar(s, cell.len, n, UI.stem[2], 1);
        else if (c === 4) { if (row % 2 === 0) bar(s, 1, cell.n, UI.stem[4], 1); }
        else bar(s, cell.len, cell.n, UI.stem[c], c === 1 ? 2 : 2);
      }
      const list = R.byStep.get(s);
      if (list) for (const e of list) {
        const m = e[2];
        const deg = R.world.scale.indexOf((((m - R.world.root) % 12) + 12) % 12);
        const wc = R.world.deg[Math.max(0, deg) % R.world.deg.length];
        const col = e[1] === 'drone' ? C(0xff8030) : BT.rgb(wc[0], wc[1], wc[2]);
        bar(s, Math.min(e[4], 16), m, col, e[1] === 'drone' ? 2 : 3);
      }
    }
    g.rect(head, y0, 1, h, C(0xffffff));
    g.frame(x0 - 1, y0 - 1, w + 2, h + 2, C(0x283048));
    g.text('LEMMINGS', x0 + 2, y0 + 2, C(0x8890a8), 3);
    g.text('+ STEMS', x0 + 36, y0 + 2, C(0x505a78), 3);
  }

  /* =====================================================================
   * MAIN LOOP (fixed 60 Hz simulation, render on rAF)
   * ===================================================================== */
  function update() {
    fc++; stateT++;
    // global keys
    for (const k of input.keyq) {
      if (k.code === 'KeyM' && (state === 'play')) audio.toggleMute();
      if (k.code === 'KeyC' && state === 'play') setCRT(!prog.crt);
    }
    switch (state) {
      case 'title': updTitle(); break;
      case 'select': updSelect(); break;
      case 'preview': updPreview(); break;
      case 'play': updPlay(); break;
      case 'demo': updDemo(); break;
      case 'results': updResults(); break;
    }
    input.keyq.length = 0; input.clicks.length = 0;
  }
  function render() {
    g.clipY1 = 200;
    g.clear(UI.bg);
    let onLem = false;
    switch (state) {
      case 'title': drawTitle(); break;
      case 'select': drawSelect(); break;
      case 'preview': drawPreview(); break;
      case 'play': drawRun(run); onLem = !!run.hover; break;
      case 'demo':
        drawRun(run);
        if ((fc >> 5) & 1) g.textC('SOLUTION DEMO - PRESS ANY KEY', 160, 20, UI.yel, 5, 1, C(0x000000));
        break;
      case 'results': drawResults(); break;
    }
    if (audio.muted) g.text('MUTE', 300, 190, UI.red, 3);
    drawCursor(onLem);
    g.present();
  }
  let last = performance.now(), accum = 0;
  function frame(now) {
    accum += now - last; last = now;
    if (accum > 250) accum = 250;       // tab was hidden: don't spiral
    let n = 0;
    while (accum >= TICK - 0.5 && n < 4) { update(); accum -= TICK; n++; }
    if (accum < 0) accum = 0;
    render();
    requestAnimationFrame(frame);
  }
  goTitle();
  requestAnimationFrame(frame);
  BT.game = { get state() { return state; }, get run() { return run; }, input, prog };
})(window);
