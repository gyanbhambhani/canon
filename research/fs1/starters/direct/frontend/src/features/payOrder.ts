import { call } from "../api/client";
import type { Order } from "../api/types";
import type { Outcome } from "./result";

/** Pay an open order. */
export async function payOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>> {
  return call<Order>(baseUrl, "POST", `/orders/${orderId}/pay`);
}
