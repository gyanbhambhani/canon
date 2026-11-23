import { call } from "../api/client";
import type { Address } from "../api/types";
import type { Outcome } from "./result";

/** A user's default shipping address, or null when none is set. */
export async function getDefaultAddress(baseUrl: string, email: string): Promise<Outcome<Address | null>> {
  return call<Address | null>(baseUrl, "GET", `/users/${encodeURIComponent(email)}/default-address`);
}
