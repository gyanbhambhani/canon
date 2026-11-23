"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)

CURRENCIES = ("USD", "EUR", "GBP")


class GiftCard(BaseModel):
    code: str
    amount: int
    currency: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/gift-cards")
def register_gift_card(card: GiftCard) -> GiftCard:
    if not 8 <= len(card.code) <= 12:
        raise InvalidRequest("code must have 8 to 12 characters")
    if not 5 <= card.amount <= 500:
        raise InvalidRequest("amount must be from 5 to 500")
    if card.currency not in CURRENCIES:
        raise InvalidRequest("currency must be USD, EUR or GBP")
    return card
