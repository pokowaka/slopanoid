# XENON II — MEGABLAST: EVOLUTION & TRACKER ODYSSEY

A retro vertical shoot-'em-up inspired by The Bitmap Brothers' *Xenon 2: Megablast* (1989),
written as **one self-contained, dependency-free `index.html`** (vanilla JavaScript, HTML and CSS).
No build step, no assets, no network: every sprite, cavern, palette, sample and note is
synthesised procedurally at start-up.

```
open index.html          # double-click it, or drag it into any modern desktop browser
```

Click the screen (or press any key) once to "insert the disk" — browsers only allow audio to
start after a user gesture.

---

## 1. Controls

| Input | Action |
|---|---|
| **Mouse** *or* **WASD / Arrow keys** | Fly the Megablaster (smooth 60 FPS; the ship chases the pointer, keys take over as soon as you press one) |
| **Space / Z / Left-click** (hold) | Fire every equipped hardpoint |
| **Down / S** while the ship is at the bottom edge (or pointer on the bottom rows) | **Reverse Scroll Thrust** — backs the camera up, up to ~1.5 screens, to escape dead-end caverns |
| **Shift / R / Right-click** (hold) | **Chrono-Reverse** — rewinds camera, ship, enemies, bullets, pickups, particles and destroyed walls up to 3 seconds |
| **Q** | Smart Bomb (falls back to Nashwan if you have no bombs) |
| **X** | Super Nashwan Overdrive (falls back to a Smart Bomb) |
| **B** | Dock at Crispin's Upgrade Store at any time (also the *SHOP DOCK* cabinet button) |
| **T** | 8-channel Tracker Jukebox modal (also the *TRACKER VIEW* cabinet button) |
| **1 – 5** | Epoch warp. Pressing the number of the epoch you are already in skips ahead: start → mid-point → boss approach |
| **P / M / C / H** | Pause / mute / toggle CRT scanline bezel / help overlay |
| **G**, **I** | Tester keys: +5000 credits, toggle invincibility |

**Shop:** Left/Right (A/D) pick a hardpoint, Up/Down (W/S) pick an item, Enter/Space/Z buy,
X/Delete sell the fitted item for 50 %, B/Esc leave. Everything is also clickable.

**Tracker modal:** `1-8` mute a channel, `Shift+1-8` solo, Left/Right jump between patterns in the
order list, Up/Down change era song, `L` loop the current pattern, click the order chips / `M` / `S`
buttons, `T` or `Esc` to close. The game pauses, the music keeps playing.

---

## 2. The game

The Xenites have planted temporal bombs across five epochs of evolutionary history. Each epoch is a
long, procedurally generated (fixed seed, so always the same) cavern with a mid-point shop, an
end-of-stage boss guarding the bomb, and a second shop afterwards.

| # | Epoch | Walls / hazards | Creatures | Boss (weak spot) |
|---|---|---|---|---|
| 1 | **Cambrian Trilobite Reef** — 520,000,000 BC | brain-coral rock with buried chrome conduits, destructible pink tube-coral bottlenecks, crinoid wall turrets | armoured trilobites, spinning ammonites, anomalocarid larvae | **Leviathan Anomalocaris** (eye-stalks) — spine fans, grasping claws, trilobite broods |
| 2 | **Abyssal Nautiloid Trench** — 400,000,000 BC | basalt columns with bioluminescent seams, sulphur chimneys, thermal-vent geysers, chain-reacting minefields | charging nautiloids, jellyfish, squid, anglerfish | **Kraken-Nautilus** (the big eye) — tentacle slams, bullet spirals, ink clouds |
| 3 | **Babbage Clockwork Foundry** — 1837 AD | riveted brass gear-walls, piston corridors, giant cogs, arc-lightning turrets and lightning gates | cog-drones, clockwork ornithopters | **Difference Engine Automaton** (furnace door, open while it calculates) — it rolls five digits and fires that many shots per column, bouncing gears, piston fists, tesla sweep |
| 4 | **1989 Demoscene Silicon Wafer** — 1989 AD | golden PCB circuit mazes, solder blobs, copper-bar vector grid, capacitor turrets | blitter-bob swarms, wireframe vector cubes, DIP-chip bugs, boing balls, a sine-scroller made of letters | **68000 Cyber-Blitter** (die window, when the shutter is up) — bob streams, copper-bar walls with a moving gap, Guru Meditation |
| 5 | **Biomechanical Xenite Hive** — the end of time | chrome ribcages over wet flesh, spore-spawning wall pods, laser gates | xenite drones, face-huggers, vertebra worms, spores | **Sovereign Xenite Mother-Brain** (the eye) — three phases, rib lasers, spores, temporal bombs on a countdown |

Rules worth knowing:

* **Walls never hurt.** They block you, and the auto-scroll can push you down the screen. If you get
  pinned at the bottom the scroll halts — slide sideways, shoot through, or reverse-thrust out.
* **Destructible walls** (pink coral, sulphur, copper crates, solder blobs, spore sacs) can be shot
  away; ones with gold flecks hide a cash bubble. Some forks are dead ends with a stash of bubbles —
  that is what Reverse Thrust is for.
