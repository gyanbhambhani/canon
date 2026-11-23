import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Cancel an order that is not paid yet. */
export async function cancelOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/cancel`);
}
