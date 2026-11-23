"""The scored corpus: (item id, task, prefix kind, text) for every program and variant.

Prefix kinds:
  hdr:canon      "# Canon\n"
  hdr:ts         "// TypeScript\n"
  hdr:python     "# Python\n"
  hdr:canonpy    "# Canon-Py\n"
  ref:canon      body of apps/web/content/docs/for-agents.mdx (frontmatter stripped) + blank line
  ref:canonpy    research/v0.3/canonpy/RULES.md + blank line (extra; shorter than the Canon reference)
Only program tokens are scored. Programs are rstripped and end with one newline.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V03 = HERE.parent
ROOT = V03.parents[1]
sys.path.insert(0, str(V03 / "tokens"))
sys.path.insert(0, str(V03 / "canonpy"))

import canonpy  # noqa: E402
import measure as M  # noqa: E402  (loads the Qwen tokenizer; used for modal selection and text transforms)

MODELS = M.MODELS
SHORT = {"claude-opus-5-5": "claude", "gpt-6.2-sol": "gpt"}


def reference_text() -> str:
    src = (ROOT / "apps/web/content/docs/for-agents.mdx").read_text()
    body = re.sub(r"\A---\n[\s\S]*?\n---\n", "", src)
    return body.strip() + "\n\n"


PREFIXES = {
    "hdr:canon": "# Canon\n",
    "hdr:ts": "// TypeScript\n",
    "hdr:python": "# Python\n",
    "hdr:canonpy": "# Canon-Py\n",
    "ref:canon": reference_text(),
    "ref:canonpy": (V03 / "canonpy" / "RULES.md").read_text().strip() + "\n\n",
}


# ---------------------------------------------------------------------------
# Candidate edit (b): destructuring enumerate loops.
# ---------------------------------------------------------------------------


def destructure_enumerate(code: str) -> str:
    """`for p in enumerate(xs) {` + p.0 / p.1 (or `let i = p.0` lines) -> `for (i, x) in enumerate(xs) {`."""
    lines = code.split("\n")
    i = 0
    while i < len(lines):
        m = re.match(r"^(\s*)for (\w+) in (enumerate\(.*\)) \{$", lines[i])
        if not m:
            i += 1
            continue
        ind, p, it = m.groups()
        j = i + 1
        while j < len(lines) and not (lines[j].startswith(ind + "}") and not lines[j].startswith(ind + " ")):
            j += 1
        body = lines[i + 1 : j]
        text = "\n".join(body)
        if re.search(rf"\b{p}\b(?!\.[01]\b)", text):  # p used whole: leave it
            i = j
            continue
        names = {}
        kept = []
        for ln in body:
            lm = re.match(rf"^\s*let (\w+) = {p}\.([01])$", ln)
            if lm and lm.group(2) not in names:
                names[lm.group(2)] = lm.group(1)
                continue
            kept.append(ln)
        used = set(re.findall(r"\b[a-z_]\w*\b", "\n".join(kept)))
        for slot, default in (("0", "i"), ("1", "x")):
            if slot not in names:
                cand = default
                while cand in used or cand in names.values():
                    cand += "_"
                names[slot] = cand
        kept = [re.sub(rf"\b{p}\.([01])\b", lambda mm: names[mm.group(1)], ln) for ln in kept]
        lines[i : j] = [f"{ind}for ({names['0']}, {names['1']}) in {it} {{"] + kept
        i += 1
    return "\n".join(lines)


CANON_EDITS = {
    "a_logic_ops": M.canon_logic_ops,
    "b_for_destructure": destructure_enumerate,
    "c_expr_fns": M.canon_expr_fns,
    "d_implicit_return": M.canon_implicit_return,
    "e_indent_blocks": M.braces_to(M.C, ":"),
    "f_drop_let": M.canon_drop_let,
    "g_compound_assign": M.sub(M.C, r"^(\s*)(\w+) = \2 ([+\-*/%]) ", r"\1\2 \3= "),
    "all_a_to_g": M.compose(
        M.canon_logic_ops,
        destructure_enumerate,
        M.canon_implicit_return,
        M.canon_expr_fns,
        M.canon_drop_let,
        M.sub(M.C, r"^(\s*)(\w+) = \2 ([+\-*/%]) ", r"\1\2 \3= "),
        M.braces_to(M.C, ":"),
    ),
    "x_drop_contracts (info)": M.canon_drop_clauses,
}


def items() -> list[dict]:
    tasks, _, by = M.load()
    out: list[dict] = []

    def add(iid, task, prefix, text):
        out.append({"id": iid, "task": task["id"], "tier": task["tier"], "prefix": prefix, "text": M.norm(text)})

    for t in tasks:
        tid = t["id"]
        for m in MODELS:
            s = SHORT[m]
            canon = M.modal(by[(m, "canon", tid)])[0]
            ts = M.modal(by[(m, "typescript", tid)])[0]
            add(f"canon_{s}", t, "hdr:canon", canon)
            add(f"canon_{s}", t, "ref:canon", canon)
            add(f"ts_{s}", t, "hdr:ts", ts)
            for name, f in CANON_EDITS.items():
                new = M.norm(f(canon))
                for pre in ("hdr:canon", "ref:canon"):
                    out.append({"id": f"edit_{s}:{name}", "task": tid, "tier": t["tier"], "prefix": pre, "text": new, "changed": new != M.norm(canon)})
        add("python", t, "hdr:python", (V03 / "tokens/python" / f"{tid}.py").read_text())
        idio = (V03 / "canonpy/idiomatic" / f"{tid}.cnpy").read_text()
        add("cnpy", t, "hdr:canonpy", idio)
        add("cnpy", t, "hdr:python", idio)
        add("cnpy", t, "ref:canonpy", idio)
        add("cnpy_legal", t, "hdr:canonpy", canonpy.legal_dataclass_form(idio))
        tl = V03 / "canonpy/translit" / f"{tid}.cnpy"
        if tl.exists():
            tr = tl.read_text()
            add("cnpy_translit", t, "hdr:canonpy", tr)
            add("cnpy_translit", t, "hdr:python", tr)
            add("cnpy_translit", t, "ref:canonpy", tr)
            add("cnpy_translit_q", t, "hdr:canonpy", canonpy.question_form(tr))
            add("cnpy_translit_legal", t, "hdr:canonpy", canonpy.legal_dataclass_form(tr))
    return out
