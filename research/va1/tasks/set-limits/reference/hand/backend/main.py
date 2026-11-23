"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Limits(BaseModel):
    daily: int
    monthly: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/limits")
def set_limits(limits: Limits) -> Limits:
    if not 1 <= limits.daily <= 1000:
        raise InvalidRequest("daily must be from 1 to 1000")
    if not 1 <= limits.monthly <= 31000:
        raise InvalidRequest("monthly must be from 1 to 31000")
    return limits
