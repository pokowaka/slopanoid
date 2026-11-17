/* ============================================================================
 * js/game.js
 * Main 60 FPS Fixed-Timestep Engine, Sir Arthur State Machine, Tactical Armor
 * Eject & Anvil Physics, 8s Monster Possession, Parchment World Map Intro,
 * HUD, Cabinet Controls & Victory Sequence
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});
  const TILE = GNG.TILE;
  const TS = GNG.TILE_SIZE;
  const hex = GNG.hexToCol;
  const pack = GNG.packRGB;

  class GhostsNGoblinsGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.fb = new GNG.Framebuffer(this.canvas);
      this.audio = new GNG.ArcadeAudio();
      this.input = new GNG.InputManager(this.canvas, () => {
        this.audio.unlock();
        if (this.state === 'TITLE' && !this.audio.currentTheme) {
          this.audio.setTheme('title');
        }
      });

      this.crtEnabled = true;
      this.state = 'TITLE'; // 'TITLE' | 'MAP' | 'PLAY' | 'PAUSED' | 'GAMEOVER' | 'VICTORY'
      this.frame = 0;
      this.stateTimer = 0;
      this.stageIdx = 0;
      this.prevStageIdx = 0;
      this.loop = 1;

      this.score = 0;
      this.highScore = 25000;
      this.lives = 3;
      this.checkpointReached = false;

      this.level = GNG.buildStage(0);
      this.camX = 0;
      this.bossLocked = false;
      this.boss = null;

      this.particles = new GNG.ParticleSystem();
      this.enemies = [];
      this.playerShots = [];
      this.enemyShots = [];
      this.pickups = [];
      this.magicEffects = [];
      this.anvil = null;
      this.soulBeam = null;

      this.lightningFlash = 0;
      this.shakeTimer = 0;
      this.fpsDisplay = 60;
      this._fpsFrames = 0;
      this._fpsLastTime = performance.now();

      this.player = this._createPlayer(36, 11 * TS - 22, 'steel', 'LANCE');

      this._bindCabinetUI();
      this._syncCabinetUI();
    }

    _createPlayer(x, y, armor, weapon) {
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        w: 12,
        h: 21,
        facing: 1,
        armor: armor || 'steel', // 'steel' | 'boxers' | 'gold'
        weapon: weapon || 'LANCE',
        grounded: false,
        onLadder: false,
        crouching: false,
        aimUp: false,
        coyote: 0,
        doubleJumpUsed: false,
        attackCooldown: 0,
        throwAnim: 0,
        shatterAnim: 0,
        invuln: 0,
        dead: false,
        deathTimer: 0,
        possessing: null,
        possessTimer: 0,
        magicCooldown: 0,
        magicCastTimer: 0,
        runClock: 0
      };
    }

    _bindCabinetUI() {
      for (let i = 0; i < 6; i++) {
        const btn = document.getElementById('btn-warp-' + (i + 1));
        if (btn) {
          btn.addEventListener('click', () => {
            this.audio.unlock();
            this.warpToStage(i, false);
            this.canvas.focus();
          });
        }
      }

      const btnMap = document.getElementById('btn-map');
      if (btnMap) {
        btnMap.addEventListener('click', () => {
          this.audio.unlock();
          this.openMapIntro(this.stageIdx);
        });
      }

      const btnCrt = document.getElementById('btn-crt');
      if (btnCrt) {
        btnCrt.addEventListener('click', () => {
          this.toggleCRT();
        });
      }

      const btnAudio = document.getElementById('btn-audio');
      if (btnAudio) {
        btnAudio.addEventListener('click', () => {
          const on = this.audio.toggle();
          btnAudio.setAttribute('aria-pressed', on ? 'true' : 'false');
          btnAudio.textContent = on ? 'FM: ON' : 'FM: OFF';
        });
      }
    }

    toggleCRT() {
      this.crtEnabled = !this.crtEnabled;
      const bezel = document.getElementById('crt-bezel');
      const btn = document.getElementById('btn-crt');
      if (bezel) {
        bezel.classList.toggle('bezel-off', !this.crtEnabled);
      }
      if (btn) {
        btn.setAttribute('aria-pressed', this.crtEnabled ? 'true' : 'false');
        btn.textContent = this.crtEnabled ? 'CRT: ON' : 'CRT: OFF';
      }
    }

    _syncCabinetUI() {
      for (let i = 0; i < 6; i++) {
        const btn = document.getElementById('btn-warp-' + (i + 1));
        if (btn) {
          btn.classList.toggle('active', i === this.stageIdx);
        }
      }
      const statusEl = document.getElementById('cabinet-status');
      if (!statusEl) return;
      if (this.state === 'TITLE') {
        statusEl.textContent = this.fpsDisplay + ' FPS LOCKED · PRESS SPACE OR CLICK TO START';
      } else if (this.state === 'MAP') {
        statusEl.textContent = 'CURSED MUSEUM MAP · ' + GNG.STAGE_META[this.stageIdx].title;
      } else if (this.state === 'PLAY') {
        const p = this.player;
        const modeLabel = p.possessing
          ? 'POSSESSING ' + p.possessing.type.toUpperCase()
          : p.armor === 'gold'
          ? 'GOLDEN ARMOR'
          : p.armor === 'boxers'
          ? 'BOXER SHORTS (SPECTRAL VISION)'
          : 'STEEL ARMOR';
        statusEl.textContent =
          this.fpsDisplay + ' FPS · STG ' + (this.stageIdx + 1) + ' · ' + modeLabel + ' · ' + p.weapon;
      } else if (this.state === 'VICTORY') {
        statusEl.textContent = 'CURSED FLOPPY RECLAIMED! · MUSEUM SAVED';
      }
    }

    openMapIntro(targetStage) {
      this.prevStageIdx = this.stageIdx;
      this.stageIdx = Math.max(0, Math.min(5, targetStage));
      this.checkpointReached = false;
      this.state = 'MAP';
      this.stateTimer = 175;
      this.audio.setBoxerPanic(false);
      this.audio.playMapJingle();
      this._syncCabinetUI();
    }

    warpToStage(targetStage, showMap) {
      this.prevStageIdx = this.stageIdx;
      this.stageIdx = Math.max(0, Math.min(5, targetStage));
      this.checkpointReached = false;
      if (showMap) {
        this.openMapIntro(this.stageIdx);
      } else {
        this.startStage(this.stageIdx, false);
      }
    }

    startStage(stageIdx, fromCheckpoint) {
      this.stageIdx = stageIdx;
      this.level = GNG.buildStage(stageIdx);
      const keepWeapon = this.player ? this.player.weapon : 'LANCE';
      const keepArmor =
        fromCheckpoint || !this.player || this.player.armor === 'boxers'
          ? 'steel'
          : this.player.armor;

      const startX = fromCheckpoint ? this.level.checkpointX : 34;
      this.player = this._createPlayer(startX, 11 * TS - 22, keepArmor, keepWeapon);
      this.camX = Math.max(0, Math.min(this.level.widthPx - 320, startX - 90));
      this.bossLocked = false;
      this.boss = null;

      this.particles.clear();
      this.enemies.length = 0;
      this.playerShots.length = 0;
      this.enemyShots.length = 0;
      this.pickups.length = 0;
      this.magicEffects.length = 0;
      this.anvil = null;
      this.soulBeam = null;
      this.lightningFlash = 0.45;
      this.shakeTimer = 0;

      // Mark spawns far behind checkpoint as already cleared
      if (fromCheckpoint) {
        for (const sp of this.level.spawns) {
          if (sp.x < startX - 40) sp.spawned = true;
        }
      }

      this.state = 'PLAY';
      this.audio.setBoxerPanic(this.player.armor === 'boxers');
      this.audio.setTheme(this.level.meta.music);
      this._syncCabinetUI();
    }

    // --- FIXED 60 HZ SIMULATION TICK ---
    tick() {
      this.frame++;

      // Global cabinet hotkeys
      if (this.input.pressed.crt) this.toggleCRT();
      if (this.input.pressed.mute) {
        const on = this.audio.toggle();
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
          btnAudio.setAttribute('aria-pressed', on ? 'true' : 'false');
          btnAudio.textContent = on ? 'FM: ON' : 'FM: OFF';
        }
      }
      for (let i = 0; i < 6; i++) {
        if (this.input.pressed['warp' + (i + 1)]) {
          this.warpToStage(i, false);
          this.input.endFrame();
          return;
        }
      }

      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - 0.035);
      } else if (this.frame % 380 === 210) {
        this.lightningFlash = 0.72;
      }

      if (this.shakeTimer > 0) {
        this.shakeTimer--;
        this.fb.shakeX = ((Math.random() - 0.5) * 4) | 0;
        this.fb.shakeY = ((Math.random() - 0.5) * 3) | 0;
      } else {
        this.fb.shakeX = 0;
        this.fb.shakeY = 0;
      }

      if (this.state === 'TITLE') {
        if (
          this.input.pressed.jump ||
          this.input.pressed.attack ||
          this.input.pressed.confirm ||
          this.input.mouseClicked
        ) {
          this.score = 0;
          this.lives = 3;
          this.openMapIntro(0);
        }
      } else if (this.state === 'MAP') {
        this.stateTimer--;
        if (
          this.stateTimer <= 0 ||
          (this.stateTimer < 145 &&
            (this.input.pressed.jump ||
              this.input.pressed.attack ||
              this.input.pressed.confirm ||
              this.input.mouseClicked))
        ) {
          this.startStage(this.stageIdx, false);
        }
      } else if (this.state === 'PAUSED') {
        if (this.input.pressed.pause || this.input.pressed.jump) {
          this.state = 'PLAY';
        }
      } else if (this.state === 'GAMEOVER') {
        this.stateTimer--;
        if (
          this.input.pressed.jump ||
          this.input.pressed.attack ||
          this.input.pressed.confirm ||
          this.input.mouseClicked
        ) {
          this.lives = 3;
          this.score = Math.floor(this.score * 0.5);
          this.startStage(this.stageIdx, this.checkpointReached);
        } else if (this.stateTimer <= 0) {
          this.state = 'TITLE';
          this.audio.setTheme('title');
        }
      } else if (this.state === 'VICTORY') {
        this.stateTimer++;
        if (this.stateTimer % 28 === 0) {
          this.particles.spawnEmbers(40 + Math.random() * 240, 50 + Math.random() * 60, '#fff29c', 10);
          this.particles.spawnSplash(40 + Math.random() * 240, 50 + Math.random() * 60, '#8cf7ff', 8);
        }
        this.particles.update(this.level);
        if (
          this.stateTimer > 60 &&
          (this.input.pressed.jump || this.input.pressed.confirm || this.input.mouseClicked)
        ) {
          this.loop++;
          this.openMapIntro(0);
        }
      } else if (this.state === 'PLAY') {
        if (this.input.pressed.pause) {
          this.state = 'PAUSED';
        } else if (this.input.pressed.map) {
          this.openMapIntro(this.stageIdx);
        } else if (this.input.pressed.retry) {
          this.startStage(this.stageIdx, this.checkpointReached);
        } else {
          this._updatePlay();
        }
      }

      if (this.score > this.highScore) {
        this.highScore = this.score;
      }
      if ((this.frame & 15) === 0) {
        this._syncCabinetUI();
      }
      this.input.endFrame();
    }

    _updatePlay() {
      const p = this.player;
      GNG.syncBossTargetX(p.x);

      // Sync dynamic Boxer-Shorts FM panic music!
      this.audio.setBoxerPanic(!p.dead && p.armor === 'boxers');

      // Reveal Spectral Chests when Arthur has Spectral Vision (Boxer Shorts / Possessing)!
      const spectralVision = p.armor === 'boxers' || !!p.possessing;
      if (spectralVision) {
        for (const ch of this.level.chests) {
          if (!ch.revealed) {
            ch.revealed = true;
            this.particles.spawnEmbers(ch.x + 7, ch.y + 4, '#8cf7ff', 6);
          }
        }
      }

      // Checkpoint check
      if (!this.checkpointReached && p.x >= this.level.checkpointX) {
        this.checkpointReached = true;
        this.audio.sfx('chestSpawn');
        this.particles.popup(p.x - 12, p.y - 12, 'CHECKPOINT!', hex('#57d95b'));
      }

      // Boss Arena Lock & Spawn
      if (!this.bossLocked && p.x >= this.level.bossTriggerX) {
        this.bossLocked = true;
        this.boss = GNG.createBoss(this.level);
        this.audio.setTheme('boss');
        this.lightningFlash = 0.85;
        this.particles.popup(this.boss.x - 30, this.boss.y - 14, this.boss.name, hex('#eb4034'));
      }

      // Activate enemy waves entering screen horizon
      for (const sp of this.level.spawns) {
        if (!sp.spawned && sp.x <= this.camX + 332 && sp.x >= this.camX - 32) {
          sp.spawned = true;
          this.enemies.push(GNG.createEnemy(sp));
        }
      }

      this._updatePlayer();
      this._updateAnvil();
      this._updateContraptionsAndBridges();
      this._updateProjectiles();
      GNG.updateEnemies(this);
      GNG.updateBoss(this, this.boss);
      this._updatePickups();
      this._updateMagicVisuals();
      this.particles.update(this.level);

      // Smooth horizontal camera tracking (locks cleanly onto 320px boss arena)
      const maxCam = this.level.widthPx - 320;
      const minCam = this.bossLocked ? Math.min(maxCam, this.level.bossTriggerX) : 0;
      const desiredCam = this.bossLocked
        ? maxCam
        : Math.max(minCam, Math.min(maxCam, p.x - 116));
      this.camX += (desiredCam - this.camX) * 0.18;
      if (Math.abs(desiredCam - this.camX) < 0.5) this.camX = desiredCam;
      this.camX = Math.max(0, Math.min(maxCam, this.camX));

      if (this.soulBeam) {
        if (--this.soulBeam.life <= 0) this.soulBeam = null;
      }
    }

    _updatePlayer() {
      const p = this.player;
      const inp = this.input;

      if (p.dead) {
        if (--p.deathTimer <= 0) {
          this.lives--;
          if (this.lives <= 0) {
            this.state = 'GAMEOVER';
            this.stateTimer = 600;
          } else {
            this.startStage(this.stageIdx, this.checkpointReached);
          }
        }
        return;
      }

      if (p.invuln > 0) p.invuln--;
      if (p.attackCooldown > 0) p.attackCooldown--;
      if (p.throwAnim > 0) p.throwAnim--;
      if (p.shatterAnim > 0) p.shatterAnim--;
      if (p.magicCooldown > 0) p.magicCooldown--;

      // Golden Magic Spell-Charge Stance
      if (p.magicCastTimer > 0) {
        p.magicCastTimer--;
        if ((p.magicCastTimer & 3) === 0) {
          this.particles.spawnEmbers(p.x + 6, p.y + 10, '#fff29c', 4);
        }
        if (p.magicCastTimer === 0) {
          GNG.castGoldenMagic(this, p);
          p.magicCooldown = 165;
        }
        return;
      }

      // Monster Possession Active!
      if (p.possessing) {
        GNG.updatePossessedMonster(this, p, inp);
        return;
      }

      // Tactical Special Button ([E] / [C] / Right-Click):
      // - Steel Armor -> EJECT ARMOR ANVIL!
      // - Boxer Shorts -> POSSESS NEAREST MONSTER FOR 8 SECONDS!
      // - Golden Armor -> CAST GOLDEN MAGIC (or Down+Special to Eject!)
      if (inp.pressed.special) {
        if (p.armor === 'steel' || (p.armor === 'gold' && inp.down.down)) {
          this._ejectArmorAnvil();
          return;
        } else if (p.armor === 'boxers') {
          this._tryPossessMonster();
          return;
        } else if (p.armor === 'gold') {
          if (p.magicCooldown <= 0) {
            p.magicCastTimer = 15;
            p.invuln = Math.max(p.invuln, 25);
            this.audio.sfx('magicCharge');
            this.particles.spawnEmbers(p.x + 6, p.y + 8, '#fff29c', 8);
            return;
          } else {
            this.particles.popup(p.x - 8, p.y - 8, 'CHARGING', hex('#ecc146'));
          }
        }
      }

      // Ladder detection & climbing
      const centerX = p.x + p.w * 0.5;
      const ladderMid = GNG.tileAtWorld(this.level, centerX, p.y + 12) === TILE.LADDER;
      const ladderBelow = GNG.tileAtWorld(this.level, centerX, p.y + p.h + 2) === TILE.LADDER;

      if (!p.onLadder && (inp.down.up && ladderMid)) {
        p.onLadder = true;
        p.vx = 0;
        p.vy = 0;
        p.x = Math.floor(centerX / TS) * TS + 2;
      } else if (!p.onLadder && inp.down.down && p.grounded && ladderBelow && !ladderMid) {
        p.onLadder = true;
        p.y += 6;
        p.vx = 0;
        p.vy = 0;
        p.x = Math.floor(centerX / TS) * TS + 2;
      }

      if (p.onLadder) {
        p.crouching = false;
        p.aimUp = false;
        p.doubleJumpUsed = false;
        let climbV = 0;
        if (inp.down.up) climbV = -1.25;
        else if (inp.down.down) climbV = 1.25;
        p.y += climbV;
        if (climbV !== 0) p.runClock += 0.2;

        if (inp.consumeJumpBuffer()) {
          p.onLadder = false;
          p.vy = -3.8;
          this.audio.sfx('jump');
        } else {
          const stillOnLadder =
            GNG.tileAtWorld(this.level, centerX, p.y + 8) === TILE.LADDER ||
            GNG.tileAtWorld(this.level, centerX, p.y + p.h - 1) === TILE.LADDER;
          if (!stillOnLadder) {
            p.onLadder = false;
          }
        }
      } else {
        // Horizontal Movement (+35% speed in Strawberry Boxer Shorts!)
        const baseSpeed = p.armor === 'boxers' ? 1.96 : 1.45;
        const moveDir = (inp.down.right ? 1 : 0) - (inp.down.left ? 1 : 0);
        if (moveDir !== 0) p.facing = moveDir;

        p.crouching = p.grounded && inp.down.down && moveDir === 0;
        p.aimUp = inp.down.up && !p.crouching;

        if (p.crouching) {
          p.vx = 0;
        } else {
          p.vx = moveDir * baseSpeed;
        }

        // Environmental Wind Gusts (Steel & Golden Armor are heavy & immune!)
        const meta = this.level.meta;
        if (
          p.armor === 'boxers' &&
          meta.windX !== 0 &&
          p.x >= meta.windRange[0] &&
          p.x <= meta.windRange[1]
        ) {
          p.vx += meta.windX;
        }

        if (moveDir !== 0 && p.grounded) {
          p.runClock += p.armor === 'boxers' ? 0.28 : 0.2;
        }

        // Drop through one-way platforms (Down + Jump)
        if (p.grounded && inp.down.down && inp.pressed.jump) {
          const footT = GNG.tileAtWorld(this.level, centerX, p.y + p.h + 1);
          if (footT === TILE.PLATFORM || footT === TILE.GHOST_PLAT) {
            p.y += 5;
            p.grounded = false;
            p.coyote = 0;
            inp.jumpBuffer = 0;
          }
        }

        // Jump & Boxer-Shorts Double-Jump!
        if (p.grounded) {
          p.coyote = 5;
          p.doubleJumpUsed = false;
        } else if (p.coyote > 0) {
          p.coyote--;
        }

        if (inp.consumeJumpBuffer()) {
          if (p.coyote > 0) {
            p.vy = p.armor === 'boxers' ? -4.55 : -4.35;
            p.grounded = false;
            p.coyote = 0;
            this.audio.sfx('jump');
          } else if (p.armor === 'boxers' && !p.doubleJumpUsed) {
            p.vy = -4.25;
            p.doubleJumpUsed = true;
            this.audio.sfx('doubleJump');
            this.particles.spawnEmbers(p.x + 6, p.y + p.h, '#8cf7ff', 6);
          }
        }

        // Apply Horizontal Velocity & Solid Wall Collisions
        const minX = this.bossLocked ? this.level.bossTriggerX : 2;
        const maxX = this.level.widthPx - p.w - 4;
        p.x = Math.max(minX, Math.min(maxX, p.x + p.vx));

        if (p.vx !== 0) {
          const probeX = p.vx > 0 ? p.x + p.w : p.x;
          if (
            GNG.isSolidWallTile(GNG.tileAtWorld(this.level, probeX, p.y + 4)) ||
            GNG.isSolidWallTile(GNG.tileAtWorld(this.level, probeX, p.y + p.h - 3))
          ) {
            p.x = p.vx > 0 ? Math.floor(probeX / TS) * TS - p.w : (Math.floor(probeX / TS) + 1) * TS;
          }
        }

        // Apply Gravity & Ceiling/Floor Collisions
        const prevBottom = p.y + p.h;
        const fallSpeedBefore = p.vy;
        p.vy = Math.min(5.8, p.vy + 0.22);
        p.y += p.vy;
        p.grounded = false;

        if (p.vy < 0) {
          if (
            GNG.isSolidWallTile(GNG.tileAtWorld(this.level, p.x + 2, p.y)) ||
            GNG.isSolidWallTile(GNG.tileAtWorld(this.level, p.x + p.w - 2, p.y))
          ) {
            p.y = (Math.floor(p.y / TS) + 1) * TS;
            p.vy = 0;
          }
        } else {
          const footY = p.y + p.h;
          const tL = GNG.tileAtWorld(this.level, p.x + 2, footY);
          const tR = GNG.tileAtWorld(this.level, p.x + p.w - 2, footY);
          const tileTop = Math.floor(footY / TS) * TS;

          if ((GNG.isSolidFloorTile(tL) || GNG.isSolidFloorTile(tR)) && prevBottom <= tileTop + 7) {
            // Check Heavy Steel/Golden Armor Smash on Cracked Floors!
            const r = Math.floor(footY / TS);
            if ((p.armor === 'steel' || p.armor === 'gold') && fallSpeedBefore >= 2.2) {
              let smashed = false;
              for (const probe of [p.x + 2, p.x + p.w - 2]) {
                const c = Math.floor(probe / TS);
                if (this.level.grid[r * this.level.cols + c] === TILE.CRACKED) {
                  this.level.grid[r * this.level.cols + c] = TILE.EMPTY;
                  this.particles.spawnRubble(c * TS + 8, r * TS + 4);
                  smashed = true;
                }
              }
              if (smashed) {
                this.audio.sfx('anvilSlam');
                this.shakeTimer = 8;
                this.particles.popup(p.x - 6, p.y - 8, 'SMASH!', hex('#fff29c'));
              }
            }

            // Re-verify floor in case Cracked Floor just shattered beneath our boots!
            const nL = GNG.tileAtWorld(this.level, p.x + 2, footY);
            const nR = GNG.tileAtWorld(this.level, p.x + p.w - 2, footY);
            if (GNG.isSolidFloorTile(nL) || GNG.isSolidFloorTile(nR)) {
              p.y = tileTop - p.h;
              p.vy = 0;
              p.grounded = true;

              // Conveyor Belt Push (Steel/Gold heavy boots resist 45% of belt push!)
              const beltMul = p.armor === 'boxers' ? 0.9 : 0.5;
              if (nL === TILE.CONV_LEFT || nR === TILE.CONV_LEFT) p.x -= beltMul;
              if (nL === TILE.CONV_RIGHT || nR === TILE.CONV_RIGHT) p.x += beltMul;

              // Trigger Collapsing Drawbridge Shudder!
              for (const probe of [p.x + 2, p.x + p.w - 2]) {
                const c = Math.floor(probe / TS);
                if (this.level.grid[r * this.level.cols + c] === TILE.DRAWBRIDGE) {
                  const st = this.level.drawbridges.get(r * this.level.cols + c);
                  if (st && st.state === 'idle') {
                    st.state = 'shaking';
                    st.timer = 34;
                  }
                }
              }
            }
          }
        }
      }

      // Attack Button (J / X / Left-Click)
      if ((inp.pressed.attack || inp.down.attack) && p.attackCooldown <= 0) {
        const def = GNG.WEAPON_DEFS[p.weapon];
        if (GNG.firePlayerWeapon(this, p)) {
          p.attackCooldown = def.cooldown;
          p.throwAnim = 10;
        }
      }

      // Lethal Hazard Pit Check (Moat Water, Pit Spikes, Molten Iron, Nukage Slime)
      const hazardTouch =
        GNG.tileAtWorld(this.level, p.x + 6, p.y + p.h - 2) === TILE.HAZARD || p.y > 196;
      if (hazardTouch) {
        if (this.level.idx === 4 && p.armor !== 'boxers' && p.y <= 194) {
          // Toxic Nukage Slime shatters armor & bounces knight upward once!
          p.vy = -4.3;
          this._damagePlayer();
        } else {
          this._killPlayerImmediate();
        }
        return;
      }

      // Enemy Contact Check
      const hitY = p.crouching ? p.y + 7 : p.y + 2;
      const hitH = p.crouching ? p.h - 7 : p.h - 2;
      for (const e of this.enemies) {
        if (e.dead || e.possessed) continue;
        if (e.type === 'zombie' && e.state === 'rising' && e.riseTimer > 12) continue;
        if (GNG.aabb(p.x + 2, hitY, p.w - 4, hitH, e.x + 2, e.y + 2, e.w - 4, e.h - 4)) {
          this._damagePlayer();
          break;
        }
      }

      // Boss Contact & Phase-3 Laser Beam Check
      if (this.boss && !this.boss.dead && this.boss.dyingTimer === 0) {
        const b = this.boss;
        if (GNG.aabb(p.x + 2, hitY, p.w - 4, hitH, b.x + 2, b.y + 2, b.w - 4, b.h - 4)) {
          this._damagePlayer();
        } else if (b.laserTimer > 0) {
          const beamY = b.y + 30;
          const onBeamSide = p.x < b.x ? true : false;
          if (onBeamSide && GNG.aabb(p.x, hitY, p.w, hitH, 0, beamY, b.x - this.camX + this.camX, 6)) {
            this._damagePlayer();
          }
        }
      }
    }

    _ejectArmorAnvil() {
      const p = this.player;
      const wasGold = p.armor === 'gold';
      p.armor = 'boxers';
      p.vy = -3.1;
      p.grounded = false;
      p.doubleJumpUsed = false;
      p.invuln = Math.max(p.invuln, 32);

      this.anvil = {
        x: p.x - 1,
        y: p.y + 4,
        vx: p.vx * 0.4,
        vy: 1.8,
        w: 14,
        h: 12,
        grounded: false,
        squash: 0,
        isGold: wasGold
      };

      this.audio.sfx('armorEject');
      this.particles.spawnEmbers(p.x + 6, p.y + 10, '#8cf7ff', 8);
      this.particles.popup(p.x - 12, p.y - 10, 'ARMOR EJECT!', hex('#8cf7ff'));
    }

    _updateAnvil() {
      const a = this.anvil;
      if (!a) return;
      if (a.squash > 0) a.squash--;

      if (!a.grounded) {
        a.x += a.vx;
        a.vy = Math.min(6.4, a.vy + 0.35);
        a.y += a.vy;

        // Crush any enemies underneath!
        for (const e of this.enemies) {
          if (e.dead || e.possessed) continue;
          if (GNG.aabb(a.x - 2, a.y, a.w + 4, a.h + 2, e.x, e.y, e.w, e.h)) {
            GNG.hurtEnemy(this, e, 16, true, 0);
            this.score += 300;
            this.particles.popup(a.x - 10, a.y - 8, 'ANVIL CRUSH! +500', hex('#fff29c'));
          }
        }
        if (this.boss && !this.boss.dead && GNG.aabb(a.x, a.y, a.w, a.h, this.boss.x, this.boss.y, this.boss.w, this.boss.h)) {
          GNG.hurtBoss(this, this.boss, 6);
          a.vy = -2.5;
          a.vx = -1.8;
        }

        // Land on tiles & Smash Cracked Floors!
        const footY = a.y + a.h;
        const r = Math.floor(footY / TS);
        let smashed = false;
        for (const probe of [a.x + 2, a.x + a.w - 2]) {
          const c = Math.floor(probe / TS);
          if (r >= 0 && r < this.level.rows && c >= 0 && c < this.level.cols) {
            if (this.level.grid[r * this.level.cols + c] === TILE.CRACKED) {
              this.level.grid[r * this.level.cols + c] = TILE.EMPTY;
              this.particles.spawnRubble(c * TS + 8, r * TS + 4);
              smashed = true;
            }
          }
        }
        if (smashed) {
          this.audio.sfx('anvilSlam');
          this.shakeTimer = 10;
        }

        const tL = GNG.tileAtWorld(this.level, a.x + 2, footY);
        const tR = GNG.tileAtWorld(this.level, a.x + a.w - 2, footY);
        if (GNG.isSolidFloorTile(tL) || GNG.isSolidFloorTile(tR)) {
          a.y = Math.floor(footY / TS) * TS - a.h;
          a.vy = 0;
          a.vx = 0;
          a.grounded = true;
          a.squash = 8;
          this.audio.sfx('anvilSlam');
          this.shakeTimer = Math.max(this.shakeTimer, 7);
          this.particles.spawnRubble(a.x + 7, a.y + a.h);
        } else if (a.y > 205) {
          this.anvil = null;
          return;
        }
      } else {
        // Check if floor vanished under anvil (e.g. drawbridge)
        const under = GNG.tileAtWorld(this.level, a.x + 7, a.y + a.h + 1);
        if (!GNG.isSolidFloorTile(under)) {
          a.grounded = false;
        } else if (under === TILE.CONV_LEFT) {
          a.x -= 0.45;
        } else if (under === TILE.CONV_RIGHT) {
          a.x += 0.45;
        }
      }

      // Springboard Bounce when Arthur lands on top of his Ejected Armor Anvil!
      const p = this.player;
      if (!p.dead && !p.possessing && p.vy > 0) {
        if (
          p.x + p.w > a.x - 2 &&
          p.x < a.x + a.w + 2 &&
          p.y + p.h >= a.y - 2 &&
          p.y + p.h <= a.y + 10
        ) {
          p.y = a.y - p.h;
          p.vy = -5.65;
          p.grounded = false;
          p.doubleJumpUsed = false;
          a.squash = 12;
          this.audio.sfx('springBounce');
          this.particles.spawnEmbers(a.x + 7, a.y + 2, '#fff29c', 7);
          this.particles.popup(a.x - 10, a.y - 10, 'SPRING!', hex('#8cf7ff'));
        }
      }
    }

    _tryPossessMonster() {
      const p = this.player;
      let best = null;
      let bestDist = 195;
      for (const e of this.enemies) {
        if (e.dead || e.possessed) continue;
        if (e.x + e.w < this.camX || e.x > this.camX + 320) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }

      if (!best) {
        this.particles.spawnEmbers(p.x + 6, p.y + 8, '#8cf7ff', 4);
        this.particles.popup(p.x - 14, p.y - 8, 'NO MONSTER!', hex('#8cf7ff'));
        return;
      }

      // Leap Arthur's Exposed Soul into the target monster for 8.0 seconds (480 frames)!
      if (best.type === 'arremer' && best.state === 'statue') {
        best.state = 'hover';
      }
      if (best.type === 'zombie' && best.state === 'rising') {
        best.state = 'walk';
      }
      best.possessed = true;
      p.possessing = best;
      p.possessTimer = 480; // 8 seconds @ 60 FPS!
      this.soulBeam = { x0: p.x + 6, y0: p.y + 8, x1: best.x + 7, y1: best.y + 8, life: 16 };
      this.audio.sfx('possess');
      this.lightningFlash = 0.55;
      const arch = GNG.getPossessionArchetype(best.type);
      const hint = arch === 'FLYER' ? 'POSSESSED! FLY!' : arch === 'BURROWER' ? 'POSSESSED! S:BURROW' : 'POSSESSED! BONES!';
      this.particles.popup(best.x - 20, best.y - 12, hint, hex('#8cf7ff'));
    }

    _updateContraptionsAndBridges() {
      const p = this.player;
      const a = this.anvil;

      // Update Collapsing Drawbridges
      for (const [, st] of this.level.drawbridges) {
        if (st.state === 'shaking') {
          if (--st.timer <= 0) {
            st.state = 'gone';
            st.timer = 190;
            this.audio.sfx('enemyHit');
          }
        } else if (st.state === 'gone') {
          if (--st.timer <= 0) {
            st.state = 'idle';
          }
        }
      }

      // Update Pressure Plates, Jaffar Slicers & Lemmings Piston Crushers
      for (const con of this.level.contraptions) {
        if (con.kind === 'plate') {
          const heldByPlayer =
            !p.dead && GNG.aabb(p.x, p.y + p.h - 4, p.w, 6, con.x - 2, con.y - 3, con.w + 4, 8);
          const heldByAnvil =
            !!a && GNG.aabb(a.x, a.y + a.h - 4, a.w, 6, con.x - 2, con.y - 3, con.w + 4, 8);
          const nowPressed = heldByPlayer || heldByAnvil;

          if (nowPressed && !con.pressed) {
            this.audio.sfx('shieldClink');
          }
          con.pressed = nowPressed;

          if (con.gateCol !== undefined && con.gateRows) {
            for (const gr of con.gateRows) {
              this.level.grid[gr * this.level.cols + con.gateCol] = con.pressed ? TILE.EMPTY : TILE.GATE;
            }
          }
          if (con.pressed && !con.triggeredOnce && con.spawnPotion) {
            con.triggeredOnce = true;
            this.pickups.push({
              kind: 'potion',
              x: con.x + 2,
              y: con.y - 14,
              vy: -2.4,
              life: 900
            });
            this.audio.sfx('chestSpawn');
            this.particles.popup(con.x - 8, con.y - 16, 'POTION!', hex('#eb4034'));
          }
        } else if (con.kind === 'slicer') {
          const cyc = (this.frame + con.phase) % con.period;
          if (cyc < 14) {
            con.closedRatio = cyc / 14;
            if (cyc === 12 && Math.abs(con.x - p.x) < 160) this.audio.sfx('slicerSnap');
          } else if (cyc < 34) {
            con.closedRatio = 1;
          } else if (cyc < 54) {
            con.closedRatio = 1 - (cyc - 34) / 20;
          } else {
            con.closedRatio = 0;
          }

          // Slicer Hazard Check (Burrowed Possessed Zombies scuttle safely underneath!)
          if (con.closedRatio > 0.65 && !p.dead) {
            const burrowedSafe = p.possessing && p.possessing.burrowed;
            if (!burrowedSafe && GNG.aabb(p.x + 3, p.y + 3, p.w - 6, p.h - 4, con.x + 2, con.y, con.w - 4, con.h)) {
              if (p.possessing) GNG.endPossession(this, p);
              else this._damagePlayer();
            }
          }
        } else if (con.kind === 'crusher') {
          const cyc = (this.frame + con.phase) % con.period;
          if (cyc < 20) {
            const t = cyc / 20;
            con.y = con.yTop + (con.yBot - con.yTop) * (t * t);
            if (cyc === 19 && Math.abs(con.x - p.x) < 170) {
              this.audio.sfx('anvilSlam');
              this.shakeTimer = Math.max(this.shakeTimer, 5);
              this.particles.spawnEmbers(con.x + 12, con.y + con.h, '#ff9c38', 5);
            }
          } else if (cyc < 42) {
            con.y = con.yBot;
          } else {
            const t = (cyc - 42) / (con.period - 42);
            con.y = con.yBot - (con.yBot - con.yTop) * t;
          }

          if (!p.dead && GNG.aabb(p.x + 2, p.y + 2, p.w - 4, p.h - 2, con.x + 2, con.y, con.w - 4, con.h)) {
            if (p.possessing) GNG.endPossession(this, p);
            else this._damagePlayer();
          }
        }
      }
    }

    _updateProjectiles() {
      const p = this.player;

      // 1. Player & Possessed Monster Projectiles
      for (let i = this.playerShots.length - 1; i >= 0; i--) {
        const s = this.playerShots[i];
        s.life--;
        if (s.life <= 0) {
          this.playerShots.splice(i, 1);
          continue;
        }

        if (s.kind === 'cross') {
          if (!s.returning) {
            s.returnTimer--;
            if (s.returnTimer <= 0) s.returning = true;
          } else {
            const dx = p.x + 6 - s.x;
            const dy = p.y + 8 - s.y;
            const d = Math.max(1, Math.hypot(dx, dy));
            s.vx = (dx / d) * 4.4;
            s.vy = (dy / d) * 4.4;
            if (d < 10) {
              this.playerShots.splice(i, 1);
              continue;
            }
          }
        }

        if (s.grav) s.vy += s.grav;
        s.x += s.vx || 0;
        s.y += s.vy || 0;

        // Destroy enemy shots on contact (Boomerang Cross & Tornado!)
        if (s.destroysEnemyShots) {
          for (let j = this.enemyShots.length - 1; j >= 0; j--) {
            const es = this.enemyShots[j];
            if (GNG.aabb(s.x - 2, s.y - 2, s.w + 4, s.h + 4, es.x, es.y, es.w, es.h)) {
              this.particles.spawnEmbers(es.x, es.y, '#fff29c', 3);
              this.enemyShots.splice(j, 1);
            }
          }
        }

        // Holy Water Torch ground impact -> Creeping Blue Ground Flames!
        if (s.kind === 'torch') {
          const hitTile = GNG.tileAtWorld(this.level, s.x + 4, s.y + s.h);
          if (s.vy > 0 && GNG.isSolidFloorTile(hitTile)) {
            const baseY = Math.floor((s.y + s.h) / TS) * TS - 8;
            const count = s.empowered ? 4 : 3;
            this.audio.sfx('torchBurn');
            for (let f = 0; f < count; f++) {
              this.playerShots.push({
                kind: 'blueFlame',
                sourceWeapon: 'TORCH',
                isSubFlame: true,
                x: s.x + f * s.dir * 10,
                y: baseY,
                w: 10,
                h: 9,
                vx: 0,
                vy: 0,
                dmg: 0.22,
                dir: s.dir,
                pierce: true,
                breaksShield: true,
                life: 58 - f * 6
              });
            }
            this.playerShots.splice(i, 1);
            continue;
          }
        }

        // Crack Open Treasure Chests!
        let consumed = false;
        for (const ch of this.level.chests) {
          if (ch.opened || !ch.revealed) continue;
          if (GNG.aabb(s.x, s.y, s.w, s.h, ch.x, ch.y, 16, 10)) {
            this._openChest(ch);
            if (!s.pierce) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.playerShots.splice(i, 1);
          continue;
        }

        // Shootable Exploding Nukage Barrels (Stage 5 DOOM!)
        for (let bIdx = this.level.barrels.length - 1; bIdx >= 0; bIdx--) {
          const bar = this.level.barrels[bIdx];
          if (GNG.aabb(s.x, s.y, s.w, s.h, bar.x, bar.y, 14, 12)) {
            this.level.barrels.splice(bIdx, 1);
            this.audio.sfx('explosion');
            this.shakeTimer = 12;
            this.particles.spawnSplash(bar.x + 7, bar.y + 6, '#66ff38', 14);
            this.particles.popup(bar.x - 8, bar.y - 10, 'BOOM!', hex('#66ff38'));
            for (const e of this.enemies) {
              if (!e.dead && !e.possessed && Math.hypot(e.x - bar.x, e.y - bar.y) < 68) {
                GNG.hurtEnemy(this, e, 10, true, 0);
              }
            }
            if (!s.pierce) consumed = true;
            break;
          }
        }
        if (consumed) {
          this.playerShots.splice(i, 1);
          continue;
        }

        // Hit Undead Enemies
        for (const e of this.enemies) {
          if (e.dead || e.possessed) continue;
          if (s.hitIds && s.hitIds.has(e.id)) continue;
          if (GNG.aabb(s.x, s.y, s.w, s.h, e.x, e.y, e.w, e.h)) {
            GNG.hurtEnemy(this, e, s.dmg, s.breaksShield, s.dir);
            if (s.hitIds) s.hitIds.add(e.id);
            if (!s.pierce) {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.playerShots.splice(i, 1);
          continue;
        }

        // Hit Stage Boss
        if (this.boss && !this.boss.dead && this.boss.dyingTimer === 0) {
          const b = this.boss;
          if ((!s.hitIds || !s.hitIds.has(9999)) && GNG.aabb(s.x, s.y, s.w, s.h, b.x, b.y, b.w, b.h)) {
            GNG.hurtBoss(this, b, s.dmg);
            if (s.hitIds) s.hitIds.add(9999);
            if (!s.pierce) {
              this.playerShots.splice(i, 1);
              continue;
            }
          }
        }
      }

      // 2. Enemy Projectiles
      const hitY = p.crouching ? p.y + 8 : p.y + 2;
      const hitH = p.crouching ? p.h - 8 : p.h - 2;
      for (let i = this.enemyShots.length - 1; i >= 0; i--) {
        const es = this.enemyShots[i];
        es.life--;
        if (es.grav) es.vy += es.grav;
        es.x += es.vx;
        es.y += es.vy;
        if (es.life <= 0 || es.y > 202 || es.x < this.camX - 30 || es.x > this.camX + 350) {
          this.enemyShots.splice(i, 1);
          continue;
        }

        if (!p.dead) {
          if (p.possessing) {
            const m = p.possessing;
            if (!m.burrowed && GNG.aabb(es.x, es.y, es.w, es.h, m.x + 2, m.y + 2, m.w - 4, m.h - 4)) {
              this.enemyShots.splice(i, 1);
              p.possessTimer -= 110;
              m.flash = 5;
              this.audio.sfx('enemyHit');
            }
          } else if (GNG.aabb(es.x, es.y, es.w, es.h, p.x + 2, hitY, p.w - 4, hitH)) {
            this.enemyShots.splice(i, 1);
            this._damagePlayer();
          }
        }
      }
    }

    _openChest(ch) {
      ch.opened = true;
      this.audio.sfx('chestOpen');
      this.score += 500;
      this.particles.spawnEmbers(ch.x + 8, ch.y + 2, '#fff29c', 10);

      const p = this.player;
      if (ch.kind === 'magician') {
        // Hidden Magician Chest -> Spawns GOLDEN ARMOR Upgrade!
        this.pickups.push({
          kind: 'goldArmor',
          x: ch.x + 2,
          y: ch.y - 6,
          vy: -2.5,
          life: 1200
        });
        this.particles.popup(ch.x - 16, ch.y - 12, 'MAGICIAN CHEST!', hex('#fff29c'));
      } else if (p.armor === 'boxers') {
        // Reclaim Knight's Steel Armor!
        this.pickups.push({
          kind: 'steelArmor',
          weapon: ch.weapon,
          x: ch.x + 2,
          y: ch.y - 6,
          vy: -2.5,
          life: 1200
        });
      } else {
        // Drop Swap-On-Pickup Weapon!
        const nextWep =
          ch.weapon ||
          GNG.WEAPON_ORDER[(GNG.WEAPON_ORDER.indexOf(p.weapon) + 1) % GNG.WEAPON_ORDER.length];
        this.pickups.push({
          kind: 'weapon',
          weapon: nextWep,
          x: ch.x + 2,
          y: ch.y - 6,
          vy: -2.5,
          life: 900
        });
      }
    }

    _updatePickups() {
      const p = this.player;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.life--;
        if (pk.life <= 0) {
          this.pickups.splice(i, 1);
          continue;
        }
        pk.vy = Math.min(3.4, pk.vy + 0.16);
        pk.y += pk.vy;
        const footT = GNG.tileAtWorld(this.level, pk.x + 6, pk.y + 12);
        if (pk.vy > 0 && GNG.isSolidFloorTile(footT)) {
          pk.y = Math.floor((pk.y + 12) / TS) * TS - 12;
          pk.vy = 0;
        }

        if (!p.dead && GNG.aabb(p.x - 2, p.y - 2, p.w + 4, p.h + 4, pk.x, pk.y, 14, 14)) {
          if (pk.kind === 'steelArmor') {
            if (p.possessing) GNG.endPossession(this, p);
            p.armor = 'steel';
            this.anvil = null;
            this.audio.sfx('armorEquip');
            this.score += 1000;
            this.particles.popup(p.x - 16, p.y - 12, 'KNIGHT ARMOR!', hex('#f6f8fc'));
          } else if (pk.kind === 'goldArmor') {
            if (p.possessing) GNG.endPossession(this, p);
            p.armor = 'gold';
            p.magicCooldown = 0;
            this.anvil = null;
            this.audio.sfx('goldenUpgrade');
            this.lightningFlash = 0.75;
            this.score += 3000;
            this.particles.popup(p.x - 18, p.y - 12, 'GOLDEN ARMOR!', hex('#fff29c'));
          } else if (pk.kind === 'weapon') {
            p.weapon = pk.weapon;
            this.audio.sfx('armorEquip');
            this.score += 400;
            this.particles.popup(p.x - 14, p.y - 12, GNG.WEAPON_DEFS[pk.weapon].name + '!', hex('#ecc146'));
          } else if (pk.kind === 'potion') {
            this.score += 1500;
            p.magicCooldown = 0;
            p.invuln = Math.max(p.invuln, 90);
            this.audio.sfx('goldenUpgrade');
            this.particles.popup(p.x - 14, p.y - 12, 'AURA POTION!', hex('#57d95b'));
          } else if (pk.kind === 'stageKey') {
            this.audio.playVictoryFanfare();
            this.score += 5000;
            this.openMapIntro(this.stageIdx + 1);
            this.pickups.splice(i, 1);
            return;
          } else if (pk.kind === 'floppy') {
            // Reclaimed the Cursed 3.5" Floppy Disk -> Grand Victory!
            this.audio.playVictoryFanfare();
            this.score += 25000;
            this.state = 'VICTORY';
            this.stateTimer = 0;
            this.pickups.splice(i, 1);
            this._syncCabinetUI();
            return;
          }
          this.pickups.splice(i, 1);
        }
      }
    }

    _updateMagicVisuals() {
      for (let i = this.magicEffects.length - 1; i >= 0; i--) {
        const m = this.magicEffects[i];
        m.life--;
        if (m.kind === 'phoenix') {
          m.angle += 0.22;
          m.radius += 2.8;
        }
        if (m.life <= 0) this.magicEffects.splice(i, 1);
      }
    }

    _damagePlayer() {
      const p = this.player;
      if (p.dead || p.invuln > 0) return;

      if (p.armor === 'steel' || p.armor === 'gold') {
        const wasGold = p.armor === 'gold';
        p.armor = 'boxers';
        p.shatterAnim = 22;
        p.invuln = 75;
        p.vy = -3.0;
        p.vx = -p.facing * 1.6;
        p.grounded = false;
        p.doubleJumpUsed = false;
        this.shakeTimer = 14;
        this.audio.sfx('armorShatter');
        this.particles.spawnArmorShatter(p.x + 6, p.y + 8, wasGold);
        this.particles.popup(p.x - 16, p.y - 12, 'ARMOR SHATTERED!', hex('#eb4034'));
      } else {
        this._killPlayerImmediate();
      }
    }

    _killPlayerImmediate() {
      const p = this.player;
      if (p.dead) return;
      if (p.possessing) {
        GNG.endPossession(this, p);
      }
      p.dead = true;
      p.deathTimer = 78;
      this.shakeTimer = 14;
      this.audio.sfx('playerDeath');
      this.particles.spawnBones(p.x + 6, p.y + 10, 14);
    }

    // ========================================================================
    // 320x200 SOFTWARE FRAMEBUFFER RENDERER
    // ========================================================================
    render() {
      const fb = this.fb;

      if (this.state === 'TITLE') {
        this._renderTitleScreen(fb);
      } else if (this.state === 'MAP') {
        this._renderParchmentMap(fb);
      } else {
        this._renderPlayWorld(fb);
        if (this.state === 'PAUSED') {
          fb.rectBlend(0, 22, 320, 178, 8, 9, 14, 170, true);
          fb.textGradientCentered('PAUSED', 86, hex('#fff29c'), hex('#ecc146'), hex('#a8791d'), hex('#08090d'), 2);
          fb.textCentered('PRESS P OR JUMP TO RESUME', 114, hex('#f0e9d8'), hex('#08090d'), 1);
        } else if (this.state === 'GAMEOVER') {
          fb.rectBlend(0, 22, 320, 178, 16, 6, 6, 190, true);
          fb.textGradientCentered('YOU ARE BONES!', 74, hex('#ff9c38'), hex('#eb4034'), hex('#9c1e18'), hex('#08090d'), 2);
          const sec = Math.ceil(this.stateTimer / 60);
          fb.textCentered('FREE ARCADE CONTINUE: ' + sec, 106, hex('#fff29c'), hex('#08090d'), 1);
          fb.textCentered('PRESS JUMP OR CLICK TO RISE AGAIN', 124, hex('#8cf7ff'), hex('#08090d'), 1);
        } else if (this.state === 'VICTORY') {
          this._renderVictoryOverlay(fb);
        }
      }

      fb.present();
    }

    _renderTitleScreen(fb) {
      const S = GNG.SPRITES;
      // Animated Gothic Graveyard Parallax Preview
      GNG.renderParallaxAndTiles(fb, this.level, (this.frame * 0.65) % 600, this.frame, false, this.lightningFlash);
      fb.rectBlend(0, 0, 320, 200, 6, 8, 12, 110, true);

      // Top Arcade Coin-Op Bar
      fb.text('1UP ' + String(this.score).padStart(6, '0'), 10, 6, hex('#f0e9d8'), hex('#08090d'), 1);
      fb.text('HI ' + String(this.highScore).padStart(6, '0'), 218, 6, hex('#eb4034'), hex('#08090d'), 1);

      // Emblem Banner
      fb.rectBlend(22, 22, 276, 54, 12, 13, 18, 210, true);
      fb.rectOutline(22, 22, 276, 54, hex('#ecc146'), true);
      fb.textGradientCentered("GHOSTS 'N GOBLINS", 30, hex('#fff29c'), hex('#ecc146'), hex('#b8681f'), hex('#08090d'), 2);
      fb.textCentered('THE CURSED PC GAMING MUSEUM', 52, hex('#8cf7ff'), hex('#08090d'), 1);
      fb.textCentered('STEEL · BOXERS · POSSESSION · GOLD MAGIC', 64, hex('#f0e9d8'), hex('#08090d'), 1);

      // Animated Showcase: Sir Arthur vs Swooping Red Arremer & Rising Zombie!
      const runIdx = (this.frame >> 3) & 3;
      const modeCycle = Math.floor(this.frame / 150) % 3;
      const arthurSet = modeCycle === 0 ? S.arthurSteel : modeCycle === 1 ? S.arthurBoxers : S.arthurGold;
      fb.blitScaled(arthurSet.run[runIdx], 58, 128, 2, 2, false, 0, true);
      fb.blitScaled(S.arremerFly[(this.frame >> 3) & 1], 210, 102 + ((Math.sin(this.frame * 0.08) * 8) | 0), 2, 2, true, 0, true);
      fb.blitScaled(S.zombieWalk[(this.frame >> 4) & 1], 164, 136, 2, 2, true, 0, true);
      fb.blitScaled(S.chestMagician, 118, 156, 1.5, 1.5, false, 0, true);

      // Blinking Start Prompt + Stage Warp Notice
      if (((this.frame >> 4) & 1) === 0) {
        fb.textGradientCentered('PRESS SPACE OR CLICK TO START', 176, hex('#ffffff'), hex('#fff29c'), hex('#ecc146'), hex('#08090d'), 1);
      }
      fb.textCentered('PRESS [1]-[6] TO WARP TO ANY MUSEUM STAGE', 189, hex('#b5ab94'), hex('#08090d'), 1);

      if (this.lightningFlash > 0.1) {
        fb.applyLightningFlash(this.lightningFlash * 0.4, 180, 220, 255);
      }
    }

    // --- CLASSIC ARCADE PARCHMENT WORLD MAP INTRO SCREEN ---
    _renderParchmentMap(fb) {
      const S = GNG.SPRITES;
      // Aged Bayer-Dithered Parchment Scroll
      fb.ditherGradientV(0, 0, 320, 200, [216, 192, 142], [172, 138, 86]);
      fb.rectOutline(4, 4, 312, 192, hex('#5c3616'), true);
      fb.rectOutline(7, 7, 306, 186, hex('#8c5828'), true);

      // Dark Sea & Haunted Coastline Silhouette on Parchment
      fb.rectBlend(14, 42, 292, 124, 92, 68, 38, 55, true);
      fb.textGradientCentered('THE CURSED PC GAMING MUSEUM', 14, hex('#7a1c14'), hex('#5c1610'), hex('#2e0c08'), hex('#f5ecc6'), 1);
      const curMeta = GNG.STAGE_META[this.stageIdx];
      fb.textCentered(curMeta.code + ': ' + curMeta.title, 27, hex('#1e140a'), 0, 1);

      // Connect all 6 Museum Landmarks with Dotted Graveyard Trail
      for (let i = 0; i < 5; i++) {
        const a = GNG.STAGE_META[i];
        const b = GNG.STAGE_META[i + 1];
        for (let step = 0; step <= 10; step++) {
          const px = (a.mapX + ((b.mapX - a.mapX) * step) / 10) | 0;
          const py = (a.mapY + ((b.mapY - a.mapY) * step) / 10) | 0;
          fb.rect(px - 1, py - 1, 2, 2, i < this.stageIdx ? hex('#9c1e18') : hex('#5c3616'), true);
        }
      }

      // Draw Landmark Nodes & Icons
      for (let i = 0; i < 6; i++) {
        const m = GNG.STAGE_META[i];
        const isTarget = i === this.stageIdx;
        const cleared = i < this.stageIdx;
        fb.circle(m.mapX, m.mapY, isTarget ? 8 : 6, isTarget ? hex('#eb4034') : cleared ? hex('#288a36') : hex('#5c3616'), true);
        fb.circle(m.mapX, m.mapY, isTarget ? 5 : 4, hex('#f5ecc6'), true);
        fb.text(String(i + 1), m.mapX - 2, m.mapY - 3, hex('#1e140a'), 0, 1);
        const lw = fb.textWidth(m.parody, 1);
        const lx = Math.max(10, Math.min(308 - lw, m.mapX - (lw >> 1)));
        fb.text(m.parody, lx, m.mapY + 10, hex('#3d230e'), 0, 1);
      }

      // Mini Sir Arthur Marching Along Parchment Trail to Target Stage!
      const prevM = GNG.STAGE_META[this.prevStageIdx];
      const progress = Math.min(1, (175 - this.stateTimer) / 95);
      const ax = (prevM.mapX + (curMeta.mapX - prevM.mapX) * progress) | 0;
      const ay = (prevM.mapY + (curMeta.mapY - prevM.mapY) * progress) | 0;
      fb.blit(S.arthurSteel.run[(this.frame >> 3) & 3], ax - 8, ay - 22, curMeta.mapX < prevM.mapX, false, 0, false, true);
      fb.blit(S.cursedFloppy, 274, 42, false, false, 0, false, true);

      // Bottom Player Ready Banner
      fb.rect(14, 171, 292, 16, hex('#24160c'), true);
      fb.textCentered(curMeta.subtitle + ' · PLAYER 1 READY!', 176, hex('#fff29c'), hex('#08090d'), 1);
    }

    _renderPlayWorld(fb) {
      const S = GNG.SPRITES;
      const p = this.player;
      const spectralVision = p.armor === 'boxers' || !!p.possessing;

      // 3-Layer Parallax + Stage Tiles + Contraptions
      GNG.renderParallaxAndTiles(fb, this.level, this.camX, this.frame, spectralVision, this.lightningFlash);

      // Checkpoint Haunted Torch Marker
      const cpX = (this.level.checkpointX - this.camX) | 0;
      if (cpX > -16 && cpX < 336) {
        fb.rect(cpX, 11 * TS - 18, 4, 18, hex('#6e5540'));
        const flameCol = this.checkpointReached ? '#57d95b' : '#ff8c26';
        fb.circle(cpX + 2, 11 * TS - 21 - (this.frame & 1), 4, hex(flameCol));
      }

      // Shootable Nukage Barrels
      for (const bar of this.level.barrels) {
        const bx = (bar.x - this.camX) | 0;
        if (bx > -16 && bx < 336) {
          fb.blit(S.nukageBarrel[(this.frame >> 4) & 1], bx, bar.y | 0, false, false, 0);
        }
      }

      // Treasure Chests (Normal, Spectral, Magician)
      for (const ch of this.level.chests) {
        if (!ch.revealed) continue;
        const cx = (ch.x - this.camX) | 0;
        if (cx < -20 || cx > 336) continue;
        if (ch.opened) {
          fb.blit(S.chestOpen, cx, ch.y + 1, false, false, 0);
        } else {
          const spr =
            ch.kind === 'magician'
              ? S.chestMagician
              : ch.kind === 'spectral'
              ? S.chestSpectral
              : S.chestClosed;
          fb.blit(spr, cx, ch.y, false, false, 0, ch.kind === 'spectral' && ((this.frame >> 2) & 1) === 0);
          if (ch.kind === 'magician' && (this.frame & 7) === 0) {
            fb.pset(cx + ((this.frame >> 2) % 14), ch.y - 2, hex('#fff29c'));
          }
        }
      }

      // Ejected Decoy Armor Anvil
      if (this.anvil) {
        const ax = (this.anvil.x - this.camX) | 0;
        const ay = this.anvil.y | 0;
        const spr = this.anvil.squash > 0 ? S.armorAnvilSquash : S.armorAnvil;
        const tint = this.anvil.isGold ? hex('#ecc146') : 0;
        fb.blit(spr, ax, ay + (this.anvil.squash > 0 ? 4 : 0), false, false, tint);
      }

      // Pickups (Steel Armor, Golden Armor, Weapons, Potions, Stage Key, Cursed Floppy)
      for (const pk of this.pickups) {
        const px = (pk.x - this.camX) | 0;
        const py = (pk.y + Math.sin(this.frame * 0.12) * 1.5) | 0;
        if (px < -16 || px > 336) continue;
        if (pk.kind === 'steelArmor') {
          fb.glowCircle(px + 6, py + 6, 10, 120, 160, 220);
          fb.blit(S.pickupSteelArmor, px, py, false, false, 0);
        } else if (pk.kind === 'goldArmor') {
          fb.glowCircle(px + 6, py + 6, 13, 220, 180, 50);
          fb.blit(S.pickupGoldArmor, px, py, false, false, 0);
        } else if (pk.kind === 'weapon') {
          fb.glowCircle(px + 6, py + 6, 9, 180, 140, 40);
          fb.blit(this._weaponIconSprite(pk.weapon), px, py + 2, false, false, 0);
        } else if (pk.kind === 'potion') {
          fb.blit(S.potionRed, px + 2, py + 2, false, false, 0);
        } else if (pk.kind === 'stageKey') {
          fb.glowCircle(px + 6, py + 6, 12, 230, 190, 60);
          fb.blit(S.cross[0], px + 2, py + 2, false, false, hex('#fff29c'));
        } else if (pk.kind === 'floppy') {
          fb.glowCircle(px + 8, py + 6, 16, 80, 220, 255);
          fb.blit(S.cursedFloppy, px, py, false, false, 0);
        }
      }

      // Undead Enemies (+ Possessed Monster Highlight & Countdown Bar!)
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ex = (e.x - this.camX) | 0;
        if (ex < -24 || ex > 344) continue;
        const ey = e.y | 0;
        const flip = e.facing < 0;
        const tint = e.flash > 0 ? hex('#ffffff') : e.possessed && (this.frame & 3) === 0 ? hex('#8cf7ff') : 0;

        let spr = null;
        if (e.type === 'zombie') {
          if (e.burrowed) {
            spr = S.zombieBurrow;
          } else if (e.state === 'rising') {
            const idx = Math.min(2, ((28 - e.riseTimer) / 9) | 0);
            spr = S.zombieRise[idx];
          } else {
            spr = S.zombieWalk[(this.frame >> 3) & 1];
          }
        } else if (e.type === 'skeleton') {
          spr = S.skeletonWalk[(this.frame >> 3) & 1];
        } else if (e.type === 'skelSword') {
          spr = S.skelSwordWalk[(this.frame >> 3) & 1];
        } else if (e.type === 'hauntedArmor') {
          spr = S.hauntedArmor[(this.frame >> 4) & 1];
        } else if (e.type === 'voodooSkull') {
          spr = S.voodooSkull[(this.frame >> 3) & 1];
        } else if (e.type === 'lemming') {
          spr = S.lemmingBlocker[(this.frame >> 3) & 1];
          if (e.countdown > 0) {
            const num = Math.ceil(e.countdown / 36);
            fb.text(String(num), ex + 4, ey - 9, hex('#ff9c38'), hex('#08090d'), 1);
          }
        } else if (e.type === 'cyberImp') {
          spr = S.cyberImp[(this.frame >> 3) & 1];
        } else if (e.type === 'arremer' || e.type === 'arremerElite') {
          if (e.state === 'statue') spr = S.arremerStatue;
          else if (e.state === 'swoop') spr = S.arremerDive;
          else spr = S.arremerFly[(this.frame >> 2) & 1];
        }

        if (e.possessed) {
          fb.glowCircle(ex + 7, ey + 9, 13, 40, 170, 190);
          // 8-Second Possession Countdown Bar above monster!
          const ratio = Math.max(0, p.possessTimer / 480);
          fb.rect(ex - 1, ey - 6, 16, 3, hex('#08090d'));
          fb.rect(ex, ey - 5, (14 * ratio) | 0, 1, hex('#8cf7ff'));
        }

        const drawY = e.burrowed ? ey + 11 : ey;
        if (e.type === 'arremerElite') {
          fb.blitScaled(spr, ex - 2, drawY - 2, 1.25, 1.25, flip, tint);
        } else {
          fb.blit(spr, ex, drawY, flip, false, tint);
        }
      }

      // Stage Boss
      GNG.renderBoss(fb, this.boss, this.camX, this.frame);

      // Soul-Possession Tether Beam
      if (this.soulBeam) {
        fb.lightningBolt(
          this.soulBeam.x0 - this.camX,
          this.soulBeam.y0,
          this.soulBeam.x1 - this.camX,
          this.soulBeam.y1,
          this.frame,
          hex('#ffffff'),
          70,
          235,
          255
        );
      }

      // Sir Arthur (if not currently inside a Possessed Monster)
      if (!p.possessing) {
        const px = (p.x - this.camX) | 0;
        const py = p.y | 0;
        if (p.dead) {
          fb.blit(S.arthurBonePile, px - 2, py + 9, false, false, 0);
        } else if (p.invuln === 0 || (this.frame & 1) === 0) {
          if (p.magicCastTimer > 0) {
            fb.glowCircle(px + 6, py + 10, 18, 230, 190, 60);
          }
          if (p.shatterAnim > 10) {
            fb.blit(S.arthurShatter, px - 2, py + 2, p.facing < 0, false, 0);
          } else {
            const set =
              p.armor === 'gold'
                ? S.arthurGold
                : p.armor === 'boxers'
                ? S.arthurBoxers
                : S.arthurSteel;
            let spr = set.idle[(this.frame >> 4) & 1];
            if (p.onLadder) {
              spr = set.climb[(p.runClock | 0) & 1];
            } else if (p.throwAnim > 0) {
              spr = p.crouching ? set.throwCrouch : p.aimUp ? set.throwUp : set.throw;
            } else if (!p.grounded) {
              spr = set.jump;
            } else if (p.crouching) {
              spr = set.crouch;
            } else if (Math.abs(p.vx) > 0.25) {
              spr = set.run[(p.runClock | 0) & 3];
            }
            const yAdj = p.crouching ? 5 : 0;
            fb.blit(spr, px - 2, py + yAdj, p.facing < 0, false, 0);
          }
        }
      }

      // Player Projectiles & Creeping Blue Flames
      for (const s of this.playerShots) {
        const sx = (s.x - this.camX) | 0;
        const sy = s.y | 0;
        if (sx < -24 || sx > 344) continue;
        const goldTint = s.isMagic ? hex('#fff29c') : 0;
        if (s.kind === 'lance') {
          fb.blit(s.aimUp ? S.lanceV : S.lanceH, sx, sy, s.dir < 0, false, goldTint);
        } else if (s.kind === 'dagger') {
          fb.blit(s.aimUp ? S.daggerV : S.daggerH, sx, sy, s.dir < 0, false, goldTint);
        } else if (s.kind === 'torch') {
          fb.blit(S.torch[(this.frame >> 2) & 1], sx, sy, false, false, 0);
        } else if (s.kind === 'blueFlame') {
          fb.glowCircle(sx + 4, sy + 4, 8, 30, 120, 200);
          fb.blit(S.blueFlame[(this.frame >> 2) % 3], sx, sy, false, false, 0);
        } else if (s.kind === 'axe') {
          fb.blit(S.axe[(this.frame >> 2) & 1], sx, sy, s.dir < 0, (this.frame >> 3) & 1, 0);
        } else if (s.kind === 'cross') {
          fb.blit(S.cross[(this.frame >> 2) & 1], sx, sy, false, false, 0);
        } else if (s.kind === 'tornado') {
          for (let ty = 0; ty < s.h; ty += 6) {
            const w = 8 + ((ty >> 2) & 7);
            fb.rect(sx + (((this.frame + ty) & 3) - 1), sy + ty, w, 4, (ty & 4) ? hex('#eb4034') : hex('#fff29c'));
          }
        } else if (s.kind === 'possessFire') {
          fb.glowCircle(sx + 4, sy + 4, 7, 200, 90, 30);
          fb.circle(sx + 4, sy + 4, 3, hex('#fff29c'));
        } else if (s.kind === 'possessAcid') {
          fb.circle(sx + 4, sy + 4, 3, hex('#57d95b'));
        } else if (s.kind === 'possessBone') {
          fb.blit(S.boneProj[(this.frame >> 2) & 1], sx, sy, false, false, hex('#8cf7ff'));
        }
      }

      // Golden Magic Screen-Clearing Visual Effects!
      for (const m of this.magicEffects) {
        const mx = (m.x - this.camX) | 0;
        if (m.kind === 'thunderDragon') {
          fb.lightningBolt(0, m.y, 320, m.y, this.frame, hex('#fff29c'), 220, 180, 40);
          fb.lightningBolt(mx, 22, mx, 196, this.frame + 7, hex('#ffffff'), 120, 220, 255);
        } else if (m.kind === 'phoenix') {
          const px = (m.cx - this.camX + Math.cos(m.angle) * m.radius) | 0;
          const py = (m.cy + Math.sin(m.angle) * m.radius * 0.65) | 0;
          fb.glowCircle(px, py, 14, 50, 190, 255);
          fb.circle(px, py, 5, hex('#ffffff'));
        } else if (m.kind === 'sunburst') {
          const rad = (38 - m.life) * 6;
          fb.rect(0, m.y - 3, 320, 6, hex('#fff29c'));
          fb.rect(mx - 3, 22, 6, 178, hex('#fff29c'));
          fb.glowCircle(mx, m.y, Math.min(80, rad), 200, 170, 50);
        }
      }

      // Enemy Projectiles
      for (const es of this.enemyShots) {
        const sx = (es.x - this.camX) | 0;
        const sy = es.y | 0;
        if (es.kind === 'bone') {
          fb.blit(S.boneProj[(this.frame >> 2) & 1], sx, sy, false, false, 0);
        } else if (es.kind === 'acid') {
          fb.circle(sx + 2, sy + 2, 3, hex('#57d95b'));
          fb.pset(sx + 2, sy + 1, hex('#ffffff'));
        } else {
          fb.glowCircle(sx + 3, sy + 3, 6, 200, 70, 20);
          fb.circle(sx + 3, sy + 3, 2, hex('#fff29c'));
        }
      }

      // Particles & Floating Popups
      this.particles.render(fb, this.camX);

      // 1.25x Foreground Gothic Graveyard Spikes
      GNG.renderForegroundSilhouette(fb, this.camX);

      // Spectral Vision Rim Shimmer in Boxer Shorts / Possession!
      if (spectralVision) {
        fb.applySpectralRim(Math.sin(this.frame * 0.15) * 0.5 + 0.5);
      }
      if (this.lightningFlash > 0.05) {
        fb.applyLightningFlash(this.lightningFlash * 0.35, 190, 225, 255);
      }

      // Top 22px CPS-1 Arcade HUD
      this._renderHUD(fb);
    }

    _weaponIconSprite(wep) {
      const S = GNG.SPRITES;
      if (wep === 'DAGGER') return S.daggerH;
      if (wep === 'TORCH') return S.torch[0];
      if (wep === 'AXE') return S.axe[0];
      if (wep === 'CROSS') return S.cross[0];
      return S.lanceH;
    }

    _renderHUD(fb) {
      const p = this.player;
      fb.rect(0, 0, 320, 22, pack(10, 11, 15), true);
      fb.rect(0, 21, 320, 1, hex('#5c451c'), true);

      // Score & Lives
      fb.text('1UP', 4, 2, hex('#eb4034'), 0, 1);
      fb.text(String(this.score).padStart(6, '0'), 4, 11, hex('#f6f8fc'), 0, 1);

      fb.text('LIVES:' + Math.max(0, this.lives), 52, 2, hex('#ecc146'), 0, 1);
      fb.text('STG:' + (this.stageIdx + 1) + (this.loop > 1 ? '+' : ''), 52, 11, hex('#b5ab94'), 0, 1);

      // Equipped Weapon Box
      fb.rectOutline(102, 2, 58, 18, hex('#8c6826'), true);
      fb.blit(this._weaponIconSprite(p.weapon), 105, 6, false, false, 0, false, true);
      fb.text(p.weapon.slice(0, 5), 125, 7, hex('#fff29c'), 0, 1);

      // Tactical Mode / Possession / Golden Magic Status
      if (p.possessing) {
        const secs = (p.possessTimer / 60).toFixed(1);
        fb.text('SOUL ' + secs + 'S', 165, 3, hex('#8cf7ff'), 0, 1);
        fb.rect(165, 13, 64, 5, hex('#1d2b36'), true);
        fb.rect(166, 14, ((62 * p.possessTimer) / 480) | 0, 3, hex('#8cf7ff'), true);
      } else if (p.armor === 'gold') {
        fb.text('GOLD [E:MAGIC]', 165, 3, hex('#fff29c'), 0, 1);
        const ready = Math.max(0, 1 - p.magicCooldown / 165);
        fb.rect(165, 13, 76, 5, hex('#2e220d'), true);
        fb.rect(166, 14, (74 * ready) | 0, 3, ready >= 1 ? hex('#fff29c') : hex('#ecc146'), true);
      } else if (p.armor === 'boxers') {
        fb.text('BOXERS+SPECTRAL', 165, 3, hex('#8cf7ff'), 0, 1);
        fb.text('[E] POSSESS FOE', 165, 12, hex('#eb4034'), 0, 1);
      } else {
        fb.text('STEEL ARMOR', 165, 3, hex('#f6f8fc'), 0, 1);
        fb.text('[E] EJECT ANVIL', 165, 12, hex('#c3ccd9'), 0, 1);
      }

      // Boss Health Bar (right side when active!)
      if (this.boss && !this.boss.dead) {
        fb.text('BOSS', 262, 3, hex('#eb4034'), 0, 1);
        fb.rect(258, 12, 58, 6, hex('#2e1111'), true);
        const bw = Math.max(0, ((56 * this.boss.hp) / this.boss.maxHp) | 0);
        fb.rect(259, 13, bw, 4, hex('#eb4034'), true);
      } else {
        const prog = Math.min(1, p.x / Math.max(1, this.level.bossTriggerX));
        fb.text('MAP', 268, 3, hex('#b5ab94'), 0, 1);
        fb.rect(258, 13, 56, 4, hex('#232830'), true);
        fb.rect(259, 14, (54 * prog) | 0, 2, hex('#ecc146'), true);
      }
    }

    _renderVictoryOverlay(fb) {
      const S = GNG.SPRITES;
      fb.rectBlend(0, 22, 320, 178, 8, 10, 18, 212, true);
      fb.rectOutline(16, 30, 288, 158, hex('#ecc146'), true);

      fb.textGradientCentered('CURSE BROKEN!', 38, hex('#fff29c'), hex('#ecc146'), hex('#b8681f'), hex('#08090d'), 2);
      fb.textCentered('ASTAROTH-LECHUCK-9000 IS SHATTERED!', 62, hex('#8cf7ff'), hex('#08090d'), 1);
      fb.textCentered('SIR ARTHUR RECLAIMED MAKAIMURA.EXE!', 74, hex('#f0e9d8'), hex('#08090d'), 1);

      fb.blitScaled(S.arthurGold.idle[(this.frame >> 4) & 1], 118, 92, 2, 2, false, 0, true);
      fb.glowCircle(176, 108, 18, 80, 220, 255);
      fb.blitScaled(S.cursedFloppy, 162, 96, 2, 2, false, 0, true);

      fb.textCentered('FINAL SCORE: ' + String(this.score).padStart(7, '0'), 148, hex('#fff29c'), hex('#08090d'), 1);
      fb.textCentered('RANK: GRAND KNIGHT OF 320X200', 160, hex('#57d95b'), hex('#08090d'), 1);
      if (((this.frame >> 4) & 1) === 0) {
        fb.textCentered('PRESS SPACE FOR 2ND QUEST LOOP!', 174, hex('#ffffff'), hex('#08090d'), 1);
      }
      this.particles.render(fb, 0);
    }

    // --- LOCKED 60 FPS MAIN LOOP ---
    start() {
      const STEP = 1000 / 60;
      let last = performance.now();
      let acc = 0;

      const loop = (now) => {
        const dt = Math.min(100, now - last);
        last = now;
        acc += dt;

        let steps = 0;
        while (acc >= STEP && steps < 5) {
          this.tick();
          acc -= STEP;
          steps++;
        }

        this.render();

        this._fpsFrames++;
        if (now - this._fpsLastTime >= 1000) {
          this.fpsDisplay = Math.min(60, Math.round((this._fpsFrames * 1000) / (now - this._fpsLastTime)));
          this._fpsFrames = 0;
          this._fpsLastTime = now;
        }

        window.requestAnimationFrame(loop);
      };

      this.render();
      window.requestAnimationFrame(loop);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    GNG.instance = new GhostsNGoblinsGame();
    GNG.instance.start();
  });
})();
