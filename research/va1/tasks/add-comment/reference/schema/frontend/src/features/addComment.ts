import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Comment = components["schemas"]["Comment"];

/** Add a comment. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function addComment(baseUrl: string, input: Comment): Promise<Outcome<Comment>> {
  return send(baseUrl, "POST", "/comments", "Comment", input);
}
