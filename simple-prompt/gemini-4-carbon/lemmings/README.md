# Lemmings: Beat Tribe

> **"Playing Is Composing."** Every level is a living music sequencer. The terrain is the score, the lemmings are the playheads, and the song you hear is the direct result of how you guide the tribe. Saving lemmings completes the song.

**Lemmings: Beat Tribe** is a pure, dependency-free Vanilla JavaScript, HTML, and CSS puzzle-strategy game inspired by DMA Design / Psygnosis's *Lemmings* (1991) and the Commodore Amiga OCS demoscene. Every pixel sprite, destructible terrain texture, bitmap font, multi-pattern tracker song, and synthesized instrument/vocal stab is generated procedurally in code with **zero external assets**.

---

## Quick Start

No build step, bundler, or external packages are required:

1. Open `index.html` directly in any modern browser, **or** serve the directory locally:
   ```bash
   python3 -m http.server 8080
   # Visit http://localhost:8080
   ```
2. Click anywhere or press **`Enter`** / **`Space`** to initialize Web Audio and begin playing.

---

## Controls & UI

### Mouse Controls
- **Select a Skill (`1`–`8`)**: Click any of the 8 classic skill icons in the bottom panel.
- **Assign Skill**: Hover over a lemming in the playfield (highlighted by a selection bracket + live state readout in the HUD bar) and **left-click**.
- **Release Rate (`-` / `+`)**: Click or hold the leftmost `-` / `+` buttons to adjust spawn speed between the level's minimum rate and `99`.
- **Scroll Camera**: **Click or drag** on the live **Minimap** (bottom-right) or **right-click drag** directly on the playfield.
- **Nuke (Mushroom Cloud)**: **Double-click** within 1.5 seconds to confirm and start the classic sequential `"Oh no!"` Bomber countdown across the tribe.
- **Spectrum / Oscilloscope Box**: Click the live audio analyzer (or stem `[D][B][C][L][F]` pips) to open the **ProTracker Stem Mixer**.

### Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| **`1` – `8`** | Select skill: `1` Climber, `2` Floater, `3` Bomber, `4` Blocker, `5` Builder, `6` Basher, `7` Miner, `8` Digger |
| **`Left` / `Right`** or **`A` / `D`** | Smooth horizontal camera scrolling |
| **`-` / `+` (`=`)** | Decrease / increase lemming release rate |
| **`P`** | Tactical Pause (inspect terrain, scroll camera, and pre-select skills while paused) |
| **`F`** | Fast-Forward (`2x` simulation speed with locked `2x` tracker tempo) |
| **`N`** | Nuke tribe (press twice within 1.5s to confirm) |
| **`D`** / **`Shift+D`** | Watch the scripted **Solution Demo** for the current level (click or select a skill at any time to take over live!) |
| **`T`** | Toggle the live **ProTracker Pattern & Stem Mixer** overlay (`Mute` / `Solo` any stem) |
| **`M`** | Master audio Mute / Unmute |
| **`C`** | Toggle Commodore 1084S **CRT Scanline & Monitor Bezel** |
| **`R`** | Quick-restart the current level |
| **`Esc`** | Close active overlay or open **Level Select, World Warp & Password Entry** |

---

## Beat Tribe Mechanics ("The Level Is the Sequencer")

1. **Scale-Coded Note Terrain**:
   - Every platform and stratum is tinted to a scale degree of the current world's pentatonic or modal scale.
   - Ground color determines scale pitch; vertical height band (`0..159`) determines the octave.
2. **Sample-Accurate Quantized Footsteps**:
   - Footsteps never fire off-grid: every note is quantized onto the next `1/16` or `1/8` tracker step using an `AudioContext.currentTime` lookahead scheduler, with per-pitch voice deduplication (`max 4` voices/step) and `1/sqrt(N)` crowd velocity scaling so 50 lemmings stay punchy and never clip.
