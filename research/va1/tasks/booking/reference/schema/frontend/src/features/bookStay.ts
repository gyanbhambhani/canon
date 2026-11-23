import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type StayRequest = components["schemas"]["StayRequest"];
type Stay = components["schemas"]["Stay"];

/** Book a stay. The schema carries the single-field rules; the rules over `start` and `end` are written here too. */
export async function bookStay(baseUrl: string, input: StayRequest): Promise<Outcome<Stay>> {
  return send(baseUrl, "POST", "/bookings", "StayRequest", input, (i: StayRequest) => {
    if (i.end <= i.start) return "end must be after start";
    if (i.end - i.start > 30) return "a stay is at most 30 nights";
    return null;
  });
}
