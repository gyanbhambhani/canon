import { createClient } from "../canon/client";
import type { Order } from "../canon/types";
import type { Outcome } from "./result";

/** Apply a discount code to an open order. */
export async function applyDiscount(baseUrl: string, orderId: number, code: string): Promise<Outcome<Order>> {
  return createClient(baseUrl).applyDiscount(orderId, { code });
}
