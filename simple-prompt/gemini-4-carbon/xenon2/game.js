(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});
  const {
    WIDTH,
    HEIGHT,
    PALETTE,
    RAMP,
    sampleRamp,
    Framebuffer,
    SPRITES,
    EPOCH_TILES,
    TILE,
    STAGE_DEFS,
    generateStageData,
    WEAPONS
  } = XENON;

  class XenonGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.fb = new Framebuffer(this.canvas);

      this.state = 'title'; // 'title' | 'playing' | 'gameover' | 'victory'
      this.tick = 0;
      this.crtEnabled = true;
      this.shakeTimer = 0;
      this.BannerTimer = 0;
      this.bannerTitle = '';
      this.bannerSub = '';
      this.pendingStageAdvance = false;

      // Input state (Keyboard + Mouse seamless hybrid)
      this.keys = {};
      this.mouse = {
        x: WIDTH / 2,
        y: HEIGHT - 36,
        active: false,
        leftDown: false,
        rightDown: false
      };

      // Starfield / Parallax particles
      this.bgStars = [];
      for (let i = 0; i < 56; i++) {
        this.bgStars.push({
          x: (i * 73) % WIDTH,
          y: (i * 41) % HEIGHT,
          speed: 0.2 + (i % 3) * 0.22,
          bright: 4 + (i % 8)
        });
      }

      this.resetCampaign();

      this.shop = new XENON.CrispinShopController(this);
      this.trackerUI = new XENON.TrackerUIController(this);
    }

    resetCampaign() {
      this.score = 0;
      this.stageNum = 1;
      this.player = {
        x: WIDTH / 2,
        y: HEIGHT - 34,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        shield: 50,
        maxShield: 50,
        chrono: 180,
        maxChrono: 180,
        credits: 350, // Generous starter credits so players can test Crispin's Shop right away!
        bombs: 2,
        speedTier: 1,
        invuln: 0,
        nashwanTimer: 0,
        bossIntelStage: 0,
        droneAngle: 0,
        frameCount: 0,
        cdNose: 0,
        cdLeftWing: 0,
        cdRightWing: 0,
        cdTail: 0,
        cdDrones: 0,
        cdNova: 0,
        loadout: {
          nose: 'twin_vulcan',
          leftWing: 'side_laser',
          rightWing: null,
          rearTail: null,
          drones: 'scout_drone',
          hull: null
        }
      };

      this.loadStage(1, false);
    }

    loadStage(stageNum, isWarp = false) {
      this.stageNum = Math.max(1, Math.min(5, stageNum | 0));
      this.stageData = generateStageData(this.stageNum);
      this.cameraY = this.stageData.startScrollY;
      this.frontierCameraY = this.cameraY;
      this.midShopTriggered = false;
      this.bossSpawned = false;
      this.boss = null;
      this.reverseThrustActive = false;
      this.chronoRewindActive = false;
      this.deadEndWarning = false;

      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.pickups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.lightningArcs = [];
      this.chronoBuffer = []; // 180-frame ring buffer

      // Populate dead-end treasure Cash Bubbles from stage definition
      for (const sp of this.stageData.staticPickups) {
        this.pickups.push({
          x: sp.x,
          y: sp.y,
          vx: 0,
          vy: 0,
          value: sp.value,
          tier: sp.tier,
          worldSpace: true,
          bobPhase: sp.x * 0.1
        });
      }

      this.player.x = WIDTH / 2;
      this.player.y = HEIGHT - 34;
      this.player.invuln = 60;

      // If warping directly to a higher stage with starter credits, grant stage-scaled credits for fun testing!
      if (isWarp && this.player.credits < this.stageNum * 250) {
        this.player.credits = this.stageNum * 280;
      }

      XENON.audio.setEpoch(this.stageNum);
      XENON.audio.setBossMode(false);

      const def = this.stageData.def;
      this.showBanner(`EPOCH ${def.num}: ${def.name}`, def.epochYear, 165);
      this.updateCabinetHUD();
    }

    showBanner(title, sub, duration = 140) {
      this.bannerTitle = title;
      this.bannerSub = sub;
      this.BannerTimer = duration;
    }

    start() {
      this.shop.bindDOM();
      this.trackerUI.bindDOM();
      this.bindControls();
      this.updateCabinetHUD();

      // Locked 60 FPS Fixed-Timestep Loop (prevents 2x speed on 120Hz ProMotion displays!)
      const STEP_MS = 1000 / 60;
      let lastTime = performance.now();
      let accumulator = 0;

      const loop = (now) => {
        let delta = now - lastTime;
        lastTime = now;
        if (delta > 100) delta = 100;
        accumulator += delta;

        let stepped = false;
        while (accumulator >= STEP_MS) {
          this.fixedUpdate();
          accumulator -= STEP_MS;
          stepped = true;
        }

        if (stepped) {
          this.render();
          this.shop.updateAndRender();
          this.trackerUI.update();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    bindControls() {
      const unlockAudio = () => {
        XENON.audio.init();
      };

      window.addEventListener('keydown', (e) => {
        unlockAudio();
        const code = e.code;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
          e.preventDefault();
        }

        if (!e.repeat) {
          // Modal shortcuts
          if (code === 'KeyT') {
            if (this.shop.isOpen) this.shop.close();
            this.trackerUI.toggle();
            return;
          }
          if (code === 'KeyB') {
            if (this.trackerUI.isOpen) this.trackerUI.close();
            if (this.state === 'title') this.state = 'playing';
            this.shop.toggle();
            return;
          }
          if (code === 'KeyC') {
            this.toggleCRT();
            return;
          }
          if (code === 'KeyM') {
            XENON.audio.setMasterMute(!XENON.audio.masterMuted);
            this.updateCabinetHUD();
            return;
          }
          if (code === 'Escape') {
            if (this.shop.isOpen) this.shop.close();
            if (this.trackerUI.isOpen) this.trackerUI.close();
            return;
          }

          // Stage Warp Selector [1] - [5]
          if (code >= 'Digit1' && code <= 'Digit5') {
            const stg = Number(code.slice(5));
            if (this.shop.isOpen) this.shop.close();
            if (this.trackerUI.isOpen) this.trackerUI.close();
            this.state = 'playing';
            this.loadStage(stg, true);
            return;
          }

          // Smart Bomb / Super Nashwan Overdrive [Q] / [X]
          if ((code === 'KeyQ' || code === 'KeyX') && this.state === 'playing' && !this.shop.isOpen && !this.trackerUI.isOpen) {
            this.triggerSmartBomb();
          }

          // Start from Title or Restart from GameOver/Victory
          if (code === 'Enter' || code === 'Space') {
            if (this.shop.isOpen) {
              if (code === 'Enter') this.shop.close();
              return;
            }
            if (this.state === 'title') {
              this.state = 'playing';
              this.loadStage(1, false);
            } else if (this.state === 'gameover' || this.state === 'victory') {
              this.resetCampaign();
              this.state = 'playing';
            }
          }
        }

        this.keys[code] = true;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
          this.mouse.active = false;
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      const updateMouseCoords = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        this.mouse.x = Math.max(10, Math.min(WIDTH - 10, ((e.clientX - rect.left) / rect.width) * WIDTH));
        this.mouse.y = Math.max(14, Math.min(HEIGHT - 12, ((e.clientY - rect.top) / rect.height) * HEIGHT));
      };

      this.canvas.addEventListener('pointermove', (e) => {
        updateMouseCoords(e);
        if (this.state === 'playing' && !this.shop.isOpen && !this.trackerUI.isOpen) {
          this.mouse.active = true;
        }
      });

      this.canvas.addEventListener('pointerdown', (e) => {
        unlockAudio();
        updateMouseCoords(e);
        if (this.state === 'title') {
          this.state = 'playing';
          this.loadStage(1, false);
          return;
        }
        if (this.state === 'gameover' && e.button === 0) {
          this.resetCampaign();
          this.state = 'playing';
          return;
        }
        if (this.state === 'victory' && e.button === 0) {
          this.resetCampaign();
          this.state = 'playing';
          return;
        }
        if (e.button === 2) {
          this.mouse.rightDown = true;
        } else {
          this.mouse.leftDown = true;
          this.mouse.active = true;
        }
      });

      window.addEventListener('pointerup', (e) => {
        if (e.button === 2) this.mouse.rightDown = false;
        else this.mouse.leftDown = false;
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Cabinet deck buttons
      const bindBtn = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { unlockAudio(); fn(); });
      };
      bindBtn('btn-open-shop', () => {
        if (this.trackerUI.isOpen) this.trackerUI.close();
        if (this.state === 'title') this.state = 'playing';
        this.shop.toggle();
      });
      bindBtn('btn-open-tracker', () => {
        if (this.shop.isOpen) this.shop.close();
        this.trackerUI.toggle();
      });
      bindBtn('btn-toggle-crt', () => this.toggleCRT());
      bindBtn('btn-smart-bomb', () => {
        if (this.state === 'playing') this.triggerSmartBomb();
      });
      bindBtn('btn-mute-audio', () => {
        XENON.audio.setMasterMute(!XENON.audio.masterMuted);
        this.updateCabinetHUD();
      });

      document.querySelectorAll('[data-warp-stage]').forEach((btn) => {
        btn.addEventListener('click', () => {
          unlockAudio();
          const stg = Number(btn.getAttribute('data-warp-stage'));
          if (this.shop.isOpen) this.shop.close();
          if (this.trackerUI.isOpen) this.trackerUI.close();
          this.state = 'playing';
          this.loadStage(stg, true);
        });
      });
    }

    toggleCRT() {
      this.crtEnabled = !this.crtEnabled;
      const screenWrap = document.getElementById('crt-viewport');
      if (screenWrap) screenWrap.classList.toggle('crt-on', this.crtEnabled);
      const btn = document.getElementById('btn-toggle-crt');
      if (btn) btn.textContent = this.crtEnabled ? 'CRT: ON [C]' : 'CRT: OFF [C]';
    }

    onShopClosed() {
      if (this.pendingStageAdvance) {
        this.pendingStageAdvance = false;
        if (this.stageNum < 5) {
          this.loadStage(this.stageNum + 1, false);
        } else {
          this.state = 'victory';
        }
      }
    }

    // =========================================================================
    // 180-FRAME (3.0 SECOND) CHRONO-REVERSE STATE RING BUFFER
    // =========================================================================
    pushChronoSnapshot() {
      const p = this.player;
      const snap = {
        cameraY: this.cameraY,
        frontierCameraY: this.frontierCameraY,
        midShopTriggered: this.midShopTriggered,
        bossSpawned: this.bossSpawned,
        boss: this.boss ? JSON.parse(JSON.stringify(this.boss)) : null,
        player: {
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          hp: p.hp,
          shield: p.shield,
          invuln: p.invuln,
          nashwanTimer: p.nashwanTimer,
          droneAngle: p.droneAngle,
          cdNose: p.cdNose,
          cdLeftWing: p.cdLeftWing,
          cdRightWing: p.cdRightWing,
          cdTail: p.cdTail,
          cdDrones: p.cdDrones
        },
        tiles: new Uint8Array(this.stageData.tiles),
        tileHP: new Uint8Array(this.stageData.tileHP),
        waveFlags: this.stageData.waves.map((w) => w.spawned),
        enemies: this.enemies.map((e) => ({
          ...e,
          segments: e.segments ? e.segments.map((s) => ({ ...s })) : null
        })),
        bullets: this.bullets.map((b) => ({ ...b })),
        enemyBullets: this.enemyBullets.map((eb) => ({ ...eb })),
        pickups: this.pickups.map((pk) => ({ ...pk }))
      };

      this.chronoBuffer.push(snap);
      if (this.chronoBuffer.length > 180) {
        this.chronoBuffer.shift();
      }
    }

    popChronoSnapshot() {
      if (this.chronoBuffer.length === 0 || this.player.chrono <= 0) return false;
      const snap = this.chronoBuffer.pop();
      this.cameraY = snap.cameraY;
      this.frontierCameraY = snap.frontierCameraY;
      this.midShopTriggered = snap.midShopTriggered;
      this.bossSpawned = snap.bossSpawned;
      this.boss = snap.boss;
      XENON.audio.setBossMode(!!this.boss);

      const p = this.player;
      p.x = snap.player.x;
      p.y = snap.player.y;
      p.vx = snap.player.vx;
      p.vy = snap.player.vy;
      p.hp = snap.player.hp;
      p.shield = snap.player.shield;
      p.invuln = Math.max(24, snap.player.invuln);
      p.nashwanTimer = snap.player.nashwanTimer;
      p.droneAngle = snap.player.droneAngle;
      p.cdNose = snap.player.cdNose;
      p.cdLeftWing = snap.player.cdLeftWing;
      p.cdRightWing = snap.player.cdRightWing;
      p.cdTail = snap.player.cdTail;
      p.cdDrones = snap.player.cdDrones;

      this.stageData.tiles.set(snap.tiles);
      this.stageData.tileHP.set(snap.tileHP);
      for (let i = 0; i < snap.waveFlags.length; i++) {
        this.stageData.waves[i].spawned = snap.waveFlags[i];
      }

      this.enemies = snap.enemies;
      this.bullets = snap.bullets;
      this.enemyBullets = snap.enemyBullets;
      this.pickups = snap.pickups;
      this.lightningArcs = [];

      p.chrono = Math.max(0, p.chrono - 1);
      XENON.audio.playChronoRewindTick(this.tick);
      return true;
    }

    // =========================================================================
    // FIXED 60 FPS SIMULATION UPDATE
    // =========================================================================
    fixedUpdate() {
      this.tick++;
      this.updateBgStars();

      // Pause world simulation when Shop or Tracker Modal is open
      if (this.shop.isOpen || this.trackerUI.isOpen) return;

      if (this.state === 'title' || this.state === 'victory') return;

      const wantRewind =
        this.keys['KeyR'] ||
        this.keys['ShiftLeft'] ||
        this.keys['ShiftRight'] ||
        this.mouse.rightDown;

      // Allow Chrono-Rewind rescue even from GameOver if Chrono-Energy & history exist!
      if (this.state === 'gameover') {
        if (wantRewind && this.player.chrono > 10 && this.chronoBuffer.length > 5) {
          this.state = 'playing';
          this.popChronoSnapshot();
          this.chronoRewindActive = true;
        }
        return;
      }

      const p = this.player;
      p.frameCount++;
      if (this.BannerTimer > 0) this.BannerTimer--;
      if (this.shakeTimer > 0) this.shakeTimer--;

      // Check Chrono-Reverse Thrust first!
      if (wantRewind && p.chrono > 0 && this.chronoBuffer.length > 0) {
        this.chronoRewindActive = true;
        this.reverseThrustActive = false;
        this.popChronoSnapshot();

        // Check CHRONO BACKFIRE NOVA Synergy during Chrono-Rewind!
        const syn = WEAPONS.computeActiveSynergies(p.loadout, p.nashwanTimer > 0);
        if (syn.chrono_nova) {
          if (p.cdNova <= 0) {
            WEAPONS.triggerChronoBackfireNova(this);
            p.cdNova = 36;
          } else {
            p.cdNova--;
          }
        }
        this.updateParticles();
        if (this.tick % 4 === 0) this.updateCabinetHUD();
        return;
      }
      this.chronoRewindActive = false;

      // Recharge Chrono-Energy gradually during forward timeline play
      const chronoRegen = p.loadout.hull === 'chrono_capacitor' ? 0.34 : 0.18;
      p.chrono = Math.min(p.maxChrono, p.chrono + chronoRegen);
      // Slight shield trickle
      p.shield = Math.min(p.maxShield, p.shield + 0.025);

      if (p.invuln > 0) p.invuln--;
      if (p.nashwanTimer > 0) p.nashwanTimer--;
      if (p.cdNose > 0) p.cdNose--;
      if (p.cdLeftWing > 0) p.cdLeftWing--;
      if (p.cdRightWing > 0) p.cdRightWing--;
      if (p.cdTail > 0) p.cdTail--;
      if (p.cdDrones > 0) p.cdDrones--;
      if (p.cdNova > 0) p.cdNova--;
      p.droneAngle += 0.075;

      // 1. Player Movement (Keyboard WASD/Arrows OR Smooth Mouse Tracking)
      const baseSpeed = 2.05 + (p.speedTier - 1) * 0.35 + (p.loadout.hull === 'twin_thrusters' ? 0.55 : 0);
      let dx = 0;
      let dy = 0;
      const moveUp = this.keys['KeyW'] || this.keys['ArrowUp'];
      const moveDown = this.keys['KeyS'] || this.keys['ArrowDown'];
      const moveLeft = this.keys['KeyA'] || this.keys['ArrowLeft'];
      const moveRight = this.keys['KeyD'] || this.keys['ArrowRight'];

      if (moveLeft) dx -= 1;
      if (moveRight) dx += 1;
      if (moveUp) dy -= 1;
      if (moveDown) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        p.vx = (dx / len) * baseSpeed;
        p.vy = (dy / len) * baseSpeed;
      } else if (this.mouse.active) {
        const mdx = this.mouse.x - p.x;
        const mdy = this.mouse.y - p.y;
        const dist = Math.hypot(mdx, mdy);
        const maxStep = baseSpeed * 1.45;
        if (dist > 0.5) {
          const step = Math.min(dist * 0.32, maxStep);
          p.vx = (mdx / dist) * step;
          p.vy = (mdy / dist) * step;
        } else {
          p.vx = 0;
          p.vy = 0;
        }
      } else {
        p.vx *= 0.65;
        p.vy *= 0.65;
      }

      this.movePlayerWithCavernCollision(p.vx, p.vy);

      // 2. XENON 2 SIGNATURE REVERSE SCROLLING THRUST vs FORWARD SCROLLING
      const wantReverseScroll =
        !this.boss &&
        ((moveDown && p.y >= 132) || (this.mouse.active && this.mouse.y >= 176 && p.y >= 164));

      const maxBacktrackY = Math.min(this.stageData.startScrollY, this.frontierCameraY + 320);

      if (wantReverseScroll && this.cameraY < maxBacktrackY) {
        this.reverseThrustActive = true;
        const revRate = p.loadout.hull === 'twin_thrusters' ? 1.75 : 1.28;
        this.cameraY = Math.min(maxBacktrackY, this.cameraY + revRate);

        // Trigger CHRONO BACKFIRE NOVA Synergy when Reverse-Scrolling!
        const syn = WEAPONS.computeActiveSynergies(p.loadout, p.nashwanTimer > 0);
        if (syn.chrono_nova && p.cdNova <= 0) {
          WEAPONS.triggerChronoBackfireNova(this);
          p.cdNova = 38;
        }
      } else {
        this.reverseThrustActive = false;
        if (!this.boss && this.cameraY > this.stageData.bossTriggerScrollY) {
          this.cameraY = Math.max(this.stageData.bossTriggerScrollY, this.cameraY - 0.72);
          if (this.cameraY < this.frontierCameraY) {
            this.frontierCameraY = this.cameraY;
          }
          // Check if scrolling ceiling pushes player downward!
          if (this.isRectTouchingWall(p.x, p.y, 7, 7)) {
            p.y += 1.0;
            if (p.y >= HEIGHT - 11) {
              // Caught against dead-end ceiling! Deal crush scrape & flash warning
              this.damagePlayer(14);
              p.y = HEIGHT - 12;
            }
          }
        }
      }

      // Check if player is inside a Dead-End Treasure Alcove to show helpful HUD hint
      this.deadEndWarning = this.checkDeadEndProximity();

      // Mid-Stage Crispin Shop Dock Beacon!
      if (!this.midShopTriggered && this.cameraY <= this.stageData.midShopScrollY) {
        this.midShopTriggered = true;
        this.showBanner("DOCKING AT CRISPIN'S EMPORIUM", '50% TRADE-IN & SYNERGY UPGRADES', 120);
        this.shop.open('midstage');
      }

      // Boss Arena Trigger!
      if (!this.bossSpawned && this.cameraY <= this.stageData.bossTriggerScrollY + 1) {
        this.spawnStageBoss();
      }

      // 3. Fire Equipped Hardpoint Weapons!
      const firing = this.keys['Space'] || this.keys['KeyZ'] || this.mouse.leftDown || p.nashwanTimer > 0;
      if (firing) {
        WEAPONS.firePlayerArsenal(this);
      }

      // 4. Spawn Scripted Epoch Enemy Waves & Update Wall Hazards
      this.updateWaveSpawns();
      this.updateCavernHazards();

      // 5. Update Bullets, Bounce-Orbs, Prism Splits, Enemies, Boss & Cash Bubbles
      this.updatePlayerBullets();
      this.updateEnemies();
      this.updateBoss();
      this.updateEnemyBullets();
      this.updatePickups();
      this.updateParticles();
      this.updateLightningArcs();

      // 6. Record frame into 180-frame Chrono-Rewind Ring-Buffer!
      this.pushChronoSnapshot();

      if (this.tick % 5 === 0) {
        this.updateCabinetHUD();
      }
    }

    updateBgStars() {
      const dir = this.chronoRewindActive ? -2.2 : (this.reverseThrustActive ? -0.8 : 1.0);
      for (const s of this.bgStars) {
        s.y += s.speed * dir;
        if (s.y >= HEIGHT) s.y -= HEIGHT;
        if (s.y < 0) s.y += HEIGHT;
      }
    }

    // =========================================================================
    // CAVERN TILE COLLISION & DESTRUCTIBLE BOTTLENECKS
    // =========================================================================
    getTileAtWorld(wx, wy) {
      const c = Math.floor(wx / 8);
      const r = Math.floor(wy / 8);
      if (c < 0 || c >= this.stageData.cols || r < 0 || r >= this.stageData.rows) {
        return c < 0 || c >= this.stageData.cols ? TILE.SOLID : TILE.EMPTY;
      }
      return this.stageData.tiles[r * this.stageData.cols + c];
    }

    damageTileAtWorld(wx, wy, dmg) {
      const c = Math.floor(wx / 8);
      const r = Math.floor(wy / 8);
      if (c < 0 || c >= this.stageData.cols || r < 0 || r >= this.stageData.rows) return false;
      const idx = r * this.stageData.cols + c;
      const t = this.stageData.tiles[idx];
      if (t === TILE.DESTRUCT || t === TILE.HAZARD_L || t === TILE.HAZARD_R) {
        if (this.stageData.tileHP[idx] <= dmg) {
          this.stageData.tiles[idx] = TILE.EMPTY;
          this.stageData.tileHP[idx] = 0;
          this.score += 25;
          const sy = wy - this.cameraY;
          this.spawnSparks(c * 8 + 4, sy, 6, RAMP.CORAL);
          XENON.audio.playExplosion(0.4);
          if (Math.random() < 0.24) {
            this.spawnCashBubble(c * 8 + 4, sy, 25, 1);
          }
        } else {
          this.stageData.tileHP[idx] -= dmg;
          this.spawnSparks(wx, wy - this.cameraY, 2, RAMP.CHROME);
        }
        return true;
      }
      return t !== TILE.EMPTY;
    }

    isRectTouchingWall(sx, sy, halfW, halfH) {
      const wy = sy + this.cameraY;
      const pts = [
        [sx - halfW, wy - halfH],
        [sx + halfW, wy - halfH],
        [sx - halfW, wy + halfH],
        [sx + halfW, wy + halfH],
        [sx, wy - halfH],
        [sx, wy + halfH]
      ];
      for (const [px, py] of pts) {
        if (this.getTileAtWorld(px, py) !== TILE.EMPTY) return true;
      }
      return false;
    }

    movePlayerWithCavernCollision(vx, vy) {
      const p = this.player;
      // Slide X
      const nextX = Math.max(14, Math.min(WIDTH - 14, p.x + vx));
      if (!this.isRectTouchingWall(nextX, p.y, 7, 7)) {
        p.x = nextX;
      } else if (Math.abs(vx) > 0.4 && this.tick % 4 === 0) {
        this.spawnSparks(p.x + Math.sign(vx) * 8, p.y, 2, RAMP.CHROME);
      }

      // Slide Y
      const nextY = Math.max(18, Math.min(HEIGHT - 13, p.y + vy));
      if (!this.isRectTouchingWall(p.x, nextY, 7, 7)) {
        p.y = nextY;
      } else if (Math.abs(vy) > 0.4 && this.tick % 4 === 0) {
        this.spawnSparks(p.x, p.y + Math.sign(vy) * 8, 2, RAMP.CHROME);
      }
    }

    checkDeadEndProximity() {
      const pWorldY = this.player.y + this.cameraY;
      for (const fk of this.stageData.forkZones) {
        const topPx = fk.topRow * 8;
        const botPx = fk.botRow * 8;
        if (pWorldY >= topPx && pWorldY <= botPx) {
          const inRight = this.player.x > 160;
          if ((fk.deadSide === 'right' && inRight) || (fk.deadSide === 'left' && !inRight)) {
            if (pWorldY - topPx < 95) return true;
          }
        }
      }
      return false;
    }

    getDronePositions() {
      const p = this.player;
      const mode = p.nashwanTimer > 0 ? 'dual_drones' : p.loadout.drones;
      if (!mode) return [];
      const r = 21;
      if (mode === 'scout_drone') {
        return [{
          x: p.x + Math.cos(p.droneAngle) * r,
          y: p.y + Math.sin(p.droneAngle) * r * 0.85
        }];
      }
      return [
        {
          x: p.x + Math.cos(p.droneAngle) * r,
          y: p.y + Math.sin(p.droneAngle) * r * 0.85
        },
        {
          x: p.x + Math.cos(p.droneAngle + Math.PI) * r,
          y: p.y + Math.sin(p.droneAngle + Math.PI) * r * 0.85
        }
      ];
    }

    // =========================================================================
    // WEAPON PROJECTILES, BOUNCE-ORBS, PRISM MATRIX & TESLA CHAIN SWARM
    // =========================================================================
    spawnBullet(x, y, vx, vy, dmg, kind, color, extra = null) {
      this.bullets.push({
        x,
        y,
        vx,
        vy,
        dmg,
        kind,
        color,
        bouncesLeft: extra && extra.bouncesLeft ? extra.bouncesLeft : 0,
        canPrism: !!(extra && extra.canPrism),
        wallBonus: extra && extra.wallBonus ? extra.wallBonus : 1,
        ttl: extra && extra.ttl ? extra.ttl : 180,
        isNova: !!(extra && extra.isNova)
      });
    }

    fireElectroArc(ox, oy, chainSwarm = false) {
      // Find forward targets for nose Electro-Arc
      const candidates = [];
      for (const e of this.enemies) {
        if (e.y < oy + 35 && Math.hypot(e.x - ox, e.y - oy) < 135) {
          candidates.push(e);
        }
      }
      if (this.boss && Math.hypot(this.boss.x - ox, this.boss.y - oy) < 165) {
        candidates.push(this.boss);
      }

      candidates.sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy));

      if (candidates.length > 0) {
        const primary = candidates[0];
        this.damageTarget(primary, 13, 'electro');
        this.lightningArcs.push({ x0: ox, y0: oy, x1: primary.x, y1: primary.y, ttl: 5, cyan: true });
      } else {
        // Crackling forward arc bolt even without target, damaging destructible cavern tiles ahead!
        const endY = Math.max(4, oy - 78);
        for (let py = oy; py >= endY; py -= 8) {
          if (this.getTileAtWorld(ox, py + this.cameraY) !== TILE.EMPTY) {
            this.damageTileAtWorld(ox, py + this.cameraY, 12);
            this.lightningArcs.push({ x0: ox, y0: oy, x1: ox, y1: py, ttl: 4, cyan: true });
            break;
          }
          if (py - 8 < endY) {
            this.lightningArcs.push({ x0: ox, y0: oy, x1: ox + (Math.random() - 0.5) * 14, y1: endY, ttl: 4, cyan: true });
          }
        }
      }

      // SYNERGY #3: TESLA CHAIN SWARM (Chains high-voltage arcs through Orbiting Drones -> up to 4 foes!)
      if (chainSwarm) {
        const drones = this.getDronePositions();
        if (drones.length >= 2) {
          this.lightningArcs.push({ x0: this.player.x, y0: this.player.y, x1: drones[0].x, y1: drones[0].y, ttl: 4, cyan: false });
          this.lightningArcs.push({ x0: drones[0].x, y0: drones[0].y, x1: drones[1].x, y1: drones[1].y, ttl: 4, cyan: true });

          const allTargets = [...this.enemies];
          if (this.boss) allTargets.push(this.boss);
          let prevX = drones[1].x;
          let prevY = drones[1].y;
          let hits = 0;
          for (const tgt of allTargets) {
            if (hits >= 4) break;
            if (Math.hypot(tgt.x - prevX, tgt.y - prevY) < 150) {
              this.damageTarget(tgt, 9, 'electro');
              this.lightningArcs.push({ x0: prevX, y0: prevY, x1: tgt.x, y1: tgt.y, ttl: 5, cyan: true });
              prevX = tgt.x;
              prevY = tgt.y;
              hits++;
            }
          }
        }
      }
    }

    splitIntoPrismBeams(bx, by, baseVy = -5.2) {
      const colors = [
        { col: '#ff4d8d', vx: -2.35, vy: baseVy * 0.92 },
        { col: '#4ade80', vx: 0, vy: baseVy * 1.05 },
        { col: '#38bdf8', vx: 2.35, vy: baseVy * 0.92 }
      ];
      for (const c of colors) {
        this.spawnBullet(bx, by, c.vx, c.vy, 13, 'prism', c.col, { bouncesLeft: 1, canPrism: false });
      }
      this.spawnSparks(bx, by, 5, RAMP.NASHWAN);
      XENON.audio.playBounce();
    }

    updatePlayerBullets() {
      const bounceOrbs = this.bullets.filter((b) => b.kind === 'bounce_orb');

      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.ttl--;
        if (b.ttl <= 0 || b.y < -14 || b.y > HEIGHT + 16 || b.x < -12 || b.x > WIDTH + 12) {
          if (b.kind === 'mine' && b.ttl <= 0) {
            this.spawnSparks(b.x, b.y, 7, RAMP.NASHWAN);
          }
          this.bullets.splice(i, 1);
          continue;
        }

        // Homing Missile steering
        if (b.kind === 'missile') {
          let best = this.boss;
          let bestD = best ? Math.hypot(best.x - b.x, best.y - b.y) : 999;
          for (const e of this.enemies) {
            const d = Math.hypot(e.x - b.x, e.y - b.y);
            if (d < bestD) { bestD = d; best = e; }
          }
          if (best) {
            const ang = Math.atan2(best.y - b.y, best.x - b.x);
            b.vx += Math.cos(ang) * 0.35;
            b.vy += Math.sin(ang) * 0.35;
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > 4.6) { b.vx = (b.vx / sp) * 4.6; b.vy = (b.vy / sp) * 4.6; }
          }
        } else if (b.kind === 'mine') {
          b.vx *= 0.96;
          b.vy *= 0.96;
          // Gentle proximity attraction toward nearby enemies
          for (const e of this.enemies) {
            const d = Math.hypot(e.x - b.x, e.y - b.y);
            if (d < 54 && d > 1) {
              b.vx += ((e.x - b.x) / d) * 0.25;
              b.vy += ((e.y - b.y) / d) * 0.25;
            }
          }
        }

        // SYNERGY #1: RICOCHET PRISM MATRIX — Laser hitting a friendly Bounce-Orb splits into 3 RGB Prism Beams!
        if (b.canPrism) {
          let refracted = false;
          for (const orb of bounceOrbs) {
            if (Math.hypot(orb.x - b.x, orb.y - b.y) < 13) {
              this.splitIntoPrismBeams(orb.x, orb.y, -5.2);
              this.bullets.splice(i, 1);
              refracted = true;
              break;
            }
          }
          if (refracted) continue;
        }

        // Step X & Y checking cavern walls for Ricochet / Destruction!
        const nx = b.x + b.vx;
        const ny = b.y + b.vy;
        const hitTileX = this.getTileAtWorld(nx, b.y + this.cameraY) !== TILE.EMPTY;
        const hitTileY = this.getTileAtWorld(b.x, ny + this.cameraY) !== TILE.EMPTY;

        if (hitTileX || hitTileY || nx <= 3 || nx >= WIDTH - 3) {
          if (hitTileX) this.damageTileAtWorld(nx, b.y + this.cameraY, b.dmg * b.wallBonus * 0.65);
          if (hitTileY) this.damageTileAtWorld(b.x, ny + this.cameraY, b.dmg * b.wallBonus * 0.65);

          if (b.bouncesLeft > 0) {
            b.bouncesLeft--;
            if (hitTileX || nx <= 3 || nx >= WIDTH - 3) b.vx = -b.vx;
            if (hitTileY) b.vy = -b.vy;
            XENON.audio.playBounce();
            // Wall bounce with Prism Matrix also spawns a prism split!
            if (b.canPrism) {
              b.canPrism = false;
              this.splitIntoPrismBeams(b.x, b.y, b.vy || -4.8);
              this.bullets.splice(i, 1);
              continue;
            }
          } else {
            this.spawnSparks(b.x, b.y, 3, RAMP.CYAN);
            this.bullets.splice(i, 1);
            continue;
          }
        } else {
          b.x = nx;
          b.y = ny;
        }

        // Check Enemy & Serpent Segment collisions
        let consumed = false;
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          if (Math.hypot(e.x - b.x, e.y - b.y) <= e.radius + 4) {
            this.damageTarget(e, b.dmg, b.kind);
            if (b.kind !== 'prism') {
              this.bullets.splice(i, 1);
              consumed = true;
              break;
            }
          }
          // Stage 5 Segmented Serpent body segments!
          if (!consumed && e.segments) {
            for (let si = e.segments.length - 1; si >= 0; si--) {
              const seg = e.segments[si];
              if (Math.hypot(seg.x - b.x, seg.y - b.y) <= 8) {
                seg.hp -= b.dmg;
                this.spawnSparks(seg.x, seg.y, 3, RAMP.EMERALD);
                if (seg.hp <= 0) {
                  this.spawnCashBubble(seg.x, seg.y, 25, 1);
                  e.segments.splice(si, 1);
                }
                this.bullets.splice(i, 1);
                consumed = true;
                break;
              }
            }
            if (consumed) break;
          }
        }
        if (consumed) continue;

        // Check Boss collision
        if (this.boss && Math.abs(b.x - this.boss.x) <= 30 && Math.abs(b.y - this.boss.y) <= 20) {
          // Stage 2 Kraken-Nautilus shell deflects pure frontal vulcan/laser when spinning!
          if (
            this.stageNum === 2 &&
            this.boss.shellShieldActive &&
            (b.kind === 'vulcan' || b.kind === 'laser') &&
            Math.abs(b.x - this.boss.x) < 16
          ) {
            b.vy = Math.abs(b.vy);
            b.vx += (Math.random() - 0.5) * 3;
            XENON.audio.playBounce();
            this.bullets.splice(i, 1);
            continue;
          }
          this.damageTarget(this.boss, b.dmg, b.kind);
          this.bullets.splice(i, 1);
        }
      }
    }

    triggerSmartBomb() {
      const p = this.player;
      if (p.bombs <= 0) return;
      p.bombs--;
      this.shakeTimer = 24;
      this.enemyBullets = [];
      XENON.audio.playExplosion(2.2);
      this.showBanner('MEGABLAST SMART BOMB!!', 'PLASMA SHOCKWAVE DEPLOYED', 65);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        this.damageTarget(this.enemies[i], 140, 'bomb');
      }
      if (this.boss) {
        this.damageTarget(this.boss, 130, 'bomb');
      }
      for (let a = 0; a < 28; a++) {
        const ang = (a / 28) * Math.PI * 2;
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * 4.2,
          vy: Math.sin(ang) * 4.2,
          life: 28,
          maxLife: 28,
          ramp: RAMP.NASHWAN
        });
      }
      this.updateCabinetHUD();
    }

    // =========================================================================
    // ENEMY WAVES, WALL HAZARDS & 5 EPOCH BOSSES
    // =========================================================================
    updateWaveSpawns() {
      for (const w of this.stageData.waves) {
        if (!w.spawned && this.cameraY <= w.triggerScrollY) {
          w.spawned = true;
          this.spawnEnemyWave(w);
        }
      }
    }

    spawnEnemyWave(w) {
      const hpScale = 1 + (this.stageNum - 1) * 0.32;
      for (let i = 0; i < w.count; i++) {
        let sx = 72 + ((i + 0.5) / w.count) * (WIDTH - 144);
        let sy = -14 - i * 16;
        if (w.pattern === 'vee') {
          sx = WIDTH / 2 + (i - (w.count - 1) / 2) * 28;
          sy = -12 - Math.abs(i - (w.count - 1) / 2) * 14;
        }

        const baseHp = w.kind === 'bomber' ? 72 : (w.kind === 'serpent' ? 120 : 28);
        const enemy = {
          kind: w.kind,
          x: Math.max(48, Math.min(WIDTH - 48, sx)),
          y: sy,
          baseX: sx,
          vx: (i % 2 === 0 ? 1 : -1) * 0.9,
          vy: w.kind === 'orthoceras' ? 2.1 : 0.95,
          hp: Math.round(baseHp * hpScale),
          maxHp: Math.round(baseHp * hpScale),
          radius: w.kind === 'bomber' ? 11 : 9,
          age: i * 10,
          flash: 0,
          segments: null
        };

        // Stage 5: Classic Xenon 2 Multi-Segment Chrome Serpent!
        if (w.kind === 'serpent') {
          enemy.segments = [];
          for (let s = 1; s <= 6; s++) {
            enemy.segments.push({ x: enemy.x, y: enemy.y - s * 11, hp: 32 });
          }
        }
        this.enemies.push(enemy);
      }
    }

    updateCavernHazards() {
      // Check visible rows for Thermal Vents (Stg 2), Arc Coils (Stg 3), Laser Gates (Stg 4), Spore Walls (Stg 5)
      if (this.tick % 55 !== 0) return;
      const rStart = Math.max(0, Math.floor(this.cameraY / 8));
      const rEnd = Math.min(this.stageData.rows - 1, Math.floor((this.cameraY + HEIGHT) / 8));
      const cols = this.stageData.cols;

      for (let r = rStart; r <= rEnd; r++) {
        for (let c = 0; c < cols; c++) {
          const t = this.stageData.tiles[r * cols + c];
          if (t !== TILE.HAZARD_L && t !== TILE.HAZARD_R) continue;
          const sx = c * 8 + 4;
          const sy = r * 8 + 4 - this.cameraY;
          const dir = t === TILE.HAZARD_L ? 1 : -1;

          if (this.stageNum === 5 && this.enemies.length < 10) {
            // Spore-spawning wall cyst births a Xenite hatchling!
            this.enemies.push({
              kind: 'xenite',
              x: sx + dir * 10,
              y: sy,
              baseX: sx + dir * 35,
              vx: dir * 1.4,
              vy: 0.9,
              hp: 24,
              maxHp: 24,
              radius: 8,
              age: 0,
              flash: 0,
              segments: null
            });
          } else {
            // Thermal Vent Geyser / Voltaic Arc Bolt / Laser Gate Pulse!
            this.enemyBullets.push({
              x: sx + dir * 6,
              y: sy,
              vx: dir * 2.2,
              vy: 0.25,
              color: this.stageNum === 2 ? '#38bdf8' : '#fbbf24',
              ttl: 95
            });
          }
        }
      }
    }

    updateEnemies() {
      const p = this.player;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.age++;
        if (e.flash > 0) e.flash--;

        const scrollDelta = this.reverseThrustActive ? -1.1 : 0;

        if (e.kind === 'trilobite' || e.kind === 'squid') {
          e.x = e.baseX + Math.sin(e.age * 0.055) * 34;
          e.y += e.vy + scrollDelta;
        } else if (e.kind === 'blitter_bob') {
          // Demoscene Lissajous curve!
          e.x = WIDTH / 2 + Math.sin(e.age * 0.045) * 92;
          e.y += 0.72 + Math.cos(e.age * 0.09) * 0.9 + scrollDelta;
        } else if (e.kind === 'ammonite' || e.kind === 'cog') {
          const nx = e.x + e.vx * 1.55;
          if (nx < 38 || nx > WIDTH - 38 || this.getTileAtWorld(nx, e.y + this.cameraY) !== TILE.EMPTY) {
            e.vx = -e.vx;
          } else {
            e.x = nx;
          }
          e.y += 0.85 + scrollDelta;
        } else if (e.kind === 'serpent') {
          const prevX = e.x;
          const prevY = e.y;
          e.x = WIDTH / 2 + Math.sin(e.age * 0.05) * 86;
          e.y += 0.82 + scrollDelta;
          if (e.segments) {
            let leadX = prevX;
            let leadY = prevY;
            for (const seg of e.segments) {
              const ang = Math.atan2(leadY - seg.y, leadX - seg.x);
              seg.x = leadX - Math.cos(ang) * 10;
              seg.y = leadY - Math.sin(ang) * 10;
              leadX = seg.x;
              leadY = seg.y;
            }
          }
        } else if (e.kind === 'xenite') {
          // Lunges smoothly toward player X
          e.x += Math.sign(p.x - e.x) * 0.75;
          e.y += 1.25 + scrollDelta;
        } else {
          e.y += e.vy + scrollDelta;
        }

        // Enemy firing patterns
        const fireRate = e.kind === 'turret' || e.kind === 'glenz' ? 75 : 105;
        if (e.y > 12 && e.y < HEIGHT - 36 && e.age % fireRate === 35) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          this.enemyBullets.push({
            x: e.x,
            y: e.y + 6,
            vx: Math.cos(ang) * 1.95,
            vy: Math.sin(ang) * 1.95,
            color: '#fb7185',
            ttl: 180
          });
        }

        // Player hull & orbital drone collision
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 8) {
          this.damagePlayer(18);
          this.damageTarget(e, 45, 'ram');
          continue;
        }

        if (e.y > HEIGHT + 28) {
          this.enemies.splice(i, 1);
        }
      }
    }

    spawnStageBoss() {
      this.bossSpawned = true;
      const def = this.stageData.def;
      this.boss = {
        isBoss: true,
        name: def.bossName,
        x: WIDTH / 2,
        y: -30,
        targetY: 46,
        hp: def.bossHp,
        maxHp: def.bossHp,
        age: 0,
        flash: 0,
        shellShieldActive: false
      };
      XENON.audio.setBossMode(true);
      this.showBanner(`WARNING: ${def.bossName}`, 'EPOCH GUARDIAN ENGAGED!', 155);
    }

    updateBoss() {
      const b = this.boss;
      if (!b) return;
      b.age++;
      if (b.flash > 0) b.flash--;

      if (b.y < b.targetY) {
        b.y += 0.65;
        return;
      }

      // Epoch-specific Boss movement & attack patterns!
      const rage = b.hp < b.maxHp * 0.45 ? 1.35 : 1.0;

      if (this.stageNum === 4 && b.age % 150 === 0) {
        // MC68000 Cyber-Blitter scanline teleport dash!
        this.spawnSparks(b.x, b.y, 10, RAMP.NASHWAN);
        b.x = 76 + ((b.age * 53) % (WIDTH - 152));
      } else {
        b.x = WIDTH / 2 + Math.sin(b.age * 0.026 * rage) * 86;
        b.y = b.targetY + Math.cos(b.age * 0.04) * 10;
      }

      // Stage 2 Kraken-Nautilus shell shield oscillation
      b.shellShieldActive = this.stageNum === 2 && (Math.floor(b.age / 90) % 2 === 1);

      // Boss Radial & Aimed Bullet Volleys
      const volleyCadence = Math.max(32, Math.floor(56 / rage));
      if (b.age % volleyCadence === 0) {
        const fanCount = 3 + Math.min(4, this.stageNum);
        const baseAng = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        for (let k = 0; k < fanCount; k++) {
          const spread = (k - (fanCount - 1) / 2) * 0.24;
          const a = baseAng + spread;
          this.enemyBullets.push({
            x: b.x + spread * 24,
            y: b.y + 16,
            vx: Math.cos(a) * 2.15,
            vy: Math.sin(a) * 2.15,
            color: k % 2 === 0 ? '#f472b6' : '#38bdf8',
            ttl: 200
          });
        }
        XENON.audio.playLaser('plasma');
      }

      // Stage 5 Sovereign Xenite Mother-Brain & Stage 4 Blitter spawn minions!
      if ((this.stageNum >= 4) && b.age % 190 === 95 && this.enemies.length < 5) {
        this.enemies.push({
          kind: this.stageNum === 4 ? 'blitter_bob' : 'xenite',
          x: b.x,
          y: b.y + 18,
          baseX: b.x,
          vx: 1.2,
          vy: 1.1,
          hp: 30,
          maxHp: 30,
          radius: 8,
          age: 0,
          flash: 0,
          segments: null
        });
      }

      if (Math.hypot(this.player.x - b.x, this.player.y - b.y) < 28) {
        this.damagePlayer(24);
      }
    }

    damageTarget(target, rawDmg, weaponKind) {
      let dmg = rawDmg;
      // Crispin's Boss Weakness Intel grants +25% bonus crit damage against current Boss!
      if (target.isBoss && this.player.bossIntelStage === this.stageNum) {
        dmg = Math.ceil(dmg * 1.25);
      }
      // Stage 3 Clockwork Boss takes extra damage from Electro-Arc!
      if (target.isBoss && this.stageNum === 3 && weaponKind === 'electro') {
        dmg = Math.ceil(dmg * 1.35);
      }

      target.hp -= dmg;
      target.flash = 3;
      this.spawnSparks(target.x, target.y, 2, RAMP.FIRE);

      if (target.hp > 0) return;

      if (target.isBoss) {
        // BOSS DEFEATED!!
        this.shakeTimer = 35;
        XENON.audio.playExplosion(3.0);
        XENON.audio.setBossMode(false);
        this.score += 5000 * this.stageNum;

        for (let k = 0; k < 10; k++) {
          this.spawnCashBubble(
            target.x + (Math.random() - 0.5) * 60,
            target.y + (Math.random() - 0.5) * 32,
            k < 3 ? 250 : 75,
            k < 3 ? 3 : 2
          );
        }
        for (let p = 0; p < 42; p++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 0.8 + Math.random() * 3.8;
          this.particles.push({
            x: target.x,
            y: target.y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: 40,
            maxLife: 40,
            ramp: p % 2 === 0 ? RAMP.FIRE : RAMP.NASHWAN
          });
        }

        this.boss = null;
        this.enemyBullets = [];
        this.showBanner(`${target.name} DESTROYED!`, `+${5000 * this.stageNum} PTS — COLLECT CASH BUBBLES!`, 160);

        // Give player 2.5 seconds to scoop the Boss Cash Bubble shower before docking at Crispin's Shop!
        setTimeout(() => {
          if (this.state !== 'playing') return;
          if (this.stageNum >= 5) {
            this.state = 'victory';
          } else {
            this.pendingStageAdvance = true;
            this.shop.open('stageclear');
          }
        }, 2400);
        return;
      }

      // Normal Enemy Destroyed -> Drop Xenon 2 Cash Bubbles!
      const idx = this.enemies.indexOf(target);
      if (idx >= 0) this.enemies.splice(idx, 1);

      this.score += target.kind === 'serpent' ? 600 : 120;
      XENON.audio.playExplosion(0.8);
      this.spawnSparks(target.x, target.y, 9, RAMP.FIRE);

      if (target.kind === 'serpent') {
        this.spawnCashBubble(target.x, target.y, 250, 3);
      } else if (target.kind === 'bomber') {
        this.spawnCashBubble(target.x, target.y, 75, 2);
      } else if (Math.random() < 0.68) {
        const big = Math.random() < 0.22;
        this.spawnCashBubble(target.x, target.y, big ? 75 : 25, big ? 2 : 1);
      }
    }

    spawnCashBubble(x, y, value, tier = 1) {
      this.pickups.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 0.65,
        value,
        tier,
        worldSpace: false,
        bobPhase: Math.random() * 6.28
      });
    }

    updatePickups() {
      const p = this.player;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        pk.bobPhase += 0.1;

        let sx = pk.x;
        let sy = pk.y;
        if (pk.worldSpace) {
          sy = pk.y - this.cameraY;
        } else {
          pk.x += pk.vx + Math.sin(pk.bobPhase) * 0.25;
          pk.y += pk.vy + (this.reverseThrustActive ? -1.1 : 0);
          sx = pk.x;
          sy = pk.y;
          // Gentle magnet pull when Megablaster gets close!
          const dist = Math.hypot(p.x - sx, p.y - sy);
          if (dist < 46 && dist > 1) {
            pk.x += ((p.x - sx) / dist) * 1.9;
            pk.y += ((p.y - sy) / dist) * 1.9;
          }
          if (sy > HEIGHT + 24) {
            this.pickups.splice(i, 1);
            continue;
          }
        }

        if (Math.hypot(p.x - sx, p.y - sy) < 15) {
          p.credits += pk.value;
          p.chrono = Math.min(p.maxChrono, p.chrono + 10);
          this.score += pk.value * 2;
          this.addFloatingText(sx, sy - 6, `+${pk.value} CR`, PALETTE[RAMP.EMERALD + 14]);
          XENON.audio.playCashPickup(pk.tier);
          this.pickups.splice(i, 1);
          this.updateCabinetHUD();
        }
      }
    }

    updateEnemyBullets() {
      const p = this.player;
      const drones = this.getDronePositions();

      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        eb.ttl--;
        eb.x += eb.vx;
        eb.y += eb.vy + (this.reverseThrustActive ? -0.9 : 0);

        if (
          eb.ttl <= 0 ||
          eb.x < -8 || eb.x > WIDTH + 8 ||
          eb.y < -8 || eb.y > HEIGHT + 8 ||
          this.getTileAtWorld(eb.x, eb.y + this.cameraY) !== TILE.EMPTY
        ) {
          this.enemyBullets.splice(i, 1);
          continue;
        }

        // Orbiting Electro-Drones block enemy bullets!
        let blocked = false;
        for (const dp of drones) {
          if (Math.hypot(eb.x - dp.x, eb.y - dp.y) < 8) {
            this.spawnSparks(dp.x, dp.y, 4, RAMP.CYAN);
            this.enemyBullets.splice(i, 1);
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        if (Math.hypot(eb.x - p.x, eb.y - p.y) < 7) {
          this.enemyBullets.splice(i, 1);
          this.damagePlayer(14);
        }
      }
    }

    damagePlayer(rawDmg) {
      const p = this.player;
      if (p.invuln > 0 || p.nashwanTimer > 0) return;

      const mult = p.loadout.hull === 'hull_plating' ? 0.75 : 1.0;
      let dmg = Math.ceil(rawDmg * mult);

      if (p.shield > 0) {
        const absorbed = Math.min(p.shield, dmg);
        p.shield -= absorbed;
        dmg -= absorbed;
      }
      p.hp = Math.max(0, p.hp - dmg);
      p.invuln = 36;
      this.shakeTimer = 12;
      this.spawnSparks(p.x, p.y, 10, RAMP.CYAN);
      XENON.audio.playExplosion(0.9);
      this.updateCabinetHUD();

      if (p.hp <= 0) {
        this.state = 'gameover';
      }
    }

    spawnSparks(x, y, count, ramp = RAMP.FIRE) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 2.4;
        this.particles.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 14 + ((Math.random() * 10) | 0),
          maxLife: 24,
          ramp
        });
      }
    }

    addFloatingText(x, y, text, col) {
      this.floatingTexts.push({ x, y, text, col, life: 42 });
    }

    updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 0.45;
        ft.life--;
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }
    }

    updateLightningArcs() {
      for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
        this.lightningArcs[i].ttl--;
        if (this.lightningArcs[i].ttl <= 0) this.lightningArcs.splice(i, 1);
      }
    }

    // =========================================================================
    // 320x200 VGA MODE 13h SOFTWARE FRAMEBUFFER RENDERING
    // =========================================================================
    render() {
      const fb = this.fb;

      if (this.state === 'title') {
        this.renderTitleScreen(fb);
        fb.present(0, 0);
        return;
      }

      // 1. Deep Epoch Parallax Backdrop + Mid-Layer Parallax Pillars/Copper Bars
      this.renderParallaxBackground(fb);

      // 2. Foreground Cavern Walls & Destructible Bottlenecks
      this.renderCavernTiles(fb);

      // 3. Cash Bubbles & Static Alcove Treasures
      this.renderPickups(fb);

      // 4. Biomechanical Enemies & Multi-Part Epoch Boss
      this.renderEnemiesAndBoss(fb);

      // 5. Player Megablaster + Real-Time Bolted-On Hardpoints & Orbiting Drones!
      if (this.state !== 'gameover') {
        const bank = this.player.vx < -0.6 ? -1 : (this.player.vx > 0.6 ? 1 : 0);
        if (this.player.invuln % 4 < 3) {
          this.renderShipSpriteAt(fb, this.player.x, this.player.y, bank, this.tick, false);
        }
      }

      // 6. Player & Enemy Projectiles, Prism Beams, Tesla Chain Lightning & Sparks
      this.renderProjectilesAndFX(fb);

      // 7. In-Canvas VGA Top/Bottom Bitmap Brothers Micro-HUD & Banners
      this.renderInCanvasHUD(fb);

      // 8. Chrono-Reverse VHS / Copper-Bar Temporal Scanline Warp!
      if (this.chronoRewindActive) {
        fb.applyChronoWarp(this.tick);
        fb.drawBevelBox(76, 22, 168, 16, RAMP.NASHWAN);
        const secsLeft = (this.player.chrono / 60).toFixed(1);
        fb.drawTextCentered(`<< CHRONO REWIND ${secsLeft}S`, 27, PALETTE[15], PALETTE[RAMP.CYAN + 13]);
      }

      const sx = this.shakeTimer > 0 ? ((Math.random() - 0.5) * 4) | 0 : 0;
      const sy = this.shakeTimer > 0 ? ((Math.random() - 0.5) * 4) | 0 : 0;
      fb.present(sx, sy);
    }

    renderParallaxBackground(fb) {
      const def = this.stageData.def;
      const cam = this.cameraY;

      // Base dithered vertical cavern depth gradient
      for (let y = 0; y < HEIGHT; y++) {
        if (this.stageNum === 4) {
          // Stage 4 Demoscene: Rolling Amiga Raster Copper Bars + Vector Horizon!
          const copperWave = Math.sin((y * 0.055) - this.tick * 0.06) + Math.sin(y * 0.02 + this.tick * 0.03);
          if (Math.abs(copperWave) < 0.24) {
            const cIdx = Math.min(15, Math.floor((1 - Math.abs(copperWave) / 0.24) * 13));
            fb.hline(0, y, WIDTH, PALETTE[RAMP.NASHWAN + (cIdx >> 1)]);
          } else {
            fb.hline(0, y, WIDTH, PALETTE[RAMP.SILICON + ((y >> 5) & 1)]);
          }
        } else {
          const shade = 0.03 + ((y / HEIGHT) * 0.09);
          fb.hline(0, y, WIDTH, sampleRamp(def.bgRamp, 16, shade, 0, y, 0.4));
        }
      }

      // Deep Star / Spore / Bubble Dust Layer (0.25x scroll)
      for (const s of this.bgStars) {
        fb.pset(s.x, s.y, PALETTE[def.midRamp + s.bright]);
      }

      // Mid-Layer Parallax Architecture (0.45x camera scroll): Fossil Pillars / Giant Brass Cogs / Bio-Ribs
      const midScroll = Math.floor(cam * 0.45);
      for (let py = 0; py < HEIGHT; py += 2) {
        const wy = py + midScroll;
        if (this.stageNum === 3) {
          // Distant rotating clockwork gear silhouettes
          const gy = ((wy % 64) + 64) % 64 - 32;
          const rL = Math.hypot(54 - 36, gy);
          const rR = Math.hypot(266 - 284, gy);
          if (Math.abs(rL - 22) < 4 || Math.abs(rR - 22) < 4) {
            fb.hline(34, py, 32, PALETTE[RAMP.BRASS + 2]);
            fb.hline(254, py, 32, PALETTE[RAMP.BRASS + 2]);
          }
        } else if (this.stageNum === 4) {
          // Golden PCB circuit grid lines
          if (wy % 24 === 0) fb.hline(28, py, WIDTH - 56, PALETTE[RAMP.SILICON + 3]);
        } else if (this.stageNum === 5) {
          // Giger biomechanical spine ribs arching across background!
          const rib = Math.sin(wy * 0.14);
          if (rib > 0.55) {
            fb.hline(48, py, 224, PALETTE[RAMP.BONE + 2]);
          }
        } else {
          // Prehistoric strata & abyssal cavern arches
          const arch = Math.sin(wy * 0.09) * 18;
          fb.hline(32, py, Math.max(0, (24 + arch) | 0), PALETTE[def.bgRamp + 2]);
          fb.hline(WIDTH - 56, py, Math.max(0, (24 - arch) | 0), PALETTE[def.bgRamp + 2]);
        }
      }
    }

    renderCavernTiles(fb) {
      const tset = EPOCH_TILES[this.stageNum - 1] || EPOCH_TILES[0];
      const cols = this.stageData.cols;
      const rStart = Math.max(0, Math.floor(this.cameraY / 8));
      const rEnd = Math.min(this.stageData.rows - 1, Math.floor((this.cameraY + HEIGHT) / 8) + 1);

      for (let r = rStart; r <= rEnd; r++) {
        const dy = (r * 8) - Math.round(this.cameraY);
        const rowOff = r * cols;
        for (let c = 0; c < cols; c++) {
          const t = this.stageData.tiles[rowOff + c];
          if (t === TILE.EMPTY) continue;
          const dx = c * 8;
          if (t === TILE.SOLID) {
            fb.blitTile8(tset.solid, dx, dy);
          } else if (t === TILE.EDGE) {
            fb.blitTile8(tset.edge, dx, dy);
          } else if (t === TILE.DESTRUCT) {
            const hp = this.stageData.tileHP[rowOff + c];
            fb.blitTile8(hp < 18 ? tset.destructCracked : tset.destructIntact, dx, dy);
          } else {
            fb.blitTile8(tset.hazard, dx, dy, (this.tick & 15) === 0);
          }
        }
      }
    }

    // Renders "The Megablaster" with EVERY bolted-on hardpoint visibly rendered in real time!
    renderShipSpriteAt(fb, cx, cy, bank = 0, animTick = 0, isShopPreview = false) {
      const p = this.player;
      const lo = p.loadout;
      const nashwan = p.nashwanTimer > 0;
      const rainbowSeed = nashwan ? ((animTick >> 1) | 1) : 0;

      // 1. Engine Thruster Plumes (upgraded twin/golden plumes for Twin Thrusters or Chrono-Capacitor!)
      const flameLen = 5 + ((animTick * 3) % 6) + (lo.hull === 'twin_thrusters' ? 5 : 0);
      if (!this.reverseThrustActive || isShopPreview) {
        fb.drawGlowLine(cx - 4, cy + 10, cx - 4, cy + 10 + flameLen, 40, 190, 255);
        fb.drawGlowLine(cx + 4, cy + 10, cx + 4, cy + 10 + flameLen, 40, 190, 255);
        if (lo.hull === 'twin_thrusters' || lo.hull === 'chrono_capacitor' || nashwan) {
          fb.drawGlowLine(cx, cy + 11, cx, cy + 12 + flameLen, 255, 190, 60);
        }
      } else {
        // Forward-firing retro-braking jets when Reverse Scroll Thrust is active!
        fb.drawGlowLine(cx - 8, cy - 4, cx - 10, cy - 11 - (animTick & 3), 255, 150, 40);
        fb.drawGlowLine(cx + 8, cy - 4, cx + 10, cy - 11 - (animTick & 3), 255, 150, 40);
      }

      // 2. Rear Tailgun Hardpoint (bolted aft of engine!)
      if (lo.rearTail && SPRITES[WEAPONS.CATALOG[lo.rearTail].sprite]) {
        fb.blitSprite(SPRITES[WEAPONS.CATALOG[lo.rearTail].sprite], cx, cy + 12, { rainbow: rainbowSeed });
      }

      // 3. Left Wing Pod & Right Wing Pod Hardpoints!
      if (lo.leftWing && WEAPONS.CATALOG[lo.leftWing]) {
        fb.blitSprite(SPRITES[WEAPONS.CATALOG[lo.leftWing].sprite], cx - 12, cy + 2, { rainbow: rainbowSeed });
      }
      if (lo.rightWing && WEAPONS.CATALOG[lo.rightWing]) {
        fb.blitSprite(SPRITES[WEAPONS.CATALOG[lo.rightWing].sprite], cx + 12, cy + 2, { flipX: true, rainbow: rainbowSeed });
      }

      // 4. Core Megablaster Chrome Fuselage + Hull Upgrade Overlay
      const hullSpr = bank < 0 ? SPRITES.ship_left : (bank > 0 ? SPRITES.ship_right : SPRITES.ship_center);
      fb.blitSprite(hullSpr, cx, cy, { rainbow: rainbowSeed });

      if (lo.hull === 'hull_plating') {
        fb.blitSprite(SPRITES.hull_plating, cx, cy);
      } else if (lo.hull === 'chrono_capacitor' || lo.hull === 'twin_thrusters') {
        fb.blitSprite(SPRITES.hull_chrono, cx, cy);
      }

      // 5. Nose Cannon Hardpoint (bolted onto forward prow!)
      if (lo.nose && WEAPONS.CATALOG[lo.nose]) {
        fb.blitSprite(SPRITES[WEAPONS.CATALOG[lo.nose].sprite], cx, cy - 12, { rainbow: rainbowSeed });
      }

      // 6. Orbiting Electro-Drones + Glowing Tether!
      const droneMode = nashwan ? 'dual_drones' : lo.drones;
      if (droneMode) {
        const ang = animTick * 0.075;
        const count = droneMode === 'dual_drones' ? 2 : 1;
        const spr = droneMode === 'dual_drones' ? SPRITES.drone_tesla : SPRITES.drone_scout;
        for (let d = 0; d < count; d++) {
          const da = ang + d * Math.PI;
          const dx = cx + Math.cos(da) * 21;
          const dy = cy + Math.sin(da) * 18;
          fb.drawLine(cx, cy, dx, dy, PALETTE[RAMP.CYAN + 6]);
          fb.blitSprite(spr, dx, dy, { rainbow: rainbowSeed });
        }
      }

      // Live demo bolts inside Crispin's Paper-Doll schematic!
      if (isShopPreview && (animTick % 18 < 9)) {
        if (lo.nose) fb.drawGlowLine(cx, cy - 17, cx, 42, 90, 220, 255);
        if (lo.leftWing) fb.drawGlowLine(cx - 12, cy - 5, cx - 12, 46, 240, 100, 250);
        if (lo.rightWing) fb.drawGlowLine(cx + 12, cy - 5, cx + 12, 46, 80, 240, 140);
        if (lo.rearTail) fb.drawGlowLine(cx, cy + 17, cx, 162, 190, 120, 255);
      }
    }

    renderPickups(fb) {
      for (const pk of this.pickups) {
        const sy = pk.worldSpace ? (pk.y - this.cameraY) : pk.y;
        if (sy < -16 || sy > HEIGHT + 16) continue;
        const spr = pk.tier >= 3 ? SPRITES.cash_large : (pk.tier === 2 ? SPRITES.cash_med : SPRITES.cash_small);
        fb.blitSprite(spr, pk.x, sy);
      }
    }

    renderEnemiesAndBoss(fb) {
      const spriteMap = {
        trilobite: SPRITES.enemy_trilobite,
        ammonite: SPRITES.enemy_ammonite,
        turret: SPRITES.enemy_turret,
        squid: SPRITES.enemy_squid,
        orthoceras: SPRITES.enemy_orthoceras,
        mine: SPRITES.enemy_mine,
        cog: SPRITES.enemy_cog,
        bomber: SPRITES.enemy_bomber,
        blitter_bob: SPRITES.enemy_blitter_bob,
        glenz: SPRITES.enemy_glenz,
        xenite: SPRITES.enemy_xenite,
        serpent: SPRITES.serpent_head
      };

      for (const e of this.enemies) {
        if (e.segments) {
          for (let s = e.segments.length - 1; s >= 0; s--) {
            fb.blitSprite(SPRITES.serpent_seg, e.segments[s].x, e.segments[s].y);
          }
        }
        const spr = spriteMap[e.kind] || SPRITES.enemy_trilobite;
        fb.blitSprite(spr, e.x, e.y, { flash: e.flash > 0 });
      }

      if (this.boss) {
        const b = this.boss;
        const bSpr = SPRITES['boss_' + this.stageNum] || SPRITES.boss_1;
        fb.blitSprite(bSpr, b.x, b.y, { flash: b.flash > 0 });

        // Visual indicator for Kraken-Nautilus Shell Deflection or Crispin Boss Weakpoint Reticle!
        if (b.shellShieldActive) {
          fb.drawPlasmaOrb(b.x, b.y + 4, 20, 40, 180, 255);
        } else if (this.player.bossIntelStage === this.stageNum && (this.tick & 7) < 5) {
          // Crispin's Boss Weakpoint Targeting Reticle!
          fb.hline(b.x - 7, b.y + 2, 15, PALETTE[RAMP.FIRE + 14]);
          fb.vline(b.x, b.y - 5, 15, PALETTE[RAMP.FIRE + 14]);
        }
      }
    }

    renderProjectilesAndFX(fb) {
      // Player projectiles
      for (const b of this.bullets) {
        if (b.kind === 'bounce_orb') {
          fb.blitSprite(SPRITES.proj_bounce_orb, b.x, b.y);
          fb.drawPlasmaOrb(b.x, b.y, 5.5, 40, 220, 110);
        } else if (b.kind === 'mine') {
          fb.blitSprite(SPRITES.proj_mine, b.x, b.y);
          fb.drawPlasmaOrb(b.x, b.y, 5, 200, 80, 255);
        } else if (b.kind === 'plasma') {
          fb.drawPlasmaOrb(b.x, b.y, 4.8, 255, 80, 210);
        } else if (b.kind === 'laser' || b.kind === 'prism') {
          const isBlue = b.color === '#38bdf8';
          const isGreen = b.color === '#4ade80';
          fb.drawGlowLine(
            b.x,
            b.y,
            b.x - b.vx * 1.8,
            b.y - b.vy * 1.8,
            isBlue ? 60 : (isGreen ? 70 : 255),
            isBlue ? 210 : (isGreen ? 245 : 75),
            isBlue ? 255 : (isGreen ? 130 : 220)
          );
        } else if (b.kind === 'missile') {
          fb.fillRect(b.x - 1, b.y - 3, 3, 6, PALETTE[14]);
          fb.psetAdd(b.x, b.y + 3, 255, 140, 40);
        } else {
          fb.fillRect(b.x - 1, b.y - 3, 2, 5, PALETTE[RAMP.CYAN + 14]);
          fb.psetAdd(b.x, b.y, 120, 220, 255);
        }
      }

      // Electro-Arc & Tesla Chain Swarm Jagged Lightning Bolts!
      for (const arc of this.lightningArcs) {
        const mx = (arc.x0 + arc.x1) * 0.5 + (Math.random() - 0.5) * 12;
        const my = (arc.y0 + arc.y1) * 0.5 + (Math.random() - 0.5) * 12;
        const r = arc.cyan ? 70 : 240;
        const g = arc.cyan ? 225 : 140;
        const bl = 255;
        fb.drawGlowLine(arc.x0, arc.y0, mx, my, r, g, bl);
        fb.drawGlowLine(mx, my, arc.x1, arc.y1, r, g, bl);
      }

      // Enemy bullets
      for (const eb of this.enemyBullets) {
        fb.drawPlasmaOrb(eb.x, eb.y, 3.4, 255, 65, 95);
      }

      // Explosions & Debris Sparks
      for (const pt of this.particles) {
        const t = pt.life / pt.maxLife;
        fb.fillRect(pt.x, pt.y, t > 0.5 ? 2 : 1, t > 0.5 ? 2 : 1, PALETTE[pt.ramp + Math.min(15, Math.floor(t * 15))]);
      }

      // Floating +CR & Synergy Pixel Popups
      for (const ft of this.floatingTexts) {
        fb.drawText(ft.text, ft.x - 14, ft.y, ft.col);
      }
    }

    renderInCanvasHUD(fb) {
      const p = this.player;
      // Sleek top chrome bar (12px tall)
      fb.drawBevelBox(0, 0, WIDTH, 12, RAMP.CHROME);

      // Hull Bar
      fb.drawText('HULL', 4, 3, PALETTE[13]);
      fb.fillRect(26, 3, 44, 5, PALETTE[0]);
      const hpW = Math.round((p.hp / p.maxHp) * 42);
      fb.fillRect(27, 4, hpW, 3, PALETTE[(p.hp < 30 ? RAMP.CORAL : RAMP.EMERALD) + 12]);

      // Chrono Rewind Gauge
      fb.drawText('CHR', 75, 3, PALETTE[RAMP.CYAN + 13]);
      fb.fillRect(92, 3, 36, 5, PALETTE[0]);
      const chW = Math.round((p.chrono / p.maxChrono) * 34);
      fb.fillRect(93, 4, chW, 3, PALETTE[RAMP.CYAN + 12]);

      // Credits & Stage
      fb.drawText(`CR:${p.credits}`, 134, 3, PALETTE[RAMP.BRASS + 14]);
      fb.drawText(`EP:${this.stageNum}/5`, 196, 3, PALETTE[14]);
      fb.drawText(`${String(this.score).padStart(6, '0')}`, 280, 3, PALETTE[15]);

      // Boss HP Bar at bottom when fighting Epoch Guardian!
      if (this.boss) {
        fb.drawBevelBox(36, HEIGHT - 13, WIDTH - 72, 11, RAMP.CORAL);
        const bw = Math.max(0, Math.round((this.boss.hp / this.boss.maxHp) * (WIDTH - 78)));
        fb.fillRect(39, HEIGHT - 10, bw, 5, PALETTE[RAMP.FIRE + 12]);
        fb.drawTextCentered(this.boss.name, HEIGHT - 10, PALETTE[15]);
      } else if (this.reverseThrustActive) {
        fb.drawBevelBox(82, HEIGHT - 14, 156, 11, RAMP.BRASS);
        fb.drawTextCentered('<< REVERSE SCROLL THRUST >>', HEIGHT - 11, PALETTE[RAMP.BRASS + 15]);
      } else if (this.deadEndWarning && (this.tick & 16) === 0) {
        fb.drawBevelBox(44, HEIGHT - 14, 232, 11, RAMP.CORAL);
        fb.drawTextCentered('CUL-DE-SAC! HOLD [DOWN/S] TO BACK OUT!', HEIGHT - 11, PALETTE[15]);
      }

      // Super Nashwan Overdrive Banner!
      if (p.nashwanTimer > 0) {
        const nSecs = (p.nashwanTimer / 60).toFixed(1);
        const cCol = PALETTE[160 + ((this.tick * 3) & 63)];
        fb.drawTextCentered(`* SUPER NASHWAN OVERDRIVE ${nSecs}S *`, 15, cCol);
      }

      // Epoch Title Banner (shifts below Boss arena when Guardian is onscreen so Boss is unobstructed!)
      if (this.BannerTimer > 0 && p.nashwanTimer <= 0) {
        const by = this.boss ? 76 : 26;
        fb.drawBevelBox(28, by, WIDTH - 56, 24, RAMP.STEEL);
        fb.drawTextCentered(this.bannerTitle, by + 4, PALETTE[15], PALETTE[RAMP.BRASS + 13]);
        fb.drawTextCentered(this.bannerSub, by + 13, PALETTE[RAMP.CYAN + 13]);
      }

      // Game Over Overlay (with Chrono-Rewind Rescue option!)
      if (this.state === 'gameover') {
        fb.drawBevelBox(36, 68, WIDTH - 72, 64, RAMP.CORAL);
        fb.drawTextCentered('MEGABLASTER DESTROYED', 76, PALETTE[15], PALETTE[RAMP.FIRE + 12], 2);
        if (p.chrono > 15 && this.chronoBuffer.length > 5) {
          fb.drawTextCentered('HOLD [R / SHIFT / R-CLICK] CHRONO RESCUE!', 98, PALETTE[RAMP.CYAN + 14]);
        }
        fb.drawTextCentered('PRESS [ENTER / CLICK] NEW MISSION', 112, PALETTE[RAMP.BRASS + 14]);
      }

      // Victory Screen!
      if (this.state === 'victory') {
        fb.drawBevelBox(24, 52, WIDTH - 48, 92, RAMP.BRASS);
        fb.drawTextCentered('TIMELINE SAVED!', 62, PALETTE[15], PALETTE[RAMP.BRASS + 13], 2);
        fb.drawTextCentered('XENITE MOTHER-BRAIN OBLITERATED', 84, PALETTE[RAMP.EMERALD + 14]);
        fb.drawTextCentered(`FINAL SCORE: ${this.score} PTS`, 98, PALETTE[15]);
        fb.drawTextCentered(`CREDITS BANKED: ${p.credits} CR`, 110, PALETTE[RAMP.CYAN + 13]);
        fb.drawTextCentered('CLICK OR PRESS [ENTER] TO PLAY AGAIN', 126, PALETTE[RAMP.NASHWAN + 14]);
      }
    }

    renderTitleScreen(fb) {
      fb.clear(PALETTE[0]);

      // Rolling Amiga Demoscene Copper Bars!
      for (let y = 0; y < HEIGHT; y++) {
        const bar1 = Math.sin(y * 0.05 - this.tick * 0.055);
        const bar2 = Math.cos(y * 0.035 + this.tick * 0.04);
        if (bar1 > 0.72) {
          const i = Math.min(15, Math.floor((bar1 - 0.72) * 52));
          fb.hline(0, y, WIDTH, PALETTE[RAMP.CYAN + i]);
        } else if (bar2 > 0.76) {
          const i = Math.min(15, Math.floor((bar2 - 0.76) * 60));
          fb.hline(0, y, WIDTH, PALETTE[RAMP.NASHWAN + i]);
        } else {
          fb.hline(0, y, WIDTH, sampleRamp(RAMP.STEEL, 16, 0.04 + (y / HEIGHT) * 0.12, 0, y, 0.5));
        }
      }

      for (const s of this.bgStars) {
        fb.pset(s.x, s.y, PALETTE[12]);
      }

      // Metallic Bitmap Brothers Logo Plate
      fb.drawBevelBox(22, 18, WIDTH - 44, 54, RAMP.CHROME);
      fb.drawTextCentered('XENON II', 25, PALETTE[15], PALETTE[RAMP.CHROME + 9], 3);
      fb.drawTextCentered('MEGABLAST: EVOLUTION & TRACKER ODYSSEY', 50, PALETTE[RAMP.BRASS + 14]);
      fb.drawTextCentered('VGA MODE 13H  *  8-CH BOMB THE BASS SYNTH', 60, PALETTE[RAMP.CYAN + 13]);

      // Showcase Flyby of Fully Upgraded Megablaster!
      const sx = WIDTH / 2 + Math.sin(this.tick * 0.04) * 52;
      const sy = 114 + Math.cos(this.tick * 0.06) * 8;
      const bank = Math.cos(this.tick * 0.04) > 0.35 ? 1 : (Math.cos(this.tick * 0.04) < -0.35 ? -1 : 0);
      this.renderShipSpriteAt(fb, sx, sy, bank, this.tick, false);

      // Feature Callout Box
      fb.drawBevelBox(26, 146, WIDTH - 52, 44, RAMP.STEEL);
      if ((this.tick & 31) < 24) {
        fb.drawTextCentered('CLICK OR PRESS [SPACE / ENTER] TO START!', 153, PALETTE[15], PALETTE[RAMP.EMERALD + 13]);
      }
      fb.drawTextCentered('[B] CRISPIN SHOP   [T] 8-CH TRACKER   [1-5] WARP', 166, PALETTE[RAMP.BRASS + 13]);
      fb.drawTextCentered('[R/SHIFT] 3S CHRONO REWIND   [DOWN/S] REV THRUST', 177, PALETTE[RAMP.CYAN + 12]);
    }

    // Updates external Arcade Cabinet Telemetry & Golden Synergy Badges
    updateCabinetHUD() {
      const p = this.player;
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      const setBar = (id, pct) => {
        const el = document.getElementById(id);
        if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
      };

      setTxt('hud-hull-val', `${Math.ceil(p.hp)}/${p.maxHp}`);
      setBar('hud-hull-bar', (p.hp / p.maxHp) * 100);

      setTxt('hud-shield-val', `${Math.floor(p.shield)}/${p.maxShield}`);
      setBar('hud-shield-bar', (p.shield / p.maxShield) * 100);

      setTxt('hud-chrono-val', `${(p.chrono / 60).toFixed(1)}s`);
      setBar('hud-chrono-bar', (p.chrono / p.maxChrono) * 100);

      setTxt('hud-credits', `${p.credits} CR`);
      setTxt('hud-score', String(this.score).padStart(7, '0'));
      setTxt('hud-bombs', `${p.bombs}`);
      setTxt('hud-epoch-title', `${this.stageNum}. ${this.stageData.def.name}`);
      setTxt('hud-epoch-year', this.stageData.def.epochYear);

      const muteBtn = document.getElementById('btn-mute-audio');
      if (muteBtn) muteBtn.textContent = XENON.audio.masterMuted ? 'AUDIO: MUTED [M]' : 'AUDIO: LIVE [M]';

      // ActiveWarp stage highlight
      document.querySelectorAll('[data-warp-stage]').forEach((b) => {
        b.classList.toggle('active', Number(b.getAttribute('data-warp-stage')) === this.stageNum);
      });

      // Live Equipped Hardpoints summary & Golden Synergies on Left Deck
      const rigEl = document.getElementById('hud-hardpoint-list');
      if (rigEl) {
        rigEl.innerHTML = WEAPONS.SLOTS.map((s) => {
          const id = p.loadout[s.id];
          const item = id ? WEAPONS.CATALOG[id] : null;
          return `<div class="rig-row"><span>${s.short}</span><strong>${item ? item.name : '—'}</strong></div>`;
        }).join('');
      }

      const synEl = document.getElementById('hud-synergy-badges');
      if (synEl) {
        const syn = WEAPONS.computeActiveSynergies(p.loadout, p.nashwanTimer > 0);
        if (syn.list.length === 0) {
          synEl.innerHTML = `<div class="hud-syn-empty">Pair Side-Laser+Bounce-Orb, Mines+Rev, or Electro+Dual Drones in Shop [B]!</div>`;
        } else {
          synEl.innerHTML = syn.list.map((s) => `<div class="hud-syn-active">★ ${s.name}</div>`).join('');
        }
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new XenonGame();
    XENON.game = game;
    game.start();
  });
})();
