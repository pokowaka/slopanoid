/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — levels.js
 * 16 levels: 1 tutorial + 5 genre worlds x 3. Every level was designed
 * around its intended solution first (see `solution`, a conditional
 * trigger script compiled into frame-exact recordings by
 * tools/compile-demos.js and verified by tools/verify.js).
 *
 * Solution trigger fields:
 *   lem   : lemming index (spawn order) to receive the skill (or '$tag')
 *   on    : lemming index whose state is tested (defaults to lem)
 *   pick  : true -> first lemming matching the conditions; `tag` names it
 *   x/xmin/xmax/y/ymax/dir/st : conditions ; frame/after : timing
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const L = [];

  /* ---------------------------------------------------------------- */
  L.push({
    id: 'T', name: 'LET\'S GO!', world: 0, code: 'TRIBE', width: 480,
    count: 10, save: 5, rr: 50, time: 180, seed: 11,
    skills: { basher: 3, digger: 2 },
    entrance: { x: 56, y: 72 }, exit: { x: 410, y: 124 },
    notes: [0, 1, 2, 3, 4, 3, 2, 1],
    hint: 'A WALL BLOCKS THE SONG. SELECT THE BASHER (6) AND CLICK A LEMMING NEAR THE WALL.',
    build(p) {
      p.slab(0, 124, 480, 36, 0);
      p.ground(0, 480, (x) => 124 + Math.round(Math.sin(x / 23) * 1.5), null, 160);
      p.rect(392, 124, 40, 4);
      p.slab(234, 72, 36, 54, 6, null, 5);
      p.ellipse(252, 72, 18, 8);
      p.rect(0, 60, 8, 64, { mat: BT.MAT.STEEL });
    },
    solution: [{ lem: 0, skill: 'basher', x: 226 }],
  });

  /* ---------------------------------------------------------------- */
  L.push({
    id: '1-1', name: 'STAIRWAY GROOVE', world: 0, code: 'PAULA', width: 560,
    count: 20, save: 16, rr: 50, time: 240, seed: 21,
    skills: { builder: 3, basher: 0 },
    entrance: { x: 80, y: 70 }, exit: { x: 480, y: 128 },
    notes: [0, 2, 4, 2, 1, 3, 0, 4, 2, 3],
    hint: 'THE TRIBE IS PENNED IN. BUILD A STAIRCASE OVER THE EAST WALL - ONE NOTE PER BRICK!',
    build(p) {
      p.ground(0, 560, (x) => 128 + Math.round(Math.sin(x / 31) * 1), null, 160);
      p.rect(0, 128, 560, 32);
      p.rect(250, 112, 14, 16);
      p.ellipse(257, 112, 7, 3);
      p.slab(0, 20, 14, 108, 4, null, 3);
      // decorative floating stones
      p.ellipse(150, 40, 20, 6); p.ellipse(380, 50, 26, 7);
    },
    solution: [{ lem: 0, skill: 'builder', x: 222, dir: 1 }],
  });

  /* ---------------------------------------------------------------- */
  L.push({
    id: '1-2', name: 'DIG THE BEAT', world: 0, code: 'AGNUS', width: 560,
    count: 20, save: 16, rr: 50, time: 240, seed: 31,
    skills: { digger: 2, basher: 1, builder: 1 },
    entrance: { x: 50, y: 50 }, exit: { x: 470, y: 150 },
    notes: [4, 3, 2, 0, 1, 2, 4, 3, 1, 0],
    hint: 'THE EXIT HIDES IN A CAVE BELOW. DIG (8) DOWN - BUT STEEL CANNOT BE DUG.',
    build(p) {
      p.ground(0, 560, (x) => 92 + Math.round(Math.sin(x / 40) * 1), null, 160);
      p.steel(96, 92, 72, 6);
      // the cave
      p.erase(200, 118, 330, 32);
      p.eraseEllipse(360, 118, 150, 12);
      p.eraseEllipse(215, 134, 20, 16);
      p.rect(200, 150, 340, 10);
      p.rect(440, 150, 60, 2);
      p.erase(440, 150, 60, 0);
    },
    solution: [{ lem: 0, skill: 'digger', x: 250 }],
  });

  /* ---------------------------------------------------------------- */
  L.push({
    id: '1-3', name: 'MINING MELODIES', world: 0, code: 'DENIS', width: 640,
    count: 20, save: 16, rr: 50, time: 300, seed: 41,
    skills: { miner: 2, digger: 2, basher: 1 },
    entrance: { x: 50, y: 22 }, exit: { x: 585, y: 106 },
    notes: [0, 1, 2, 3, 4, 2, 3, 1],
    hint: 'A STEEL ROOF GUARDS THE LOWER HALL. MINE (7) DIAGONALLY UNDER IT.',
    build(p) {
      p.ground(0, 640, (x) => 64 + Math.round(Math.sin(x / 27) * 1), null, 160);
      p.erase(300, 82, 330, 24);
      p.eraseEllipse(470, 84, 150, 4);
      p.steel(308, 66, 327, 8);
      // water channel in the deep
      p.erase(120, 132, 140, 20);
    },
    objects: [{ type: 'water', x: 120, y: 140, w: 140, h: 12 }],
    solution: [{ lem: 0, skill: 'miner', x: 236 }],
  });

  /* ================= WORLD 2 : ACID WAREHOUSE ================= */
  const girders = (p, w) => {
    p.steel(0, 0, w, 4);
    for (let x = 30; x < w; x += 96) { p.steel(x, 4, 4, 22); p.steel(x - 10, 22, 24, 3); }
  };
  L.push({
    id: '2-1', name: 'BLOCKER\'S BASSLINE', world: 1, code: 'ACIDS', width: 640,
    count: 20, save: 16, rr: 50, time: 300, seed: 51,
    skills: { blocker: 2, builder: 4, bomber: 2, basher: 1 },
    entrance: { x: 60, y: 70 }, exit: { x: 560, y: 100 },
    hint: 'HOLD THE TRIBE WITH A BLOCKER (4) WHILE TWO STAIRCASES CROSS THE ACID BATH. THEN BOMB (3) THE BLOCKER.',
    build(p) {
      girders(p, 640);
      p.rect(0, 120, 300, 40);
      p.rect(346, 100, 294, 60);
      p.steel(292, 120, 8, 40);
      p.steel(346, 100, 6, 60);
    },
    objects: [{ type: 'water', x: 300, y: 140, w: 46, h: 20, acid: true }],
    solution: [
      { lem: 0, skill: 'builder', x: 296 },
      { lem: 1, skill: 'blocker', xmin: 262, xmax: 286, dir: 1, st: 'WALK' },
      { lem: 0, skill: 'builder', st: 'SHRUG' },
      { lem: 1, skill: 'bomber', on: 0, st: 'BUILD', xmin: 332 },
    ],
  });

  L.push({
    id: '2-2', name: 'SQUELCH CRUSHER', world: 1, code: 'SQUEL', width: 720,
    count: 20, save: 16, rr: 50, time: 300, seed: 61,
    skills: { miner: 2, basher: 2, digger: 2, blocker: 1 },
    entrance: { x: 60, y: 50 }, exit: { x: 650, y: 136 },
    hint: 'CRUSHERS GUARD THE DECK. MINE BELOW THEM, THEN BASH THE ONE-WAY WALL IN THE DIRECTION OF ITS ARROWS.',
    build(p) {
      girders(p, 720);
      p.rect(0, 100, 720, 60);
      p.erase(320, 112, 380, 24);
      p.steel(318, 103, 392, 6);
      p.oneway(450, 112, 12, 24, 1);
    },
    objects: [{ type: 'crusher', x: 340, y: 100 }, { type: 'crusher', x: 400, y: 100 }, { type: 'crusher', x: 520, y: 100 }],
    solution: [
      { lem: 0, skill: 'miner', x: 268 },
      { lem: 0, skill: 'basher', x: 440, dir: 1 },
    ],
  });

  L.push({
    id: '2-3', name: 'DETONATION STATION', world: 1, code: 'SLIDE', width: 640,
    count: 20, save: 17, rr: 50, time: 300, seed: 71,
    skills: { blocker: 2, bomber: 3, basher: 1 },
    entrance: { x: 60, y: 56 }, exit: { x: 572, y: 150 },
    hint: 'THE STEEL DECK HAS ONE THIN PATCH. A BLOCKER ON IT + A BOMB DROPS THE TRIBE TO THE LOWER LINE. THE WALL IS A TRAP!',
    build(p) {
      girders(p, 640);
      p.steel(0, 110, 520, 6);
      p.erase(180, 110, 40, 6);
      p.rect(180, 110, 40, 3);
      p.rect(400, 56, 6, 54);
      p.steel(520, 30, 10, 86);
      p.rect(0, 150, 640, 10);
    },
    objects: [{ type: 'fire', x: 440, y: 96, w: 40, h: 14 }],
    solution: [
      { lem: 0, skill: 'blocker', x: 200 },
      { lem: 0, skill: 'bomber', after: 0 },
    ],
  });

  /* ================= WORLD 3 : SYNTHWAVE SUNSET ================= */
  L.push({
    id: '3-1', name: 'HUSH HOUR', world: 2, code: 'NEONS', width: 600,
    count: 20, save: 14, rr: 50, time: 300, seed: 81, shear: true,
    skills: { builder: 2, blocker: 2, bomber: 2 },
    entrance: { x: 60, y: 68 }, exit: { x: 540, y: 126 },
    hint: 'THE SILENCE DEVOURS THE BEAT. A BLOCKER\'S DRONE AND A BUILDER\'S ARPEGGIO PUSH IT BACK.',
    build(p) {
      p.rect(0, 126, 600, 34);
      p.erase(400, 126, 20, 34);
      p.steel(396, 126, 4, 34); p.steel(420, 118, 4, 42);
    },
    objects: [{ type: 'lava', x: 400, y: 146, w: 20, h: 14 }],
    silence: { x0: 240, x1: 599, start: [[400, 540]], seeds: [[460, 520]], creep: 0.04 },
    solution: [
      { pick: true, skill: 'builder', x: 394, dir: 1, tag: 'b' },
      { pick: true, skill: 'blocker', xmin: 340, xmax: 390, dir: 1, notTag: ['b'], tag: 'k' },
      { lem: '$k', skill: 'bomber', on: '$b', st: 'SHRUG' },
    ],
  });

  L.push({
    id: '3-2', name: 'SUNSET DIVE', world: 2, code: 'DRIVE', width: 640,
    count: 20, save: 15, rr: 50, time: 300, seed: 91,
    skills: { floater: 10, miner: 1, builder: 1 },
    entrance: { x: 50, y: 4 }, exit: { x: 470, y: 150 },
    hint: 'A DEADLY DROP TO THE VALLEY. FLOATERS (2) FOR ALL... OR ONE CLEVER MINER STARTED EARLY ENOUGH.',
    build(p) {
      p.ground(0, 244, (x) => 40 + Math.round(Math.sin(x / 19)), null, 160);
      p.rect(244, 150, 396, 10);
      p.erase(560, 150, 40, 10);
      p.steel(556, 150, 4, 10); p.steel(600, 150, 4, 10);
    },
    objects: [{ type: 'lava', x: 560, y: 152, w: 40, h: 8 }],
    silence: { x0: 300, x1: 639, start: [[380, 600]], seeds: [[540, 600]], creep: 0.04 },
    solution: [{ lem: 0, skill: 'miner', x: 100 }],
  });

  L.push({
    id: '3-3', name: 'OUTRUN THE QUIET', world: 2, code: 'OUTRN', width: 820,
    count: 20, save: 14, rr: 50, time: 360, seed: 101, shear: true,
    skills: { builder: 3, blocker: 1, bomber: 1, miner: 1, basher: 1 },
    entrance: { x: 60, y: 62 }, exit: { x: 740, y: 150 },
    hint: 'STAIRS OVER THE ONE-WAY WALL, A BRIDGE THROUGH THE SILENCE, THEN MINE UNDER THE STEEL GATE.',
    build(p) {
      p.rect(0, 120, 820, 40);
      p.oneway(200, 102, 12, 18, -1);
      p.erase(400, 120, 20, 40);
      p.steel(396, 124, 4, 36); p.steel(420, 112, 4, 48);
      p.steel(600, 30, 12, 95);
      p.erase(614, 128, 186, 22);
    },
    objects: [{ type: 'lava', x: 400, y: 146, w: 20, h: 14 }],
    silence: { x0: 280, x1: 580, start: [[400, 500]], seeds: [[440, 480]], creep: 0.04 },
    solution: [
      { lem: 0, skill: 'builder', x: 172 },
      { pick: true, skill: 'builder', x: 394, dir: 1, tag: 'b' },
      { pick: true, skill: 'blocker', xmin: 330, xmax: 390, dir: 1, notTag: ['b'], tag: 'k' },
      { lem: '$k', skill: 'bomber', on: '$b', st: 'SHRUG' },
      { lem: '$b', skill: 'miner', x: 560 },
    ],
  });

  /* ================= WORLD 4 : JUNGLE BREAKBEAT CAVES ================= */
  const cave = (p, w, seed) => {
    p.slab(0, 0, w, 16, 10, null, seed);
    for (let x = 20; x < w; x += 37 + ((x * 7) % 23)) p.poly([[x - 6, 12], [x + 6, 12], [x + ((x * 3) % 5) - 2, 26 + ((x * 11) % 14)]]);
  };
  L.push({
    id: '4-1', name: 'AMEN CAVERN', world: 3, code: 'AMENS', width: 640,
    count: 20, save: 16, rr: 50, time: 300, seed: 111,
    skills: { basher: 2, digger: 2, builder: 1 },
    entrance: { x: 60, y: 50 }, exit: { x: 540, y: 150 },
    hint: 'BASH THE STALAGMITE, THEN DIG DOWN BEFORE THE UNDERGROUND LAKE.',
    build(p) {
      cave(p, 640, 7);
      p.rect(0, 100, 640, 60);
      p.erase(400, 100, 240, 24);
      p.erase(300, 128, 320, 22);
      p.slab(220, 20, 40, 82, 8, null, 4);
    },
    objects: [{ type: 'water', x: 400, y: 104, w: 240, h: 20 }],
    solution: [
      { lem: 0, skill: 'basher', x: 208 },
      { lem: 0, skill: 'digger', x: 340 },
    ],
  });

  L.push({
    id: '4-2', name: 'REESE BASS', world: 3, code: 'REESE', width: 720,
    count: 20, save: 16, rr: 50, time: 330, seed: 121,
    skills: { builder: 3, blocker: 1, bomber: 1, digger: 2 },
    entrance: { x: 60, y: 60 }, exit: { x: 640, y: 150 },
    hint: 'BRIDGE THE MAGMA WITH TWO STAIRCASES, THEN DIG DOWN BEFORE THE CRUSHERS.',
    build(p) {
      cave(p, 720, 9);
      p.rect(0, 110, 260, 50);
      p.rect(300, 110, 420, 18);
      p.rect(300, 150, 420, 10);
      p.rect(300, 128, 10, 22);
    },
    objects: [
      { type: 'lava', x: 260, y: 140, w: 40, h: 20 },
      { type: 'crusher', x: 430, y: 110 }, { type: 'crusher', x: 520, y: 110 },
    ],
    solution: [
      { lem: 0, skill: 'builder', x: 256 },
      { lem: 1, skill: 'blocker', xmin: 224, xmax: 236, dir: 1, st: 'WALK' },
      { lem: 0, skill: 'builder', st: 'SHRUG' },
      { lem: 1, skill: 'bomber', on: 0, st: 'BUILD', xmin: 294 },
      { lem: 0, skill: 'digger', x: 360 },
    ],
  });

  L.push({
    id: '4-3', name: 'RINSE AND REPEAT', world: 3, code: 'RINSE', width: 760,
    count: 20, save: 15, rr: 50, time: 360, seed: 131,
    skills: { climber: 3, blocker: 1, basher: 1, bomber: 1, builder: 1 },
    entrance: { x: 80, y: 72 }, exit: { x: 640, y: 130 },
    hint: 'THE PILLAR\'S BASE ONLY BREAKS RIGHT-TO-LEFT. TWO CLIMBERS: ONE BLOCKS, ONE BASHES BACK.',
    build(p) {
      cave(p, 760, 13);
      p.rect(0, 130, 760, 30);
      p.rect(300, 72, 30, 34);
      p.oneway(300, 106, 30, 24, -1);
    },
    silence: { x0: 400, x1: 759, start: [[440, 700]], seeds: [[600, 680]], creep: 0.04 },
    solution: [
      { lem: 0, skill: 'climber', st: 'WALK' },
      { lem: 1, skill: 'climber', st: 'WALK' },
      { lem: 0, skill: 'blocker', xmin: 356, xmax: 372, dir: 1, st: 'WALK' },
      { lem: 1, skill: 'basher', x: 334, dir: -1 },
      { lem: 0, skill: 'bomber', on: 1, st: 'BASH', xmax: 304 },
    ],
  });

  /* ================= WORLD 5 : GRAND ORCHESTRAL FINALE ================= */
  const hall = (p, w) => {
    p.rect(0, 0, w, 6);
    for (let x = 0; x < w; x += 64) p.poly([[x, 6], [x + 64, 6], [x + 32, 16]], null, true);
  };
  L.push({
    id: '5-1', name: 'OVERTURE', world: 4, code: 'TUTTI', width: 560,
    count: 14, save: 10, rr: 40, time: 300, seed: 141,
    skills: { floater: 14, builder: 2, blocker: 1, bomber: 1, digger: 1 },
    entrance: { x: 40, y: 10 }, exit: { x: 470, y: 150 },
    hint: 'FIRE BELOW THE BALCONY. BUILD OUT FROM THE EDGE, HOLD THE ORCHESTRA, THEN FLOAT THEM DOWN.',
    build(p) {
      hall(p, 560);
      p.rect(0, 50, 262, 14);
      p.rect(40, 64, 10, 86); p.rect(140, 64, 10, 86);
      p.rect(0, 150, 560, 10);
    },
    objects: [{ type: 'fire', x: 150, y: 138, w: 126, h: 12 }],
    solution: [
      { lem: 0, skill: 'floater', st: 'ANY' },
      { lem: 0, skill: 'builder', x: 256 },
      { lem: 1, skill: 'blocker', xmin: 228, xmax: 240, dir: 1, st: 'WALK' },
      { lem: 1, skill: 'bomber', on: 0, st: 'SHRUG' },
      { lem: 2, skill: 'floater', st: 'ANY' }, { lem: 3, skill: 'floater', st: 'ANY' },
      { lem: 4, skill: 'floater', st: 'ANY' }, { lem: 5, skill: 'floater', st: 'ANY' },
      { lem: 6, skill: 'floater', st: 'ANY' }, { lem: 7, skill: 'floater', st: 'ANY' },
      { lem: 8, skill: 'floater', st: 'ANY' }, { lem: 9, skill: 'floater', st: 'ANY' },
      { lem: 10, skill: 'floater', st: 'ANY' }, { lem: 11, skill: 'floater', st: 'ANY' },
      { lem: 12, skill: 'floater', st: 'ANY' },
    ],
  });

  L.push({
    id: '5-2', name: 'FORTISSIMO', world: 4, code: 'FORTE', width: 900,
    count: 30, save: 24, rr: 50, time: 420, seed: 151,
    skills: { basher: 3, miner: 2, builder: 2, blocker: 1, bomber: 1, digger: 1 },
    entrance: { x: 60, y: 60 }, exit: { x: 840, y: 150 },
    hint: 'A FOUR-MOVEMENT SYMPHONY: BASH, MINE UNDER STEEL, BASH THE ONE-WAY, BRIDGE THE FOUNTAIN.',
    build(p) {
      hall(p, 900);
      p.rect(0, 110, 472, 50);
      p.slab(240, 16, 40, 96, 6, null, 3);
      p.steel(460, 16, 10, 103);
      p.rect(472, 110, 428, 16);
      p.rect(472, 150, 428, 10);
      p.oneway(560, 126, 10, 24, 1);
      p.erase(700, 150, 22, 10);
    },
    objects: [{ type: 'water', x: 700, y: 152, w: 22, h: 8 }],
    solution: [
      { lem: 0, skill: 'basher', x: 232 },
      { lem: 0, skill: 'miner', x: 420 },
      { lem: 0, skill: 'basher', x: 550, dir: 1 },
      { lem: 0, skill: 'builder', x: 696 },
    ],
  });

  L.push({
    id: '5-3', name: 'CODA', world: 4, code: 'CODAS', width: 1000,
    count: 40, save: 30, rr: 55, time: 480, seed: 161, shear: true,
    skills: { climber: 2, floater: 2, bomber: 2, blocker: 2, builder: 3, basher: 3, miner: 2, digger: 2 },
    entrances: [{ x: 50, y: 64 }, { x: 140, y: 64 }], exit: { x: 900, y: 150 },
    hint: 'THE FINALE: BRIDGE THE FIRE, BASH THROUGH THE SILENCE, DIG BEFORE THE CRUSHER, THEN BASH THE LAST ONE-WAY GATE.',
    build(p) {
      hall(p, 1000);
      p.rect(0, 120, 220, 40);
      p.rect(220, 136, 20, 24);
      p.steel(240, 112, 4, 8);
      p.rect(240, 120, 760, 16);
      p.slab(440, 16, 30, 106, 6, null, 8);
      p.rect(240, 150, 760, 10);
      p.steel(760, 16, 12, 120);
      p.oneway(800, 136, 8, 14, 1);
    },
    objects: [
      { type: 'fire', x: 220, y: 124, w: 20, h: 12 },
      { type: 'crusher', x: 600, y: 120 },
      { type: 'water', x: 240, y: 142, w: 40, h: 8 },
    ],
    silence: { x0: 250, x1: 999, start: [[360, 440], [910, 990]], seeds: [[380, 420], [940, 990]], creep: 0.045 },
    solution: [
      { pick: true, skill: 'builder', x: 214, dir: 1, tag: 'b' },
      { pick: true, skill: 'blocker', xmin: 170, xmax: 210, dir: 1, notTag: ['b'], tag: 'k' },
      { lem: '$k', skill: 'bomber', on: '$b', st: 'SHRUG' },
      { lem: '$b', skill: 'basher', x: 432 },
      { lem: '$b', skill: 'digger', x: 560 },
      { lem: '$b', skill: 'basher', x: 792, dir: 1 },
    ],
  });

  BT.LEVELS = L;
  BT.levelIndexById = (id) => L.findIndex((l) => l.id === id);
})(typeof window !== 'undefined' ? window : globalThis);
