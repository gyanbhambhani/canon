"""Sandbox for Python execution: hand-written Python ("py") or Canon compiled to Python ("canonpy").

Limits: a memory limit (RLIMIT_AS / RLIMIT_DATA where the OS honours it), a CPU-time limit for the
whole process, a wall-clock alarm per call, and no network (socket creation raises). The caller also
kills the process after a wall-clock timeout.

stdin:  {"mode": "py" | "canonpy", "path": dir, "name": fn, "calls": [[args...]...],
         "params": [type...], "ret": type, "timeoutS": float}
A type is {"t": "Int" | "Float" | "String" | "Bool" | "List" | "Option" | "Result" | "Tuple" | "Rec" | "Sum",
           "a": [type...], "name": str}
stdout: one JSON line: [{"ok": true, "v": value} | {"ok": false, "e": message}, ...]
"""

import json
import resource
import signal
import socket
import sys

MEM = 1024 * 1024 * 1024
for lim in ("RLIMIT_AS", "RLIMIT_DATA"):
    try:
        resource.setrlimit(getattr(resource, lim), (MEM, MEM))
    except (ValueError, OSError, AttributeError):
        pass
try:
    resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
except (ValueError, OSError):
    pass


def _no_network(*_a: object, **_k: object) -> None:
    raise PermissionError("network access is disabled in the sandbox")


socket.socket.connect = _no_network  # type: ignore[assignment, method-assign]
socket.socket.connect_ex = _no_network  # type: ignore[assignment, method-assign]
socket.socket.sendto = _no_network  # type: ignore[assignment, method-assign]
socket.create_connection = _no_network  # type: ignore[assignment]
socket.getaddrinfo = _no_network  # type: ignore[assignment]
sys.setrecursionlimit(5000)


class CallTimeout(Exception):
    pass


def _alarm(_s: int, _f: object) -> None:
    raise CallTimeout("time limit exceeded")


signal.signal(signal.SIGALRM, _alarm)

req = json.load(sys.stdin)
sys.path.insert(0, req["path"])
models = None
if req["mode"] == "py":
    import importlib.util

    spec = importlib.util.spec_from_file_location("main", req["path"] + "/main.py")
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["main"] = mod
    spec.loader.exec_module(mod)
    fn = getattr(mod, req["name"])
else:
    from canon_generated import logic, models  # type: ignore[import-not-found, no-redef]
    from canon_generated.runtime import Err, Ok  # type: ignore[import-not-found]

    fn = getattr(logic, req["name"])


def to_py(v: object, t: dict) -> object:  # type: ignore[type-arg]
    k = t["t"]
    if v is None:
        return None
    if k == "List":
        return [to_py(x, t["a"][0]) for x in v]  # type: ignore[attr-defined]
    if k == "Tuple":
        return tuple(to_py(x, a) for x, a in zip(v, t["a"]))  # type: ignore[call-overload]
    if k == "Option":
        return to_py(v, t["a"][0])
    if req["mode"] == "canonpy":
        if k == "Rec":
            return getattr(models, t["name"]).model_validate(v)
        if k == "Sum":
            return getattr(models, v["kind"]).model_validate(v)  # type: ignore[index]
        if k == "Result":
            r = v  # type: ignore[assignment]
            return Ok(to_py(r["value"], t["a"][0])) if r["ok"] else Err(to_py(r["error"], t["a"][1]))  # type: ignore[index]
    return v


def plain(v: object) -> object:
    if models is not None:
        if isinstance(v, Ok):
            return {"ok": True, "value": plain(v.value)}
        if isinstance(v, Err):
            return {"ok": False, "error": plain(v.error)}
        if hasattr(v, "model_dump"):
            return plain(v.model_dump())  # type: ignore[attr-defined]
    if isinstance(v, (list, tuple)):
        return [plain(x) for x in v]
    if isinstance(v, dict):
        return {str(k): plain(x) for k, x in v.items()}
    return v


out = []
per_call = float(req.get("timeoutS", 2))
for args in req["calls"]:
    try:
        conv = [to_py(a, t) for a, t in zip(args, req["params"])]
        signal.setitimer(signal.ITIMER_REAL, per_call)
        try:
            res = fn(*conv)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
        out.append({"ok": True, "v": plain(res)})
    except BaseException as e:  # noqa: BLE001 - every failure is recorded, including timeouts
        if isinstance(e, KeyboardInterrupt):
            raise
        out.append({"ok": False, "e": (type(e).__name__ + ": " + str(e))[:300]})
sys.stdout.write("\n" + json.dumps(out) + "\n")
