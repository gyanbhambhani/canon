"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

GRANULARITIES = ("day", "week")


class ReportRange(BaseModel):
    from_day: int
    to_day: int
    granularity: str



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/reports/range")
def request_report(r: ReportRange) -> ReportRange:
    if not 1 <= r.from_day <= 31:
        raise InvalidRequest("from_day must be from 1 to 31")
    if not 1 <= r.to_day <= 31:
        raise InvalidRequest("to_day must be from 1 to 31")
    if r.granularity not in GRANULARITIES:
        raise InvalidRequest("granularity must be day or week")
    if r.to_day < r.from_day:
        raise InvalidRequest("to_day must not be before from_day")
    if r.to_day - r.from_day > 14 and r.granularity != "week":
        raise InvalidRequest("a range wider than 14 days must be week")
    return r
