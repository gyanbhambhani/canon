"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class RectangleRequest(BaseModel):
    width: int
    height: int
    label: str


class Rectangle(BaseModel):
    width: int
    height: int
    label: str
    area: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/rectangles")
def create_rectangle(r: RectangleRequest) -> Rectangle:
    if r.width < 1 or r.height < 1:
        raise InvalidRequest("width and height must be at least 1")
    if r.width * r.height > 10000:
        raise InvalidRequest("the area must be at most 10000")
    if len(r.label) > 20:
        raise InvalidRequest("label must be at most 20 characters")
    return Rectangle(width=r.width, height=r.height, label=r.label, area=r.width * r.height)
