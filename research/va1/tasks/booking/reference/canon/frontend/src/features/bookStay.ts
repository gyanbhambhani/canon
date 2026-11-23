import { createClient } from "../canon/client";
import type { Stay, StayRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Book a stay. */
export async function bookStay(baseUrl: string, input: StayRequest): Promise<Outcome<Stay>> {
  return createClient(baseUrl).bookStay(input);
}
