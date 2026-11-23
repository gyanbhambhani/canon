"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Allocation(BaseModel):
    ads: int
    dev: int
    ops: int
    project: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/allocations")
def set_allocation(a: Allocation) -> Allocation:
    for name, share in (("ads", a.ads), ("dev", a.dev), ("ops", a.ops)):
        if not 0 <= share <= 100:
            raise InvalidRequest(f"{name} must be from 0 to 100")
    if a.ads + a.dev + a.ops != 100:
        raise InvalidRequest("ads + dev + ops must be 100")
    if not 1 <= len(a.project) <= 30:
        raise InvalidRequest("project must have 1 to 30 characters")
    return a
