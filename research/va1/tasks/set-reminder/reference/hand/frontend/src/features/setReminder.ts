import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Reminder {
  minutes_before: number;
  channel: string;
}

const CHANNELS = ["email", "sms", "push"];

/** Set a reminder. */
export async function setReminder(baseUrl: string, input: Reminder): Promise<Outcome<Reminder>> {
  if (input.minutes_before < 5 || input.minutes_before > 1440) return invalid("minutes_before must be from 5 to 1440");
  if (!CHANNELS.includes(input.channel)) return invalid("channel must be email, sms or push");
  return call(baseUrl, "POST", "/reminders", input);
}
