# Slopanoid: Gemini Next Benchmark Run

Scaffolding for evaluating Google DeepMind's **Gemini Next** on the Slopanoid autonomous retro game dev benchmark.

## Benchmark Status
- **Model:** Gemini Next
- **Execution Mode:** Single Turn (One-Shot), zero human intervention
- **Constraints:** Zero external assets (100% procedural Web Audio & HTML5 Canvas), zero external libraries
- **Current Status:** Scaffolding Initialized (4/4 prompts staged)

---

## 🕹️ Challenges & Prompts

| Game | Benchmark Target | Prompt File | Target File |
| :--- | :--- | :--- | :--- |
| **Arkanoid: The Secret of Brick Island** | OPL2/AdLib FM synth, 33 mosaic levels, insult sword fighting | [`arkanoid/PROMPT.md`](arkanoid/PROMPT.md) | [`arkanoid/index.html`](arkanoid/index.html) |
| **Xenon 2: Megablast** | 8-ch Amiga MOD tracker, Bomb the Bass, TB-303 filters, Crispin shop | [`xenon2/PROMPT.md`](xenon2/PROMPT.md) | [`xenon2/index.html`](xenon2/index.html) |
| **Ghosts 'n Goblins: The Cursed Museum** | Tactical armor ejection, monster possession, 5 weapons, bosses | [`ghosts-n-goblins/PROMPT.md`](ghosts-n-goblins/PROMPT.md) | [`ghosts-n-goblins/index.html`](ghosts-n-goblins/index.html) |
| **Lemmings: Beat Tribe** | Quantized step sequencer, terrain as score, 5 genre worlds | [`lemmings/PROMPT.md`](lemmings/PROMPT.md) | [`lemmings/index.html`](lemmings/index.html) |

---

## 🚀 Air-Gapped Execution Instructions

1. Stage `/var/tmp/bench-gemini-next` (with only `PROMPT.md` per game; `/var/tmp` avoids macOS's 3-day midnight `/tmp` cleanup) and lock the `slopanoid` repo (working tree + `.git/`):
   ```bash
   ./scripts/cleanroom_harness.py prepare gemini-next
   # Optional kernel-enforced root lock:
   # ./scripts/cleanroom_harness.py prepare gemini-next --sudo-lock
   ```
2. Close any workspace opened on `slopanoid`, open `/var/tmp/bench-gemini-next/<game>`, and run **Gemini Next** on each `PROMPT.md`.
3. Unlock the repo, copy the generated builds back into `simple-prompt/gemini-next/`, validate syntax/assets/clean-room overlap, and optionally record conversation metrics:
   ```bash
   python3 ~/.cache/slopanoid/cleanroom_harness.py collect gemini-next \
     --convs <conv-arkanoid> <conv-xenon2> <conv-gng> <conv-lemmings>
   ```
4. Launch the arcade hub locally to evaluate:
   ```bash
   open simple-prompt/gemini-next/index.html
   ```
