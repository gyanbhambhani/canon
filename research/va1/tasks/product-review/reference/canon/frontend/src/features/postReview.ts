import { createClient } from "../canon/client";
import type { Review } from "../canon/types";
import type { Outcome } from "./result";

/** Post a product review. */
export async function postReview(baseUrl: string, input: Review): Promise<Outcome<Review>> {
  return createClient(baseUrl).postReview(input);
}
