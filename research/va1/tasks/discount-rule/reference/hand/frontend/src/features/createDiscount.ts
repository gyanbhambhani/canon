import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface DiscountRule {
  percent: number;
  fixed_cents: number;
  name: string;
}


/** Create a discount. */
export async function createDiscount(baseUrl: string, input: DiscountRule): Promise<Outcome<DiscountRule>> {
  if (!Number.isInteger(input.percent) || input.percent < 0 || input.percent > 100) return invalid("percent must be from 0 to 100");
  if (!Number.isInteger(input.fixed_cents) || input.fixed_cents < 0 || input.fixed_cents > 100000) return invalid("fixed_cents must be from 0 to 100000");
  const length = [...input.name].length;
  if (length < 1 || length > 30) return invalid("name must have 1 to 30 characters");
  if (input.percent > 0 === input.fixed_cents > 0) return invalid("exactly one of percent and fixed_cents must be greater than 0");
  return call(baseUrl, "POST", "/discounts", input);
}
