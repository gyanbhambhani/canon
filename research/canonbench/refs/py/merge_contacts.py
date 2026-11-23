from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Contact(TypedDict):
    name: str
    email: str
    phone: str


def merge_contacts(contacts: list[Contact]) -> list[Contact]:
    """Merge contacts linked by trimmed email or by phone digits, filling empty fields in order."""
    parent = list(range(len(contacts)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            # The smaller index stays the root, so a root is always a person's first contact.
            parent[max(root_a, root_b)] = min(root_a, root_b)

    first_by_email: dict[str, int] = {}
    first_by_phone: dict[str, int] = {}
    for i, contact in enumerate(contacts):
        email = contact["email"].strip()
        if email:
            union(i, first_by_email.setdefault(email, i))
        phone = _digits(contact["phone"])
        if phone:
            union(i, first_by_phone.setdefault(phone, i))

    merged: dict[int, Contact] = {}
    for i, contact in enumerate(contacts):
        root = find(i)
        person = merged.get(root)
        if person is None:
            merged[root] = {
                "name": contact["name"],
                "email": contact["email"],
                "phone": contact["phone"],
            }
            continue
        if person["name"] == "":
            person["name"] = contact["name"]
        if person["email"] == "":
            person["email"] = contact["email"]
        if person["phone"] == "":
            person["phone"] = contact["phone"]
    return list(merged.values())


def _digits(text: str) -> str:
    """Keep only the ASCII digit characters of text."""
    return "".join(ch for ch in text if "0" <= ch <= "9")
