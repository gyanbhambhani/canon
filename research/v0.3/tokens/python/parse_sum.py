import re


def parse_sum(s: str) -> int:
    total = 0
    for item in s.split(","):
        if re.fullmatch(r"-?[0-9]+", item):
            total += int(item)
    return total
