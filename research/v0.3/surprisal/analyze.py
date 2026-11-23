"""Bootstrap summaries of results/<model>.json -> RESULTS.md and summary.json.

    /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python research/v0.3/surprisal/analyze.py

Intervals: 95% percentile bootstrap over tasks, 10,000 resamples, seed 2026. Paired differences
resample tasks and average the per-task difference (A - B). Per-token surprisal is a ratio of sums
(total nats / total tokens over the resampled tasks).
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MODELS = ["Qwen/Qwen2.5-Coder-1.5B", "Qwen/Qwen2.5-Coder-7B"]
B, SEED = 10_000, 2026


def boot_idx(n: int) -> np.ndarray:
    return np.random.default_rng(SEED).integers(0, n, size=(B, n))


def ci_mean(x: np.ndarray):
    bs = x[boot_idx(len(x))].mean(axis=1)
    return float(x.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def ci_ratio(num: np.ndarray, den: np.ndarray):
    idx = boot_idx(len(num))
    bs = num[idx].sum(axis=1) / den[idx].sum(axis=1)
    return float(num.sum() / den.sum()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def fmt(t, d=1):
    return f"{t[0]:.{d}f} [{t[1]:.{d}f}, {t[2]:.{d}f}]"


HEADLINE = [
    ("Canon v0.2, Claude programs, bare", "canon_claude", "hdr:canon"),
    ("Canon v0.2, Claude programs, with reference", "canon_claude", "ref:canon"),
    ("Canon v0.2, GPT programs, bare", "canon_gpt", "hdr:canon"),
    ("Canon v0.2, GPT programs, with reference", "canon_gpt", "ref:canon"),
    ("Canon-Py (idiomatic), `# Canon-Py` header", "cnpy", "hdr:canonpy"),
    ("Canon-Py (idiomatic), `# Python` header", "cnpy", "hdr:python"),
    ("Canon-Py (idiomatic), with RULES.md prefix", "cnpy", "ref:canonpy"),
    ("Canon-Py (idiomatic), sums as legal dataclasses", "cnpy_legal", "hdr:canonpy"),
    ("Typed Python", "python", "hdr:python"),
    ("TypeScript, Claude programs", "ts_claude", "hdr:ts"),
    ("TypeScript, GPT programs", "ts_gpt", "hdr:ts"),
]
SUBSET = [
    ("Canon v0.2 Claude, bare", "canon_claude", "hdr:canon"),
    ("Canon v0.2 Claude, with reference", "canon_claude", "ref:canon"),
    ("Canon-Py translit of the same programs, `# Canon-Py`", "cnpy_translit", "hdr:canonpy"),
    ("Canon-Py translit, `# Python` header", "cnpy_translit", "hdr:python"),
    ("Canon-Py translit, with RULES.md prefix", "cnpy_translit", "ref:canonpy"),
    ("Canon-Py translit, `e?` instead of `try_(e)`", "cnpy_translit_q", "hdr:canonpy"),
    ("Canon-Py translit, sums as legal dataclasses", "cnpy_translit_legal", "hdr:canonpy"),
    ("Canon-Py idiomatic", "cnpy", "hdr:canonpy"),
    ("Typed Python", "python", "hdr:python"),
]
PAIRS = [
    ("Canon Claude bare - Python", ("canon_claude", "hdr:canon"), ("python", "hdr:python"), None),
    ("Canon GPT bare - Python", ("canon_gpt", "hdr:canon"), ("python", "hdr:python"), None),
    ("Canon Claude ref - Python", ("canon_claude", "ref:canon"), ("python", "hdr:python"), None),
    ("Canon GPT ref - Python", ("canon_gpt", "ref:canon"), ("python", "hdr:python"), None),
    ("Canon Claude bare - TS Claude", ("canon_claude", "hdr:canon"), ("ts_claude", "hdr:ts"), None),
    ("Canon GPT bare - TS GPT", ("canon_gpt", "hdr:canon"), ("ts_gpt", "hdr:ts"), None),
    ("Reference effect: Canon Claude ref - bare", ("canon_claude", "ref:canon"), ("canon_claude", "hdr:canon"), None),
    ("Reference effect: Canon GPT ref - bare", ("canon_gpt", "ref:canon"), ("canon_gpt", "hdr:canon"), None),
    ("Canon-Py - Python", ("cnpy", "hdr:canonpy"), ("python", "hdr:python"), None),
    ("Canon-Py (`# Python` hdr) - Python", ("cnpy", "hdr:python"), ("python", "hdr:python"), None),
    ("Canon-Py - Canon Claude bare", ("cnpy", "hdr:canonpy"), ("canon_claude", "hdr:canon"), None),
    ("Canon-Py - Canon GPT bare", ("cnpy", "hdr:canonpy"), ("canon_gpt", "hdr:canon"), None),
    ("Canon-Py - Canon Claude ref", ("cnpy", "hdr:canonpy"), ("canon_claude", "ref:canon"), None),
    ("Canon-Py legal dataclass sums - compact `type` line", ("cnpy_legal", "hdr:canonpy"), ("cnpy", "hdr:canonpy"), None),
    ("Canon-Py RULES.md prefix - bare", ("cnpy", "ref:canonpy"), ("cnpy", "hdr:canonpy"), None),
    ("[20] translit - Canon Claude bare (same algorithms)", ("cnpy_translit", "hdr:canonpy"), ("canon_claude", "hdr:canon"), "translit"),
    ("[20] translit with RULES.md - Canon Claude with reference", ("cnpy_translit", "ref:canonpy"), ("canon_claude", "ref:canon"), "translit"),
    ("[20] translit bare - Canon Claude with reference", ("cnpy_translit", "hdr:canonpy"), ("canon_claude", "ref:canon"), "translit"),
    ("[20] translit `e?` - `try_(e)`", ("cnpy_translit_q", "hdr:canonpy"), ("cnpy_translit", "hdr:canonpy"), "translit"),
    ("[20] translit - Canon-Py idiomatic", ("cnpy_translit", "hdr:canonpy"), ("cnpy", "hdr:canonpy"), "translit"),
    ("[20] translit - Python", ("cnpy_translit", "hdr:canonpy"), ("python", "hdr:python"), "translit"),
]
EDITS = ["a_logic_ops", "b_for_destructure", "c_expr_fns", "d_implicit_return", "e_indent_blocks", "f_drop_let", "g_compound_assign", "all_a_to_g", "x_drop_contracts (info)"]


def analyze(path: Path) -> dict:
    data = json.loads(path.read_text())
    val = defaultdict(dict)  # (id, prefix) -> task -> row
    tier = {}
    for r in data["rows"]:
        val[(r["id"], r["prefix"])][r["task"]] = r
        tier[r["task"]] = r["tier"]
    translit_tasks = sorted(val[("cnpy_translit", "hdr:canonpy")])
    all_tasks = sorted(tier)

    def arr(key, tasks, field):
        return np.array([val[key][t][field] for t in tasks], dtype=float)

    def summary(key, tasks):
        nll, tok = arr(key, tasks, "nll"), arr(key, tasks, "tokens")
        return {"nll": ci_mean(nll), "tokens": ci_mean(tok), "nats_per_token": ci_ratio(nll, tok), "n": len(tasks)}

    out = {"model": data["meta"]["model"], "headline": {}, "subset": {}, "pairs": {}, "edits": {}}
    for label, i, p in HEADLINE:
        out["headline"][label] = {
            scope: summary((i, p), [t for t in all_tasks if scope == "all" or tier[t] == scope]) for scope in ("all", "basic", "hard")
        }
    for label, i, p in SUBSET:
        out["subset"][label] = summary((i, p), translit_tasks)
    for label, a, b, sub in PAIRS:
        tasks = translit_tasks if sub else all_tasks
        out["pairs"][label] = {
            "nll": ci_mean(arr(a, tasks, "nll") - arr(b, tasks, "nll")),
            "tokens": ci_mean(arr(a, tasks, "tokens") - arr(b, tasks, "tokens")),
            "n": len(tasks),
        }
    for s in ("claude", "gpt"):
        for e in EDITS:
            for pre in ("hdr:canon", "ref:canon"):
                ek, bk = (f"edit_{s}:{e}", pre), (f"canon_{s}", pre)
                d = arr(ek, all_tasks, "nll") - arr(bk, all_tasks, "nll")
                dt = arr(ek, all_tasks, "tokens") - arr(bk, all_tasks, "tokens")
                changed = [t for t in all_tasks if val[ek][t]["changed"]]
                base = arr(bk, all_tasks, "nll").mean()
                rec = {"n_changed": len(changed), "delta_all": ci_mean(d), "pct_all": 100 * d.mean() / base, "dtokens_all": float(dt.mean())}
                if len(changed) >= 2:
                    dc = arr(ek, changed, "nll") - arr(bk, changed, "nll")
                    rec["delta_changed"] = ci_mean(dc)
                elif len(changed) == 1:
                    dc = arr(ek, changed, "nll") - arr(bk, changed, "nll")
                    rec["delta_changed"] = (float(dc[0]),) * 3
                out["edits"][f"{s}|{e}|{pre}"] = rec
    return out


def main():
    results = {}
    for m in MODELS:
        p = HERE / "results" / (m.replace("/", "__") + ".json")
        if p.exists():
            results[m] = analyze(p)
    (HERE / "summary.json").write_text(json.dumps(results, indent=1) + "\n")

    L = []
    w = L.append
    w("# Total surprisal of correct programs: Canon v0.2 vs Canon-Py vs typed Python vs TypeScript\n")
    w("Generated by `analyze.py` from `results/<model>.json` (written by `score.py`). Surprisal is -sum ln p over the program's tokens (nats) under a local **base** model (Qwen2.5-Coder, Qwen tokenizer), conditioned on a prefix that is not scored. ")
    w("Programs: modal final programs from `runs-v0.2.jsonl` for Canon and TS (they pass the benchmark tests); hand-written typed Python (`../tokens/python`) and Canon-Py (`../canonpy`), both checked against the same tests. ")
    w("Brackets: 95% bootstrap CI over tasks (10,000 resamples, seed 2026). Per-token = total nats / total tokens.\n")
    w("Prefixes: bare = one header line, exactly `# Canon\\n`, `// TypeScript\\n`, `# Python\\n` or `# Canon-Py\\n`. With reference = the body of `apps/web/content/docs/for-agents.mdx` (frontmatter stripped) + a blank line. RULES.md prefix = `../canonpy/RULES.md` + a blank line (shorter, extra condition).\n")
    for m, R in results.items():
        w(f"## {m}\n")
        w("### Headline (50 tasks; mean per program)\n")
        w("| program set | total surprisal (nats) | tokens | nats/token | hard-tier nats (10) | basic-tier nats (40) |")
        w("|---|---|---|---|---|---|")
        for label, d in R["headline"].items():
            a = d["all"]
            w(f"| {label} | {fmt(a['nll'])} | {fmt(a['tokens'])} | {fmt(a['nats_per_token'], 3)} | {fmt(d['hard']['nll'])} | {fmt(d['basic']['nll'])} |")
        w("\n### Same-algorithm subset (20 tasks: all 10 hard + 10 basic): Claude's Canon programs vs their Canon-Py transliteration\n")
        w("| program set | total surprisal | tokens | nats/token |")
        w("|---|---|---|---|")
        for label, a in R["subset"].items():
            w(f"| {label} | {fmt(a['nll'])} | {fmt(a['tokens'])} | {fmt(a['nats_per_token'], 3)} |")
        w("\n### Paired differences (A - B, per task, mean)\n")
        w("| comparison | n | delta nats | delta tokens |")
        w("|---|---|---|---|")
        for label, d in R["pairs"].items():
            w(f"| {label} | {d['n']} | {fmt(d['nll'])} | {fmt(d['tokens'])} |")
        w("\n### Candidate v0.3 edits applied textually to the Canon v0.2 programs (delta total surprisal vs v0.2; negative = better)\n")
        w("`delta/program (all 50)` averages over every task (unchanged programs give 0); `delta/changed program` is over the programs the edit touched.\n")
        w("| edit | programs | n changed | delta/program bare | delta/program with ref | % of v0.2 (bare / ref) | delta/changed program bare | delta/changed with ref | delta tokens/program |")
        w("|---|---|---|---|---|---|---|---|---|")
        for e in EDITS:
            for s in ("claude", "gpt"):
                hb, hr = R["edits"][f"{s}|{e}|hdr:canon"], R["edits"][f"{s}|{e}|ref:canon"]
                cb = fmt(hb["delta_changed"]) if "delta_changed" in hb else "-"
                cr = fmt(hr["delta_changed"]) if "delta_changed" in hr else "-"
                w(f"| {e} | {s} | {hb['n_changed']} | {fmt(hb['delta_all'])} | {fmt(hr['delta_all'])} | {hb['pct_all']:.1f}% / {hr['pct_all']:.1f}% | {cb} | {cr} | {hb['dtokens_all']:.1f} |")
        w("")
    w(INTERPRETATION)
    (HERE / "RESULTS.md").write_text("\n".join(L) + "\n")


INTERPRETATION = """## Interpretation (written after reading both models' tables; the numbers above are regenerated, this text is not)

