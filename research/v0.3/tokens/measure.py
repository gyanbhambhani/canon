"""Where does Canon spend tokens, compared with TypeScript and typed Python?

Inputs
  research/benchmark/results/runs-v0.2.jsonl   final programs (Canon and TypeScript, two models)
  research/v0.3/tokens/python/<task>.py         hand-written typed Python 3.12 equivalents
  research/v0.3/tokens/tasks.json               task specs (dump_tasks.mjs)

Tokenizer: Qwen/Qwen2.5-Coder-1.5B (local cache, HF_HUB_OFFLINE=1). It is a proxy: neither Claude's
nor GPT's tokenizer. Counts exclude special tokens; every program is rstripped and given one final
newline.

Outputs: RESULTS.md and results.json next to this file.

Run: HF_HUB_OFFLINE=1 /Users/gyanb/Desktop/canon/research/likelihood/.venv/bin/python \
       research/v0.3/tokens/measure.py
"""

from __future__ import annotations

import json
import os
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
from transformers import AutoTokenizer  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUNS = ROOT / "research/benchmark/results/runs-v0.2.jsonl"
MODELS = ["claude-opus-5-5", "gpt-6.2-sol"]

TOK = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-Coder-1.5B")
_cache: dict[str, int] = {}


def ntok(text: str) -> int:
    text = norm(text)
    if text not in _cache:
        _cache[text] = len(TOK(text, add_special_tokens=False)["input_ids"])
    return _cache[text]


def norm(text: str) -> str:
    return text.rstrip() + "\n"


# ---------------------------------------------------------------------------
# String masking: transforms never touch the inside of string literals.
# ---------------------------------------------------------------------------

