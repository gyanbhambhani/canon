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
