"""Summarize results/<model>.json into RESULTS.md and summary.json.

    python3 research/v0.4/surprisal/analyze.py

Per program set and prefix: mean total surprisal per program (nats), Qwen tokens, characters and
syntax-tree nodes per program, and nats per token, per character and per node (ratios of sums).
Brackets are 95% bootstrap intervals over tasks (10,000 resamples, seed 2026), as in v0.3.
Paired differences compare the same task across sets (for canon_py vs canon_brace: the same
program in two surfaces).

Node counts come from each language's own parser and are only roughly comparable:
  Canon (both surfaces share one tree): every AST node; names in declarations are strings, not nodes.
  Python: `ast` nodes with a source position (no Load()/Add() singletons).
  TypeScript: every node the compiler API's forEachChild visits (identifiers and keywords included,
  so TypeScript counts run high and its nats per node low).
"""

from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED, B = 2026, 10_000

LABEL = {
    ("canon_brace_claude", "hdr:canon"): "Canon brace (v0.3/v0.4 default), Claude's programs, bare",
    ("canon_brace_claude", "ref:canon"): "Canon brace, Claude's programs, with reference",
    ("canon_py_claude", "hdr:canonpy"): "Canon-Py (implemented), same programs, bare",
    ("canon_py_claude", "hdr:python"): "Canon-Py, same programs, `# Python` header",
    ("canon_py_claude", "ref:canonpy"): "Canon-Py, same programs, with Canon-Py reference",
    ("canon_brace_gpt", "hdr:canon"): "Canon brace, GPT-6.2 Sol's programs, bare",
    ("canon_brace_gpt", "ref:canon"): "Canon brace, GPT-6.2 Sol's programs, with reference",
    ("canon_py_gpt", "hdr:canonpy"): "Canon-Py, GPT-6.2 Sol's programs converted, bare",
    ("canon_py_gpt", "ref:canonpy"): "Canon-Py, GPT-6.2 Sol's programs converted, with reference",
    ("ts_claude", "hdr:ts"): "TypeScript, Claude's programs",
    ("ts_gpt", "hdr:ts"): "TypeScript, GPT-6.2 Sol's programs",
    ("python", "hdr:python"): "Typed Python (hand-written)",
    ("proto_cnpy", "hdr:canonpy"): "v0.3 prototype Canon-Py (Python's library), bare",
}

PAIRS = [
    ("Canon-Py − Canon brace, same programs, bare", ("canon_py_claude", "hdr:canonpy"), ("canon_brace_claude", "hdr:canon")),
    ("Canon-Py − Canon brace, same programs, each with its reference", ("canon_py_claude", "ref:canonpy"), ("canon_brace_claude", "ref:canon")),
    ("(GPT's programs) Canon-Py − Canon brace, each with its reference", ("canon_py_gpt", "ref:canonpy"), ("canon_brace_gpt", "ref:canon")),
    ("Canon-Py bare − typed Python", ("canon_py_claude", "hdr:canonpy"), ("python", "hdr:python")),
    ("Canon-Py with reference − typed Python", ("canon_py_claude", "ref:canonpy"), ("python", "hdr:python")),
    ("Canon brace with reference − typed Python", ("canon_brace_claude", "ref:canon"), ("python", "hdr:python")),
    ("Canon-Py bare − TypeScript (Claude)", ("canon_py_claude", "hdr:canonpy"), ("ts_claude", "hdr:ts")),
    ("Canon-Py with reference − TypeScript (Claude)", ("canon_py_claude", "ref:canonpy"), ("ts_claude", "hdr:ts")),
    ("Canon-Py (implemented) − v0.3 prototype Canon-Py, bare", ("canon_py_claude", "hdr:canonpy"), ("proto_cnpy", "hdr:canonpy")),
    ("Canon-Py `# Python` header − `# Canon-Py` header", ("canon_py_claude", "hdr:python"), ("canon_py_claude", "hdr:canonpy")),
]


def boot(tasks: list[str], stat) -> tuple[float, float, float]:
    rng = random.Random(SEED)
    point = stat(tasks)
    vals = sorted(stat([tasks[rng.randrange(len(tasks))] for _ in tasks]) for _ in range(B))
    return point, vals[int(0.025 * B)], vals[int(0.975 * B) - 1]


def fmt(t, d=1):
    return f"{t[0]:.{d}f} [{t[1]:.{d}f}, {t[2]:.{d}f}]"


