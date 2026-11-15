# BEAT TRIBE

**Lemmings, but the level is the sequencer.** A retro puzzle-strategy game inspired by
DMA Design / Psygnosis's *Lemmings* (1991) in which *playing is composing*: the terrain
is the score, the lemmings are the playheads, and the song you hear is the direct
result of how you guide the tribe. Saving lemmings completes the song.

- Pure vanilla JavaScript, HTML and CSS. No dependencies, no build step, no network.
- **Zero external assets.** Every sprite, terrain texture, background, font glyph and
  sound is generated in code at runtime.
- 320x200 software framebuffer (`Uint32Array` over `ImageData`), nearest-neighbour
  scaled, with a toggleable CRT scanline bezel.
- Fixed 60 Hz simulation with a seeded RNG: every level replays bit-for-bit.
- 16 levels (1 tutorial + 5 genre worlds x 3), each shipped with a recorded solution
  that is machine-verified.

## Running it

Open `index.html` in a modern desktop browser (Chrome, Firefox, Safari, Edge). It works
straight from `file://`. If you prefer a local server:

```sh
python3 -m http.server 8000     # then visit http://localhost:8000
```

Browsers only start audio after a user gesture, so the attract mode is silent until
you click or press a key.

## How to play

Lemmings drop from the hatch and walk until something stops them. Pick a skill, click a
lemming, and get the required percentage of the tribe to the exit before time runs out.

| Skill | Key | What it does | Its instrument |
| --- | --- | --- | --- |
| Climber | `1` | climbs walls (permanent) | plucked ascending notes while climbing |
| Floater | `2` | survives any fall (permanent) | soft pad swell while drifting down |
| Bomber | `3` | explodes after a 5 second countdown | pitch-dropping "Oh no!" formant vocal + crash cymbal |
| Blocker | `4` | stands still and turns walkers around | sustained drone on the current chord root |
| Builder | `5` | lays a 12-brick staircase | rising arpeggio, one note per brick |
| Basher | `6` | tunnels horizontally | filtered bass sweep per stroke |
| Miner | `7` | tunnels diagonally downwards | syncopated percussive clicks |
| Digger | `8` | digs straight down | kick and snare pattern |

Classic rules apply: a fall of more than 60 pixels is fatal, walkers step over
obstacles up to 6 pixels high, steel cannot be removed, one-way walls can only be
bashed or mined in the direction of their arrows, builders stop when they hit a wall
that is too high, and a climber that bumps its head falls back down.

### Controls

| Input | Action |
| --- | --- |
| `1`-`8` or click a skill button | select a skill |
| Left click on a lemming | assign the selected skill (the cursor highlights the lemming and the status line shows its state) |
| `Left` / `Right` or `A` / `D` | scroll the camera (also: mouse at the screen edge, mouse wheel) |
| Right-drag / right-click | drag the view / centre the view on that spot |
| Click or drag the minimap | jump the camera |
| `-` / `+` or the first two buttons | release rate down / up (hold the buttons to repeat) |
| `P` or `Space` | pause |
| `F` | fast-forward: 2x simulation, and the song speeds up with it |
| `N` twice, or double-click the mushroom cloud | nuke |
| `T` | stem mixer: live pattern rows, `1`-`5` mute, `Shift`+`1`-`5` solo (or click / right-click) |
| `D` | watch the solution demo of the current level (see the note below) |
| `M` | mute |
| `C` | toggle the CRT bezel and scanlines |
| `Esc` | back to level select |
| `Shift`+`R` | restart the level |

**About the `D` key.** The brief asks for `A`/`D` to scroll *and* for `D` to start the
solution demo. Both are honoured without ambiguity: on the level select, intro card,
pause and results screens `D` starts the demo; while a level is actively running `D`
scrolls right and `Shift`+`D` starts the demo. During a demo, `D` hands the level back
to you.

### Level select, warp and codes