3. **Skills Are Synthesized Instruments**:
   - **Climber**: Plucked ascending scale notes while scaling vertical walls.
   - **Floater**: Warm detuned chorus pad swells while drifting under the parasol.
   - **Bomber**: 3-band formant-filtered `"Oh no!"` pitch-dropping vocal stab + crash cymbal + sub-bass crater boom.
   - **Blocker**: Continuous resonant harmonic drone on the world's chord root (actively radiates soundwaves that push back *The Silence*).
   - **Builder**: 12-note rising scale arpeggio—each brick laid is also color-coded to an ascending scale degree, turning every player-built staircase into a playable melody for the rest of the tribe!
   - **Basher**: High-Q `BiquadFilterNode` resonant bass sweep on each horizontal tunnel scoop.
   - **Miner**: Syncopated metallic/woody percussive clicks timed to pickaxe strikes.
   - **Digger**: Alternating synthesized kick drum and snare pattern as it digs vertically down.
4. **Song Stems Unlock by Saving Lemmings**:
   - Every **20%** of the total tribe saved fades the next permanent channel stem into the arrangement:
     `20% DRUMS` &rarr; `40% BASS` &rarr; `60% CHORDS` &rarr; `80% LEAD` &rarr; `100% FULL MIX`
   - Each lemming hopping into the Exit Portal triggers a rising triad chime.
5. **On-Beat Groove Bonus**:
   - Assigning a skill right on a quarter-note beat triggers a shimmering FM bell sparkle, golden pixel burst, combo multiplier (`BEAT X2!`, `BEAT X3!...`), and Groove Score bonus. Off-beat assignments always execute on the exact frame clicked—puzzle precision always comes first.
6. **The Silence**:
   - Creeping grey *Silence* spores drain color from nearby terrain, muffle footsteps, slow lemmings by 50%, and eventually cause unrescued lemmings to panic and wander. Radiating music through a region (especially sustained Blocker drones, Builder arpeggios, and tunnel instruments) visibly pushes the Silence back and restores color and rhythm.
7. **End-of-Level Composed Song Replay**:
   - Every note and skill instrument triggered during your run is recorded onto the level's step timeline and replayed on the Results screen with a live scrolling piano-roll visualizer.

---

## Worlds, Scales & Level Passwords (16 Levels)

All 16 levels ship with verified deterministic solution demos (`level.demo`) viewable via **`[D]`** or the Title Screen Attract Mode, and can be accessed immediately via **Level Warp** (`[Esc]`) or classic 5-character passwords:

| # | World | Level Name | Genre / Scale / Tempo | Key Hazards & Mechanics | Code |
| :- | :--- | :--- | :--- | :--- | :--- |
| `00` | Tutorial | **First Footsteps** | 4-Ch Amiga Chip • C Maj Pentatonic • 124 BPM | Water pond, note-steps, earthen pillar | `BEAT0` |
| `01` | World 1-1 | **Pentatonic Promenade** | Amiga Chip Garden • C Maj Pentatonic • 124 BPM | Upper terrace dig, moat bridge | `CHIP1` |
| `02` | World 1-2 | **Parasol Polyrhythm** | Amiga Chip Garden • C Maj Pentatonic • 124 BPM | Fatal cliff splat height, athlete pioneer | `CHIP2` |
| `03` | World 1-3 | **Garden of Whispers** | Amiga Chip Garden • C Maj Pentatonic • 124 BPM | Creeping Silence, One-Way-Right (`>>>`) | `CHIP3` |
| `04` | World 2-1 | **303 Conveyor** | Acid Warehouse • E Phrygian • 132 BPM | Indestructible Steel girders, Miner seam | `ACID1` |
| `05` | World 2-2 | **Piston Stomp** | Acid Warehouse • E Phrygian • 132 BPM | Twin beat-synced Piston Crushers, Silence | `ACID2` |
| `06` | World 2-3 | **Resonant Lockdown** | Acid Warehouse • E Phrygian • 132 BPM | One-Way-Left (`<<<`), Climber overhang, Fire | `ACID3` |
| `07` | World 3-1 | **Chrome Horizon** | Synthwave Sunset • D Dorian • 118 BPM | Chained sky staircases over plasma sea | `WAVE1` |
| `08` | World 3-2 | **Laser One-Way** | Synthwave Sunset • D Dorian • 118 BPM | Fire trenches, `>>>` laser gate, monolith mine | `WAVE2` |
| `09` | World 3-3 | **Fading Cassette** | Synthwave Sunset • D Dorian • 118 BPM | Dual Silence emitters, Crusher, Lava chasm | `WAVE3` |
| `10` | World 4-1 | **Amen Stalactites** | Jungle Breakbeat Caves • A Min Pent • 156 BPM | High-BPM breakbeat caverns, underground lake | `JUNG1` |
| `11` | World 4-2 | **Sub-Bass Catacombs** | Jungle Breakbeat Caves • A Min Pent • 156 BPM | 3-tier vertical steel/crystal shafts, Fire | `JUNG2` |
| `12` | World 4-3 | **Breakbeat Gauntlet** | Jungle Breakbeat Caves • A Min Pent • 156 BPM | High release rate, pioneer Climber, `>>>` wall | `JUNG3` |
| `13` | World 5-1 | **Lydian Colonnade** | Grand Orchestral Finale • F Lydian • 120 BPM | Marble columns, twin Lava chasms, `>>>` frieze | `SYMP1` |
| `14` | World 5-2 | **The Silent Movement** | Grand Orchestral Finale • F Lydian • 120 BPM | Triple Silence orchestra pit, Lava, Steel box | `SYMP2` |
| `15` | World 5-3 | **Symphony of the Saved** | Grand Orchestral Finale • F Lydian • 120 BPM | 50-Lemming Finale across Lava, Water, & Silence | `SYMP3` |

