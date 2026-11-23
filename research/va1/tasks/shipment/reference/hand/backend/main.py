"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Shipment(BaseModel):
    weight_g: int
    length: int
    width: int
    height: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/shipments")
def create_shipment(r: Shipment) -> Shipment:
    if not 1 <= r.weight_g <= 30000:
        raise InvalidRequest("weight_g must be from 1 to 30000")
    if not 1 <= r.length <= 200:
        raise InvalidRequest("length must be from 1 to 200")
    if not 1 <= r.width <= 100 or not 1 <= r.height <= 100:
        raise InvalidRequest("width and height must be from 1 to 100")
    if r.length + 2 * (r.width + r.height) > 300:
        raise InvalidRequest("length + 2 * (width + height) must be at most 300")
    return r