Every level is unlocked from the start: move with the arrow keys (or click) and press
`Enter`. Each level also has a classic 10-letter code, shown on the level select, the
intro card and the results screen. Press `Tab` on the level select and type a code to
jump straight to that level.

## The twist: Beat Tribe

**Note terrain.** The ground is divided into 16-pixel *note blocks*. Each block is
capped in the colour of a scale degree, and each world uses one fixed scale, so any
combination of triggered notes is consonant. When a lemming steps onto a block it plays
that block's pitch; its height band (top / middle / bottom third of the screen) picks
the octave. Builder bricks take the colour of the note they played.

**Quantized footsteps.** Nothing a lemming does is heard immediately. Every event waits
for the next 1/8 or 1/16 step of the song clock. Per step, identical notes are merged,
at most four footstep pitches survive (the ones most lemmings asked for), velocity
grows with the logarithm of the crowd and shrinks with the number of simultaneous
notes, and a hard polyphony ceiling plus a master compressor and soft clipper keep
50-lemming moments clean.

**Stems unlock by saving.** Each song is split into five stems. At the start you hear
only a soft metronome pulse and whatever the tribe plays. Every 20% of the tribe saved
fades the next stem permanently into the mix: DRUMS, BASS, CHORDS, LEAD, FULL MIX. Each
arrival makes the exit answer with a rising chord. Save 100% and the full arrangement
plays.

**On-beat groove bonus.** Assigning a skill within a few frames of a beat gives a
sparkle, a pixel burst and Groove Score with a combo multiplier. It is never required:
off-beat assignments work instantly and identically.

**The Silence.** A creeping grey hazard that eats sound. Where no music is played it
spreads from block to block, draining the colour from the terrain and low-passing the
mix. Lemmings in silent blocks walk at half speed, lose their rhythm, and after a few
seconds panic and wander before pulling themselves together. Music pushes it back:
footsteps a little, builders' arpeggios and diggers' drums more, and a blocker's drone
holds a wide area clear for as long as it stands.

**Song replay.** The results screen shows saved / needed percentages and the Groove
Score, then replays the exact song you composed (the quantized note log plus the moments
each stem unlocked) on a scrolling piano-roll with the live spectrum underneath.

**In time with the music.** Walk cycles and blocker poses are driven by the song clock,
so the whole tribe steps and bobs on the beat; the terrain pulses on every beat and note
blocks flash when triggered. Crushers slam on the beat.

## Worlds and levels

| World | Genre | Scale | BPM |
| --- | --- | --- | --- |
| Training Meadow (tutorial) | chip jingle | C major pentatonic | 108 |
| 1. Amiga Chip Garden | 4-channel chiptune | D major pentatonic | 126 |
| 2. Acid Warehouse | TB-303 acid house | A Phrygian | 132 |
| 3. Synthwave Sunset | synthwave | D Dorian | 104 |
| 4. Jungle Breakbeat Caves | jungle / drum and bass | F minor pentatonic | 168 |
| 5. Grand Orchestral Finale | symphonic | G Lydian | 96 |

