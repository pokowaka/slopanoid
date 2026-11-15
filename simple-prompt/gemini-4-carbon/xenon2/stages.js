(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});
  const { RAMP } = XENON;

  // Tile type constants in cavern grid (40 cols x STAGE_ROWS rows, 8x8 px per tile)
  const TILE = {
    EMPTY: 0,
    SOLID: 1,      // Indestructible cavern interior
    EDGE: 2,       // Indestructible beveled cavern wall edge
    DESTRUCT: 3,   // Destructible coral / crystal / gear-lock / capacitor / spore-cyst
    HAZARD_L: 4,   // Left-mounted Thermal Vent / Arc-Gate / Laser Emitter (fires right)
    HAZARD_R: 5    // Right-mounted Thermal Vent / Arc-Gate / Laser Emitter (fires left)
  };

  const STAGE_DEFS = [
    {
      num: 1,
      name: 'CAMBRIAN TRILOBITE REEF',
      epochYear: '520,000,000 BCE',
      subtitle: 'ARMOURED TRILOBITES & FOSSIL CORAL BOTTLENECKS',
      bgRamp: RAMP.STEEL,
      midRamp: RAMP.CORAL,
      bossName: 'LEVIATHAN ANOMALOCARIS',
      bossHp: 900,
      bossIntel: 'Aim for its glowing compound eye stalks when its raptorial claws uncurl — Plasma Spread & Side-Lasers shred its chitin!',
      enemyPool: ['trilobite', 'ammonite', 'turret']
    },
    {
      num: 2,
      name: 'ABYSSAL NAUTILOID TRENCH',
      epochYear: '360,000,000 BCE',
      subtitle: 'THERMAL VENT GEYSERS & BIOLUMINESCENT SQUIDS',
      bgRamp: RAMP.ABYSS,
      midRamp: RAMP.CYAN,
      bossName: 'THE KRAKEN-NAUTILUS',
      bossHp: 1250,
      bossIntel: 'Its coiled shell deflects frontal shots while spinning! Use Bounce-Orbs, Missiles, or strike when its cyan mantle opens!',
      enemyPool: ['squid', 'orthoceras', 'mine']
    },
    {
      num: 3,
      name: 'BABBAGE CLOCKWORK FOUNDRY',
      epochYear: '1847 CE — STEAM EPOCH',
      subtitle: 'BRASS GEAR-WALLS, PISTONS & ARC-LIGHTNING COILS',
      bgRamp: RAMP.BRASS,
      midRamp: RAMP.STEEL,
      bossName: 'DIFFERENCE ENGINE AUTOMATON',
      bossHp: 1600,
      bossIntel: 'Electro-Arc Beams & Tesla Drones overload its brass analytical cylinders! Watch out for its twin furnace sweeps!',
      enemyPool: ['cog', 'bomber', 'turret']
    },
    {
      num: 4,
      name: '1989 SILICON WAFER',
      epochYear: '1989 CE — DEMOSCENE ERA',
      subtitle: 'COPPER RASTERS, PCB MAZES & BLITTER-BOB SWARMS',
      bgRamp: RAMP.SILICON,
      midRamp: RAMP.NASHWAN,
      bossName: 'MC68000 CYBER-BLITTER',
      bossHp: 1950,
      bossIntel: 'Wait for the quartz UV window shutter to open over its silicon die — Prism Lasers & Mines deal massive crit damage!',
      enemyPool: ['blitter_bob', 'glenz', 'cog']
    },
    {
      num: 5,
      name: 'BIOMECHANICAL XENITE HIVE',
      epochYear: 'FAR FUTURE — NEXUS',
      subtitle: 'CHROME RIBCAGES, SPORE WALLS & SERPENT BROODS',
      bgRamp: RAMP.BONE,
      midRamp: RAMP.EMERALD,
      bossName: 'SOVEREIGN XENITE MOTHER-BRAIN',
      bossHp: 2500,
      bossIntel: 'Sever her chrome mandible beams and unleash SUPER NASHWAN OVERDRIVE into the pulsing Temporal Cortex!',
      enemyPool: ['xenite', 'serpent', 'bomber']
    }
  ];

  // Deterministic PRNG so every stage layout & rewind is 100% reproducible
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Builds a 40-col x 340-row cavern map (scrolls from bottom row 339 -> top row 0!)
  function generateStageData(stageNum) {
    const def = STAGE_DEFS[stageNum - 1] || STAGE_DEFS[0];
    const cols = 40;
    const rows = 340; // 340 * 8 = 2720 pixels of vertical cavern travel!
    const tiles = new Uint8Array(cols * rows);
    const tileHP = new Uint8Array(cols * rows);
    const rng = mulberry32(stageNum * 1989 + 42);

    const setT = (c, r, type, hp = 0) => {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      tiles[r * cols + c] = type;
      tileHP[r * cols + c] = hp;
    };

    // Carve undulating outer cavern walls (wider in Boss arena rows 0..42 & Shop dock rows 162..182)
    for (let r = 0; r < rows; r++) {
      const inBossZone = r < 46;
      const inShopZone = r >= 164 && r <= 184;
      const inSpawnZone = r >= rows - 34;

      let leftWall = 2 + Math.round(Math.sin(r * 0.085 + stageNum) * 2.2 + Math.cos(r * 0.037) * 1.6);
      let rightWall = 37 - Math.round(Math.cos(r * 0.078 + stageNum * 1.7) * 2.2 + Math.sin(r * 0.041) * 1.6);

      if (stageNum === 4) {
        // Stage 4 Silicon Wafer: crisp angular 90-degree PCB circuit walls!
        leftWall = 2 + (((Math.floor(r / 12) * 3 + stageNum) % 4));
        rightWall = 37 - (((Math.floor((r + 6) / 12) * 3 + stageNum) % 4));
      }

      if (inBossZone || inShopZone || inSpawnZone) {
        leftWall = 2;
        rightWall = 37;
      } else {
        leftWall = Math.max(2, Math.min(8, leftWall));
        rightWall = Math.max(31, Math.min(37, rightWall));
      }

      for (let c = 0; c <= leftWall; c++) {
        setT(c, r, c === leftWall ? TILE.EDGE : TILE.SOLID, 255);
      }
      for (let c = rightWall; c < cols; c++) {
        setT(c, r, c === rightWall ? TILE.EDGE : TILE.SOLID, 255);
      }
    }

    const staticPickups = [];

    // Feature Set A: Destructible Bottleneck Gates (player must blast through coral/gear/capacitor plugs!)
    const bottleneckRows = [285, 215, 118];
    for (const br of bottleneckRows) {
      for (let dr = -2; dr <= 2; dr++) {
        const r = br + dr;
        // Narrow rock/steel shoulders leaving a 10-tile center choke plugged with destructible blocks!
        for (let c = 3; c < 14; c++) {
          setT(c, r, (c === 13 || Math.abs(dr) === 2) ? TILE.EDGE : TILE.SOLID, 255);
        }
        for (let c = 26; c < 37; c++) {
          setT(c, r, (c === 26 || Math.abs(dr) === 2) ? TILE.EDGE : TILE.SOLID, 255);
        }
        if (Math.abs(dr) <= 1) {
          for (let c = 14; c <= 25; c++) {
            setT(c, r, TILE.DESTRUCT, 28 + stageNum * 6);
          }
        }
      }
    }

    // Feature Set B: XENON 2 SIGNATURE SPLIT FORKS WITH DEAD-END TREASURE ALCOVE!
    // Left lane OR Right lane is a rich Cash-Bubble cul-de-sac requiring Reverse Scroll Thrust (or Chrono-Rewind)
    // to back out if you scoop the treasure, while the opposite lane is wide open!
    const forkConfigs = [
      { topRow: 242, botRow: 268, deadSide: stageNum % 2 === 1 ? 'right' : 'left' },
      { topRow: 132, botRow: 158, deadSide: stageNum % 2 === 1 ? 'left' : 'right' },
      { topRow: 66, botRow: 92, deadSide: 'right' }
    ];

    for (const fk of forkConfigs) {
      // Central divider pillar between columns 18..21
      for (let r = fk.topRow; r <= fk.botRow; r++) {
        for (let c = 18; c <= 21; c++) {
          const isEdge = c === 18 || c === 21 || r === fk.topRow || r === fk.botRow;
          setT(c, r, isEdge ? TILE.EDGE : TILE.SOLID, 255);
        }
      }
      // Cap the top of the dead-end treasure alcove (with a tough destructible emergencycenter + solid arch)
      const cStart = fk.deadSide === 'left' ? 4 : 22;
      const cEnd = fk.deadSide === 'left' ? 17 : 35;
      for (let r = fk.topRow; r <= fk.topRow + 2; r++) {
        for (let c = cStart; c <= cEnd; c++) {
          // Small tough emergency breach in middle, solid walls around so Reverse Thrust shines!
          if (c >= (cStart + cEnd) / 2 - 1 && c <= (cStart + cEnd) / 2 + 1) {
            setT(c, r, TILE.DESTRUCT, 85);
          } else {
            setT(c, r, r === fk.topRow + 2 ? TILE.EDGE : TILE.SOLID, 255);
          }
        }
      }
      // Reward risky dead-end explorers with 3 Giant 250-CR Cash Bubbles!
      const midC = Math.floor((cStart + cEnd) / 2);
      staticPickups.push({ x: midC * 8, y: (fk.topRow + 8) * 8, value: 250, tier: 3 });
      staticPickups.push({ x: (midC - 2) * 8, y: (fk.topRow + 12) * 8, value: 250, tier: 3 });
      staticPickups.push({ x: (midC + 2) * 8, y: (fk.topRow + 12) * 8, value: 250, tier: 3 });
    }

    // Feature Set C: Epoch-Specific Wall Hazards (Thermal Vents, Arc-Lightning Turrets, Laser Gates, Spore Walls)
    if (stageNum >= 2) {
      const hazardRows = [298, 228, 196, 104, 56];
      for (const hr of hazardRows) {
        // Place opposing emitters on cavern inner edges
        for (let c = 1; c < 15; c++) {
          if (tiles[hr * cols + c] === TILE.EDGE && tiles[hr * cols + c + 1] === TILE.EMPTY) {
            setT(c, hr, TILE.HAZARD_L, 45);
            break;
          }
        }
        for (let c = cols - 2; c > 24; c--) {
          if (tiles[hr * cols + c] === TILE.EDGE && tiles[hr * cols + c - 1] === TILE.EMPTY) {
            setT(c, hr, TILE.HAZARD_R, 45);
            break;
          }
        }
      }
    }

    // Build scripted enemy waves along scroll progress (worldY from bottom ~2550 up to Boss ~360)
    const waves = [];
    for (let w = 0; w < 22; w++) {
      const triggerScrollY = Math.floor(2420 - w * 96);
      if (triggerScrollY < 320) break;
      // Skip spawning right on top of mid-stage shop dock
      if (Math.abs(triggerScrollY - 1260) < 75) continue;

      const kindIdx = (w + Math.floor(rng() * 2)) % def.enemyPool.length;
      const enemyKind = def.enemyPool[kindIdx];
      const count = enemyKind === 'serpent' ? 1 : (enemyKind === 'bomber' ? 2 : 4 + (w % 3));
      const pattern = w % 3 === 0 ? 'sine' : (w % 3 === 1 ? 'vee' : 'columns');
      waves.push({
        id: w,
        triggerScrollY,
        kind: enemyKind,
        count,
        pattern,
        spawned: false
      });
    }

    return {
      def,
      cols,
      rows,
      worldHeight: rows * 8,
      startScrollY: rows * 8 - 200, // Start at bottom of cavern, scrolling UP toward 0!
      midShopScrollY: 1260,
      bossTriggerScrollY: 185,
      tiles,
      tileHP,
      initialTiles: new Uint8Array(tiles),
      initialTileHP: new Uint8Array(tileHP),
      waves,
      staticPickups,
      forkZones: forkConfigs
    };
  }

  XENON.TILE = TILE;
  XENON.STAGE_DEFS = STAGE_DEFS;
  XENON.generateStageData = generateStageData;
})();
