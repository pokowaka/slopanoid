# XENON II — MEGABLAST: Evolution & Tracker Odyssey

A dependency-free Vanilla JavaScript, HTML5, and CSS3 vertical shoot-'em-up tribute to **The Bitmap Brothers' *Xenon 2: Megablast* (1989)**, combining a **VGA Mode 13h (`320×200`) 256-color software pixel renderer** with a real-time **8-Channel Web Audio ProTracker / XM Synthesizer** inspired by Bomb the Bass's *"Megablast (Hip Hop on Precinct 13)"* and David Whittaker's tracker arrangements.

---

## Quick Start

No build step, bundler, or external dependencies are required.

- **Direct Launch:** Open `index.html` directly in any modern browser (`Chrome`, `Safari`, `Firefox`, `Edge`), or
- **Local HTTP Server:**
  ```bash
  python3 -m http.server 8080
  ```
  Then visit `http://localhost:8080`.

Click anywhere on the screen or press **`Space` / `Enter`** to unlock Web Audio and launch your mission.

---

## Core Architecture & Features

### 1. VGA Mode 13h (`320×200`) Software Framebuffer & Real-Time Modular Ship
- **Software Pixel Pipeline (`palette.js`, `sprites.js`, `game.js`):** Renders every frame directly into a `320×200` `Uint32Array` (`ImageData`) using 16-shade Bitmap Brothers metallic chrome, antique brass, coral, cyan plasma, bio-emerald, and Super Nashwan copper-bar ramps with ordered `4×4` Bayer dithering and additive glow lines.
- **Procedural Normal-Lit Metallic Pixel Compiler:** Generates high-contrast surface-normal beveled sprites with top-left specular highlights, panel grooves, rivets, dark 1px silhouettes, and emissive plasma cores at startup.
- **Real-Time Physical Hardpoints on "The Megablaster":** Every item bolted onto the 6 hardpoints (`NOSE`, `LEFT WING`, `RIGHT WING`, `REAR TAIL`, `ORBITAL DRONES`, and `HULL / ENGINE`) physically renders onto your starfighter in real time—both in combat and inside Crispin's live Paper-Doll rig preview.
- **Toggleable CRT Scanline & Aperture-Grille Bezel (`[C]`):** Switch between crisp raw VGA square pixels and a curved phosphor scanline arcade monitor overlay.

---

### 2. 8-Channel Web Audio Tracker & Bomb the Bass Synth (`audio.js`, `tracker_ui.js`)
- **Multi-Pattern Song Odyssey (64-Step Patterns `00..3F`):**
  - `00: INTRO - PRECINCT AWAKEN` — Heartbeat kicks, 808 cowbell ticks, vinyl scratch teases & Carpenter bass entry
  - `01: PRECINCT 13 MAIN GROOVE` — Iconic syncopated *Assault on Precinct 13* / *Megablast* ostinato, breakbeats, Fairlight brass stabs & ping-pong delay lead
  - `02: TB-303 ACID BREAKDOWN` — High-Q resonant acid line with `3xx` portamento slides & `A0F` filter cutoff accents
  - `03: BRASS & SCRATCH DROP` — Turntable transformer scratches, vinyl backspins, `"MEGA-BLAST!"` formant vocal callouts & Orch5 stabs
  - `04: EVOLUTIONARY BRIDGE` — Chord modulation with classic 50Hz Amiga ProTracker `0xy` arpeggios & melodic solo
  - `05: BOSS RAVE OVERDRIVE` — High-urgency 130 BPM rave assault triggered automatically during Epoch Guardian battles
  - `06: CRISPIN'S ELECTRO-DUB` — Smoothly engaged on the beat when docking at Crispin's Shop while sweeping a warm master low-pass dub filter (`20 kHz -> 1.48 kHz`)
- **8 Dedicated Synthesis & Sample-Style Channels:**
  1. `CH1 (P13 FM BASS)`: 2-Operator FM + Analog Sawtooth Precinct 13 Ostinato Bass
  2. `CH2 (TB-303 ACID)`: Persistent monophonic Roland TB-303 synth (`BiquadFilterNode` lowpass with high Q resonance, accent & slide)
  3. `CH3 (PINGPONG LD)`: Dual-oscillator lead with vibrato (`4xx`), chip arpeggio (`0xy`), and stereo ping-pong `DelayNode` feedback loop
  4. `CH4 (ORCH5 / PWM)`: Detuned PWM synth chords & 8-bit crushed 1988 Fairlight `ORCH5` brass hits
  5. `CH5 (SCRATCH/VOX)`: Turntable vinyl scratch/backspin synth & 3-bandpass vowel formant vocal synthesizer (`"MEGA-BLAST!"` / `"YEAH!"`)
  6. `CH6 (808/909 KCK)`: Punchy TR-808/909 kick drum & transition sub-drops
  7. `CH7 (BRKBEAT SNR)`: Crispy breakbeat snare, funky ghost-notes & multi-tap gated reverb clap
  8. `CH8 (HATS & BELL)`: 6-oscillator metallic open/closed hi-hats (with choke group) & dual-square TR-808 cowbell
- **Live Cabinet Analyser & Interactive Tracker Jukebox Modal (`[T]`):**
  - Real-time `AnalyserNode` 24-band copper spectrum analyzer + phosphor waveform oscilloscope in the cabinet HUD.
  - Press **`[T]`** anytime to open the live scrolling 8-Channel ProTracker Pattern Viewer (`Row 00..3F | Note | Inst | Effect`) with per-channel **Mute (`M`)**, **Solo (`S`)**, live VU meters, Dub Lowpass toggle, and instant Pattern Jumping.

