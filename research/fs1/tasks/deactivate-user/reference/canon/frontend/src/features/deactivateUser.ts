import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Deactivate an account: it can no longer log in or place orders. */
export async function deactivateUser(baseUrl: string, email: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).deactivate(email);
}
