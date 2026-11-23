"""The FastAPI app. canon build writes this file once and never changes it again: it is yours."""

import os

from fastapi import FastAPI

from canon_generated import store
from canon_generated.api import router
from canon_generated.net import Http, http
from canon_generated.runtime import Error, Ok, Result, install

# The database file: $SHOP_DATABASE, default shop.db.
os.environ.setdefault("CANON_DATABASE", os.environ.get("SHOP_DATABASE", "shop.db"))

app = FastAPI()
install(app)
app.include_router(router)


def reset_database() -> None:
    """Forget the open database; the next request opens $SHOP_DATABASE again (tests)."""
    os.environ["CANON_DATABASE"] = os.environ.get("SHOP_DATABASE", "shop.db")
    store.reset()


class FakePayments(Http):
    """Approves every charge without calling the payment provider (tests and demos)."""

    def post(self, url: str, body: str) -> Result[str, Error]:
        return Ok(f"test-receipt-{body}")


if os.environ.get("SHOP_FAKE_PAYMENTS") == "1":
    payments = "payments.example.com"
    app.dependency_overrides[http(payments)] = lambda: FakePayments(payments)
