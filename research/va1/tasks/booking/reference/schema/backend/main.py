"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Stay, StayRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/bookings")
def book_stay(r: StayRequest) -> Stay:
    return Stay(guest=r.guest, start=r.start, end=r.end, nights=r.end - r.start)
