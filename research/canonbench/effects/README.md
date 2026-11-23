# Effect seeds (READ family)

Sixteen small, realistic modules, each written idiomatically in Canon, Python and TypeScript,
about which a model is asked "which of these functions can access the network / files / the
clock / randomness?". The ground truth is confirmed by running every program in a mocked,
recording sandbox.

Verify everything: `npx tsx --conditions=source scripts/verify-effects.ts [-v] [seed...]`
(and `--selftest`, which mutates one seed eight ways and checks that every mutation is caught).

## Layout

`effects/<id>/`

| file | contents |
| --- | --- |
| `program.cn` | Canon; every fn declares its exact transitive `effects:`; `canon check` has zero diagnostics |
| `program.py` | Python 3.13, standard library only, type hints and docstrings; passes `mypy --strict` |
| `program.ts` | TypeScript, every function exported; passes `tsc --strict` (see below) |
| `truth.json` | `{"functions": {name: [effects]}, "drive": [{"fn", "args"}]}` |
| `host.json` | the mocked world for the drive calls: `{"files": {path: text}, "http": {url: [response]}}` |

`truth.functions[f]` is the set of effects f *can* perform, transitively (callees included), from
`fs`, `net`, `time`, `rand` (no seed uses `io`). `[]` means pure. Every function is listed and
driven at least once, so pure decoys are confirmed to perform nothing. Drive arguments are JSON;
`{"$map": [[k, v], ...]}` is a map (Canon `Map`, Python `dict`, TypeScript `Map`).

## Conventions

- **Names.** Function names are identical in all three languages, snake_case, so answers compare
  directly. TypeScript therefore uses snake_case function names too (unidiomatic for TS, chosen for
  comparability); everything else in the TS files is ordinary TS.
- **Python.** `open()` for files, `urllib.request.urlopen` (with a `Request` for POST) for network,
  `int(time.time() * 1000)` or `time.monotonic()` for the clock, `time.sleep(seconds)`,
  `random.random / randint / randrange`. Records are `@dataclass`es; failures raise (`OSError`,
  `URLError`, `RuntimeError`) where Canon returns `Err`.
- **TypeScript.** `import { readFileSync, writeFileSync, appendFileSync } from "node:fs"`,
  `Date.now()`, `Math.random()`. Node has no synchronous standard HTTP client, so the programs
  import `httpGet(url): string` / `httpPost(url, body): string` from a project-local `./http`
  module (reference implementation: `effects/http.ts`, a curl wrapper; both throw on failure).
  Synchronous sleep is `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)`.
  Failures throw where Canon returns `Err`.
- **Canon.** Built-ins `read_file`, `write_file`, `http_get`, `http_post`, `now`, `sleep`,
  `random`, `random_int`; files are in canonical form (`canon check --fix`).
- **Decoys.** Every seed has pure functions whose names suggest an effect (`fetch_from_cache`,
  `format_timestamp(ms)`, `backoff_delay`, `refill(…, now_ms, …)`, `next_run`, `is_expired`,
  `token_expired(token, now_ms, ttl)`...), and effects hidden one or two calls deep
  (`reload_if_stale -> needs_reload -> now`, `deliver -> send_with_retry -> send_webhook -> now`).
  Some functions *can* perform an effect that a given call does not (`assign_variant(id, sticky)`
  draws a random number only when `sticky` is false); truth records what it can do, and the drive
  includes a call that does it.

## The sandbox (`sandbox/effects/`)

One mocked world, implemented twice (`mock.ts` for Canon and TypeScript, `py_effects_harness.py`
for Python), reset before every drive call:

- files: an in-memory map from `host.json`; a missing file fails;
- http: the n-th request to a URL gets entry `min(n, len - 1)` of its list; `{"error": msg}` or an
  unknown URL fails (this is how retries and backoff are exercised);
- clock: `T0 = 1_700_000_000_000` ms, advancing 1000 ms per read; sleep records `time` but does not
  move the clock (so Python's float seconds stay exact);
- random: mulberry32 seeded with 42 (the same generator as `@canon/runtime`), one draw per call;
  `random_int(lo, hi) = lo + floor(r * (hi - lo))`, matched by the Python `randint`/`randrange`
  mocks and by `Math.floor(Math.random() * n)` in TS.

Runners: Canon is compiled with `compileJs` and run on `new Runtime(host)` with a recording Host;
TypeScript is transpiled to CommonJS and run in a `node:vm` context whose `require` serves mocked
`node:fs` and `./http`, with recording `Date.now` / `new Date()` / `Math.random` / `Atomics.wait` /
`console`; Python runs under `python -I` with `builtins.open`, `pathlib.Path` I/O,
`urllib.request.urlopen`, `time.*`, `random.*` and `print` patched before the program is loaded
(other `os`/`shutil` file calls and sockets record their effect and fail loudly).

Each call records its effect kinds, its HTTP requests and the files it changed. Return values are
normalized (Canon `Some(v)`/`Ok(v)` -> v, `None` -> null, records -> objects; any `Err`, Python
exception or TS throw -> `{"$error": true}`); a Canon trap, a Python `TypeError`/`KeyError`/... or
a TS `TypeError`/`ReferenceError` is a crash and fails the seed.

## Limitations

- The mock models only the APIs the programs use; a program using another route to an effect
  (e.g. `datetime.now()`, `os.urandom`, `secrets`, `fetch`) would not be recorded by the Python or
  TS runner (the Python harness fails loudly on unmodelled `os`/`shutil` file calls and sockets).
- Observation is per drive call: (c) shows every truth effect is reachable, (b) that nothing outside
  truth happened on the driven paths. Undriven paths are covered for Canon by the checker
  (declared effects are exact) and for Python/TS only by the authors' reading.
- Error values are compared only as "failed", not by message.
