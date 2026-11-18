You are a master 1990 LucasArts EGA Pixel Artist (lead background & sprite artist on *The Secret of Monkey Island* and *Loom*), an expert C++/JavaScript Game Engine Architect, and an AdLib OPL2 Chiptune Composer.

Your task is to write a complete, single-file retro Arkanoid clone (`index.html`) inside this directory. Everything—HTML, CSS, JS, procedural pixel art, 33 levels, and Web Audio OPL2 FM synthesis—must live in this single self-contained file with zero external assets.

---

### 🎨 Visual Art Bible & Concrete Quality Exemplars (READ CAREFULLY)

Your #1 visual rule: **every pixel on the `320x200` EGA canvas must look hand-crafted by a 1990 LucasArts artist—NEVER placeholder `fillRect` boxes.** Follow these concrete implementation patterns and exemplars:

#### Exemplar 1 — 64-Color EGA Shading & 4x4 Bayer Ordered Dithering
Never paint large flat rectangles for skies, water, HUD panels, or stone walls. Use the exact 64-color IBM EGA palette (`EGA[0..63]`), a 6-bit RGB shade stepper `egaShade(reg, ±1)`, and 4x4 Bayer ordered dithering baked into **offscreen `<canvas>` parallax layers** (`far`, `mid`, `near` per world):
```js
const BAYER4 = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
function dither(g, x, y, w, h, regA, regB, level) { // level: 0..16
  g.fillStyle = EGA[regA]; g.fillRect(x|0, y|0, w|0, h|0);
  if (level <= 0) return;
  g.fillStyle = EGA[regB];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (BAYER4[((y + j) & 3) * 4 + ((x + i) & 3)] < level) g.fillRect(x + i, y + j, 1, 1);
}
```
Use scanline math (`Math.sqrt(r*r - dy*dy)`) for circular dithered moons/planets, pixel-stepped triangles/ridges for islands and crooked Victorian mansion roofs, twinkling 4-shade starfields, glowing windows, and water reflections.

#### Exemplar 2 — Multi-Tone Outlined ASCII Sprite Grids (`makeSprite`)
NEVER draw capsules, paddles, balls, hazards, or LeChuck out of 4–8 `fillRect` bars. Compile every sprite from an explicit **2D ASCII ink grid** (`'.'` = transparent, `'k'` = 1px black silhouette outline, plus highlight/midtone/shadow EGA registers) into cached offscreen canvases:
```js
// Example quality bar: 12x10 shaded skull/icon with 1px black outline ('k'), specular ('W'), mid ('w'), shadow ('s'), eye ('R')
const VOODOO_SKULL = makeSprite([
  "...kkkkkk...",
  "..kWWwwwwk..",
  ".kWwwwwwwwk.",
  ".kwkRRwwkRwk",
  ".kwkRRwwkRwk",
  ".kwwwwsswwwk",
  "..kwwksskwwk",
  "..kskwkakwsk",
  "...kkkkkkkk.",
  "....k.kk.k.."
]);
```
Apply this exact multi-tone + `1px` dark-outline craft to:
- **`18x9` Beveled Power-Up Capsules** (`L`, `E`, `C`, `S`, `P`): rounded 3-tone pill body with letter on the left and a dedicated `7x7` pixel-art icon (blaster, rubber chicken with pulley, compass, hourglass, Gold Guy) on the right.
- **Paddle & Ball:** `5x5` specular-shaded sphere ball (plus golden cutlass sprite during insult-duel pierce mode), and a sculpted Vaus paddle with full pixel-art variants for the Rubber Chicken with pulley (`E`), Space-Ranger twin blasters (`L`), and Compass needle (`C`).
- **Animated Ghost Pirate LeChuck Boss (`>= 36x28` pixels, Level 33):** Detailed pixel-art boss sprite with feathered tricorne hat, skull brow, glowing red eyes, and 3-frame flickering ghost-fire beard + voodoo skull projectiles.

