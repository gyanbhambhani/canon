"""The forms service: small stateless JSON endpoints."""

import re

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

EMAIL = re.compile(r"[^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+")


class Terms(BaseModel):
    email: str
    accepted: bool


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/terms")
def accept_terms(t: Terms) -> Terms:
    if EMAIL.fullmatch(t.email) is None:
        raise InvalidRequest("email must be a valid address")
    if not t.accepted:
        raise InvalidRequest("the terms must be accepted")
    return t
