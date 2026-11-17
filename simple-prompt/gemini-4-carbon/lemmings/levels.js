/**
 * Lemmings: Beat Tribe — 16 Levels Across 5 Musical Genre Worlds (levels.js)
 *
 * Structure:
 * - Level 0: Tutorial ("First Footsteps")
 * - World 1 (Levels 1-3): Amiga Chip Garden (C Major Pentatonic, 124 BPM)
 * - World 2 (Levels 4-6): Acid Warehouse (E Phrygian, 132 BPM)
 * - World 3 (Levels 7-9): Synthwave Sunset (D Dorian, 118 BPM)
 * - World 4 (Levels 10-12): Jungle Breakbeat Caves (A Minor Pentatonic, 156 BPM)
 * - World 5 (Levels 13-15): Grand Orchestral Finale (F Lydian, 120 BPM)
 *
 * Every level includes a classic Password code and a verified deterministic solution demo.
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const TerrainMod = BeatTribe.Terrain || (typeof require !== 'undefined' ? require('./terrain.js') : null);
  const { MAT, Terrain } = TerrainMod;

  function addArch(t, cx, topY, spanW, height, deg) {
    const legW = 6;
    const xL = Math.round(cx - spanW / 2);
    const xR = Math.round(cx + spanW / 2 - legW);
    t.fillRectMat(xL, topY, legW, height, MAT.DIRT, deg);
    t.fillRectMat(xR, topY, legW, height, MAT.DIRT, deg + 2);
    t.fillMusicalPlatform(xL - 2, topY - 6, spanW + 4, 6, deg + 1, 14);
  }

  // 3x6px safety curb: turns normal walkers around (stepUp=6), while a Builder starting ~14px earlier climbs right over!
  function addSafetyCurb(t, xGap, floorY, deg = 3) {
    t.fillRectMat(xGap - 3, floorY - 6, 3, 6, MAT.DIRT, deg);
  }

  const LEVELS = [
    // =======================================================================
    // LEVEL 0 — TUTORIAL: FIRST FOOTSTEPS (World 1: Amiga Chip Garden)
    // =======================================================================
    {
      index: 0,
      code: 'BEAT0',
      worldId: 1,
      worldLabel: 'Tutorial',
      name: 'First Footsteps',
      subtitle: 'Build across the pond & bash the earthen pillar to complete the song!',
      seed: 1001,
      width: 640,
      lemmingCount: 10,
      saveReqPct: 60,
      minReleaseRate: 35,
      initialReleaseRate: 48,
      timeLimitSec: 240,
      hatch: { x: 84, y: 54 },
      exit: { x: 544, y: 96 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2,
        BUILDER: 5, BASHER: 4, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(640, 160, 1);
        t.fillRectMat(28, 56, 14, 104, MAT.DIRT, 0);
        t.fillMusicalPlatform(42, 96, 64, 64, 0, 22);
        t.fillMusicalPlatform(106, 100, 64, 60, 1, 22);
        t.fillMusicalPlatform(170, 104, 66, 56, 2, 22);
        addSafetyCurb(t, 236, 104, 4);

        // Sparkling Water Pond Basin (x=236..250, 14px span)
        t.fillRectMat(236, 134, 14, 26, MAT.WATER, 0);
        t.fillRectMat(232, 148, 22, 12, MAT.STEEL, 0);

        // East Garden Terrace (x=250..612, y=96)
        t.fillMusicalPlatform(250, 96, 362, 64, 3, 25);
        t.fillRectMat(376, 62, 18, 34, MAT.DIRT, 4);
        t.fillRectMat(598, 56, 18, 104, MAT.DIRT, 2);
        addArch(t, 140, 42, 44, 16, 2);
        addArch(t, 470, 44, 48, 16, 1);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":20,"type":"rate","rate":35},
        {"frame":202,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":499,"type":"skill","lemmingIndex":0,"skill":"BASHER"}
      ]
    },

    // =======================================================================
    // LEVEL 1 — WORLD 1-1: PENTATONIC PROMENADE (Amiga Chip Garden)
    // =======================================================================
    {
      index: 1,
      code: 'CHIP1',
      worldId: 1,
      worldLabel: 'World 1-1',
      name: 'Pentatonic Promenade',
      subtitle: 'Dig through the upper terrace, bridge the moat, and bash to the temple.',
      seed: 1101,
      width: 640,
      lemmingCount: 15,
      saveReqPct: 73,
      minReleaseRate: 40,
      initialReleaseRate: 52,
      timeLimitSec: 240,
      hatch: { x: 88, y: 30 },
      exit: { x: 548, y: 102 },
      skills: {
        CLIMBER: 1, FLOATER: 1, BOMBER: 2, BLOCKER: 2,
        BUILDER: 4, BASHER: 3, MINER: 1, DIGGER: 3
      },
      buildTerrain() {
        const t = new Terrain(640, 160, 1);
        t.fillRectMat(40, 34, 12, 46, MAT.DIRT, 0);
        t.fillMusicalPlatform(52, 66, 184, 14, 0, 24);
        t.fillRectMat(236, 46, 12, 34, MAT.DIRT, 4);

        t.fillRectMat(148, 86, 12, 74, MAT.DIRT, 1);
        t.fillMusicalPlatform(160, 110, 200, 50, 1, 25);
        addSafetyCurb(t, 360, 110, 3);

        t.fillRectMat(360, 136, 14, 24, MAT.WATER, 0);
        t.fillRectMat(356, 150, 22, 10, MAT.STEEL, 0);

        t.fillMusicalPlatform(374, 102, 230, 58, 2, 26);
        t.fillRectMat(454, 68, 18, 34, MAT.DIRT, 4);
        t.fillRectMat(592, 60, 16, 100, MAT.DIRT, 0);
        addArch(t, 300, 48, 42, 16, 3);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":20,"type":"rate","rate":40},
        {"frame":182,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":437,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":688,"type":"skill","lemmingIndex":0,"skill":"BASHER"}
      ]
    },

    // =======================================================================
    // LEVEL 2 — WORLD 1-2: PARASOL POLYRHYTHM (Amiga Chip Garden)
    // =======================================================================
    {
      index: 2,
      code: 'CHIP2',
      worldId: 1,
      worldLabel: 'World 1-2',
      name: 'Parasol Polyrhythm',
      subtitle: 'Float a scout down the tall cliff while carving a lower exit for the tribe!',
      seed: 1102,
      width: 660,
      lemmingCount: 16,
      saveReqPct: 75,
      minReleaseRate: 35,
      initialReleaseRate: 45,
      timeLimitSec: 240,
      hatch: { x: 84, y: 16 },
      exit: { x: 568, y: 116 },
      skills: {
        CLIMBER: 2, FLOATER: 3, BOMBER: 2, BLOCKER: 2,
        BUILDER: 5, BASHER: 3, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(660, 160, 1);
        t.fillRectMat(38, 14, 12, 146, MAT.STEEL, 0);
        t.fillMusicalPlatform(50, 42, 154, 118, 0, 22);
        // 8px lip at x=196..204 keeps non-climbers safely on top!
        t.fillRectMat(196, 32, 8, 10, MAT.DIRT, 4);

        t.fillMusicalPlatform(204, 124, 228, 36, 1, 26);
        addSafetyCurb(t, 432, 124, 3);

        t.fillRectMat(432, 138, 14, 22, MAT.WATER, 0);

        t.fillMusicalPlatform(446, 116, 178, 44, 2, 24);
        t.fillRectMat(612, 72, 14, 88, MAT.DIRT, 0);
        addArch(t, 318, 66, 52, 20, 2);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":89,"type":"skill","lemmingIndex":0,"skill":"CLIMBER"},
        {"frame":99,"type":"skill","lemmingIndex":0,"skill":"FLOATER"},
        {"frame":493,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":564,"type":"skill","lemmingIndex":7,"skill":"DIGGER"},
        {"frame":847,"type":"skill","lemmingIndex":7,"skill":"BASHER"}
      ]
    },

    // =======================================================================
    // LEVEL 3 — WORLD 1-3: GARDEN OF WHISPERS (Introduces Silence & One-Way)
    // =======================================================================
    {
      index: 3,
      code: 'CHIP3',
      worldId: 1,
      worldLabel: 'World 1-3',
      name: 'Garden of Whispers',
      subtitle: 'Keep music flowing past The Silence and bash rightward through the arrow wall!',
      seed: 1103,
      width: 680,
      lemmingCount: 20,
      saveReqPct: 75,
      minReleaseRate: 45,
      initialReleaseRate: 55,
      timeLimitSec: 240,
      hatch: { x: 118, y: 56 },
      exit: { x: 590, y: 96 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 3,
        BUILDER: 5, BASHER: 3, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(680, 160, 1);
        t.fillRectMat(24, 134, 34, 26, MAT.WATER, 0);
        t.fillRectMat(58, 60, 12, 100, MAT.DIRT, 0);
        t.fillMusicalPlatform(70, 104, 206, 56, 0, 24);
        addSafetyCurb(t, 276, 104, 3);

        t.addSilenceSource(146, 100, 0.005, 68);

        t.fillRectMat(276, 138, 14, 22, MAT.WATER, 0);

        t.fillMusicalPlatform(290, 96, 354, 64, 1, 26);
        t.fillRectMat(428, 58, 18, 38, MAT.ONE_WAY_RIGHT, 4);
        t.fillRectMat(632, 54, 16, 106, MAT.DIRT, 2);
        addArch(t, 514, 46, 46, 16, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":157,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":214,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":523,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":760,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 4 — WORLD 2-1: 303 CONVEYOR (Acid Warehouse: Steel & Miner)
    // =======================================================================
    {
      index: 4,
      code: 'ACID1',
      worldId: 2,
      worldLabel: 'World 2-1',
      name: '303 Conveyor',
      subtitle: 'Steel girders resist digging! Mine the neon cinderblock joint and bridge the vat.',
      seed: 2101,
      width: 680,
      lemmingCount: 20,
      saveReqPct: 80,
      minReleaseRate: 45,
      initialReleaseRate: 58,
      timeLimitSec: 240,
      hatch: { x: 86, y: 24 },
      exit: { x: 592, y: 104 },
      skills: {
        CLIMBER: 1, FLOATER: 1, BOMBER: 2, BLOCKER: 2,
        BUILDER: 4, BASHER: 2, MINER: 4, DIGGER: 1
      },
      buildTerrain() {
        const t = new Terrain(680, 160, 2);
        t.fillRectMat(40, 28, 14, 44, MAT.STEEL, 0);
        t.fillRectMat(54, 58, 178, 14, MAT.STEEL, 0);
        t.fillMusicalPlatform(232, 58, 76, 16, 0, 18);
        t.fillRectMat(308, 32, 14, 42, MAT.STEEL, 0);

        t.fillRectMat(196, 84, 14, 76, MAT.STEEL, 0);
        t.fillMusicalPlatform(210, 112, 254, 48, 1, 24);
        addSafetyCurb(t, 464, 112, 3);

        t.fillRectMat(464, 136, 14, 24, MAT.WATER, 0);
        t.fillRectMat(460, 150, 22, 10, MAT.STEEL, 0);

        t.fillMusicalPlatform(478, 104, 162, 56, 2, 24);
        t.fillRectMat(532, 70, 16, 34, MAT.DIRT, 5);
        t.fillRectMat(628, 56, 14, 104, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":213,"type":"skill","lemmingIndex":0,"skill":"MINER"},
        {"frame":561,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":786,"type":"skill","lemmingIndex":0,"skill":"BASHER"}
      ]
    },

    // =======================================================================
    // LEVEL 5 — WORLD 2-2: PISTON STOMP (Acid Warehouse: Piston Crushers)
    // =======================================================================
    {
      index: 5,
      code: 'ACID2',
      worldId: 2,
      worldLabel: 'World 2-2',
      name: 'Piston Stomp',
      subtitle: 'Heavy beat-synced crushers guard the catwalk! Tunnel safely through the duct below.',
      seed: 2102,
      width: 700,
      lemmingCount: 22,
      saveReqPct: 77,
      minReleaseRate: 45,
      initialReleaseRate: 56,
      timeLimitSec: 240,
      hatch: { x: 84, y: 40 },
      exit: { x: 614, y: 120 },
      skills: {
        CLIMBER: 1, FLOATER: 1, BOMBER: 2, BLOCKER: 2,
        BUILDER: 4, BASHER: 4, MINER: 2, DIGGER: 3
      },
      buildTerrain() {
        const t = new Terrain(700, 160, 2);
        t.fillRectMat(40, 46, 14, 50, MAT.STEEL, 0);
        t.fillMusicalPlatform(54, 82, 390, 14, 0, 24);
        t.fillRectMat(240, 72, 10, 10, MAT.DIRT, 2);
        t.fillRectMat(432, 36, 14, 60, MAT.STEEL, 0);

        t.addCrusher(286, 48, 18, 34, 96, 0);
        t.addCrusher(358, 48, 18, 34, 96, 48);

        t.fillRectMat(156, 96, 14, 64, MAT.STEEL, 0);
        t.fillMusicalPlatform(170, 128, 326, 32, 1, 24);
        t.fillRectMat(276, 96, 16, 32, MAT.DIRT, 4);
        t.fillRectMat(418, 96, 16, 32, MAT.DIRT, 5);
        addSafetyCurb(t, 496, 128, 3);

        t.fillRectMat(496, 140, 14, 20, MAT.WATER, 0);
        t.fillMusicalPlatform(510, 120, 150, 40, 2, 22);
        t.fillRectMat(648, 70, 14, 90, MAT.STEEL, 0);
        t.addSilenceSource(348, 124, 0.004, 56);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":191,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":374,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":591,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":700,"type":"skill","lemmingIndex":0,"skill":"BUILDER"}
      ]
    },

    // =======================================================================
    // LEVEL 6 — WORLD 2-3: RESONANT LOCKDOWN (Climber + One-Way-Left Rescue)
    // =======================================================================
    {
      index: 6,
      code: 'ACID3',
      worldId: 2,
      worldLabel: 'World 2-3',
      name: 'Resonant Lockdown',
      subtitle: 'The bay is sealed by a left-only barrier! Climb over and bash back from the far side.',
      seed: 2103,
      width: 720,
      lemmingCount: 25,
      saveReqPct: 80,
      minReleaseRate: 50,
      initialReleaseRate: 62,
      timeLimitSec: 240,
      hatch: { x: 132, y: 66 },
      exit: { x: 626, y: 106 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2,
        BUILDER: 5, BASHER: 4, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(720, 160, 2);
        t.fillRectMat(68, 60, 14, 100, MAT.STEEL, 0);
        t.fillMusicalPlatform(82, 114, 150, 46, 0, 22);
        t.fillRectMat(232, 88, 18, 26, MAT.ONE_WAY_LEFT, 3);

        t.fillMusicalPlatform(232, 114, 254, 46, 1, 24);
        t.fillRectMat(304, 82, 16, 32, MAT.DIRT, 5);
        t.fillRectMat(296, 76, 26, 6, MAT.STEEL, 0); // Overhang turns Climbers back left!
        addSafetyCurb(t, 486, 114, 2);

        t.fillRectMat(486, 138, 14, 22, MAT.FIRE, 0);
        t.fillMusicalPlatform(500, 106, 176, 54, 4, 24);
        t.fillRectMat(662, 58, 14, 102, MAT.STEEL, 0);
        t.addSilenceSource(400, 110, 0.0045, 64);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":92,"type":"skill","lemmingIndex":0,"skill":"CLIMBER"},
        {"frame":414,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":578,"type":"skill","lemmingIndex":1,"skill":"BASHER"},
        {"frame":799,"type":"skill","lemmingIndex":3,"skill":"BLOCKER"},
        {"frame":830,"type":"skill","lemmingIndex":1,"skill":"BUILDER"},
        {"frame":1145,"type":"skill","lemmingIndex":3,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 7 — WORLD 3-1: CHROME HORIZON (Synthwave Sunset: Chained Sky Bridges)
    // =======================================================================
    {
      index: 7,
      code: 'WAVE1',
      worldId: 3,
      worldLabel: 'World 3-1',
      name: 'Chrome Horizon',
      subtitle: 'Chain glowing arpeggio staircases across floating neon islands under the sunset!',
      seed: 3101,
      width: 720,
      lemmingCount: 24,
      saveReqPct: 80,
      minReleaseRate: 50,
      initialReleaseRate: 60,
      timeLimitSec: 240,
      hatch: { x: 96, y: 64 },
      exit: { x: 618, y: 92 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2,
        BUILDER: 7, BASHER: 3, MINER: 2, DIGGER: 1
      },
      buildTerrain() {
        const t = new Terrain(720, 160, 3);
        t.fillRectMat(0, 146, 720, 14, MAT.WATER, 0);

        // Island 1 (x=48..224, y=108..146) -> 34px sky gap -> Island 2 (x=258..452, y=94)
        t.fillRectMat(48, 66, 12, 80, MAT.STEEL, 0);
        t.fillMusicalPlatform(60, 108, 164, 38, 0, 22);
        addSafetyCurb(t, 224, 108, 2);

        // Island 2 (x=258..456, y=94..146) + Synth Prism Wall + 14px gap to Island 3
        t.fillMusicalPlatform(258, 94, 198, 52, 1, 24);
        t.fillRectMat(344, 60, 18, 34, MAT.DIRT, 4);
        addSafetyCurb(t, 456, 94, 5);

        // Island 3 (x=470..672, y=92..146)
        t.fillMusicalPlatform(470, 92, 202, 54, 3, 24);
        t.fillRectMat(658, 52, 14, 94, MAT.STEEL, 0);
        addArch(t, 548, 42, 48, 16, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":176,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":278,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":416,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":672,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":821,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":1168,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 8 — WORLD 3-2: LASER ONE-WAY (Synthwave: Fire Pits & Miner)
    // =======================================================================
    {
      index: 8,
      code: 'WAVE2',
      worldId: 3,
      worldLabel: 'World 3-2',
      name: 'Laser One-Way',
      subtitle: 'Bridge the fire trench, bash the laser gate, and mine inside the neon monolith!',
      seed: 3102,
      width: 740,
      lemmingCount: 25,
      saveReqPct: 80,
      minReleaseRate: 50,
      initialReleaseRate: 60,
      timeLimitSec: 240,
      hatch: { x: 88, y: 48 },
      exit: { x: 648, y: 122 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2,
        BUILDER: 6, BASHER: 3, MINER: 4, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(740, 160, 3);
        t.fillRectMat(42, 54, 12, 106, MAT.STEEL, 0);
        t.fillMusicalPlatform(54, 96, 192, 64, 0, 24);
        addSafetyCurb(t, 246, 96, 2);

        // Fire Trench 1 (x=246..260, 14px)
        t.fillRectMat(246, 134, 14, 26, MAT.FIRE, 0);

        // Central Laser Monolith (x=260..496, y=88..104) with ONE_WAY_RIGHT Gate & Steel edge guard
        t.fillMusicalPlatform(260, 88, 236, 16, 1, 24);
        t.fillMusicalPlatform(260, 104, 164, 56, 3, 24);
        t.fillRectMat(356, 52, 18, 36, MAT.ONE_WAY_RIGHT, 5);
        t.fillRectMat(484, 58, 12, 46, MAT.STEEL, 0);

        // Lower East Plaza underneath monolith overhang (x=412..536, y=130..160)
        t.fillRectMat(412, 104, 12, 56, MAT.STEEL, 0);
        t.fillMusicalPlatform(424, 130, 112, 30, 4, 22);
        addSafetyCurb(t, 536, 130, 6);

        // Fire Trench 2 (x=536..550) + Sunset Exit Terrace (x=550..700, y=122..160)
        t.fillRectMat(536, 140, 14, 20, MAT.FIRE, 0);
        t.fillMusicalPlatform(550, 122, 150, 38, 0, 24);
        t.fillRectMat(688, 74, 12, 86, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":190,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":207,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":474,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":602,"type":"skill","lemmingIndex":0,"skill":"MINER"},
        {"frame":826,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":1120,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 9 — WORLD 3-3: FADING CASSETTE (Silence + Crusher + Lava)
    // =======================================================================
    {
      index: 9,
      code: 'WAVE3',
      worldId: 3,
      worldLabel: 'World 3-3',
      name: 'Fading Cassette',
      subtitle: 'Dual Silence fields drain the neon glow! Duck beneath the crusher and cross the lava.',
      seed: 3103,
      width: 740,
      lemmingCount: 26,
      saveReqPct: 80,
      minReleaseRate: 50,
      initialReleaseRate: 62,
      timeLimitSec: 240,
      hatch: { x: 88, y: 36 },
      exit: { x: 646, y: 118 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 3,
        BUILDER: 6, BASHER: 4, MINER: 2, DIGGER: 3
      },
      buildTerrain() {
        const t = new Terrain(740, 160, 3);
        t.fillRectMat(42, 42, 12, 50, MAT.STEEL, 0);
        t.fillMusicalPlatform(54, 78, 306, 14, 0, 24);
        t.fillRectMat(248, 68, 10, 10, MAT.DIRT, 2);
        t.addCrusher(292, 44, 18, 34, 90, 12);
        t.fillRectMat(348, 36, 12, 56, MAT.STEEL, 0);

        t.fillRectMat(168, 92, 12, 68, MAT.STEEL, 0);
        t.fillMusicalPlatform(180, 126, 304, 34, 1, 24);
        t.fillRectMat(316, 92, 18, 34, MAT.DIRT, 4);
        addSafetyCurb(t, 484, 126, 5);

        t.fillRectMat(484, 140, 14, 20, MAT.LAVA, 0);
        t.fillMusicalPlatform(498, 118, 200, 42, 3, 24);
        t.fillRectMat(564, 82, 18, 36, MAT.DIRT, 6);
        t.fillRectMat(686, 68, 12, 92, MAT.STEEL, 0);

        t.addSilenceSource(152, 74, 0.0045, 62);
        t.addSilenceSource(428, 122, 0.005, 66);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":211,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":427,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":631,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":662,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":899,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":1056,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 10 — WORLD 4-1: AMEN STALACTITES (Jungle Breakbeat Caves, 156 BPM)
    // =======================================================================
    {
      index: 10,
      code: 'JUNG1',
      worldId: 4,
      worldLabel: 'World 4-1',
      name: 'Amen Stalactites',
      subtitle: '156 BPM Jungle rush! Mine the crystal shelf, bash stalagmites, and span the lake.',
      seed: 4101,
      width: 740,
      lemmingCount: 28,
      saveReqPct: 82,
      minReleaseRate: 55,
      initialReleaseRate: 68,
      timeLimitSec: 240,
      hatch: { x: 86, y: 32 },
      exit: { x: 646, y: 108 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 2,
        BUILDER: 5, BASHER: 4, MINER: 4, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(740, 160, 4);
        t.fillRectMat(42, 36, 12, 52, MAT.STEEL, 0);
        t.fillMusicalPlatform(54, 72, 202, 16, 0, 22);
        t.fillRectMat(256, 44, 12, 44, MAT.STEEL, 0);

        t.fillRectMat(184, 88, 12, 72, MAT.STEEL, 0);
        t.fillMusicalPlatform(196, 116, 272, 44, 1, 24);
        t.fillRectMat(312, 82, 16, 34, MAT.DIRT, 2);
        t.fillRectMat(392, 82, 16, 34, MAT.DIRT, 4);
        addSafetyCurb(t, 468, 116, 3);

        t.fillRectMat(468, 136, 14, 24, MAT.WATER, 0);

        t.fillMusicalPlatform(482, 108, 218, 52, 0, 24);
        t.fillRectMat(688, 60, 12, 100, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":184,"type":"skill","lemmingIndex":0,"skill":"MINER"},
        {"frame":420,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":544,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":651,"type":"skill","lemmingIndex":0,"skill":"BUILDER"}
      ]
    },

    // =======================================================================
    // LEVEL 11 — WORLD 4-2: SUB-BASS CATACOMBS (3-Tier Vertical Shaft)
    // =======================================================================
    {
      index: 11,
      code: 'JUNG2',
      worldId: 4,
      worldLabel: 'World 4-2',
      name: 'Sub-Bass Catacombs',
      subtitle: 'Find the crystal seams between steel veins to descend three cavern tiers!',
      seed: 4102,
      width: 760,
      lemmingCount: 30,
      saveReqPct: 80,
      minReleaseRate: 55,
      initialReleaseRate: 68,
      timeLimitSec: 240,
      hatch: { x: 88, y: 18 },
      exit: { x: 676, y: 130 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 3,
        BUILDER: 5, BASHER: 3, MINER: 3, DIGGER: 4
      },
      buildTerrain() {
        const t = new Terrain(760, 160, 4);
        t.fillRectMat(44, 18, 12, 44, MAT.STEEL, 0);
        t.fillRectMat(56, 50, 160, 12, MAT.STEEL, 0);
        t.fillMusicalPlatform(216, 50, 84, 12, 1, 20);
        t.fillRectMat(300, 22, 12, 40, MAT.STEEL, 0);

        t.fillRectMat(180, 62, 12, 46, MAT.STEEL, 0);
        t.fillRectMat(192, 96, 212, 12, MAT.STEEL, 0);
        t.fillMusicalPlatform(404, 96, 92, 12, 2, 20);
        t.fillRectMat(496, 68, 12, 40, MAT.STEEL, 0);
        t.fillRectMat(336, 66, 16, 30, MAT.DIRT, 3);
        t.addSilenceSource(290, 92, 0.0045, 60);

        t.fillRectMat(384, 108, 12, 52, MAT.STEEL, 0);
        t.fillMusicalPlatform(396, 138, 160, 22, 4, 22);
        addSafetyCurb(t, 556, 138, 0);
        t.fillRectMat(556, 146, 14, 14, MAT.FIRE, 0);
        t.fillMusicalPlatform(570, 130, 150, 30, 1, 24);
        t.fillRectMat(708, 84, 12, 76, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":216,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":441,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":595,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":798,"type":"skill","lemmingIndex":0,"skill":"BUILDER"}
      ]
    },

    // =======================================================================
    // LEVEL 12 — WORLD 4-3: BREAKBEAT GAUNTLET (Pioneer Athlete + Crowd Release)
    // =======================================================================
    {
      index: 12,
      code: 'JUNG3',
      worldId: 4,
      worldLabel: 'World 4-3',
      name: 'Breakbeat Gauntlet',
      subtitle: 'Send a Climber pioneer ahead to bridge the underground lake before freeing the tribe!',
      seed: 4103,
      width: 780,
      lemmingCount: 32,
      saveReqPct: 84,
      minReleaseRate: 60,
      initialReleaseRate: 72,
      timeLimitSec: 240,
      hatch: { x: 96, y: 62 },
      exit: { x: 688, y: 104 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 3,
        BUILDER: 6, BASHER: 5, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(780, 160, 4);
        t.fillRectMat(48, 62, 12, 98, MAT.STEEL, 0);
        t.fillMusicalPlatform(60, 112, 148, 48, 0, 22);
        t.fillRectMat(208, 88, 18, 24, MAT.DIRT, 3);

        t.fillMusicalPlatform(208, 112, 244, 48, 1, 24);
        t.fillRectMat(328, 78, 16, 34, MAT.DIRT, 4);
        t.addSilenceSource(388, 108, 0.005, 64);

        t.fillRectMat(452, 136, 14, 24, MAT.WATER, 0);

        t.fillMusicalPlatform(466, 104, 270, 56, 2, 26);
        t.fillRectMat(568, 68, 18, 36, MAT.ONE_WAY_RIGHT, 0);
        t.fillRectMat(724, 58, 12, 102, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":109,"type":"skill","lemmingIndex":0,"skill":"CLIMBER"},
        {"frame":357,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":546,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":817,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":821,"type":"skill","lemmingIndex":19,"skill":"BASHER"}
      ]
    },

    // =======================================================================
    // LEVEL 13 — WORLD 5-1: LYDIAN COLONNADE (Grand Orchestral Finale)
    // =======================================================================
    {
      index: 13,
      code: 'SYMP1',
      worldId: 5,
      worldLabel: 'World 5-1',
      name: 'Lydian Colonnade',
      subtitle: 'Build golden staircases over lava chasms and carve through marble concert columns!',
      seed: 5101,
      width: 760,
      lemmingCount: 35,
      saveReqPct: 85,
      minReleaseRate: 55,
      initialReleaseRate: 66,
      timeLimitSec: 240,
      hatch: { x: 88, y: 52 },
      exit: { x: 668, y: 90 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 3,
        BUILDER: 7, BASHER: 5, MINER: 2, DIGGER: 2
      },
      buildTerrain() {
        const t = new Terrain(760, 160, 5);
        t.fillRectMat(42, 54, 12, 106, MAT.STEEL, 0);
        t.fillMusicalPlatform(54, 104, 182, 56, 0, 22);
        addSafetyCurb(t, 236, 104, 3);

        t.fillRectMat(236, 138, 14, 22, MAT.LAVA, 0);

        t.fillMusicalPlatform(250, 98, 246, 62, 1, 24);
        t.fillRectMat(324, 60, 18, 38, MAT.DIRT, 3);
        t.fillRectMat(412, 60, 18, 38, MAT.DIRT, 5);
        addSafetyCurb(t, 496, 98, 2);

        t.fillRectMat(496, 138, 14, 22, MAT.LAVA, 0);

        t.fillMusicalPlatform(510, 90, 210, 70, 3, 24);
        t.fillRectMat(584, 54, 16, 36, MAT.ONE_WAY_RIGHT, 6);
        t.fillRectMat(708, 46, 12, 114, MAT.STEEL, 0);
        addArch(t, 140, 40, 48, 16, 3);
        addArch(t, 668, 36, 52, 16, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":186,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":199,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":445,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":583,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":704,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":949,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":1102,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 14 — WORLD 5-2: THE SILENT MOVEMENT (Triple Silence Orchestra Pit)
    // =======================================================================
    {
      index: 14,
      code: 'SYMP2',
      worldId: 5,
      worldLabel: 'World 5-2',
      name: 'The Silent Movement',
      subtitle: 'Banish three Silence vortices in the sunken orchestra pit with continuous music!',
      seed: 5102,
      width: 780,
      lemmingCount: 40,
      saveReqPct: 85,
      minReleaseRate: 58,
      initialReleaseRate: 70,
      timeLimitSec: 240,
      hatch: { x: 88, y: 26 },
      exit: { x: 692, y: 118 },
      skills: {
        CLIMBER: 2, FLOATER: 2, BOMBER: 2, BLOCKER: 4,
        BUILDER: 7, BASHER: 5, MINER: 3, DIGGER: 3
      },
      buildTerrain() {
        const t = new Terrain(780, 160, 5);
        t.fillRectMat(44, 30, 12, 52, MAT.STEEL, 0);
        t.fillRectMat(56, 68, 132, 14, MAT.STEEL, 0);
        t.fillMusicalPlatform(188, 68, 68, 14, 0, 20);
        t.fillRectMat(256, 40, 12, 42, MAT.STEEL, 0);

        t.fillRectMat(176, 82, 12, 78, MAT.STEEL, 0);
        t.fillMusicalPlatform(188, 126, 352, 34, 1, 24);
        t.fillRectMat(304, 90, 18, 36, MAT.DIRT, 3);
        t.fillRectMat(428, 90, 18, 36, MAT.ONE_WAY_RIGHT, 5);
        addSafetyCurb(t, 540, 126, 2);

        t.addSilenceSource(258, 122, 0.005, 62);
        t.addSilenceSource(376, 122, 0.005, 62);
        t.addSilenceSource(492, 122, 0.005, 62);

        t.fillRectMat(540, 142, 14, 18, MAT.LAVA, 0);
        t.fillMusicalPlatform(554, 118, 186, 42, 3, 24);
        t.fillRectMat(618, 82, 16, 36, MAT.DIRT, 4);
        t.fillRectMat(728, 68, 12, 92, MAT.STEEL, 0);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":195,"type":"skill","lemmingIndex":0,"skill":"DIGGER"},
        {"frame":375,"type":"skill","lemmingIndex":1,"skill":"BLOCKER"},
        {"frame":416,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":629,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":818,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":1053,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":1196,"type":"skill","lemmingIndex":1,"skill":"BOMBER"}
      ]
    },

    // =======================================================================
    // LEVEL 15 — WORLD 5-3: SYMPHONY OF THE SAVED (50-Lemming Grand Finale!)
    // =======================================================================
    {
      index: 15,
      code: 'SYMP3',
      worldId: 5,
      worldLabel: 'World 5-3',
      name: 'Symphony of the Saved',
      subtitle: '50-Lemming Finale! Send an athlete pioneer to prepare the score, then release the tribe!',
      seed: 5103,
      width: 800,
      lemmingCount: 50,
      saveReqPct: 88,
      minReleaseRate: 62,
      initialReleaseRate: 75,
      timeLimitSec: 300,
      hatch: { x: 98, y: 58 },
      exit: { x: 734, y: 96 },
      skills: {
        CLIMBER: 3, FLOATER: 3, BOMBER: 3, BLOCKER: 4,
        BUILDER: 9, BASHER: 6, MINER: 3, DIGGER: 3
      },
      buildTerrain() {
        const t = new Terrain(800, 160, 5);
        t.fillRectMat(48, 56, 14, 104, MAT.STEEL, 0);
        t.fillMusicalPlatform(62, 112, 150, 48, 0, 22);
        t.fillRectMat(212, 88, 18, 24, MAT.DIRT, 3);

        t.fillMusicalPlatform(212, 112, 174, 48, 1, 24);
        t.fillRectMat(296, 76, 16, 36, MAT.DIRT, 4);
        t.addSilenceSource(344, 108, 0.005, 62);

        t.fillRectMat(386, 138, 14, 22, MAT.LAVA, 0);

        t.fillMusicalPlatform(400, 104, 178, 56, 2, 24);
        t.fillRectMat(478, 68, 18, 36, MAT.ONE_WAY_RIGHT, 6);
        t.addSilenceSource(536, 100, 0.005, 62);

        t.fillRectMat(578, 136, 14, 24, MAT.WATER, 0);

        t.fillMusicalPlatform(592, 96, 184, 64, 3, 24);
        t.fillRectMat(652, 60, 16, 36, MAT.DIRT, 0);
        t.fillRectMat(764, 48, 14, 112, MAT.STEEL, 0);
        addArch(t, 734, 40, 52, 16, 3);
        t.finalizeShading();
        return t;
      },
      demo: [
        {"frame":109,"type":"skill","lemmingIndex":0,"skill":"CLIMBER"},
        {"frame":325,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":472,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":719,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":895,"type":"skill","lemmingIndex":0,"skill":"BUILDER"},
        {"frame":1124,"type":"skill","lemmingIndex":0,"skill":"BASHER"},
        {"frame":1130,"type":"skill","lemmingIndex":21,"skill":"BASHER"}
      ]
    }
  ];

  function findLevelByPassword(code) {
    if (!code) return null;
    const norm = String(code).trim().toUpperCase();
    return LEVELS.find(l => l.code === norm) || null;
  }

  BeatTribe.Levels = {
    LEVELS,
    findLevelByPassword
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Levels;
  }
})(typeof window !== 'undefined' ? window : globalThis);
