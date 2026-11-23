import { call } from "../api/client";
import type { Order, Shipment } from "../api/types";
import type { Outcome } from "./result";

/** Ship a paid order with its tracking number. */
export async function shipOrder(baseUrl: string, orderId: number, tracking: string): Promise<Outcome<Order>> {
  const body: Shipment = { tracking };
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/ship`, { body });
}
