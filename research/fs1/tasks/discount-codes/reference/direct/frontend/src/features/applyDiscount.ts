import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Apply a discount code to an open order. */
export async function applyDiscount(baseUrl: string, orderId: number, code: string): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/discount`, { body: { code } });
}
