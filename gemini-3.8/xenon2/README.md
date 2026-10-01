# Xenon II &middot; Megablast: Evolution & Tracker Odyssey

> **A Complete Clean-Room Retro Tribute to The Bitmap Brothers' 1989 Amiga Masterpiece**  
> *Zero External Assets &middot; Zero Third-Party Libraries &middot; 320&times;200 Software Framebuffer &middot; 8-Channel Web Audio Tracker Sequencer &middot; Real-Time TB-303 Acid Synthesis*

---

## 1. Executive Summary & Design Philosophy

**Xenon II: Megablast &middot; Evolution & Tracker Odyssey** is an authentic, self-contained reimagining of the legendary vertical shoot-'em-up designed by **The Bitmap Brothers** and featuring the iconic soundtrack composed by **Bomb the Bass** (Tim Simenon) with David Whittaker's legendary tracker arrangement.

Built from scratch in pure Vanilla JavaScript, HTML5 Canvas, and Web Audio API without a single external image, audio sample, or third-party dependency, the entire game engine, graphics pipeline, sound synthesizers, and game mechanics fit inside a single, zero-CORS HTML file.

---

## 2. Core Architectural Pillars

### A. Graphics & Software Framebuffer Pipeline (320&times;200 VGA Mode 13h / Amiga OCS)
* **Direct Pixel Manipulation**: Renders directly into a 320&times;200 `Uint32Array` software framebuffer (`ImageData.data.buffer`) simulating the Amiga's Blitter and Copper coprocessors.
* **Bitmap Brothers Specular Chrome Palette**: 16-shade lookup tables (LUTs) for high-contrast specular steel, polished brass, alien chitin, and radiant fire.
* **4&times;4 Bayer Ordered Dithering**: Authentic cross-hatch shading reproducing Amiga 32-color Half-Brite and OCS gradient transitions.
* **Multi-Layer Parallax Caverns**:
  1. *Layer 1 (0.25&times;)*: Deep starfield with twinkling distant stars and Stage 4 copper rainbow raster bars.
  2. *Layer 2 (0.6&times;)*: Biomechanical ribcage arches, copper steam pipes, and fossilized spires.
  3. *Layer 3 (1.0&times;)*: Destructible cavern walls, coral bottlenecks, and narrow mineral obstacles.
* **Real-Time Modular Ship Visuals**: All bolted upgrades physically render onto the Megablaster fuselage:
  - Base sleek chrome craft with 5 banking tilt frames (`-2, -1, 0, +1, +2`) and specular cockpit glass reflections.
  - Nose Cannons (Long Twin Vulcan barrels, Glowing Plasma bulb, or Conductive Tesla prongs).
  - Wing Pods (Flanking Laser emitters, Rocket missile racks, or Magnetic Bounce-Orb rings).
  - Tail Mounts (Dual rear cannons or pulsing temporal mine cradle).
  - Dual Orbiting Drones (Revolving around the ship in a 3D tilted ellipse).
  - Hull Augmentations (Bolted gold armor plates, oversized quad afterburners, or cooling radiator fins).
  - Dynamic Exhaust Plumes (Forward blue-white plasma flames; forward-firing orange plumes on reverse scroll!).
* **Toggleable CRT Bezel & Scanlines**: Authentically curved monitor bezel with toggleable horizontal scanline mask and phosphor glass glare (`[C]` key).

---

### B. 8-Channel Amiga MOD Tracker Sequencer (`audio.js`)
* **Live Tracker Engine**: Accurate 16th-note lookahead scheduling at 125 BPM (120ms per row) running through a master demoscene compressor, stereo ping-pong delay network, and master dub filter.
* **7 Full 64-Step Song Patterns**:
  1. `00: INTRO`: Suspenseful break, Carpenter bass motifs, vinyl scratch teasers, riser, and "MEGA-BLAST!" vocal stab.
  2. `01: PRECINCT 13 MAIN GROOVE`: The legendary Bomb the Bass driving rhythm with relentless 16th-note Carpenter bassline, 909 kick/snare breakbeat, brass stabs, hi-hats, and cowbell.
  3. `02: TB-303 ACID BREAKDOWN`: Roland TB-303 takes center stage with squelchy resonant filter sweeps, slides, accents, and syncopated ghost snares.
  4. `03: BRASS & SCRATCH DROP`: Massive orchestral brass chords, soaring delay lead synth carrying the iconic melody, and "YEAH!" vocal stabs.
  5. `04: BRIDGE`: Ambient demoscene arpeggio leads and building 16th-note snare rolls.
  6. `05: BOSS RAVE`: Hyper-accelerated tempo, double-kick barrage, emergency rave alarms, and screaming acid lines.
  7. `06: CRISPIN'S ELECTRO-DUB SHOP GROOVE`: Laid-back dub reggae groove with master dub lowpass filter and space echoes.
