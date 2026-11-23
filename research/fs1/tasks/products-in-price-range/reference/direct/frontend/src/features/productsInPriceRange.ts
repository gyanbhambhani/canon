import { call } from "../api/client";
import type { Product } from "../api/types";
import type { Outcome } from "./result";

/** The products priced from minCents to maxCents (inclusive), cheapest first. */
export async function productsInPriceRange(
  baseUrl: string,
  minCents: number,
  maxCents: number,
): Promise<Outcome<Product[]>> {
  return call<Product[]>(baseUrl, "GET", "/price-range", { query: { min_cents: minCents, max_cents: maxCents } });
}
