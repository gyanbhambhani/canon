"""The forms service: small stateless JSON endpoints."""

import re

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class Subscription(BaseModel):
    email: str
    name: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/newsletter")
def subscribe_newsletter(sub: Subscription) -> Subscription:
    if EMAIL.fullmatch(sub.email) is None:
        raise InvalidRequest("email must be an email address")
    if not sub.name.strip() or len(sub.name) > 50:
        raise InvalidRequest("name must be present and at most 50 characters")
    return sub
