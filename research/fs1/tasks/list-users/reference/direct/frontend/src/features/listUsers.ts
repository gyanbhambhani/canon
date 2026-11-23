import { call } from "../api/client";
import type { Profile } from "../api/types";
import type { Outcome } from "./result";

/** One page of users, sorted by email. */
export async function listUsers(baseUrl: string, page: number, perPage: number): Promise<Outcome<Profile[]>> {
  return call<Profile[]>(baseUrl, "GET", "/users", { query: { page, per_page: perPage } });
}
