"""Canon-Py prototype support: desugar to Python 3.12+, a runtime shim, and textual variants.

Desugaring (the only non-Python syntax in Canon-Py):
  type T = A(f: t, ...) | B(...)      -> one @dataclass per variant + `type T = A | B`
  @requires(expr) / @ensures(expr)    -> dropped for execution (the checker would enforce them)
  @effects(io, ...)                   -> dropped for execution
  try_(e)                             -> runtime: unwrap Ok, or return the Err from the enclosing def
  e?                                  -> (variant spelling of try_; text only, not executed)
"""

from __future__ import annotations

import re
import sys
import types
from dataclasses import dataclass

VARIANT = re.compile(r"(\w+)\(([^()]*)\)")


def _split_variants(rhs: str) -> list[str]:
    rhs = rhs.strip()
    if rhs.startswith("(") and rhs.endswith(")"):
        rhs = rhs[1:-1]
    return [v.strip() for v in rhs.replace("\n", " ").split("|") if v.strip()]


def expand_sums(src: str) -> str:
    """Rewrite compact `type T = A(x: int) | B(...)` declarations as legal Python dataclasses."""

    def repl(m: re.Match) -> str:
        name, rhs = m.group(1), m.group(2)
        variants = _split_variants(rhs)
        if not all(VARIANT.fullmatch(v) for v in variants):
            return m.group(0)  # plain alias such as `type X = A | B`
        out = ["from dataclasses import dataclass\n\n\n"] if "from dataclasses import" not in src else []
        names = []
        for v in variants:
            vm = VARIANT.fullmatch(v)
            names.append(vm.group(1))
            fields = [f.strip() for f in vm.group(2).split(",") if f.strip()]
            body = "\n".join(f"    {f}" for f in fields) or "    pass"
            out.append(f"@dataclass\nclass {vm.group(1)}:\n{body}\n\n\n")
        out.append(f"type {name} = {' | '.join(names)}\n")
        return "".join(out)

    return re.sub(r"^type (\w+) = (\([\s\S]*?\n\)|[^\n]*)\n", repl, src, flags=re.M)


def legal_dataclass_form(src: str) -> str:
    """Canon-Py text with sums spelled as legal Python dataclasses (records stay as written)."""
    out = expand_sums(src)
    if "@dataclass" in out and "from dataclasses import dataclass" not in out:
        out = "from dataclasses import dataclass\n\n\n" + out
    return re.sub(r"(from dataclasses import dataclass\n)\n*(from dataclasses import dataclass\n)\n*", r"\1\n\n", out)


def question_form(src: str) -> str:
    """`try_(e)` -> `e?` (postfix propagation spelling)."""
    out, i = [], 0
    while True:
        j = src.find("try_(", i)
        if j < 0:
            out.append(src[i:])
            return "".join(out)
        out.append(src[i:j])
        k, depth = j + len("try_("), 1
        while depth:
            depth += {"(": 1, ")": -1}.get(src[k], 0)
            k += 1
        out.append(src[j + len("try_(") : k - 1] + "?")
        i = k


# ---------------------------------------------------------------------------
# Runtime shim
# ---------------------------------------------------------------------------


@dataclass
class Ok[T]:
    value: T


@dataclass
class Err[E]:
    error: E


type Result[T, E] = Ok[T] | Err[E]


class _Propagate(Exception):
    def __init__(self, err: Err) -> None:
        self.err = err


def try_(r):
    if isinstance(r, Err):
        raise _Propagate(r)
    return r.value


def _catches(f):
    def wrapper(*args):
        try:
            return f(*args)
        except _Propagate as p:
            return p.err

    wrapper.__name__ = f.__name__
    return wrapper


def parse_int(s: str) -> int | None:
    """Canon-Py builtin: an optional leading minus sign then ASCII digits, else None."""
    return int(s) if re.fullmatch(r"-?[0-9]+", s) else None


def to_python(src: str) -> str:
    src = expand_sums(src)
    src = re.sub(r"^@(requires|ensures|effects)\(.*\)\n", "", src, flags=re.M)
    return re.sub(r"^def ", "@_catches\ndef ", src, flags=re.M)


def load(path, name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    mod.__dict__.update(Ok=Ok, Err=Err, Result=Result, try_=try_, parse_int=parse_int, _catches=_catches, dataclass=dataclass)
    sys.modules[name] = mod
    exec(compile(to_python(open(path).read()), str(path), "exec"), mod.__dict__)
    return mod
