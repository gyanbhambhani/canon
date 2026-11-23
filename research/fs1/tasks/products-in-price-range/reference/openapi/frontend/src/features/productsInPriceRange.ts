import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Browse the catalog within a price range, cheapest first. */
export async function productsInPriceRange(
  baseUrl: string,
  minCents: number,
  maxCents: number,
): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() =>
    api(baseUrl).GET("/price-range", { params: { query: { min_cents: minCents, max_cents: maxCents } } }),
  );
}
