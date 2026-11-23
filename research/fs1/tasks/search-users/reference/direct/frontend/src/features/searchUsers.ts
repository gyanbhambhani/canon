import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** The users whose name contains the search text. */
export async function searchUsers(baseUrl: string, q: string): Promise<Outcome<Profile[]>> {
  return call<Profile[]>(baseUrl, "GET", "/users/search", { query: { q } });
}