STR_RE = {
    "canon": re.compile(r'"(?:[^"\\\n]|\\.)*"'),
    "ts": re.compile(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`(?:[^`\\]|\\.)*`|/\^[^/\n]*/'),
    "py": re.compile(r'[rf]?"(?:[^"\\\n]|\\.)*"|[rf]?\'(?:[^\'\\\n]|\\.)*\''),
}


def masked(lang: str, code: str, fn):
    """Apply fn to code with string literals replaced by placeholders, then restore them."""
    lits: list[str] = []

    def keep(m):
        lits.append(m.group(0))
        return f"\x00{len(lits) - 1}\x00"

    out = fn(STR_RE[lang].sub(keep, code))
    return re.sub(r"\x00(\d+)\x00", lambda m: lits[int(m.group(1))], out)


def sub(lang, pattern, repl, flags=re.M):
    return lambda code: masked(lang, code, lambda c: re.sub(pattern, repl, c, flags=flags))


def compose(*fs):
    def run(code):
        for f in fs:
            code = f(code)
        return code

    return run


def drop_blank_runs(code: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", code).lstrip("\n")


# ---------------------------------------------------------------------------
# Signature parsing shared by all three languages.
# ---------------------------------------------------------------------------


def split_top(s: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch in "([{<":
            depth += 1
        elif ch in ")]}>" and not (ch == ">" and cur.endswith("-")):
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur)
    return parts


def strip_param_types(params: str) -> str:
    out = []
    for p in split_top(params):
        name, _, rest = p.partition(":")
        default = ""
        if "=" in rest:  # python default values
            default = " =" + rest.split("=", 1)[1]
        out.append(name + default)
    return ",".join(out)


def drop_sig_types(lang: str):
    """Remove parameter and return types from function headers (not from lambdas)."""
    head = {"canon": r"fn \w+(?:\[[^\]]*\])?\(", "ts": r"function \w+(?:<[^>]*>)?\(", "py": r"def \w+(?:\[[^\]]*\])?\("}[lang]

    def run(code: str) -> str:
        out = []
        for line in code.split("\n"):
            m = re.match(r"(\s*(?:export\s+)?(?:async\s+)?)" + head, line)
            if m:
                start = m.end()
                depth, i = 1, start
                while i < len(line) and depth:
                    depth += {"(": 1, ")": -1}.get(line[i], 0)
                    i += 1
                params, tail = line[start : i - 1], line[i:]
                if lang == "canon":
                    tail = re.sub(r"^\s*->\s*.*?(\s*(?:=.*|\{)?)$", r"\1", tail)
                elif lang == "ts":
                    tail = re.sub(r"^\s*:\s*.*?(\s*\{?)$", r"\1", tail)
                else:
                    tail = re.sub(r"^\s*->\s*.*?:$", ":", tail)
                line = line[:start] + strip_param_types(params) + ")" + tail
            out.append(line)
        return "\n".join(out)

    return lambda code: masked(lang, code, run)


# ---------------------------------------------------------------------------
# Brace / block handling (Canon and TS share brace syntax).
# ---------------------------------------------------------------------------


def braces_to(lang: str, opener: str):
    """Turn brace blocks into indentation blocks. opener is what replaces a line-final '{' (':' or '')."""

    def run(code: str) -> str:
        lines = code.split("\n")
        out: list[str] = []
        for line in lines:
            s = line.strip()
            if s == "{":  # Canon: '{' alone after contract clauses
                out[-1] = out[-1] + opener
                continue
            m = re.match(r"^(\s*)\}\s*(else.*?)\s*\{$", line)
            if m:  # '} else {' / '} else if c {'
                out.append(m.group(1) + m.group(2) + opener)
                continue
            if re.fullmatch(r"\}[;,]?", s):
                continue
            m = re.match(r"^(\s*)\}(.*)$", line)
            if m and m.group(2).strip() in (")", "),", ");", ")\n"):
                out.append(m.group(1) + m.group(2).strip())
                continue
            if line.rstrip().endswith("{") and not line.rstrip().endswith("${"):
                out.append(line.rstrip()[:-1].rstrip() + opener)
                continue
            out.append(line)
        return "\n".join(out)

    return lambda code: masked(lang, code, run)


def remove_comments(lang):
    pat = {"canon": r"^[ \t]*#.*\n", "ts": r"^[ \t]*//.*\n|[ \t]*//.*$", "py": r"^[ \t]*#.*\n|[ \t]+#.*$"}[lang]
    return sub(lang, pat, "")


def strip_indent(lang):
    return sub(lang, r"^[ \t]+", "")


def remove_type_decls(lang):
    """Delete type declarations together with the blank lines that follow them."""
    if lang == "canon":
        def run(code):
            # records: 'type X {' .. '}' ; sums: 'type X =' then '  | ...' lines
            code = re.sub(r"^type \w+(?:\[[^\]]*\])? \{\n(?:  .*\n)*?\}\n\n*", "", code, flags=re.M)
            code = re.sub(r"^type \w+(?:\[[^\]]*\])? =.*\n(?:  \|.*\n)*\n*", "", code, flags=re.M)
            return code
        return run
    if lang == "ts":
        def run(code):
            code = re.sub(r"^(?:export )?(?:type \w+(?:<[^>]*>)? =[\s\S]*?;[ \t]*$|interface \w+ \{[\s\S]*?\n\})\n\n*", "", code, flags=re.M)
            return code
        return run

    def run(code):
        code = re.sub(r"^from dataclasses import dataclass\n\n*", "", code, flags=re.M)
        code = re.sub(r"^@dataclass\nclass .*:\n(?:    .*\n)*\n*", "", code, flags=re.M)
        code = re.sub(r"^type \w+.*\n\n*", "", code, flags=re.M)
        return code
    return run


def remove_result_decl(lang):
    """Only the Result helper (Canon has it built in; TS got it in the prompt; Python must write it)."""
    if lang == "ts":
        return lambda c: re.sub(r"^type Result<T> =.*\n\n*", "", c, flags=re.M)
    if lang == "py":
        def run(c):
            c = re.sub(r"^@dataclass\nclass (Ok|Err)\b.*:\n(?:    .*\n)*\n*", "", c, flags=re.M)
            c = re.sub(r"^type Result\b.*\n\n*", "", c, flags=re.M)
            return c
        return run
    return lambda c: c


def remove_helper_headers(lang: str, main_fn: str):
    head = {"canon": r"^fn (\w+)", "ts": r"^(?:export )?function (\w+)", "py": r"^def (\w+)"}[lang]

    def run(code):
        out, lines, i = [], code.split("\n"), 0
        while i < len(lines):
            m = re.match(head, lines[i])
            if m and m.group(1) != main_fn:
                # Canon headers may continue with clause lines and a lone '{'
                if lang == "canon" and not lines[i].rstrip().endswith("{"):
                    i += 1
                    while i < len(lines) and lines[i].strip() != "{":
                        i += 1
                i += 1
                continue
            out.append(lines[i])
            i += 1
        return "\n".join(out)

    return run


def helper_count(lang: str, code: str, main_fn: str) -> int:
    head = {"canon": r"^fn (\w+)", "ts": r"^(?:export )?function (\w+)|^const (\w+) = \(", "py": r"^def (\w+)"}[lang]
    names = [next(g for g in m.groups() if g) for m in re.finditer(head, code, flags=re.M)]
    return sum(1 for n in names if n != main_fn)


# ---------------------------------------------------------------------------
# Canon-specific transforms.
# ---------------------------------------------------------------------------

C = "canon"
canon_drop_let = sub(C, r"^(\s*)let ", r"\1")
canon_drop_var = sub(C, r"^(\s*)var ", r"\1")
canon_drop_return = sub(C, r"^(\s*)return ", r"\1")
canon_join_pipeline = sub(C, r"\n[ \t]+\|> ", " |> ")
canon_drop_pipe_op = sub(C, r"\s*\|> ", " ")


def canon_drop_clauses(code):
    code = re.sub(r"^[ \t]+(effects|requires|ensures):.*\n", "", code, flags=re.M)
    return re.sub(r"\n\{\n", " {\n", code)


canon_match_commas = sub(C, r"^(.*=>.*),[ \t]*$", r"\1")
canon_match_closer_commas = sub(C, r"^([ \t]*\}),[ \t]*$", r"\1")
canon_match_arrow = sub(C, r" => ", " ")
canon_logic_ops = compose(
    sub(C, r"\band\b", "&&"),
    sub(C, r"\bor\b", "||"),
    sub(C, r"\bnot ", "!"),
)


def fn_bodies(lines: list[str]):
    """Yield (header_idx, body_start, body_end) for top-level brace-bodied fns; body_end is the '}' line."""
    i = 0
    while i < len(lines):
        if lines[i].startswith("fn "):
            h = i
            while i < len(lines) and not lines[i].rstrip().endswith("{"):
                i += 1
            start = i + 1
            j = start
            while j < len(lines) and lines[j] != "}":
                j += 1
            yield h, i, start, j
            i = j + 1
        else:
            i += 1


def top_statements(lines, start, end):
    """Indices of lines at body indent (2) that begin a statement."""
    return [k for k in range(start, end) if re.match(r"^  \S", lines[k]) and not re.match(r"^  [}\)\]|]", lines[k]) and not lines[k].startswith("  #")]


def canon_implicit_return(code):
    def run(c):
        lines = c.split("\n")
        for _, _, start, end in list(fn_bodies(lines)):
            st = top_statements(lines, start, end)
            if st and lines[st[-1]].startswith("  return "):
                lines[st[-1]] = "  " + lines[st[-1]][len("  return "):]
        return "\n".join(lines)

    return masked(C, code, run)


def canon_expr_fns(code):
    """fn f(..) -> T { return e } (one top-level statement) -> fn f(..) -> T = e."""

    def run(c):
        lines = c.split("\n")
        for h, brace, start, end in reversed(list(fn_bodies(lines))):
            st = top_statements(lines, start, end)
            if len(st) != 1 or st[0] != start:
                continue
            first = lines[start][2:]
            if first.startswith("return "):
                first = first[len("return "):]
            if re.match(r"(let|var|if|for|while) ", first) or re.match(r"\w+ = ", first):
                continue
            body = [first] + [ln[2:] if ln.startswith("  ") else ln for ln in lines[start + 1 : end]]
            hdr = lines[h : brace + 1]
            hdr[-1] = hdr[-1].rstrip()
            if hdr[-1] == "{":
                hdr = hdr[:-1]
            else:
                hdr[-1] = hdr[-1][:-1].rstrip()
            hdr[-1] = hdr[-1] + " = " + body[0]
            lines[h : end + 1] = hdr + body[1:]
        return "\n".join(lines)

    return masked(C, code, run)


# ---------------------------------------------------------------------------
# TS- and Python-specific transforms.
# ---------------------------------------------------------------------------

T, P = "ts", "py"
ts_drop_local_types = compose(
    sub(T, r"\b((?:const|let|var) \w+): [^=;]+?( =|;)", r"\1\2"),
    sub(T, r" as (?:number|string|boolean|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?)\b", ""),
    sub(T, r"(\w|\]|\))!(?=[.;,)\]\s])", r"\1"),
)
ts_drop_decl_kw = sub(T, r"\b(const|let|var) (?=[\w\[{])", "")
ts_drop_semicolons = sub(T, r";[ \t]*$", "")
ts_drop_export = sub(T, r"^export ", "")
ts_drop_return = sub(T, r"^(\s*)return\b ?", r"\1")
ts_drop_ctrl_parens = sub(T, r"^(\s*(?:\} )?(?:if|while|else if|for)) \((.*)\) \{$", r"\1 \2 {")
py_drop_local_types = sub(P, r"^(\s*\w+): [^=\n]+ =", r"\1 =")
py_drop_return = sub(P, r"^(\s*)return\b ?", r"\1")
py_drop_colons = sub(P, r":[ \t]*$", "")


# ---------------------------------------------------------------------------
# Data.
# ---------------------------------------------------------------------------


def load():
    tasks = json.loads((HERE / "tasks.json").read_text())
    runs = [json.loads(l) for l in RUNS.read_text().splitlines() if l.strip()]
    runs = [r for r in runs if not r.get("fallback")]
    by = defaultdict(list)
    for r in runs:
        by[(r["model"], r["lang"], r["task"])].append(r)
    return tasks, runs, by


def modal(rs):
    counts = Counter(norm(r["final"]) for r in rs)
    best = max(counts.values())
    for r in sorted(rs, key=lambda r: r["run"]):
        if counts[norm(r["final"])] == best:
            return norm(r["final"]), best
    raise AssertionError


def delta(code: str, f) -> int:
    return ntok(code) - ntok(f(code))


def attribution(lang: str, code: str, fn: str) -> dict[str, int]:
    a: dict[str, int] = {}
    if lang == "canon":
        a["block braces (+ their newline/indent)"] = delta(code, braces_to(C, ""))
        a["block braces -> ':' (net)"] = delta(code, braces_to(C, ":"))
        a["signature types"] = delta(code, drop_sig_types(C))
        a["let keyword"] = delta(code, canon_drop_let)
        a["var keyword"] = delta(code, canon_drop_var)
        a["return keyword"] = delta(code, canon_drop_return)
        a["requires/ensures/effects clauses"] = delta(code, canon_drop_clauses)
        a["pipeline layout (line breaks + indent)"] = delta(code, canon_join_pipeline)
        a["|> operators (as ' ')"] = delta(code, compose(canon_join_pipeline, canon_drop_pipe_op)) - a["pipeline layout (line breaks + indent)"]
        a["match arm trailing commas"] = delta(code, compose(canon_match_commas, canon_match_closer_commas))
        a["match `=>` (as ' ')"] = delta(code, canon_match_arrow)
        a["and/or/not as words vs &&/||/!"] = delta(code, canon_logic_ops)
        a["type declarations"] = delta(code, remove_type_decls(C))
        a["helper fn headers"] = delta(code, remove_helper_headers(C, fn))
        a["comments"] = delta(code, remove_comments(C))
        a["indentation whitespace"] = delta(code, strip_indent(C))
    elif lang == "typescript":
        a["block braces (+ their newline/indent)"] = delta(code, braces_to(T, ""))
        a["signature types"] = delta(code, drop_sig_types(T))
        a["local annotations / as / !"] = delta(code, ts_drop_local_types)
        a["const/let keyword"] = delta(code, ts_drop_decl_kw)
        a["return keyword"] = delta(code, ts_drop_return)
        a["semicolons"] = delta(code, ts_drop_semicolons)
        a["export"] = delta(code, ts_drop_export)
        a["parens around if/while/for conditions"] = delta(code, ts_drop_ctrl_parens)
        a["type declarations"] = delta(code, remove_type_decls(T))
        a["  of which Result decl"] = delta(code, remove_result_decl(T))
        a["helper fn headers"] = delta(code, remove_helper_headers(T, fn))
        a["comments"] = delta(code, remove_comments(T))
        a["indentation whitespace"] = delta(code, strip_indent(T))
    else:
        a["block colons"] = delta(code, py_drop_colons)
        a["signature types"] = delta(code, drop_sig_types(P))
        a["local annotations"] = delta(code, py_drop_local_types)
        a["return keyword"] = delta(code, py_drop_return)
        a["type declarations"] = delta(code, remove_type_decls(P))
        a["  of which Result decl"] = delta(code, remove_result_decl(P))
        a["helper fn headers"] = delta(code, remove_helper_headers(P, fn))
        a["comments"] = delta(code, remove_comments(P))
        a["indentation whitespace"] = delta(code, strip_indent(P))
    return a


HYPOTHETICALS = {
    "a: &&/||/! for and/or/not": canon_logic_ops,
    "b: single-expression fns `fn f(..) -> T = e`": canon_expr_fns,
    "c: indentation blocks (`:`) instead of braces": braces_to(C, ":"),
    "d: drop `let` (bare `x = e`)": canon_drop_let,
    "d': drop `let` and `var`": compose(canon_drop_let, canon_drop_var),
    "e: implicit final-expression return": canon_implicit_return,
    "f (extra): compound assignment `x += e`": sub(C, r"^(\s*)(\w+) = \2 ([+\-*/%]) ", r"\1\2 \3= "),
    "a+b+d+e": compose(canon_logic_ops, canon_implicit_return, canon_expr_fns, canon_drop_let),
    "a+b+c+d+e": compose(canon_logic_ops, canon_implicit_return, canon_expr_fns, canon_drop_let, braces_to(C, ":")),
    "a+b+c+d+e+f": compose(canon_logic_ops, canon_implicit_return, canon_expr_fns, canon_drop_let, braces_to(C, ":"), sub(C, r"^(\s*)(\w+) = \2 ([+\-*/%]) ", r"\1\2 \3= ")),
}


def mean(xs):
    return statistics.fmean(xs) if xs else float("nan")


def main():
    tasks, runs, by = load()
    tier = {t["id"]: t["tier"] for t in tasks}
    fname = {t["id"]: t["fn"] for t in tasks}
    py = {t["id"]: norm((HERE / "python" / f"{t['id']}.py").read_text()) for t in tasks if (HERE / "python" / f"{t['id']}.py").exists()}
    py_untyped = {k: drop_sig_types(P)(py_drop_local_types(v)) for k, v in py.items()}

    # ---- 1. tokens per program (modal final) ----
    per_task = {}
    for t in tasks:
        tid = t["id"]
        row = {"tier": t["tier"], "python": ntok(py[tid]) if tid in py else None, "python_untyped": ntok(py_untyped[tid]) if tid in py else None}
        for m in MODELS:
            for lang in ("canon", "typescript"):
                rs = by[(m, lang, tid)]
                code, k = modal(rs)
                row[f"{m}|{lang}"] = ntok(code)
                row[f"{m}|{lang}|modal_share"] = k / len(rs)
                row[f"{m}|{lang}|all_runs_mean"] = mean([ntok(r["final"]) for r in rs])
        per_task[tid] = row

    def summarize(key, tiers=("basic", "hard")):
        vals = [r[key] for r in per_task.values() if r["tier"] in tiers and r.get(key) is not None]
        return mean(vals)

    headline = {}
    for scope, tiers in (("all", ("basic", "hard")), ("basic", ("basic",)), ("hard", ("hard",))):
        h = {}
        for m in MODELS:
            for lang in ("canon", "typescript"):
                h[f"{m}|{lang}"] = summarize(f"{m}|{lang}", tiers)
                h[f"{m}|{lang}|all_runs_mean"] = summarize(f"{m}|{lang}|all_runs_mean", tiers)
                h[f"{m}|{lang}|median"] = statistics.median([r[f"{m}|{lang}"] for r in per_task.values() if r["tier"] in tiers])
        h["python|median"] = statistics.median([r["python"] for r in per_task.values() if r["tier"] in tiers])
        h["python"] = summarize("python", tiers)
        h["python_untyped"] = summarize("python_untyped", tiers)
        h["n_tasks"] = sum(1 for r in per_task.values() if r["tier"] in tiers)
        headline[scope] = h

    # ---- 2. attribution (modal programs) ----
    attr = {}  # (source) -> scope -> category -> mean tokens/program
    attr_rows = defaultdict(lambda: defaultdict(list))
    helpers = defaultdict(list)
    for t in tasks:
        tid, fn = t["id"], t["fn"]
        sources = {f"{m}|{lang}": modal(by[(m, lang, tid)])[0] for m in MODELS for lang in ("canon", "typescript")}
        sources["python"] = py[tid]
        for src, code in sources.items():
            lang = "python" if src == "python" else src.split("|")[1]
            a = attribution(lang, code, fn)
            a["TOTAL"] = ntok(code)
            for k, v in a.items():
                attr_rows[src][(t["tier"], k)].append(v)
            helpers[src].append(helper_count({"canon": C, "typescript": T, "python": P}[lang], code, fn))
    for src, d in attr_rows.items():
        attr[src] = {}
        for scope, tiers in (("all", ("basic", "hard")), ("basic", ("basic",)), ("hard", ("hard",))):
            cats = sorted({k for (_, k) in d}, key=lambda k: list(dict.fromkeys(k2 for (_, k2) in d)).index(k))
            attr[src][scope] = {k: mean([v for tr in tiers for v in d.get((tr, k), [])]) for k in cats}
        attr[src]["helpers_per_program"] = mean(helpers[src])

    # ---- 3. hypotheticals on Canon ----
    hyp = {}
    examples = {}
    for m in MODELS:
        hyp[m] = {}
        for scope, tiers in (("all", ("basic", "hard")), ("basic", ("basic",)), ("hard", ("hard",))):
            base = []
            res = defaultdict(list)
            for t in tasks:
                if t["tier"] not in tiers:
                    continue
                code = modal(by[(m, "canon", t["id"])])[0]
                base.append(ntok(code))
                for name, f in HYPOTHETICALS.items():
                    new = f(code)
                    res[name].append(ntok(code) - ntok(new))
                    if scope == "all" and t["id"] in ("report_card", "chunk", "balanced_parens") and m == "claude-opus-5-5":
                        examples.setdefault(name, {})[t["id"]] = norm(new)
            b = mean(base)
            hyp[m][scope] = {"baseline": b, **{k: {"saved": mean(v), "pct": 100 * mean(v) / b} for k, v in res.items()}}

    # ---- 4. output tokens vs code tokens ----
    out = {}
    for m in MODELS:
        for lang in ("canon", "typescript"):
            rs = [r for r in runs if r["model"] == m and r["lang"] == lang]
            r0 = [r for r in rs if r["fixRounds"] == 0]
            code0 = mean([ntok(r["final"]) for r in r0])
            out0 = mean([r["usage"]["output"] for r in r0])
            out[f"{m}|{lang}"] = {
                "runs": len(rs),
                "mean_output_all_runs": mean([r["usage"]["output"] for r in rs]),
                "first_pass_runs": len(r0),
                "mean_output_first_pass": out0,
                "mean_code_tokens_first_pass_qwen": code0,
                "code_share_first_pass": code0 / out0,
                "by_tier": {
                    tr: {
                        "mean_output": mean([r["usage"]["output"] for r in r0 if tier[r["task"]] == tr]),
                        "mean_code_qwen": mean([ntok(r["final"]) for r in r0 if tier[r["task"]] == tr]),
                    }
                    for tr in ("basic", "hard")
                },
            }

    result = {
        "tokenizer": "Qwen/Qwen2.5-Coder-1.5B",
        "headline": headline,
        "per_task": per_task,
        "attribution": attr,
        "hypotheticals": hyp,
        "output_vs_code": out,
        "examples": examples,
    }
    (HERE / "results.json").write_text(json.dumps(result, indent=1))
    write_md(result)
    print((HERE / "RESULTS.md").read_text())


def f1(x):
    return f"{x:.1f}"


def write_md(R):
    H, A, Y, O = R["headline"], R["attribution"], R["hypotheticals"], R["output_vs_code"]
    L = []
    w = L.append
    w("# Canon v0.2 token spend vs TypeScript and typed Python\n")
    w("Generated by `measure.py`. Tokenizer: **Qwen2.5-Coder-1.5B** (local, offline) as a proxy; Claude and GPT tokenizers differ. ")
    w("Canon/TS programs: the modal (most frequent) final program per (model, task) from `runs-v0.2.jsonl` (10 runs each, all passing). ")
    w("Python: one hand-written typed Python 3.12 program per task (`python/`, all 50 pass `test_python.py`).\n")
    w("## 1. Tokens per program\n")
    w("| scope | n | Canon (Claude) | TS (Claude) | Canon (GPT) | TS (GPT) | Python typed | Python untyped |")
    w("|---|---|---|---|---|---|---|---|")
    for s in ("all", "basic", "hard"):
        h = H[s]
        w(f"| {s} | {h['n_tasks']} | {f1(h['claude-opus-5-5|canon'])} | {f1(h['claude-opus-5-5|typescript'])} | {f1(h['gpt-6.2-sol|canon'])} | {f1(h['gpt-6.2-sol|typescript'])} | {f1(h['python'])} | {f1(h['python_untyped'])} |")
    w("\nMedian over tasks (modal programs), less sensitive to a few outliers (e.g. GPT's bignum collatz_steps, hand-rolled integer parsing):\n")
    w("| scope | Canon (Claude) | TS (Claude) | Canon (GPT) | TS (GPT) | Python typed |")
    w("|---|---|---|---|---|---|")
    for s in ("all", "basic", "hard"):
        h = H[s]
        w(f"| {s} | {f1(h['claude-opus-5-5|canon|median'])} | {f1(h['claude-opus-5-5|typescript|median'])} | {f1(h['gpt-6.2-sol|canon|median'])} | {f1(h['gpt-6.2-sol|typescript|median'])} | {f1(h['python|median'])} |")
    w("\nSame, but mean over all 10 runs instead of the modal program:\n")
    w("| scope | Canon (Claude) | TS (Claude) | Canon (GPT) | TS (GPT) |")
    w("|---|---|---|---|---|")
    for s in ("all", "basic", "hard"):
        h = H[s]
        w(f"| {s} | {f1(h['claude-opus-5-5|canon|all_runs_mean'])} | {f1(h['claude-opus-5-5|typescript|all_runs_mean'])} | {f1(h['gpt-6.2-sol|canon|all_runs_mean'])} | {f1(h['gpt-6.2-sol|typescript|all_runs_mean'])} |")

    w("\n## 2. Attribution (tokens/program, mean over 50 tasks, modal programs)\n")
    w("Each figure is `tokens(program) - tokens(program with that construct removed/rewritten)`. Categories overlap (e.g. indentation inside braces), so they do not sum to the total.\n")
    for src in ("claude-opus-5-5|canon", "gpt-6.2-sol|canon", "claude-opus-5-5|typescript", "gpt-6.2-sol|typescript", "python"):
        a = A[src]
        w(f"### {src} (helper fns/program: {a['helpers_per_program']:.2f})\n")
        w("| category | all | basic | hard |")
        w("|---|---|---|---|")
        for k in a["all"]:
            w(f"| {k} | {f1(a['all'][k])} | {f1(a['basic'][k])} | {f1(a['hard'][k])} |")
        w("")

    w("## 3. Where Canon spends tokens Python does not (all 50 tasks, tokens/program)\n")
    cc = {m: A[f"{m}|canon"]["all"] for m in ("claude-opus-5-5", "gpt-6.2-sol")}
    pa = A["python"]["all"]
    tc = {m: A[f"{m}|typescript"]["all"] for m in ("claude-opus-5-5", "gpt-6.2-sol")}
    rows = [
        ("block delimiters", "block braces (+ their newline/indent)", "block colons", "block braces (+ their newline/indent)"),
        ("signature types", "signature types", "signature types", "signature types"),
        ("local annotations", None, "local annotations", "local annotations / as / !"),
        ("binding keywords", ("let keyword", "var keyword"), None, "const/let keyword"),
        ("return keyword", "return keyword", "return keyword", "return keyword"),
        ("contracts", "requires/ensures/effects clauses", None, None),
        ("pipeline line breaks", "pipeline layout (line breaks + indent)", None, None),
        ("match trailing commas", "match arm trailing commas", None, None),
        ("and/or/not words (vs &&/||/!)", "and/or/not as words vs &&/||/!", None, None),
        ("type declarations", "type declarations", "type declarations", "type declarations"),
        ("helper fn headers", "helper fn headers", "helper fn headers", "helper fn headers"),
        ("indentation whitespace", "indentation whitespace", "indentation whitespace", "indentation whitespace"),
        ("comments", "comments", "comments", "comments"),
        ("semicolons / export / cond parens", None, None, ("semicolons", "export", "parens around if/while/for conditions")),
    ]

    def get(d, k):
        if k is None:
            return 0.0
        if isinstance(k, tuple):
            return sum(d.get(x, 0.0) for x in k)
        return d.get(k, 0.0)

    w("| category | Canon Claude | Canon GPT | Python | TS Claude | TS GPT | Canon - Python (avg of models) |")
    w("|---|---|---|---|---|---|---|")
    explained = 0.0
    for label, ck, pk, tk in rows:
        c1, c2, p = get(cc["claude-opus-5-5"], ck), get(cc["gpt-6.2-sol"], ck), get(pa, pk)
        t1, t2 = get(tc["claude-opus-5-5"], tk), get(tc["gpt-6.2-sol"], tk)
        if label != "indentation whitespace":  # overlaps with block delimiters (brace lines)
            explained += (c1 + c2) / 2 - p
        w(f"| {label} | {f1(c1)} | {f1(c2)} | {f1(p)} | {f1(t1)} | {f1(t2)} | {f1((c1 + c2) / 2 - p)} |")
    gap = (cc["claude-opus-5-5"]["TOTAL"] + cc["gpt-6.2-sol"]["TOTAL"]) / 2 - pa["TOTAL"]
    w(f"| *residual: gap not explained by the rows above (indentation row excluded, it overlaps braces)* | | | | | | {f1(gap - explained)} |")
    w(f"| **total program** | {f1(cc['claude-opus-5-5']['TOTAL'])} | {f1(cc['gpt-6.2-sol']['TOTAL'])} | {f1(pa['TOTAL'])} | {f1(tc['claude-opus-5-5']['TOTAL'])} | {f1(tc['gpt-6.2-sol']['TOTAL'])} | {f1((cc['claude-opus-5-5']['TOTAL'] + cc['gpt-6.2-sol']['TOTAL']) / 2 - pa['TOTAL'])} |")
    w(f"| helper fns per program | {A['claude-opus-5-5|canon']['helpers_per_program']:.2f} | {A['gpt-6.2-sol|canon']['helpers_per_program']:.2f} | {A['python']['helpers_per_program']:.2f} | {A['claude-opus-5-5|typescript']['helpers_per_program']:.2f} | {A['gpt-6.2-sol|typescript']['helpers_per_program']:.2f} | |")

    w("\n## 4. Hypothetical v0.3 syntax changes, applied textually to the modal Canon programs\n")
    w("Tokens saved per program (and % of the v0.2 program).\n")
    w("| change | Claude all | Claude basic | Claude hard | GPT all | GPT basic | GPT hard |")
    w("|---|---|---|---|---|---|---|")
    w("| *baseline tokens* | " + " | ".join(f1(Y[m][s]["baseline"]) for m in MODELS for s in ("all", "basic", "hard")) + " |")
    for k in HYPOTHETICALS:
        w(f"| {k} | " + " | ".join(f"{Y[m][s][k]['saved']:.1f} ({Y[m][s][k]['pct']:.1f}%)" for m in MODELS for s in ("all", "basic", "hard")) + " |")

    w("\n## 5. Output tokens vs code tokens\n")
    w("`usage.output` is billed output (Claude: adaptive thinking at effort medium + text; GPT: reasoning + text), summed over fix rounds. ")
    w("Code tokens are Qwen counts of the final program, so the share is a **proxy**: Claude's and GPT's tokenizers differ from Qwen's (and the reply's fence/prose is not stored). First-pass runs only (fixRounds = 0), so the reply holds one program.\n")
    w("| model / lang | first-pass runs | mean output tokens | mean code tokens (Qwen) | code share | basic output / code | hard output / code |")
    w("|---|---|---|---|---|---|---|")
    for k, o in O.items():
        b, h = o["by_tier"]["basic"], o["by_tier"]["hard"]
        w(f"| {k} | {o['first_pass_runs']} | {f1(o['mean_output_first_pass'])} | {f1(o['mean_code_tokens_first_pass_qwen'])} | {100 * o['code_share_first_pass']:.0f}% | {f1(b['mean_output'])} / {f1(b['mean_code_qwen'])} | {f1(h['mean_output'])} / {f1(h['mean_code_qwen'])} |")
    w("\n(Mean output over all runs including fix rounds: " + ", ".join(f"{k} {f1(o['mean_output_all_runs'])}" for k, o in O.items()) + ".)\n")
    w("## Caveats\n")
    w("- Qwen2.5-Coder BPE is a proxy. It merges `{\\n`, `:\\n`, `,\\n` and ` and`/` &&` into single tokens, which is why `:` vs `{`, trailing commas and word operators measure ~0; another tokenizer may differ by a token here and there.")
    w("- Python is one hand-written program per task by the analyst, not model output; it is idiomatic (comprehensions, slicing, `str.count`, `re.fullmatch`) and has no comments, docstrings or helpers. Model-written Python would likely be longer. Treat it as a lower bound for a typed mainstream language.")
    w("- Python pays for its declarations: dataclasses for records/variants and an `Ok`/`Err` Result (Canon has Result built in; TS got the Result type in its prompt).")
    w("- Attribution figures are textual ablations on whole programs; categories overlap and the hypothetical rewrites are approximate (e.g. (e) only strips a `return` that is the last top-level statement; (b) only fires on bodies with one top-level statement).")
    w("- The large residual in section 3 is semantic, not syntactic: no indexing/slicing/methods, missing stdlib (character tests, regex, string repeat/count), 53-bit Int caution (GPT wrote bignum Collatz), more helper functions, and hand-rolled integer validation.")
    (HERE / "RESULTS.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
