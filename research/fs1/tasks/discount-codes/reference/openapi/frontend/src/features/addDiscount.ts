import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Create a discount code worth a percentage off an order. */
export async function addDiscount(baseUrl: string, code: string, percent: number): Promise<Outcome<Schemas["Discount"]>> {
  return attempt(() => api(baseUrl).POST("/discounts", { body: { code, percent } }));
}
