# Lemmings: Beat Tribe

A retro Lemmings-style puzzle game in which **the lemmings write the song**.
Every footstep, brick, bash, mine and dig is a quantized note on a Web Audio
tracker; saving the tribe unlocks the stems of the level's track.

Pure vanilla JavaScript / HTML / CSS. No build step, no dependencies, no
external assets, no ES modules or `fetch` — just open `index.html` from disk
(`file://` works).

```
open index.html          # macOS
node test.js             # replays every baked solution: ALL 16 LEVELS PASS
node bake.js             # re-bakes solutions.js from the trigger plans
node smoke.js            # headless run of the browser shell under node (fake DOM / Web Audio)
```

Click or press any key on the attract screen to start (this also unlocks the
AudioContext).

---

## Controls

| Input | Action |
| --- | --- |
| Mouse | Select a skill button, then click a lemming. The crosshair becomes a bracket over a lemming; the status line shows its state (green = the selected skill can be assigned). |
| Right-drag / mouse at screen edge / wheel | Scroll the camera |
| Minimap (bottom right) | Click or drag to jump the camera |
| `1`–`8` | Select skill: climber, floater, bomber, blocker, builder, basher, miner, digger |
| `←` `→` / `A` `D` (hold `Shift` for fast) | Scroll |
| `P` / `Space` | Pause |
| `F` | Fast-forward (sim and song clock run 2×) |
| `N` `N` (or double-click the nuke button) | Nuke (armed confirmation) |
| `-` / `+` | Release rate |
| `T` | Stem mixer overlay (live pattern rows; click = mute, right-click = solo, `1`–`5` / `Shift+1`–`5`) |
| `M` | Mute |
| `C` | CRT scanlines + bezel on/off |
| `R` | Restart level |
| `D` (intro screen) / `Shift+D` (in game) | Watch the built-in demo solution |
| `Esc` | Back to level select |

Level select: `↑`/`↓` + `Enter`, or type a **password** and press `Enter` to warp.
Progress is remembered in `localStorage`.

## Worlds (16 levels: tutorial + 5 × 3)

| World | Genre | Scale | BPM | Levels |
| --- | --- | --- | --- | --- |
| 1 | Amiga Chip Garden | major pentatonic | 125 | Walk the Score, Dig Deep, Bridge the Beat, Bash and Mine |
| 2 | Acid Warehouse | Phrygian, 303 bass | 132 | Acid Drop, Hear the Silence, Crusher Line |
| 3 | Synthwave Sunset | Dorian, chrome pads | 108 | Chrome Grid, Gated Reverb, Neon Descent |
| 4 | Jungle Breakbeat Caves | minor pentatonic, breaks | 160 | Break Cave, Sub Drop, Amen Break |
| 5 | Grand Orchestral Finale | Lydian, strings/timpani | 96 | Overture, Crescendo, Finale |

Hazards: water (drown), lava/fire (burn), frame-timed crushers, indestructible
steel (basher/miner/digger *clank* and stop), one-way walls (bashable only in
the arrow direction) and **The Silence** — a grey, muffling front that creeps
across the level, slows lemmings (sim ticks at 2/3 speed), mutes their notes
and eventually makes them panic and turn around. Every musical event pushes
the front back.

Passwords: BEATONE1 CHIPDIG2 ARPEGGIO BASSWEEP SQUELCH1 LOUDTRIB PRESSGO3
NEONCLMB STEELGAP SUNSET3X AMENCAVE SUBBASS8 CHOPBRK9 TIMPANI5 STRINGS6 FULLMIX7

---

## How the music works

* **Terrain is notation.** Each solid pixel carries a scale degree (1–7, coloured
  per world). The octave comes from the height band of the lemming's feet
  (high / mid / low). Steel and one-way walls are unpitched.
* **Footsteps** are quantized to the next 1/16 of the song clock (1/8 for
  bashes and digs), voice-limited to 6 notes per slot with velocity scaled by
  `1/sqrt(1 + 0.8·load)`; identical notes in the same slot are dropped.
