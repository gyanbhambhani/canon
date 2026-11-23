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
