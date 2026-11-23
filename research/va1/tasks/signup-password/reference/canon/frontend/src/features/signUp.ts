import { createClient } from "../canon/client";
import type { Account, SignupRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Sign up with a password. */
export async function signUp(baseUrl: string, input: SignupRequest): Promise<Outcome<Account>> {
  return createClient(baseUrl).signUp(input);
}
