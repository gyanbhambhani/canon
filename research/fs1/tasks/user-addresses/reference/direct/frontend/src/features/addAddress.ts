import { call } from "../api/client";
import type { Address } from "../api/types";
import type { Outcome } from "./result";

/** Save a new address for a user. */
export async function addAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Address>> {
  return call<Address>(baseUrl, "POST", `/users/${encodeURIComponent(email)}/addresses`, {
    body: { street, city, postcode },
  });
}
