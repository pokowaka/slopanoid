/* ============================================================================
 * js/levels.js
 * "THE CURSED PC GAMING MUSEUM" — 6 Scrolling Stages, 3-Layer Parallax Engine,
 * Tile Renderer, Environmental Contraptions & Parchment World Map Data
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});
  const pack = GNG.packRGB;
  const hex = GNG.hexToCol;

  const TILE_SIZE = 16;
  const LEVEL_ROWS = 13; // 13 * 16 = 208px (rows 11..12 = floor at y=176)

  const TILE = {
    EMPTY: 0,
    SOLID: 1,
    PLATFORM: 2,
    LADDER: 3,
    CRACKED: 4,
    GHOST_PLAT: 5,
    HAZARD: 6,
    CONV_LEFT: 7,
    CONV_RIGHT: 8,
    DRAWBRIDGE: 9,
    GATE: 10
  };

  // Classic Arcade Parchment World Map Metadata for all 6 Museum Stages
  const STAGE_META = [
    {
      id: 0,
      code: 'STAGE 1',
      title: "LECHUCK'S GHOST SHIP",
      subtitle: 'MELEE GRAVEYARD (1990)',
      parody: 'MONKEY ISLAND',
      music: 'stage1',
      mapX: 42,
      mapY: 146,
      skyTop: [10, 22, 36],
      skyBot: [24, 58, 66],
      moonCol: hex('#c4fff0'),
      tileMain: hex('#3c4a52'),
      tileHi: hex('#647b82'),
      tileDark: hex('#1e262b'),
      hazardTop: hex('#37e69b'),
      hazardBot: hex('#136e51'),
      shipRock: true,
      windX: -0.34,
      windRange: [640, 1220]
    },
    {
      id: 1,
      code: 'STAGE 2',
      title: 'HAUNTED MOAT OF DAVENTRY',
      subtitle: 'CURSED CASTLE GROUNDS (1984)',
      parody: "KING'S QUEST",
      music: 'stage2',
      mapX: 92,
      mapY: 108,
      skyTop: [12, 16, 34],
      skyBot: [32, 44, 68],
      moonCol: hex('#f5ecc6'),
      tileMain: hex('#4f5463'),
      tileHi: hex('#7c8396'),
      tileDark: hex('#282b36'),
      hazardTop: hex('#3898d4'),
      hazardBot: hex('#173b66'),
      shipRock: false,
      windX: 0,
      windRange: [0, 0]
    },
    {
      id: 2,
      code: 'STAGE 3',
      title: 'JAFFAR SPIKE CATACOMBS',
      subtitle: 'SANDSTONE SLICER DUNGEON (1989)',
      parody: 'PRINCE OF PERSIA',
      music: 'stage3',
      mapX: 144,
      mapY: 142,
      skyTop: [22, 14, 12],
      skyBot: [56, 34, 22],
      moonCol: hex('#ffd584'),
      tileMain: hex('#7a5939'),
      tileHi: hex('#b08657'),
      tileDark: hex('#422d19'),
      hazardTop: hex('#d9dfe8'),
      hazardBot: hex('#646d7a'),
      shipRock: false,
      windX: -0.32,
      windRange: [880, 1260]
    },
    {
      id: 3,
      code: 'STAGE 4',
      title: 'LEMMINGS CRUSHER FOUNDRY',
      subtitle: 'PISTON & CONVEYOR WORKS (1991)',
      parody: 'LEMMINGS',
      music: 'stage4',
      mapX: 194,
      mapY: 98,
      skyTop: [26, 12, 10],
      skyBot: [68, 26, 14],
      moonCol: hex('#ff9c45'),
      tileMain: hex('#594c47'),
      tileHi: hex('#8c796d'),
      tileDark: hex('#2e2522'),
      hazardTop: hex('#ff8c26'),
      hazardBot: hex('#a82811'),
      shipRock: false,
      windX: 0,
      windRange: [0, 0]
    },
    {
      id: 4,
      code: 'STAGE 5',
      title: 'PHOBOS E1M1 NECROPOLIS',
      subtitle: 'NUKAGE HANGAR & ARREMER LAIR (1993)',
      parody: 'DOOM',
      music: 'stage5',
      mapX: 242,
      mapY: 132,
      skyTop: [42, 12, 12],
      skyBot: [88, 28, 18],
      moonCol: hex('#ff684d'),
      tileMain: hex('#435442'),
      tileHi: hex('#6c8768'),
      tileDark: hex('#212b20'),
      hazardTop: hex('#66ff38'),
      hazardBot: hex('#237814'),
      shipRock: false,
      windX: 0,
      windRange: [0, 0]
    },
    {
      id: 5,
      code: 'STAGE 6',
      title: 'THRONE OF ASTAROTH-9000',
      subtitle: 'SANCTUM OF THE CURSED FLOPPY',
      parody: 'FINAL CITADEL',
      music: 'boss',
      mapX: 282,
      mapY: 66,
      skyTop: [28, 6, 8],
      skyBot: [72, 16, 16],
      moonCol: hex('#ff3d33'),
      tileMain: hex('#4a3333'),
      tileHi: hex('#805454'),
      tileDark: hex('#241616'),
      hazardTop: hex('#ff4f2b'),
      hazardBot: hex('#8f150d'),
      shipRock: false,
      windX: 0,
      windRange: [0, 0]
    }
  ];

  // Helper to stamp tiles cleanly into a stage grid
  class GridBuilder {
    constructor(cols) {
      this.cols = cols;
      this.rows = LEVEL_ROWS;
      this.grid = new Uint8Array(cols * LEVEL_ROWS);
      this.contraptions = [];
      this.chests = [];
      this.spawns = [];
      this.barrels = [];
      this.props = [];
    }

    set(c, r, t) {
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
      this.grid[r * this.cols + c] = t;
    }

    get(c, r) {
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return TILE.EMPTY;
      return this.grid[r * this.cols + c];
    }

    fillRect(c0, r0, w, h, t) {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          this.set(c, r, t);
        }
      }
    }

    ground(c0, c1, tileType) {
      const t = tileType || TILE.SOLID;
      for (let c = c0; c <= c1; c++) {
        this.set(c, 11, t);
        this.set(c, 12, TILE.SOLID);
      }
    }

    pitHazard(c0, c1) {
      for (let c = c0; c <= c1; c++) {
        this.set(c, 11, TILE.EMPTY);
        this.set(c, 12, TILE.HAZARD);
      }
    }

    platform(c0, c1, r, tileType) {
      const t = tileType || TILE.PLATFORM;
      for (let c = c0; c <= c1; c++) {
        this.set(c, r, t);
      }
    }

    ladder(c, rTop, rBot) {
      for (let r = rTop; r <= rBot; r++) {
        this.set(c, r, TILE.LADDER);
      }
    }

    addChest(c, r, kind, weaponDrop) {
      // kind: 'normal' | 'spectral' | 'magician'
      this.chests.push({
        id: this.chests.length,
        x: c * TILE_SIZE + 1,
        y: r * TILE_SIZE - 9,
        kind: kind || 'normal',
        weapon: weaponDrop || null,
        opened: false,
        revealed: kind !== 'spectral'
      });
    }

    addEnemy(c, r, type, extra) {
      this.spawns.push(
        Object.assign(
          {
            x: c * TILE_SIZE + 2,
            y: r * TILE_SIZE - 16,
            type,
            spawned: false
          },
          extra || {}
        )
      );
    }

    addPlate(c, r, opts) {
      this.contraptions.push(
        Object.assign(
          {
            kind: 'plate',
            x: c * TILE_SIZE,
            y: r * TILE_SIZE - 3,
            w: 16,
            h: 4,
            pressed: false,
            triggeredOnce: false
          },
          opts || {}
        )
      );
    }

    addSlicer(c, rTop, period, phase) {
      this.contraptions.push({
        kind: 'slicer',
        x: c * TILE_SIZE + 2,
        y: rTop * TILE_SIZE,
        w: 12,
        h: 32,
        period: period || 110,
        phase: phase || 0,
        closedRatio: 0
      });
    }

    addCrusher(c, rTop, rBot, period, phase) {
      this.contraptions.push({
        kind: 'crusher',
        x: c * TILE_SIZE,
        yTop: rTop * TILE_SIZE,
        yBot: rBot * TILE_SIZE,
        y: rTop * TILE_SIZE,
        w: 24,
        h: 18,
        period: period || 120,
        phase: phase || 0,
        slamming: false
      });
    }
  }

  function buildStage(stageIdx) {
    const meta = STAGE_META[stageIdx];
    const cols = stageIdx === 5 ? 68 : stageIdx === 4 ? 100 : 96;
    const b = new GridBuilder(cols);

    // Base ground across stage
    b.ground(0, cols - 1, TILE.SOLID);

    if (stageIdx === 0) {
      // ======================================================================
      // STAGE 1: LeChuck's Ghost Ship & Melee Graveyard (Monkey Island)
      // ======================================================================
      // Graveyard tombs & upper crypt tier
      b.platform(8, 15, 8, TILE.PLATFORM);
      b.ladder(14, 8, 10);
      b.addChest(10, 8, 'normal', 'DAGGER');

      // Cracked Crypt Floor leading to secret underground Magician Chest vault!
      b.fillRect(19, 12, 7, 1, TILE.SOLID);
      b.fillRect(18, 9, 1, 3, TILE.SOLID);
      b.fillRect(26, 9, 1, 3, TILE.SOLID);
      b.platform(20, 24, 9, TILE.PLATFORM);
      // Carve small crypt recess at row 11 with Cracked Floor lid at row 9
      for (let c = 20; c <= 24; c++) {
        b.set(c, 9, TILE.CRACKED);
        b.set(c, 11, TILE.SOLID);
      }
      b.addChest(22, 11, 'magician', 'TORCH'); // Secret Magician Chest -> GOLDEN ARMOR!

      // Spectral Ghost Rigging leading to high Crow's Nest
      b.platform(29, 32, 7, TILE.GHOST_PLAT);
      b.platform(34, 38, 6, TILE.PLATFORM);
      b.addChest(36, 6, 'spectral', 'CROSS');

      // Sea channel before boarding LeChuck's Ghost Galleon
      b.pitHazard(40, 44);
      b.platform(41, 43, 10, TILE.DRAWBRIDGE);

      // Ghost Ship Boarding & Upper Poop Deck (cols 45..82)
      b.platform(48, 56, 8, TILE.PLATFORM);
      b.ladder(49, 8, 10);
      b.addChest(53, 8, 'normal', 'AXE');

      // Ship Hold Cracked Planks + Pressure Plate bonus
      b.platform(60, 66, 7, TILE.PLATFORM);
      b.set(62, 7, TILE.CRACKED);
      b.set(63, 7, TILE.CRACKED);
      b.addPlate(64, 11, { spawnPotion: true });

      b.pitHazard(69, 72);
      b.platform(70, 71, 9, TILE.GHOST_PLAT);
      b.platform(68, 73, 7, TILE.PLATFORM);
      b.addChest(76, 11, 'normal', 'LANCE');

      // Boss Quarterdeck platforms (cols 82..94)
      b.platform(83, 86, 8, TILE.PLATFORM);
      b.platform(90, 93, 8, TILE.PLATFORM);

      // Enemies: Zombie Buccaneers, Voodoo Skulls & Crow's-Nest Skeletons
      b.addEnemy(11, 11, 'zombie', { pirate: true });
      b.addEnemy(16, 11, 'zombie', { pirate: true, potWeapon: 'TORCH' });
      b.addEnemy(23, 9, 'skeleton');
      b.addEnemy(30, 8, 'voodooSkull');
      b.addEnemy(36, 6, 'skeleton');
      b.addEnemy(47, 11, 'zombie', { pirate: true });
      b.addEnemy(52, 8, 'skeleton', { potWeapon: 'CROSS' });
      b.addEnemy(58, 9, 'voodooSkull');
      b.addEnemy(63, 11, 'hauntedArmor');
      b.addEnemy(66, 7, 'voodooSkull');
      b.addEnemy(75, 8, 'arremer', { statue: true });
      b.addEnemy(79, 11, 'zombie', { pirate: true });

      b.checkpointX = 46 * TILE_SIZE;
      b.bossTriggerX = 80 * TILE_SIZE;
      b.bossType = 'lechuck';
    } else if (stageIdx === 1) {
      // ======================================================================
      // STAGE 2: The Haunted Moat of Daventry (King's Quest)
      // ======================================================================
      // Wide lethal Daventry cursed moat sections with collapsing drawbridges!
      b.pitHazard(10, 17);
      b.platform(11, 13, 10, TILE.DRAWBRIDGE);
      b.platform(15, 16, 10, TILE.DRAWBRIDGE);
      b.platform(12, 15, 7, TILE.GHOST_PLAT);
      b.addChest(13, 7, 'spectral', 'CROSS');

      // Castle outer gatehouse with ladder & gargoyle perch
      b.platform(20, 28, 7, TILE.PLATFORM);
      b.ladder(21, 7, 10);
      b.ladder(27, 7, 10);
      b.addChest(24, 7, 'normal', 'TORCH');

      // Pressure Plate Drawbridge Puzzle: Weigh down plate at col 31 with Ejected
      // Steel Armor to open Portcullis Gate at col 35 & reveal Magician Chest!
      b.fillRect(35, 8, 1, 3, TILE.GATE);
      b.fillRect(34, 7, 6, 1, TILE.SOLID);
      b.addPlate(31, 11, { gateCol: 35, gateRows: [8, 9, 10], spawnPotion: true });
      b.addChest(37, 11, 'magician', 'AXE');
      b.platform(33, 39, 7, TILE.PLATFORM); // Alternate upper battlement route!

      // Second Great Moat Crossing
      b.pitHazard(42, 53);
      b.platform(43, 45, 10, TILE.DRAWBRIDGE);
      b.platform(47, 49, 9, TILE.PLATFORM);
      b.platform(51, 52, 10, TILE.DRAWBRIDGE);
      b.platform(46, 50, 6, TILE.GHOST_PLAT);

      // Inner Keep Cracked Masonry Vault
      b.platform(57, 65, 8, TILE.PLATFORM);
      b.set(60, 8, TILE.CRACKED);
      b.set(61, 8, TILE.CRACKED);
      b.addChest(61, 11, 'normal', 'DAGGER');

      b.pitHazard(68, 73);
      b.platform(69, 72, 9, TILE.DRAWBRIDGE);
      b.addChest(76, 11, 'normal', 'LANCE');

      // Boss Battlements
      b.platform(83, 86, 8, TILE.PLATFORM);
      b.platform(89, 92, 7, TILE.PLATFORM);

      // Enemies
      b.addEnemy(8, 11, 'zombie');
      b.addEnemy(15, 9, 'voodooSkull');
      b.addEnemy(24, 7, 'arremer', { statue: true });
      b.addEnemy(30, 11, 'skeleton', { potWeapon: 'AXE' });
      b.addEnemy(38, 7, 'arremer', { statue: true });
      b.addEnemy(48, 9, 'skeleton');
      b.addEnemy(55, 11, 'hauntedArmor');
      b.addEnemy(62, 8, 'zombie', { potWeapon: 'CROSS' });
      b.addEnemy(66, 11, 'hauntedArmor');
      b.addEnemy(75, 8, 'arremer', { statue: true });

      b.checkpointX = 54 * TILE_SIZE;
      b.bossTriggerX = 80 * TILE_SIZE;
      b.bossType = 'dragon';
    } else if (stageIdx === 2) {
      // ======================================================================
      // STAGE 3: The Jaffar Spike Catacombs (Prince of Persia)
      // ======================================================================
      // Chomping Iron Slicer Gates + Pressure-Plate Potions & Gates + Sword Skeletons
      b.fillRect(0, 2, cols, 1, TILE.SOLID); // Dungeon ceiling archwork

      b.platform(8, 16, 8, TILE.PLATFORM);
      b.ladder(8, 8, 10);
      b.addSlicer(12, 9, 105, 0);
      b.addSlicer(14, 6, 95, 45);
      b.addChest(15, 8, 'normal', 'AXE'); // Axe pierces Sword Skeleton shields!

      // Spike Pit + Spectral Vision Bridge
      b.pitHazard(19, 23);
      b.platform(20, 22, 9, TILE.GHOST_PLAT);
      b.platform(19, 23, 6, TILE.PLATFORM);

      // Classic Prince of Persia Pressure-Plate Gate + Potion Pedestal!
      b.fillRect(31, 8, 1, 3, TILE.GATE);
      b.fillRect(30, 7, 4, 1, TILE.SOLID);
      b.addPlate(27, 11, { gateCol: 31, gateRows: [8, 9, 10], spawnPotion: true });
      b.platform(28, 34, 6, TILE.PLATFORM);
      b.ladder(26, 6, 10);
      b.addSlicer(30, 4, 100, 20);

      // Hidden Cracked Catacomb Vault -> Magician Chest!
      b.platform(37, 44, 8, TILE.PLATFORM);
      b.set(40, 8, TILE.CRACKED);
      b.set(41, 8, TILE.CRACKED);
      b.addChest(41, 11, 'magician', 'CROSS');

      // Double Slicer Corridor + Spike Trench
      b.addSlicer(48, 9, 96, 0);
      b.addSlicer(52, 9, 96, 48);
      b.pitHazard(56, 60);
      b.platform(57, 59, 9, TILE.DRAWBRIDGE);

      b.platform(63, 72, 7, TILE.PLATFORM);
      b.ladder(63, 7, 10);
      b.ladder(72, 7, 10);
      b.addPlate(67, 7, { spawnPotion: true });
      b.addChest(69, 7, 'spectral', 'TORCH');
      b.addChest(76, 11, 'normal', 'LANCE');

      // Boss Palace Arena
      b.platform(83, 86, 8, TILE.PLATFORM);
      b.platform(90, 93, 8, TILE.PLATFORM);

      // Enemies: Skeleton Swordsmen, Haunted Guards, Skulls
      b.addEnemy(10, 11, 'skelSword');
      b.addEnemy(15, 8, 'skelSword', { potWeapon: 'AXE' });
      b.addEnemy(22, 6, 'voodooSkull');
      b.addEnemy(29, 11, 'skelSword');
      b.addEnemy(39, 8, 'skeleton');
      b.addEnemy(43, 11, 'hauntedArmor');
      b.addEnemy(50, 11, 'zombie');
      b.addEnemy(65, 7, 'skelSword', { potWeapon: 'DAGGER' });
      b.addEnemy(70, 11, 'arremer', { statue: false });
      b.addEnemy(75, 11, 'skelSword');

      b.checkpointX = 46 * TILE_SIZE;
      b.bossTriggerX = 80 * TILE_SIZE;
      b.bossType = 'jaffar';
    } else if (stageIdx === 3) {
      // ======================================================================
      // STAGE 4: The Lemmings Crusher Foundry (Lemmings)
      // ======================================================================
      // Conveyor Belts + Industrial Piston Crushers + Exploding Lemming Blockers!
      b.ground(8, 16, TILE.CONV_RIGHT);
      b.addCrusher(11, 4, 10, 108, 0);
      b.addCrusher(15, 4, 10, 108, 54);
      b.platform(9, 16, 4, TILE.SOLID);

      // Molten vat + Conveyor jump
      b.pitHazard(19, 23);
      b.platform(20, 22, 9, TILE.CONV_LEFT);
      b.addChest(25, 11, 'normal', 'TORCH');

      // Multi-tier Foundry Catwalks with Lemming Blockers
      b.platform(28, 38, 8, TILE.CONV_LEFT);
      b.ladder(28, 8, 10);
      b.ladder(38, 8, 10);
      b.set(33, 8, TILE.CRACKED);
      b.set(34, 8, TILE.CRACKED);
      b.addChest(33, 11, 'magician', 'AXE'); // Magician Chest under cracked grate!

      // Triple Piston Stamping Press
      b.ground(42, 54, TILE.CONV_RIGHT);
      b.platform(41, 55, 4, TILE.SOLID);
      b.addCrusher(44, 5, 10, 96, 0);
      b.addCrusher(48, 5, 10, 96, 32);
      b.addCrusher(52, 5, 10, 96, 64);

      // Spectral Catwalk over Molten Iron Vat
      b.pitHazard(57, 63);
      b.platform(58, 62, 9, TILE.PLATFORM);
      b.platform(58, 62, 6, TILE.GHOST_PLAT);
      b.addChest(60, 6, 'spectral', 'CROSS');

      b.ground(66, 75, TILE.CONV_LEFT);
      b.addPlate(70, 11, { spawnPotion: true });
      b.addChest(77, 11, 'normal', 'DAGGER');

      // Forgemaster Boss Arena
      b.platform(83, 86, 8, TILE.PLATFORM);
      b.platform(90, 93, 8, TILE.PLATFORM);

      // Enemies: Exploding Lemming Blockers, Skeletons, Gargoyles
      b.addEnemy(9, 11, 'lemming');
      b.addEnemy(18, 11, 'skeleton', { potWeapon: 'CROSS' });
      b.addEnemy(31, 8, 'lemming');
      b.addEnemy(36, 8, 'lemming');
      b.addEnemy(35, 11, 'zombie');
      b.addEnemy(46, 11, 'lemming');
      b.addEnemy(55, 11, 'hauntedArmor');
      b.addEnemy(60, 9, 'arremer', { statue: false });
      b.addEnemy(68, 11, 'lemming');
      b.addEnemy(73, 11, 'skeleton', { potWeapon: 'LANCE' });

      b.checkpointX = 56 * TILE_SIZE;
      b.bossTriggerX = 80 * TILE_SIZE;
      b.bossType = 'forgemaster';
    } else if (stageIdx === 4) {
      // ======================================================================
      // STAGE 5: Phobos E1M1 Necropolis (DOOM)
      // ======================================================================
      // Toxic Nukage Slime Pits + Exploding Barrels + Cyber-Imps +
      // Intelligent Red Arremer Mini-Boss Sentinel!
      b.pitHazard(10, 15);
      b.platform(11, 14, 9, TILE.PLATFORM);
      b.barrels.push({ x: 17 * TILE_SIZE, y: 11 * TILE_SIZE - 11, hp: 1 });
      b.addChest(19, 11, 'normal', 'DAGGER');

      // Zig-Zag E1M1 Nukage Pool Walkways
      b.pitHazard(22, 35);
      b.platform(23, 26, 9, TILE.PLATFORM);
      b.platform(28, 31, 8, TILE.PLATFORM);
      b.platform(32, 34, 9, TILE.PLATFORM);
      // Secret IDSPISPOPD Ghost Shortcut + Magician Chest!
      b.platform(25, 30, 5, TILE.GHOST_PLAT);
      b.addChest(28, 5, 'magician', 'CROSS');

      b.barrels.push({ x: 38 * TILE_SIZE, y: 11 * TILE_SIZE - 11, hp: 1 });
      b.barrels.push({ x: 42 * TILE_SIZE, y: 11 * TILE_SIZE - 11, hp: 1 });

      // Mid-Stage Arena (cols 46..60): Intelligent Red Arremer Gargoyle Mini-Boss!
      b.platform(47, 50, 8, TILE.PLATFORM);
      b.platform(55, 58, 8, TILE.PLATFORM);
      b.addEnemy(54, 7, 'arremerElite', { miniBoss: true });
      b.addChest(60, 11, 'normal', 'LANCE');

      // Second Nukage Processing Wing
      b.pitHazard(64, 71);
      b.platform(65, 67, 9, TILE.DRAWBRIDGE);
      b.platform(69, 70, 8, TILE.PLATFORM);
      b.set(74, 11, TILE.CRACKED);
      b.addPlate(76, 11, { spawnPotion: true });
      b.barrels.push({ x: 79 * TILE_SIZE, y: 11 * TILE_SIZE - 11, hp: 1 });
      b.addChest(81, 11, 'normal', 'AXE');

      // Exit Hangar Boss Arena (cols 86..98)
      b.platform(87, 90, 8, TILE.PLATFORM);
      b.platform(94, 97, 8, TILE.PLATFORM);

      // Enemies: Cyber-Imps, Shotgun Skeletons, Toxic Zombies, Haunted Marines
      b.addEnemy(8, 11, 'cyberImp');
      b.addEnemy(16, 11, 'zombie');
      b.addEnemy(25, 9, 'cyberImp');
      b.addEnemy(30, 8, 'cyberImp', { potWeapon: 'TORCH' });
      b.addEnemy(39, 11, 'skeleton');
      b.addEnemy(43, 11, 'hauntedArmor');
      b.addEnemy(66, 9, 'cyberImp');
      b.addEnemy(73, 11, 'hauntedArmor');
      b.addEnemy(78, 11, 'cyberImp', { potWeapon: 'LANCE' });

      b.checkpointX = 60 * TILE_SIZE;
      b.bossTriggerX = 84 * TILE_SIZE;
      b.bossType = 'cyberbaron';
    } else {
      // ======================================================================
      // STAGE 6: Throne of Astaroth-LeChuck-9000 (Final Boss Citadel)
      // ======================================================================
      // Short dramatic Armory Gauntlet -> Multi-Phase Final Boss Arena!
      b.platform(6, 11, 8, TILE.PLATFORM);
      b.ladder(6, 8, 10);
      b.addChest(8, 8, 'normal', 'LANCE');
      b.addChest(13, 11, 'normal', 'CROSS');

      // Secret Cracked Obsidian Floor + Spectral Altar with Magician Chest!
      b.platform(17, 23, 7, TILE.PLATFORM);
      b.set(19, 7, TILE.CRACKED);
      b.set(20, 7, TILE.CRACKED);
      b.platform(18, 22, 4, TILE.GHOST_PLAT);
      b.addChest(20, 4, 'magician', 'AXE');
      b.addChest(25, 11, 'normal', 'DAGGER');
      b.addPlate(28, 11, { spawnPotion: true });

      b.pitHazard(31, 34);
      b.platform(32, 33, 9, TILE.PLATFORM);
      b.addChest(37, 11, 'normal', 'TORCH');

      // Elite Honor Guard before Throne
      b.addEnemy(11, 11, 'hauntedArmor');
      b.addEnemy(21, 7, 'cyberImp');
      b.addEnemy(27, 11, 'arremer', { statue: false });
      b.addEnemy(36, 11, 'skelSword');

      // Grand Throne Arena (cols 48..67 = exact 320px screen!)
      b.platform(50, 54, 8, TILE.PLATFORM);
      b.platform(56, 59, 6, TILE.GHOST_PLAT);
      b.platform(61, 65, 8, TILE.PLATFORM);

      b.checkpointX = 36 * TILE_SIZE;
      b.bossTriggerX = 48 * TILE_SIZE;
      b.bossType = 'astaroth9000';
    }

    // Build dynamic runtime drawbridge state map
    const drawbridges = new Map();
    for (let r = 0; r < LEVEL_ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        if (b.get(c, r) === TILE.DRAWBRIDGE) {
          drawbridges.set(r * cols + c, { state: 'idle', timer: 0 });
        }
      }
    }

    return {
      idx: stageIdx,
      meta,
      cols,
      rows: LEVEL_ROWS,
      widthPx: cols * TILE_SIZE,
      grid: b.grid,
      contraptions: b.contraptions,
      chests: b.chests,
      spawns: b.spawns,
      barrels: b.barrels,
      drawbridges,
      checkpointX: b.checkpointX,
      bossTriggerX: b.bossTriggerX,
      bossType: b.bossType
    };
  }

  // --- 3-LAYER PARALLAX BACKGROUND + FOREGROUND TILE RENDERER ---
  function renderParallaxAndTiles(fb, level, camX, frame, spectralVision, lightningFlash) {
    const meta = level.meta;
    const shipOffset = meta.shipRock && camX > 520 ? Math.sin(frame * 0.05) * 2.5 : 0;

    // LAYER 0: Far Sky Gradient + Moon + Drifting Clouds (0.12x Parallax)
    fb.ditherGradientV(0, 22, 320, 156, meta.skyTop, meta.skyBot);

    const moonX = (250 - ((camX * 0.08) | 0)) % 360;
    fb.circle(moonX < -20 ? moonX + 360 : moonX, 50, 16, meta.moonCol);
    fb.circle((moonX < -20 ? moonX + 360 : moonX) + 5, 47, 13, pack(meta.skyTop[0] + 10, meta.skyTop[1] + 14, meta.skyTop[2] + 18));

    // Drifting EGA clouds
    const cloudCol = pack(meta.skyBot[0] + 16, meta.skyBot[1] + 18, meta.skyBot[2] + 22);
    for (let i = 0; i < 5; i++) {
      const cx = (((i * 92 - ((camX * 0.14 + frame * 0.25) | 0)) % 380) + 380) % 380 - 40;
      const cy = 36 + (i % 3) * 14;
      fb.rect(cx, cy, 38, 4, cloudCol);
      fb.rect(cx + 6, cy - 3, 24, 3, cloudCol);
    }

    // Dynamic Forked Gothic Lightning Bolt
    if (lightningFlash > 0.35) {
      const boltX = 70 + ((frame * 37) % 190);
      fb.lightningBolt(boltX, 22, boltX + ((frame & 1) ? 18 : -18), 140, frame >> 1, hex('#ffffff'), 140, 220, 255);
    }

    // Distant Silhouette Horizon Hills / Castle Spires (0.22x Parallax)
    const farCol = pack(
      Math.max(4, meta.skyTop[0] - 4),
      Math.max(5, meta.skyTop[1] - 4),
      Math.max(8, meta.skyTop[2] - 2)
    );
    for (let sx = -32; sx < 352; sx += 32) {
      const worldIdx = Math.floor((sx + camX * 0.22) / 32);
      const drawX = sx - ((camX * 0.22) % 32);
      const h = 24 + ((Math.abs(worldIdx * 19 + 7) % 4) * 10);
      fb.rect(drawX, 176 - h, 32, h, farCol);
      if ((worldIdx & 1) === 0) {
        fb.rect(drawX + 10, 176 - h - 12, 12, 12, farCol);
        fb.rect(drawX + 14, 176 - h - 18, 4, 6, farCol);
      }
    }

    // LAYER 1: Midground Stage-Specific Architecture (0.48x Parallax)
    const midCol = pack(
      (meta.skyBot[0] * 0.45) | 0,
      (meta.skyBot[1] * 0.45) | 0,
      (meta.skyBot[2] * 0.48) | 0
    );
    const midHi = pack(
      Math.min(255, ((meta.skyBot[0] * 0.65) | 0) + 12),
      Math.min(255, ((meta.skyBot[1] * 0.65) | 0) + 12),
      Math.min(255, ((meta.skyBot[2] * 0.68) | 0) + 14)
    );
    for (let sx = -64; sx < 384; sx += 64) {
      const idx = Math.floor((sx + camX * 0.48) / 64);
      const dx = (sx - ((camX * 0.48) % 64)) | 0;
      const my = (shipOffset * 0.6) | 0;

      if (level.idx === 0) {
        // Stage 1: Haunted Graveyard Iron Fences -> Ghost Ship Masts & Tattered Sails
        if (idx >= 3) {
          fb.rect(dx + 28, 42 + my, 5, 134, midCol);
          fb.rect(dx + 8, 56 + my, 46, 3, midHi);
          fb.rect(dx + 12, 59 + my, 38, 26, midCol);
          fb.rect(dx + 20, 85 + my, 12, 10, midCol);
        } else {
          fb.rect(dx + 14, 136, 18, 40, midCol);
          fb.rect(dx + 18, 128, 10, 8, midHi);
        }
      } else if (level.idx === 1) {
        // Stage 2: Daventry Gothic Battlement Towers & Dead Willows
        fb.rect(dx + 12, 82, 34, 94, midCol);
        fb.rect(dx + 10, 76, 8, 6, midHi);
        fb.rect(dx + 24, 76, 8, 6, midHi);
        fb.rect(dx + 38, 76, 8, 6, midHi);
        fb.rect(dx + 25, 98, 8, 18, hex('#d4a93b'));
      } else if (level.idx === 2) {
        // Stage 3: Jaffar Palace Sandstone Columns & Flickering Wall Torches
        fb.rect(dx + 22, 38, 14, 138, midCol);
        fb.rect(dx + 18, 38, 22, 6, midHi);
        const flick = (frame + idx * 7) & 3;
        fb.rect(dx + 28, 92, 3, 8, hex('#6e4720'));
        fb.circle(dx + 29, 89 - (flick & 1), 3, flick === 0 ? hex('#fff29c') : hex('#ff8426'));
      } else if (level.idx === 3) {
        // Stage 4: Lemmings Giant Rotating Cogwheels & Smelting Furnaces
        fb.circle(dx + 32, 108, 20, midCol);
        fb.circle(dx + 32, 108, 9, pack(meta.skyTop[0], meta.skyTop[1], meta.skyTop[2]));
        const ang = frame * 0.03 * (idx & 1 ? 1 : -1);
        for (let k = 0; k < 6; k++) {
          const tx = dx + 32 + Math.cos(ang + k * 1.047) * 21;
          const ty = 108 + Math.sin(ang + k * 1.047) * 21;
          fb.rect(tx - 2, ty - 2, 5, 5, midHi);
        }
      } else if (level.idx === 4) {
        // Stage 5: Phobos UAC Tech Pillars & Radioactive Slime Conduits
        fb.rect(dx + 16, 48, 28, 128, midCol);
        fb.rect(dx + 26, 48, 8, 128, hex('#236b19'));
        const dripY = 52 + ((frame * 2 + idx * 19) % 118);
        fb.rect(dx + 28, dripY, 4, 7, hex('#70ff40'));
      } else {
        // Stage 6: Petrified CRT Monitors & Ribcage Demon Pillars
        fb.rect(dx + 18, 52, 24, 124, midCol);
        fb.rect(dx + 14, 110, 32, 24, midHi);
        fb.rect(dx + 17, 113, 26, 18, (frame + idx * 9) % 24 < 20 ? hex('#3b1212') : hex('#ff3d33'));
      }
    }

    // LAYER 2: Playfield Tiles (1.0x Scroll)
    const cStart = Math.max(0, (camX / TILE_SIZE) | 0);
    const cEnd = Math.min(level.cols - 1, ((camX + 320) / TILE_SIZE + 1) | 0);

    for (let r = 0; r < LEVEL_ROWS; r++) {
      for (let c = cStart; c <= cEnd; c++) {
        const t = level.grid[r * level.cols + c];
        if (t === TILE.EMPTY) continue;

        const sx = (c * TILE_SIZE - camX) | 0;
        let sy = r * TILE_SIZE;
        if (meta.shipRock && c >= 45) {
          sy += shipOffset | 0;
        }

        if (t === TILE.SOLID) {
          fb.rect(sx, sy, 16, 16, meta.tileMain);
          fb.rect(sx, sy, 16, 2, meta.tileHi);
          fb.rect(sx, sy + 14, 16, 2, meta.tileDark);
          fb.rect(sx + ((r & 1) ? 7 : 15), sy + 2, 1, 12, meta.tileDark);
        } else if (t === TILE.PLATFORM) {
          fb.rect(sx, sy, 16, 6, meta.tileMain);
          fb.rect(sx, sy, 16, 2, meta.tileHi);
          fb.rect(sx + 2, sy + 6, 3, 3, meta.tileDark);
          fb.rect(sx + 11, sy + 6, 3, 3, meta.tileDark);
        } else if (t === TILE.LADDER) {
          const wood = hex('#b87a3d');
          const darkWood = hex('#633c17');
          fb.rect(sx + 2, sy, 2, 16, wood);
          fb.rect(sx + 12, sy, 2, 16, wood);
          for (let ry = 2; ry < 16; ry += 4) {
            fb.rect(sx + 4, sy + ry, 8, 2, ry & 4 ? wood : darkWood);
          }
        } else if (t === TILE.CRACKED) {
          fb.rect(sx, sy, 16, 10, hex('#876c56'));
          fb.rect(sx, sy, 16, 2, hex('#bfa084'));
          // Visible fracture lines telling Steel-Armored Arthur he can smash it!
          fb.line(sx + 3, sy + 1, sx + 8, sy + 6, hex('#1a120d'));
          fb.line(sx + 8, sy + 6, sx + 6, sy + 9, hex('#1a120d'));
          fb.line(sx + 8, sy + 5, sx + 13, sy + 8, hex('#1a120d'));
        } else if (t === TILE.GHOST_PLAT) {
          if (spectralVision) {
            const pulse = (frame >> 2) & 1;
            fb.rect(sx, sy, 16, 5, pulse ? hex('#33d9e6') : hex('#1f8fa8'));
            fb.rect(sx + 1, sy + 1, 14, 2, hex('#b8ffff'));
            if (((c + (frame >> 3)) & 1) === 0) {
              fb.pset(sx + 7, sy - 2, hex('#8cf7ff'));
            }
          } else if (((frame + c * 17) & 31) === 0) {
            // Subtle spectral dust hint in Steel Armor
            fb.pset(sx + 8, sy + 2, hex('#4c8591'));
          }
        } else if (t === TILE.HAZARD) {
          const wave = ((Math.sin(frame * 0.14 + c * 0.9) * 2) | 0);
          if (level.idx === 2) {
            // Stage 3 Iron Pit Spikes
            for (let sp = 0; sp < 16; sp += 4) {
              fb.line(sx + sp + 2, sy - 6, sx + sp, sy + 8, hex('#cfd6e0'));
              fb.line(sx + sp + 2, sy - 6, sx + sp + 3, sy + 8, hex('#6c7685'));
            }
          } else {
            // Animated Cursed Water / Molten Iron / Nukage Slime
            fb.rect(sx, sy - 6 + wave, 16, 22, meta.hazardBot);
            fb.rect(sx, sy - 6 + wave, 16, 3, meta.hazardTop);
            if (((frame + c * 11) & 15) < 4) {
              fb.pset(sx + 6, sy - 8 + wave, hex('#ffffff'));
            }
          }
        } else if (t === TILE.CONV_LEFT || t === TILE.CONV_RIGHT) {
          fb.rect(sx, sy, 16, 12, hex('#3b404a'));
          fb.rect(sx, sy, 16, 2, hex('#d9a438'));
          fb.rect(sx, sy + 10, 16, 2, hex('#1c1f24'));
          const dir = t === TILE.CONV_RIGHT ? 1 : -1;
          const tread = (((frame * dir) >> 1) & 3);
          for (let tx = tread; tx < 16; tx += 4) {
            fb.rect(sx + tx, sy + 3, 2, 6, hex('#8d97a8'));
          }
        } else if (t === TILE.DRAWBRIDGE) {
          const st = level.drawbridges.get(r * level.cols + c);
          if (!st || st.state !== 'gone') {
            const jitter = st && st.state === 'shaking' ? ((frame & 1) ? 1 : -1) : 0;
            fb.rect(sx + jitter, sy, 16, 6, hex('#8f5929'));
            fb.rect(sx + jitter, sy, 16, 2, hex('#c7884a'));
            fb.rect(sx + 3 + jitter, sy + 2, 2, 4, hex('#4a2b10'));
            fb.rect(sx + 11 + jitter, sy + 2, 2, 4, hex('#4a2b10'));
          }
        } else if (t === TILE.GATE) {
          fb.rect(sx + 3, sy, 2, 16, hex('#9da6b5'));
          fb.rect(sx + 7, sy, 2, 16, hex('#cfd7e6'));
          fb.rect(sx + 11, sy, 2, 16, hex('#9da6b5'));
          fb.rect(sx + 1, sy + 6, 14, 2, hex('#5c6370'));
        }
      }
    }

    // Render Stage Contraptions (Pressure Plates, Slicer Gates, Piston Crushers)
    for (const con of level.contraptions) {
      const cx = (con.x - camX) | 0;
      if (cx < -32 || cx > 352) continue;

      if (con.kind === 'plate') {
        const py = con.pressed ? con.y + 2 : con.y;
        fb.rect(cx, py, con.w, con.pressed ? 2 : 4, con.pressed ? hex('#5af084') : hex('#e6b647'));
        fb.rect(cx - 1, con.y + 3, con.w + 2, 2, hex('#2e333d'));
      } else if (con.kind === 'slicer') {
        // Chomping Jaffar Iron Slicer Jaws!
        const jawH = (4 + con.closedRatio * 12) | 0;
        fb.rect(cx, con.y, con.w, jawH, hex('#a8b3c4'));
        fb.rect(cx, con.y + con.h - jawH, con.w, jawH, hex('#a8b3c4'));
        for (let tx = 0; tx < con.w; tx += 4) {
          fb.rect(cx + tx, con.y + jawH, 2, 3, hex('#ffffff'));
          fb.rect(cx + tx + 1, con.y + con.h - jawH - 3, 2, 3, hex('#ffffff'));
        }
      } else if (con.kind === 'crusher') {
        // Hydraulic shaft + yellow/black Foundry Crusher Block
        fb.rect(cx + 9, con.yTop - 16, 6, con.y - con.yTop + 16, hex('#687180'));
        fb.rect(cx, con.y, con.w, con.h, hex('#3b404a'));
        fb.rectOutline(cx, con.y, con.w, con.h, hex('#e8b638'));
        for (let hx = 2; hx < con.w - 2; hx += 6) {
          fb.rect(cx + hx, con.y + con.h - 5, 3, 4, hex('#e8b638'));
        }
      }
    }

    // Wind Particles in active wind zones
    const [w0, w1] = meta.windRange;
    if (meta.windX !== 0 && camX + 320 > w0 && camX < w1) {
      for (let i = 0; i < 8; i++) {
        const wx = (((320 - ((frame * 3 + i * 43) % 320)) + 320) % 320);
        const wy = 34 + ((i * 23 + (frame >> 1)) % 130);
        fb.line(wx, wy, wx + 6, wy, level.idx === 2 ? hex('#e3be78') : hex('#8ee8dc'));
      }
    }
  }

  function renderForegroundSilhouette(fb, camX) {
    // 1.25x Foreground Gothic Graveyard Spikes / Chains along very bottom 6px
    const sil = hex('#07080b');
    for (let sx = -24; sx < 344; sx += 24) {
      const dx = (sx - ((camX * 1.25) % 24)) | 0;
      fb.rect(dx + 10, 194, 2, 6, sil);
      fb.pset(dx + 10, 193, sil);
    }
  }

  GNG.TILE_SIZE = TILE_SIZE;
  GNG.LEVEL_ROWS = LEVEL_ROWS;
  GNG.TILE = TILE;
  GNG.STAGE_META = STAGE_META;
  GNG.buildStage = buildStage;
  GNG.renderParallaxAndTiles = renderParallaxAndTiles;
  GNG.renderForegroundSilhouette = renderForegroundSilhouette;
})();
