import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Review {
  rating: number;
  title: string;
}

/** Post a product review. */
export async function postReview(baseUrl: string, input: Review): Promise<Outcome<Review>> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return invalid("rating must be from 1 to 5");
  const length = [...input.title].length;
  if (length < 3 || length > 80) return invalid("title must have 3 to 80 characters");
  return call(baseUrl, "POST", "/reviews", input);
}
