# Spot check: READ questions (10%)

Check: the question is answerable from the program, and the recorded answer is right.

## parse_query.failure (failure, basis: executed)

For which of these calls does `parse_query` return an error result (an error, not a successful value)? The arguments are written as JSON.
A. parse_query("+=1+")
B. parse_query("qlablqh")
C. parse_query("a=1&b=&co")
D. parse_query("&==&o")

Recorded answer: `["D"]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_query(s: str) -> Ok[list[tuple[str, str]]] | Err:
    """Parse a URL query string into (key, value) pairs, decoding "+" as a space."""
    pairs: list[tuple[str, str]] = []
    for item in s.split("&"):
        if not item:
            continue
        key, _, value = item.partition("=")
        key = key.replace("+", " ")
        if not key:
            return {"ok": False, "error": f"empty key: {item}"}
        pairs.append((key, value.replace("+", " ")))
    return {"ok": True, "value": pairs}
```

Stripped Canon:

```canon
fn decode(s: String) -> String {
  return join(split(s, "+"), " ")
}

fn parse_query(s: String) -> Result[List[(String, String)], String] {
  var out = []
  for item in split(s, "&") {
    if item != "" {
      let parts = split(item, "=")
      let key = parts
        |> first()
        |> unwrap_or("")
        |> decode()
      let value = parts
        |> drop(1)
        |> join("=")
        |> decode()
      if key == "" {
        return Err("empty key: " + item)
      }
      out = append(out, (key, value))
    }
  }
  return Ok(out)
}
```

## session_tokens.effects.time (effects, basis: sandbox+checker)

Which of these functions can read the clock or sleep when called, directly or through the functions they call? Functions: check_token, encode_token, issue_token, pick_char, random_suffix, refresh_token, token_alphabet, token_expired.

Recorded answer: `["check_token","issue_token","refresh_token"]`

Python version shown to the model:

```python
"""Session tokens of the form `user.issued_at_ms.suffix`, with expiry and refresh."""

import random
import time


def token_alphabet() -> list[str]:
    """Characters a token suffix may use (lowercase hex)."""
    return list("0123456789abcdef")


def pick_char(index: int) -> str:
    """The alphabet character at `index`, wrapping around."""
    alphabet = token_alphabet()
    return alphabet[index % len(alphabet)]


def random_suffix(length: int) -> str:
    """A random suffix of `length` alphabet characters."""
    suffix = ""
    for _ in range(length):
        suffix += pick_char(random.randrange(len(token_alphabet())))
    return suffix


def encode_token(user: str, issued_at: int, suffix: str) -> str:
    """Join the parts of a token."""
    return user + "." + str(issued_at) + "." + suffix


def issue_token(user: str) -> str:
    """A fresh token for `user`, issued now."""
    issued_at = int(time.time() * 1000)
    return encode_token(user, issued_at, random_suffix(12))


def token_expired(token: str, now_ms: int, ttl_ms: int) -> bool:
    """True if the token is older than `ttl_ms` at `now_ms` (or malformed)."""
    parts = token.split(".")
    if len(parts) < 2:
        return True
    try:
        issued = int(parts[1])
    except ValueError:
        issued = 0
    return now_ms - issued >= ttl_ms


def check_token(token: str, ttl_ms: int) -> bool:
    """True if the token is still valid by the wall clock."""
    return not token_expired(token, int(time.time() * 1000), ttl_ms)


def refresh_token(token: str, ttl_ms: int) -> str:
    """The same token while valid; otherwise a new token for the same user."""
    if check_token(token, ttl_ms):
        return token
    user = token.split(".")[0]
    return issue_token(user)
```

Stripped Canon:

```canon
fn token_alphabet() -> List[String] {
  return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"]
}

fn pick_char(index: Int) -> String {
  let alphabet = token_alphabet()
  return alphabet
    |> drop(index % len(alphabet))
    |> first()
    |> unwrap_or("a")
}

fn random_suffix(length: Int) -> String {
  var suffix = ""
  for i in range(0, length) {
    suffix = suffix + pick_char(random_int(0, len(token_alphabet())))
  }
  return suffix
}

fn encode_token(user: String, issued_at: Int, suffix: String) -> String {
  return user + "." + to_string(issued_at) + "." + suffix
}

fn issue_token(user: String) -> String {
  let issued_at = now()
  return encode_token(user, issued_at, random_suffix(12))
}

fn token_expired(token: String, now_ms: Int, ttl_ms: Int) -> Bool {
  let issued = token
    |> split(".")
    |> drop(1)
    |> first()
  return match issued {
    Some(text) => now_ms - unwrap_or(parse_int(text), 0) >= ttl_ms,
    None => true,
  }
}

fn check_token(token: String, ttl_ms: Int) -> Bool {
  return !token_expired(token, now(), ttl_ms)
}

fn refresh_token(token: String, ttl_ms: Int) -> String {
  if check_token(token, ttl_ms) {
    return token
  }
  let user = token
    |> split(".")
    |> first()
    |> unwrap_or("anonymous")
  return issue_token(user)
}
```

## heading_numbers.output (output, basis: executed)

What does `heading_numbers(["## A","ixx","# C","## D"])` return? The arguments are written as JSON. Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a "kind" field naming it plus its fields, an optional value is the value or null, and a result is {"ok": true, "value": v} or {"ok": false, "error": e}.

Recorded answer: `["0.1 A","1 C","1.1 D"]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def heading_numbers(lines: list[str]) -> list[str]:
    """Number level 1-3 Markdown headings hierarchically, e.g. "1.2.1 Title"."""
    counters = [0, 0, 0]
    out: list[str] = []
    for line in lines:
        heading = _parse_heading(line)
        if heading is None:
            continue
        level, title = heading
        counters[level - 1] += 1
        for deeper in range(level, len(counters)):
            counters[deeper] = 0
        number = ".".join(str(c) for c in counters[:level])
        out.append(f"{number} {title}")
    return out


def _parse_heading(line: str) -> tuple[int, str] | None:
    """Return (level, title) if line is a valid heading, else None."""
    level = len(line) - len(line.lstrip("#"))
    if not 1 <= level <= 3:
        return None
    rest = line[level:]
    if not rest.startswith(" ") or len(rest) < 2:
        return None
    return level, rest[1:]
```

Stripped Canon:

```canon
fn hashes(cs: List[String]) -> Int {
  var n = 0
  var going = true
  for c in cs {
    if going && c == "#" {
      n = n + 1
    } else {
      going = false
    }
  }
  return n
}

fn heading_numbers(lines: List[String]) -> List[String] {
  var a = 0
  var b = 0
  var c = 0
  var out = []
  for line in lines {
    let cs = split(line, "")
    let n = hashes(cs)
    let sp = cs
      |> drop(n)
      |> first()
      |> unwrap_or("")
    if n >= 1 && n <= 3 && sp == " " && len(cs) > n + 1 {
      let title = join(drop(cs, n + 1), "")
      if n == 1 {
        a = a + 1
        b = 0
        c = 0
        out = append(out, to_string(a) + " " + title)
      } else if n == 2 {
        b = b + 1
        c = 0
        out = append(out, to_string(a) + "." + to_string(b) + " " + title)
      } else {
        c = c + 1
        out = append(out, to_string(a) + "." + to_string(b) + "." + to_string(c) + " " + title)
      }
    }
  }
  return out
}
```

## report_generator.effects.net (effects, basis: sandbox+checker)

Which of these functions can access the network when called, directly or through the functions they call? Functions: build_report, format_timestamp, parse_sale, publish_report, render_report, report_is_recent, totals_by_region.

