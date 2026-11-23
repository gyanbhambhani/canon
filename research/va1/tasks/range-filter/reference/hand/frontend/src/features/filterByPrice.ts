import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface PriceFilter {
  min_price: number;
  max_price: number;
  category: string;
}

const CATEGORIES = ["food", "drink", "tool"];

/** Filter products by price range. */
export async function filterByPrice(baseUrl: string, input: PriceFilter): Promise<Outcome<PriceFilter>> {
  if (!Number.isInteger(input.min_price) || input.min_price < 0) return invalid("min_price must be at least 0");
  if (!Number.isInteger(input.max_price) || input.max_price < 0) return invalid("max_price must be at least 0");
  if (input.min_price > input.max_price) return invalid("min_price must be at most max_price");
  if (!CATEGORIES.includes(input.category)) return invalid("category must be food, drink or tool");
  return call(baseUrl, "POST", "/filters/price", input);
}
