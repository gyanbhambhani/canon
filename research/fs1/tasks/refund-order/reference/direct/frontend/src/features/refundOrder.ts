import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Refund a paid order through the payment provider. */
export async function refundOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/refund`);
}
