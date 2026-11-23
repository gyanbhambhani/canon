"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class OrderNote(BaseModel):
    note: str
    priority: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/order-notes")
def add_order_note(r: OrderNote) -> OrderNote:
    if len(r.note) > 200:
        raise InvalidRequest("note must be at most 200 characters")
    if not 0 <= r.priority <= 9:
        raise InvalidRequest("priority must be from 0 to 9")
    return r
