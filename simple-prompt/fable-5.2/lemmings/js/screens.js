/* BEAT TRIBE - full-screen UI: title overlay, level select / warp / passwords,
 * level intro card, results + song-replay visualizer, stem mixer, pause.
 * Pure drawing from plain state objects (so it can be rendered headlessly too). */
(function (g) {
  'use strict';
  var BT = g.BT, R = BT.Render, hex = BT.hex, mix = BT.mix, WHITE = BT.WHITE, BLACK = BT.BLACK, SP = BT.Sprites;
  var Scr = BT.Screens = {};
  var TXT = hex(0xd8d8f0), DIM = hex(0x7878a0), GOLD = hex(0xffe060), RAIN = BT.WORLDS[2].degCols;

  // Classic 10-letter level codes.
  var ALPHA = 'BCDFGHJKLMNPQRSTVWXZ';
  BT.levelCode = function (i) {
    var r = new BT.RNG(0xBEA7 + i * 7919), s = '', k;
    for (k = 0; k < 10; k++) s += ALPHA.charAt(r.int(20));
    return s;
  };
  BT.levelByCode = function (code) {
    for (var i = 0; i < BT.LEVELS.length; i++) if (BT.levelCode(i) === code) return i;
    return -1;
  };

  function backdrop(t, c1, c2) {
    var y, x, k;
    for (y = 0; y < 200; y++) {
      k = mix(hex(c1), hex(c2), y / 200);
      R.rect(0, y, 320, 1, k);
    }
    for (x = 0; x < 320; x += 16) for (y = 0; y < 200; y += 16) if (((x + y) >> 4) & 1) R.shade(x, y, 16, 16, WHITE, 0.018);
    for (x = 0; x < 40; x++) {                                   // drifting note sparks
      k = (x * 53 + ((t * (0.3 + (x % 5) * 0.12)) | 0)) % 320; y = (x * 37 + ((t * 0.1 * (1 + x % 3)) | 0)) % 200;
      R.px(k, 199 - y, mix(RAIN[x % 7], BLACK, 0.45));
    }
  }
  function box(x, y, w, h, c) { R.rect(x, y, w, h, hex(0x0c0c18)); R.frame(x, y, w, h, c || hex(0x5050a0)); }
  function skillRow(x, y, sk) {
    var IC = [SP.R.climb[0], SP.R.float[0], SP.R.ohno[1], SP.R.block[2], SP.R.build[0], SP.R.bash[0], SP.R.mine[2], SP.R.dig[2]], i, n;
    for (i = 0; i < 8; i++) {
      n = sk[BT.SKILLS[i]] || 0;
      R.rect(x + i * 18, y, 17, 27, hex(n ? 0x24243c : 0x14141e));
      R.cell(IC[i], x + i * 18, y + 10, n ? SP.PAL : SP.PAL_GREY);
      R.textC(n ? String(n) : '-', x + i * 18 + 8, y + 2, n ? TXT : DIM);
    }
  }
  function timeStr(sec) { var s = sec % 60; return ((sec / 60) | 0) + '-' + (s < 10 ? '0' : '') + s; }

  // ------------------------------------------------------------ title (drawn over the attract demo)
  Scr.title = function (t, level, bp, audioOn) {
    var pulse = Math.max(0, 1 - bp * 2.5);
    R.shade(0, 0, 320, 80, BLACK, 0.62);
    R.rect(0, 80, 320, 1, hex(0x5050a0));
    R.big('BEAT TRIBE', 42, 8, 4, function (r, i) { return mix(RAIN[(r + ((t / 8) | 0) + i) % 7], WHITE, pulse * 0.35); }, hex(0x101020));
    R.textC('LEMMINGS, BUT THE LEVEL IS THE SEQUENCER', 160, 42, TXT, BLACK);
    R.textC('~ PLAYING IS COMPOSING ~', 160, 53, GOLD, BLACK);
    if ((t >> 5) & 1) R.textC(audioOn ? 'PRESS ANY KEY OR CLICK TO START' : 'CLICK OR PRESS ANY KEY - SOUND ON!', 160, 67, WHITE, BLACK);
    R.shade(0, 148, 320, 12, BLACK, 0.5);
    R.text('ATTRACT DEMO  ' + level.id + ' ' + level.name, 4, 150, hex(0x90e8a0), BLACK);
  };

  // ------------------------------------------------------------ level select / warp / codes
  // sel: { idx, codeMode, code, msg }   save: { [id]: {pct, groove, win} }
  Scr.selectCells = function () {
    var cells = [], i, lv, k = 0, w = -1;
    for (i = 0; i < BT.LEVELS.length; i++) {
      lv = BT.LEVELS[i];
      if (lv.world !== w) { w = lv.world; k = 0; }
      cells.push({ i: i, x: 190 + k * 42, y: 19 + w * 16, w: 38, h: 13 });
      k++;
    }
    return cells;
  };
  Scr.select = function (sel, save, t) {
    var cells = Scr.selectCells(), i, c, lv, w, on, sv, ac, wd;
    backdrop(t, 0x0a0a22, 0x1c0c2c);
    R.textC('LEVEL SELECT ~ WARP ANYWHERE', 160, 6, GOLD, BLACK);
    for (w = 0; w < BT.WORLDS.length; w++) {
      wd = BT.WORLDS[w];
      R.text((w ? 'W' + w + ' ' : '   ') + wd.name, 8, 22 + w * 16, hex(wd.accent), BLACK);
    }
    for (i = 0; i < cells.length; i++) {
      c = cells[i]; lv = BT.LEVELS[i]; on = i === sel.idx; sv = save[lv.id]; ac = hex(BT.WORLDS[lv.world].accent);
      R.bevel(c.x, c.y, c.w, c.h, on ? mix(ac, hex(0x202038), 0.45) : hex(0x202038), on ? WHITE : hex(0x6060a0), hex(0x08080e));
      R.textC(lv.id, c.x + 17, c.y + 3, on ? WHITE : TXT);
      if (sv && sv.win) R.text('*', c.x + c.w - 8, c.y + 3, GOLD);
    }
    lv = BT.LEVELS[sel.idx]; wd = BT.WORLDS[lv.world]; ac = hex(wd.accent); sv = save[lv.id];
    box(4, 116, 312, 70, ac);
    R.text(lv.id + '  ' + lv.name, 10, 120, ac);
    R.text(lv.num + ' LEMMINGS  SAVE ' + lv.need + '%  TIME ' + timeStr(lv.time), 10, 131, TXT);
    R.text('RATE ' + lv.rr, 10, 141, TXT);
    if (lv.silence) R.text('+ THE SILENCE', 64, 141, hex(0xb0b0b8));
    skillRow(166, 139, lv.skills);
    R.text(wd.genre, 10, 152, DIM);
    R.text(wd.bpm + ' BPM ' + wd.scaleName, 10, 162, DIM);
    R.text('CODE ' + BT.levelCode(sel.idx), 10, 174, GOLD);
    R.text(sv ? 'BEST ' + sv.pct + '%  ~' + sv.groove : 'NOT PLAYED YET', 124, 174, sv && sv.win ? hex(0x60ff60) : DIM);
    R.textC('ENTER PLAY   D DEMO   TAB CODE   ESC TITLE', 160, 190, TXT);
    if (sel.codeMode) {
      box(70, 78, 180, 34, GOLD);
      R.textC('ENTER LEVEL CODE', 160, 83, GOLD);
      var s = sel.code; while (s.length < 10) s += '_';
      R.textC(s, 160, 96, WHITE);
      if (sel.msg) R.textC(sel.msg, 160, 104, hex(0xff6060));
    }
  };

  // ------------------------------------------------------------ level intro card
  Scr.intro = function (level, sim, t) {
    var wd = BT.WORLDS[level.world], ac = hex(wd.accent), T = sim.T, x, y, i, n, c, lx, ly, sx, sy, w = 300, h = 60;
    backdrop(t, 0x06061a, 0x101030);
    R.text(wd.index ? 'WORLD ' + wd.index + ' - ' + wd.name : wd.name, 10, 6, ac, BLACK);
    R.big('LEVEL ' + level.id, 10, 18, 2, WHITE, hex(0x202040));
    R.textR(level.name, 310, 22, GOLD, BLACK);
    box(9, 37, w + 2, h + 2, ac);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {              // terrain preview
      lx = (x * T.w / w) | 0; ly = (y * 160 / h) | 0; n = 0; c = 0;
      for (sy = 0; sy < 3; sy++) for (sx = 0; sx < T.w / w; sx += 1) { i = (ly + sy) * T.w + lx + (sx | 0); if (T.mat[i]) { n++; c = T.col[i]; } }
      if (n) R.px(10 + x, 38 + y, c);
    }
    sim.objs.liquids.forEach(function (z) { for (x = (z.x0 * w / T.w) | 0; x < (z.x1 * w / T.w) | 0; x++) for (y = (z.y * h / 160) | 0; y < h; y++) if (R.fb[(38 + y) * 320 + 10 + x] === hex(0x0c0c18)) R.px(10 + x, 38 + y, hex(z.kind === 'water' ? 0x2858c8 : 0xd04810)); });
    var e = sim.objs.exit, ht = sim.objs.hatch, bl = (t >> 4) & 1;
    R.rect(10 + ((ht.x * w / T.w) | 0) - 3, 38 + ((ht.y * h / 160) | 0), 7, 2, WHITE);
    R.text('IN', 10 + ((ht.x * w / T.w) | 0) - 5, 38 + ((ht.y * h / 160) | 0) - 9, WHITE, BLACK);
    R.rect(10 + ((e.x * w / T.w) | 0) - 2, 38 + ((e.y * h / 160) | 0) - 4, 5, 5, bl ? GOLD : hex(0xc08020));
    R.text('OUT', 10 + BT.clamp(((e.x * w / T.w) | 0) - 8, 0, w - 18), 38 + ((e.y * h / 160) | 0) - 14, GOLD, BLACK);
    R.text('NUMBER OF LEMMINGS ' + level.num, 10, 104, hex(0x60a0ff));
    R.text(level.need + '% TO BE SAVED', 10, 114, hex(0x60ff60));
    R.text('RELEASE RATE ' + level.rr, 10, 124, hex(0xffa040));
    R.text('TIME ' + timeStr(level.time), 10, 134, hex(0x40e0e0));
    R.text(wd.bpm + ' BPM ' + wd.scaleName, 10, 144, hex(0xe060d8));
    skillRow(170, 104, level.skills);
    R.text('CODE ' + BT.levelCode(level.index), 170, 136, GOLD);
    if (level.silence) R.text('BEWARE THE SILENCE', 170, 146, hex(0xb0b0b8));
    R.textC(level.hint || '', 160, 160, WHITE, BLACK);
    if ((t >> 5) & 1) R.textC('SPACE OR CLICK TO PLAY', 160, 174, GOLD);
    R.textC('D WATCH THE SOLUTION DEMO   ESC BACK', 160, 188, DIM);
  };

  // ------------------------------------------------------------ results + song replay visualizer
  function remark(res) {
    if (!res.win) return res.pct === 0 ? 'ROCK BOTTOM. NOT ONE LEMMING HOME.' : res.pct < res.need - 20 ? 'THE BAND FELL APART. TRY AGAIN.' : 'SO CLOSE! A FEW MORE VOICES NEEDED.';
    if (res.pct === 100) return 'SUPERB! THE FULL ARRANGEMENT PLAYS!';
    if (res.pct >= res.need + 10) return 'A FINE GROOVE. MORE THAN ENOUGH!';
    return 'JUST ENOUGH TO KEEP THE BEAT ALIVE.';
  }
  var VCOL = [0, 0xf8f8f8, 0x90d0ff, 0xffe060, 0xff9040, 0xc0c0d0, 0xff5050, 0xf0f0f0, 0xffffff, 0xff80ff, 0x60ff90, 0xb0b0b0, 0x8060c0].map(hex);
  /* res: { win, pct, need, groove, onBeats, assigns, stems, log, stemLog, endStep, world, levelId, nextCode, nextId }
   * rep: { step (float), playing } */
  Scr.results = function (res, rep, t, an) {
    var wd = res.world, ac = hex(wd.accent), i, e, x, y, v, c, log = res.log, cur = rep.step, X0 = 6, Y0 = 82, VW = 308, VH = 80, PH = 104, pxs = 2;
    backdrop(t, res.win ? 0x081c18 : 0x200c10, 0x0c0c20);
    if (res.demo) R.text('DEMO', 4, 4, GOLD, BLACK);
    R.big(res.win ? 'LEVEL COMPLETE' : 'LEVEL FAILED', res.win ? 76 : 88, 5, 2, res.win ? function (r, k) { return RAIN[(r + k) % 7]; } : hex(0xff6060), BLACK);
    R.textC(remark(res), 160, 24, TXT, BLACK);
    R.text('YOU NEEDED  ' + res.need + '%', 30, 37, TXT);
    R.text('YOU RESCUED ' + res.pct + '%', 30, 47, res.win ? hex(0x60ff60) : hex(0xff6060));
    R.text('GROOVE SCORE ~' + res.groove, 170, 37, GOLD);
    R.text('ON-BEAT ' + res.onBeats + '/' + res.assigns, 170, 47, GOLD);
    for (i = 0; i < 5; i++) R.text(BT.STEMS[i], 12 + [0, 44, 80, 128, 164][i], 59, i < res.stems ? ac : hex(0x404058));
    R.text('~' + (res.stems === 5 ? ' FULL SONG!' : ' ' + res.stems + '/5 STEMS'), 230, 59, res.stems === 5 ? GOLD : DIM);
    R.text('THE SONG YOU COMPOSED', X0, 72, DIM);
    // piano roll: 2px per 1/16 step, playhead fixed, notes scroll right-to-left
    box(X0 - 1, Y0 - 1, VW + 2, VH + 2, ac);
    var s0 = cur - PH / pxs, s1 = cur + (VW - PH) / pxs, bar;
    for (bar = Math.ceil(s0 / 16) * 16; bar < s1; bar += 16) {
      x = X0 + Math.round((bar - s0) * pxs);
      if (bar >= 0 && x >= X0 && x < X0 + VW) R.rect(x, Y0, 1, VH, bar % 64 === 0 ? hex(0x30305c) : hex(0x1a1a30));
    }
    for (i = 0; i < res.stemLog.length; i++) {
      x = X0 + Math.round((res.stemLog[i][0] - s0) * pxs);
      if (x >= X0 && x < X0 + VW - 2) { R.rect(x, Y0, 1, VH, ac); R.text(BT.STEMS[res.stemLog[i][1] - 1].slice(0, 5), Math.min(x + 2, X0 + VW - 32), Y0 + 2, ac); }
    }
    var root = wd.root % 12, sc = wd.scale, deg, k, n = log.length, lo = rep.lo || 0;
    while (lo < n && log[lo][0] < s0 - 8) lo++;
    rep.lo = lo;
    for (i = lo; i < n; i++) {
      e = log[i]; if (e[0] > s1) break;
      x = X0 + Math.round((e[0] - s0) * pxs); v = e[1];
      if (x < X0 || x >= X0 + VW - 1) continue;
      if (v === 6 || v === 7 || v === 8 || v === 11) { y = Y0 + VH - 3 - (v === 6 ? 0 : v === 7 ? 3 : v === 8 ? 6 : 9); c = VCOL[v]; }
      else {
        y = Y0 + VH - 14 - BT.clamp(Math.round((e[2] - 30) * 0.92), 0, VH - 16);
        if (v === 0) { deg = 0; for (k = 0; k < sc.length; k++) if ((((e[2] - root) % 12) + 12) % 12 === sc[k]) deg = k; c = BT.degColor(wd, deg); } else c = VCOL[v];
      }
      if (e[0] > cur) c = mix(c, BLACK, 0.55); else if (cur - e[0] < 2) c = WHITE;
      R.rect(x, y, Math.max(2, Math.min(e[4], 8) * pxs - 1), 2, c);
    }
    R.rect(X0 + PH, Y0, 1, VH, WHITE);
    if (an && an.freq) for (x = 0; x < VW; x += 3) {               // live spectrum under the roll
      v = an.freq[Math.min(an.freq.length - 1, 1 + ((x / VW) * an.freq.length * 0.55) | 0)] / 255;
      R.shade(X0 + x, Y0 + VH - Math.round(v * 22), 2, Math.round(v * 22), ac, 0.35);
    }
    var sd = wd.sf / 60, tot = Math.round(res.endStep * sd), now = Math.round(BT.clamp(cur, 0, res.endStep) * sd);
    R.text('~ REPLAY ' + timeStr(now) + ' / ' + timeStr(tot), X0, 166, ac);
    if (res.win && res.nextId) R.textR('CODE ' + res.nextId + ' ' + res.nextCode, 314, 166, GOLD);
    R.textC((res.demo ? 'ENTER PLAY IT' : res.win ? (res.nextId ? 'ENTER NEXT LEVEL' : 'ENTER LEVELS') : 'ENTER RETRY') + '   R RETRY   D DEMO   ESC LEVELS', 160, 186, TXT);
  };

  // ------------------------------------------------------------ stem mixer + live pattern rows
  Scr.mixerBoxes = function () { var b = [], i; for (i = 0; i < 5; i++) b.push({ x: 14 + i * 59, y: 22, w: 56, h: 22 }); return b; };
  Scr.mixer = function (world, step, stems, t) {
    var song = world.song, p = BT.songPos(song, step), i, r, ci, ch, cell, y, x, st, c, ac = hex(world.accent), bx = Scr.mixerBoxes();
    var any = stems.solo.some(function (s, k) { return s && k < stems.unlocked; });
    R.shade(0, 0, 320, 160, BLACK, 0.5);
    box(8, 6, 304, 150, ac);
    R.text('STEM MIXER [T]', 14, 10, ac);
    R.textR('PATTERN ' + p.pat + '  ORDER ' + (p.ord + 1) + '/' + song.order.length + '  ROW ' + (p.row < 10 ? '0' : '') + p.row, 306, 10, TXT);
    for (i = 0; i < 5; i++) {
      st = i >= stems.unlocked ? 'LOCKED' : stems.mute[i] ? 'MUTE' : stems.solo[i] ? 'SOLO' : any ? 'OFF' : 'ON';
      c = st === 'LOCKED' ? hex(0x404058) : st === 'MUTE' || st === 'OFF' ? hex(0xff5050) : st === 'SOLO' ? GOLD : ac;
      R.bevel(bx[i].x, bx[i].y, bx[i].w, bx[i].h, hex(0x181828), c, hex(0x08080e));
      R.text((i + 1) + ' ' + BT.STEMS[i].split(' ')[0], bx[i].x + 3, bx[i].y + 3, c);
      R.text(st, bx[i].x + 3, bx[i].y + 12, c);
    }
    R.text('1-5 MUTE  SHIFT+1-5 SOLO  (OR CLICK/RIGHT-CLICK)', 14, 47, DIM);
    for (ci = 0; ci < song.chans.length; ci++) {
      ch = song.chans[ci]; x = 34 + ci * 30;
      st = ch.stem < stems.unlocked && !stems.mute[ch.stem] && (!any || stems.solo[ch.stem]);
      R.text(ch.n, x, 58, st ? ac : hex(0x505068));
    }
    R.rect(12, 68 + 4 * 9 - 1, 296, 9, hex(0x30306c));
    for (r = 0; r < 9; r++) {
      y = 68 + r * 9;
      var pp = BT.songPos(song, step + r - 4), rr = song.rows[pp.pat];
      R.text((pp.row < 10 ? '0' : '') + pp.row, 14, y, (pp.row & 3) === 0 ? TXT : DIM);
      for (ci = 0; ci < song.chans.length; ci++) {
        ch = song.chans[ci]; cell = rr[ci][pp.row]; x = 34 + ci * 30;
        st = ch.stem < stems.unlocked && !stems.mute[ch.stem] && (!any || stems.solo[ch.stem]);
        c = !st ? hex(0x404058) : r === 4 ? WHITE : TXT;
        R.text(cell ? cell.txt : '...', x, y, cell ? c : hex(0x343450));
      }
    }
  };

  Scr.pause = function (t, demoHint) {
    R.shade(0, 56, 320, 44, BLACK, 0.6);
    R.big('PAUSED', 106, 62, 3, GOLD, BLACK);
    R.textC(demoHint ? 'P RESUME   D WATCH DEMO   ESC LEVELS' : 'P RESUME   ESC LEVELS', 160, 88, TXT, BLACK);
  };
  Scr.banner = function (txt, c, y) {
    var w = BT.Font.width(txt) + 12;
    R.shade(160 - (w >> 1), y - 3, w, 13, BLACK, 0.6);
    R.textC(txt, 160, y, c, BLACK);
  };
})(typeof window !== 'undefined' ? window : globalThis);
