"""Score every corpus item's surprisal under one local base model (one model per process).

    HF_HUB_OFFLINE=1 /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python \
        research/v0.3/surprisal/score.py Qwen/Qwen2.5-Coder-1.5B [--dtype float32|float16|bfloat16]

Surprisal = -sum ln p(token | prefix, earlier program tokens), in nats, over the program's tokens
only. Prefix and program are tokenized separately and concatenated, so a program's tokens do not
depend on its prefix. Long prefixes are encoded once and their KV cache is reused (cropped back
after each program). Writes results/<model>.json.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

import torch  # noqa: E402
from transformers import AutoModelForCausalLM, AutoTokenizer, DynamicCache  # noqa: E402

import corpus  # noqa: E402

HERE = Path(__file__).resolve().parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("--dtype", default=None)
    ap.add_argument("--limit", type=int, default=0, help="score only the first N unique texts (smoke test)")
    a = ap.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = getattr(torch, a.dtype) if a.dtype else (torch.float32 if "1.5B" in a.model else torch.float16)
    tok = AutoTokenizer.from_pretrained(a.model)
    model = AutoModelForCausalLM.from_pretrained(a.model, dtype=dtype).to(device).eval()

    items = corpus.items()
    unique = sorted({(it["prefix"], it["text"]) for it in items})
    if a.limit:
        unique = unique[: a.limit]
    print(f"{a.model} on {device} ({dtype}); {len(items)} items, {len(unique)} unique (prefix, text) pairs", flush=True)

    prefix_state: dict[str, tuple] = {}

    def prefix(pk: str):
        if pk not in prefix_state:
            ids = tok(corpus.PREFIXES[pk], add_special_tokens=False)["input_ids"]
            x = torch.tensor([ids], device=device)
            cache = DynamicCache()
            with torch.no_grad():
                out = model(x, past_key_values=cache, use_cache=True)
            last = torch.log_softmax(out.logits[0, -1].float(), dim=-1)
            prefix_state[pk] = (len(ids), cache, last)
        return prefix_state[pk]

    scores: dict[str, dict] = {}
    t0 = time.time()
    for n, (pk, text) in enumerate(unique):
        plen, cache, last = prefix(pk)
        ids = tok(text, add_special_tokens=False)["input_ids"]
        x = torch.tensor([ids], device=device)
        with torch.no_grad():
            out = model(x, past_key_values=cache, use_cache=True)
        cache.crop(-len(ids))  # back to the prefix only
        assert cache.get_seq_length() == plen
        logp = torch.log_softmax(out.logits[0, :-1].float(), dim=-1)
        per_tok = [float(last[ids[0]])] + logp.gather(1, x[0, 1:, None])[:, 0].tolist()
        scores[f"{pk}\x00{text}"] = {"nll": -sum(per_tok), "tokens": len(ids), "per_token": [-v for v in per_tok]}
        if n % 100 == 0:
            print(f"  {n}/{len(unique)}  {time.time() - t0:.0f}s", flush=True)

    rows = []
    for it in items:
        s = scores.get(f"{it['prefix']}\x00{it['text']}")
        if s is None:
            continue
        rows.append({k: it[k] for k in it if k != "text"} | {"nll": s["nll"], "tokens": s["tokens"], "text": it["text"]})
    dest = HERE / "results" / (a.model.replace("/", "__") + ".json")
    dest.parent.mkdir(exist_ok=True)
    meta = {"model": a.model, "dtype": str(dtype), "device": device, "prefixes": corpus.PREFIXES}
    dest.write_text(json.dumps({"meta": meta, "rows": rows}, indent=0) + "\n")
    print(f"wrote {dest} ({len(rows)} rows) in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
