import { createClient } from "../canon/client";
import type { DiscountRule } from "../canon/types";
import type { Outcome } from "./result";

/** Create a discount. */
export async function createDiscount(baseUrl: string, input: DiscountRule): Promise<Outcome<DiscountRule>> {
  return createClient(baseUrl).createDiscount(input);
}
