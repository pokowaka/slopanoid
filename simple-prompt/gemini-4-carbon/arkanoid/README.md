# SCUMM-ANOID: Chronicles of AdLib & EGA

A complete, zero-dependency, single-file retro Arkanoid tribute to golden-era LucasArts games (`index.html`), rendered on a crisp **320x200 64-color IBM EGA** virtual viewport and powered by a custom **Web Audio AdLib / Yamaha YM3812 (OPL2) FM Synthesizer**.

## How to Play Immediately

Open `index.html` directly in any modern browser (Chrome, Safari, Firefox, Edge) — no build step or web server required:

```bash
open /var/tmp/bench-gemini-4-carbon/arkanoid/index.html
```

Or serve locally if preferred:

```bash
python3 -m http.server 8080 -d /var/tmp/bench-gemini-4-carbon/arkanoid
# Then visit http://127.0.0.1:8080
```

## Controls

- **Mouse / Touch:** Move horizontally to steer the paddle; **Left-Click / Tap** to start, launch the ball, or fire Space-Ranger lasers.
- **Keyboard:**
  - `Left` / `Right` Arrows or `A` / `D`: Move paddle (or cycle stages `01–33` on the Main Menu)
  - `Space` / `Enter`: Start game, launch caught ball, fire lasers, or advance overlays
  - `[` and `]` (or `< LVL` / `LVL >` cabinet buttons): Jump between any of the **33 stages** and **7 AdLib soundtracks**
  - `P` / `Esc`: Pause / Resume
  - `M`: Toggle AdLib OPL2 Audio Mute
  - `V`: Toggle CRT Scanline Overlay

## Worlds, Soundtracks & Custom Mechanics (33 Stages)

1. **Levels 1–6 — *The Secret of Monkey Island*** (`Monkey Island Reggae` steel-pan FM lead + Insult Sword-Fighting cutlass parries)
2. **Levels 7–12 — *Day of the Tentacle*** (`Purple Tentacle March` vibrato monster-square FM + Chron-o-John twin time-warp portals)
3. **Levels 13–18 — *Indiana Jones and the Fate of Atlantis*** (`Atlantis Crypt` echoing pad & pentatonic chimes + ancient wall poison dart traps)
4. **Levels 19–24 — *Star Wars Space Combat*** (`Space Combat Flight` 16th-note driving bass & soaring synth + subspace gravity wells)
5. **Levels 25–30 — *LOOM*** (`The Loom of Fate` 4-voice classical counterpoint + 4-note musical Draft spell-weaving)
6. **Levels 31–32 — *Sam & Max Hit the Road*** (`Road to Sam & Max` swung walking-bass blues & pitch-bending synth sax + Wak-A-Rat highway bounties)
7. **Level 33 — *Ghost Pirate LeChuck Finale*** (`LeChuck Battle Anthem` distorted heavy-metal FM guitar & double-time drums + moving LeChuck boss battle & voodoo cannonball dodging)
