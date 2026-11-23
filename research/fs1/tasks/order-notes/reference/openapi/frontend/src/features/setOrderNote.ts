import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Write (or replace) the note on an order. */
export async function setOrderNote(
  baseUrl: string,
  orderId: number,
  note: string,
): Promise<Outcome<Schemas["OrderNote"]>> {
  return attempt(() => api(baseUrl).PUT("/orders/{id}/note", { params: { path: { id: orderId } }, body: { note } }));
}
