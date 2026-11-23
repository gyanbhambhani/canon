"""Build the v0.4 surprisal corpus (corpus.json): the implemented Canon-Py surface against Canon's
brace syntax, typed Python and TypeScript, on the 50 benchmark tasks.

    /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python research/v0.4/surprisal/corpus.py

Program sets (per task):
  canon_brace_{claude,gpt}  the modal final Canon program from the v0.2 benchmark, formatted by
                            today's `canon fmt` (brace syntax, the v0.4 default; v0.3 text)
  canon_py_{claude,gpt}     the same programs converted by `canon fmt --syntax py` (the real,
                            implemented Canon-Py: same algorithm, helpers and names)
  ts_{claude,gpt}           the modal final TypeScript program
  python                    hand-written typed Python (research/v0.3/tokens/python)
  proto_cnpy                the v0.3 prototype's idiomatic Canon-Py (Python's library: indexing,
                            methods, comprehensions), for comparison only

Prefixes (not scored): a one-line header, or the language's agent reference.
Each item also carries its character count and syntax-tree node count (see analyze.py).
"""

from __future__ import annotations

import ast
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "research/v0.3/tokens"))

import measure as M  # noqa: E402  (modal selection; loads the Qwen tokenizer)

SHORT = {"claude-opus-5-5": "claude", "gpt-6.2-sol": "gpt"}


def reference(page: str) -> str:
    src = (ROOT / "apps/web/content/docs" / page).read_text()
    return re.sub(r"\A---\n[\s\S]*?\n---\n", "", src).strip() + "\n\n"


PREFIXES = {
    "hdr:canon": "# Canon\n",
    "hdr:canonpy": "# Canon-Py\n",
    "hdr:python": "# Python\n",
    "hdr:ts": "// TypeScript\n",
    "ref:canon": reference("for-agents.mdx"),
    "ref:canonpy": reference("for-agents-py.mdx"),
}


def py_nodes(code: str) -> int:
    """Python's own parser; nodes with a source position (expression contexts and operator
    singletons such as Load() and Add() are not counted, as Canon's tree has no such nodes)."""
    return sum(1 for n in ast.walk(ast.parse(code)) if hasattr(n, "lineno"))


def convert(items: list[dict]) -> dict[str, dict]:
    p = subprocess.run(
        ["npx", "tsx", "--conditions=source", str(HERE / "convert.ts")],
        input=json.dumps(items), capture_output=True, text=True, cwd=ROOT, check=True,
    )
    return {r["key"]: r for r in json.loads(p.stdout)}


def build() -> dict:
    tasks, _, by = M.load()
    raw = []
    for t in tasks:
        for m in M.MODELS:
            s = SHORT[m]
            raw.append({"key": f"canon:{s}:{t['id']}", "lang": "canon", "code": M.modal(by[(m, "canon", t["id"])])[0]})
            raw.append({"key": f"ts:{s}:{t['id']}", "lang": "typescript", "code": M.modal(by[(m, "typescript", t["id"])])[0]})
    conv = convert(raw)
    items, failures = [], []

    def add(set_id, task, prefix, text, nodes):
        text = M.norm(text)
        items.append({"set": set_id, "task": task["id"], "tier": task["tier"], "prefix": prefix,
                      "text": text, "chars": len(text), "nodes": nodes})

    for t in tasks:
        for m in M.MODELS:
            s = SHORT[m]
            c = conv[f"canon:{s}:{t['id']}"]
            if "error" in c:
                failures.append({"task": t["id"], "model": s, "error": c["error"]})
            else:
                for pre in ("hdr:canon", "ref:canon"):
                    add(f"canon_brace_{s}", t, pre, c["brace"], c["nodes"])
                for pre in ("hdr:canonpy", "hdr:python", "ref:canonpy"):
                    add(f"canon_py_{s}", t, pre, c["py"], c["nodes"])
            ts_code = M.modal(by[(m, "typescript", t["id"])])[0]
            add(f"ts_{s}", t, "hdr:ts", ts_code, conv[f"ts:{s}:{t['id']}"]["nodes"])
        py = (ROOT / "research/v0.3/tokens/python" / f"{t['id']}.py").read_text()
        add("python", t, "hdr:python", py, py_nodes(py))
        proto = (ROOT / "research/v0.3/canonpy/idiomatic" / f"{t['id']}.cnpy").read_text()
        add("proto_cnpy", t, "hdr:canonpy", proto, None)
    return {"prefixes": PREFIXES, "items": items, "conversion_failures": failures}


if __name__ == "__main__":
    out = build()
    (HERE / "corpus.json").write_text(json.dumps(out, indent=1) + "\n")
    sets = sorted({i["set"] for i in out["items"]})
    print(f"{len(out['items'])} items; sets: {sets}; conversion failures: {out['conversion_failures']}")
