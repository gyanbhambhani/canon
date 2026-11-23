import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type TagDraft = components["schemas"]["TagDraft"];

/** Create a tag. Every rule is in the Pydantic model. */
export async function createTag(baseUrl: string, input: TagDraft): Promise<Outcome<TagDraft>> {
  return send(baseUrl, "POST", "/tags", "TagDraft", input);
}
