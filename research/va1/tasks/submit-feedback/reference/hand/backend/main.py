"""The forms service: small stateless JSON endpoints."""

import re

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class Feedback(BaseModel):
    email: str
    message: str
    score: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/feedback")
def submit_feedback(r: Feedback) -> Feedback:
    if EMAIL.fullmatch(r.email) is None:
        raise InvalidRequest("email must be an email address")
    if not 10 <= len(r.message) <= 1000:
        raise InvalidRequest("message must have 10 to 1000 characters")
    if not 0 <= r.score <= 10:
        raise InvalidRequest("score must be from 0 to 10")
    return r
