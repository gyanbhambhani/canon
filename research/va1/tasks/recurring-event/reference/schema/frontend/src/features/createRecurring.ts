import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type RecurringRequest = components["schemas"]["RecurringRequest"];
type Recurring = components["schemas"]["Recurring"];

/** Create a recurring event. The schema carries the single-field rules; the span rule is written here too. */
export async function createRecurring(baseUrl: string, input: RecurringRequest): Promise<Outcome<Recurring>> {
  return send(baseUrl, "POST", "/events/recurring", "RecurringRequest", input, (i: RecurringRequest) => {
    if (i.interval_days * i.occurrences > 365) return "the span (interval_days * occurrences) is at most 365 days";
    return null;
  });
}