Recorded answer: `[]`

Python version shown to the model:

```python
"""Regional sales report, rendered from a CSV file and stamped with its generation time."""

import time
from dataclasses import dataclass


@dataclass
class Sale:
    region: str
    cents: int


def parse_sale(line: str) -> Sale | None:
    """Parse one `region,cents` line; None if malformed."""
    parts = line.split(",")
    if len(parts) != 2:
        return None
    try:
        cents = int(parts[1].strip())
    except ValueError:
        return None
    return Sale(parts[0].strip(), cents)


def totals_by_region(sales_text: str) -> list[tuple[str, int]]:
    """Total cents per region, regions in first-seen order."""
    totals: dict[str, int] = {}
    for line in sales_text.split("\n"):
        sale = parse_sale(line)
        if sale is not None:
            totals[sale.region] = totals.get(sale.region, 0) + sale.cents
    return list(totals.items())


def format_timestamp(ms: int) -> str:
    """The report's header line for a report generated at `ms`."""
    return "generated at " + str(ms // 1000)


def render_report(sales_text: str, generated_at: int) -> str:
    """The full report text for the given sales and generation time."""
    lines = [format_timestamp(generated_at)]
    for region, cents in totals_by_region(sales_text):
        lines.append(region + ": " + str(cents))
    return "\n".join(lines)


def build_report(sales_path: str) -> str:
    """Render the report for the sales file at `sales_path`, stamped now."""
    with open(sales_path, encoding="utf-8") as f:
        text = f.read()
    return render_report(text, int(time.time() * 1000))


def publish_report(sales_path: str, out_path: str) -> int:
    """Build the report and write it to `out_path`; returns its length."""
    report = build_report(sales_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report)
    return len(report)


def report_is_recent(generated_at: int, max_age_ms: int) -> bool:
    """True if a report generated at `generated_at` is at most `max_age_ms` old."""
    return int(time.time() * 1000) - generated_at <= max_age_ms
```

Stripped Canon:

```canon
type Sale {
  region: String,
  cents: Int,
}

fn parse_sale(line: String) -> Option[Sale] {
  let parts = split(line, ",")
  if len(parts) != 2 {
    return None
  }
  let region = parts
    |> first()
    |> unwrap_or("")
    |> trim()
  let cents = parts
    |> last()
    |> unwrap_or("")
    |> trim()
    |> parse_int()
  return match cents {
    Some(c) => Some(Sale { region: region, cents: c }),
    None => None,
  }
}

fn totals_by_region(sales_text: String) -> List[(String, Int)] {
  var sales = []
  for line in split(sales_text, "\n") {
    sales = match parse_sale(line) {
      Some(s) => append(sales, s),
      None => sales,
    }
  }
  return map(group_by(sales, |s| s.region), |r, group| (r, sum(map(group, |s| s.cents))))
}

fn format_timestamp(ms: Int) -> String {
  return "generated at " + to_string(ms / 1000)
}

fn render_report(sales_text: String, generated_at: Int) -> String {
  var lines = [format_timestamp(generated_at)]
  for (region, cents) in totals_by_region(sales_text) {
    lines = append(lines, region + ": " + to_string(cents))
  }
  return join(lines, "\n")
}

fn build_report(sales_path: String) -> Result[String, Error] {
  let text = try read_file(sales_path)
  return Ok(render_report(text, now()))
}

fn publish_report(sales_path: String, out_path: String) -> Result[Int, Error] {
  let report = try build_report(sales_path)
  try write_file(out_path, report)
  return Ok(str_len(report))
}

fn report_is_recent(generated_at: Int, max_age_ms: Int) -> Bool {
  return now() - generated_at <= max_age_ms
}
```

## build_order.output (output, basis: executed)

What does `build_order([{"name":"x","deps":[]}])` return? The arguments are written as JSON. Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a "kind" field naming it plus its fields, an optional value is the value or null, and a result is {"ok": true, "value": v} or {"ok": false, "error": e}.

Recorded answer: `{"ok":true,"value":["x"]}`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Job(TypedDict):
    name: str
    deps: list[str]


def _first_duplicate(names: list[str]) -> str | None:
    seen: set[str] = set()
    for name in names:
        if name in seen:
            return name
        seen.add(name)
    return None


def build_order(jobs: list[Job]) -> Ok[list[str]] | Err:
    """Return a dependency-respecting order, preferring earlier jobs.

    At each step the earliest-listed job whose dependencies are all placed
    is placed next.
    """
    names = [job["name"] for job in jobs]
    duplicate = _first_duplicate(names)
    if duplicate is not None:
        return {"ok": False, "error": f"duplicate job: {duplicate}"}

    known = set(names)
    for job in jobs:
        for dep in job["deps"]:
            if dep not in known:
                return {"ok": False, "error": f"unknown dependency: {dep}"}

    placed: set[str] = set()
    order: list[str] = []
    remaining = list(jobs)
    while remaining:
        ready = next(
            (i for i, job in enumerate(remaining) if all(d in placed for d in job["deps"])),
            None,
        )
        if ready is None:
            return {"ok": False, "error": "cycle detected"}
        job = remaining.pop(ready)
        placed.add(job["name"])
        order.append(job["name"])
    return {"ok": True, "value": order}
```

Stripped Canon:

```canon
type Job {
  name: String,
  deps: List[String],
}

fn all_in(xs: List[String], ys: List[String]) -> Bool {
  return len(filter(xs, |x| !contains(ys, x))) == 0
}

fn build_order(jobs: List[Job]) -> Result[List[String], String] {
  var seen = []
  for j in jobs {
    if contains(seen, j.name) {
      return Err("duplicate job: " + j.name)
    }
    seen = append(seen, j.name)
  }
  for j in jobs {
    for d in j.deps {
      if !contains(seen, d) {
        return Err("unknown dependency: " + d)
      }
    }
  }
  var done = []
  while len(done) < len(jobs) {
    let ready = filter(jobs, |j| !contains(done, j.name) && all_in(j.deps, done))
    if len(ready) == 0 {
      return Err("cycle detected")
    }
    done = append(done, ready |> map(|j| j.name) |> first() |> unwrap_or(""))
  }
  return Ok(done)
}
```

## payroll_by_dept.output (output, basis: executed)

What does `payroll_by_dept([{"name":"tee","dept":"n","hours":5,"rate_cents":333},{"name":"b","dept":"t","hours":50,"rate_cents":1000},{"name":"c","dept":"s","hours":20,"rate_cents":1500}])` return? The arguments are written as JSON. Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a "kind" field naming it plus its fields, an optional value is the value or null, and a result is {"ok": true, "value": v} or {"ok": false, "error": e}.

Recorded answer: `[["t",55000],["s",30000],["n",1665]]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Employee(TypedDict):
    name: str
    dept: str
    hours: int
    rate_cents: int


REGULAR_HOURS = 40


def employee_pay(emp: Employee) -> int:
    """Pay in cents for one employee, with overtime at 1.5x rounded down."""
    rate = emp["rate_cents"]
    hours = emp["hours"]
    regular = min(hours, REGULAR_HOURS)
    overtime = max(hours - REGULAR_HOURS, 0)
    return regular * rate + overtime * rate * 3 // 2


def payroll_by_dept(emps: list[Employee]) -> list[tuple[str, int]]:
    """Total pay per department, highest total first, ties by department name."""
    totals: dict[str, int] = {}
    for emp in emps:
        totals[emp["dept"]] = totals.get(emp["dept"], 0) + employee_pay(emp)
    return sorted(totals.items(), key=lambda item: (-item[1], item[0]))
