"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class StayRequest(BaseModel):
    guest: str
    start: int
    end: int


class Stay(BaseModel):
    guest: str
    start: int
    end: int
    nights: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/bookings")
def book_stay(r: StayRequest) -> Stay:
    if not r.guest.strip() or len(r.guest) > 40:
        raise InvalidRequest("guest must be present and at most 40 characters")
    if not 0 <= r.start <= 365:
        raise InvalidRequest("start must be from 0 to 365")
    if r.end <= r.start:
        raise InvalidRequest("end must be after start")
    if r.end - r.start > 30:
        raise InvalidRequest("a stay is at most 30 nights")
    return Stay(guest=r.guest, start=r.start, end=r.end, nights=r.end - r.start)
