import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** One order, by id. */
export async function getOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "GET", `/orders/${orderId}`);
}
