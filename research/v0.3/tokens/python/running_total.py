def running_total(xs: list[int]) -> list[int]:
    result: list[int] = []
    total = 0
    for x in xs:
        total += x
        result.append(total)
    return result
