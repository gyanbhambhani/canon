import { createClient } from "../canon/client";
import type { Tip } from "../canon/types";
import type { Outcome } from "./result";

/** Add a tip. */
export async function addTip(baseUrl: string, input: Tip): Promise<Outcome<Tip>> {
  return createClient(baseUrl).addTip(input);
}
