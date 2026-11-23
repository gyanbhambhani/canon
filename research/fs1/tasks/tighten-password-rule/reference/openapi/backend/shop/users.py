"""Accounts: sign up and log in."""

import base64
import hashlib
import hmac
import re
import secrets
import uuid

from fastapi import APIRouter

from .db import transaction
from .errors import ApiError, InvalidRequest
from .schemas import Profile, Signup

router = APIRouter()

EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
DIGIT = re.compile(r"[0-9]")
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
    if not EMAIL.fullmatch(body.email) or not name or len(body.password) < 12:
        raise InvalidRequest(
            "a valid email, a name, and a password of at least 12 characters"
        )
    if not DIGIT.search(body.password):
        raise ApiError("WeakPassword")
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