| Level | Name | Lemmings | Save | Rate | Time | Skill budget | Silence | Code |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T | JUST DIG THE BEAT | 10 | 50% | 50 | 3:00 | 3 digger | | `FPNPPVXWZF` |
| 1-1 | STAIRWAY TO GROOVE | 20 | 80% | 50 | 4:00 | 4 builder | | `FCNSNPHCFT` |
| 1-2 | BASH STREET BEAT | 30 | 80% | 45 | 5:00 | 3 basher, 3 builder | | `XTWFBQSVXN` |
| 1-3 | TRIBE DIVIDED | 20 | 85% | 50 | 3:00 | 2 blocker, 2 digger, 2 bomber | | `NSBHJKFDMW` |
| 2-1 | WRONG WAY GIRDER | 20 | 80% | 50 | 4:00 | 2 climber, 2 floater, 2 basher | | `GCJJKFRCHC` |
| 2-2 | ACID DROP | 30 | 80% | 40 | 5:00 | 2 miner, 2 basher | yes | `ZXMGHPGWVM` |
| 2-3 | PRESSURE PLANT | 40 | 75% | 50 | 6:00 | 2 digger, 2 basher, 2 blocker, 5 builder, 2 bomber | yes | `WMQKKQMMNX` |
| 3-1 | NEON SKYLINE | 30 | 80% | 50 | 5:00 | 2 miner, 3 bomber, 3 floater | | `TFDMZMJZFV` |
| 3-2 | OUTRUN THE SILENCE | 40 | 95% | 50 | 5:30 | 2 blocker, 3 basher, 3 builder | yes | `GLJXVDJVVR` |
| 3-3 | CHROME CANYON | 40 | 90% | 60 | 5:00 | 1 climber, 6 builder | yes | `PKNZFTWCRJ` |
| 4-1 | SUB-BASS GROTTO | 30 | 90% | 55 | 5:00 | 1 climber, 1 miner, 1 basher, 2 builder | | `RCZBJHTMNK` |
| 4-2 | AMEN CAVERN | 40 | 85% | 50 | 6:00 | 1 climber, 1 floater, 4 builder, 2 basher | yes | `JTCBWTCSHX` |
| 4-3 | RINSE OUT | 40 | 80% | 60 | 5:00 | 6 blocker, 6 bomber | | `NQVHPCCQMR` |
| 5-1 | OVERTURE | 50 | 90% | 55 | 6:00 | 1 climber, 3 builder, 2 basher | yes | `HNPGFJWLVV` |
| 5-2 | CRESCENDO | 50 | 90% | 60 | 7:00 | 2 miner, 2 digger, 2 basher, 4 builder | yes | `XHVLZXLSJZ` |
| 5-3 | ODE TO LEMMINGS | 60 | 85% | 60 | 8:00 | all eight skills | yes | `RMKSSXZJVG` |

Hazards: water, lava, fire pits, beat-synced crushers, steel, one-way walls, lethal
falls, and the Silence.

<details>
<summary>Intended solutions (spoilers)</summary>

Each level was designed solution-first; the same text sits above every `build()` in
`js/levels.js`.

- **T** Make anyone a digger on the stone slab.
- **1-1** One builder, started about 20 px before the 9 px step.
- **1-2** Bash the stone pillar, bash the earth mound, build over the last step.
- **1-3** Lemming 0 blocks near the right end of the slab, the first lemming walking
  back blocks near the left end, a digger opens a shaft between them. Nuke at the end.
- **2-1** The crowd cannot bash the one-way wall. One climber + floater goes over it,
  bounces off the crate (the low girder stops it climbing over) and bashes the wall
  from the right. Then bash the crate.
- **2-2** Mine down through the catwalk before the fire pit, then bash the rust heap.
- **2-3** Dig about 16 px before the crusher, switch to basher and tunnel under it. On
  the lower floor the second arrival blocks, the first builds three times across the
  lava, then bomb the blocker free.
- **3-1** Start a miner just past the steel core so the ramp leaves the cliff low
  enough. Below, time a bomber to explode on the golden thin floor over the basement
  that holds the exit.
- **3-2** The first lemming walks left: make it a blocker, its drone is a sound
  barrier that keeps the Silence off the hatch. Bash two walls, build over the step,
  nuke. (Raising the release rate to 99 and outrunning the Silence also works.)
- **3-3** One climber leaves the steel pit, builds twice over the lava and once over
  the far step. Meanwhile build twice inside the pit to release everybody else.
- **4-1** A climber leaves the pit, bounces off the rock column and comes back; make
  it a miner 50 to 75 px before the pit edge so its tunnel becomes a ramp. Bash the
  column.
