"""Runs canonpy/idiomatic/*.cnpy and canonpy/translit/*.cnpy against the benchmark tests.

Reuses the JSON <-> value conversion of ../tokens/test_python.py; programs are desugared by canonpy.py.
Run: python3 research/v0.3/canonpy/test_canonpy.py
"""

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import canonpy  # noqa: E402

spec = importlib.util.spec_from_file_location("tp", HERE.parent / "tokens" / "test_python.py")
tp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tp)


def main() -> int:
    tasks = json.loads((HERE.parent / "tokens" / "tasks.json").read_text())
    bad = 0
    for sub in ("idiomatic", "translit"):
        n = cases = 0
        for t in tasks:
            path = HERE / sub / f"{t['id']}.cnpy"
            if not path.exists():
                continue
            n += 1
            mod = canonpy.load(path, f"cnpy_{sub}_{t['id']}")
            fn = getattr(mod, t["fn"])
            record = next((k for k, v in (t.get("typeKinds") or {}).items() if v == "record"), None)
            for args, expected in t["tests"]:
                cases += 1
                got = tp.to_json(fn(*[tp.to_py(a, mod, record) for a in args]))
                if not tp.same(got, expected):
                    bad += 1
                    print(f"FAIL {sub}/{t['id']}{args} -> {got!r}, expected {expected!r}")
        print(f"{sub}: {n} programs, {cases} cases")
    print(f"{bad} failures")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
