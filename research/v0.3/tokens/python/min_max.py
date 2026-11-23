def min_max(xs: list[int]) -> tuple[int, int] | None:
    if not xs:
        return None
    return (min(xs), max(xs))