**Does Canon-Py clearly beat Canon v0.2 syntax? Yes, under both models.**
- Same algorithms (20 tasks: Claude's Canon programs vs their Canon-Py transliteration). Bare, Canon-Py is
  lower by 51 nats/program (1.5B) and 46 (7B), with CIs well clear of 0. With each language's own
  documentation as prefix (Canon reference vs the much shorter RULES.md), Canon-Py is still lower by
  17 [7, 27] and 14 [4, 22] nats. Bare Canon-Py with no documentation ties Canon v0.2 that has the
  full 7k-character reference (-7 [-19, 4] and -0.4 [-10, 9]).
- Across all 50 tasks, idiomatic Canon-Py is within about 2 nats of typed Python: +0.2 [-2.1, 2.1]
  on 1.5B and +1.8 [0.1, 3.2] on 7B with the `# Canon-Py` header; -1.2 and -0.6 with a `# Python`
  header. The subset's restrictions cost almost nothing: no truthiness, no generator expressions, a
  closed set of methods, `parse_int`, built-in Ok/Err, no local annotations.
- Neither spelling choice matters. `e?` vs `try_(e)` comes out at about 0. The compact `type` line
  for sums vs legal dataclasses is 0.0 on 1.5B and -0.5 nats on 7B; the dataclasses cost about 1.5
  more tokens.

**The reference matters a lot for Canon v0.2.** Conditioning on the agent reference lowers Canon's
surprisal by 38-41 nats/program (about 36-40%). Even then, Canon remains 19-38 nats/program above
typed Python, depending on whose programs and which model.

**Piecemeal v0.3 edits to Canon do not help, and most hurt.** Under both models, bare:
- Indentation instead of braces costs +2 to +5 nats/program.
- `= e` functions cost +1.5 to +2.4.
- Dropping `let` costs +0.7 to +1.3.
- The all-edits combination costs +5 to +9.
- Small wins:
  - destructuring `for (i, x) in enumerate(xs)`: -5 to -8 nats per changed program, but only 4 Claude
    programs and 0 GPT programs use enumerate;
  - `&&`/`||`/`!`: -1.4 to -2 per changed program, Claude only; GPT's is not significant;
  - `x += e`, bare: -0.1 to -0.4.
- Dropping the optional requires/ensures clauses (informational) saves about 20-25 nats per program
  that has them, bare.

Each edit produces a hybrid such as `fn f(x: Int) -> Int:` that is neither Canon nor Python, and the
model finds it unfamiliar. Only a wholesale move to Python's surface pays off.

The with-reference deltas for the edits are **confounded**: the prefix documents v0.2 syntax, so any
edit contradicts it. That is why the with-reference penalties are larger (up to +18 nats for
all-edits). Read the bare column as the prior effect.

**Where Canon's own syntax wins.** Within the Canon family, the v0.2 spellings (`return`, `let`, braces)
beat the hybrid alternatives above. Canon's compact sum-type line is no worse than dataclasses. At the
whole-program level, no construct of Canon v0.2 makes it less surprising than Python or Canon-Py.
TypeScript has the lowest nats/token (0.64-0.73), but its programs are long. Canon v0.2 is the most
surprising per token both bare (1.10-1.26) and with the reference (0.71-0.83).

**Where Python still wins, and by how much.** Typed Python beats Canon v0.2 by:
- 60-76 nats/program bare;
- 19-38 nats/program with the Canon reference.

Canon-Py removes essentially the whole gap. Part of the gap is not syntax: Claude's Canon programs use
workarounds such as hand-rolled `is_int`. The transliteration keeps those, and it is still 30 nats
above the idiomatic Canon-Py and Python versions of the same tasks.

**Caveats**
- These are base models, not the agent models. Surprisal is a proxy for how "natural" a text is to a
  code LM; it is not generation accuracy.
- Python and Canon-Py were hand-written by one author, the same author for both, and idiomatically.
  Canon and TS are model outputs, so cross-language rows mix style with syntax. The 20-task
  transliteration controls for the algorithm.
- The RULES.md prefix is far shorter than the Canon reference, so the two with-documentation
  conditions are not equal-length.
- n = 50 tasks (10 hard), so tier-level intervals are wide.
"""


if __name__ == "__main__":
    main()
