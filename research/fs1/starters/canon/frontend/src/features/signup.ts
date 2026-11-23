import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Create an account. */
export async function signup(
  baseUrl: string,
  email: string,
  name: string,
  password: string,
): Promise<Outcome<Profile>> {
  return createClient(baseUrl).signup({ email, name, password });
}
