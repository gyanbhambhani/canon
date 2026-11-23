import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface RecurringRequest {
  interval_days: number;
  occurrences: number;
  title: string;
}

export interface Recurring extends RecurringRequest {
  span_days: number;
}

/** Create a recurring event. */
export async function createRecurring(baseUrl: string, input: RecurringRequest): Promise<Outcome<Recurring>> {
  if (input.interval_days < 1 || input.interval_days > 365) return invalid("interval_days must be from 1 to 365");
  if (input.occurrences < 1 || input.occurrences > 52) return invalid("occurrences must be from 1 to 52");
  if (input.interval_days * input.occurrences > 365) return invalid("the span (interval_days * occurrences) is at most 365 days");
  if (/^[ \t\r\n]*$/.test(input.title)) return invalid("title must not be blank");
  return call(baseUrl, "POST", "/events/recurring", input);
}
