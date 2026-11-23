def count_greater(xs: list[int], limit: int) -> int:
    return sum(1 for x in xs if x > limit)
