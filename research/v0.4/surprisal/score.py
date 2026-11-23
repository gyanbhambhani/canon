"""Score every corpus.json item's surprisal under one local base model (one model per process).

    HF_HUB_OFFLINE=1 /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python \
        research/v0.4/surprisal/score.py Qwen/Qwen2.5-Coder-1.5B

Same method as research/v0.3/surprisal/score.py: surprisal = -sum ln p(token | prefix, earlier
program tokens), in nats, over the program's tokens only. Prefix and program are tokenized
separately and concatenated; each prefix is encoded once and its KV cache reused.
Writes results/<model>.json.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

import torch  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer, DynamicCache  # noqa: E402

HERE = Path(__file__).resolve().parent


def main(model_id: str) -> None:
    corpus = json.loads((HERE / "corpus.json").read_text())
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float32 if "1.5B" in model_id else torch.float16
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, dtype=dtype).to(device).eval()
    items = corpus["items"]
    unique = sorted({(it["prefix"], it["text"]) for it in items})
    print(f"{model_id} on {device} ({dtype}); {len(items)} items, {len(unique)} unique", flush=True)

    state: dict[str, tuple] = {}

    def prefix(pk: str):
        if pk not in state:
            ids = tok(corpus["prefixes"][pk], add_special_tokens=False)["input_ids"]
            cache = DynamicCache()
            with torch.no_grad():
                out = model(torch.tensor([ids], device=device), past_key_values=cache, use_cache=True)
            state[pk] = (len(ids), cache, torch.log_softmax(out.logits[0, -1].float(), dim=-1))
        return state[pk]

    scores = {}
    t0 = time.time()
    for n, (pk, text) in enumerate(unique):
        plen, cache, last = prefix(pk)
        ids = tok(text, add_special_tokens=False)["input_ids"]
        x = torch.tensor([ids], device=device)
        with torch.no_grad():
            out = model(x, past_key_values=cache, use_cache=True)
        cache.crop(-len(ids))
        assert cache.get_seq_length() == plen
        logp = torch.log_softmax(out.logits[0, :-1].float(), dim=-1)
        per_tok = [float(last[ids[0]])] + logp.gather(1, x[0, 1:, None])[:, 0].tolist()
        scores[(pk, text)] = (-sum(per_tok), len(ids))
        if n % 100 == 0:
            print(f"  {n}/{len(unique)}  {time.time() - t0:.0f}s", flush=True)

    rows = [{k: v for k, v in it.items() if k != "text"} | {"nll": scores[(it["prefix"], it["text"])][0],
                                                          "tokens": scores[(it["prefix"], it["text"])][1]}
            for it in items]
    dest = HERE / "results" / (model_id.replace("/", "__") + ".json")
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps({"model": model_id, "dtype": str(dtype), "device": device, "rows": rows}, indent=0) + "\n")
    print(f"wrote {dest} ({len(rows)} rows) in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Qwen/Qwen2.5-Coder-1.5B")
