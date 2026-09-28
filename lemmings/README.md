# LEMMINGS: BEAT TRIBE

> *Playing is composing.* A Lemmings-style puzzle game where every level is a live music
> sequencer: the terrain is the score, the lemmings are the playheads, and the song you hear
> comes straight out of how you guide the tribe. Save lemmings and the song fills out.

Everything is plain JavaScript, HTML and CSS with **no dependencies and no external assets**.
Every pixel, sprite, font glyph, terrain texture, instrument, drum hit and vocal is generated in code.

```
open index.html            # works straight from file:// — no build step, no server
```

Click once to start (browsers only allow audio after a user gesture). I've tested it in Chrome (including
headless runs via `tools/browser-run.js`). It uses only standard Canvas 2D and Web Audio APIs, so other
modern browsers should work too.

---

## Features

### Graphics & engine (Amiga OCS style, 320×200)
- A software framebuffer (`Uint32Array` → `ImageData`) at **320×200**, scaled up with nearest-neighbour
  filtering to the largest integer multiple that fits. Press **C** to toggle a **CRT bezel** with scanlines,
  vignette, glass glare and flicker.
- **Per-pixel destructible terrain**: dig, bash, mine, build and explode. Includes steel (indestructible)
  and one-way walls with arrows.
- **Levels wider than the screen** (480–1000 px) with smooth scrolling, parallax backgrounds and a
  **clickable minimap** you can also drag.
- **Procedurally built 10 px lemmings** (green hair, blue robe) with animations for walk, fall, float, climb,
  hoist, build, shrug, bash, mine, dig, block, "Oh no!" countdown, explosion into pixel particles, splat,
  drown, burn and the exit celebration hop.
- **Lemmings walk to the beat.** The lemming logic clock comes from the song clock
  (`ticks = frame × BPM × ticksPerBeat / 3600`), so walkers take one full stride per beat. Their feet land
  on 8th notes and their heads dip on the downbeat. Blockers pump on the beat.
- The terrain **pulses on the beat** (surface edges glow brightest), and **note blocks flash** when a
  lemming plays them.
- **Deterministic simulation**: fixed 60 Hz timestep, seeded Mulberry32 RNG and no `Math.random` in the
  sim. Recordings replay frame-exactly.

### The twist: the level is the sequencer
- **Note terrain.** Terrain comes in coloured bands, one colour per scale degree. Each world is locked to
  one scale, so any mix of notes sounds consonant. The **colour under a lemming's feet sets the pitch** and
  its **height sets the octave** (high ground sings high).
- **Quantized footsteps.** Footsteps never play right away. Each one is queued to the next 1/8 (steps) or
  1/16 (skills) of the song clock. **Voice limiting** keeps at most 4 distinct footstep pitches per step,
  with velocity ∝ 1/√n. Other voices are capped at 3 per step and 64 in total. A master compressor keeps
  50 marching lemmings tight and clean.
