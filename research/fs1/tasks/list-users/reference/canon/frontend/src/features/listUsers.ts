import { createClient } from "../canon/client";
import type { Profile } from "../canon/types";
import type { Outcome } from "./result";

/** One page of users, sorted by email. */
export async function listUsers(baseUrl: string, page: number, perPage: number): Promise<Outcome<Profile[]>> {
  return createClient(baseUrl).listUsers(page, perPage);
}
