"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class TableBooking(BaseModel):
    party_size: int
    name: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/tables/book")
def book_table(r: TableBooking) -> TableBooking:
    if not 1 <= r.party_size <= 12:
        raise InvalidRequest("party_size must be from 1 to 12")
    if not r.name.strip(" \t\r\n") or len(r.name) > 40:
        raise InvalidRequest("name must be present and at most 40 characters")
    return r
