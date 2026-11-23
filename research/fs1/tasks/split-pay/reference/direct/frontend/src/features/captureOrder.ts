import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Capture the authorized payment of an order: the order is paid. */
export async function captureOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/capture`);
}
