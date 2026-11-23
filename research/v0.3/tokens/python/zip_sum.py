def zip_sum(a: list[int], b: list[int]) -> list[int]:
    return [x + y for x, y in zip(a, b)]
