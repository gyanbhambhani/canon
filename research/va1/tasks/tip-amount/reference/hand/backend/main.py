"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Tip(BaseModel):
    amount: float
    percent: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/tips")
def add_tip(r: Tip) -> Tip:
    if not 0.01 <= r.amount <= 10000.0:
        raise InvalidRequest("amount must be from 0.01 to 10000.0")
    if not 0 <= r.percent <= 100:
        raise InvalidRequest("percent must be from 0 to 100")
    return r
