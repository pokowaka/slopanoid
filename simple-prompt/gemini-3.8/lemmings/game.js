// ============================================================================
// Lemmings: Beat Tribe — Core Game Engine
// Per-pixel Destructible Framebuffer, Lemmings Physics, Rendering, & UI
// ============================================================================

(function(global) {
  'use strict';

  const SCREEN_W = 320;
  const SCREEN_H = 200;
  const PLAY_H = 160;
  const LEVEL_W = 640;
  const LEVEL_H = 160;

  // Material Constants
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

  // World Color Palettes (packed 0xAABBGGRR for Little-Endian Uint32Array)
  function packColor(r, g, b, a = 255) {
    return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
  }

  const PALETTES = {
    1: { // Amiga Chip Garden
      bgTop: packColor(24, 48, 120),
      bgBottom: packColor(72, 144, 216),
      noteColors: [
        packColor(46, 204, 113),  // Emerald Grass
        packColor(39, 174, 96),   // Deep Forest
        packColor(52, 152, 219),  // Sky Cyan Stone
        packColor(241, 196, 15),  // Golden Amber Moss
        packColor(155, 89, 182),  // Floral Violet
        packColor(230, 126, 34),  // Terracotta Earth
        packColor(26, 188, 156)   // Seafoam Mineral
      ],
      steelColor: packColor(127, 140, 141),
      brickColor: packColor(211, 84, 0)
    },
    2: { // Acid Warehouse
      bgTop: packColor(16, 20, 24),
      bgBottom: packColor(32, 44, 38),
      noteColors: [
        packColor(46, 232, 26),   // Neon Toxic Lime
        packColor(244, 208, 63),  // Hazard Yellow
        packColor(231, 76, 60),   // Radioactive Orange
        packColor(142, 68, 173),  // Ultraviolet
        packColor(0, 240, 255),   // Cyber Cyan
        packColor(214, 48, 49),   // Rust Red
        packColor(0, 184, 148)    // Acid Wash
      ],
      steelColor: packColor(99, 110, 114),
      brickColor: packColor(225, 112, 85)
    },
    3: { // Synthwave Sunset
      bgTop: packColor(18, 5, 36),
      bgBottom: packColor(85, 20, 95),
      noteColors: [
        packColor(255, 0, 128),   // Hot Pink
        packColor(0, 243, 255),   // Laser Cyan
        packColor(157, 78, 221),  // Purple Horizon
        packColor(255, 107, 53),  // Sunset Orange
        packColor(255, 214, 10),  // Neon Yellow
        packColor(114, 9, 183),   // Electric Violet
        packColor(67, 97, 238)    // Retro Blue
      ],
      steelColor: packColor(108, 117, 125),
      brickColor: packColor(247, 37, 133)
    },
    4: { // Jungle Breakbeat Caves
      bgTop: packColor(10, 15, 24),
      bgBottom: packColor(20, 40, 35),
      noteColors: [
        packColor(0, 229, 163),   // Bioluminescent Teal
        packColor(118, 255, 3),   // Phosphor Lime
        packColor(179, 136, 255), // Spore Violet
        packColor(255, 171, 0),   // Amber Stalagmite
        packColor(0, 180, 216),   // Deep Spring Blue
        packColor(13, 148, 136),  // Jungle Moss
        packColor(251, 146, 60)   // Fungal Gold
      ],
      steelColor: packColor(71, 85, 105),
      brickColor: packColor(180, 83, 9)
    },
    5: { // Grand Orchestral Finale
      bgTop: packColor(20, 20, 40),
      bgBottom: packColor(50, 45, 75),
      noteColors: [
        packColor(245, 245, 240), // Carrara Marble White
        packColor(255, 215, 0),   // Imperial Gold
        packColor(192, 57, 43),   // Royal Crimson
        packColor(41, 128, 185),  // Imperial Lapis
        packColor(248, 187, 208), // Alabaster Rose
        packColor(189, 195, 199), // Celestial Silver
        packColor(211, 84, 0)     // Antique Bronze
      ],
      steelColor: packColor(120, 144, 156),
      brickColor: packColor(230, 126, 34)
    }
  };

  class BeatTribeGame {
    constructor(canvas, audio) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.audio = audio;

      // Software Framebuffer (320x200)
      this.imgData = this.ctx.createImageData(SCREEN_W, SCREEN_H);
      this.fb32 = new Uint32Array(this.imgData.data.buffer);

      // Level Terrain Buffers (640x160)
      this.mask = new Uint8Array(LEVEL_W * LEVEL_H);
      this.colorMap = new Uint32Array(LEVEL_W * LEVEL_H);
      this.silenceMap = new Uint8Array(LEVEL_W * LEVEL_H);

      // Camera
      this.cameraX = 0;
      this.targetCameraX = 0;

      // Current Level State
      this.currentLevelIndex = 0;
      this.levelDef = null;
      this.lemmings = [];
      this.spawnCount = 0;
      this.totalLemmings = 0;
      this.savedCount = 0;
      this.deadCount = 0;
      this.releaseRate = 50;
      this.spawnTimer = 0;
      this.frame = 0;
      this.timeRemaining = 180;
      this.skills = {};
      this.selectedSkill = 'builder';

      // Attract Demo Playback
      this.isDemoMode = false;
      this.demoIndex = 0;
      this.demoScript = [];

      // Game Flow State: 'TITLE', 'PLAYING', 'PAUSED', 'RESULTS'
      this.gameState = 'TITLE';
      this.isNuking = false;
      this.nukeConfirmTime = 0;
      this.fastForward = false;
      this.isPaused = false;
      this.grooveScore = 0;

      // Mouse & UI Input
      this.mouseX = 0;
      this.mouseY = 0;
      this.isMouseDown = false;
      this.hoverLemming = null;

      // Visual Effects & Particles
      this.particles = [];
      this.floatingTexts = [];
      this.sonicRings = [];

      // Idle Timer for Title Attract Mode
      this.titleIdleFrames = 0;

      // CRT Scanline Filter Toggle
      this.crtEnabled = true;

      this.setupInput();
    }

    setupInput() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = SCREEN_W / rect.width;
        const scaleY = SCREEN_H / rect.height;
        return {
          x: Math.floor((e.clientX - rect.left) * scaleX),
          y: Math.floor((e.clientY - rect.top) * scaleY)
        };
      };

      this.canvas.addEventListener('mousemove', (e) => {
        const p = getPos(e);
        this.mouseX = p.x;
        this.mouseY = p.y;
        this.titleIdleFrames = 0;

        // Minimap drag
        if (this.isMouseDown && this.mouseY >= 165 && this.mouseY <= 195 && this.mouseX >= 240 && this.mouseX <= 315) {
          const miniX = (this.mouseX - 240) / 75.0;
          this.targetCameraX = Math.max(0, Math.min(LEVEL_W - SCREEN_W, miniX * LEVEL_W - SCREEN_W / 2));
        }
      });

      this.canvas.addEventListener('mousedown', (e) => {
        const p = getPos(e);
        this.mouseX = p.x;
        this.mouseY = p.y;
        this.isMouseDown = true;
        this.titleIdleFrames = 0;

        if (this.audio && !this.audio.isInitialized) {
          this.audio.init();
        }

        if (this.gameState === 'TITLE') {
          this.startLevel(0);
          return;
        }

        if (this.gameState === 'RESULTS') {
          if (p.y >= 160) {
            // Next Level or Retry
            if (p.x < 160) {
              this.startLevel(this.currentLevelIndex);
            } else {
              this.startLevel((this.currentLevelIndex + 1) % global.BEAT_TRIBE_LEVELS.length);
            }
          }
          return;
        }

        // Click Bottom Panel UI
        if (p.y >= 160) {
          this.handleBottomPanelClick(p.x, p.y);
          return;
        }

        // Click on Lemming in Playfield
        if (p.y < 160 && this.hoverLemming !== null) {
          this.assignSkillToLemming(this.hoverLemming, this.selectedSkill);
        }
      });

      window.addEventListener('mouseup', () => {
        this.isMouseDown = false;
      });

      window.addEventListener('keydown', (e) => {
        this.titleIdleFrames = 0;
        const key = e.key.toLowerCase();

        if (this.audio && !this.audio.isInitialized) {
          this.audio.init();
        }

        if (this.gameState === 'TITLE') {
          if (key === 'enter' || key === ' ') {
            this.startLevel(0);
          } else if (key === 'd') {
            this.startDemo(this.currentLevelIndex);
          } else if (key === 'c') {
            this.toggleCRT();
          }
          return;
        }

        if (key === '1') this.selectSkill('climber');
        if (key === '2') this.selectSkill('floater');
        if (key === '3') this.selectSkill('bomber');
        if (key === '4') this.selectSkill('blocker');
        if (key === '5') this.selectSkill('builder');
        if (key === '6') this.selectSkill('basher');
        if (key === '7') this.selectSkill('miner');
        if (key === '8') this.selectSkill('digger');

        if (key === 'p') this.togglePause();
        if (key === 'f') this.toggleFastForward();
        if (key === 'n') this.triggerNuke();
        if (key === 'd') this.startDemo(this.currentLevelIndex);
        if (key === 'm') this.audio.toggleMute();
        if (key === 'c') this.toggleCRT();
        if (key === '-' || key === '_') this.adjustReleaseRate(-5);
        if (key === '+' || key === '=') this.adjustReleaseRate(5);
        if (key === 'escape') this.gameState = 'TITLE';

        if (key === 'arrowleft' || key === 'a') this.targetCameraX = Math.max(0, this.targetCameraX - 30);
        if (key === 'arrowright') this.targetCameraX = Math.min(LEVEL_W - SCREEN_W, this.targetCameraX + 30);
      });
    }

    toggleCRT() {
      this.crtEnabled = !this.crtEnabled;
      const overlay = document.getElementById('crtOverlay');
      if (overlay) {
        overlay.style.display = this.crtEnabled ? 'block' : 'none';
      }
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        if (this.audio) this.audio.stopTracker();
      } else {
        if (this.audio) this.audio.startTracker();
      }
    }

    toggleFastForward() {
      this.fastForward = !this.fastForward;
      if (this.audio) this.audio.setFastForward(this.fastForward);
    }

    triggerNuke() {
      const now = Date.now();
      if (now - this.nukeConfirmTime > 2500) {
        this.nukeConfirmTime = now;
        this.addFloatingText('DOUBLE CLICK NUKE TO CONFIRM!', SCREEN_W / 2, 80, '#ff3333');
        return;
      }
      this.isNuking = true;
      this.addFloatingText('ALL LEMMINGS NUKED!', SCREEN_W / 2, 80, '#ffcc00');
      // Assign bomber to every living lemming staggered
      this.lemmings.forEach((lem, idx) => {
        if (lem.state !== 'DEAD' && lem.state !== 'EXITING') {
          lem.countdown = 60 + idx * 5;
        }
      });
    }

    selectSkill(skillName) {
      this.selectedSkill = skillName;
    }

    adjustReleaseRate(delta) {
      this.releaseRate = Math.max(1, Math.min(99, this.releaseRate + delta));
    }

    handleBottomPanelClick(x, y) {
      // Release Rate - / +
      if (x >= 8 && x <= 22 && y >= 170 && y <= 190) this.adjustReleaseRate(-5);
      if (x >= 42 && x <= 56 && y >= 170 && y <= 190) this.adjustReleaseRate(5);

      // Skills: 8 slots between x=64 and x=208
      const skills = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
      for (let i = 0; i < skills.length; i++) {
        const sx = 64 + i * 18;
        if (x >= sx && x <= sx + 16 && y >= 165 && y <= 195) {
          this.selectSkill(skills[i]);
          return;
        }
      }

      // Pause button
      if (x >= 210 && x <= 218) this.togglePause();
      // Fast forward
      if (x >= 220 && x <= 228) this.toggleFastForward();
      // Nuke button
      if (x >= 230 && x <= 238) this.triggerNuke();

      // Minimap click
      if (x >= 240 && x <= 315) {
        const miniX = (x - 240) / 75.0;
        this.targetCameraX = Math.max(0, Math.min(LEVEL_W - SCREEN_W, miniX * LEVEL_W - SCREEN_W / 2));
      }
    }

    startLevel(index) {
      const levels = global.BEAT_TRIBE_LEVELS || [];
      if (index < 0 || index >= levels.length) index = 0;
      this.currentLevelIndex = index;
      this.levelDef = levels[index];

      this.lemmings = [];
      this.spawnCount = 0;
      this.totalLemmings = this.levelDef.lemmings;
      this.savedCount = 0;
      this.deadCount = 0;
      this.releaseRate = this.levelDef.releaseRate || 50;
      this.spawnTimer = 0;
      this.frame = 0;
      this.timeRemaining = this.levelDef.timeLimit || 200;
      this.skills = Object.assign({}, this.levelDef.skills);
      this.isDemoMode = false;
      this.demoIndex = 0;
      this.demoScript = [];
      this.isNuking = false;
      this.isPaused = false;
      this.fastForward = false;
      this.grooveScore = 0;
      this.particles = [];
      this.floatingTexts = [];
      this.sonicRings = [];

      this.buildLevelTerrain();

      // Camera starts centered near spawn
      this.cameraX = Math.max(0, Math.min(LEVEL_W - SCREEN_W, this.levelDef.spawn.x - SCREEN_W / 2));
      this.targetCameraX = this.cameraX;

      // Start Web Audio Tracker
      if (this.audio) {
        this.audio.setWorld(this.levelDef.world, this.levelDef.bpm);
        this.audio.startTracker();
      }

      this.gameState = 'PLAYING';
    }

    startDemo(index) {
      this.startLevel(index);
      this.isDemoMode = true;
      this.demoIndex = 0;
      this.demoScript = this.levelDef.demoScript || [];
      this.addFloatingText('ATTRACT DEMO PLAYBACK', SCREEN_W / 2, 40, '#00ffcc');
    }

    buildLevelTerrain() {
      // Clear buffers
      this.mask.fill(T_AIR);
      this.silenceMap.fill(0);

      const pal = PALETTES[this.levelDef.world] || PALETTES[1];

      // Helper for level blueprint builder
      const builder = {
        setRect: (rx, ry, rw, rh, mat) => {
          const x0 = Math.max(0, Math.floor(rx));
          const y0 = Math.max(0, Math.floor(ry));
          const x1 = Math.min(LEVEL_W, Math.floor(rx + rw));
          const y1 = Math.min(LEVEL_H, Math.floor(ry + rh));
          for (let py = y0; py < y1; py++) {
            const row = py * LEVEL_W;
            for (let px = x0; px < x1; px++) {
              this.mask[row + px] = mat;
            }
          }
        },
        fillCircle: (cx, cy, r, mat) => {
          const r2 = r * r;
          const x0 = Math.max(0, Math.floor(cx - r));
          const y0 = Math.max(0, Math.floor(cy - r));
          const x1 = Math.min(LEVEL_W, Math.ceil(cx + r));
          const y1 = Math.min(LEVEL_H, Math.ceil(cy + r));
          for (let py = y0; py < y1; py++) {
            const row = py * LEVEL_W;
            const dy = py - cy;
            for (let px = x0; px < x1; px++) {
              const dx = px - cx;
              if (dx * dx + dy * dy <= r2) {
                this.mask[row + px] = mat;
              }
            }
          }
        }
      };

      if (this.levelDef.generate) {
        this.levelDef.generate(builder);
      }

      // Generate Color Map from Mask and Palette
      for (let y = 0; y < LEVEL_H; y++) {
        const row = y * LEVEL_W;
        for (let x = 0; x < LEVEL_W; x++) {
          const m = this.mask[row + x];
          if (m === T_AIR) {
            this.colorMap[row + x] = 0;
          } else if (m >= 1 && m <= 7) {
            const baseCol = pal.noteColors[(m - 1) % pal.noteColors.length];
            // Subtle dither / stone noise
            const noise = ((x ^ y) & 3) * 6;
            this.colorMap[row + x] = baseCol;
          } else if (m === T_STEEL) {
            this.colorMap[row + x] = pal.steelColor;
          } else if (m === T_BRICK) {
            this.colorMap[row + x] = pal.brickColor;
          } else if (m === T_WATER) {
            this.colorMap[row + x] = packColor(30, 100, 220);
          } else if (m === T_LAVA) {
            this.colorMap[row + x] = packColor(230, 60, 20);
          } else if (m === T_CRUSHER) {
            this.colorMap[row + x] = packColor(180, 40, 40);
          }
        }
      }
    }

    isSolid(x, y) {
      if (x < 0 || x >= LEVEL_W || y >= LEVEL_H) return true;
      if (y < 0) return false;
      const m = this.mask[y * LEVEL_W + x];
      return (m >= 1 && m <= 10) || m === T_BRICK;
    }

    isSteel(x, y) {
      if (x < 0 || x >= LEVEL_W || y >= LEVEL_H) return true;
      if (y < 0) return false;
      return this.mask[y * LEVEL_W + x] === T_STEEL;
    }

    getHazard(x, y) {
      if (x < 0 || x >= LEVEL_W || y < 0 || y >= LEVEL_H) return 0;
      const m = this.mask[y * LEVEL_W + x];
      if (m === T_WATER) return 'water';
      if (m === T_LAVA) return 'lava';
      if (m === T_CRUSHER) return 'crusher';
      return 0;
    }

    carveCircle(cx, cy, r) {
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const x1 = Math.min(LEVEL_W, Math.ceil(cx + r));
      const y1 = Math.min(LEVEL_H, Math.ceil(cy + r));
      for (let py = y0; py < y1; py++) {
        const row = py * LEVEL_W;
        const dy = py - cy;
        for (let px = x0; px < x1; px++) {
          const dx = px - cx;
          if (dx * dx + dy * dy <= r2) {
            const idx = row + px;
            if (this.mask[idx] !== T_STEEL) {
              this.mask[idx] = T_AIR;
              this.colorMap[idx] = 0;
            }
          }
        }
      }
    }

    pushSilenceBack(cx, cy, radius) {
      const r2 = radius * radius;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const x1 = Math.min(LEVEL_W, Math.ceil(cx + radius));
      const y1 = Math.min(LEVEL_H, Math.ceil(cy + radius));
      for (let py = y0; py < y1; py++) {
        const row = py * LEVEL_W;
        const dy = py - cy;
        for (let px = x0; px < x1; px++) {
          const dx = px - cx;
          if (dx * dx + dy * dy <= r2) {
            this.silenceMap[row + px] = 0;
          }
        }
      }
      this.sonicRings.push({ x: cx, y: cy, radius: 4, maxRadius: radius, alpha: 1.0 });
    }

    assignSkillToLemming(lem, skill) {
      if (!lem || lem.state === 'DEAD' || lem.state === 'EXITING' || lem.state === 'SPLAT' || lem.state === 'DROWNING' || lem.state === 'BURNING') {
        return false;
      }
      if (this.skills[skill] !== undefined && this.skills[skill] <= 0) {
        return false;
      }

      let success = false;
      if (skill === 'climber') {
        if (!lem.skills.climber) {
          lem.skills.climber = true;
          success = true;
          if (this.audio) this.audio.playClimberChime(0);
        }
      } else if (skill === 'floater') {
        if (!lem.skills.floater) {
          lem.skills.floater = true;
          success = true;
          if (this.audio) this.audio.playFloaterPad(0);
        }
      } else if (skill === 'bomber') {
        if (lem.countdown < 0) {
          lem.countdown = 300;
          success = true;
          if (this.audio) this.audio.playFormantVocal('oh', 240);
        }
      } else if (skill === 'blocker') {
        if (lem.state === 'WALKING') {
          lem.state = 'BLOCKING';
          success = true;
          if (this.audio) this.audio.startBlockerDrone();
          this.pushSilenceBack(lem.x, lem.y, 65);
        }
      } else if (skill === 'builder') {
        if (lem.state === 'WALKING' || lem.state === 'BUILDING' || lem.state === 'BASHING' || lem.state === 'MINING' || lem.state === 'DIGGING') {
          lem.state = 'BUILDING';
          lem.bricksLeft = 12;
          lem.actionTick = 0;
          success = true;
          if (this.audio) this.audio.playBuilderStep(0);
          this.pushSilenceBack(lem.x, lem.y, 45);
        }
      } else if (skill === 'basher') {
        if (lem.state === 'WALKING') {
          lem.state = 'BASHING';
          lem.actionTick = 0;
          success = true;
          if (this.audio) this.audio.playBasherSweep();
          this.pushSilenceBack(lem.x, lem.y, 35);
        }
      } else if (skill === 'miner') {
        if (lem.state === 'WALKING') {
          lem.state = 'MINING';
          lem.actionTick = 0;
          success = true;
          if (this.audio) this.audio.playMinerClick();
          this.pushSilenceBack(lem.x, lem.y, 35);
        }
      } else if (skill === 'digger') {
        if (lem.state === 'WALKING') {
          lem.state = 'DIGGING';
          lem.actionTick = 0;
          success = true;
          if (this.audio) this.audio.playDiggerBeat(0);
          this.pushSilenceBack(lem.x, lem.y, 35);
        }
      }

      if (success) {
        if (this.skills[skill] !== undefined) {
          this.skills[skill]--;
        }

        // On-Beat Groove Bonus check!
        if (this.audio && this.audio.checkOnBeat()) {
          this.grooveScore += 50;
          this.audio.playGrooveBonus();
          this.addFloatingText('GROOVY! +50', lem.x, lem.y - 12, '#ffd700');
          this.spawnSparkles(lem.x, lem.y - 6, '#ffd700', 12);
        }
      }

      return success;
    }

    addFloatingText(text, x, y, color = '#ffffff') {
      this.floatingTexts.push({ text, x, y, color, life: 60, maxLife: 60 });
    }

    spawnSparkles(x, y, color, count = 8) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.0 + Math.random() * 2.5;
        this.particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.0,
          color,
          life: 25 + Math.floor(Math.random() * 20)
        });
      }
    }

    // =========================================================================
    // SIMULATION UPDATE (Fixed 60Hz Step)
    // =========================================================================
    updateSimulation() {
      this.frame++;

      // Time countdown (1 second per 60 frames)
      if (this.frame % 60 === 0 && this.timeRemaining > 0) {
        this.timeRemaining--;
        if (this.timeRemaining === 0) {
          this.triggerNuke();
        }
      }

      // Attract Demo Script Processing
      while (this.demoIndex < this.demoScript.length && this.demoScript[this.demoIndex].frame <= this.frame) {
        const cmd = this.demoScript[this.demoIndex];
        if (cmd.lemmingIdx < this.lemmings.length) {
          this.assignSkillToLemming(this.lemmings[cmd.lemmingIdx], cmd.skill);
        }
        this.demoIndex++;
      }

      // Spawn Lemmings
      if (this.spawnCount < this.totalLemmings && this.frame >= 40) {
        if (this.spawnTimer <= 0) {
          this.lemmings.push({
            id: this.spawnCount,
            x: this.levelDef.spawn.x,
            y: this.levelDef.spawn.y,
            facing: 1,
            state: 'FALLING',
            fallDistance: 0,
            skills: { climber: false, floater: false },
            countdown: -1,
            bricksLeft: 0,
            actionTick: 0,
            silenceTimer: 0,
            animTick: 0
          });
          this.spawnCount++;
          const spawnInterval = Math.max(4, Math.floor((104 - this.releaseRate) * 1.5));
          this.spawnTimer = spawnInterval;
        } else {
          this.spawnTimer--;
        }
      }

      // Silence Expansion (if level has silence)
      if (this.levelDef.hasSilence && this.frame % 25 === 0) {
        const silenceX = Math.min(LEVEL_W, Math.floor(this.frame * 0.08));
        for (let py = 0; py < LEVEL_H; py++) {
          const row = py * LEVEL_W;
          for (let px = 0; px < silenceX; px++) {
            if (this.silenceMap[row + px] === 0 && Math.random() < 0.2) {
              this.silenceMap[row + px] = 1;
            }
          }
        }
      }

      // Update Lemmings
      for (let i = 0; i < this.lemmings.length; i++) {
        const lem = this.lemmings[i];
        if (lem.state === 'DEAD' || lem.state === 'EXITING') continue;

        lem.animTick++;

        // Bomber Countdown
        if (lem.countdown > 0) {
          lem.countdown--;
          if (lem.countdown === 0) {
            this.carveCircle(lem.x, lem.y - 5, 13);
            if (this.audio) this.audio.playBomberDetonation();
            this.spawnSparkles(lem.x, lem.y - 5, '#ff4400', 30);
            lem.state = 'DEAD';
            this.deadCount++;
            continue;
          }
        }

        // Out of Bounds Check
        if (lem.y >= LEVEL_H) {
          lem.state = 'DEAD';
          this.deadCount++;
          continue;
        }

        // Hazards Check
        const haz = this.getHazard(lem.x, lem.y);
        if (haz === 'water') {
          if (lem.state !== 'DROWNING' && lem.state !== 'DEAD') {
            lem.state = 'DROWNING';
            this.deadCount++;
            this.spawnSparkles(lem.x, lem.y, '#3399ff', 8);
          }
          continue;
        }
        if (haz === 'lava' || haz === 'crusher') {
          if (lem.state !== 'BURNING' && lem.state !== 'DEAD') {
            lem.state = 'BURNING';
            this.deadCount++;
            this.spawnSparkles(lem.x, lem.y, '#ff3300', 12);
          }
          continue;
        }

        // Exit Door Check
        const ex = this.levelDef.exit.x;
        const ey = this.levelDef.exit.y;
        if (Math.abs(lem.x - ex) <= 8 && Math.abs(lem.y - ey) <= 8) {
          if (lem.state === 'WALKING' || lem.state === 'FALLING' || lem.state === 'FLOATING') {
            lem.state = 'EXITING';
            this.savedCount++;
            if (this.audio) this.audio.playExitChime();
            this.spawnSparkles(ex, ey - 4, '#ffdd00', 16);

            // Stem unlock progression: 20%, 40%, 60%, 80%, 100%
            const pct = (this.savedCount / this.totalLemmings) * 100;
            if (pct >= 20 && this.audio && this.audio.unlockStem(0)) {
              this.addFloatingText('STEM UNLOCKED: DRUMS!', ex, ey - 20, '#00ffcc');
            }
            if (pct >= 40 && this.audio && this.audio.unlockStem(1)) {
              this.addFloatingText('STEM UNLOCKED: BASS!', ex, ey - 20, '#33ff33');
            }
            if (pct >= 60 && this.audio && this.audio.unlockStem(2)) {
              this.addFloatingText('STEM UNLOCKED: CHORDS!', ex, ey - 20, '#ffcc00');
            }
            if (pct >= 80 && this.audio && this.audio.unlockStem(3)) {
              this.addFloatingText('STEM UNLOCKED: LEAD!', ex, ey - 20, '#ff33cc');
            }
            if (pct >= 100 && this.audio && this.audio.unlockStem(4)) {
              this.addFloatingText('FULL MIX UNLOCKED!', ex, ey - 20, '#ffffff');
            }
            continue;
          }
        }

        // Silence slowdown
        const inSilence = (this.silenceMap[lem.y * LEVEL_W + lem.x] === 1);
        if (inSilence) {
          lem.silenceTimer++;
          if (lem.silenceTimer > 600) {
            lem.state = 'DEAD';
            this.deadCount++;
            this.spawnSparkles(lem.x, lem.y, '#888888', 10);
            continue;
          }
          if (this.frame % 2 !== 0) continue; // half speed in silence
        } else {
          lem.silenceTimer = Math.max(0, lem.silenceTimer - 2);
        }

        // Lemming State Machine
        switch (lem.state) {
          case 'FALLING': {
            lem.fallDistance += 2;
            if (lem.skills.floater && lem.fallDistance >= 16) {
              lem.state = 'FLOATING';
              if (this.audio) this.audio.playFloaterPad(0);
              break;
            }
            let landed = false;
            for (let step = 0; step < 2; step++) {
              lem.y++;
              if (this.isSolid(lem.x, lem.y)) {
                landed = true;
                break;
              }
            }
            if (landed) {
              if (lem.fallDistance > 55) {
                lem.state = 'SPLAT';
                this.deadCount++;
                this.spawnSparkles(lem.x, lem.y, '#ff4444', 8);
              } else {
                lem.fallDistance = 0;
                lem.state = 'WALKING';
              }
            }
            break;
          }

          case 'FLOATING': {
            lem.actionTick++;
            if (lem.actionTick % 2 === 0) {
              lem.y++;
              if (this.isSolid(lem.x, lem.y)) {
                lem.fallDistance = 0;
                lem.state = 'WALKING';
              }
            }
            break;
          }

          case 'WALKING': {
            while (this.isSolid(lem.x, lem.y) && lem.y > 0) {
              lem.y--;
            }
            if (!this.isSolid(lem.x, lem.y + 1) && !this.isSolid(lem.x, lem.y + 2) && !this.isSolid(lem.x, lem.y + 3)) {
              lem.state = 'FALLING';
              lem.fallDistance = 0;
              break;
            }

            const targetX = lem.x + lem.facing;

            // Check Blocker Collision
            let hitBlocker = false;
            for (let b = 0; b < this.lemmings.length; b++) {
              if (b === i) continue;
              const other = this.lemmings[b];
              if (other.state === 'BLOCKING') {
                if (Math.abs(targetX - other.x) <= 5 && Math.abs(lem.y - other.y) <= 8) {
                  hitBlocker = true;
                  break;
                }
              }
            }
            if (hitBlocker) {
              lem.facing = -lem.facing;
              break;
            }

            // Check Wall Ahead
            let wall = false;
            if (this.isSolid(targetX, lem.y - 8) || this.isSolid(targetX, lem.y - 6) || this.isSolid(targetX, lem.y - 4)) {
              wall = true;
            }

            if (wall) {
              if (lem.skills.climber) {
                lem.state = 'CLIMBING';
              } else {
                lem.facing = -lem.facing;
              }
              break;
            }

            // Slope Up (1..4 px)
            let steppedUp = false;
            for (let dy = -1; dy >= -4; dy--) {
              if (this.isSolid(targetX, lem.y + dy + 1) && !this.isSolid(targetX, lem.y + dy) && !this.isSolid(targetX, lem.y + dy - 8)) {
                lem.x = targetX;
                lem.y += dy;
                steppedUp = true;
                break;
              }
            }
            if (steppedUp) {
              this.triggerQuantizedFootstep(lem);
              break;
            }

            // Flat Step
            if (this.isSolid(targetX, lem.y + 1) && !this.isSolid(targetX, lem.y) && !this.isSolid(targetX, lem.y - 8)) {
              lem.x = targetX;
              this.triggerQuantizedFootstep(lem);
              break;
            }

            // Slope Down (1..3 px)
            let steppedDown = false;
            for (let dy = 1; dy <= 3; dy++) {
              if (this.isSolid(targetX, lem.y + dy + 1) && !this.isSolid(targetX, lem.y + dy) && !this.isSolid(targetX, lem.y + dy - 8)) {
                lem.x = targetX;
                lem.y += dy;
                steppedDown = true;
                break;
              }
            }
            if (steppedDown) {
              this.triggerQuantizedFootstep(lem);
              break;
            }

            // Open Air -> Falling
            lem.x = targetX;
            lem.state = 'FALLING';
            lem.fallDistance = 0;
            break;
          }

          case 'CLIMBING': {
            lem.y--;
            if (lem.animTick % 10 === 0 && this.audio) {
              this.audio.playClimberChime(Math.floor(lem.animTick / 10));
            }
            if (this.isSolid(lem.x, lem.y - 9)) {
              lem.facing = -lem.facing;
              lem.state = 'FALLING';
              lem.fallDistance = 0;
              break;
            }
            const wallX = lem.x + lem.facing;
            if (!this.isSolid(wallX, lem.y) && !this.isSolid(wallX, lem.y - 8) && this.isSolid(wallX, lem.y + 1)) {
              lem.x = wallX;
              lem.state = 'WALKING';
            }
            break;
          }

          case 'BUILDING': {
            lem.actionTick++;
            if (lem.actionTick >= 12) {
              lem.actionTick = 0;
              const bx = lem.x + lem.facing * 2;
              const by = lem.y;

              if (this.isSolid(bx, by - 1)) {
                lem.facing = -lem.facing;
                lem.state = 'WALKING';
                break;
              }

              // Lay 4-pixel wide brick
              const pal = PALETTES[this.levelDef.world] || PALETTES[1];
              for (let px = 0; px < 4; px++) {
                const placeX = lem.x + (lem.facing > 0 ? px : -px);
                if (placeX >= 0 && placeX < LEVEL_W && by >= 0 && by < LEVEL_H) {
                  const idx = by * LEVEL_W + placeX;
                  if (this.mask[idx] === T_AIR) {
                    this.mask[idx] = T_BRICK;
                    this.colorMap[idx] = pal.brickColor;
                  }
                }
              }

              lem.x += lem.facing * 2;
              lem.y -= 1;
              lem.bricksLeft--;

              if (this.audio) this.audio.playBuilderStep(12 - lem.bricksLeft);
              this.pushSilenceBack(lem.x, lem.y, 40);

              if (lem.bricksLeft <= 0) {
                lem.state = 'WALKING';
              }
            }
            break;
          }

          case 'BASHING': {
            lem.actionTick++;
            if (lem.actionTick >= 8) {
              lem.actionTick = 0;
              const targetX = lem.x + lem.facing * 3;

              let hitSteel = false;
              for (let py = lem.y - 9; py <= lem.y; py++) {
                if (this.isSteel(targetX, py)) {
                  hitSteel = true;
                  break;
                }
              }
              if (hitSteel) {
                lem.facing = -lem.facing;
                lem.state = 'WALKING';
                break;
              }

              let carvedAny = false;
              for (let py = lem.y - 9; py <= lem.y; py++) {
                for (let step = 1; step <= 3; step++) {
                  const px = lem.x + lem.facing * step;
                  if (px >= 0 && px < LEVEL_W && py >= 0 && py < LEVEL_H) {
                    const idx = py * LEVEL_W + px;
                    if (this.mask[idx] !== T_STEEL && this.mask[idx] !== T_AIR) {
                      this.mask[idx] = T_AIR;
                      this.colorMap[idx] = 0;
                      carvedAny = true;
                    }
                  }
                }
              }

              lem.x += lem.facing * 2;
              if (this.audio) this.audio.playBasherSweep();
              this.pushSilenceBack(lem.x, lem.y, 35);

              let solidAhead = false;
              for (let py = lem.y - 9; py <= lem.y; py++) {
                if (this.isSolid(lem.x + lem.facing * 3, py)) {
                  solidAhead = true;
                  break;
                }
              }
              if (!solidAhead && !carvedAny) {
                lem.state = 'WALKING';
              }
            }
            break;
          }

          case 'MINING': {
            lem.actionTick++;
            if (lem.actionTick >= 8) {
              lem.actionTick = 0;
              const targetX = lem.x + lem.facing * 2;
              const targetY = lem.y + 2;

              if (this.isSteel(targetX, targetY)) {
                lem.facing = -lem.facing;
                lem.state = 'WALKING';
                break;
              }

              for (let py = lem.y - 8; py <= lem.y + 2; py++) {
                for (let px = lem.x; px <= lem.x + lem.facing * 3; px += Math.sign(lem.facing)) {
                  if (px >= 0 && px < LEVEL_W && py >= 0 && py < LEVEL_H) {
                    const idx = py * LEVEL_W + px;
                    if (this.mask[idx] !== T_STEEL) {
                      this.mask[idx] = T_AIR;
                      this.colorMap[idx] = 0;
                    }
                  }
                }
              }

              lem.x += lem.facing * 2;
              lem.y += 2;
              if (this.audio) this.audio.playMinerClick();
              this.pushSilenceBack(lem.x, lem.y, 35);

              if (!this.isSolid(lem.x, lem.y + 1) && !this.isSolid(lem.x, lem.y + 2)) {
                lem.state = 'FALLING';
                lem.fallDistance = 0;
              }
            }
            break;
          }

          case 'DIGGING': {
            lem.actionTick++;
            if (lem.actionTick >= 8) {
              lem.actionTick = 0;
              let hitSteel = false;
              for (let px = lem.x - 4; px <= lem.x + 4; px++) {
                if (this.isSteel(px, lem.y + 1) || this.isSteel(px, lem.y + 2)) {
                  hitSteel = true;
                  break;
                }
              }
              if (hitSteel) {
                lem.state = 'WALKING';
                break;
              }

              for (let py = lem.y + 1; py <= lem.y + 2; py++) {
                for (let px = lem.x - 4; px <= lem.x + 4; px++) {
                  if (px >= 0 && px < LEVEL_W && py >= 0 && py < LEVEL_H) {
                    const idx = py * LEVEL_W + px;
                    if (this.mask[idx] !== T_STEEL) {
                      this.mask[idx] = T_AIR;
                      this.colorMap[idx] = 0;
                    }
                  }
                }
              }

              lem.y += 2;
              if (this.audio) this.audio.playDiggerBeat(Math.floor(lem.animTick / 8));
              this.pushSilenceBack(lem.x, lem.y, 35);

              if (!this.isSolid(lem.x, lem.y + 1) && !this.isSolid(lem.x, lem.y + 2)) {
                lem.state = 'FALLING';
                lem.fallDistance = 0;
              }
            }
            break;
          }

          case 'BLOCKING': {
            if (lem.animTick % 20 === 0) {
              this.pushSilenceBack(lem.x, lem.y, 60);
            }
            break;
          }
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // Update Floating Texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const t = this.floatingTexts[i];
        t.y -= 0.5;
        t.life--;
        if (t.life <= 0) this.floatingTexts.splice(i, 1);
      }

      // Update Sonic Rings
      for (let i = this.sonicRings.length - 1; i >= 0; i--) {
        const r = this.sonicRings[i];
        r.radius += 2.0;
        r.alpha -= 0.03;
        if (r.alpha <= 0 || r.radius >= r.maxRadius) this.sonicRings.splice(i, 1);
      }

      // Check Level End Condition
      if (this.spawnCount >= this.totalLemmings) {
        const active = this.lemmings.some(l => l.state !== 'DEAD' && l.state !== 'EXITING' && l.state !== 'SPLAT' && l.state !== 'DROWNING' && l.state !== 'BURNING');
        if (!active) {
          this.gameState = 'RESULTS';
        }
      }

      // Smooth Camera Tracking
      this.cameraX += (this.targetCameraX - this.cameraX) * 0.15;
    }

    triggerQuantizedFootstep(lem) {
      if (!this.audio) return;
      if (lem.animTick % 8 === 0) {
        const m = this.mask[(lem.y + 1) * LEVEL_W + lem.x];
        const deg = (m >= 1 && m <= 7) ? m : 1;
        const octaveOffset = (lem.y < 50) ? 1 : (lem.y > 110 ? -1 : 0);
        this.audio.queueFootstep(deg, octaveOffset);
      }
    }

    // =========================================================================
    // SOFTWARE FRAMEBUFFER RENDERING (320x200 Per-Pixel)
    // =========================================================================
    render() {
      const pal = PALETTES[this.levelDef ? this.levelDef.world : 1] || PALETTES[1];
      const camX = Math.floor(this.cameraX);

      if (this.gameState === 'TITLE') {
        this.renderTitleScreen();
        this.ctx.putImageData(this.imgData, 0, 0);
        return;
      }

      if (this.gameState === 'RESULTS') {
        this.renderResultsScreen();
        this.ctx.putImageData(this.imgData, 0, 0);
        return;
      }

      // 1. Render Background Copper Gradient into Playfield (Y = 0..159)
      for (let y = 0; y < PLAY_H; y++) {
        const ratio = y / PLAY_H;
        // Interpolate background top & bottom colors
        const rTop = pal.bgTop & 0xff, gTop = (pal.bgTop >> 8) & 0xff, bTop = (pal.bgTop >> 16) & 0xff;
        const rBot = pal.bgBottom & 0xff, gBot = (pal.bgBottom >> 8) & 0xff, bBot = (pal.bgBottom >> 16) & 0xff;
        const r = Math.floor(rTop + (rBot - rTop) * ratio);
        const g = Math.floor(gTop + (gBot - gTop) * ratio);
        const b = Math.floor(bTop + (bBot - bTop) * ratio);
        const bgCol = packColor(r, g, b);

        const row = y * SCREEN_W;
        for (let x = 0; x < SCREEN_W; x++) {
          this.fb32[row + x] = bgCol;
        }
      }

      // 2. Render Destructible Terrain Slice (from camX to camX + 320)
      for (let y = 0; y < PLAY_H; y++) {
        const screenRow = y * SCREEN_W;
        const levelRow = y * LEVEL_W;
        for (let x = 0; x < SCREEN_W; x++) {
          const lx = camX + x;
          if (lx >= 0 && lx < LEVEL_W) {
            const col = this.colorMap[levelRow + lx];
            if (col !== 0) {
              // Check silence mask
              if (this.silenceMap[levelRow + lx] === 1) {
                // Desaturate to dark grey
                this.fb32[screenRow + x] = packColor(45, 45, 50);
              } else {
                this.fb32[screenRow + x] = col;
              }
            }
          }
        }
      }

      // 3. Render Entrance Hatch & Exit Door
      this.renderEntranceHatch(camX);
      this.renderExitDoor(camX);

      // 4. Render Lemmings
      this.hoverLemming = null;
      for (let i = 0; i < this.lemmings.length; i++) {
        const lem = this.lemmings[i];
        if (lem.state === 'DEAD' || lem.state === 'EXITING') continue;

        const sx = lem.x - camX;
        const sy = lem.y;

        if (sx >= -10 && sx <= SCREEN_W + 10) {
          this.renderLemmingSprite(sx, sy, lem);

          // Check mouse hover
          if (Math.abs(this.mouseX - sx) <= 8 && Math.abs(this.mouseY - (sy - 5)) <= 8) {
            this.hoverLemming = lem;
          }
        }
      }

      // 5. Render Cursor Crosshair
      if (this.hoverLemming) {
        const hx = this.hoverLemming.x - camX;
        const hy = this.hoverLemming.y - 5;
        this.renderCrosshair(hx, hy);
      }

      // 6. Render Particles
      for (let p of this.particles) {
        const px = Math.floor(p.x - camX);
        const py = Math.floor(p.y);
        if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
          this.fb32[py * SCREEN_W + px] = packColor(255, 255, 255);
        }
      }

      // 7. Render Bottom Control Panel (Y = 160..199)
      this.renderBottomPanel();

      // Push Software Framebuffer to Canvas
      this.ctx.putImageData(this.imgData, 0, 0);

      // 8. Render Floating Texts & Overlays (Canvas 2D layer for crisp typography)
      this.renderTextOverlays(camX);
    }

    renderEntranceHatch(camX) {
      const hx = this.levelDef.spawn.x - camX;
      const hy = this.levelDef.spawn.y - 12;
      if (hx < -20 || hx > SCREEN_W + 20) return;

      // Draw metallic trapdoor box (16x10)
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = -8; dx < 8; dx++) {
          const px = hx + dx;
          const py = hy + dy;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            const edge = (dx === -8 || dx === 7 || dy === 0 || dy === 7);
            this.fb32[py * SCREEN_W + px] = edge ? packColor(200, 200, 200) : packColor(100, 100, 110);
          }
        }
      }
    }

    renderExitDoor(camX) {
      const ex = this.levelDef.exit.x - camX;
      const ey = this.levelDef.exit.y;
      if (ex < -20 || ex > SCREEN_W + 20) return;

      // Draw glowing exit archway (16x16)
      for (let dy = -16; dy <= 0; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const px = ex + dx;
          const py = ey + dy;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            const isBorder = (Math.abs(dx) === 8 || dy === -16);
            if (isBorder) {
              this.fb32[py * SCREEN_W + px] = packColor(241, 196, 15); // Gold border
            } else {
              // Glowing vortex portal
              const glow = (this.frame * 4 + dx * 10 + dy * 10) & 255;
              this.fb32[py * SCREEN_W + px] = packColor(glow, 50, 200);
            }
          }
        }
      }
    }

    renderLemmingSprite(sx, sy, lem) {
      // 8x10 sprite
      const hairCol = packColor(46, 227, 59);
      const robeCol = packColor(40, 72, 220);
      const skinCol = packColor(255, 201, 153);
      const toolCol = packColor(220, 220, 230);
      const f = lem.facing;

      // Hair (y-9 .. y-7)
      for (let hy = -9; hy <= -7; hy++) {
        for (let hx = -2; hx <= 2; hx++) {
          const px = sx + hx;
          const py = sy + hy;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            this.fb32[py * SCREEN_W + px] = hairCol;
          }
        }
      }

      // Face / Skin (y-6 .. y-5)
      for (let fy = -6; fy <= -5; fy++) {
        for (let fx = -2; fx <= 2; fx++) {
          const px = sx + fx;
          const py = sy + fy;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            this.fb32[py * SCREEN_W + px] = skinCol;
          }
        }
      }

      // Robe (y-4 .. y-1)
      for (let ry = -4; ry <= -1; ry++) {
        for (let rx = -2; rx <= 2; rx++) {
          const px = sx + rx;
          const py = sy + ry;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            this.fb32[py * SCREEN_W + px] = robeCol;
          }
        }
      }

      // Action Specific Overlays
      if (lem.state === 'FLOATING') {
        // Umbrella canopy overhead (width 12)
        for (let ux = -6; ux <= 6; ux++) {
          const px = sx + ux;
          const py = sy - 14;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            const col = (ux % 2 === 0) ? packColor(255, 255, 255) : packColor(230, 40, 40);
            this.fb32[py * SCREEN_W + px] = col;
          }
        }
      } else if (lem.state === 'BLOCKING') {
        // Outstretched arms
        for (let ax = -5; ax <= 5; ax++) {
          const px = sx + ax;
          const py = sy - 4;
          if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
            this.fb32[py * SCREEN_W + px] = robeCol;
          }
        }
      } else if (lem.state === 'BUILDING' || lem.state === 'BASHING' || lem.state === 'MINING' || lem.state === 'DIGGING') {
        // Tool in hand
        const px = sx + f * 4;
        const py = sy - 3;
        if (px >= 0 && px < SCREEN_W && py >= 0 && py < PLAY_H) {
          this.fb32[py * SCREEN_W + px] = toolCol;
        }
      }
    }

    renderCrosshair(hx, hy) {
      const chCol = packColor(255, 255, 0);
      for (let d = -6; d <= 6; d++) {
        if (d === 0) continue;
        const px1 = hx + d, py1 = hy;
        const px2 = hx, py2 = hy + d;
        if (px1 >= 0 && px1 < SCREEN_W && py1 >= 0 && py1 < PLAY_H) this.fb32[py1 * SCREEN_W + px1] = chCol;
        if (px2 >= 0 && px2 < SCREEN_W && py2 >= 0 && py2 < PLAY_H) this.fb32[py2 * SCREEN_W + px2] = chCol;
      }
    }

    renderBottomPanel() {
      const panelBg = packColor(30, 32, 40);
      const borderCol = packColor(90, 95, 110);
      const goldCol = packColor(255, 215, 0);

      // Fill panel background
      for (let y = 160; y < SCREEN_H; y++) {
        const row = y * SCREEN_W;
        for (let x = 0; x < SCREEN_W; x++) {
          this.fb32[row + x] = (y === 160 || y === 161) ? borderCol : panelBg;
        }
      }

      // Draw 8 Skill Slots
      const skills = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
      for (let i = 0; i < skills.length; i++) {
        const sx = 64 + i * 18;
        const isSelected = (this.selectedSkill === skills[i]);
        const slotBorder = isSelected ? goldCol : borderCol;

        for (let dy = 0; dy < 30; dy++) {
          for (let dx = 0; dx < 16; dx++) {
            const px = sx + dx;
            const py = 165 + dy;
            if (dx === 0 || dx === 15 || dy === 0 || dy === 29) {
              this.fb32[py * SCREEN_W + px] = slotBorder;
            }
          }
        }
      }

      // Draw Minimap (x=240..315, y=165..195, size 75x30)
      for (let my = 0; my < 30; my++) {
        const levelY = Math.floor((my / 30.0) * LEVEL_H);
        for (let mx = 0; mx < 75; mx++) {
          const levelX = Math.floor((mx / 75.0) * LEVEL_W);
          const px = 240 + mx;
          const py = 165 + my;
          const m = this.mask[levelY * LEVEL_W + levelX];
          this.fb32[py * SCREEN_W + px] = (m !== T_AIR) ? packColor(100, 160, 120) : packColor(15, 15, 20);
        }
      }

      // Draw Lemmings on Minimap
      for (let lem of this.lemmings) {
        if (lem.state !== 'DEAD' && lem.state !== 'EXITING') {
          const mx = 240 + Math.floor((lem.x / LEVEL_W) * 75);
          const my = 165 + Math.floor((lem.y / LEVEL_H) * 30);
          if (mx >= 240 && mx < 315 && my >= 165 && my < 195) {
            this.fb32[my * SCREEN_W + mx] = packColor(0, 255, 0);
          }
        }
      }

      // Draw Camera Viewport Box on Minimap
      const camMiniX = 240 + Math.floor((this.cameraX / LEVEL_W) * 75);
      const camMiniW = Math.floor((SCREEN_W / LEVEL_W) * 75);
      for (let cy = 165; cy < 195; cy++) {
        for (let cx = camMiniX; cx < camMiniX + camMiniW; cx++) {
          if (cx === camMiniX || cx === camMiniX + camMiniW - 1 || cy === 165 || cy === 194) {
            if (cx >= 240 && cx < 315) {
              this.fb32[cy * SCREEN_W + cx] = packColor(255, 255, 255);
            }
          }
        }
      }
    }

    renderTextOverlays(camX) {
      this.ctx.font = '8px monospace';
      this.ctx.textBaseline = 'top';

      // Top HUD: Out / In / Time / Groove / Stem Badges
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, SCREEN_W, 14);

      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillText(`OUT:${this.spawnCount}/${this.totalLemmings}`, 4, 3);
      this.ctx.fillText(`IN:${this.savedCount} (${Math.round((this.savedCount/this.totalLemmings)*100)}%)`, 75, 3);

      const mins = Math.floor(this.timeRemaining / 60);
      const secs = (this.timeRemaining % 60).toString().padStart(2, '0');
      this.ctx.fillStyle = this.timeRemaining < 30 ? '#ff3333' : '#ffffff';
      this.ctx.fillText(`TIME:${mins}:${secs}`, 155, 3);

      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText(`GROOVE:${this.grooveScore}`, 225, 3);

      // Stem Status Indicator in HUD
      if (this.audio) {
        const stems = ['DRM', 'BAS', 'CHD', 'LED', 'FUL'];
        for (let i = 0; i < 5; i++) {
          this.ctx.fillStyle = this.audio.stemUnlocked[i] ? '#22e033' : '#555555';
          this.ctx.fillText(stems[i], 4 + i * 24, 18);
        }
      }

      // Bottom Panel Text: Release Rate & Skill Counts
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(`-`, 12, 172);
      this.ctx.fillText(`+`, 46, 172);
      this.ctx.fillText(`${this.releaseRate}`, 24, 172);

      const skills = ['climber', 'floater', 'bomber', 'blocker', 'builder', 'basher', 'miner', 'digger'];
      const abbrev = ['CLM', 'FLT', 'BOM', 'BLK', 'BLD', 'BSH', 'MIN', 'DIG'];
      for (let i = 0; i < skills.length; i++) {
        const sx = 64 + i * 18;
        const count = this.skills[skills[i]] || 0;
        this.ctx.fillStyle = count > 0 ? '#38bdf8' : '#888888';
        this.ctx.fillText(abbrev[i], sx + 1, 168);
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillText(`${count}`, sx + 3, 182);
      }

      // Hover Lemming Label
      if (this.hoverLemming) {
        const hx = this.hoverLemming.x - camX;
        const hy = this.hoverLemming.y - 20;
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillText(`${this.hoverLemming.state}`, hx - 12, hy);
      }

      // Floating Texts
      for (let t of this.floatingTexts) {
        this.ctx.fillStyle = t.color;
        this.ctx.fillText(t.text, t.x - camX - 20, t.y);
      }
    }

    renderTitleScreen() {
      // Demoscene Title Screen with Raster Bars
      this.titleIdleFrames++;
      if (this.titleIdleFrames > 700) { // ~12 seconds idle
        this.titleIdleFrames = 0;
        this.startDemo(1); // Auto attract demo
        return;
      }

      for (let y = 0; y < SCREEN_H; y++) {
        const row = y * SCREEN_W;
        const rainbow = Math.floor(Math.sin((y + this.frame * 2) * 0.08) * 40 + 60);
        const col = packColor(rainbow, 15, Math.floor(rainbow * 1.4));
        for (let x = 0; x < SCREEN_W; x++) {
          this.fb32[row + x] = col;
        }
      }
    }

    renderResultsScreen() {
      // End of Level Results & Replay Screen
      for (let y = 0; y < SCREEN_H; y++) {
        const row = y * SCREEN_W;
        for (let x = 0; x < SCREEN_W; x++) {
          this.fb32[row + x] = packColor(15, 20, 30);
        }
      }
    }
  }

  global.BeatTribeGame = BeatTribeGame;

})(typeof window !== 'undefined' ? window : global);
