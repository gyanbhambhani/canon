import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** Deactivate an account: it can no longer log in or place orders. */
export async function deactivateUser(baseUrl: string, email: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "POST", `/users/${encodeURIComponent(email)}/deactivate`);
}