- **4-2** A climber + floater leaves the pen, floats down the cliff, bounces off the
  stalagmite and builds three times towards the cliff so the stairs touch the wall.
  Bash the pen open: everyone lands on the stairs. Bash the stalagmite.
- **4-3** No tools, only bombs. Park a blocker right against the rock and give it a
  bomber. Three blasts open the first wall, two the second.
- **5-1** Do not open the first pillar yet. A climber crosses it alone and builds
  twice over the lava. Then bash pillar one, and pillar two when the crowd arrives.
- **5-2** Mine just past the steel core, dig until you hit steel in front of the
  crusher, bash under it, build twice up to the exit loge.
- **5-3** Blockers at both ends of the tower, a miner ramps down through it. One
  climber + floater crosses the tall pillar, builds twice over the lava, digs to the
  steel and bashes under the crusher, then climbs out over the last wall. Bash the
  pillar to release the tribe; park a blocker against the thin wall and bomb it. Nuke
  the two tower blockers at the end.

</details>

## Attract mode and solution demos

Every level ships with a recording in `js/solutions.js`: a list of
`{frame, lemmingIndex, skill}` commands (plus `{frame, nuke: true}` where the intended
solution ends by nuking leftover blockers). The title screen cycles through them as a
classic attract mode, and `D` plays the recording for the current level.

Because the simulation is deterministic and has no dependency on rendering or audio,
the same recordings are replayed headlessly under Node to prove that every level is
solvable:

```sh
node tools/verify.js
```

```
level  result  saved        need  time used   stems  notes  deterministic  name
T      PASS    10/10 100%    50%   51s/180s   5/5      267  yes            JUST DIG THE BEAT
1-1    PASS    20/20 100%    80%   98s/240s   5/5      719  yes            STAIRWAY TO GROOVE
...
5-3    PASS    57/60  95%    85%  193s/480s   4/5     2763  yes            ODE TO LEMMINGS

All 16 levels solved by their recordings.
```

Each level is run twice and the save count, end frame and composed song are compared,
so the check also covers determinism.

## Audio engine (`js/audio.js`)

- **Tracker.** `js/songs.js` holds one song per world: an order list chaining 64-step
  patterns (2 to 4 patterns per song, 7 to 9 channels). Patterns are written one
  character per 1/16 step in scale degrees, so everything is in key by construction.
- **Lookahead scheduler.** Rows are queued 140 ms ahead against
  `AudioContext.currentTime`; no note is ever timed with `setTimeout`. The game derives
  how many 1/60 s simulation steps are due from the same audio clock, so the song and
  the simulation cannot drift. Fast-forward maps two simulation frames onto each 1/60 s
  of audio time, which doubles the tempo with it.
- **Stems.** Every channel feeds one of five gain-controlled stem buses that fade in
  when unlocked. Delay sends are gated per stem so a locked stem cannot leak through
  the echo.
- **Voices, all synthesized:** pulse waves built from Fourier coefficients (12.5 / 25 /
  50% duty), triangle bass and tracker-style arpeggio chords for the chip worlds; a
  persistent TB-303 style voice (resonant `BiquadFilterNode`, accent, slide, slow
  cutoff sweep); detuned saw pads and strings; a brass voice with a filter "blat";
  2-operator FM bells, glockenspiel and leads; sine-sweep kicks, toms and timpani;
  filtered-noise snares, claps, hats, rides, shakers and crashes, including a gated
  80s snare; a formant choir; and formant-filtered "Oh no!" and "Let's go!" vocal
  stabs (sawtooth glottis and breath noise through three moving band-pass filters).
- **Mix bus.** Stems and lemming voices pass through a "Silence" low-pass, a
  `DynamicsCompressorNode`, the master gain and a soft clipper into an `AnalyserNode`
  whose spectrum and oscilloscope are drawn in the bottom panel. A tempo-synced stereo
  ping-pong delay sits on a send bus.

## Project layout

