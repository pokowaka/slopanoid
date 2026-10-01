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
- Raw per-step data: [`gemini-3.8.json`](gemini-3.8.json), [`fable-5.1.json`](fable-5.1.json).

> [!NOTE]
> Model IDs recorded in the metadata were
> `Gemini-4.1-S-IT-G1038-Rev25-Topo-Skimaki-EEVEE/2` for the run labelled
> *Gemini 3.8 Flash*, and `claude-fable-5-1@default` for *Fable 5.1*.

---

## Gemini 3.8 Flash — `gemini-3.8/` (complete, 4/4 verified)

Run on 2026-09-30 21:26–22:08 PDT. Arkanoid and Xenon 2 ran sequentially;
Ghosts 'n Goblins and Lemmings ran in parallel.

| Game | Wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Lines shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | 9.0 min | 46 | 112,088 | 336,462 | 4,511,929 | 4,848,391 | 157,168 | 3,453 |
| Xenon 2 | 11.0 min | 67 | 148,676 | 780,098 | 6,167,787 | 6,947,885 | 185,768 | 5,718 |
| Ghosts 'n Goblins | 8.2 min | 44 | 115,662 | 556,647 | 4,030,510 | 4,587,157 | 158,702 | 4,932 |
| Lemmings | 15.5 min | 129 | 183,842 | 645,312 | 14,715,403 | 15,360,715 | 231,959 | 6,902 |
| **Total** | **43.7 min agent-time**<br>(~35.5 min wall) | **286** | **560,268** | **2,318,519** | **29,425,629** | **31,744,148** | — | **21,005** |

**Style:** many small steps — write a chunk, run `node --check`, patch, repeat.
Average ~2,000 output tokens per call; cost dominated by re-reading context.

---

## Fable 5.1 — `fable-5.1/` (in progress)

Run started 2026-09-30 22:28 PDT. All four games launched in parallel.

| Game | Wall time | LLM calls | Output tokens | Input (uncached) | Input (cached) | Input (total) | Peak ctx | Lines shipped |
| :--- | --: | --: | --: | --: | --: | --: | --: | --: |
| Arkanoid | ⏳ | | | | | | | |
| Xenon 2 | ⏳ | | | | | | | |
| Ghosts 'n Goblins | ⏳ | | | | | | | |
| Lemmings | ⏳ | | | | | | | |
| **Total** | | | | | | | | |

**Style (observed at 20 min):** few, very large steps — 10+ minutes of
reasoning before the first write, then multi-tens-of-KB file writes.
~15–20k output tokens per call versus ~2k for Gemini; far fewer calls, so
cached-input volume is an order of magnitude lower.

*Snapshot at 22:48 PDT (20 min in, nothing finished):*

| Game | LLM calls | Output tokens | Input (total) | Peak ctx |
| :--- | --: | --: | --: | --: |
| Arkanoid | 6 | 92,922 | 392,634 | 101,238 |
| Xenon 2 | 5 | 92,026 | 265,798 | 102,229 |
| Ghosts 'n Goblins | 5 | 84,794 | 230,891 | 80,826 |
| Lemmings | 4 | 61,643 | 118,317 | 73,696 |
