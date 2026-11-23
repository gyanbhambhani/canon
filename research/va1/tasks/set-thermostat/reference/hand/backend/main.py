"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

MODES = ("eco", "comfort", "away")


class Setting(BaseModel):
    temperature: int
    mode: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/thermostat")
def set_thermostat(setting: Setting) -> Setting:
    if not 10 <= setting.temperature <= 30:
        raise InvalidRequest("temperature must be from 10 to 30")
    if setting.mode not in MODES:
        raise InvalidRequest("mode must be eco, comfort or away")
    return setting