* **Cash Bubbles** are dropped when you destroy an *entire* wave (nothing may escape), by turrets and
  big creatures, and in a shower by bosses. Later epochs pay more.
* **Shield** is your health bar; **Chrono-Energy** powers the rewind (a full bar is exactly three
  seconds) and recharges slowly or from blue crystals.
* When your shield hits zero the ship breaks up over ~1.5 seconds. **You can still hold Chrono-Reverse
  during that time to un-die.**

### Chrono-Reverse internals
Every simulated frame the complete world state is pushed into a 180-entry snapshot buffer (3 s at
60 FPS): camera scroll, RNG seed, spawn cursors, the player, every enemy/boss, both bullet lists,
pickups, effects and the particle array (a `Float32Array` that is simply copied). Destroyed wall
tiles are journaled with a frame stamp and un-destroyed while rewinding. Holding the rewind pops one
snapshot per frame, drains Chrono-Energy, tints the palette, adds VHS tracking jitter — and makes
the tracker play its rows **backwards** (watch it in the `T` view).

---

## 3. Crispin's Intergalactic Upgrade Store

Crispin the alien pawnbroker (reflective shades that mirror the live spectrum, headphones that bob
to the beat of the tracker, a jaw that flaps while his dialogue types out) sells from a
**six-slot hardpoint paper-doll** that shows the real ship sprite with everything bolted on.

| Slot | Items (price) |
|---|---|
| NOSE | Twin Vulcan (800) · Plasma Spread (2400) · Electro-Arc Beam (4000) |
| LEFT WING / RIGHT WING (independent) | Side-Laser Pod (1200) · Homing Missile Rack (1800) · Bounce-Orb Launcher (1500) |
| REAR TAIL | Rear Tail Cannon (900) · Temporal Proximity Mines (1600) |
| ORBITAL DRONES | Dual Orbiting Drones (2600) · Quad Drone Halo (4600) |
| HULL / ENGINE | Hull Plating (2000) · Chrono-Capacitor (2400) |
| SUPPLIES & INTEL | Shield Repair (400) · Speed Booster ×3 (700) · Smart Bomb (600) · Boss Weakness Intel (500) · **Super Nashwan Power** (5000) · Extra Life (3500) |

* **50 % trade-in:** sell any fitted hardpoint back for half its price, or just buy a replacement and
  the trade-in is deducted automatically.
* **Boss Weakness Intel** marks the current boss's weak spot with a reticle and raises weak-spot
  damage from ×2 to ×3.
* **Super Nashwan Power** is 20 seconds of every weapon at once, four drones, all three synergies and
  maximum thrusters.
* Every purchase is drawn on the ship in play: nose cannon, left pod, right pod, tail gun, orbiting
  electro-drones, armour plating / capacitor coil, and extra engine nozzles with longer flames.

### Golden synergy perks (activate automatically)
1. **RICOCHET PRISM MATRIX** — Side-Laser Pod + Bounce-Orb Launcher (one on each wing). Lasers reflect
   off cavern walls, and a laser that crosses one of your bounce-orbs splits into three prism beams.
2. **CHRONO BACKFIRE NOVA** — Temporal Proximity Mines + Reverse/Chrono thrust. Backing up, or
   releasing a rewind, throws out a ring of temporal plasma mines (12 instead of 8 with the
   Chrono-Capacitor).
3. **TESLA CHAIN SWARM** — Electro-Arc Beam + any drones. Lightning chains from each drone through up
   to four nearby enemies while you fire.

---

## 4. The tracker soundtrack (`audio.js`, inlined)

The first `<script id="audio-js">` block is the music engine; it exposes one global, `XAudio`.
It is a real pattern sequencer in the Amiga MOD / XM mould — 64-row patterns, an order list,
per-row effect commands — driving Web Audio synth voices instead of samples. A look-ahead scheduler
queues rows ~150 ms ahead on the audio clock, so timing does not depend on the frame rate.

**Arrangement.** Every song has eight patterns:
`00 INTRO → 01 PRECINCT 13 MAIN GROOVE → 02 TB-303 ACID BREAKDOWN → 03 BRASS & SCRATCH DROP → 04 BRIDGE`,
`05 BOSS RAVE`, and `06/07 ELECTRO-DUB SHOP GROOVE A/B`. Three order lists chain them:
main `00 01 01 02 01 03 04 01 03 02` (loops back to the second entry), boss `05`, shop `06 07`.

**Channels**

