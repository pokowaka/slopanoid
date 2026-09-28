# GHOSTS 'N GOBLINS · *The Cursed PC Gaming Museum*

A run-and-gun arcade platformer inspired by Capcom's **Ghosts 'n Goblins** (1985).
It is written in **pure, dependency-free vanilla JavaScript, HTML and CSS**: no build step, no libraries, no image files and no audio samples.
Every pixel is drawn into a 320×200 software framebuffer, and every note is synthesized live in Web Audio by a small FM/PSG synthesizer.

Sir Arthur's kingdom has been swallowed by a **cursed floppy disk**. Its six exhibits are haunted parodies of classic late-80s / early-90s PC games. Find the five floppy fragments, format the curse, and try to keep your trousers on.

> Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). It works directly from `file://`.
> Click or press a key to wake the audio (browsers need a user gesture), then press **Enter**.

---

## Controls

| Action | Keyboard | Mouse |
|---|---|---|
| Move | `A` / `D` or `←` / `→` | |
| Aim up / climb ladders | `W` / `↑` | |
| Crouch / climb down / drop through thin floors | `S` / `↓` | |
| Aim down (mid-air) | hold `S` / `↓` while firing in the air | |
| Jump (hold for higher; press again in boxers for a double jump) | `Space` / `Z` | |
| Throw weapon (hold to charge gold magic) | `J` / `X` | Left button |
| **Eject armor** / **possess** / cast charged gold magic | `E` / `C` | Right button |
| Re-don an ejected anvil | crouch (`S`) next to it for half a second | |
| Pause | `P` | **PAUSE** button |
| Stage warp (title, game over, ending) | `1`–`6` | **STAGE WARP** buttons |
| CRT bezel on/off | `V` | **CRT BEZEL** button |
| Sound on/off | `M` | **SOUND** button |
| Start / continue | `Enter` (fire or jump also work) | click |

---

## The twist: your armor is a tool, not a hit point

In the original game, armor is just your first hit. Here it is also your most versatile piece of equipment.

### Steel armor (default)

- **Heavy.** Arthur is slower (walk 1.3 px/frame) but **ignores wind gusts** on the Daventry moat bridges.
- He **presses pressure plates**, and a hard landing **cracks weakened floors** (marked tiles collapse in a chain).
- Weapons are **empowered**: every weapon deals ×1.5 damage, and the lance becomes a bigger, faster bolt.
- A hit **shatters** the armor into flying plates and leaves you in boxers. A second hit kills you (a pile of bones, as tradition demands).

### Ejecting armor: the anvil

Press `E` / right-click to **eject** your armor on purpose. It lands as a lump of iron (an **anvil**) that:
- **crushes** any enemy it falls on;
- **weighs down pressure plates** permanently. This is how you solve the **HEAVY ONLY** gates: a gate held by your own weight closes 1.5 s after you step off, and steel Arthur is too slow to reach it in time;
- is a **springboard**: land on it to bounce much higher than any normal jump. That's how you reach the high ledges in the boss arenas;
- **jams the pistons** of the Lemmings Crusher Engine (see the bosses below).

Lose the anvil in lava, acid or a pit and it's gone. Crouch beside it for half a second to put the armor back on.

### Strawberry boxers

Being naked is dangerous (one hit kills), but it has perks:
- **35% faster** and **double jump**.
- **Spectral vision**: translucent **ghost platforms** become solid and visible, and **hidden chests** appear in the scenery. Several optional routes and all golden chests are only reachable this way.
- **Possession**: press `E` near a non-boss monster to take over its body for **8 seconds** (a soul trail flies into it). Each form plays differently:

| Form | Special |
|---|---|
| Zombie | Burrow underground with `↓` (immune while buried). Fires an acid lob. Heavy enough for plates. |
| Skeleton / sword skeleton | Rapid bone volleys (hold fire). |
| Haunted Armor | Front shield blocks shots. Sword slash. Heavy. |
| Cyber-Imp | Huge jump and a straight fireball. |
| Red Arremer / gargoyle | Hold jump to fly. Fireballs (aim down in the air). |
| Lemming | Tiny and harmless... until you press fire: *OH NO!* It explodes and takes everything nearby with it. |

Press `E` again to leave the body early. Taking a hit while possessing only ejects your soul (no death).
**Opening a chest while possessing reclaims your armor** instantly.

### The Magician's chest: golden armor

