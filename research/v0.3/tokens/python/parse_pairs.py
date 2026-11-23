import re
from dataclasses import dataclass


@dataclass
class Ok[T]:
    value: T


@dataclass
class Err:
    error: str


type Result[T] = Ok[T] | Err


def parse_pairs(s: str) -> Result[list[tuple[str, int]]]:
    if s == "":
        return Ok([])
    pairs: list[tuple[str, int]] = []
    for item in s.split(";"):
        parts = item.split("=")
        if len(parts) != 2 or not re.fullmatch(r"-?[0-9]+", parts[1]):
            return Err("bad item: " + item)
        pairs.append((parts[0], int(parts[1])))
    return Ok(pairs)
