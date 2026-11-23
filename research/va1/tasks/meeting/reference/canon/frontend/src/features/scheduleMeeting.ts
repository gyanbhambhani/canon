import { createClient } from "../canon/client";
import type { Meeting } from "../canon/types";
import type { Outcome } from "./result";

/** Schedule a meeting. */
export async function scheduleMeeting(baseUrl: string, input: Meeting): Promise<Outcome<Meeting>> {
  return createClient(baseUrl).scheduleMeeting(input);
}
