import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Delete an account; the password confirms it. */
export async function deleteAccount(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).deleteAccount(email, { password });
}
