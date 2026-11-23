import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface CouponRequest {
  code: string;
  subtotal: number;
  discount: number;
}

export interface Coupon extends CouponRequest {
  payable: number;
}

/** Apply a coupon. */
export async function applyCoupon(baseUrl: string, input: CouponRequest): Promise<Outcome<Coupon>> {
  const length = [...input.code].length;
  if (length < 3 || length > 20) return invalid("code must have 3 to 20 characters");
  if (!Number.isInteger(input.subtotal) || input.subtotal < 1) return invalid("subtotal must be at least 1");
  if (!Number.isInteger(input.discount) || input.discount < 0) return invalid("discount must be at least 0");
  if (input.discount > input.subtotal) return invalid("discount must be at most subtotal");
  return call(baseUrl, "POST", "/coupons/apply", input);
}
