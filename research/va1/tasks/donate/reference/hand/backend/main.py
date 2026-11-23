"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

CURRENCIES = ("USD", "EUR")


class Donation(BaseModel):
    amount: float
    currency: str
    anonymous: bool


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/donations")
def donate(d: Donation) -> Donation:
    if not 1.0 <= d.amount <= 5000.0:
        raise InvalidRequest("amount must be from 1.0 to 5000.0")
    if d.currency not in CURRENCIES:
        raise InvalidRequest("currency must be USD or EUR")
    return d
