"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class PageSettings(BaseModel):
    size: int
    sort: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/settings/paging")
def set_page_size(r: PageSettings) -> PageSettings:
    if not 10 <= r.size <= 100:
        raise InvalidRequest("size must be from 10 to 100")
    if r.sort not in ("asc", "desc"):
        raise InvalidRequest("sort must be asc or desc")
    return r
