import { createClient } from "../canon/client";
import type { Poll } from "../canon/types";
import type { Outcome } from "./result";

/** Create a poll. */
export async function createPoll(baseUrl: string, input: Poll): Promise<Outcome<Poll>> {
  return createClient(baseUrl).createPoll(input);
}
