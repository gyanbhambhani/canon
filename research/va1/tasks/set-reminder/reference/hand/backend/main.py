"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

CHANNELS = ("email", "sms", "push")


class Reminder(BaseModel):
    minutes_before: int
    channel: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/reminders")
def set_reminder(r: Reminder) -> Reminder:
    if not 5 <= r.minutes_before <= 1440:
        raise InvalidRequest("minutes_before must be from 5 to 1440")
    if r.channel not in CHANNELS:
        raise InvalidRequest("channel must be email, sms or push")
    return r