* **Skills are instruments**: climber = pluck, floater = pad swell, bomber =
  crash + formant *"Oh no!"*, blocker = sustained drone on the current chord
  root, builder = arpeggio per brick, basher = resonant bass sweep, miner =
  syncopated click, digger = kick/snare alternation. The exit door plays a
  rising chord.
* **Stems unlock per 20 % saved**: DRUMS → BASS → CHORDS → LEAD → FULL, each
  faded in with `setTargetAtTime` and announced with a fanfare banner.
* **Groove bonus**: assigning a skill within ±12 % of a beat gives a sparkle,
  a pixel burst and `100 + 25·combo` points (never required to solve).
* **Results screen** replays the recorded composition with a scrolling
  piano-roll visualizer; the stems you unlocked play underneath.

### Audio engine (`audio.js`)

* Lookahead scheduler: a 20 ms `setInterval` schedules everything that falls
  within a 0.22 s horizon using `AudioContext.currentTime`; the game calls
  `audio.sync(beat, speed)` every frame so the sim's deterministic beat clock
  is the master (pause = speed 0, fast-forward = speed 2).
* Per-world 64-step patterns (two patterns chained in an order list) for
  drums / bass / chords / lead / full, generated deterministically from the
  world scale and chord progression.
* Synthesis: FM and subtractive leads, resonant `BiquadFilter` acid bass with
  envelope-swept cutoff, detuned saw pads, noise-based kick/snare/hat/crash,
  formant-filtered "Oh no!" / "Let's go!" vocals, stereo ping-pong delay bus
  (dotted eighth), master compressor and an `AnalyserNode` feeding the scope /
  spectrum display in the panel.

---

## Architecture

| File | Role |
| --- | --- |
| `sim.js` | Deterministic 60 Hz simulation: per-pixel destructible terrain (`Uint8Array`, value = note degree / steel / one-way), lemming state machine (walk, fall, float, climb, build, bash, mine, dig, block, shrug, oh-no, explode, splat, drown, burn, exit), hazards, The Silence, seeded RNG, event emission. Runs in node and the browser. |
| `levels.js` | 16 level definitions (terrain ops, hazards, skills, passwords, hints). |
| `bake.js` → `solutions.js` | Trigger-plan DSL that plays each level to produce `{frame, lemmingIndex, skill}` command recordings; used by attract mode, `[D]` demos and the test. |
| `test.js` | Replays every recording independently, checks the quota and a determinism hash. |
| `audio.js` | Web Audio tracker/synth described above. |
| `render.js` | 320×200 `Uint32Array` framebuffer → `ImageData` → canvas (nearest-neighbour, integer-scaled, optional CRT scanlines). 4×5 bitmap font, procedural backgrounds per world, terrain texturing with beat pulse and note flashes, lemming sprites with tempo head-bob, particles, panel icons, minimap, scope. |
| `game.js` | State machine (attract/title → select → intro → play → results), fixed-timestep loop, camera, input, bottom panel, mixer overlay, demo playback, sim → audio/visual event bridge. |
| `smoke.js` | Headless browser-shell test. |

### Simulation notes

* Lemmings tick at 15 Hz (accumulator of 3/frame; 2/frame inside The Silence).
  A walker climbs steps ≤ 6 px, drops ≤ 3 px, otherwise falls; falls over 62 px
  are fatal unless floating.
* Builder lays 12 six-pixel bricks, basher clears a 9-px tunnel in 3-px bites,
  miner carves a diagonal with 6-px circles, digger an 9-px shaft, bomber
  erases a 9-px radius after a 5 s countdown; blockers emit a drone until they
  are blown up or the level ends.
* Commands are applied before the frame they are stamped with, which makes
  the baked solutions replay bit-identically.

### Level solvability (from `node test.js`)

All 16 levels are solved by their baked demo: saves 10/10, 10/10, 9/10, 12/12,
8/8, 17/20, 12/12, 9/10, 9/10, 11/12, 8/10, 9/10, 14/15, 11/12, 14/15, 19/20 —
every one at or above its quota.
