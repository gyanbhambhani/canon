"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

class DiscountRule(BaseModel):
    percent: int
    fixed_cents: int
    name: str



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/discounts")
def create_discount(r: DiscountRule) -> DiscountRule:
    if not 0 <= r.percent <= 100:
        raise InvalidRequest("percent must be from 0 to 100")
    if not 0 <= r.fixed_cents <= 100000:
        raise InvalidRequest("fixed_cents must be from 0 to 100000")
    if not 1 <= len(r.name) <= 30:
        raise InvalidRequest("name must have 1 to 30 characters")
    if (r.percent > 0) == (r.fixed_cents > 0):
        raise InvalidRequest("exactly one of percent and fixed_cents must be greater than 0")
    return r
