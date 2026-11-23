import { createClient } from "../canon/client";
import type { OrderNote } from "../canon/types";
import type { Outcome } from "./result";

/** The note on an order ("" when there is none). */
export async function getOrderNote(baseUrl: string, orderId: number): Promise<Outcome<OrderNote>> {
  return createClient(baseUrl).getNote(orderId);
}
