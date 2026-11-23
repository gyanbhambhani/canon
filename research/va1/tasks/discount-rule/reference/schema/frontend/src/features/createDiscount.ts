import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type DiscountRule = components["schemas"]["DiscountRule"];

/** Create a discount. The schema carries the ranges and the name length; the exactly-one rule is written here too. */
export async function createDiscount(baseUrl: string, input: DiscountRule): Promise<Outcome<DiscountRule>> {
  return send(baseUrl, "POST", "/discounts", "DiscountRule", input, (i: DiscountRule) => ((i.percent > 0) === (i.fixed_cents > 0) ? "exactly one of percent and fixed_cents must be greater than 0" : null));
}
