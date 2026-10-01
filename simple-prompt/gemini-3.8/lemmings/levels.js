// ============================================================================
// Lemmings: Beat Tribe — 16 Solvable Levels Definitions & Attract Mode Demos
// ============================================================================

(function(global) {
  'use strict';

  const T_AIR = 0;
  const T_NOTE_1 = 1;
  const T_NOTE_2 = 2;
  const T_NOTE_3 = 3;
  const T_NOTE_4 = 4;
  const T_NOTE_5 = 5;
  const T_NOTE_6 = 6;
  const T_NOTE_7 = 7;
  const T_STEEL = 8;
  const T_ONEWAY_L = 9;
  const T_ONEWAY_R = 10;
  const T_WATER = 11;
  const T_LAVA = 12;
  const T_CRUSHER = 13;
  const T_BRICK = 14;

  const LEVELS = [
    // -------------------------------------------------------------
    // TUTORIAL: Level 0
    // -------------------------------------------------------------
    {
      id: 'level_0',
      number: 0,
      title: 'Penta Park: Step to the Beat',
      world: 1,
      worldName: 'Amiga Chip Garden',
      scaleName: 'Major Pentatonic (C, D, E, G, A)',
      scaleNotes: ['C4', 'D4', 'E4', 'G4', 'A4'],
      bpm: 124,
      password: 'BEATTRIBE',
      lemmings: 10,
      requiredPercent: 100,
      timeLimit: 180,
      releaseRate: 50,
      spawn: { x: 90, y: 30 },
      exit: { x: 380, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 5, basher: 0, miner: 0, digger: 5 },
      generate: function(lvl) {
        lvl.setRect(50, 65, 180, 20, T_NOTE_1);
        lvl.setRect(140, 115, 260, 20, T_NOTE_2);
        lvl.setRect(220, 45, 15, 40, T_NOTE_1);
      },
      demoScript: [
        { frame: 120, lemmingIdx: 0, skill: 'digger' }
      ]
    },

    // -------------------------------------------------------------
    // WORLD 1: AMIGA CHIP GARDEN (Levels 1-1, 1-2, 1-3)
    // -------------------------------------------------------------
    {
      id: 'level_1_1',
      number: 1,
      title: 'The Emerald Step',
      world: 1,
      worldName: 'Amiga Chip Garden',
      scaleName: 'Major Pentatonic (C, D, E, G, A)',
      scaleNotes: ['C4', 'D4', 'E4', 'G4', 'A4'],
      bpm: 124,
      password: 'CHIPCHOP',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 200,
      releaseRate: 50,
      spawn: { x: 70, y: 80 },
      exit: { x: 420, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 8, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 400, 20, T_NOTE_1);
        lvl.setRect(35, 75, 10, 40, T_NOTE_1);
        lvl.setRect(180, 65, 45, 50, T_NOTE_2);
        lvl.setRect(300, 85, 30, 30, T_NOTE_3);
      },
      demoScript: [
        { frame: 165, lemmingIdx: 0, skill: 'basher' },
        { frame: 430, lemmingIdx: 0, skill: 'basher' }
      ]
    },

    {
      id: 'level_1_2',
      number: 2,
      title: 'Pachinko Chime',
      world: 1,
      worldName: 'Amiga Chip Garden',
      scaleName: 'Major Pentatonic (C, D, E, G, A)',
      scaleNotes: ['C4', 'D4', 'E4', 'G4', 'A4'],
      bpm: 124,
      password: 'PACHINKO',
      lemmings: 10,
      requiredPercent: 80,
      timeLimit: 220,
      releaseRate: 40,
      spawn: { x: 80, y: 15 },
      exit: { x: 440, y: 125 },
      skills: { climber: 0, floater: 10, bomber: 0, blocker: 0, builder: 5, basher: 0, miner: 5, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 125, 420, 20, T_NOTE_1);
        lvl.setRect(30, 85, 10, 40, T_NOTE_1);
        lvl.setRect(70, 50, 25, 8, T_NOTE_2);
        lvl.setRect(110, 75, 25, 8, T_NOTE_3);
        lvl.setRect(150, 100, 25, 8, T_NOTE_4);
      },
      demoScript: [
        { frame: 50, lemmingIdx: 0, skill: 'floater' },
        { frame: 150, lemmingIdx: 1, skill: 'floater' },
        { frame: 245, lemmingIdx: 2, skill: 'floater' },
        { frame: 345, lemmingIdx: 3, skill: 'floater' },
        { frame: 440, lemmingIdx: 4, skill: 'floater' },
        { frame: 535, lemmingIdx: 5, skill: 'floater' },
        { frame: 635, lemmingIdx: 6, skill: 'floater' },
        { frame: 730, lemmingIdx: 7, skill: 'floater' },
        { frame: 830, lemmingIdx: 8, skill: 'floater' },
        { frame: 925, lemmingIdx: 9, skill: 'floater' }
      ]
    },

    {
      id: 'level_1_3',
      number: 3,
      title: 'The Four-Channel Chasm',
      world: 1,
      worldName: 'Amiga Chip Garden',
      scaleName: 'Major Pentatonic (C, D, E, G, A)',
      scaleNotes: ['C4', 'D4', 'E4', 'G4', 'A4'],
      bpm: 124,
      password: 'AMIGAFOUR',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 75 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 5, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 105, 120, 25, T_NOTE_1);
        lvl.setRect(30, 65, 10, 40, T_NOTE_1);
        lvl.setRect(160, 140, 60, 20, T_WATER);
        lvl.setRect(220, 75, 240, 50, T_NOTE_2);
        lvl.setRect(300, 45, 30, 30, T_NOTE_3);
      },
      demoScript: [
        { frame: 135, lemmingIdx: 0, skill: 'builder' },
        { frame: 195, lemmingIdx: 1, skill: 'blocker' },
        { frame: 280, lemmingIdx: 0, skill: 'builder' },
        { frame: 425, lemmingIdx: 0, skill: 'builder' },
        { frame: 650, lemmingIdx: 0, skill: 'basher' },
        { frame: 850, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    // -------------------------------------------------------------
    // WORLD 2: ACID WAREHOUSE (Levels 2-1, 2-2, 2-3)
    // -------------------------------------------------------------
    {
      id: 'level_2_1',
      number: 4,
      title: '303 Resonant Girders',
      world: 2,
      worldName: 'Acid Warehouse',
      scaleName: 'Phrygian Mode (E, F, G, A, B, C, D)',
      scaleNotes: ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'],
      bpm: 135,
      password: 'ACIDBASS',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 200,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 85 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 6, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 140, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(100, 115, 35, 10, T_STEEL);
        lvl.setRect(140, 80, 40, 35, T_NOTE_2);
        lvl.setRect(180, 140, 60, 20, T_LAVA);
        lvl.setRect(240, 85, 200, 45, T_NOTE_3);
      },
      demoScript: [
        { frame: 130, lemmingIdx: 0, skill: 'basher' },
        { frame: 195, lemmingIdx: 1, skill: 'blocker' },
        { frame: 302, lemmingIdx: 0, skill: 'builder' },
        { frame: 447, lemmingIdx: 0, skill: 'builder' },
        { frame: 592, lemmingIdx: 0, skill: 'builder' },
        { frame: 800, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    {
      id: 'level_2_2',
      number: 5,
      title: 'Squelch & Slide',
      world: 2,
      worldName: 'Acid Warehouse',
      scaleName: 'Phrygian Mode (E, F, G, A, B, C, D)',
      scaleNotes: ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'],
      bpm: 135,
      password: 'SQUELCHY',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 220,
      releaseRate: 50,
      spawn: { x: 70, y: 50 },
      exit: { x: 420, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 4, basher: 0, miner: 5, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 80, 130, 40, T_NOTE_1);
        lvl.setRect(30, 40, 10, 50, T_NOTE_1);
        lvl.setRect(140, 115, 300, 20, T_NOTE_2);
      },
      demoScript: [
        { frame: 130, lemmingIdx: 0, skill: 'miner' }
      ]
    },

    {
      id: 'level_2_3',
      number: 6,
      title: 'Overdrive Assembly Line',
      world: 2,
      worldName: 'Acid Warehouse',
      scaleName: 'Phrygian Mode (E, F, G, A, B, C, D)',
      scaleNotes: ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'],
      bpm: 135,
      password: 'OVERDRIVE',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 85 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 6, basher: 0, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 120, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(90, 115, 35, 10, T_STEEL);
        lvl.setRect(160, 140, 50, 20, T_CRUSHER);
        lvl.setRect(210, 85, 240, 45, T_NOTE_2);
      },
      demoScript: [
        { frame: 125, lemmingIdx: 0, skill: 'builder' },
        { frame: 185, lemmingIdx: 1, skill: 'blocker' },
        { frame: 255, lemmingIdx: 0, skill: 'builder' },
        { frame: 385, lemmingIdx: 0, skill: 'builder' },
        { frame: 515, lemmingIdx: 0, skill: 'builder' },
        { frame: 750, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    // -------------------------------------------------------------
    // WORLD 3: SYNTHWAVE SUNSET (Levels 3-1, 3-2, 3-3)
    // -------------------------------------------------------------
    {
      id: 'level_3_1',
      number: 7,
      title: 'Neon Highway 1984',
      world: 3,
      worldName: 'Synthwave Sunset',
      scaleName: 'Dorian Mode (D, E, F, G, A, B, C)',
      scaleNotes: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
      bpm: 110,
      password: 'SYNTHWAVE',
      lemmings: 10,
      requiredPercent: 80,
      timeLimit: 200,
      releaseRate: 50,
      spawn: { x: 70, y: 75 },
      exit: { x: 420, y: 115 },
      skills: { climber: 5, floater: 5, bomber: 0, blocker: 0, builder: 5, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 390, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(170, 70, 40, 45, T_NOTE_2);
      },
      demoScript: [
        { frame: 156, lemmingIdx: 0, skill: 'basher' }
      ]
    },

    {
      id: 'level_3_2',
      number: 8,
      title: 'Sunset Arpeggios',
      world: 3,
      worldName: 'Synthwave Sunset',
      scaleName: 'Dorian Mode (D, E, F, G, A, B, C)',
      scaleNotes: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
      bpm: 110,
      password: 'OUTRUN86',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 75 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 8, basher: 0, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 110, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(80, 115, 35, 10, T_STEEL);
        lvl.setRect(190, 88, 90, 25, T_NOTE_2);
        lvl.setRect(285, 75, 160, 25, T_NOTE_3);
      },
      demoScript: [
        { frame: 120, lemmingIdx: 0, skill: 'builder' },
        { frame: 180, lemmingIdx: 1, skill: 'blocker' },
        { frame: 250, lemmingIdx: 0, skill: 'builder' },
        { frame: 380, lemmingIdx: 0, skill: 'builder' },
        { frame: 600, lemmingIdx: 0, skill: 'builder' },
        { frame: 850, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    {
      id: 'level_3_3',
      number: 9,
      title: 'The Creeping Silence',
      world: 3,
      worldName: 'Synthwave Sunset',
      scaleName: 'Dorian Mode (D, E, F, G, A, B, C)',
      scaleNotes: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
      bpm: 110,
      password: 'MUTEDVOID',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      hasSilence: true,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 3, builder: 6, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 400, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(180, 75, 40, 40, T_NOTE_2);
      },
      demoScript: [
        { frame: 169, lemmingIdx: 0, skill: 'basher' }
      ]
    },

    // -------------------------------------------------------------
    // WORLD 4: JUNGLE BREAKBEAT CAVES (Levels 4-1, 4-2, 4-3)
    // -------------------------------------------------------------
    {
      id: 'level_4_1',
      number: 10,
      title: 'Amen Cavern',
      world: 4,
      worldName: 'Jungle Breakbeat Caves',
      scaleName: 'Minor Pentatonic (A, C, D, E, G)',
      scaleNotes: ['A2', 'C3', 'D3', 'E3', 'G3'],
      bpm: 160,
      password: 'BREAKBEAT',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 200,
      releaseRate: 70,
      spawn: { x: 80, y: 45 },
      exit: { x: 400, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 4, basher: 0, miner: 0, digger: 5 },
      generate: function(lvl) {
        lvl.setRect(50, 75, 160, 20, T_NOTE_1);
        lvl.setRect(200, 55, 15, 30, T_NOTE_1);
        lvl.setRect(120, 115, 300, 20, T_NOTE_2);
      },
      demoScript: [
        { frame: 120, lemmingIdx: 0, skill: 'digger' }
      ]
    },

    {
      id: 'level_4_2',
      number: 11,
      title: 'Sub-Bass Trench',
      world: 4,
      worldName: 'Jungle Breakbeat Caves',
      scaleName: 'Minor Pentatonic (A, C, D, E, G)',
      scaleNotes: ['A2', 'C3', 'D3', 'E3', 'G3'],
      bpm: 160,
      password: 'SUBTERRA',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 220,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 85 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 6, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 120, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(90, 115, 35, 10, T_STEEL);
        lvl.setRect(160, 140, 50, 20, T_WATER);
        lvl.setRect(210, 85, 240, 45, T_NOTE_2);
      },
      demoScript: [
        { frame: 125, lemmingIdx: 0, skill: 'builder' },
        { frame: 185, lemmingIdx: 1, skill: 'blocker' },
        { frame: 255, lemmingIdx: 0, skill: 'builder' },
        { frame: 385, lemmingIdx: 0, skill: 'builder' },
        { frame: 515, lemmingIdx: 0, skill: 'builder' },
        { frame: 750, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    {
      id: 'level_4_3',
      number: 12,
      title: 'Syncopated Descent',
      world: 4,
      worldName: 'Jungle Breakbeat Caves',
      scaleName: 'Minor Pentatonic (A, C, D, E, G)',
      scaleNotes: ['A2', 'C3', 'D3', 'E3', 'G3'],
      bpm: 160,
      password: 'SYNCOPATE',
      lemmings: 10,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      spawn: { x: 70, y: 50 },
      exit: { x: 420, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 4, basher: 0, miner: 5, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 80, 120, 40, T_NOTE_1);
        lvl.setRect(30, 40, 10, 50, T_NOTE_1);
        lvl.setRect(140, 115, 290, 20, T_NOTE_2);
      },
      demoScript: [
        { frame: 130, lemmingIdx: 0, skill: 'miner' }
      ]
    },

    // -------------------------------------------------------------
    // WORLD 5: GRAND ORCHESTRAL FINALE (Levels 5-1, 5-2, 5-3)
    // -------------------------------------------------------------
    {
      id: 'level_5_1',
      number: 13,
      title: 'Symphonic Ruins',
      world: 5,
      worldName: 'Grand Orchestral Finale',
      scaleName: 'Lydian Mode (F, G, A, B, C, D, E)',
      scaleNotes: ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
      bpm: 100,
      password: 'ALLEGRO',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 220,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 0, blocker: 0, builder: 5, basher: 5, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 390, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(190, 75, 40, 40, T_NOTE_2);
      },
      demoScript: [
        { frame: 178, lemmingIdx: 0, skill: 'basher' }
      ]
    },

    {
      id: 'level_5_2',
      number: 14,
      title: 'The Silence at the Gates',
      world: 5,
      worldName: 'Grand Orchestral Finale',
      scaleName: 'Lydian Mode (F, G, A, B, C, D, E)',
      scaleNotes: ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
      bpm: 100,
      password: 'REQUIEM',
      lemmings: 15,
      requiredPercent: 80,
      timeLimit: 240,
      releaseRate: 50,
      hasSilence: true,
      spawn: { x: 70, y: 70 },
      exit: { x: 440, y: 115 },
      skills: { climber: 0, floater: 0, bomber: 2, blocker: 2, builder: 6, basher: 0, miner: 0, digger: 0 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 120, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(90, 115, 35, 10, T_STEEL);
        lvl.setRect(210, 115, 240, 20, T_NOTE_2);
      },
      demoScript: [
        { frame: 130, lemmingIdx: 0, skill: 'builder' },
        { frame: 195, lemmingIdx: 1, skill: 'blocker' },
        { frame: 275, lemmingIdx: 0, skill: 'builder' },
        { frame: 420, lemmingIdx: 0, skill: 'builder' },
        { frame: 680, lemmingIdx: 1, skill: 'bomber' }
      ]
    },

    {
      id: 'level_5_3',
      number: 15,
      title: 'The Great Polyphonic Exit',
      world: 5,
      worldName: 'Grand Orchestral Finale',
      scaleName: 'Lydian Mode (F, G, A, B, C, D, E)',
      scaleNotes: ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
      bpm: 100,
      password: 'MAESTRO',
      lemmings: 20,
      requiredPercent: 85,
      timeLimit: 300,
      releaseRate: 50,
      spawn: { x: 70, y: 70 },
      exit: { x: 420, y: 85 },
      skills: { climber: 5, floater: 5, bomber: 2, blocker: 2, builder: 8, basher: 5, miner: 5, digger: 5 },
      generate: function(lvl) {
        lvl.setRect(40, 115, 120, 20, T_NOTE_1);
        lvl.setRect(30, 75, 10, 40, T_NOTE_1);
        lvl.setRect(90, 115, 35, 10, T_STEEL);
        lvl.setRect(160, 140, 50, 20, T_LAVA);
        lvl.setRect(210, 85, 240, 45, T_NOTE_2);
        lvl.setRect(310, 45, 35, 40, T_NOTE_3);
      },
      demoScript: [
        { frame: 125, lemmingIdx: 0, skill: 'builder' },
        { frame: 185, lemmingIdx: 1, skill: 'blocker' },
        { frame: 255, lemmingIdx: 0, skill: 'builder' },
        { frame: 385, lemmingIdx: 0, skill: 'builder' },
        { frame: 515, lemmingIdx: 0, skill: 'builder' },
        { frame: 755, lemmingIdx: 0, skill: 'basher' },
        { frame: 850, lemmingIdx: 1, skill: 'bomber' }
      ]
    }
  ];

  global.BEAT_TRIBE_LEVELS = LEVELS;
  global.T_AIR = T_AIR;
  global.T_NOTE_1 = T_NOTE_1;
  global.T_NOTE_2 = T_NOTE_2;
  global.T_NOTE_3 = T_NOTE_3;
  global.T_NOTE_4 = T_NOTE_4;
  global.T_NOTE_5 = T_NOTE_5;
  global.T_NOTE_6 = T_NOTE_6;
  global.T_NOTE_7 = T_NOTE_7;
  global.T_STEEL = T_STEEL;
  global.T_WATER = T_WATER;
  global.T_LAVA = T_LAVA;
  global.T_CRUSHER = T_CRUSHER;
  global.T_BRICK = T_BRICK;

})(typeof window !== 'undefined' ? window : global);
