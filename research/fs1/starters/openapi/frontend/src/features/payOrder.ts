import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Pay an open order. */
export async function payOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/pay", { params: { path: { id: orderId } } }));
}
