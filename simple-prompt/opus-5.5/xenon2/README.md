# XENON II · MEGABLAST — *Evolution & Tracker Odyssey*

A vertical shoot-'em-up inspired by The Bitmap Brothers' **Xenon 2: Megablast** (1989).
It is written in **pure, dependency-free vanilla JavaScript, HTML and CSS**: no build step, no libraries, no image files and no audio samples.
Every pixel is drawn into a 320×200 256-colour framebuffer, and every sound is synthesized live in Web Audio by an 8-channel tracker.

> Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). It works directly from `file://`.
> Press any key or click to wake the audio (browsers need a user gesture), then press **Enter**.

---

## Controls

| Action | Keyboard | Mouse |
|---|---|---|
| Move | `WASD` / arrow keys | move the pointer (the ship follows) |
| Fire all hardpoints | `Space` / `Z` (hold) | Left button (hold) |
| **Reverse scroll thrust** | hold `S` / `↓` at the bottom of the screen | pointer at the bottom edge |
| **Chrono-Rewind** | hold `R` / `Shift` | Right button (hold) |
| Smart Bomb | `Q` (falls back to Nashwan if you have no bombs) | |
| Super Nashwan Power | `X` (falls back to a Smart Bomb) | |
| Dock at Crispin's shop | `B` (`B` / `Esc` undocks) | **SHOP DOCK** button |
| Tracker Jukebox | `T` | **TRACKER VIEW** button |
| Stage warp | `1`–`5` | **WARP** buttons |
| Pause | `P` / `Esc` | |
| CRT bezel on/off | `C` | **CRT BEZEL** button |
| Sound on/off | `M` | **SOUND** button |

**Inside the shop:** `1`–`6` selects a hardpoint slot.

**Inside the tracker:**
- `1`–`8` mute a channel.
- `←` / `→` jump between patterns.
- `↑` / `↓` switch the era song.
- `Esc` or `T` closes it.

---

## The twist: the Evolution Timeline and time-reverse thrust

The Xenites have planted temporal bombs across five epochs of evolutionary history.

### Stages

| # | Epoch | Hazards | Boss |
|---|---|---|---|
| 1 | **Cambrian Trilobite Reef** (541 MYA) | Armoured trilobites, ammonite spirals, eurypterid brutes, coral turrets, fossil-coral bottlenecks | **The Leviathan Anomalocaris** |
| 2 | **Abyssal Nautiloid Trench** (450 MYA) | Bioluminescent squid and nautiloids, thermal-vent geysers, minefields, anglerfish | **The Kraken-Nautilus** |
| 3 | **Babbage Clockwork Foundry** (1822) | Brass gear walls, piston corridors that crush, Tesla arc-lightning gates, clockwork beetles | **The Difference Engine Automaton** |
| 4 | **1989 Demoscene Silicon Wafer** | Copper-bar raster backdrop, gold PCB circuit mazes, blitter-bob swarms, spinning vector cubes, bouncing Boing balls | **The 68000 Cyber-Blitter** |
| 5 | **Biomechanical Xenite Hive** | Chrome ribcages, spore-spawning pods, face-hugger swarms, laser gates | **The Sovereign Xenite Mother-Brain** |

### Cavern walls

Cavern walls are **pixel-perfect**. They are baked into a per-pixel collision map for the whole stage.
- Bottlenecks are plugged with **destructible rock/brass/silicon**, which you shoot through pixel by pixel.
- Some forks are **dead ends** sealed with a tougher plug. Missiles, mines, Nova blasts and bombs chew through those much faster.
- Walls scroll into you. If you're pinned at the bottom of the screen, you'll see **BLOCKED!**.

### Reverse Scroll Thrust

Hold `Down` at the bottom of the screen to back the camera up, the classic Xenon 2 move for getting out of dead ends.

### Chrono-Rewind

Hold `R` / `Shift` / right mouse button to rewind time.
- Every frame, a **180-frame ring buffer** stores the camera, your ship, shield, score, credits, enemies, bullets, pickups, wave counters and boss state.
- Rewinding plays that buffer backwards, up to 3 seconds, and drains **Chrono Energy**.
- While rewinding, a palette-space blue/cyan filter and a scanline wobble are applied, and a tape-scrub sound plays over the ducked music.

### Cash Bubbles

Wiping out a whole wave drops a **Cash Bubble**. Individual kills sometimes drop coins. Rare **S capsules** restore your shield.

---

## Crispin's Intergalactic Upgrade Store

You dock automatically at the **mid-point** and **end** of every stage. You can also dock any time with `B`.

- **Crispin the Alien Pawnbroker** is an animated VGA portrait drawn with the same SDF sprite shader as the game:
  - mirrored shades with a moving specular sheen;
  - chrome headphones whose drivers pulse with the kick drum;
  - a head that bobs on the beat and sways on alternate beats;
  - a jaw synced to typewriter dialogue with "talk" blips;
  - LED meters driven by the eight tracker channels.
