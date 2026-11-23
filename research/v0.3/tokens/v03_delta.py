"""Tokens per program before (v0.2 fmt) and after (v0.3 fmt), with the Qwen2.5-Coder tokenizer.

    npx tsx --conditions=source research/v0.3/tokens/v03_delta.ts
    HF_HUB_OFFLINE=1 <venv>/bin/python research/v0.3/tokens/v03_delta.py
"""
import json
from collections import defaultdict
from pathlib import Path

from transformers import AutoTokenizer

HERE = Path(__file__).parent
tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-Coder-1.5B")
pairs = json.loads((HERE / "v03_pairs.json").read_text())
agg = defaultdict(lambda: [0, 0, 0, 0, 0, 0])  # n, changed, tok02, tok03, chars02, chars03
for p in pairs:
    a = agg[p["corpus"]]
    a[0] += 1
    a[1] += p["v02"] != p["v03"]
    a[2] += len(tok(p["v02"])["input_ids"])
    a[3] += len(tok(p["v03"])["input_ids"])
    a[4] += len(p["v02"])
    a[5] += len(p["v03"])
lines = ["| Corpus | Programs | Changed by v0.3 fmt | Qwen tokens / program, v0.2 | v0.3 | Change | Characters / program, v0.2 | v0.3 |",
         "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
out = {}
for c, (n, ch, t2, t3, c2, c3) in agg.items():
    lines.append(f"| {c} | {n} | {ch} | {t2 / n:.1f} | {t3 / n:.1f} | {100 * (t3 - t2) / t2:+.2f}% | {c2 / n:.1f} | {c3 / n:.1f} |")
    out[c] = dict(programs=n, changed=ch, tokens_v02=t2 / n, tokens_v03=t3 / n, chars_v02=c2 / n, chars_v03=c3 / n)
(HERE / "V03_DELTA.md").write_text("\n".join(lines) + "\n")
(HERE / "v03_delta.json").write_text(json.dumps(out, indent=2) + "\n")
print("\n".join(lines))
