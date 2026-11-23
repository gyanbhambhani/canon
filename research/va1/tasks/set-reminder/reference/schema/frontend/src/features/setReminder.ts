import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Reminder = components["schemas"]["Reminder"];

/** Set a reminder. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function setReminder(baseUrl: string, input: Reminder): Promise<Outcome<Reminder>> {
  return send(baseUrl, "POST", "/reminders", "Reminder", input);
}
