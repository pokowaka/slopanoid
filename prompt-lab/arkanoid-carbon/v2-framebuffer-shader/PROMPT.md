You are a legendary 1990s Amiga/DOS Demoscene Shader Wizard, Retro Game Designer, C++/JavaScript Systems Engineer, and Chiptune Composer steeped in LucasArts history.

Your task is to write a complete, single-file retro Arkanoid clone (`index.html`) inside this directory. The game must be immediately playable in a modern browser with zero external assets (no external images, audio files, fonts, or libraries).

Instead of flat Canvas 2D `fillRect` drawing, you will build a **true `320x200` software pixel-buffer rasterizer (`Uint32Array` / `ImageData`)** with procedural heightmap surface-normal lighting, Bayer ordered dithering quantized strictly to the **64-color IBM EGA hardware palette**, demoscene per-scanline raster effects, and a multi-channel AdLib/OPL2 FM chiptune synthesizer.

---

### 🎨 Software Framebuffer (`Uint32Array`) & Lit Pixel-Shader Engine (CRITICAL)

Do NOT render game graphics with flat `ctx.fillRect` or `ctx.strokeRect` boxes. Build a locked-60-FPS **software pixel rasterizer** (`const fb = new Uint32Array(imageData.data.buffer)` at `320x200`, blitted once per frame via `ctx.putImageData(imageData, 0, 0)` on an integer-scaled `image-rendering: pixelated` canvas):

1. **Exact 64-Color EGA Hardware Quantizer & Bayer Dithering:**
   - Precompute all **64 IBM EGA palette registers** as packed 32-bit ABGR `Uint32` integers, plus a fast RGB-to-EGA lookup/ramp quantizer using a **4x4 Bayer ordered dithering matrix** (`BAYER_4X4[(y & 3) * 4 + (x & 3)]`) so continuous lighting, skies, and metallic gradients dither crisply into authentic 64-color EGA stipple patterns with zero smooth 24-bit banding.

2. **Procedural Heightmap + Surface-Normal Sprite & Tile Compiler (`compileLitSprite`):**
   - Implement a software sprite/tile compiler `compileLitSprite(w, h, sampleFn)` that evaluates a procedural height `h(x, y)` + material color ramp per pixel, computes finite-difference surface normals `(nx, ny, nz)` lit by a classic top-left key light `(-0.55, -0.60, 0.58)` (diffuse + crisp specular highlight), quantizes onto your EGA palette ramps with Bayer dithering, and automatically stamps a **`1px` dark EGA outline** around every non-transparent silhouette pixel!
   - Pre-compile all sprites and `8x6` brick tiles at startup into fast `Uint32Array` blitter buffers:
     - **3D Sculpted `8x6` Brick Tiles:** Glossy beveled normal bricks (in 16+ EGA hues), multi-stage battle-scarred Armored bricks with recessed fracture cracks, brushed-chrome riveted Steel bricks, animated bubbling green-acid Grog bricks, and glowing world-mechanic bricks (crossed cutlasses, pulsing Chron-o-John, golden dart-spitting idol, musical rune bricks).
     - **Sculpted `18x9` Pill Capsules:** Cylindrical lit EGA capsules with specular sheen, a crisp letter stamp (`L`, `E`, `C`, `S`, `P`), and a detailed pixel-art icon (blaster, rubber chicken with pulley, compass, hourglass, LucasArts Gold Guy).
     - **Spherical Lit Ball & Sculpted Vaus Paddle:** Specular-lit `5x5` chrome/plasma sphere ball (with dithered afterimage trail) and cylindrical metallic Vaus paddle that physically morphs into a sculpted Rubber Chicken with pulley (`E`), twin Space-Ranger laser cannons (`L`), or glowing magnetic compass core (`C`).
     - **Sculpted Level 33 Boss & World Entities:** Multi-frame `40x28` lit pixel-art **Ghost Pirate LeChuck** (tricorne pirate hat, glowing red-eyed skull, flickering dithered fire-beard, voodoo skull projectiles), Atlantean poison darts, and swirling polar-coordinate particle gravity vortices.