- **Skills are instruments:**

  | Skill   | Voice |
  |---------|-------|
  | Climber | plucked notes climbing the scale as it climbs |
  | Floater | slow filtered pad swell on the chord |
  | Bomber  | "Oh no!" formant vocal, then an explosion with a crash cymbal |
  | Blocker | a detuned drone on the **current chord root**, retuned every bar while it holds |
  | Builder | a rising FM-bell arpeggio, **one note per brick** (the brick's colour is its note) |
  | Basher  | a resonant filtered bass sweep on the chord root |
  | Miner   | syncopated percussive clicks on the off-16ths |
  | Digger  | alternating kick / snare as it digs down |

- **Stems unlock as you save lemmings.** Each world's song is split into 5 gain-controlled stem groups.
  Every 20 % of the tribe saved fades in the next one: **DRUMS → BASS → CHORDS → LEAD → FULL MIX**. Until
  the first unlock, a soft heartbeat (kick + hat) keeps time. Every exit plays a rising chord, and saving
  100 % plays the full arrangement.
- **On-beat groove bonus** (optional). Assign a skill within ±8.5 % of a beat and you get a sparkle
  arpeggio, a pixel starburst, an "ON BEAT!" / "GROOVE X4" popup and Groove Score (100 × streak, up to
  ×8). Off-beat assignments still take effect instantly; the puzzle always comes first.
- **The Silence.** A creeping grey field that eats sound. It drains colour from the terrain, mutes
  footsteps and muffles the whole mix (a low-pass sweep on the master bus). Lemmings inside it slow to half
  speed and fall off the beat. If they stay in it long enough they panic (grey "?") and start wandering the
  wrong way. Music pushes it back. Every skill and footstep adds **energy**: blocker drones (strong and
  wide), builder arpeggios, bashes, explosions and exits.
- **Results screen & song replay.** Shows rescued / needed %, Groove Score, on-beat count and which stems
  you unlocked. Then it **replays the song you composed**: the backing stems exactly as they unlocked over
  time, plus every logged lemming note (footsteps, bricks, drones, vocals…). A scrolling piano-roll
  visualizer and a live spectrum/scope play along (F = 1×/2×/4×, Space = restart).

### Worlds

| # | World | Genre / palette | Scale | BPM |
|---|-------|-----------------|-------|-----|
| 1 | Amiga Chip Garden | 4-channel chiptune: pulse-wave lead/bass/arps, noise drums; grass & brick | C major pentatonic | 125 |
| 2 | Acid Warehouse | TB-303 squelch (resonant biquad, accents, slides), 909 kick, claps, FM stabs; neon girders | E Phrygian | 128 |
| 3 | Synthwave Sunset | detuned saw pads, gated-reverb snare, 808, saw lead; chrome grid under a gradient sun | D Dorian | 108 |
| 4 | Jungle Breakbeat Caves | chopped synthesized "amen" break, sub bass, reese, rhodes, flute; bioluminescent caves | A minor pentatonic | 170 |
| 5 | Grand Orchestral Finale | strings, brass, celli, timpani, gran cassa, snare rolls, celesta, pizzicato; marble ruins | F Lydian | 96 |

### Levels (1 tutorial + 5 worlds × 3)

| Level | Name | Code | World | Save | RR | Time | Skills | Hazards |
|---|---|---|---|---|---|---|---|---|
| T | LET'S GO! | `TRIBE` | Chip Garden | 5/10 | 50 | 3:00 | basher 3, digger 2 | - |
| 1-1 | STAIRWAY GROOVE | `PAULA` | Chip Garden | 16/20 | 50 | 4:00 | builder 3 | - |
| 1-2 | DIG THE BEAT | `AGNUS` | Chip Garden | 16/20 | 50 | 4:00 | digger 2, basher 1, builder 1 | steel |
| 1-3 | MINING MELODIES | `DENIS` | Chip Garden | 16/20 | 50 | 5:00 | miner 2, digger 2, basher 1 | water, steel |
| 2-1 | BLOCKER'S BASSLINE | `ACIDS` | Acid Warehouse | 16/20 | 50 | 5:00 | blocker 2, builder 4, bomber 2, basher 1 | acid bath |
| 2-2 | SQUELCH CRUSHER | `SQUEL` | Acid Warehouse | 16/20 | 50 | 5:00 | miner 2, basher 2, digger 2, blocker 1 | crushers, one-way |
| 2-3 | DETONATION STATION | `SLIDE` | Acid Warehouse | 17/20 | 50 | 5:00 | blocker 2, bomber 3, basher 1 | fire, steel |
| 3-1 | HUSH HOUR | `NEONS` | Synthwave Sunset | 14/20 | 50 | 5:00 | builder 2, blocker 2, bomber 2 | lava, **Silence** |
| 3-2 | SUNSET DIVE | `DRIVE` | Synthwave Sunset | 15/20 | 50 | 5:00 | floater 10, miner 1, builder 1 | lava, **Silence** |
| 3-3 | OUTRUN THE QUIET | `OUTRN` | Synthwave Sunset | 14/20 | 50 | 6:00 | builder 3, blocker 1, bomber 1, miner 1, basher 1 | lava, one-way, steel, **Silence** |
| 4-1 | AMEN CAVERN | `AMENS` | Jungle Caves | 16/20 | 50 | 5:00 | basher 2, digger 2, builder 1 | water |
| 4-2 | REESE BASS | `REESE` | Jungle Caves | 16/20 | 50 | 5:30 | builder 3, blocker 1, bomber 1, digger 2 | magma, crushers |
| 4-3 | RINSE AND REPEAT | `RINSE` | Jungle Caves | 15/20 | 50 | 6:00 | climber 3, blocker 1, basher 1, bomber 1, builder 1 | one-way, **Silence** |
| 5-1 | OVERTURE | `TUTTI` | Orchestral Finale | 10/14 | 40 | 5:00 | floater 14, builder 2, blocker 1, bomber 1, digger 1 | fire |
| 5-2 | FORTISSIMO | `FORTE` | Orchestral Finale | 24/30 | 50 | 7:00 | basher 3, miner 2, builder 2, blocker 1, bomber 1, digger 1 | water, steel, one-way |
| 5-3 | CODA | `CODAS` | Orchestral Finale | 30/40 | 55 | 8:00 | all eight | fire, crusher, water, one-way, **Silence** |

Difficulty ramps up gradually. The tutorial teaches one skill, and each later level adds a new skill or
hazard. The finale combines everything, with two entrances and a double Silence. **Every level ships with a
solution recording** that the verifier replays (see below).

---

## Controls

| Input | Action |
|---|---|
| **Left click** skill button, then a lemming | assign the skill (works while paused) |
| Crosshair over a lemming | brackets it; the status bar shows its state (WALKER, BUILDER, ATHLETE…) and how many are under the cursor |
| **Right-drag** / mouse wheel / screen edges | scroll the camera |
| Click or drag the **minimap** | jump the camera |
| `1`–`8` | select Climber · Floater · Bomber · Blocker · Builder · Basher · Miner · Digger |
| `Left`/`Right` or `A`/`D` (hold `Shift` = faster) | scroll |
| `P` (or `Space`) | pause |
| `F` | fast-forward ×2 (the song clock speeds up with the simulation) |
| `N` twice, or double-click the mushroom | nuke |
| `-` / `+` | release rate (the panel buttons auto-repeat when held) |
| `D` | watch the solution demo (title, level select, briefing). **In-game use `Shift+D`**, since plain `D` scrolls right as the spec's A/D scrolling requires. |
| `T` | stem mixer overlay: live tracker rows for all 5 stems; `1`–`5` mute, `Shift+1`–`5` solo, or click (right-click = solo) a column header |
| `M` | mute |
| `C` | toggle the CRT bezel |
| `Esc` | back to level select |

**Level select:** `Up`/`Down` + `Enter` (or click) plays **any** level straight away (level warp). Type a
5-letter code (or press `Tab`, or click the code box) to restore progress. Reached levels show their code;
the rest show `WARP`. Best % and groove per level are stored in `localStorage`.

**Bottom panel** (classic layout): RR− / RR+, eight skill buttons with remaining counts and hotkeys, pause,
nuke (mushroom cloud, flashes `??` while armed), fast-forward, minimap, a live **AnalyserNode
spectrum + oscilloscope**, and a status line (hovered lemming, OUT, IN %/needed %, time left, and five stem
LEDs that blink on the beat once unlocked).

---

## Audio engine (`js/audio.js`)

A small Web Audio tracker and synth rack:

- **Lookahead scheduler** on `AudioContext.currentTime`. Each frame the game passes the sim's song position
  (in 16th steps). The engine maps steps to audio time with an anchor that drifts to match (and re-anchors
  if the error goes over 50 ms), then schedules everything due in the next ~120 ms at exact sample times.
  `setTimeout` never times a note.
- **Tracker songs** (`js/songs.js`): each world has three 64-step patterns (4 bars of 16ths) chained by an
  order list, rotated per level. Pattern cells are compiled from a compact text notation: chord-relative
  bass, scale-degree melodies, drum strings, 303 accent/slide lanes and break-slice indices.
- **Five stem groups** (voice → stemIn → unlock gain → user mute/solo gain → mix, plus reverb/delay sends
  after the fader). Unlocked stems fade in with `setTargetAtTime`.
- **Synthesized voices** (65 instruments): FM leads, bells and electric piano; subtractive saw leads,
  brass, strings and pads with detune and vibrato LFOs; a **resonant `BiquadFilterNode` acid bass** with
  accent envelopes, slides and waveshaper drive; periodic-wave pulse channels (12.5 %/25 %) for the chip
  world; noise kicks, snares, claps, hats and cymbals; timpani on the chord root; and a synthesized amen-style
  break that gets sliced live for jungle.
- **Formant vocals**: "Oh no!" and "Let's go!" come from a glottal sawtooth (pitch contour + vibrato)
  through three moving band-pass formant filters (o / u / n / e / l / s / g targets, scaled up for tiny
  lemming vocal tracts), plus a noise burst for the "s".
- **FX**: a stereo **ping-pong delay** (dotted 8th, low-passed feedback), a generated-IR convolution
  reverb, a gated-reverb IR for the synthwave snare, a Silence muffle filter, a master
  `DynamicsCompressor`, and an `AnalyserNode` feeding the panel and results visualizers.
- **Song log & replay**: every lemming-made note is logged as `[step, voice, midi, velocity, length]`,
  along with stem-unlock times and drone segments. The results screen feeds this log back through the same
  scheduler.

---

## Architecture

```
index.html        canvas + CRT bezel; loads scripts in dependency order
style.css         integer scaling, pixelated rendering, CRT overlay
js/core.js        BT namespace, constants, Mulberry32 RNG, value noise, the 5 worlds
js/terrain.js     destructible material/degree bitmap + level Painter (bands, steel, one-way)
js/sim.js         deterministic 60 Hz simulation: lemmings, skills, hazards, Silence, stems, groove, events
js/levels.js      16 level definitions (terrain builders, budgets, hints, codes, solution scripts)
js/demos.js       AUTO-GENERATED {frame, lemmingIndex, skill} solution recordings
js/gfx.js         framebuffer primitives + 5×7 and 3×5 bitmap fonts
js/sprites.js     procedural lemming animation frames + panel icons
js/render.js      level view: textured note terrain, parallax, hazards, particles, beat pulse, minimap
js/songs.js       tracker songs + compiler
js/audio.js       scheduler, stems, instruments, vocals, FX, song log/replay
js/game.js        main loop, screens, panel, input, mixer overlay, results visualizer
tools/            headless verification & test tooling (Node, no dependencies)
```

The simulation has no DOM or audio dependencies. It only emits events (`step`, `brick`, `droneOn`, `ohno`,
`exit`, `stem`, …). `render.js` turns them into visuals and `audio.js` turns them into quantized music.
Because the sim is headless-safe, Node can verify every level.

**Main loop:** `requestAnimationFrame` feeds a fixed-timestep accumulator that runs `update()` at exactly
60 Hz (catch-up is capped so the game never spirals after the tab was hidden) and renders once per display
frame. Fast-forward runs two sim steps per tick.

---

## Verification & tools

All tools are plain Node scripts (tested with Node 26):

| Command | What it does |
|---|---|
| `node tools/verify.js` | Replays every level's recording **twice** through a fresh sim; checks the save target and bit-identical determinism |
| `node tools/compile-demos.js [--png]` | Compiles the conditional solution scripts in `levels.js` into frame-exact recordings (`js/demos.js`); `--png` renders level maps |
| `node tools/audio-smoke.js` | Runs the audio engine against a **strict Web Audio mock** (non-finite values, bad ramps, double start/stop), plays all 65 instruments and schedules every level's full song and replay |
| `node tools/game-smoke.js [--png]` | End-to-end headless run of the whole game with a stubbed DOM: title → code entry → every level (skills, pause, mixer, scrolling, FF) → results replay → demo → CRT; `--png` writes UI screenshots |
| `node tools/browser-run.js` | Runs `tools/browser-test.html` in **real headless Chrome** over DevTools; reports JS errors, frame rate, analyser signal and saves a screenshot |
| `node tools/snapframe.js <level> <frame> [camX]` | Renders a single in-game frame to PNG |

Latest `tools/verify.js` output:

```
PASS  T    LET'S GO!                saved 10/10 (need 5, 100%)  1 cmds  58.4s  deterministic=true
PASS  1-1  STAIRWAY GROOVE          saved 20/20 (need 16, 100%)  1 cmds  62.1s  deterministic=true
PASS  1-2  DIG THE BEAT             saved 20/20 (need 16, 100%)  1 cmds  63.3s  deterministic=true
PASS  1-3  MINING MELODIES          saved 20/20 (need 16, 100%)  1 cmds  79.5s  deterministic=true
PASS  2-1  BLOCKER'S BASSLINE       saved 19/20 (need 16, 95%)  4 cmds  80.0s  deterministic=true
PASS  2-2  SQUELCH CRUSHER          saved 20/20 (need 16, 100%)  2 cmds  81.5s  deterministic=true
PASS  2-3  DETONATION STATION       saved 19/20 (need 17, 95%)  2 cmds  67.0s  deterministic=true
PASS  3-1  HUSH HOUR                saved 19/20 (need 14, 95%)  3 cmds  214.0s  deterministic=true
PASS  3-2  SUNSET DIVE              saved 20/20 (need 15, 100%)  1 cmds  86.8s  deterministic=true
PASS  3-3  OUTRUN THE QUIET         saved 18/20 (need 14, 90%)  5 cmds  125.8s  deterministic=true
PASS  4-1  AMEN CAVERN              saved 20/20 (need 16, 100%)  2 cmds  65.5s  deterministic=true
PASS  4-2  REESE BASS               saved 19/20 (need 16, 95%)  5 cmds  81.5s  deterministic=true
PASS  4-3  RINSE AND REPEAT         saved 18/20 (need 15, 90%)  5 cmds  129.8s  deterministic=true
PASS  5-1  OVERTURE                 saved 12/14 (need 10, 86%)  15 cmds  75.8s  deterministic=true
PASS  5-2  FORTISSIMO               saved 28/30 (need 24, 93%)  4 cmds  118.8s  deterministic=true
PASS  5-3  CODA                     saved 38/40 (need 30, 95%)  6 cmds  131.1s  deterministic=true
ALL 16 LEVELS VERIFIED SOLVABLE
```

The recording format follows the spec: `{frame, lemmingIndex, skill}`. `lemmingIndex` is the spawn
order, and a command applies just before the sim steps past `frame`, which is exactly what happens when you
click between frames. The same recordings drive the title-screen attract mode (cycling through all 16
levels with an auto-camera that follows the next lemming to be given a skill) and the `D` demo viewer.

### Design notes
- Each level was built around a known solution first. The solution is written as a conditional script
  ("when the first walker reaches x ≥ 212, give it a basher"), which `compile-demos.js` turns into
  frame-exact commands.
- Silence regions start small and sit away from the entrance, and steel "curbs" after pits stop panicked
  wanderers from falling back. This keeps the Silence tense without making levels unfair.
- The simulation never reads the audio clock. The song clock is derived from the frame count, so
  gameplay stays deterministic whether sound is on, muted or unavailable.
