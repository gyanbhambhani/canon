"""Orders: placing, paying and reporting."""

import json
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import TypeAdapter

from .catalog import find_product
from .db import transaction
from .errors import ApiError, InvalidRequest
from .payments import PaymentClient, PaymentFailed, get_payments
from .schemas import (
    ApplyCode,
    Discount,
    Line,
    NewOrder,
    Open,
    Order,
    Paid,
    Status,
    Summary,
)

router = APIRouter()

_status = TypeAdapter[Status](Status)


def row_to_order(row: sqlite3.Row) -> Order:
    return Order(
        id=row["id"],
        email=row["email"],
        lines=[Line.model_validate(x) for x in json.loads(row["lines"])],
        total=row["total"],
        status=_status.validate_json(row["status"]),
    )


def all_orders(conn: sqlite3.Connection) -> list[Order]:
    return [row_to_order(r) for r in conn.execute("SELECT * FROM orders ORDER BY id")]


def save_order(conn: sqlite3.Connection, order: Order) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO orders (id, email, lines, total, status) VALUES (?, ?, ?, ?, ?)",
        (
            order.id,
            order.email,
            json.dumps([line.model_dump() for line in order.lines]),
            order.total,
            _status.dump_json(order.status).decode(),
        ),
    )


@router.post("/orders")
def place_order(body: NewOrder) -> Order:
    if not body.lines:
        raise InvalidRequest("an order has at least one line")
    with transaction() as conn:
        total = 0
        for line in body.lines:
            product = find_product(conn, line.sku)
            if product is None:
                raise ApiError("Missing", sku=line.sku)
            total += product.cents * line.quantity
        next_id = conn.execute(
            "SELECT COALESCE(MAX(id), 0) + 1 FROM orders"
        ).fetchone()[0]
        order = Order(
            id=next_id, email=body.email, lines=body.lines, total=total, status=Open()
        )
        save_order(conn, order)
    return order


@router.post("/orders/{id}/pay")
def pay(id: int, payments: Annotated[PaymentClient, Depends(get_payments)]) -> Order:
    with transaction() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (id,)).fetchone()
        if row is None:
            raise ApiError("Missing", sku=f"order {id}")
        order = row_to_order(row)
        try:
            receipt = payments.charge(order.total)
        except PaymentFailed as e:
            raise ApiError("Missing", sku=str(e)) from e
        paid = order.model_copy(update={"status": Paid(receipt=receipt)})
        save_order(conn, paid)
    return paid


@router.get("/summaries")
def summaries() -> list[Summary]:
    with transaction() as conn:
        orders = all_orders(conn)
    by_email: dict[str, list[Order]] = {}
    for order in orders:
        by_email.setdefault(order.email, []).append(order)
    rows = [
        Summary(email=e, orders=len(os), spent=sum(o.total for o in os))
        for e, os in by_email.items()
    ]
    return sorted(rows, key=lambda s: s.spent, reverse=True)


@router.get("/orders/open")
def open_count(email: str) -> int:
    with transaction() as conn:
        return sum(
            1
            for o in all_orders(conn)
            if o.email == email and isinstance(o.status, Open)
        )


@router.get("/customers")
def customers() -> list[tuple[str, int]]:
    with transaction() as conn:
        names = [r["name"] for r in conn.execute("SELECT name FROM users ORDER BY pos")]
        count = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    return [(name, i + count) for i, name in enumerate(names)]


@router.get("/orders/first")
def first_email() -> str | None:
    with transaction() as conn:
        row = conn.execute("SELECT email FROM orders ORDER BY id LIMIT 1").fetchone()
    return row["email"] if row else None


@router.post("/discounts")
def add_discount(body: Discount) -> Discount:
    if len(body.code) < 3 or not 1 <= body.percent <= 100:
        raise InvalidRequest(
            "a code has at least 3 characters, and percent is between 1 and 100"
        )
    with transaction() as conn:
        if conn.execute(
            "SELECT 1 FROM discounts WHERE code = ?", (body.code,)
        ).fetchone():
            raise ApiError("Invalid", reason=f"duplicate code {body.code}")
        conn.execute(
            "INSERT INTO discounts (code, percent) VALUES (?, ?)",
            (body.code, body.percent),
        )
    return body


@router.post("/orders/{id}/discount")
def apply_discount(id: int, body: ApplyCode) -> Order:
    with transaction() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (id,)).fetchone()
        if row is None:
            raise ApiError("Missing", sku=f"order {id}")
        order = row_to_order(row)
        if not isinstance(order.status, Open):
            raise ApiError("Invalid", reason=f"order {id} is not open")
        found = conn.execute(
            "SELECT percent FROM discounts WHERE code = ?", (body.code,)
        ).fetchone()
        if found is None:
            raise ApiError("UnknownCode", code=body.code)
        off = order.total * found["percent"] // 100
        discounted = order.model_copy(update={"total": order.total - off})
        save_order(conn, discounted)
    return discounted