```

Stripped Canon:

```canon
type Employee {
  name: String,
  dept: String,
  hours: Int,
  rate_cents: Int,
}

fn pay(e: Employee) -> Int {
  if e.hours <= 40 {
    return e.hours * e.rate_cents
  }
  return 40 * e.rate_cents + (e.hours - 40) * e.rate_cents * 3 / 2
}

fn payroll_by_dept(emps: List[Employee]) -> List[(String, Int)] {
  return emps
    |> group_by(|e| e.dept)
    |> map(|g| (g.0, sum(map(g.1, |e| pay(e)))))
    |> sort_by(|r| r.0)
    |> sort_desc_by(|r| r.1)
}
```

## config_cache.effects.rand (effects, basis: sandbox+checker)

Which of these functions can use randomness when called, directly or through the functions they call? Functions: cache_is_fresh, fetch_from_cache, get_setting, needs_reload, parse_config, parse_line, read_config, reload_if_stale.

Recorded answer: `[]`

Python version shown to the model:

```python
"""Key=value configuration files, with a small cache and staleness check."""

import time


def parse_line(line: str) -> tuple[str, str] | None:
    """Split one `key = value` line; None if it is not exactly one assignment."""
    parts = line.split("=")
    if len(parts) != 2:
        return None
    return parts[0].strip(), parts[1].strip()


def parse_config(text: str) -> dict[str, str]:
    """Parse a whole config file into a dict; later keys win."""
    settings: dict[str, str] = {}
    for line in text.split("\n"):
        pair = parse_line(line)
        if pair is not None:
            settings[pair[0]] = pair[1]
    return settings


def fetch_from_cache(cache: dict[str, str], key: str) -> str | None:
    """Look a key up in an already-loaded settings dict."""
    return cache.get(key)


def cache_is_fresh(loaded_at: int, now_ms: int, ttl_ms: int) -> bool:
    """True while a cache loaded at `loaded_at` is younger than `ttl_ms` at `now_ms`."""
    return now_ms - loaded_at < ttl_ms


def read_config(path: str) -> dict[str, str]:
    """Read and parse the config file at `path`; raises OSError if it cannot be read."""
    with open(path, encoding="utf-8") as f:
        return parse_config(f.read())


def get_setting(path: str, key: str, fallback: str) -> str:
    """One setting from the file at `path`, or `fallback` if the file or key is missing."""
    try:
        settings = read_config(path)
    except OSError:
        return fallback
    value = fetch_from_cache(settings, key)
    return fallback if value is None else value


def needs_reload(loaded_at: int, ttl_ms: int) -> bool:
    """True when a cache loaded at `loaded_at` has outlived `ttl_ms` by the wall clock."""
    return not cache_is_fresh(loaded_at, int(time.time() * 1000), ttl_ms)


def reload_if_stale(path: str, key: str, loaded_at: int, ttl_ms: int) -> str | None:
    """Re-read `key` from disk if the cache is stale; None if the cache is still fresh."""
    if needs_reload(loaded_at, ttl_ms):
        return get_setting(path, key, "")
    return None
```

Stripped Canon:

```canon
fn parse_line(line: String) -> Option[(String, String)] {
  let parts = split(line, "=")
  if len(parts) != 2 {
    return None
  }
  let key = parts
    |> first()
    |> unwrap_or("")
    |> trim()
  let value = parts
    |> last()
    |> unwrap_or("")
    |> trim()
  return Some((key, value))
}

fn parse_config(text: String) -> Map[String, String] {
  var settings = map_from([])
  for line in split(text, "\n") {
    settings = match parse_line(line) {
      Some((k, v)) => map_set(settings, k, v),
      None => settings,
    }
  }
  return settings
}

fn fetch_from_cache(cache: Map[String, String], key: String) -> Option[String] {
  return map_get(cache, key)
}

fn cache_is_fresh(loaded_at: Int, now_ms: Int, ttl_ms: Int) -> Bool {
  return now_ms - loaded_at < ttl_ms
}

fn read_config(path: String) -> Result[Map[String, String], Error] {
  let text = try read_file(path)
  return Ok(parse_config(text))
}

fn get_setting(path: String, key: String, fallback: String) -> String {
  return match read_config(path) {
    Ok(settings) => unwrap_or(fetch_from_cache(settings, key), fallback),
    Err(_) => fallback,
  }
}

fn needs_reload(loaded_at: Int, ttl_ms: Int) -> Bool {
  return !cache_is_fresh(loaded_at, now(), ttl_ms)
}

fn reload_if_stale(path: String, key: String, loaded_at: Int, ttl_ms: Int) -> Option[String] {
  if needs_reload(loaded_at, ttl_ms) {
    return Some(get_setting(path, key, ""))
  }
  return None
}
```

## metrics_pusher.effects.fs (effects, basis: sandbox+checker)

Which of these functions can read or write files when called, directly or through the functions they call? Functions: encode_summary, maybe_push, parse_samples, push_summary, read_samples, should_sample, summarize.

Recorded answer: `["maybe_push","push_summary","read_samples"]`

Python version shown to the model:

```python
"""Summarize latency samples from a spool file and push them to a metrics gateway."""

import random
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class Summary:
    count: int
    total: int
    peak: int


def parse_samples(text: str) -> list[int]:
    """Every integer sample in the spool text, one per line; other lines are skipped."""
    samples = []
    for line in text.split("\n"):
        try:
            samples.append(int(line.strip()))
        except ValueError:
            continue
    return samples


def summarize(samples: list[int]) -> Summary:
    """Count, total and peak of the samples (peak 0 when empty)."""
    return Summary(len(samples), sum(samples), max(samples, default=0))


def encode_summary(name: str, count: int, total: int, peak: int, ts: int) -> str:
    """The gateway's line format for one metric summary."""
    return " ".join([name, str(count), str(total), str(peak), str(ts)])


def read_samples(path: str) -> list[int]:
    """The samples in the spool file, or [] if it cannot be read."""
    try:
        with open(path, encoding="utf-8") as f:
            return parse_samples(f.read())
    except OSError:
        return []


def should_sample(rate_percent: int) -> bool:
    """True for roughly `rate_percent` percent of calls."""
    return random.random() * 100.0 < rate_percent


def push_summary(url: str, name: str, path: str) -> bool:
    """Summarize the spool file and POST it with the current time; False if nothing was sent."""
    s = summarize(read_samples(path))
    if s.count == 0:
        return False
    line = encode_summary(name, s.count, s.total, s.peak, int(time.time() * 1000))
    request = urllib.request.Request(url, data=line.encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=5):
            return True
    except urllib.error.URLError:
        return False


def maybe_push(url: str, name: str, path: str, rate_percent: int) -> bool:
    """Push the summary on a sampled fraction of calls."""
    if not should_sample(rate_percent):
        return False
    return push_summary(url, name, path)
```

Stripped Canon:

```canon
type Summary {
  count: Int,
  total: Int,
  peak: Int,
}

fn parse_samples(text: String) -> List[Int] {
  var samples = []
  for line in split(text, "\n") {
    samples = match parse_int(trim(line)) {
      Some(n) => append(samples, n),
      None => samples,
    }
  }
  return samples
}

fn summarize(samples: List[Int]) -> Summary {
  return Summary {
    count: len(samples),
    total: sum(samples),
    peak: fold(samples, 0, |m, x| max(m, x)),
  }
}

fn encode_summary(name: String, count: Int, total: Int, peak: Int, ts: Int) -> String {
  return join([name, to_string(count), to_string(total), to_string(peak), to_string(ts)], " ")
}

