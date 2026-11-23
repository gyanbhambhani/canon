from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Employee(TypedDict):
    name: str
    dept: str
    hours: int
    rate_cents: int


REGULAR_HOURS = 40
DOUBLE_TIME_HOURS = 60


def employee_pay(emp: Employee) -> int:
    """Pay in cents for one employee: overtime at 1.5x rounded down, then double time."""
    rate = emp["rate_cents"]
    hours = emp["hours"]
    regular = min(hours, REGULAR_HOURS)
    overtime = max(min(hours, DOUBLE_TIME_HOURS) - REGULAR_HOURS, 0)
    double_time = max(hours - DOUBLE_TIME_HOURS, 0)
    return regular * rate + overtime * rate * 3 // 2 + double_time * rate * 2


def payroll_by_dept(emps: list[Employee]) -> list[tuple[str, int]]:
    """Total pay per department, highest total first, ties by department name."""
    totals: dict[str, int] = {}
    for emp in emps:
        totals[emp["dept"]] = totals.get(emp["dept"], 0) + employee_pay(emp)
    return sorted(totals.items(), key=lambda item: (-item[1], item[0]))
