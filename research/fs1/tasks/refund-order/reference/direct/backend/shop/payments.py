"""The payment provider, payments.example.com."""

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

    def charge(self, cents: int) -> str:
        """Charge an amount; the provider answers with a receipt."""
        return self._post("charge", cents)

    def refund(self, cents: int) -> str:
        """Refund an amount; the provider answers with a refund id."""
        return self._post("refund", cents)


class FakePayments(PaymentClient):
    """Approves every charge and refund without calling the provider (tests and demos)."""

    def charge(self, cents: int) -> str:
        return f"test-receipt-{cents}"

    def refund(self, cents: int) -> str:
        return f"test-receipt-{cents}"


def get_payments() -> PaymentClient:
    """A FastAPI dependency; tests replace it through app.dependency_overrides."""
    return PaymentClient()
