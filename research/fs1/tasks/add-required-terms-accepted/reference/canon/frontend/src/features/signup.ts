import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Create an account; the customer must accept the terms. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  termsAccepted: boolean,
): Promise<Outcome<Profile>> {
  return createClient(baseUrl).signup({ email, name, password, terms_accepted: termsAccepted });
}
