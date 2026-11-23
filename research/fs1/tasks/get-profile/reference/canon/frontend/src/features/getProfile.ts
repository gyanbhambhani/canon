import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** A user's profile, by email. */
export async function getProfile(baseUrl: string, email: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).getProfile(email);
}