fn read_samples(path: String) -> List[Int] {
  return match read_file(path) {
    Ok(text) => parse_samples(text),
    Err(_) => [],
  }
}

fn should_sample(rate_percent: Int) -> Bool {
  return random() * 100.0 < to_float(rate_percent)
}

fn push_summary(url: String, name: String, path: String) -> Bool {
  let s = summarize(read_samples(path))
  if s.count == 0 {
    return false
  }
  let line = encode_summary(name, s.count, s.total, s.peak, now())
  return match http_post(url, line) {
    Ok(_) => true,
    Err(_) => false,
  }
}

fn maybe_push(url: String, name: String, path: String, rate_percent: Int) -> Bool {
  if !should_sample(rate_percent) {
    return false
  }
  return push_summary(url, name, path)
}
```

## pig_latin.property (property, basis: witness)

Can `pig_latin` ever return the empty string? Consider every possible argument value of the declared types for which the function returns normally (without raising, throwing or trapping).

Recorded answer: `true`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


VOWELS = frozenset("aeiou")


def _is_vowel(word: str, i: int) -> bool:
    ch = word[i]
    if ch == "y":
        return i > 0
    if ch == "u" and i > 0 and word[i - 1] == "q":
        return False
    return ch in VOWELS


def _translate_word(word: str) -> str:
    first_vowel = next((i for i in range(len(word)) if _is_vowel(word, i)), None)
    if first_vowel is None:
        return word + "ay"
    if first_vowel == 0:
        return word + "way"
    return word[first_vowel:] + word[:first_vowel] + "ay"


def pig_latin(s: str) -> str:
    """Translate a space-separated string of lowercase words into Pig Latin."""
    if not s:
        return ""
    return " ".join(_translate_word(word) for word in s.split(" "))
```

Stripped Canon:

```canon
fn cluster_len(cs: List[String]) -> Int {
  var i = 0
  var prev = ""
  var found = -1
  for c in cs {
    if found < 0 {
      let vowel = contains(["a", "e", "i", "o", "u"], c) && !(c == "u" && prev == "q")
      if vowel || c == "y" && i > 0 {
        found = i
      }
    }
    prev = c
    i = i + 1
  }
  return found
}

fn pig_word(w: String) -> String {
  let cs = split(w, "")
  let n = cluster_len(cs)
  if n == 0 {
    return w + "way"
  }
  if n < 0 {
    return w + "ay"
  }
  return join(drop(cs, n), "") + join(take(cs, n), "") + "ay"
}

fn pig_latin(s: String) -> String {
  if s == "" {
    return ""
  }
  return s
    |> split(" ")
    |> map(|w| pig_word(w))
    |> join(" ")
}
```

## rle_decode.property (property, basis: fuzz-10000)

Can `rle_decode` ever return an error result although every argument is empty (empty strings, empty lists, zeros)? Consider every possible argument value of the declared types for which the function returns normally (without raising, throwing or trapping).

Recorded answer: `false`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def _is_digit(ch: str) -> bool:
    return "0" <= ch <= "9"


def rle_decode(s: str) -> Ok[str] | Err:
    """Decode a run-length encoded string such as "a3bc2"."""
    if s and _is_digit(s[0]):
        return {"ok": False, "error": "missing character before count"}

    parts: list[str] = []
    i = 0
    while i < len(s):
        ch = s[i]
        j = i + 1
        while j < len(s) and _is_digit(s[j]):
            j += 1
        count = s[i + 1 : j]
        if not count:
            parts.append(ch)
        elif count[0] == "0":
            return {"ok": False, "error": f"bad count for {ch}"}
        else:
            parts.append(ch * int(count))
        i = j
    return {"ok": True, "value": "".join(parts)}
```

Stripped Canon:

```canon
fn is_digit(c: String) -> Bool {
  return c >= "0" && c <= "9"
}

fn repeat(c: String, n: Int) -> String {
  var out = ""
  var i = 0
  while i < n {
    out = out + c
    i = i + 1
  }
  return out
}

fn flush(out: String, ch: String, digits: String) -> Result[String, String] {
  if digits == "" {
    return Ok(out + ch)
  }
  if (digits |> split("") |> first() |> unwrap_or("")) == "0" {
    return Err("bad count for " + ch)
  }
  return Ok(out + repeat(ch, unwrap_or(parse_int(digits), 0)))
}

fn rle_decode(s: String) -> Result[String, String] {
  var out = ""
  var ch = ""
  var have = false
  var digits = ""
  for c in split(s, "") {
    if is_digit(c) {
      if !have {
        return Err("missing character before count")
      }
      digits = digits + c
    } else {
      if have {
        out = try flush(out, ch, digits)
      }
      ch = c
      have = true
      digits = ""
    }
  }
  if have {
    out = try flush(out, ch, digits)
  }
  return Ok(out)
}
```

## caesar_shift.property (property, basis: witness)

Can `caesar_shift` ever return the empty string? Consider every possible argument value of the declared types for which the function returns normally (without raising, throwing or trapping).

Recorded answer: `true`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


_ALPHABET = "abcdefghijklmnopqrstuvwxyz"


def caesar_shift(s: str, k: int) -> str:
    """Shift each lowercase ASCII letter in s by k places, wrapping around."""
    shift = k % len(_ALPHABET)
    table = str.maketrans(_ALPHABET, _ALPHABET[shift:] + _ALPHABET[:shift])
    return s.translate(table)
```

Stripped Canon:

```canon
fn shift_char(c: String, k: Int) -> String {
  let letters = split("abcdefghijklmnopqrstuvwxyz", "")
  let hits = filter(enumerate(letters), |p| p.1 == c)
  return match first(hits) {
    Some(p) => letters |> drop(((p.0 + k) % 26 + 26) % 26) |> first() |> unwrap_or(c),
    None => c,
  }
}

fn caesar_shift(s: String, k: Int) -> String {
  return s
    |> split("")
    |> map(|c| shift_char(c, k))
    |> join("")
}
```

## flatten_nested.failure (failure, basis: executed)

For which of these calls does `flatten_nested` return an error result (an error, not a successful value)? The arguments are written as JSON.
A. flatten_nested("[7007,-10]")
B. flatten_nested("[,1]")
C. flatten_nested("--077[[0")
D. flatten_nested("1]]")

Recorded answer: `["B","C","D"]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


class _Invalid(Exception):
    def __init__(self, pos: int) -> None:
        super().__init__(f"invalid at {pos}")
        self.pos = pos


def _is_digit(ch: str | None) -> bool:
    return ch is not None and "0" <= ch <= "9"


class _Parser:
    """Recursive-descent parser that collects integers and the deepest list level."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.pos = 0
        self.values: list[int] = []
        self.max_depth = 0

    def _peek(self) -> str | None:
        return self.text[self.pos] if self.pos < len(self.text) else None

    def _expect(self, ch: str) -> None:
        if self._peek() != ch:
            raise _Invalid(self.pos)
        self.pos += 1

    def parse(self) -> None:
        self._list(1)
        if self.pos != len(self.text):
            raise _Invalid(self.pos)

    def _list(self, depth: int) -> None:
        self._expect("[")
        self.max_depth = max(self.max_depth, depth)
        if self._peek() == "]":
            self.pos += 1
            return
        self._element(depth)
        while self._peek() == ",":
            self.pos += 1
            self._element(depth)
        self._expect("]")

    def _element(self, depth: int) -> None:
        if self._peek() == "[":
            self._list(depth + 1)
        else:
            self._integer()

    def _integer(self) -> None:
        start = self.pos
        if self._peek() == "-":
            self.pos += 1
        if not _is_digit(self._peek()):
            raise _Invalid(self.pos)
        while _is_digit(self._peek()):
            self.pos += 1
        self.values.append(int(self.text[start:self.pos]))


def flatten_nested(s: str) -> Ok[tuple[list[int], int]] | Err:
    """Flatten a textual nested integer list and report its maximum depth."""
    parser = _Parser(s.replace(" ", ""))
    try:
        parser.parse()
    except _Invalid as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "value": (parser.values, parser.max_depth)}
```

