import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Add a product to an open order (or more of a product it already has). */
export async function addLine(
  baseUrl: string,
  orderId: number,
  sku: string,
  quantity: number,
): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() =>
    api(baseUrl).POST("/orders/{id}/lines", { params: { path: { id: orderId } }, body: { sku, quantity } }),
  );
}
