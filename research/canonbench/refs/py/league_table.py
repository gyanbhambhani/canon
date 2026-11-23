from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Match(TypedDict):
    home: str
    away: str
    home_goals: int
    away_goals: int


def league_table(matches: list[Match]) -> list[tuple[str, int, int, int]]:
    """Build (team, points, goal_difference, goals_for) rows in standard league order."""
    points: dict[str, int] = {}
    scored: dict[str, int] = {}
    conceded: dict[str, int] = {}

    def record(team: str, goals_for: int, goals_against: int) -> None:
        if goals_for > goals_against:
            earned = 3
        elif goals_for == goals_against:
            earned = 1
        else:
            earned = 0
        points[team] = points.get(team, 0) + earned
        scored[team] = scored.get(team, 0) + goals_for
        conceded[team] = conceded.get(team, 0) + goals_against

    for match in matches:
        record(match["home"], match["home_goals"], match["away_goals"])
        record(match["away"], match["away_goals"], match["home_goals"])

    rows = [
        (team, points[team], scored[team] - conceded[team], scored[team]) for team in points
    ]
    rows.sort(key=lambda row: (-row[1], -row[2], -row[3], row[0]))
    return rows
