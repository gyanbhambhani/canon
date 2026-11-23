import { call } from "../api/client";
import type { Address } from "../api/types";
import type { Outcome } from "./result";

/** Set (or replace) a user's default shipping address. */
export async function setDefaultAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Address>> {
  const body: Address = { street, city, postcode };
  return call<Address>(baseUrl, "PUT", `/users/${encodeURIComponent(email)}/default-address`, { body });
}
