"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Meeting(BaseModel):
    title: str
    start_hour: int
    duration_min: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/meetings")
def schedule_meeting(r: Meeting) -> Meeting:
    if not 1 <= len(r.title) <= 60:
        raise InvalidRequest("title must have 1 to 60 characters")
    if not 0 <= r.start_hour <= 23:
        raise InvalidRequest("start_hour must be from 0 to 23")
    if not 15 <= r.duration_min <= 240 or r.duration_min % 15 != 0:
        raise InvalidRequest("duration_min must be from 15 to 240 and a multiple of 15")
    if r.start_hour * 60 + r.duration_min > 1440:
        raise InvalidRequest("the meeting must end by midnight")
    return r
