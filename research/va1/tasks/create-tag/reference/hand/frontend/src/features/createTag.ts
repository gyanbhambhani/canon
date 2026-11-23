import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface TagDraft {
  label: string;
  color: string;
}

const COLORS = ["red", "green", "blue", "gray"];

/** Create a tag. */
export async function createTag(baseUrl: string, input: TagDraft): Promise<Outcome<TagDraft>> {
  const length = [...input.label].length;
  if (length < 2 || length > 20) return invalid("label must have 2 to 20 characters");
  if (!COLORS.includes(input.color)) return invalid("color must be red, green, blue or gray");
  return call(baseUrl, "POST", "/tags", input);
}
