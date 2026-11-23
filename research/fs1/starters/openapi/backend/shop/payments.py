"""The payment provider, payments.example.com."""

import urllib.error
import urllib.request


class PaymentFailed(Exception):
    pass


class PaymentClient:
    url = "https://payments.example.com/charge"

    def charge(self, cents: int) -> str:
        """Charge an amount; the provider answers with a receipt."""
        request = urllib.request.Request(
            self.url, data=str(cents).encode(), method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return str(response.read().decode())
        except (urllib.error.URLError, ValueError) as e:
            raise PaymentFailed(str(e)) from e


class FakePayments(PaymentClient):
    """Approves every charge without calling the provider (tests and demos)."""

    def charge(self, cents: int) -> str:
        return f"test-receipt-{cents}"


def get_payments() -> PaymentClient:
    """A FastAPI dependency; tests replace it through app.dependency_overrides."""
    return PaymentClient()
