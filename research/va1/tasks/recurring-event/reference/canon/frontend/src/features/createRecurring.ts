import { createClient } from "../canon/client";
import type { Recurring, RecurringRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Create a recurring event. */
export async function createRecurring(baseUrl: string, input: RecurringRequest): Promise<Outcome<Recurring>> {
  return createClient(baseUrl).createRecurring(input);
}
