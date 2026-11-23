import { call } from "../api/client";
import type { Address } from "../api/types";
import type { Outcome } from "./result";

/** A user's addresses, oldest first. */
export async function listAddresses(baseUrl: string, email: string): Promise<Outcome<Address[]>> {
  return call<Address[]>(baseUrl, "GET", `/users/${encodeURIComponent(email)}/addresses`);
}
