import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface AgeRange {
  min_age: number;
  max_age: number;
  title: string;
}

/** Set the age range of an event. */
export async function setAgeRange(baseUrl: string, input: AgeRange): Promise<Outcome<AgeRange>> {
  if (input.min_age < 0 || input.min_age > 120 || input.max_age < 0 || input.max_age > 120) return invalid("ages must be from 0 to 120");
  if (input.min_age > input.max_age) return invalid("min_age must be at most max_age");
  if (/^[ \t\r\n]*$/.test(input.title) || [...input.title].length > 60) return invalid("title must be present and at most 60 characters");
  return call(baseUrl, "POST", "/events/ages", input);
}
