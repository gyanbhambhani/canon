import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** A user's profile, by email. */
export async function getProfile(baseUrl: string, email: string): Promise<Outcome<Profile>> {
  return call<Profile>(baseUrl, "GET", `/users/${encodeURIComponent(email)}`);
}
