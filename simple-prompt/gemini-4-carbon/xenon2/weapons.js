(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});

  const SLOTS = [
    { id: 'nose', label: 'NOSE CANNON', short: 'NOSE' },
    { id: 'leftWing', label: 'LEFT WING POD', short: 'L-WING' },
    { id: 'rightWing', label: 'RIGHT WING POD', short: 'R-WING' },
    { id: 'rearTail', label: 'REAR TAILGUN', short: 'TAIL' },
    { id: 'drones', label: 'ORBITAL DRONES', short: 'DRONES' },
    { id: 'hull', label: 'HULL / ENGINE', short: 'HULL' }
  ];

  // 16 Hardpoint Modules + 5 Consumables/Specials = 21 Upgrades
  const CATALOG = {
    // --- NOSE SLOT ---
    pulse_mk1: {
      id: 'pulse_mk1',
      name: 'Pulse Vulcan Mk.I',
      slot: 'nose',
      cost: 100,
      sprite: 'nose_vulcan_1',
      tag: 'STARTER',
      desc: 'Standard rapid-fire chrome pulse barrel. Reliable trade-in fodder.'
    },
    twin_vulcan: {
      id: 'twin_vulcan',
      name: 'Twin Vulcan',
      slot: 'nose',
      cost: 220,
      sprite: 'nose_twin_vulcan',
      tag: 'KINETIC',
      desc: 'High-ROF dual titanium gatling cannons shredding light swarms & coral.'
    },
    plasma_spread: {
      id: 'plasma_spread',
      name: 'Plasma Spread',
      slot: 'nose',
      cost: 360,
      sprite: 'nose_plasma_spread',
      tag: 'WIDE 3-WAY',
      desc: 'Fires 3 incandescent Bitmap-sheen plasma spheres in a wide fan.'
    },
    electro_arc: {
      id: 'electro_arc',
      name: 'Electro-Arc Beam',
      slot: 'nose',
      cost: 460,
      sprite: 'nose_electro_arc',
      tag: 'SYNERGY: TESLA',
      desc: 'High-voltage lightning arc locking onto forward foes. Pairs w/ Dual Drones!'
    },

    // --- WING POD SLOTS (COMPATIBLE WITH LEFT WING OR RIGHT WING) ---
    side_laser: {
      id: 'side_laser',
      name: 'Side-Laser Pods',
      slot: 'wing',
      cost: 280,
      sprite: 'wing_side_laser',
      tag: 'SYNERGY: PRISM',
      desc: 'High-velocity coherent laser pod. Pair w/ Bounce-Orb for Prism Matrix!'
    },
    bounce_orb: {
      id: 'bounce_orb',
      name: 'Bounce-Orb Launchers',
      slot: 'wing',
      cost: 320,
      sprite: 'wing_bounce_orb',
      tag: 'SYNERGY: PRISM',
      desc: 'Xenon-classic emerald plasma spheres ricocheting 5x off cavern walls!'
    },
    homing_missile: {
      id: 'homing_missile',
      name: 'Homing Missile Racks',
      slot: 'wing',
      cost: 340,
      sprite: 'wing_homing_missile',
      tag: 'SEEKER',
      desc: ' Launches agile micro-missiles that curl around cavern bottlenecks.'
    },
    flak_pod: {
      id: 'flak_pod',
      name: 'Shrapnel Flak Pod',
      slot: 'wing',
      cost: 240,
      sprite: 'wing_flak',
      tag: 'WALLBREAKER',
      desc: '3-pellet brass shrapnel burst dealing 2x damage to destructible walls.'
    },

    // --- REAR TAIL SLOT ---
    rear_cannon: {
      id: 'rear_cannon',
      name: 'Rear Tail Cannon',
      slot: 'rearTail',
      cost: 230,
      sprite: 'tail_rear_cannon',
      tag: 'AFT GUARD',
      desc: 'Twin aft-facing plasma barrels blasting enemies sneaking up behind you.'
    },
    temporal_mines: {
      id: 'temporal_mines',
      name: 'Temporal Proximity Mines',
      slot: 'rearTail',
      cost: 350,
      sprite: 'tail_temporal_mines',
      tag: 'SYNERGY: NOVA',
      desc: 'Drops drifting chrono-mines. Reverse/Chrono Thrust triggers Backfire Nova!'
    },

    // --- ORBITAL DRONES SLOT ---
    scout_drone: {
      id: 'scout_drone',
      name: 'Orbiting Electro-Drone',
      slot: 'drones',
      cost: 260,
      sprite: 'drone_scout',
      tag: '1X ORBITAL',
      desc: 'Autonomous chrome sphere orbiting hull, blocking shots & firing pulses.'
    },
    dual_drones: {
      id: 'dual_drones',
      name: 'Dual Orbiting Drones',
      slot: 'drones',
      cost: 480,
      sprite: 'drone_tesla',
      tag: 'SYNERGY: TESLA',
      desc: 'Twin counter-orbiting Tesla drones. Pair w/ Electro-Arc for Chain Swarm!'
    },

    // --- HULL / ENGINE SLOT ---
    hull_plating: {
      id: 'hull_plating',
      name: 'Hull Plating',
      slot: 'hull',
      cost: 300,
      sprite: 'hull_plating',
      tag: '+45 MAX HP',
      desc: 'Bolts gilded Titan pauldrons onto fuselage (+45 Max Hull & -25% dmg).'
    },
    chrono_capacitor: {
      id: 'chrono_capacitor',
      name: 'Chrono-Capacitor',
      slot: 'hull',
      cost: 340,
      sprite: 'hull_chrono',
      tag: '+80% REWIND',
      desc: 'Expands Chrono-Energy core & doubles time-rewind recharge rate.'
    },
    twin_thrusters: {
      id: 'twin_thrusters',
      name: 'Twin Ion Thrusters',
      slot: 'hull',
      cost: 260,
      sprite: 'hull_chrono',
      tag: '+SPEED/REV',
      desc: '+30% ship agility & supercharged Reverse-Scroll cavern braking.'
    }
  };

  const SPECIALS = [
    {
      id: 'shield_repair',
      name: 'Shield & Hull Repair',
      cost: 120,
      tag: '+60 HP / +SHLD',
      desc: "Crispin's arc-welder patches +60 Hull HP and recharges +45 Shield."
    },
    {
      id: 'speed_booster',
      name: 'Speed Boosters',
      cost: 180,
      tag: 'PERM +SPEED',
      desc: 'Overclocks flight servos (+1 Permanent Speed Tier, max Lv.4).'
    },
    {
      id: 'smart_bomb',
      name: 'Smart Bomb (+1)',
      cost: 150,
      tag: 'KEY [Q]/[X]',
      desc: 'Screen-clearing Megablast plasma shockwave that vaporizes enemy fire.'
    },
    {
      id: 'boss_intel',
      name: "Crispin's Boss Intel",
      cost: 140,
      tag: '+25% BOSS CRIT',
      desc: 'Reveals Epoch Guardian weakpoint & grants +25% bonus boss damage!'
    },
    {
      id: 'super_nashwan',
      name: 'SUPER NASHWAN POWER',
      cost: 550,
      tag: '20s OVERDRIVE!',
      desc: 'THE ULTIMATE: 20 seconds of full-arsenal rainbow Megablast Overdrive!'
    }
  ];

  const SYNERGY_DEFS = [
    {
      id: 'prism_matrix',
      name: 'RICOCHET PRISM MATRIX',
      reqText: 'Side-Laser Pods + Bounce-Orb Launchers',
      desc: 'Lasers reflect off cavern walls & refract off Bounce-Orbs into 3x RGB Prism Beams!'
    },
    {
      id: 'chrono_nova',
      name: 'CHRONO BACKFIRE NOVA',
      reqText: 'Temporal Proximity Mines + Reverse/Chrono Thrust',
      desc: 'Backing up [Down/S] or Rewinding [R/Shift] blasts an 8-orb ring of Temporal Plasma Mines!'
    },
    {
      id: 'tesla_swarm',
      name: 'TESLA CHAIN SWARM',
      reqText: 'Electro-Arc Beam + Dual Orbiting Drones',
      desc: 'Chains high-voltage lightning bolts from your Orbiting Drones across nearby enemy swarms!'
    }
  ];

  function isSlotCompatible(item, slotId) {
    if (!item) return false;
    if (item.slot === 'wing') return slotId === 'leftWing' || slotId === 'rightWing';
    return item.slot === slotId;
  }

  function getTradeInValue(itemId) {
    const item = CATALOG[itemId];
    return item ? Math.floor(item.cost * 0.5) : 0;
  }

  function computeActiveSynergies(loadout, nashwanActive = false) {
    if (nashwanActive) {
      return {
        prism_matrix: true,
        chrono_nova: true,
        tesla_swarm: true,
        list: SYNERGY_DEFS.slice()
      };
    }
    const wings = [loadout.leftWing, loadout.rightWing];
    const hasSideLaser = wings.includes('side_laser');
    const hasBounceOrb = wings.includes('bounce_orb');

    const prism_matrix = hasSideLaser && hasBounceOrb;
    const chrono_nova = loadout.rearTail === 'temporal_mines';
    const tesla_swarm = loadout.nose === 'electro_arc' && loadout.drones === 'dual_drones';

    const list = [];
    if (prism_matrix) list.push(SYNERGY_DEFS[0]);
    if (chrono_nova) list.push(SYNERGY_DEFS[1]);
    if (tesla_swarm) list.push(SYNERGY_DEFS[2]);

    return { prism_matrix, chrono_nova, tesla_swarm, list };
  }

  // Fires all equipped hardpoint weapons (or full arsenal during Super Nashwan!)
  function firePlayerArsenal(game) {
    const p = game.player;
    const nashwan = p.nashwanTimer > 0;
    const loadout = p.loadout;
    const syn = computeActiveSynergies(loadout, nashwan);

    // 1. NOSE HARDPOINT
    const noseId = nashwan ? 'plasma_spread' : loadout.nose;
    if (p.cdNose <= 0 && noseId) {
      if (noseId === 'pulse_mk1') {
        game.spawnBullet(p.x, p.y - 13, 0, -4.6, 12, 'vulcan', '#7dd3fc');
        p.cdNose = 8;
        XENON.audio.playLaser('vulcan');
      } else if (noseId === 'twin_vulcan') {
        game.spawnBullet(p.x - 4, p.y - 12, 0, -5.2, 11, 'vulcan', '#fde047');
        game.spawnBullet(p.x + 4, p.y - 12, 0, -5.2, 11, 'vulcan', '#fde047');
        p.cdNose = 5;
        XENON.audio.playLaser('vulcan');
      } else if (noseId === 'plasma_spread') {
        game.spawnBullet(p.x, p.y - 14, 0, -4.5, 17, 'plasma', '#f472b6');
        game.spawnBullet(p.x - 4, p.y - 12, -1.05, -4.3, 14, 'plasma', '#f472b6');
        game.spawnBullet(p.x + 4, p.y - 12, 1.05, -4.3, 14, 'plasma', '#f472b6');
        if (nashwan) {
          game.spawnBullet(p.x - 6, p.y - 10, -2.0, -4.0, 14, 'plasma', '#38bdf8');
          game.spawnBullet(p.x + 6, p.y - 10, 2.0, -4.0, 14, 'plasma', '#38bdf8');
        }
        p.cdNose = nashwan ? 5 : 10;
        XENON.audio.playLaser(nashwan ? 'nashwan' : 'plasma');
      } else if (noseId === 'electro_arc') {
        game.fireElectroArc(p.x, p.y - 12, syn.tesla_swarm);
        p.cdNose = 6;
        XENON.audio.playLaser('electro');
      }

      // During Super Nashwan, ALSO fire Electro-Arc!
      if (nashwan) {
        game.fireElectroArc(p.x, p.y - 12, true);
      }
    }

    // 2. LEFT & RIGHT WING POD HARDPOINTS
    const wingSlots = [
      { id: nashwan ? 'side_laser' : loadout.leftWing, side: -1, cdKey: 'cdLeftWing' },
      { id: nashwan ? 'bounce_orb' : loadout.rightWing, side: 1, cdKey: 'cdRightWing' }
    ];

    for (const w of wingSlots) {
      if (!w.id || p[w.cdKey] > 0) continue;
      const wx = p.x + w.side * 12;
      const wy = p.y;

      if (w.id === 'side_laser') {
        // Straight laser + slight inward prism-seeker angle when Prism Matrix is active!
        const vx = syn.prism_matrix ? -w.side * 0.85 : 0;
        game.spawnBullet(wx, wy - 5, vx, -5.8, 15, 'laser', '#e879f9', {
          bouncesLeft: syn.prism_matrix ? 2 : 0,
          canPrism: syn.prism_matrix
        });
        if (syn.prism_matrix) {
          game.spawnBullet(wx, wy - 5, w.side * 1.15, -5.5, 12, 'laser', '#38bdf8', {
            bouncesLeft: 2,
            canPrism: true
          });
        }
        p[w.cdKey] = nashwan ? 6 : 9;
      } else if (w.id === 'bounce_orb') {
        game.spawnBullet(wx, wy - 4, w.side * 1.65, -3.6, 19, 'bounce_orb', '#4ade80', {
          bouncesLeft: 5
        });
        p[w.cdKey] = nashwan ? 8 : 13;
      } else if (w.id === 'homing_missile') {
        game.spawnBullet(wx, wy - 2, w.side * 1.4, -2.4, 24, 'missile', '#fb7185');
        p[w.cdKey] = nashwan ? 10 : 16;
      } else if (w.id === 'flak_pod') {
        for (let k = -1; k <= 1; k++) {
          game.spawnBullet(wx, wy - 4, w.side * 0.7 + k * 0.9, -4.6, 11, 'flak', '#fbbf24', {
            wallBonus: 2
          });
        }
        p[w.cdKey] = 11;
      }

      if (nashwan && w.side === -1 && p.frameCount % 12 === 0) {
        game.spawnBullet(p.x - 10, p.y, -1.8, -2.8, 22, 'missile', '#fb7185');
        game.spawnBullet(p.x + 10, p.y, 1.8, -2.8, 22, 'missile', '#fb7185');
      }
    }

    // 3. REAR TAIL HARDPOINT
    const tailId = nashwan ? 'temporal_mines' : loadout.rearTail;
    if (tailId && p.cdTail <= 0) {
      if (tailId === 'rear_cannon') {
        game.spawnBullet(p.x - 3, p.y + 12, -0.35, 4.4, 13, 'vulcan', '#38bdf8');
        game.spawnBullet(p.x + 3, p.y + 12, 0.35, 4.4, 13, 'vulcan', '#38bdf8');
        p.cdTail = 10;
      } else if (tailId === 'temporal_mines') {
        game.spawnBullet(p.x, p.y + 12, (Math.random() - 0.5) * 0.8, 1.8, 28, 'mine', '#c084fc', {
          ttl: 135
        });
        p.cdTail = nashwan ? 12 : 20;
      }
    }

    // 4. ORBITAL DRONES
    const droneId = nashwan ? 'dual_drones' : loadout.drones;
    if (droneId && p.cdDrones <= 0) {
      const positions = game.getDronePositions();
      for (const dp of positions) {
        game.spawnBullet(dp.x, dp.y - 5, 0, -4.8, 10, 'drone_pulse', '#38bdf8');
      }
      p.cdDrones = nashwan ? 7 : 12;
    }
  }

  // Triggered when Chrono Backfire Nova synergy is active while backing up or rewinding!
  function triggerChronoBackfireNova(game) {
    const p = game.player;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + (game.tick * 0.05);
      game.spawnBullet(
        p.x + Math.cos(ang) * 8,
        p.y + Math.sin(ang) * 8,
        Math.cos(ang) * 2.5,
        Math.sin(ang) * 2.5,
        26,
        'mine',
        '#f472b6',
        { ttl: 85, isNova: true }
      );
    }
    game.addFloatingText(p.x, p.y - 16, 'CHRONO NOVA!', XENON.PALETTE[XENON.RAMP.NASHWAN + 14]);
    XENON.audio.playLaser('nashwan');
  }

  XENON.WEAPONS = {
    SLOTS,
    CATALOG,
    SPECIALS,
    SYNERGY_DEFS,
    isSlotCompatible,
    getTradeInValue,
    computeActiveSynergies,
    firePlayerArsenal,
    triggerChronoBackfireNova
  };
})();
