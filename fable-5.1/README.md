# Slopanoid: Fable 5.1 Benchmark Run

Scaffolding for evaluating Fable Studio's **Fable 5.1** on the Slopanoid autonomous retro game dev benchmark.

## Benchmark Status
- **Model:** Fable 5.1
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

## 🚀 Execution Instructions

1. Feed each verbatim prompt in a fresh context window to **Fable 5.1**.
2. Save the generated single-turn code directly to the corresponding game directory:
   - `fable-5.1/arkanoid/index.html`
   - `fable-5.1/xenon2/index.html`
   - `fable-5.1/ghosts-n-goblins/index.html`
   - `fable-5.1/lemmings/index.html`
3. Launch the arcade launcher locally to evaluate:
   ```bash
   open index.html
   ```
4. Verify against the benchmark rubric (zero external asset requests, audio fidelity, gameplay responsiveness).
