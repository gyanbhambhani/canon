"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI

from errors import install_error_handlers
from models import Review

app = FastAPI(title="forms")
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/reviews")
def post_review(review: Review) -> Review:
    return review