```
index.html          page shell: canvas, CRT bezel markup, script tags
style.css           scaling and the CRT bezel (the game itself is not styled by CSS)
js/core.js          namespace, constants, colour helpers, hash noise, seeded RNG
js/worlds.js        the six worlds: scale, mode, root, tempo, colours
js/songs.js         tracker song data and pattern compiler
js/terrain.js       destructible bitmap, procedural textures, level builder, scenery
js/levels.js        the 16 levels with their intended solutions
js/solutions.js     generated solution recordings (attract mode / demos)
js/sim.js           deterministic lemming simulation, quantizer, the Silence
js/font.js          5x7 pixel font
js/sprites.js       procedural lemming animations
js/render.js        software renderer: backgrounds, terrain, objects, lemmings, panel
js/screens.js       title, level select, intro card, results + replay, mixer
js/audio.js         Web Audio tracker and synthesizer
js/game.js          screens, input, camera, clock, main loop
tools/              development helpers (Node; not needed to play)
```

### Development tools

All of these are optional. The headless tools need only Node 18 or newer. The two
browser tests additionally need Node 22+ (built-in `WebSocket`) and a local Chrome
(default macOS path, or set `CHROME=/path/to/chrome`); they skip themselves if no
Chrome is found.

| Command | Purpose |
| --- | --- |
| `node tools/verify.js` | replay every shipped recording, check the result and determinism |
| `node tools/solve.js` | play the rule-based solution scripts in `tools/scripts.js` and regenerate `js/solutions.js` |
| `node tools/shot.js <level> [frame]` | dump a whole level strip as a PNG with a per-lemming trace (level design debugging) |
| `node tools/frame.js level <level> <frame> [camX]` | render a real 320x200 game frame to PNG with the software renderer; also `sprites`, `font`, `bg`, `strip` |
| `node tools/browser-test.js` | end-to-end smoke test in headless Chrome: every screen, mouse assignment, fast-forward, pause, mixer, all worlds, a full demo and the replay |
| `node tools/audio-test.js` | render every pattern, stem and lemming voice through an `OfflineAudioContext` and report peak / RMS; fails on silence or clipping |

To change a level, edit its `build()` in `js/levels.js` and its rules in
`tools/scripts.js`, then run `node tools/solve.js && node tools/verify.js`.

## Design notes

- **Timestep.** The simulation advances in fixed 1/60 s steps. Lemming logic ticks
  every fourth step (15 Hz, close to the original's pace), which keeps walking at one
  pixel per tick and makes pixel-exact terrain rules simple; lemmings slowed by the
  Silence accumulate ticks at half rate.
- **Determinism.** The simulation uses only its own seeded generator (mulberry32) and
  integer terrain. Particles and other cosmetics use a separate generator and never
  feed back into it.
- **Quantizer lookahead.** A note is committed to its step 6 frames before that step
  sounds. That is what lets the audio engine schedule it sample-accurately instead of
  "as soon as possible", and the note block flashes on the frame the note is heard.
- **Tutorial plus fifteen.** The level select lists the tutorial on its own row and
  three levels per world, 16 in total.
- **Pulse.** With no stems unlocked a level would be silent until the first footstep,
  which makes on-beat play impossible to judge, so a quiet metronome tick is always
  audible underneath.
- **Level edges** are invisible walls; falling out of the bottom of a level is fatal.
- Progress (best percentage and Groove Score per level) is kept in `localStorage`.

## Known limitations

- Desktop only: mouse and keyboard, no touch controls.
- Developed and smoke-tested in Chrome on macOS only. Nothing browser-specific is
  used, but Firefox and Safari were not tested.
- The music was balanced by measurement (`tools/audio-test.js`), not by ear on many
  devices; use `T` to mute or solo stems, or `M` to mute everything.
- Fast-forward is 2x only, as specified.
- The on-beat window does not compensate for the audio output latency of the device.
