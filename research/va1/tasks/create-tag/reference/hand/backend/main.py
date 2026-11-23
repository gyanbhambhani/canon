"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

COLORS = ("red", "green", "blue", "gray")


class TagDraft(BaseModel):
    label: str
    color: str



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/tags")
def create_tag(r: TagDraft) -> TagDraft:
    if not 2 <= len(r.label) <= 20:
        raise InvalidRequest("label must have 2 to 20 characters")
    if r.color not in COLORS:
        raise InvalidRequest("color must be red, green, blue or gray")
    return r
