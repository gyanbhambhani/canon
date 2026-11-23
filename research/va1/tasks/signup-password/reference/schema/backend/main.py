"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Account, SignupRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/signup")
def sign_up(r: SignupRequest) -> Account:
    return Account(email=r.email)
