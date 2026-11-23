import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Ship a paid order with its tracking number. */
export async function shipOrder(
  baseUrl: string,
  orderId: number,
  tracking: string,
): Promise<Outcome<Schemas["Order"]>> {
  return attempt(() =>
    api(baseUrl).POST("/orders/{id}/ship", { params: { path: { id: orderId } }, body: { tracking } }),
  );
}
