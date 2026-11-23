import { createClient } from "../canon/client";
import type { Comment } from "../canon/types";
import type { Outcome } from "./result";

/** Add a comment. */
export async function addComment(baseUrl: string, input: Comment): Promise<Outcome<Comment>> {
  return createClient(baseUrl).addComment(input);
}