Stripped Canon:

```canon
fn at(cs: List[String], i: Int) -> String {
  return cs
    |> drop(i)
    |> first()
    |> unwrap_or("")
}

fn is_digit(c: String) -> Bool {
  return str_len(c) == 1 && c >= "0" && c <= "9"
}

fn bad(i: Int) -> String {
  return "invalid at " + to_string(i)
}

fn parse_int_at(cs: List[String], i: Int) -> Result[(Int, Int), String] {
  var j = i
  var sign = 1
  if at(cs, j) == "-" {
    sign = -1
    j = j + 1
  }
  if !is_digit(at(cs, j)) {
    return Err(bad(j))
  }
  var v = 0
  while is_digit(at(cs, j)) {
    v = v * 10 + (cs |> at(j) |> parse_int() |> unwrap_or(0))
    j = j + 1
  }
  return Ok((sign * v, j))
}

fn parse_list(cs: List[String], i: Int, depth: Int) -> Result[(List[Int], Int, Int), String] {
  if at(cs, i) != "[" {
    return Err(bad(i))
  }
  var j = i + 1
  var ints = []
  var deepest = depth
  if at(cs, j) == "]" {
    return Ok((ints, j + 1, deepest))
  }
  var going = true
  while going {
    if at(cs, j) == "[" {
      let r = try parse_list(cs, j, depth + 1)
      ints = fold(r.0, ints, |acc, x| append(acc, x))
      deepest = max(deepest, r.2)
      j = r.1
    } else {
      let r = try parse_int_at(cs, j)
      ints = append(ints, r.0)
      j = r.1
    }
    if at(cs, j) == "," {
      j = j + 1
    } else if at(cs, j) == "]" {
      going = false
    } else {
      return Err(bad(j))
    }
  }
  return Ok((ints, j + 1, deepest))
}

fn flatten_nested(s: String) -> Result[(List[Int], Int), String] {
  let cs = filter(split(s, ""), |c| c != " ")
  let r = try parse_list(cs, 0, 1)
  if r.1 < len(cs) {
    return Err(bad(r.1))
  }
  return Ok((r.0, r.2))
}
```

## parse_money.output (output, basis: executed)

What does `parse_money("-$0.0")` return? The arguments are written as JSON. Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a "kind" field naming it plus its fields, an optional value is the value or null, and a result is {"ok": true, "value": v} or {"ok": false, "error": e}.

Recorded answer: `{"ok":false,"error":"bad cents"}`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_money(s: str) -> Ok[int] | Err:
    """Parse an amount such as "-$1,234.56" into signed cents."""
    negative = s.startswith("-")
    body = s[1:] if negative else s
    if not body.startswith("$"):
        return {"ok": False, "error": "missing $"}
    dollars_text, dot, cents_text = body[1:].partition(".")
    if dot and not (len(cents_text) == 2 and _all_digits(cents_text)):
        return {"ok": False, "error": "bad cents"}
    dollars = _parse_dollars(dollars_text)
    if dollars is None:
        return {"ok": False, "error": "bad dollars"}
    cents = dollars * 100 + (int(cents_text) if dot else 0)
    return {"ok": True, "value": -cents if negative else cents}


def _all_digits(text: str) -> bool:
    """True if every character is an ASCII digit (vacuously true for "")."""
    return all("0" <= ch <= "9" for ch in text)


def _parse_dollars(text: str) -> int | None:
    """Validate plain or comma-grouped dollars without a leading zero; return the value."""
    head, *groups = text.split(",")
    if not head or not _all_digits(head):
        return None
    if groups and (len(head) > 3 or any(len(g) != 3 or not _all_digits(g) for g in groups)):
        return None
    digits = head + "".join(groups)
    if len(digits) > 1 and digits[0] == "0":
        return None
    return int(digits)
```

Stripped Canon:

```canon
fn all_digits(cs: List[String]) -> Bool {
  return len(filter(cs, |c| c >= "0" && c <= "9")) == len(cs)
}

fn dollars_ok(d: String) -> Bool {
  let groups = split(d, ",")
  let plain = split(join(groups, ""), "")
  if len(plain) == 0 || !all_digits(plain) {
    return false
  }
  if len(plain) > 1 && unwrap_or(first(plain), "") == "0" {
    return false
  }
  if len(groups) == 1 {
    return true
  }
  let g0 = groups
    |> first()
    |> unwrap_or("")
    |> str_len()
  if g0 < 1 || g0 > 3 {
    return false
  }
  for g in drop(groups, 1) {
    if str_len(g) != 3 {
      return false
    }
  }
  return true
}

fn parse_money(s: String) -> Result[Int, String] {
  let cs = split(s, "")
  let neg = unwrap_or(first(cs), "") == "-"
  var rest = cs
  if neg {
    rest = drop(cs, 1)
  }
  if unwrap_or(first(rest), "") != "$" {
    return Err("missing $")
  }
  let pieces = rest
    |> drop(1)
    |> join("")
    |> split(".")
  let dollars = unwrap_or(first(pieces), "")
  var cents = 0
  if len(pieces) > 1 {
    let after = join(drop(pieces, 1), ".")
    let ccs = split(after, "")
    if len(ccs) != 2 || !all_digits(ccs) {
      return Err("bad cents")
    }
    cents = unwrap_or(parse_int(after), 0)
  }
  if !dollars_ok(dollars) {
    return Err("bad dollars")
  }
  let total = (dollars |> split(",") |> join("") |> parse_int() |> unwrap_or(0)) * 100 + cents
  if neg {
    return Ok(0 - total)
  }
  return Ok(total)
}
```

## compare_versions.failure (failure, basis: executed)

For which of these calls does `compare_versions` return an error result (an error, not a successful value)? The arguments are written as JSON.
A. compare_versions("251", "4")
B. compare_versions("351y3933", "02x50y1")
C. compare_versions("y.931.9x", "59")
D. compare_versions("y1", "94x49.")

Recorded answer: `["B","C","D"]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


import re

_VERSION = re.compile(r"[0-9]+(?:\.[0-9]+){0,3}")


def _parse(version: str) -> list[int] | None:
    if _VERSION.fullmatch(version) is None:
        return None
    return [int(part) for part in version.split(".")]


def compare_versions(a: str, b: str) -> Ok[int] | Err:
    """Compare two dotted versions numerically, padding missing parts with 0."""
    pa = _parse(a)
    if pa is None:
        return {"ok": False, "error": f"bad version: {a}"}
    pb = _parse(b)
    if pb is None:
        return {"ok": False, "error": f"bad version: {b}"}
    size = max(len(pa), len(pb))
    pa += [0] * (size - len(pa))
    pb += [0] * (size - len(pb))
    return {"ok": True, "value": (pa > pb) - (pa < pb)}
```

Stripped Canon:

```canon
fn all_digits(cs: List[String]) -> Bool {
  return len(filter(cs, |c| c >= "0" && c <= "9")) == len(cs)
}

fn valid_version(v: String) -> Bool {
  let parts = split(v, ".")
  if len(parts) > 4 {
    return false
  }
  for p in parts {
    let cs = split(p, "")
    if len(cs) == 0 || !all_digits(cs) {
      return false
    }
  }
  return true
}

