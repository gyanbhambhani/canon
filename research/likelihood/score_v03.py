"""
Score every spelling in constructs_v03.py (v0.3 candidates) under a local open-weights model.

    .venv/bin/python score_v03.py Qwen/Qwen2.5-Coder-1.5B

For each program: the sum of log-probabilities (natural log) of its tokens, conditioned on a
fixed header line, plus the token count. The header is the same for every program, so the
sum is the model's log-likelihood of writing exactly that text. Writes results-v0.3/<model>.json.
"""
import json
import sys
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from constructs_v03 import CONSTRUCTS, programs

HEADER = "# A Canon source file (main.cn). Canon is a small, strictly formatted language.\n"


def main(model_id: str) -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, dtype=torch.float32 if device == "cpu" else torch.float16)
    model.to(device).eval()

    header_ids = tok(HEADER, add_special_tokens=False)["input_ids"]

    def score(text: str) -> tuple[float, int]:
        body_ids = tok(text, add_special_tokens=False)["input_ids"]
        ids = torch.tensor([header_ids + body_ids], device=device)
        with torch.no_grad():
            logits = model(ids).logits.float()
        logp = torch.log_softmax(logits[0, :-1], dim=-1)
        targets = ids[0, 1:]
        per_tok = logp.gather(1, targets[:, None])[:, 0]
        body = per_tok[len(header_ids) - 1 :]  # tokens of the program only
        return float(body.sum()), len(body_ids)

    out = {"model": model_id, "header": HEADER, "constructs": []}
    for c in CONSTRUCTS:
        rows = []
        for ci, name, text in programs(c):
            lp, n = score(text)
            rows.append({"context": ci, "variant": name, "logprob": lp, "tokens": n, "text": text})
        out["constructs"].append({k: c[k] for k in ("id", "question", "canon")} | {"rows": rows})
        print(f"{c['id']:<20} " + "  ".join(f"{r['variant']}[{r['context']}]={r['logprob']:.1f}" for r in rows))

    dest = Path(__file__).parent / "results-v0.3" / (model_id.replace("/", "__") + ".json")
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Qwen/Qwen2.5-Coder-1.5B")
