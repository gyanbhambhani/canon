"""The payment provider, payments.example.com: authorize an amount, then capture it."""

import urllib.error
import urllib.request


class PaymentFailed(Exception):
    pass


class PaymentClient:
    base = "https://payments.example.com"

    def _post(self, path: str, cents: int) -> str:
        request = urllib.request.Request(
            f"{self.base}/{path}", data=str(cents).encode(), method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return str(response.read().decode())
        except (urllib.error.URLError, ValueError) as e:
            raise PaymentFailed(str(e)) from e

    def authorize(self, cents: int) -> str:
        """Hold an amount; the provider answers with an authorization."""
        return self._post("authorize", cents)

    def capture(self, cents: int) -> str:
        """Take an authorized amount; the provider answers with a receipt."""
        return self._post("capture", cents)


class FakePayments(PaymentClient):
    """Approves everything without calling the provider (tests and demos)."""

    def authorize(self, cents: int) -> str:
        return f"test-receipt-{cents}"

    def capture(self, cents: int) -> str:
        return f"test-receipt-{cents}"


def get_payments() -> PaymentClient:
    """A FastAPI dependency; tests replace it through app.dependency_overrides."""
    return PaymentClient()