The **Magician's chests** only rise out of the ground for a spectral Arthur in boxers. They contain **golden armor**, which works like steel (with ×2 weapon damage) and adds:
- **Hold fire** to charge (the HUD shows a bar). When it reads **CHARGED**, release fire or press `E` to cast a **screen-clearing lightning spell**. It strikes every enemy on screen (bosses take a heavy chunk) and erases every enemy shot.
- Ejecting golden armor makes a golden anvil.

### Chests

Treasure chests rise out of the ground when you get close. Some are **hidden** and only rise for a spectral Arthur in boxers.
- Shoot or touch a chest to open it.
- In boxers, a chest restores your steel armor.
- Otherwise a chest drops a new weapon, a treasure bag or a gem.

Some pressure plates drop a **potion**, which also restores armor. Extra lives are awarded at 20,000 and 70,000 points, then every 100,000.

---

## Weapons

You carry one weapon at a time. Picking one up replaces it; enemies sometimes drop them.

| Weapon | Behaviour |
|---|---|
| **Lance** | Fast and straight. Two on screen at once. Empowered: bigger and harder-hitting. |
| **Dagger** | The fastest thrower. Three on screen at once. Weaker. |
| **Holy-water torch** | An arcing flask that bursts into a ground fire. The fire burns enemies over time. |
| **Battle axe** | A heavy arc. It pierces through enemies and sails through walls while rising. |
| **Boomerang cross** | Flies out and homes back to you. It **destroys enemy projectiles** on contact. One on screen at once. |

Aim up with `W` and throw straight down during a jump with `S`. Shooting straight up is how you hit airborne bosses such as the Ghost Captain and the 9000 Core.

---

## The six exhibits

Each stage starts on a **parchment world map**, where Arthur walks from island to island to the next exhibit. Every stage has **checkpoint flags**, a **4:00 timer**, and a boss arena that locks the camera.

