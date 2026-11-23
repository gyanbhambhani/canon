from dataclasses import dataclass


@dataclass
class Student:
    name: str
    scores: list[int]


def letter(avg: int) -> str:
    if avg >= 90:
        return "A"
    if avg >= 80:
        return "B"
    if avg >= 70:
        return "C"
    if avg >= 60:
        return "D"
    return "F"


def report_card(students: list[Student]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for student in students:
        avg = 0
        if student.scores:
            avg = int(sum(student.scores) / len(student.scores))
        result.append((student.name, letter(avg)))
    return result
