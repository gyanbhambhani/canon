import { createClient } from "../canon/client";
import type { Address } from "../canon/types";
import type { Outcome } from "./result";

/** A user's addresses, oldest first. */
export async function listAddresses(baseUrl: string, email: string): Promise<Outcome<Address[]>> {
  return createClient(baseUrl).listAddresses(email);
}
