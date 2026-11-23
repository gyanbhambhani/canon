"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class AgeRange(BaseModel):
    min_age: int
    max_age: int
    title: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/events/ages")
def set_age_range(r: AgeRange) -> AgeRange:
    if not 0 <= r.min_age <= 120 or not 0 <= r.max_age <= 120:
        raise InvalidRequest("ages must be from 0 to 120")
    if r.min_age > r.max_age:
        raise InvalidRequest("min_age must be at most max_age")
    if not r.title.strip(" \t\r\n") or len(r.title) > 60:
        raise InvalidRequest("title must be present and at most 60 characters")
    return r
