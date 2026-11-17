/* ============================================================================
 * js/entities.js
 * Weapons (5 Swap-On-Pickup + Golden Magic), Particle Physics, Ejected Armor
 * Anvil, Reactive Undead AI (Smart Dodging Red Arremer), 8s Monster Possession
 * & 6 Multi-Part Bosses culminating in 3-Phase Astaroth-LeChuck-9000
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});
  const TILE = GNG.TILE;
  const TS = GNG.TILE_SIZE;
  const hex = GNG.hexToCol;

  const WEAPON_DEFS = {
    LANCE: {
      id: 'LANCE',
      name: 'JAVELIN',
      cooldown: 15,
      maxActive: 2,
      damage: 3.0,
      sfx: 'throwLance',
      magicName: 'THUNDER DRAGON'
    },
    DAGGER: {
      id: 'DAGGER',
      name: 'DAGGER',
      cooldown: 8,
      maxActive: 4,
      damage: 1.7,
      sfx: 'throwDagger',
      magicName: 'BLADE TEMPEST'
    },
    TORCH: {
      id: 'TORCH',
      name: 'HOLY TORCH',
      cooldown: 18,
      maxActive: 2,
      damage: 2.0,
      sfx: 'throwTorch',
      magicName: 'FIRE PHOENIX'
    },
    AXE: {
      id: 'AXE',
      name: 'BATTLE AXE',
      cooldown: 19,
      maxActive: 2,
      damage: 3.6,
      sfx: 'throwAxe',
      magicName: 'TORNADO CLEAVER'
    },
    CROSS: {
      id: 'CROSS',
      name: 'CROSS SHIELD',
      cooldown: 14,
      maxActive: 3,
      damage: 2.4,
      sfx: 'throwCross',
      magicName: 'SUNBURST AEGIS'
    }
  };

  const WEAPON_ORDER = ['LANCE', 'DAGGER', 'TORCH', 'AXE', 'CROSS'];

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function tileAtWorld(level, wx, wy) {
    const c = Math.floor(wx / TS);
    const r = Math.floor(wy / TS);
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows) {
      return r >= level.rows ? TILE.HAZARD : TILE.EMPTY;
    }
    const t = level.grid[r * level.cols + c];
    if (t === TILE.DRAWBRIDGE) {
      const st = level.drawbridges.get(r * level.cols + c);
      if (st && st.state === 'gone') return TILE.EMPTY;
    }
    return t;
  }

  function isSolidFloorTile(t) {
    return (
      t === TILE.SOLID ||
      t === TILE.PLATFORM ||
      t === TILE.CRACKED ||
      t === TILE.GHOST_PLAT ||
      t === TILE.CONV_LEFT ||
      t === TILE.CONV_RIGHT ||
      t === TILE.DRAWBRIDGE ||
      t === TILE.GATE
    );
  }

  function isSolidWallTile(t) {
    return t === TILE.SOLID || t === TILE.GATE;
  }

  // --- PARTICLE & FLOATING POPUP ENGINE ---
  class ParticleSystem {
    constructor() {
      this.list = [];
      this.popups = [];
    }

    clear() {
      this.list.length = 0;
      this.popups.length = 0;
    }

    add(p) {
      if (this.list.length < 260) {
        this.list.push(p);
      }
    }

    popup(x, y, text, col) {
      this.popups.push({
        x,
        y,
        text,
        col: col || hex('#fff29c'),
        life: 46
      });
    }

    spawnArmorShatter(x, y, isGold) {
      const cols = isGold
        ? [hex('#fff29c'), hex('#ecc146'), hex('#eb4034')]
        : [hex('#f6f8fc'), hex('#c3ccd9'), hex('#8390a3')];
      for (let i = 0; i < 12; i++) {
        const ang = -Math.PI * 0.15 - (Math.PI * 0.7 * i) / 11;
        const spd = 1.6 + (i % 3) * 0.9;
        this.add({
          x,
          y,
          vx: Math.cos(ang) * spd + (Math.random() - 0.5),
          vy: Math.sin(ang) * spd - 1.4,
          grav: 0.18,
          bounce: 0.52,
          size: i < 5 ? 4 : 2,
          col: cols[i % cols.length],
          life: 52 + ((Math.random() * 18) | 0)
        });
      }
    }

    spawnBones(x, y, count) {
      const n = count || 8;
      for (let i = 0; i < n; i++) {
        this.add({
          x,
          y,
          vx: (Math.random() - 0.5) * 4.2,
          vy: -1.6 - Math.random() * 2.8,
          grav: 0.19,
          bounce: 0.45,
          size: (i & 1) ? 3 : 2,
          col: (i & 1) ? hex('#f0e9d8') : hex('#b5ab94'),
          life: 40 + ((Math.random() * 20) | 0)
        });
      }
    }

    spawnSplash(x, y, colHex, count) {
      const c = hex(colHex);
      const n = count || 8;
      for (let i = 0; i < n; i++) {
        this.add({
          x,
          y,
          vx: (Math.random() - 0.5) * 3.4,
          vy: -1.0 - Math.random() * 2.4,
          grav: 0.16,
          bounce: 0.2,
          size: 2,
          col: c,
          life: 24 + ((Math.random() * 14) | 0)
        });
      }
    }

    spawnRubble(x, y) {
      for (let i = 0; i < 10; i++) {
        this.add({
          x: x + (Math.random() - 0.5) * 12,
          y,
          vx: (Math.random() - 0.5) * 3.2,
          vy: -1.2 - Math.random() * 2.2,
          grav: 0.22,
          bounce: 0.35,
          size: 3,
          col: (i & 1) ? hex('#bfa084') : hex('#6e5540'),
          life: 36
        });
      }
    }

    spawnEmbers(x, y, colHex, count) {
      const c = hex(colHex);
      for (let i = 0; i < (count || 6); i++) {
        this.add({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.6 - Math.random() * 1.4,
          grav: -0.02,
          bounce: 0,
          size: (i & 1) ? 2 : 1,
          col: c,
          life: 22 + ((Math.random() * 14) | 0)
        });
      }
    }

    update(level) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.grav;
        if (p.bounce > 0 && p.vy > 0) {
          const t = tileAtWorld(level, p.x, p.y + p.size);
          if (isSolidFloorTile(t)) {
            p.y = Math.floor((p.y + p.size) / TS) * TS - p.size;
            p.vy = -p.vy * p.bounce;
            p.vx *= 0.78;
          }
        }
        if (--p.life <= 0) {
          this.list.splice(i, 1);
        }
      }

      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.y -= 0.35;
        if (--pop.life <= 0) {
          this.popups.splice(i, 1);
        }
      }
    }

    render(fb, camX) {
      for (const p of this.list) {
        const sx = (p.x - camX) | 0;
        if (sx < -6 || sx > 326) continue;
        fb.rect(sx, p.y | 0, p.size, p.size, p.col);
      }
      const shadow = hex('#08090d');
      for (const pop of this.popups) {
        const sx = (pop.x - camX) | 0;
        if (sx < -40 || sx > 340) continue;
        fb.text(pop.text, sx, pop.y | 0, pop.col, shadow, 1);
      }
    }
  }

  // --- PLAYER WEAPON SPAWNER & GOLDEN MAGIC SPELLS ---
  function firePlayerWeapon(world, p) {
    const def = WEAPON_DEFS[p.weapon] || WEAPON_DEFS.LANCE;
    let activeCount = 0;
    for (const s of world.playerShots) {
      if (s.sourceWeapon === def.id && !s.isSubFlame && !s.isMagic) activeCount++;
    }
    if (activeCount >= def.maxActive) return false;

    const empowered = p.armor === 'steel' || p.armor === 'gold';
    const dmgMul = p.armor === 'gold' ? 1.45 : p.armor === 'steel' ? 1.25 : 1.0;
    const dmg = def.damage * dmgMul;
    const dir = p.facing;
    const aimUp = p.aimUp && !p.crouching;

    const spawnX = aimUp ? p.x + 4 : p.x + (dir > 0 ? 12 : -6);
    const spawnY = aimUp ? p.y - 6 : p.crouching ? p.y + 10 : p.y + 5;

    world.audio.sfx(def.sfx);

    if (def.id === 'LANCE') {
      world.playerShots.push({
        kind: 'lance',
        sourceWeapon: 'LANCE',
        x: spawnX,
        y: spawnY,
        w: aimUp ? 5 : 16,
        h: aimUp ? 14 : 5,
        vx: aimUp ? 0 : dir * (empowered ? 5.1 : 4.4),
        vy: aimUp ? -(empowered ? 5.1 : 4.4) : 0,
        dmg,
        dir,
        aimUp,
        empowered,
        pierce: p.armor === 'gold',
        breaksShield: empowered,
        life: 68
      });
    } else if (def.id === 'DAGGER') {
      world.playerShots.push({
        kind: 'dagger',
        sourceWeapon: 'DAGGER',
        x: spawnX,
        y: spawnY + 1,
        w: aimUp ? 5 : 12,
        h: aimUp ? 10 : 5,
        vx: aimUp ? 0 : dir * (empowered ? 6.2 : 5.4),
        vy: aimUp ? -(empowered ? 6.2 : 5.4) : 0,
        dmg,
        dir,
        aimUp,
        empowered,
        pierce: false,
        breaksShield: false,
        life: 52
      });
    } else if (def.id === 'TORCH') {
      world.playerShots.push({
        kind: 'torch',
        sourceWeapon: 'TORCH',
        x: spawnX,
        y: spawnY,
        w: 8,
        h: 8,
        vx: aimUp ? dir * 1.1 : dir * (empowered ? 3.1 : 2.6),
        vy: aimUp ? -4.8 : -3.2,
        grav: 0.19,
        dmg,
        dir,
        empowered,
        pierce: false,
        breaksShield: true,
        life: 90
      });
    } else if (def.id === 'AXE') {
      world.playerShots.push({
        kind: 'axe',
        sourceWeapon: 'AXE',
        x: spawnX,
        y: spawnY - 2,
        w: 12,
        h: 12,
        vx: aimUp ? dir * 1.4 : dir * (empowered ? 3.2 : 2.7),
        vy: aimUp ? -5.3 : -4.2,
        grav: 0.16,
        dmg,
        dir,
        empowered,
        pierce: true,
        breaksShield: true,
        hitIds: new Set(),
        life: 85
      });
    } else if (def.id === 'CROSS') {
      world.playerShots.push({
        kind: 'cross',
        sourceWeapon: 'CROSS',
        x: spawnX,
        y: spawnY - 1,
        w: 10,
        h: 10,
        vx: aimUp ? 0 : dir * (empowered ? 4.2 : 3.6),
        vy: aimUp ? -(empowered ? 4.2 : 3.6) : 0,
        dmg,
        dir,
        aimUp,
        empowered,
        returnTimer: empowered ? 28 : 22,
        returning: false,
        pierce: true,
        breaksShield: false,
        destroysEnemyShots: true,
        hitIds: new Set(),
        life: 110
      });
    }

    return true;
  }

  function castGoldenMagic(world, p) {
    const def = WEAPON_DEFS[p.weapon] || WEAPON_DEFS.LANCE;
    world.audio.sfx('magicCast');
    world.lightningFlash = 0.95;
    world.shakeTimer = 18;
    world.particles.popup(p.x - 18, p.y - 14, def.magicName + '!', hex('#fff29c'));

    // Vaporize all enemy projectiles on screen!
    for (const es of world.enemyShots) {
      world.particles.spawnEmbers(es.x, es.y, '#fff29c', 4);
    }
    world.enemyShots.length = 0;

    if (p.weapon === 'LANCE') {
      // Twin Thunder Dragons blasting horizontally & vertically across screen
      world.magicEffects.push({ kind: 'thunderDragon', x: p.x + 6, y: p.y + 8, life: 34 });
      damageAllVisibleEnemies(world, 11);
    } else if (p.weapon === 'DAGGER') {
      // 12-way Radial Golden Blade Tempest
      for (let i = 0; i < 12; i++) {
        const ang = (Math.PI * 2 * i) / 12;
        world.playerShots.push({
          kind: 'dagger',
          sourceWeapon: 'DAGGER',
          isMagic: true,
          x: p.x + 4,
          y: p.y + 6,
          w: 10,
          h: 10,
          vx: Math.cos(ang) * 5.2,
          vy: Math.sin(ang) * 5.2,
          dmg: 4.5,
          dir: Math.cos(ang) >= 0 ? 1 : -1,
          aimUp: Math.abs(Math.sin(ang)) > 0.75,
          pierce: true,
          breaksShield: true,
          hitIds: new Set(),
          life: 65
        });
      }
      damageAllVisibleEnemies(world, 6);
    } else if (p.weapon === 'TORCH') {
      // Twin Spiraling Blue Fire Phoenixes
      for (let side = -1; side <= 1; side += 2) {
        world.magicEffects.push({
          kind: 'phoenix',
          cx: p.x + 6,
          cy: p.y + 6,
          angle: side > 0 ? 0 : Math.PI,
          radius: 8,
          life: 48
        });
      }
      damageAllVisibleEnemies(world, 10);
    } else if (p.weapon === 'AXE') {
      // Sweeping Crimson Tornado Cleavers
      for (let side = -1; side <= 1; side += 2) {
        world.playerShots.push({
          kind: 'tornado',
          sourceWeapon: 'AXE',
          isMagic: true,
          x: p.x,
          y: p.y - 26,
          w: 20,
          h: 48,
          vx: side * 3.4,
          vy: 0,
          dmg: 8.5,
          dir: side,
          pierce: true,
          breaksShield: true,
          destroysEnemyShots: true,
          hitIds: new Set(),
          life: 65
        });
      }
      damageAllVisibleEnemies(world, 7);
    } else {
      // CROSS: Sacred Sunburst + Divine Aegis Invulnerability
      p.invuln = Math.max(p.invuln, 150);
      world.magicEffects.push({ kind: 'sunburst', x: p.x + 6, y: p.y + 8, life: 36 });
      damageAllVisibleEnemies(world, 9.5);
    }
  }

  function damageAllVisibleEnemies(world, dmg) {
    const camX = world.camX;
    for (const e of world.enemies) {
      if (e.dead || e.possessed) continue;
      if (e.x + e.w >= camX - 16 && e.x <= camX + 336) {
        hurtEnemy(world, e, dmg, true);
      }
    }
    if (world.boss && !world.boss.dead) {
      hurtBoss(world, world.boss, dmg * 0.85);
    }
  }

  // --- ENEMY FACTORY & REACTIVE AI ---
  let nextEntityId = 1;

  function createEnemy(spawn) {
    const base = {
      id: nextEntityId++,
      type: spawn.type,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      w: 14,
      h: 20,
      hp: 2,
      maxHp: 2,
      facing: -1,
      timer: 0,
      flash: 0,
      grounded: false,
      dead: false,
      possessed: false,
      pirate: !!spawn.pirate,
      potWeapon: spawn.potWeapon || null,
      miniBoss: !!spawn.miniBoss,
      score: 200
    };

    switch (spawn.type) {
      case 'zombie':
        base.state = 'rising';
        base.riseTimer = 28;
        base.hp = 2;
        base.maxHp = 2;
        base.h = 18;
        base.y += 2;
        base.score = 200;
        break;
      case 'skeleton':
        base.state = 'patrol';
        base.hp = 3;
        base.maxHp = 3;
        base.score = 300;
        break;
      case 'skelSword':
        base.state = 'patrol';
        base.hp = 4;
        base.maxHp = 4;
        base.shielded = true;
        base.score = 400;
        break;
      case 'hauntedArmor':
        base.state = 'march';
        base.w = 16;
        base.h = 22;
        base.y -= 2;
        base.hp = 6;
        base.maxHp = 6;
        base.shielded = true;
        base.score = 600;
        break;
      case 'voodooSkull':
        base.state = 'fly';
        base.w = 14;
        base.h = 12;
        base.baseY = spawn.y;
        base.hp = 2;
        base.maxHp = 2;
        base.score = 250;
        break;
      case 'lemming':
        base.state = 'block';
        base.w = 14;
        base.h = 16;
        base.y += 4;
        base.hp = 2.5;
        base.maxHp = 2.5;
        base.countdown = -1;
        base.score = 350;
        break;
      case 'cyberImp':
        base.state = 'prowl';
        base.w = 15;
        base.h = 18;
        base.y += 2;
        base.hp = 4;
        base.maxHp = 4;
        base.score = 450;
        break;
      case 'arremer':
      case 'arremerElite':
        base.state = spawn.statue ? 'statue' : 'hover';
        base.w = 16;
        base.h = 16;
        base.hp = spawn.type === 'arremerElite' ? 12 : 5;
        base.maxHp = base.hp;
        base.dodgeCooldown = 0;
        base.swoopOriginY = Math.max(38, spawn.y - 24);
        base.score = spawn.type === 'arremerElite' ? 2000 : 800;
        break;
      default:
        break;
    }
    return base;
  }

  function hurtEnemy(world, e, dmg, ignoreShield, hitDir) {
    if (e.dead) return;
    if (e.type === 'arremer' && e.state === 'statue') {
      e.state = 'hover';
      world.particles.spawnRubble(e.x + 8, e.y + 8);
    }

    // Frontal shield parry on Haunted Armor & Stage 3 Skeleton Swordsmen!
    if (e.shielded && !ignoreShield && hitDir && hitDir === -e.facing) {
      world.audio.sfx('shieldClink');
      world.particles.spawnEmbers(e.x + (e.facing > 0 ? 14 : 0), e.y + 8, '#fff29c', 5);
      return;
    }

    e.hp -= dmg;
    e.flash = 6;
    if (e.hp <= 0) {
      e.dead = true;
      world.score += e.score;
      world.audio.sfx('enemyKill');
      world.particles.spawnBones(e.x + e.w * 0.5, e.y + e.h * 0.5, 9);
      world.particles.spawnSplash(e.x + e.w * 0.5, e.y + e.h * 0.5, '#eb4034', 6);
      if (e.miniBoss) {
        world.particles.popup(e.x - 10, e.y - 8, 'ARREMER SLAIN! +2000', hex('#fff29c'));
      }
      if (e.potWeapon) {
        world.pickups.push({
          kind: 'weapon',
          weapon: e.potWeapon,
          x: e.x,
          y: e.y - 4,
          vy: -2.4,
          life: 600
        });
      }
    } else {
      world.audio.sfx('enemyHit');
    }
  }

  function applyGroundPhysics(level, ent) {
    ent.x += ent.vx;
    // Wall check
    if (ent.vx !== 0) {
      const checkX = ent.vx > 0 ? ent.x + ent.w : ent.x;
      const tMid = tileAtWorld(level, checkX, ent.y + ent.h * 0.5);
      if (isSolidWallTile(tMid)) {
        ent.x = ent.vx > 0 ? Math.floor(checkX / TS) * TS - ent.w : (Math.floor(checkX / TS) + 1) * TS;
        ent.vx = -ent.vx;
      }
    }

    const prevBottom = ent.y + ent.h;
    ent.vy = Math.min(5.2, ent.vy + 0.22);
    ent.y += ent.vy;
    ent.grounded = false;

    if (ent.vy >= 0) {
      const footY = ent.y + ent.h;
      const tL = tileAtWorld(level, ent.x + 2, footY);
      const tR = tileAtWorld(level, ent.x + ent.w - 2, footY);
      const tileTop = Math.floor(footY / TS) * TS;
      if ((isSolidFloorTile(tL) || isSolidFloorTile(tR)) && prevBottom <= tileTop + 6) {
        ent.y = tileTop - ent.h;
        ent.vy = 0;
        ent.grounded = true;
        if (tL === TILE.CONV_LEFT || tR === TILE.CONV_LEFT) ent.x -= 0.65;
        if (tL === TILE.CONV_RIGHT || tR === TILE.CONV_RIGHT) ent.x += 0.65;
      }
    }
  }

  function updateEnemies(world) {
    const p = world.player;
    const targetX = p.possessing ? p.possessing.x : p.x;
    const targetY = p.possessing ? p.possessing.y : p.y;

    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      if (e.dead) {
        world.enemies.splice(i, 1);
        continue;
      }
      if (e.flash > 0) e.flash--;
      if (e.possessed) continue; // Controlled directly by Arthur's Soul!

      e.timer++;
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      e.facing = dx >= 0 ? 1 : -1;

      if (e.type === 'zombie') {
        if (e.state === 'rising') {
          if ((e.timer & 3) === 0) world.particles.spawnSplash(e.x + 7, e.y + 16, '#7a5939', 2);
          if (--e.riseTimer <= 0) {
            e.state = 'walk';
            e.vx = e.facing * 0.68;
          }
        } else {
          if (e.timer % 50 === 0) e.vx = e.facing * (0.68 + (world.loop > 1 ? 0.25 : 0));
          applyGroundPhysics(world.level, e);
          if (e.timer % 130 === 90 && Math.abs(dx) < 150) {
            // Spit arcing corrosive zombie acid!
            world.enemyShots.push({
              kind: 'acid',
              x: e.x + (e.facing > 0 ? 12 : -2),
              y: e.y + 5,
              vx: e.facing * 2.1,
              vy: -2.4,
              grav: 0.12,
              w: 5,
              h: 5,
              life: 95
            });
          }
        }
      } else if (e.type === 'skeleton' || e.type === 'skelSword') {
        const spd = e.type === 'skelSword' ? 0.92 : 0.82;
        if (Math.abs(dx) > 48) {
          e.vx = e.facing * spd;
        } else if (e.type === 'skeleton' && Math.abs(dx) < 30 && e.grounded) {
          e.vx = -e.facing * 1.3;
          e.vy = -3.4;
        } else {
          e.vx = e.facing * 0.4;
        }
        if (e.grounded && e.timer % 95 === 0) {
          e.vy = -3.6;
        }
        applyGroundPhysics(world.level, e);

        const fireRate = e.type === 'skelSword' ? 110 : 78;
        if (e.timer % fireRate === 45 && Math.abs(dx) < 170) {
          world.enemyShots.push({
            kind: 'bone',
            x: e.x + 4,
            y: e.y + 4,
            vx: e.facing * 2.3,
            vy: -2.7,
            grav: 0.12,
            w: 7,
            h: 7,
            life: 105
          });
        }
      } else if (e.type === 'hauntedArmor') {
        if (e.timer % 120 < 85) {
          e.vx = e.facing * 0.55;
        } else if (e.timer % 120 === 95) {
          // Telegraph lunge!
          e.vx = e.facing * 2.2;
        }
        applyGroundPhysics(world.level, e);
      } else if (e.type === 'voodooSkull') {
        if (e.vx === 0) e.vx = e.facing * 1.25;
        e.x += e.vx;
        e.y = e.baseY + Math.sin(e.timer * 0.09) * 16;
        if (Math.abs(e.x - targetX) > 190) {
          e.vx = e.facing * 1.25;
        }
      } else if (e.type === 'lemming') {
        e.vx = 0;
        applyGroundPhysics(world.level, e);
        if (e.countdown < 0 && Math.abs(dx) < 86 && Math.abs(dy) < 42) {
          e.countdown = 180; // 3-second visible 5..4..3..2..1 countdown!
        }
        if (e.countdown >= 0) {
          e.countdown--;
          if (e.countdown === 0) {
            e.dead = true;
            world.audio.sfx('explosion');
            world.particles.popup(e.x - 8, e.y - 10, 'OH NO!', hex('#ff9c38'));
            world.particles.spawnBones(e.x + 7, e.y + 8, 12);
            for (let k = 0; k < 6; k++) {
              const ang = -Math.PI * 0.15 - (Math.PI * 0.7 * k) / 5;
              world.enemyShots.push({
                kind: 'bone',
                x: e.x + 6,
                y: e.y + 6,
                vx: Math.cos(ang) * 2.8,
                vy: Math.sin(ang) * 2.8 - 1.0,
                grav: 0.12,
                w: 6,
                h: 6,
                life: 75
              });
            }
          }
        }
      } else if (e.type === 'cyberImp') {
        if (e.grounded && e.timer % 75 === 0) {
          e.vy = -3.9;
          e.vx = e.facing * 1.45;
        } else if (e.grounded) {
          e.vx *= 0.9;
        }
        applyGroundPhysics(world.level, e);
        if (e.timer % 82 === 40 && Math.abs(dx) < 185) {
          const dist = Math.max(1, Math.hypot(dx, dy));
          world.enemyShots.push({
            kind: 'fireball',
            x: e.x + 6,
            y: e.y + 6,
            vx: (dx / dist) * 2.6,
            vy: (dy / dist) * 2.6,
            grav: 0,
            w: 6,
            h: 6,
            life: 110
          });
        }
      } else if (e.type === 'arremer' || e.type === 'arremerElite') {
        updateRedArremerAI(world, e, targetX, targetY);
      }

      if (e.y > 212) {
        e.dead = true;
      }
    }
  }

  // --- INTELLIGENT RED ARREMER GARGOYLE AI (DODGE, HOVER & SWOOP-DIVE) ---
  function updateRedArremerAI(world, e, targetX, targetY) {
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    if (e.dodgeCooldown > 0) e.dodgeCooldown--;

    if (e.state === 'statue') {
      if (Math.abs(dx) < 135) {
        e.state = 'hover';
        e.timer = 0;
        world.particles.spawnRubble(e.x + 8, e.y + 8);
      }
      return;
    }

    // 1. Reactive Horizontal Shot Dodge!
    if (e.dodgeCooldown === 0 && e.state !== 'swoop') {
      for (const s of world.playerShots) {
        const approaching = (s.vx > 0 && s.x < e.x && e.x - s.x < 78) || (s.vx < 0 && s.x > e.x && s.x - e.x < 78);
        if (approaching && Math.abs(s.y - (e.y + 8)) < 20) {
          e.vy = e.y > 58 ? -3.4 : 2.8;
          e.vx = -Math.sign(s.vx) * 2.0;
          e.dodgeCooldown = e.type === 'arremerElite' ? 26 : 44;
          world.particles.spawnEmbers(e.x + 8, e.y + 8, '#ff9c38', 4);
          break;
        }
      }
    }

    if (e.state === 'hover') {
      const side = (Math.floor(e.timer / 90) & 1) ? 1 : -1;
      const goalX = targetX + side * 72;
      const goalY = Math.max(34, Math.min(108, targetY - 46 + Math.sin(e.timer * 0.08) * 12));
      e.vx += (Math.sign(goalX - e.x) * 1.9 - e.vx) * 0.09;
      e.vy += (Math.sign(goalY - e.y) * 1.6 - e.vy) * 0.09;
      e.x += e.vx;
      e.y += e.vy;

      // Spit aimed hellfire orb while hovering
      const shotPeriod = e.type === 'arremerElite' ? 68 : 92;
      if (e.timer % shotPeriod === 36 && Math.abs(dx) < 190) {
        const dist = Math.max(1, Math.hypot(dx, dy));
        world.enemyShots.push({
          kind: 'fireball',
          x: e.x + 6,
          y: e.y + 8,
          vx: (dx / dist) * 2.7,
          vy: (dy / dist) * 2.7,
          grav: 0,
          w: 6,
          h: 6,
          life: 110
        });
      }

      // Telegraph & initiate Swoop-Dive!
      const swoopPeriod = e.type === 'arremerElite' ? 115 : 145;
      if (e.timer >= swoopPeriod) {
        e.state = 'telegraph';
        e.timer = 0;
      }
    } else if (e.state === 'telegraph') {
      // Hover vibration before swooping down!
      e.x += (e.timer & 1) ? 1 : -1;
      if (e.timer >= 18) {
        e.state = 'swoop';
        e.timer = 0;
        e.swoopDir = dx >= 0 ? 1 : -1;
        e.vx = e.swoopDir * (e.type === 'arremerElite' ? 3.5 : 2.9);
        e.vy = 3.4;
      }
    } else if (e.state === 'swoop') {
      // Parabolic swoop-dive arc across Arthur's elevation and back up!
      e.vy -= 0.11;
      e.x += e.vx;
      e.y += e.vy;
      if (e.y < 34 || e.timer > 56) {
        e.y = Math.max(34, e.y);
        e.state = 'hover';
        e.timer = 0;
      }
    }
  }

  // --- MONSTER POSSESSION CONTROLLER (8.0 SECONDS = 480 FRAMES) ---
  function getPossessionArchetype(type) {
    if (type === 'arremer' || type === 'arremerElite' || type === 'voodooSkull' || type === 'cyberImp') {
      return 'FLYER';
    }
    if (type === 'zombie' || type === 'lemming') {
      return 'BURROWER';
    }
    return 'BONE_HURLER';
  }

  function updatePossessedMonster(world, p, input) {
    const m = p.possessing;
    if (!m || m.dead) {
      endPossession(world, p);
      return;
    }

    p.possessTimer--;
    if (p.possessTimer <= 0 || input.pressed.special) {
      if (m.type === 'lemming' && input.pressed.special) {
        // Tactical Blocker Detonation on manual vault-out!
        damageAllVisibleEnemies(world, 5);
        world.audio.sfx('explosion');
      }
      endPossession(world, p);
      return;
    }

    const arch = getPossessionArchetype(m.type);
    const moveDir = (input.down.right ? 1 : 0) - (input.down.left ? 1 : 0);
    if (moveDir !== 0) m.facing = moveDir;

    if (arch === 'FLYER') {
      // Full 8-way Gargoyle / Voodoo Flight over spike pits & moat water!
      const moveY = (input.down.down ? 1 : 0) - (input.down.up || input.down.jump ? 1 : 0);
      m.vx = moveDir * 2.35;
      m.vy = moveY * 2.05;
      m.x = Math.max(world.camX + 4, Math.min(world.level.widthPx - 20, m.x + m.vx));
      m.y = Math.max(26, Math.min(162, m.y + m.vy));
      m.burrowed = false;

      if (input.pressed.attack && p.attackCooldown <= 0) {
        p.attackCooldown = 11;
        world.audio.sfx('throwTorch');
        world.playerShots.push({
          kind: 'possessFire',
          sourceWeapon: 'POSSESS',
          x: m.x + (m.facing > 0 ? 12 : -4),
          y: m.y + 6,
          w: 8,
          h: 8,
          vx: m.facing * 4.5,
          vy: input.down.up ? -2.2 : input.down.down ? 1.8 : 0,
          dmg: 3.2,
          dir: m.facing,
          pierce: false,
          breaksShield: true,
          life: 62
        });
      }
    } else if (arch === 'BURROWER') {
      // Zombie: Hold Down to BURROW underground (invulnerable under slicers!) + Spit Acid!
      m.burrowed = !!input.down.down && m.grounded;
      m.vx = moveDir * (m.burrowed ? 2.2 : 1.55);
      if (!m.burrowed && input.consumeJumpBuffer() && m.grounded) {
        m.vy = -4.1;
        world.audio.sfx('jump');
      }
      applyGroundPhysics(world.level, m);
      if (m.burrowed && (world.frame & 3) === 0) {
        world.particles.spawnSplash(m.x + 7, m.y + m.h - 2, '#7a5939', 2);
      }

      if (!m.burrowed && input.pressed.attack && p.attackCooldown <= 0) {
        p.attackCooldown = 13;
        world.audio.sfx('throwTorch');
        world.playerShots.push({
          kind: 'possessAcid',
          sourceWeapon: 'POSSESS',
          x: m.x + (m.facing > 0 ? 12 : -4),
          y: m.y + 4,
          w: 8,
          h: 8,
          vx: m.facing * 3.5,
          vy: -2.8,
          grav: 0.16,
          dmg: 3.4,
          dir: m.facing,
          pierce: false,
          breaksShield: true,
          life: 75
        });
      }
    } else {
      // Skeleton / Haunted Knight: Agile High Leap + Rapid Bone Volley!
      m.burrowed = false;
      m.vx = moveDir * 2.0;
      if (input.consumeJumpBuffer() && m.grounded) {
        m.vy = -4.75;
        world.audio.sfx('jump');
      }
      applyGroundPhysics(world.level, m);

      if (input.pressed.attack && p.attackCooldown <= 0) {
        p.attackCooldown = 9;
        world.audio.sfx('throwDagger');
        for (let k = -1; k <= 1; k += 2) {
          world.playerShots.push({
            kind: 'possessBone',
            sourceWeapon: 'POSSESS',
            x: m.x + 4,
            y: m.y + 4,
            w: 8,
            h: 8,
            vx: m.facing * 4.2,
            vy: k < 0 ? -2.6 : -1.1,
            grav: 0.13,
            dmg: 2.3,
            dir: m.facing,
            pierce: false,
            breaksShield: true,
            life: 70
          });
        }
      }
    }

    m.x = Math.max(4, Math.min(world.level.widthPx - 20, m.x));
    p.x = m.x;
    p.y = m.y;
    p.facing = m.facing;
  }

  function endPossession(world, p) {
    const m = p.possessing;
    if (m) {
      world.particles.spawnBones(m.x + 8, m.y + 8, 10);
      world.particles.spawnSplash(m.x + 8, m.y + 8, '#8cf7ff', 10);
      m.dead = true;
      p.x = m.x;
      p.y = Math.min(150, m.y - 4);
    }
    p.possessing = null;
    p.possessTimer = 0;
    p.vy = -3.8;
    p.grounded = false;
    p.doubleJumpUsed = false;
    p.invuln = Math.max(p.invuln, 50);
    world.audio.sfx('possessEnd');
  }

  // --- MULTI-PART STAGE BOSSES + 3-PHASE FINAL BOSS ASTAROTH-LECHUCK-9000 ---
  function createBoss(level) {
    const arenaRight = level.widthPx - 64;
    const kind = level.bossType;
    const isFinal = kind === 'astaroth9000';
    const maxHp = isFinal ? 68 : 28 + level.idx * 5;
    return {
      kind,
      name:
        kind === 'lechuck' ? 'GHOST CAPTAIN LECHUCK' :
        kind === 'dragon' ? 'WYVERN OF DAVENTRY' :
        kind === 'jaffar' ? 'JAFFAR BONE AUTOMATON' :
        kind === 'forgemaster' ? 'LEMMING FORGEMASTER' :
        kind === 'cyberbaron' ? 'CYBER-BARON OF PHOBOS' :
        'ASTAROTH-LECHUCK-9000',
      x: arenaRight,
      y: isFinal ? 96 : 124,
      w: isFinal ? 38 : 28,
      h: isFinal ? 52 : 44,
      vx: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      phase: 1,
      timer: 0,
      mouthOpen: false,
      laserTimer: 0,
      flash: 0,
      dead: false,
      dyingTimer: 0
    };
  }

  function hurtBoss(world, boss, dmg) {
    if (boss.dead || boss.dyingTimer > 0) return;
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.flash = 5;
    world.audio.sfx('enemyHit');

    if (boss.kind === 'astaroth9000') {
      const ratio = boss.hp / boss.maxHp;
      if (ratio <= 0.32 && boss.phase < 3) {
        boss.phase = 3;
        world.lightningFlash = 1.0;
        world.shakeTimer = 22;
        world.particles.popup(boss.x - 24, boss.y - 16, '9000 OVERCLOCK!', hex('#ff4f2b'));
      } else if (ratio <= 0.66 && boss.phase < 2) {
        boss.phase = 2;
        world.lightningFlash = 0.85;
        world.particles.popup(boss.x - 24, boss.y - 16, 'VOODOO PHASE!', hex('#8cf7ff'));
      }
    }

    if (boss.hp <= 0) {
      boss.dyingTimer = 95;
      world.enemyShots.length = 0;
      world.audio.sfx('explosion');
      world.shakeTimer = 35;
    }
  }

  function updateBoss(world, boss) {
    if (!boss || boss.dead) return;
    if (boss.flash > 0) boss.flash--;

    if (boss.dyingTimer > 0) {
      boss.dyingTimer--;
      if (boss.dyingTimer % 8 === 0) {
        world.audio.sfx('explosion');
        world.particles.spawnBones(
          boss.x + Math.random() * boss.w,
          boss.y + Math.random() * boss.h,
          7
        );
        world.particles.spawnEmbers(
          boss.x + Math.random() * boss.w,
          boss.y + Math.random() * boss.h,
          '#fff29c',
          8
        );
      }
      if (boss.dyingTimer === 0) {
        boss.dead = true;
        world.score += boss.kind === 'astaroth9000' ? 20000 : 5000;
        // Spawn Stage Key OR The Cursed 3.5" Floppy Disk!
        world.pickups.push({
          kind: boss.kind === 'astaroth9000' ? 'floppy' : 'stageKey',
          x: boss.x + 8,
          y: boss.y + 8,
          vy: -2.6,
          life: 9999
        });
      }
      return;
    }

    boss.timer++;
    const p = world.player;
    const arenaLeft = world.level.bossTriggerX + 18;
    const arenaRight = world.level.widthPx - 62;

    // Emergency comeback chest if player is in Boxer Shorts for a while during boss!
    if (p.armor === 'boxers' && boss.timer % 540 === 260) {
      world.level.chests.push({
        id: 900 + boss.timer,
        x: arenaLeft + 44,
        y: 11 * TS - 9,
        kind: 'normal',
        weapon: null,
        opened: false,
        revealed: true
      });
      world.audio.sfx('chestSpawn');
      world.particles.spawnEmbers(arenaLeft + 50, 11 * TS - 6, '#fff29c', 8);
    }

    if (boss.kind === 'astaroth9000') {
      // --- FINAL BOSS: 3-PHASE ASTAROTH-LECHUCK-9000 ---
      const speedMul = boss.phase === 3 ? 1.55 : boss.phase === 2 ? 1.25 : 1.0;
      boss.y = 92 + Math.sin(boss.timer * 0.05 * speedMul) * 24;
      const targetX = boss.timer % 240 < 120 ? arenaRight : arenaLeft + 24;
      boss.x += Math.sign(targetX - boss.x) * 0.85 * speedMul;

      // Phase 2+ Voodoo Teleport Flash
      if (boss.phase >= 2 && boss.timer % 170 === 0) {
        world.particles.spawnSplash(boss.x + 18, boss.y + 24, '#8cf7ff', 12);
        boss.x = Math.abs(p.x - arenaLeft) < 110 ? arenaRight - 8 : arenaLeft + 20;
        world.lightningFlash = 0.65;
      }

      boss.mouthOpen = (boss.timer % 90) >= 48;
      if (boss.laserTimer > 0) boss.laserTimer--;

      // Belly-Demon Hellfire Streams & Voodoo Spreads
      if (boss.timer % Math.max(36, (68 / speedMul) | 0) === 54) {
        const dir = p.x < boss.x ? -1 : 1;
        for (let k = -1; k <= 1; k++) {
          world.enemyShots.push({
            kind: boss.phase === 2 ? 'acid' : 'fireball',
            x: boss.x + 16,
            y: boss.y + 28,
            vx: dir * (2.6 + Math.abs(k) * 0.3),
            vy: k * 0.95,
            grav: 0,
            w: 7,
            h: 7,
            life: 120
          });
        }
      }

      // Phase 3 Belly-Core Sweeping Laser!
      if (boss.phase === 3 && boss.timer % 150 === 110) {
        boss.laserTimer = 28;
        world.audio.sfx('magicCast');
      }

      // Summon occasional skeleton minion at arena edge (possessable in Boxers!)
      if (boss.timer % 320 === 140 && world.enemies.length < 2) {
        const sx = p.x > (arenaLeft + arenaRight) * 0.5 ? arenaLeft + 16 : arenaRight - 10;
        world.enemies.push(createEnemy({ x: sx, y: 11 * TS - 20, type: 'skeleton' }));
      }
    } else {
      // --- STAGES 1..5 MULTI-PART GUARDIANS ---
      if (boss.kind === 'dragon') {
        boss.x = (arenaLeft + arenaRight) * 0.5 + Math.cos(boss.timer * 0.035) * 78;
        boss.y = 78 + Math.sin(boss.timer * 0.06) * 28;
      } else {
        const patrolX = boss.timer % 200 < 100 ? arenaRight : arenaLeft + 30;
        boss.x += Math.sign(patrolX - boss.x) * 0.85;
        boss.y = 126 + (boss.kind === 'jaffar' ? Math.sin(boss.timer * 0.07) * 10 : 0);
      }

      boss.mouthOpen = (boss.timer % 76) > 44;
      if (boss.timer % 66 === 50) {
        const dx = p.x - boss.x;
        const dy = p.y - boss.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const count = boss.kind === 'forgemaster' || boss.kind === 'cyberbaron' ? 2 : 1;
        for (let k = 0; k < count; k++) {
          world.enemyShots.push({
            kind: boss.kind === 'lechuck' ? 'acid' : boss.kind === 'jaffar' ? 'bone' : 'fireball',
            x: boss.x + 8,
            y: boss.y + 12 + k * 12,
            vx: (dx / dist) * 2.6,
            vy: (dy / dist) * 2.4 - (boss.kind === 'jaffar' ? 1.5 : 0),
            grav: boss.kind === 'jaffar' ? 0.08 : 0,
            w: 7,
            h: 7,
            life: 120
          });
        }
      }

      // Stage 4 Forgemaster drops Exploding Lemming Blockers; others summon possessable undead!
      if (boss.timer % 310 === 180 && world.enemies.length < 2) {
        const summonType = boss.kind === 'forgemaster' ? 'lemming' : 'zombie';
        world.enemies.push(createEnemy({ x: arenaLeft + 26, y: 11 * TS - 20, type: summonType }));
      }
    }
  }

  function renderBoss(fb, boss, camX, frame) {
    if (!boss || boss.dead) return;
    if (boss.dyingTimer > 0 && (frame & 1) === 1) return;

    const S = GNG.SPRITES;
    const sx = (boss.x - camX) | 0;
    const sy = boss.y | 0;
    const tint = boss.flash > 0 ? hex('#ffffff') : 0;
    const flip = worldRefPlayerLeft(boss);

    if (boss.kind === 'astaroth9000') {
      // Levitating Cursed 3.5" Floppy Disk Shrine above Astaroth!
      const fy = 40 + ((Math.sin(frame * 0.08) * 4) | 0);
      fb.glowCircle(sx + 18, fy + 6, 16, 40, 180, 220);
      fb.blit(S.cursedFloppy, sx + 10, fy, false, false, 0);

      // Multi-part Torso (Belly Demon Mouth opens & closes!) + Horned Pirate Head + Orbiting Claws!
      const torsoSpr = boss.mouthOpen ? S.astarothTorsoOpen : S.astarothTorsoClosed;
      fb.blitScaled(torsoSpr, sx - 2, sy + 16, 2, 2, flip, tint);
      fb.blitScaled(S.astarothHead, sx + 2, sy - 4, 2, 2, flip, tint);

      const clawWave = Math.sin(frame * 0.11) * 8;
      fb.blitScaled(S.astarothClaw, sx - 16, sy + 20 + clawWave, 2, 2, false, tint);
      fb.blitScaled(S.astarothClaw, sx + 32, sy + 20 - clawWave, 2, 2, true, tint);

      if (boss.laserTimer > 0) {
        const beamY = sy + 30;
        if (flip) {
          fb.rect(0, beamY, sx + 10, 6, hex('#ff4f2b'));
          fb.rect(0, beamY + 2, sx + 10, 2, hex('#ffffff'));
        } else {
          fb.rect(sx + 28, beamY, 320 - (sx + 28), 6, hex('#ff4f2b'));
          fb.rect(sx + 28, beamY + 2, 320 - (sx + 28), 2, hex('#ffffff'));
        }
      }
    } else if (boss.kind === 'dragon') {
      // Articulated Serpentine Wyvern Neck Segments + Twin Snapping Dragon Heads!
      for (let seg = 4; seg >= 1; seg--) {
        const nx = sx + Math.sin(frame * 0.09 - seg * 0.5) * (seg * 5);
        const ny = sy + seg * 7;
        fb.circle(nx + 14, ny + 8, 7, tint || hex('#288a36'));
        fb.circle(nx + 14, ny + 6, 4, tint || hex('#57d95b'));
      }
      fb.blitScaled(S.bossDragonHead, sx - 6, sy - 4, 1.6, 1.6, flip, tint);
      fb.blitScaled(S.bossDragonHead, sx + 10, sy + 6, 1.4, 1.4, flip, tint);
    } else {
      // Multi-part Towering Bosses (LeChuck, Jaffar, Forgemaster, Cyber-Baron)
      const bodyCol =
        boss.kind === 'lechuck' ? hex('#1e5c4c') :
        boss.kind === 'jaffar' ? hex('#8f241e') :
        boss.kind === 'forgemaster' ? hex('#687180') :
        hex('#7d3228');
      fb.rect(sx + 2, sy + 16, 24, 28, tint || bodyCol);
      fb.rectOutline(sx + 2, sy + 16, 24, 28, hex('#ecc146'));
      const headSpr =
        boss.kind === 'lechuck' ? S.bossPirateHead :
        boss.kind === 'jaffar' ? S.bossSkelKing :
        S.astarothHead;
      fb.blitScaled(headSpr, sx - 2, sy - 4, 1.8, 1.8, flip, tint);
      const armY = sy + 20 + ((Math.sin(frame * 0.14) * 5) | 0);
      fb.blitScaled(S.astarothClaw, sx - 10, armY, 1.5, 1.5, false, tint);
      fb.blitScaled(S.astarothClaw, sx + 22, armY, 1.5, 1.5, true, tint);
    }
  }

  let lastKnownPlayerX = 60;
  function worldRefPlayerLeft(boss) {
    return lastKnownPlayerX < boss.x;
  }
  function syncBossTargetX(px) {
    lastKnownPlayerX = px;
  }

  GNG.WEAPON_DEFS = WEAPON_DEFS;
  GNG.WEAPON_ORDER = WEAPON_ORDER;
  GNG.aabb = aabb;
  GNG.tileAtWorld = tileAtWorld;
  GNG.isSolidFloorTile = isSolidFloorTile;
  GNG.isSolidWallTile = isSolidWallTile;
  GNG.ParticleSystem = ParticleSystem;
  GNG.firePlayerWeapon = firePlayerWeapon;
  GNG.castGoldenMagic = castGoldenMagic;
  GNG.createEnemy = createEnemy;
  GNG.hurtEnemy = hurtEnemy;
  GNG.updateEnemies = updateEnemies;
  GNG.getPossessionArchetype = getPossessionArchetype;
  GNG.updatePossessedMonster = updatePossessedMonster;
  GNG.endPossession = endPossession;
  GNG.createBoss = createBoss;
  GNG.hurtBoss = hurtBoss;
  GNG.updateBoss = updateBoss;
  GNG.renderBoss = renderBoss;
  GNG.syncBossTargetX = syncBossTargetX;
})();
