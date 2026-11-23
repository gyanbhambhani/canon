"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Poll(BaseModel):
    question: str
    options: list[str]


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/polls")
def create_poll(poll: Poll) -> Poll:
    if not 5 <= len(poll.question) <= 120:
        raise InvalidRequest("question must have 5 to 120 characters")
    if not 2 <= len(poll.options) <= 6:
        raise InvalidRequest("options must have 2 to 6 entries")
    return poll
