import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Move a user's account to a new email. */
export async function changeEmail(baseUrl: string, email: string, newEmail: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "PATCH", `/users/${encodeURIComponent(email)}/email`, {
    body: { new_email: newEmail },
  });
}
