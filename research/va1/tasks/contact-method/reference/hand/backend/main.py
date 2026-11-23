"""The forms service: small stateless JSON endpoints."""

import re

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

EMAIL = re.compile(r"[^@ \t\r\n\x0b\x0c]+@[^@ \t\r\n\x0b\x0c]+\.[^@ \t\r\n\x0b\x0c]+")


class Contact(BaseModel):
    name: str
    email: str
    phone: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/contacts")
def add_contact(c: Contact) -> Contact:
    if not 1 <= len(c.name) <= 40:
        raise InvalidRequest("name must have 1 to 40 characters")
    if c.email and EMAIL.fullmatch(c.email) is None:
        raise InvalidRequest("email must be empty or a valid address")
    if c.phone and not 7 <= len(c.phone) <= 15:
        raise InvalidRequest("phone must be empty or have 7 to 15 characters")
    if not c.email and not c.phone:
        raise InvalidRequest("give an email or a phone")
    return c
