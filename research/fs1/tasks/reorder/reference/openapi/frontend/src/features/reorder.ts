import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Place a new order with the same lines as a previous one. */
export async function reorder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/reorder", { params: { path: { id: orderId } } }));
}
