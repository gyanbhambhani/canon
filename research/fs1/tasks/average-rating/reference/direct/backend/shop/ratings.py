"""Star ratings: customers rate products from 1 to 5."""

import sqlite3

from fastapi import APIRouter

from .catalog import find_product
from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import NewRating, RatingSummary

router = APIRouter()


def summary(conn: sqlite3.Connection, sku: str) -> RatingSummary:
    count, average = conn.execute(
        "SELECT COUNT(*), AVG(stars) FROM ratings WHERE sku = ?", (sku,)
    ).fetchone()
    return RatingSummary(sku=sku, count=count, average=average)


@router.post("/products/{sku}/ratings")
def rate_product(sku: str, body: NewRating) -> RatingSummary:
    if not 1 <= body.stars <= 5:
        raise InvalidRequest("stars is between 1 and 5")
    with transaction() as conn:
        if find_product(conn, sku) is None:
            raise ApiError("Missing", sku=sku)
        conn.execute(
            "INSERT INTO ratings (sku, stars) VALUES (?, ?)", (sku, body.stars)
        )
        return summary(conn, sku)


@router.get("/products/{sku}/rating")
def product_rating(sku: str) -> RatingSummary:
    with transaction() as conn:
        if find_product(conn, sku) is None:
            raise ApiError("Missing", sku=sku)
        return summary(conn, sku)
