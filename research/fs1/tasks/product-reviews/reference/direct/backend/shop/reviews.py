"""Reviews: a rating from 1 to 5 and some text, per product."""

import sqlite3

from fastapi import APIRouter

from .catalog import find_product
from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import NewReview, Review

router = APIRouter()

MAX_TEXT = 500


def row_to_review(row: sqlite3.Row) -> Review:
    return Review(id=row["id"], sku=row["sku"], rating=row["rating"], text=row["text"])


def require_product(conn: sqlite3.Connection, sku: str) -> None:
    if find_product(conn, sku) is None:
        raise ApiError("Missing", sku=sku)


@router.post("/products/{sku}/reviews")
def add_review(sku: str, body: NewReview) -> Review:
    if not 1 <= body.rating <= 5 or not body.text.strip() or len(body.text) > MAX_TEXT:
        raise InvalidRequest(
            "the rating is between 1 and 5, and the text is not blank and at most 500 characters"
        )
    with transaction() as conn:
        require_product(conn, sku)
        cursor = conn.execute(
            "INSERT INTO reviews (sku, rating, text) VALUES (?, ?, ?)",
            (sku, body.rating, body.text),
        )
        assert cursor.lastrowid is not None
        return Review(id=cursor.lastrowid, sku=sku, rating=body.rating, text=body.text)


@router.get("/products/{sku}/reviews")
def list_reviews(sku: str) -> list[Review]:
    with transaction() as conn:
        require_product(conn, sku)
        rows = conn.execute("SELECT * FROM reviews WHERE sku = ? ORDER BY id", (sku,))
        return [row_to_review(r) for r in rows]