* **8 Distinct Synthesizer Channels**:
  - `CH1: BASS`: Dual-oscillator (sawtooth + sub-square) with snappy resonant lowpass envelope (1400Hz &rarr; 220Hz).
  - `CH2: TB-303 ACID`: High-resonance lowpass (`Q = 14..18`) with dynamic cutoff envelope decay, portamento frequency slides (`~`), and accent boosts (`+`).
  - `CH3: LEAD`: Dual detuned sawtooth waves (+7 cents / -7 cents) with vibrato LFO and stereo ping-pong delay returns.
  - `CH4: BRASS`: 4-voice stacked saw chord stabs (Root, Minor 3rd, 5th, Octave) with sharp punch transients.
  - `CH5: SCRATCH & VOCAL`:
    - Turntable Vinyl Scratch: Bandpass-filtered white noise with sinusoidal FM frequency sweeps (800Hz &rarr; 2600Hz &rarr; 700Hz) simulating vinyl backspins.
    - Formant Vocal Stabs: Dual resonant bandpass filters (F1/F2) synthesizing speech-like vowels: "ME-GA!", "BLAST!", "YEAH!", "UH!".
  - `CH6: KICK`: Pitch envelope falling 180Hz &rarr; 46Hz in 45ms with 2ms transient click.
  - `CH7: SNARE & CLAP`: Tuned body sine (185Hz) + crispy white noise bandpass burst + gated multi-burst handclap.
  - `CH8: HI-HATS & COWBELL`: Metallic noise clusters for closed/open hats + dual-square 587Hz/845Hz bandpass 808 cowbell.
* **Smooth Dub Filter Transition**: Entering Crispin's shop smoothly ramps the master lowpass filter from 20,000Hz down to 450Hz over 0.6s, engaging dub delay without stopping the clock or breaking BPM sync! Exiting shop sweeps the filter wide open with high energy.
* **ProTracker Jukebox Modal (`[T]`)**:
  - Live 8-column scrolling pattern display highlighting active rows in real-time.
  - Per-channel `[MUTE]` and `[SOLO]` buttons.
  - Pattern Jump selector (`00` to `06`), BPM slider, and Dub Filter toggle.
  - Real-time Stereo Vector Oscilloscope and 32-band Amiga Copper Frequency Spectrum Analyzer!

---

### C. The Out-of-the-Box Gameplay Twist: Chrono-Reverse Time Rewind
* **180-Frame Circular Ring Buffer**: Captures full world state snapshots (player ship, shield, heat, positions, velocities, camera scroll, active enemies, bullets, and floating cash bubbles) for 3 seconds of buffer at 60 FPS.
* **Chrono-Reverse Rewind (`[R]`, `Shift`, or `Right-Click`)**:
  - Drains Chrono-Energy while seamlessly rolling back game state backwards in time frame by frame.
  - Screen displays chromatic aberration (red/blue horizontal shift) and VHS tape tracking flutter.
  - Web Audio triggers reverse pitch-swept tape rewind audio.
  - Recharges automatically when released.
* **Xenon 2 Reverse Scrolling Thrust (`Down` / `S` at bottom of screen)**:
  - Backs camera scroll down the cavern, allowing players to escape narrow dead ends or re-approach enemy waves!

---

### D. Crispin's Intergalactic Upgrade Store & 50% Trade-In Haggling
* **Animated Talking Portrait**:
  - Green alien pawnbroker with cranial ridges.
  - Mirrored aviator sunglasses reflecting animated cyber neon grids.
  - DJ headphones bobbing in rhythm to the tracker BPM.
  - Talking jaw moving in sync with synthesized alien chatter chirps.
* **Interactive 6-Slot Paper-Doll Blueprint**:
  - Visual display of the 6 hardpoints: `NOSE`, `LEFT WING`, `RIGHT WING`, `REAR TAIL`, `DRONES`, `HULL`.
  - **50% Trade-In Haggling**: Sell any equipped weapon back to Crispin for half its purchase credits!
* **17 Modular Weapons & Upgrades**:
  1. *Twin Vulcan* ($300): Rapid alternating kinetic auto-cannons.
  2. *Plasma Spread* ($550): Multi-angle glowing plasma orbs.
  3. *Electro-Arc Beam* ($750): Continuous piercing electric lightning beam.
  4. *Side-Laser Pods* ($450): Flanking 45-degree and 90-degree laser cannons.
  5. *Homing Missile Racks* ($600): Self-steering micro-missiles with smoke trails.
  6. *Bounce-Orb Launchers* ($500): Heavy metallic spheres ricocheting off walls and enemies up to 4 times.
  7. *Rear Tail Cannon* ($350): Twin auto-cannons firing downward.
  8. *Temporal Proximity Mines* ($400): Floating mines detonating on contact or timer.
  9. *Dual Orbiting Drones* ($800): 2 satellite pods orbiting ship, blocking bullets and shooting tandem lasers.
  10. *Heavy Hull Plating* ($400): +50% max shield capacity and 20% damage reduction.
  11. *Speed Booster* ($300): +40% engine thrust and reverse responsiveness.
  12. *Chrono-Capacitor* ($500): Expands rewind pool to 5 seconds and speeds recharge.
  13. *Heat Sink Radiator* ($350): Cuts heat buildup by 50% and doubles cooling rate.
  14. *Super Nashwan Power* ($1200): 20-second all-weapon overdrive with zero heat and golden invulnerability!
  15. *Smart Bomb* ($250): Screen-clearing temporal blast.
  16. *Shield Repair* ($150): Full 100% hull repair.
  17. *Boss Intel* ($100): Tactical scan revealing current boss weak-points and vulnerabilities.

