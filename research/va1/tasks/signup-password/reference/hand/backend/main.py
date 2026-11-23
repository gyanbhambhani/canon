"""The forms service: small stateless JSON endpoints."""

import re

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class SignupRequest(BaseModel):
    email: str
    password: str


class Account(BaseModel):
    email: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/signup")
def sign_up(r: SignupRequest) -> Account:
    if EMAIL.fullmatch(r.email) is None:
        raise InvalidRequest("email must be an email address")
    if len(r.password) < 8:
        raise InvalidRequest("password must have at least 8 characters")
    if r.password == r.email:
        raise InvalidRequest("password must differ from the email")
    return Account(email=r.email)
