"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Band(BaseModel):
    low: int
    high: int
    label: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/bands")
def create_band(b: Band) -> Band:
    if not -50 <= b.low <= 50:
        raise InvalidRequest("low must be from -50 to 50")
    if not -50 <= b.high <= 50:
        raise InvalidRequest("high must be from -50 to 50")
    if b.high - b.low < 2:
        raise InvalidRequest("high must be at least 2 more than low")
    if len(b.label) > 20:
        raise InvalidRequest("label must have at most 20 characters")
    return b
