import { createClient } from "../canon/client";
import type { Reminder } from "../canon/types";
import type { Outcome } from "./result";

/** Set a reminder. */
export async function setReminder(baseUrl: string, input: Reminder): Promise<Outcome<Reminder>> {
  return createClient(baseUrl).setReminder(input);
}
