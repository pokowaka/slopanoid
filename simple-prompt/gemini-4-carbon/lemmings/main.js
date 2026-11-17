/**
 * Lemmings: Beat Tribe — Main Game Loop, Input Controller & State Machine (main.js)
 * Locked 60 Hz deterministic simulation + Web Audio tracker sync + 320x200 CRT presentation.
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const { SKILL_LIST, GameSim } = BeatTribe.Sim;
  const { LEVELS, findLevelByPassword } = BeatTribe.Levels;
  const { AudioEngine } = BeatTribe.Audio;
  const { FB_W, FB_H, PLAY_H, HUD_LAYOUT, FramebufferRenderer } = BeatTribe.Renderer;

  class BeatTribeApp {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.renderer = new FramebufferRenderer(this.canvas);
      this.audio = new AudioEngine();

      // Modes: 'TITLE' (Attract Mode), 'BRIEFING', 'PLAY', 'SELECT', 'RESULTS'
      this.mode = 'TITLE';
      this.currentLevelIdx = 0;
      this.attractOrderIdx = 0;
      this.attractCycleOrder = [0, 4, 7, 10, 13, 2, 6, 12, 15];

      // Camera & UI State
      this.camX = 0;
      this.targetCamX = 0;
      this.selectedSkill = 'BUILDER';
      this.hoveredLemming = null;
      this.paused = false;
      this.fastForward = false;
      this.showTracker = false;
      this.crtEnabled = true;
      this.nukeArmedFrames = 0;

      // Level Select Password entry
      this.passwordInput = '';
      this.passwordMsg = '';

      // Mouse & Key state
      this.mouseX = 160;
      this.mouseY = 100;
      this.mouseInside = false;
      this.draggingMinimap = false;
      this.rightPanning = false;
      this.panStartMouseX = 0;
      this.panStartCamX = 0;
      this.heldRateDelta = 0;
      this.heldRateTicks = 0;
      this.keysDown = new Set();

      // Fixed 60 Hz Timing
      this.lastFrameTime = performance.now();
      this.accumulatorMs = 0;
      this.visualTick = 0;

      // Boot into live Attract-Mode Demo on Title Screen!
      this.startAttractDemo(this.attractCycleOrder[0]);
      this.bindEvents();
      this.syncHeaderBadges();
      requestAnimationFrame(t => this.frameLoop(t));
    }

    ensureAudio() {
      if (!this.audio.initialized) {
        this.audio.init();
        this.audio.setWorld(this.sim ? this.sim.worldId : 1, false);
        this.syncHeaderBadges();
      } else if (this.audio.ctx && this.audio.ctx.state === 'suspended') {
        this.audio.ctx.resume().catch(() => {});
      }
    }

    startAttractDemo(levelIdx) {
      const lvl = LEVELS[levelIdx % LEVELS.length];
      this.sim = new GameSim(lvl, this.audio, { demoMode: true, attractMode: true });
      this.camX = Math.max(0, Math.min(lvl.width - FB_W, lvl.hatch.x - 80));
      this.targetCamX = this.camX;
      this.paused = false;
      this.fastForward = false;
      this.audio.stopComposedReplay();
      this.audio.setPaused(false);
      this.audio.setSpeedMultiplier(1.0);
    }

    openBriefing(levelIdx) {
      this.currentLevelIdx = Math.max(0, Math.min(LEVELS.length - 1, levelIdx));
      const lvl = LEVELS[this.currentLevelIdx];
      this.mode = 'BRIEFING';
      this.showTracker = false;
      this.audio.stopComposedReplay();
      this.sim = new GameSim(lvl, this.audio, { demoMode: false, attractMode: true });
      this.camX = Math.max(0, Math.min(lvl.width - FB_W, lvl.hatch.x - 76));
      this.targetCamX = this.camX;
      this.pickDefaultSkill(lvl);
      this.syncHeaderBadges();
    }

    startLevel(levelIdx, demoMode = false) {
      this.ensureAudio();
      this.currentLevelIdx = Math.max(0, Math.min(LEVELS.length - 1, levelIdx));
      const lvl = LEVELS[this.currentLevelIdx];
      this.mode = 'PLAY';
      this.paused = false;
      this.fastForward = false;
      this.nukeArmedFrames = 0;
      this.audio.stopComposedReplay();
      this.audio.setPaused(false);
      this.audio.setSpeedMultiplier(1.0);
      this.sim = new GameSim(lvl, this.audio, { demoMode, attractMode: false });
      this.camX = Math.max(0, Math.min(lvl.width - FB_W, lvl.hatch.x - 76));
      this.targetCamX = this.camX;
      this.pickDefaultSkill(lvl);
      this.syncHeaderBadges();
    }

    pickDefaultSkill(lvl) {
      for (const s of ['BUILDER', 'BASHER', 'DIGGER', 'MINER', 'CLIMBER', 'FLOATER', 'BLOCKER', 'BOMBER']) {
        if ((lvl.skills[s] || 0) > 0) {
          this.selectedSkill = s;
          return;
        }
      }
      this.selectedSkill = 'CLIMBER';
    }

    enterResultsScreen() {
      this.mode = 'RESULTS';
      this.showTracker = false;
      this.fastForward = false;
      this.paused = false;
      this.audio.setSpeedMultiplier(1.0);
      this.audio.setPaused(false);
      this.audio.startComposedReplay();
      this.syncHeaderBadges();
    }

    openLevelSelect() {
      this.mode = 'SELECT';
      this.showTracker = false;
      this.passwordMsg = '';
      this.audio.stopComposedReplay();
      this.syncHeaderBadges();
    }

    toggleCRT() {
      this.crtEnabled = !this.crtEnabled;
      document.body.classList.toggle('crt-on', this.crtEnabled);
      this.syncHeaderBadges();
    }

    togglePause() {
      if (this.mode !== 'PLAY') return;
      this.paused = !this.paused;
      this.audio.setPaused(this.paused);
      this.syncHeaderBadges();
    }

    toggleFastForward() {
      if (this.mode !== 'PLAY') return;
      this.fastForward = !this.fastForward;
      this.audio.setSpeedMultiplier(this.fastForward ? 2.0 : 1.0);
      this.syncHeaderBadges();
    }

    handleNukePress() {
      if (this.mode !== 'PLAY' || !this.sim || this.sim.nuking) return;
      if (this.nukeArmedFrames > 0) {
        this.nukeArmedFrames = 0;
        this.sim.triggerNuke();
      } else {
        this.nukeArmedFrames = 90; // 1.5s double-click / double-press confirmation window
      }
    }

    submitPassword() {
      const found = findLevelByPassword(this.passwordInput);
      if (found) {
        this.passwordMsg = `OK -> ${found.worldLabel}`;
        this.passwordInput = '';
        this.openBriefing(found.index);
      } else {
        this.passwordMsg = 'INVALID CODE!';
      }
    }

    syncHeaderBadges() {
      const setBtn = (id, active, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('active', !!active);
        if (text) el.textContent = text;
      };
      setBtn('hdr-crt', this.crtEnabled, `CRT [${this.crtEnabled ? 'ON' : 'OFF'}]`);
      setBtn('hdr-mute', this.audio.masterMuted, this.audio.masterMuted ? 'UNMUTE [M]' : 'MUTE [M]');
      setBtn('hdr-mixer', this.showTracker, 'MIXER [T]');
      setBtn('hdr-demo', this.sim && this.sim.demoMode && this.mode === 'PLAY', 'DEMO [D]');
    }

    // =======================================================================
    // INPUT EVENTS (MOUSE + KEYBOARD + HEADER BAR)
    // =======================================================================
    clientToFramebuffer(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - rect.left) / Math.max(1, rect.width)) * FB_W);
      const y = Math.floor(((clientY - rect.top) / Math.max(1, rect.height)) * FB_H);
      return {
        x: Math.max(0, Math.min(FB_W - 1, x)),
        y: Math.max(0, Math.min(FB_H - 1, y))
      };
    }

    scrollMinimapTo(mx) {
      if (!this.sim) return;
      const mm = HUD_LAYOUT.minimap;
      const u = Math.max(0, Math.min(1, (mx - (mm.x + 1)) / (mm.w - 2)));
      const worldX = u * this.sim.terrain.width - FB_W * 0.5;
      this.targetCamX = Math.max(0, Math.min(this.sim.terrain.width - FB_W, worldX));
      this.camX = this.targetCamX;
    }

    bindEvents() {
      // Prevent context menu on canvas so right-click drag pans smoothly
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());

      this.canvas.addEventListener('mousemove', e => {
        const pt = this.clientToFramebuffer(e.clientX, e.clientY);
        this.mouseX = pt.x;
        this.mouseY = pt.y;
        this.mouseInside = true;

        if (this.draggingMinimap) {
          this.scrollMinimapTo(pt.x);
        } else if (this.rightPanning && this.sim) {
          const dx = pt.x - this.panStartMouseX;
          this.targetCamX = Math.max(
            0,
            Math.min(this.sim.terrain.width - FB_W, this.panStartCamX - dx * 1.8)
          );
          this.camX = this.targetCamX;
        }
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouseInside = false;
        this.hoveredLemming = null;
        this.heldRateDelta = 0;
      });

      window.addEventListener('mouseup', () => {
        this.draggingMinimap = false;
        this.rightPanning = false;
        this.heldRateDelta = 0;
      });

      this.canvas.addEventListener('mousedown', e => {
        this.ensureAudio();
        const pt = this.clientToFramebuffer(e.clientX, e.clientY);
        this.mouseX = pt.x;
        this.mouseY = pt.y;

        // Right-click on playfield or minimap pans camera
        if (e.button === 2) {
          if (pt.y >= HUD_LAYOUT.minimap.y && pt.x >= HUD_LAYOUT.minimap.x) {
            this.draggingMinimap = true;
            this.scrollMinimapTo(pt.x);
          } else if (this.sim) {
            this.rightPanning = true;
            this.panStartMouseX = pt.x;
            this.panStartCamX = this.camX;
          }
          return;
        }

        if (e.button !== 0) return;

        // 1. Check active overlay/modal buttons first
        for (let i = this.renderer.hitRegions.length - 1; i >= 0; i--) {
          const r = this.renderer.hitRegions[i];
          if (pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h) {
            this.handleOverlayAction(r.id, r.data);
            return;
          }
        }

        // If on Briefing screen, clicking anywhere starts the level!
        if (this.mode === 'BRIEFING') {
          this.startLevel(this.currentLevelIdx, false);
          return;
        }
        if (this.mode !== 'PLAY' && this.mode !== 'TITLE') return;

        // 2. Bottom HUD Panel interactions (y >= 160)
        if (pt.y >= 160) {
          const mm = HUD_LAYOUT.minimap;
          const an = HUD_LAYOUT.analyser;

          if (pt.x >= mm.x && pt.y >= mm.y) {
            this.draggingMinimap = true;
            this.scrollMinimapTo(pt.x);
            return;
          }
          // Clicking Analyser or Stem Pips opens [T] Stem Mixer!
          if ((pt.x >= an.x && pt.x < an.x + an.w && pt.y >= an.y) ||
              (pt.x >= 184 && pt.x <= 224 && pt.y < 169)) {
            this.showTracker = !this.showTracker;
            this.syncHeaderBadges();
            return;
          }

          if (this.mode === 'PLAY' && pt.y >= HUD_LAYOUT.buttonsY && pt.x < 182) {
            const btnIdx = Math.floor(pt.x / 14);
            if (btnIdx === 0) {
              this.sim.adjustReleaseRate(-2);
              this.heldRateDelta = -1;
              this.heldRateTicks = 0;
            } else if (btnIdx === 1) {
              this.sim.adjustReleaseRate(2);
              this.heldRateDelta = 1;
              this.heldRateTicks = 0;
            } else if (btnIdx >= 2 && btnIdx <= 9) {
              this.selectedSkill = SKILL_LIST[btnIdx - 2];
              // If player clicks a skill while watching Demo, let them take over or play!
              if (this.sim.demoMode) {
                this.sim.demoMode = false;
                this.syncHeaderBadges();
              }
            } else if (btnIdx === 10) {
              this.togglePause();
            } else if (btnIdx === 11) {
              this.toggleFastForward();
            } else if (btnIdx === 12) {
              this.handleNukePress();
            }
          }
          return;
        }

        // 3. Playfield click: Assign selected skill to highlighted lemming!
        if (this.mode === 'TITLE') {
          this.openBriefing(this.currentLevelIdx);
          return;
        }
        if (this.mode === 'PLAY' && !this.showTracker && this.sim) {
          if (this.sim.demoMode) {
            // Take over live from the demo!
            this.sim.demoMode = false;
            this.syncHeaderBadges();
          }
          const beatPhase = this.audio.getBeatPhase(this.sim.frame);
          const wx = Math.round(this.camX) + pt.x;
          const lem = this.sim.findLemmingAt(wx, pt.y, this.selectedSkill, 10);
          if (lem) {
            this.sim.assignSkill(lem, this.selectedSkill, beatPhase);
          }
        }
      });

      // Keyboard Controls
      window.addEventListener('keydown', e => {
        const key = e.key;
        this.keysDown.add(key.toLowerCase());

        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) {
          e.preventDefault();
        }
        this.ensureAudio();

        // Password typing when in Level Select screen
        if (this.mode === 'SELECT') {
          if (key === 'Escape') {
            this.mode = 'TITLE';
            this.startAttractDemo(this.currentLevelIdx);
            return;
          }
          if (key === 'Backspace') {
            this.passwordInput = this.passwordInput.slice(0, -1);
            this.passwordMsg = '';
            e.preventDefault();
            return;
          }
          if (key === 'Enter') {
            if (this.passwordInput.length > 0) {
              this.submitPassword();
            } else {
              this.openBriefing(this.currentLevelIdx);
            }
            return;
          }
          if (/^[a-zA-Z0-9]$/.test(key) && !e.ctrlKey && !e.metaKey) {
            if (this.passwordInput.length < 5) {
              this.passwordInput += key.toUpperCase();
              this.passwordMsg = '';
            }
            return;
          }
          return;
        }

        // Global Shortcuts
        const lower = key.toLowerCase();
        if (lower === 'm') {
          this.audio.toggleMute();
          this.syncHeaderBadges();
          return;
        }
        if (lower === 'c') {
          this.toggleCRT();
          return;
        }
        if (lower === 't') {
          this.showTracker = !this.showTracker;
          this.syncHeaderBadges();
          return;
        }
        if (key === 'Escape') {
          if (this.showTracker) {
            this.showTracker = false;
            this.syncHeaderBadges();
          } else {
            this.openLevelSelect();
          }
          return;
        }

        // Mode-specific Enter/Space shortcuts
        if (this.mode === 'TITLE') {
          if (key === 'Enter' || key === ' ') {
            this.openBriefing(this.currentLevelIdx);
            return;
          }
          if (lower === 'd') {
            this.startLevel(this.currentLevelIdx, true);
            return;
          }
          if (lower === 'l') {
            this.openLevelSelect();
            return;
          }
        } else if (this.mode === 'BRIEFING') {
          if (key === 'Enter' || key === ' ') {
            this.startLevel(this.currentLevelIdx, false);
            return;
          }
          if (lower === 'd') {
            this.startLevel(this.currentLevelIdx, true);
            return;
          }
        } else if (this.mode === 'RESULTS') {
          if (key === 'Enter') {
            if (this.sim && this.sim.won && this.currentLevelIdx + 1 < LEVELS.length) {
              this.openBriefing(this.currentLevelIdx + 1);
            } else {
              this.startLevel(this.currentLevelIdx, false);
            }
            return;
          }
          if (lower === 'r') {
            this.startLevel(this.currentLevelIdx, false);
            return;
          }
          if (key === ' ') {
            this.audio.startComposedReplay();
            return;
          }
        }

        // Active Gameplay Shortcuts
        if (this.mode === 'PLAY') {
          if (key >= '1' && key <= '8') {
            this.selectedSkill = SKILL_LIST[parseInt(key, 10) - 1];
            return;
          }
          if (lower === 'p') {
            this.togglePause();
            return;
          }
          if (lower === 'f') {
            this.toggleFastForward();
            return;
          }
          if (lower === 'n') {
            this.handleNukePress();
            return;
          }
          if (key === '-' || key === '_') {
            this.sim.adjustReleaseRate(-3);
            return;
          }
          if (key === '+' || key === '=') {
            this.sim.adjustReleaseRate(3);
            return;
          }
          if (lower === 'r') {
            this.startLevel(this.currentLevelIdx, false);
            return;
          }
          // [D]: Shift+D always toggles Solution Demo; plain D tap starts Demo before first move, while holding A/D scrolls camera!
          if (lower === 'd' && !e.repeat) {
            this.dPressTime = performance.now();
            if (e.shiftKey || this.sim.demoMode) {
              this.startLevel(this.currentLevelIdx, !this.sim.demoMode);
              this.dHandledAsDemo = true;
              return;
            }
            this.dHandledAsDemo = false;
          }
        }
      });

      window.addEventListener('keyup', e => {
        const lower = e.key.toLowerCase();
        this.keysDown.delete(lower);
        if (lower === 'd' && this.mode === 'PLAY' && !this.dHandledAsDemo && this.sim) {
          const heldMs = performance.now() - (this.dPressTime || 0);
          if (heldMs < 220 && this.sim.recordedCommands.length === 0 && !this.sim.demoMode) {
            this.startLevel(this.currentLevelIdx, true);
          }
        }
      });

      // Top Header Quick-Action Buttons
      const bindHdr = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => { this.ensureAudio(); fn(); });
      };
      bindHdr('hdr-levels', () => this.openLevelSelect());
      bindHdr('hdr-demo', () => this.startLevel(this.currentLevelIdx, !(this.sim && this.sim.demoMode && this.mode === 'PLAY')));
      bindHdr('hdr-restart', () => this.startLevel(this.currentLevelIdx, false));
      bindHdr('hdr-mixer', () => { this.showTracker = !this.showTracker; this.syncHeaderBadges(); });
      bindHdr('hdr-mute', () => { this.audio.toggleMute(); this.syncHeaderBadges(); });
      bindHdr('hdr-crt', () => this.toggleCRT());
    }

    handleOverlayAction(id, data) {
      switch (id) {
        case 'START_GAME':
          this.openBriefing(this.currentLevelIdx);
          break;
        case 'BEGIN_LEVEL':
          this.startLevel(this.currentLevelIdx, false);
          break;
        case 'WATCH_DEMO':
          this.startLevel(this.currentLevelIdx, true);
          break;
        case 'OPEN_SELECT':
          this.openLevelSelect();
          break;
        case 'CLOSE_SELECT':
          this.mode = 'TITLE';
          this.startAttractDemo(this.currentLevelIdx);
          break;
        case 'WARP_LEVEL':
          this.openBriefing(data);
          break;
        case 'SUBMIT_CODE':
          this.submitPassword();
          break;
        case 'CLOSE_TRACKER':
          this.showTracker = false;
          this.syncHeaderBadges();
          break;
        case 'STEM_MUTE':
          this.audio.toggleStemMute(data);
          break;
        case 'STEM_SOLO':
          this.audio.toggleStemSolo(data);
          break;
        case 'NEXT_LEVEL':
          if (this.currentLevelIdx + 1 < LEVELS.length) {
            this.openBriefing(this.currentLevelIdx + 1);
          } else {
            this.openLevelSelect();
          }
          break;
        case 'RETRY_LEVEL':
          this.startLevel(this.currentLevelIdx, false);
          break;
        case 'REPLAY_SONG':
          this.audio.startComposedReplay();
          break;
      }
    }

    // =======================================================================
    // LOCKED 60 FPS GAME LOOP
    // =======================================================================
    frameLoop(now) {
      const STEP_MS = 1000 / 60;
      const dt = Math.min(100, Math.max(0, now - this.lastFrameTime));
      this.lastFrameTime = now;
      this.accumulatorMs += dt;

      while (this.accumulatorMs >= STEP_MS) {
        this.accumulatorMs -= STEP_MS;
        this.fixedUpdate();
      }

      this.render();
      requestAnimationFrame(t => this.frameLoop(t));
    }

    fixedUpdate() {
      this.visualTick++;
      if (this.nukeArmedFrames > 0) this.nukeArmedFrames--;

      // Continuous +/- release rate hold
      if (this.heldRateDelta !== 0 && this.sim && this.mode === 'PLAY') {
        this.heldRateTicks++;
        if (this.heldRateTicks > 8 && (this.heldRateTicks % 3 === 0)) {
          this.sim.adjustReleaseRate(this.heldRateDelta);
        }
      }

      // Smooth keyboard camera scrolling (Left/Right or A/D)
      if (this.sim && (this.mode === 'PLAY' || this.mode === 'TITLE' || this.mode === 'BRIEFING')) {
        const scrollSpd = 4.5;
        if (this.keysDown.has('arrowleft') || this.keysDown.has('a')) {
          this.targetCamX -= scrollSpd;
        }
        if (this.keysDown.has('arrowright') || this.keysDown.has('d')) {
          this.targetCamX += scrollSpd;
        }
        this.targetCamX = Math.max(0, Math.min(this.sim.terrain.width - FB_W, this.targetCamX));
      }

      // Step simulation
      if (this.mode === 'TITLE' && this.sim) {
        const beat = this.audio.getBeatPhase(this.sim.frame);
        this.sim.step(beat);
        // Auto-follow pioneer lemming smoothly during Attract Mode!
        const lead = this.sim.lemmings[0];
        if (lead && lead.alive && !lead.saved) {
          this.targetCamX = Math.max(0, Math.min(this.sim.terrain.width - FB_W, lead.x - FB_W * 0.45));
        }
        if (this.sim.finished || this.sim.frame > 2400) {
          this.attractOrderIdx = (this.attractOrderIdx + 1) % this.attractCycleOrder.length;
          this.startAttractDemo(this.attractCycleOrder[this.attractOrderIdx]);
        }
      } else if (this.mode === 'PLAY' && this.sim && !this.paused) {
        const steps = this.fastForward ? 2 : 1;
        for (let s = 0; s < steps; s++) {
          const beat = this.audio.getBeatPhase(this.sim.frame);
          this.sim.step(beat);
          if (this.sim.finished) {
            this.enterResultsScreen();
            break;
          }
        }
        // Auto-follow virtual demo cursor during [D] Demo playback unless user scrolls manually
        if (this.sim.demoMode && !this.draggingMinimap && !this.rightPanning &&
            !this.keysDown.has('arrowleft') && !this.keysDown.has('arrowright')) {
          const focusX = this.sim.demoCursor.active
            ? this.sim.demoCursor.x
            : (this.sim.lemmings[0] && this.sim.lemmings[0].alive ? this.sim.lemmings[0].x : this.camX + 160);
          this.targetCamX = Math.max(0, Math.min(this.sim.terrain.width - FB_W, focusX - FB_W * 0.45));
        }
      }

      // Smooth camera interpolation
      this.camX += (this.targetCamX - this.camX) * 0.22;
      if (Math.abs(this.targetCamX - this.camX) < 0.2) this.camX = this.targetCamX;

      // Update hovered lemming under crosshair
      if (this.mode === 'PLAY' && this.sim && this.mouseInside && this.mouseY < PLAY_H && !this.showTracker) {
        const wx = Math.round(this.camX) + this.mouseX;
        this.hoveredLemming = this.sim.findLemmingAt(wx, this.mouseY, this.selectedSkill, 10);
      } else {
        this.hoveredLemming = null;
      }
    }

    render() {
      this.renderer.clearHitRegions();

      if (this.mode === 'SELECT') {
        this.renderer.renderLevelSelectOverlay(
          LEVELS,
          this.currentLevelIdx,
          this.passwordInput,
          this.passwordMsg
        );
        this.renderer.present();
        return;
      }

      if (this.mode === 'RESULTS' && this.sim) {
        const nextLvl = LEVELS[this.currentLevelIdx + 1];
        this.renderer.renderResultsScreen(this.sim, this.audio, nextLvl ? nextLvl.code : null);
        this.renderer.present();
        return;
      }

      // Render Playfield + Classic Bottom HUD
      if (this.sim) {
        const beatPhase = this.audio.getBeatPhase(this.sim.frame);
        this.renderer.renderPlayfield(this.sim, this.camX, beatPhase, this.visualTick);

        if (this.mode === 'PLAY' && !this.showTracker) {
          if (this.hoveredLemming) {
            this.renderer.drawLemmingHighlight(this.hoveredLemming, this.camX);
          }
          if (this.mouseInside && this.mouseY < PLAY_H) {
            const cCol = this.hoveredLemming
              ? BeatTribe.Font.packRGBA(120, 255, 168)
              : BeatTribe.Font.packRGBA(255, 255, 255);
            this.renderer.drawCrosshair(this.mouseX, this.mouseY, cCol, true);
          }
        }

        this.renderer.renderHUD(
          this.sim,
          {
            selectedSkill: this.selectedSkill,
            hoveredLemming: this.hoveredLemming,
            paused: this.paused,
            fastForward: this.fastForward,
            nukeArmedFrames: this.nukeArmedFrames
          },
          this.audio,
          this.camX,
          beatPhase,
          this.visualTick
        );

        if (this.mode === 'TITLE') {
          this.renderer.renderTitleOverlay(this.sim, this.audio, this.visualTick);
        } else if (this.mode === 'BRIEFING') {
          this.renderer.renderBriefingOverlay(LEVELS[this.currentLevelIdx]);
        }

        if (this.showTracker) {
          this.renderer.renderTrackerOverlay(this.audio);
        }
      }

      this.renderer.present();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    BeatTribe.app = new BeatTribeApp();
  });
})(typeof window !== 'undefined' ? window : globalThis);
