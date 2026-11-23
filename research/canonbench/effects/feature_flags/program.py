"""Feature flags given as `name: percent` lines, from a local file or a flag service."""

import random
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class Flag:
    name: str
    percent: int


def parse_flag(line: str) -> Flag | None:
    """Parse one `name: percent` line; None if malformed."""
    parts = line.split(":")
    if len(parts) != 2:
        return None
    try:
        percent = int(parts[1].strip())
    except ValueError:
        return None
    return Flag(parts[0].strip(), percent)


def parse_flags(text: str) -> list[Flag]:
    """Every well-formed flag in a flags document, in order."""
    flags = []
    for line in text.split("\n"):
        flag = parse_flag(line)
        if flag is not None:
            flags.append(flag)
    return flags


def user_bucket(user_id: int, salt: int) -> int:
    """A stable bucket in [0, 100) for a user, salted per flag."""
    return (user_id * 31 + salt * 17) % 100


def is_enabled_for(flags_text: str, name: str, user_id: int) -> bool:
    """Whether flag `name` in `flags_text` is on for `user_id` (deterministic rollout)."""
    for flag in parse_flags(flags_text):
        if flag.name == name:
            return user_bucket(user_id, flag.percent) < flag.percent
    return False


def load_flags(path: str) -> str:
    """The flags file's text, or "" if it cannot be read."""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def fetch_flags(url: str) -> str:
    """The flag service's document, or "" if it cannot be reached."""
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            body: bytes = resp.read()
            return body.decode("utf-8")
    except urllib.error.URLError:
        return ""


def flag_enabled(path: str, name: str, user_id: int) -> bool:
    """Whether a flag from the local flags file is on for a user."""
    return is_enabled_for(load_flags(path), name, user_id)


def sample_enabled(url: str, name: str) -> bool:
    """Whether a remote flag is on for this request, sampled at its percentage."""
    for flag in parse_flags(fetch_flags(url)):
        if flag.name == name:
            return random.randrange(100) < flag.percent
    return False
