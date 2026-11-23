"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Recurring, RecurringRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/events/recurring")
def create_recurring(r: RecurringRequest) -> Recurring:
    return Recurring(
        interval_days=r.interval_days,
        occurrences=r.occurrences,
        title=r.title,
        span_days=r.interval_days * r.occurrences,
    )
