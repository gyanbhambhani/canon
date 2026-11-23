"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

class LoanApplication(BaseModel):
    principal: int
    months: int
    monthly_payment: int



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/loans")
def apply_for_loan(r: LoanApplication) -> LoanApplication:
    if not 1000 <= r.principal <= 1000000:
        raise InvalidRequest("principal must be from 1000 to 1000000")
    if not 6 <= r.months <= 360:
        raise InvalidRequest("months must be from 6 to 360")
    if not 1 <= r.monthly_payment <= 1000000:
        raise InvalidRequest("monthly_payment must be from 1 to 1000000")
    if r.monthly_payment * r.months < r.principal:
        raise InvalidRequest("the payments must cover the principal")
    return r
