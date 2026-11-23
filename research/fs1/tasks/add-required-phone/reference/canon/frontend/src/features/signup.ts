import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Create an account with a phone number. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
  phone: string,
): Promise<Outcome<Profile>> {
  return createClient(baseUrl).signup({ email, name, password, phone });
}
