import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Delete an account; the password confirms it. */
export async function deleteAccount(baseUrl: string, email: string, password: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "POST", `/users/${encodeURIComponent(email)}/delete`, { body: { password } });
}
