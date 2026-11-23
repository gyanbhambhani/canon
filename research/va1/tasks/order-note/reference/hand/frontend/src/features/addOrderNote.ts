import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface OrderNote {
  note: string;
  priority: number;
}

/** Add an order note. */
export async function addOrderNote(baseUrl: string, input: OrderNote): Promise<Outcome<OrderNote>> {
  if ([...input.note].length > 200) return invalid("note must be at most 200 characters");
  if (input.priority < 0 || input.priority > 9) return invalid("priority must be from 0 to 9");
  return call(baseUrl, "POST", "/order-notes", input);
}
