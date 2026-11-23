from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Request(TypedDict):
    endpoint: str
    ms: int
    status: int


def latency_report(entries: list[Request]) -> list[tuple[str, int, int, int]]:
    """Per endpoint (slowest p90 first, ties in first-appearance order): count, nearest-rank p90 latency and 5xx errors."""
    latencies: dict[str, list[int]] = {}
    errors: dict[str, int] = {}
    for entry in entries:
        endpoint = entry["endpoint"]
        latencies.setdefault(endpoint, []).append(entry["ms"])
        errors[endpoint] = errors.get(endpoint, 0) + (1 if entry["status"] >= 500 else 0)
    report: list[tuple[str, int, int, int]] = []
    for endpoint, values in latencies.items():
        count = len(values)
        rank = (9 * count + 9) // 10
        p90 = sorted(values)[rank - 1]
        report.append((endpoint, count, p90, errors[endpoint]))
    report.sort(key=lambda row: -row[2])
    return report