---

## Architecture

- **`index.html` & `styles.css`**: Responsive `320:200` nearest-neighbor viewport (`image-rendering: pixelated`) housed inside a toggleable Commodore 1084S CRT monitor bezel with CSS scanlines and phosphor vignette.
- **`font.js`**: Endian-safe `Uint32Array` RGBA color packing, Amiga `5x7` & `3x5` bitmap pixel fonts, and multi-scanline Copper-bar gradient banner text.
- **`sprites.js`**: Procedural pixel-art sprite compiler generating 15 multi-frame `8–10px` lemming animations (`walk`, `fall`, `float`, `climb`, `build`, `shrug`, `bash`, `mine`, `dig`, `block`, `ohno`, `splat`, `drown`, `burn`, `celebrate`), silence-desaturated variants, animated entrance hatches, equalizer exit portals, and 13 HUD icons.
- **`terrain.js`**: Per-pixel destructible material & scale-degree bitmaps (`DIRT`, `BRICK`, `STEEL`, `ONE_WAY_LEFT`, `ONE_WAY_RIGHT`, `WATER`, `LAVA`, `FIRE`), world parallax sky generators, `8x8` note-block flash cells, beat-synced Piston Crushers, and creeping Silence diffusion/pushback.
- **`audio.js`**: Real-time Web Audio API 64-step multi-pattern tracker & synthesizer featuring lookahead scheduling, 5 gain-faded stems per world, quantized footstep voice limiting, 2-op FM & subtractive leads, resonant TB-303 acid bass, gated-reverb/Amen/timpani percussion, 3-formant `"Let's go!"` and `"Oh no!"` vocal stabs, stereo ping-pong delay, master `DynamicsCompressorNode`, `AnalyserNode`, and Composed Song recorder/replayer.
- **`sim.js`**: Fixed `60 Hz` deterministic simulation engine powered by an isolated Mulberry32 PRNG, smart crowd priority selection, On-Beat Groove scoring, sequential Nuke countdown, and scripted Demo controller.
- **`levels.js`**: All 16 procedural levels, passwords, and verified frame-exact solution demo recordings.
- **`renderer.js` & `main.js`**: Software `320x200` `ImageData` blitter, HUD & overlay hit-testing, ProTracker Stem Mixer, Level Select/Password screen, Results Piano-Roll Visualizer, and `60 FPS` fixed-timestep game loop.
