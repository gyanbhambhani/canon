import { call } from "../api/client";
import type { Discount } from "../api/types";
import type { Outcome } from "./result";

/** Create a discount code worth a percentage off an order. */
export async function addDiscount(baseUrl: string, code: string, percent: number): Promise<Outcome<Discount>> {
  return call<Discount>(baseUrl, "POST", "/discounts", { body: { code, percent } });
}
