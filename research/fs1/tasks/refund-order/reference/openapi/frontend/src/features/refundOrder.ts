import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Refund a paid order through the payment provider. */
export async function refundOrder(baseUrl: string, orderId: number): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).POST("/orders/{id}/refund", { params: { path: { id: orderId } } }));
}
