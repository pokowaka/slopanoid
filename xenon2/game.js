'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — game.js
 *  Core game: the Megablaster & its six hardpoints, weapons + synergies,
 *  reverse-scroll thrust, 180-frame Chrono-Rewind ring buffer, enemies,
 *  hazards, bosses, pickups, particles, HUD and the fixed 60 FPS main loop.
 * ===========================================================================*/
const Game = (() => {
  const W = 320, H = 200, PH = 188;
  const { R, C, LUT } = GFX;
  const G = GFX;
  const rand = Math.random;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const TAU = Math.PI * 2;

  // =========================================================== CATALOGUE
  const ITEMS = {
    pulse: { slot: 'nose', name: 'PULSE CANNON', price: 150, desc: 'Standard-issue plasma pulses. Reliable. Boring.' },
    vulcan: { slot: 'nose', name: 'TWIN VULCAN', price: 450, desc: 'Twin rotary cannons. A hosepipe of hot lead.' },
    spread: { slot: 'nose', name: 'PLASMA SPREAD', price: 800, desc: 'Fans out 3 / 5 / 7 magenta plasma orbs.' },
    arc: { slot: 'nose', name: 'ELECTRO-ARC BEAM', price: 1150, desc: 'Auto-locking lightning. Chains through drones.' },
    sidelaser: { slot: 'wing', name: 'SIDE-LASER POD', price: 450, desc: 'Sideways lasers. Ricochet with Bounce-Orbs.' },
    missile: { slot: 'wing', name: 'HOMING MISSILE RACK', price: 700, desc: 'Seeker missiles with a blast radius.' },
    bounce: { slot: 'wing', name: 'BOUNCE-ORB LAUNCHER', price: 600, desc: 'Orbs that rebound off cavern walls.' },
    tailgun: { slot: 'tail', name: 'REAR TAIL CANNON', price: 350, desc: 'Covers your six with twin rear streams.' },
    mines: { slot: 'tail', name: 'TEMPORAL PROXIMITY MINES', price: 650, desc: 'Chrono mines. Backfire Nova on reverse/rewind.' },
    drones2: { slot: 'drones', name: 'DUAL ORBITING DRONES', price: 800, desc: 'Two orbiters that shoot & absorb bullets.' },
    drones4: { slot: 'drones', name: 'QUAD PLASMA HALO', price: 1400, desc: 'Four orbiters in a wider halo.' },
    plating: { slot: 'hull', name: 'HULL PLATING', price: 600, desc: '+50% max shield, -30% damage taken.' },
    capacitor: { slot: 'hull', name: 'CHRONO-CAPACITOR', price: 700, desc: 'Triple chrono regen, cheaper rewinds.' },
    afterburner: { slot: 'hull', name: 'MEGAFLUX AFTERBURNER', price: 500, desc: '+Speed and faster reverse thrust.' },
  };
  const SUPPLIES = {
    repair: { name: 'SHIELD REPAIR', desc: 'Patch the hull back to 100%.', price: () => Math.max(20, Math.ceil((maxShield() - P.shield) * 3)) },
    speed: { name: 'SPEED BOOSTER', desc: 'Permanent extra thrust (max 3).', price: () => 300 + P.speedLvl * 150 },
    bomb: { name: 'SMART BOMB', desc: 'Screen-clearing Megablast (max 5). [Q]', price: () => 250 },
    intel: { name: "CRISPIN'S BOSS WEAKNESS INTEL", desc: 'Marks the boss weak point: x4 damage there.', price: () => 350 },
    nashwan: { name: 'SUPER NASHWAN POWER', desc: '20s full-arsenal golden overdrive! [X]', price: () => 1800 },
  };
  const SLOTS = ['nose', 'lwing', 'rwing', 'tail', 'drones', 'hull'];
  const SLOT_NAMES = { nose: 'NOSE', lwing: 'LEFT WING', rwing: 'RIGHT WING', tail: 'REAR TAIL', drones: 'ORBITAL DRONES', hull: 'HULL / ENGINE' };
  const SYNERGIES = [
    { id: 'prism', name: 'RICOCHET PRISM MATRIX', need: 'SIDE-LASER + BOUNCE-ORB' },
    { id: 'nova', name: 'CHRONO BACKFIRE NOVA', need: 'PROX MINES + REVERSE/CHRONO' },
    { id: 'tesla', name: 'TESLA CHAIN SWARM', need: 'ELECTRO-ARC + DRONES' },
  ];

  const KINDS = {
    trilobite: { spr: 'trilobite', hp: 4, r: 7, score: 150, anim: 8 },
    ammonite: { spr: 'ammonite', hp: 7, r: 8, score: 250, anim: 4 },
    coralturret: { spr: 'coralturret', hp: 10, r: 7, score: 300, fixed: 1, barrel: 1 },
    eurypterid: { spr: 'eurypterid', hp: 45, r: 14, score: 1500 },
    squid: { spr: 'squid', hp: 4, r: 7, score: 150, anim: 10 },
    nautilus: { spr: 'nautilus', hp: 8, r: 9, score: 300, anim: 5 },
    mine: { spr: 'mine', hp: 3, r: 6, score: 100 },
    vent: { spr: 'vent', hp: 14, r: 7, score: 350, fixed: 1 },
    angler: { spr: 'angler', hp: 45, r: 11, score: 1500 },
    gear: { spr: 'gear', hp: 5, r: 8, score: 150, anim: 3 },
    beetle: { spr: 'beetle', hp: 5, r: 7, score: 200 },
    brassturret: { spr: 'brassturret', hp: 11, r: 7, score: 300, fixed: 1, barrel: 1 },
    automaton: { spr: 'automaton', hp: 50, r: 14, score: 1500 },
    tesla: { spr: 'tesla', hp: 14, r: 7, score: 400, fixed: 1 },
    bob: { spr: null, hp: 3, r: 6, score: 120 },
    vcube: { spr: null, hp: 10, r: 10, score: 400 },
    chip: { spr: 'chip', hp: 12, r: 7, score: 300, fixed: 1, barrel: 1 },
    copperdiver: { spr: 'copperdiver', hp: 4, r: 7, score: 200 },
    boing: { spr: 'boing', hp: 55, r: 13, score: 2000, anim: 3 },
    spore: { spr: 'spore', hp: 1, r: 4, score: 50, anim: 8 },
    hugger: { spr: 'hugger', hp: 5, r: 7, score: 200, anim: 6 },
    wasp: { spr: 'wasp', hp: 5, r: 7, score: 200, anim: 3 },
    gatenode: { spr: 'gatenode', hp: 14, r: 6, score: 400, fixed: 1 },
    pod: { spr: 'pod', hp: 15, r: 7, score: 350, fixed: 1 },
    warrior: { spr: 'warrior', hp: 55, r: 14, score: 2000 },
    piston: { spr: 'piston', hp: 1e9, r: 0, score: 0, fixed: 1, invuln: 1 },
  };
  const TURRET_BEH = { coralturret: 'turret', brassturret: 'turret', chip: 'turret', vent: 'geyser', pod: 'sporepod' };

  const BOSSES = [
    { spr: 'boss1', hp: 420, circles: [[0, -2, 14], [0, 19, 12], [-25, -4, 10], [25, -4, 10]], weak: [0, 25, 6], minion: 'trilobite', attacks: ['aimed3', 'fan', 'minions', 'ring'],
      intel: 'That Anomalocaris has a soft mouth-cone under its head. Stay out of the flap volleys and aim low!' },
    { spr: 'boss2', hp: 520, circles: [[0, -5, 24], [0, 14, 16]], weak: [0, 13, 6], minion: 'squid', attacks: ['ink', 'tentacles', 'aimed5', 'minions'], tentacles: 1,
      intel: 'Kraken-Nautilus: shoot the eye in the shell aperture. The ink blobs are slow, the tentacles are not.' },
    { spr: 'boss3', hp: 620, circles: [[-30, -2, 22], [0, -2, 24], [30, -2, 22], [-51, -4, 7], [51, -4, 7]], weak: [0, 26, 6], minion: 'beetle', attacks: ['gears', 'beams', 'spiral', 'aimed3'], coils: 1,
      intel: 'Babbage built it with a flyball governor under the cabinet. Break it and the whole Engine seizes!' },
    { spr: 'boss4', hp: 720, circles: [[-32, 0, 20], [0, 0, 21], [32, 0, 20]], weak: [0, 0, 8], minion: 'copperdiver', attacks: ['beams', 'bobs', 'spiral', 'aimed5'], chip: 1,
      intel: 'The 68000 has a die window dead centre. Its copper-bar beams are telegraphed; watch the red lines.' },
    { spr: 'boss5', hp: 900, circles: [[0, -8, 28], [0, 10, 9], [-40, -2, 10], [40, -2, 10]], weak: [0, 10, 7], minion: 'wasp', attacks: ['spores', 'ring2', 'beams', 'aimed5', 'spiral'], brain: 1,
      intel: 'The Mother-Brain sees through one eye. Put EVERYTHING into it. Spore storms home in, keep moving.' },
  ];

  // =========================================================== STATE
  let state = 'boot', stateT = 0, frame = 0, paused = false, modal = null;
  let stageIdx = 0, loopN = 0, world = null;
  let cam = 0, camI = 0, camDelta = 0, maxCam = 0, spawnIdx = 0;
  let bossSpawned = false, midShopDone = false, shopReason = null, boss = null, carryIntel = false;
  const P = { x: 160, y: 160, vx: 0, vy: 0, shield: 100, lives: 3, credits: 500, score: 0, bombs: 1, speedLvl: 0, nashwan: 0, nashT: 0, inv: 0, chrono: 180,
    dead: 0, droneA: 0, intel: false, blocked: false, reversing: false, rewinding: false, rewound: 0, revT: 0 };
  const equip = { nose: null, lwing: null, rwing: null, tail: null, drones: null, hull: null };
  const cd = {};
  const enemies = [], ebul = [], pbul = [], pickups = [], parts = [], waves = [];
  let arcs = [], beams = [];
  const RING = 180, ring = new Array(RING); let ringHead = 0, ringCount = 0;
  let shake = 0, flashT = 0, hiScore = +(localStorage.getItem('x2hi') || 50000);
  let banner = null, intro = 0;
  const input = { keys: {}, mouse: { x: 160, y: 150, active: false, l: false, r: false } };
  const LOGO = {};
  let titleWorld = null;

  // =========================================================== HELPERS
  const toS = d => PH - 1 - (d - camI);
  const wy = sy => camI + PH - 1 - sy;
  const hpScale = () => 1 + stageIdx * 0.25 + loopN * 0.6;
  const diff = () => 1 + stageIdx * 0.1 + loopN * 0.25;
  function solidAt(x, d) {
    if (x < 0 || x >= W) return true;
    const di = d | 0; if (di < 0 || di >= world.len) return false;
    return world.wall[di * W + (x | 0)] !== 0;
  }
  const SHIP_PTS = [[0, -11], [-4, -5], [4, -5], [-10, 5], [10, 5], [-6, 9], [6, 9], [0, 12]];
  function shipHitsAt(px, py, cv) {
    const ci = Math.floor(cv);
    for (const [ox, oy] of SHIP_PTS) if (solidAt(px + ox, ci + PH - 1 - (py + oy))) return true;
    return false;
  }
  function flipH(s) { const d = new Uint8Array(s.w * s.h); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) d[y * s.w + x] = s.d[y * s.w + s.w - 1 - x]; return { w: s.w, h: s.h, d }; }
  function has(id) {
    if (P.nashT > 0 && !ITEMS[id].slot.match(/hull|drones/)) return true;
    for (const s of SLOTS) if (equip[s] && equip[s].id === id) return true;
    return false;
  }
  function lvlOf(id) { if (P.nashT > 0) return 3; let l = 0; for (const s of SLOTS) if (equip[s] && equip[s].id === id) l = Math.max(l, equip[s].lvl); return l; }
  const maxShield = () => (equip.hull && equip.hull.id === 'plating') ? 150 : 100;
  const hullIs = id => equip.hull && equip.hull.id === id;
  function droneCount() { if (P.nashT > 0) return 4; if (!equip.drones) return 0; return equip.drones.id === 'drones4' ? 4 : 2; }
  function synergy() {
    return { prism: has('sidelaser') && has('bounce'), nova: has('mines'), tesla: has('arc') && droneCount() > 0 };
  }
  function weaponList() {
    if (P.nashT > 0) return [['vulcan', 3, 0], ['spread', 3, 0], ['sidelaser', 3, -1], ['missile', 3, -1], ['bounce', 3, 1], ['missile', 3, 1], ['sidelaser', 3, 1], ['bounce', 3, -1], ['tailgun', 3, 0], ['mines', 3, 0]];
    const w = [];
    for (const s of ['nose', 'lwing', 'rwing', 'tail']) if (equip[s]) w.push([equip[s].id, equip[s].lvl, s === 'lwing' ? -1 : s === 'rwing' ? 1 : 0]);
    return w;
  }
  function dronePos(i, n) { const a = P.droneA + i * TAU / n, r = n === 4 ? 23 : 19; return [P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * 0.78]; }
  function say(text, t = 120, col = C.WHITE) { banner = { text, t, max: t, col }; }

  // =========================================================== PARTICLES
  function addP(x, y, vx, vy, life, k, c, r = 0, str = null) {
    if (parts.length > 900) parts.splice(0, 100);
    parts.push({ x, y, vx, vy, life, max: life, k, c, r, str });
  }
  function explode(x, y, size, quiet) {
    addP(x, y, 0, 0, 10 + size * 2, 'flash', R.FIRE, size * 4 + 3);
    addP(x, y, 0, 0, 14 + size * 2, 'ring', R.FIRE, size * 6 + 4);
    const n = 6 + size * 6;
    for (let i = 0; i < n; i++) { const a = rand() * TAU, s = (0.3 + rand() * 1.6) * Math.sqrt(size); addP(x, y, Math.cos(a) * s, Math.sin(a) * s, 14 + rand() * 22, 'spark', R.FIRE); }
    for (let i = 0; i < size * 2; i++) addP(x, y, (rand() - 0.5) * 3, rand() * 2.5, 30 + rand() * 30, 'debris', rand() < 0.5 ? R.E0 + 9 : R.CHROME + 8);
    if (size >= 3) for (let i = 0; i < size; i++) addP(x + (rand() - 0.5) * size * 4, y + (rand() - 0.5) * size * 4, (rand() - 0.5) * 0.4, 0.2, 40, 'smoke', R.CHROME, 3 + size);
    if (!quiet) Music.sfx(size >= 4 ? 'bigexplode' : 'explode');
    shake = Math.max(shake, size * 1.4);
  }
  function floatText(x, y, str, c = C.YELLOW) { addP(x, y, 0, 0.35, 50, 'text', c, 0, str); }

  // =========================================================== TERRAIN FX
  function carve(x, d, r, power = 1) {
    const wall = world.wall, destr = world.destr, len = world.len, ri = Math.ceil(r) + 2;
    let hit = false;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const X = (x + dx) | 0, D = (d + dy) | 0; if (X < 0 || X >= W || D < 0 || D >= len) continue;
      const i = D * W + X; if (!wall[i] || !destr[i]) continue;
      const dd = Math.hypot(dx, dy);
      if (dd <= r) {
        if (destr[i] === 2 && power < 2 && rand() < 0.7) continue;
        wall[i] = 0; destr[i] = 0; hit = true;
        if (rand() < 0.06) addP(X, D, (rand() - 0.5) * 2, rand() * 1.5, 30, 'debris', R.S3 + 9);
      } else if (dd <= r + 1.6 && (wall[i] & 15) > 3) wall[i] = R.S3 + 2 + ((rand() * 2) | 0);
    }
    if (hit) Music.sfx('carve');
    return hit;
  }

  // =========================================================== ENEMIES
  function mkEnemy(k, x, y, beh, extra) {
    const K = KINDS[k], hp = K.hp * hpScale();
    const e = { k, beh, x, y, vx: 0, vy: 0, hp, mhp: hp, r: K.r, t: 0, ft: 50 + rand() * 80, fl: 0, st: 0, wave: null, side: 0, ang: 0, fixed: !!K.fixed };
    if (extra) Object.assign(e, extra);
    enemies.push(e);
    return e;
  }
  function eShoot(x, y, ang, spd, k = 'orb') { ebul.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, k, t: 0, life: k === 'steam' ? 60 : 900 }); }
  function aimAng(x, y) { return Math.atan2(wy(P.y) - y, P.x - x); }
  function onScreen(e, m = 0) { const sy = toS(e.y); return sy > -m && sy < PH - 24 && e.x > 0 && e.x < W; }
  function maybeFire(e, p) { if (onScreen(e) && !P.dead && rand() < p * diff()) eShoot(e.x, e.y, aimAng(e.x, e.y), 1.5 * Math.min(1.6, diff())); }
  function spawnWave(ev) {
    const top = cam + PH + 14, wv = { n: ev.n, killed: 0 }, K = ev.kind, n = ev.n;
    waves.push(wv);
    let s = ev.seed; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const sp = world.def.scroll;
    switch (ev.beh) {
      case 'snake': for (let i = 0; i < n; i++) mkEnemy(K, ev.x, top + i * 15, 'snake', { x0: ev.x, amp: 36 + r() * 36, fq: 0.03 + r() * 0.015, ph: -i * 0.45, vy: -0.75 - stageIdx * 0.05, wave: wv }); break;
      case 'spinner': for (let i = 0; i < n; i++) mkEnemy(K, 50 + r() * 220, top + i * 36, 'spinner', { vy: sp * 0.6, wave: wv, ft: 40 + i * 25 }); break;
      case 'crawler': for (let i = 0; i < n; i++) mkEnemy(K, 160, top + i * 24, 'crawler', { side: i % 2 ? -1 : 1, vy: -0.4, wave: wv }); break;
      case 'diver': for (let i = 0; i < n; i++) mkEnemy(K, 40 + (i / Math.max(1, n - 1)) * 240, top + (i % 2) * 14, 'diver', { wave: wv, hold: 28 + i * 7, stopY: 30 + (i % 3) * 14 }); break;
      case 'tank': mkEnemy(K, 160, top + 16, 'tank', { wave: wv, vy: -0.7 }); break;
      case 'darter': for (let i = 0; i < n; i++) mkEnemy(K, clamp(ev.x + (i - n / 2) * 22, 30, 290), top + (i % 2) * 14, 'darter', { wave: wv, ft: 20 + i * 8 }); break;
      case 'minefield': { let placed = 0; for (let i = 0; i < n * 3 && placed < n; i++) { const x = 30 + r() * 260, y = top + r() * 150; if (!solidAt(x, y)) { mkEnemy('mine', x, y, 'mine', { wave: wv }); placed++; } } wv.n = placed; break; }
      case 'lissajous': for (let i = 0; i < n; i++) mkEnemy('bob', ev.x, top + 30, 'lissajous', { i, cx: clamp(ev.x, 90, 230), cy: top + 36, wave: wv, col: i % 4 }); break;
      case 'vcube': for (let i = 0; i < n; i++) mkEnemy('vcube', 70 + i * (180 / Math.max(1, n - 1)), top + i * 26, 'vcube', { wave: wv, ax: r() * 3, ay: r() * 3, ph: r() * 6 }); break;
      case 'bouncer': mkEnemy('boing', 60 + r() * 200, top, 'bouncer', { wave: wv, vx: r() < 0.5 ? 1.3 : -1.3, vys: 0.5 }); break;
      case 'homers': for (let i = 0; i < n; i++) mkEnemy('spore', 40 + r() * 240, top + r() * 40, 'homer', { wave: wv }); break;
    }
  }
  function spawnEvent(ev) {
    if (ev.t === 'wave') spawnWave(ev);
    else if (ev.t === 'turret') mkEnemy(ev.kind, ev.x + (ev.side < 0 ? 3 : -3), ev.d, TURRET_BEH[ev.kind] || 'turret', { side: ev.side, ft: 60 + rand() * 60 });
    else if (ev.t === 'hazard') {
      if (ev.kind === 'piston') mkEnemy('piston', ev.x, ev.d, 'piston', { side: ev.side, reach: ev.reach, ext: 0, t: (rand() * 180) | 0 });
      else {
        const k = ev.kind === 'arc' ? 'tesla' : 'gatenode';
        const a = mkEnemy(k, ev.xl + 4, ev.d, 'arcnode', { master: 1, laser: ev.kind === 'gate' });
        const b = mkEnemy(k, ev.xr - 4, ev.d, 'arcnode', { master: 0 });
        a.partner = b; b.partner = a;
      }
    }
  }

  const BEH = {
    snake(e) { e.y += e.vy; e.x = e.x0 + Math.sin(e.t * e.fq + e.ph) * e.amp; maybeFire(e, 0.004); },
    spinner(e) {
      e.y += e.vy - 0.25; e.ang += 0.05;
      if (--e.ft <= 0 && onScreen(e, -10)) { e.ft = Math.max(40, 80 - stageIdx * 6); const n = 6 + stageIdx; for (let k = 0; k < n; k++) eShoot(e.x, e.y, e.ang + k * TAU / n, 1.2); }
    },
    crawler(e) {
      e.y += e.vy; const di = clamp(e.y | 0, 0, world.len - 1);
      const edge = e.side < 0 ? Stages.edgeL(world.wall, di) + 6 : Stages.edgeR(world.wall, di) - 6;
      e.x += (edge - e.x) * 0.25; maybeFire(e, 0.006);
    },
    diver(e) {
      const sy = toS(e.y);
      if (e.st === 0) { e.y -= 1.5; if (sy > e.stopY) e.st = 1; }
      else if (e.st === 1) { e.y += camDelta; if (--e.hold <= 0) { e.st = 2; const a = aimAng(e.x, e.y); e.vx = Math.cos(a) * 3.2; e.vy = Math.sin(a) * 3.2; if (rand() < 0.5 * diff()) eShoot(e.x, e.y, a, 1.8); } }
      else { e.x += e.vx; e.y += e.vy; }
    },
    tank(e) {
      const sy = toS(e.y);
      if (e.st === 0) { e.y += e.vy; if (sy >= 42) { e.st = 1; e.t0 = e.t; } }
      else if (e.st === 1) {
        e.y += camDelta; e.x = 160 + Math.sin((e.t - e.t0) * 0.012) * 80;
        if (--e.ft <= 0) { e.ft = Math.max(35, 60 - stageIdx * 5); const a = aimAng(e.x, e.y); for (let k = -2; k <= 2; k++) eShoot(e.x, e.y - 8, a + k * 0.22, 1.5); }
        if (e.t - e.t0 > 560) e.st = 2;
      } else e.y -= 1;
    },
    darter(e) {
      if (--e.ft <= 0) { e.ft = 44; const a = aimAng(e.x, e.y); e.vx = Math.cos(a) * 2.6; e.vy = Math.sin(a) * 2.6 - 0.4; }
      e.vx *= 0.94; e.vy *= 0.94; e.x += e.vx; e.y += e.vy - 0.3; maybeFire(e, 0.003);
    },
    mine(e) {
      e.x += Math.sin(e.t * 0.05) * 0.15;
      const dx = e.x - P.x, dy = e.y - wy(P.y);
      if (!e.armed && !P.dead && dx * dx + dy * dy < 30 * 30) { e.armed = 1; e.ft = 32; Music.sfx('mine'); }
      if (e.armed && --e.ft <= 0) { for (let k = 0; k < 8; k++) eShoot(e.x, e.y, k * TAU / 8, 1.6); e.hp = 0; e.noScore = 1; }
    },
    turret(e) {
      e.ang = aimAng(e.x, e.y);
      if (--e.ft <= 0 && onScreen(e, -4) && !P.dead) { e.ft = Math.max(55, 110 - stageIdx * 10); eShoot(e.x + Math.cos(e.ang) * 7, e.y + Math.sin(e.ang) * 7, e.ang, 1.6); }
    },
    geyser(e) {
      const ph = e.t % 150;
      if (ph > 100 && ph % 3 === 0 && onScreen(e, -20)) { eShoot(e.x, e.y + (rand() - 0.5) * 4, (e.side < 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.25, 2 + rand()); ebul[ebul.length - 1].k = 'steam'; ebul[ebul.length - 1].life = 55; }
      e.venting = ph > 90;
    },
    sporepod(e) { if (--e.ft <= 0 && onScreen(e)) { e.ft = 120; mkEnemy('spore', e.x - e.side * 8, e.y, 'homer', {}); } },
    piston(e) {
      const ph = e.t % 180; let u;
      if (ph < 30) u = ph / 30; else if (ph < 80) u = 1; else if (ph < 110) u = 1 - (ph - 80) / 30; else u = 0;
      e.ext = (u * u * (3 - 2 * u)) * e.reach;
    },
    arcnode(e) {
      if (!e.master) return;
      const ph = e.t % 170; e.beam = (!e.partner || e.partner.hp <= 0) ? 0 : ph < 70 ? 0 : ph < 100 ? 1 : 2;
    },
    lissajous(e) {
      e.cy -= 0.28; e.cx += Math.sin(e.t * 0.011) * 0.4;
      e.x = e.cx + Math.sin(e.t * 0.031 + e.i * 0.78) * 76; e.y = e.cy + Math.cos(e.t * 0.047 + e.i * 0.78) * 26;
      maybeFire(e, 0.002);
    },
    vcube(e) { e.y -= 0.35; e.x += Math.sin(e.t * 0.02 + e.ph) * 0.9; e.ax += 0.035; e.ay += 0.023; maybeFire(e, 0.008); },
    bouncer(e) {
      let sy = toS(e.y); e.vys += 0.12; sy += e.vys; e.x += e.vx;
      if (sy > PH - 22 && e.vys > 0 && e.t < 700) { e.vys = -4.4; sy = PH - 22; for (let k = 0; k < 10; k++) eShoot(e.x, wy(sy), k * TAU / 10 + e.t, 1.4); Music.sfx('bounce'); shake = 2; }
      if (e.x < 20 || e.x > 300 || solidAt(e.x + Math.sign(e.vx) * 14, wy(sy))) e.vx = -e.vx;
      e.y = wy(sy);
    },
    homer(e) {
      const a = aimAng(e.x, e.y); e.vx = (e.vx + Math.cos(a) * 0.05) * 0.985; e.vy = (e.vy + Math.sin(a) * 0.05) * 0.985;
      e.x += e.vx; e.y += e.vy; if (e.t > 420) e.hp = 0, e.noScore = 1;
    },
    bossminion(e) { BEH.diver(e); },
  };

  function killEnemy(e, silent) {
    const K = KINDS[e.k];
    e.hp = 0;
    if (e.noScore) { explode(e.x, e.y, 1); return; }
    const big = e.r >= 11;
    explode(e.x, e.y, big ? 4 : 2, silent);
    P.score += K.score * (1 + loopN);
    if (big) pickups.push({ k: 'bubble', x: e.x, y: e.y, v: 150 + stageIdx * 60, t: 0 }), rand() < 0.6 && pickups.push({ k: 'capsule', x: e.x + 10, y: e.y, v: 0, t: 0 });
    else if (rand() < 0.22) pickups.push({ k: 'coin', x: e.x, y: e.y, v: 10 + stageIdx * 4, t: 0 });
    if (e.wave) { e.wave.killed++; if (e.wave.killed >= e.wave.n && e.wave.n > 1) { pickups.push({ k: 'bubble', x: e.x, y: e.y, v: Math.round(25 * e.wave.n * (1 + stageIdx * 0.3)), t: 0 }); floatText(e.x, e.y + 8, 'WAVE BONUS', C.CYAN); } }
  }
  function hitEnemy(e, dmg, quiet) {
    if (e.hp <= 0 || KINDS[e.k].invuln) return;
    e.hp -= dmg; e.fl = 3;
    if (!quiet) Music.sfx('ping');
    if (e.hp <= 0) killEnemy(e);
  }

  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp > 0) { e.t++; if (e.fl > 0) e.fl--; (BEH[e.beh] || BEH.snake)(e); }
      const sy = toS(e.y);
      const gone = e.hp <= 0 || sy > PH + 50 || e.x < -60 || e.x > W + 60 || (!e.fixed && sy < -260 && e.t > 200);
      if (gone) { enemies.splice(i, 1); continue; }
      if (P.dead || P.inv > 0 || P.rewinding) continue;
      const pd = wy(P.y);
      if (e.beh === 'piston') {
        const x0 = e.side < 0 ? e.x : e.x - e.ext, x1 = e.side < 0 ? e.x + e.ext : e.x;
        if (P.x + 8 > x0 && P.x - 8 < x1 && Math.abs(pd - e.y) < 9) { hurt(14); P.vx += e.side * 3; }
      } else if (e.beh === 'arcnode' && e.master && e.beam === 2 && e.partner) {
        const x0 = Math.min(e.x, e.partner.x), x1 = Math.max(e.x, e.partner.x);
        if (P.x > x0 && P.x < x1 && Math.abs(pd - e.y) < 6) hurt(16);
      } else if (e.r > 0) {
        const dx = e.x - P.x, dy = e.y - pd, rr = e.r + 5;
        if (dx * dx + dy * dy < rr * rr) { hurt(15); hitEnemy(e, 6, true); }
      }
    }
  }

  // =========================================================== PLAYER
  function hurt(dmg) {
    if (P.inv > 0 || P.dead || P.rewinding || state !== 'play') return;
    if (hullIs('plating')) dmg *= 0.7;
    P.shield -= dmg; P.inv = 45; flashT = 6; shake = Math.max(shake, 4);
    Music.sfx('hit');
    if (P.shield <= 0) die();
  }
  function die() {
    P.shield = 0; P.dead = 150; P.lives--; P.nashT = 0;
    explode(P.x, wy(P.y), 6); Music.sfx('die');
    for (let i = 0; i < 20; i++) addP(P.x, wy(P.y), (rand() - 0.5) * 5, (rand() - 0.5) * 5, 60, 'debris', R.CHROME + 10);
    if (P.lives < 0) { state = 'gameover'; stateT = 0; if (P.score > hiScore) { hiScore = P.score; localStorage.setItem('x2hi', hiScore); } }
  }
  function respawn() {
    P.shield = maxShield(); P.inv = 180; P.vx = P.vy = 0; P.y = PH - 30;
    let best = 160, bd = 1e9;
    for (let x = 20; x < 300; x += 4) if (!shipHitsAt(x, P.y, cam)) { const d = Math.abs(x - 160); if (d < bd) { bd = d; best = x; } }
    P.x = best; ebul.length = 0;
  }
  function updatePlayer() {
    if (P.dead > 0) { if (--P.dead === 0 && state === 'play') respawn(); return; }
    const k = input.keys;
    const L = k.ArrowLeft || k.KeyA, Rt = k.ArrowRight || k.KeyD, U = k.ArrowUp || k.KeyW, D = k.ArrowDown || k.KeyS;
    if (L || Rt || U || D) input.mouse.active = false;
    const maxS = 2.1 + P.speedLvl * 0.35 + (hullIs('afterburner') ? 0.5 : 0) + (P.nashT > 0 ? 0.4 : 0);
    if (input.mouse.active) {
      const dx = input.mouse.x - P.x, dy = input.mouse.y - P.y, d = Math.hypot(dx, dy);
      if (d > 0.8) { const s = Math.min(maxS, d * 0.3); P.vx = dx / d * s; P.vy = dy / d * s; } else P.vx = P.vy = 0;
    } else {
      const acc = 0.55;
      P.vx = clamp((P.vx + (Rt ? acc : 0) - (L ? acc : 0)) * 0.84, -maxS, maxS);
      P.vy = clamp((P.vy + (D ? acc : 0) - (U ? acc : 0)) * 0.84, -maxS, maxS);
    }
    const nx = clamp(P.x + P.vx, 10, W - 10);
    if (!shipHitsAt(nx, P.y, cam)) P.x = nx; else { if (Math.abs(P.vx) > 0.8) { addP(P.x + Math.sign(P.vx) * 10, wy(P.y), -P.vx, rand(), 12, 'spark', R.GOLD); Music.sfx('block'); } P.vx *= -0.3; }
    const ny = clamp(P.y + P.vy, 14, PH - 14);
    if (!shipHitsAt(P.x, ny, cam)) P.y = ny; else P.vy *= -0.3;
    const wantRev = (D || (input.mouse.active && input.mouse.y > PH - 8)) && P.y >= PH - 18;
    if (wantRev && !P.reversing) { Music.sfx('reverse'); nova(); P.revT = 0; }
    P.reversing = wantRev && !boss && cam > 0;
    if (P.reversing && ++P.revT % 50 === 0) nova();
    P.droneA += 0.055;
    if (P.inv > 0) P.inv--;
    if (P.nashT > 0 && --P.nashT === 0) say('NASHWAN POWER DEPLETED', 90, C.ORANGE);
    const regen = hullIs('capacitor') ? 0.55 : 0.18;
    if (!P.rewinding) P.chrono = Math.min(180, P.chrono + regen);
  }
  function updateCamera() {
    const prev = cam; P.blocked = false;
    if (P.reversing) {
      const nc = Math.max(0, cam - (hullIs('afterburner') ? 1.7 : 1.25));
      if (!shipHitsAt(P.x, P.y, nc)) cam = nc;
    } else if (cam < world.camStop) {
      const nc = Math.min(world.camStop, cam + world.def.scroll + loopN * 0.06);
      if (!P.dead && shipHitsAt(P.x, P.y, nc) && !shipHitsAt(P.x, P.y, cam)) {
        const push = Math.floor(nc) - Math.floor(cam);
        if (P.y + push <= PH - 12 && !shipHitsAt(P.x, P.y + push, nc)) { P.y += push; cam = nc; }
        else P.blocked = true;
      } else cam = nc;
    }
    camI = Math.floor(cam); camDelta = cam - prev; maxCam = Math.max(maxCam, cam);
  }

  // =========================================================== WEAPONS
  function pb(x, y, vx, vy, dmg, k, ex) { const b = { x, y, vx, vy, dmg, k, t: 0, r: 2, bounces: 0, life: 0 }; if (ex) Object.assign(b, ex); pbul.push(b); return b; }
  function nearestEnemy(x, y, range, ahead) {
    let best = null, bd = range * range;
    for (const e of enemies) {
      if (e.hp <= 0 || KINDS[e.k].invuln || !onScreen(e, 10)) continue;
      if (ahead && e.y < y - 12) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; }
    }
    if (boss && boss.st === 1) {
      const bw = bossWorld(), dx = bw.x - x, dy = bw.y - y, d = dx * dx + dy * dy;
      if (d < bd * 1.4 || !best) { if (d < range * range * 2.2) return { boss: 1, x: bw.x, y: bw.y }; }
    }
    return best;
  }
  function fireWeapons() {
    if (P.dead || P.rewinding) return;
    const firing = input.keys.Space || input.keys.KeyZ || input.mouse.l;
    const pd = wy(P.y), syn = synergy();
    for (const k in cd) if (cd[k] > 0) cd[k]--;
    if (firing) {
      for (const [id, lvl, side] of weaponList()) {
        const key = id + side; if (cd[key] > 0) continue;
        switch (id) {
          case 'pulse': { cd[key] = 9; for (let i = 0; i < lvl; i++) { const o = i - (lvl - 1) / 2; pb(P.x + o * 5, pd + 13, lvl > 2 ? o * 0.5 : 0, 6.5, 1.3, 'pulse'); } Music.sfx('shoot'); break; }
          case 'vulcan': { cd[key] = 5; const offs = lvl === 1 ? [-3, 3] : lvl === 2 ? [-4, -1, 1, 4] : [-6, -2, 2, 6]; for (const o of offs) pb(P.x + o, pd + 12, Math.abs(o) > 5 ? o * 0.05 : 0, 8, 0.9, 'vulcan'); Music.sfx('vulcan'); break; }
          case 'spread': { cd[key] = 15 - lvl; const n = 1 + lvl * 2; for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.17; pb(P.x, pd + 12, Math.sin(a) * 5, Math.cos(a) * 5, 2.2, 'plasma', { r: 3 }); } Music.sfx('plasma'); break; }
          case 'sidelaser': { cd[key] = 11 - lvl * 2; pb(P.x + side * 11, pd - 3, side * 6.5, 1.3, 1.5, 'laser', { bounces: syn.prism ? 5 : 0 }); if (lvl >= 3) pb(P.x + side * 11, pd - 3, side * 6, 2.8, 1.5, 'laser', { bounces: syn.prism ? 5 : 0 }); Music.sfx('laser'); break; }
          case 'missile': { cd[key] = 38 - lvl * 6; pb(P.x + side * 11, pd - 2, side * 1.6, 1.2, 5, 'missile', { life: 170, r: 3 }); Music.sfx('missile'); break; }
          case 'bounce': { cd[key] = 32 - lvl * 5; pb(P.x + side * 11, pd, side * 2.2, 2.6, 2.5, 'orb', { bounces: 5 + lvl, life: 260, r: 3 }); Music.sfx('orb'); break; }
          case 'tailgun': { cd[key] = 11; for (const o of [-3, 3]) pb(P.x + o, pd - 13, 0, -6, 1.2, 'tail'); if (lvl >= 2) for (const o of [-1, 1]) pb(P.x + o * 5, pd - 12, o * 2.4, -5.5, 1.2, 'tail'); break; }
          case 'mines': { cd[key] = 55 - lvl * 10; pb(P.x, pd - 12, 0, 0, 8 + lvl * 2, 'mine', { life: 440, r: 4 }); Music.sfx('mine'); break; }
        }
      }
      const al = lvlOf('arc'); if (al > 0) arcBeam(al, syn.tesla);
      const dn = droneCount();
      if (dn && (cd.drone = (cd.drone || 0)) <= 0) { cd.drone = 14; for (let i = 0; i < dn; i++) { const [x, y] = dronePos(i, dn); pb(x, wy(y) + 4, 0, 6, 0.8, 'drone'); } }
    }
    if (syn.tesla && frame % 6 === 0) teslaSwarm();
  }
  function addArc(x0, y0, x1, y1, life, base = R.PLASMA) { arcs.push({ x0, y0, x1, y1, life, base }); }
  function arcBeam(lvl, tesla) {
    const x0 = P.x, y0 = wy(P.y) + 15, range = 85 + lvl * 25;
    const t = nearestEnemy(x0, y0, range, true);
    if (t) {
      const dmg = 0.1 + 0.07 * lvl;
      if (t.boss) damageBoss(dmg, t.x, t.y); else hitEnemy(t, dmg, true);
      addArc(x0, y0, t.x, t.y, 2);
      if (tesla && !t.boss) {
        let src = t; const hit = new Set([t]);
        for (let c = 0; c < 2; c++) {
          let nb = null, bd = 55 * 55;
          for (const e of enemies) { if (hit.has(e) || e.hp <= 0 || KINDS[e.k].invuln) continue; const d = (e.x - src.x) ** 2 + (e.y - src.y) ** 2; if (d < bd) { bd = d; nb = e; } }
          if (!nb) break; hit.add(nb); hitEnemy(nb, dmg * 0.7, true); addArc(src.x, src.y, nb.x, nb.y, 2, R.GOLD); src = nb;
        }
      }
    } else if (frame % 2 === 0) addArc(x0, y0, x0 + (rand() - 0.5) * 24, y0 + 22 + rand() * 18, 1);
    Music.sfx('arc');
  }
  function teslaSwarm() {
    const n = droneCount(); if (!n) return;
    const pts = [];
    for (let i = 0; i < n; i++) { const [x, y] = dronePos(i, n); pts.push([x, wy(y)]); }
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; addArc(a[0], a[1], b[0], b[1], 3, R.GOLD); }
    for (const [x, y] of pts) {
      const near = enemies.filter(e => e.hp > 0 && !KINDS[e.k].invuln && (e.x - x) ** 2 + (e.y - y) ** 2 < 75 * 75).slice(0, 2);
      for (const e of near) { hitEnemy(e, 1.2, true); addArc(x, y, e.x, e.y, 4, R.GOLD); }
      if (boss && boss.st === 1) { const bw = bossWorld(); if ((bw.x - x) ** 2 + (bw.y - y) ** 2 < 90 * 90) { damageBoss(0.8, bw.x, bw.y); addArc(x, y, bw.x, bw.y, 4, R.GOLD); } }
    }
    if (frame % 12 === 0) Music.sfx('arc');
  }
  function nova() {
    if (!synergy().nova || P.dead) return;
    const pd = wy(P.y);
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; pb(P.x, pd, Math.cos(a) * 2.6, Math.sin(a) * 2.6, 5, 'nova', { r: 4, life: 55 }); }
    addP(P.x, pd, 0, 0, 20, 'ring', R.PLASMA, 40);
    Music.sfx('nova');
  }
  function blast(x, y, rad, dmg) {
    for (const e of enemies) { if (e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 < (rad + e.r) ** 2) hitEnemy(e, dmg, true); }
    if (boss && boss.st === 1) { const bw = bossWorld(); if ((bw.x - x) ** 2 + (bw.y - y) ** 2 < (rad + 30) ** 2) damageBoss(dmg * 0.6, x, y); }
    carve(x, y, rad * 0.45, 2);
    addP(x, y, 0, 0, 14, 'flash', R.PLASMA, rad);
    addP(x, y, 0, 0, 16, 'ring', R.PLASMA, rad + 4);
    Music.sfx('explode');
  }
  const CARVE_R = { pulse: 2, vulcan: 1.5, plasma: 3, laser: 2, missile: 5, orb: 2.5, tail: 2, prism: 1.5, drone: 1.5, nova: 4 };
  function updatePBullets() {
    const syn = synergy();
    for (let i = pbul.length - 1; i >= 0; i--) {
      const b = pbul[i]; b.t++;
      let dead = false;
      if (b.k === 'missile') {
        const tg = nearestEnemy(b.x, b.y, 220, false);
        const sp = Math.min(4.8, Math.hypot(b.vx, b.vy) + 0.15);
        let a = Math.atan2(b.vy, b.vx);
        if (tg) { const ta = Math.atan2(tg.y - b.y, tg.x - b.x); let da = ta - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; a += clamp(da, -0.14, 0.14); }
        else a += clamp(Math.PI / 2 - a, -0.05, 0.05);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        if (b.t % 2 === 0) addP(b.x - b.vx, b.y - b.vy, (rand() - 0.5) * 0.3, 0, 18, 'smoke', R.CHROME, 2);
      }
      if (b.k === 'mine') {
        if (b.t > 20) for (const e of enemies) { if (e.hp > 0 && e.r > 0 && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < 22 * 22) { dead = true; break; } }
        if (!dead && boss && boss.st === 1) { const bw = bossWorld(); if ((bw.x - b.x) ** 2 + (bw.y - b.y) ** 2 < 40 * 40) dead = true; }
        if (dead) { blast(b.x, b.y, 28, b.dmg); pbul.splice(i, 1); continue; }
      }
      b.x += b.vx; b.y += b.vy;
      if (b.life && b.t > b.life) { pbul.splice(i, 1); continue; }
      if (b.k !== 'mine' && solidAt(b.x, b.y)) {
        if (b.bounces > 0 && (b.k === 'laser' || b.k === 'orb' || b.k === 'prism')) {
          if (!solidAt(b.x - b.vx, b.y)) b.vx = -b.vx; else b.vy = -b.vy;
          b.x += b.vx * 1.5; b.y += b.vy * 1.5; b.bounces--;
          addP(b.x, b.y, 0, 0, 6, 'flash', b.k === 'orb' ? R.GREEN : R.MAG, 4);
          if (syn.prism && b.k === 'orb') { const a = Math.atan2(b.vy, b.vx); for (const o of [-0.5, 0, 0.5]) pb(b.x, b.y, Math.cos(a + o) * 6, Math.sin(a + o) * 6, 1.5, 'prism', { bounces: 1, life: 40 }); }
          Music.sfx('bounce');
        } else {
          carve(b.x, b.y, CARVE_R[b.k] || 2, b.k === 'missile' || b.k === 'nova' ? 2 : 1);
          addP(b.x, b.y, (rand() - 0.5), (rand() - 0.5), 8, 'spark', R.GOLD);
          if (b.k === 'missile') blast(b.x, b.y, 16, 3);
          pbul.splice(i, 1); continue;
        }
      }
      const sy = toS(b.y);
      if (b.k === 'orb' && b.bounces > 0 && (b.x < 3 || b.x > W - 3)) { b.vx = -b.vx; b.bounces--; }
      if (sy < -12 || sy > PH + 12 || b.x < -10 || b.x > W + 10) { pbul.splice(i, 1); continue; }
      if (b.k === 'mine') continue;
      // enemy hits
      for (const e of enemies) {
        if (e.hp <= 0 || e.r <= 0) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          hitEnemy(e, b.dmg);
          if (b.k === 'missile') blast(b.x, b.y, 16, 3);
          if (b.k === 'nova') blast(b.x, b.y, 18, 3);
          addP(b.x, b.y, 0, 0, 5, 'flash', R.FIRE, 3);
          dead = true; break;
        }
        if (KINDS[e.k].invuln && e.beh === 'piston') {
          const x0 = e.side < 0 ? e.x : e.x - e.ext, x1 = e.side < 0 ? e.x + e.ext : e.x;
          if (b.x > x0 && b.x < x1 && Math.abs(b.y - e.y) < 5) { addP(b.x, b.y, 0, 0, 5, 'spark', R.GOLD); dead = true; break; }
        }
      }
      if (!dead && boss && boss.st === 1 && bossHitTest(b.x, b.y, b.r)) {
        const weak = bossHitTest(b.x, b.y, b.r, true);
        damageBoss(b.dmg * (weak ? (P.intel ? 4 : 2) : 1), b.x, b.y);
        if (b.k === 'missile' || b.k === 'nova') blast(b.x, b.y, 16, 2);
        addP(b.x, b.y, 0, 0, 5, 'flash', weak ? R.MAG : R.FIRE, weak ? 5 : 3);
        dead = true;
      }
      if (dead) pbul.splice(i, 1);
    }
  }
  function updateEBullets() {
    const dn = droneCount(), dps = [];
    for (let i = 0; i < dn; i++) { const [x, y] = dronePos(i, dn); dps.push([x, wy(y)]); }
    const pd = wy(P.y);
    for (let i = ebul.length - 1; i >= 0; i--) {
      const b = ebul[i]; b.t++; b.x += b.vx; b.y += b.vy;
      if (b.k === 'steam') { b.vx *= 0.985; b.vy += 0.01; }
      const sy = toS(b.y);
      if (b.t > b.life || sy < -20 || sy > PH + 20 || b.x < -20 || b.x > W + 20 || (b.k !== 'steam' && b.k !== 'big' && solidAt(b.x, b.y))) { ebul.splice(i, 1); continue; }
      let gone = false;
      for (const [x, y] of dps) if ((x - b.x) ** 2 + (y - b.y) ** 2 < 36) { addP(b.x, b.y, 0, 0, 6, 'flash', R.PLASMA, 3); gone = true; break; }
      if (!gone && !P.dead) {
        const r = b.k === 'big' ? 5.5 : b.k === 'steam' ? 4.5 : 3.2;
        if ((b.x - P.x) ** 2 + (b.y - (pd - 1)) ** 2 < r * r) { hurt(b.k === 'big' ? 14 : b.k === 'steam' ? 6 : 9); gone = true; }
      }
      if (gone) ebul.splice(i, 1);
    }
  }
  function updatePickups() {
    const pd = wy(P.y);
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t++;
      const dx = P.x - p.x, dy = pd - p.y, d = Math.hypot(dx, dy);
      if (!P.dead && d < 44) { p.x += dx / d * 2.4; p.y += dy / d * 2.4; }
      else { p.y -= 0.3; p.x += Math.sin(p.t * 0.05) * 0.3; }
      if (!P.dead && d < 12) {
        if (p.k === 'capsule') { P.shield = Math.min(maxShield(), P.shield + 35); floatText(p.x, p.y, 'SHIELD +35', C.GREEN); Music.sfx('shield'); }
        else { P.credits += p.v; P.score += p.v * 2; floatText(p.x, p.y, '+' + p.v + ' CR'); Music.sfx('cash'); if (p.k === 'bubble') Music.sfx('yeah', 2); }
        pickups.splice(i, 1); continue;
      }
      if (toS(p.y) > PH + 20 || p.t > 1400) pickups.splice(i, 1);
    }
  }
  function updateParticles() {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy;
      if (p.k === 'debris') p.vy -= 0.07;
      if (p.k === 'spark') { p.vx *= 0.95; p.vy *= 0.95; }
      if (--p.life <= 0) parts.splice(i, 1);
    }
    for (let i = arcs.length - 1; i >= 0; i--) if (--arcs[i].life <= 0) arcs.splice(i, 1);
  }

  // =========================================================== BOSS
  function bossWorld() { return { x: boss.x, y: wy(boss.y) }; }
  function bossHitTest(x, y, r, weakOnly) {
    const def = BOSSES[boss.i], sy = toS(y);
    if (weakOnly) { const [ox, oy, rr] = def.weak; return (x - boss.x - ox) ** 2 + (sy - boss.y - oy) ** 2 < (rr + r) ** 2; }
    for (const [ox, oy, rr] of def.circles) if ((x - boss.x - ox) ** 2 + (sy - boss.y - oy) ** 2 < (rr + r) ** 2) return true;
    const [ox, oy, rr] = def.weak; return (x - boss.x - ox) ** 2 + (sy - boss.y - oy) ** 2 < (rr + r) ** 2;
  }
  function spawnBoss() {
    bossSpawned = true;
    const def = BOSSES[stageIdx], hp = def.hp * (1 + loopN * 0.7);
    boss = { i: stageIdx, x: 160, y: -70, hp, mhp: hp, st: 0, t: 0, atk: 0, at: 0, fl: 0, sa: 0 };
    Music.setMode('boss'); Music.sfx('bosswarn');
    say('WARNING: ' + world.def.bossName, 200, C.RED);
  }
  function damageBoss(dmg, x, y) {
    if (!boss || boss.st !== 1) return;
    boss.hp -= dmg; boss.fl = 2;
    if (rand() < 0.3) Music.sfx('ping');
    if (boss.hp <= 0) { boss.st = 2; boss.t = 0; ebul.length = 0; Music.sfx('bigexplode'); P.score += 25000 * (stageIdx + 1) * (1 + loopN); }
  }
  function bShoot(ox, oy, ang, spd, k) { eShoot(boss.x + ox, wy(boss.y + oy), ang, spd, k); }
  function bAim(ox, oy) { return Math.atan2(wy(P.y) - wy(boss.y + oy), P.x - boss.x - ox); }
  function updateBoss() {
    if (!boss) return;
    const b = boss, def = BOSSES[b.i]; b.t++; if (b.fl > 0) b.fl--;
    if (b.st === 0) { b.y += 0.9; if (b.y >= 52) { b.st = 1; b.t = 0; } return; }
    if (b.st === 2) {
      if (b.t % 6 === 0) explode(b.x + (rand() - 0.5) * 90, wy(b.y + (rand() - 0.5) * 60), 3, b.t % 18 !== 0);
      shake = 3;
      if (b.t > 200) {
        explode(b.x, wy(b.y), 8); flashT = 12;
        pickups.push({ k: 'bubble', x: b.x, y: wy(b.y), v: 800 + stageIdx * 300, t: 0 });
        boss = null; state = 'clear'; stateT = 0; Music.sfx('yeah');
        say('EPOCH ' + ROMAN[stageIdx] + ' SECURED', 220, C.YELLOW);
      }
      return;
    }
    const enr = b.hp < b.mhp * 0.5 ? 1.5 : 1;
    b.x = 160 + Math.sin(b.t * 0.011) * (def.chip ? 90 : 70) + (def.chip && (b.t % 120) < 10 ? (rand() - 0.5) * 6 : 0);
    b.y = 52 + Math.sin(b.t * 0.021) * 8;
    const atk = def.attacks[b.atk % def.attacks.length], t = ++b.at, dur = 200;
    const [wx, wyy] = def.weak;
    switch (atk) {
      case 'aimed3': if (t % Math.round(34 / enr) === 0) { const a = bAim(wx, wyy); for (let k = -1; k <= 1; k++) bShoot(wx, wyy, a + k * 0.2, 1.9); } break;
      case 'aimed5': if (t % Math.round(42 / enr) === 0) { const a = bAim(wx, wyy); for (let k = -2; k <= 2; k++) bShoot(wx, wyy, a + k * 0.18, 1.8); } break;
      case 'fan': if (t % Math.round(7 / enr) === 0) { const a = -Math.PI / 2 + Math.sin(t * 0.05) * 1.1; bShoot(-12, 30, a - 0.3, 2.2); bShoot(12, 30, a + 0.3, 2.2); } break;
      case 'ring': if (t % Math.round(48 / enr) === 0) { const n = 14; for (let k = 0; k < n; k++) bShoot(0, 0, k * TAU / n + t, 1.4); } break;
      case 'ring2': if (t % Math.round(40 / enr) === 0) { for (let k = 0; k < 16; k++) { bShoot(0, -8, k * TAU / 16 + t * 0.1, 1.3); bShoot(0, -8, k * TAU / 16 + t * 0.1 + 0.2, 1.8); } } break;
      case 'spiral': if (t % 4 === 0) { b.sa += 0.23 * enr; for (let k = 0; k < 2; k++) bShoot(wx, wyy - 6, b.sa + k * Math.PI, 1.5); } break;
      case 'minions': if (t % 70 === 1 && enemies.length < 14) for (let k = -1; k <= 1; k++) mkEnemy(def.minion, b.x + k * 30, wy(b.y + 10), 'diver', { st: 2, vx: k * 0.8, vy: -2.2 }); break;
      case 'ink': if (t % Math.round(26 / enr) === 0) bShoot(wx, wyy, bAim(wx, wyy) + (rand() - 0.5) * 0.5, 0.9, 'big'); break;
      case 'tentacles': if (t % Math.round(44 / enr) === 0) for (let k = 0; k < 8; k++) { const tx = -28 + k * 8, ty = 22 + 24; bShoot(tx, ty, bAim(tx, ty), 1.7); } break;
      case 'gears': if (t % Math.round(22 / enr) === 0) bShoot((rand() - 0.5) * 80, 20, -Math.PI / 2 + (rand() - 0.5) * 0.8, 1.5, 'big'); break;
      case 'beams': if (t % Math.round(70 / enr) === 1) { beams.push({ x: P.x, t: 0, warn: 50, dur: 34, w: 5 }); if (enr > 1) beams.push({ x: 20 + rand() * 280, t: 0, warn: 50, dur: 34, w: 5 }); } break;
      case 'bobs': if (t === 10) spawnWave({ beh: 'lissajous', kind: 'bob', n: 6, x: 160, seed: b.t, d: 0 }); break;
      case 'spores': if (t % 50 === 1) for (let k = 0; k < 4; k++) mkEnemy('spore', b.x + (k - 1.5) * 20, wy(b.y + 10), 'homer', { vx: (k - 1.5) * 0.8, vy: -1 }); break;
    }
    if (def.coils && t % 40 === 0) { for (const sx of [-51, 51]) addArc(b.x + sx, wy(b.y - 21), b.x + sx + (rand() - 0.5) * 40, wy(b.y + 10 + rand() * 30), 8, R.PLASMA); }
    if (t > dur) { b.atk++; b.at = 0; }
    if (!P.dead && P.inv <= 0 && bossHitTest(P.x, wy(P.y), 6)) hurt(20);
  }
  function updateBeams() {
    for (let i = beams.length - 1; i >= 0; i--) {
      const bm = beams[i]; bm.t++;
      if (bm.t === bm.warn) { Music.sfx('laser'); shake = 2; }
      if (bm.t >= bm.warn && Math.abs(P.x - bm.x) < bm.w + 4) hurt(14);
      if (bm.t > bm.warn + bm.dur) beams.splice(i, 1);
    }
  }

  // =========================================================== REWIND
  function copyList(list) { const out = new Array(list.length); for (let i = 0; i < list.length; i++) { const c = Object.assign({}, list[i]); c.__ref = list[i]; out[i] = c; } return out; }
  function restoreList(list, saved) { list.length = 0; for (const c of saved) { const r = c.__ref; Object.assign(r, c); list.push(r); } }
  function snapshot() {
    const s = ring[ringHead] || (ring[ringHead] = {});
    s.cam = cam; s.spawnIdx = spawnIdx; s.px = P.x; s.py = P.y; s.pvx = P.vx; s.pvy = P.vy; s.shield = P.shield; s.score = P.score; s.credits = P.credits;
    s.en = copyList(enemies); s.eb = copyList(ebul); s.pb = copyList(pbul); s.pk = copyList(pickups); s.wv = copyList(waves);
    s.boss = boss ? Object.assign({ __ref: boss }, boss) : null; s.bossSpawned = bossSpawned;
    ringHead = (ringHead + 1) % RING; ringCount = Math.min(RING, ringCount + 1);
  }
  function rewindStep() {
    ringHead = (ringHead - 1 + RING) % RING; ringCount--;
    const s = ring[ringHead];
    cam = s.cam; camI = Math.floor(cam); spawnIdx = s.spawnIdx; P.x = s.px; P.y = s.py; P.vx = s.pvx; P.vy = s.pvy; P.shield = s.shield; P.score = s.score; P.credits = s.credits;
    restoreList(enemies, s.en); restoreList(ebul, s.eb); restoreList(pbul, s.pb); restoreList(pickups, s.pk); restoreList(waves, s.wv);
    if (s.boss) { boss = s.boss.__ref; Object.assign(boss, s.boss); } else boss = null;
    bossSpawned = s.bossSpawned;
    P.chrono = Math.max(0, P.chrono - (hullIs('capacitor') ? 0.6 : 1));
    P.rewound++;
    if (frame % 3 === 0) for (let i = 0; i < 3; i++) addP(rand() * W, wy(rand() * PH), 0, 0, 8, 'streak', R.PLASMA);
  }

  // =========================================================== FLOW
  function resetPlayer() {
    Object.assign(P, { x: 160, y: PH - 30, vx: 0, vy: 0, shield: 100, lives: 3, credits: 500, score: 0, bombs: 1, speedLvl: 0, nashwan: 0, nashT: 0, inv: 120, chrono: 180, dead: 0, intel: false });
    for (const s of SLOTS) equip[s] = null;
    carryIntel = false;
    equip.nose = { id: 'pulse', lvl: 1, paid: 150 };
  }
  function loadStage(i) {
    stageIdx = i; world = Stages.build(i, loopN);
    cam = 0; camI = 0; maxCam = 0; spawnIdx = 0; camDelta = 0;
    enemies.length = ebul.length = pbul.length = pickups.length = parts.length = waves.length = 0;
    arcs = []; beams = []; boss = null; bossSpawned = false; midShopDone = false; P.intel = carryIntel; carryIntel = false; ringCount = 0;
    P.x = 160; P.y = PH - 30; P.vx = P.vy = 0; P.inv = 120; P.dead = 0; if (P.shield <= 0) P.shield = maxShield();
    for (const k in cd) delete cd[k];
    Music.setEra(i);
    state = 'play'; stateT = 0; intro = 260;
  }
  function startGame(stage = 0) {
    Music.init(); loopN = 0; resetPlayer(); loadStage(stage);
    if (window.UI) UI.onStageStart();
  }
  function nextStage() {
    if (stageIdx >= 4) { state = 'victory'; stateT = 0; Music.setMode('normal'); if (P.score > hiScore) { hiScore = P.score; localStorage.setItem('x2hi', hiScore); } return; }
    loadStage(stageIdx + 1);
    if (window.UI) UI.onStageStart();
  }
  function openShop(reason) {
    if (modal || !world) return;
    shopReason = reason; modal = 'shop';
    Music.setMode('shop'); Music.sfx('dock'); P.rewinding = false; Music.setRewind(false);
    if (window.UI) UI.openShop(reason);
  }
  function closeShop() {
    if (modal !== 'shop') return;
    modal = null; if (window.UI) UI.closeShop();
    if (shopReason === 'end') { carryIntel = P.intel; nextStage(); }
    else Music.setMode(boss ? 'boss' : 'normal');
  }
  function smartBomb() {
    if (P.bombs <= 0 || P.dead || state !== 'play') { Music.sfx('error'); return false; }
    P.bombs--; flashT = 14; shake = 12; ebul.length = 0;
    for (const e of enemies) if (onScreen(e, 20)) hitEnemy(e, 30, true);
    if (boss && boss.st === 1) damageBoss(25, boss.x, wy(boss.y));
    addP(P.x, wy(P.y), 0, 0, 30, 'ring', R.FIRE, 200); addP(P.x, wy(P.y), 0, 0, 24, 'ring', R.GOLD, 150);
    Music.sfx('bomb'); say('MEGABLAST!', 70, C.YELLOW);
    return true;
  }
  function nashwan() {
    if (P.nashwan <= 0 || P.nashT > 0 || P.dead || state !== 'play') { Music.sfx('error'); return false; }
    P.nashwan--; P.nashT = 1200; Music.sfx('nashwan'); say('SUPER NASHWAN POWER!', 150, C.YELLOW); flashT = 8;
    return true;
  }

  // =========================================================== UPDATE
  function update() {
    frame++;
    if (state === 'title') { stateT++; if (titleWorld) Stages.cyclePalette(titleWorld.def, frame); return; }
    if (!world) return;
    Stages.cyclePalette(world.def, frame);
    if (paused || modal) return;
    stateT++;
    if (shake > 0) shake *= 0.86;
    if (flashT > 0) flashT--;
    if (banner && --banner.t <= 0) banner = null;
    if (intro > 0) intro--;
    if (state === 'gameover') { updateParticles(); if (stateT > 330) toTitle(); return; }
    if (state === 'victory') { updateParticles(); if (stateT > 900) { loopN++; loadStage(0); if (window.UI) UI.onStageStart(); } return; }
    if (state === 'clear') { updatePlayer(); updatePBullets(); updatePickups(); updateParticles(); if (stateT > 240) openShop('end'); return; }

    // ---- Chrono-Reverse Thrust
    const wantRw = (input.keys.KeyR || input.keys.ShiftLeft || input.keys.ShiftRight || input.mouse.r) && !P.dead;
    if (wantRw && P.chrono > 0.5 && ringCount > 0) {
      if (!P.rewinding) { P.rewinding = true; P.rewound = 0; Music.setRewind(true); }
      rewindStep(); updateParticles();
      return;
    } else if (P.rewinding) {
      P.rewinding = false; Music.setRewind(false);
      if (P.rewound > 12) nova();
      P.inv = Math.max(P.inv, 30);
    }

    updatePlayer();
    updateCamera();
    while (spawnIdx < world.events.length && world.events[spawnIdx].d <= cam + PH + 30) { const ev = world.events[spawnIdx++]; if (ev.t !== 'shop') spawnEvent(ev); }
    if (!midShopDone && cam + PH * 0.55 >= world.midShop) { midShopDone = true; openShop('mid'); return; }
    if (!bossSpawned && cam >= world.camStop) spawnBoss();
    fireWeapons();
    updatePBullets();
    updateEnemies();
    updateBoss();
    updateBeams();
    updateEBullets();
    updatePickups();
    updateParticles();
    if (state === 'play') snapshot();
  }
  function toTitle() { state = 'title'; stateT = 0; world = null; boss = null; if (titleWorld) Stages.applyPalette(titleWorld.def); Music.setMode('normal'); if (window.UI) UI.onStageStart(); }

  // =========================================================== RENDER
  function drawFar(wd, cv, t) {
    const px = G.px, far = wd.far, off = Math.floor(cv * 0.3);
    if (wd.def.copper) {
      for (let sy = 0; sy < PH; sy++) {
        const ci = R.CYC + ((((sy + Math.sin(t * 0.02 + sy * 0.012) * 24) | 0) >> 1) + (off >> 1) & 31);
        const o = sy * W; px.fill(ci, o, o + W);
        const row = ((off * 0.5 - sy) & 255) << 8;
        for (let x = 0; x < W; x++) { const v = far[row | (x & 255)]; if (v) px[o + x] = v; }
      }
      return;
    }
    for (let sy = 0; sy < PH; sy++) { const row = ((off - sy) & 255) << 8, o = sy * W; for (let x = 0; x < W; x++) px[o + x] = far[row | (x & 255)]; }
  }
  function drawMid(wd, cv) {
    const px = G.px, mid = wd.mid, off = Math.floor(cv * 0.6);
    for (let sy = 0; sy < PH; sy++) { const row = ((off - sy) & 255) << 8, o = sy * W; for (let x = 0; x < W; x++) { const v = mid[row | ((x + 40) & 255)]; if (v) px[o + x] = v; } }
  }
  function drawWalls(wd, ci) {
    const px = G.px, wall = wd.wall, len = wd.len;
    for (let sy = 0; sy < PH; sy++) {
      const d = ci + PH - 1 - sy; if (d < 0 || d >= len) continue;
      const ro = d * W, o = sy * W;
      for (let x = 0; x < W; x++) { const v = wall[ro + x]; if (v) px[o + x] = v; }
    }
  }
  function jag(x0, y0, x1, y1, c1, c2) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), n = Math.max(2, Math.ceil(len / 7));
    const nx = -dy / (len || 1), ny = dx / (len || 1);
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
      const u = i / n, j = i === n ? 0 : (rand() - 0.5) * 7;
      const qx = x0 + dx * u + nx * j, qy = y0 + dy * u + ny * j;
      G.line(px + 1, py, qx + 1, qy, c2); G.line(px, py, qx, qy, c1);
      px = qx; py = qy;
    }
  }
  function drawShip(x, y, view, lut) {
    const f = frame;
    const fl = 3 + (view.speed || 0) + Math.sin(f * 0.7) * 1.2 + (view.boost ? 3 : 0);
    for (const sx of [-4.5, 4.5]) for (let k = 0; k < fl; k++) G.glow(x + sx, y + 13 + k * 1.6 + (view.after ? 4 : 0), 3.2 * (1 - k / (fl + 1)) + 0.8, view.gold ? R.GOLD : R.FIRE, 1.1);
    if (view.after) G.blitC(SPR.hull_afterburner, x, y + 2, lut);
    const lw = view.lwing || [], rw = view.rwing || [];
    lw.forEach((id, k) => G.blitC(SPR['pod_' + id], x - 10 - k * 6, y + 4 + k * 2, lut));
    rw.forEach((id, k) => G.blitC(SPR['pod_' + id], x + 10 + k * 6, y + 4 + k * 2, lut));
    G.blitC(SPR.ship, x, y, lut);
    if (view.plating) G.blitC(SPR.hull_plating, x, y, lut);
    if (view.cap) G.blitC(SPR.hull_capacitor, x, y, (f >> 3) & 1 ? LUT.gold : lut);
    for (const id of (view.nose || [])) G.blitC(SPR['nose_' + id], x, y - 15, lut);
    for (const id of (view.tail || [])) G.blitC(SPR['tail_' + id], x, y + 15, lut);
  }
  function shipView() {
    if (P.nashT > 0) return { nose: ['arc', 'vulcan'], lwing: ['sidelaser', 'missile', 'bounce'], rwing: ['bounce', 'missile', 'sidelaser'], tail: ['mines', 'tailgun'], plating: hullIs('plating'), cap: hullIs('capacitor'), after: hullIs('afterburner'), speed: P.speedLvl, gold: true, boost: P.vy < -0.5 };
    return {
      nose: equip.nose ? [equip.nose.id] : [], lwing: equip.lwing ? [equip.lwing.id] : [], rwing: equip.rwing ? [equip.rwing.id] : [], tail: equip.tail ? [equip.tail.id] : [],
      plating: hullIs('plating'), cap: hullIs('capacitor'), after: hullIs('afterburner'), speed: P.speedLvl, boost: P.vy < -0.5,
    };
  }
  function drawPlayer() {
    if (P.dead) return;
    if (P.inv > 0 && !P.rewinding && (frame & 4) && state === 'play') return;
    const view = shipView(), lut = P.nashT > 0 ? LUT.gold : null;
    if (P.nashT > 0) G.glow(P.x, P.y, 22, R.GOLD, 0.35 + Math.sin(frame * 0.2) * 0.1);
    drawShip(Math.round(P.x), Math.round(P.y), view, lut);
    const n = droneCount();
    for (let i = 0; i < n; i++) { const [x, y] = dronePos(i, n); G.blitC(SPR.drone[(frame >> 2) & 7], x, y, lut); }
    if (P.blocked && (frame & 16)) G.textC('BLOCKED! HOLD DOWN: REVERSE THRUST', 160, PH - 10, C.YELLOW, C.OUTLINE);
  }
  function drawEnemies() {
    for (const e of enemies) {
      const K = KINDS[e.k], sy = toS(e.y), lut = e.fl > 0 ? LUT.flash : null;
      if (sy < -40 || sy > PH + 40) continue;
      if (e.k === 'bob') { G.orb(e.x, sy, 5.5, e.fl > 0 ? R.CHROME : [R.PLASMA, R.MAG, R.GREEN, R.GOLD][e.col]); continue; }
      if (e.k === 'vcube') { drawCube(e, sy); continue; }
      if (e.beh === 'piston') {
        if (e.side < 0) G.blit(SPR.piston, e.x + e.ext - 64, sy - 5); else G.blit(SPR.pistonR, e.x - e.ext, sy - 5);
        continue;
      }
      if (e.beh === 'arcnode' && e.master && e.partner && e.partner.hp > 0) {
        const x0 = e.x, x1 = e.partner.x;
        if (e.beam === 1 && (frame & 2)) for (let x = x0; x < x1; x += 4) G.pset(x, sy, C.RED);
        if (e.beam === 2) {
          if (e.laser) { G.rect(x0, sy - 2, x1 - x0, 5, R.FIRE + 10); G.rect(x0, sy - 1, x1 - x0, 3, R.FIRE + 14); G.hline(x0, x1, sy, C.WHITE); }
          else { jag(x0, sy, x1, sy, R.PLASMA + 15, R.PLASMA + 9); jag(x0, sy, x1, sy, R.PLASMA + 12, R.PLASMA + 6); }
        }
      }
      let spr = SPR[K.spr]; if (Array.isArray(spr)) spr = spr[Math.floor(e.t / (K.anim || 6)) % spr.length];
      G.blitC(spr, e.x, sy, lut);
      if (K.barrel) { const a = -e.ang; G.line(e.x, sy, e.x + Math.cos(a) * 8, sy + Math.sin(a) * 8, R.CHROME + 13); G.pset(e.x + Math.cos(a) * 8, sy + Math.sin(a) * 8, C.WHITE); }
      if (e.k === 'mine') G.glow(e.x, sy, e.armed ? 4 : 2.5, R.FIRE, (e.armed ? (frame & 2) : (frame & 32)) ? 1.2 : 0.3);
      if (e.k === 'vent' && e.venting) G.glow(e.x, sy, 6, R.FIRE, 0.8);
    }
  }
  function drawCube(e, sy) {
    const V = [], ca = Math.cos(e.ax), sa = Math.sin(e.ax), cb = Math.cos(e.ay), sb = Math.sin(e.ay), s = 8;
    for (let i = 0; i < 8; i++) {
      let x = (i & 1 ? 1 : -1) * s, y = (i & 2 ? 1 : -1) * s, z = (i & 4 ? 1 : -1) * s;
      let y2 = y * ca - z * sa, z2 = y * sa + z * ca; let x2 = x * cb + z2 * sb; z2 = -x * sb + z2 * cb;
      const p = 60 / (60 + z2); V.push([e.x + x2 * p, sy + y2 * p, z2]);
    }
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of E) { const z = (V[a][2] + V[b][2]) / 2; G.line(V[a][0], V[a][1], V[b][0], V[b][1], e.fl > 0 ? C.WHITE : (z > 0 ? R.PLASMA + 7 : R.CYC + ((frame >> 1) & 31))); }
  }
  function drawBoss() {
    if (!boss) return;
    const b = boss, def = BOSSES[b.i], sy = Math.round(b.y), bx = Math.round(b.x);
    const lut = b.fl > 0 ? LUT.flash : (b.st === 2 && (frame & 4) ? LUT.red : null);
    if (def.tentacles) for (let k = 0; k < 8; k++) {
      let x = bx - 28 + k * 8, y = sy + 20, a = Math.PI / 2;
      for (let s = 0; s < 11; s++) { a = Math.PI / 2 + Math.sin(b.t * 0.05 + k * 0.8 + s * 0.45) * 0.5 * (s / 10); x += Math.cos(a) * 3.2; y += Math.sin(a) * 3.2; G.orb(x, y, 3.6 - s * 0.25, b.fl > 0 ? R.CHROME : R.E0); }
    }
    const spr = SPR[def.spr]; G.blitC(spr[Math.floor(b.t / 8) % spr.length], bx, sy, lut);
    if (def.chip) { G.textC('MC68000', bx, sy - 16, R.GOLD + 12); G.textC('(C)1989 XENITE', bx, sy + 12, R.CHROME + 7); }
    if (def.brain) { const a = Math.atan2(P.y - (sy + 10), P.x - bx); G.circle(bx + Math.cos(a) * 3, sy + 11 + Math.sin(a) * 2, 2.2, C.BLACK); }
    if (P.intel && b.st === 1 && (frame & 8)) { const [ox, oy, r] = def.weak; G.ring(bx + ox, sy + oy, r + 4, C.YELLOW); G.textC('WEAK', bx + ox, sy + oy + r + 6, C.YELLOW, C.OUTLINE); }
    if (b.st >= 1) {
      G.rect(59, 3, 202, 6, C.OUTLINE); G.rect(60, 4, 200, 4, C.PANEL2);
      G.rect(60, 4, Math.max(0, 200 * b.hp / b.mhp), 4, R.FIRE + 11); G.rect(60, 4, Math.max(0, 200 * b.hp / b.mhp), 1, R.FIRE + 15);
      G.textC(world.def.bossName, 160, 11, C.WHITE, C.OUTLINE);
    }
  }
  function drawBullets() {
    for (const b of pbul) {
      const sy = toS(b.y), x = b.x;
      switch (b.k) {
        case 'pulse': G.glow(x, sy, 3, R.PLASMA, 1.2); G.pset(x, sy, C.WHITE); break;
        case 'vulcan': G.rect(x, sy - 2, 1, 4, R.GOLD + 14); G.pset(x, sy - 3, C.WHITE); break;
        case 'plasma': G.glow(x, sy, 4, R.MAG, 1.2); G.pset(x, sy, C.WHITE); break;
        case 'laser': { const l = 6 / Math.hypot(b.vx, b.vy); G.line(x - b.vx * l, sy + b.vy * l, x, sy, R.FIRE + 11); G.line(x - b.vx * l * 0.6, sy + b.vy * l * 0.6, x, sy, C.WHITE); break; }
        case 'prism': G.line(x - b.vx, sy + b.vy, x, sy, [R.MAG + 14, R.PLASMA + 14, R.GOLD + 14][(b.t >> 1) % 3]); break;
        case 'missile': { const l = 4 / Math.hypot(b.vx, b.vy); G.line(x - b.vx * l, sy + b.vy * l, x, sy, R.CHROME + 12); G.glow(x - b.vx * l, sy + b.vy * l, 2.5, R.FIRE, 1); break; }
        case 'orb': G.orb(x, sy, 3, R.GREEN); break;
        case 'tail': G.rect(x, sy - 1, 1, 3, R.GOLD + 12); break;
        case 'drone': G.rect(x, sy - 1, 1, 3, R.PLASMA + 14); break;
        case 'mine': G.glow(x, sy, 3.5 + Math.sin(b.t * 0.3), R.PLASMA, 1); if ((b.t >> 3) & 1) G.ring(x, sy, 6, R.PLASMA + 8); break;
        case 'nova': G.glow(x, sy, 4.5, R.PLASMA, 1.3); G.pset(x, sy, C.WHITE); break;
      }
    }
    for (const b of ebul) {
      const sy = toS(b.y);
      if (b.k === 'big') { G.glow(b.x, sy, 6.5, R.MAG, 1.2); G.circle(b.x, sy, 1.5, C.WHITE); }
      else if (b.k === 'steam') G.glow(b.x, sy, 4 + b.t * 0.05, R.CHROME, 0.55);
      else { G.glow(b.x, sy, 3.6, R.FIRE, 1.25); G.pset(b.x, sy, C.WHITE); }
    }
  }
  function drawPickups() {
    for (const p of pickups) {
      const sy = toS(p.y);
      if (p.k === 'bubble') { G.blitC(SPR.bubble, p.x, sy + Math.sin(p.t * 0.1) * 1.5); if ((p.t >> 4) & 1) G.textC(p.v, p.x, sy - 13, C.YELLOW, C.OUTLINE); }
      else if (p.k === 'coin') G.blitC(SPR.coin, p.x, sy);
      else if (p.k === 'capsule') { G.blitC(SPR.capsule, p.x, sy); if (p.t & 8) G.textC('S', p.x, sy - 2, C.WHITE); }
    }
  }
  function drawParticles() {
    for (const p of parts) {
      const sy = toS(p.y), u = p.life / p.max;
      switch (p.k) {
        case 'flash': G.glow(p.x, sy, p.r * u + 2, p.c, 1.3); break;
        case 'ring': G.ring(p.x, sy, p.r * (1 - u) + 2, p.c + Math.max(1, Math.round(15 * u))); break;
        case 'spark': G.pset(p.x, sy, p.c + Math.max(1, Math.round(15 * u))); break;
        case 'debris': G.rect(p.x, sy, 2, 2, p.c); break;
        case 'smoke': G.glow(p.x, sy, p.r * (1.6 - u), p.c, 0.35 * u + 0.1); break;
        case 'text': G.textC(p.str, p.x, sy, p.c, C.OUTLINE); break;
        case 'streak': G.hline(p.x - 20, p.x + 20, sy, R.PLASMA + 10); break;
      }
    }
    for (const a of arcs) jag(a.x0, toS(a.y0), a.x1, toS(a.y1), a.base + 15, a.base + 9);
    for (const bm of beams) {
      if (bm.t < bm.warn) { if (bm.t & 4) for (let y = 0; y < PH; y += 3) G.pset(bm.x, y, C.RED); }
      else { const w = bm.w + Math.sin(bm.t) * 1; G.rect(bm.x - w, 0, w * 2, PH, R.FIRE + 9); G.rect(bm.x - w + 2, 0, w * 2 - 4, PH, R.FIRE + 14); G.rect(bm.x - 1, 0, 2, PH, C.WHITE); }
    }
  }
  function bar(x, y, w, v, base) {
    G.rect(x - 1, y - 1, w + 2, 5, C.OUTLINE); G.rect(x, y, w, 3, C.PANEL);
    const f = Math.round(w * clamp(v, 0, 1)); G.rect(x, y, f, 3, base + 10); G.rect(x, y, f, 1, base + 14);
  }
  function drawHUD() {
    for (let y = PH; y < H; y++) G.rect(0, y, W, 1, y === PH ? R.CHROME + 12 : y === PH + 1 ? R.CHROME + 7 : y === H - 1 ? R.CHROME + 2 : C.PANEL);
    G.text('SC ' + String(P.score).padStart(7, '0'), 4, 192, C.WHITE);
    G.text('$' + P.credits, 70, 192, C.YELLOW);
    G.text('SH', 110, 192, R.GREEN + 12); bar(120, 193, 60, P.shield / maxShield(), P.shield < 30 && (frame & 8) ? R.FIRE : R.GREEN);
    G.text('CH', 188, 192, R.PLASMA + 12); bar(198, 193, 50, P.chrono / 180, R.PLASMA);
    G.text('x' + Math.max(0, P.lives), 256, 192, C.WHITE);
    G.text('B' + P.bombs, 274, 192, R.FIRE + 13);
    G.text(P.nashT > 0 ? 'N' + Math.ceil(P.nashT / 60) : 'N' + P.nashwan, 292, 192, R.GOLD + 13);
  }
  function drawOverlays() {
    if (intro > 0 && state === 'play') {
      const a = intro > 220 ? (260 - intro) / 40 : intro < 40 ? intro / 40 : 1;
      const lg = LOGO['epoch' + stageIdx], y = Math.round(46 - (1 - a) * 30);
      if (lg) G.blitC(lg, 160, y);
      G.textC(world.def.name, 160, y + 24, C.WHITE, C.OUTLINE);
      G.textC(world.def.epoch, 160, y + 32, R.GOLD + 13, C.OUTLINE);
      if (intro < 200) G.textC('GET READY', 160, y + 44, (frame & 8) ? C.YELLOW : C.ORANGE, C.OUTLINE);
    }
    if (P.rewinding) {
      G.blitC(LOGO.rewind, 160, 26);
      G.textC('<< CHRONO REWIND ' + Math.ceil(P.chrono / 60 * 10) / 10 + 'S >>', 160, 42, C.CYAN, C.OUTLINE);
    } else if (P.reversing && (frame & 8)) G.textC('REVERSE THRUST', 160, PH - 22, C.CYAN, C.OUTLINE);
    if (banner) { const y = boss && boss.st ? 24 : 70; G.textC(banner.text, 160, y, (frame & 4) || banner.col !== C.RED ? banner.col : C.WHITE, C.OUTLINE, banner.text.length > 26 ? 1 : 2); }
    if (state === 'gameover') { G.blitC(LOGO.gameover, 160, 80); G.textC('FINAL SCORE ' + P.score, 160, 104, C.WHITE, C.OUTLINE); }
    if (state === 'victory') {
      G.blitC(LOGO.victory, 160, 50);
      const lines = ['THE XENITE TEMPORAL BOMBS ARE DEFUSED.', 'EVOLUTION CONTINUES ON SCHEDULE.', '', 'CRISPIN SENDS HIS REGARDS', '(AND HIS INVOICE).', '', 'SCORE ' + P.score, '', 'A TRIBUTE TO THE BITMAP BROTHERS', 'AND BOMB THE BASS - MEGABLAST 1989', '', 'NEXT LOOP: HARDER. FASTER. CHROMIER.'];
      lines.forEach((l, i) => G.textC(l, 160, 78 + i * 8, i === 6 ? C.YELLOW : C.WHITE, C.OUTLINE));
    }
    if (paused) { G.blitC(LOGO.paused, 160, 90); G.textC('PRESS P TO CONTINUE', 160, 110, C.WHITE, C.OUTLINE); }
  }
  function renderTitle() {
    const tw = titleWorld, cv = stateT * 0.6;
    drawFar(tw, cv, frame); drawMid(tw, cv);
    const b = Music.ready ? Music.beat() : 0;
    const bob = Math.round(Math.sin(frame * 0.03) * 3);
    G.blitC(LOGO.title, 160, 38 + bob);
    G.blitC(LOGO.mega, 160, 66 + bob);
    G.textC('EVOLUTION & TRACKER ODYSSEY', 160, 84, C.CYAN, C.OUTLINE);
    const x = 160 + Math.sin(frame * 0.02) * 60, y = 128 + Math.sin(frame * 0.05) * 5;
    drawShip(Math.round(x), Math.round(y), { nose: ['arc'], lwing: ['sidelaser'], rwing: ['bounce'], tail: ['mines'], cap: true, speed: 2, boost: true }, null);
    for (let i = 0; i < 2; i++) { const [dx, dy] = [Math.cos(frame * 0.055 + i * Math.PI) * 19, Math.sin(frame * 0.055 + i * Math.PI) * 15]; G.blitC(SPR.drone[(frame >> 2) & 7], x + dx, y + dy); }
    if ((frame >> 5) & 1) G.textC('PRESS ENTER OR CLICK TO START', 160, 160, b < 0.25 ? C.WHITE : C.YELLOW, C.OUTLINE);
    G.textC('1-5: WARP TO EPOCH   T: TRACKER JUKEBOX   C: CRT', 160, 172, R.CHROME + 11, C.OUTLINE);
    G.textC('HI ' + String(hiScore).padStart(7, '0'), 160, 184, R.GOLD + 13, C.OUTLINE);
    G.textC('A BITMAP BROTHERS TRIBUTE - 100% SYNTHESIZED - NO SAMPLES', 160, 193, R.CHROME + 8);
  }
  function render() {
    G.target();
    if (state === 'boot') { G.clear(C.BLACK); G.present(); return; }
    if (state === 'title') { renderTitle(); G.fx.rewind = 0; G.fx.red = 0; G.fx.flash = 0; G.present(); return; }
    drawFar(world, cam, frame); drawMid(world, cam); drawWalls(world, camI);
    drawPickups(); drawEnemies(); drawBoss(); drawBullets(); drawPlayer(); drawParticles(); drawOverlays(); drawHUD();
    G.fx.rewind = P.rewinding ? 0.85 : 0;
    G.fx.red = P.inv > 30 && !P.rewinding && P.shield > 0 && state === 'play' ? (P.inv - 30) / 30 * 0.4 : 0;
    G.fx.flash = flashT > 0 ? flashT / 14 : 0;
    G.fx.dim = modal ? 0.35 : 0;
    const s = shake > 0.5 ? shake : 0;
    G.present(s ? Math.round((rand() - 0.5) * s) : 0, s ? Math.round((rand() - 0.5) * s) : 0, P.rewinding ? 3 : 0, frame * 0.3);
  }
  function drawShipPreview(surf) {
    G.target(surf); G.clear(0);
    const cx = surf.w >> 1, cy = surf.h >> 1;
    for (let y = 0; y < surf.h; y++) for (let x = 0; x < surf.w; x++) if (((x >> 3) + (y >> 3)) & 1) surf.px[y * surf.w + x] = C.PANEL;
    const v = shipView(); v.boost = false;
    drawShip(cx, cy, v, null);
    const n = droneCount();
    for (let i = 0; i < n; i++) { const a = frame * 0.03 + i * TAU / n, r = n === 4 ? 30 : 26; G.blitC(SPR.drone[(frame >> 2) & 7], cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); }
    G.target();
  }

  // =========================================================== INPUT
  function onKey(code, e) {
    Music.init();
    if (window.UI && UI.handleKey(code)) return;
    if (state === 'title') {
      if (code === 'Enter' || code === 'Space') startGame(0);
      else if (/^Digit[1-5]$/.test(code)) startGame(+code[5] - 1);
      return;
    }
    switch (code) {
      case 'KeyB': if (modal === 'shop') closeShop(); else if (state === 'play' && !modal) openShop('dock'); break;
      case 'KeyP': if (!modal) paused = !paused; break;
      case 'Escape': if (modal === 'shop') closeShop(); else if (!modal) paused = !paused; break;
      case 'KeyQ': if (!modal && !paused && !smartBomb() && P.nashwan > 0) nashwan(); break;
      case 'KeyX': if (!modal && !paused && !nashwan() && P.bombs > 0) smartBomb(); break;
      default:
        if (/^Digit[1-5]$/.test(code) && !modal) { const i = +code[5] - 1; if (state === 'gameover' || state === 'victory') startGame(i); else { loadStage(i); if (window.UI) UI.onStageStart(); } }
        if (code === 'Enter' && (state === 'gameover' || state === 'victory')) toTitle();
    }
  }
  function bindInput(canvas) {
    const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (block.includes(e.code)) e.preventDefault();
      if (!e.repeat) onKey(e.code, e);
      input.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { input.keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in input.keys) input.keys[k] = false; input.mouse.l = input.mouse.r = false; });
    const toLocal = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    canvas.addEventListener('mousemove', e => { const [x, y] = toLocal(e); input.mouse.x = clamp(x, 0, W); input.mouse.y = clamp(y, 0, PH); if (e.movementX || e.movementY) input.mouse.active = true; });
    canvas.addEventListener('mousedown', e => {
      Music.init(); e.preventDefault();
      if (state === 'title') { startGame(0); return; }
      if (state === 'gameover' || state === 'victory') { toTitle(); return; }
      input.mouse.active = true;
      if (e.button === 0) input.mouse.l = true; else if (e.button === 2) input.mouse.r = true;
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) input.mouse.l = false; else if (e.button === 2) input.mouse.r = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  // =========================================================== BOOT
  function init(canvas) {
    G.init(canvas);
    Sprites.build();
    SPR.pistonR = flipH(SPR.piston);
    LOGO.title = G.makeLogo('XENON II', 40, null, { rad: 5 });
    LOGO.mega = G.makeLogo('MEGABLAST', 24, () => G.M.gold, { rad: 3.5 });
    LOGO.gameover = G.makeLogo('GAME OVER', 30, null, { rad: 4 });
    LOGO.victory = G.makeLogo('VICTORY!', 30, () => G.M.gold, { rad: 4 });
    LOGO.rewind = G.makeLogo('CHRONO REWIND', 18, () => G.M.plasmam, { rad: 3 });
    LOGO.paused = G.makeLogo('PAUSED', 26, null, { rad: 3.5 });
    for (let i = 0; i < 5; i++) LOGO['epoch' + i] = G.makeLogo('EPOCH ' + ROMAN[i], 26, () => G.M.chrome, { rad: 3.5 });
    titleWorld = Stages.build(0, 0);
    bindInput(canvas);
    state = 'title'; stateT = 0;
    let acc = 0, last = performance.now();
    const STEP = 1000 / 60;
    function loop(now) {
      acc += Math.max(0, Math.min(100, now - last)); last = now;
      let n = 0;
      while (acc >= STEP && n < 4) { update(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      render();
      if (window.UI) UI.frame();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // =========================================================== SHOP API
  function slotAccepts(slot, id) { const s = ITEMS[id].slot; return s === 'wing' ? (slot === 'lwing' || slot === 'rwing') : s === slot; }
  const upgradeCost = cur => Math.round(ITEMS[cur.id].price * 0.75 * cur.lvl);
  function quote(slot, id) {
    const cur = equip[slot];
    if (cur && cur.id === id) return cur.lvl >= 3 ? { kind: 'max', cost: 0 } : { kind: 'upgrade', cost: upgradeCost(cur) };
    const trade = cur ? Math.floor(cur.paid * 0.5) : 0;
    return { kind: cur ? 'trade' : 'buy', cost: Math.max(0, ITEMS[id].price - trade), trade };
  }
  function shopBuy(slot, id) {
    const q = quote(slot, id), cur = equip[slot];
    if (q.kind === 'max') return 'max';
    if (P.credits < q.cost) { Music.sfx('error'); return 'poor'; }
    P.credits -= q.cost;
    if (q.kind === 'upgrade') { cur.lvl++; cur.paid += q.cost; }
    else equip[slot] = { id, lvl: 1, paid: ITEMS[id].price };
    P.shield = Math.min(P.shield, maxShield());
    Music.sfx('buy');
    return q.kind;
  }
  function shopSell(slot) {
    const cur = equip[slot]; if (!cur) return null;
    const v = Math.floor(cur.paid * 0.5); P.credits += v; equip[slot] = null; P.shield = Math.min(P.shield, maxShield());
    Music.sfx('sell'); return v;
  }
  function supplyState(k) {
    const price = SUPPLIES[k].price();
    let ok = P.credits >= price, why = '';
    if (k === 'repair' && P.shield >= maxShield()) { ok = false; why = 'FULL'; }
    if (k === 'speed' && P.speedLvl >= 3) { ok = false; why = 'MAX'; }
    if (k === 'bomb' && P.bombs >= 5) { ok = false; why = 'MAX'; }
    if (k === 'intel' && P.intel) { ok = false; why = 'OWNED'; }
    if (k === 'intel' && shopReason === 'end' && stageIdx >= 4) { ok = false; why = 'N/A'; }
    if (k === 'nashwan' && P.nashwan >= 1) { ok = false; why = 'OWNED'; }
    return { price, ok, why };
  }
  function buySupply(k) {
    const s = supplyState(k);
    if (!s.ok) { Music.sfx('error'); return s.why || 'poor'; }
    P.credits -= s.price;
    if (k === 'repair') P.shield = maxShield();
    if (k === 'speed') P.speedLvl++;
    if (k === 'bomb') P.bombs++;
    if (k === 'intel') P.intel = true;
    if (k === 'nashwan') P.nashwan++;
    Music.sfx(k === 'nashwan' ? 'powerup' : 'buy');
    return 'ok';
  }

  return {
    init, ITEMS, SUPPLIES, SLOTS, SLOT_NAMES, SYNERGIES, BOSSES, P, equip,
    slotAccepts, quote, shopBuy, shopSell, supplyState, buySupply, synergy, drawShipPreview, openShop, closeShop, startGame, loadStage,
    get state() { return state; }, get modal() { return modal; }, set modal(m) { modal = m; },
    get stageIdx() { return stageIdx; }, get world() { return world; }, get shopReason() { return shopReason; }, get boss() { return boss; },
    get frame() { return frame; }, get cam() { return cam; }, get paused() { return paused; }, set paused(v) { paused = v; }, maxShield, droneCount,
    togglePause() { if (!modal) paused = !paused; },
  };
})();
