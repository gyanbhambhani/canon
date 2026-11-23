"""Property testing for the Python arm, the counterpart of `canon test` contract fuzzing.

Canon fuzzes every pure function that declares a contract, discarding inputs that fail its own
`requires`, and reports any other trap. Here: every top-level function of main.py whose body
contains an `assert` statement (the model's own contract) and whose parameters are all annotated
is run by Hypothesis on inputs drawn from its type hints. An AssertionError raised by one of the
function's leading asserts is a failed precondition (the input is discarded, like Canon's R001);
any other exception is a failure, reported with its counterexample.

stdin: {"path": dir, "examples": int}; stdout: one JSON line: [{"fn", "args", "error"}...]
Same sandbox limits as py_harness.py (no network, memory and CPU limits).
"""

import ast
import json
import resource
import socket
import sys
import traceback
import typing


def _no_network(*_a: object, **_k: object) -> None:
    raise PermissionError("network access is disabled in the sandbox")


socket.socket.connect = _no_network  # type: ignore[assignment, method-assign]
socket.create_connection = _no_network  # type: ignore[assignment]
socket.getaddrinfo = _no_network  # type: ignore[assignment]
try:
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
except (ValueError, OSError):
    pass

from hypothesis import HealthCheck, assume, given, settings  # noqa: E402
from hypothesis import strategies as st  # noqa: E402

req = json.load(sys.stdin)
path = req["path"] + "/main.py"
src = open(path, encoding="utf8").read()
tree = ast.parse(src)

import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("main", path)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
sys.modules["main"] = mod
spec.loader.exec_module(mod)

targets: list[tuple[str, set[int]]] = []
for node in tree.body:
    if not isinstance(node, ast.FunctionDef):
        continue
    if not any(isinstance(n, ast.Assert) for n in ast.walk(node)):
        continue
    if any(a.annotation is None for a in node.args.args) or not node.args.args:
        continue
    leading: set[int] = set()
    body = node.body
    if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant):
        body = body[1:]  # docstring
    for stmt in body:
        if isinstance(stmt, ast.Assert):
            leading.add(stmt.lineno)
        else:
            break
    targets.append((node.name, leading))

failures = []
for name, leading in targets:
    fn = getattr(mod, name)
    try:
        hints = typing.get_type_hints(fn)
        strategies = [st.from_type(hints[a]) for a in fn.__code__.co_varnames[: fn.__code__.co_argcount]]
    except Exception as e:  # noqa: BLE001 - an unfuzzable signature is skipped, as in Canon
        continue
    found: list[dict[str, object]] = []

    @settings(max_examples=int(req.get("examples", 100)), deadline=None, database=None, derandomize=True,
              suppress_health_check=list(HealthCheck))
    @given(st.tuples(*strategies))
    def prop(args: tuple[object, ...]) -> None:
        try:
            fn(*args)
        except AssertionError:
            tb = traceback.extract_tb(sys.exc_info()[2])
            last = tb[-1]
            if last.filename == path and last.name == name and last.lineno in leading:
                assume(False)
            found.append({"fn": name, "args": repr(args)[:300], "error": "AssertionError at line %d" % last.lineno})
            raise
        except RecursionError:
            found.append({"fn": name, "args": repr(args)[:300], "error": "RecursionError"})
            raise
        except Exception as e:
            found.append({"fn": name, "args": repr(args)[:300], "error": (type(e).__name__ + ": " + str(e))[:200]})
            raise

    try:
        prop()
    except Exception:  # noqa: BLE001
        pass
    if found:
        failures.append(found[-1])
sys.stdout.write("\n" + json.dumps(failures) + "\n")
