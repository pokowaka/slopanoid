# One-Shot Prompt: Xenon II — Megablast: Evolution & Tracker Odyssey

```text
We are going to build a retro vertical shoot-'em-up inspired by The Bitmap Brothers' Xenon 2: Megablast (1989) inside the `/Users/jansene/src/slopanoid/xenon2/` directory as a single one-shot prompt. You are a legendary Amiga/DOS demoscene musician, pixel-art shader wizard, and creative game designer. Make all design and technical decisions yourself and build the complete, playable game in one shot using pure, dependency-free Vanilla JavaScript, HTML, and CSS at a locked 60 FPS. Do not read or reference any files outside `/Users/jansene/src/slopanoid/xenon2/`.

Use these core specifications:

1. GRAPHICS & ENGINE (VGA Mode 13h 320x200 256-Color "Bitmap Brothers Metallic Sheen"):
- Render into a 320x200 pixel-perfect software framebuffer (`Uint32Array` / `ImageData`) with signature Bitmap Brothers aesthetics: high-contrast chrome/steel specular gradients, dithering, glowing plasma orbs, organic-meets-industrial cavern walls, multi-layer parallax scrolling, and a toggleable CRT scanline bezel.
- Every upgrade bolted onto the player's ship ("The Megablaster") must physically render on the ship sprite in real time (Nose Cannon, Left Wing Pod, Right Wing Pod, Rear Tailgun, Orbiting Electro-Drones, and Engine Thrusters).

2. COMPLEX BACKGROUND MUSIC ENGINE (8-Channel Tracker / Bomb the Bass "Megablast" Synth):
- The soundtrack is the centerpiece of this showcase. Build a real-time 8-channel Amiga MOD / XM-style Tracker Sequencer in Web Audio API (`audio.js`) inspired by Bomb the Bass's "Megablast (Hip Hop on Precinct 13)" and David Whittaker's tracker arrangements:
  * MULTI-PATTERN SONG ARRANGEMENTS: Instead of a short loop, each track must sequence through multiple 64-step patterns (`00: INTRO -> 01: PRECINCT 13 MAIN GROOVE -> 02: TB-303 ACID BREAKDOWN -> 03: BRASS & SCRATCH DROP -> 04: BRIDGE -> 05: BOSS RAVE`) with pattern chaining and distinct evolutionary era variations.
  * 8 DISTINCT SYNTH & SAMPLE-STYLE CHANNELS:
    - CH1: John Carpenter / Precinct 13 Ostinato FM/Analog Bassline
    - CH2: Resonant TB-303 Acid Line (`BiquadFilterNode` lowpass with high Q resonance and dynamic cutoff envelope sweeps)
    - CH3: Soaring Lead Synth with stereo ping-pong delay (`DelayNode` feedback loop)
    - CH4: Detuned PWM Synth Chords / Orchestra Hit Brass Stabs
    - CH5: Turntable Vinyl Scratch & Formant Vocal Stab Synthesizer (pitch-bent noise/oscillator bursts simulating vinyl record backspins and formant-filtered vocal hits like "MEGA-BLAST!" / "YEAH!")
    - CH6: Punchy 808/909 Kick & Sub-Drop
    - CH7: Crispy Breakbeat Snare, Ghost-Notes & Gated Reverb Clap
    - CH8: Syncopated Open/Closed Hi-Hats & 808 Cowbell
  * DYNAMIC SHOP & BOSS MIXING: When docking at Crispin's Intergalactic Shop, smoothly sweep a master low-pass dub filter and switch to a laid-back Electro-Dub Shop Groove without dropping the beat.
  * LIVE SPECTRUM / OSCILLOSCOPE & IN-GAME TRACKER JUKEBOX MODAL (`[T]`):
    - Include a real-time `AnalyserNode` Spectrum Analyzer & Waveform Oscilloscope in the cabinet HUD.
    - Pressing `[T]` or clicking "TRACKER VIEW" opens a live scrolling 8-Channel ProTracker Pattern Viewer modal (`Row 00..3F | Note | Inst | Effect`) that scrolls in sync with the live music and lets the player Mute/Solo any of the 8 channels or jump between patterns!

3. THE OUT-OF-THE-BOX GAMEPLAY TWIST ("THE EVOLUTION TIMELINE & TIME-REVERSE THRUST"):
- The Xenites have planted temporal bombs across 5 epochs of evolutionary history. Each stage features destructible cavern walls (requiring you to navigate narrow bottlenecks), swarms of period-specific biomechanical creatures, and Cash Bubbles (Credits) dropped by destroyed waves:
  * Stage 1: Cambrian Trilobite Reef (Prehistoric armoured trilobites, ammonite spirals, fossilized coral bottlenecks & The Leviathan Anomalocaris Boss)
  * Stage 2: Abyssal Nautiloid Trench (Bioluminescent deep-sea cephalopods, thermal vent geysers, minefields & The Kraken-Nautilus Boss)
  * Stage 3: Babbage Clockwork Foundry (Steampunk brass gear-walls, rotating piston corridors, arc-lightning turrets & The Difference Engine Automaton Boss)
  * Stage 4: 1989 Demoscene Silicon Wafer (Copper-bar vector grids, golden PCB circuit mazes, blitter-bob swarms & The 68000 Cyber-Blitter Boss)
  * Stage 5: Biomechanical Xenite Hive (Giger-esque chrome ribcages, spore-spawning walls, laser gates & The Sovereign Xenite Mother-Brain Final Boss)
- REVERSE THRUST & CHRONO-REWIND:
  * Holding `Down` (`S` / `ArrowDown`) engages Xenon 2's classic **Reverse Scrolling Thrust**, allowing you to back the camera up when trapped against a dead-end cavern wall!
  * Holding `Shift` / `Right-Click` / `[R]` engages **Chrono-Reverse Thrust**, consuming Chrono-Energy to literally rewind the camera scroll, your ship, enemy positions, and bullets backward through time for up to 3 seconds (using a 180-frame state ring-buffer)!

4. CRISPIN'S INTERGALACTIC UPGRADE STORE & WEAPON SYNERGIES:
- At the mid-point and end of every stage (or anytime via the `[B]` Shop Dock button for testing), the player docks at **Crispin's Shop**:
  * Animated VGA pixel-art portrait of **Crispin the Alien Pawnbroker** (reflective sunglasses, headphones bobbing to the beat, animated jaw, and witty dialogue).
  * **Visual Hardpoint Paper-Doll (6 Slots)**: `NOSE`, `LEFT WING`, `RIGHT WING`, `REAR TAIL`, `ORBITAL DRONES`, and `HULL / ENGINE`.
  * **50% Trade-In Haggling**: Players can sell any currently equipped hardpoint item back to Crispin for 50% of its value before buying a new one, plus buy **Shield Repair**, **Speed Boosters**, **Smart Bombs**, and **Crispin's Boss Weakness Intel**.
  * **14+ Modular Weapons & Upgrades**: Twin Vulcan, Plasma Spread, Electro-Arc Beam, Side-Laser Pods, Homing Missile Racks, Bounce-Orb Launchers, Rear Tail Cannon, Temporal Proximity Mines, Dual Orbiting Drones, Hull Plating, Chrono-Capacitor, and the ultimate **SUPER NASHWAN POWER** (20-second full-arsenal overdrive).
  * **Weapon Synergy Combos**: Equipping specific combinations automatically activates golden Synergy perks:
    1. *RICOCHET PRISM MATRIX* (`Side-Laser Pods` + `Bounce-Orb Launchers`): Lasers reflect off cavern walls and Bounce-Orbs into splitting prism beams!
    2. *CHRONO BACKFIRE NOVA* (`Temporal Proximity Mines` + `Reverse/Chrono Thrust`): Backing up or rewinding time unleashes a high-damage ring of temporal plasma mines!
    3. *TESLA CHAIN SWARM* (`Electro-Arc Beam` + `Dual Orbiting Drones`): Chains high-voltage lightning bolts between your orbiting drones and all nearby enemies!

5. CONTROLS & UI (Keyboard + Mouse):
- Smooth 60 FPS movement via **Mouse** OR **Keyboard** (`WASD` / `Arrow Keys`).
- `Space` / `Z` / `Left-Click` (Hold): Fire all equipped hardpoint weapons.
- `Down` / `S` at bottom of screen: Engage Reverse Scroll Thrust to back out of cavern dead-ends.
- `R` / `Shift` / `Right-Click` (Hold): Engage Chrono-Reverse Time Rewind.
- `Q` / `X`: Trigger Smart Bomb / Super Nashwan Overdrive.
- `B`: Dock at Crispin's Upgrade Store | `T`: Open 8-Channel Tracker Jukebox | `1`-`5`: Stage Warp Selector.
- Include a comprehensive `README.md` in `/Users/jansene/src/slopanoid/xenon2/README.md`.
```
