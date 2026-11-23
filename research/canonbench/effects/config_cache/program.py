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
