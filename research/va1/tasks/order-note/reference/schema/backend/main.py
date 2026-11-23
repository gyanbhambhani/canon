"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import OrderNote

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/order-notes")
def add_order_note(r: OrderNote) -> OrderNote:
    return r
