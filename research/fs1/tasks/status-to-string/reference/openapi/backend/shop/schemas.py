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


Status = Literal["open", "paid", "cancelled"]


class Order(BaseModel):
    id: SafeInt
    email: str
    lines: list[Line]
    total: SafeInt
    status: Status
    receipt: str | None


class NewOrder(BaseModel):
    email: str
    lines: list[Line]


class Summary(BaseModel):
    email: str
    orders: SafeInt
    spent: SafeInt
