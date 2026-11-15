/* BEAT TRIBE - the 16 levels (1 tutorial + 5 worlds x 3).
 * Every level was designed solution-first: the intended route is written in the
 * comment above each build() and is replayed by the recordings in solutions.js
 * (verified headlessly by `node tools/verify.js`).
 * Coordinates: x grows right, y grows down, the level is 160 px tall.
 * `melody` is the score painted on the ground: one scale degree per 16px block. */
(function (g) {
  'use strict';
  var BT = g.BT, sin = Math.sin;

  var L = [];

  // ====================================================================== TUTORIAL
  // Solution: the tribe is penned on a stone slab. Make anyone a DIGGER; everybody
  // drops through the shaft (40px, safe) and walks right to the exit.
  L.push({
    id: 'T', world: 0, name: 'JUST DIG THE BEAT', hint: 'PICK THE DIGGER, CLICK A LEMMING',
    num: 10, need: 50, rr: 50, time: 180, width: 640, startX: 0,
    skills: { digger: 3 },
    melody: [0, 1, 2, 3, 4, 3, 2, 1],
    build: function (b) {
      b.hill('a', 0, 640, function (x) { return 123 + 4 * sin(x / 37) + 2 * sin(x / 13); });
      b.fill('b', 64, 72, 296, 92);
      b.fill('b', 64, 46, 76, 72);
      b.fill('b', 284, 46, 296, 72);
      b.fill('b', 64, 92, 76, 126);
      b.hatch(128, 24);
      b.exit(548, 60);
    }
  });

  // ====================================================================== WORLD 1 - AMIGA CHIP GARDEN
  // 1-1 Solution: a 9px stone step blocks the basin. One BUILDER started ~20px before
  // the step lays a staircase over it. Everyone else bounces safely in the basin.
  L.push({
    id: '1-1', world: 1, name: 'STAIRWAY TO GROOVE', hint: 'BUILD A STAIRCASE OVER THE STEP',
    num: 20, need: 80, rr: 50, time: 240, width: 800, startX: 0,
    skills: { builder: 4 },
    melody: [0, 2, 4, 2, 3, 1, 2, 0, 0, 2, 4, 7, 6, 4, 3, 2],
    build: function (b) {
      b.hill('a', 0, 424, function (x) { return x > 330 ? 120 : 120 + 3 * sin((330 - x) / 29); });
      b.hill('a', 424, 800, function (x) { return x < 470 ? 111 : 111 - 4 * sin((x - 470) / 41); });
      b.fill('b', 424, 111, 440, 160);
      b.fill('b', 30, 84, 44, 124);
      b.hatch(140, 58);
      b.exit(712, 60);
    }
  });

  // 1-2 Solution: BASH through the stone pillar, BASH through the earth mound,
  // then BUILD over the last step. One pioneer can do all three.
  L.push({
    id: '1-2', world: 1, name: 'BASH STREET BEAT', hint: 'BASHERS TUNNEL STRAIGHT AHEAD',
    num: 30, need: 80, rr: 45, time: 300, width: 960, startX: 0,
    skills: { basher: 3, builder: 3 },
    melody: [0, 0, 2, 3, 4, 4, 3, 2, 0, 0, 2, 3, 6, 5, 4, 2],
    build: function (b) {
      b.hill('a', 0, 660, function (x) { return (x > 200 && x < 560) ? 124 : 124 + 2 * sin(x / 19); });
      b.hill('a', 660, 960, function (x) { return x < 700 ? 115 : 115 - 3 * sin((x - 700) / 37); });
      b.fill('b', 660, 115, 674, 160);
      b.fill('b', 250, 40, 310, 124);
      b.fill('b', 244, 34, 316, 42);
      b.ell('a', 495, 124, 26, 62);
      b.cut(440, 124, 560, 125);
      b.hill('a', 440, 560, 124);
      b.hatch(90, 62);
      b.exit(864, 60);
    }
  });

  // 1-3 Solution: lethal drops on both ends of the slab. Lemming 0 BLOCKS near the
  // right end, lemming 1 (bounced back) BLOCKS near the left end, a DIGGER opens a
  // shaft in the middle onto the mound below (50px, safe). NUKE the two blockers when the rest are home.
  L.push({
    id: '1-3', world: 1, name: 'TRIBE DIVIDED', hint: 'BLOCKERS HOLD THE LINE. NUKE WHEN DONE',
    num: 20, need: 85, rr: 50, time: 180, width: 800, startX: 200,
    skills: { blocker: 2, digger: 2, bomber: 2 },
    melody: [4, 3, 2, 0, 2, 3, 4, 7, 6, 4, 3, 2, 0, 2, 3, 2],
    build: function (b) {
      b.hill('a', 0, 304, 155);
      b.hill('a', 304, 800, function (x) { return x < 496 ? 130 : x < 510 ? 130 + (x - 496) * 1.4 : 150 + 2 * sin((x - 510) / 27); });
      b.fill('b', 300, 80, 520, 104);
      b.fill('b', 300, 104, 314, 132);
      b.water(0, 304, 146);
      b.hatch(410, 30);
      b.exit(724, 100);
    }
  });

  // ====================================================================== WORLD 2 - ACID WAREHOUSE
  // 2-1 Solution: the one-way wall (arrows point LEFT) cannot be bashed by the crowd.
  // Make one lemming a CLIMBER + FLOATER: it goes over the wall, floats down, bounces
  // off the crate (the low girder stops it climbing over) and comes back; BASH the wall
  // from the right. Then BASH the crate.
  L.push({
    id: '2-1', world: 2, name: 'WRONG WAY GIRDER', hint: 'ARROWS SHOW THE ONLY WAY TO BASH',
    num: 20, need: 80, rr: 50, time: 240, width: 800, startX: 0,
    skills: { climber: 2, floater: 2, basher: 2 },
    melody: [0, 0, 3, 0, 1, 0, 4, 3, 0, 0, 6, 4, 1, 0, 3, 2],
    build: function (b) {
      b.hill('a', 0, 800, 130);
      b.oneway(-1, 300, 40, 340, 130);
      b.steel(300, 34, 340, 40);
      b.fill('c', 420, 121, 429, 130);
      b.fill('a', 408, 0, 420, 117);          // low girder: a climber bumps its head and turns back
      b.fill('b', 560, 20, 800, 34);
      b.steel(0, 0, 60, 14);
      b.hatch(110, 66);
      b.exit(700, 100);
    }
  });

  // 2-2 Solution: MINE down through the catwalk before the fire pit (56px drop, safe),
  // then BASH through the rust heap on the factory floor. The Silence creeps in from
  // the right - walk through it together and it retreats.
  L.push({
    id: '2-2', world: 2, name: 'ACID DROP', hint: 'MINE DOWN BEFORE THE FLAMES',
    num: 30, need: 80, rr: 40, time: 300, width: 960, startX: 0,
    skills: { miner: 2, basher: 2 },
    melody: [0, 1, 0, 3, 4, 3, 1, 0, 0, 1, 0, 6, 5, 4, 3, 1],
    silence: { src: 'right', delay: 20, rate: 0.006 },
    build: function (b) {
      b.hill('b', 0, 960, 128);
      b.fill('a', 40, 58, 470, 72);
      b.steel(40, 18, 52, 58);
      b.fire(400, 30);
      b.ell('c', 600, 128, 24, 40);
      b.hill('b', 560, 640, 128);
      b.fill('a', 700, 30, 960, 44);
      b.hatch(110, 8);
      b.exit(860, 90);
    }
  });

  // 2-3 Solution: the crusher flattens anyone on the road. DIG ~16px before it, turn the
  // digger into a BASHER and tunnel underneath to the cliff face. Below: second arrival
  // BLOCKS, the pioneer BUILDS three times across the lava, then BOMB the blocker free.
  L.push({
    id: '2-3', world: 2, name: 'PRESSURE PLANT', hint: 'TUNNEL UNDER THE CRUSHER',
    num: 40, need: 75, rr: 50, time: 360, width: 1040, startX: 0,
    skills: { digger: 2, basher: 2, blocker: 2, builder: 5, bomber: 2 },
    melody: [0, 3, 1, 0, 4, 3, 6, 4, 0, 3, 1, 0, 2, 1, 0, 0],
    silence: { src: 'left', delay: 45, rate: 0.008 },
    build: function (b) {
      b.fill('b', 0, 84, 560, 140);
      b.steel(0, 140, 560, 160);
      b.hill('a', 560, 700, 128);
      b.hill('a', 760, 1040, 128);
      b.steel(696, 140, 764, 160);
      b.lava(700, 760, 136);
      b.fill('a', 380, 26, 462, 38);
      b.crusher(420, 38, 2, 0);
      b.hatch(90, 28);
      b.exit(950, 90);
    }
  });

  // ====================================================================== WORLD 3 - SYNTHWAVE SUNSET
  // 3-1 Solution: the cliff is lethal (90px). Start a MINER just past the steel core
  // (x 242..298) so the ramp leaves the cliff face low enough. Below, the exit is in
  // the basement: give a lemming a BOMBER so it explodes on the golden thin floor.
  L.push({
    id: '3-1', world: 3, name: 'NEON SKYLINE', hint: 'MINE PAST THE STEEL. BLAST THE GOLD FLOOR',
    num: 30, need: 80, rr: 50, time: 300, width: 960, startX: 0,
    skills: { miner: 2, bomber: 3, floater: 3 },
    melody: [0, 2, 4, 2, 3, 2, 0, 6, 0, 2, 4, 6, 4, 3, 2, 1],
    build: function (b) {
      b.hill('a', 0, 360, 40);
      b.steel(120, 56, 270, 160);
      b.hill('b', 360, 640, 130);
      b.fill('c', 640, 130, 700, 135);
      b.steel(700, 130, 900, 136);
      b.hill('b', 900, 960, 84);
      b.hill('b', 620, 900, 152);
      b.fill('b', 620, 135, 640, 152);
      b.cut(640, 136, 900, 152);
      b.hatch(60, 0);
      b.exit(860, 140);
    }
  });

  // 3-2 Solution: the Silence pours in from the left and would swallow the hatch.
  // Lemming 0 walks left first: make it a BLOCKER - its drone is a sound barrier.
  // Then BASH two walls and BUILD over the last step. NUKE to release the blocker.
  // (Alternative: crank the release rate to 99 and literally outrun it.)
  L.push({
    id: '3-2', world: 3, name: 'OUTRUN THE SILENCE', hint: 'A BLOCKER\'S DRONE HOLDS THE SILENCE BACK',
    num: 40, need: 95, rr: 50, time: 330, width: 1280, startX: 0,
    skills: { blocker: 2, basher: 3, builder: 3 },
    melody: [0, 4, 2, 4, 3, 4, 2, 0, 0, 4, 6, 4, 5, 4, 2, 1],
    silence: { src: 'left', delay: 8, rate: 0.02 },
    build: function (b) {
      b.hill('a', 0, 1040, 120);
      b.hill('a', 1040, 1280, 111);
      b.fill('b', 1040, 111, 1056, 160);
      b.fill('b', 420, 78, 450, 120);
      b.fill('c', 760, 70, 800, 120);
      b.hatch(100, 56, -1);
      b.exit(1200, 60);
    }
  });

  // 3-3 Solution: the tribe is locked in a steel pit. Send one CLIMBER out alone: it
  // BUILDS twice across the lava and once over the far step. Meanwhile BUILD twice
  // inside the pit (start 30-45px before the wall) to let everybody else out.
  L.push({
    id: '3-3', world: 3, name: 'CHROME CANYON', hint: 'ONE PIONEER PREPARES THE ROAD',
    num: 40, need: 90, rr: 60, time: 300, width: 1120, startX: 0,
    skills: { climber: 1, builder: 6 },
    melody: [0, 2, 3, 4, 6, 4, 3, 2, 0, 2, 3, 4, 7, 6, 4, 3],
    silence: { src: 'right', delay: 30, rate: 0.008 },
    build: function (b) {
      b.steel(40, 130, 316, 160);
      b.steel(40, 84, 56, 130);
      b.steel(300, 110, 316, 130);
      b.hill('a', 316, 520, 130);
      b.hill('a', 556, 840, 108);               // far bank is higher: the bridge lands flush on it
      b.hill('a', 840, 1120, 99);
      b.fill('b', 840, 99, 856, 160);
      b.steel(516, 144, 560, 160);
      b.lava(520, 556, 138);
      b.hatch(120, 68);
      b.exit(1010, 60);
    }
  });

  // ====================================================================== WORLD 4 - JUNGLE BREAKBEAT CAVES
  // 4-1 Solution: the grotto pit is 30px deep. A CLIMBER gets out, bounces off the rock
  // column and comes back; make it a MINER ~50-75px before the pit edge so its tunnel
  // becomes a ramp out of the pit. The crowd follows; BASH the column.
  L.push({
    id: '4-1', world: 4, name: 'SUB-BASS GROTTO', hint: 'MINE A RAMP BACK INTO THE PIT',
    num: 30, need: 90, rr: 55, time: 300, width: 960, startX: 0,
    skills: { climber: 1, miner: 1, basher: 1, builder: 2 },
    melody: [0, 0, 2, 0, 3, 2, 0, 4, 0, 0, 2, 3, 4, 3, 2, 1],
    build: function (b) {
      b.hill('a', 0, 44, 0);
      b.fill('a', 44, 96, 52, 112);             // lip: keeps the climber from scaling the back wall
      b.steel(40, 134, 400, 160);
      b.hill('a', 400, 960, 104, 150);
      b.steel(400, 150, 960, 160);
      b.hill('b', 560, 600, 0, 104);
      b.fill('b', 546, 56, 560, 90);            // rock lip: the climber bumps its head and turns back
      b.hill('a', 44, 560, 0, function (x) { return 14 + 6 * sin(x / 21) + 4 * sin(x / 7); });
      b.hill('a', 600, 960, 0, function (x) { return 16 + 7 * sin(x / 17) + 3 * sin(x / 5); });
      b.hatch(150, 68);
      b.exit(870, 60);
    }
  });

  // 4-2 Solution: a 90px cliff. One CLIMBER + FLOATER leaves the pen, floats down,
  // bounces off the stalagmite and walks back towards the cliff: BUILD three times
  // (start 60-72px from the cliff) so the stairs touch the wall. BASH the pen open -
  // everyone lands on the stairs. BASH the stalagmite.
  L.push({
    id: '4-2', world: 4, name: 'AMEN CAVERN', hint: 'STAIRS CAN CATCH A FALL',
    num: 40, need: 85, rr: 50, time: 360, width: 1040, startX: 0,
    skills: { climber: 1, floater: 1, builder: 4, basher: 2 },
    melody: [0, 2, 3, 2, 0, 4, 3, 2, 0, 2, 3, 4, 5, 4, 3, 2],
    silence: { src: [700], delay: 30, rate: 0.008 },
    build: function (b) {
      b.hill('a', 0, 380, 50);
      b.hill('a', 380, 1040, 140);
      b.fill('b', 300, 20, 320, 50);
      b.fill('b', 520, 129, 530, 140);
      b.hill('b', 508, 520, 0, 128);           // stalactite above it: even a climber must turn back
      b.hill('a', 600, 1040, 0, function (x) { return 12 + 6 * sin(x / 19) + 4 * sin(x / 6); });
      b.hatch(120, 0);
      b.exit(900, 100);
    }
  });

  // 4-3 Solution: no tools, only bombs. A BLOCKER stands still - park one right against
  // the rock and give it a BOMBER. Three blasts open the first wall, two the second.
  L.push({
    id: '4-3', world: 4, name: 'RINSE OUT', hint: 'A BLOCKER HOLDS A BOMB IN PLACE',
    num: 40, need: 80, rr: 60, time: 300, width: 800, startX: 0,
    skills: { blocker: 6, bomber: 6 },
    melody: [0, 3, 2, 0, 4, 3, 2, 0, 0, 3, 2, 4, 5, 4, 2, 1],
    build: function (b) {
      b.hill('a', 0, 800, 124);
      b.hill('b', 300, 318, 0, 124);
      b.hill('b', 520, 532, 0, 124);
      b.hill('a', 0, 300, 0, function (x) { return 12 + 5 * sin(x / 15) + 3 * sin(x / 4); });
      b.hill('a', 318, 520, 0, function (x) { return 14 + 6 * sin(x / 13); });
      b.hill('a', 532, 800, 0, function (x) { return 12 + 5 * sin(x / 18) + 3 * sin(x / 5); });
      b.hatch(120, 56);
      b.exit(700, 80);
    }
  });

  // ====================================================================== WORLD 5 - GRAND ORCHESTRAL FINALE
  // 5-1 Solution: do NOT open the first pillar yet. A CLIMBER goes over it alone,
  // BUILDS twice across the lava and climbs on. Then BASH pillar one to release the
  // tribe, and BASH pillar two when the first of them arrives.
  L.push({
    id: '5-1', world: 5, name: 'OVERTURE', hint: 'BRIDGE FIRST, THEN OPEN THE PILLAR',
    num: 50, need: 90, rr: 55, time: 360, width: 1120, startX: 0,
    skills: { climber: 1, builder: 3, basher: 2 },
    melody: [0, 2, 4, 3, 4, 6, 4, 2, 0, 2, 4, 7, 6, 4, 3, 1],
    silence: { src: 'right', delay: 30, rate: 0.007 },
    build: function (b) {
      b.hill('a', 0, 540, 128);
      b.hill('a', 576, 1120, 106);              // far bank is higher: the bridge lands flush on it
      b.steel(536, 144, 580, 160);
      b.lava(540, 576, 136);
      b.fill('b', 280, 80, 304, 128);
      b.fill('c', 280, 74, 304, 80);
      b.fill('b', 760, 58, 784, 106);
      b.fill('c', 760, 52, 784, 58);
      b.hatch(110, 66);
      b.exit(1010, 90);
    }
  });

  // 5-2 Solution: MINE just past the steel core to leave the balcony safely. On the
  // stage the crusher blocks the road: DIG until you hit steel, then BASH under it and
  // out of the stage front. Finally BUILD twice (20-48px before it) up to the exit loge.
  L.push({
    id: '5-2', world: 5, name: 'CRESCENDO', hint: 'DOWN, UNDER, AND UP AGAIN',
    num: 50, need: 90, rr: 60, time: 420, width: 1040, startX: 0,
    skills: { miner: 2, digger: 2, basher: 2, builder: 4 },
    melody: [0, 4, 2, 4, 3, 6, 4, 2, 0, 4, 2, 6, 7, 6, 4, 3],
    silence: { src: 'right', delay: 40, rate: 0.008 },
    build: function (b) {
      b.hill('a', 0, 300, 44);
      b.steel(100, 62, 190, 160);
      b.hill('a', 300, 560, 120, 140);
      b.steel(300, 140, 560, 160);
      b.hill('a', 560, 820, 148);
      b.hill('a', 820, 1040, 128);
      b.fill('b', 820, 128, 836, 160);
      b.fill('c', 400, 60, 480, 72);
      b.crusher(440, 72, 2, 0);
      b.hatch(70, 0);
      b.exit(950, 90);
    }
  });

  // 5-3 Solution (all eight skills): BLOCKERS at both ends of the tower, a MINER ramps
  // down through it. One CLIMBER + FLOATER crosses the tall pillar, BUILDS twice over
  // the lava, DIGS to the steel and BASHES under the crusher, then BLOCKS against the
  // last thin wall and gets a BOMBER. Meanwhile BASH the pillar to release the tribe.
  L.push({
    id: '5-3', world: 5, name: 'ODE TO LEMMINGS', hint: 'THE FINALE: EVERY SKILL, EVERY VOICE',
    num: 60, need: 85, rr: 60, time: 480, width: 1280, startX: 0,
    skills: { climber: 1, floater: 1, bomber: 2, blocker: 3, builder: 3, basher: 2, miner: 1, digger: 1 },
    melody: [0, 2, 4, 6, 4, 2, 3, 1, 0, 2, 4, 7, 6, 4, 2, 1],
    silence: { src: 'left', delay: 60, rate: 0.006 },
    build: function (b) {
      b.hill('a', 60, 260, 40);
      b.hill('a', 0, 60, 150);
      b.lava(0, 60, 142);
      b.hill('a', 260, 600, 130);
      b.hill('a', 636, 900, 130, 156);
      b.steel(596, 144, 640, 160);
      b.lava(600, 636, 138);
      b.steel(636, 156, 1280, 160);
      b.fill('b', 440, 58, 464, 130);
      b.fill('c', 440, 52, 464, 58);
      b.fill('c', 740, 62, 820, 74);
      b.crusher(780, 74, 2, 0);
      b.hill('b', 1000, 1007, 60, 156);
      b.fill('c', 1000, 54, 1007, 60);
      b.hatch(160, 0);
      b.exit(1110, 120);
    }
  });

  L.forEach(function (lv, i) { lv.index = i; });
  BT.LEVELS = L;
})(typeof window !== 'undefined' ? window : globalThis);
