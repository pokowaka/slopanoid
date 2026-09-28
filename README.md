# Slopanoid Arcade: The One-Shot Retro Collection

A retro gaming showcase featuring four complete, fully-featured games conceived, designed, composed, and coded entirely via **single one-shot prompts** with zero human micro-management.

Every game is built with **zero external assets** (no external sprite sheets, images, or audio files) and **zero external libraries or frameworks**. Everything—from pixel-perfect 320×200 software framebuffers and custom EGA palettes to Web Audio AdLib/OPL2 FM synthesizers and 8-channel Amiga MOD tracker engines—is self-contained in pure Vanilla JavaScript, HTML5 Canvas, and CSS.

---

## 🕹️ The Games & One-Shot Prompts

| Game | Description | One-Shot Prompt | Play Link |
| :--- | :--- | :--- | :--- |
| **Arkanoid: The Secret of Brick Island** | LucasArts tribute featuring 33 mosaic levels across 7 worlds, AdLib FM synth with 7 world soundtracks, insult sword fighting, time-travel portals, Loom spell-weaving, and LeChuck boss fight. | [arkanoid/PROMPT.md](arkanoid/PROMPT.md) | [Play Arkanoid](arkanoid/index.html) |
| **Xenon 2: Megablast** | The Bitmap Brothers tribute with 320×200 software framebuffer, 8-channel Amiga MOD tracker sequencing Bomb the Bass's *"Megablast"*, TB-303 acid filter sweeps, and Crispin's shop with modular ship upgrades. | [xenon2/PROMPT.md](xenon2/PROMPT.md) | [Play Xenon 2](xenon2/index.html) |
| **Ghosts 'n Goblins: The Cursed PC Gaming Museum** | CPS-1 / VGA platformer with Sir Arthur, tactical armor ejection, Strawberry Boxer Shorts mode (+35% speed & double jump), monster possession curse, 5 weapons, and multi-stage bosses. | [ghosts-n-goblins/PROMPT.md](ghosts-n-goblins/PROMPT.md) | [Play Ghosts 'n Goblins](ghosts-n-goblins/index.html) |
| **Lemmings: Beat Tribe** | Psygnosis tribute where every level is a music sequencer: colour-coded terrain plays quantized notes under the lemmings' feet, every skill is an instrument, and saving the tribe unlocks song stems (drums → bass → chords → lead → full mix). 16 levels across 5 genre worlds (chiptune, acid, synthwave, jungle, orchestral), a sound-eating Silence hazard, and a results screen that replays the song you composed. | [lemmings/PROMPT.md](lemmings/PROMPT.md) | [Play Lemmings](lemmings/index.html) |

---

## 🚀 Quick Start

Open the arcade launcher in any modern browser:

```bash
# Simply open the root launcher
open index.html
```

Or serve locally with any static web server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

### Arcade Launcher Hotkeys
- Press <kbd>1</kbd> to launch **Arkanoid**
- Press <kbd>2</kbd> to launch **Xenon 2**
- Press <kbd>3</kbd> to launch **Ghosts 'n Goblins**
- Press <kbd>4</kbd> to launch **Lemmings: Beat Tribe**
- Press <kbd>P</kbd> to jump to the One-Shot Prompts manifesto
