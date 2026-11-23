import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Change a user's password; the old one must match. */
export async function changePassword(
  baseUrl: string,
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "POST", `/users/${encodeURIComponent(email)}/password`, {
    body: { old_password: oldPassword, new_password: newPassword },
  });
}
