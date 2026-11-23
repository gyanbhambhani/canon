def most_common_word(s: str) -> str | None:
    if s == "":
        return None
    counts: dict[str, int] = {}
    for word in s.split(" "):
        counts[word] = counts.get(word, 0) + 1
    best: str | None = None
    for word, count in counts.items():
        if best is None or count > counts[best]:
            best = word
    return best
