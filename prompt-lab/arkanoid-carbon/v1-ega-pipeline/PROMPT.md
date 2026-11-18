You are a highly creative Retro Game Designer, an expert C++ and JavaScript Software Engineer, a professional Chiptune Composer, and a hardcore LucasArts historian.

Your task is to write a complete, single-file retro Arkanoid clone (`index.html`) and save it inside this directory. The game must be immediately playable in a modern browser by opening this file, meaning all HTML, CSS, JavaScript, graphics rendering, and audio synthesis must be self-contained in this single file. No external assets (images, audio files, fonts, or libraries) are allowed.

To truly honor the LucasArts legacy, the game must pair an authentic, demoscene-grade 320x200 EGA pixel-art engine with a multi-channel AdLib/OPL2 FM chiptune synthesizer featuring distinct procedural soundtracks for every world.

---

### 🎵 High-Fidelity AdLib FM Synthesizer & Music Engine (CRITICAL)

You must implement a robust, customized **Web Audio API synthesizer** running a multi-channel scheduler. It must NOT use simple beep sounds; instead, it must build a simulated OPL2 synthesizer with:

1. **Instruments:** Define distinct Web Audio synthesizer patches:
   - _FM Lead/Melody:_ A carrier/modulator pair (using `GainNode` modulation of an oscillator's frequency) to create a biting metal brass or hollow woodwind sound.
   - _Bass:_ A fat triangle wave with a fast-decaying low-pass filter to simulate a punchy bass synth.
   - _Percussion/Noise:_ A synthesized noise buffer or band-pass filtered white noise burst for snappy retro snare/hi-hat hits.
2. **The Sequencer/Tracker:** Create a precise, state-driven step-sequencer (running on a fast clock loop, e.g., 120-140 BPM, utilizing `Web Audio` scheduling timestamps to avoid browser drift).
3. **Soundtrack Variety (Each level has its own unique soundtrack!):**
   Hardcode **distinct musical compositions** (separate note, pitch, velocity, and duration arrays) for different levels/themed worlds:
   - _The Monkey Island Theme (Levels 1–6):_ A syncopated, bouncing Caribbean-style reggae groove featuring a metallic steel-pan FM lead, a walking bassline, and upbeat off-beat percussion.
   - _The Purple Tentacle March (Levels 7–12):_ A quirky, chromatic, and mischievous march with a fast-modulating square wave lead (suggesting an active b-movie monster) and dramatic descending bass stabs.
   - _The Atlantis Crypt (Levels 13–18):_ A slow, mysterious ambient soundscape featuring a sweeping, echoing pad, low frequency bass hums, and a random, haunting pentatonic chime melody.
   - _Space Combat Flight (Levels 19–24):_ A fast-paced, driving 16th-note bassline with a high-energy, soaring futuristic lead synth and rapid snare drums to capture high-stakes space action.
   - _The Loom of Fate (Levels 25–30):_ A beautiful, complex, four-voice classical counterpoint piece where the synth voices weave melodies together to form complex chords.
   - _The Road to Sam & Max (Levels 31–32):_ A swing-jazz, walking bass blues line with a highly expressive, pitch-bending "synth saxophone" lead.
   - _LeChuck's Battle Anthem (Level 33):_ A bombastic, rapid-fire heavy metal style track with highly distorted carrier-modulated guitar leads, double-time drums, and an aggressive, dark minor-scale bassline.

- **Audio FX (SFX):**
  - All game sound effects must be scheduled on dedicated FX channels so they cut through or gracefully mix with the active background tracks without causing audio clipping.
  - SFX must sound satisfyingly low-fi (leveraging pitch sweeps, envelope adjustments, and bit-crush styled distortion filters).

---

### 🎨 High-Craft EGA Pixel-Art Rendering Pipeline (CRITICAL — Equal Priority to Audio)

Do NOT draw flat `fillRect` placeholder boxes for backgrounds, sprites, capsules, or bosses. Build an authentic 1990 LucasArts EGA pixel-art engine with the following mandatory primitives:

1. **Viewport, Integer Scaling & Classic Arkanoid Split Layout (`320x200`):**
   - Render to a strict **320x200** internal `<canvas>` (`imageSmoothingEnabled = false`, `image-rendering: pixelated`), resized in JS to the largest whole-number device-pixel multiple that fits the cabinet bezel so pixels never shimmer. Never use half-pixel `strokeRect(x + 0.5, ...)` calls or browser vector fonts on the canvas.
   - **Classic Arkanoid Split Layout:** Partition the `320x200` screen into a **`256x200` Playfield** framed on the left (`8px`), top (`8px`), and right (`8px`) by riveted, 3-tone beveled metallic border pipes (using per-world EGA palette colors), and a **`64x200` Dithered Right-Hand HUD Sidebar** (`x = 256..319`) displaying the game logo, 7-digit score & hi-score, level counter (`01/33`), mini-paddle life icons, active world mechanic meter/readout, active power-up capsule badges, and a clipped scrolling soundtrack marquee.
   - **Live Attract-Mode Title Screen:** Render the Main Menu and Title Logo directly *over* the live parallax backdrop and brick mosaic of the currently selected level (`Left`/`Right` previews any stage 1–33)—never cover the playfield with a giant opaque black box.

2. **64-Color EGA Palette, Algorithmic Shading & 4x4 Bayer Ordered Dithering:**
   - Define all **64 exact IBM EGA hardware palette** hex registers (`0..63`) plus an `egaShade(register, delta)` helper that steps any EGA color lighter (`+1`) or darker (`-1`) in 6-bit RGB space for automatic specular highlights and bevel shadows.
   - Implement a **4x4 Bayer ordered dithering** primitive (`ditherRect(ctx, x, y, w, h, regA, regB, level0to16)`) and a multi-stop vertical `ditherGradient(ctx, x, y, w, h, regStops)` helper—the signature texture technique of *Loom* and *The Secret of Monkey Island*.

3. **Pre-Rendered 3-Layer Offscreen Parallax Backdrops (1 Per World):**
   - At startup/world load, pre-render **3 offscreen `<canvas>` parallax layers** (`far`, `mid`, `near`, wider than the playfield so they slide at different depths with paddle movement) for each of the 7 worlds:
     - Dithered EGA sky/cavern gradients, multi-shade starfields (`60+` stars across 4 EGA brightnesses), scanline-rasterized circular moons/planets with dithered craters (never square moons), pixel-exact mountain/island ridges and crooked Victorian mansard rooftops (no anti-aliased paths), lit village/mansion windows, shimmering water reflections, stone masonry blocks with torches, and animated lava/sludge scanlines.

4. **ASCII Pixel-Art Sprite Compiler (`makeSprite` — No `fillRect` Box-Art):**
   - Implement a `makeSprite(rows, paletteMap)` compiler that converts 2D character-grid strings (`'.'` = transparent) into cached offscreen `<canvas>` sprites with `1px` dark outlines and multi-tone EGA shading.
   - Author genuine pixel-art sprite matrices for:
     - **18x9 Beveled Pill Capsules** pairing a crisp letter badge (`L`, `E`, `C`, `S`, `P`) on the left with a dedicated `7x7` pixel-art icon on a recessed dark panel on the right (space-ranger blaster, rubber chicken with pulley, magnetic compass, hourglass, pixelated LucasArts Gold Guy).
     - **Shaded 4x4 / 5x5 Sphere Ball** (with specular highlight pixel and glowing motion trail when powered up) and **Detailed Vaus Paddle** (with distinct pixel-art geometry for Rubber Chicken Expand, Twin Space-Ranger Blasters, and Magnetic Compass needle).
     - **World Hazards & Level 33 Boss:** Detailed pixel-art poison darts, flaming voodoo skulls, swirling spiral particle gravity wells, and an animated multi-frame **Ghost Pirate LeChuck Boss Sprite** (`>= 32x24` pixels with tricorne hat, glowing eyes, animated flaming ghost beard, and health bar).

5. **Proportional `5x7` Outlined Bitmap Font Atlas:**
   - Include a full ASCII **`5x7` bitmap font** pre-rendered to tintable offscreen glyph sheets (not a tiny `3x5` micro-font), supporting `1px` 8-neighbor black pixel outlines and integer `2x`/`3x` scaling for crisp, readable titles and banners over pixel art.

6. **Cached Beveled Brick Tiles & Arcade Visual "Juice":**
   - Cache brick states (`normal`, `2-stage cracked armor`, `dithered steel with corner rivets`, `animated bubbling grog`, `world-mechanic special bricks`, `white hit-flash`) as offscreen `8x6` tiles with 4-edge 3D bevels (`top/left` highlight, `bottom/right` shadow).
   - Add `1–2px` screen-shake on Grog 3x3 chain explosions and boss hits, EGA scanline stipple flashes, pixel debris particles, and floating outlined score/status popups (`+150`, `EN GARDE!`).

---

### 🕹️ Controls

- **Mouse:** Paddle tracks horizontal mouse coordinates smoothly.
- **Keyboard:** Arrow keys / `A` and `D` keys for movement, `Spacebar` (or Left-Click) to launch the ball or fire lasers, `P` to pause, `M` to mute audio, and `Left`/`Right` on the Main Menu to select any starting level (`1–33`).

---

### 👾 High-Density LucasArts Pixel-Art Mosaic Levels (33 Levels)

Design **33 unique levels** on a **high-density `28–30` column × `16–18` row grid of `8x6` pixel bricks** (fit cleanly inside the `240px` inner playfield width), mapping single-character ASCII codes (`a-z` normal bricks, `A-Z` multi-hit armored bricks, `#` indestructible steel, `*` explosive 3x3 Grog, plus world-mechanic trigger bricks) across **at least 16 distinct EGA colors**. Rather than coarse rows of wide bars, every stage must form an unmistakable, recognizable LucasArts pixel-art mosaic (Jolly Roger skull, foaming Grog mug, Three-Headed Monkey, Purple Tentacle, Chron-o-John, Atlantean idol, X-Wing/TIE trench, Loom distaff/swan, Max's lagomorph grin, and LeChuck's ghost galleon), paired with custom per-world mechanics (insult sword fighting comebacks, Chron-o-John time-era brick phasing, Atlantean dart-spitting traps, orbital gravity wells, Loom musical draft note-weaving, Sam & Max moving road formations, and the Level 33 LeChuck moving boss battle with voodoo fireball dodging).

---

### 🧱 Game Mechanics & Power-ups

- **Brick Types:** Normal bricks (1 hit), Armored bricks (multi-hit with progressive visual cracking), Indestructible steel bricks (dithered metallic sheen with rivets), and _Grog Bricks (Explosive 3x3 recursive chain reaction)_.
- **Power-ups:** Spawning upon brick destruction and falling smoothly as `18x9` beveled pixel-art capsules:
  - **L (Laser):** Attaches twin space-ranger blasters to shoot bricks.
  - **E (Expand):** Widens the paddle (transforms into a rubber chicken with a pulley in the middle).
  - **C (Catch):** Magnetizes the ball on contact (with compass indicator) until launched.
  - **S (Slow):** Decelerates ball speed (hourglass icon).
  - **P (Player):** Grants an extra life (LucasArts Gold Guy icon).

---

### 📋 Code Architecture Requirements

Provide the **entire, clean, production-ready single-file HTML/CSS/JS code** (`index.html`) with zero placeholders, `TODO` comments, or skipped levels:
1. Inline CSS styling a dark CRT arcade cabinet bezel (with optional toggleable scanlines) framing the integer-scaled `320x200` canvas.
2. Complete state management (`MENU`, `PLAYING`, `LEVEL_CLEAR`, `GAME_OVER`, `VICTORY`, plus `PAUSED`), score, persistent high score (`localStorage`), and lives.
3. All 33 high-density `8x6`-brick pixel-art mosaic level layouts.
4. Swept/sub-stepped circle-vs-AABB collision physics solving corner and seam bounces cleanly so the ball never clips through bricks.
5. Web Audio OPL2 FM synthesizer wrapped in a user-interaction unlock handler.
