"""Accounts: sign up and log in."""

import base64
import hashlib
import hmac
import re
import secrets
import sqlite3
import uuid

from fastapi import APIRouter

from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import Address, NewAddress, Profile, Signup

router = APIRouter()

EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(12)[:16]
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt}${base64.b64encode(digest).decode()}"


def verify_password(password: str, hashed: str) -> bool:
    algorithm, iterations, salt, expected = (hashed.split("$") + ["", "", "", ""])[:4]
    if algorithm != "pbkdf2_sha256" or not iterations.isdigit():
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), int(iterations)
    )
    return hmac.compare_digest(base64.b64encode(digest).decode(), expected)


@router.post("/users")
def signup(body: Signup) -> Profile:
    name = body.name.strip()
    if not EMAIL.fullmatch(body.email) or not name or len(body.password) < 8:
        raise InvalidRequest(
            "a valid email, a name, and a password of at least 8 characters"
        )
    with transaction() as conn:
        if conn.execute(
            "SELECT 1 FROM users WHERE email = ?", (body.email,)
        ).fetchone():
            raise ApiError("Taken", email=body.email)
        conn.execute(
            "INSERT INTO users (email, name, password_hash, id) VALUES (?, ?, ?, ?)",
            (body.email, name, hash_password(body.password), str(uuid.uuid4())),
        )
    return Profile(email=body.email, name=name)


@router.post("/login")
def login(body: Signup) -> Profile:
    with transaction() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (body.email,)
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise ApiError("BadLogin")
    return Profile(email=row["email"], name=row["name"])


def require_user(conn: sqlite3.Connection, email: str) -> None:
    if not conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise ApiError("NoSuchUser", email=email)


@router.post("/users/{email}/addresses")
def add_address(email: str, body: NewAddress) -> Address:
    street, city = body.street.strip(), body.city.strip()
    if not street or not city or len(body.postcode) < 3:
        raise InvalidRequest(
            "a street, a city, and a postcode of at least 3 characters"
        )
    with transaction() as conn:
        require_user(conn, email)
        cursor = conn.execute(
            "INSERT INTO addresses (email, street, city, postcode) VALUES (?, ?, ?, ?)",
            (email, street, city, body.postcode),
        )
        assert cursor.lastrowid is not None
        return Address(
            id=cursor.lastrowid,
            email=email,
            street=street,
            city=city,
            postcode=body.postcode,
        )


@router.get("/users/{email}/addresses")
def list_addresses(email: str) -> list[Address]:
    with transaction() as conn:
        require_user(conn, email)
        rows = conn.execute(
            "SELECT * FROM addresses WHERE email = ? ORDER BY id", (email,)
        ).fetchall()
    return [
        Address(
            id=r["id"],
            email=r["email"],
            street=r["street"],
            city=r["city"],
            postcode=r["postcode"],
        )
        for r in rows
    ]
