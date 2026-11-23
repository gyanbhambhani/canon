"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Rectangle, RectangleRequest

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/rectangles")
def create_rectangle(r: RectangleRequest) -> Rectangle:
    return Rectangle(width=r.width, height=r.height, label=r.label, area=r.width * r.height)
