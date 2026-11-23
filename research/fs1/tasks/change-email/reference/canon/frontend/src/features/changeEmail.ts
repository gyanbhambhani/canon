import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Move a user's account to a new email. */
export async function changeEmail(baseUrl: string, email: string, newEmail: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).changeEmail(email, { new_email: newEmail });
}
