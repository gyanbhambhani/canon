"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class TransferRequest(BaseModel):
    from_account: str
    to_account: str
    amount: int
    balance: int


class Transfer(BaseModel):
    from_account: str
    to_account: str
    amount: int
    balance: int
    remaining: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/transfers")
def make_transfer(r: TransferRequest) -> Transfer:
    if not 1 <= len(r.from_account) <= 20:
        raise InvalidRequest("from_account must have 1 to 20 characters")
    if not 1 <= len(r.to_account) <= 20:
        raise InvalidRequest("to_account must have 1 to 20 characters")
    if r.from_account == r.to_account:
        raise InvalidRequest("from_account and to_account must differ")
    if r.amount < 1:
        raise InvalidRequest("amount must be at least 1")
    if r.balance < 0:
        raise InvalidRequest("balance must be at least 0")
    if r.amount > r.balance:
        raise InvalidRequest("amount must be at most balance")
    return Transfer(
        from_account=r.from_account,
        to_account=r.to_account,
        amount=r.amount,
        balance=r.balance,
        remaining=r.balance - r.amount,
    )
