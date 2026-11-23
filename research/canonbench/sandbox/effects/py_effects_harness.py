"""Effect harness for the Python programs: runs drive calls against a mocked, recording world.

Run with `python -I py_effects_harness.py`; stdin is
  {"path": ".../program.py", "host": {"files": {...}, "http": {...}}, "drive": [{"fn", "args"}...]}
stdout is one JSON line: [{"fn", "v", "effects", "err"?, "crash"?, "requests"}...].

The world is the one in mock.ts (keep them in step): an in-memory file map, canned HTTP responses
per URL (the n-th request gets entry min(n, len - 1); {"error": msg} or an unknown URL fails), a
clock that returns T0, T0 + 1 s, ... on each read (sleep records but does not move it), and
mulberry32(42) for randomness. It is reset before every drive call.

Patched before the program is loaded (so `from x import y` also binds the mocks):
  fs    builtins.open, pathlib.Path.{open, read_text, write_text, exists}, os.path.exists; other
        os / shutil file operations record fs and fail as a crash (not modelled)
  net   urllib.request.urlopen (str or Request), socket connections fail
  time  time.time, time.time_ns, time.monotonic, time.perf_counter, time.sleep
  rand  random.random, randint, randrange, uniform, choice
  io    builtins.print
"""

import builtins
import dataclasses
import io
import json
import os
import pathlib
import random
import shutil
import socket
import sys
import time
import types
import urllib.error
import urllib.request
from typing import Any

T0 = 1_700_000_000_000
SEED = 42
M32 = 0xFFFFFFFF

_real_open = builtins.open
_stdout = sys.stdout


def mulberry32(seed: int) -> Any:
    state = [seed & M32]

    def imul(a: int, b: int) -> int:
        return (a * b) & M32

    def nxt() -> float:
        state[0] = (state[0] + 0x6D2B79F5) & M32
        t = state[0]
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return nxt


class World:
    def __init__(self, spec: dict[str, Any]) -> None:
        self.spec = spec
        self.reset()

    def reset(self) -> None:
        self.files: dict[str, str] = dict(self.spec.get("files", {}))
        self.hits: dict[str, int] = {}
        self.clock = 0
        self.rand = mulberry32(SEED)
        self.seen: set[str] = set()
        self.log: list[str] = []

    def read_file(self, path: str) -> str:
        self.seen.add("fs")
        if path not in self.files:
            raise FileNotFoundError(2, "No such file or directory", path)
        return self.files[path]

    def write_file(self, path: str, text: str) -> None:
        self.seen.add("fs")
        self.files[path] = text

    def http(self, method: str, url: str, body: str | None) -> str:
        self.seen.add("net")
        self.log.append(f"{method} {url}" + ("" if body is None else f" {body}"))
        entries = self.spec.get("http", {}).get(url)
        if not entries:
            raise urllib.error.URLError(f"connection refused: {url}")
        n = self.hits.get(url, 0)
        self.hits[url] = n + 1
        e = entries[min(n, len(entries) - 1)]
        if isinstance(e, str):
            return e
        raise urllib.error.URLError(e["error"])

    def now_ms(self) -> int:
        self.seen.add("time")
        t = T0 + 1000 * self.clock
        self.clock += 1
        return t

    def sleep(self) -> None:
        self.seen.add("time")

    def random(self) -> float:
        self.seen.add("rand")
        return float(self.rand())

    def writes(self) -> dict[str, str]:
        init = self.spec.get("files", {})
        return {p: t for p, t in sorted(self.files.items()) if init.get(p) != t}

    def effects(self) -> list[str]:
        return sorted(self.seen)


req = json.load(sys.stdin)
world = World(req["host"])
source = _real_open(req["path"], encoding="utf-8").read()


# ---------------------------------------------------------------- fs


class _WriteBuffer(io.StringIO):
    def __init__(self, path: str, initial: str) -> None:
        super().__init__()
        self._path = path
        self.write(initial)

    def close(self) -> None:
        if not self.closed:
            world.write_file(self._path, self.getvalue())
        super().close()


def _open(file: Any, mode: str = "r", *_a: Any, **_k: Any) -> Any:
    path = os.fspath(file)
    if isinstance(path, bytes):
        path = path.decode()
    if "r" in mode and "+" not in mode:
        text = world.read_file(path)
        return io.BytesIO(text.encode()) if "b" in mode else io.StringIO(text)
    if "w" in mode:
        world.write_file(path, "")
        return _WriteBuffer(path, "")
    if "a" in mode:
        world.seen.add("fs")
        return _WriteBuffer(path, world.files.get(path, ""))
    raise PermissionError(f"open mode {mode!r} is not modelled by the sandbox")


def _not_modelled(name: str) -> Any:
    def f(*_a: Any, **_k: Any) -> Any:
        world.seen.add("fs")
        raise NotImplementedError(f"{name} is not modelled by the sandbox")

    return f


def _path_exists(p: Any) -> bool:
    world.seen.add("fs")
    return os.fspath(p) in world.files


