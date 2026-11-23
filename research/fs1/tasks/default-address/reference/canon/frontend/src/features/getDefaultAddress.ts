import { createClient } from "../canon/client";
import type { Address } from "../canon/types";
import type { Outcome } from "./result";

/** A user's default shipping address, or null when none is set. */
export async function getDefaultAddress(baseUrl: string, email: string): Promise<Outcome<Address | null>> {
  return createClient(baseUrl).getDefaultAddress(email);
}
