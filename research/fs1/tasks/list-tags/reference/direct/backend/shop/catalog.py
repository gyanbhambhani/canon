"""Products: the catalog, prices and stock."""

import json
import sqlite3

from fastapi import APIRouter

from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import Product, Restock

router = APIRouter()


def row_to_product(row: sqlite3.Row) -> Product:
    return Product(
        sku=row["sku"],
        name=row["name"],
        cents=row["cents"],
        stock=row["stock"],
        tags=json.loads(row["tags"]),
    )


def find_product(conn: sqlite3.Connection, sku: str) -> Product | None:
    row = conn.execute("SELECT * FROM products WHERE sku = ?", (sku,)).fetchone()
    return row_to_product(row) if row else None


def all_products(conn: sqlite3.Connection) -> list[Product]:
    return [
        row_to_product(r) for r in conn.execute("SELECT * FROM products ORDER BY pos")
    ]


def save_product(conn: sqlite3.Connection, product: Product) -> None:
    values = (
        product.name,
        product.cents,
        product.stock,
        json.dumps(product.tags),
        product.sku,
    )
    updated = conn.execute(
        "UPDATE products SET name = ?, cents = ?, stock = ?, tags = ? WHERE sku = ?",
        values,
    )
    if updated.rowcount == 0:
        conn.execute(
            "INSERT INTO products (name, cents, stock, tags, sku) VALUES (?, ?, ?, ?, ?)",
            values,
        )


def price_label(cents: int) -> str:
    """The price as dollars and cents, like $19.99."""
    return f"${cents // 100}.{cents % 100:02d}"


@router.post("/products")
def add_product(product: Product) -> Product:
    if len(product.sku) < 3 or product.cents < 0 or product.stock < 0:
        raise InvalidRequest(
            "the sku has at least 3 characters, and cents and stock are not negative"
        )
    with transaction() as conn:
        if find_product(conn, product.sku):
            raise ApiError("Invalid", reason=f"duplicate sku {product.sku}")
        save_product(conn, product)
    return product


@router.get("/products/{sku}")
def get_product(sku: str) -> Product:
    with transaction() as conn:
        product = find_product(conn, sku)
    if product is None:
        raise ApiError("Missing", sku=sku)
    return product


@router.get("/products")
def list_products(page: int, per_page: int, tag: str | None = None) -> list[Product]:
    if page < 1 or not 1 <= per_page <= 50:
        raise InvalidRequest("page is at least 1, and per_page is between 1 and 50")
    with transaction() as conn:
        products = sorted(all_products(conn), key=lambda p: p.sku)
    if tag is not None:
        products = [p for p in products if tag in p.tags]
    start = (page - 1) * per_page
    return products[start : start + per_page]


@router.get("/tags")
def list_tags() -> list[str]:
    with transaction() as conn:
        rows = conn.execute(
            "SELECT DISTINCT tag.value FROM products, json_each(products.tags) AS tag"
            " ORDER BY tag.value"
        ).fetchall()
    return [r[0] for r in rows]


@router.patch("/products/{sku}/stock")
def restock(sku: str, body: Restock) -> Product:
    if body.amount <= 0:
        raise InvalidRequest("the amount is positive")
    with transaction() as conn:
        product = find_product(conn, sku)
        if product is None:
            raise ApiError("Missing", sku=sku)
        # validating the new stock rejects an overflow before it is saved
        updated = Product.model_validate(
            {**product.model_dump(), "stock": product.stock + body.amount}
        )
        save_product(conn, updated)
    return updated


@router.get("/prices")
def price_table() -> dict[str, str]:
    with transaction() as conn:
        return {p.sku: price_label(p.cents) for p in all_products(conn)}


@router.delete("/products/{sku}")
def delete_product(sku: str) -> bool:
    with transaction() as conn:
        return conn.execute("DELETE FROM products WHERE sku = ?", (sku,)).rowcount > 0


@router.get("/average")
def average_cents(skus: str) -> int:
    wanted = skus.split(",")
    with transaction() as conn:
        found = [p for p in all_products(conn) if p.sku in wanted]
    return sum(p.cents for p in found) // len(found)