builtins.open = _open
pathlib.Path.open = lambda self, mode="r", *a, **k: _open(str(self), mode)  # type: ignore[method-assign, assignment, misc]
pathlib.Path.read_text = lambda self, *a, **k: world.read_file(str(self))  # type: ignore[method-assign, assignment, misc]
pathlib.Path.write_text = lambda self, data, *a, **k: (world.write_file(str(self), data), len(data))[1]  # type: ignore[method-assign, assignment, misc]
pathlib.Path.exists = lambda self, *a, **k: _path_exists(self)  # type: ignore[method-assign, assignment, misc]
os.path.exists = _path_exists
for _name in ("rename", "replace", "remove", "unlink", "listdir", "makedirs", "mkdir", "stat", "scandir"):
    setattr(os, _name, _not_modelled(f"os.{_name}"))
os.path.getsize = _not_modelled("os.path.getsize")
os.path.getmtime = _not_modelled("os.path.getmtime")
for _name in ("copy", "copyfile", "copy2", "move", "rmtree"):
    setattr(shutil, _name, _not_modelled(f"shutil.{_name}"))

# ---------------------------------------------------------------- net


class _Response:
    def __init__(self, body: str) -> None:
        self._body = body.encode()
        self.status = 200

    def read(self, *_a: Any) -> bytes:
        return self._body

    def getcode(self) -> int:
        return 200

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_a: Any) -> None:
        return None


def _urlopen(url: Any, data: Any = None, *_a: Any, **_k: Any) -> _Response:
    if isinstance(url, urllib.request.Request):
        data = url.data if data is None else data
        target = url.full_url
    else:
        target = str(url)
    body = None if data is None else (data.decode() if isinstance(data, bytes) else str(data))
    return _Response(world.http("GET" if body is None else "POST", target, body))


def _no_socket(*_a: Any, **_k: Any) -> Any:
    world.seen.add("net")
    raise NotImplementedError("raw sockets are not modelled by the sandbox")


urllib.request.urlopen = _urlopen  # type: ignore[assignment]
socket.socket.connect = _no_socket  # type: ignore[method-assign]
socket.create_connection = _no_socket  # type: ignore[assignment]
socket.getaddrinfo = _no_socket

# ---------------------------------------------------------------- time, rand, io

time.time = lambda: world.now_ms() / 1000
time.time_ns = lambda: world.now_ms() * 1_000_000
time.monotonic = lambda: world.now_ms() / 1000
time.perf_counter = lambda: world.now_ms() / 1000
time.sleep = lambda _s: world.sleep()
random.random = world.random
random.randint = lambda a, b: a + int(world.random() * (b - a + 1))
random.randrange = lambda a, b=None, *_r: (0 + int(world.random() * a)) if b is None else a + int(world.random() * (b - a))  # type: ignore[assignment]
random.uniform = lambda a, b: a + (b - a) * world.random()
random.choice = lambda seq: seq[int(world.random() * len(seq))]  # type: ignore[assignment]
builtins.print = lambda *a, **k: world.seen.add("io")  # type: ignore[assignment]

# ---------------------------------------------------------------- load and run

mod = types.ModuleType("program")
mod.__file__ = req["path"]
sys.modules["program"] = mod
load_error = None
try:
    exec(compile(source, req["path"], "exec"), mod.__dict__)
except Exception as e:  # noqa: BLE001
    load_error = f"{type(e).__name__}: {e}"


def decode(v: Any) -> Any:
    if isinstance(v, list):
        return [decode(x) for x in v]
    if isinstance(v, dict):
        if "$map" in v:
            return {k: decode(x) for k, x in v["$map"]}
        return {k: decode(x) for k, x in v.items()}
    return v


def encode(v: Any) -> Any:
    if dataclasses.is_dataclass(v) and not isinstance(v, type):
        return {f.name: encode(getattr(v, f.name)) for f in dataclasses.fields(v)}
    if isinstance(v, (list, tuple)):
        return [encode(x) for x in v]
    if isinstance(v, dict):
        return {str(k): encode(x) for k, x in v.items()}
    return v


CRASH = (TypeError, AttributeError, NameError, KeyError, IndexError, ZeroDivisionError, AssertionError, NotImplementedError, RecursionError)

out = []
for d in req["drive"]:
    world.reset()
    rec: dict[str, Any] = {"fn": d["fn"], "v": None}
    if load_error:
        rec["crash"] = load_error
    elif not callable(getattr(mod, d["fn"], None)):
        rec["crash"] = f"no function {d['fn']}"
    else:
        try:
            rec["v"] = encode(getattr(mod, d["fn"])(*decode(d["args"])))
        except CRASH as e:
            rec["crash"] = f"{type(e).__name__}: {e}"
        except Exception as e:  # noqa: BLE001
            rec["v"] = {"$error": True}
            rec["err"] = f"{type(e).__name__}: {e}"
    rec["effects"] = world.effects()
    rec["requests"] = world.log
    rec["writes"] = world.writes()
    out.append(rec)

_stdout.write(json.dumps(out) + "\n")
