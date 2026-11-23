import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type OrderNote = components["schemas"]["OrderNote"];

/** Add an order note. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function addOrderNote(baseUrl: string, input: OrderNote): Promise<Outcome<OrderNote>> {
  return send(baseUrl, "POST", "/order-notes", "OrderNote", input);
}
