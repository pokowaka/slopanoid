# Lemmings &middot; Beat Tribe: The Sequencer Odyssey

> **A Complete Clean-Room Retro Puzzle-Strategy Tribute to DMA Design / Psygnosis (1991)**  
> *Zero External Assets &middot; Zero Third-Party Libraries &middot; Amiga OCS 320&times;200 Destructible Framebuffer &middot; 5-World Web Audio Tracker Sequencer &middot; Skills As Instruments &middot; Procedural TB-303 Acid & Demoscene Synthesis*

---

## 1. Executive Summary & Design Philosophy: "Playing is Composing"

**Lemmings: Beat Tribe** is a clean-room, retro puzzle-strategy game that bridges the classic 1991 DMA Design / Psygnosis masterpiece with the golden era of the Amiga demoscene.

Every level is a **living music sequencer**:
- **The Terrain is the Score**: Geological strata are color-coded into consonant modal scales.
- **The Lemmings are the Playheads**: As lemmings traverse the terrain, their footsteps trigger quantized scale degrees based on the ground color beneath their feet, with height bands establishing pitch octaves.
- **Skills are Instruments**: Diggers drum, Builders arpeggiate, Blockers sustain resonant drones, Bashers sweep bass filters, Miners click syncopated rhythms, and Bombers crash with formant speech stabs.
- **Saving Lemmings Unlocks the Song**: Each world features a multi-channel tracker track divided into 5 stems. Every 20% of the tribe saved unlocks the next stem into the permanent mix (`DRUMS` &rarr; `BASS` &rarr; `CHORDS` &rarr; `LEAD` &rarr; `FULL MIX`).
- **The Silence Hazard**: A creeping monochrome shadow drains color from the terrain and suffocates sound. Lemmings entering the Silence slow down and dissolve unless pushed back by the sonic radiation of Blockers and Builders.

Built 100% from scratch in pure Vanilla JavaScript, HTML5 Canvas, and Web Audio API without a single external image, audio sample, or third-party dependency, the complete game engine runs inside a single self-contained file with zero CORS restrictions.

---

## 2. Core Architectural Pillars

### A. Graphics & Software Framebuffer Pipeline (Amiga OCS 320&times;200)
* **Direct Per-Pixel Software Framebuffer**:
  - Direct blitting to a 320&times;200 `Uint32Array` (`ImageData.data.buffer`) scaled with nearest-neighbor interpolation (`image-rendering: pixelated; crisp-edges`).
  - Native playfield viewport: 320&times;160 pixels scrolling over levels 640 pixels wide.
  - Metallic bottom control panel: 320&times;40 pixels with classic release rate controls, 8 skill slots, pause, fast forward, nuke, real-time minimap, and tribe HUD.
* **Per-Pixel Destructible Terrain Bitmap**:
  - `mask`: `Uint8Array` storing pixel physics attributes: `AIR`, `NOTE_1..7`, `STEEL` (indestructible metal), `WATER` (lethal drowning), `LAVA` (lethal incineration), `CRUSHER`, `BRICK` (builder steps), and `SILENCE`.
  - Destruction operations (`carveCircle`, `digShaft`, `bashTunnel`, `mineSlope`) slice through terrain in real-time, spawning gravity-driven pixel particles.
* **Classic 8&times;10 Lemming Sprites & Multi-Frame Animation**:
  - Green hair (`#2ee33b`), blue robes (`#2848dc`), and peach skin (`#ffc999`).
  - Full animation state machine: `WALKING` (head-bobbing in sync with tempo!), `FALLING`, `FLOATING` (striped umbrella), `CLIMBING` (scaling sheer walls), `BUILDING` (laying diagonal steps), `BASHING` (tunneling fists), `MINING` (diagonal pickaxe), `DIGGING` (downward shovel), `BLOCKING` (outstretched arms), `SHRUGGING`, `BOMBER_COUNTDOWN` (floating countdown digits + head-clutching "Oh no!"), `SPLAT`, `DROWNING`, `BURNING`, and `EXITING` (celebration hop into portal).
* **Toggleable CRT Bezel & Scanline Mask (`[C]` Key)**:
  - Authentic curved monitor chassis with scanlines, phosphor glare, and power LED indicator.

---

### B. Web Audio API Tracker & Procedural Synthesis Engine (`audio.js`)
* **Sample-Accurate Lookahead Scheduler**:
  - Precise 16th-note lookahead scheduling driven by `AudioContext.currentTime` (never `setTimeout` or `setInterval` for note timing) ensuring locked BPM groove.
  - Fast-forward button (`[F]`) doubles simulation speed and tracker tempo simultaneously, keeping music and mechanics in 1:1 synchronization.
