/**
 * Lemmings: Beat Tribe — Fixed 60 Hz Deterministic Simulation Engine (sim.js)
 *
 * Features:
 * - Seeded Mulberry32 PRNG for 100% deterministic simulation & solution demo playback
 * - All 8 classic Lemmings skills + permanent athlete flags + Nuke sequential countdown
 * - Hazard interactions: Water (drown), Lava/Fire (burn), Piston Crushers, Steel, One-Way walls
 * - Beat Tribe mechanics: Quantized Note Terrain footsteps, Skill Instruments, Stem unlocks,
 *   On-Beat Groove Bonus, and Creeping Silence + musical pushback
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const Font = BeatTribe.Font || (typeof require !== 'undefined' ? require('./font.js') : null);
  const TerrainMod = BeatTribe.Terrain || (typeof require !== 'undefined' ? require('./terrain.js') : null);
  const { packRGBA } = Font;
  const { MAT } = TerrainMod;

  const SKILL_LIST = [
    'CLIMBER',
    'FLOATER',
    'BOMBER',
    'BLOCKER',
    'BUILDER',
    'BASHER',
    'MINER',
    'DIGGER'
  ];

  const MAX_SAFE_FALL = 62;

  function makeMulberry32(seed) {
    let a = (seed >>> 0) || 0x12345678;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Lemming {
    constructor(index, x, y) {
      this.index = index;
      this.x = x | 0;
      this.y = y | 0;
      this.dir = 1; // +1 right, -1 left
      this.state = 'FALL';
      this.alive = true;
      this.saved = false;

      // Permanent athlete skills
      this.isClimber = false;
      this.isFloater = false;

      // Counters & timers
      this.animFrame = 0;
      this.stateTimer = 0;
      this.skillTimer = 0;
      this.stepCounter = 0;
      this.fallDist = 0;
      this.climbPixels = 0;
      this.bricksLaid = 0;
      this.buildStartDeg = 0;
      this.bashStrokes = 0;
      this.mineStrokes = 0;
      this.digStrokes = 0;
      this.bombTimer = -1; // >0 counting down, 0 triggers OHNO

      // Silence hazard exposure
      this.silenceLevel = 0;
      this.silenceExposure = 0;
      this.panicking = false;
    }

    getLabel() {
      if (this.panicking) return 'SILENCED #' + (this.index + 1);
      const tag = (this.isClimber && this.isFloater) ? 'ATHLETE'
        : (this.isClimber ? 'CLIMBER' : (this.isFloater ? 'FLOATER' : null));
      if (this.state === 'WALK' && tag) return tag + ' #' + (this.index + 1);
      const map = {
        WALK: 'WALKER',
        FALL: 'FALLER',
        FLOAT: 'FLOATER',
        CLIMB: 'CLIMBER',
        BUILD: 'BUILDER',
        SHRUG: 'SHRUGGER',
        BASH: 'BASHER',
        MINE: 'MINER',
        DIG: 'DIGGER',
        BLOCK: 'BLOCKER',
        OHNO: 'BOMBER',
        SPLAT: 'SPLAT',
        DROWN: 'DROWNING',
        BURN: 'BURNING',
        CELEBRATE: 'EXITING'
      };
      return (map[this.state] || this.state) + ' #' + (this.index + 1);
    }
  }

  class GameSim {
    constructor(levelDef, audioEngine = null, options = {}) {
      this.level = levelDef;
      this.audio = audioEngine;
      this.demoMode = !!options.demoMode;
      this.attractMode = !!options.attractMode;

      // Deterministic RNGs: gameplay RNG strictly isolated from cosmetic particle RNG
      this.rng = makeMulberry32(levelDef.seed || 424242);
      this.fxRng = makeMulberry32((levelDef.seed || 424242) ^ 0x9e3779b9);

      // Build terrain from level definition
      this.terrain = levelDef.buildTerrain();
      this.worldId = levelDef.worldId;

      // Level parameters
      this.totalLemmings = levelDef.lemmingCount;
      this.saveReqPct = levelDef.saveReqPct;
      this.minReleaseRate = levelDef.minReleaseRate || 25;
      this.releaseRate = levelDef.initialReleaseRate || 50;
      this.timeLimitFrames = (levelDef.timeLimitSec || 240) * 60;
      this.timeRemainingFrames = this.timeLimitFrames;

      // Copy skill budget
      this.skills = {};
      for (const s of SKILL_LIST) {
        this.skills[s] = (levelDef.skills && levelDef.skills[s]) || 0;
      }

      // Simulation state
      this.frame = 0;
      this.hatchOpenProgress = 0;
      this.spawnedCount = 0;
      this.nextSpawnFrame = 42;
      this.savedCount = 0;
      this.deadCount = 0;
      this.lemmings = [];
      this.particles = [];
      this.floatingTexts = []; // { x, y, text, color, life }

      // Nuke state
      this.nuking = false;
      this.nukeCursor = 0;

      // Groove & Stem progress
      this.grooveScore = 0;
      this.grooveStreak = 0;
      this.onBeatHits = 0;
      this.unlockedStems = 0; // 0..5
      this.exitFlash = 0;
      this.finished = false;
      this.won = false;

      // Demo playback & live recording
      this.demoEvents = (levelDef.demo || []).slice().sort((a, b) => a.frame - b.frame);
      this.demoPtr = 0;
      this.demoCursor = { x: levelDef.hatch.x, y: levelDef.hatch.y + 16, active: false, label: '' };
      this.recordedCommands = [];

      if (this.audio && !this.attractMode) {
        this.audio.startLevelRecording(this.worldId);
      } else if (this.audio && this.attractMode) {
        this.audio.setWorld(this.worldId, false);
      }
    }

    getSpawnInterval() {
      return Math.max(4, Math.round(106 - this.releaseRate));
    }

    panForX(x) {
      return ((x / Math.max(1, this.terrain.width)) * 2 - 1) * 0.75;
    }

    adjustReleaseRate(delta) {
      if (this.nuking) return false;
      const next = Math.max(this.minReleaseRate, Math.min(99, this.releaseRate + delta));
      if (next !== this.releaseRate) {
        this.releaseRate = next;
        return true;
      }
      return false;
    }

    setReleaseRate(val) {
      if (this.nuking) return;
      this.releaseRate = Math.max(this.minReleaseRate, Math.min(99, val | 0));
    }

    triggerNuke() {
      if (this.nuking) return;
      this.nuking = true;
      this.nukeCursor = 0;
    }

    canAssignSkill(lem, skill) {
      if (!lem || !lem.alive || lem.saved) return false;
      const fatal = ['OHNO', 'SPLAT', 'DROWN', 'BURN', 'CELEBRATE'];
      if (fatal.includes(lem.state)) return false;
      if (this.skills[skill] <= 0) return false;

      switch (skill) {
        case 'CLIMBER':
          return !lem.isClimber;
        case 'FLOATER':
          return !lem.isFloater;
        case 'BOMBER':
          return lem.bombTimer < 0;
        case 'BLOCKER':
          return ['WALK', 'BUILD', 'SHRUG', 'BASH', 'MINE', 'DIG'].includes(lem.state) &&
                 this.terrain.isSolid(lem.x, lem.y);
        case 'BUILDER':
          return ['WALK', 'SHRUG', 'BASH', 'MINE', 'DIG'].includes(lem.state) &&
                 this.terrain.isSolid(lem.x, lem.y);
        case 'BASHER':
          return ['WALK', 'BUILD', 'SHRUG', 'MINE', 'DIG'].includes(lem.state) &&
                 this.terrain.isSolid(lem.x, lem.y);
        case 'MINER':
          return ['WALK', 'BUILD', 'SHRUG', 'BASH', 'DIG'].includes(lem.state) &&
                 this.terrain.isSolid(lem.x, lem.y);
        case 'DIGGER':
          return ['WALK', 'BUILD', 'SHRUG', 'BASH', 'MINE'].includes(lem.state) &&
                 this.terrain.isSolid(lem.x, lem.y) &&
                 this.terrain.getMat(lem.x, lem.y) !== MAT.STEEL;
        default:
          return false;
      }
    }

    // Find best lemming under cursor at world (wx, wy), prioritizing assignable lemmings!
    findLemmingAt(wx, wy, preferredSkill = null, radius = 9) {
      let best = null;
      let bestScore = -1e9;
      for (let i = 0; i < this.lemmings.length; i++) {
        const lem = this.lemmings[i];
        if (!lem.alive || lem.saved) continue;
        const cx = lem.x;
        const cy = lem.y - 4;
        const dx = cx - wx;
        const dy = cy - wy;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;

        let score = (radius - dist) * 10;
        if (preferredSkill && this.canAssignSkill(lem, preferredSkill)) {
          score += 500;
          // If assigning Bomber and cursor is near a Blocker, slightly favor Blocker so freeing crowds is effortless
          if (preferredSkill === 'BOMBER' && lem.state === 'BLOCK') score += 80;
          // If assigning Builder while a Builder is shrugging, strongly favor the shrugging Builder to chain stairs!
          if (preferredSkill === 'BUILDER' && lem.state === 'SHRUG') score += 120;
        }
        if (score > bestScore) {
          bestScore = score;
          best = lem;
        }
      }
      return best;
    }

    assignSkillToIndex(lemIdx, skill, beatPhase = 0.5) {
      const lem = this.lemmings[lemIdx];
      return this.assignSkill(lem, skill, beatPhase);
    }

    assignSkill(lem, skill, beatPhase = 0.5) {
      if (!this.canAssignSkill(lem, skill)) return false;

      this.skills[skill]--;
      this.recordedCommands.push({
        frame: this.frame,
        type: 'skill',
        lemmingIndex: lem.index,
        skill
      });

      // Assigning a skill restores rhythm if silenced!
      lem.panicking = false;
      lem.silenceExposure = 0;
      this.terrain.pushSilence(lem.x, lem.y, 44, 0.55);

      const pan = this.panForX(lem.x);

      switch (skill) {
        case 'CLIMBER':
          lem.isClimber = true;
          if (this.audio) this.audio.playSkillClimb(this.terrain.getMidiAt(lem.x, lem.y), pan);
          break;
        case 'FLOATER':
          lem.isFloater = true;
          if (lem.state === 'FALL' && lem.fallDist >= 8) {
            lem.state = 'FLOAT';
            lem.fallDist = 0;
          }
          if (this.audio) this.audio.playSkillFloat(this.terrain.getMidiAt(lem.x, lem.y), pan);
          break;
        case 'BOMBER':
          lem.bombTimer = 180; // 3.0s crisp 5-4-3-2-1 countdown
          break;
        case 'BLOCKER':
          lem.state = 'BLOCK';
          lem.stateTimer = 0;
          lem.skillTimer = 0;
          break;
        case 'BUILDER':
          lem.state = 'BUILD';
          lem.stateTimer = 0;
          lem.skillTimer = 0;
          lem.bricksLaid = 0;
          lem.buildStartDeg = this.terrain.getDegreeAt(lem.x, lem.y);
          break;
        case 'BASHER':
          lem.state = 'BASH';
          lem.stateTimer = 0;
          lem.skillTimer = 0;
          lem.bashStrokes = 0;
          break;
        case 'MINER':
          lem.state = 'MINE';
          lem.stateTimer = 0;
          lem.skillTimer = 0;
          lem.mineStrokes = 0;
          break;
        case 'DIGGER':
          lem.state = 'DIG';
          lem.stateTimer = 0;
          lem.skillTimer = 0;
          lem.digStrokes = 0;
          break;
      }

      // ON-BEAT GROOVE BONUS (never required, always immediate, rewards rhythmic play!)
      const distToBeat = Math.min(beatPhase, 1 - beatPhase);
      if (distToBeat <= 0.19) {
        this.grooveStreak++;
        this.onBeatHits++;
        const bonus = 100 * Math.min(8, this.grooveStreak);
        this.grooveScore += bonus;
        if (this.audio) this.audio.playGrooveSparkle(this.grooveStreak);
        this.spawnBurst(lem.x, lem.y - 6, 12, packRGBA(255, 232, 82), 1.8);
        this.addFloatingText(
          lem.x,
          lem.y - 14,
          this.grooveStreak > 1 ? `BEAT X${this.grooveStreak}!` : 'ON BEAT!',
          packRGBA(255, 238, 92)
        );
      } else {
        this.grooveStreak = 0;
        this.grooveScore += 20;
        this.spawnBurst(lem.x, lem.y - 5, 5, packRGBA(120, 224, 255), 1.0);
      }

      return true;
    }

    spawnBurst(wx, wy, count, baseCol, speedScale = 1.2) {
      const palette = [
        baseCol,
        packRGBA(255, 240, 110),
        packRGBA(82, 246, 212),
        packRGBA(255, 96, 168),
        packRGBA(112, 168, 255)
      ];
      for (let i = 0; i < count; i++) {
        const ang = this.fxRng() * Math.PI * 2;
        const spd = (0.4 + this.fxRng() * 1.9) * speedScale;
        this.particles.push({
          x: wx,
          y: wy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 0.9,
          color: palette[i % palette.length],
          life: 16 + Math.floor(this.fxRng() * 20)
        });
      }
    }

    addFloatingText(wx, wy, text, color) {
      this.floatingTexts.push({ x: wx, y: wy, text, color, life: 42 });
    }

    // Advance exactly 1 deterministic 60 Hz frame
    step(beatPhase = 0.0) {
      if (this.finished) return;
      if (this.audio && this.audio.setSimFrame) {
        this.audio.setSimFrame(this.frame);
      }

      // 0. Execute scripted demo events for this exact frame if in Demo Mode
      if (this.demoMode) {
        // Preview virtual demo cursor moving toward upcoming target lemming
        const upcoming = this.demoEvents[this.demoPtr];
        if (upcoming && upcoming.frame - this.frame <= 45) {
          const targetLem = this.lemmings[upcoming.lemmingIndex];
          if (targetLem && targetLem.alive) {
            this.demoCursor.active = true;
            this.demoCursor.x += (targetLem.x - this.demoCursor.x) * 0.25;
            this.demoCursor.y += ((targetLem.y - 4) - this.demoCursor.y) * 0.25;
            this.demoCursor.label = upcoming.skill || '';
          }
        } else {
          this.demoCursor.active = false;
        }

        while (this.demoPtr < this.demoEvents.length && this.demoEvents[this.demoPtr].frame <= this.frame) {
          const cmd = this.demoEvents[this.demoPtr++];
          if (cmd.type === 'rate') {
            this.setReleaseRate(cmd.rate);
          } else {
            this.assignSkillToIndex(cmd.lemmingIndex, cmd.skill, beatPhase);
          }
        }
      }

      // 1. Entrance Hatch animation & "Let's go!" stab
      if (this.frame === 8 && this.audio && !this.attractMode) {
        this.audio.playLetsGo();
      }
      if (this.frame >= 10 && this.hatchOpenProgress < 1) {
        this.hatchOpenProgress = Math.min(1, (this.frame - 10) / 24);
      }

      // 2. Spawn Lemmings according to Release Rate
      if (!this.nuking && this.spawnedCount < this.totalLemmings && this.frame >= this.nextSpawnFrame) {
        const lem = new Lemming(this.spawnedCount, this.level.hatch.x, this.level.hatch.y + 4);
        this.lemmings.push(lem);
        this.spawnedCount++;
        this.nextSpawnFrame = this.frame + this.getSpawnInterval();
      }

      // 3. Nuke sequential Bomber arming (1 lemming every 3 frames, just like Amiga Lemmings!)
      if (this.nuking && (this.frame % 3 === 0)) {
        while (this.nukeCursor < this.lemmings.length) {
          const lem = this.lemmings[this.nukeCursor++];
          if (lem.alive && !lem.saved && lem.bombTimer < 0) {
            lem.bombTimer = 120;
            break;
          }
        }
      }

      // 4. Step Terrain effects (Note-Block flashes, Creeping Silence, Piston Crushers)
      this.terrain.stepEffects(this.frame);
      for (const c of this.terrain.crushers) {
        if (c.justSlammed && this.audio) {
          this.audio.playSteelClang(this.panForX(c.x + c.width * 0.5));
        }
      }

      // 5. Gather active Blockers
      const blockers = [];
      for (let i = 0; i < this.lemmings.length; i++) {
        const l = this.lemmings[i];
        if (l.alive && !l.saved && l.state === 'BLOCK') {
          blockers.push(l);
        }
      }
      if (this.audio) {
        this.audio.syncBlockers(blockers.length);
      }

      // 6. Step every Lemming deterministically
      let activeCount = 0;
      for (let i = 0; i < this.lemmings.length; i++) {
        const lem = this.lemmings[i];
        if (!lem.alive || lem.saved) continue;
        activeCount++;
        this.stepLemming(lem, blockers);
      }

      // 7. Update cosmetic particles & floating Groove popups
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 0.35;
        ft.life--;
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }
      if (this.exitFlash > 0) this.exitFlash--;

      // 8. Countdown clock & Check level completion
      if (this.timeRemainingFrames > 0) {
        this.timeRemainingFrames--;
      }

      const allSpawned = (this.spawnedCount >= this.totalLemmings || this.nuking);
      if ((allSpawned && activeCount === 0) || this.timeRemainingFrames <= 0) {
        this.finished = true;
        this.won = this.getSavedPct() >= this.saveReqPct;
        if (this.audio) this.audio.stopBlockerDrone();
      }

      this.frame++;
    }

    stepLemming(lem, blockers) {
      lem.stateTimer++;
      lem.skillTimer++;
      if ((this.frame & 3) === 0) lem.animFrame++;

      const terrain = this.terrain;
      const pan = this.panForX(lem.x);

      // Terminal animations
      if (lem.state === 'SPLAT' || lem.state === 'DROWN' || lem.state === 'BURN') {
        if (lem.stateTimer >= 30) {
          lem.alive = false;
          this.deadCount++;
        }
        return;
      }

      if (lem.state === 'CELEBRATE') {
        if (lem.stateTimer >= 28) {
          lem.saved = true;
          this.savedCount++;
          const savedPct = this.getSavedPct();
          if (this.audio) {
            const newStem = this.audio.setSavedPercentage(savedPct);
            if (newStem >= 0) {
              this.unlockedStems = Math.max(this.unlockedStems, newStem + 1);
              if (!this.attractMode) {
                this.audio.playStemUnlockFanfare(newStem);
                const stemName = ['DRUMS', 'BASS', 'CHORDS', 'LEAD', 'FULL MIX'][newStem];
                this.addFloatingText(
                  this.level.exit.x,
                  this.level.exit.y - 26,
                  `+${stemName}!`,
                  packRGBA(110, 255, 168)
                );
              }
            } else {
              this.unlockedStems = Math.floor((savedPct + 0.001) / 20);
            }
          } else {
            this.unlockedStems = Math.floor((savedPct + 0.001) / 20);
          }
        }
        return;
      }

      // Bomber Countdown -> OHNO -> Detonation
      if (lem.bombTimer > 0) {
        lem.bombTimer--;
        if (lem.bombTimer === 0) {
          lem.state = 'OHNO';
          lem.stateTimer = 0;
          if (this.audio) this.audio.playOhNo(pan);
          return;
        }
      }
      if (lem.state === 'OHNO') {
        if (lem.stateTimer >= 22) {
          terrain.carveOval(lem.x, lem.y - 3, 11, 14);
          terrain.pushSilence(lem.x, lem.y, 76, 1.0);
          if (this.audio) this.audio.playBomberDetonate(pan);
          this.spawnBurst(lem.x, lem.y - 4, 32, packRGBA(255, 148, 48), 2.1);
          lem.alive = false;
          this.deadCount++;
        }
        return;
      }

      // Check Abyss bottom out-of-bounds
      if (lem.y >= terrain.height + 3) {
        lem.alive = false;
        this.deadCount++;
        return;
      }

      // Check Liquid / Fire Hazards at feet & lower body
      const haz = terrain.getHazard(lem.x, lem.y - 1) || terrain.getHazard(lem.x, lem.y);
      if (haz === MAT.WATER) {
        lem.state = 'DROWN';
        lem.stateTimer = 0;
        this.spawnBurst(lem.x, lem.y - 2, 10, packRGBA(92, 214, 255), 1.0);
        return;
      }
      if (haz === MAT.LAVA || haz === MAT.FIRE) {
        lem.state = 'BURN';
        lem.stateTimer = 0;
        this.spawnBurst(lem.x, lem.y - 3, 14, packRGBA(255, 128, 32), 1.4);
        return;
      }

      // Check Piston Crushers
      for (const c of terrain.crushers) {
        if (c.curExt > 4) {
          const headBottom = c.yTop + c.curExt;
          if (lem.x >= c.x && lem.x < c.x + c.width &&
              lem.y - 2 >= c.yTop && lem.y - 6 <= headBottom) {
            lem.state = 'BURN';
            lem.stateTimer = 0;
            this.spawnBurst(lem.x, lem.y - 4, 16, packRGBA(255, 96, 48), 1.6);
            return;
          }
        }
      }

      // Check THE SILENCE exposure
      lem.silenceLevel = terrain.getSilenceAt(lem.x, lem.y - 3);
      if (lem.state === 'BLOCK') {
        // Blocker's chord-root drone actively banishes Silence in a wide aura!
        terrain.pushSilence(lem.x, lem.y - 3, 58, 0.14);
        lem.silenceLevel = 0;
        lem.silenceExposure = 0;
        lem.panicking = false;
      } else if (lem.silenceLevel > 0.65) {
        lem.silenceExposure++;
        if (lem.silenceExposure > 180) {
          lem.panicking = true;
          // Panicking lemmings lose rhythm and wander aimlessly!
          if (lem.silenceExposure % 48 === 0 && lem.state === 'WALK') {
            lem.dir = this.rng() < 0.5 ? -1 : 1;
          }
        }
      } else {
        lem.silenceExposure = Math.max(0, lem.silenceExposure - 3);
        if (lem.silenceExposure === 0) lem.panicking = false;
      }

      // Check Exit Door arrival (standing near exit portal and not panicking in deep Silence)
      const ex = this.level.exit;
      if (!lem.panicking &&
          lem.state !== 'FALL' && lem.state !== 'FLOAT' && lem.state !== 'BLOCK' &&
          Math.abs(lem.x - ex.x) <= 6 && Math.abs(lem.y - ex.y) <= 6) {
        lem.state = 'CELEBRATE';
        lem.stateTimer = 0;
        this.exitFlash = 16;
        this.grooveScore += 50;
        if (this.audio) this.audio.playExitChord(this.savedCount + 1);
        this.spawnBurst(ex.x, ex.y - 10, 10, packRGBA(255, 232, 92), 1.3);
        return;
      }

      // Blocker repulsion field for non-blocking, non-climbing lemmings
      if (lem.state !== 'BLOCK' && lem.state !== 'CLIMB' && lem.state !== 'FALL' && lem.state !== 'FLOAT') {
        for (let b = 0; b < blockers.length; b++) {
          const blk = blockers[b];
          if (blk === lem) continue;
          if (Math.abs(lem.x - blk.x) <= 5 && Math.abs(lem.y - blk.y) <= 8) {
            const wantDir = lem.x <= blk.x ? -1 : 1;
            if (lem.dir !== wantDir) {
              lem.dir = wantDir;
            }
          }
        }
      }

      // State Machine Execution
      switch (lem.state) {
        case 'FALL':
        case 'FLOAT': {
          if (lem.isFloater && lem.state === 'FALL' && lem.fallDist >= 14) {
            lem.state = 'FLOAT';
            lem.fallDist = 0;
            if (this.audio) this.audio.playSkillFloat(terrain.getMidiAt(lem.x, lem.y), pan);
          }
          const maxPixels = (lem.state === 'FLOAT') ? 1 : 2;
          if (lem.state === 'FLOAT' && lem.stateTimer % 36 === 0) {
            terrain.pushSilence(lem.x, lem.y, 38, 0.28);
            if (this.audio) this.audio.playSkillFloat(terrain.getMidiAt(lem.x, lem.y), pan);
          }
          for (let step = 0; step < maxPixels; step++) {
            if (terrain.isSolid(lem.x, lem.y)) {
              if (lem.state === 'FALL' && lem.fallDist > MAX_SAFE_FALL) {
                lem.state = 'SPLAT';
                lem.stateTimer = 0;
                this.spawnBurst(lem.x, lem.y - 2, 10, packRGBA(72, 138, 255), 1.0);
              } else {
                lem.state = 'WALK';
                lem.stateTimer = 0;
                lem.fallDist = 0;
                this.emitFootstep(lem);
              }
              return;
            }
            lem.y++;
            if (lem.state === 'FALL') lem.fallDist++;
          }
          if (terrain.isSolid(lem.x, lem.y)) {
            if (lem.state === 'FALL' && lem.fallDist > MAX_SAFE_FALL) {
              lem.state = 'SPLAT';
              lem.stateTimer = 0;
            } else {
              lem.state = 'WALK';
              lem.stateTimer = 0;
              lem.fallDist = 0;
              this.emitFootstep(lem);
            }
          }
          break;
        }

        case 'WALK': {
          // Verify ground still beneath feet
          if (!terrain.isSolid(lem.x, lem.y)) {
            let snapped = false;
            for (let d = 1; d <= 3; d++) {
              if (terrain.isSolid(lem.x, lem.y + d)) {
                lem.y += d;
                snapped = true;
                break;
              }
            }
            if (!snapped) {
              lem.state = 'FALL';
              lem.fallDist = 0;
              return;
            }
          }

          // Silence slows walking down by 50%!
          if (lem.silenceLevel > 0.65 && (this.frame & 1) === 1) {
            return;
          }

          const nx = lem.x + lem.dir;
          // Measure step height at nx (0..6)
          let stepUp = 0;
          while (stepUp <= 6 && terrain.isSolid(nx, lem.y - 1 - stepUp)) {
            stepUp++;
          }

          if (stepUp === 0) {
            lem.x = nx;
            if (!terrain.isSolid(lem.x, lem.y)) {
              let down = 0;
              for (let d = 1; d <= 3; d++) {
                if (terrain.isSolid(lem.x, lem.y + d)) {
                  down = d;
                  break;
                }
              }
              if (down > 0) {
                lem.y += down;
              } else {
                lem.state = 'FALL';
                lem.fallDist = 0;
                return;
              }
            }
          } else if (stepUp <= 5 && !terrain.isSolid(nx, lem.y - stepUp - 6)) {
            lem.x = nx;
            lem.y -= stepUp;
          } else {
            // Vertical wall (>= 6px high)
            if (lem.isClimber && !lem.panicking && !terrain.isSolid(lem.x, lem.y - 9)) {
              lem.state = 'CLIMB';
              lem.stateTimer = 0;
              lem.climbPixels = 0;
              return;
            }
            lem.dir = -lem.dir;
          }

          lem.stepCounter++;
          if (lem.stepCounter % 10 === 0) {
            this.emitFootstep(lem);
          }
          break;
        }

        case 'CLIMB': {
          if ((this.frame & 1) === 1) return; // 0.5px/frame authentic climb speed
          const wx = lem.x + lem.dir;
          // Overhang ceiling check
          if (terrain.isSolid(lem.x, lem.y - 9)) {
            lem.dir = -lem.dir;
            lem.state = 'FALL';
            lem.fallDist = 0;
            return;
          }
          // Check if reached top ledge of wall
          if (!terrain.isSolid(wx, lem.y - 1) && !terrain.isSolid(wx, lem.y - 3) && !terrain.isSolid(wx, lem.y - 6)) {
            lem.x = wx;
            while (!terrain.isSolid(lem.x, lem.y) && lem.y < terrain.height) {
              lem.y++;
            }
            lem.state = 'WALK';
            lem.stateTimer = 0;
            this.emitFootstep(lem);
            return;
          }
          lem.y--;
          lem.climbPixels++;
          if (lem.climbPixels % 6 === 1) {
            const midi = terrain.getMidiAt(wx, lem.y) + Math.min(12, Math.floor(lem.climbPixels / 5));
            if (this.audio) this.audio.playSkillClimb(midi, pan);
            terrain.triggerNoteFlash(wx, lem.y, terrain.getDegreeAt(wx, lem.y), 190);
            terrain.pushSilence(wx, lem.y, 40, 0.35);
          }
          if (lem.y <= 4) {
            lem.dir = -lem.dir;
            lem.state = 'FALL';
            lem.fallDist = 0;
          }
          break;
        }

        case 'BLOCK': {
          if (!terrain.isSolid(lem.x, lem.y)) {
            lem.state = 'FALL';
            lem.fallDist = 0;
          }
          break;
        }

        case 'BUILD': {
          if (!terrain.isSolid(lem.x, lem.y)) {
            lem.state = 'FALL';
            lem.fallDist = 0;
            return;
          }
          if (lem.skillTimer % 12 === 6) {
            const by = lem.y - 1;
            const deg = lem.buildStartDeg + lem.bricksLaid;
            terrain.layBrick(lem.x + lem.dir, by, 6, lem.dir, deg);
            terrain.pushSilence(lem.x, lem.y, 48, 0.45);
            if (this.audio) this.audio.playSkillBuild(lem.bricksLaid, pan);

            const nx = lem.x + 2 * lem.dir;
            const ny = lem.y - 1;
            // Stop & turn around only if head/upper torso hits a tall wall or ceiling
            if (terrain.isSolid(nx, ny - 7) || terrain.isSolid(nx + lem.dir, ny - 7)) {
              lem.dir = -lem.dir;
              lem.state = 'WALK';
              return;
            }
            lem.x = nx;
            lem.y = ny;
            lem.bricksLaid++;
            if (lem.bricksLaid >= 12) {
              lem.state = 'SHRUG';
              lem.stateTimer = 0;
              if (this.audio) this.audio.playBuilderShrug(pan);
            }
          }
          break;
        }

        case 'SHRUG': {
          if (!terrain.isSolid(lem.x, lem.y)) {
            lem.state = 'FALL';
            lem.fallDist = 0;
            return;
          }
          if (lem.stateTimer >= 28) {
            lem.state = 'WALK';
            lem.stateTimer = 0;
          }
          break;
        }

        case 'BASH': {
          if (!terrain.isSolid(lem.x, lem.y)) {
            lem.state = 'FALL';
            lem.fallDist = 0;
            return;
          }
          if (lem.skillTimer % 8 === 4) {
            const x0 = lem.dir > 0 ? lem.x + 1 : lem.x - 3;
            const res = terrain.carveRect(x0, lem.y - 9, 3, 9, lem.dir, false);
            if (res.hitHard && res.carvedCount === 0) {
              if (this.audio) this.audio.playSteelClang(pan);
              lem.dir = -lem.dir;
              lem.state = 'WALK';
              return;
            }
            lem.x += 2 * lem.dir;
            lem.bashStrokes++;
            terrain.pushSilence(lem.x, lem.y, 44, 0.40);
            terrain.triggerNoteFlash(lem.x, lem.y - 4, terrain.getDegreeAt(lem.x, lem.y), 190);
            if (this.audio) this.audio.playSkillBash(terrain.getMidiAt(lem.x, lem.y), pan);
            this.spawnBurst(lem.x + lem.dir * 2, lem.y - 4, 3, packRGBA(210, 175, 115), 0.7);

            // Check floor beneath new x
            if (!terrain.isSolid(lem.x, lem.y)) {
              if (terrain.isSolid(lem.x, lem.y + 1)) {
                lem.y += 1;
              } else {
                lem.state = 'FALL';
                lem.fallDist = 0;
                return;
              }
            }

            // Check if wall ahead still exists within 1..5 px
            let hasWallAhead = false;
            for (let d = 1; d <= 5; d++) {
              for (let h = 2; h <= 7; h++) {
                if (terrain.isSolid(lem.x + d * lem.dir, lem.y - h)) {
                  hasWallAhead = true;
                  break;
                }
              }
              if (hasWallAhead) break;
            }
            if (!hasWallAhead && lem.bashStrokes >= 1) {
              lem.state = 'WALK';
            }
          }
          break;
        }

        case 'MINE': {
          if (!terrain.isSolid(lem.x, lem.y)) {
            lem.state = 'FALL';
            lem.fallDist = 0;
            return;
          }
          if (lem.skillTimer % 10 === 4) {
            const x0 = lem.dir > 0 ? lem.x + 1 : lem.x - 4;
            const res = terrain.carveRect(x0, lem.y - 8, 4, 9, lem.dir, false);
            if (res.hitHard && res.carvedCount < 4) {
              if (this.audio) this.audio.playSteelClang(pan);
              lem.dir = -lem.dir;
              lem.state = 'WALK';
              return;
            }
            lem.x += 2 * lem.dir;
            lem.y += 1;
            lem.mineStrokes++;
            terrain.pushSilence(lem.x, lem.y, 44, 0.40);
            terrain.triggerNoteFlash(lem.x, lem.y, terrain.getDegreeAt(lem.x, lem.y), 190);
            if (this.audio) this.audio.playSkillMine(terrain.getMidiAt(lem.x, lem.y), lem.mineStrokes, pan);
            this.spawnBurst(lem.x + lem.dir * 2, lem.y - 2, 3, packRGBA(235, 200, 110), 0.7);

            if (!terrain.isSolid(lem.x, lem.y)) {
              if (terrain.isSolid(lem.x, lem.y + 1)) {
                lem.y += 1;
              } else {
                lem.state = 'FALL';
                lem.fallDist = 0;
              }
            }
          }
          break;
        }

        case 'DIG': {
          if (lem.skillTimer % 8 === 3) {
            const res = terrain.carveRect(lem.x - 4, lem.y, 9, 1, 0, true);
            if (res.hitHard && res.carvedCount === 0) {
              if (this.audio) this.audio.playSteelClang(pan);
              lem.state = 'WALK';
              return;
            }
            lem.y += 1;
            lem.digStrokes++;
            terrain.pushSilence(lem.x, lem.y, 46, 0.42);
            terrain.triggerNoteFlash(lem.x, lem.y, terrain.getDegreeAt(lem.x, lem.y), 200);
            if (this.audio) this.audio.playSkillDig(lem.digStrokes, pan);
            this.spawnBurst(lem.x, lem.y - 2, 3, packRGBA(198, 152, 92), 0.65);

            // Continue digging while any solid ground supports central 3px foot span
            if (!terrain.isSolid(lem.x - 1, lem.y) &&
                !terrain.isSolid(lem.x, lem.y) &&
                !terrain.isSolid(lem.x + 1, lem.y)) {
              lem.state = 'FALL';
              lem.fallDist = 0;
            }
          }
          break;
        }
      }
    }

    emitFootstep(lem) {
      if (lem.silenceLevel > 0.65) return; // Silence muffles footsteps!
      const deg = this.terrain.getDegreeAt(lem.x, lem.y);
      const midi = this.terrain.getMidiAt(lem.x, lem.y);
      this.terrain.triggerNoteFlash(lem.x, lem.y, deg, 160);
      this.terrain.pushSilence(lem.x, lem.y, 22, 0.08);
      if (this.audio) {
        this.audio.queueFootstep(midi, deg, this.panForX(lem.x));
      }
    }

    getSavedPct() {
      if (this.totalLemmings <= 0) return 0;
      return Math.floor((this.savedCount / this.totalLemmings) * 100);
    }

    getActiveCount() {
      let c = 0;
      for (let i = 0; i < this.lemmings.length; i++) {
        if (this.lemmings[i].alive && !this.lemmings[i].saved) c++;
      }
      return c;
    }
  }

  BeatTribe.Sim = {
    SKILL_LIST,
    MAX_SAFE_FALL,
    makeMulberry32,
    Lemming,
    GameSim
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Sim;
  }
})(typeof window !== 'undefined' ? window : globalThis);
