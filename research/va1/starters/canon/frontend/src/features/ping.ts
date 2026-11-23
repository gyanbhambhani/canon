import { createClient } from "../canon/client";
import type { Outcome } from "./result";

/** Check that the service is up. */
export async function ping(baseUrl: string): Promise<Outcome<{ ok: boolean }>> {
  return createClient(baseUrl).ping();
}