* **5 Distinct Genre Soundtracks**:
  1. **World 1: Amiga Chip Garden** (124 BPM, Major Pentatonic `[C, D, E, G, A]`) &mdash; Classic Paula 4-channel chiptune with arpeggio pulse leads and punchy drums.
  2. **World 2: Acid Warehouse** (135 BPM, Phrygian Mode `[E, F, G, A, B, C, D]`) &mdash; Roland TB-303 resonant acid squelch (`Q = 14..18`), filter sweeps, and 909-style drum synthesis.
  3. **World 3: Synthwave Sunset** (110 BPM, Dorian Mode `[D, E, F, G, A, B, C]`) &mdash; Lush detuned analog sawtooth pads, gated snare body, and nostalgic lead hooks.
  4. **World 4: Jungle Breakbeat Caves** (160 BPM, Minor Pentatonic `[A, C, D, E, G]`) &mdash; Chopped breakbeats, pitch-dropping 808 sub-bass, and resonant cave leads.
  5. **World 5: Grand Orchestral Finale** (100 BPM, Lydian Mode `[F, G, A, B, C, D, E]`) &mdash; Synthesized string section swells, brass fanfare swells, and resonant timpani rolls.
* **100% Procedural Synthesis**:
  - Procedural noise buffer generated in memory for all cymbals, snares, and hats. Zero audio samples.
  - Formant speech synthesis: Dual parallel bandpass filters (`F1`/`F2`) synthesizing speech vowels: "OH!", "NO!", and "LET'S GO!".
  - Stereo Ping-Pong Delay Network with cross-channel feedback and high-cut damping filter.
  - Master `DynamicsCompressorNode` preventing polyphonic clipping.
* **Quantized Footsteps Engine**:
  - Footsteps are queued to the upcoming 16th note step of the tracker clock.
  - Ground material determines scale degree; height band determines octave.
  - Polyphony limiter (max 3 simultaneous steps) and `1 / sqrt(N)` velocity scaling keep large crowds musical without distortion.
* **On-Beat Groove Bonus**:
  - Assigning a skill within &plusmn;75ms of a beat triggers a sparkle chime, golden star burst, floating text `"GROOVY! +50"`, and awards 50 bonus points. Puzzle precision always takes precedence: off-beat assignments still execute instantly.

---

### C. 5-Tier Stem Unlock Progression
Each world's song is divided into 5 independent audio stem channels routed to dedicated `GainNode`s:
| Tribe Saved % | Stem Unlocked | Arrangement Elements Added |
| :---: | :---: | :--- |
| **0%** | *Ambient / Lemmings* | Footstep melody notes, skill instruments, and background room tone |
| **20%** | **DRUMS** | Kick drum, snappy snare, hi-hats, and rhythmic breakbeats |
| **40%** | **BASS** | TB-303 acid lines, 808 sub-bass, or driving chiptune basslines |
| **60%** | **CHORDS** | Lush analog pads, detuned strings, and modal harmonies |
| **80%** | **LEAD** | Demoscene melodic hook, brass fanfare, and arpeggios |
| **100%** | **FULL MIX** | Riser sweeps, crashes, ear candy, and complete master arrangement |

When lemmings reach the exit door, a triumphant rising arpeggio chord (`C4 - E4 - G4 - C5`) plays, and on-screen fanfare text confirms each stem unlock.

---

### D. The 8 Skill Instruments
| Skill | Musical Role | Synthesis Technique |
| :--- | :--- | :--- |
| **Climber** | Ascending Plucked Chimes | Staccato plucked triangle waves ascending the current world's scale |
| **Floater** | Soft Harmonic Pad | Gentle sine-wave chord swell with slow attack and exponential decay |
| **Bomber** | Formant Vocal & Crash | "Oh no!" speech formant sweep followed by heavy cymbal crash & sub-bass |
| **Blocker** | Sustained Root Drone | Low-frequency triangle/saw root drone with sonic shield clearing Silence |
| **Builder** | Rising Arpeggio | Ascending marimba/synth-bell tone for every brick laid (12 bricks per step) |
| **Basher** | Resonant Bass Sweep | Resonant lowpass filter sweep (`Q = 14`) digging through rock |
| **Miner** | Syncopated Metallic Clicks | High-Q dual-frequency resonant spikes (1400 Hz) |
| **Digger** | Live Drum Kit Beat | Alternating kick drum thump and snappy acoustic snare |

---

## 3. Levels & Attract-Mode Demos (16 Solvable Levels Across 5 Worlds)

Every single level has been mathematically verified using an automated headless simulation engine running deterministic solution recordings:

