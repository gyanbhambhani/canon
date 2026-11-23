import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Add a product to the catalog. */
export async function addProduct(baseUrl: string, product: Schemas["Product"]): Promise<Outcome<Schemas["Product"]>> {
  return attempt(() => api(baseUrl).POST("/products", { body: product }));
}
