/**
 * Lemmings: Beat Tribe — 320x200 Amiga OCS Software Framebuffer Renderer (renderer.js)
 *
 * Renders everything into a 320x200 Uint32Array pixel buffer:
 * - Scrolling destructible Note Terrain, parallax world sky, beat pulse, 8x8 note-block flashes
 * - Creeping grey Silence drain & Blocker harmonic soundwave rings
 * - Animated Water, Lava, Fire, One-Way chevrons, and Beat-Synced Piston Crushers
 * - Multi-frame 8-10px Lemmings with beat-synced head bobbing
 * - Classic 320x40 Bottom Panel (13 buttons, live Analyser spectrum/oscilloscope, clickable minimap)
 * - Attract-mode Title banner, Briefing card, [T] ProTracker Stem Mixer, Level Warp/Password,
 *   and End-of-Level Composed Song Replay Scrolling Visualizer
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const Font = BeatTribe.Font;
  const Sprites = BeatTribe.Sprites;
  const { MAT, WORLD_THEMES } = BeatTribe.Terrain;
  const { SKILL_LIST } = BeatTribe.Sim;
  const {
    packRGBA,
    lerpColor,
    brightenColor,
    desaturateColor,
    drawText5x7,
    drawCopperText,
    drawText3x5,
    measureText5x7,
    measureText3x5,
    fillRect,
    strokeRect,
    drawBevelBox
  } = Font;

  const FB_W = 320;
  const FB_H = 200;
  const PLAY_H = 160;
  const HUD_Y = 160;

  // Exact pixel geometry for the bottom HUD so main.js hit-testing is 100% aligned
  const HUD_LAYOUT = {
    buttonsY: 169,
    buttonsH: 30,
    buttonW: 14,
    buttonCount: 13, // 0:Rate-, 1:Rate+, 2..9:Skills 0..7, 10:Pause, 11:FF, 12:Nuke
    analyser: { x: 183, y: 170, w: 42, h: 29 },
    minimap: { x: 226, y: 170, w: 93, h: 29 }
  };

  const COPPER_GOLD = [
    packRGBA(255, 252, 196),
    packRGBA(255, 236, 124),
    packRGBA(255, 206, 68),
    packRGBA(244, 168, 42),
    packRGBA(218, 122, 28),
    packRGBA(246, 184, 58),
    packRGBA(255, 232, 118),
    packRGBA(126, 255, 152),
    packRGBA(58, 224, 186),
    packRGBA(52, 168, 248),
    packRGBA(96, 124, 255),
    packRGBA(182, 118, 255),
    packRGBA(255, 128, 212),
    packRGBA(255, 214, 242)
  ];

  const STEM_COLORS = [
    packRGBA(255, 112, 82),  // DRUMS
    packRGBA(186, 255, 64),  // BASS
    packRGBA(78, 224, 255),  // CHORDS
    packRGBA(255, 108, 228), // LEAD
    packRGBA(255, 226, 84)   // FULL MIX
  ];

  class FramebufferRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.imageData = this.ctx.createImageData(FB_W, FB_H);
      this.fb = new Uint32Array(this.imageData.data.buffer);
      this.hitRegions = []; // Dynamic clickable overlay buttons for menus/modals
    }

    clearHitRegions() {
      this.hitRegions.length = 0;
    }

    addHitRegion(id, x, y, w, h, data = null) {
      this.hitRegions.push({ id, x, y, w, h, data });
    }

    drawButton(id, x, y, w, h, label, active = false, accentCol = null, data = null) {
      const fill = active ? packRGBA(52, 82, 148) : packRGBA(28, 34, 58);
      const hi = accentCol || (active ? packRGBA(146, 228, 255) : packRGBA(88, 106, 158));
      const lo = packRGBA(12, 14, 26);
      drawBevelBox(this.fb, FB_W, FB_H, x, y, w, h, fill, hi, lo);
      const tw = measureText5x7(label, 1);
      const tx = x + Math.floor((w - tw) / 2);
      const ty = y + Math.floor((h - 7) / 2);
      drawText5x7(this.fb, FB_W, FB_H, label, tx, ty, packRGBA(248, 250, 255), packRGBA(10, 12, 22), 1);
      this.addHitRegion(id, x, y, w, h, data);
    }

    darkenRect(x, y, w, h, factor = 0.28) {
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(FB_W, (x + w) | 0);
      const y1 = Math.min(FB_H, (y + h) | 0);
      for (let py = y0; py < y1; py++) {
        const off = py * FB_W;
        for (let px = x0; px < x1; px++) {
          const c = Font.unpackRGBA(this.fb[off + px]);
          this.fb[off + px] = packRGBA(c.r * factor, c.g * factor, c.b * factor, 255);
        }
      }
    }

    present() {
      this.ctx.putImageData(this.imageData, 0, 0);
    }

    // =======================================================================
    // PLAYFIELD RENDERING (320 x 160)
    // =======================================================================
    renderPlayfield(sim, camX, beatPhase, visualTick) {
      const fb = this.fb;
      const terrain = sim.terrain;
      const tW = terrain.width;
      const cx0 = Math.max(0, Math.min(tW - FB_W, Math.round(camX)));
      const parallaxX = Math.floor(cx0 * 0.45);
      const beatGlow = Math.round(Math.pow(1 - beatPhase, 3) * 18);

      const degColors = terrain.theme.degreeColors;

      // 1. Background + Destructible Note Terrain + Hazards + Silence Drain
      for (let sy = 0; sy < PLAY_H; sy++) {
        const dstOff = sy * FB_W;
        const srcOff = sy * tW;
        const gy = sy >> 3;
        const cellRowOff = gy * terrain.gridW;

        for (let sx = 0; sx < FB_W; sx++) {
          const wx = cx0 + sx;
          const idx = srcOff + wx;
          const m = terrain.mat[idx];

          if (m === MAT.EMPTY) {
            // Parallax background sky
            let col = terrain.bgPixels[srcOff + ((parallaxX + sx) % tW)];
            // Subtle drifting grey static mist in deep Silence zones!
            if (terrain.silenceSources.length > 0) {
              const sVal = terrain.silence[cellRowOff + (wx >> 3)];
              if (sVal > 0.35 && (((wx * 17 + sy * 31 + visualTick) & 15) === 0)) {
                col = lerpColor(col, packRGBA(118, 122, 130), sVal * 0.65);
              }
            }
            fb[dstOff + sx] = col;
            continue;
          }

          if (m === MAT.WATER) {
            const wave = Math.sin(wx * 0.22 + visualTick * 0.14 + sy * 0.3);
            const topSurface = (sy > 0 && terrain.mat[idx - tW] === MAT.EMPTY);
            if (topSurface && wave > -0.2) {
              fb[dstOff + sx] = packRGBA(190, 248, 255);
            } else {
              const b = 175 + Math.round(wave * 32);
              const g = (terrain.worldId === 2) ? 215 + Math.round(wave * 30) : 118 + Math.round(wave * 24);
              const r = (terrain.worldId === 2) ? 92 : 24;
              fb[dstOff + sx] = packRGBA(r, g, b);
            }
            continue;
          }

          if (m === MAT.LAVA) {
            const bub = Math.sin(wx * 0.28 - visualTick * 0.16) + Math.cos(sy * 0.4 + visualTick * 0.1);
            const topSurface = (sy > 0 && terrain.mat[idx - tW] === MAT.EMPTY);
            if (topSurface || bub > 0.9) {
              fb[dstOff + sx] = packRGBA(255, 238, 86);
            } else if (bub > -0.2) {
              fb[dstOff + sx] = packRGBA(255, 118, 24);
            } else {
              fb[dstOff + sx] = packRGBA(188, 36, 18);
            }
            continue;
          }

          if (m === MAT.FIRE) {
            const flk = ((wx * 13 + visualTick * 3 + sy * 7) % 11);
            const topSurface = (sy > 0 && terrain.mat[idx - tW] === MAT.EMPTY);
            if (topSurface && flk < 5) {
              fb[dstOff + sx] = packRGBA(255, 244, 128);
            } else if (flk < 6) {
              fb[dstOff + sx] = packRGBA(255, 108, 24);
            } else {
              fb[dstOff + sx] = packRGBA(168, 28, 24);
            }
            continue;
          }

          // Solid Terrain (DIRT, BRICK, STEEL, ONE_WAY_LEFT, ONE_WAY_RIGHT)
          let col = terrain.baseColor[idx];

          // Beat-synced pulse & 8x8 Note-Block flash!
          const cIdx = cellRowOff + (wx >> 3);
          const flash = terrain.noteFlash[cIdx];
          if (m !== MAT.STEEL) {
            if (beatGlow > 0) {
              col = brightenColor(col, beatGlow);
            }
            if (flash > 0) {
              const fDeg = terrain.noteFlashDeg[cIdx] % degColors.length;
              const hiRGB = degColors[fDeg][1];
              const flashCol = packRGBA(
                Math.min(255, hiRGB[0] + 55),
                Math.min(255, hiRGB[1] + 55),
                Math.min(255, hiRGB[2] + 55)
              );
              col = lerpColor(col, flashCol, (flash / 255) * 0.72);
            }
          }

          // Shimmering directional arrows on ONE_WAY walls!
          if (m === MAT.ONE_WAY_LEFT || m === MAT.ONE_WAY_RIGHT) {
            const dirSign = (m === MAT.ONE_WAY_RIGHT) ? -1 : 1;
            const localY = (sy & 7) - 3.5;
            const chevron = ((wx + dirSign * (visualTick >> 2) + Math.round(Math.abs(localY))) & 7);
            if (chevron === 0 || chevron === 1) {
              col = packRGBA(255, 246, 148);
            }
          }

          // Creeping grey Silence colour-drain!
          if (terrain.silenceSources.length > 0 && m !== MAT.STEEL) {
            const sVal = terrain.silence[cIdx];
            if (sVal > 0.08) {
              col = desaturateColor(col, Math.min(1, sVal * 1.05));
            }
          }

          fb[dstOff + sx] = col;
        }
      }

      // 2. Silence Source Pulsing Grey Spores
      for (const src of terrain.silenceSources) {
        const sx = (src.x - cx0) | 0;
        const sy = (src.y - 4) | 0;
        if (sx < -16 || sx > FB_W + 16) continue;
        const sVal = terrain.getSilenceAt(src.x, src.y);
        if (sVal > 0.15) {
          const r = 3 + Math.round(Math.sin(visualTick * 0.1) * 1.5);
          strokeRect(fb, FB_W, PLAY_H, sx - r, sy - r, r * 2, r * 2, packRGBA(146, 150, 162));
          fillRect(fb, FB_W, PLAY_H, sx - 1, sy - 1, 3, 3, packRGBA(72, 74, 84));
        }
      }

      // 3. Beat-Synced Piston Crushers
      for (const c of terrain.crushers) {
        const sx = (c.x - cx0) | 0;
        if (sx + c.width < 0 || sx >= FB_W) continue;
        const shaftX = sx + Math.floor((c.width - 6) / 2);
        const headY = c.yTop + c.curExt - 8;
        // Hydraulic shaft
        fillRect(fb, FB_W, PLAY_H, shaftX, Math.max(0, c.yTop - 24), 6, (headY - Math.max(0, c.yTop - 24)), packRGBA(98, 108, 126));
        fillRect(fb, FB_W, PLAY_H, shaftX + 1, Math.max(0, c.yTop - 24), 2, (headY - Math.max(0, c.yTop - 24)), packRGBA(172, 186, 208));
        // Hazard-striped crusher head
        for (let py = headY; py < headY + 8; py++) {
          if (py < 0 || py >= PLAY_H) continue;
          for (let px = sx; px < sx + c.width; px++) {
            if (px < 0 || px >= FB_W) continue;
            const stripe = ((px + py) >> 2) & 1;
            fb[py * FB_W + px] = stripe ? packRGBA(246, 198, 38) : packRGBA(36, 38, 46);
          }
        }
      }

      // 4. Entrance Hatch & Musical Exit Door
      Sprites.drawHatch(
        fb, FB_W, PLAY_H,
        sim.level.hatch.x, sim.level.hatch.y,
        cx0, sim.hatchOpenProgress, 1 - beatPhase, terrain.theme.accent
      );
      Sprites.drawExitDoor(
        fb, FB_W, PLAY_H,
        sim.level.exit.x, sim.level.exit.y,
        cx0, visualTick, 1 - beatPhase, sim.exitFlash, terrain.theme
      );

      // 5. Lemmings (8-10px sprites + beat-synced head bobbing + Blocker drone rings + Bomber countdown!)
      const headBob = (beatPhase < 0.26) ? -1 : 0;
      for (let i = 0; i < sim.lemmings.length; i++) {
        const lem = sim.lemmings[i];
        if (!lem.alive || lem.saved) continue;
        const sx = (lem.x - cx0) | 0;
        const sy = (lem.y - 1) | 0;
        if (sx < -12 || sx > FB_W + 12) continue;

        // Blocker sustained root-drone soundwave aura!
        if (lem.state === 'BLOCK') {
          const ringR = 6 + ((visualTick + i * 9) % 24);
          const ringCol = packRGBA(98, 232, 255);
          for (let a = 0; a < 12; a++) {
            const ang = (a / 12) * Math.PI * 2;
            const rx = Math.round(sx + Math.cos(ang) * ringR);
            const ry = Math.round((sy - 4) + Math.sin(ang) * (ringR * 0.5));
            if (rx >= 0 && rx < FB_W && ry >= 0 && ry < PLAY_H) {
              fb[ry * FB_W + rx] = ringCol;
            }
          }
        }

        const anim = Sprites.ANIMS[lem.state] || Sprites.ANIMS.WALK;
        const frames = (lem.dir >= 0) ? anim.right : anim.left;
        let fIdx = 0;
        if (lem.state === 'WALK') {
          // Sync walk cycle subtly with both movement and beat!
          fIdx = (lem.stepCounter >> 1) % frames.length;
        } else if (lem.state === 'FLOAT') {
          fIdx = lem.stateTimer < 8 ? Math.floor(lem.stateTimer / 4) : 2 + ((lem.stateTimer >> 3) % 4);
        } else if (['SPLAT', 'DROWN', 'BURN', 'CELEBRATE', 'OHNO', 'SHRUG'].includes(lem.state)) {
          fIdx = Math.min(frames.length - 1, Math.floor((lem.stateTimer / 28) * frames.length));
        } else if (lem.state === 'BUILD') {
          fIdx = lem.skillTimer % frames.length;
        } else {
          fIdx = lem.animFrame % frames.length;
        }

        const applyBob = (!lem.panicking && ['WALK', 'BLOCK', 'BUILD', 'BASH', 'MINE', 'DIG'].includes(lem.state))
          ? headBob
          : 0;
        Sprites.blitSprite(fb, FB_W, FB_H, frames[fIdx], sx, sy, lem.panicking || lem.silenceLevel > 0.72, PLAY_H, applyBob);

        // Athlete badge pixel (subtle cyan/gold pip on cap for Climber/Floater)
        if (lem.isClimber && sy - 8 >= 0 && sy - 8 < PLAY_H && sx >= 0 && sx < FB_W) {
          fb[(sy - 8 + applyBob) * FB_W + sx] = packRGBA(255, 236, 88);
        }

        // Bomber floating countdown 5..4..3..2..1!
        if (lem.bombTimer > 0) {
          const sec = Math.min(5, Math.ceil(lem.bombTimer / 36));
          const cCol = sec <= 2 ? packRGBA(255, 84, 84) : packRGBA(255, 238, 92);
          drawText3x5(fb, FB_W, PLAY_H, String(sec), sx - 1, sy - 15, cCol, packRGBA(12, 12, 18));
        }
      }

      // 6. Cosmetic Pixel Particles & Floating Groove Popups
      for (let i = 0; i < sim.particles.length; i++) {
        const p = sim.particles[i];
        const px = Math.round(p.x - cx0);
        const py = Math.round(p.y);
        if (px >= 0 && px < FB_W && py >= 0 && py < PLAY_H) {
          fb[py * FB_W + px] = p.color;
          if (p.life > 12 && px + 1 < FB_W) fb[py * FB_W + px + 1] = p.color;
        }
      }

      for (let i = 0; i < sim.floatingTexts.length; i++) {
        const ft = sim.floatingTexts[i];
        const tx = Math.round(ft.x - cx0) - Math.floor(measureText3x5(ft.text) / 2);
        const ty = Math.round(ft.y);
        if (ty >= 2 && ty < PLAY_H - 6) {
          drawText3x5(fb, FB_W, PLAY_H, ft.text, tx, ty, ft.color, packRGBA(10, 12, 20));
        }
      }

      // 7. Virtual Demo Cursor when watching Solution Demo
      if (sim.demoMode && sim.demoCursor.active) {
        const dx = Math.round(sim.demoCursor.x - cx0);
        const dy = Math.round(sim.demoCursor.y);
        this.drawCrosshair(dx, dy, packRGBA(255, 224, 72), true);
        if (sim.demoCursor.label) {
          drawText3x5(fb, FB_W, PLAY_H, sim.demoCursor.label.slice(0, 5), dx + 6, dy - 6, packRGBA(255, 240, 120), packRGBA(10, 10, 18));
        }
      }
    }

    drawLemmingHighlight(lem, camX) {
      if (!lem) return;
      const sx = Math.round(lem.x - camX);
      const sy = Math.round(lem.y - 5);
      const c = packRGBA(120, 255, 168);
      // Corner selection brackets around hovered lemming
      fillRect(this.fb, FB_W, PLAY_H, sx - 6, sy - 6, 3, 1, c);
      fillRect(this.fb, FB_W, PLAY_H, sx - 6, sy - 6, 1, 3, c);
      fillRect(this.fb, FB_W, PLAY_H, sx + 4, sy - 6, 3, 1, c);
      fillRect(this.fb, FB_W, PLAY_H, sx + 6, sy - 6, 1, 3, c);
      fillRect(this.fb, FB_W, PLAY_H, sx - 6, sy + 5, 3, 1, c);
      fillRect(this.fb, FB_W, PLAY_H, sx - 6, sy + 3, 1, 3, c);
      fillRect(this.fb, FB_W, PLAY_H, sx + 4, sy + 5, 3, 1, c);
      fillRect(this.fb, FB_W, PLAY_H, sx + 6, sy + 3, 1, 3, c);
    }

    drawCrosshair(sx, sy, col = packRGBA(255, 255, 255), clipPlayfield = false) {
      const maxH = clipPlayfield ? PLAY_H : FB_H;
      fillRect(this.fb, FB_W, maxH, sx - 4, sy, 3, 1, col);
      fillRect(this.fb, FB_W, maxH, sx + 2, sy, 3, 1, col);
      fillRect(this.fb, FB_W, maxH, sx, sy - 4, 1, 3, col);
      fillRect(this.fb, FB_W, maxH, sx, sy + 2, 1, 3, col);
    }

    // =======================================================================
    // CLASSIC AMIGA LEMMINGS BOTTOM PANEL (320 x 40, y = 160..199)
    // =======================================================================
    renderHUD(sim, uiState, audioEngine, camX, beatPhase, visualTick) {
      const fb = this.fb;

      // Panel backdrop
      fillRect(fb, FB_W, FB_H, 0, HUD_Y, FB_W, 40, packRGBA(22, 26, 42));
      fillRect(fb, FB_W, FB_H, 0, HUD_Y, FB_W, 1, packRGBA(92, 108, 156));

      // 1. Top Status Bar (y = 161..168)
      fillRect(fb, FB_W, FB_H, 0, 161, FB_W, 8, packRGBA(14, 16, 28));

      // Left: Hovered Lemming State OR Selected Skill + Groove Score
      const hoverLabel = uiState.hoveredLemming
        ? uiState.hoveredLemming.getLabel()
        : `${uiState.selectedSkill}  GRV:${sim.grooveScore}`;
      drawText3x5(
        fb, FB_W, FB_H,
        hoverLabel.slice(0, 23),
        2, 162,
        uiState.hoveredLemming ? packRGBA(136, 255, 174) : packRGBA(218, 228, 255)
      );

      // Middle-Left: OUT & SAVED%
      const savedPct = sim.getSavedPct();
      const pctCol = savedPct >= sim.saveReqPct ? packRGBA(92, 255, 128) : packRGBA(255, 208, 86);
      drawText3x5(fb, FB_W, FB_H, `OUT:${sim.getActiveCount()}`, 98, 162, packRGBA(172, 206, 255));
      drawText3x5(fb, FB_W, FB_H, `IN:${savedPct}/${sim.saveReqPct}%`, 128, 162, pctCol);

      // Middle-Right: 5 Song Stem Unlock Pips [D][B][C][L][F]
      const stemLetters = ['D', 'B', 'C', 'L', 'F'];
      const unlockedArr = audioEngine ? audioEngine.stemUnlocked : [false, false, false, false, false];
      for (let i = 0; i < 5; i++) {
        const px = 184 + i * 8;
        const on = unlockedArr[i] || savedPct >= (i + 1) * 20;
        fillRect(fb, FB_W, FB_H, px, 161, 7, 7, on ? STEM_COLORS[i] : packRGBA(36, 40, 58));
        drawText3x5(
          fb, FB_W, FB_H,
          stemLetters[i],
          px + 2, 162,
          on ? packRGBA(12, 14, 22) : packRGBA(96, 104, 132)
        );
      }

      // Beat Pulse LED + Countdown Clock
      const beatFlash = beatPhase < 0.22;
      fillRect(fb, FB_W, FB_H, 228, 162, 5, 5, beatFlash ? packRGBA(255, 242, 92) : packRGBA(54, 62, 86));

      const totalSec = Math.ceil(sim.timeRemainingFrames / 60);
      const mins = Math.floor(totalSec / 60);
      const secs = String(totalSec % 60).padStart(2, '0');
      const timeCol = totalSec <= 30 ? packRGBA(255, 92, 92) : packRGBA(240, 244, 255);
      const modeTag = uiState.fastForward ? '2X ' : (uiState.paused ? 'II ' : '');
      drawText3x5(fb, FB_W, FB_H, `${modeTag}${mins}:${secs}`, 276, 162, timeCol);
      if (audioEngine && audioEngine.masterMuted) {
        drawText3x5(fb, FB_W, FB_H, 'MUTE', 246, 162, packRGBA(255, 102, 102));
      } else if (sim.demoMode && !sim.attractMode) {
        drawText3x5(fb, FB_W, FB_H, 'DEMO', 246, 162, packRGBA(255, 228, 88));
      }

      // 2. Classic 13 Control Buttons (x = 0..181, y = 169..198)
      const iconNames = [
        'RATE_MINUS',
        'RATE_PLUS',
        ...SKILL_LIST,
        'PAUSE',
        'FF',
        'NUKE'
      ];

      for (let b = 0; b < 13; b++) {
        const bx = b * 14;
        const by = HUD_LAYOUT.buttonsY;
        let isSelected = false;
        let topText = '';
        let topCol = packRGBA(236, 242, 255);

        if (b === 0) {
          topText = String(sim.minReleaseRate).padStart(2, '0');
          topCol = packRGBA(126, 206, 255);
        } else if (b === 1) {
          topText = String(sim.releaseRate).padStart(2, '0');
          topCol = packRGBA(255, 234, 92);
        } else if (b >= 2 && b <= 9) {
          const sk = SKILL_LIST[b - 2];
          const cnt = sim.skills[sk] || 0;
          isSelected = (uiState.selectedSkill === sk);
          topText = String(Math.min(99, cnt)).padStart(2, '0');
          topCol = cnt > 0 ? (isSelected ? packRGBA(255, 246, 118) : packRGBA(238, 244, 255)) : packRGBA(92, 98, 122);
        } else if (b === 10) {
          isSelected = uiState.paused;
          topText = 'P';
          topCol = isSelected ? packRGBA(255, 214, 78) : packRGBA(200, 210, 232);
        } else if (b === 11) {
          isSelected = uiState.fastForward;
          topText = 'FF';
          topCol = isSelected ? packRGBA(92, 242, 255) : packRGBA(200, 210, 232);
        } else if (b === 12) {
          isSelected = sim.nuking || uiState.nukeArmedFrames > 0;
          topText = uiState.nukeArmedFrames > 0 ? '!!' : 'NK';
          topCol = isSelected ? packRGBA(255, 86, 86) : packRGBA(255, 168, 132);
        }

        const fill = isSelected ? packRGBA(56, 78, 138) : packRGBA(34, 40, 64);
        const hi = isSelected
          ? ((b === 12 && (visualTick & 4)) ? packRGBA(255, 72, 72) : packRGBA(255, 232, 98))
          : packRGBA(82, 96, 138);
        const lo = packRGBA(12, 14, 24);
        drawBevelBox(fb, FB_W, FB_H, bx, by, 14, 30, fill, hi, lo);

        // Top number/label
        const tx = bx + Math.floor((14 - measureText3x5(topText)) / 2);
        drawText3x5(fb, FB_W, FB_H, topText, tx, by + 2, topCol);

        // Pixel-art skill/control icon (12x12 at by+9)
        const icon = Sprites.HUD_ICONS[iconNames[b]];
        if (icon) {
          const dim = (b >= 2 && b <= 9 && (sim.skills[SKILL_LIST[b - 2]] || 0) <= 0);
          Sprites.blitSprite(fb, FB_W, FB_H, icon, bx + 1, by + 9, dim, FB_H, 0);
        }

        // Tiny keyboard number hint at very bottom for skills 1..8
        if (b >= 2 && b <= 9) {
          drawText3x5(fb, FB_W, FB_H, String(b - 1), bx + 5, by + 23, packRGBA(112, 128, 168));
        }
      }

      // 3. Real-Time Web Audio Spectrum + Oscilloscope (x = 183..224, y = 170..198)
      const anBox = HUD_LAYOUT.analyser;
      drawBevelBox(fb, FB_W, FB_H, anBox.x, anBox.y, anBox.w, anBox.h, packRGBA(10, 14, 22), packRGBA(12, 16, 28), packRGBA(68, 82, 118));
      if (audioEngine) {
        const { freq, wave } = audioEngine.sampleAnalyser();
        // 13 Frequency Spectrum Bars
        for (let i = 0; i < 13; i++) {
          const v = freq[Math.min(freq.length - 1, i * 2 + 1)] / 255;
          const bh = Math.round(v * 23);
          const bx = anBox.x + 2 + i * 3;
          for (let y = 0; y < bh; y++) {
            const py = anBox.y + anBox.h - 2 - y;
            const barCol = y > 16
              ? packRGBA(255, 96, 118)
              : (y > 9 ? packRGBA(255, 228, 86) : packRGBA(68, 242, 148));
            fillRect(fb, FB_W, FB_H, bx, py, 2, 1, barCol);
          }
        }
        // Overlaid cyan Oscilloscope waveform
        let prevY = anBox.y + 14;
        for (let x = 0; x < anBox.w - 4; x++) {
          const wIdx = Math.floor((x / (anBox.w - 4)) * wave.length);
          const wy = anBox.y + 14 + Math.round(((wave[wIdx] - 128) / 128) * 11);
          const cy = Math.max(anBox.y + 2, Math.min(anBox.y + anBox.h - 3, wy));
          const y0 = Math.min(prevY, cy);
          const y1 = Math.max(prevY, cy);
          for (let py = y0; py <= y1; py++) {
            fb[py * FB_W + (anBox.x + 2 + x)] = packRGBA(140, 248, 255);
          }
          prevY = cy;
        }
      }
      drawText3x5(fb, FB_W, FB_H, 'T', anBox.x + anBox.w - 5, anBox.y + 2, packRGBA(118, 148, 198));

      // 4. Live Clickable & Draggable Minimap (x = 226..318, y = 170..198)
      const mm = HUD_LAYOUT.minimap;
      drawBevelBox(fb, FB_W, FB_H, mm.x, mm.y, mm.w, mm.h, packRGBA(8, 10, 18), packRGBA(14, 18, 30), packRGBA(78, 92, 134));
      const inX = mm.x + 1;
      const inY = mm.y + 1;
      const inW = mm.w - 2;
      const inH = mm.h - 2;
      const terrain = sim.terrain;

      for (let my = 0; my < inH; my++) {
        const wy = Math.floor((my / inH) * terrain.height);
        const tRow = wy * terrain.width;
        const dstRow = (inY + my) * FB_W;
        for (let mx = 0; mx < inW; mx++) {
          const wx = Math.floor((mx / inW) * terrain.width);
          const m = terrain.mat[tRow + wx];
          if (m === MAT.EMPTY) continue;
          let c = terrain.baseColor[tRow + wx];
          if (m === MAT.WATER) c = packRGBA(48, 178, 255);
          else if (m === MAT.LAVA || m === MAT.FIRE) c = packRGBA(255, 112, 32);
          else if (terrain.silenceSources.length > 0 && terrain.silence[(wy >> 3) * terrain.gridW + (wx >> 3)] > 0.45) {
            c = packRGBA(112, 116, 126);
          }
          fb[dstRow + inX + mx] = c;
        }
      }

      // Hatch & Exit markers on minimap
      const hx = inX + Math.floor((sim.level.hatch.x / terrain.width) * inW);
      const hy = inY + Math.floor((sim.level.hatch.y / terrain.height) * inH);
      fillRect(fb, FB_W, FB_H, hx - 1, hy, 2, 2, packRGBA(110, 224, 255));

      const ex = inX + Math.floor((sim.level.exit.x / terrain.width) * inW);
      const ey = inY + Math.floor((sim.level.exit.y / terrain.height) * inH);
      fillRect(fb, FB_W, FB_H, ex - 1, ey - 2, 3, 3, packRGBA(255, 226, 72));

      // Live Lemming dots on minimap
      const lemDot = packRGBA(78, 255, 96);
      for (let i = 0; i < sim.lemmings.length; i++) {
        const l = sim.lemmings[i];
        if (!l.alive || l.saved) continue;
        const lx = inX + Math.floor((l.x / terrain.width) * inW);
        const ly = inY + Math.floor(((l.y - 3) / terrain.height) * inH);
        if (lx >= inX && lx < inX + inW && ly >= inY && ly < inY + inH) {
          fb[ly * FB_W + lx] = lemDot;
        }
      }

      // Camera Viewport Box on minimap
      const vpX = inX + Math.floor((camX / terrain.width) * inW);
      const vpW = Math.max(8, Math.floor((FB_W / terrain.width) * inW));
      strokeRect(fb, FB_W, FB_H, vpX, inY, Math.min(inW - (vpX - inX), vpW), inH, packRGBA(248, 250, 255));
    }

    // =======================================================================
    // OVERLAYS: TITLE / ATTRACT, BRIEFING, LEVEL WARP, [T] MIXER, & REPLAY
    // =======================================================================
    renderTitleOverlay(sim, audioEngine, visualTick) {
      this.darkenRect(14, 8, 292, 68, 0.34);
      strokeRect(this.fb, FB_W, FB_H, 14, 8, 292, 68, packRGBA(112, 158, 246));

      // Copper-gradient Demoscene Logo
      const title = 'LEMMINGS: BEAT TRIBE';
      const tw = measureText5x7(title, 2);
      drawCopperText(this.fb, FB_W, FB_H, title, Math.floor((FB_W - tw) / 2), 14, COPPER_GOLD, packRGBA(10, 12, 26), 2);

      const sub = 'PLAYING IS COMPOSING  *  THE TERRAIN IS THE SCORE';
      drawText3x5(this.fb, FB_W, FB_H, sub, Math.floor((FB_W - measureText3x5(sub)) / 2), 34, packRGBA(158, 242, 255));

      // Action buttons
      this.drawButton('START_GAME', 26, 46, 86, 16, 'PLAY GAME', true, packRGBA(98, 255, 148));
      this.drawButton('OPEN_SELECT', 118, 46, 92, 16, 'LEVEL WARP', false, packRGBA(120, 214, 255));
      this.drawButton('WATCH_DEMO', 216, 46, 78, 16, 'DEMO [D]', false, packRGBA(255, 222, 92));

      // Live Attract-Mode ticker at bottom of playfield
      this.darkenRect(24, 142, 272, 14, 0.35);
      const attTxt = `ATTRACT DEMO: ${sim.level.worldLabel} - ${sim.level.name} [${sim.level.code}]`;
      drawText3x5(this.fb, FB_W, FB_H, attTxt, Math.floor((FB_W - measureText3x5(attTxt)) / 2), 146, packRGBA(255, 236, 128));
    }

    renderBriefingOverlay(level) {
      const theme = WORLD_THEMES[level.worldId];
      this.darkenRect(20, 12, 280, 136, 0.20);
      drawBevelBox(this.fb, FB_W, FB_H, 20, 12, 280, 136, packRGBA(18, 22, 38), theme.accent, packRGBA(8, 10, 18));

      const hdr = `${level.worldLabel}: ${level.name}`;
      drawText5x7(this.fb, FB_W, FB_H, hdr, Math.floor((FB_W - measureText5x7(hdr)) / 2), 20, theme.accent, packRGBA(8, 10, 16));

      const worldInfo = `${theme.name}  |  ${theme.scaleName}  |  ${theme.bpm} BPM`;
      drawText3x5(this.fb, FB_W, FB_H, worldInfo, Math.floor((FB_W - measureText3x5(worldInfo)) / 2), 34, packRGBA(172, 224, 255));

      fillRect(this.fb, FB_W, FB_H, 32, 43, 256, 1, packRGBA(64, 78, 118));

      // Stats grid
      drawText5x7(this.fb, FB_W, FB_H, `TRIBE SIZE: ${level.lemmingCount}`, 36, 50, packRGBA(240, 244, 255));
      drawText5x7(this.fb, FB_W, FB_H, `SAVE NEEDED: ${level.saveReqPct}%`, 168, 50, packRGBA(106, 255, 148));
      drawText5x7(this.fb, FB_W, FB_H, `RELEASE RATE: ${level.initialReleaseRate}`, 36, 63, packRGBA(255, 224, 98));
      drawText5x7(this.fb, FB_W, FB_H, `CODE: ${level.code}`, 168, 63, packRGBA(255, 152, 236));

      // Word-wrapped 2-line subtitle hint
      const words = String(level.subtitle || '').split(' ');
      let line1 = '';
      let line2 = '';
      for (const w of words) {
        if (!line2 && (line1 + ' ' + w).trim().length <= 58) {
          line1 = (line1 + ' ' + w).trim();
        } else {
          line2 = (line2 + ' ' + w).trim();
        }
      }
      drawText3x5(this.fb, FB_W, FB_H, line1, Math.floor((FB_W - measureText3x5(line1)) / 2), 77, packRGBA(212, 224, 248));
      if (line2) {
        drawText3x5(this.fb, FB_W, FB_H, line2, Math.floor((FB_W - measureText3x5(line2)) / 2), 85, packRGBA(212, 224, 248));
      }

      // Stem unlock legend
      const stemHint = 'SAVE 20%->DRUMS  40%->BASS  60%->CHORDS  80%->LEAD  100%->FULL MIX';
      drawText3x5(this.fb, FB_W, FB_H, stemHint, Math.floor((FB_W - measureText3x5(stemHint)) / 2), 98, packRGBA(146, 244, 196));

      this.drawButton('BEGIN_LEVEL', 46, 116, 110, 18, "LET'S GO!", true, packRGBA(98, 255, 148));
      this.drawButton('WATCH_DEMO', 166, 116, 98, 18, 'WATCH DEMO', false, packRGBA(255, 224, 92));
    }

    renderLevelSelectOverlay(levels, currentIdx, passwordInput, passwordMsg) {
      fillRect(this.fb, FB_W, FB_H, 0, 0, FB_W, FB_H, packRGBA(12, 15, 28));
      strokeRect(this.fb, FB_W, FB_H, 4, 4, FB_W - 8, FB_H - 8, packRGBA(84, 118, 186));

      const title = 'BEAT TRIBE - LEVEL WARP & PASSWORDS';
      drawText5x7(this.fb, FB_W, FB_H, title, Math.floor((FB_W - measureText5x7(title)) / 2), 10, packRGBA(255, 232, 102));

      // Password input bar
      drawText3x5(this.fb, FB_W, FB_H, 'TYPE PASSWORD CODE:', 14, 25, packRGBA(172, 214, 255));
      drawBevelBox(this.fb, FB_W, FB_H, 96, 22, 54, 11, packRGBA(8, 10, 18), packRGBA(118, 224, 255), packRGBA(42, 54, 82));
      drawText5x7(this.fb, FB_W, FB_H, (passwordInput + '_').slice(0, 6), 101, 24, packRGBA(118, 255, 158));
      this.drawButton('SUBMIT_CODE', 154, 22, 42, 11, 'WARP', false, packRGBA(118, 255, 158));
      this.drawButton('CLOSE_SELECT', 260, 22, 48, 11, 'BACK', false, packRGBA(255, 142, 142));

      if (passwordMsg) {
        drawText3x5(this.fb, FB_W, FB_H, passwordMsg, 202, 25, packRGBA(255, 214, 98));
      }

      // 16 Level Cards in a clean 2-column x 8-row grid (y = 38..190)
      for (let i = 0; i < levels.length; i++) {
        const lv = levels[i];
        const col = i >> 3;
        const row = i & 7;
        const bx = 10 + col * 152;
        const by = 38 + row * 19;
        const theme = WORLD_THEMES[lv.worldId];
        const selected = (i === currentIdx);
        const fill = selected ? packRGBA(44, 64, 114) : packRGBA(22, 28, 46);
        drawBevelBox(this.fb, FB_W, FB_H, bx, by, 148, 17, fill, selected ? theme.accent : packRGBA(62, 76, 114), packRGBA(8, 10, 18));

        // World colour tab
        fillRect(this.fb, FB_W, FB_H, bx + 1, by + 1, 4, 15, theme.accent);
        const tag = `${String(i).padStart(2, '0')} ${lv.name.slice(0, 29)}`;
        drawText3x5(this.fb, FB_W, FB_H, tag, bx + 8, by + 3, packRGBA(244, 248, 255));
        const sub = `${lv.worldLabel} | ${lv.code} | ${lv.saveReqPct}%`;
        drawText3x5(this.fb, FB_W, FB_H, sub, bx + 8, by + 10, packRGBA(154, 198, 236));

        this.addHitRegion('WARP_LEVEL', bx, by, 148, 17, i);
      }
    }

    // [T] Live ProTracker Pattern & Stem Mixer Overlay!
    renderTrackerOverlay(audioEngine) {
      if (!audioEngine) return;
      const snap = audioEngine.getTrackerSnapshot();
      this.darkenRect(10, 6, 300, 148, 0.16);
      drawBevelBox(this.fb, FB_W, FB_H, 10, 6, 300, 148, packRGBA(14, 18, 32), packRGBA(98, 224, 255), packRGBA(6, 8, 14));

      const hdr = `PROTRACKER STEM MIXER  |  PAT 0${snap.patternIdx} ROW ${snap.row.toString(16).toUpperCase().padStart(2, '0')}  |  ${snap.bpm} BPM`;
      drawText3x5(this.fb, FB_W, FB_H, hdr, 18, 12, packRGBA(126, 244, 255));
      this.drawButton('CLOSE_TRACKER', 274, 9, 30, 10, 'X', false, packRGBA(255, 120, 120));

      // 5 Stem Channel Strips with [M] Mute / [S] Solo & VU Meters (y = 22..52)
      for (let i = 0; i < 5; i++) {
        const cx = 16 + i * 58;
        const cy = 22;
        const unlocked = snap.stemUnlocked[i];
        const muted = snap.stemMuted[i];
        const solo = snap.stemSolo[i];
        drawBevelBox(this.fb, FB_W, FB_H, cx, cy, 54, 30, packRGBA(22, 26, 44), unlocked ? STEM_COLORS[i] : packRGBA(56, 62, 86), packRGBA(8, 10, 18));
        drawText3x5(this.fb, FB_W, FB_H, snap.stemNames[i].slice(0, 8), cx + 3, cy + 3, unlocked ? STEM_COLORS[i] : packRGBA(112, 120, 148));

        // VU Meter bar
        const vuW = Math.round(snap.stemMeters[i] * 46);
        fillRect(this.fb, FB_W, FB_H, cx + 4, cy + 10, 46, 4, packRGBA(10, 12, 20));
        if (vuW > 0) fillRect(this.fb, FB_W, FB_H, cx + 4, cy + 10, vuW, 4, STEM_COLORS[i]);

        // Mute & Solo mini buttons
        const mCol = muted ? packRGBA(255, 88, 88) : packRGBA(46, 54, 78);
        const sCol = solo ? packRGBA(255, 224, 78) : packRGBA(46, 54, 78);
        fillRect(this.fb, FB_W, FB_H, cx + 4, cy + 17, 21, 10, mCol);
        drawText3x5(this.fb, FB_W, FB_H, 'MUTE', cx + 7, cy + 20, packRGBA(248, 250, 255));
        this.addHitRegion('STEM_MUTE', cx + 4, cy + 17, 21, 10, i);

        fillRect(this.fb, FB_W, FB_H, cx + 29, cy + 17, 21, 10, sCol);
        drawText3x5(this.fb, FB_W, FB_H, 'SOLO', cx + 32, cy + 20, solo ? packRGBA(12, 14, 22) : packRGBA(248, 250, 255));
        this.addHitRegion('STEM_SOLO', cx + 29, cy + 17, 21, 10, i);
      }

      // Live Scrolling 64-Step Hex Pattern Display (13 visible rows centered on currentRow!)
      fillRect(this.fb, FB_W, FB_H, 16, 56, 288, 92, packRGBA(8, 10, 18));
      strokeRect(this.fb, FB_W, FB_H, 16, 56, 288, 92, packRGBA(52, 68, 104));
      const patRows = snap.patterns[snap.patternIdx];

      for (let rOff = -6; rOff <= 6; rOff++) {
        const rIdx = (snap.row + rOff + 64) & 63;
        const py = 59 + (rOff + 6) * 7;
        const isCurrent = (rOff === 0);
        if (isCurrent) {
          fillRect(this.fb, FB_W, FB_H, 17, py - 1, 286, 7, packRGBA(42, 68, 118));
        }
        const hexRow = rIdx.toString(16).toUpperCase().padStart(2, '0');
        drawText3x5(this.fb, FB_W, FB_H, hexRow, 20, py, isCurrent ? packRGBA(255, 238, 96) : packRGBA(108, 124, 162));

        const rData = patRows[rIdx];
        const c0 = rData.drum ? rData.drum.padEnd(3, '-') : '---';
        const c1 = rData.bass ? snap.midiToTrackerStr(rData.bass.midi) : '---';
        const c2 = rData.chord ? snap.midiToTrackerStr(rData.chord.midis[0]) : '---';
        const c3 = rData.lead ? snap.midiToTrackerStr(rData.lead.midi) : '---';
        const c4 = rData.full ? snap.midiToTrackerStr(rData.full.midi) : '---';

        const cols = [c0, c1, c2, c3, c4];
        for (let ch = 0; ch < 5; ch++) {
          const tx = 42 + ch * 52;
          const col = isCurrent ? STEM_COLORS[ch] : (cols[ch] === '---' ? packRGBA(58, 68, 92) : packRGBA(178, 198, 232));
          drawText3x5(this.fb, FB_W, FB_H, `${cols[ch]} 0${ch + 1}`, tx, py, col);
        }
      }
    }

    // End-of-Level Results & Composed Song Replay Scrolling Visualizer!
    renderResultsScreen(sim, audioEngine, nextLevelCode) {
      fillRect(this.fb, FB_W, FB_H, 0, 0, FB_W, FB_H, packRGBA(12, 14, 26));
      const theme = WORLD_THEMES[sim.worldId];
      strokeRect(this.fb, FB_W, FB_H, 4, 4, FB_W - 8, FB_H - 8, theme.accent);

      const savedPct = sim.getSavedPct();
      const header = sim.won
        ? (savedPct === 100 ? 'PERFECT HARMONY - 100% SAVED!' : 'SONG COMPLETED - STAGE CLEAR!')
        : 'THE SONG FADED - TRY AGAIN!';
      const hCol = sim.won ? packRGBA(104, 255, 152) : packRGBA(255, 108, 108);
      drawText5x7(this.fb, FB_W, FB_H, header, Math.floor((FB_W - measureText5x7(header)) / 2), 12, hCol);

      const sub = `${sim.level.worldLabel}: ${sim.level.name}  |  STEMS UNLOCKED: ${sim.unlockedStems}/5`;
      drawText3x5(this.fb, FB_W, FB_H, sub, Math.floor((FB_W - measureText3x5(sub)) / 2), 24, packRGBA(184, 224, 255));

      // Score summary cards
      drawBevelBox(this.fb, FB_W, FB_H, 14, 34, 94, 26, packRGBA(20, 26, 44), packRGBA(78, 96, 142), packRGBA(8, 10, 18));
      drawText3x5(this.fb, FB_W, FB_H, 'TRIBE SAVED', 22, 38, packRGBA(168, 196, 238));
      drawText5x7(this.fb, FB_W, FB_H, `${savedPct}% / ${sim.saveReqPct}%`, 22, 47, hCol);

      drawBevelBox(this.fb, FB_W, FB_H, 113, 34, 94, 26, packRGBA(20, 26, 44), packRGBA(78, 96, 142), packRGBA(8, 10, 18));
      drawText3x5(this.fb, FB_W, FB_H, 'GROOVE SCORE', 121, 38, packRGBA(168, 196, 238));
      drawText5x7(this.fb, FB_W, FB_H, `${sim.grooveScore}`, 121, 47, packRGBA(255, 232, 92));

      drawBevelBox(this.fb, FB_W, FB_H, 212, 34, 94, 26, packRGBA(20, 26, 44), packRGBA(78, 96, 142), packRGBA(8, 10, 18));
      drawText3x5(this.fb, FB_W, FB_H, nextLevelCode ? 'NEXT PASSWORD' : 'CAMPAIGN', 220, 38, packRGBA(168, 196, 238));
      drawText5x7(this.fb, FB_W, FB_H, nextLevelCode || 'VICTORY!', 220, 47, packRGBA(255, 148, 236));

      // Scrolling Composed Song Piano-Roll Visualizer (x = 14..306, y = 66..162)
      drawBevelBox(this.fb, FB_W, FB_H, 14, 66, 292, 96, packRGBA(8, 10, 18), theme.accent, packRGBA(6, 8, 14));
      drawText3x5(this.fb, FB_W, FB_H, 'LIVE REPLAY OF YOUR COMPOSED TRIBE SCORE:', 20, 70, packRGBA(146, 242, 214));

      if (audioEngine) {
        const rep = audioEngine.getReplayState();
        const { freq } = audioEngine.sampleAnalyser();

        // Subtle background spectrum glow inside piano roll
        for (let b = 0; b < 28; b++) {
          const fv = freq[Math.min(freq.length - 1, b * 2)] / 255;
          const bh = Math.round(fv * 32);
          if (bh > 0) {
            fillRect(this.fb, FB_W, FB_H, 20 + b * 10, 158 - bh, 7, bh, packRGBA(24, 42, 68));
          }
        }

        // Playhead line at x = 78
        const playheadX = 78;
        fillRect(this.fb, FB_W, FB_H, playheadX, 78, 2, 80, packRGBA(255, 252, 168));

        // Render recorded notes scrolling across playhead!
        const kindColors = {
          step: packRGBA(88, 224, 255),
          build: packRGBA(255, 228, 84),
          dig: packRGBA(255, 118, 82),
          bash: packRGBA(186, 255, 72),
          mine: packRGBA(255, 168, 72),
          climb: packRGBA(126, 255, 178),
          float: packRGBA(198, 142, 255),
          bomb: packRGBA(255, 72, 98),
          exit: packRGBA(255, 255, 210)
        };

        for (let i = 0; i < rep.events.length; i++) {
          const ev = rep.events[i];
          // Wrap step relative to currentStep so loop scrolls seamlessly
          let ds = ev.step - rep.currentStep;
          if (ds < -24) ds += rep.totalSteps;
          const nx = playheadX + ds * 4;
          if (nx < 18 || nx > 300) continue;

          const normPitch = Math.max(0, Math.min(1, (ev.midi - 36) / 48));
          const ny = 152 - Math.round(normPitch * 68);
          const nw = Math.max(3, Math.min(14, Math.round((ev.dur || 0.16) * 28)));
          const activeHit = Math.abs(ds) <= 1;
          const nCol = activeHit ? packRGBA(255, 255, 255) : (kindColors[ev.kind] || STEM_COLORS[ev.degree % 5]);
          fillRect(this.fb, FB_W, FB_H, nx, ny, Math.min(nw, 302 - nx), activeHit ? 4 : 3, nCol);
        }
      }

      // Action buttons at bottom (y = 170..188)
      if (sim.won) {
        this.drawButton('NEXT_LEVEL', 20, 170, 92, 18, 'NEXT LEVEL', true, packRGBA(98, 255, 148));
      } else {
        this.drawButton('RETRY_LEVEL', 20, 170, 92, 18, 'TRY AGAIN', true, packRGBA(255, 214, 88));
      }
      this.drawButton('REPLAY_SONG', 118, 170, 92, 18, 'REPLAY SONG', false, packRGBA(118, 224, 255));
      this.drawButton('OPEN_SELECT', 216, 170, 84, 18, 'LEVELS', false, packRGBA(218, 168, 255));
    }
  }

  BeatTribe.Renderer = {
    FB_W,
    FB_H,
    PLAY_H,
    HUD_Y,
    HUD_LAYOUT,
    FramebufferRenderer
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Renderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
