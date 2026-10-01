/* =====================================================================
   Lemmings: Beat Tribe — level data (levels.js)
   16 levels: 1 tutorial + 5 worlds x 3. Each level is designed around a
   known intended solution (see bake.js plans / solutions.js recordings).
   Terrain ops: ['rect',x,y,w,h(,type)] ['ellipse',cx,cy,rx,ry(,type)]
                ['ramp',x0,y0,x1,y1,bottom(,type)] ['erase',x,y,w,h]
                ['steel',x,y,w,h] ['owr',x,y,w,h] ['owl',x,y,w,h]
   type -1/omitted = melodic auto-colour (scale degree by x block).
   Coordinates: y grows downward, level is 160px tall; lemming y = foot row.
   ===================================================================== */
(function (root) {
  'use strict';
  var LEVELS = [
    /* ---------------- TUTORIAL ---------------- */
    { name: 'WALK THE SCORE', world: 0, width: 320, code: 'BEATONE1',
      hint: 'Every footstep plays the ground. Just let the tribe walk to the exit and listen.',
      entrance: { x: 40, y: 60 }, exit: { x: 280, y: 120 },
      lemmings: 10, need: 50, rate: 50, time: 3,
      skills: { digger: 1, builder: 1 },
      terrain: [['rect', 0, 120, 320, 40], ['ellipse', 60, 124, 30, 10], ['rect', 120, 114, 24, 6], ['rect', 200, 116, 20, 4]] },

    /* ---------------- WORLD 1: AMIGA CHIP GARDEN ---------------- */
    { name: 'DIG DEEP', world: 0, width: 400, code: 'CHIPDIG2',
      hint: 'The drop at the end of the shelf is fatal. Dig through the shelf onto the mound below.',
      entrance: { x: 40, y: 20 }, exit: { x: 360, y: 150 },
      lemmings: 10, need: 60, rate: 50, time: 4,
      skills: { digger: 2 },
      terrain: [['rect', 0, 50, 220, 30], ['rect', 0, 108, 150, 52], ['rect', 0, 150, 400, 10], ['ellipse', 300, 154, 40, 8]] },

    { name: 'BRIDGE THE BEAT', world: 0, width: 480, code: 'ARPEGGIO',
      hint: 'Builders arpeggiate. Hold the crowd with a Blocker drone, bridge the water, then free them.',
      entrance: { x: 40, y: 70 }, exit: { x: 430, y: 120 },
      lemmings: 10, need: 60, rate: 50, time: 5,
      skills: { builder: 3, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 120, 200, 40], ['rect', 240, 120, 240, 40], ['ellipse', 120, 126, 40, 10], ['ellipse', 380, 124, 50, 8]],
      hazards: [{ type: 'water', x: 196, y: 140, w: 48, h: 20 }] },

    { name: 'BASH AND MINE', world: 0, width: 480, code: 'BASSWEEP',
      hint: 'Bash the wall for a bass sweep, then mine a diagonal down the cliff before the fatal drop.',
      entrance: { x: 40, y: 30 }, exit: { x: 440, y: 150 },
      lemmings: 12, need: 60, rate: 50, time: 5,
      skills: { basher: 2, miner: 2 },
      terrain: [['rect', 0, 80, 300, 80], ['rect', 240, 20, 30, 60], ['rect', 300, 150, 180, 10], ['ellipse', 120, 84, 50, 8]] },

    /* ---------------- WORLD 2: ACID WAREHOUSE ---------------- */
    { name: 'ACID DROP', world: 1, width: 400, code: 'SQUELCH1',
      hint: 'A long fall into the warehouse. Floaters swell a pad on the way down. Bash the girder.',
      entrance: { x: 30, y: 15 }, exit: { x: 360, y: 140 },
      lemmings: 8, need: 75, rate: 50, time: 5,
      skills: { floater: 8, basher: 2 },
      terrain: [['rect', 0, 40, 100, 12], ['rect', 0, 140, 20, 20], ['rect', 80, 140, 320, 20], ['rect', 250, 100, 16, 40], ['steel', 250, 96, 16, 4]],
      hazards: [{ type: 'fire', x: 20, y: 130, w: 60, h: 30 }] },

    { name: 'HEAR THE SILENCE', world: 1, width: 480, code: 'LOUDTRIB',
      hint: 'The grey Silence eats sound. Crank the release rate: a marching crowd is louder than one. A drone helps.',
      entrance: { x: 40, y: 60 }, exit: { x: 440, y: 110 },
      lemmings: 20, need: 70, rate: 50, time: 6,
      skills: { blocker: 1, basher: 2 },
      terrain: [['rect', 0, 110, 480, 50], ['rect', 300, 70, 12, 40], ['steel', 300, 66, 12, 4]],
      silence: { start: 400, dir: -1, speed: 0.03, limit: 180 } },

    { name: 'CRUSHER LINE', world: 1, width: 480, code: 'PRESSGO3',
      hint: 'The press kills on the beat. Dig into the service tunnel and bash the one-way gate.',
      entrance: { x: 40, y: 70 }, exit: { x: 440, y: 150 },
      lemmings: 12, need: 70, rate: 50, time: 5,
      skills: { digger: 2, basher: 2 },
      terrain: [['rect', 0, 120, 260, 40], ['erase', 160, 134, 100, 16], ['owr', 230, 134, 6, 16], ['rect', 260, 150, 220, 10], ['steel', 196, 84, 24, 20]],
      hazards: [{ type: 'crusher', x: 200, y: 104, w: 16, h: 17, period: 150, closed: 40, phase: 0 }] },

    /* ---------------- WORLD 3: SYNTHWAVE SUNSET ---------------- */
    { name: 'CHROME GRID', world: 2, width: 480, dir: -1, code: 'NEONCLMB',
      hint: 'One-way chrome: bashable only heading right. Climb over, float down, turn at the fence and bash back. Bomb the fence.',
      entrance: { x: 430, y: 100 }, exit: { x: 40, y: 150 },
      lemmings: 10, need: 80, rate: 50, time: 6,
      skills: { climber: 1, floater: 1, basher: 1, bomber: 2 },
      terrain: [['rect', 216, 150, 264, 10], ['owr', 200, 40, 16, 120], ['rect', 0, 150, 200, 10], ['rect', 180, 143, 2, 7], ['rect', 178, 138, 6, 3]] },

    { name: 'GATED REVERB', world: 2, width: 560, code: 'STEELGAP',
      hint: 'Steel plating resists diggers. Find the gap, drop into the hollow, hold the crowd, bridge the pool.',
      entrance: { x: 40, y: 20 }, exit: { x: 520, y: 130 },
      lemmings: 10, need: 60, rate: 50, time: 6,
      skills: { digger: 1, builder: 2, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 60, 160, 100], ['steel', 0, 60, 100, 6], ['steel', 120, 60, 40, 6], ['erase', 60, 100, 100, 20], ['rect', 160, 130, 400, 30], ['erase', 300, 130, 20, 30]],
      hazards: [{ type: 'water', x: 300, y: 140, w: 20, h: 20 }] },

    { name: 'NEON DESCENT', world: 2, width: 560, code: 'SUNSET3X',
      hint: 'Three terraces. Mine down, bash through, bridge the lava — and keep the Silence off the exit.',
      entrance: { x: 40, y: 10 }, exit: { x: 530, y: 150 },
      lemmings: 12, need: 60, rate: 50, time: 6,
      skills: { miner: 2, basher: 2, builder: 2, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 40, 200, 120], ['rect', 200, 110, 180, 50], ['rect', 380, 150, 180, 10], ['rect', 300, 70, 12, 40], ['erase', 440, 150, 24, 10]],
      hazards: [{ type: 'fire', x: 440, y: 152, w: 24, h: 8 }],
      silence: { start: 540, dir: -1, speed: 0.015, limit: 380 } },

    /* ---------------- WORLD 4: JUNGLE BREAKBEAT CAVES ---------------- */
    { name: 'BREAK CAVE', world: 3, width: 480, code: 'AMENCAVE',
      hint: 'Blocker, then Bomber: a drone that ends in a crash opens the cave wall.',
      entrance: { x: 40, y: 50 }, exit: { x: 440, y: 150 },
      lemmings: 10, need: 60, rate: 50, time: 5,
      skills: { builder: 2, blocker: 2, bomber: 2 },
      terrain: [['rect', 0, 100, 480, 60], ['erase', 160, 100, 24, 60], ['rect', 240, 40, 6, 60], ['erase', 300, 100, 180, 60], ['rect', 300, 150, 180, 10], ['rect', 0, 0, 480, 10]],
      hazards: [{ type: 'water', x: 160, y: 140, w: 24, h: 20 }] },

    { name: 'SUB DROP', world: 3, width: 560, code: 'SUBBASS8',
      hint: 'Steel plate at the wall foot: build stairs and bash above it. Two bridges over the lava.',
      entrance: { x: 40, y: 10 }, exit: { x: 520, y: 128 },
      lemmings: 10, need: 60, rate: 50, time: 7,
      skills: { digger: 1, builder: 4, basher: 1, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 44, 120, 26], ['rect', 60, 100, 60, 60], ['rect', 0, 128, 560, 32], ['erase', 200, 128, 40, 32], ['rect', 300, 60, 16, 68], ['steel', 300, 118, 4, 10], ['rect', 0, 0, 560, 8]],
      hazards: [{ type: 'fire', x: 200, y: 138, w: 40, h: 22 }] },

    { name: 'AMEN BREAK', world: 3, width: 640, code: 'CHOPBRK9',
      hint: 'Dig into the undercroft before the press, bridge the pool below it, bash the one-way gate.',
      entrance: { x: 40, y: 66 }, exit: { x: 600, y: 150 },
      lemmings: 15, need: 60, rate: 50, time: 7,
      skills: { digger: 2, builder: 2, basher: 2, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 120, 260, 40], ['erase', 150, 130, 110, 20], ['erase', 200, 150, 16, 10], ['rect', 260, 150, 380, 10], ['owr', 400, 110, 10, 40], ['steel', 196, 84, 24, 20], ['rect', 0, 0, 640, 8]],
      hazards: [{ type: 'crusher', x: 200, y: 104, w: 16, h: 17, period: 150, closed: 40, phase: 0 }, { type: 'water', x: 200, y: 152, w: 16, h: 8 }],
      silence: { start: 600, dir: -1, speed: 0.015, limit: 420 } },

    /* ---------------- WORLD 5: GRAND ORCHESTRAL FINALE ---------------- */
    { name: 'OVERTURE', world: 4, width: 560, code: 'TIMPANI5',
      hint: 'Mine off the balcony, bridge the reflecting pool, build up to the dais.',
      entrance: { x: 40, y: 20 }, exit: { x: 530, y: 128 },
      lemmings: 12, need: 70, rate: 50, time: 6,
      skills: { miner: 1, builder: 3, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 60, 100, 100], ['rect', 100, 138, 460, 22], ['rect', 480, 128, 80, 32], ['erase', 260, 138, 24, 22]],
      hazards: [{ type: 'water', x: 260, y: 148, w: 24, h: 12 }] },

    { name: 'CRESCENDO', world: 4, width: 640, code: 'STRINGS6',
      hint: 'Bash the wall, build over the press with head-room, and let the arpeggios push the Silence back.',
      entrance: { x: 40, y: 20 }, exit: { x: 600, y: 128 },
      lemmings: 15, need: 60, rate: 50, time: 8,
      skills: { miner: 1, basher: 1, builder: 5, blocker: 1, bomber: 1 },
      terrain: [['rect', 0, 60, 100, 100], ['rect', 100, 138, 540, 22], ['rect', 320, 90, 14, 48], ['steel', 406, 80, 24, 16], ['rect', 560, 128, 80, 32]],
      hazards: [{ type: 'crusher', x: 410, y: 128, w: 16, h: 11, period: 150, closed: 40, phase: 20 }],
      silence: { start: 620, dir: -1, speed: 0.02, limit: 300 } },

    { name: 'FINALE', world: 4, width: 640, code: 'FULLMIX7',
      hint: 'Everything you learned: bridge the gap, bash the column, two bridges over lava, two over the press, up to the dais.',
      entrance: { x: 40, y: 20 }, exit: { x: 600, y: 130 },
      lemmings: 20, need: 70, rate: 50, time: 9,
      skills: { builder: 7, basher: 1, blocker: 1, bomber: 1 },
      terrain: [['steel', 20, 50, 80, 6], ['rect', 20, 43, 2, 7], ['rect', 126, 44, 74, 10], ['rect', 180, 24, 10, 20], ['rect', 200, 100, 100, 60], ['rect', 300, 140, 340, 20], ['erase', 360, 140, 40, 20], ['steel', 436, 80, 24, 16], ['rect', 560, 130, 80, 30]],
      hazards: [{ type: 'fire', x: 360, y: 150, w: 40, h: 10 }, { type: 'crusher', x: 440, y: 130, w: 16, h: 11, period: 150, closed: 40, phase: 0 }],
      silence: { start: 630, dir: -1, speed: 0.02, limit: 350 } }
  ];
  for (var i = 0; i < LEVELS.length; i++) { LEVELS[i].index = i; LEVELS[i].seed = i + 1; }
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS; else root.BT_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : this);
