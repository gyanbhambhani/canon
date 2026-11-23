import { createClient } from "../canon/client";
import type { Pending } from "../canon/types";
import type { Outcome } from "./result";

/** Register an account; it stays pending until confirmSignup redeems the token. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<Outcome<Pending>> {
  return createClient(baseUrl).signup({ email, name, password });
}
