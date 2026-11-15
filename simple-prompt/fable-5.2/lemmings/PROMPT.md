# One-Shot Prompt: Lemmings — Beat Tribe

```text
We are going to build a retro puzzle-strategy game inspired by DMA Design / Psygnosis's Lemmings (1991) inside the `/Users/jansene/src/slopanoid/lemmings/` directory as a single one-shot prompt. You are a legendary Amiga demoscene musician, pixel-art terrain artist, and meticulous puzzle designer. Make all design and technical decisions yourself and build the complete, playable game in one shot using pure, dependency-free Vanilla JavaScript, HTML, and CSS at a locked 60 FPS. Use zero external assets: every sprite, terrain texture, font, and sound must be generated in code. Do not read or reference any files outside `/Users/jansene/src/slopanoid/lemmings/`.

THE CORE IDEA: "PLAYING IS COMPOSING." Every level is a living music sequencer. The terrain is the score, the lemmings are the playheads, and the song you hear is the direct result of how you guide the tribe. Saving lemmings completes the song.

Use these core specifications:

1. GRAPHICS & ENGINE (Amiga OCS 320x200 Pixel-Destructible Terrain):
- Render into a 320x200 pixel-perfect software framebuffer (`Uint32Array` / `ImageData`) scaled with nearest-neighbour filtering, with a toggleable CRT scanline bezel.
- Terrain is a per-pixel destructible bitmap (dig, bash, mine, build, explode) with levels wider than the screen, smooth horizontal camera scrolling, and a clickable minimap in the bottom panel.
- Animate classic tiny 8-10 pixel-tall lemmings (green hair, blue robe) with full multi-frame animations: walk, fall, float, climb, build, bash, mine, dig, block, shrug, "Oh no!" countdown, explode into pixel particles, splat, drown, burn, and the exit-door celebration hop.
- Lemmings must visibly bob their heads and step in time with the tempo of the current song.
- Terrain pulses and glows subtly on the beat; note-blocks flash when a lemming triggers them.
- Simulation runs on a fixed 60 Hz timestep with a seeded RNG so every level plays back deterministically.

2. THE OUT-OF-THE-BOX TWIST ("BEAT TRIBE" — THE LEVEL IS THE SEQUENCER):
- NOTE TERRAIN: Terrain is colour-coded into scale degrees. Each world uses its own fixed musical scale (pentatonic or modal), so any combination of triggered notes sounds consonant. The colour of the ground under a lemming determines the pitch it plays; its height band determines the octave.
- QUANTIZED FOOTSTEPS: Lemming footsteps never play immediately. Every note event is quantized to the next 1/8 or 1/16 step of the global song clock, so 50 lemmings produce a tight groove instead of noise. Apply per-note voice limiting and velocity scaling so large crowds stay musical and never clip.
- SKILLS ARE INSTRUMENTS: Every classic skill doubles as a distinct musical voice:
  * Climber: plucked ascending notes as it climbs
  * Floater: soft pad swell while drifting down
  * Bomber: crash cymbal + pitch-dropping "Oh no!" formant vocal on detonation
  * Blocker: sustained drone on the chord root, held while blocking
  * Builder: rising arpeggio, one note per brick laid
  * Basher: filtered bass sweep as it tunnels
  * Miner: syncopated percussive clicks
  * Digger: kick drum and snare pattern as it digs down
- SONG STEMS UNLOCK BY SAVING LEMMINGS: Each level's song is split into stems. Every 20% of the tribe saved unlocks the next stem into the permanent mix: DRUMS -> BASS -> CHORDS -> LEAD -> FULL MIX. The exit door plays a rising chord when a lemming arrives. Save 100% and the full arrangement plays in glorious completion.
- ON-BEAT GROOVE BONUS (never a requirement): Assigning a skill exactly on a beat triggers a sparkle sound, a small pixel burst, and a Groove Score bonus. Off-beat assignments still work instantly and normally — puzzle precision always comes first.
- THE SILENCE: A creeping grey "Silence" hazard eats sound. Areas without music drain colour from the terrain; lemmings in silent zones slow down, lose their rhythm, and eventually panic and wander. Keep the music flowing through a region (via Blockers' drones, Builders' arpeggios, etc.) to push the Silence back.
- END-OF-LEVEL SONG REPLAY: The results screen shows saved/needed percentages, Groove Score, and replays the exact song the player composed during the level, with a scrolling visualizer.

3. LEVELS & WORLDS (5 GENRE WORLDS, 16 LEVELS TOTAL):
- 1 tutorial level followed by 5 worlds of 3 levels each. Each world has its own genre, scale, tempo, instrument palette, and EGA/Amiga-style colour theme:
  * World 1: Amiga Chip Garden (4-channel chiptune, major pentatonic, bright grass-and-stone terrain)
  * World 2: Acid Warehouse (TB-303 squelch, Phrygian mode, neon steel girders and smoke)
  * World 3: Synthwave Sunset (analog pads and gated drums, Dorian mode, chrome grids under a gradient sun)
  * World 4: Jungle Breakbeat Caves (chopped breaks and sub-bass, minor pentatonic, bioluminescent caverns)
  * World 5: Grand Orchestral Finale (strings, brass, and timpani synthesized, Lydian mode, marble concert-hall ruins)
- Each level has an entrance hatch, an exit door, a lemming count, a required save percentage, a release-rate range, a time limit, and a per-skill count budget.
- Include classic hazards (water, lava, crushers, fire pits, steel/indestructible blocks, one-way walls) alongside The Silence.
- Difficulty must ramp gradually, and every level must be solvable with the skills provided. Design each level around a known intended solution first, then build the terrain around it.
- ATTRACT-MODE SOLUTION DEMOS: Every level ships with a scripted solution recording (a list of `{frame, lemmingIndex, skill}` commands). The title screen plays these as a classic attract-mode demo, and a `[D]` key lets the player watch the demo for the current level. Use these recordings to verify that each level is actually solvable.
- Include a Level Select screen with password-style codes (classic Lemmings style) and a Level Warp selector so any level can be played immediately.

4. AUDIO ENGINE (Web Audio API Tracker + Synth, `audio.js`):
- The soundtrack is the centerpiece of this showcase. Build a real-time multi-channel tracker sequencer driven by a lookahead scheduler (`AudioContext.currentTime`-based, never `setTimeout`-timed notes) so quantization stays sample-accurate at a locked tempo.
- Each world's song sequences through multiple 64-step patterns with pattern chaining, and each stem is a separate gain-controlled channel group that fades in when unlocked.
- Synthesize every voice in code: FM/subtractive leads, resonant `BiquadFilterNode` acid bass, detuned pads, noise-based percussion, formant-filtered "Oh no!" and "Let's go!" vocal stabs, and a stereo ping-pong delay bus.
- Include a real-time `AnalyserNode` spectrum/oscilloscope in the bottom panel, plus a master compressor to keep dense crowd moments clean.
- Fast-forward doubles the simulation speed while keeping the music locked to the simulation (the song clock speeds up with it).

5. CONTROLS & UI (Mouse + Keyboard):
- Classic Lemmings bottom panel: release rate -/+, the 8 skill buttons with remaining counts, pause, nuke (mushroom-cloud button, double-click to confirm), fast-forward, and minimap.
- Mouse: click a skill, then click a lemming to assign it. A crosshair cursor highlights the lemming under it and shows its current state. Right-click or drag the minimap to scroll.
- Keyboard: `1`-`8` select skills, `Left/Right` or `A/D` scroll the camera, `P` pause, `F` fast-forward, `N` nuke, `-`/`+` release rate, `D` watch solution demo, `M` mute, `C` toggle CRT bezel, `Esc` return to level select.
- A mute/stem mixer overlay (`[T]`) shows the live pattern rows and lets the player solo/mute each stem.
- Include a comprehensive `README.md` in `/Users/jansene/src/slopanoid/lemmings/README.md`.
```
