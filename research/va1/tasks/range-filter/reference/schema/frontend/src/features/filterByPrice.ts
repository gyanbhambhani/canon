import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type PriceFilter = components["schemas"]["PriceFilter"];

/** Filter products by price range. The schema carries the single-field rules; the rule over the two prices is written here too. */
export async function filterByPrice(baseUrl: string, input: PriceFilter): Promise<Outcome<PriceFilter>> {
  return send(baseUrl, "POST", "/filters/price", "PriceFilter", input, (i: PriceFilter) => {
    if (i.min_price > i.max_price) return "min_price must be at most max_price";
    return null;
  });
}
