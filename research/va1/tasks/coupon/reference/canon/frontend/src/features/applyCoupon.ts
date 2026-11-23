import { createClient } from "../canon/client";
import type { Coupon, CouponRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Apply a coupon. */
export async function applyCoupon(baseUrl: string, input: CouponRequest): Promise<Outcome<Coupon>> {
  return createClient(baseUrl).applyCoupon(input);
}
