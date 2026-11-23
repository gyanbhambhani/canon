"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

class SeatBlock(BaseModel):
    seats: int
    row: int
    first_seat: int



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/seats/reserve")
def reserve_seats(r: SeatBlock) -> SeatBlock:
    if not 1 <= r.seats <= 10:
        raise InvalidRequest("seats must be from 1 to 10")
    if not 1 <= r.row <= 30:
        raise InvalidRequest("row must be from 1 to 30")
    if not 1 <= r.first_seat <= 20:
        raise InvalidRequest("first_seat must be from 1 to 20")
    if r.first_seat + r.seats - 1 > 20:
        raise InvalidRequest("the seats must fit in the row")
    return r
