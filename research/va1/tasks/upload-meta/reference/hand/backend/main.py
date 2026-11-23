"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

KINDS = ("png", "jpg", "pdf")


class UploadMeta(BaseModel):
    filename: str
    size_kb: int
    kind: str



@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/uploads")
def register_upload(r: UploadMeta) -> UploadMeta:
    if not 1 <= len(r.filename) <= 100:
        raise InvalidRequest("filename must have 1 to 100 characters")
    if not 1 <= r.size_kb <= 10240:
        raise InvalidRequest("size_kb must be from 1 to 10240")
    if r.kind not in KINDS:
        raise InvalidRequest("kind must be png, jpg or pdf")
    return r
