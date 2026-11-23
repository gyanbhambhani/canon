"""The forms service: small stateless JSON endpoints."""

from fastapi import FastAPI
from pydantic import BaseModel

from errors import InvalidRequest, install_error_handlers

app = FastAPI(title="forms")
install_error_handlers(app)


class Review(BaseModel):
    rating: int
    title: str


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/reviews")
def post_review(review: Review) -> Review:
    if not 1 <= review.rating <= 5:
        raise InvalidRequest("rating must be from 1 to 5")
    if not 3 <= len(review.title) <= 80:
        raise InvalidRequest("title must have 3 to 80 characters")
    return review
