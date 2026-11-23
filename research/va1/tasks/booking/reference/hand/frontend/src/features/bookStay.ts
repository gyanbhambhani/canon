import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface StayRequest {
  guest: string;
  start: number;
  end: number;
}

export interface Stay extends StayRequest {
  nights: number;
}

/** Book a stay. */
export async function bookStay(baseUrl: string, input: StayRequest): Promise<Outcome<Stay>> {
  if (input.guest.trim() === "" || [...input.guest].length > 40) return invalid("guest must be present and at most 40 characters");
  if (input.start < 0 || input.start > 365) return invalid("start must be from 0 to 365");
  if (input.end <= input.start) return invalid("end must be after start");
  if (input.end - input.start > 30) return invalid("a stay is at most 30 nights");
  return call(baseUrl, "POST", "/bookings", input);
}
