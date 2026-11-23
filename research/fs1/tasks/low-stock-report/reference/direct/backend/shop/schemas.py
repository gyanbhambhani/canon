"""The request and response bodies (the wire contract with the frontend)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

# Integers must survive JSON and JavaScript numbers: 53 bits.
MAX_INT = 2**53 - 1
SafeInt = Annotated[int, Field(ge=-MAX_INT, le=MAX_INT)]


class Product(BaseModel):
    sku: str
    name: str
    cents: SafeInt
    stock: SafeInt
    tags: list[str]


class LowStock(BaseModel):
    sku: str
    name: str
    stock: SafeInt


class Restock(BaseModel):
    amount: SafeInt


class Signup(BaseModel):
    email: str
    name: str
    password: str


class Profile(BaseModel):
    email: str
    name: str


class Line(BaseModel):
    sku: str
    quantity: SafeInt


class Open(BaseModel):
    kind: Literal["Open"] = "Open"


class Paid(BaseModel):
    kind: Literal["Paid"] = "Paid"
    receipt: str


class Cancelled(BaseModel):
    kind: Literal["Cancelled"] = "Cancelled"


Status = Annotated[Open | Paid | Cancelled, Field(discriminator="kind")]


class Order(BaseModel):
    id: SafeInt
    email: str
    lines: list[Line]
    total: SafeInt
    status: Status


class NewOrder(BaseModel):
    email: str
    lines: list[Line]


class Summary(BaseModel):
    email: str
    orders: SafeInt
    spent: SafeInt
