from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

class Sale(TypedDict):
    region: str
    product: str
    units: int
    price_cents: int


def top_product_per_region(sales: list[Sale]) -> list[tuple[str, str, int]]:
    """Best-selling products by revenue in each region (all ties), regions in name order."""
    revenue: dict[str, dict[str, int]] = {}
    for sale in sales:
        products = revenue.setdefault(sale["region"], {})
        products[sale["product"]] = (
            products.get(sale["product"], 0) + sale["units"] * sale["price_cents"]
        )

    result: list[tuple[str, str, int]] = []
    for region in sorted(revenue):
        products = revenue[region]
        top = max(products.values())
        for product in sorted(p for p, total in products.items() if total == top):
            result.append((region, product, top))
    return result
