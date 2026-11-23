"""
Score every spelling in constructs_v04.py under a local base model (one model per process).

    HF_HUB_OFFLINE=1 /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python \
        research/v0.4/likelihood/score_v04.py Qwen/Qwen2.5-Coder-1.5B

For each program: the sum of natural-log probabilities of its tokens, conditioned on a fixed
header line that is not scored. Writes results/<model>.json. Same method as
research/likelihood/score_v03.py; only the header and the constructs differ.
"""
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

import torch  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer  # noqa: E402

from constructs_v04 import CONSTRUCTS, programs  # noqa: E402

HEADER = "# A Canon source file (main.cn). Canon is a strictly formatted, effect-typed subset of Python.\n"


def main(model_id: str) -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float32 if "1.5B" in model_id else torch.float16
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, dtype=dtype).to(device).eval()
    header_ids = tok(HEADER, add_special_tokens=False)["input_ids"]

    def score(text: str) -> tuple[float, int]:
        body_ids = tok(text, add_special_tokens=False)["input_ids"]
        ids = torch.tensor([header_ids + body_ids], device=device)
        with torch.no_grad():
            logits = model(ids).logits.float()
        logp = torch.log_softmax(logits[0, :-1], dim=-1)
        per_tok = logp.gather(1, ids[0, 1:, None])[:, 0]
        return float(per_tok[len(header_ids) - 1:].sum()), len(body_ids)

    out = {"model": model_id, "dtype": str(dtype), "header": HEADER, "constructs": []}
    for c in CONSTRUCTS:
        rows = []
        for ci, name, text in programs(c):
            lp, n = score(text)
            rows.append({"context": ci, "variant": name, "logprob": lp, "tokens": n, "text": text})
        out["constructs"].append({k: c[k] for k in ("id", "question", "chosen")} | {"rows": rows})
        print(f"{c['id']:<16} " + "  ".join(f"{r['variant']}[{r['context']}]={r['logprob']:.1f}" for r in rows), flush=True)

    dest = Path(__file__).parent / "results" / (model_id.replace("/", "__") + ".json")
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Qwen/Qwen2.5-Coder-1.5B")
