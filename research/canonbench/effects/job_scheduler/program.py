"""A tiny cron: jobs listed as `name, interval_s, last_run_ms`, triggered through an API."""

import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class Job:
    name: str
    interval_s: int
    last_run: int


def parse_job(line: str) -> Job | None:
    """Parse one job line; None if malformed."""
    parts = [p.strip() for p in line.split(",")]
    if len(parts) != 3:
        return None
    try:
        return Job(parts[0], int(parts[1]), int(parts[2]))
    except ValueError:
        return None


def parse_jobs(text: str) -> list[Job]:
    """Every well-formed job in a jobs file."""
    jobs = []
    for line in text.split("\n"):
        job = parse_job(line)
        if job is not None:
            jobs.append(job)
    return jobs


def next_run(interval_s: int, last_run: int) -> int:
    """When a job that last ran at `last_run` is next due."""
    return last_run + interval_s * 1000


def is_due(interval_s: int, last_run: int, now_ms: int) -> bool:
    """True if the job is due at `now_ms`."""
    return now_ms >= next_run(interval_s, last_run)


def due_jobs(path: str) -> list[str]:
    """Names of the jobs in the jobs file that are due now."""
    try:
        with open(path, encoding="utf-8") as f:
            jobs = parse_jobs(f.read())
    except OSError:
        jobs = []
    now_ms = int(time.time() * 1000)
    return [j.name for j in jobs if is_due(j.interval_s, j.last_run, now_ms)]


def trigger(api: str, name: str) -> bool:
    """Ask the job runner API to start a job; False if the request fails."""
    request = urllib.request.Request(api + "/jobs/" + name + "/run", data=b"", method="POST")
    try:
        with urllib.request.urlopen(request, timeout=5):
            return True
    except urllib.error.URLError:
        return False


def run_due(path: str, api: str) -> int:
    """Trigger every due job; returns how many started."""
    started = 0
    for name in due_jobs(path):
        if trigger(api, name):
            started += 1
    return started
