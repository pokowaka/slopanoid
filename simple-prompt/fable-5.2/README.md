# Slopanoid: Fable 5.2 Benchmark Run

Results of evaluating Fable Studio's **Fable 5.2** on the Slopanoid autonomous retro game dev benchmark.

## Benchmark Status
- **Model:** Fable 5.2
- **Execution Mode:** Single Turn (One-Shot), zero human intervention
- **Constraints:** Zero external assets (100% procedural Web Audio & HTML5 Canvas), zero external libraries
- **Current Status:** Complete — 4/4 games generated clean-room and verified (1,750 KB · 35,015 shipped runtime lines, see [`../metrics/`](../metrics/README.md))

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

1. Stage `/tmp/bench-fable-5.2` (with only `PROMPT.md` per game) and lock the `slopanoid` repo (working tree + `.git/`):
   ```bash
   ./scripts/cleanroom_harness.py prepare fable-5.2
   # Optional kernel-enforced root lock:
   # ./scripts/cleanroom_harness.py prepare fable-5.2 --sudo-lock
   ```
2. Close any workspace opened on `slopanoid`, open `/tmp/bench-fable-5.2` (or `/tmp/bench-fable-5.2/<game>`), and run **Fable 5.2** on each `PROMPT.md`.
3. Unlock the repo, copy the generated builds back into `simple-prompt/fable-5.2/`, validate syntax/assets/clean-room overlap, and optionally record conversation metrics:
   ```bash
   python3 ~/.cache/slopanoid/cleanroom_harness.py collect fable-5.2 \
     --convs <conv-arkanoid> <conv-xenon2> <conv-gng> <conv-lemmings>
   ```
4. Launch the arcade hub locally to evaluate:
   ```bash
   open simple-prompt/fable-5.2/index.html
   ```
