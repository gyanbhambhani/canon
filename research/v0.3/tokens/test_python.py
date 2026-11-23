"""Runs every python/<task>.py against the benchmark's own test cases (tasks.json, dumped from
research/benchmark/src/tasks.ts by dump_tasks.mjs).

JSON encodings: Option is null or the value; tuples are arrays; records are plain objects; sum-type
values are {kind, ...fields}; Result is {ok: true, value} | {ok: false, error}. The harness converts
records/sums into the module's dataclasses and converts the return value back to JSON shape.

Run: python3 research/v0.3/tokens/test_python.py
"""

import dataclasses
import importlib.util
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).parent


def load(task_id: str):
    spec = importlib.util.spec_from_file_location(task_id, HERE / "python" / f"{task_id}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def to_py(v, mod, kind_hint):
    """JSON test input -> Python value (dataclasses for declared records and sums)."""
    if isinstance(v, list):
        return [to_py(x, mod, kind_hint) for x in v]
    if isinstance(v, dict):
        if "kind" in v:
            cls = getattr(mod, v["kind"])
            return cls(**{k: x for k, x in v.items() if k != "kind"})
        cls = getattr(mod, kind_hint)  # the task's only record type
        return cls(**{k: to_py(x, mod, kind_hint) for k, x in v.items()})
    return v


def to_json(v):
    """Python return value -> JSON shape."""
    if isinstance(v, (list, tuple)):
        return [to_json(x) for x in v]
    if dataclasses.is_dataclass(v):
        name = type(v).__name__
        if name == "Ok":
            return {"ok": True, "value": to_json(v.value)}
        if name == "Err":
            return {"ok": False, "error": v.error}
        return {k: to_json(x) for k, x in dataclasses.asdict(v).items()}
    return v


def same(a, b):
    if isinstance(a, float) or isinstance(b, float):
        return isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    return type(a) is type(b) and a == b


def main() -> int:
    tasks = json.loads((HERE / "tasks.json").read_text())
    failures = 0
    tested = 0
    for t in tasks:
        path = HERE / "python" / f"{t['id']}.py"
        if not path.exists():
            continue
        mod = load(t["id"])
        fn = getattr(mod, t["fn"])
        record = next((k for k, v in (t.get("typeKinds") or {}).items() if v == "record"), None)
        for args, expected in t["tests"]:
            got = to_json(fn(*[to_py(a, mod, record) for a in args]))
            tested += 1
            if not same(got, expected):
                failures += 1
                print(f"FAIL {t['id']}{args} -> {got!r}, expected {expected!r}")
    n = sum(1 for t in tasks if (HERE / "python" / f"{t['id']}.py").exists())
    print(f"{n} tasks, {tested} cases, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
