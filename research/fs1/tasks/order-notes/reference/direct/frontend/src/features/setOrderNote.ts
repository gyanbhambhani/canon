import { call } from "../api/client";
import type { OrderNote } from "../api/types";
import type { Outcome } from "./result";

/** Write (or replace) the note on an order. */
export async function setOrderNote(baseUrl: string, orderId: number, note: string): Promise<Outcome<OrderNote>> {
  return call<OrderNote>(baseUrl, "PUT", `/orders/${orderId}/note`, { body: { note } });
}
