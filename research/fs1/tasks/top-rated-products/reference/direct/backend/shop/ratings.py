"""Star ratings: customers rate products from 1 to 5, and the best-rated are listed."""

from fastapi import APIRouter

from .catalog import find_product
from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import NewRating, RatingSummary, TopRated

router = APIRouter()


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
        count, average = conn.execute(
            "SELECT COUNT(*), AVG(stars) FROM ratings WHERE sku = ?", (sku,)
        ).fetchone()
    return RatingSummary(sku=sku, count=count, average=average)


@router.get("/top-rated")
def top_rated(limit: int) -> list[TopRated]:
    if not 1 <= limit <= 20:
        raise InvalidRequest("limit is between 1 and 20")
    with transaction() as conn:
        rows = conn.execute(
            """
            SELECT p.sku, p.name, AVG(r.stars) AS average, COUNT(*) AS count
            FROM ratings r JOIN products p ON p.sku = r.sku
            GROUP BY p.sku
            ORDER BY average DESC, p.sku
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        TopRated(sku=r["sku"], name=r["name"], average=r["average"], count=r["count"])
        for r in rows
    ]
