import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Remove a product's line from an open order. */
export async function removeLine(baseUrl: string, orderId: number, sku: string): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() => api(baseUrl).DELETE("/orders/{id}/lines/{sku}", { params: { path: { id: orderId, sku } } }));
}
