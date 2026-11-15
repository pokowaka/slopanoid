(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});
  const { PALETTE, RAMP, sampleRamp } = XENON;

  // Heightmap + Surface-Normal Metallic Sprite Compiler ("Dan Malone Sheen")
  function compileLitSprite(w, h, evalPixel) {
    const pixels = new Uint32Array(w * h);
    const grid = new Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        grid[y * w + x] = evalPixel(x, y, w, h);
      }
    }

    // Light direction: classic Bitmap Brothers top-left key light
    const lx = -0.52;
    const ly = -0.62;
    const lz = 0.587;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y * w + x];
        if (!cell) {
          // 1px dark silhouette outline adjacent to solid sprite pixels
          const hasNeighbor =
            (x > 0 && grid[y * w + (x - 1)]) ||
            (x < w - 1 && grid[y * w + (x + 1)]) ||
            (y > 0 && grid[(y - 1) * w + x]) ||
            (y < h - 1 && grid[(y + 1) * w + x]);
          if (hasNeighbor) {
            pixels[y * w + x] = PALETTE[0];
          }
          continue;
        }

        if (cell.directCol) {
          pixels[y * w + x] = cell.directCol;
          continue;
        }

        if (cell.emissive !== undefined) {
          const eRamp = cell.emissiveRamp !== undefined ? cell.emissiveRamp : RAMP.CYAN;
          pixels[y * w + x] = sampleRamp(eRamp, 16, cell.emissive, x, y, 0.45);
          continue;
        }

        const hC = cell.h;
        const hL = x > 0 && grid[y * w + (x - 1)] ? grid[y * w + (x - 1)].h : hC - 1.1;
        const hR = x < w - 1 && grid[y * w + (x + 1)] ? grid[y * w + (x + 1)].h : hC - 1.1;
        const hU = y > 0 && grid[(y - 1) * w + x] ? grid[(y - 1) * w + x].h : hC - 1.1;
        const hD = y < h - 1 && grid[(y + 1) * w + x] ? grid[(y + 1) * w + x].h : hC - 1.1;

        let nx = (hL - hR) * 0.75;
        let ny = (hU - hD) * 0.75;
        let nz = 1.0;
        const invLen = 1 / Math.hypot(nx, ny, nz);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;

        const ndotl = Math.max(0, nx * lx + ny * ly + nz * lz);
        // Halfway vector for metallic specular horizon sheen
        const hx = lx * 0.5;
        const hy = ly * 0.5;
        const hz = (lz + 1.0) * 0.5;
        const hLen = Math.hypot(hx, hy, hz);
        const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
        const spec = Math.pow(ndoth, 7) * 0.62;
        const rim = Math.max(0, nx * 0.45 + ny * 0.45) * 0.16;

        let shade = 0.12 + ndotl * 0.58 + spec + rim + (cell.bias || 0);
        if (cell.groove) shade *= 0.35;
        if (cell.rivet === 1) shade = 0.92;
        if (cell.rivet === -1) shade = 0.14;
        shade = Math.max(0.04, Math.min(0.99, shade));

        const ramp = cell.ramp !== undefined ? cell.ramp : RAMP.CHROME;
        pixels[y * w + x] = sampleRamp(ramp, 16, shade, x, y, 0.75);
      }
    }

    return { w, h, pixels };
  }

  const SPRITES = {};

  // =========================================================================
  // 1. PLAYER "THE MEGABLASTER" HULLS & PHYSICAL HARDPOINT ATTACHMENTS
  // =========================================================================
  function buildMegablasterHull(bank = 0) {
    return compileLitSprite(26, 26, (x, y, w, h) => {
      const cx = 12.5 + bank * 0.8;
      const dx = (x - cx) * (bank !== 0 && (x - cx) * bank > 0 ? 1.18 : 0.95);
      const adx = Math.abs(dx);

      // Swept chrome delta wings + forward fuselage
      let wingSpan = 0;
      if (y >= 9 && y <= 21) {
        wingSpan = 3.2 + (y - 9) * 0.78;
        if (y > 18) wingSpan -= (y - 18) * 1.65;
      }
      const fuselageHalf = y >= 2 && y <= 22 ? (y < 8 ? 1.6 + (y - 2) * 0.35 : 3.8 - (y - 8) * 0.08) : 0;

      // Cockpit glass canopy (cyan specular orb)
      if (y >= 7 && y <= 14 && adx <= 2.3 - Math.abs(y - 10.5) * 0.35) {
        const glint = (x < cx && y < 11) ? 0.95 : 0.58 - (y - 7) * 0.05;
        return { h: 4.2, emissive: Math.max(0.35, glint), emissiveRamp: RAMP.CYAN };
      }

      if (adx <= fuselageHalf && y >= 2 && y <= 22) {
        const hVal = 3.8 - adx * 0.45 - Math.abs(y - 12) * 0.06;
        const groove = y === 15 || (y >= 16 && Math.abs(adx - 1.8) < 0.45);
        const rivet = (y === 6 || y === 18) && Math.abs(adx - 2.1) < 0.5 ? 1 : 0;
        return { h: hVal, ramp: RAMP.CHROME, groove, rivet, bias: 0.06 };
      }

      if (adx <= wingSpan && y >= 9 && y <= 21) {
        // Wingtip chrome pods
        if (adx >= wingSpan - 1.7 && y >= 13 && y <= 20) {
          return { h: 3.1, ramp: RAMP.STEEL, rivet: y === 14 ? 1 : 0, bias: 0.08 };
        }
        const groove = y === 16 || Math.abs(adx - 5.5) < 0.42;
        const rivet = y === 18 && Math.abs(adx - 7.2) < 0.5 ? 1 : 0;
        return {
          h: 2.6 - (adx - fuselageHalf) * 0.16,
          ramp: y < 13 ? RAMP.CHROME : RAMP.STEEL,
          groove,
          rivet
        };
      }
      return null;
    });
  }

  SPRITES.ship_left = buildMegablasterHull(-1);
  SPRITES.ship_center = buildMegablasterHull(0);
  SPRITES.ship_right = buildMegablasterHull(1);

  // Hull Upgrade overlays physically bolted to the Megablaster
  SPRITES.hull_plating = compileLitSprite(30, 26, (x, y) => {
    const adx = Math.abs(x - 14.5);
    // Heavy golden-brass & chrome armoured shoulder pauldrons
    if (y >= 8 && y <= 19 && adx >= 4.2 && adx <= 11.5) {
      const inner = Math.abs(y - 13.5) + (adx - 7.5) * 0.5;
      if (inner < 5.2) {
        return {
          h: 3.6 - Math.abs(adx - 7.5) * 0.3,
          ramp: adx > 8.5 ? RAMP.BRASS : RAMP.CHROME,
          groove: y === 13,
          rivet: (y === 10 || y === 16) && Math.abs(adx - 7.5) < 0.6 ? 1 : 0,
          bias: 0.1
        };
      }
    }
    return null;
  });

  SPRITES.hull_chrono = compileLitSprite(26, 26, (x, y) => {
    const adx = Math.abs(x - 12.5);
    if (y >= 15 && y <= 22 && adx <= 2.4) {
      if (adx <= 1.1 && y >= 16 && y <= 21) {
        return { h: 4, emissive: 0.85 - (y - 16) * 0.08, emissiveRamp: RAMP.CYAN };
      }
      return { h: 3.4, ramp: RAMP.BRASS, bias: 0.12 };
    }
    return null;
  });

  // NOSE HARDPOINT SPRITES
  SPRITES.nose_vulcan_1 = compileLitSprite(8, 9, (x, y) => {
    const adx = Math.abs(x - 3.5);
    if (y >= 1 && y <= 7 && adx <= (y > 4 ? 2.1 : 1.1)) {
      if (y === 1 && adx <= 0.8) return { h: 3, emissive: 0.9, emissiveRamp: RAMP.FIRE };
      return { h: 3.2 - adx * 0.5, ramp: RAMP.CHROME, bias: 0.08 };
    }
    return null;
  });

  SPRITES.nose_twin_vulcan = compileLitSprite(12, 11, (x, y) => {
    const adx = Math.abs(x - 5.5);
    // Twin gatling barrels
    if (y >= 1 && y <= 9 && ((adx >= 1.2 && adx <= 3.3) || (y >= 5 && adx <= 3.8))) {
      if (y === 1 && adx >= 1.4 && adx <= 2.9) {
        return { h: 3, emissive: 0.92, emissiveRamp: RAMP.FIRE };
      }
      return {
        h: 3.5 - Math.abs(adx - 2.2) * 0.6,
        ramp: y >= 6 ? RAMP.BRASS : RAMP.CHROME,
        groove: y === 5
      };
    }
    return null;
  });

  SPRITES.nose_plasma_spread = compileLitSprite(14, 11, (x, y) => {
    const adx = Math.abs(x - 6.5);
    // 3-prong chrome plasma fork
    const centerProng = adx <= 1.2 && y >= 1 && y <= 9;
    const outerProng = adx >= 3.2 && adx <= 5.1 && y >= 2 && y <= 8;
    const bridge = y >= 6 && y <= 9 && adx <= 5.2;
    if (centerProng || outerProng || bridge) {
      if ((y <= 2 && centerProng) || (y <= 3 && outerProng)) {
        return { h: 4, emissive: 0.92, emissiveRamp: RAMP.NASHWAN };
      }
      return { h: 3.4, ramp: RAMP.CHROME, bias: 0.1 };
    }
    return null;
  });

  SPRITES.nose_electro_arc = compileLitSprite(14, 12, (x, y) => {
    const adx = Math.abs(x - 6.5);
    const coil = adx >= 1.6 && adx <= 4.4 && y >= 1 && y <= 9;
    const core = adx <= 2.2 && y >= 4 && y <= 10;
    if (coil || core) {
      if (y <= 3 && coil) {
        return { h: 4, emissive: 0.95, emissiveRamp: RAMP.CYAN };
      }
      return {
        h: 3.5,
        ramp: (y & 1) === 0 ? RAMP.CYAN : RAMP.CHROME,
        bias: 0.08
      };
    }
    return null;
  });

  // WING POD HARDPOINTS (designed for Left Wing; flipped via flipX for Right Wing)
  SPRITES.wing_side_laser = compileLitSprite(9, 14, (x, y) => {
    if (x >= 2 && x <= 6 && y >= 1 && y <= 12) {
      if (y <= 3 && x >= 3 && x <= 5) {
        return { h: 4, emissive: 0.95, emissiveRamp: RAMP.NASHWAN };
      }
      return {
        h: 3.4 - Math.abs(x - 4) * 0.5,
        ramp: RAMP.CHROME,
        groove: y === 7,
        bias: 0.08
      };
    }
    return null;
  });

  SPRITES.wing_homing_missile = compileLitSprite(10, 13, (x, y) => {
    if (x >= 1 && x <= 8 && y >= 2 && y <= 11) {
      // Red missile warhead tips peeking from rack
      if (y <= 3 && (x === 2 || x === 5 || x === 7)) {
        return { h: 3.5, emissive: 0.85, emissiveRamp: RAMP.CORAL };
      }
      return {
        h: 3.1 - Math.abs(x - 4.5) * 0.25,
        ramp: RAMP.STEEL,
        groove: x === 4 || y === 7,
        rivet: y === 9 && x === 3 ? 1 : 0
      };
    }
    return null;
  });

  SPRITES.wing_bounce_orb = compileLitSprite(10, 12, (x, y) => {
    const d = Math.hypot(x - 4.5, y - 5.5);
    if (d <= 4.0) {
      if (d <= 1.8 && y <= 5) {
        return { h: 4, emissive: 0.9, emissiveRamp: RAMP.EMERALD };
      }
      return { h: 4.0 - d * 0.65, ramp: RAMP.CHROME, bias: 0.1 };
    }
    return null;
  });

  SPRITES.wing_flak = compileLitSprite(10, 12, (x, y) => {
    if (x >= 2 && x <= 7 && y >= 2 && y <= 10) {
      if (y === 2) return { h: 3, emissive: 0.85, emissiveRamp: RAMP.FIRE };
      return { h: 3.2 - Math.abs(x - 4.5) * 0.35, ramp: RAMP.BRASS, groove: y === 6 };
    }
    return null;
  });

  // REAR TAIL HARDPOINTS
  SPRITES.tail_rear_cannon = compileLitSprite(12, 10, (x, y) => {
    const adx = Math.abs(x - 5.5);
    if (y >= 1 && y <= 8 && ((adx >= 1.1 && adx <= 3.0) || (y <= 4 && adx <= 3.6))) {
      if (y === 8 && adx >= 1.3 && adx <= 2.8) {
        return { h: 3, emissive: 0.88, emissiveRamp: RAMP.CYAN };
      }
      return { h: 3.1, ramp: RAMP.CHROME, groove: y === 4 };
    }
    return null;
  });

  SPRITES.tail_temporal_mines = compileLitSprite(12, 10, (x, y) => {
    const d = Math.hypot(x - 5.5, y - 4.5);
    if (d <= 4.2) {
      if (d <= 1.8) return { h: 3.8, emissive: 0.9, emissiveRamp: RAMP.NASHWAN };
      return { h: 3.4 - d * 0.4, ramp: RAMP.BRASS, groove: x === 5 || y === 4 };
    }
    return null;
  });

  // ORBITING DRONES
  SPRITES.drone_scout = compileLitSprite(10, 10, (x, y) => {
    const d = Math.hypot(x - 4.5, y - 4.5);
    if (d <= 3.8) {
      if (d <= 1.5) return { h: 4, emissive: 0.95, emissiveRamp: RAMP.CYAN };
      return { h: 4.0 - d * 0.65, ramp: RAMP.CHROME, bias: 0.12 };
    }
    return null;
  });

  SPRITES.drone_tesla = compileLitSprite(12, 12, (x, y) => {
    const dx = x - 5.5;
    const dy = y - 5.5;
    const d = Math.hypot(dx, dy);
    const prong = (Math.abs(dx) <= 1.1 && Math.abs(dy) <= 5.0) || (Math.abs(dy) <= 1.1 && Math.abs(dx) <= 5.0);
    if (d <= 3.9 || prong) {
      if (d <= 1.8) return { h: 4.2, emissive: 0.96, emissiveRamp: RAMP.CYAN };
      return { h: 3.8 - d * 0.45, ramp: d > 3.5 ? RAMP.BRASS : RAMP.CHROME, bias: 0.12 };
    }
    return null;
  });

  // =========================================================================
  // 2. CAVERN 8x8 TILESETS FOR ALL 5 EVOLUTIONARY EPOCHS
  // =========================================================================
  function buildEpochTiles(wallRamp, accentRamp, destructRamp, style) {
    function makeTile(fn) {
      const px = new Uint32Array(64);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          px[y * 8 + x] = fn(x, y);
        }
      }
      return px;
    }

    // Solid interior wall tile
    const solid = makeTile((x, y) => {
      let shade = 0.28 + Math.sin(x * 0.9 + y * 0.7) * 0.14;
      if (style === 'clockwork') {
        const d = Math.hypot(x - 3.5, y - 3.5);
        shade = d < 3.2 && d > 1.6 ? 0.62 : 0.24;
      } else if (style === 'silicon') {
        if (x === 3 || y === 3) return sampleRamp(accentRamp, 16, 0.68, x, y, 0.3);
        shade = 0.22 + ((x ^ y) & 1) * 0.08;
      } else if (style === 'hive') {
        shade = 0.25 + Math.abs(Math.sin((x + y) * 0.8)) * 0.38;
      }
      return sampleRamp(wallRamp, 16, shade, x, y, 0.8);
    });

    // Exposed metallic/organic edge wall tile (high-contrast Bitmap bevel!)
    const edge = makeTile((x, y) => {
      if (x === 0 || y === 0) return sampleRamp(wallRamp, 16, 0.86, x, y, 0.4);
      if (x === 7 || y === 7) return PALETTE[0];
      if ((x === 2 && y === 2) || (x === 5 && y === 5)) {
        return sampleRamp(accentRamp, 16, 0.82, x, y, 0.3);
      }
      const shade = 0.48 - (x + y) * 0.025;
      return sampleRamp(wallRamp, 16, shade, x, y, 0.8);
    });

    // Destructible barrier intact (coral / crystal / brass lock / capacitor / spore cyst)
    const destructIntact = makeTile((x, y) => {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d > 4.3) return PALETTE[0];
      if (d < 1.7) return sampleRamp(accentRamp, 16, 0.92, x, y, 0.3);
      const bevel = 0.75 - (x * 0.05 + y * 0.06);
      return sampleRamp(destructRamp, 16, Math.max(0.18, bevel), x, y, 0.7);
    });

    // Destructible barrier cracked
    const destructCracked = makeTile((x, y) => {
      if (x === y || x + y === 7) return PALETTE[0];
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d > 4.1) return 0;
      return sampleRamp(destructRamp, 16, 0.42, x, y, 0.8);
    });

    // Hazard emitter tile (Thermal Vent / Arc Coil / Laser Gate Emitter)
    const hazard = makeTile((x, y) => {
      if (x === 0 || x === 7 || y === 0 || y === 7) return PALETTE[0];
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d <= 2.1) return sampleRamp(RAMP.CYAN, 16, 0.95, x, y, 0.2);
      return sampleRamp(RAMP.CHROME, 16, 0.65, x, y, 0.5);
    });

    return { solid, edge, destructIntact, destructCracked, hazard };
  }

  XENON.EPOCH_TILES = [
    buildEpochTiles(RAMP.STEEL, RAMP.CHROME, RAMP.CORAL, 'cambrian'),
    buildEpochTiles(RAMP.ABYSS, RAMP.CYAN, RAMP.EMERALD, 'abyssal'),
    buildEpochTiles(RAMP.BRASS, RAMP.CHROME, RAMP.FIRE, 'clockwork'),
    buildEpochTiles(RAMP.SILICON, RAMP.BRASS, RAMP.NASHWAN, 'silicon'),
    buildEpochTiles(RAMP.BONE, RAMP.EMERALD, RAMP.CORAL, 'hive')
  ];

  // =========================================================================
  // 3. PERIOD-SPECIFIC BIOMECHANICAL ENEMY SPRITES (STAGES 1..5)
  // =========================================================================

  // Stage 1: Cambrian Trilobite, Ammonite Spiral, Spine Turret
  SPRITES.enemy_trilobite = compileLitSprite(18, 18, (x, y) => {
    const adx = Math.abs(x - 8.5);
    const dy = y - 8.5;
    if (Math.hypot(adx * 1.05, dy * 0.9) <= 7.2) {
      // Glowing compound eyes on cephalon (front faces down toward player)
      if (y >= 11 && y <= 13 && adx >= 2.8 && adx <= 4.6) {
        return { h: 4, emissive: 0.92, emissiveRamp: RAMP.FIRE };
      }
      const groove = y % 3 === 0 || Math.abs(adx - 2.3) < 0.45;
      return {
        h: 4.0 - adx * 0.35 - Math.abs(dy) * 0.18,
        ramp: adx < 2.3 ? RAMP.CHROME : RAMP.CORAL,
        groove,
        bias: 0.08
      };
    }
    return null;
  });

  SPRITES.enemy_ammonite = compileLitSprite(18, 18, (x, y) => {
    const dx = x - 8.5;
    const dy = y - 8.5;
    const r = Math.hypot(dx, dy);
    if (r <= 7.4) {
      const ang = Math.atan2(dy, dx);
      const spiral = Math.sin(r * 1.4 - ang * 2.0);
      if (r <= 2.0) return { h: 4, emissive: 0.88, emissiveRamp: RAMP.CYAN };
      return {
        h: 3.6 - r * 0.25 + spiral * 0.65,
        ramp: spiral > 0 ? RAMP.BRASS : RAMP.CHROME,
        groove: Math.abs(spiral) < 0.2
      };
    }
    return null;
  });

  SPRITES.enemy_turret = compileLitSprite(16, 16, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d <= 6.5) {
      if (d <= 2.4) return { h: 4, emissive: 0.92, emissiveRamp: RAMP.CORAL };
      return {
        h: 3.8 - d * 0.38,
        ramp: RAMP.CHROME,
        groove: x === 7 || y === 7,
        rivet: d > 4.2 && d < 5.2 && ((x + y) & 3) === 0 ? 1 : 0
      };
    }
    return null;
  });

  // Stage 2: Bioluminescent Vampire Squid, Orthoceras Spear, Abyssal Mine
  SPRITES.enemy_squid = compileLitSprite(18, 20, (x, y) => {
    const adx = Math.abs(x - 8.5);
    if (y <= 12) {
      const wSpan = 1.5 + y * 0.52;
      if (adx <= wSpan) {
        if (y >= 8 && y <= 10 && adx >= 2.0 && adx <= 3.8) {
          return { h: 4, emissive: 0.95, emissiveRamp: RAMP.CYAN };
        }
        return { h: 3.8 - adx * 0.35, ramp: RAMP.CYAN, groove: adx > wSpan - 1.2 };
      }
    } else if (y <= 18) {
      // Tentacles
      const tent = Math.sin((x + y * 0.6) * 1.5);
      if (adx <= 6.2 && tent > 0.05) {
        return { h: 2.5, ramp: RAMP.NASHWAN };
      }
    }
    return null;
  });

  SPRITES.enemy_orthoceras = compileLitSprite(14, 22, (x, y) => {
    const adx = Math.abs(x - 6.5);
    const coneW = 0.8 + (21 - y) * 0.26;
    if (y >= 1 && y <= 20 && adx <= coneW) {
      if (y >= 16 && adx <= 1.8) return { h: 4, emissive: 0.9, emissiveRamp: RAMP.EMERALD };
      return {
        h: 3.8 - adx * 0.5,
        ramp: y > 14 ? RAMP.CYAN : RAMP.CHROME,
        groove: y % 4 === 0
      };
    }
    return null;
  });

  SPRITES.enemy_mine = compileLitSprite(16, 16, (x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    const spike = (Math.abs(dx) < 1.2 && Math.abs(dy) < 7.0) ||
                  (Math.abs(dy) < 1.2 && Math.abs(dx) < 7.0) ||
                  (Math.abs(Math.abs(dx) - Math.abs(dy)) < 1.1 && d < 6.8);
    if (d <= 4.8 || spike) {
      if (d <= 2.0) return { h: 4, emissive: 0.95, emissiveRamp: RAMP.FIRE };
      return { h: 3.6 - d * 0.4, ramp: RAMP.STEEL, bias: 0.08 };
    }
    return null;
  });

  // Stage 3: Babbage Gyro-Cog & Steampunk Loom Bomber
  SPRITES.enemy_cog = compileLitSprite(18, 18, (x, y) => {
    const dx = x - 8.5;
    const dy = y - 8.5;
    const r = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const tooth = Math.cos(ang * 8) > 0.2 ? 1.4 : 0;
    if (r <= 6.2 + tooth) {
      if (r <= 2.1) return { h: 4, emissive: 0.92, emissiveRamp: RAMP.FIRE };
      if (r > 2.4 && r < 3.5) return null; // Gear cutouts
      return { h: 3.8 - Math.abs(r - 4.8) * 0.5, ramp: RAMP.BRASS, bias: 0.1 };
    }
    return null;
  });

  SPRITES.enemy_bomber = compileLitSprite(22, 20, (x, y) => {
    const adx = Math.abs(x - 10.5);
    const body = Math.hypot(adx * 0.85, (y - 9.5) * 0.95) <= 7.8;
    const sponson = adx >= 6.5 && adx <= 9.5 && y >= 5 && y <= 15;
    if (body || sponson) {
      if (adx <= 2.2 && y >= 11 && y <= 15) {
        return { h: 4, emissive: 0.9, emissiveRamp: RAMP.FIRE };
      }
      return {
        h: 4.2 - adx * 0.28,
        ramp: sponson ? RAMP.CHROME : RAMP.BRASS,
        groove: y === 9 || Math.abs(adx - 4.5) < 0.45,
        rivet: y === 6 && Math.abs(adx - 3) < 0.5 ? 1 : 0
      };
    }
    return null;
  });

  // Stage 4: Amiga Blitter-Bob Sphere, Glenz Vector Diamond, IRQ IC Bug
  SPRITES.enemy_blitter_bob = compileLitSprite(16, 16, (x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    if (d <= 6.5) {
      // Classic Amiga Boing / Blitter-Bob checkered chrome-magenta facets!
      const checker = (((Math.floor((dx + 8) / 3.2) + Math.floor((dy + 8) / 3.2)) & 1) === 0);
      return {
        h: Math.sqrt(Math.max(0.1, 44 - d * d)) * 0.65,
        ramp: checker ? RAMP.CHROME : RAMP.NASHWAN,
        bias: 0.14
      };
    }
    return null;
  });

  SPRITES.enemy_glenz = compileLitSprite(18, 18, (x, y) => {
    const adx = Math.abs(x - 8.5);
    const ady = Math.abs(y - 8.5);
    if (adx + ady <= 8.2) {
      if (adx + ady <= 2.5) return { h: 4, emissive: 0.95, emissiveRamp: RAMP.CYAN };
      const facet = x < 8.5 ? (y < 8.5 ? 0.2 : 0.0) : (y < 8.5 ? 0.05 : -0.15);
      return {
        h: 3.6 - (adx + ady) * 0.25,
        ramp: (x > 8.5) ^ (y > 8.5) ? RAMP.CYAN : RAMP.CHROME,
        groove: adx < 0.5 || ady < 0.5,
        bias: facet
      };
    }
    return null;
  });

  // Stage 5: Xenite Skimmer, Brood Cruiser & Segmented Biomechanical Serpent
  SPRITES.enemy_xenite = compileLitSprite(18, 18, (x, y) => {
    const adx = Math.abs(x - 8.5);
    const dy = y - 8.5;
    const carapace = Math.hypot(adx * 1.1, dy * 0.9) <= 6.2;
    const pincer = y >= 11 && y <= 16 && adx >= 3.0 && adx <= 6.5 && Math.abs(adx - (18 - y)) <= 1.5;
    if (carapace || pincer) {
      if (y >= 9 && y <= 12 && adx <= 1.8) {
        return { h: 4, emissive: 0.95, emissiveRamp: RAMP.EMERALD };
      }
      return {
        h: 3.9 - adx * 0.35,
        ramp: pincer ? RAMP.CHROME : RAMP.BONE,
        groove: y % 3 === 0,
        bias: 0.1
      };
    }
    return null;
  });

  SPRITES.serpent_head = compileLitSprite(18, 18, (x, y) => {
    const adx = Math.abs(x - 8.5);
    const d = Math.hypot(adx, y - 8.5);
    if (d <= 7.2) {
      if (y >= 10 && y <= 13 && adx >= 2.2 && adx <= 4.4) {
        return { h: 4, emissive: 0.95, emissiveRamp: RAMP.EMERALD };
      }
      return { h: 4.2 - d * 0.38, ramp: RAMP.CHROME, groove: adx < 0.6, bias: 0.12 };
    }
    return null;
  });

  SPRITES.serpent_seg = compileLitSprite(14, 14, (x, y) => {
    const d = Math.hypot(x - 6.5, y - 6.5);
    if (d <= 5.6) {
      if (d <= 1.8) return { h: 3.8, emissive: 0.8, emissiveRamp: RAMP.EMERALD };
      return { h: 3.8 - d * 0.45, ramp: RAMP.BONE, groove: y === 6, bias: 0.1 };
    }
    return null;
  });

  // =========================================================================
  // 4. FIVE MASSIVE EPOCH BOSS SPRITES (64x46 MULTI- MATERIAL METALLIC ART)
  // =========================================================================
  function buildBossSprite(stageNum) {
    return compileLitSprite(68, 46, (x, y) => {
      const cx = 33.5;
      const cy = 22.5;
      const dx = x - cx;
      const adx = Math.abs(dx);
      const dy = y - cy;

      if (stageNum === 1) {
        // THE LEVIATHAN ANOMALOCARIS
        const body = Math.hypot(adx * 0.62, dy * 0.95) <= 18.5;
        const lobe = Math.abs(dy + Math.sin(adx * 0.35) * 3) <= 9.5 && adx <= 30 && adx >= 12;
        const claw = y >= 26 && y <= 43 && adx >= 7 && adx <= 20 && Math.abs(adx - (46 - y) * 0.75) <= 3.2;
        const eyeStalk = y >= 22 && y <= 30 && adx >= 14 && adx <= 21;
        if (eyeStalk && Math.hypot(adx - 18, y - 27) <= 3.0) {
          return { h: 5, emissive: 0.96, emissiveRamp: RAMP.FIRE };
        }
        if (Math.hypot(adx, y - 28) <= 4.5) {
          return { h: 5, emissive: 0.92, emissiveRamp: RAMP.CYAN };
        }
        if (body || lobe || claw) {
          return {
            h: 4.5 - adx * 0.08 - Math.abs(dy) * 0.08,
            ramp: claw ? RAMP.CHROME : (lobe ? RAMP.CORAL : RAMP.STEEL),
            groove: y % 5 === 0 || Math.abs(adx - 11) < 0.6,
            bias: 0.08
          };
        }
      } else if (stageNum === 2) {
        // THE KRAKEN-NAUTILUS
        const r = Math.hypot(dx * 0.85, (y - 19) * 0.95);
        const ang = Math.atan2(y - 19, dx);
        const spiral = Math.sin(r * 0.7 - ang * 2.0);
        const tentacle = y >= 28 && adx <= 24 && Math.sin(x * 0.65 + y * 0.25) > 0.0;
        if (Math.hypot(adx, y - 29) <= 5.2) {
          return { h: 5, emissive: 0.96, emissiveRamp: RAMP.CYAN };
        }
        if (r <= 20.5 || tentacle) {
          return {
            h: 4.6 - r * 0.12 + spiral * 0.6,
            ramp: tentacle ? RAMP.CYAN : (spiral > 0 ? RAMP.CHROME : RAMP.ABYSS),
            groove: Math.abs(spiral) < 0.18,
            bias: 0.1
          };
        }
      } else if (stageNum === 3) {
        // THE DIFFERENCE ENGINE AUTOMATON
        const chassis = adx <= 26 && Math.abs(dy) <= 16;
        const leftGear = Math.hypot(adx - 22, dy) <= 13.5;
        if (Math.hypot(adx, y - 24) <= 5.5) {
          return { h: 5, emissive: 0.96, emissiveRamp: RAMP.FIRE };
        }
        if (chassis || leftGear) {
          const gearRing = Math.abs(Math.hypot(adx - 22, dy) - 10) < 2.2;
          return {
            h: 4.4 - (adx % 8) * 0.12,
            ramp: gearRing || adx > 16 ? RAMP.BRASS : RAMP.CHROME,
            groove: x % 8 === 0 || y % 7 === 0,
            rivet: (x % 8 === 2 && y % 7 === 2) ? 1 : 0,
            bias: 0.1
          };
        }
      } else if (stageNum === 4) {
        // THE MC68000 CYBER-BLITTER DIP WAR-MACHINE
        const chipBody = adx <= 25 && Math.abs(dy) <= 15;
        const icPins = adx >= 25 && adx <= 31 && (y % 4 <= 1) && Math.abs(dy) <= 14;
        const quartz = adx <= 9 && Math.abs(dy - 1) <= 7;
        if (quartz) {
          const grid = (x % 3 === 0 || y % 3 === 0) ? 0.95 : 0.65;
          return { h: 5, emissive: grid, emissiveRamp: RAMP.NASHWAN };
        }
        if (chipBody || icPins) {
          return {
            h: icPins ? 3.2 : 4.2,
            ramp: icPins ? RAMP.BRASS : (adx < 12 ? RAMP.CHROME : RAMP.SILICON),
            groove: adx === 12 || Math.abs(dy) === 10,
            bias: 0.1
          };
        }
      } else {
        // STAGE 5: THE SOVEREIGN XENITE MOTHER-BRAIN
        const cranium = Math.hypot(adx * 0.72, (y - 18) * 0.95) <= 21;
        const mandible = y >= 24 && y <= 43 && adx >= 11 && adx <= 26 && Math.abs(adx - (52 - y) * 0.68) <= 4.2;
        const cortex = Math.hypot(adx, y - 22) <= 6.8;
        if (cortex) {
          return { h: 5, emissive: 0.96 - Math.hypot(adx, y - 22) * 0.06, emissiveRamp: RAMP.EMERALD };
        }
        if (cranium || mandible) {
          const ribs = Math.sin(y * 0.9 + adx * 0.25) > 0.35;
          return {
            h: 4.6 - adx * 0.09 + (ribs ? 0.5 : 0),
            ramp: mandible ? RAMP.CHROME : RAMP.BONE,
            groove: !ribs && y % 4 === 0,
            bias: 0.12
          };
        }
      }
      return null;
    });
  }

  for (let s = 1; s <= 5; s++) {
    SPRITES['boss_' + s] = buildBossSprite(s);
  }

  // =========================================================================
  // 5. CASH BUBBLES (CREDITS), POWERUP CAPSULES & PROJECTILE SPRITES
  // =========================================================================
  function buildCashBubble(size, ramp) {
    return compileLitSprite(size, size, (x, y) => {
      const c = (size - 1) * 0.5;
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      const maxR = c - 0.6;
      if (r <= maxR) {
        // Glassy specular highlight top-left + glowing inner credit coin
        if (dx < -maxR * 0.2 && dy < -maxR * 0.2 && r < maxR * 0.72) {
          return { directCol: PALETTE[15] };
        }
        if (r > maxR - 1.3) {
          return { h: 3.8, emissive: 0.85, emissiveRamp: ramp };
        }
        if (r < maxR * 0.48) {
          return { h: 4.0, ramp: RAMP.BRASS, bias: 0.2 };
        }
        return { h: 2.5, emissive: 0.42, emissiveRamp: ramp };
      }
      return null;
    });
  }

  SPRITES.cash_small = buildCashBubble(9, RAMP.EMERALD);
  SPRITES.cash_med = buildCashBubble(12, RAMP.CYAN);
  SPRITES.cash_large = buildCashBubble(15, RAMP.NASHWAN);

  SPRITES.proj_bounce_orb = compileLitSprite(8, 8, (x, y) => {
    const d = Math.hypot(x - 3.5, y - 3.5);
    if (d <= 3.3) {
      if (x <= 3 && y <= 3 && d < 2.2) return { directCol: PALETTE[15] };
      return { h: 4, emissive: 0.92 - d * 0.15, emissiveRamp: RAMP.EMERALD };
    }
    return null;
  });

  SPRITES.proj_mine = compileLitSprite(9, 9, (x, y) => {
    const d = Math.hypot(x - 4, y - 4);
    if (d <= 3.8) {
      if (d <= 1.8) return { h: 4, emissive: 0.95, emissiveRamp: RAMP.NASHWAN };
      return { h: 3.5, ramp: RAMP.BRASS, bias: 0.15 };
    }
    return null;
  });

  // =========================================================================
  // 6. CRISPIN THE ALIEN PAWNBROKER — ANIMATED 96x96 VGA PORTRAIT RENDERER
  // =========================================================================
  function renderCrispinPortrait(ctx, width, height, state) {
    // Renders into an internal 96x96 ImageData and blits crisp pixel-art
    if (!renderCrispinPortrait.buf) {
      renderCrispinPortrait.img = ctx.createImageData(96, 96);
      renderCrispinPortrait.buf = new Uint32Array(renderCrispinPortrait.img.data.buffer);
    }
    const buf = renderCrispinPortrait.buf;
    const t = state.time || 0;
    const beat = state.beatPulse || 0; // 0..1 head bob & headphone thump
    const jawOpen = state.jawOpen || 0; // 0..1 talking mouth flap
    const spectrum = state.spectrum || null;

    const bobY = Math.round(beat * 2.6);

    // 1. Cyber-Pawnshop Background with dithered copper horizon & neon grid
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        let bgShade = 0.08 + (y / 96) * 0.25;
        if ((x % 16 === 0) || ((y + ((t * 12) | 0)) % 16 === 0)) bgShade += 0.08;
        buf[y * 96 + x] = sampleRamp(RAMP.STEEL, 16, bgShade, x, y, 0.7);
      }
    }

    function putPx(x, y, col) {
      if (x >= 0 && x < 96 && y >= 0 && y < 96) buf[y * 96 + x] = col;
    }

    const cx = 48;
    const headCy = 44 + bobY;

    // 2. Brushed-Chrome Pawnbroker Cyber-Collar & Shoulders
    for (let y = 66 + bobY; y < 96; y++) {
      for (let x = 8; x < 88; x++) {
        const adx = Math.abs(x - cx);
        const shoulderY = 68 + bobY + Math.pow(adx / 38, 1.7) * 14;
        if (y >= shoulderY) {
          const collar = adx < 22 && y < 82 + bobY;
          const bevel = 0.72 - adx * 0.012 - (y - shoulderY) * 0.015;
          let col = sampleRamp(collar ? RAMP.BRASS : RAMP.CHROME, 16, Math.max(0.15, bevel), x, y, 0.75);
          if (Math.abs(adx - 22) <= 1 || y === Math.round(shoulderY)) col = PALETTE[0];
          // Equalizer LED pips on collar
          if (collar && y >= 75 + bobY && y <= 78 + bobY && adx >= 8 && adx <= 18 && (x % 3 !== 0)) {
            col = PALETTE[RAMP.EMERALD + (beat > 0.35 ? 14 : 9)];
          }
          putPx(x, y, col);
        }
      }
    }

    // 3. DJ Headphone Band (arcing over Crispin's cranium, bobbing with beat!)
    for (let y = 8 + bobY; y < 52 + bobY; y++) {
      for (let x = 10; x < 86; x++) {
        const dx = x - cx;
        const dy = y - (38 + bobY);
        const r = Math.hypot(dx * 0.96, dy * 1.08);
        if (dy < 4 && r >= 27.5 && r <= 32.5) {
          const bandShade = 0.82 - Math.abs(r - 30) * 0.22;
          putPx(x, y, r < 28.3 || r > 31.7 ? PALETTE[0] : sampleRamp(RAMP.CHROME, 16, bandShade, x, y, 0.5));
        }
      }
    }

    // 4. Reptilian Alien Cranium (Emerald scales + brow ridges)
    for (let y = 14 + bobY; y < 66 + bobY; y++) {
      for (let x = 20; x < 76; x++) {
        const dx = x - cx;
        const adx = Math.abs(dx);
        const dy = y - headCy;
        // Tapered alien skull silhouette
        const maxW = dy < 0 ? 24 - Math.pow(-dy / 28, 1.8) * 10 : 24 - (dy / 26) * 8;
        if (adx <= maxW && dy >= -27 && dy <= 18) {
          if (adx >= maxW - 1.1 || dy <= -26) {
            putPx(x, y, PALETTE[0]);
          } else {
            const scaleTex = ((x + (y >> 1)) & 3) === 0 ? -0.06 : 0.04;
            const ridge = dy < -8 && Math.abs(adx - 9) < 2.2 ? 0.16 : 0;
            const light = 0.68 - (dx * 0.012) - (dy * 0.01) + scaleTex + ridge;
            putPx(x, y, sampleRamp(RAMP.EMERALD, 16, Math.max(0.14, Math.min(0.95, light)), x, y, 0.8));
          }
        }
      }
    }

    // 5. Articulated Talking Lower Jaw & Smug Grin (gold tooth glint!)
    const jawDrop = Math.round(jawOpen * 6);
    for (let y = 52 + bobY; y < 78 + bobY + jawDrop; y++) {
      for (let x = 26; x < 70; x++) {
        const dx = x - cx;
        const adx = Math.abs(dx);
        const localY = y - (56 + bobY + jawDrop);
        const jawW = 18 - Math.max(0, localY) * 0.75;
        if (localY >= -3 && localY <= 15 && adx <= jawW) {
          // Open mouth cavity between upper lip & dropped lower jaw
          if (y < 57 + bobY + jawDrop && adx < 13) {
            // Teeth & tongue
            if (y === 53 + bobY && adx < 11) {
              // Gold tooth on right!
              const isGoldTooth = dx >= 4 && dx <= 7;
              putPx(x, y, isGoldTooth ? PALETTE[RAMP.BRASS + 14] : PALETTE[14]);
            } else {
              putPx(x, y, PALETTE[RAMP.CORAL + 3]);
            }
          } else if (adx >= jawW - 1.1 || localY >= 14) {
            putPx(x, y, PALETTE[0]);
          } else {
            const chinShade = 0.56 - dx * 0.012 - localY * 0.018;
            putPx(x, y, sampleRamp(RAMP.EMERALD, 16, Math.max(0.14, chinShade), x, y, 0.75));
          }
        }
      }
    }
    // Closed-mouth smirk line when jawOpen == 0
    if (jawDrop <= 1) {
      for (let x = 35; x <= 62; x++) {
        const smileY = 56 + bobY - (x > 55 ? Math.round((x - 55) * 0.45) : 0);
        putPx(x, smileY, PALETTE[0]);
      }
      putPx(54, 55 + bobY, PALETTE[RAMP.BRASS + 14]); // Gold tooth peek!
    }

    // 6. Thumping DJ Ear-Cups (Left & Right, expanding on beat!)
    const cupBump = Math.round(beat * 1.8);
    for (let side of [-1, 1]) {
      const ecx = cx + side * (26 + cupBump);
      const ecy = 43 + bobY;
      for (let y = ecy - 11; y <= ecy + 11; y++) {
        for (let x = ecx - 6; x <= ecx + 6; x++) {
          const d = Math.hypot((x - ecx) * 1.15, (y - ecy) * 0.75);
          if (d <= 7.8) {
            if (d >= 6.8) putPx(x, y, PALETTE[0]);
            else if (d <= 2.6) putPx(x, y, PALETTE[RAMP.CYAN + (beat > 0.4 ? 14 : 9)]);
            else putPx(x, y, sampleRamp(RAMP.CHROME, 16, 0.75 - (x - ecx) * 0.06, x, y, 0.5));
          }
        }
      }
    }

    // 7. ICONIC WRAP-AROUND REFLECTIVE SUNGLASSES (with live audio spectrum & specular sweep!)
    for (let y = 33 + bobY; y <= 47 + bobY; y++) {
      for (let x = 23; x <= 73; x++) {
        const dx = x - cx;
        const adx = Math.abs(dx);
        const ly = y - (33 + bobY);
        // Twin wrap-around aviator/cyber lenses with nose bridge
        const bridge = ly <= 4 && adx <= 4;
        const lens = adx >= 2 && adx <= 23 && ly <= 13 - Math.pow((adx - 11) / 13, 2) * 5;
        if (bridge || lens) {
          const isFrame = ly === 0 || ly >= 12 || adx >= 22 || (adx <= 3 && ly > 3);
          if (isFrame) {
            putPx(x, y, ly === 0 ? PALETTE[RAMP.CHROME + 13] : PALETTE[0]);
          } else {
            // Inside reflective sunglasses: copper horizon + live spectrum reflection + diagonal glint!
            let col = sampleRamp(RAMP.NASHWAN, 16, 0.18 + (ly / 13) * 0.55, x, y, 0.5);
            if (spectrum && spectrum.length > 0) {
              const bin = Math.min(spectrum.length - 1, Math.floor(((x - 24) / 48) * 16));
              const amp = (spectrum[bin] / 255) * 9;
              if (12 - ly <= amp) {
                col = PALETTE[RAMP.CYAN + Math.min(15, 7 + ((amp) | 0))];
              }
            }
            const sweep = ((x + ly * 2 - Math.floor(t * 28)) % 34 + 34) % 34;
            if (sweep <= 2) col = PALETTE[15];
            else if (sweep <= 4) col = PALETTE[RAMP.CYAN + 13];
            putPx(x, y, col);
          }
        }
      }
    }

    ctx.imageSmoothingEnabled = false;
    // Draw to offscreen or temp canvas if scaled, or putImageData at 1:1 then scale
    if (!renderCrispinPortrait.tmpCanvas) {
      const tc = document.createElement('canvas');
      tc.width = 96;
      tc.height = 96;
      renderCrispinPortrait.tmpCanvas = tc;
      renderCrispinPortrait.tmpCtx = tc.getContext('2d');
    }
    renderCrispinPortrait.tmpCtx.putImageData(renderCrispinPortrait.img, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(renderCrispinPortrait.tmpCanvas, 0, 0, width, height);
  }

  XENON.SPRITES = SPRITES;
  XENON.compileLitSprite = compileLitSprite;
  XENON.renderCrispinPortrait = renderCrispinPortrait;
})();
