"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

CATEGORIES = ("food", "drink", "tool")


class PriceFilter(BaseModel):
    min_price: int
    max_price: int
    category: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/filters/price")
def filter_by_price(f: PriceFilter) -> PriceFilter:
    if f.min_price < 0:
        raise InvalidRequest("min_price must be at least 0")
    if f.max_price < 0:
        raise InvalidRequest("max_price must be at least 0")
    if f.min_price > f.max_price:
        raise InvalidRequest("min_price must be at most max_price")
    if f.category not in CATEGORIES:
        raise InvalidRequest("category must be food, drink or tool")
    return f