3. **Demoscene Multi-Layer Parallax & Per-Scanline Raster Backdrops (7 Worlds):**
   - Pre-bake wide (`288x192`) multi-layer EGA-indexed backdrop buffers per world and composite them with **real-time per-scanline demoscene raster effects**:
     - *World 1 (Mêlée Island):* Dithered twilight sky, cratered circular moon, hilltop town silhouette with warm glowing Scumm Bar windows, and **per-scanline sine-wave harbor water reflections** at the bottom of the playfield.
     - *World 2 (Edison Mansion):* Crooked mansard roof towers, lightning-flash sky dither, and bubbling radioactive green sludge waves.
     - *World 3 (Atlantis Crypt):* Carved dithered Mayan stonework, flickering torchlight radial dither halos, and molten orichalcum lava conduits.
     - *World 4 (Space Combat):* 3-plane parallax starfield, dithered ringed gas-giant planet, and scrolling perspective Death-Star trench scanlines.
     - *World 5 (Loom):* Starlit indigo sky, crystalline guild spires, and shimmering emerald ocean waves.
     - *World 6 (Sam & Max):* Sunset desert mesas and **OutRun-style perspective-warped scrolling highway scanlines** with yellow center dashes.
     - *World 7 (LeChuck's Lair):* Volcanic stalactites, rising ember particles, and **per-scanline heat-haze cavern shimmer** above churning lava.

4. **Classic `256x200` Playfield + `64x200` Right-Hand HUD Sidebar & `5x7` Outlined Font:**
   - Frame a `256x200` playfield (`8px` lit metallic pipes on left/top/right) beside a `64x200` Bayer-dithered HUD panel (`x = 256..319`) showing logo, 7-digit score/hi-score, stage `XX/33`, mini-paddle lives, custom world-mechanic gauge, active capsule icons, and scrolling song title.
   - Blit a full proportional **`5x7` ASCII bitmap font** directly into `fb` with `1px` 8-neighbor black outlines and `2x`/`3x` integer scaling. Render the Main Menu directly over the live animated backdrop + brick mosaic of the selected level (`1–33`).
   - Include screen-shake, EGA stipple flashes on Grog chain explosions, physics sparks, and floating outlined score popups.

---

### 🎵 High-Fidelity AdLib FM Synthesizer & Music Engine (CRITICAL)

Implement a customized **Web Audio API simulated OPL2 FM synthesizer** with lookahead timestamp scheduling (120–140 BPM) and dedicated non-clipping lo-fi SFX channels:
1. **Patches:** Carrier/modulator `GainNode` FM Leads (brass/woodwind/steel-pan/distorted guitar), resonant low-pass triangle Bass, and filtered white-noise Percussion (kick/snare/hi-hat).
2. **7 Distinct Multi-Bar Compositions:**
   - *Levels 1–6 (Monkey Island):* Syncopated Caribbean reggae groove, steel-pan FM lead, walking bass.
   - *Levels 7–12 (Purple Tentacle March):* Quirky chromatic B-movie monster march with descending bass stabs.
   - *Levels 13–18 (Atlantis Crypt):* Sweeping echoing FM pad, deep bass hums, haunting pentatonic chimes.
   - *Levels 19–24 (Space Combat):* Driving 16th-note bassline, soaring heroic lead, rapid snare rolls.
   - *Levels 25–30 (Loom of Fate):* Four-voice classical counterpoint weaving arpeggiated chords.
   - *Levels 31–32 (Sam & Max):* Swing-jazz walking bass blues with pitch-bending FM saxophone lead.
   - *Level 33 (LeChuck's Battle Anthem):* Bombastic double-time heavy metal with distorted FM guitar leads.

---

### 👾 High-Density 33-Level LucasArts Pixel-Art Mosaics, Mechanics & Controls

- **33 Mosaic Levels (`28–30 cols × 16–18 rows` of `8x6` bricks, 16+ EGA colors):** Every stage is a detailed, recognizable LucasArts pixel-art mosaic (Jolly Roger, foaming Grog mug, Three-Headed Monkey, Purple Tentacle, Chron-o-John, Atlantean idol, X-Wing/TIE fighter, Loom swan/distaff, Max's grin, LeChuck's ghost ship) paired with its world mechanic (insult sword-fighting duels, Chron-o-John time-era phasing, dart-spitting idols, orbital gravity wells, Loom 4-note spell weaving, moving highway formations, and Level 33's moving LeChuck boss battle).
- **Bricks & Power-ups:** Normal (`1 HP`), Armored (`2–3 HP` cracking), Steel (indestructible), Grog (`3x3` recursive chain explosion), plus `L` (Laser), `E` (Expand rubber chicken), `C` (Catch compass), `S` (Slow hourglass), and `P` (Extra life Gold Guy).
- **Controls & Physics:** Smooth mouse + `A`/`D`/`Arrow` movement, `Space`/Click launch & fire, `Left`/`Right` menu stage select (`1–33`), `P` pause, `M` mute, sub-stepped circle-vs-AABB corner-safe bounce physics, zero `TODO`s or placeholders.
