"""The shop's FastAPI app."""

import os

from fastapi import FastAPI

from shop import catalog, db, orders, reviews, users
from shop.errors import install_error_handlers
from shop.payments import FakePayments, get_payments

app = FastAPI(title="shop")
install_error_handlers(app)
app.include_router(catalog.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(reviews.router)


def reset_database() -> None:
    """Forget the open database; the next request opens $SHOP_DATABASE again (tests)."""
    db.reset()


if os.environ.get("SHOP_FAKE_PAYMENTS") == "1":
    app.dependency_overrides[get_payments] = FakePayments
