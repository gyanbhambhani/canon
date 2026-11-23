import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Authorize payment for an open order (the amount is held, not taken). */
export async function authorizeOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/authorize", { params: { path: { id: orderId } } }));
}
