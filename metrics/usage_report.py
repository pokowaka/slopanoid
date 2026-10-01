#!/usr/bin/env python3
"""Extract per-step generation usage from a jetski conversation sqlite DB.

Usage: usage_report.py <conversation-id> [<conversation-id> ...]
Reads gen_metadata blobs (protobuf) and prints per-step + total usage.
Field mapping (empirically derived):
  msg 1 -> field 4 (usage):
      1: output tokens, 2: input tokens, 3: cache-create tokens,
      5: cache-read tokens, 6: ?, 10: ?
  msg 1 -> field 9.10: {1: context tokens, 4: context window}
  msg 1 -> field 19: model id
"""
import shutil, sqlite3, subprocess, sys, os, re, json, tempfile
from datetime import datetime

BRAIN = os.path.expanduser("~/.gemini/jetski")

def decode_raw(blob):
    p = subprocess.run(["protoc", "--decode_raw"], input=blob, capture_output=True)
    return p.stdout.decode("utf-8", "replace")

def parse_block(text):
    """Very small parser for protoc --decode_raw output -> nested dict of lists."""
    lines = text.splitlines()
    pos = 0
    def parse(depth):
        nonlocal pos
        node = {}
        while pos < len(lines):
            line = lines[pos]
            stripped = line.strip()
            if stripped == "}":
                pos += 1
                return node
            m = re.match(r"^(\d+)\s*(\{|:\s*(.*))$", stripped)
            pos += 1
            if not m:
                continue
            key = m.group(1)
            if m.group(2) == "{":
                val = parse(depth + 1)
            else:
                val = m.group(3)
            node.setdefault(key, []).append(val)
        return node
    return parse(0)

def first(node, *path):
    cur = node
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p][0]
    return cur

def to_int(v):
    try: return int(v)
    except: return 0

def report(conv_id):
    src = f"{BRAIN}/conversations/{conv_id}.db"
    tmp = tempfile.mkdtemp()
    for ext in ("", "-wal", "-shm"):
        if os.path.exists(src + ext):
            shutil.copy(src + ext, f"{tmp}/c.db{ext}")
    db = sqlite3.connect(f"{tmp}/c.db")
    rows = db.execute("select idx, data from gen_metadata order by idx").fetchall()
    steps = []
    model = None
    for idx, blob in rows:
        tree = parse_block(decode_raw(blob))
        m1 = first(tree, "1")
        if not m1: continue
        usage = first(m1, "4")
        if not usage: continue
        model = model or first(m1, "19")
        steps.append({
            "idx": idx,
            "out": to_int(first(usage, "3")),          # output tokens (incl. thinking); == field 10
            "in_uncached": to_int(first(usage, "2")),  # fresh prompt tokens
            "in_cached": to_int(first(usage, "5")),    # cache-read prompt tokens
            "ctx": to_int(first(m1, "9", "10", "1")),
        })
    # timing from transcript
    tf = f"{BRAIN}/brain/{conv_id}/.system_generated/logs/transcript.jsonl"
    t0 = t1 = None
    nsteps = 0
    if os.path.exists(tf):
        for line in open(tf):
            try: d = json.loads(line)
            except: continue
            nsteps += 1
            ts = d.get("created_at")
            if ts:
                t0 = t0 or ts
                t1 = ts
    tot = {k: sum(s[k] for s in steps) for k in ("out", "in_uncached", "in_cached")}
    tot["in_total"] = tot["in_uncached"] + tot["in_cached"]
    dur = None
    if t0 and t1:
        f = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
        dur = (f(t1) - f(t0)).total_seconds()
    return {"conv": conv_id, "model": model, "llm_calls": len(steps), "transcript_steps": nsteps,
            "start": t0, "end": t1, "duration_s": dur, "totals": tot,
            "max_ctx": max((s["ctx"] for s in steps), default=0), "steps": steps}

if __name__ == "__main__":
    out = [report(c) for c in sys.argv[1:]]
    if os.environ.get("JSON"):
        print(json.dumps(out, indent=1))
    else:
        for r in out:
            t = r["totals"]
            print(f"{r['conv'][:8]}  model={r['model']}  calls={r['llm_calls']}  steps={r['transcript_steps']}  "
                  f"dur={r['duration_s'] and round(r['duration_s']/60,1)}min  "
                  f"out={t['out']:,}  in_uncached={t['in_uncached']:,}  in_cached={t['in_cached']:,}  in_total={t['in_total']:,}  max_ctx={r['max_ctx']:,}")
