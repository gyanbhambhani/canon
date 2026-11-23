"""Snowflake-style ids: milliseconds since a custom epoch, a worker number and a sequence."""

import random
import time


def compose_id(ms: int, worker: int, seq: int) -> int:
    """Pack a timestamp, worker and sequence number into one id."""
    return (ms - 1600000000000) * 4096 + worker * 64 + seq % 64


def id_timestamp(id: int) -> int:
    """The millisecond timestamp an id was made at."""
    return id // 4096 + 1600000000000


def id_worker(id: int) -> int:
    """The worker number inside an id."""
    return id % 4096 // 64


def format_id(id: int) -> str:
    """The printable form of an id."""
    return "id-" + str(id)


def new_id(worker: int) -> int:
    """A new id for `worker` with a random sequence number."""
    ms = int(time.time() * 1000)
    return compose_id(ms, worker, random.randrange(64))


def next_sequence(path: str) -> int:
    """Increment the counter stored at `path` and return the new value."""
    try:
        with open(path, encoding="utf-8") as f:
            current = int(f.read().strip())
    except (OSError, ValueError):
        current = 0
    with open(path, "w", encoding="utf-8") as f:
        f.write(str(current + 1))
    return current + 1


def sequential_id(path: str, worker: int) -> int:
    """A new id whose sequence comes from the persistent counter."""
    seq = next_sequence(path)
    return compose_id(int(time.time() * 1000), worker, seq)


def new_request_id() -> str:
    """A printable id for tagging one request."""
    return format_id(new_id(0))
