def second_largest(xs: list[int]) -> int | None:
    distinct = sorted(set(xs), reverse=True)
    if len(distinct) < 2:
        return None
    return distinct[1]
