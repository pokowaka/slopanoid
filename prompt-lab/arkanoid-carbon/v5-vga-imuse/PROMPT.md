You are the Lead VGA Background Painter & Sprite Animator of 1992-era LucasArts (*Monkey Island 2: LeChuck's Revenge*, *Indiana Jones and the Fate of Atlantis*, *Day of the Tentacle*), paired with Michael Land & Peter McConnell (inventors of the LucasArts *iMUSE* dynamic music system) and an expert JavaScript Game Engine Programmer.

Your task is to write a complete, single-file retro Arkanoid tribute (`index.html`) inside this directory—immediately playable in any modern browser with zero external assets (all HTML, CSS, JS, procedural 256-color VGA pixel art, 33 levels, and Web Audio OPL2 + iMUSE FM synthesis self-contained in one file).

---

### 🎨 CO-CENTERPIECE #1: Lush 1992 LucasArts 256-Color VGA Pixel Art & SCUMM Presentation

Treat visual craftsmanship as a centerpiece of this build. Render **rich 1992 LucasArts 256-color VGA Mode 13h (`320x200`, integer-scaled, `image-rendering: pixelated`) painterly pixel art**:

1. **Painterly 256-Color VGA Ramps & Ordered Dithering:**
   - Construct a curated **256-color VGA palette** organized into smooth **8-to-16-shade artist ramps** (deep Caribbean twilight blues/teals, warm Scumm Bar lantern golds/ambers, Tentacle Mansion purples/toxic greens, Atlantean terracotta & molten orichalcum, starfighter chrome/plasma cyan, Loom celestial indigos, and LeChuck necrotic ghost-greens/hellfire oranges).
   - Provide a 4x4 Bayer ordered-dither ramp painter (`paintRampGradient`, `ditherRamp`) so skies, clouds, stone vaults, water, and metallic trim blend with authentic 1992 pixel-art warmth—never smooth CSS/Canvas vector gradients or half-pixel anti-aliased strokes.

2. **Multi-Plane Painterly Parallax Scenery (7 Worlds, Pre-Rendered Offscreen Surfaces):**
   - Pre-render **3 to 4 parallax planes** per world (`sky/moon`, `far horizon`, `mid architecture`, `foreground details` + animated water/lava/star overlays):
     - *Mêlée Island:* Glowing cratered full moon behind dithered trade-wind clouds, silhouetted cliffside lookout & pirate galleon masts, warm flickering Scumm Bar pier lanterns, and multi-shade harbor wave reflections.
     - *Edison Mansion:* Stormy purple dusk, crooked Victorian mansion towers with glowing lab windows, hilltop tombstones, and bubbling green sludge river.
     - *Lost Atlantis:* Carved subterranean temple colonnades, glowing orichalcum relief murals, flickering braziers with warm radial pixel dither halos, and flowing lava channels.
     - *Space Combat:* Deep-space painterly nebula clouds, shaded ringed planet with terminator shadow, 3-speed starfield, and perspective trench hull plates.
     - *Island of Loom:* Shimmering aurora/star sky, cathedral crystal spires, cliffside swan shrine, and emerald sea spray.
     - *Sam & Max Highway:* Desert sunset mesa silhouettes, neon roadside signs, and animated perspective highway dashes.
     - *LeChuck's Fortress:* Jagged volcanic cavern maw, ghost-ship ribs, rising ember particles, and churning molten lava glow.

3. **Classic `256x200` Playfield + `64x200` Right-Hand HUD with Live Animated SCUMM Character Portraits:**
   - Left `256x200`: Playfield framed by ornate, world-themed `8px` sculpted pixel borders (carved pirate wood & brass, mansion pipes, Atlantean stone, starship hull, Loom stained crystal). Render the Main Menu directly over the live animated backdrop & brick mosaic (`Left`/`Right` previews all 33 stages).
   - Right `64x200` (`x = 256..319`): Textured sidebar featuring:
     - **Live Animated `48x36` Pixel-Art Character Portrait Box** (Guybrush Threepwood, Purple Tentacle, Indiana Jones, Rebel Pilot, Bobbin Threadbare, Max, and Ghost Pirate LeChuck) with blinking eyes, animated talking mouth when delivering witty one-liners/insults, and wincing/cheering expressions on ball loss or big combos!
     - Crisp `5x7` pixel-outlined bitmap font (never `3x5` or browser fonts) showing 7-digit Score/Hi-Score, Stage `XX/33`, mini-paddle Lives, active World Mechanic gauge, active Power-up badges, and a live scrolling iMUSE soundtrack + active-stem marquee.

4. **High-Detail ASCII/Bitmap Sprites, `30x18` (`8x6` Brick) Mosaics & Arcade Juice:**
   - **Sprites (`makeSprite` character-grid bitmaps with `1px` dark silhouettes + multi-shade VGA ramps):** `18x9` glossy beveled capsules with `7x7` pixel icons (`L` blaster, `E` rubber chicken w/ pulley, `C` compass, `S` hourglass, `P` Gold Guy); specular-lit `5x5` orb ball with glowing pixel trail; richly detailed Vaus/Chicken/Blaster/Compass paddle sprites; poison darts, voodoo skulls, spiral gravity vortices, and a centerpiece **`44x30` multi-frame Ghost Pirate LeChuck Boss** on Level 33.
   - **33 Recognizable Pixel-Art Mosaic Levels (`28–30 cols × 16–18 rows` of `8x6` beveled bricks):** Use rich multi-shade VGA ramp codes so every stage looks like an unmistakable, shaded pixel-art illustration (Jolly Roger skull, foaming Grog mug, Three-Headed Monkey, Purple Tentacle, Chron-o-John, Atlantean sun-idol, X-Wing/TIE trench, Loom distaff/swan, Max's grin, LeChuck's ghost galleon).
   - **Arcade Juice:** Hit-flash, `1–2px` screen-shake, radial pixel explosion rings & sparks on 3x3 Grog chain reactions, and pixel-outlined floating score/quips.

---

### 🎵 CO-CENTERPIECE #2: Authentic Yamaha YM3812 (OPL2) & LucasArts *iMUSE* Dynamic Music Engine

Do NOT write short 4-bar `null`-padded loops, monophonic harmony tracks, or plain Web Audio `sine`/`square` oscillators. Build an authentic **Yamaha OPL2 + LucasArts iMUSE dynamic soundtrack engine** (lookahead timestamp step-sequencer, unlocked on first click/key):

1. **True OPL2 Operator Wavetables & Expressive 2-Op FM Voice Architecture:**
   - At audio init, synthesize custom `PeriodicWave` tables via DFT (`48` harmonics) for the **exact OPL2 rectified operator waveforms** (`half-sine`, `abs-sine`, `quarter-pulse`) PLUS **self-modulating feedback operators** (`fb1`, `fb2`, `fb3` computed via iterative phase self-modulation `y = Math.sin(phase + fb * prev)` for authentic woody/metallic OPL2 brass, reed/sax, harpsichord, and gritty overdriven guitar).
   - Give every 2-operator FM patch (`16+` distinct patches across the 7 worlds):
     - Independent **4-stage ADSR envelopes** on *both* the Modulator Index (`GainNode` -> `carrier.frequency`, scaled by MIDI key-scale level `ksl` so high notes stay sweet rather than shrill) and Carrier Amplitude.
     - **Expressive Articulation:** Optional stereo unison dual-carrier detune (`±4..9 cents`), pitch-scoop / portamento glide from the previous note (`sax`, `starlead`), and **delayed vibrato LFO** (`delay: 0.16–0.25s` ramp-in so held melody notes blossom with vibrato while short staccato notes stay tight).
   - **Channel Mixer Strips, GM Percussion & Mastering:**
     - Per-channel `StereoPannerNode`, optional overdrive + cabinet low-pass (`3.4 kHz`), and tempo-synced stereo echo send (`3` 16th-notes with a `2.4 kHz` low-pass damping filter in the feedback loop).
     - Resonant fast-decaying low-pass filter bass synth (`triangle` + optional sub/edge harmonic) and a **10-piece synthesized percussion kit** (pitch-swept kick + click transient, body+bandpass-noise snare, rimshot, 3-burst clap, closed/open hi-hats, shaker, FM ride/cowbell, pitched toms).
     - Master `DynamicsCompressorNode` + transparent soft `tanh` clipper so zero clipping ever occurs, plus **sidechain ducking** (`musicBus` dips `35%` for `150ms` on Grog explosions, spells, and extra-life fanfares).

2. **Multi-Section 16-to-24-Bar Compositions (`256–384 Steps` Per World — NO 4-Bar Loops) + Polyphonic Chords:**
   - Encode each of the **7 world soundtracks** using **compact pattern chains** (`order: ['INTRO', 'A1', 'A2', 'B_BRIDGE', 'A_CLIMAX']` of reusable/varied 64-step patterns, or compact `[step, midiOrChord, dur, vel, bend]` event tuples—never sparse `null`-filled arrays) so every soundtrack develops across **at least 16–24 bars (~45–65 seconds)** with distinct `A` melody, `B` harmonic bridge/counter-melody, and drum turnaround fills every 4th/8th bar:
     1. *The Monkey Island Theme (Levels 1–6):* Syncopated Caribbean reggae (`swing: 0.10`), stereo steel-pan + marimba call-and-response melody, **3-note off-beat reggae organ chord skanks** (`[60,64,69]`, `[59,62,67]`), melodic walking bass, rimshot/shaker island groove.
     2. *The Purple Tentacle March (Levels 7–12):* Mischievous chromatic B-movie monster march with wobble-modulated FM lead, brass triad stabs, chromatic walking tuba/synth bass, and snappy march snares.
     3. *The Atlantis Crypt (Levels 13–18):* Atmospheric LFO-swept stereo FM pad chords, deep resonant bass drones, echo-drenched ocarina/flute theme, and generative pentatonic crystal chimes.
     4. *Space Combat Flight (Levels 19–24):* Driving 16th-note resonant bassline, soaring portamento `fb2` hero lead, fast 3-voice chord arpeggiator, and propelling snare/tom fills.
     5. *The Loom of Fate (Levels 25–30):* Genuine **four-voice classical counterpoint** (flute, oboe, viola, cello/harpsichord) weaving independent contrapuntal lines into rich D-minor / F-major harmonies.
     6. *The Road to Sam & Max (Levels 31–32):* Hard-swinging (`swing: 0.28`) film-noir jazz blues with upright walking bass, **3-to-4-note electric-piano/organ 7th-chord comping**, ride cymbal swing pattern, and scoop-bending `fb2` tenor saxophone solo.
     7. *LeChuck's Battle Anthem (Level 33):* Ferocious double-time neoclassical/pirate heavy metal with `fb3` overdriven dual-harmony guitar leads, palm-muted power-chord fifths, galloping bass, and double-kick/crash drums.
   - **Mandatory Polyphonic Chord Support:** Harmony/comping channels MUST trigger **3-to-4-note chord arrays** simultaneously!

3. **LucasArts *iMUSE* Interactive Stem Layering & In-Key Harmonic SFX:**
   - **Per-Level & Live Gameplay-Reactive iMUSE Stems:** Within each world, give levels distinct iMUSE orchestration presets (swapping lead patches, toggling harmony/percussion stems, subtle key/tempo shifts) AND **react live to gameplay intensity**—smoothly unmuting an extra high-energy counter-melody / percussion stem when `< 30%` bricks remain, during Insult Sword-Fighting duels, during multiball/laser overdrive, or in LeChuck's enraged phase! Crossfade (`250ms`) cleanly between worlds and include `1–7` sound-test preview keys on the Main Menu.
   - **Scale-Quantized Harmonic Brick SFX:** Store each soundtrack's `{ root, scale }` and quantize brick-hit combo pitches onto scale degrees of the currently playing song (respecting active transposition) through a 4-channel priority voice-stealing staircase bit-crusher FX bank—so brick-breaking combos literally improvise in key with the live band!

---

### 🕹️ Controls, World Mechanics & Completeness

- **7 World Mechanics:** Insult sword-fighting duels (1–6), Chron-o-John era-phasing bricks (7–12), dart-spitting Atlantean idols (13–18), orbital gravity wells (19–24), Loom musical note-weaving spells (25–30), Sam & Max patrolling road formations (31–32), and LeChuck's moving fireball boss battle (33).
- **Bricks & Power-ups:** Normal (`1 HP`), Armored (`2–3 HP` progressive cracks), Steel (indestructible), Grog (`3x3` recursive chain explosion); Capsules `L`, `E`, `C`, `S`, `P`.
- **Controls & Physics:** Smooth mouse + `A`/`D`/`Arrows`, `Space`/Click launch & fire, `Left`/`Right` stage select (`1–33`), `1–7` menu soundtrack jukebox preview, `P` pause, `M` mute, toggleable CRT scanlines, `localStorage` hi-score, sub-stepped corner-safe circle-vs-AABB collision physics, and zero placeholders or `TODO`s.
