# Ghosts 'n Goblins — The Cursed PC Gaming Museum

A retro arcade action-platformer in the spirit of *Ghosts 'n Goblins* / *Ghouls 'n Ghosts*,
written in dependency-free vanilla JavaScript, HTML and CSS. No build step, no assets, no network:
every sprite, tile, backdrop, song and sound effect is generated in code.

## Play

Open `index.html` in a desktop browser (Chrome, Firefox, Safari). It also runs from any static
file server.

| Action | Keys / mouse |
|---|---|
| Move | `A` `D` or `←` `→` |
| Aim up · crouch · climb ladders | `W` `S` or `↑` `↓` |
| Jump (double-jump in boxer shorts) | `Space` or `Z` |
| Throw weapon | `J`, `X` or left click |
| Eject armour · possess monster · golden magic | `E`, `C` or right click |
| Drop through a ledge | `↓` + jump |
| Start / confirm · pause | `Enter` · `P` or `Esc` |
| CRT filter · mute | `T` (or `F2`) · `M` |
| Stage warp | *Stage Warp* in the menu, or keys `1`–`6` on the title screen |

## The twists

- **Steel armour** is heavy: immune to wind, smashes cracked floors on landing, empowers weapons.
- **`E` ejects the armour.** The empty suit drops like an anvil (crushing what is below), holds
  pressure plates down, baits monsters and works as a springboard. Crouch on it to suit up again.
- **Boxer shorts** (strawberry print): 35 % faster, double jump, and *spectral vision* that
  reveals ghost platforms and secret chests. One more hit is fatal.
- **Possession:** in boxers, `E` hurls Arthur's soul into the nearest non-boss monster for
  8 seconds — fly as a Red Arremer, burrow and spit acid as a zombie, hurl bones as a skeleton…
- **Chests** return the knight's armour; a hidden **Magician chest** grants **golden armour**:
  hold `E` to charge a screen-clearing spell.
- Five swap-on-pickup weapons: lance, dagger, holy-water torch, battle axe, boomerang cross.

## Stages

1. LeChuck's Ghost Ship & Mêlée Graveyard (*Monkey Island*) — Three-Headed Monkey
2. The Haunted Moat of Daventry (*King's Quest*) — Dragon of Daventry
3. The Jaffar Spike Catacombs (*Prince of Persia*) — The Shadow Vizier
4. The Lemmings Crusher Foundry (*Lemmings*) — Mega-Blocker
5. Phobos E1M1 Necropolis (*DOOM*) — Red Arremer King
6. Throne of Astaroth-LeChuck-9000 — the three-phase final boss and the Cursed Floppy Disk

## Under the hood

| File | Role |
|---|---|
| `js/engine.js` | 320×200 8-bit indexed software framebuffer, 256-colour palette + palette FX, bitmap/sprite toolkit, bitmap font, input, fixed 60 Hz loop |
| `js/art_*.js`, `js/tiles_*.js`, `js/backdrops_*.js` | procedural pixel art: sprites, per-stage tilesets and props, 3-layer parallax backdrops, world map, title |
| `js/world.js` | level parsing, tile physics, particles, liquids, weather and lightning |
| `js/stage.js` | the live stage: actors, collisions, camera, boss arenas, layered renderer |
| `js/player.js`, `js/enemies.js`, `js/bosses.js`, `js/objects.js` | Arthur, the bestiary and its AI, bosses, weapons, pickups, mechanisms |
| `js/levels.js` | the six stages as ASCII screens |
| `js/audio.js` | Web Audio FM/PSG synthesizer, procedural baroque themes, sound effects |
| `js/game.js` | title, stage warp, world map, HUD, game over, ending, boot |
| `style.css` | the museum hall and the toggleable CRT monitor bezel |

The only thing stored on the machine is the high score (`localStorage`).
