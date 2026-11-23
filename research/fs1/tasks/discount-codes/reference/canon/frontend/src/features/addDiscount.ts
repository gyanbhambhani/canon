import { createClient } from "../canon/client";
import type { Discount } from "../canon/types";
import type { Outcome } from "./result";

/** Create a discount code worth a percentage off an order. */
export async function addDiscount(baseUrl: string, code: string, percent: number): Promise<Outcome<Discount>> {
  return createClient(baseUrl).addDiscount({ code, percent });
}
