import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Authorize payment for an open order (the amount is held, not taken). */
export async function authorizeOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/authorize`);
}
