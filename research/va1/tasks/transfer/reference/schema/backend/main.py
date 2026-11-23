"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Transfer, TransferRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/transfers")
def make_transfer(r: TransferRequest) -> Transfer:
    return Transfer(
        from_account=r.from_account,
        to_account=r.to_account,
        amount=r.amount,
        balance=r.balance,
        remaining=r.balance - r.amount,
    )
