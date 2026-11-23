"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import StockRemoval, StockResult

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/inventory/remove")
def remove_stock(r: StockRemoval) -> StockResult:
    return StockResult(on_hand=r.on_hand, remove=r.remove, reason=r.reason, left=r.on_hand - r.remove)
