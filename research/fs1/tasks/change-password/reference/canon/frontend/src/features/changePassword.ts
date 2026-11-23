import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Change a user's password; the old one must match. */
export async function changePassword(
  baseUrl: string,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<Outcome<Profile>> {
  return createClient(baseUrl).changePassword(email, { old_password: oldPassword, new_password: newPassword });
}
