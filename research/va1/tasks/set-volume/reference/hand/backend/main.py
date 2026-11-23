"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

class VolumeSetting(BaseModel):
    level: int



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/volume")
def set_volume(r: VolumeSetting) -> VolumeSetting:
    if not 0 <= r.level <= 100:
        raise InvalidRequest("level must be from 0 to 100")
    return r
