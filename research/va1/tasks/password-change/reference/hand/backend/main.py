"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str
    confirm: str


class PasswordChanged(BaseModel):
    changed: bool


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/password")
def change_password(r: PasswordChange) -> PasswordChanged:
    if len(r.old_password) < 1:
        raise InvalidRequest("old_password is required")
    if len(r.new_password) < 8:
        raise InvalidRequest("new_password must have at least 8 characters")
    if r.confirm != r.new_password:
        raise InvalidRequest("confirm must equal new_password")
    if r.new_password == r.old_password:
        raise InvalidRequest("new_password must differ from old_password")
    return PasswordChanged(changed=True)
