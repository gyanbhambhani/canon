import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type CouponRequest = components["schemas"]["CouponRequest"];
type Coupon = components["schemas"]["Coupon"];

/** Apply a coupon. The schema carries the single-field rules; the rule over `discount` and `subtotal` is written here too. */
export async function applyCoupon(baseUrl: string, input: CouponRequest): Promise<Outcome<Coupon>> {
  return send(baseUrl, "POST", "/coupons/apply", "CouponRequest", input, (i: CouponRequest) => {
    if (i.discount > i.subtotal) return "discount must be at most subtotal";
    return null;
  });
}
