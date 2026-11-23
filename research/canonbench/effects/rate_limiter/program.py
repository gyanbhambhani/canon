"""Token-bucket rate limiter whose state lives in a small file (`tokens,last_ms`)."""

import time
from dataclasses import dataclass


@dataclass
class Bucket:
    tokens: int
    last_ms: int


def parse_bucket(text: str, capacity: int) -> Bucket:
    """Parse the state file; a full bucket if it is malformed."""
    fields = text.strip().split(",")
    if len(fields) != 2:
        return Bucket(capacity, 0)
    try:
        return Bucket(int(fields[0]), int(fields[1]))
    except ValueError:
        return Bucket(capacity, 0)


def encode_bucket(tokens: int, last_ms: int) -> str:
    """Serialize the bucket state."""
    return str(tokens) + "," + str(last_ms)


def refill(tokens: int, last_ms: int, now_ms: int, rate_per_s: int, capacity: int) -> int:
    """Tokens available at `now_ms` after refilling since `last_ms`, capped at `capacity`."""
    return min(capacity, tokens + (now_ms - last_ms) * rate_per_s // 1000)


def wait_time_ms(tokens: int, rate_per_s: int) -> int:
    """How long to wait before a token can be available."""
    if tokens > 0:
        return 0
    return 1000 // rate_per_s


def load_bucket(path: str, capacity: int) -> Bucket:
    """The bucket stored at `path`, or a full bucket if there is none."""
    try:
        with open(path, encoding="utf-8") as f:
            return parse_bucket(f.read(), capacity)
    except OSError:
        return Bucket(capacity, 0)


def try_acquire(path: str, rate_per_s: int, capacity: int) -> bool:
    """Take one token if available, persisting the new state; False if rate limited."""
    bucket = load_bucket(path, capacity)
    now_ms = int(time.time() * 1000)
    tokens = refill(bucket.tokens, bucket.last_ms, now_ms, rate_per_s, capacity)
    if tokens < 1:
        return False
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(encode_bucket(tokens - 1, now_ms))
    except OSError:
        return False
    return True


def acquire_blocking(path: str, rate_per_s: int, capacity: int, max_waits: int) -> bool:
    """Try to take a token, sleeping between attempts up to `max_waits` times."""
    for _ in range(max_waits + 1):
        if try_acquire(path, rate_per_s, capacity):
            return True
        time.sleep(wait_time_ms(0, rate_per_s) / 1000)
    return False
