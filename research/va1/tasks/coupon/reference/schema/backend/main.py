"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Coupon, CouponRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/coupons/apply")
def apply_coupon(r: CouponRequest) -> Coupon:
    return Coupon(code=r.code, subtotal=r.subtotal, discount=r.discount, payable=r.subtotal - r.discount)
