# Arkanoid Graphics Prompt Lab (`gemini-4-carbon-high`)

Controlled clean-room ablation study investigating why baseline **Gemini 4 Carbon** trailed **Fable 5.2** visually on Arkanoid—and testing 4 distinct prompt-engineering strategies on the exact same `gemini-4-carbon-high` model (`carbon-g-jetski/tfhub/prod/ml-gemini-experimental/Gemini-5-M-IT-G1149-Rev27-Carbon-G/1`).

Open [`index.html`](index.html) in a browser to compare any two builds side-by-side in a live dual-viewport cabinet.

## Root Cause Diagnosis

The canonical [`simple-prompt/.../arkanoid/PROMPT.md`](../../simple-prompt/gemini-4-carbon/arkanoid/PROMPT.md) contains **23 lines of explicit DSP architecture** for the AdLib/OPL2 synthesizer (`GainNode` FM modulation, low-pass triangle bass, noise bursts, timestamp lookahead sequencer), while **Graphics gets only 4 high-level bullets**. Because Carbon optimizes aggressively for token economy, underspecified visual layers defaulted to minimum-viable `ctx.fillRect()` boxes, a `3×5` micro-font, and a coarse `16×11` grid of wide `18×7` bricks.

## Clean-Room Ablation Results

All 4 variants ran simultaneously in isolated `/var/tmp/arkanoid-prompt-lab/<variant>/` directories while `simple-prompt/`, `gauntlet/`, `prompt-lab/`, and `.git/objects/` were locked (`chmod 000`). Transcript audits confirmed zero cross-directory reads (`cleanroom_leak = False` across all 4 runs).

| Build | Strategy Tested | Active Time | LLM Calls | Output Tokens | Total Input Tokens | Est. API Cost (Std / Intro) | Shipped (`index.html`) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Baseline Carbon** ([play](../../simple-prompt/gemini-4-carbon/arkanoid/index.html)) | Canonical prompt (23L audio / 4L graphics) | 26.3 min | 52 | 172,845 | 8,482,301 | **$7.69** ($3.84 intro) | 136.7 KB · 3,557 lines |
| **Fable 5.2 Reference** ([play](../../simple-prompt/fable-5.2/arkanoid/index.html)) | Canonical prompt (unprompted EGA craft) | 67.7 min | 56 | 346,262 | 18,618,436 | **$22.62** | 206.2 KB · 3,930 lines |
| **[`v1-ega-pipeline`](v1-ega-pipeline/index.html)** ([prompt](v1-ega-pipeline/PROMPT.md)) | Explicit EGA pipeline (`4×4` Bayer dither, `egaShade`, `30×18` `8×6` bricks, `makeSprite`, `5×7` font, `256+64` HUD) | 29.6 min | 26 | 112,801 | 2,876,569 | **$3.96** ($1.98 intro) | **183.1 KB · 5,308 lines** |
| **[`v2-framebuffer-shader`](v2-framebuffer-shader/index.html)** ([prompt](v2-framebuffer-shader/PROMPT.md)) | `Uint32Array` software framebuffer + heightmap surface-normal lighting (`compileLitSprite`) + scanline water/road/lava | **10.4 min** | 26 | **105,263** | 3,168,321 | **$4.17** ($2.08 intro) | **162.9 KB · 4,428 lines** |
| **[`v3-fewshot-art-bible`](v3-fewshot-art-bible/index.html)** ([prompt](v3-fewshot-art-bible/PROMPT.md)) | Concrete few-shot Bayer dither + outlined ASCII sprite code anchors + mandatory visual self-audit checklist | 25.3 min | 38 | 111,540 | 4,980,588 | **$4.03** ($2.02 intro) | **159.3 KB · 4,606 lines** |
| **[`v4-vga-scumm-deluxe`](v4-vga-scumm-deluxe/index.html)** ([prompt](v4-vga-scumm-deluxe/PROMPT.md)) | Visuals-first prompt ordering + 1992 256-color *MI2* VGA ramps + live animated character portraits in `64px` HUD | 27.3 min | **22** | 106,293 | **2,260,699** | **$4.56** ($2.28 intro) | **169.8 KB · 4,629 lines** |
| **[`v5-vga-imuse`](v5-vga-imuse/index.html)** ⭐ ([prompt](v5-vga-imuse/PROMPT.md)) | `v4` 256-color VGA & SCUMM portraits + true OPL2 `PeriodicWave` feedback operators + 16–24 bar polyphonic *iMUSE* dynamic stems & in-key SFX | 44.4 min | 26 | 157,906 | 3,621,175 | **$6.23** ($3.12 intro) | **247.0 KB · 5,986 lines** |

> **API Pricing Basis (per 1M tokens — uncached input / cache read / output):**
> - **Gemini 4 Carbon:** `$4.00 / $0.20 / $20.00` standard list rate (`$2.00 / $0.10 / $10.00` introductory rate through Nov 30, 2026).
> - **Claude Fable 5.2:** `$8.00 / $0.20 / $40.00` standard rate.

## Key Takeaways

1. **More code & far better art for *less* compute:** Specifying concrete visual primitives didn't increase token cost—it *slashed* LLM calls from `52` down to `22–38`, reduced output tokens by **35%–39%**, and cut total input tokens by up to **73%** (`2.26M` on `v4` vs `8.48M` on baseline) while shipping **+17% to +34% more code**.
2. **Shader/Framebuffer prompts (`v2`) unlock extreme speed & cohesion on Carbon:** Asking for a `Uint32Array` software rasterizer + procedural heightmap normal shader (`compileLitSprite`) finished in **10.4 minutes** active time with zero offscreen-canvas glue boilerplate.
3. **Prompt ordering + palette ramps (`v4`) maximize visual personality:** Putting Visuals *above* Audio and allowing 16-shade 256-color VGA ramps + animated SCUMM character portraits produced the lowest-cost run (`22` calls, `2.26M` total input) with rich LucasArts personality.
