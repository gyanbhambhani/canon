import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** The note on an order ("" when there is none). */
export async function getOrderNote(baseUrl: string, orderId: number): Promise<Outcome<Schemas["OrderNote"]>> {
  return attempt(() => api(baseUrl).GET("/orders/{id}/note", { params: { path: { id: orderId } } }));
}
