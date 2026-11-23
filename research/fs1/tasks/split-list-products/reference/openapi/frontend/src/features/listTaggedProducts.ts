import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** One page of the products with a tag. */
export async function listTaggedProducts(
  baseUrl: string,
  tag: string,
  page: number,
  perPage: number,
): Promise<Outcome<Schemas["Product"][]>> {
  return attempt(() =>
    api(baseUrl).GET("/tags/{tag}/products", { params: { path: { tag }, query: { page, per_page: perPage } } }),
  );
}
