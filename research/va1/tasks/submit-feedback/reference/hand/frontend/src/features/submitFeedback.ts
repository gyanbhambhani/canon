import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Feedback {
  email: string;
  message: string;
  score: number;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Submit feedback. */
export async function submitFeedback(baseUrl: string, input: Feedback): Promise<Outcome<Feedback>> {
  if (!EMAIL.test(input.email)) return invalid("email must be an email address");
  const length = [...input.message].length;
  if (length < 10 || length > 1000) return invalid("message must have 10 to 1000 characters");
  if (input.score < 0 || input.score > 10) return invalid("score must be from 0 to 10");
  return call(baseUrl, "POST", "/feedback", input);
}