| Level | Title | World | Scale | Lemmings | Req % | Password | Verified Demo Solution |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **0** | **Penta Park: Step to the Beat** | 1 | Major Pentatonic | 10 | 100% | `BEATTRIBE` | Digger shafts down into tunnel, 10/10 saved (**100%**) |
| **1-1** | **The Emerald Step** | 1 | Major Pentatonic | 15 | 80% | `CHIPCHOP` | Dual bashers tunnel through monoliths, 15/15 saved (**100%**) |
| **1-2** | **Pachinko Chime** | 1 | Major Pentatonic | 10 | 80% | `PACHINKO` | Floaters drift down musical note pegs, 10/10 saved (**100%**) |
| **1-3** | **The Four-Channel Chasm** | 1 | Major Pentatonic | 15 | 80% | `AMIGAFOUR` | Blocker holds crowd, builder bridges chasm, basher opens exit (**93%**) |
| **2-1** | **303 Resonant Girders** | 2 | Phrygian Mode | 15 | 80% | `ACIDBASS` | Basher clears rusted girder, builder bridges acid vat (**93%**) |
| **2-2** | **Squelch & Slide** | 2 | Phrygian Mode | 15 | 80% | `SQUELCHY` | Miner carves diagonal slides down scaffolding, 15/15 saved (**100%**) |
| **2-3** | **Overdrive Assembly Line** | 2 | Phrygian Mode | 15 | 80% | `OVERDRIVE` | Blocker stations on steel plate, builder bridges crusher pit (**93%**) |
| **3-1** | **Neon Highway 1984** | 3 | Dorian Mode | 10 | 80% | `SYNTHWAVE` | Basher punches through chrome skyscraper, 10/10 saved (**100%**) |
| **3-2** | **Sunset Arpeggios** | 3 | Dorian Mode | 15 | 80% | `OUTRUN86` | Multi-tiered arpeggio staircases bridge floating grid islands (**93%**) |
| **3-3** | **The Creeping Silence** | 3 | Dorian Mode | 15 | 80% | `MUTEDVOID` | Silence hazard repelled, basher cuts escape tunnel (**100%**) |
| **4-1** | **Amen Cavern** | 4 | Minor Pentatonic | 15 | 80% | `BREAKBEAT` | Fast 160 BPM: Digger cuts through glowing mushroom cap (**100%**) |
| **4-2** | **Sub-Bass Trench** | 4 | Minor Pentatonic | 15 | 80% | `SUBTERRA` | Blocker holds tribe, scout bridges underground lake (**93%**) |
| **4-3** | **Syncopated Descent** | 4 | Minor Pentatonic | 10 | 80% | `SYNCOPATE` | Miner carves stepped corridor through root shelves (**100%**) |
| **5-1** | **Symphonic Ruins** | 5 | Lydian Mode | 15 | 80% | `ALLEGRO` | Basher tunnels through ancient marble portico (**100%**) |
| **5-2** | **The Silence at the Gates** | 5 | Lydian Mode | 15 | 80% | `REQUIEM` | Blocker sonic shields protect tribe from dual silence waves (**93%**) |
| **5-3** | **The Great Polyphonic Exit** | 5 | Lydian Mode | 20 | 85% | `MAESTRO` | Grand Finale: All skills, lava pit bridge, marble arch bash (**95%**) |

* **Attract-Mode Demo**: Title screen automatically enters demo mode if left idle for 12 seconds, playing back scripted solutions.
* **Instant Solution Demo (`[D]` Key)**: Press `[D]` during gameplay on any level to sit back and watch the master solution demo execute automatically.

---

## 4. Controls & User Interface Guide

### Mouse Controls
* **Left Click Skill Button**: Selects active skill.
* **Left Click Lemming**: Assigns selected skill (crosshair highlights target with current action label).
* **Right Click + Drag / Minimap Drag**: Smoothly pans camera across the 640px level.

### Keyboard Shortcuts
* `1` &ndash; `8`: Select Skills (`Climber`, `Floater`, `Bomber`, `Blocker`, `Builder`, `Basher`, `Miner`, `Digger`).
* `A` / `D` or `Left` / `Right`: Scroll camera.
* `P`: Pause / Resume game and audio clock.
* `F`: Toggle 2&times; Fast-Forward (doubles simulation and tracker BPM in lockstep).
* `N`: Nuke tribe (mushroom cloud; double-click / double-press to confirm).
* `-` / `+`: Decrease / Increase release rate.
* `L`: Open Level Select & Password Warp Modal.
* `T`: Open Tracker Sequencer & Multitrack Stem Mixer Modal.
* `D`: Watch current level's Solution Demo.
* `M`: Toggle Master Mute.
* `C`: Toggle CRT Bezel & Scanlines.
* `Esc`: Return to Title Screen.

---

## 5. Directory Structure & Verification

```text
/tmp/gemini-eval/lemmings/
├── index.html        # Complete self-contained playable game (zero CORS, 122 KB)
├── audio.js          # Web Audio API tracker & demoscene synthesis engine
├── levels.js         # 16 level blueprints, scales, and verified solution demo scripts
├── game.js           # Lemmings physics, per-pixel framebuffer, and UI renderer
├── README.md         # Comprehensive engineering specification & game manual
├── bundle.js         # Single-file bundling script
└── test/
    ├── sim_engine.js      # Headless deterministic simulation engine
    ├── all_levels_data.js # Test definitions
    └── run_all_levels.js  # Automated solvability test runner (16/16 PASS)
```

To run the automated solvability test suite:
```bash
node /tmp/gemini-eval/lemmings/test/run_all_levels.js
```
*Result: 16 PASSED, 0 FAILED across all 16 levels.*
