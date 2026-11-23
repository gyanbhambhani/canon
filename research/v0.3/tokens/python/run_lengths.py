def run_lengths(s: str) -> list[tuple[str, int]]:
    runs: list[tuple[str, int]] = []
    for c in s:
        if runs and runs[-1][0] == c:
            runs[-1] = (c, runs[-1][1] + 1)
        else:
            runs.append((c, 1))
    return runs
