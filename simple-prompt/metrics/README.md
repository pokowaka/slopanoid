# Benchmark Cost & Time Metrics

Per-model token usage and wall-clock time for each clean-room game generation.
Each game was built by one autonomous agent in an isolated directory containing
only its `PROMPT.md`, with all prior builds moved out of the filesystem.

## Methodology

- **Source:** Antigravity per-request generation metadata (`gen_metadata` table in
  each agent's conversation DB). Extracted with [`usage_report.py`](usage_report.py).
- **LLM calls:** number of model requests the agent made (each tool call = 1 request).
- **Output tokens:** all generated tokens, *including hidden reasoning/thinking*.
- **Input tokens:** prompt tokens per request, split into *uncached* (freshly
  processed) and *cached* (prompt-cache reads). `in_total` is the sum. Because the
  whole conversation is re-sent on every request, cached input grows quadratically
  with the number of calls — it is the dominant number for chatty agents.
- **Peak context:** largest context window observed on any single request.
- **Wall time:** first → last transcript timestamp of the agent (includes tool
  execution time, not just model latency).
- **Shipped bytes:** runtime files only (HTML + JS loaded by the page), excluding
  READMEs and test harnesses. Bytes are a fairer size measure than lines because
  the two models format code very differently (Fable averages ~70 B/line vs
  Gemini's ~33 B/line).
- Raw per-step data: [`gemini-3.8.json`](gemini-3.8.json), [`fable-5.1.json`](fable-5.1.json), [`fable-5.2.json`](fable-5.2.json), [`gemini-4-carbon.json`](gemini-4-carbon.json).

> [!NOTE]
> Model IDs recorded in the metadata were
> `Gemini-4.1-S-IT-G1038-Rev25-Topo-Skimaki-EEVEE/2` for the run labelled
> *Gemini 3.8 Flash*, `claude-fable-5-1@default` for *Fable 5.1*,
> `claude-fable-5-2@default` for *Fable 5.2*, and
> `carbon-g-jetski/tfhub/prod/ml-gemini-experimental/Gemini-5-M-IT-G1149-Rev27-Carbon-G/1`
> for *Gemini 4 Carbon*.

---

## Gemini 3.8 Flash — `gemini-3.8/` (complete, 4/4 verified)

Run on 2026-09-30 21:26–22:08 PDT. Arkanoid and Xenon 2 ran sequentially;
Ghosts 'n Goblins and Lemmings ran in parallel.

| Game | Wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | 9.0 min | 46 | 112,088 | 336,462 | 4,511,929 | 4,848,391 | 157,168 | 113 KB · 3,453 lines |
| Xenon 2 | 11.0 min | 67 | 148,676 | 780,098 | 6,167,787 | 6,947,885 | 185,768 | 185 KB · 5,718 lines |
| Ghosts 'n Goblins | 8.2 min | 44 | 115,662 | 556,647 | 4,030,510 | 4,587,157 | 158,702 | 162 KB · 4,932 lines |
| Lemmings | 15.5 min | 129 | 183,842 | 645,312 | 14,715,403 | 15,360,715 | 231,959 | 230 KB · 6,902 lines |
| **Total** | **43.7 min agent-time**<br>(~35.5 min wall) | **286** | **560,268** | **2,318,519** | **29,425,629** | **31,744,148** | — | **690 KB · 21,005 lines** |

**Style:** many small steps — write a chunk, run `node --check`, patch, repeat.
Average ~2,000 output tokens per call; cost dominated by re-reading context.

---

## Fable 5.1 — `fable-5.1/` (complete, 4/4 verified)

Run on 2026-09-30 22:28–23:26 PDT. All four games launched in parallel.

| Game | Wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | 26.2 min | 27 | 131,952 | 179,814 | 3,472,013 | 3,651,827 | 163,238 | 112 KB · 2,371 lines |
| Xenon 2 | 41.9 min | 48 | 195,120 | 278,396 | 8,917,667 | 9,196,063 | 234,877 | 172 KB · 1,639 lines |
| Ghosts 'n Goblins | 44.7 min | 40 | 224,550 | 392,718 | 6,732,892 | 7,125,610 | 255,678 | 214 KB · 2,480 lines |
| Lemmings | 57.3 min | 85 | 267,930 | 665,967 | 9,983,760 | 10,649,727 | 240,195 | 149 KB · 2,229 lines |
| **Total** | **170.1 min agent-time**<br>(57.3 min wall) | **200** | **819,552** | **1,516,895** | **29,106,332** | **30,623,227** | — | **647 KB · 8,719 lines** |

**Style:** long reasoning before the first write (10+ min for several games),
then very large file writes (20–30k output tokens per call), followed by a
verification phase where each agent wrote its own headless harness (stubbed
DOM/Canvas/WebAudio) and drove the full game state machine. Average ~4,100
output tokens per call. Lemmings additionally built a deterministic simulator
and solver *before* the game, then baked solution demos from it.

---

## Fable 5.2 — `fable-5.2/` (complete, 4/4 verified)

Run sequentially per game across 2026-11-10 – 2026-11-14 PST in isolated
`/tmp/bench-fable-5.2/<game>` directories while `slopanoid` was locked (`chmod 000`).

| Game | Wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | 67.7 min | 56 | 346,262 | 647,013 | 17,971,423 | 18,618,436 | 422,023 | 206 KB · 3,930 lines |
| Xenon 2 | 80.0 min | 58 | 458,112 | 696,207 | 19,799,757 | 20,495,964 | 528,057 | 272 KB · 3,769 lines |
| Ghosts 'n Goblins *(+17 subagents)* | 115.4 min<br>(661.6 min agent-time) | 798 | 3,469,191 | 8,578,122 | 157,884,013 | 166,462,135 | 456,759 | 1,061 KB · 23,580 lines |
| Lemmings | 91.4 min | 77 | 435,775 | 934,866 | 27,486,135 | 28,421,001 | 504,718 | 211 KB · 3,736 lines |
| **Total** | **354.5 min sequential**<br>(900.7 min agent-time) | **989** | **4,709,340** | **10,856,208** | **223,141,328** | **233,997,536** | — | **1,750 KB · 35,015 lines** |

**Style:** Fable 5.2 scales up scope dramatically compared to 5.1: ~1.6–1.8×
larger single-file builds on Arkanoid and Xenon 2, a 15-file deterministic
simulator + headless Chrome/OfflineAudioContext test suite (`tools/verify.js`
solving all 16 levels) on Lemmings, and autonomous 17-subagent fan-out on
Ghosts 'n Goblins producing a 21-module, 1.06 MB (23,580-line) platformer.

---

## Gemini 4 Carbon — `gemini-4-carbon/` (complete, 4/4 verified)

Run across 2026-11-15 – 2026-11-16 PST in isolated
`/var/tmp/bench-gemini-4-carbon/<game>` directories while `slopanoid` was locked
(`chmod 000`). *(Arkanoid active wall time excludes one 9.1 h overnight
machine-sleep gap.)*

| Game | Active wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | 26.3 min | 52 | 172,845 | 666,763 | 7,815,538 | 8,482,301 | 322,215 | 137 KB · 3,557 lines |
| Xenon 2 | 25.3 min | 26 | 143,803 | 193,518 | 3,012,434 | 3,205,952 | 206,236 | 266 KB · 7,799 lines |
| Ghosts 'n Goblins | 37.8 min | 27 | 130,704 | 688,650 | 2,318,740 | 3,007,390 | 195,849 | 234 KB · 7,325 lines |
| Lemmings | 47.2 min | 47 | 190,338 | 300,819 | 7,346,862 | 7,647,681 | 239,552 | 267 KB · 7,918 lines |
| **Total** | **136.6 min active**<br>(47.2 min max game) | **152** | **637,690** | **1,849,750** | **20,493,574** | **22,343,324** | — | **904 KB · 26,599 lines** |

**Style:** Few, high-yield calls (~4.2k output tokens/call) with modular file
decomposition on Xenon 2 (10 files), Ghosts 'n Goblins (9 files), and Lemmings
(10 files). Achieves the lowest total input token footprint (22.3M) and best
token efficiency (~705 output tokens per shipped KB) in the benchmark.

---

## Head-to-head

| Metric | Gemini 3.8 Flash | Gemini 4 Carbon | Fable 5.1 | Fable 5.2 |
| :--- | --: | --: | --: | --: |
| Max single-game wall time | 15.5 min | 47.2 min | 57.3 min | 115.4 min |
| Agent-time (sum) | 43.7 min | 136.6 min | 170.1 min | 900.7 min |
| LLM calls | 286 | 152 | 200 | 989 |
| Output tokens | 560k | 638k | 820k | 4.71M |
| Input tokens (total) | 31.7M | 22.3M | 30.6M | 234.0M |
| Output tokens / call | ~2.0k | ~4.2k | ~4.1k | ~4.8k |
| Shipped runtime bytes | 690 KB | 904 KB | 647 KB | 1,750 KB |
| Shipped runtime lines | 21,005 | 26,599 | 8,719 | 35,015 |
| Output tokens / shipped KB | ~810 | ~705 | ~1,270 | ~2,690 |

Gemini 4 Carbon ships 31% more runtime bytes than Gemini 3.8 Flash (904 KB vs
690 KB) and 40% more than Fable 5.1 (647 KB) while making the fewest LLM calls
(152) and using the least total input context (22.3M tokens). Fable 5.2 occupies
a heavier multi-agent / verification-first tier, spending 7.4× the output tokens
and 10.5× the total input tokens of Gemini 4 Carbon to ship 1.9× the runtime
bytes (dominated by its 1.06 MB, 17-subagent Ghosts 'n Goblins build).
