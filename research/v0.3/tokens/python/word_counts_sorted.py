def word_counts_sorted(s: str) -> list[tuple[str, int]]:
    if s == "":
        return []
    counts: dict[str, int] = {}
    for word in s.split(" "):
        counts[word] = counts.get(word, 0) + 1
    return sorted(counts.items(), key=lambda pair: pair[1], reverse=True)
