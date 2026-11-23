import { createClient } from "../canon/client";
import type { Subscription } from "../canon/types";
import type { Outcome } from "./result";

/** Subscribe to the newsletter. */
export async function subscribeNewsletter(baseUrl: string, input: Subscription): Promise<Outcome<Subscription>> {
  return createClient(baseUrl).subscribeNewsletter(input);
}