- **Paper-doll with 6 hardpoints:** `NOSE`, `LEFT WING`, `RIGHT WING`, `REAR TAIL`, `ORBITAL DRONES`, `HULL / ENGINE`. The live preview renders the exact sprite parts that are bolted onto your ship in game.
- **50% trade-in haggling:**
  - Sell any equipped item for half of what you paid, including upgrades.
  - Buying into an occupied slot automatically offers a trade-in discount.
  - Each item upgrades to **Level 3**, which adds more barrels, faster rates and bigger payloads.

### Catalogue (14 modular hardpoint items and 5 supplies)

| Slot | Item | Notes |
|---|---|---|
| Nose | Pulse Cannon | starter weapon |
| Nose | Twin Vulcan | rotary hosepipe; 2 / 4 / 6 barrels |
| Nose | Plasma Spread | 3 / 5 / 7 magenta orbs |
| Nose | Electro-Arc Beam | auto-locking lightning |
| Wing (L/R) | Side-Laser Pod | sideways lasers |
| Wing (L/R) | Homing Missile Rack | seekers with blast radius; carve walls |
| Wing (L/R) | Bounce-Orb Launcher | orbs that rebound off cavern walls |
| Tail | Rear Tail Cannon | covers your six |
| Tail | Temporal Proximity Mines | arm, then detonate on proximity |
| Drones | Dual Orbiting Drones | shoot and absorb bullets |
| Drones | Quad Plasma Halo | four orbiters |
| Hull | Hull Plating | +50% max shield, −30% damage |
| Hull | Chrono-Capacitor | ~3× chrono regen, cheaper rewinds |
| Hull | Megaflux Afterburner | extra speed, faster reverse thrust, bigger engine flames |

The **supplies** are Shield Repair, Speed Booster (×3), Smart Bomb (max 5), **Crispin's Boss Weakness Intel** and **SUPER NASHWAN POWER**.
- **Intel** marks the boss's weak point in game; hits there deal ×4 damage. If you buy it at the end-of-stage shop, it applies to the *next* boss.
- **Super Nashwan Power** is a 20-second golden overdrive. It fires every weapon in the game at Level 3 and turns the ship's palette gold.

Every upgrade is **drawn on the ship in real time**:
- nose guns;
- stacked wing pods;
- tail guns and mine dispensers;
- orbiting drones;
- armour plates and a blinking capacitor;
- the afterburner nacelle, with engine flames that grow with speed boosters.

### Weapon synergies

When the right combination is equipped, a golden badge lights up in the HUD and in the shop.

1. **RICOCHET PRISM MATRIX** (Side-Laser + Bounce-Orb): lasers ricochet off cavern walls, and Bounce-Orbs split into prism beams on every rebound.
2. **CHRONO BACKFIRE NOVA** (Proximity Mines + Reverse/Chrono): engaging reverse thrust, holding it (every 50 frames) or releasing a Chrono-Rewind triggers a ring of 12 high-damage temporal plasma mines.
3. **TESLA CHAIN SWARM** (Electro-Arc + Drones): lightning links your drones, arcs out to every nearby enemy and boss, and chains the main arc through extra targets.

---

## The soundtrack: an 8-channel tracker in Web Audio (`audio.js`)

This is a real pattern-based sequencer, not a loop:
- a look-ahead scheduler (25 ms timer, about 120 ms horizon) drives 64-row patterns with swing;
- per-row note, instrument, volume and effect columns;
- order lists chain the patterns;
- a **visual event queue** keeps the tracker view and VU meters in exact sync with what you hear.

Each epoch has its own **era song**. The key, scale (minor / dorian / harmonic minor / phrygian), tempo (100–128 BPM), chord progression, swing and acid waveform are all procedurally composed from a seed:

`00 INTRO → 01 PRECINCT 13 MAIN GROOVE → 02 TB-303 ACID BREAKDOWN → 03 BRASS & SCRATCH DROP → 04 BRIDGE → 05 BOSS RAVE`, plus `06 CRISPIN'S ELECTRO-DUB` for the shop.

### Channels

| Ch | Voice |
|---|---|
| 1 | John Carpenter / *Precinct 13* ostinato: detuned saw + square through a filter envelope |
| 2 | **TB-303 acid**: resonant `BiquadFilter` low-pass (high Q) with accent/slide and `Exx` cutoff-sweep automation |
| 3 | Soaring lead with **stereo ping-pong delay** (cross-fed `DelayNode` feedback loop) and `3xx` portamento |
| 4 | Detuned PWM chords (`0xy` arpeggio chord shapes), brass stabs and orchestra hits |
| 5 | **Vinyl scratch / backspin and formant vocal stabs**: "MEGA", "BLAST", "YEAH" built from formant-filtered pulse trains; `E9x` retrigger gives the "M-M-MEGA-BLAST!" stutter |
| 6 | 909/808 kick and sub-drop |
| 7 | Breakbeat snare, ghost notes and **gated reverb clap** (a gated noise convolution IR) |
| 8 | Syncopated closed/open hi-hats and 808 cowbell |

