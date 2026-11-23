import { createClient } from "../canon/client";
import type { OrderNote } from "../canon/types";
import type { Outcome } from "./result";

/** Add an order note. */
export async function addOrderNote(baseUrl: string, input: OrderNote): Promise<Outcome<OrderNote>> {
  return createClient(baseUrl).addOrderNote(input);
}
