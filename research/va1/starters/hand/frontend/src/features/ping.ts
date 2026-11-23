import { call } from "../api/client";
import type { Outcome } from "./result";

/** Check that the service is up. */
export async function ping(baseUrl: string): Promise<Outcome<{ ok: boolean }>> {
  return call(baseUrl, "GET", "/ping");
}
