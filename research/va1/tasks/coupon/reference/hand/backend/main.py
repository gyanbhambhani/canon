"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class CouponRequest(BaseModel):
    code: str
    subtotal: int
    discount: int


class Coupon(BaseModel):
    code: str
    subtotal: int
    discount: int
    payable: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/coupons/apply")
def apply_coupon(r: CouponRequest) -> Coupon:
    if not 3 <= len(r.code) <= 20:
        raise InvalidRequest("code must have 3 to 20 characters")
    if r.subtotal < 1:
        raise InvalidRequest("subtotal must be at least 1")
    if r.discount < 0:
        raise InvalidRequest("discount must be at least 0")
    if r.discount > r.subtotal:
        raise InvalidRequest("discount must be at most subtotal")
    return Coupon(code=r.code, subtotal=r.subtotal, discount=r.discount, payable=r.subtotal - r.discount)
