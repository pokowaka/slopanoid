You are a highly creative Retro Game Designer, an expert C++ and JavaScript Software Engineer, a professional Chiptune Composer, and a hardcore LucasArts historian.

Your task is to write a complete, single-file retro Arkanoid clone and save it exactly inside this directory. The game must be immediately playable in a modern browser by opening this file, meaning all HTML, CSS, JavaScript, graphics rendering, and audio synthesis must be self-contained in this single file. No external assets (images, audio files, libraries) are allowed.

To truly honor the LucasArts legacy, the game must feature a highly sophisticated, multi-channel chiptune synthesizer engine that mimics the classic AdLib/OPL2 sound card, complete with distinct, complex, and varied procedural soundtracks for different levels.

---

### 🎵 High-Fidelity AdLib FM Synthesizer & Music Engine (CRITICAL)

You must implement a robust, customized **Web Audio API synthesizer** running a multi-channel scheduler. It must NOT use simple beep sounds; instead, it must build a simulated OPL2 synthesizer with:

1. **Instruments:** Define distinct Web Audio synthesizer patches:
   - _FM Lead/Melody:_ A carrier/modulator pair (using `GainNode` modulation of an oscillator's frequency) to create a biting metal brass or hollow woodwind sound.
   - _Bass:_ A fat triangle wave with a fast-decaying low-pass filter to simulate a punchy bass synth.
   - _Percussion/Noise:_ A synthesized noise buffer or band-pass filtered white noise burst for snappy retro snare/hi-hat hits.
2. **The Sequencer/Tracker:** Create a precise, state-driven step-sequencer (running on a fast clock loop, e.g., 120-140 BPM, utilizing `Web Audio` scheduling timestamps to avoid browser drift).
3. **Soundtrack Variety (Each level has its own unique soundtrack!):**
   Hardcode **distinct musical compositions** (separate note, pitch, velocity, and duration arrays) for different levels/themed worlds:
   - _The Monkey Island Theme (Levels 1–6):_ A syncopated, bouncing Caribbean-style reggae groove featuring a metallic steel-pan FM lead, a walking bassline, and upbeat off-beat percussion.
   - _The Purple Tentacle March (Levels 7–12):_ A quirky, chromatic, and mischievous march with a fast-modulating square wave lead (suggesting an active b-movie monster) and dramatic descending bass stabs.
   - _The Atlantis Crypt (Levels 13–18):_ A slow, mysterious ambient soundscape featuring a sweeping, echoing pad, low frequency bass hums, and a random, haunting pentatonic chime melody.
   - _Space Combat Flight (Levels 19–24):_ A fast-paced, driving 16th-note bassline with a high-energy, soaring futuristic lead synth and rapid snare drums to capture high-stakes space action.
   - _The Loom of Fate (Levels 25–30):_ A beautiful, complex, four-voice classical counterpoint piece where the synth voices weave melodies together to form complex chords.
   - _The Road to Sam & Max (Levels 31–32):_ A swing-jazz, walking bass blues line with a highly expressive, pitch-bending "synth saxophone" lead.
   - _LeChuck's Battle Anthem (Level 33):_ A bombastic, rapid-fire heavy metal style track with highly distorted carrier-modulated guitar leads, double-time drums, and an aggressive, dark minor-scale bassline.

- **Audio FX (SFX):**
  - All game sound effects must be scheduled on dedicated FX channels so they cut through or gracefully mix with the active background tracks without causing audio clipping.
  - SFX must sound satisfyingly low-fi (leveraging pitch sweeps, envelope adjustments, and bit-crush styled distortion filters).

---

### 🎨 Visual & Graphics Specifications (EGA Style)

- **Resolution:** Render on a `<canvas>` element utilizing a strict, low-resolution virtual viewport of **320x200 pixels** (the exact golden-era LucasArts resolution). Scale this canvas responsively in the browser preserving crisp, pixel-art scaling (`image-rendering: pixelated`).
- **Color Palette:** Use the classic **64-color EGA palette** registers. Create highly vibrant, high-contrast retro themes for paddles, balls, power-ups, and bricks using these exact hexadecimal color mappings.
- **Backgrounds:** Draw subtle, parallax pixelated background details like a stylized night sky over Mêlée Island, a dusty Mayan temple vault, or a futuristic alien cavern.

---

### 🕹️ Controls

- **Mouse:** Paddle tracks horizontal mouse coordinates smoothly.
- **Keyboard:** Arrow keys / `A` and `D` keys for movement, and `Spacebar` to launch the ball or fire lasers.

---

### 👾 LucasArts-Inspired Level Design (33 Levels)

Design exactly **33 unique levels** represented as hardcoded coordinate arrays/matrices. Rather than generic rows of bricks, every level must be a distinct pixel-art mosaic of classic LucasArts imagery, featuring custom mechanics matching the themes above (insult sword fighting, time travel, ancient traps, gravity wells, loom musical spell-weaving, and the LeChuck moving boss battle with projectile dodging).

---

### 🧱 Game Mechanics & Power-ups

- **Brick Types:** Normal bricks (1 hit), Armored bricks (multi-hit with visual cracking), Indestructible steel bricks, and _Grog Bricks (Explosive 3x3 chain reaction)_.
- **Power-ups:** Spawning randomly upon brick destruction, falling slowly down as classic icons:
  - **L (Laser):** Attaches space-ranger blasters to shoot bricks.
  - **E (Expand):** Widens the paddle (styled as a rubber chicken).
  - **C (Catch):** Magnetizes the ball (styled as a magnetic compass).
  - **S (Slow):** Decelerates ball speed (styled as a tiny hourglass).
  - **P (Player):** Grants an extra life (styled as a pixelated gold guy logo).

---

### 📋 Code Architecture Requirements

Provide the **entire, clean, production-ready code** with zero placeholders, comments like `// TODO: Implement other levels`, or skipped lines. The script must include:

1. An inline CSS sheet styling a dark arcade cabinet border with the responsive pixelated canvas centered.
2. A complete state management system (score, high score, lives, current level, game states: Main Menu, Playing, Level Clear, Game Over, Victory).
3. The complete array data structure of all 33 level layouts.
4. Robust collision detection (AABB vs. circle) solving the "corner bounce" physics correctly so the ball never clips through bricks.
5. All synthetic Web Audio generator functions wrapped in a user-interaction trigger (to comply with browser audio autostart policies).

Write the full code block below and save it directly to the specified folder.
