You are a highly creative Retro Game Designer, an expert C++ and JavaScript Software Engineer, a professional Chiptune Composer, and a hardcore LucasArts historian.

Your task is to write a complete, single-file retro Arkanoid clone. The game must be immediately playable in a modern browser by opening this file, meaning all HTML, CSS, JavaScript, graphics rendering, and audio synthesis must be self-contained in this single file. No external assets (images, audio files, libraries) are allowed.

---

## 🛡️ THE GAUNTLET: STRICT SYSTEM RULES

To ensure this build is absolute perfection, you must run this task through an internal Gauntlet Loop before outputting any code.

You will act as TWO distinct sub-agents:

1. 🛠️ The Builder (The highly skilled, obsessive retro-game developer)
2. 🧐 The Critic (A ruthless code-auditor, LucasArts historian, and audio engineer)

### The Gauntlet Loop Rules:

- The Builder writes a draft of the game code.
- The Critic immediately inspects the draft. If the Critic finds ANY of the following, the Critic must flag it as an immediate "GAUNTLET FAILURE" and send the Builder back to Step 1:
  - No simple audio tracks, the music is engaging complex and interesting.
  - Fewer than 33 fully populated level design arrays.
  - Repetitive, generic level design layouts.
  - Corner-clipping ball-collision bugs.
  - Uninteresting or simplistic static graphics. LucasArts graphics were engaging.
- The loop continues until the Critic is "utterly wowed" and certifies the code as 100% complete, flawless, and production-ready.

---

## 🎵 THE BUILD SPECIFICATIONS

### 1. High-Fidelity AdLib FM Synthesizer & Music Engine (CRITICAL)

You must implement a robust, customized Web Audio API synthesizer running a multi-channel scheduler. It must NOT use simple beep sounds; instead, it must build a simulated OPL2 synthesizer with:

- FM Lead/Melody: A carrier/modulator pair (using GainNode modulation of an oscillator's frequency) to create a biting metal brass or hollow woodwind sound.
- Bass: A fat triangle wave with a fast-decaying low-pass filter to simulate a punchy bass synth.
- Percussion/Noise: A synthesized noise buffer or band-pass filtered white noise burst for snappy retro snare/hi-hat hits.
- The Sequencer/Tracker: Create a precise, state-driven step-sequencer (running on a fast clock loop, e.g., 120-140 BPM, utilizing Web Audio scheduling timestamps to avoid browser drift).
- Soundtrack Variety (Each level style has its own unique procedurally generated soundtrack!): Hardcode distinct musical compositions (separate note, pitch, velocity, and duration arrays):
  - Levels 1–6 (The Monkey Island Theme): Caribbean-style reggae groove featuring a metallic steel-pan FM lead, a walking bassline, and upbeat off-beat percussion.
  - Levels 7–12 (The Purple Tentacle March): Quirky, chromatic, and mischievous march with a fast-modulating square wave lead and dramatic descending bass stabs.
  - Levels 13–18 (The Atlantis Crypt): Slow, mysterious ambient soundscape featuring a sweeping, echoing pad, low frequency bass hums, and a random, haunting pentatonic chime melody.
  - Levels 19–24 (Space Combat Flight): Fast-paced, driving 16th-note bassline with a high-energy, soaring futuristic lead synth and rapid snare drums to capture high-stakes space action.
  - Levels 25–30 (The Loom of Fate): Complex, four-voice classical counterpoint piece where the synth voices weave melodies together to form complex chords.
  - Levels 31–32 (The Road to Sam & Max): Swing-jazz, walking bass blues line with a highly expressive, pitch-bending "synth saxophone" lead.
  - Level 33 (LeChuck's Battle Anthem): Bombastic, rapid-fire heavy metal style track with highly distorted carrier-modulated guitar leads, double-time drums, and an aggressive, dark minor-scale bassline.

### 2. Visual & Graphics Specifications (EGA Style)

- Resolution: Render on a `<canvas>` element utilizing a strict, low-resolution virtual viewport of 320x200 pixels (the exact golden-era LucasArts resolution). Scale this canvas responsively in the browser preserving crisp, pixel-art scaling (`image-rendering: pixelated`).
- Color Palette: Use the classic 64-color EGA palette registers. Create highly vibrant, high-contrast retro themes for paddles, balls, power-ups, and bricks using these exact hexadecimal color mappings.
- Backgrounds: Draw subtle, parallax pixelated background details like a stylized night sky over Mêlée Island, a dusty Mayan temple vault, or a futuristic alien cavern.

### 3. Controls

- Mouse: Paddle tracks horizontal mouse coordinates smoothly.
- Keyboard: Arrow keys / `A` and `D` keys for movement, and `Spacebar` to launch the ball or fire lasers.
- A developer shortcut to switch to the next level for testing

### 4. LucasArts-Inspired Level Design (33 Levels)

Design exactly 33 unique levels represented as hardcoded coordinate arrays/matrices. Rather than generic rows of bricks, every level must be a distinct pixel-art mosaic of classic LucasArts imagery, featuring custom mechanics matching the themes above (insult sword fighting, time travel, ancient traps, gravity wells, loom musical spell-weaving, and the LeChuck moving boss battle with projectile dodging).

### 5. Game Mechanics & Power-ups

- Brick Types: Normal bricks (1 hit), Armored bricks (multi-hit with visual cracking), Indestructible steel bricks, and Grog Bricks (Explosive 3x3 chain reaction).
- Power-ups: Spawning randomly upon brick destruction, falling slowly down as classic icons:
  - L (Laser): Attaches space-ranger blasters to shoot bricks.
  - E (Expand): Widens the paddle (styled as a rubber chicken).
  - C (Catch): Magnetizes the ball (styled as a magnetic compass).
  - S (Slow): Decelerates ball speed (styled as a tiny hourglass).
  - P (Player): Grants an extra life (styled as a pixelated gold guy logo).

---

## 📋 OUTPUT RULES FOR THE CRITIC & BUILDER

When writing your final response, you MUST structure it as follows:

1. **🛠️ The Gauntlet Logs:** List each run through the Gauntlet Loop (e.g., "Run 1: Rejected because Level 15-33 arrays were missing", "Run 2: Rejected because OPL2 music sequencer had a timing drift bug", "Run 3: Approved").
2. **🏆 The Golden Master Build:** The final, flawless single-file HTML. Every single line of code, matrix element, and synth coefficient must be present. Absolutely no placeholder comments or shortened arrays are allowed.
