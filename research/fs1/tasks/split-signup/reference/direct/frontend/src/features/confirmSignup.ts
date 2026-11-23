import { call } from "../api/client";
import type { Confirmation, Profile } from "../api/types";
import type { Outcome } from "./result";

/** Confirm a pending account with the token signup returned. */
export async function confirmSignup(baseUrl: string, token: string): Promise<Outcome<Profile>> {
  const body: Confirmation = { token };
  return call<Profile>(baseUrl, "POST", "/users/confirm", { body });
}
