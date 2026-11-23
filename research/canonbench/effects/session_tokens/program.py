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
