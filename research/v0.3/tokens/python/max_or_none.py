def max_or_none(xs: list[int]) -> int | None:
    if not xs:
        return None
    return max(xs)
