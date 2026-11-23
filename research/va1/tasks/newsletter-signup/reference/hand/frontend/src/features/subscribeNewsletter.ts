import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Subscription {
  email: string;
  name: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Subscribe to the newsletter. */
export async function subscribeNewsletter(baseUrl: string, input: Subscription): Promise<Outcome<Subscription>> {
  if (!EMAIL.test(input.email)) return invalid("email must be an email address");
  if (input.name.trim() === "" || [...input.name].length > 50) return invalid("name must be present and at most 50 characters");
  return call(baseUrl, "POST", "/newsletter", input);
}
