import { createClient } from "../canon/client";
import type { TagDraft } from "../canon/types";
import type { Outcome } from "./result";

/** Create a tag. */
export async function createTag(baseUrl: string, input: TagDraft): Promise<Outcome<TagDraft>> {
  return createClient(baseUrl).createTag(input);
}
