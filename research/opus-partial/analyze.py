"""What the Claude Opus 5.5 runs recorded before the Anthropic credit ran out (2026-11-23, 01:18 PST)
support. Reads CanonBench's and FS-1's raw results; prints the tables in README.md.

    python3 research/opus-partial/analyze.py <canonbench results dir> <fs1 results dir>
"""
import collections, json, random, sys

cb, fs1 = sys.argv[1], sys.argv[2]

def load(path):
    return [json.loads(line) for line in open(path)]

def boot(diffs, b=10000):
    random.seed(2026)
    means = sorted(sum(random.choice(diffs) for _ in diffs) / len(diffs) for _ in range(b))
    return sum(diffs) / len(diffs), means[int(0.025 * b)], means[int(0.975 * b)]

# CanonBench READ, main run
rows = load(f"{cb}/read-opus.jsonl")
print(f"READ main run: {len(rows)} answers; runs {dict(collections.Counter(r['run'] for r in rows))}")
arms = ["canon", "canon-stripped", "py", "ts"]
for t in [None, "effects", "failure", "output", "property"]:
    sel = [r for r in rows if t is None or r.get("type") == t]
    acc = {a: [r["correct"] for r in sel if r["arm"] == a] for a in arms}
    def seeds(a):
        d = collections.defaultdict(list)
        for r in sel:
            if r["arm"] == a:
                d[r["seed"]].append(r["correct"])
        return {s: sum(v) / len(v) for s, v in d.items()}
    cs = seeds("canon")
    parts = []
    for b in ["py", "ts", "canon-stripped"]:
        bs = seeds(b)
        common = sorted(set(cs) & set(bs))
        m, lo, hi = boot([cs[s] - bs[s] for s in common])
        parts.append(f"vs {b} {100*m:+.1f} [{100*lo:+.1f}, {100*hi:+.1f}]")
    print(f"  {t or 'all':9} " + "  ".join(f"{a} {100*sum(v)/len(v):.1f}%" for a, v in acc.items()) + "  |  " + "; ".join(parts) + f"  ({len(cs)} seeds)")

# CanonBench pilots (WRITE, FIX, CHANGE, THINK)
for fam in ["write", "fix", "change", "think"]:
    rs = load(f"{cb}/{fam}-opus-pilot.jsonl")
    by = collections.defaultdict(list)
    for r in rs:
        by[r["arm"]].append(r.get("thinkPass", r["pass"]) if fam == "think" else r["pass"])
    print(f"{fam.upper()} pilot: " + ", ".join(f"{a} {sum(v)}/{len(v)}" for a, v in sorted(by.items())))

# FS-1 pilot
rs = load(f"{fs1}/pilot-claude.jsonl")
print(f"FS-1 pilot: {len(rs)} runs over {len({r['task'] for r in rs})} tasks")
for arm in ["direct", "openapi", "canon"]:
    a = [r for r in rs if r["arm"] == arm]
    vals = [x for r in a for x in ((r.get("validation") or {}).values() if isinstance(r.get("validation"), dict) else []) if isinstance(x, (int, float))]
    print(f"  {arm:8} pass {sum(r['pass'] for r in a)}/{len(a)}  mismatch {sum(bool(r['mismatch']) for r in a)}"
          f"  rounds {sum(r['editRounds'] for r in a)/len(a):.1f}  ${sum(r['dollars'] or 0 for r in a):.2f}"
          + (f"  validation agreement {sum(vals)/len(vals):.2f} (n={len(vals)})" if vals else ""))
