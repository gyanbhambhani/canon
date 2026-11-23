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