---

### 3. Five Evolutionary Epochs, Reverse Scroll Thrust & 3-Second Chrono-Rewind (`stages.js`)
1. **Stage 1 — Cambrian Trilobite Reef (`520,000,000 BCE`):** Armoured trilobite sine-swarms, rolling ammonite spirals, fossilized coral bottlenecks & **The Leviathan Anomalocaris**.
2. **Stage 2 — Abyssal Nautiloid Trench (`360,000,000 BCE`):** Bioluminescent vampire squids, orthoceras divers, thermal vent geysers, tethered minefields & **The Kraken-Nautilus** (spinning shell deflects frontal nose fire).
3. **Stage 3 — Babbage Clockwork Foundry (`1847 CE`):** Victorian brass gear-walls, ricocheting gyro-cogs, punch-card bombers, arc-lightning coils & **The Difference Engine Automaton**.
4. **Stage 4 — 1989 Demoscene Silicon Wafer (`1989 CE`):** Rolling Amiga raster copper bars, golden PCB circuit mazes, Lissajous Blitter-Bobs, Glenz diamond fighters & **The MC68000 Cyber-Blitter**.
5. **Stage 5 — Biomechanical Xenite Hive (`Temporal Nexus`):** Giger-esque chrome ribcages, spore-spawning wall cysts, multi-segment articulated chrome serpents & **The Sovereign Xenite Mother-Brain**.

- **Classic Reverse Scrolling Thrust (`Down` / `S` at bottom of screen):** Cavern forks feature lucrative dead-end Cash Bubble alcoves (`+250 CR` giant bubbles). Fly in, scoop the credits, and hold `Down` / `S` at the bottom of the screen to engage forward-firing retro-thrusters and scroll the camera backward out of the cul-de-sac!
- **Chrono-Reverse Thrust (`R` / `Shift` / `Right-Click` Hold):** Powered by a deterministic **180-frame (3.0-second @ 60 FPS) state ring-buffer** that rewinds camera scroll, ship state, enemy waves, bullets, pickups, and even destroyed cavern tiles backward through time—including last-second Chrono-Rescue if your hull is destroyed while Chrono-Energy remains!

---

### 4. Crispin's Intergalactic Upgrade Store & Golden Weapon Synergies (`weapons.js`, `shop.js`)
Dock automatically at the mid-point and end of every stage—or press **`[B]`** anytime:
- **Animated VGA Portrait of Crispin:** Headphone-wearing reptilian pawnbroker bobbing to the live tracker beat, with live spectrum reflections in his wrap-around shades, flapping jaw speech blips, and **50% Trade-In Haggling** on all 6 hardpoint slots.
- **20 Modular Weapons, Hulls & Specials:** Pulse Vulcan Mk.I, Twin Vulcan, Plasma Spread, Electro-Arc Beam, Side-Laser Pods, Bounce-Orb Launchers, Homing Missile Racks, Shrapnel Flak Pod, Rear Tail Cannon, Temporal Proximity Mines, Orbiting Electro-Drone, Dual Orbiting Drones, Hull Plating, Chrono-Capacitor, Twin Ion Thrusters, Shield & Hull Repair, Speed Boosters, Smart Bombs, Crispin's Boss Intel, and **SUPER NASHWAN POWER** (20-second full-arsenal rainbow overdrive).
- **3 Golden Weapon Synergy Combos:**
  1. ★ **RICOCHET PRISM MATRIX** (`Side-Laser Pods` + `Bounce-Orb Launchers`): Lasers reflect off cavern walls and refract off friendly airborne Bounce-Orbs into 3 splitting RGB prism beams!
  2. ★ **CHRONO BACKFIRE NOVA** (`Temporal Proximity Mines` + `Reverse / Chrono Thrust`): Backing up or rewinding time unleashes an 8-orb radial ring of high-damage temporal plasma mines!
  3. ★ **TESLA CHAIN SWARM** (`Electro-Arc Beam` + `Dual Orbiting Drones`): Chains high-voltage lightning bolts through both orbiting drones across up to 4 nearby enemies simultaneously!

---

## Controls Reference

| Action | Primary Controls | Alternate Controls |
| :--- | :--- | :--- |
| **Move Ship (60 FPS)** | **Mouse Cursor** | `WASD` or `Arrow Keys` |
| **Fire All Hardpoints** | `Left-Click` (Hold) | `Space` or `Z` (Hold) |
| **Reverse Scroll Thrust** | `Down` / `S` (at bottom of screen) | Mouse at bottom edge |
| **Chrono-Reverse Rewind (3s)** | `Right-Click` (Hold) | `R` or `Shift` (Hold) |
| **Smart Bomb** | `Q` | `X` or Cabinet `BOMB [Q]` |
| **Crispin's Upgrade Store** | `B` | Cabinet `DOCK AT CRISPIN'S SHOP [B]` |
| **8-Channel Tracker Jukebox** | `T` | Cabinet `TRACKER VIEW [T]` |
| **Stage Warp (Epochs 1–5)** | `1` `2` `3` `4` `5` | Cabinet Epoch Warp Buttons |
| **Toggle CRT Scanlines** | `C` | Cabinet `CRT [C]` |
| **Mute / Unmute Audio** | `M` | Cabinet `AUDIO [M]` |
