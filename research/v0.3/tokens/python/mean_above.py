def mean_above(xs: list[float], limit: float) -> float:
    above = [x for x in xs if x > limit]
    if not above:
        return 0.0
    return sum(above) / len(above)