fn part_at(ns: List[Int], i: Int) -> Int {
  return ns
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn sign(d: Int) -> Int {
  if d < 0 {
    return -1
  }
  return 1
}

fn compare_versions(a: String, b: String) -> Result[Int, String] {
  if !valid_version(a) {
    return Err("bad version: " + a)
  }
  if !valid_version(b) {
    return Err("bad version: " + b)
  }
  let x = map(split(a, "."), |p| unwrap_or(parse_int(p), 0))
  let y = map(split(b, "."), |p| unwrap_or(parse_int(p), 0))
  let diffs = filter(map(range(0, 4), |i| part_at(x, i) - part_at(y, i)), |d| d != 0)
  return match first(diffs) {
    Some(d) => Ok(sign(d)),
    None => Ok(0),
  }
}
```

## price_fetcher.effects.rand (effects, basis: sandbox+checker)

Which of these functions can use randomness when called, directly or through the functions they call? Functions: backoff_delay, fetch_price, fetch_price_once, fetch_quote, jittered_delay, parse_price, price_url.

Recorded answer: `["fetch_price","fetch_quote","jittered_delay"]`

Python version shown to the model:

```python
"""Stock price fetcher with retries, exponential backoff and random jitter."""

import random
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class Quote:
    symbol: str
    price: float
    fetched_at: int


def price_url(symbol: str) -> str:
    """The quote service URL for one ticker symbol."""
    return "https://quotes.example.com/v1/price?symbol=" + symbol


def parse_price(body: str) -> float | None:
    """Parse a plain-text price body; None if it is not a number."""
    try:
        return float(body.strip())
    except ValueError:
        return None


def backoff_delay(attempt: int, base_ms: int) -> int:
    """Exponential backoff: base_ms doubled once per previous attempt."""
    return base_ms << attempt


def jittered_delay(attempt: int, base_ms: int) -> int:
    """The backoff delay plus up to half of it again, chosen at random."""
    delay = backoff_delay(attempt, base_ms)
    return delay + random.randint(0, delay // 2)


def fetch_price_once(symbol: str) -> float | None:
    """One request to the quote service; None on any network failure or bad body."""
    try:
        with urllib.request.urlopen(price_url(symbol), timeout=5) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError:
        return None
    return parse_price(body)


def fetch_price(symbol: str, retries: int) -> float | None:
    """Fetch a price, retrying up to `retries` times with jittered backoff between tries."""
    for attempt in range(retries + 1):
        price = fetch_price_once(symbol)
        if price is not None:
            return price
        if attempt < retries:
            time.sleep(jittered_delay(attempt, 100) / 1000)
    return None


def fetch_quote(symbol: str, retries: int) -> Quote | None:
    """A Quote stamped with the time it was fetched, or None if every try failed."""
    price = fetch_price(symbol, retries)
    if price is None:
        return None
    return Quote(symbol, price, int(time.time() * 1000))
```

Stripped Canon:

```canon
type Quote {
  symbol: String,
  price: Float,
  fetched_at: Int,
}

fn price_url(symbol: String) -> String {
  return "https://quotes.example.com/v1/price?symbol=" + symbol
}

fn parse_price(body: String) -> Option[Float] {
  return parse_float(trim(body))
}

fn backoff_delay(attempt: Int, base_ms: Int) -> Int {
  return base_ms * pow(2, attempt)
}

fn jittered_delay(attempt: Int, base_ms: Int) -> Int {
  let delay = backoff_delay(attempt, base_ms)
  return delay + random_int(0, delay / 2 + 1)
}

fn fetch_price_once(symbol: String) -> Option[Float] {
  return match http_get(price_url(symbol)) {
    Ok(body) => parse_price(body),
    Err(_) => None,
  }
}

fn fetch_price(symbol: String, retries: Int) -> Option[Float] {
  var attempt = 0
  while attempt <= retries {
    let price = fetch_price_once(symbol)
    if is_some(price) {
      return price
    }
    if attempt < retries {
      sleep(jittered_delay(attempt, 100))
    }
    attempt = attempt + 1
  }
  return None
}

fn fetch_quote(symbol: String, retries: Int) -> Option[Quote] {
  return match fetch_price(symbol, retries) {
    Some(p) => Some(Quote { symbol: symbol, price: p, fetched_at: now() }),
    None => None,
  }
}
```

## ab_bucketing.effects.fs (effects, basis: sandbox+checker)

Which of these functions can read or write files when called, directly or through the functions they call? Functions: assign_variant, assignment_payload, enroll, hash_bucket, random_variant, record_assignment, sticky_variant, variant_name.

Recorded answer: `[]`

Python version shown to the model:

```python
"""A/B experiment enrollment: sticky or random variants, recorded with the analytics API."""

import random
import urllib.error
import urllib.request


def variant_name(index: int) -> str:
    """The variant for a bucket index."""
    if index == 0:
        return "control"
    if index == 1:
        return "treatment"
    return "holdout"


def hash_bucket(user_id: int, buckets: int) -> int:
    """A stable bucket for a user id."""
    return (user_id * 2654435 + 12345) % buckets


def sticky_variant(user_id: int) -> str:
    """The variant a user always gets."""
    return variant_name(hash_bucket(user_id, 3))


def random_variant() -> str:
    """A uniformly random variant."""
    return variant_name(random.randrange(3))


def assign_variant(user_id: int, sticky: bool) -> str:
    """The user's sticky variant, or a random one when `sticky` is False."""
    if sticky:
        return sticky_variant(user_id)
    return random_variant()


def assignment_payload(experiment: str, user_id: int, variant: str) -> str:
    """The form-encoded body that records one assignment."""
    return "experiment=" + experiment + "&user=" + str(user_id) + "&variant=" + variant


def record_assignment(api: str, experiment: str, user_id: int, variant: str) -> bool:
    """POST the assignment to the analytics API; False if the request fails."""
    body = assignment_payload(experiment, user_id, variant).encode("utf-8")
    request = urllib.request.Request(api + "/assignments", data=body, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=5):
            return True
    except urllib.error.URLError:
        return False


def enroll(api: str, experiment: str, user_id: int, sticky: bool) -> str:
    """Assign and record a variant; falls back to control if recording fails."""
    variant = assign_variant(user_id, sticky)
    if not record_assignment(api, experiment, user_id, variant):
        return "control"
    return variant
```

Stripped Canon:

```canon
fn variant_name(index: Int) -> String {
  return match index {
    0 => "control",
    1 => "treatment",
    _ => "holdout",
  }
}

fn hash_bucket(user_id: Int, buckets: Int) -> Int {
  return (user_id * 2654435 + 12345) % buckets
}

fn sticky_variant(user_id: Int) -> String {
  return variant_name(hash_bucket(user_id, 3))
}

fn random_variant() -> String {
  return variant_name(random_int(0, 3))
}

fn assign_variant(user_id: Int, sticky: Bool) -> String {
  if sticky {
    return sticky_variant(user_id)
  }
  return random_variant()
}

fn assignment_payload(experiment: String, user_id: Int, variant: String) -> String {
  return "experiment=" + experiment + "&user=" + to_string(user_id) + "&variant=" + variant
}

fn record_assignment(api: String, experiment: String, user_id: Int, variant: String) -> Bool {
  let body = assignment_payload(experiment, user_id, variant)
  return match http_post(api + "/assignments", body) {
    Ok(_) => true,
    Err(_) => false,
  }
}

fn enroll(api: String, experiment: String, user_id: Int, sticky: Bool) -> String {
  let variant = assign_variant(user_id, sticky)
  if !record_assignment(api, experiment, user_id, variant) {
    return "control"
  }
  return variant
}
```

## parse_money.failure (failure, basis: executed)

For which of these calls does `parse_money` return an error result (an error, not a successful value)? The arguments are written as JSON.
A. parse_money("45$,54.")
B. parse_money(",1$,6")
C. parse_money("$00112")
D. parse_money("$1234")

Recorded answer: `["A","B","C"]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str


def parse_money(s: str) -> Ok[int] | Err:
    """Parse an amount such as "-$1,234.56" into signed cents."""
    negative = s.startswith("-")
    body = s[1:] if negative else s
    if not body.startswith("$"):
        return {"ok": False, "error": "missing $"}
    dollars_text, dot, cents_text = body[1:].partition(".")
    if dot and not (len(cents_text) == 2 and _all_digits(cents_text)):
        return {"ok": False, "error": "bad cents"}
    dollars = _parse_dollars(dollars_text)
    if dollars is None:
        return {"ok": False, "error": "bad dollars"}
    cents = dollars * 100 + (int(cents_text) if dot else 0)
    return {"ok": True, "value": -cents if negative else cents}


def _all_digits(text: str) -> bool:
    """True if every character is an ASCII digit (vacuously true for "")."""
    return all("0" <= ch <= "9" for ch in text)


def _parse_dollars(text: str) -> int | None:
    """Validate plain or comma-grouped dollars without a leading zero; return the value."""
    head, *groups = text.split(",")
    if not head or not _all_digits(head):
        return None
    if groups and (len(head) > 3 or any(len(g) != 3 or not _all_digits(g) for g in groups)):
        return None
    digits = head + "".join(groups)
    if len(digits) > 1 and digits[0] == "0":
        return None
    return int(digits)
```

Stripped Canon:

```canon
fn all_digits(cs: List[String]) -> Bool {
  return len(filter(cs, |c| c >= "0" && c <= "9")) == len(cs)
}

fn dollars_ok(d: String) -> Bool {
  let groups = split(d, ",")
  let plain = split(join(groups, ""), "")
  if len(plain) == 0 || !all_digits(plain) {
    return false
  }
  if len(plain) > 1 && unwrap_or(first(plain), "") == "0" {
    return false
  }
  if len(groups) == 1 {
    return true
  }
  let g0 = groups
    |> first()
    |> unwrap_or("")
    |> str_len()
  if g0 < 1 || g0 > 3 {
    return false
  }
  for g in drop(groups, 1) {
    if str_len(g) != 3 {
      return false
    }
  }
  return true
}

fn parse_money(s: String) -> Result[Int, String] {
  let cs = split(s, "")
  let neg = unwrap_or(first(cs), "") == "-"
  var rest = cs
  if neg {
    rest = drop(cs, 1)
  }
  if unwrap_or(first(rest), "") != "$" {
    return Err("missing $")
  }
  let pieces = rest
    |> drop(1)
    |> join("")
    |> split(".")
  let dollars = unwrap_or(first(pieces), "")
  var cents = 0
  if len(pieces) > 1 {
    let after = join(drop(pieces, 1), ".")
    let ccs = split(after, "")
    if len(ccs) != 2 || !all_digits(ccs) {
      return Err("bad cents")
    }
    cents = unwrap_or(parse_int(after), 0)
  }
  if !dollars_ok(dollars) {
    return Err("bad dollars")
  }
  let total = (dollars |> split(",") |> join("") |> parse_int() |> unwrap_or(0)) * 100 + cents
  if neg {
    return Ok(0 - total)
  }
  return Ok(total)
}
```

## min_coins.output (output, basis: executed)

What does `min_coins([5,6,11], 5)` return? The arguments are written as JSON. Values are written as JSON: a list or tuple is an array, a record is an object, a variant is an object with a "kind" field naming it plus its fields, an optional value is the value or null, and a result is {"ok": true, "value": v} or {"ok": false, "error": e}.

Recorded answer: `[1,[5]]`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar


def min_coins(coins: list[int], amount: int) -> tuple[int, list[int]] | None:
    """Fewest coins summing to amount; among ties, the lexicographically greatest descending list."""
    if amount < 0:
        return None
    values = sorted(set(coins), reverse=True)
    unreachable = amount + 1
    fewest = [0] + [unreachable] * amount
    for total in range(1, amount + 1):
        for coin in values:
            if coin <= total and fewest[total - coin] + 1 < fewest[total]:
                fewest[total] = fewest[total - coin] + 1
    if fewest[amount] == unreachable:
        return None
    used: list[int] = []
    remaining = amount
    while remaining > 0:
        # The largest coin that still allows an optimal finish is the best next element;
        # later picks can never exceed it, so the list stays in descending order.
        coin = next(
            c for c in values if c <= remaining and fewest[remaining - c] == fewest[remaining] - 1
        )
        used.append(coin)
        remaining -= coin
    return (len(used), used)
```

Stripped Canon:

```canon
fn at(xs: List[Int], i: Int) -> Int {
  return xs
    |> drop(i)
    |> first()
    |> unwrap_or(0)
}

fn min_coins(coins: List[Int], amount: Int) -> Option[(Int, List[Int])] {
  if amount < 0 {
    return None
  }
  var best = [0]
  for a in range(1, amount + 1) {
    var b = -1
    for c in coins {
      if a - c >= 0 {
        let p = at(best, a - c)
        if p >= 0 && (b < 0 || p + 1 < b) {
          b = p + 1
        }
      }
    }
    best = append(best, b)
  }
  if at(best, amount) < 0 {
    return None
  }
  let desc = sort_desc_by(coins, |c| c)
  var used = []
  var a = amount
  var cap = amount
  while a > 0 {
    let rest = a
    let limit = cap
    let need = at(best, rest) - 1
    let pick = first(filter(desc, |c| c <= limit && rest - c >= 0 && at(best, rest - c) == need))
    let c = unwrap_or(pick, rest)
    used = append(used, c)
    a = a - c
    cap = c
  }
  return Some((len(used), used))
}
```

## health_checker.effects.time (effects, basis: sandbox+checker)

Which of these functions can read the clock or sleep when called, directly or through the functions they call? Functions: check_all, check_from_file, classify, classify_of, parse_targets, probe, status_line, write_status.

Recorded answer: `["check_all","check_from_file","probe","write_status"]`

Python version shown to the model:

```python
"""Service health checker: probes each target's /healthz and writes a status file."""

import time
import urllib.error
import urllib.request


def classify(latency_ms: int) -> str:
    """Health class for a probe latency (-1 means the probe failed)."""
    if latency_ms < 0:
        return "down"
    elif latency_ms <= 1000:
        return "healthy"
    return "degraded"


def status_line(url: str, latency_ms: int) -> str:
    """One line of the status file."""
    return classify(latency_ms) + " " + url + " " + str(latency_ms)


def parse_targets(text: str) -> list[str]:
    """The target URLs in a targets file, one per line, blank lines skipped."""
    return [line.strip() for line in text.split("\n") if line.strip() != ""]


def probe(url: str) -> int:
    """Latency of the target's health endpoint in ms, or -1 if it is unreachable."""
    started = time.monotonic()
    try:
        with urllib.request.urlopen(url + "/healthz", timeout=2):
            pass
    except urllib.error.URLError:
        return -1
    return int((time.monotonic() - started) * 1000)


def check_all(urls: list[str]) -> list[str]:
    """A status line for every target."""
    return [status_line(url, probe(url)) for url in urls]


def write_status(path: str, urls: list[str]) -> int:
    """Probe every target, write the status file, return how many are not healthy."""
    lines = check_all(urls)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len([line for line in lines if classify_of(line) != "healthy"])


def classify_of(line: str) -> str:
    """The health class at the start of a status line."""
    return line.split(" ")[0]


def check_from_file(targets_path: str, status_path: str) -> int:
    """Read the targets file and write the status file; returns the unhealthy count."""
    with open(targets_path, encoding="utf-8") as f:
        text = f.read()
    return write_status(status_path, parse_targets(text))
```

Stripped Canon:

```canon
fn classify(latency_ms: Int) -> String {
  if latency_ms < 0 {
    return "down"
  } else if latency_ms <= 1000 {
    return "healthy"
  }
  return "degraded"
}

fn status_line(url: String, latency_ms: Int) -> String {
  return classify(latency_ms) + " " + url + " " + to_string(latency_ms)
}

fn parse_targets(text: String) -> List[String] {
  return text
    |> split("\n")
    |> map(|l| trim(l))
    |> filter(|l| l != "")
}

fn probe(url: String) -> Int {
  let started = now()
  return match http_get(url + "/healthz") {
    Ok(_) => now() - started,
    Err(_) => -1,
  }
}

fn check_all(urls: List[String]) -> List[String] {
  var lines = []
  for url in urls {
    lines = append(lines, status_line(url, probe(url)))
  }
  return lines
}

fn write_status(path: String, urls: List[String]) -> Result[Int, Error] {
  let lines = check_all(urls)
  try write_file(path, join(lines, "\n") + "\n")
  return Ok(len(filter(lines, |l| classify_of(l) != "healthy")))
}

fn classify_of(line: String) -> String {
  return line
    |> split(" ")
    |> first()
    |> unwrap_or("")
}

fn check_from_file(targets_path: String, status_path: String) -> Result[Int, Error] {
  let text = try read_file(targets_path)
  return write_status(status_path, parse_targets(text))
}
```

## stack_vm.property (property, basis: witness)

Can `stack_vm` ever return a successful result whose value is an empty list? Consider every possible argument value of the declared types for which the function returns normally (without raising, throwing or trapping).

Recorded answer: `true`

Python version shown to the model:

```python
from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Push(TypedDict):
    kind: Literal["Push"]
    n: int

class Pop(TypedDict):
    kind: Literal["Pop"]

class Add(TypedDict):
    kind: Literal["Add"]

class Sub(TypedDict):
    kind: Literal["Sub"]

class Mul(TypedDict):
    kind: Literal["Mul"]

class Dup(TypedDict):
    kind: Literal["Dup"]

class Swap(TypedDict):
    kind: Literal["Swap"]

class Jz(TypedDict):
    kind: Literal["Jz"]
    target: int

class Jmp(TypedDict):
    kind: Literal["Jmp"]
    target: int

class Print(TypedDict):
    kind: Literal["Print"]

class Halt(TypedDict):
    kind: Literal["Halt"]

Instr = Push | Pop | Add | Sub | Mul | Dup | Swap | Jz | Jmp | Print | Halt


STEP_LIMIT = 1000

STACK_NEEDS: dict[str, int] = {
    "Pop": 1, "Dup": 1, "Print": 1, "Jz": 1,
    "Add": 2, "Sub": 2, "Mul": 2, "Swap": 2,
}

BINARY_OPS: dict[str, Callable[[int, int], int]] = {
    "Add": lambda a, b: a + b,
    "Sub": lambda a, b: a - b,
    "Mul": lambda a, b: a * b,
}


def stack_vm(prog: list[Instr]) -> Ok[list[int]] | Err:
    """Execute a stack-machine program and return the values it prints."""
    stack: list[int] = []
    output: list[int] = []
    pc = 0
    steps = 0
    while 0 <= pc < len(prog):
        if steps == STEP_LIMIT:
            return {"ok": False, "error": "step limit exceeded"}
        steps += 1

        instr = prog[pc]
        kind = instr["kind"]
        if len(stack) < STACK_NEEDS.get(kind, 0):
            return {"ok": False, "error": f"stack underflow at {pc}"}

        next_pc = pc + 1
        if instr["kind"] == "Push":
            stack.append(instr["n"])
        elif instr["kind"] == "Pop":
            stack.pop()
        elif instr["kind"] in BINARY_OPS:
            b = stack.pop()
            a = stack.pop()
            stack.append(BINARY_OPS[instr["kind"]](a, b))
        elif instr["kind"] == "Dup":
            stack.append(stack[-1])
        elif instr["kind"] == "Swap":
            stack[-1], stack[-2] = stack[-2], stack[-1]
        elif instr["kind"] == "Print":
            output.append(stack.pop())
        elif instr["kind"] == "Jz" or instr["kind"] == "Jmp":
            target = instr["target"]
            if not 0 <= target < len(prog):
                return {"ok": False, "error": f"bad jump at {pc}"}
            if instr["kind"] == "Jmp" or stack.pop() == 0:
                next_pc = target
        elif instr["kind"] == "Halt":
            break
        pc = next_pc
    return {"ok": True, "value": output}
```

Stripped Canon:

```canon
type Instr =
  | Push(n: Int)
  | Pop
  | Add
  | Sub
  | Mul
  | Dup
  | Swap
  | Jz(target: Int)
  | Jmp(target: Int)
  | Print
  | Halt

fn needs(ins: Instr) -> Int {
  return match ins {
    Push(_) => 0,
    Pop => 1,
    Add => 2,
    Sub => 2,
    Mul => 2,
    Dup => 1,
    Swap => 2,
    Jz(_) => 1,
    Jmp(_) => 0,
    Print => 1,
    Halt => 0,
  }
}

fn jump_target(ins: Instr) -> Option[Int] {
  return match ins {
    Jz(t) => Some(t),
    Jmp(t) => Some(t),
    _ => None,
  }
}

fn stack_vm(prog: List[Instr]) -> Result[List[Int], String] {
  let n = len(prog)
  var stack = []
  var out = []
  var pc = 0
  var steps = 0
  while pc < n {
    if steps == 1000 {
      return Err("step limit exceeded")
    }
    steps = steps + 1
    let ins = prog
      |> drop(pc)
      |> first()
      |> unwrap_or(Halt)
    let size = len(stack)
    if size < needs(ins) {
      return Err("stack underflow at " + to_string(pc))
    }
    let target = unwrap_or(jump_target(ins), 0)
    if target < 0 || target >= n {
      return Err("bad jump at " + to_string(pc))
    }
    let b = unwrap_or(last(stack), 0)
    let a = stack
      |> take(size - 1)
      |> last()
      |> unwrap_or(0)
    let rest1 = take(stack, size - 1)
    let rest2 = take(stack, size - 2)
    stack = match ins {
      Push(v) => append(stack, v),
      Pop => rest1,
      Add => append(rest2, a + b),
      Sub => append(rest2, a - b),
      Mul => append(rest2, a * b),
      Dup => append(stack, b),
      Swap => append(append(rest2, b), a),
      Jz(_) => rest1,
      Jmp(_) => stack,
      Print => rest1,
      Halt => stack,
    }
    if ins == Print {
      out = append(out, b)
    }
    pc = match ins {
      Jz(t) => if_zero(b, t, pc + 1),
      Jmp(t) => t,
      Halt => n,
      _ => pc + 1,
    }
  }
  return Ok(out)
}

fn if_zero(v: Int, yes: Int, no: Int) -> Int {
  if v == 0 {
    return yes
  }
  return no
}
```