* **The 3 Golden Synergy Combos**:
  1. **RICOCHET PRISM MATRIX** (`Side-Lasers` + `Bounce-Orbs`): Side lasers that hit walls or bounce orbs refract into splitting 3-way prism laser fans!
  2. **CHRONO BACKFIRE NOVA** (`Temporal Mines` + Reverse Scroll / Rewind): Backing up or rewinding time ejects an 8-way ring of high-damage temporal nova mines!
  3. **TESLA CHAIN SWARM** (`Electro-Arc` + `Dual Orbiting Drones`): High-voltage lightning continuously arcs between the ship, both drones, and up to 4 nearby hostiles!

---

### E. 5 Evolutionary Epoch Stages & Multi-Phase Bosses
1. **Epoch 1: Cambrian Trilobite Reef**:
   - Terrain: Limestone cavern walls and narrow fossilized coral bottlenecks.
   - Enemies: Armoured Trilobites, Ammonite Spirals, Coral Spores.
   - Boss: **The Leviathan Anomalocaris** (grasping appendages, pincer sweeps, needle storms).
2. **Epoch 2: Abyssal Nautiloid Trench**:
   - Terrain: Obsidian basalt walls, hydrothermal steam geysers, deep mines.
   - Enemies: Abyssal Anglerfish, Cephalopod Ink Jets, Trench Eels.
   - Boss: **The Kraken-Nautilus** (8 writhing tentacles, shell retreat defense, ink torpedoes).
3. **Epoch 3: Babbage Clockwork Foundry**:
   - Terrain: Brass gear walls with intermeshing teeth, vertical steam pistons.
   - Enemies: Clockwork Gyro-Bombers, Arc-Lightning Turrets, Piston Beetles.
   - Boss: **The Difference Engine Automaton** (punched card reels, spinning sawblades, binary laser storms).
4. **Epoch 4: 1989 Demoscene Silicon Wafer**:
   - Terrain: PCB motherboard bus circuits, gold heatsinks, raster capacitor barriers.
   - Enemies: Blitter-Bobs (spinning Amiga chrome spheres in Lissajous curves), Vector Prisms, Microchip Spiders.
   - Boss: **The 68000 Cyber-Blitter** (giant CPU chip, orbiting rainbow copper bars, DMA memory storm).
5. **Epoch 5: Biomechanical Xenite Hive**:
   - Terrain: Giger chrome ribcages, bone arches, pulsating spore sacs.
   - Enemies: Xenite Bio-Drones, Facehugger Eggs, Chitinous Wall Guns.
   - Final Boss: **The Sovereign Xenite Mother-Brain** (giant cyber-brain, floating eye stalks, triple-phase battle!).

---

## 3. Controls Reference

| Input Action | Primary Key | Secondary / Mouse |
| :--- | :--- | :--- |
| **Move Megablaster** | `W` `A` `S` `D` | `Arrow Keys` or **Mouse Cursor** |
| **Fire Hardpoint Arsenal** | `Space` | `Z` or **Left-Click (Hold)** |
| **Reverse Scroll Thrust** | `Down` / `S` at bottom | Backs camera up dead ends |
| **Chrono-Reverse Rewind** | `R` / `Shift` (Hold) | **Right-Click (Hold)** |
| **Smart Bomb / Overdrive** | `Q` | `X` |
| **Dock at Crispin's Shop** | `B` | Click **SHOP [B]** button |
| **Open ProTracker Jukebox** | `T` | Click **TRACKER [T]** button |
| **Toggle CRT Scanlines** | `C` | Click **CRT [C]** button |
| **Toggle Sound Effects** | `M` | Click **SFX** button |
| **Epoch Warp Selector** | `1` &ndash; `5` | Warp immediately to Stage 1&ndash;5 |

---

## 4. Verification & Testing

The game was validated using automated headless browser simulation:
- 100% pure vanilla JavaScript syntax check passed with zero linter errors.
- 200+ simulated frames of gameplay verified with player movement, weapon fire, and collision detection.
- Reverse Scroll Thrust verified with camera offset manipulation.
- Chrono-Reverse 180-frame ring buffer verified across 50 frames of forward capture and reverse state restoration.
- Crispin's Shop tested with paper-doll mounting, 50% trade-in refunds, and dub lowpass filter sweep.
- All 5 Stages and Boss encounters verified through stage warping.
- ProTracker Jukebox visualizers and pattern playback verified.

---
*Created as part of the Slopanoid Autonomous Game Dev Benchmark.*
