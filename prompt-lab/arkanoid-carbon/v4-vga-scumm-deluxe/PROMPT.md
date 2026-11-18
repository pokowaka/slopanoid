You are the Lead VGA Background Painter & Sprite Animator of 1992-era LucasArts (*Monkey Island 2: LeChuck's Revenge*, *Indiana Jones and the Fate of Atlantis*, *Day of the Tentacle*), paired with an expert JavaScript Game Engine Programmer and AdLib OPL2 Chiptune Composer.

Your task is to write a complete, single-file retro Arkanoid tribute (`index.html`) inside this directory—immediately playable in any modern browser with zero external assets (all HTML, CSS, JS, procedural pixel art, 33 levels, and Web Audio FM music self-contained in one file).

---

### 🎨 PRIORITY #1: Lush 1992 LucasArts 256-Color VGA Pixel Art & SCUMM Presentation (50% of Effort)

Treat visual craftsmanship as the centerpiece of this build. Upgrade from flat early-EGA blocks to **rich 1992 LucasArts 256-color VGA Mode 13h (`320x200`, integer-scaled, `image-rendering: pixelated`) painterly pixel art**:

1. **Painterly 256-Color VGA Ramps & Ordered Dithering:**
   - Construct a curated **256-color VGA palette** organized into smooth **8-to-16-shade artist ramps** (deep Caribbean twilight blues/teals, warm Scumm Bar lantern golds/ambers, Tentacle Mansion purples/toxic greens, Atlantean terracotta & molten orichalcum, starfighter chrome/plasma cyan, Loom celestial indigos, and LeChuck necrotic ghost-greens/hellfire oranges).
   - Provide a 4x4 Bayer ordered-dither ramp painter (`paintRampGradient`, `dither Ramp`) so skies, clouds, stone vaults, water, and metallic trim blend with authentic 1992 pixel-art warmth—never smooth CSS/Canvas vector gradients or half-pixel anti-aliased strokes.

2. **Multi-Plane Painterly Parallax Scenery (7 Worlds, Pre-Rendered Offscreen Layers):**
   - Pre-render **3 to 4 offscreen `<canvas>` parallax planes** per world (`sky/moon`, `far horizon`, `mid architecture`, `foreground details` + animated water/lava/star overlays):
     - *Mêlée Island:* Glowing full moon behind dithered trade-wind clouds, silhouetted cliffside lookout & pirate galleon masts, warm flickering Scumm Bar pier lanterns, and multi-shade harbor wave reflections.
     - *Edison Mansion:* Stormy purple dusk, crooked Victorian mansion towers with glowing lab windows, hilltop tombstones, and bubbling green sludge river.
     - *Lost Atlantis:* Carved subterranean temple colonnades, glowing orichalcum relief murals, flickering braziers with warm radial pixel dither halos, and flowing lava channels.
     - *Space Combat:* Deep-space painterly nebula clouds, shaded ringed planet with terminator shadow, 3-speed starfield, and perspective trench hull plates.
     - *Island of Loom:* Shimmering aurora/star sky, cathedral crystal spires, cliffside swan shrine, and emerald sea spray.
     - *Sam & Max Highway:* Desert sunset mesa silhouettes, neon roadside signs, and animated perspective highway dashes.
     - *LeChuck's Fortress:* Jagged volcanic cavern maw, ghost-ship ribs, rising ember particles, and churning molten lava glow.

3. **Classic `256x200` Playfield + `64x200` Right-Hand HUD with Live Animated SCUMM Character Portraits!**
   - Left `256x200`: Playfield framed by ornate, world-themed `8px` sculpted pixel borders (carved pirate wood & brass, mansion pipes, Atlantean stone, starship hull, Loom stained crystal). Render the Main Menu directly over the live animated backdrop & brick mosaic (`Left`/`Right` previews all 33 stages).
   - Right `64x200` (`x = 256..319`): Textured sidebar featuring:
     - **Live Animated `48x36` Pixel-Art Character Portrait Box** (Guybrush Threepwood, Purple Tentacle, Indiana Jones, Rebel Pilot, Bobbin Threadbare, Max, and Ghost Pirate LeChuck) with blinking eyes, animated talking mouth when delivering witty one-liners/insults, and wincing/cheering expressions on ball loss or big combos!
     - Crisp `5x7` pixel-outlined bitmap font (never `3x5` or browser fonts) showing 7-digit Score/Hi-Score, Stage `XX/33`, mini-paddle Lives, active World Mechanic gauge, active Power-up badges, and scrolling AdLib track marquee.

4. **High-Detail ASCII/Bitmap Sprites, `30x18` (`8x6` Brick) Mosaics & Arcade Juice:**
   - **Sprites (`makeSprite` character-grid bitmaps with `1px` dark silhouettes + 4-shade VGA ramps):** `18x9` glossy beveled capsules with `7x7` pixel icons (`L` blaster, `E` rubber chicken w/ pulley, `C` compass, `S` hourglass, `P` Gold Guy); specular-lit `5x5` orb ball with glowing pixel trail; richly detailed Vaus/Chicken/Blaster/Compass paddle sprites; poison darts, voodoo skulls, spiral gravity vortices, and a centerpiece **`44x30` multi-frame Ghost Pirate LeChuck Boss** on Level 33.
   - **33 Recognizable Pixel-Art Mosaic Levels (`28–30 cols × 16–18 rows` of `8x6` beveled bricks):** Use rich multi-shade VGA ramp codes so every stage looks like an unmistakable, shaded pixel-art illustration (Jolly Roger skull, foaming Grog mug, Three-Headed Monkey, Purple Tentacle, Chron-o-John, Atlantean sun-idol, X-Wing/TIE trench, Loom distaff/swan, Max's grin, LeChuck's ghost galleon).
   - **Arcade Juice:** Hit-flash, `1–2px` screen-shake, radial pixel explosion rings & sparks on 3x3 Grog chain reactions, and pixel-outlined floating score/quips.

---

### 🎵 PRIORITY #2: Multi-Channel AdLib / OPL2 FM Synthesizer (7 World Soundtracks + SFX)

Implement a Web Audio API **simulated OPL2 FM synthesizer** (lookahead step-sequencer at 120–140 BPM + dedicated lo-fi SFX channels, unlocked on first click/key):
- **Patches:** Carrier/modulator `GainNode` FM Leads (steel-pan, B-movie square-FM, echoing chime/pad, heroic brass, classical voices, pitch-bent FM sax, distorted metal guitar), punchy filtered triangle Bass, and synthesized noise Percussion.
- **7 Distinct Hardcoded Soundtracks:** *Monkey Island Reggae* (1–6), *Purple Tentacle March* (7–12), *Atlantis Crypt Ambient* (13–18), *Space Combat Driving Synth* (19–24), *Loom 4-Voice Counterpoint* (25–30), *Sam & Max Swing-Jazz Blues* (31–32), and *LeChuck Heavy Metal Boss Anthem* (33).

---

### 🕹️ Controls, World Mechanics & Completeness

- **7 World Mechanics:** Insult sword-fighting duels (1–6), Chron-o-John era-phasing bricks (7–12), dart-spitting Atlantean idols (13–18), orbital gravity wells (19–24), Loom musical note-weaving spells (25–30), Sam & Max patrolling road formations (31–32), and LeChuck's moving fireball boss battle (33).
- **Bricks & Power-ups:** Normal (`1 HP`), Armored (`2–3 HP` progressive cracks), Steel (indestructible), Grog (`3x3` recursive chain explosion); Capsules `L`, `E`, `C`, `S`, `P`.
- **Controls & Physics:** Smooth mouse + `A`/`D`/`Arrows`, `Space`/Click launch & fire, `Left`/`Right` stage select (`1–33`), `P` pause, `M` mute, toggleable CRT scanlines, `localStorage` hi-score, sub-stepped corner-safe circle-vs-AABB collision physics, and zero placeholders or `TODO`s.
