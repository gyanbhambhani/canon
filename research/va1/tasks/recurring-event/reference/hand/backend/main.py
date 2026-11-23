"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class RecurringRequest(BaseModel):
    interval_days: int
    occurrences: int
    title: str


class Recurring(BaseModel):
    interval_days: int
    occurrences: int
    title: str
    span_days: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/events/recurring")
def create_recurring(r: RecurringRequest) -> Recurring:
    if not 1 <= r.interval_days <= 365:
        raise InvalidRequest("interval_days must be from 1 to 365")
    if not 1 <= r.occurrences <= 52:
        raise InvalidRequest("occurrences must be from 1 to 52")
    if r.interval_days * r.occurrences > 365:
        raise InvalidRequest("the span (interval_days * occurrences) is at most 365 days")
    if not r.title.strip(" \t\r\n"):
        raise InvalidRequest("title must not be blank")
    return Recurring(
        interval_days=r.interval_days,
        occurrences=r.occurrences,
        title=r.title,
        span_days=r.interval_days * r.occurrences,
    )
