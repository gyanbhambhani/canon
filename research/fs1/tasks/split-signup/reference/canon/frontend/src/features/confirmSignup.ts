import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Confirm a pending account with the token signup returned. */
export async function confirmSignup(baseUrl: string, token: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).confirm({ token });
}
