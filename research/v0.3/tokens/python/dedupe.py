def dedupe(xs: list[int]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []
    for x in xs:
        if x not in seen:
            seen.add(x)
            result.append(x)
    return result
