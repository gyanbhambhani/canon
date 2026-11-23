import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Comment {
  body: string;
}

/** Add a comment. */
export async function addComment(baseUrl: string, input: Comment): Promise<Outcome<Comment>> {
  if (input.body.trim() === "" || [...input.body].length > 500) return invalid("body must be present and at most 500 characters");
  return call(baseUrl, "POST", "/comments", input);
}