def summarize(result: dict) -> dict:
    by = defaultdict(dict)
    for r in result["rows"]:
        by[(r["set"], r["prefix"])][r["task"]] = r
    out = {"model": result["model"], "sets": {}, "pairs": {}}
    for key, label in LABEL.items():
        rows = by.get(key)
        if not rows:
            continue
        tasks = sorted(rows)

        def mean(f):
            return lambda ts: sum(f(rows[t]) for t in ts) / len(ts)

        def ratio(num, den):
            return lambda ts: sum(num(rows[t]) for t in ts) / sum(den(rows[t]) for t in ts)

        has_nodes = all(rows[t]["nodes"] for t in tasks)
        out["sets"][label] = {
            "n": len(tasks),
            "nats": boot(tasks, mean(lambda r: r["nll"])),
            "tokens": boot(tasks, mean(lambda r: r["tokens"])),
            "chars": boot(tasks, mean(lambda r: r["chars"])),
            "nodes": boot(tasks, mean(lambda r: r["nodes"])) if has_nodes else None,
            "per_token": boot(tasks, ratio(lambda r: r["nll"], lambda r: r["tokens"])),
            "per_char": boot(tasks, ratio(lambda r: r["nll"], lambda r: r["chars"])),
            "per_node": boot(tasks, ratio(lambda r: r["nll"], lambda r: r["nodes"])) if has_nodes else None,
        }
    for label, a, b in PAIRS:
        ra, rb = by[a], by[b]
        tasks = sorted(set(ra) & set(rb))
        out["pairs"][label] = {
            "n": len(tasks),
            "nats": boot(tasks, lambda ts: sum(ra[t]["nll"] - rb[t]["nll"] for t in ts) / len(ts)),
            "tokens": boot(tasks, lambda ts: sum(ra[t]["tokens"] - rb[t]["tokens"] for t in ts) / len(ts)),
        }
    return out


def main():
    results = [json.loads(p.read_text()) for p in sorted((HERE / "results").glob("*.json"))]
    summaries = [summarize(r) for r in results]
    (HERE / "summary.json").write_text(json.dumps(summaries, indent=1) + "\n")
    w = []
    w.append("# v0.4 surprisal: the implemented Canon-Py against Canon brace syntax, typed Python and TypeScript\n")
    w.append("Generated by `analyze.py` from `results/<model>.json` (written by `score.py` over `corpus.json`, built by `corpus.py`). "
             "Surprisal is −Σ ln p over a program's tokens (nats) under a local **base** model, conditioned on a prefix that is not scored. "
             "Mean per program over the 50 benchmark tasks; brackets are 95% bootstrap intervals over tasks (10,000 resamples, seed 2026). "
             "Per token, per character and per node are ratios of sums.\n")
    w.append("Canon programs are the modal final programs of the v0.2 benchmark (all pass the hidden tests). **Canon-Py rows are those same "
             "programs converted by `canon fmt --syntax py`**, so Canon brace vs Canon-Py is a like-for-like comparison of the surface. "
             "Typed Python is hand-written and idiomatic (different algorithms, Python's library), so Canon-Py vs Python mixes surface with "
             "library and style. Node counts: see the note at the top of `analyze.py` (Canon and Python roughly comparable; TypeScript "
             "counts every identifier and keyword, so its per-node figure is low).\n")
    for s in summaries:
        w.append(f"## {s['model']}\n")
        w.append("| program set | nats per program | tokens | chars | nodes | nats/token | nats/char | nats/node |")
        w.append("|---|---|---|---|---|---|---|---|")
        for label, v in s["sets"].items():
            nodes = fmt(v["nodes"], 0) if v["nodes"] else "–"
            pn = fmt(v["per_node"], 3) if v["per_node"] else "–"
            w.append(f"| {label} | {fmt(v['nats'])} | {v['tokens'][0]:.1f} | {v['chars'][0]:.0f} | {nodes} | "
                     f"{fmt(v['per_token'], 3)} | {fmt(v['per_char'], 3)} | {pn} |")
        w.append("\nPaired differences (A − B, per task, mean):\n")
        w.append("| comparison | n | Δ nats | Δ tokens |")
        w.append("|---|---|---|---|")
        for label, v in s["pairs"].items():
            w.append(f"| {label} | {v['n']} | {fmt(v['nats'])} | {fmt(v['tokens'])} |")
        w.append("")
    (HERE / "RESULTS.md").write_text("\n".join(w) + "\n")
    print("\n".join(w))


if __name__ == "__main__":
    main()