| CH | Voice | How it is made |
|---|---|---|
| 1 | Carpenter-style ostinato bass | saw + square + sine sub through a plucked low-pass; or a 2-operator FM bass |
| 2 | TB-303 acid line | persistent mono synth → `BiquadFilterNode` low-pass at high Q → drive → VCA; accents, slides (`3xx`), and a cut-off envelope whose base is automated by `Zxx` |
| 3 | Soaring lead | detuned saws, delayed vibrato, portamento, into a stereo ping-pong `DelayNode` feedback loop |
| 4 | PWM chords / orchestra hits / brass | PWM = a saw minus a delayed copy whose delay time is swept by an LFO; stacked-saw orchestra hit with pitch scoop |
| 5 | Turntable scratch + formant vocals | a small Klatt-style formant synthesiser renders "MEGA-BLAST!" and "YEAH!" once; scratches bend that "record" via `playbackRate` |
| 6 | 909 / 808 kick + sub-drop | pitch-swept sine through a soft clipper |
| 7 | Snare, ghost notes, gated-reverb clap | filtered noise + tone; the clap feeds a gated `ConvolverNode` |
| 8 | Hats + 808 cowbell | six-square "metal" source through band-pass; two detuned squares for the bell |

Effects implemented: `0xy` arpeggio, `1xx/2xx` portamento, `3xx` slide, `4xy` vibrato, `9xx` sample
offset, `Axy` volume slide, `Cxx` volume/accent, `E9x` retrigger, `ECx` cut, `Zxx` filter cut-off.

**Era variations.** The song is written once in E minor and re-voiced per epoch (key, tempo, swing,
instrument map, drum kit, patch): I Cambrian tribal (116 BPM, congas), II Abyssal dub (108 BPM, FM
bass, sonar lead, 808 kick), III Babbage clockwork (120 BPM, swung, tick-tock rims, anvils,
arpeggiated harpsichord), IV Demoscene '89 (125 BPM, chip lead, `0xy` chord arpeggios), V Xenite
hive rave (130 BPM, square 303, hoovers, four-on-the-floor).

**Dynamic mixing.** Docking at the shop switches to the shop order list on the next row *without
resetting the row counter* (the beat never drops), eases the tempo down and sweeps a master
low-pass "dub" filter shut and partly open again. Bosses switch to the Boss Rave pattern at +10 BPM.
Rewinding reverses the row direction.

**Visualisers.** One `AnalyserNode` feeds the spectrum analyser and oscilloscope in the cabinet
side panels (and Crispin's sunglasses). The `T` modal is a live pattern viewer —
`Row 00..3F | Note | Inst | Effect` for all eight channels, with VU meters, mute/solo and pattern jump.

---

## 5. Graphics engine

* Everything is drawn into a 320×200 **8-bit indexed framebuffer** and converted through a 256-colour
  palette into a `Uint32Array` view of the canvas `ImageData` each frame — i.e. VGA Mode 13h.
  Palette layout: 16 system colours, nine fixed 16-step ramps (steel, gold, copper, blue, green,
  purple, fire, teal, flesh), five per-stage ramps, and a 16-entry colour-cycling range.
* Palette effects are real palette effects: fades, hit flashes, the blue Chrono tint, the gold
  Nashwan tint and colour cycling. Additive glows use a precomputed 256×256 lookup table.
* Sprites are not drawn by hand: a small **height-field modeller** (ellipsoids, capsules, bevelled
  boxes/polygons, gears, spirals) is lit per pixel with diffuse + specular + a chrome horizon
  environment term, then quantised into a ramp with 4×4 Bayer dithering — that is where the
  metallic sheen comes from.
* Cavern walls are a per-pixel shader over the tile grid: the solidity field is bilinearly smoothed
  and noise-perturbed so edges are organic, bevelled from its gradient, and textured per epoch.
  Rows are rendered lazily and re-rendered locally when a tile is damaged.
* Three parallax layers (far texture ×0.25, mid silhouettes ×0.5, walls ×1) plus foreground ambient
  particles; the CRT bezel (scanlines, vignette, glass highlight) is a CSS overlay toggled with `C`.
* Fixed 60 Hz simulation step, decoupled from the display refresh rate.

---

## 6. Files

| File | Purpose |
|---|---|
| `index.html` | The whole game. `<script id="audio-js">` is the tracker (`audio.js`), `<script id="game-js">` is everything else, split by banner comments (core, pixel shader, sprites, levels, combat, enemies, bosses, world, shop, UI, tracker view, main). |
| `README.md` | This document. |
| `PROMPT.md` | The original specification. |

The specification names `audio.js` as a file; because the game had to be a single self-contained
HTML file it is inlined as its own script block rather than shipped separately.

Saved in `localStorage`: hi-score and the CRT toggle. Nothing else is stored or sent anywhere.

## 7. Notes and limitations

* Desktop browsers with a keyboard and/or mouse; there are no touch controls.
* Tested headlessly: the shipped scripts were syntax-checked with `node --check` and the full game
  loop (all five epochs, bosses, shop, rewind, tracker) was driven in Node against strict DOM and
  Web Audio mocks, with framebuffer screenshots inspected. **It has not been play-tested by ear or
  in a real browser by its author**, so sound balance and difficulty tuning are best guesses.
* The synthesised vocals are deliberately crunchy robot speech — closer to a speech chip than to a
  sampled voice.
* Display scale is an integer multiple of 320×200 when 3× or more fits the window, otherwise
  half-steps (2.5×, 2×, 1.5×) are allowed.
