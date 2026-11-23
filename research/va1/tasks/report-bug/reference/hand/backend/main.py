"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class BugReport(BaseModel):
    title: str
    severity: int
    steps: list[str]


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/bugs")
def report_bug(b: BugReport) -> BugReport:
    if not 5 <= len(b.title) <= 100:
        raise InvalidRequest("title must have 5 to 100 characters")
    if not 1 <= b.severity <= 4:
        raise InvalidRequest("severity must be from 1 to 4")
    if len(b.steps) > 10:
        raise InvalidRequest("at most 10 steps")
    return b