### Dynamic mixing

- **Shop:** on docking, the master **dub low-pass filter** sweeps down at the next bar line. The sequencer switches to the laid-back Electro-Dub groove *without dropping the beat*, and the filter blooms back open with a dub-echo send.
- **Boss:** boss fights switch to the **BOSS RAVE** order.
- **Rewind:** rewinding ducks the music under a tape-scrub effect.

### HUD and jukebox

- **Cabinet HUD:** a segmented LED **spectrum analyser** with peak-hold, and a phosphor **oscilloscope** with persistence and zero-cross triggering, both fed by an `AnalyserNode`.
- **Tracker Jukebox (`T`):**
  - a live-scrolling ProTracker-style pattern view (`ROW | NOTE INS FX` for all 8 channels);
  - per-channel VU meters and **Mute / Solo**;
  - pattern-jump buttons and era-song buttons;
  - NORMAL / BOSS / SHOP mode switching.
  - The game pauses while the jukebox is open. When you close it, the soundtrack returns to the current stage.

---

## Graphics engine

- **Mode 13h emulation (`gfx.js`)**
  - A `Uint8Array` 320×200 indexed framebuffer and a 256-colour palette are expanded to a `Uint32Array` `ImageData` every frame.
  - The palette is split into 16-shade ramps: chrome, gold, fire, plasma, green, magenta, four stage ramps, two enemy ramps, a cycling ramp and skin.
  - Palette-space post-FX: damage flash, rewind tint, modal dim and bomb whiteout.
  - **Palette cycling** animates copper bars, caustics and lava glows.
- **Bitmap Brothers metallic sheen**
  - Sprites are defined as **signed distance fields**.
  - The SDFs are shaded with a height-field normal and specular materials: chrome with a horizon band, gold, steel, organic and plasma.
  - Results are quantized with **4×4 Bayer dithering** and outlined in black.
  - The metal logos are generated the same way from a built-in bitmap font.
- **Four-layer parallax:** a far layer at 0.3× speed (the copper-bar raster in epoch 4), a mid layer at 0.6×, pixel-perfect cavern walls at 1×, and sprites.
- **CRT bezel (`C`):** CSS scanlines locked to the framebuffer's row pitch, an RGB mask, vignette, glass glare and flicker.

---

## Project layout

| File | Role |
|---|---|
| `index.html` | Cabinet layout, HUD, shop and tracker modals |
| `style.css` | Chrome cabinet, CRT bezel, HUD, shop and tracker styling |
| `audio.js` | `Music`: 8-channel Web Audio tracker, era-song composer, synth voices, FX buses, SFX |
| `gfx.js` | `GFX`: framebuffer, palette and FX, primitives, 3×5 font, SDF sprite shader, logo generator |
| `sprites.js` | `SPR` / `Sprites`: ship, hardpoint parts, drones, pickups, 25 enemy types, 5 animated bosses, Crispin |
| `stages.js` | `Stages`: 5 epoch definitions, procedural cavern and parallax baking, destructible plugs, dead-end forks, wave and turret event scripts |
| `game.js` | `Game`: fixed-step 60 FPS loop, player and weapons, synergies, reverse thrust, Chrono-Rewind ring buffer, enemies, bosses, pickups, particles, shop API |
| `ui.js` | `UI`: screen scaling, side HUD, analyser and oscilloscope, Crispin portrait and dialogue, paper-doll shop, tracker jukebox |

All modules are plain `<script>` globals (no ES modules), so the game runs straight from `file://`.

### Engine notes

- **Timing:** a fixed-timestep loop runs `update()` at exactly 60 Hz, independent of the display refresh, with a catch-up cap. Rendering happens once per animation frame.
- **Coordinates:** world depth `d` increases upward. The camera scrolls `d`, while the player and bosses live in screen space.
- **Walls:** a per-stage `Uint8Array` of about 320 × 5000 palette indices, where 0 means open. Collision tests the ship's 8-point hull against it. Destructible plugs are carved per pixel with scorched edges.
- **Rewind:** snapshots are shallow copies of every live object tagged with `__ref`. Restoring writes them back into the same objects, so references stay valid (enemy ↔ wave, arc-node partners).
- **Difficulty:** after the Mother-Brain falls, the game loops back to Epoch I with faster scroll and more HP. Your high score is kept in `localStorage`.

Credits: a tribute to The Bitmap Brothers, Assembly Line, David Whittaker and Bomb the Bass ("Megablast (Hip Hop on Precinct 13)"). All code, art and music are procedurally generated.
