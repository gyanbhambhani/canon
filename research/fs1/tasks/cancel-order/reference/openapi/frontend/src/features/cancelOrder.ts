import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Cancel an order that is not paid yet. */
export async function cancelOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/cancel", { params: { path: { id: orderId } } }));
}
