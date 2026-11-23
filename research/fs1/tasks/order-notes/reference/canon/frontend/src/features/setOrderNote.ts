import { createClient } from "../canon/client";
import type { OrderNote } from "../canon/types";
import type { Outcome } from "./result";

/** Write (or replace) the note on an order. */
export async function setOrderNote(baseUrl: string, orderId: number, note: string): Promise<Outcome<OrderNote>> {
  return createClient(baseUrl).setNote(orderId, { note });
}