| # | Exhibit (parody of) | Hazards | Boss |
|---|---|---|---|
| 1 | **LeChuck's Ghost Ship & the Mélée Island Graveyard** (*Monkey Island*, 1990) | Rising zombies, pirate skeletons, a **rocking ship deck** where the whole hull sways, cannons, rolling barrels | **Ghost Pirate LeChuck**: a spectral captain whose giant hands slam the deck (they spray ghost-fire when he's angry). Aim up to hit his face. |
| 2 | **The Haunted Moat of Castle Daventry** (*King's Quest*, 1984) | Moat eels, stone gargoyles, **wind gusts** (steel ignores them), crumbling bridges, a **HEAVY ONLY** plate gate | **The Moat Dragon**: a serpent whose segmented neck rises from the moat, spits fire spreads and dives to resurface elsewhere. |
| 3 | **The Jaffar Spike Catacombs** (*Prince of Persia*, 1989) | Spike pits, **slicer traps**, cracked floors, sword-skeleton guards, loose ledges, plate-triggered potions and gates | **Grand Vizier Jaffar**: teleports, casts ghost-fire and ground waves, and summons sword skeletons. |
| 4 | **The Lemmings Crusher Foundry** (*Lemmings*, 1991) | Hydraulic **crushers**, conveyor belts, molten metal, lemmings with umbrellas pouring out of trapdoors, and **blockers** that count down *OH NO!* and explode | **The 10-Ton Crusher Engine**: shoot the furnace door while it's open. Better still, park your anvil under a piston: the piston **jams** for massive damage and flings the anvil away. |
| 5 | **Phobos E1M1 Necropolis** (*DOOM*, 1993) | **Nukage** (bounces and hurts armored Arthur, instantly lethal in boxers), exploding barrels, cyber-imps, ghost-platform bridges, Arremers | **The Arremer Ace**: the dreaded Red Arremer, bigger, faster and fond of dodging your shots. Swoops, hovers and fires spreads. |
| 6 | **Throne of Astaroth-LeChuck-9000** (the cursed floppy itself) | Lava, everything at once | **Astaroth-LeChuck-9000**, in three phases: **Astaroth** (belly beam, fist shockwaves, fire spit; jump-shoot the belly) → **LeChuck** (flaming head, homing voodoo skulls, dive attacks: *"You fight like a dairy farmer!"*) → **The 9000 Core** (a red eye sweeping a laser and throwing floppy boomerangs; shoot up while the eye is lit). |

Each boss drops a **floppy fragment**. The stage-clear screen tallies your time bonus and the fragments collected.

### The Loop

Defeat the final boss once and a voice echoes from the drive: *"This room is an illusion and is a trap devised by Astaroth..."* You are sent back to Stage 1 for **Loop 2**, where the monsters are about 30% tougher.
Only then does the true ending play: the floppy is formatted, and Arthur puts his pants back on.

**Game over** offers a 10-second continue (your score resets). High scores are saved in `localStorage`.

---

## The soundtrack: a YM2151 / OPL-flavoured synth in Web Audio (`audio.js`)

There are no samples. Every sound comes from `OscillatorNode`s, `GainNode` envelopes and a procedural noise buffer.

### Instruments

| Voice | Synthesis |
|---|---|
| **Harpsichord** | 2-operator FM with a fast-decaying modulation index, so each note has a plucked-quill attack. |
| **Pipe organ** | Additive stops (16′, 8′, 4′, 2′) on a shared bus with a rotating-speaker tremolo LFO. |
| **Bass** | FM slap bass. |
| **Lead** | PSG-style square wave with delayed vibrato. |
| **Drums** | Pitch-swept sine kick, noise snare and hats through band-pass filters. |

A procedurally generated impulse response adds a cathedral **reverb**, and a compressor glues the mix together.

### Generative baroque themes

Each stage theme is **composed at boot from a seed**, with its own tempo and feel:
- a scale and chord progression;
- a motif that gets sequenced and transposed.

The songs are the title theme, six stage themes, the boss theme and the ending, played by a look-ahead scheduler. Short cues play for the map, stage clear, game over and floppy pickup.

### Boxer mode

When Arthur loses his armor, the music **speeds up ×1.18** and the melody **jumps an octave**, live, without restarting the song. It drops back when he's armored again.

There are also 50+ synthesized SFX, including the armor shatter, the anvil clang, a possession whoosh, the lemming *OH NO!*, the evil laugh, piston slams and the thunder crack.

---

## Graphics engine (`gfx.js`)

- A 320×200 `Uint32Array` framebuffer blitted to a canvas each frame. The canvas is upscaled with `image-rendering: pixelated`.
- **Primitives:** rects, alpha and additive blends, lines, discs, ellipses, glows and polygons.
- **Sprite blitter:** flip; white-flash, alpha, silhouette and additive modes; rotation; horizontal wrap for the parallax layers.
- **Post-FX:** screen flash, fade, colour tint (lightning, boxers spectral tint) and screen shake.
- **Sprites** (`sprites.js`) are painted procedurally at boot, with automatic dark outlines. This includes:
  - multi-frame animations for Arthur in three outfits and every enemy (walk, throw, slash, jump, crouch);
  - multi-part bosses: ghost hands, a dragon neck of individual segments, pistons, the three-phase final boss.
- **Stages** (`stages.js`) use 16×16 procedural tiles per theme and a **3-layer parallax** (sky gradient with moon/stars, far silhouettes, mid scenery). On top of that come weather particles (rain, leaves, dust, sparks, embers, ash), **lightning strikes** that light up the scene, and animated decorations.
- **CRT bezel:** a CSS cabinet with scanlines, a vignette and curvature glow, toggled with `V`.

---

## Project layout

| File | Contents |
|---|---|
| `index.html` | Cabinet page: CRT bezel, museum placard, knight status panel, buttons |
| `style.css` | Cabinet, bezel, placard and panel styling |
| `gfx.js` | Framebuffer, primitives, sprite blitter, 5×7 bitmap font, post-FX |
| `sprites.js` | Procedural sprite painter (Arthur, enemies, bosses, items, effects) |
| `audio.js` | FM/PSG synthesizer, generative songs, sound effects |
| `stages.js` | Themes, tilesets, parallax layers, decorations, level-builder DSL and the six stage scripts |
| `entities.js` | Enemy, trap and boss behaviours, hitboxes and possession table |
| `game.js` | Main loop, input, physics, player/forms, weapons, items, plates/gates, stage flow, HUD and screens |
| `ui.js` | Side-panel wiring (placard, status, CRT/sound/pause/warp buttons) |

### Engine notes

- **Timing:** a fixed 60 Hz simulation step with an accumulator, decoupled from the display refresh rate. It catches up at most 5 steps per frame.
- **Collision:** tile-based. There are solid tiles, one-way platforms, ladders, ghost tiles (solid only for a spectral Arthur in boxers), liquids, spikes, crumbling and cracked floors, conveyors and gates.
- **Bosses and multi-part enemies** expose several hitboxes. *Weak* boxes take damage; *armoured* boxes deflect shots with a *tink*.
- **Scripts load as plain globals** (no ES modules), so the game runs from `file://` without a server.
- **Performance:** measured in headless Chrome, a full frame (simulation + render) averages about **1.1 ms**, with ~5 ms worst case, during the final boss fight.
