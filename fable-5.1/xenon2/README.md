# XENON II: MEGABLAST — Evolution & Tracker Odyssey

A clean-room, single-file retro vertical shoot-'em-up tribute to The Bitmap Brothers' *Xenon 2: Megablast*
(1989). Pure Vanilla JavaScript + HTML5 Canvas + Web Audio API. **Zero assets, zero libraries, one file.**

Open `index.html` in any modern desktop browser. Click or press a key once to boot the audio context.

---

## Engine

| Feature | Implementation |
|---|---|
| Framebuffer | 320×200 `Uint32Array` over `ImageData`, scaled ×3 with `image-rendering: pixelated` |
| Palette | 256 colours = 16 metallic ramps × 16 shades (chrome, steel, gold, plasma, fire, bone, copper, flesh…) |
| Dithering | 4×4 Bayer matrix in every gradient fill, chrome spheres with specular highlights, additive glow |
| Parallax | Pre-rendered 256×512 far/mid strips per epoch at 0.25×/0.5× + live overlays (copper bars, gears, veins) |
| Walls | 32-column tile map, 4 tile types (soft / hard / gate / ore), destructible with chrome bevels |
| Level gen | Seeded procedural caverns: bottlenecks, **dead-ends** (crossing far below a plug), pillars, ore pockets |
| Loop | Fixed-step 60 Hz accumulator with catch-up cap |
| CRT | Toggleable scanline + vignette bezel (`C`) |

## 8-Channel Tracker (the centrepiece)

A ProTracker-style scheduler (122 BPM, speed 6, swing per era) sequences seven 64-row patterns:

```
00 INTRO → 01 PRECINCT 13 GROOVE → 01 → 02 TB-303 ACID BREAK → 03 BRASS & SCRATCH → 01 → 04 BRIDGE → 03 → 01 → 02 …
05 BOSS RAVE (looped during bosses)      06 CRISPIN'S DUB (looped while docked, master dub LPF sweeps to 520 Hz)
```

| CH | Voice | Synthesis |
|---|---|---|
| 1 | Precinct 13 bass ostinato | 2 detuned saw/square + sine sub, snappy LPF envelope |
| 2 | **TB-303 acid** | saw/square → VCA → *persistent* resonant `BiquadFilter` (Q 11–22) → tanh drive. Per-note cutoff envelope, accents (`C40`), slides (`3xx` legato on the same oscillator), **`Zxx` pattern-driven cutoff automation** |
| 3 | Soaring lead | dual osc + sub, vibrato LFO (`47A`), legato, **stereo ping-pong `DelayNode` feedback loop** |
| 4 | PWM chords / brass | real PWM: `saw − delayed(saw)` with LFO on `delayTime`; orchestra hit = saw stack + noise transient + LPF sweep; era 4 switches to Amiga chip arpeggios |
| 5 | Scratch & vox | pitch-bent noise + saw through bandpass (chirp / backspin / transformer / baby); **formant vocoder**: saw → 3 parallel bandpass formants morphing EH→AH→AE→S for "MEGA-BLAST!", IY→EH→AH for "YEAH!" |
| 6 | 808 kick / sub-drop | sine 165→46 Hz pitch drop + click; 95→26 Hz sub sweep |
| 7 | Breakbeat snare / ghosts / gated clap | bandpass noise + snap + triangle body; 4-burst clap with a hard gate at 215 ms |
| 8 | Hats / cowbell | HP noise + two metallic squares (closed chokes open); 562+845 Hz square cowbell |

Each of the five epochs is an **era variation**: transposition (0, −2, +2, +4, −5), oscillator types, 303 resonance, hat decay,
swing and drive. Press **`T`** for the live **Pattern Viewer** (`ROW | NOTE INST FX` × 8) scrolling in sync with the music,
with Mute / Solo per channel and pattern-jump buttons. The cabinet shows a live `AnalyserNode` spectrum and oscilloscope.

## Gameplay — The Evolution Timeline

| Epoch | Stage | Boss |
|---|---|---|
| 1 | Cambrian Trilobite Reef (trilobites, ammonites, spore nests) | The Leviathan Anomalocaris |
| 2 | Abyssal Nautiloid Trench (jellies, squids, geysers, minefields) | The Kraken-Nautilus |
| 3 | Babbage Clockwork Foundry (gears, cogs, arc turrets, pistons) | The Difference Engine Automaton |
| 4 | 1989 Demoscene Silicon Wafer (blitter bobs, vector cubes, copper bars) | The 68000 Cyber-Blitter |
| 5 | Biomechanical Xenite Hive (pods, fighters, spawners, laser gates) | The Sovereign Xenite Mother-Brain |

Every boss has an exposed-weak-point phase; **Crispin's Boss Intel** highlights it in gold.

* **Reverse Thrust** — hold `Down` at the bottom of the screen to scroll backwards out of dead-ends (up to 420 px).
* **Chrono-Reverse** — hold `R` / `Shift` / right-click to rewind camera, ship, enemies, bullets and bubbles through a 180-frame ring buffer, draining Chrono-Energy.
* **Weapon heat** locks your guns at 100 %; shields absorb hits; cash bubbles drop from kills (wave-clear bonus).

## Crispin's Intergalactic Upgrade Store

Docks at the mid-point and end of every stage (or `B` any time). Animated portrait (reflective shades, headphones bobbing to
`Music.beatPhase()`, animated jaw while talking), 6-slot **hardpoint paper-doll** (NOSE / LEFT WING / RIGHT WING / REAR TAIL /
ORBITAL DRONES / HULL), **50 % trade-in** on replaced or sold parts, and 16 items:

Twin Vulcan · Plasma Spread · Electro-Arc Beam · Side-Laser Pod · Homing Missile Rack · Bounce-Orb Launcher · Rear Tail Cannon ·
Temporal Prox Mines · Dual Orbiting Drones · Hull Plating · Chrono-Capacitor · **Super Nashwan Power** · Shield Repair ·
Speed Booster · Smart Bomb · Boss Intel. Every mounted part is rendered on the Megablaster sprite in real time.

**Synergies:** Side-Laser + Bounce-Orb = *Ricochet Prism Matrix* (bouncing lasers that split into prism beams on orbs);
Temporal Mines + Reverse/Chrono thrust = *Chrono Backfire Nova* (ring of mines while backing up); Electro-Arc + Drones =
*Tesla Chain Swarm* (lightning from the drones to nearby enemies).

## Controls

| Key | Action |
|---|---|
| `WASD` / Arrows / Mouse | Move |
| `Space` / `Z` / LMB (hold) | Fire all hardpoints |
| `Down` at screen bottom | Reverse scroll thrust |
| `R` / `Shift` / RMB (hold) | Chrono-Reverse rewind |
| `Q` / `X` | Smart Bomb / Super Nashwan |
| `B` / `T` / `1`–`5` | Shop dock / Tracker jukebox / Stage warp |
| `C` / `M` / `P` | CRT bezel / Music on-off / Pause |
| Shop: `↑↓` item, `←→` slot, `Enter` buy, `V` sell, `Esc` leave | |
