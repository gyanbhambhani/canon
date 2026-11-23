import { call } from "../api/client";
import type { OrderNote } from "../api/types";
import type { Outcome } from "./result";

/** The note on an order ("" when there is none). */
export async function getOrderNote(baseUrl: string, orderId: number): Promise<Outcome<OrderNote>> {
  return call<OrderNote>(baseUrl, "GET", `/orders/${orderId}/note`);
}
