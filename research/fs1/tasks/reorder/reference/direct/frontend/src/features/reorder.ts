import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Place a new order with the same lines as a previous one. */
export async function reorder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/reorder`);
}
