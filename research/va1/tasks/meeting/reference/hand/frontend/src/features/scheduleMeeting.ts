import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Meeting {
  title: string;
  start_hour: number;
  duration_min: number;
}

/** Schedule a meeting. */
export async function scheduleMeeting(baseUrl: string, input: Meeting): Promise<Outcome<Meeting>> {
  const titleLength = [...input.title].length;
  if (titleLength < 1 || titleLength > 60) return invalid("title must have 1 to 60 characters");
  if (input.start_hour < 0 || input.start_hour > 23) return invalid("start_hour must be from 0 to 23");
  if (input.duration_min < 15 || input.duration_min > 240 || input.duration_min % 15 !== 0) {
    return invalid("duration_min must be from 15 to 240 and a multiple of 15");
  }
  if (input.start_hour * 60 + input.duration_min > 1440) return invalid("the meeting must end by midnight");
  return call(baseUrl, "POST", "/meetings", input);
}
