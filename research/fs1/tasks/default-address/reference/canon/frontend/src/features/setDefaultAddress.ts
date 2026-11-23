import { createClient } from "../canon/client";
import type { Address } from "../canon/types";
import type { Outcome } from "./result";

/** Set (or replace) a user's default shipping address. */
export async function setDefaultAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Address>> {
  return createClient(baseUrl).setDefaultAddress(email, { street, city, postcode });
}
