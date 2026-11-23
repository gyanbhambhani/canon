"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

REASONS = ("sold", "damaged", "lost")


class StockRemoval(BaseModel):
    on_hand: int
    remove: int
    reason: str


class StockResult(BaseModel):
    on_hand: int
    remove: int
    reason: str
    left: int



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/inventory/remove")
def remove_stock(r: StockRemoval) -> StockResult:
    if not 0 <= r.on_hand <= 100000:
        raise InvalidRequest("on_hand must be from 0 to 100000")
    if r.remove < 1:
        raise InvalidRequest("remove must be at least 1")
    if r.reason not in REASONS:
        raise InvalidRequest("reason must be sold, damaged or lost")
    if r.remove > r.on_hand:
        raise InvalidRequest("remove must not exceed on_hand")
    return StockResult(on_hand=r.on_hand, remove=r.remove, reason=r.reason, left=r.on_hand - r.remove)
