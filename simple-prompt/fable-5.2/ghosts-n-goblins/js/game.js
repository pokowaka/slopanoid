/*
 * game.js — the arcade cabinet's brain: title / stage-warp / parchment world map / play / pause /
 * game over / ending state machine, the HUD, score keeping, and the boot code.
 */
(function () {
  'use strict';
  const GNG = window.GNG;
  const C = GNG.C, fb = GNG.fb, Input = GNG.Input;
  const SW = 320, SH = 200;
  const BK = { outline: C.black };
  const CENTER = { align: 'center', outline: C.black };

  const game = GNG.game = {
    state: 'title', t: 0, st: 0,
    score: 0, hiscore: 20000, lives: 3, weapon: 'lance', stage: 0, checkpoint: null, nextMode: 'steel',
    hintsSeen: {}, stats: { hostKills: 0, magic: 0, deaths: 0, frames: 0 }, flipT: 0,
    world: null, paused: false, trans: null, backdrops: {}, crt: true,
    menuI: 0, warpI: 0, helpPage: 0, titleArt: null, mapArt: null, continueT: 0
  };

  /* ------------------------------------------------------------------ persistence (hi-score only) */
  function loadHi() {
    try {
      const v = parseInt(window.localStorage.getItem('gng_museum_hiscore'), 10);
      if (Number.isFinite(v) && v > 0 && v < 1e9) game.hiscore = Math.max(game.hiscore, v);
    } catch (e) { /* storage unavailable: keep the default */ }
  }
  function saveHi() {
    try { window.localStorage.setItem('gng_museum_hiscore', String(game.hiscore | 0)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ helpers */
  function pad(n, w) { let s = String(Math.max(0, n | 0)); while (s.length < w) s = '0' + s; return s; }
  function wrap(str, max) {
    const words = String(str).split(' '), lines = []; let cur = '';
    for (const w of words) {
      if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function panel(x, y, w, h, border) {
    fb.rect(x, y, w, h, C.black);
    fb.frame(x, y, w, h, border || C.gold[4]);
    fb.pset(x, y, C.black); fb.pset(x + w - 1, y, C.black); fb.pset(x, y + h - 1, C.black); fb.pset(x + w - 1, y + h - 1, C.black);
  }
  function dim() {      // darken the whole frame one shade (pause / game-over veil)
    const d = fb.data, dk = GNG.DARKER;
    for (let i = 0; i < d.length; i++) d[i] = dk[dk[d[i]]];
  }
  const LOGO_GRAD = [C.gold[7], C.gold[7], C.gold[6], C.gold[5], C.orange[4], C.red[4], C.red[3]];
  const confirmPressed = () => Input.pressed('start') || Input.pressed('jump') || Input.pressed('attack');

  game.backdropFor = function (index, L) {
    if (!game.backdrops[index]) {
      game.backdrops[index] = GNG.Backdrops.build(index, { levelW: L.pxW, levelH: L.pxH, marks: { shipStart: L.rock ? L.rock[0] : undefined } });
    }
    return game.backdrops[index];
  };

  game.addScore = function (pts) {
    const before = Math.floor(game.score / 30000);
    game.score += pts;
    if (Math.floor(game.score / 30000) > before) { game.lives++; GNG.snd('one_up'); }
    if (game.score > game.hiscore) game.hiscore = game.score;
  };

  game.setCrt = function (on) {
    game.crt = !!on;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('crt-off', !game.crt);
      const b = document.getElementById('btn-crt');
      if (b) { b.setAttribute('aria-pressed', String(game.crt)); b.textContent = 'CRT: ' + (game.crt ? 'ON' : 'OFF'); }
    }
    GNG.snd('crt');
  };
  game.setMute = function (m) {
    GNG.Audio.setMute(m);
    if (typeof document !== 'undefined') {
      const b = document.getElementById('btn-sound');
      if (b) { b.setAttribute('aria-pressed', String(!GNG.Audio.muted)); b.textContent = 'SOUND: ' + (GNG.Audio.muted ? 'OFF' : 'ON'); }
    }
  };

  /* ------------------------------------------------------------------ flow */
  game.setState = function (s) { game.state = s; game.st = 0; };
  game.go = function (fn) { if (!game.trans) game.trans = { t: 0, fn: fn }; };

  game.toTitle = function () {
    game.world = null; game.paused = false; game.flipT = 0; GNG.Screen.flipY = false;
    GNG.fx.gray = 0; GNG.fx.tint = 0; GNG.fx.skyFlash = 0;
    if (!game.titleArt) game.titleArt = GNG.Backdrops.buildTitle();
    GNG.useStagePalette(6, game.titleArt.sky);
    GNG.audioBoxer(false);
    GNG.music('title');
    game.setState('title');
  };

  game.newGame = function (stage) {
    game.score = 0; game.lives = 3; game.weapon = 'lance'; game.nextMode = 'steel';
    game.stats = { hostKills: 0, magic: 0, deaths: 0, frames: 0 };
    game.hintsSeen = {};
    game.showMap(stage | 0);
  };

  game.showMap = function (stage) {
    game.stage = stage; game.checkpoint = null; game.world = null;
    if (!game.mapArt) game.mapArt = GNG.Backdrops.buildMap();
    GNG.useStagePalette(6);
    GNG.fx.gray = 0; GNG.fx.skyFlash = 0; game.flipT = 0; GNG.Screen.flipY = false;
    GNG.audioBoxer(false);
    GNG.music('map', true);
    game.setState('map');
  };

  game.enterStage = function () {
    const cp = game.checkpoint && game.checkpoint.stage === game.stage ? game.checkpoint : null;
    GNG.fx.gray = 0; game.flipT = 0; GNG.Screen.flipY = false;
    game.world = new GNG.World(game, game.stage, { checkpoint: cp, mode: game.nextMode });
    game.nextMode = 'steel';
    game.paused = false;
    GNG.music(GNG.STAGES[game.stage].music, true);
    game.setState('play');
  };

  game.playerDied = function () {
    game.stats.deaths++;
    game.lives--;
    game.nextMode = 'steel';
    if (game.lives < 0) {
      saveHi();
      GNG.music('gameover', true);
      game.continueT = 10 * 60;
      game.setState('gameover');
    } else game.go(game.enterStage);
  };

  game.stageCleared = function (index, final) {
    saveHi();
    game.nextMode = game.world && game.world.player.mode === 'gold' ? 'gold' : 'steel';
    if (final || index >= GNG.STAGES.length - 1) {
      game.go(function () {
        game.world = null;
        if (!game.titleArt) game.titleArt = GNG.Backdrops.buildTitle();
        GNG.useStagePalette(6, game.titleArt.sky);
        GNG.audioBoxer(false);
        GNG.music('ending', true);
        game.setState('ending');
      });
    } else game.go(function () { game.showMap(index + 1); });
  };

  /* ------------------------------------------------------------------ update */
  game.update = function () {
    game.t++; game.st++;
    const keys = Input.takeKeys();
    if (Input.pressed('mute')) game.setMute(!GNG.Audio.muted);
    if (Input.pressed('crt')) game.setCrt(!game.crt);
    // palette FX decay
    const fx = GNG.fx;
    if (fx.flash > 0) { fx.flash *= 0.84; if (fx.flash < 0.02) fx.flash = 0; }
    if (game.trans) {
      const tr = game.trans; tr.t++;
      if (tr.t <= 12) fx.fade = tr.t / 12;
      if (tr.t === 12) tr.fn();
      if (tr.t > 12) { fx.fade = Math.max(0, 1 - (tr.t - 12) / 14); if (tr.t >= 26) { fx.fade = 0; game.trans = null; } }
    }
    const busy = !!game.trans;
    switch (game.state) {
      case 'title': updateTitle(keys, busy); break;
      case 'help': if (!busy && game.st > 10) { if (Input.pressed('right') || confirmPressed()) { GNG.snd('menu_move'); if (++game.helpPage >= HELP.length) { game.helpPage = 0; game.setState('title'); } else game.st = 0; } else if (Input.pressed('pause') || Input.pressed('left')) { GNG.snd('menu_move'); if (--game.helpPage < 0) { game.helpPage = 0; game.setState('title'); } } } break;
      case 'warp': updateWarp(keys, busy); break;
      case 'map':
        if ((game.t % 6) === 0) GNG.cyclePalette(GNG.GLOW_BASE, 8, 1);
        if (!busy && ((game.st > 50 && confirmPressed()) || game.st > 330)) game.go(game.enterStage);
        break;
      case 'play': updatePlay(busy); break;
      case 'gameover':
        fx.gray = Math.min(1, fx.gray + 0.02);
        if (game.continueT > 0) game.continueT--;
        if (!busy && game.st > 40) {
          if (confirmPressed()) {
            GNG.snd('coin'); fx.gray = 0;
            game.score = 0; game.lives = 3; game.weapon = 'lance'; game.checkpoint = null;
            game.go(function () { game.showMap(game.stage); });
          } else if (Input.pressed('pause') || game.continueT <= 0) game.go(game.toTitle);
        }
        break;
      case 'ending':
        if ((game.t % 6) === 0) GNG.cyclePalette(GNG.GLOW_BASE, 8, 1);
        if (!busy && game.st > 600 && confirmPressed()) game.go(game.toTitle);
        break;
    }
  };

  const MENU = ['START GAME', 'STAGE WARP', 'HOW TO PLAY', 'CRT', 'SOUND'];
  function digitOf(code) {
    const m = /^(?:Digit|Numpad)([1-6])$/.exec(code);
    return m ? parseInt(m[1], 10) : 0;
  }
  function updateTitle(keys, busy) {
    if ((game.t % 6) === 0) GNG.cyclePalette(GNG.GLOW_BASE, 8, 1);
    if ((game.t % 9) === 0) GNG.cyclePalette(GNG.LIQ_BASE, 8, 1);
    if (busy) return;
    for (const k of keys) { const d = digitOf(k); if (d) { GNG.snd('coin'); game.go(function () { game.newGame(d - 1); }); return; } }
    if (Input.pressed('down')) { game.menuI = (game.menuI + 1) % MENU.length; GNG.snd('menu_move'); }
    if (Input.pressed('up')) { game.menuI = (game.menuI + MENU.length - 1) % MENU.length; GNG.snd('menu_move'); }
    if (confirmPressed() && game.st > 12) {
      switch (game.menuI) {
        case 0: GNG.snd('coin'); game.go(function () { game.newGame(0); }); break;
        case 1: GNG.snd('menu_select'); game.setState('warp'); break;
        case 2: GNG.snd('menu_select'); game.helpPage = 0; game.setState('help'); break;
        case 3: game.setCrt(!game.crt); break;
        case 4: game.setMute(!GNG.Audio.muted); GNG.snd('menu_select'); break;
      }
    }
  }
  function updateWarp(keys, busy) {
    if (busy) return;
    const n = GNG.STAGES.length;
    for (const k of keys) { const d = digitOf(k); if (d && d <= n) { game.warpI = d - 1; GNG.snd('coin'); game.go(function () { game.newGame(game.warpI); }); return; } }
    if (Input.pressed('down')) { game.warpI = (game.warpI + 1) % n; GNG.snd('menu_move'); }
    if (Input.pressed('up')) { game.warpI = (game.warpI + n - 1) % n; GNG.snd('menu_move'); }
    if (Input.pressed('pause')) { GNG.snd('menu_move'); game.setState('title'); return; }
    if (confirmPressed() && game.st > 10) { GNG.snd('coin'); game.go(function () { game.newGame(game.warpI); }); }
  }
  function updatePlay(busy) {
    const W = game.world, fx = GNG.fx;
    if (!W) return;
    if (Input.pressed('pause') && !busy && !W.player.dead && !W.clearT) {
      game.paused = !game.paused; GNG.snd('pause');
    }
    if (game.paused) {
      if (Input.pressed('start') && game.st > 10) { game.paused = false; }
      return;
    }
    game.stats.frames++;
    if (game.flipT > 0) { game.flipT--; GNG.Screen.flipY = true; } else GNG.Screen.flipY = false;
    W.update();
    // boxer-shorts panic tint on the palette when the possession / soul things happen is handled by flashes;
    // death drains the colour
    fx.gray = W.player.dead ? Math.min(0.85, fx.gray + 0.012) : 0;
  }

  /* ------------------------------------------------------------------ render */
  game.render = function () {
    switch (game.state) {
      case 'title': drawTitle(); break;
      case 'help': drawHelp(); break;
      case 'warp': drawWarp(); break;
      case 'map': drawMap(); break;
      case 'play': drawPlay(); break;
      case 'gameover': drawPlay(); drawGameOver(); break;
      case 'ending': drawEnding(); break;
    }
    GNG.Screen.present();
  };

  function drawLogo(y) {
    const o = { align: 'center', scale: 3, grad: LOGO_GRAD, outline: C.black, shadow: C.maroon[1], spacing: 0 };
    GNG.text(fb, "GHOSTS 'N", 160, y, C.gold[6], o);
    GNG.text(fb, 'GOBLINS', 160, y + 25, C.gold[6], o);
    const sub = 'THE CURSED PC GAMING MUSEUM';
    const w = GNG.textWidth(sub, 1, 1);
    fb.rect(160 - (w >> 1) - 5, y + 51, w + 10, 11, C.black);
    fb.frame(160 - (w >> 1) - 5, y + 51, w + 10, 11, C.red[3]);
    GNG.text(fb, sub, 160, y + 53, C.bone[6], { align: 'center', spacing: 1 });
  }

  function drawTitleBg() {
    const art = game.titleArt || (game.titleArt = GNG.Backdrops.buildTitle());
    fb.blitPart(art.bmp, 0, 0, SW, SH, 0, 0, true);
  }

  function drawTitle() {
    drawTitleBg();
    const t = game.t;
    drawLogo(12 + Math.round(Math.sin(t * 0.03) * 1.5));
    // Arthur and a strawberry-print hint of things to come
    const run = GNG.frames('arthur_steel_run'), box = GNG.frames('arthur_boxers_run');
    const ax = ((t * 0.8) % 460) - 60;
    fb.draw(GNG.frames('arremer_fly')[(t >> 2) & 3], ax - 78 + Math.sin(t * 0.07) * 6, 108 + Math.sin(t * 0.09) * 8, false);
    fb.draw(((t / 460) | 0) & 1 ? box[(t >> 2) % box.length] : run[(t >> 2) % run.length], ax, 118, false);
    const y0 = 124;
    panel(88, y0 - 6, 144, MENU.length * 11 + 10, C.gold[3]);
    for (let i = 0; i < MENU.length; i++) {
      let label = MENU[i];
      if (i === 3) label = 'CRT FILTER: ' + (game.crt ? 'ON' : 'OFF');
      if (i === 4) label = 'SOUND: ' + (GNG.Audio.muted ? 'OFF' : 'ON');
      const sel = i === game.menuI;
      GNG.text(fb, label, 160, y0 + i * 11, sel ? C.gold[6 + ((t >> 3) & 1)] : C.bone[4], { align: 'center' });
      if (sel) {
        const w = GNG.textWidth(label);
        const wob = (t >> 3) & 1;
        fb.draw(GNG.spr('icon_lance0'), 160 - (w >> 1) - 10 - wob, y0 + i * 11 + 3, false);
        fb.draw(GNG.spr('icon_lance0'), 160 + (w >> 1) + 10 + wob, y0 + i * 11 + 3, true);
      }
    }
    if ((t >> 5) & 1) GNG.text(fb, 'PRESS ENTER OR CLICK  -  KEYS 1-6 WARP TO A STAGE', 160, 186, C.white, CENTER);
    else GNG.text(fb, 'TOP ' + pad(game.hiscore, 7) + '   (C) 1985-1993 THE UNDEAD OF PC GAMING', 160, 186, C.bone[5], CENTER);
  }

  const HELP = [
    {
      title: 'CONTROLS', lines: [
        ['MOVE', 'A / D   OR   LEFT / RIGHT'],
        ['AIM UP - CROUCH - CLIMB', 'W / S   OR   UP / DOWN'],
        ['JUMP (TWICE IN BOXERS)', 'SPACE  OR  Z'],
        ['THROW WEAPON', 'J / X   OR   LEFT CLICK'],
        ['EJECT - POSSESS - MAGIC', 'E / C   OR   RIGHT CLICK'],
        ['DROP THROUGH A LEDGE', 'DOWN + JUMP'],
        ['PAUSE', 'P  OR  ESC'],
        ['CRT FILTER  /  SOUND', 'T      /      M']
      ]
    },
    {
      title: 'STEEL, STRAWBERRIES AND SOULS', text: [
        'STEEL ARMOR: HEAVY. IGNORES WIND, SMASHES CRACKED FLOORS ON LANDING, EMPOWERS WEAPONS.',
        '[E] EJECTS IT: THE SUIT DROPS LIKE AN ANVIL, CRUSHES FOES, HOLDS PRESSURE PLATES, BAITS MONSTERS AND IS A SPRINGBOARD. CROUCH ON IT TO SUIT UP.',
        'BOXER SHORTS: 35% FASTER, DOUBLE JUMP, SPECTRAL VISION OF GHOST PLATFORMS AND SECRET CHESTS. ONE HIT KILLS!',
        'IN BOXERS [E] POSSESSES THE NEAREST MONSTER FOR 8 SECONDS: FLY AS A GARGOYLE, BURROW AS A ZOMBIE, HURL BONES AS A SKELETON.',
        'CHESTS RETURN YOUR ARMOR. THE MAGICIAN CHEST GIVES GOLDEN ARMOR: HOLD [E] TO CHARGE A SCREEN-CLEARING SPELL.'
      ]
    },
    {
      title: 'THE ARSENAL', weapons: true
    }
  ];

  function drawHelp() {
    drawTitleBg(); dim();
    const pg = HELP[game.helpPage];
    panel(10, 8, 300, 184, C.gold[3]);
    GNG.text(fb, pg.title, 160, 15, C.gold[6], { align: 'center', grad: LOGO_GRAD, spacing: 1 });
    fb.rect(24, 26, 272, 1, C.red[3]);
    if (pg.lines) {
      pg.lines.forEach((l, i) => {
        GNG.text(fb, l[0], 22, 36 + i * 17, C.bone[6]);
        GNG.text(fb, l[1], 298, 36 + i * 17 + 8, C.gold[5], { align: 'right' });
      });
    } else if (pg.text) {
      let y = 32;
      for (const para of pg.text) {
        const ls = wrap(para, 48);
        const col = /^(STEEL|BOXER|CHESTS)/.test(para) ? C.steel[6] : C.bone[5];
        for (const l of ls) { GNG.text(fb, l, 17, y, /^BOXER/.test(para) ? C.pink[5] : (/^CHESTS/.test(para) ? C.gold[6] : col)); y += 9; }
        y += 3;
      }
    } else if (pg.weapons) {
      GNG.WEAPON_ORDER.forEach((k, i) => {
        const y = 34 + i * 29;
        fb.frame(20, y, 18, 18, C.steel[4]);
        fb.draw(GNG.spr('icon_' + k + '0'), 29, y + 9, false);
        GNG.text(fb, GNG.WEAPONS[k].name, 44, y + 1, C.gold[6]);
        wrap(GNG.WEAPON_HINTS[k].replace(/^[^:]+: /, ''), 42).forEach((l, j) => GNG.text(fb, l, 44, y + 10 + j * 9, C.bone[5]));
      });
    }
    GNG.text(fb, (game.helpPage + 1) + '/' + HELP.length + '   ENTER: NEXT   ESC: BACK', 160, 180, C.white, CENTER);
  }

  function drawWarp() {
    drawTitleBg(); dim();
    const t = game.t, S = GNG.STAGES;
    panel(8, 6, 304, 188, C.gold[3]);
    GNG.text(fb, 'STAGE WARP', 160, 12, C.gold[6], { align: 'center', scale: 2, grad: LOGO_GRAD, outline: C.black });
    GNG.text(fb, 'CHOOSE YOUR CURSED EXHIBIT', 160, 30, C.bone[5], { align: 'center' });
    for (let i = 0; i < S.length; i++) {
      const y = 44 + i * 23, sel = i === game.warpI;
      if (sel) { fb.rect(14, y - 3, 292, 21, C.maroon[1]); fb.frame(14, y - 3, 292, 21, C.red[4]); }
      GNG.text(fb, String(i + 1), 20, y + 2, sel ? C.white : C.gold[4], { scale: 2 });
      GNG.text(fb, S[i].name, 36, y, sel ? C.gold[6 + ((t >> 3) & 1)] : C.bone[5]);
      GNG.text(fb, 'A HAUNTING OF: ' + S[i].parody + ' (' + S[i].year + ')', 36, y + 9, sel ? C.teal[5] : C.slate[4]);
      if (sel) fb.draw(GNG.spr('map_skull0'), 296, y + 12, false);
    }
    GNG.text(fb, 'UP/DOWN + ENTER, OR PRESS 1-6     ESC: BACK', 160, 183, C.white, CENTER);
  }

  function drawMap() {
    const art = game.mapArt, t = game.st, S = GNG.STAGES, st = game.stage, nodes = art.nodes || [];
    fb.blitPart(art.bmp, 0, 0, SW, SH, 0, 0, true);
    const INK = C.brown[1];
    for (let i = 0; i < nodes.length && i < S.length; i++) {
      const n = nodes[i];
      if (i < st) fb.draw(GNG.spr('map_skull0'), n.x, n.y + 4, false);
      else if (i === st) { if ((t >> 3) & 1) fb.circ(n.x, n.y, 6, C.red[4]); fb.draw(GNG.spr('map_flag0'), n.x + 3, n.y + 1, false); }
      else { fb.circ(n.x, n.y, 3, INK); fb.pset(n.x, n.y, INK); }
    }
    // Arthur marches from the previous exhibit to the next
    if (nodes.length) {
      const to = nodes[Math.min(st, nodes.length - 1)];
      const from = st > 0 ? nodes[st - 1] : { x: Math.max(8, to.x - 46), y: Math.min(160, to.y + 16) };
      const k = GNG.clamp((t - 30) / 150, 0, 1), e = k * k * (3 - 2 * k);
      let ax = from.x + (to.x - from.x) * e, ay = from.y + (to.y - from.y) * e;
      if (st > 0 && art.path && art.pathStops && art.pathStops.length > st) {       // follow the inked road
        const i0 = art.pathStops[st - 1], i1 = art.pathStops[st];
        const p = art.path[Math.round(i0 + (i1 - i0) * e)];
        if (p) { ax = p.x; ay = p.y; }
      }
      // a little helmet token hops along the dotted path
      const hop = k < 1 ? Math.abs(Math.sin(t * 0.22)) * 4 : 0;
      const helm = GNG.spr('hud_helm0');
      const hx = Math.round(ax) - (helm.w >> 1), hy = Math.round(ay - 6 - hop) - (helm.h >> 1);
      fb.ellipse(Math.round(ax), Math.round(ay) + 1, 4, 1.5, INK);
      fb.blitSolid(helm, hx - 1, hy, false, INK); fb.blitSolid(helm, hx + 1, hy, false, INK);
      fb.blitSolid(helm, hx, hy - 1, false, INK); fb.blitSolid(helm, hx, hy + 1, false, INK);
      fb.blit(helm, hx, hy);
    }
    GNG.text(fb, 'STAGE ' + (st + 1) + ' OF ' + S.length, 160, 8, C.red[3], { align: 'center', spacing: 1 });
    const name = wrap(S[st].name, 44);
    name.forEach((l, i) => GNG.text(fb, l, 160, 17 + i * 9, INK, { align: 'center' }));
    if (t > 40) {
      const tag = wrap('"' + S[st].tagline + '"', 48);
      tag.forEach((l, i) => GNG.text(fb, l, 160, 174 + i * 9 - (tag.length - 1) * 4, C.maroon[2], { align: 'center' }));
    }
    if (t > 60 && ((t >> 4) & 1)) GNG.text(fb, 'ENTER', 306, 189, C.red[3], { align: 'right' });
  }

  /* ---- in-game HUD ---- */
  const MODE_COL = { steel: C.steel[6], gold: C.gold[6], boxers: C.pink[5] };
  const MODE_NAME = { steel: 'STEEL', gold: 'GOLDEN', boxers: 'BOXERS!' };

  function gauge(x, y, w, k, col, back) {
    fb.rect(x - 1, y - 1, w + 2, 5, C.black);
    fb.rect(x, y, w, 3, back);
    fb.rect(x, y, Math.round(w * GNG.clamp(k, 0, 1)), 3, col);
  }

  function drawHud(W) {
    const pl = W.player, t = W.time;
    GNG.text(fb, 'ARTHUR', 6, 3, C.red[5], BK);
    GNG.text(fb, pad(game.score, 7), 6, 12, C.white, BK);
    GNG.text(fb, 'TOP', 160, 3, C.red[5], CENTER);
    GNG.text(fb, pad(game.hiscore, 7), 160, 12, C.white, CENTER);
    // lives
    const helm = GNG.spr(pl.mode === 'boxers' ? 'hud_boxers0' : (pl.mode === 'gold' ? 'hud_gold0' : 'hud_helm0'));
    const lives = Math.max(0, game.lives);
    if (lives <= 5) { for (let i = 0; i < lives; i++) fb.blit(helm, 56 + i * 11, 7); }
    else { fb.blit(helm, 56, 7); GNG.text(fb, 'x' + lives, 68, 8, C.white, BK); }
    // weapon + armour state
    fb.rect(196, 2, 18, 18, C.black); fb.frame(196, 2, 18, 18, MODE_COL[pl.mode]);
    fb.draw(GNG.spr(GNG.WEAPONS[pl.weapon].icon), 205, 11, false);
    GNG.text(fb, MODE_NAME[pl.mode], 218, 3, (pl.mode === 'boxers' && (t & 16)) ? C.white : MODE_COL[pl.mode], BK);
    if (pl.mode === 'boxers') {
      const ready = pl.soulCD <= 0;
      gauge(219, 14, 40, 1 - pl.soulCD / GNG.SOUL_COOLDOWN, ready ? C.teal[5 + ((t >> 3) & 1)] : C.teal[3], C.teal[0]);
      if (ready && !pl.possess && (t & 32)) GNG.text(fb, 'E', 262, 12, C.teal[6], BK);
    } else if (pl.mode === 'gold') {
      const k = pl.magicCD > 0 ? 1 - pl.magicCD / 150 : (pl.charge > 0 ? pl.charge / GNG.CHARGE_MAX : 1);
      gauge(219, 14, 40, k, pl.ready ? C.white : (pl.magicCD > 0 ? C.gold[3] : C.gold[5 + ((t >> 3) & 1)]), C.gold[0]);
    } else GNG.text(fb, 'E:EJECT', 218, 12, C.steel[4], BK);
    // time
    const sec = Math.max(0, Math.ceil(W.timeLeft / 60));
    GNG.text(fb, 'TIME', 314, 3, C.gold[6], { align: 'right', outline: C.black });
    GNG.text(fb, Math.floor(sec / 60) + ':' + pad(sec % 60, 2), 314, 12, (sec <= 30 && (t & 16)) ? C.hotred : C.white, { align: 'right', outline: C.black });

    // possession countdown
    if (pl.possess) {
      const p = pl.possess, k = p.t / p.max, lab = 'POSSESSING: ' + p.host.label;
      const warn = p.t < 120 && (t & 8);
      GNG.text(fb, lab, 160, 25, warn ? C.white : C.teal[6], CENTER);
      gauge(110, 35, 100, k, warn ? C.white : C.teal[5], C.teal[0]);
      GNG.text(fb, (p.t / 60).toFixed(1), 216, 33, C.teal[6], BK);
    }
    // boss bar
    const b = W.boss;
    let bottom = 194;
    if (b && !b.dead && W.bossIntro <= 0) {
      GNG.text(fb, b.label, 160, 181, C.red[5], CENTER);
      fb.rect(59, 190, 202, 6, C.black);
      fb.rect(60, 191, 200, 4, C.maroon[1]);
      const k = GNG.clamp(b.hp / b.maxHp, 0, 1);
      fb.rect(60, 191, Math.round(200 * k), 4, (b.flash > 0) ? C.white : C.red[4]);
      fb.rect(60, 191, Math.round(200 * k), 1, C.red[6]);
      bottom = 176;
    }
    // hints
    if (W.hintT > 0 && W.hintText) {
      const lines = wrap(W.hintText, 50);
      let w = 0; for (const l of lines) w = Math.max(w, GNG.textWidth(l));
      const h = lines.length * 9 + 4, y = bottom - h, x = 160 - (w >> 1);
      if (W.hintT > 12 || (W.hintT & 2)) {
        fb.rect(x - 5, y - 1, w + 10, h + 1, C.black);
        fb.frame(x - 5, y - 1, w + 10, h + 1, C.teal[3]);
        lines.forEach((l, i) => GNG.text(fb, l, 160, y + 2 + i * 9, C.teal[6], { align: 'center' }));
      }
    }
    // banners
    if (W.bossIntro > 0) {
      const k = W.bossIntro;
      if ((k >> 3) & 1) GNG.text(fb, 'WARNING!', 160, 60, C.hotred, { align: 'center', scale: 3, outline: C.black });
      GNG.text(fb, 'A HUGE GUARDIAN APPROACHES', 160, 90, C.white, CENTER);
      GNG.text(fb, W.def.bossName, 160, 102, C.gold[6], { align: 'center', outline: C.black, grad: LOGO_GRAD, spacing: 1 });
    } else if (W.introT > 24 && !W.respawned) {
      const S = W.def;
      GNG.text(fb, 'STAGE ' + (W.index + 1), 160, 58, C.gold[6], { align: 'center', scale: 2, grad: LOGO_GRAD, outline: C.black });
      wrap(S.name, 40).forEach((l, i) => GNG.text(fb, l, 160, 78 + i * 10, C.white, CENTER));
      if (W.introT < 110 && (W.introT & 8)) GNG.text(fb, 'READY!', 160, 106, C.red[5], CENTER);
    } else if (W.introT > 60 && W.respawned) {
      GNG.text(fb, 'ARTHUR x' + Math.max(0, game.lives), 160, 70, C.white, CENTER);
    }
    if (W.clearT > 30) {
      GNG.text(fb, W.clearFinal ? 'THE CURSED FLOPPY IS YOURS!' : 'STAGE CLEAR!', 160, 56, C.gold[6], { align: 'center', scale: W.clearFinal ? 1 : 2, grad: LOGO_GRAD, outline: C.black });
      GNG.text(fb, 'TIME BONUS  ' + pad(W.bonus, 5), 160, 82, C.white, CENTER);
    }
    if (game.flipT > 0 && (t & 8)) GNG.text(fb, 'CURSED!', 160, 44, C.blue[6], CENTER);
  }

  function drawPlay() {
    const W = game.world;
    if (!W) { fb.clear(C.black); return; }
    W.draw(fb);
    drawHud(W);
    if (game.paused) {
      dim();
      panel(76, 54, 168, 92, C.gold[3]);
      GNG.text(fb, 'PAUSED', 160, 62, C.gold[6], { align: 'center', scale: 2, grad: LOGO_GRAD });
      const rows = ['A/D MOVE   W/S AIM-CROUCH-CLIMB', 'SPACE/Z JUMP   J/X/CLICK THROW', 'E/C/R-CLICK EJECT-POSSESS-MAGIC', '', 'P / ESC: RESUME    T: CRT   M: SOUND'];
      rows.forEach((r, i) => GNG.text(fb, r, 160, 84 + i * 10, i === 4 ? C.white : C.bone[5], { align: 'center', spacing: -1 }));
    }
  }

  function drawGameOver() {
    if (game.st < 20) return;
    panel(84, 62, 152, 70, C.red[4]);
    GNG.text(fb, 'GAME OVER', 160, 70, C.red[5], { align: 'center', scale: 2, outline: C.maroon[0] });
    GNG.text(fb, 'CONTINUE?  ' + Math.ceil(game.continueT / 60), 160, 94, C.white, { align: 'center' });
    GNG.text(fb, 'ENTER: YES    ESC: NO', 160, 108, (game.t & 16) ? C.gold[6] : C.bone[5], { align: 'center' });
    GNG.text(fb, 'ABORT, RETRY, FAIL?', 160, 120, C.slate[4], { align: 'center' });
  }

  const ENDING = [
    [40, 'ASTAROTH-LECHUCK-9000 HAS BEEN DEFRAGMENTED.', 'white'],
    [130, 'SIR ARTHUR INSERTS THE CURSED FLOPPY DISK...', 'bone'],
    [230, 'A:\\>FORMAT C: /CURSE', 'green'],
    [300, 'NOT READY READING DRIVE A', 'green'],
    [350, 'ABORT, RETRY, FAIL? _', 'green'],
    [440, 'THE CURSE IS LIFTED. THE MUSEUM SLEEPS AGAIN.', 'white'],
    [520, 'THIS ROOM WAS AN ILLUSION AND A TRAP DEVISED BY', 'gold'],
    [530, 'SATAN. GO AHEAD DAUNTLESSLY! MAKE RAPID PROGRES!', 'gold']
  ];
  function drawEnding() {
    drawTitleBg();
    const t = game.st, st = game.stats;
    const d = fb.data, dk = GNG.DARKER;
    for (let i = 0; i < d.length; i++) d[i] = dk[d[i]];
    GNG.text(fb, 'CONGRATULATION!', 160, 10, C.gold[6], { align: 'center', scale: 2, grad: LOGO_GRAD, outline: C.black });
    // Arthur, golden and victorious, holding up the Cursed Floppy Disk
    const ax = 160, ay = 150;
    const win = GNG.spr('arthur_gold_win0'), fl = GNG.frames('floppy');
    const bob = Math.round(Math.sin(t * 0.08) * 2);
    fb.draw(win, ax, ay, false);
    fb.draw(fl[(t >> 3) % fl.length], ax + 1, ay - 34 + bob, false);
    if ((t % 5) === 0) { const a = t * 0.37, r = 16 + (t % 9); fb.pset(ax + Math.cos(a) * r, ay - 42 + bob + Math.sin(a) * r, C.white); }
    for (let i = 0; i < 12; i++) { const a = t * 0.02 + i * 0.52, r = 22 + Math.sin(t * 0.05 + i) * 5; fb.pset(ax + Math.cos(a) * r, ay - 42 + bob + Math.sin(a) * r * 0.8, i & 1 ? C.gold[6] : C.white); }
    let y = 34;
    for (const e of ENDING) {
      if (t < e[0]) break;
      const full = e[1], n = Math.min(full.length, Math.floor((t - e[0]) * 0.8));
      const col = e[2] === 'green' ? C.hotgreen : (e[2] === 'gold' ? C.gold[5] : (e[2] === 'bone' ? C.bone[5] : C.white));
      GNG.text(fb, full.slice(0, n), 160 - (GNG.textWidth(full) >> 1), y, col, BK);
      y += 9;
    }
    if (t > 600) {
      const m = Math.floor(st.frames / 3600), s = Math.floor(st.frames / 60) % 60;
      GNG.text(fb, 'SCORE ' + pad(game.score, 7) + '   TIME ' + m + ':' + pad(s, 2) + '   DEATHS ' + st.deaths, 160, 162, C.white, CENTER);
      GNG.text(fb, 'SPELLS CAST ' + st.magic + '   KILLS AS A MONSTER ' + st.hostKills, 160, 172, C.teal[6], CENTER);
      if ((t >> 5) & 1) GNG.text(fb, 'THANK YOU FOR PLAYING  -  PRESS ENTER', 160, 186, C.gold[6], CENTER);
    }
  }

  /* ------------------------------------------------------------------ boot */
  GNG.boot = function (canvas) {
    loadHi();
    GNG.Screen.init(canvas);
    Input.attach(window, canvas);
    Input.onFirstGesture = function () { GNG.Audio.unlock(); };
    game.toTitle();
    GNG.Loop.start(game.update, game.render);
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    const start = function () {
      const canvas = document.getElementById('screen');
      if (!canvas) return;
      // pixel-perfect integer scaling of the 320x200 framebuffer
      const fit = function () {
        const cab = document.getElementById('cabinet'), mon = document.getElementById('monitor');
        const bezel = canvas.closest('.monitor__bezel') || canvas, plaque = cab ? cab.querySelector('.plaque') : null;
        document.body.classList.remove('compact');
        let chromeH = 30 + (bezel.offsetHeight - canvas.offsetHeight);
        if (cab) for (const el of cab.children) if (el !== mon && el.offsetHeight) chromeH += el.offsetHeight + 12;
        const chromeW = (bezel.offsetWidth - canvas.offsetWidth) + 36;
        const byW = (window.innerWidth - chromeW) / SW;
        let s = Math.max(1, Math.floor(Math.min(byW, (window.innerHeight - chromeH) / SH)));
        // a tight window: drop the brass plaque if that buys a whole extra pixel of scale
        if (plaque && plaque.offsetHeight) {
          const s2 = Math.floor(Math.min(byW, (window.innerHeight - chromeH + plaque.offsetHeight + 12) / SH));
          if (s2 > s) { s = s2; document.body.classList.add('compact'); }
        }
        canvas.style.width = (SW * s) + 'px'; canvas.style.height = (SH * s) + 'px';
        if (mon) mon.style.setProperty('--px', String(s));
      };
      fit();
      window.addEventListener('resize', fit);
      document.addEventListener('fullscreenchange', fit);
      const on = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', function (e) { GNG.Audio.unlock(); fn(e); el.blur(); }); };
      on('btn-crt', function () { game.setCrt(!game.crt); });
      on('btn-sound', function () { game.setMute(!GNG.Audio.muted); });
      on('btn-full', function () {
        const el = document.getElementById('cabinet') || document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(function () { /* denied */ });
      });
      canvas.addEventListener('mousedown', function () { canvas.focus(); });
      GNG.boot(canvas);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})();
