import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** Change a user's display name. */
export async function changeDisplayName(baseUrl: string, email: string, name: string): Promise<Outcome<Profile>> {
  return createClient(baseUrl).changeName(email, { name });
}
