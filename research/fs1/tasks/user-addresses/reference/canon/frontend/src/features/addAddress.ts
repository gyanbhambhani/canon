import { createClient } from "../canon/client";
import type { Address } from "../canon/types";
import type { Outcome } from "./result";

/** Save a new address for a user. */
export async function addAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Address>> {
  return createClient(baseUrl).addAddress(email, { street, city, postcode });
}
