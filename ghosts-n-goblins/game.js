'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — game.js
 *  Core: fixed-step 60 Hz loop, input, tile physics, Sir Arthur (Steel / Gold /
 *  strawberry boxers), armor EJECT -> anvil (crusher, plate weight,
 *  springboard, decoy, piston jammer), POSSESSION curse, 5 weapons, Golden
 *  magic, chests, pressure plates & gates, hazards, particles, camera,
 *  lightning, HUD and every screen (title, parchment map, stage clear,
 *  game over / continue, ending).
 * ===========================================================================*/
const Game = (() => {
  const G = GFX, W = 320, H = 200, ROWS = 13;
  const hex = G.hex;
  const rnd = Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sgn = v => (v < 0 ? -1 : 1);

  // ------------------------------------------------------------ sim context shared with entities.js
  const S = { t: 0, diff: 1, loop: 0, cam: { x: 0, y: 8 }, ents: [], pshots: [], eshots: [], items: [], parts: [], anvil: null, arena: null, boss: null, floorY: 176, P: null, world: null };
  let state = 'boot', stageIdx = 0, score = 0, hi = 20000, lives = 3, timeF = 0, checkpoint = -1, fragments = 0, paused = false;
  let stT = 0, mapFrom = 0, deathMap = false, nextLife = 20000, continueT = 0, endT = 0;
  let rockDY = 0, shakeT = 0, shakeK = 0, bannerText = '', bannerT = 0, bolts = [], popups = [], weather = [], lightT = 300, lightSeq = 0;
  let crumbles = new Map(), gateOf = {}, plateHold = {}, bossDelay = -1, wind = { t: 0, dir: 1, on: false, cd: 240 }, shotId = 1;
  let clearInfo = null;
  try { hi = +localStorage.getItem('gng_cursed_hi') || 20000; } catch (e) { /* storage unavailable */ }

  // ============================================================ INPUT
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyZ: 'jump', KeyJ: 'fire', KeyX: 'fire', KeyE: 'act', KeyC: 'act', Enter: 'start', Mouse0: 'fire', Mouse2: 'act' };
  const held = {}, latch = {};
  let I = {}, E = {};
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'act', 'start'];
  function press(code) { const a = KEYMAP[code]; if (a) { if (!held[code]) latch[a] = true; held[code] = true; } }
  function release(code) { held[code] = false; }
  function readInput() {
    const cur = {};
    for (const a of ACTIONS) cur[a] = false;
    for (const c in held) if (held[c] && KEYMAP[c]) cur[KEYMAP[c]] = true;
    for (const a of ACTIONS) { E[a] = (cur[a] && !I[a]) || !!latch[a]; latch[a] = false; }
    I = cur;
  }
  const anyStart = () => E.start || E.fire || E.jump;

  // ============================================================ TILE QUERIES
  let TI = -1, TT = 0;
  function tAt(px, py) {
    const w = S.world; let dy = 0;
    if (w.rock && px >= w.rock.x0 && px < w.rock.x1) dy = rockDY;
    const tx = Math.floor(px / 16), ty = Math.floor((py - dy) / 16);
    TT = ty * 16 + dy;
    if (tx < 0 || tx >= w.w) { TI = -1; return 1; }
    if (ty < 0 || ty >= ROWS) { TI = -1; return 0; }
    TI = ty * w.w + tx; return w.t[TI];
  }
  const ghostSolid = () => S.P && S.P.armor === 'none' && !S.P.form && !S.P.dead;
  const spectral = () => S.P && S.P.armor === 'none' && !S.P.dead;
  function solidCode(c, idx) {
    if (c === 1 || c === 4 || c === 6 || c === 8 || c === 10 || c === 11 || c === 12) return true;
    if (c === 9) { const g = gateOf[idx]; return g == null || S.world.gateOpen[g] < 0.7; }
    return false;
  }
  function solidAt(x, y) { const c = tAt(x, y); return solidCode(c, TI); }
  function groundBelow(x, y) {
    for (let yy = Math.max(0, y); yy < ROWS * 16; yy += 4) { const c = tAt(x, yy); if (solidCode(c, TI) || c === 2) return TT; }
    return ROWS * 16 + 40;
  }
  function moveBody(e) {
    const isP = e === S.P;
    const grav = e.grav != null ? e.grav : 0.24, mf = e.maxFall || 5.5;
    e.vy = Math.min(e.vy + grav, mf);
    let carry = 0;
    if (e.onGround) { if (e.gTile === 11) carry = -0.8; else if (e.gTile === 12) carry = 0.8; }
    e.hitWall = 0;
    let nx = e.x + e.vx + carry + (e.push || 0);
    const dx = nx - e.x;
    if (dx !== 0) {
      const s = dx > 0 ? 1 : -1, edge = nx + s * e.w;
      for (const yy of [e.y - 2, e.y - e.h * 0.5, e.y - e.h + 2]) {
        const c = tAt(edge, yy);
        if (solidCode(c, TI)) { e.hitWall = s; nx = s > 0 ? Math.floor(edge / 16) * 16 - e.w - 0.01 : Math.floor(edge / 16) * 16 + 16 + e.w + 0.01; break; }
      }
    }
    e.x = nx;
    let ny = e.y + e.vy;
    const wasG = e.onGround; e.onGround = false; e.hitCeil = false;
    if (e.vy >= 0) {
      for (const xx of [e.x - e.w + 1, e.x + e.w - 1]) {
        const c = tAt(xx, ny), top = TT, idx = TI;
        let land = solidCode(c, idx);
        if (!land && (c === 2 || c === 3 || c === 7) && e.y <= top + 0.6 + (wasG ? 2 : 0) && !e.climb && !e.dropT) {
          if (c === 2) land = true;
          else if (c === 7) land = isP && ghostSolid();
          else { land = tAt(xx, top - 8) !== 3; tAt(xx, ny); }
        }
        if (land) { ny = top; e.vy = 0; e.onGround = true; e.gTile = c; e.gIdx = idx; break; }
      }
    } else {
      for (const xx of [e.x - e.w + 1, e.x + e.w - 1]) {
        const c = tAt(xx, ny - e.h);
        if (solidCode(c, TI)) { ny = TT + 16 + e.h; e.vy = 0; e.hitCeil = true; break; }
      }
    }
    e.y = ny;
  }
  const onScreen = (x, m = 0) => x > S.cam.x - m && x < S.cam.x + W + m;

  // ============================================================ PARTICLES
  const PCOL = {
    ecto: [hex('#60ff90'), hex('#20c060'), hex('#b0ffd0')], bones: [hex('#ece4c8')], blood: [hex('#e02020'), hex('#a01010')],
    spark: [hex('#ffffff'), hex('#fff080'), hex('#ffc040')], smoke: [hex('#5a5a66'), hex('#7a7a86')], fire: [hex('#ff6010'), hex('#ffb020'), hex('#fff080')],
    splash: [hex('#6ab0d0'), hex('#c0f0ff')], dust: [hex('#8a7a60'), hex('#b0a080')], plates: [hex('#a9b3cc'), hex('#eef2ff'), hex('#5a6384')],
    gplates: [hex('#f0bd34'), hex('#fff3a8'), hex('#9c6610')], gold: [hex('#fff3a8'), hex('#f0bd34')], rubble: [hex('#6a5a4a'), hex('#3a3028')],
    soul: [hex('#a0f0ff'), hex('#ffffff'), hex('#60a0ff')], ghost: [hex('#40f0a0'), hex('#a0ffd0')], magic: [hex('#c060ff'), hex('#ffb0ff')], acid: [hex('#90e020')],
  };
  function fx(kind, x, y, n = 1) {
    if (S.parts.length > 700) return;
    if (kind === 'boom') { S.parts.push({ k: 'boom', x, y, life: 26, max: 26, r: 10 + rnd() * 10 }); for (let i = 0; i < 6; i++) fx('fire', x, y, 1); fx('smoke', x, y, 3); return; }
    if (kind === 'splash') { const c = S.world ? hex(Stages.THEMES[S.world.idx].liquid[2]) : PCOL.splash[0]; for (let i = 0; i < n; i++) S.parts.push({ k: 'px', x, y, vx: (rnd() - 0.5) * 2.4, vy: -1.5 - rnd() * 2.5, g: 0.15, life: 30 + rnd() * 20, c: rnd() < 0.5 ? c : PCOL.splash[1], s: 1 }); return; }
    const cols = PCOL[kind] || PCOL.spark;
    for (let i = 0; i < n; i++) {
      const p = { k: 'px', x, y, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, g: 0.12, life: 20 + rnd() * 20, c: cols[(rnd() * cols.length) | 0], s: 1 };
      switch (kind) {
        case 'ecto': p.vx *= 1.4; p.vy = -1 - rnd() * 2.5; p.s = 1 + (rnd() < 0.4); p.life += 15; break;
        case 'bones': p.k = 'bone'; p.vx *= 1.5; p.vy = -2 - rnd() * 2.5; p.g = 0.2; p.rot = rnd() * 6; p.vr = (rnd() - 0.5) * 0.5; p.life = 50; break;
        case 'spark': p.vx *= 2.2; p.vy *= 2.2; p.g = 0.05; p.life = 10 + rnd() * 12; break;
        case 'smoke': p.k = 'smoke'; p.vx *= 0.3; p.vy = -0.3 - rnd() * 0.5; p.g = 0; p.life = 40 + rnd() * 20; p.r = 2 + rnd() * 2; break;
        case 'fire': p.vx *= 0.6; p.vy = -0.6 - rnd() * 1.2; p.g = -0.01; p.life = 18 + rnd() * 16; break;
        case 'dust': p.k = 'smoke'; p.c = cols[0]; p.vx *= 0.8; p.vy = -0.2 - rnd() * 0.4; p.g = 0; p.life = 22; p.r = 1.5 + rnd() * 1.5; break;
        case 'plates': case 'gplates': p.k = 'plate'; p.vx = (rnd() - 0.5) * 4.5; p.vy = -2.5 - rnd() * 3; p.g = 0.2; p.rot = rnd() * 6; p.vr = (rnd() - 0.5) * 0.6; p.life = 60 + rnd() * 30; break;
        case 'gold': case 'magic': case 'soul': p.vx *= 0.6; p.vy = -0.4 - rnd(); p.g = -0.01; p.life = 25 + rnd() * 20; break;
        case 'ghost': p.vx *= 0.3; p.vy = -0.3; p.g = 0; p.life = 18; break;
        case 'rubble': p.vx *= 1.8; p.vy = -1.5 - rnd() * 2.5; p.g = 0.22; p.s = 2; p.life = 50; break;
        case 'blood': p.vx *= 1.5; p.vy = -1 - rnd() * 2; p.g = 0.2; break;
        case 'acid': p.vx *= 1.2; p.vy = -1 - rnd(); p.g = 0.15; break;
        default: break;
      }
      S.parts.push(p);
    }
  }
  function updateParts() {
    const a = S.parts;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i];
      if (--p.life <= 0) { a[i] = a[a.length - 1]; a.pop(); continue; }
      if (p.k === 'boom') continue;
      p.vy += p.g; p.x += p.vx; p.y += p.vy;
      if (p.vr) p.rot += p.vr;
      if (p.k === 'smoke') p.r += 0.05;
    }
  }
  function drawParts() {
    const cx = S.cam.x, cy = S.cam.y;
    for (const p of S.parts) {
      const X = p.x - cx, Y = p.y - cy;
      if (X < -30 || X > W + 30) continue;
      if (p.k === 'px') { if (p.s > 1) G.rect(X, Y, p.s, p.s, p.c); else G.pset(X, Y, p.c); }
      else if (p.k === 'bone') G.blitRot(SPR.bone, X, Y, p.rot, false);
      else if (p.k === 'plate') { const dx = Math.cos(p.rot) * 2.5, dy = Math.sin(p.rot) * 2.5; G.line(X - dx, Y - dy, X + dx, Y + dy, p.c); G.line(X - dx, Y - dy + 1, X + dx, Y + dy + 1, G.shade(p.c, 0.7)); }
      else if (p.k === 'smoke') { const a = Math.min(1, p.life / 20) * 0.5; const r = Math.ceil(p.r); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= p.r * p.r) G.blend(X + x, Y + y, p.c, a); }
      else if (p.k === 'boom') {
        const k = 1 - p.life / p.max, r = p.r * (0.4 + k);
        G.glow(X, Y, r * 1.8, hex('#ff8a20'), (1 - k) * 1.2);
        if (k < 0.5) G.disc(X, Y, r * (1 - k), k < 0.25 ? hex('#fff8d0') : hex('#ffb040'));
        G.ring(X, Y, r * 1.2, hex('#ff6010'));
      }
    }
  }
  function addScore(n, x, y) {
    score += n;
    if (score >= nextLife) { lives++; nextLife += nextLife < 50000 ? 50000 : 100000; Music.sfx('life'); banner('1UP!'); }
    if (score > hi) hi = score;
    if (x != null) popups.push({ x, y, text: String(n), t: 50 });
  }
  function banner(t, dur = 120) { bannerText = t; bannerT = dur; }
  const shake = n => { shakeT = Math.max(shakeT, 10); shakeK = Math.max(shakeK, n); };
  const flash = k => { G.fx.flash = Math.max(G.fx.flash, k); };

  // ============================================================ PLAYER
  const FORMS = {
    zombie: { spd: 0.9, jump: -3.8, h: 26, w: 6, cd: 16, name: 'ZOMBIE', hint: 'DOWN BURROW · FIRE ACID', heavy: true },
    skeleton: { spd: 1.25, jump: -4.4, h: 26, w: 5, cd: 8, name: 'SKELETON', hint: 'FIRE RAPID BONES' },
    haunt: { spd: 0.8, jump: -3.4, h: 27, w: 7, cd: 22, name: 'HAUNTED ARMOR', hint: 'FRONT SHIELD · FIRE SLASH', heavy: true },
    imp: { spd: 1.45, jump: -6.0, h: 26, w: 6, cd: 18, name: 'CYBER-IMP', hint: 'HIGH JUMP · FIRE FIREBALL' },
    arremer: { spd: 1.6, jump: -2.4, h: 22, w: 8, cd: 20, name: 'RED ARREMER', hint: 'HOLD JUMP FLY · FIRE FIREBALL', fly: true },
    lemming: { spd: 0.6, jump: -2.6, h: 10, w: 3, cd: 30, name: 'LEMMING', hint: 'FIRE: OH NO! (EXPLODE)' },
  };
  const WEAP = {
    lance: { cd: 14, max: 2, name: 'LANCE' }, dagger: { cd: 7, max: 3, name: 'DAGGER' }, torch: { cd: 18, max: 2, name: 'HOLY TORCH' },
    axe: { cd: 18, max: 2, name: 'BATTLE AXE' }, cross: { cd: 12, max: 1, name: 'CROSS' },
  };
  function newPlayer(x, y, keep) {
    return {
      x, y, vx: 0, vy: 0, w: 5, h: 26, face: 1, onGround: false, armor: 'steel', form: null, weapon: keep ? keep.weapon : 'lance',
      inv: 90, dead: false, deadT: 0, crouch: false, climb: false, climbA: 0, jumps: 0, coyote: 0, fireCd: 0, throwT: 0, throwDir: 0,
      charge: 0, charged: false, hurtT: 0, soul: null, burrow: false, donT: 0, dist: 0, dropT: 0, deathCause: '',
    };
  }
  const heavyP = P => (P.armor !== 'none' && !P.form) || (P.form && FORMS[P.form.form].heavy);

  function hurtPlayer(src) {
    const P = S.P;
    if (!P || P.dead || P.inv > 0 || P.soul || P.burrow || state !== 'play') return;
    const from = src && src.x != null ? src.x : P.x - P.face;
    if (P.form) { endPossession(false); P.inv = 90; P.vy = -3; P.vx = sgn(P.x - from) * 1.2; P.hurtT = 20; return; }
    if (P.armor !== 'none') {
      fx(P.armor === 'gold' ? 'gplates' : 'plates', P.x, P.y - 14, 26);
      fx('spark', P.x, P.y - 14, 8);
      Music.sfx('shatter'); shake(4);
      P.armor = 'none'; P.inv = 120; P.vy = -3.2; P.vx = sgn(P.x - from) * 1.4; P.hurtT = 28; P.climb = false; P.charge = 0; P.charged = false;
      return;
    }
    killPlayer('hit');
  }
  function killPlayer(cause) {
    const P = S.P; if (P.dead) return;
    if (P.form) endPossession(false);
    P.dead = true; P.deadT = 0; P.vx = 0; P.vy = cause === 'liquid' ? 0.5 : -2.5; P.deathCause = cause; P.climb = false;
    Music.stop(); Music.sfx('death');
    if (cause === 'liquid') { fx('splash', P.x, P.y - 4, 20); Music.sfx('splash'); }
    else fx('bones', P.x, P.y - 14, 4);
  }

  // ---------------------------------------------------------------- weapons
  function mult() { const P = S.P; return P.armor === 'gold' ? 2 : P.armor === 'steel' ? 1.5 : 1; }
  function addShot(o) { o.id = shotId++; o.t = 0; o.hit = new Set(); S.pshots.push(o); return o; }
  function fire() {
    const P = S.P, wn = P.weapon, wd = WEAP[wn];
    if (P.fireCd > 0) return;
    if (S.pshots.filter(s => s.w === wn && s.kind !== 'flame').length >= wd.max) return;
    P.fireCd = wd.cd;
    let dx = P.face, dy = 0;
    if (I.up && !P.climb) { dx = 0; dy = -1; }
    else if (I.down && !P.onGround && !P.climb) { dx = 0; dy = 1; }
    P.throwDir = dy; P.throwT = 12;
    const y = P.crouch ? P.y - 9 : P.y - 18, x = P.x + P.face * 6 * (dy ? 0 : 1);
    const m = mult(), pow = P.armor !== 'none';
    const base = { w: wn, x, y, dmg: 0, r: 4, life: 90, grav: 0, face: P.face, gold: P.armor === 'gold' };
    if (wn === 'lance') { const s = pow ? 5.6 : 5; addShot(Object.assign(base, { kind: 'lance', vx: dx * s, vy: dy * s, dmg: 2 * m, spr: pow ? SPR.w_lanceL : SPR.w_lance, r: pow ? 6 : 4 })); Music.sfx('throw'); }
    else if (wn === 'dagger') addShot(Object.assign(base, { kind: 'dagger', vx: dx * 6.5, vy: dy * 6.5, dmg: 1.2 * m, spr: SPR.w_dagger })), Music.sfx('throw');
    else if (wn === 'torch') { addShot(Object.assign(base, { kind: 'torch', vx: dx ? dx * 2.4 + P.vx * 0.3 : P.face * 0.6, vy: dy < 0 ? -5 : dy > 0 ? 2 : -2.8, grav: 0.2, dmg: 1.6 * m, spr: SPR.w_torch, rot: 0, life: 200 })); Music.sfx('torch'); }
    else if (wn === 'axe') { addShot(Object.assign(base, { kind: 'axe', vx: dx ? dx * 2.6 : P.face * 0.8, vy: dy < 0 ? -5.8 : dy > 0 ? 2 : -4.3, grav: 0.2, dmg: 2 * m, pierce: true, spr: SPR.w_axe, rot: 0, life: 200, r: 6 })); Music.sfx('axe'); }
    else if (wn === 'cross') { addShot(Object.assign(base, { kind: 'cross', vx: dx * 4.6, vy: dy * 4.6, dmg: 1.5 * m, spr: SPR.w_cross, rot: 0, life: 170, r: 6, out: true, dx, dy })); Music.sfx('throw'); }
  }
  function formAttack() {
    const P = S.P, F = FORMS[P.form.form];
    if (P.fireCd > 0 || P.burrow) return;
    P.fireCd = F.cd; P.throwT = 10;
    const f = P.face, y = P.y - F.h * 0.65;
    const base = { w: 'form', x: P.x + f * 6, y, r: 4, life: 120, face: f };
    switch (P.form.form) {
      case 'zombie': addShot(Object.assign(base, { kind: 'pacid', vx: f * 2.6, vy: -2.4, grav: 0.16, dmg: 2, spr: SPR.acid })); Music.sfx('fire'); break;
      case 'skeleton': addShot(Object.assign(base, { kind: 'pbone', vx: f * 3.2 + P.vx * 0.3, vy: -2.4, grav: 0.15, dmg: 1.5, spr: SPR.bone, rot: 0 })); Music.sfx('throw'); break;
      case 'haunt': addShot(Object.assign(base, { kind: 'pslash', x: P.x + f * 14, y: P.y - 14, vx: 0, vy: 0, dmg: 4, pierce: true, life: 9, r: 13 })); Music.sfx('slice'); break;
      case 'imp': case 'arremer': addShot(Object.assign(base, { kind: 'pfire', vx: f * 3.4, vy: I.down && !P.onGround ? 2.2 : 0, dmg: 2, spr: SPR.fireball, r: 5 })); Music.sfx('fire'); break;
      case 'lemming': Music.sfx('ohno'); explode(P.x, P.y - 6, 46, 'player'); endPossession(false); break;
      default: break;
    }
  }
  function castMagic() {
    const P = S.P;
    P.charge = 0; P.charged = false;
    Music.sfx('cast'); flash(1); shake(8);
    bolts = [];
    for (const e of S.ents) {
      if (e.dead || e.untargetable || !onScreen(e.x, 10)) continue;
      bolts.push({ x: e.x, y: e.y - e.h / 2 });
      if (!e.inv) damage(e, e.boss ? 6 : 10, { x: e.x, y: e.y - e.h / 2 });
    }
    for (const s of S.eshots) fx('spark', s.x, s.y, 4);
    S.eshots = [];
    for (let i = 0; i < 4; i++) bolts.push({ x: S.cam.x + 30 + rnd() * 260, y: S.floorY });
    bolts.t = 16;
  }

  // ---------------------------------------------------------------- armor eject / anvil
  function ejectArmor() {
    const P = S.P;
    if (S.anvil) { fx('smoke', S.anvil.x, S.anvil.y - 6, 8); S.anvil = null; }
    S.anvil = { x: P.x + P.face * 4, y: P.y - 6, vx: P.face * 1.6, vy: -2.6, w: 9, h: 12, grav: 0.3, maxFall: 7, air: true, kind: P.armor === 'gold' ? 'gold' : 'steel', t: 0, onGround: false };
    fx(P.armor === 'gold' ? 'gplates' : 'plates', P.x, P.y - 14, 6);
    P.armor = 'none'; P.inv = Math.max(P.inv, 30); P.charge = 0; P.charged = false; P.jumps = 1;
    Music.sfx('eject');
  }
  function updateAnvil() {
    const A = S.anvil; if (!A) return;
    const P = S.P;
    A.t++;
    const vyB = A.vy, wasAir = A.air;
    if (!A.onGround) A.air = true;
    moveBody(A);
    if (A.onGround) {
      A.vx = 0;
      if (wasAir) {
        A.air = false;
        if (vyB > 1.5) { Music.sfx('clang'); shake(2); fx('dust', A.x - 8, A.y, 3); fx('dust', A.x + 8, A.y, 3); }
        if (vyB > 2.5) crackUnder(A);
      }
      if (A.gTile === 10 && A.gIdx >= 0 && !crumbles.has(A.gIdx)) crumbles.set(A.gIdx, 26);
    }
    // crush enemies while falling
    if (A.vy > 1 || (wasAir && !A.air)) {
      for (const e of S.ents) {
        if (e.dead || e.untargetable || e.inv) continue;
        if (Math.abs(e.x - A.x) < A.w + e.w && A.y > e.y - e.h && A.y < e.y + 4) {
          if (e.boss) { if (!A.bossHit) { damage(e, 5, A); A.bossHit = true; } }
          else { damage(e, 20, A); if (e.dead) { addScore(200, e.x, e.y - 20); banner('CRUSHED!', 50); } }
        }
      }
    }
    if (A.onGround) A.bossHit = false;
    const lc = tAt(A.x, A.y - 3);
    if (lc === 5 || lc === 13 || A.y > ROWS * 16 + 20) { if (lc === 5 || lc === 13) { fx('splash', A.x, A.y - 4, 12); Music.sfx('splash'); } S.anvil = null; banner('ARMOR LOST!', 70); return; }
    // springboard
    if (!P.dead && !P.soul && P.vy > 0.5 && Math.abs(P.x - A.x) < 12 && P.y >= A.y - A.h - 1 && P.prevY <= A.y - A.h + 3) {
      P.y = A.y - A.h; P.vy = -6.4; P.onGround = false; P.jumps = P.armor === 'none' && !P.form ? 1 : 0;
      Music.sfx('bounce'); fx('spark', A.x, A.y - A.h, 6); A.squash = 8;
    }
    if (A.squash > 0) A.squash--;
    // re-don: crouch beside the anvil
    if (P.armor === 'none' && !P.form && !P.dead && P.onGround && I.down && Math.abs(P.x - A.x) < 16 && Math.abs(P.y - A.y) < 10) {
      if (++P.donT >= 30) {
        P.armor = A.kind; S.anvil = null; P.donT = 0; P.inv = Math.max(P.inv, 20);
        Music.sfx('don'); fx(A.kind === 'gold' ? 'gold' : 'spark', P.x, P.y - 14, 16);
      }
    } else P.donT = 0;
  }
  function crackUnder(b) {
    let broke = false;
    for (const xx of [b.x - b.w + 1, b.x, b.x + b.w - 1]) {
      const c = tAt(xx, b.y + 2);
      if (c === 6) { breakRun(TI); broke = true; }
    }
    if (broke) { b.onGround = false; Music.sfx('crack'); shake(5); }
    return broke;
  }
  function breakRun(idx) {
    const w = S.world, ty = Math.floor(idx / w.w), tx = idx % w.w;
    breakTile(tx, ty);
    for (const d of [-1, 1]) for (let k = 1; k <= 4; k++) { const x = tx + d * k; if (w.t[ty * w.w + x] !== 6) break; breakTile(x, ty); }
  }
  function breakTile(tx, ty) {
    const w = S.world; w.t[ty * w.w + tx] = 0;
    const x = tx * 16 + 8, y = ty * 16 + 8 + (w.rock && x >= w.rock.x0 && x < w.rock.x1 ? rockDY : 0);
    fx('rubble', x, y, 10); fx('dust', x, y, 4);
  }

  // ---------------------------------------------------------------- possession
  function tryPossess() {
    const P = S.P;
    let best = null, bd = 230;
    for (const e of S.ents) {
      if (e.dead || e.boss || !Ents.POSS[e.type] || !onScreen(e.x, -4) || e.untargetable) continue;
      if (e.st === 'rise' || e.st === 'sink' || e.st === 'fuse') continue;
      const d = Math.hypot(e.x - P.x, (e.y - e.h / 2) - (P.y - 13));
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { Music.sfx('tink'); banner('NO SOUL TO POSSESS', 50); return; }
    P.soul = { t: 0, sx: P.x, sy: P.y - 14, target: best };
    Music.sfx('possess');
  }
  function updateSoul() {
    const P = S.P, s = P.soul, e = s.target;
    s.t++;
    const k = Math.min(1, s.t / 20), tx = e.x, ty = e.y - e.h / 2;
    const x = s.sx + (tx - s.sx) * k, y = s.sy + (ty - s.sy) * k - Math.sin(k * Math.PI) * 30;
    fx('soul', x, y, 2);
    s.x = x; s.y = y;
    if (e.dead) { P.soul = null; P.inv = 30; return; }
    if (s.t >= 20) {
      const f = Ents.POSS[e.type](e), F = FORMS[f.form];
      P.form = { form: f.form, set: f.set, t: 480, max: 480 };
      P.x = e.x; P.y = e.y; P.vx = 0; P.vy = 0; P.face = e.face; P.h = F.h; P.w = F.w; P.inv = 30; P.soul = null; P.climb = false; P.onGround = false;
      e.dead = true;
      fx('soul', P.x, P.y - F.h / 2, 16); flash(0.3);
      banner('POSSESSED ' + F.name + '!', 80);
    }
  }
  function endPossession(toArmor) {
    const P = S.P; if (!P.form) return;
    const F = FORMS[P.form.form];
    fx(P.form.form === 'skeleton' ? 'bones' : P.form.form === 'arremer' || P.form.form === 'imp' ? 'fire' : P.form.form === 'haunt' ? 'plates' : 'ecto', P.x, P.y - F.h / 2, 14);
    fx('soul', P.x, P.y - 14, 12);
    P.form = null; P.burrow = false; P.w = 5; P.h = 26;
    if (!toArmor) { P.inv = Math.max(P.inv, 90); P.vy = -3; Music.sfx('unpossess'); }
    // make sure Arthur isn't embedded in the ceiling after leaving a small body
    for (let k = 0; k < 16 && solidAt(P.x, P.y - P.h + 1); k++) P.y += 1;
  }

  // ---------------------------------------------------------------- player update
  function updatePlayer() {
    const P = S.P;
    P.prevY = P.y;
    if (P.inv > 0 && !P.soul) P.inv--;
    if (P.fireCd > 0) P.fireCd--;
    if (P.throwT > 0) P.throwT--;
    if (P.dropT > 0) P.dropT--;
    if (P.dead) {
      P.deadT++;
      if (P.deathCause !== 'liquid') { if (P.deadT < 40) { P.vy += 0.2; P.y += P.vy; if (!solidAt(P.x, P.y + 1) && P.deadT < 30) P.x -= P.face * 0.6; else if (solidAt(P.x, P.y)) { P.y = TT; P.vy = 0; } } }
      else P.y += 0.4;
      if (P.deadT === 40 && P.deathCause !== 'liquid') { fx('bones', P.x, P.y - 10, 5); Music.sfx('bones'); }
      if (P.deadT >= 150) loseLife();
      return;
    }
    if (P.soul) { updateSoul(); return; }

    const F = P.form ? FORMS[P.form.form] : null;
    // timers
    if (P.form) {
      if (--P.form.t <= 0) { endPossession(false); banner('THE CURSE FADES...', 60); return; }
    }

    const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    const spd = F ? F.spd : P.armor === 'none' ? 1.75 : P.armor === 'gold' ? 1.35 : 1.3;

    // ---- ladders
    if (!F && !P.climb && P.hurtT <= 0) {
      const midC = tAt(P.x, P.y - 10), belowC = tAt(P.x, P.y + 2);
      if ((I.up && midC === 3) || (I.down && P.onGround && belowC === 3)) {
        P.climb = true; P.vx = 0; P.vy = 0; P.x = Math.floor(P.x / 16) * 16 + 8; P.crouch = false;
        if (I.down && belowC === 3 && midC !== 3) P.y += 3;
      }
    }
    if (P.climb) {
      P.h = 26;
      const v = (I.up ? -1 : 0) + (I.down ? 1 : 0);
      P.y += v * 1.1; P.climbA += Math.abs(v);
      if (dir) P.face = dir;
      if (E.fire) fire();
      if (v < 0 && tAt(P.x, P.y - 1) !== 3) { P.y = Math.floor((P.y - 1) / 16) * 16 + 16; P.climb = false; P.onGround = true; P.vy = 0; }
      else if (v > 0 && tAt(P.x, P.y + 1) !== 3 && tAt(P.x, P.y - 12) !== 3) { P.climb = false; }
      else if (v > 0 && solidAt(P.x, P.y + 1) && tAt(P.x, P.y + 1) !== 3) { P.climb = false; }
      if (E.jump) { P.climb = false; P.vy = -1.5; P.vx = dir * spd * 0.6; }
      if (P.climb) { checkHazards(); return; }
    }

    // ---- horizontal & crouch
    const wasG = P.onGround;
    P.crouch = !F && P.onGround && I.down && P.hurtT <= 0;
    if (F && F === FORMS.zombie) {
      const want = P.onGround && I.down;
      if (want !== P.burrow) { P.burrow = want; fx('dust', P.x, P.y, 6); Music.sfx('crumble'); }
    } else P.burrow = false;
    P.h = F ? F.h : P.crouch ? 16 : 26;
    if (P.hurtT > 0) { P.hurtT--; }
    else if (P.crouch) { P.vx = 0; if (dir) P.face = dir; }
    else {
      const ts = dir * spd * (P.burrow ? 0.75 : 1);
      if (P.onGround) P.vx = P.throwT > 6 && !F ? P.vx * 0.5 : ts;
      else { const ac = P.armor === 'none' || F ? 0.25 : 0.1; P.vx += clamp(ts - P.vx, -ac, ac); }
      if (dir && P.throwT <= 6) P.face = dir;
    }
    // wind gusts shove the light-weight boxers (and possessed small bodies)
    P.push = 0;
    if (wind.on && P.armor === 'none' && !(F && F.heavy) && S.world.wind.some(z => P.x >= z[0] && P.x < z[1])) P.push = wind.dir * 0.75;

    // ---- jumping / flying
    if (P.onGround) { P.coyote = 6; P.jumps = (P.armor === 'none' && !F) ? 1 : 0; } else if (P.coyote > 0) P.coyote--;
    if (F && F.fly) {
      P.grav = 0.1; P.maxFall = 2;
      if (I.jump) P.vy = Math.max(-2.4, P.vy - 0.38);
      if (P.t % 6 === 0 && I.jump) Music.sfx('jump');
    } else { P.grav = 0.24; P.maxFall = 5.5; }
    if (E.jump && P.hurtT <= 0 && !(F && F.fly)) {
      if (P.onGround && I.down && !F && (P.gTile === 2 || P.gTile === 7)) { P.dropT = 10; P.y += 1; }
      else if (P.coyote > 0 && !P.burrow) { P.vy = F ? F.jump : P.armor === 'none' ? -4.4 : -4.6; P.coyote = 0; P.onGround = false; Music.sfx('jump'); }
      else if (P.jumps > 0 && !F) { P.vy = -3.8; P.jumps--; Music.sfx('djump'); fx('soul', P.x, P.y, 8); }
    }
    if (!I.jump && P.vy < -2 && P.armor === 'none' && !F) P.vy *= 0.8; // boxers: variable height
    P.t = (P.t || 0) + 1;

    // ---- physics
    const vyB = P.vy;
    moveBody(P);
    if (P.onGround) P.dist += Math.abs(P.vx);
    if (P.onGround && !wasG && vyB > 2.8) {
      if (heavyP(P)) { if (crackUnder(P)) banner('CRASH!', 40); else if (vyB > 4) { Music.sfx('land'); fx('dust', P.x - 5, P.y, 2); fx('dust', P.x + 5, P.y, 2); } }
    }
    if (P.onGround && P.gTile === 10 && !crumbles.has(P.gIdx)) crumbles.set(P.gIdx, 24);

    // ---- arena lock
    if (S.arena) { P.x = clamp(P.x, S.cam.x + 6, S.cam.x + W - 6); }
    P.x = Math.max(6, P.x);

    // ---- actions
    if (F) {
      if (E.fire || (I.fire && P.form.form === 'skeleton')) formAttack();
      if (E.act) { endPossession(false); banner('SOUL RELEASED', 50); }
    } else {
      if (E.fire) { fire(); P.charge = 0; }
      if (P.armor === 'gold') {
        if (I.fire) { P.charge++; if (P.charge === 20) Music.sfx('charge'); if (P.charge === 75) { P.charged = true; Music.sfx('charged'); } }
        else { if (P.charged) castMagic(); P.charge = 0; P.charged = false; }
      } else { P.charge = 0; P.charged = false; }
      if (E.act) {
        if (P.armor === 'gold' && P.charged) castMagic();
        else if (P.armor !== 'none') ejectArmor();
        else tryPossess();
      }
    }
    checkHazards();
  }
  function checkHazards() {
    const P = S.P; if (P.dead || P.soul) return;
    const mid = tAt(P.x, P.y - 4);
    if (mid === 5 && !P.burrow) { killPlayer('liquid'); return; }
    if (mid === 13) {
      if (P.armor === 'none' && !P.form) { if (P.inv <= 0) { fx('acid', P.x, P.y - 4, 12); killPlayer('nukage'); return; } }
      else if (P.inv <= 0) { fx('acid', P.x, P.y - 4, 10); hurtPlayer({ x: P.x - P.face }); }
      P.vy = -4.6; P.onGround = false; Music.sfx('splash');
    }
    if (P.onGround && P.gTile === 4 && !P.burrow) hurtPlayer({ x: P.x - P.face * 4 });
    else if (tAt(P.x - P.w + 1, P.y + 1) === 4 && tAt(P.x + P.w - 1, P.y + 1) === 4 && P.onGround) hurtPlayer({ x: P.x });
    if (P.y > ROWS * 16 + 30) killPlayer('pit');
    // gate closed on top of Arthur: push him back out
    const gc = tAt(P.x, P.y - 8);
    if (gc === 9 && solidCode(gc, TI)) P.x = Math.floor(P.x / 16) * 16 - P.w - 1;
  }

  // ============================================================ SHOTS
  function damage(e, dmg, src) {
    if (e.dead || e.inv) return false;
    if (e.def.hurt && e.def.hurt(e, dmg, S, src) === false) return true;
    e.hp -= dmg; e.flash = 10;
    Music.sfx(e.boss ? 'bosshit' : 'hit');
    if (e.hp <= 0) kill(e);
    return true;
  }
  const DEATHFX = { undead: ['ecto', 16, 'kill'], bone: ['bones', 7, 'bones'], demon: ['fire', 16, 'kill'], stone: ['rubble', 14, 'crack'], metal: ['spark', 14, 'clang'], fish: ['splash', 12, 'splash'], lemming: ['blood', 10, 'hit'], ghost: ['ghost', 16, 'kill'] };
  function kill(e) {
    if (e.def.die) { e.def.die(e, S); return; }
    e.dead = true;
    const d = DEATHFX[e.kind] || DEATHFX.undead;
    fx(d[0], e.x, e.y - e.h / 2, d[1]); if (e.kind === 'undead') fx('bones', e.x, e.y - e.h / 2, 2);
    if (e.kind === 'metal') fx('plates', e.x, e.y - 12, 6);
    Music.sfx(d[2]);
    addScore(e.score, e.x, e.y - e.h);
    if (!e.harmless && rnd() < (e.type === 'zombie' ? 0.07 : 0.14)) {
      const opts = ['bag', 'bag', 'gem', 'w_lance', 'w_dagger', 'w_torch', 'w_axe', 'w_cross'].filter(k => k !== 'w_' + S.P.weapon);
      drop(e.x, e.y - 12, opts[(rnd() * opts.length) | 0]);
    }
  }
  function boxesOf(e) { return e.def.boxes ? e.def.boxes(e) : [{ x0: e.x - e.w, y0: e.y - e.h, x1: e.x + e.w, y1: e.y, weak: true, harm: true }]; }
  const ovl = (x, y, r, b) => x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1;
  function killShot(s, sparks = true) { s.dead = true; if (sparks) fx('spark', s.x, s.y, 4); if (s.kind === 'torch') igniteTorch(s); }
  function igniteTorch(s) {
    const gy = groundBelow(s.x, s.y - 8);
    if (gy > ROWS * 16) return;
    addShot({ kind: 'flame', w: 'torch', x: s.x, y: gy, vx: s.face * 0.5, vy: 0, dmg: s.dmg * 0.6, life: 80, r: 6, pierce: true, tick: {} });
    Music.sfx('torch');
  }
  function updateShots() {
    const P = S.P;
    for (const s of S.pshots) {
      if (s.dead) continue;
      s.t++;
      if (--s.life <= 0) { if (s.kind === 'torch') igniteTorch(s); s.dead = true; continue; }
      if (s.kind === 'cross') {
        s.rot += 0.35;
        if (s.out) {
          if (s.dx) s.vx -= s.dx * 0.17; else s.vy -= s.dy * 0.17;
          if ((s.dx && sgn(s.vx) !== s.dx) || (s.dy && sgn(s.vy) !== s.dy) || s.t > 40) { s.out = false; s.hit.clear(); }
        } else {
          const a = Math.atan2(P.y - 14 - s.y, P.x - s.x), sp = Math.min(5.5, 2 + s.t * 0.05);
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
          if (Math.hypot(P.x - s.x, P.y - 14 - s.y) < 10 || P.dead) { s.dead = true; continue; }
        }
        s.x += s.vx; s.y += s.vy;
        for (const q of S.eshots) if (!q.dead && Math.hypot(q.x - s.x, q.y - s.y) < 9) { q.dead = true; fx('spark', q.x, q.y, 6); Music.sfx('tink'); addScore(10); }
      } else if (s.kind === 'flame') {
        s.x += s.vx; const gy = groundBelow(s.x, s.y - 10); if (Math.abs(gy - s.y) > 12) { s.dead = true; continue; } s.y = gy;
        if (s.t % 4 === 0) fx('fire', s.x + (rnd() - 0.5) * 8, s.y - 6, 1);
      } else if (s.kind === 'pslash') {
        s.x = P.x + P.face * 14; s.y = P.y - 14;
      } else {
        s.vy += s.grav; s.x += s.vx; s.y += s.vy;
        if (s.rot != null) s.rot += s.kind === 'axe' ? 0.3 * s.face : 0.25 * s.face;
        const c = tAt(s.x, s.y);
        if (solidCode(c, TI) || ((s.kind === 'torch' || s.kind === 'pacid') && (c === 2 || c === 5 || c === 13))) {
          if (s.kind === 'torch') { s.dead = true; igniteTorch(s); continue; }
          if (s.kind === 'axe' && s.vy < 0) { /* axes sail through when rising */ } else { killShot(s); continue; }
        }
      }
      if (!onScreen(s.x, 30) || s.y < -40 || s.y > ROWS * 16 + 40) { s.dead = true; continue; }
      // chests
      for (const ch of S.world.chests) if (ch.st === 'closed' && Math.abs(ch.x - s.x) < 10 + s.r && s.y > ch.y - 16 - s.r && s.y < ch.y + s.r) { openChest(ch); if (!s.pierce && s.kind !== 'cross') { killShot(s); break; } }
      if (s.dead) continue;
      // enemies
      for (const e of S.ents) {
        if (e.dead || e.untargetable || s.hit.has(e.id)) continue;
        if (s.kind === 'flame' && s.tick[e.id] > S.t) continue;
        const bs = boxesOf(e);
        let hitB = null;
        for (const b of bs) if (!b.ghost && ovl(s.x, s.y, s.r, b)) { hitB = b; if (b.weak) break; }
        if (!hitB) continue;
        if (e.inv) { if (!s.pierce && s.kind !== 'cross') { killShot(s); Music.sfx('tink'); } break; }
        if (!hitB.weak || (e.def.guard && e.def.guard(e, s, S))) {
          fx('spark', s.x, s.y, 6); Music.sfx('tink');
          if (s.kind === 'cross') { s.out = false; s.hit.add(e.id); }
          else if (s.kind !== 'flame' && s.kind !== 'pslash') { s.dead = true; if (s.kind === 'torch') igniteTorch(s); }
          break;
        }
        damage(e, s.dmg, s);
        fx(s.gold ? 'gold' : 'spark', s.x, s.y, 5);
        if (s.kind === 'flame') { s.tick[e.id] = S.t + 12; continue; }
        s.hit.add(e.id);
        if (!s.pierce && s.kind !== 'cross') { s.dead = true; if (s.kind === 'torch') igniteTorch(s); break; }
      }
    }
    S.pshots = S.pshots.filter(s => !s.dead);
  }
  function eshot(o) { const s = Object.assign({ t: 0, life: 200, r: 4, grav: 0, dead: false }, o); S.eshots.push(s); return s; }
  function updateEShots() {
    const P = S.P, A = S.anvil;
    for (const s of S.eshots) {
      if (s.dead) continue;
      s.t++;
      if (--s.life <= 0) { s.dead = true; continue; }
      if (s.homing && !P.dead) {
        const a = Math.atan2(P.y - 14 - s.y, P.x - s.x), c = Math.atan2(s.vy, s.vx);
        let d = a - c; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const na = c + clamp(d, -s.homing, s.homing), sp = s.spd || 1.5;
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      if (s.boomer) { s.boomer.t++; if (s.boomer.t > 45) { const a = Math.atan2(s.boomer.y - s.y, s.boomer.x - s.x), sp = Math.min(4, (s.boomer.t - 45) * 0.12); s.vx += Math.cos(a) * 0.25; s.vy += Math.sin(a) * 0.25; const m = Math.hypot(s.vx, s.vy); if (m > sp && sp > 0) { s.vx *= sp / m; s.vy *= sp / m; } if (Math.hypot(s.boomer.x - s.x, s.boomer.y - s.y) < 10) { s.dead = true; continue; } } }
      s.vy += s.grav; s.x += s.vx; s.y += s.vy;
      if (s.rot != null) s.ang = (s.ang || 0) + s.rot;
      if (s.ground !== 'pass') {
        const c = tAt(s.x, s.y);
        if (solidCode(c, TI) || c === 5) { s.dead = true; if (s.kind === 'cannonball') { fx('boom', s.x, s.y - 4); Music.sfx('explode'); if (!P.dead && Math.hypot(P.x - s.x, P.y - 12 - s.y) < 22) hurtPlayer(s); } else fx('spark', s.x, s.y, 3); continue; }
      }
      if (s.kind === 'wave' || s.ay) { if (s.t % 3 === 0) fx(s.spr === SPR.skull ? 'ghost' : 'fire', s.x, s.y - 3, 1); }
      if (!onScreen(s.x, 60) || s.y > ROWS * 16 + 30 || s.y < -60) { s.dead = true; continue; }
      // decoy anvil soaks shots
      if (A && Math.abs(A.x - s.x) < A.w + s.r && s.y > A.y - A.h - s.r && s.y < A.y + 2) { s.dead = true; fx('spark', s.x, s.y, 5); Music.sfx('clang'); continue; }
      if (P.dead || P.soul) continue;
      const pb = { x0: P.x - P.w, y0: P.y - P.h, x1: P.x + P.w, y1: P.y };
      if (P.burrow) pb.y0 = P.y - 4;
      if (ovl(s.x, s.y, s.r - 1, pb)) {
        if (P.form && P.form.form === 'haunt' && sgn(s.vx) !== P.face && Math.abs(s.vx) > 0.3) { s.dead = true; fx('spark', s.x, s.y, 5); Music.sfx('tink'); continue; }
        if (P.inv <= 0 && !P.burrow) { s.dead = true; hurtPlayer(s); }
      }
    }
    S.eshots = S.eshots.filter(s => !s.dead);
  }
  function explode(x, y, r, src) {
    fx('boom', x, y); fx('boom', x + (rnd() - 0.5) * r * 0.6, y + (rnd() - 0.5) * r * 0.4);
    fx('spark', x, y, 16); fx('smoke', x, y, 8);
    Music.sfx('explode'); shake(6); flash(0.25);
    for (const e of S.ents) {
      if (e.dead || e.untargetable || e.inv) continue;
      if (Math.hypot(e.x - x, e.y - e.h / 2 - y) < r + e.w) damage(e, e.boss ? 4 : 8, { x, y });
    }
    const P = S.P;
    if (src !== 'player' && !P.dead && Math.hypot(P.x - x, P.y - 13 - y) < r) hurtPlayer({ x });
    const w = S.world;
    for (let ty = Math.floor((y - r - 12) / 16); ty <= Math.floor((y + r + 12) / 16); ty++) for (let tx = Math.floor((x - r - 12) / 16); tx <= Math.floor((x + r + 12) / 16); tx++) {
      if (tx < 0 || ty < 0 || tx >= w.w || ty >= ROWS) continue;
      const c = w.t[ty * w.w + tx]; if (c !== 6 && c !== 10) continue;
      if (Math.hypot(tx * 16 + 8 - x, ty * 16 + 8 - y) < r + 14) { breakTile(tx, ty); Music.sfx('crack'); }
    }
  }

  // ============================================================ ITEMS & CHESTS
  const ITEM_SPR = () => ({ armor: SPR.armorItem, gold: SPR.goldItem, w_lance: SPR.w_lance, w_dagger: SPR.w_dagger, w_torch: SPR.w_torch, w_axe: SPR.w_axe, w_cross: SPR.w_cross, bag: SPR.bag, gem: SPR.gem, potion: SPR.potion, floppy: SPR.floppy, cursed: SPR.cursedFloppy });
  let ISPR = null;
  function drop(x, y, kind, vy = -3) { const it = { kind, x, y, vx: 0, vy, w: 6, h: 10, t: 0, onGround: false, grav: 0.18, maxFall: 3, dropT: kind === 'floppy' || kind === 'cursed' ? 1 : 0 }; S.items.push(it); return it; }
  function openChest(ch) {
    const P = S.P;
    ch.st = 'open'; ch.t = 0;
    Music.sfx('open'); fx('gold', ch.x, ch.y - 10, 16);
    if (P.form) {
      endPossession(true); P.armor = ch.kind === 'm' ? 'gold' : 'steel'; P.inv = 60;
      Music.sfx(ch.kind === 'm' ? 'gold' : 'armor'); banner(ch.kind === 'm' ? 'GOLDEN ARMOR!' : 'ARMOR RECLAIMED!', 90);
      return;
    }
    let k;
    if (ch.kind === 'm') { k = 'gold'; banner("THE MAGICIAN'S CHEST!", 90); }
    else if (P.armor === 'none') k = 'armor';
    else { const r = rnd(); if (r < 0.55) { const ws = ['w_lance', 'w_dagger', 'w_torch', 'w_axe', 'w_cross'].filter(w => w !== 'w_' + P.weapon); k = ws[(rnd() * ws.length) | 0]; } else k = r < 0.85 ? 'bag' : 'gem'; }
    const it = drop(ch.x, ch.y - 14, k, -3.6); it.vx = 0;
  }
  function updateChests() {
    const P = S.P;
    for (const ch of S.world.chests) {
      ch.t = (ch.t || 0) + 1;
      if (!ch.st) ch.st = 'hidden';
      if (ch.st === 'hidden') {
        const near = Math.abs(P.x - ch.x) < (ch.kind === 'T' ? 44 : 64) && Math.abs(P.y - ch.y) < 60;
        if (near && !P.dead && (ch.kind === 'T' || spectral())) { ch.st = 'rising'; ch.rise = 0; Music.sfx('chest'); fx('dust', ch.x, ch.y, 8); }
      } else if (ch.st === 'rising') { ch.rise += 1 / 30; if (ch.rise >= 1) ch.st = 'closed'; if (ch.t % 4 === 0) fx('dust', ch.x + (rnd() - 0.5) * 16, ch.y, 1); }
      else if (ch.st === 'closed') { if (!P.dead && !P.soul && Math.abs(P.x - ch.x) < 11 + P.w && P.y > ch.y - 16 && P.y - P.h < ch.y) openChest(ch); }
    }
  }
  function updateItems() {
    const P = S.P;
    for (const it of S.items) {
      it.t++;
      moveBody(it);
      const lc = tAt(it.x, it.y - 2);
      if (lc === 5 || lc === 13 || it.y > ROWS * 16 + 20) { if (it.kind === 'floppy' || it.kind === 'cursed') { it.vy = 0; it.x = S.cam.x + 160; for (let k = 0; k < 20; k++) { const xx = S.cam.x + 160 + (k & 1 ? 1 : -1) * ((k + 1) >> 1) * 16; if (solidAt(xx, S.floorY + 2)) { it.x = xx; break; } } it.y = S.floorY - 40; } else it.dead = true; }
      if (it.t > 720 && !['armor', 'gold', 'floppy', 'cursed'].includes(it.kind)) it.dead = true;
      if (it.dead || P.dead || P.soul || it.t < 20) continue;
      if (Math.abs(P.x - it.x) < P.w + 7 && P.y > it.y - 12 && P.y - P.h < it.y) pickup(it);
    }
    S.items = S.items.filter(i => !i.dead);
  }
  function pickup(it) {
    const P = S.P, k = it.kind;
    if (P.form && k.startsWith('w_')) return;
    it.dead = true;
    if (k === 'armor' || k === 'potion') {
      if (P.form) endPossession(true);
      if (P.armor === 'none') { P.armor = 'steel'; Music.sfx('armor'); fx('spark', P.x, P.y - 14, 16); banner('ARMOR!', 50); }
      else addScore(k === 'potion' ? 2000 : 1000, it.x, it.y - 12), Music.sfx('coin');
    } else if (k === 'gold') {
      if (P.form) endPossession(true);
      P.armor = 'gold'; Music.sfx('gold'); fx('gold', P.x, P.y - 14, 30); flash(0.4); banner('GOLDEN ARMOR! HOLD FIRE TO CHARGE MAGIC', 150);
    } else if (k.startsWith('w_')) { P.weapon = k.slice(2); Music.sfx('pickup'); banner(WEAP[P.weapon].name, 60); }
    else if (k === 'bag') { addScore(500, it.x, it.y - 12); Music.sfx('coin'); }
    else if (k === 'gem') { addScore(1000, it.x, it.y - 12); Music.sfx('coin'); }
    else if (k === 'floppy' || k === 'cursed') stageClear(k === 'cursed');
  }

  // ============================================================ WORLD STATE (plates, gates, crumbles, spawns, zones)
  function updateWorld() {
    const w = S.world, P = S.P;
    // crumbling tiles
    for (const [idx, t] of crumbles) {
      if (t <= 1) {
        crumbles.delete(idx);
        if (w.t[idx] === 10) { w.t[idx] = 0; const x = (idx % w.w) * 16 + 8, y = Math.floor(idx / w.w) * 16 + 4; S.parts.push({ k: 'tile', x, y, vx: 0, vy: 0.5, g: 0.2, life: 50, c: 0 }); fx('dust', x, y, 3); if (onScreen(x, 10)) Music.sfx('crumble'); }
      } else crumbles.set(idx, t - 1);
    }
    // pressure plates
    const bodies = [];
    if (!P.dead && heavyP(P) && P.onGround) bodies.push(P);
    if (S.anvil && S.anvil.onGround) bodies.push(S.anvil);
    for (const e of S.ents) if (!e.dead && !e.fly && e.onGround && !e.untargetable && e.kind !== 'lemming') bodies.push(e);
    const pressedG = {};
    for (const pl of w.plates) {
      const cx = pl.tx * 16 + 8, top = pl.ty * 16;
      const was = pl.pressed;
      pl.pressed = bodies.some(b => Math.abs(b.x - cx) < 8 + b.w && Math.abs(b.y - top) < 2);
      if (pl.pressed && !was) Music.sfx('plate');
      if (pl.action === 'potion') { if (pl.pressed && !pl.done) { pl.done = true; drop(cx, 40, 'potion', 0); Music.sfx('chest'); banner('A POTION FALLS!', 60); } }
      else if (pl.pressed) pressedG[pl.group] = true;
    }
    for (const g in w.gates) {
      if (pressedG[g]) plateHold[g] = 90; else plateHold[g] = (plateHold[g] || 0) - 1;
      if (plateHold[g] === 0 && !(w.hinted || (w.hinted = {}))[g]) { w.hinted[g] = true; banner('GATE CLOSING! LEAVE YOUR ANVIL (E) ON THE PLATE', 150); }
      const target = plateHold[g] > 0 ? 1 : 0, o = w.gateOpen[g];
      if (o !== target) {
        if ((target === 1 && o === 0) || (target === 0 && o === 1)) { const gt = w.gates[g][0]; if (onScreen(gt.tx * 16, 60)) Music.sfx('gate'); }
        w.gateOpen[g] = clamp(o + (target ? 0.04 : -0.03), 0, 1);
      }
    }
    // spawns come alive as the camera approaches
    for (const sp of w.spawns) {
      if (sp.done || S.arena) continue;
      if (sp.x < S.cam.x + W + 40 && sp.x > S.cam.x - 40) { sp.done = true; spawn(sp.type, sp.x, sp.y, Object.assign({}, sp.o)); }
    }
    // generator zones
    if (!S.arena && !P.dead) for (const z of w.zones) {
      if (P.x < z.x0 || P.x > z.x1) continue;
      if (--z.cd > 0) continue;
      z.cd = z.rate / S.diff;
      if (S.ents.filter(e => e.zone === z && !e.dead).length >= z.max) continue;
      spawnZone(z);
    }
    // wind gusts
    if (w.wind.length) {
      if (wind.on) { if (--wind.t <= 0) { wind.on = false; wind.cd = 200 + rnd() * 200; } }
      else if (--wind.cd <= 0) { wind.on = true; wind.t = 110; wind.dir = rnd() < 0.5 ? -1 : 1; if (w.wind.some(z => P.x >= z[0] && P.x < z[1])) { Music.sfx('wind'); banner(wind.dir > 0 ? 'GUST! >>>' : '<<< GUST!', 50); } }
    }
    // checkpoints
    for (let i = 0; i < w.checks.length; i++) {
      if (i > checkpoint && P.x > w.checks[i].x && !P.dead) { checkpoint = i; banner('CHECKPOINT', 60); Music.sfx('select'); }
    }
    for (const d of w.decos) if (d.type === 'flag') d.on = d.check <= checkpoint;
  }
  function spawnZone(z) {
    const P = S.P;
    if (z.type === 'zombie') {
      for (let k = 0; k < 6; k++) {
        const x = P.x + (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 110);
        if (x < z.x0 || x > z.x1 || !onScreen(x, -16)) continue;
        let sy = Math.max(0, P.y - 70); while (sy < ROWS * 16 && solidAt(x, sy)) sy += 4;
        const gy = groundBelow(x, sy);
        if (gy > ROWS * 16) continue;
        const c = tAt(x, gy + 2); if (c !== 1) continue;
        if (Math.abs(gy - P.y) > 90) continue;
        const e = spawn('zombie', x, gy, Object.assign({}, z.o)); if (e) e.zone = z;
        return;
      }
    } else {
      const x = S.cam.x + (rnd() < 0.5 ? -8 : W + 8), y = 60 + rnd() * 80;
      const e = spawn(z.type, x, y, {}); if (e) e.zone = z;
    }
  }
  function spawn(type, x, y, o) { const e = Ents.create(type, x, y, o || {}); if (e) S.ents.push(e); return e; }

  function updateEnts() {
    const P = S.P;
    for (const e of S.ents) {
      if (e.dead) continue;
      const active = e.boss || (e.x > S.cam.x - 120 && e.x < S.cam.x + W + 120);
      if (!active) { if (e.x < S.cam.x - 300 && !e.boss) e.dead = true; continue; }
      e.t++; if (e.flash > 0) e.flash--;
      e.def.update(e, S);
      if (e.dead) continue;
      // walkers drown / fall
      if (!e.fly && !e.boss) {
        const c = tAt(e.x, e.y - 3);
        if (c === 5 || c === 13) { e.dead = true; fx(c === 5 ? 'splash' : 'acid', e.x, e.y - 4, 10); Music.sfx('splash'); continue; }
        if (e.y > ROWS * 16 + 30) { e.dead = true; continue; }
      }
      // contact damage
      if (P.dead || P.soul || e.noHarm || e.harmless) continue;
      if (P.form && !e.boss && !e.def.boxes) continue;
      const pb = { x0: P.x - P.w + 1, y0: P.y - P.h + 2, x1: P.x + P.w - 1, y1: P.y };
      if (P.burrow) pb.y0 = P.y - 4;
      for (const b of boxesOf(e)) {
        if (!b.harm) continue;
        if (P.form && !e.boss && !b.crush && !b.ghost) continue;
        if (pb.x1 > b.x0 && pb.x0 < b.x1 && pb.y1 > b.y0 && pb.y0 < b.y1) {
          if (b.crush && P.armor === 'none' && !P.form && P.inv <= 0) { killPlayer('crush'); fx('blood', P.x, P.y - 8, 10); }
          else hurtPlayer(e);
          break;
        }
      }
    }
    S.ents = S.ents.filter(e => !e.dead);
  }

  // ============================================================ TARGETING (decoy anvil / possession)
  S.target = e => {
    const P = S.P, A = S.anvil;
    const hidden = P.dead || P.soul || P.form || P.burrow;
    if (A && !A.air) {
      const da = Math.hypot(A.x - e.x, A.y - e.y), dp = hidden ? 1e9 : Math.hypot(P.x - e.x, P.y - e.y);
      if (da < dp && da < 170) return { x: A.x, y: A.y, anvil: true };
    }
    if (hidden) return null;
    return { x: P.x, y: P.y };
  };

  // ============================================================ STAGE FLOW
  function startGame(i) {
    Music.init();
    score = 0; lives = 3; S.loop = 0; S.diff = 1; fragments = i; nextLife = 20000;
    S.P = newPlayer(40, 176);
    S.P.weapon = 'lance';
    checkpoint = -1;
    goMap(i, false);
  }
  function goMap(i, afterDeath) { stageIdx = i; state = 'map'; stT = 0; mapFrom = afterDeath ? i : Math.max(0, i - 1); deathMap = afterDeath; Music.play('map'); }
  function beginStage(i, keepPlayer) {
    stageIdx = i;
    S.world = Stages.build(i);
    gateOf = {}; for (const g in S.world.gates) for (const t of S.world.gates[g]) gateOf[t.ty * S.world.w + t.tx] = g;
    plateHold = {}; crumbles = new Map();
    S.ents = []; S.pshots = []; S.eshots = []; S.items = []; S.parts = []; S.anvil = null; S.arena = null; S.boss = null; bossDelay = -1; bolts = []; popups = [];
    for (const d of S.world.decos) if (d.type === 'flag') d.on = d.check <= checkpoint;
    const cp = checkpoint >= 0 ? S.world.checks[checkpoint] : null;
    let sy = 24; while (sy < ROWS * 16 && solidAt(40, sy)) sy += 4;
    const x = cp ? cp.x : 40, y = cp ? cp.y : groundBelow(40, sy);
    const keep = keepPlayer ? S.P : null;
    S.P = newPlayer(x, y, keep);
    S.cam.x = clamp(x - 120, 0, S.world.w * 16 - W);
    timeF = 240 * 60;
    initWeather();
    state = 'play'; stT = 0;
    Music.play('s' + i); Music.setBoxers(false);
    banner(checkpoint >= 0 ? 'CONTINUE FROM CHECKPOINT' : 'STAGE ' + (i + 1) + ' · READY!', 110);
  }
  function loseLife() {
    lives--;
    if (lives < 0) { state = 'gameover'; stT = 0; continueT = 10 * 60 - 1; Music.play('over'); saveHi(); return; }
    goMap(stageIdx, true);
  }
  function lockArena() {
    const A = S.world.arena;
    S.arena = A; S.floorY = groundBelow(A.x + 8, 40);
    bossDelay = 70;
    for (const e of S.ents) if (!e.boss && e.type !== 'piston') { e.dead = true; fx('smoke', e.x, e.y - 10, 4); }
    Music.play('boss');
    banner('WARNING! ' + S.world.def.boss, 140);
  }
  function stageClear(final) {
    state = 'clear'; stT = 0; bannerT = 0;
    const tb = Math.floor(timeF / 60) * 20;
    clearInfo = { tb, final, shown: 0 };
    Music.play('clear');
    if (!final) fragments = Math.min(5, fragments + 1);
    saveHi();
  }
  S.bossDefeated = e => {
    S.boss = null;
    addScore(e.score, e.x, e.y - 60);
    for (const o of S.ents) if (!o.boss && !o.dead) { o.dead = true; fx('smoke', o.x, o.y - 10, 4); }
    S.eshots = [];
    const final = S.world.idx === 5;
    const it = drop(clamp(e.x, S.cam.x + 40, S.cam.x + 280), Math.min(e.y - 40, S.floorY - 60), final ? 'cursed' : 'floppy', -2);
    it.t = 0;
    Music.play('floppy');
    banner(final ? 'THE CURSED FLOPPY DISK!' : 'FLOPPY FRAGMENT ' + (fragments + 1) + '/5', 160);
  };
  function saveHi() { try { localStorage.setItem('gng_cursed_hi', String(hi)); } catch (e) { /* ignore */ } }

  // ============================================================ WEATHER & LIGHTNING
  function initWeather() {
    weather = [];
    const k = Stages.THEMES[S.world.idx].weather;
    const n = k === 'rain' ? 70 : k === 'leaves' ? 24 : 36;
    for (let i = 0; i < n; i++) weather.push({ x: rnd() * W, y: rnd() * H, v: 0.5 + rnd(), p: rnd() * 6 });
    lightT = 200 + rnd() * 300;
  }
  function updateWeather() {
    const th = Stages.THEMES[S.world.idx], k = th.weather, wd = wind.on && S.world.wind.length ? wind.dir * 2 : 0;
    for (const p of weather) {
      if (k === 'rain') { p.x += -1.2 + wd; p.y += 5 * p.v; }
      else if (k === 'leaves') { p.x += Math.sin(S.t * 0.03 + p.p) * 0.5 - 0.3 + wd * 1.5; p.y += 0.4 * p.v; }
      else if (k === 'dust') { p.x += Math.sin(S.t * 0.01 + p.p) * 0.15; p.y += 0.1 * p.v; }
      else if (k === 'sparks') { p.y += 1.8 * p.v; p.x += Math.sin(p.p + S.t * 0.1) * 0.3; }
      else { p.y -= 0.5 * p.v; p.x += Math.sin(S.t * 0.02 + p.p) * 0.3; }
      if (p.y > H) { p.y = -4; p.x = rnd() * W; } if (p.y < -5) { p.y = H; p.x = rnd() * W; }
      if (p.x < -5) p.x += W + 10; if (p.x > W + 5) p.x -= W + 10;
    }
    if (th.lightning) {
      if (--lightT <= 0) { lightT = 300 + rnd() * 600; lightSeq = 14; }
      if (lightSeq > 0) { lightSeq--; if (lightSeq === 13 || lightSeq === 8) flash(0.55); if (lightSeq === 4) Music.sfx('thunder'); }
    }
  }
  function drawWeather() {
    const k = Stages.THEMES[S.world.idx].weather;
    for (const p of weather) {
      if (k === 'rain') G.line(p.x, p.y, p.x - 1, p.y + 4, hex('#6a7aa8'));
      else if (k === 'leaves') { G.pset(p.x, p.y, hex('#8a5a20')); G.pset(p.x + 1, p.y, hex('#a06a28')); }
      else if (k === 'dust') G.blend(p.x, p.y, hex('#a0a8c0'), 0.4);
      else if (k === 'sparks') G.pset(p.x, p.y, (S.t + p.p * 10) & 8 ? hex('#ffd040') : hex('#ff8a20'));
      else if (k === 'embers') G.pset(p.x, p.y, hex('#ff6a20'));
      else G.pset(p.x, p.y, (p.p > 3) ? hex('#6a6a70') : hex('#ff5a3a'));
    }
  }

  // ============================================================ TICK
  function tick() {
    readInput();
    S.t++; stT++;
    if (G.fx.flash > 0) G.fx.flash = Math.max(0, G.fx.flash - 0.06);
    if (shakeT > 0) { shakeT--; if (!shakeT) shakeK = 0; }
    switch (state) {
      case 'boot': state = 'title'; stT = 0; break;
      case 'title': tickTitle(); break;
      case 'map': if ((stT > 50 && anyStart()) || stT > 230) beginStage(stageIdx, true); break;
      case 'play': if (!paused) tickPlay(); break;
      case 'clear': tickClear(); break;
      case 'gameover':
        if (stT > 40 && anyStart()) { lives = 3; score = 0; nextLife = 20000; checkpoint = -1; S.P = newPlayer(40, 176); goMap(stageIdx, false); break; }
        if (--continueT <= 0) { state = 'title'; stT = 0; Music.play('title'); }
        break;
      case 'ending': endT++; if (endT > 240 && anyStart()) afterEnding(); break;
      default: break;
    }
  }
  function tickTitle() {
    if (stT === 2) Music.play('title');
    if (anyStart() && stT > 10) startGame(0);
  }
  function tickPlay() {
    const P = S.P, w = S.world;
    rockDY = w.rock ? Math.sin(S.t * 0.03) * 5 : 0;
    updatePlayer();
    Music.setBoxers(P.armor === 'none' && !P.dead);
    updateAnvil();
    updateWorld();
    updateEnts();
    updateChests();
    updateShots();
    updateEShots();
    updateItems();
    updateParts();
    updateWeather();
    if (bolts.t > 0) bolts.t--;
    for (const p of popups) { p.t--; p.y -= 0.4; }
    popups = popups.filter(p => p.t > 0);
    if (bannerT > 0) bannerT--;
    // boss arena trigger / spawn
    if (!S.arena && w.arena && P.x > w.arena.x + 48 && !P.dead) lockArena();
    if (bossDelay > 0 && --bossDelay === 0) { S.boss = spawn(w.arena.boss, w.arena.x + 250, S.floorY, {}); }
    // camera
    const tx = S.arena ? S.arena.x : clamp(P.x - 150 + P.face * 16, 0, w.w * 16 - W);
    S.cam.x += (tx - S.cam.x) * (S.arena ? 0.08 : 0.14);
    if (!S.arena) S.cam.x = clamp(S.cam.x, Math.max(0, P.x - 250), Math.min(w.w * 16 - W, P.x - 60));
    // time
    if (!P.dead && !(S.boss && S.boss.st === 'dying')) { if (--timeF <= 0) { timeF = 0; banner('TIME UP!', 90); killPlayer('time'); } if (timeF === 30 * 60) Music.sfx('pause'); }
    if (E.start) { paused = true; Music.sfx('pause'); }
  }
  function tickClear() {
    updateParts();
    if (clearInfo.tb > 0 && stT > 60) { const d = Math.min(clearInfo.tb, 100); clearInfo.tb -= d; clearInfo.shown += d; addScore(d); if (stT % 4 === 0) Music.sfx('coin'); }
    if (stT > 280 && anyStart() || stT > 480) {
      if (clearInfo.final) { state = 'ending'; endT = 0; Music.play('ending'); }
      else { checkpoint = -1; goMap(Math.min(5, stageIdx + 1), false); }
    }
  }
  function afterEnding() {
    if (S.loop === 0) { S.loop = 1; S.diff = 1.3; checkpoint = -1; fragments = 0; S.P = newPlayer(40, 176, S.P); goMap(0, false); }
    else { saveHi(); state = 'title'; stT = 0; Music.play('title'); }
  }

  // ============================================================ RENDER
  function render() {
    if (state === 'title' || state === 'boot') drawTitle();
    else if (state === 'map') drawMap();
    else if (state === 'play' || state === 'clear') { drawWorld(); drawHUD(); if (state === 'clear') drawClear(); if (paused) drawPaused(); }
    else if (state === 'gameover') drawGameOver();
    else if (state === 'ending') drawEnding();
    const sx = shakeT > 0 ? Math.round((rnd() - 0.5) * shakeK) : 0, sy = shakeT > 0 ? Math.round((rnd() - 0.5) * shakeK) : 0;
    G.fx.tintA = state === 'play' && S.P && S.P.armor === 'none' && !S.P.dead ? 0.07 : 0;
    G.fx.tintR = 120; G.fx.tintG = 220; G.fx.tintB = 255;
    G.present(sx, sy);
  }
  function drawBackdrop(idx, camX) {
    const w = S.world;
    G.fb.set(w.gfx.sky);
    const far = w.gfx.far, mid = w.gfx.mid;
    G.blitWrap(far, camX * 0.15, 172 - far.h);
    G.blitWrap(mid, camX * 0.4, 188 - mid.h);
  }
  function drawTiles() {
    const w = S.world, ts = w.gfx.tiles, cx = Math.floor(S.cam.x), cy = S.cam.y;
    const tx0 = Math.max(0, Math.floor(cx / 16)), tx1 = Math.min(w.w - 1, tx0 + 21);
    const f4 = (S.t >> 3) & 3, spec = spectral();
    for (let ty = 0; ty < ROWS; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const idx = ty * w.w + tx, c = w.t[idx];
      if (!c) continue;
      let X = tx * 16 - cx, Y = ty * 16 - cy;
      if (w.rock && tx * 16 >= w.rock.x0 && tx * 16 < w.rock.x1) Y += Math.round(rockDY);
      const above = ty > 0 ? w.t[idx - w.w] : 0;
      const top = !(above === 1 || above === 6 || above === 8 || above === 4 || above === 9);
      const v = (G.hash(tx, ty, 7) * 4) | 0;
      switch (c) {
        case 1: { const m = ts.mats[w.matAt(tx, ty)]; G.blit(top ? m.top[v] : m.in[v], X, Y); break; }
        case 2: G.blit(ts.oneway, X, Y); break;
        case 3: G.blit(ts.ladder, X, Y); break;
        case 4: G.blit(ts.spikes, X, Y); break;
        case 5: G.blit(above === 5 ? ts.liq[f4] : ts.liqTop[f4], X, Y); break;
        case 6: { const m = w.matAt(tx, ty); G.blit(ts.cracked[m][top ? 0 : 1], X, Y); break; }
        case 7: if (spec) { G.blit(ts.ghost, X, Y, false, 2, 0.45 + Math.sin(S.t * 0.08 + tx) * 0.15); if (((S.t >> 2) + tx * 3) % 23 === 0) G.pset(X + (S.t % 16), Y + 2, hex('#ffffff')); } else if (G.hash(tx, S.t >> 4, 3) < 0.02) G.pset(X + 8, Y + 2, hex('#6a8aa0')); break;
        case 8: { const pl = w.plates.find(p => p.tx === tx && p.ty === ty); G.blit(ts.plate[w.matAt(tx, ty)][pl && (pl.pressed || pl.done) ? 1 : 0], X, Y); break; }
        case 9: {
          const g = gateOf[idx], o = w.gateOpen[g] || 0, list = w.gates[g], topTy = list[0].ty, n = list.length;
          const oy = Math.round(o * n * 16);
          if (Y - oy >= topTy * 16 - cy) G.blit(ty === list[n - 1].ty ? ts.gateBot : ts.gate, X, Y - oy);
          break;
        }
        case 10: { const t = crumbles.get(idx); G.blit(ts.crumble, X + (t ? ((t >> 1) & 1) * 2 - 1 : 0), Y); break; }
        case 11: G.blit(ts.conv[-1][(S.t >> 2) & 3], X, Y); break;
        case 12: G.blit(ts.conv[1][(S.t >> 2) & 3], X, Y); break;
        case 13: G.blit(above === 13 ? ts.nuk[f4] : ts.nukTop[f4], X, Y); if (above !== 13 && (tx + (S.t >> 3)) % 3 === 0) G.glow(X + 8, Y + 2, 12, hex('#40ff40'), 0.18); break;
        default: break;
      }
    }
  }
  function drawWorld() {
    const w = S.world, cx = Math.floor(S.cam.x), cy = S.cam.y;
    drawBackdrop(w.idx, cx);
    // decos behind the playfield
    for (const d of w.decos) {
      const X = d.x - cx; if (X < -80 || X > W + 80) continue;
      let Y = d.y - cy; if (w.rock && d.x >= w.rock.x0 && d.x < w.rock.x1) Y += Math.round(rockDY);
      Stages.drawDeco(d, X, Y, S.t);
    }
    drawTiles();
    // falling tile debris
    for (const p of S.parts) if (p.k === 'tile') { G.blit(w.gfx.tiles.crumble, p.x - 8 - cx, p.y - 8 - cy); }
    drawChests();
    for (const it of S.items) drawItem(it);
    drawAnvil();
    for (const e of S.ents) if (!e.boss) drawEnt(e);
    for (const e of S.ents) if (e.boss) drawEnt(e);
    drawPlayer();
    drawShots();
    drawParts();
    drawBolts();
    drawWeather();
    for (const p of popups) G.textC(p.text, p.x - cx, p.y - cy, hex('#ffffff'), hex('#000000'));
  }
  function drawEnt(e) {
    const X = e.x - S.cam.x, Y = e.y - S.cam.y;
    if (!e.boss && (X < -60 || X > W + 60)) return;
    e.def.draw(e, X, Y, S);
  }
  function drawChests() {
    const cx = S.cam.x, cy = S.cam.y, spec = spectral();
    for (const ch of S.world.chests) {
      const X = ch.x - cx, Y = ch.y - cy; if (X < -20 || X > W + 20) continue;
      const set = SPR.chest[ch.kind === 'm' ? 'm' : 'T'];
      if (ch.st === 'hidden' || !ch.st) {
        if (ch.kind !== 'T' && spec) { G.blit(set[0], X, Y, false, 2, 0.3 + Math.sin(S.t * 0.1) * 0.12); if (S.t % 6 === 0) fx('soul', ch.x + (rnd() - 0.5) * 14, ch.y - rnd() * 14, 1); }
      } else if (ch.st === 'rising') G.blit(set[0], X, Y + (1 - ch.rise) * 16, false, 0, 0, Y);
      else if (ch.st === 'closed') { G.blit(set[0], X, Y); if (ch.kind === 'm') G.glow(X, Y - 8, 14, hex('#c060ff'), 0.3 + Math.sin(S.t * 0.1) * 0.1); }
      else if (ch.st === 'open' && ch.t < 120) { if (ch.t < 90 || (ch.t & 2)) G.blit(set[1], X, Y); }
    }
  }
  function drawItem(it) {
    if (!ISPR) ISPR = ITEM_SPR();
    const X = it.x - S.cam.x, Y = it.y - S.cam.y;
    if (it.t > 600 && (it.t & 4) && !['armor', 'gold', 'floppy', 'cursed'].includes(it.kind)) return;
    const s = ISPR[it.kind]; if (!s) return;
    const bob = it.onGround ? Math.round(Math.sin(it.t * 0.1)) : 0;
    const glowC = it.kind === 'gold' ? hex('#ffd040') : it.kind === 'cursed' ? hex('#ff2040') : it.kind === 'floppy' ? hex('#60a0ff') : it.kind === 'armor' ? hex('#c0d0ff') : 0;
    if (glowC) G.glow(X, Y - 7, 16, glowC, 0.35 + Math.sin(it.t * 0.15) * 0.15);
    if (it.kind.startsWith('w_')) { G.rect(X - 10, Y - 12 + bob, 20, 12, hex('#1a1020')); G.frame(X - 10, Y - 12 + bob, 20, 12, hex('#f0c848')); G.blit(s, X, Y - 6 + bob); }
    else G.blit(s, X, Y + bob);
  }
  function drawAnvil() {
    const A = S.anvil; if (!A) return;
    const X = A.x - S.cam.x, Y = A.y - S.cam.y + (A.squash > 0 ? 1 : 0);
    G.blit(SPR.anvil[A.kind], X, Y);
    const P = S.P;
    if (P.armor === 'none' && !P.form && Math.abs(P.x - A.x) < 40 && (S.t & 16)) G.textC(P.donT > 0 ? 'DON!' : 'DOWN: DON', X, Y - 26, hex('#fff080'), hex('#000000'));
    if (P.donT > 0) { const k = P.donT / 30; for (let i = 0; i < 24 * k; i++) { const a = i / 24 * Math.PI * 2 - Math.PI / 2; G.pset(X + Math.cos(a) * 12, Y - 8 + Math.sin(a) * 12, hex('#fff080')); } }
  }
  const FRAME_SPR = P => (P.armor === 'gold' ? SPR.gold : P.armor === 'steel' ? SPR.steel : SPR.boxers);
  function drawPlayer() {
    const P = S.P, X = P.x - S.cam.x, Y = P.y - S.cam.y;
    if (P.soul) {
      const s = P.soul;
      G.glow(s.x - S.cam.x, s.y - S.cam.y, 12, hex('#80e0ff'), 0.9);
      G.disc(s.x - S.cam.x, s.y - S.cam.y, 3, hex('#ffffff'));
      return;
    }
    if (P.dead) {
      if (P.deathCause === 'liquid') { G.blit(SPR.boxers.hurt, X, Y, P.face < 0, 0, 0, Math.floor(P.y - P.deadT * 0.4 - S.cam.y + 4)); return; }
      if (P.deadT < 40) G.blit(FRAME_SPR(P).hurt, X, Y, P.face < 0);
      else { const k = Math.min(1, (P.deadT - 40) / 60); G.blit(SPR.arthurBones, X, Y + k * 20, P.face < 0, 0, 0, Y + 1); if (k >= 1) G.blit(SPR.bonePile, X, Y); }
      return;
    }
    if (P.inv > 0 && (P.inv & 2) && P.inv < 200) return;
    if (P.form) { drawForm(P, X, Y); return; }
    const set = FRAME_SPR(P);
    let f;
    if (P.climb) f = ((P.climbA / 6) | 0) & 1 ? 'climb1' : 'climb0';
    else if (P.hurtT > 0) f = 'hurt';
    else if (P.throwT > 0) f = P.crouch ? 'throwC' : P.throwDir < 0 ? 'throwU' : P.throwT > 6 ? 'throw0' : 'throw1';
    else if (P.crouch) f = 'crouch';
    else if (!P.onGround) f = P.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(P.vx) > 0.1) f = 'run' + (((P.dist / 7) | 0) & 3);
    else f = (S.t % 180) < 170 ? 'idle' : 'idle2';
    const m = P.armor === 'gold' && P.charged && (S.t & 4) ? 1 : 0;
    if (P.armor === 'none') G.glow(X, Y - 14, 18, hex('#60c0ff'), 0.12);
    G.blit(set[f], X, Y, P.face < 0, m);
    if (P.armor === 'gold' && P.charge > 20) { const k = Math.min(1, P.charge / 75); G.glow(X, Y - 14, 10 + k * 14, hex('#ffd040'), 0.3 + k * 0.5); if (S.t % 3 === 0) fx('gold', P.x + (rnd() - 0.5) * 20, P.y - rnd() * 26, 1); }
  }
  function drawForm(P, X, Y) {
    const f = P.form, set = SPR[f.set];
    G.glow(X, Y - FORMS[f.form].h / 2, 20, hex('#80e0ff'), 0.25 + Math.sin(S.t * 0.2) * 0.1);
    if (f.form === 'arremer') { const k = ((S.t / 4) | 0) & 3; G.blit([set.up, set.mid, set.down, set.mid][k], X, Y, P.face < 0); }
    else if (f.form === 'lemming') G.blit(P.onGround ? set.walk[((P.dist / 3) | 0) & 1] : set.ohno, X, Y, P.face < 0);
    else if (P.burrow) { G.blit(set.walk[((P.dist / 5) | 0) & 3], X, Y + 20, P.face < 0, 0, 0, Y - 2); if (Math.abs(P.vx) > 0.1 && S.t % 4 === 0) fx('dust', P.x, P.y, 1); G.rect(X - 7, Y - 3, 14, 3, hex('#4a3426')); }
    else if (P.throwT > 0 && set.throw1) G.blit(f.form === 'haunt' ? set.slash1 : set.throw1, X, Y, P.face < 0);
    else if (!P.onGround && set.jump) G.blit(set.jump, X, Y, P.face < 0);
    else G.blit(set.walk[Math.abs(P.vx) > 0.1 ? ((P.dist / 5) | 0) & 3 : 0], X, Y, P.face < 0);
    if (f.t < 120 && (S.t & 8)) G.textC('!', X, Y - FORMS[f.form].h - 12, hex('#ff4040'), hex('#000000'));
  }
  function drawShots() {
    const cx = S.cam.x, cy = S.cam.y;
    for (const s of S.pshots) {
      const X = s.x - cx, Y = s.y - cy;
      if (s.gold) G.glow(X, Y, 9, hex('#ffd040'), 0.5);
      switch (s.kind) {
        case 'lance': case 'dagger':
          if (s.vx) G.blit(s.spr, X, Y, s.vx < 0); else G.blitRot(s.spr, X, Y, s.vy < 0 ? -Math.PI / 2 : Math.PI / 2, false);
          break;
        case 'torch': case 'axe': case 'cross': case 'pbone': G.blitRot(s.spr, X, Y, s.rot || 0, s.face < 0); if (s.kind === 'cross') G.glow(X, Y, 8, hex('#ffe080'), 0.4); break;
        case 'flame': G.blit(SPR.bluefire[(S.t >> 2) % 3], X, Y); G.glow(X, Y - 5, 10, hex('#4080ff'), 0.4); break;
        case 'pacid': G.blit(SPR.acid, X, Y); break;
        case 'pfire': G.blit(SPR.fireball[(S.t >> 2) & 1], X, Y, s.vx < 0); G.glow(X, Y, 8, hex('#ff8a20'), 0.5); break;
        case 'pslash': for (let i = 0; i < 12; i++) { const a = s.face > 0 ? -1.2 + i * 0.2 : Math.PI + 1.2 - i * 0.2; G.thick(X - s.face * 6 + Math.cos(a) * 14, Y + Math.sin(a) * 14, X - s.face * 6 + Math.cos(a) * 10, Y + Math.sin(a) * 10, 0.8, hex('#e0f0ff')); } break;
        default: break;
      }
    }
    for (const s of S.eshots) {
      const X = s.x - cx, Y = s.y - cy;
      const spr = Array.isArray(s.spr) ? s.spr[(S.t >> 2) % s.spr.length] : s.spr;
      if (!spr) { G.disc(X, Y, s.r, hex('#ff4040')); continue; }
      if (s.ang != null) G.blitRot(spr, X, Y, s.ang, false);
      else G.blit(spr, X, Y + (s.ay || 0) - (s.ay ? 0 : 0), s.vx < 0);
      if (spr === SPR.fireball[0] || spr === SPR.fireball[1]) G.glow(X, Y, 7, hex('#ff6a10'), 0.35);
    }
  }
  function drawBolts() {
    if (!(bolts.t > 0)) return;
    const cx = S.cam.x, cy = S.cam.y;
    for (const b of bolts) {
      let x = b.x - cx + (rnd() - 0.5) * 30, y = 0;
      const ty = b.y - cy;
      while (y < ty) { const nx = x + (rnd() - 0.5) * 14, ny = Math.min(ty, y + 10 + rnd() * 10); G.line(x, y, nx, ny, hex('#ffffff')); G.line(x + 1, y, nx + 1, ny, hex('#a0c0ff')); x = nx; y = ny; }
      G.glow(b.x - cx, ty, 16, hex('#c0d8ff'), 0.8);
    }
  }

  // ------------------------------------------------------------ HUD
  function drawHUD() {
    const P = S.P;
    G.rectA(0, 0, W, 11, hex('#000000'), 0.55);
    G.text('1UP', 3, 2, hex('#ff4040')); G.text(String(score).padStart(7, '0'), 23, 2, hex('#ffffff'));
    G.text('TOP', 72, 2, hex('#ff4040')); G.text(String(hi).padStart(7, '0'), 92, 2, hex('#ffffff'));
    const secs = Math.ceil(timeF / 60), tstr = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    G.text('TIME', 142, 2, hex('#ffd040')); G.text(tstr, 168, 2, secs < 30 && (S.t & 16) ? hex('#ff3030') : hex('#ffffff'));
    // weapon
    G.rect(196, 1, 22, 9, hex('#1a1020')); G.frame(196, 1, 22, 9, hex('#f0c848'));
    const ws = SPR['w_' + P.weapon]; if (ws) G.blit(ws, 207, 5);
    // armor
    if (P.form) G.text('SOUL', 223, 2, (S.t & 8) ? hex('#80e0ff') : hex('#ffffff'));
    else { G.blit(SPR.heads[P.armor === 'none' ? 'boxers' : P.armor], 229, 5); G.text(P.armor === 'none' ? 'BOX' : P.armor === 'gold' ? 'GLD' : 'STL', 236, 2, P.armor === 'gold' ? hex('#ffd040') : P.armor === 'none' ? hex('#ff8080') : hex('#c0d0ff')); }
    // lives
    G.blit(SPR.heads.steel, 264, 5); G.text('X' + Math.max(0, lives), 271, 2, hex('#ffffff'));
    G.text(String(fragments), 300, 2, hex('#80c0ff')); G.rect(294, 3, 4, 5, hex('#2a3aa0')); G.rect(295, 3, 2, 2, hex('#c8ccd8'));
    // possession / charge
    if (P.form) {
      const k = P.form.t / P.form.max, F = FORMS[P.form.form];
      G.rect(4, 14, 82, 5, hex('#102030')); G.rect(5, 15, 80 * k, 3, (P.form.t < 120 && (S.t & 8)) ? hex('#ff4040') : hex('#80e0ff'));
      G.text(F.name, 90, 13, hex('#80e0ff'), hex('#000000'));
      G.text(F.hint, 4, 21, hex('#c0e8ff'), hex('#000000'));
    } else if (P.armor === 'gold' && P.charge > 12) {
      const k = Math.min(1, P.charge / 75);
      G.rect(4, 14, 62, 5, hex('#302010')); G.rect(5, 15, 60 * k, 3, P.charged && (S.t & 4) ? hex('#ffffff') : hex('#ffd040'));
      G.text(P.charged ? 'RELEASE: MAGIC!' : 'CHARGING', 70, 13, hex('#ffd040'), hex('#000000'));
    } else if (P.armor === 'none' && !P.dead && S.t % 600 < 240 && stT < 1800) {
      G.text('E: POSSESS · SPECTRAL VISION', 4, 13, hex('#80e0ff'), hex('#000000'));
    }
    // boss bar
    const B = S.boss;
    if (B && !B.dead) {
      G.rectA(40, 181, 240, 18, hex('#000000'), 0.6);
      G.textC(B.name || S.world.def.boss, W / 2, 183, hex('#ffd040'));
      const k = Math.max(0, B.hp / B.maxhp);
      G.rect(44, 192, 232, 5, hex('#300808')); G.rect(45, 193, 230 * k, 3, B.flash > 0 ? hex('#ffffff') : hex('#e02020'));
    }
    if (bannerT > 0) {
      const a = Math.min(1, bannerT / 20);
      const y = 70;
      G.rectA(0, y - 4, W, 15, hex('#000000'), 0.5 * a);
      G.textC(bannerText, W / 2, y, (S.t & 8) ? hex('#ffe040') : hex('#ffffff'), hex('#401010'));
    }
  }
  function drawPaused() {
    G.rectA(0, 0, W, H, hex('#000000'), 0.5);
    G.textC('PAUSED', W / 2, 80, hex('#ffffff'), hex('#a01010'), 2);
    G.textC('PRESS P OR ENTER', W / 2, 104, hex('#c0c0c0'));
  }
  function drawClear() {
    G.rectA(40, 50, 240, 100, hex('#000000'), 0.7); G.frame(40, 50, 240, 100, hex('#f0c848'));
    const fin = clearInfo.final;
    G.textC(fin ? 'THE CURSE IS BROKEN!' : 'STAGE ' + (stageIdx + 1) + ' CLEAR!', W / 2, 60, hex('#ffe040'), hex('#802020'), fin ? 1 : 2);
    G.text('TIME BONUS', 60, 90, hex('#ffffff')); G.text(String(clearInfo.shown).padStart(6, '0'), 200, 90, hex('#ffffff'));
    G.text('SCORE', 60, 102, hex('#ffffff')); G.text(String(score).padStart(7, '0'), 194, 102, hex('#ffffff'));
    G.text('FLOPPY FRAGMENTS', 60, 118, hex('#80c0ff'));
    for (let i = 0; i < 5; i++) G.blit(SPR.floppy, 172 + i * 14, 130, false, i < fragments ? 0 : 3, hex('#303040'));
    if (stT > 280 && (S.t & 16)) G.textC('PRESS FIRE', W / 2, 140, hex('#c0c0c0'));
  }

  // ------------------------------------------------------------ TITLE
  let titleWorld = null;
  function drawTitle() {
    if (!titleWorld) titleWorld = Stages.build(0);
    const tw = titleWorld, cam = S.t * 0.5;
    G.fb.set(tw.gfx.sky);
    G.blitWrap(tw.gfx.far, cam * 0.15, 172 - tw.gfx.far.h);
    G.blitWrap(tw.gfx.mid, cam * 0.4, 188 - tw.gfx.mid.h);
    // graveyard ground strip
    const ts = tw.gfx.tiles.mats.earth;
    for (let x = -16; x < W + 16; x += 16) { const X = x - (cam % 16); G.blit(ts.top[(((x / 16 + Math.floor(cam / 16)) % 4) + 4) % 4], X, 176); G.blit(ts.in[1], X, 192); }
    // Arremer swoops over the logo
    const ax = (S.t * 1.3) % (W + 120) - 60, ay = 166 + Math.sin(S.t * 0.05) * 4;
    const aset = SPR.arremer_red, af = ((S.t / 5) | 0) & 3;
    G.blit([aset.up, aset.mid, aset.down, aset.mid][af], ax, ay);
    // Arthur runs from a zombie
    const run = ((S.t / 5) | 0) & 3;
    const boxers = (S.t % 600) > 300;
    G.blit((boxers ? SPR.boxers : SPR.steel)['run' + run], 140, 176);
    G.blit(SPR.zombie.walk[((S.t / 8) | 0) & 3], 90 + Math.sin(S.t * 0.02) * 6, 176);
    // logo
    const y0 = 12;
    G.textC("GHOSTS 'N", W / 2 + 2, y0 + 2, hex('#200008'), 0, 3);
    G.textC("GHOSTS 'N", W / 2, y0, hex('#e8e0ff'), 0, 3);
    G.textC('GOBLINS', W / 2 + 2, y0 + 26, hex('#200008'), 0, 4);
    for (let i = 0; i < 2; i++) G.textC('GOBLINS', W / 2 - i, y0 + 24 - i, i ? hex('#ff4020') : hex('#8a0a10'), 0, 4);
    // blood drips
    for (let i = 0; i < 9; i++) { const x = 78 + i * 20 + (i * 7 % 5), l = (S.t * 0.2 + i * 13) % 20; G.rect(x, y0 + 52, 1, l * 0.6, hex('#a01010')); }
    G.textC('THE CURSED PC GAMING MUSEUM', W / 2, y0 + 58, hex('#ffd040'), hex('#401000'));
    if ((S.t >> 5) & 1) G.textC('PRESS ENTER OR CLICK TO START', W / 2, 94, hex('#ffffff'), hex('#000000'));
    G.textC('KEYS 1-6 : STAGE WARP', W / 2, 105, hex('#80c0ff'), hex('#000000'));
    G.textC('TOP ' + String(hi).padStart(7, '0'), W / 2, 116, hex('#ff6060'), hex('#000000'));
    G.textC('A/D MOVE  W/S AIM/CLIMB  SPACE JUMP', W / 2, 129, hex('#c0c0d0'), hex('#000000'));
    G.textC('J FIRE  E EJECT/POSSESS/CAST  P PAUSE', W / 2, 139, hex('#c0c0d0'), hex('#000000'));
    if ((S.t % 700) < 12) flash(0.5);
  }

  // ------------------------------------------------------------ PARCHMENT MAP
  let parchment = null;
  function buildParchment() {
    parchment = new Uint32Array(W * H);
    const s = { w: W, h: H, d: parchment };
    G.target(s);
    const base = hex('#e2cc98');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = G.hash(x >> 1, y >> 1, 3) * 0.12 + G.hash(x >> 3, y >> 3, 4) * 0.12;
      const ex = Math.min(x, W - 1 - x, y * 1.4, (H - 1 - y) * 1.4);
      let k = 0.9 + n; if (ex < 14) k *= 0.55 + ex / 14 * 0.45;
      if (ex < 3 + G.hash(x, y, 9) * 3) k *= 0.4;
      G.pset(x, y, G.shade(base, k));
    }
    // islands & sea hatching
    const land = hex('#b8a070'), ink = hex('#5a3a1a');
    for (const [cx, cy, rx, ry] of [[60, 130, 44, 26], [100, 70, 40, 24], [165, 148, 44, 24], [228, 98, 40, 30], [266, 44, 34, 20], [284, 136, 26, 26]]) {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const d = (x * x) / (rx * rx) + (y * y) / (ry * ry) + G.hash(cx + x, cy + y, 2) * 0.15; if (d < 1) G.pset(cx + x, cy + y, G.mix(G.pget(cx + x, cy + y), land, 0.5)); else if (d < 1.08) G.pset(cx + x, cy + y, ink); }
    }
    for (let y = 30; y < 180; y += 7) for (let x = 20; x < 300; x += 11) if (G.hash(x, y, 5) > 0.7) { G.pset(x, y, hex('#9a8a6a')); G.pset(x + 1, y - 1, hex('#9a8a6a')); G.pset(x + 2, y, hex('#9a8a6a')); }
    // compass rose
    const cx = 34, cy = 40;
    G.ring(cx, cy, 12, ink); G.poly([cx, cy - 16, cx + 3, cy, cx, cy + 16, cx - 3, cy], ink); G.poly([cx - 16, cy, cx, cy - 3, cx + 16, cy, cx, cy + 3], hex('#8a5a2a')); G.text('N', cx - 2, cy - 26, ink);
    G.target(null);
  }
  function mapIcon(i, x, y, c) {
    const d = hex('#3a2410');
    switch (i) {
      case 0: G.poly([x - 9, y, x + 9, y, x + 6, y + 5, x - 6, y + 5], d); G.rect(x, y - 12, 1, 12, d); G.poly([x + 1, y - 11, x + 7, y - 6, x + 1, y - 3], c); break;
      case 1: G.rect(x - 8, y - 6, 16, 10, d); G.rect(x - 9, y - 12, 4, 16, d); G.rect(x + 5, y - 12, 4, 16, d); G.rect(x - 2, y - 1, 4, 5, c); break;
      case 2: G.ellipse(x, y - 6, 7, 6, d); G.rect(x - 8, y - 4, 16, 8, d); G.rect(x - 1, y - 16, 2, 5, d); G.rect(x - 2, y, 4, 4, c); break;
      case 3: G.rect(x - 9, y - 4, 18, 8, d); G.rect(x - 6, y - 14, 4, 10, d); G.rect(x + 2, y - 11, 4, 7, d); G.pset(x - 4, y - 16, c); break;
      case 4: G.poly([x - 11, y + 4, x - 3, y - 10, x + 2, y - 3, x + 6, y - 9, x + 11, y + 4], d); G.rect(x - 2, y - 1, 4, 3, c); break;
      case 5: G.disc(x, y - 5, 7, d); G.rect(x - 4, y, 8, 5, d); G.pset(x - 3, y - 6, c); G.pset(x + 3, y - 6, c); break;
      default: break;
    }
  }
  function drawMap() {
    if (!parchment) buildParchment();
    G.fb.set(parchment);
    const L = Stages.LIST, ink = hex('#5a3a1a'), red = hex('#b01010');
    G.textC('THE CURSED PC GAMING MUSEUM', W / 2, 10, ink);
    // dotted route
    for (let i = 0; i < L.length - 1; i++) {
      const [x0, y0] = L[i].map, [x1, y1] = L[i + 1].map, n = Math.hypot(x1 - x0, y1 - y0) / 4;
      for (let k = 0; k < n; k++) if (k % 2 === 0) G.pset(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, i < stageIdx ? red : ink);
    }
    for (let i = 0; i < L.length; i++) {
      const [x, y] = L[i].map;
      const cur = i === stageIdx;
      mapIcon(i, x, y, cur && (S.t & 8) ? hex('#ffe040') : hex('#e8c060'));
      if (i < stageIdx && !(deathMap && i === stageIdx)) { G.line(x - 5, y - 8, x + 5, y + 2, red); G.line(x + 5, y - 8, x - 5, y + 2, red); }
      G.text(String(i + 1), x - 2, y + 7, cur ? red : ink);
    }
    // Arthur's marker walks the route
    const [fx0, fy0] = L[mapFrom].map, [fx1, fy1] = L[stageIdx].map;
    const k = Math.min(1, stT / 90), mx = fx0 + (fx1 - fx0) * k, my = fy0 + (fy1 - fy0) * k;
    const walking = k < 1 && mapFrom !== stageIdx;
    const spr = SPR.steel[walking ? 'run' + (((S.t / 6) | 0) & 3) : 'idle'];
    G.blit(spr, mx, my - 6, fx1 < fx0);
    // ribbon
    G.rect(20, 160, 280, 32, hex('#7a1a1a')); G.rect(20, 160, 280, 2, hex('#c04040')); G.rect(20, 190, 280, 2, hex('#400808'));
    G.poly([20, 160, 10, 176, 20, 192], hex('#5a1010')); G.poly([300, 160, 310, 176, 300, 192], hex('#5a1010'));
    const def = L[stageIdx];
    G.textC((deathMap ? 'TRY AGAIN · ' : '') + 'STAGE ' + (stageIdx + 1) + ': ' + def.name, W / 2, 164, hex('#ffe8a0'), hex('#300000'));
    G.textC(def.sub, W / 2, 173, hex('#ffffff'), hex('#300000'));
    G.textC(def.year + (S.loop ? ' · LOOP ' + (S.loop + 1) : ''), W / 2, 182, hex('#ffb060'), hex('#300000'));
    G.text('LIVES x' + Math.max(0, lives), 252, 12, ink);
  }
  function drawGameOver() {
    G.clear(hex('#000000'));
    for (let i = 0; i < 40; i++) G.pset((G.hash(i, 1, 1) * W) | 0, (G.hash(i, 2, 1) * H) | 0, hex('#402030'));
    G.blit(SPR.arthurBones, W / 2, 150); G.blit(SPR.bonePile, W / 2 + 20, 150);
    G.textC('GAME OVER', W / 2, 60, hex('#e02020'), hex('#400000'), 3);
    G.textC('CONTINUE? ' + Math.floor(continueT / 60), W / 2, 100, (S.t & 16) ? hex('#ffffff') : hex('#ffe040'));
    G.textC('PRESS ENTER / FIRE', W / 2, 114, hex('#a0a0a0'));
    G.textC('SCORE ' + String(score).padStart(7, '0') + '   TOP ' + String(hi).padStart(7, '0'), W / 2, 170, hex('#c0c0c0'));
  }
  function drawEnding() {
    G.clear(hex('#08040c'));
    for (let i = 0; i < 90; i++) G.pset((G.hash(i, 1, 4) * W) | 0, (G.hash(i, 2, 4) * H + endT * 0.1 * G.hash(i, 3, 4)) % H, hex('#8a8ab0'));
    const cy = 60 + Math.sin(endT * 0.05) * 3;
    G.glow(W / 2, cy, 40, hex('#ff2040'), 0.5);
    G.blit(SPR.cursedFloppy, W / 2, cy + 9);
    const lines = S.loop === 0 ? [
      'THE CURSED FLOPPY DISK IS YOURS!', '', 'BUT A VOICE ECHOES FROM THE DRIVE...', '"THIS ROOM IS AN ILLUSION AND IS A', 'TRAP DEVISED BY ASTAROTH.', 'GO AHEAD DAUNTLESSLY!', 'MAKE RAPID PROGRESS!"', '', '- LOOP 2 BEGINS: THE MONSTERS ARE ANGRIER -',
    ] : [
      'THE CURSED FLOPPY IS FORMATTED.', 'THE MUSEUM IS SAFE ONCE MORE.', '', 'SIR ARTHUR PUTS HIS PANTS BACK ON.', '', 'THANK YOU FOR PLAYING', "GHOSTS 'N GOBLINS", 'THE CURSED PC GAMING MUSEUM', '', 'FINAL SCORE ' + String(score).padStart(7, '0'),
    ];
    lines.forEach((l, i) => { if (endT > 30 + i * 18) G.textC(l, W / 2, 96 + i * 10, i === 0 ? hex('#ffe040') : hex('#e0e0f0'), hex('#000000')); });
    if (endT > 240 && (S.t & 16)) G.textC('PRESS FIRE', W / 2, 190, hex('#a0a0a0'));
  }

  // ============================================================ BOOT & LOOP
  let last = 0, acc = 0;
  function frame(now) {
    if (!last) last = now;
    acc += Math.max(0, Math.min(100, now - last)); last = now;
    let n = 0;
    while (acc >= 1000 / 60 && n < 5) { tick(); acc -= 1000 / 60; n++; }
    if (n >= 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  function init(canvas) {
    G.init(canvas);
    Sprites.build();
    Stages.init();
    Ents.bind(S);
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      Music.init();
      if (e.code === 'KeyP' && state === 'play') { paused = !paused; Music.sfx('pause'); return; }
      if (paused && e.code === 'Enter') { paused = false; return; }
      if (/^Digit[1-6]$/.test(e.code) && (state === 'title' || state === 'gameover' || state === 'ending')) { startGame(+e.code.slice(5) - 1); return; }
      press(e.code);
    });
    window.addEventListener('keyup', e => release(e.code));
    window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
    canvas.addEventListener('mousedown', e => { Music.init(); press('Mouse' + e.button); e.preventDefault(); });
    window.addEventListener('mouseup', e => release('Mouse' + e.button));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    requestAnimationFrame(frame);
  }
  function warp(i) { Music.init(); paused = false; startGame(i); }

  // ------------------------------------------------------------ sim context wiring for entities.js
  Object.assign(S, {
    moveBody, solidAt, tileAt: tAt, groundBelow, onScreen, spawn, eshot, fx, explode, hurtPlayer, addScore,
    sfx: n => Music.sfx(n), shake, flash, drop, banner, clearEShots: () => { S.eshots = []; },
  });

  return {
    init, warp, S,
    get state() { return state; }, get stage() { return stageIdx; }, get paused() { return paused; },
    // test / debug hooks
    debug: { beginStage: (i) => { Music.init(); checkpoint = -1; if (!S.P) S.P = newPlayer(40, 176); beginStage(i, true); }, lockArena, ejectArmor, tryPossess, castMagic, openChest, setCheckpoint: c => { checkpoint = c; }, killPlayer, stageClear, get checkpoint() { return checkpoint; }, set time(v) { timeF = v; } },
  };
})();
window.Game = Game;
