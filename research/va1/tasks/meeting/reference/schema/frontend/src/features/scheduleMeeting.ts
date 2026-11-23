import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Meeting = components["schemas"]["Meeting"];

/** Schedule a meeting. The schema carries the single-field rules; the computed rule is written here too. */
export async function scheduleMeeting(baseUrl: string, input: Meeting): Promise<Outcome<Meeting>> {
  return send(baseUrl, "POST", "/meetings", "Meeting", input, (i: Meeting) => {
    if (i.start_hour * 60 + i.duration_min > 1440) return "the meeting must end by midnight";
    return null;
  });
}
