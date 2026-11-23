"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Invoice(BaseModel):
    number: str
    subtotal: int
    tax: int
    shipping: int
    total: int


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/invoices")
def submit_invoice(invoice: Invoice) -> Invoice:
    if not 1 <= len(invoice.number) <= 20:
        raise InvalidRequest("number must have 1 to 20 characters")
    if invoice.subtotal < 0 or invoice.tax < 0 or invoice.shipping < 0 or invoice.total < 0:
        raise InvalidRequest("amounts must be at least 0")
    if invoice.subtotal + invoice.tax + invoice.shipping != invoice.total:
        raise InvalidRequest("total must equal subtotal + tax + shipping")
    return invoice
