import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** The users whose name contains the search text. */
export async function searchUsers(baseUrl: string, q: string): Promise<Outcome<Profile[]>> {
  return createClient(baseUrl).searchUsers(q);
}