#### Exemplar 3 — High-Density `28–30` Column × `16–18` Row (`8x6` Brick) Mosaics
Do NOT use wide 16-column bars. Inside a **`256x200` left playfield** (`8px` riveted 3-tone metallic border pipes on left/top/right, leaving `240px` inner width = `30` columns × `8px`), represent all **33 LucasArts levels** using **`8x6` beveled pixel bricks** with at least **18 distinct EGA color characters** (`a-z` normal, `A-Z` multi-hit cracking armor, `#` dithered riveted steel, `*` animated bubbling Grog, plus mechanic bricks) so every stage reads immediately as shaded pixel art (e.g., Jolly Roger skull with shaded bone sockets, foaming Grog mug with handle, Three-Headed Monkey, Purple Tentacle with suction cups, Chron-o-John booth, Atlantean sun-disc/idol, X-Wing/TIE fighter, Loom swan & distaff, Max's lagomorph grin, LeChuck's galleon).

#### Layout, Typography & Mandatory Visual Self-Audit
- **Split Screen (`320x200` integer-scaled):** `256x200` framed playfield + `64x200` Bayer-dithered right-hand HUD sidebar (`x = 256..319`: logo, 7-digit score/hi-score, stage `XX/33`, mini-paddle lives, active world mechanic UI/meter, active capsule icons, scrolling song marquee).
- **Live Attract Menu & `5x7` Outlined Font:** Pre-render a full ASCII **`5x7` proportional bitmap font** with `1px` 8-neighbor black outlines and `2x`/`3x` integer scaling. Draw the Title Screen directly *over* the live backdrop + mosaic of the selected level (`Left`/`Right` previews levels `1–33`).
- **Pre-Completion Visual Self-Audit (Verify before finishing):**
  1. Zero browser vector fonts or `.5` anti-aliased `strokeRect` calls on the `320x200` canvas.
  2. Every world backdrop has >=3 pre-rendered parallax layers using Bayer dithering and non-rectangular silhouettes.
  3. All 33 level maps use `24–30` columns of `8x6` bricks and >=3 colors per mosaic with unmistakable LucasArts silhouettes.
  4. Screen-shake, EGA scanline stipple flash, debris particles, and outlined floating score popups (`+150`) work on Grog explosions and combos.

---

### 🎵 High-Fidelity AdLib FM Synthesizer & Music Engine (CRITICAL)

Build a Web Audio API **simulated OPL2 FM synthesizer** with lookahead scheduling (120–140 BPM) and dedicated non-clipping lo-fi SFX channels:
1. **Instruments:** Carrier/modulator `GainNode` FM Leads, fast-decay low-pass triangle Bass, and filtered white-noise Percussion.
2. **7 Distinct Compositions:**
   - *Levels 1–6 (Monkey Island):* Syncopated Caribbean reggae groove, steel-pan FM lead, walking bass.
   - *Levels 7–12 (Purple Tentacle March):* Quirky chromatic B-movie monster march with descending bass stabs.
   - *Levels 13–18 (Atlantis Crypt):* Sweeping echoing pad, low bass hums, haunting pentatonic chimes.
   - *Levels 19–24 (Space Combat):* Driving 16th-note bassline, soaring futuristic lead, rapid snare drums.
   - *Levels 25–30 (Loom of Fate):* Four-voice classical counterpoint weaving complex chords.
   - *Levels 31–32 (Sam & Max):* Swing-jazz walking bass blues with pitch-bending FM saxophone lead.
   - *Level 33 (LeChuck's Battle Anthem):* Bombastic double-time heavy metal with distorted FM guitar leads.

---

### 🕹️ Gameplay Mechanics, Controls & Architecture

- **7 World Mechanics:** Insult sword-fighting duels (World 1), Chron-o-John time-era phasing (World 2), dart-spitting Atlantean traps (World 3), orbital gravity wells (World 4), Loom musical draft weaving (World 5), Sam & Max moving road walls (World 6), and LeChuck's moving boss battle with voodoo fireballs (Level 33).
- **Power-ups & Bricks:** `L` (Laser), `E` (Expand rubber chicken), `C` (Catch compass), `S` (Slow hourglass), `P` (Extra life Gold Guy); Normal, Armored (cracking), Steel, and 3x3 recursive Grog bricks.
- **Controls & Robustness:** Mouse + `A`/`D`/`Arrows`, `Space`/Click launch & fire, `P` pause, `M` mute, arcade cabinet CSS bezel with scanline toggle, `localStorage` high score, corner-safe sub-stepped circle-vs-AABB physics, and zero `TODO`s or placeholders.
